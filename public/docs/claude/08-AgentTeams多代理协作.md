# Agent Teams 多代理协作 —— 持久花名册、信箱与任务板

> 🆕 本篇是 rc.8 增量（rc.5 → rc.8）新增内容。对应源码：`packages/experimental/agent-team` + `packages/experimental/tool-agent-team`；官方文档 `docs/subsystems/agent-team.md`；决策档案 `.agents/notes/implemented/feature/2026-08-05-agent-teams.zh.md`。

## 一句话总结

Agent Teams 在**已有的 subagent 接缝之上**叠一个持久协作域：具名花名册（roster）+ 点对点信箱（mailbox）+ CAS 任务板（task board），全部状态落在 Lead 的会话日志里——**协作也是事件溯源的**。

## 为什么 subagent 不够用

rc.5 的 `ctx.subagents` 已经有 fresh/fork provider、持久子会话、FIFO follow-up。但它是严格的**父子关系**：

- worker 之间**无法互相寻址**（没有 peer 通讯）
- 没有稳定的**具名成员表**（模型只能拿到不透明 id）
- 没有**共享任务板**防止两个 worker 抢同一件事（陈旧 assignment 无从检测）

Teams 补的就是这三块，而且刻意**不重造**子代理机制——创建、打断、排空全部委托回 `ctx.subagents`（rc.8 为此给接缝加了 `startContinuable({ childId })` 预留 id、`drainContinuableChildren()` 两个能力）。

## 数据模型：没有"创建 Team"这回事

**每个普通运行时根会话都是一个隐式 Team 的 Lead，`TeamId` 就是它的 `SessionId`。** 没有 creation event——身份免费，持久状态从第一条 member/message/task 事件才开始。这是"隐式身份 + 惰性物化"的漂亮设计。

四个新会话事件（声明合并进 `SessionEventMap`，**只存 Lead 会话**）：

```ts
// packages/experimental/agent-team/src/types.ts:203
declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    'team/member':            { version: 1; teamId: TeamId; member: TeamMemberSnapshot }   // 成员生命周期全量快照
    'team/task':              { version: 1; teamId: TeamId; task: TeamTaskSnapshot }       // 共享任务全量快照
    'team/message/queued':    { version: 1; teamId: TeamId; message: TeamMessageSnapshot } // 投递前先入队
    'team/message/delivered': { version: 1; teamId: TeamId; messageId: TeamMessageId; targetId: SessionId }
  }
}
```

`foldTeam(rootId, events)` 回放这四种事件重建全部状态，并按 `teamId` 过滤——**普通 fork 是新的 Root**，继承日志里别人的 Team 记录会被排除。这延续了 03 篇的铁律：一切可恢复状态从日志派生。

角色只有两级扁平：`lead | teammate`。名字是不可变小写 kebab-case（≤64 字符，不许叫 `lead`），**失败的成员永久占用名字**——身份不静默回收，让 provisioning 失败保持可见。

## 创建协议：先记账，再生娃

```ts
// packages/experimental/agent-team/src/roster.ts:267（节选）
await this.journal.transact(root.id, async () => {
  // 名字查重后，先追加并 flush 'provisioning' 快照 —— 子会话还不存在！
  await this.journal.appendAndFlush(root, 'team/member', { version: 1, teamId: TeamId(root.id), member })
})
started = await this.ctx.subagents.startContinuable({
  childId,                     // 调用方预留的子会话 id（rc.8 新增的接缝能力）
  provider: request.provider,  // fresh 走 spawn、fork 走 fork，模型永远不直接点名 provider
  request: { prompt: request.prompt, parent: root },
})
await this.checkpointInitialPrompt(childId, started.messageId, signal)
// 成功 → 追加 'active' 终态；失败 → 追加 'failed' 终态
```

顺序是精心设计的：**日志先于现实**（provisioning 记录先落盘，子代理后启动）。进程崩溃后恢复时，`reconcileProvisioning()` 拿未终结的记录去和子会话的独立持久化对账——直接父子关系匹配 + continuable 描述符匹配 + 已记录初始用户消息，三证齐全才转 `active`，否则转 `failed`。竞争产生 `TEAM_PROVISIONING_CONFLICT` 并排空孤儿，绝不遗留。

## 信箱：queued → delivered 两段式事务

Peer 通讯完全走 Lead 日志：投递前先 `team/message/queued` 落盘，target 会话确实记录了消息之后才写 `team/message/delivered` 回执。恢复时按"queued 减 delivered"重试，target 侧靠消息 id 去重（id 同时出现在持久 source 元数据和正文首行前缀里）：

```ts
// packages/experimental/agent-team/src/mailbox.ts:314
private deliveryContent(message: TeamMessageSnapshot): ContentBlock[] {
  return [
    { type: 'text', text: `Team message ${message.id} from ${message.senderName}:` },
    ...structuredClone(message.content),
  ]
}
```

两种投递语义对应两个工具（同一工厂生成）：
- `send_message`（**quiet**）：立即注入但**不唤醒**——inactive 的成员保持 queued，直到它因别的原因活过来（呼应 03 篇 inject 的"空闲保持空闲"哲学）。
- `followup_task`（**wakeup**）：成为 target 的下一个 FIFO turn，可冷恢复。

诚实的边界声明：进程内重试 + target 会话去重，**不宣称跨进程 exactly-once**。

## 任务板：CAS + DAG + 只警告不上锁

共享任务是带单调 `revision` 的全量快照，每次变更必须带 `expected_revision`（compare-and-set，陈旧更新直接拒绝）。依赖必须构成 DAG；删除留 tombstone；数字 id 永不复用。

最有意思的是 `writeScopes`（规范化路径前缀）：**只产生重叠诊断警告，绝不阻止 claim、绝不授予写权限**。官方在决策档案里说得很直白：所有成员共享同一个 checkout，Bash/formatter/外部写入都能绕过任何"文件锁"——*虚假的互斥保证比明确的 warning 更危险*。这是"诚实边界"设计哲学的又一例。

## 模型看到的十个工具

`tool-agent-team` 监听 `agent/created`，对每个 Team 成员**在其 agent 作用域内**（`agent.ctx`，见 03 篇 scope 机制）注册十个工具 + 一节 `team:policy` 提示词：

| 工具 | 谁能用 | 干什么 |
|---|---|---|
| `spawn_teammate` | 仅 Lead | 创建具名成员（`context: fresh\|fork` 选提供方） |
| `send_message` / `followup_task` | 所有成员 | quiet / wakeup 两种投递 |
| `list_agents` / `wait_agent` | 所有成员 | 花名册视图 / 等下一条状态边（防轮询；无活跃对端时立即返回 no-progress） |
| `interrupt_agent` | 仅 Lead | 保留 inbox 的打断（委托给 subagent 接缝） |
| `team_task_create/list/get/update` | 所有成员 | 任务板 CRUD；update 是 CAS 的 `claim/release/edit/complete/reassign/delete…` |

细节见微知著：每个工具都声明**完整输出 schema** 并用 `JSON.stringify` 紧凑渲染——编译器检查 `execute` 是否兑现对模型的承诺，且不为缩进花一个 token。

注意坑：`send_message`/`list_agents`/`interrupt_agent` 与旧的 `tool-subagent-control` 全局工具**同名**，作用域注册会遮蔽（shadowing）全局——同时挂载两者的组合必须 disable 旧行。

## 实验包机制（同样是 rc.8 新事物）

两个包住在 `packages/experimental/`，命名 `@deepseek-ai/dsh-experimental-*`（前缀而非后缀，npm 上聚成一个可搜索命名空间）、`private: true` 不发布、发布包禁止依赖它们；**毕业 = 改名搬出目录，一次原子改完所有引用**。稳定性等级用包名声明而不是 runtime flag——workspace 约束门禁可静态强制，值得抄。

Team 工具还是**显式挂载**的：默认组合不含它，delegation 策略只允许在用户明确要求 Agent Teams 时创建——不给简单任务偷偷加延迟和 token 成本。

## 与全仓架构的呼应

| 全仓纪律 | Teams 的体现 |
|---|---|
| 模型可见 ⟺ 已落日志 | 四种 team 事件；信箱两段式事务；恢复=对账重放 |
| 新行为=挂插件，不改循环 | agent-loop 零改动；一切经 scope 注册 + subagent 接缝 |
| Fail-closed / 诚实边界 | 失败成员占名不回收；writeScopes 只警告；不承诺 exactly-once |
| 能力接缝三角色 | Teams 是 subagent 接缝的**消费者**，不是平行机制 |

## 已知边界（官方自己列的）

单进程单 checkout（无 worktree/合并语义）；花名册扁平不可嵌套不可改名；任务 owner 不因 idle/退出自动释放；无浏览器端任务板 UI；不自主启用。配额默认：8 成员 / 256 任务 / 每成员 64 条待投递 / 单条消息 64 KiB。
