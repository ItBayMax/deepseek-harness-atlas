# Agent 循环与会话日志 —— dsh 的"心脏"

> 本文是 Claude 基于源码阅读的独立解读，非官方文档。对应源码：
> `packages/core/agent-loop/src/agent.ts`（驱动器）、`packages/core/agent/src/inbox.ts`（收件箱）、`packages/core/session/src/types.ts`（事件词汇表）。

## 一句话总结

**dsh 的一切都围绕一条 append-only 的会话日志（Session Log）转**：模型看到的历史是从日志"投影"出来的，UI 是从日志渲染出来的，恢复/分叉/遥测/持久化全部派生自这条日志。驱动 Agent 的循环（`ReactLoopAgent`）只做一件事：把收件箱里的消息变成日志事件，把日志事件变成模型请求，把模型响应变成工具执行，再全部记回日志。

## 核心分层：turn / step / round

| 概念 | 含义 | 源码锚点 |
|---|---|---|
| **step（步）** | 一次模型请求 + 该响应触发的全部工具执行 | `agent.ts` 中 `private async step()` |
| **turn（轮）** | 一次输入排空过程，包含 0 或多个 step；开于首个输入被认领前，闭于"不再欠任何东西"时 | `agent.ts` 中 `private async turn()` |
| **round（回合）** | 外层策略迭代（如 goal round、Ralph round），归属策略而非循环本身 | `packages/goal/`、`packages/workflow/tool-ralph/` |

一个关键设计：**turn 可以是零 step 的**。如果 `agent/pre-step` 拒绝了消息、或首次认领被改写为空，turn 仍然开闭一次并记录 `turn/start`/`turn/end`——日志必须记下"曾经尝试过"这一事实。

## 驱动器状态机：三相 Phase

`ReactLoopAgent` 内部是一个三态状态机（`agent.ts:38`）：

```ts
type Phase =
  | { kind: 'idle'; lastTurn: number }
  | { kind: 'maintenance'; abort: AbortController; lastTurn: number; wakeRequested: boolean }
  | { kind: 'running'; abort: AbortController; turn: number; step: number; wakeRequested: boolean }
```

- `idle`：无活动。唤醒（`wakeDriver`）从这里开启新 driver。
- `running`：driver 正在跑 `while (await this.turn()) {}`（见 `kick()`）。
- `maintenance`：独占维护窗口（如压缩 compaction 使用），期间到达的唤醒被"闩存"（latch），维护结束后重放。

状态迁移唯一入口是 `setPhase()`，它同时负责对外广播 `agent/status`（running/idle）——**对外只有两态**，maintenance 对外表现为 idle。

## 输入的三种进入方式

`Agent` 接口暴露三个方法，全部收敛到一个 `send(message, target, wakeup)`（`agent.ts:113`）：

| 方法 | target | 是否唤醒 | 语义 |
|---|---|---|---|
| `followup(msg)` | `next-turn` | ✅ | 排队一条用户消息，开启新 turn |
| `steer(msg)` | `next-step` | ✅ | 插入到当前 turn 的下一个 step（转向） |
| `inject(msg)` | `next-step` | ❌ | 注入上下文，**不唤醒**——空闲的 agent 保持空闲，注入内容等下一条唤醒消息到来时一起进入请求 |

这就是插件给模型"塞上下文"的统一通道：文件变更通知、子目录 AGENTS.md、技能内容、定时任务通知，全部走 `agent.inject()`，最终以 `user/message` 事件落日志（`source` 字段区分来源）。

一个细节（`send()` 内注释）：**唤醒消息不能加入已被中止的活动**——若当前 phase 的 abort 信号已触发，target 会被强制改为 `next-turn`，且该分类在插入收件箱**之前**捕获，防止 splice 观察者重入 cancel 导致重分类。

## 一个 turn 的完整旅程

对照 `turn()`（agent.ts:246）与 `step()`（agent.ts:332）源码，事件时序为：

```text
turn/start                          ← session.append，先落日志
  ├─ preStep(target)：
  │    1. inbox.claim(target, turn)         认领收件箱消息
  │    2. systemPrompt.assemble(...)        组装 prompt 分节 + 工具 schema
  │    3. dispatch.waterfall('agent/pre-step', ...)   ← 插件可改写/拒绝
  ├─ 拒绝 → turnEnds = blocked，零 step 关turn
  ├─ step/start
  │    ├─ user/message*                     认领的消息逐条落日志
  │    ├─ buildRequest()                    从 session.deriveMessages() 派生历史
  │    │    └─ agent/request waterfall      插件可改写请求配置
  │    ├─ llm.stream(request)               ← llm/stream waterfall 可包裹
  │    ├─ assistant/chunk*                  每个 token 级 chunk 落日志（回放保真）
  │    ├─ 流失败 → agent/request-error waterfall（可返回 retry）
  │    ├─ assistant/message                 组装后的完整消息 + usage，引用 chunk seqs
  │    └─ executeToolCalls()                tool/call → 管线 → tool/result（见 04 篇）
  ├─ step/end
  ├─ 无欠账且 next-step 空 → agent/turn-stopping（serial，插件最后的续命机会）
  └─ 还有 next-step 输入 → 认领 → 下一个 step
turn/end { reason }                 ← finally 里必然落日志
```

几个值得学习的工程细节：

1. **max-tokens 是"粘性"的**：一旦某 step 触顶，后续正常完成的 step 不能把 turn 的结局降级（`agent.ts:287-290`）。
2. **每个 turn 结束后换新 AbortController**（`agent.ts:325`），旧控制器上的闩存唤醒自动作废——活着的 driver 自己认领队列。
3. **错误结构化**：任何失败要么保留 `LlmError` 的结构化事实，要么压平成 `{ message: errorChain(error), code: 'UNKNOWN' }`，绝不丢失（`agent.ts:308-314`）。
4. **驱动器边界收容**：`kick()` 里 `catch (_error) {}` ——失败已在 `throwError()` 处通过 `agent/error` 事件上报过，driver 边界只负责收尾不再扩散。

## 会话日志：事件词汇表

`SessionEventMap`（`session/src/types.ts:236`）是**声明合并可扩展**的——插件加新事件类型就是往这个 map 里 merge。核心词汇：

| 事件 | 是否上"表面" | 用途 |
|---|---|---|
| `turn/start` / `turn/end` | 否 | turn 边界；`turn/end` 带结构化 `TurnEndReason` |
| `step/start` / `step/end` | 否 | step 边界 |
| `user/message` | ✅ | 人类输入 / inject 注入 / goal 续跑，`source` 区分 |
| `assistant/chunk` | 否 | 原始流 chunk，token 级回放保真 |
| `assistant/message` | ✅ | 组装后的助手消息 + usage，`sourceEventSeqs` 引用 chunk；取消时带 `interrupted: true`（见下文 rc.8 增量） |
| `tool/call` / `tool/result` | result ✅ | 工具调用与唯一模型可见结果；`meta` 承载 UI 卡片回放数据 |
| `todo/write` | 否 | 全量快照，last-write-wins，纯 UI 状态 |
| `request/header` / `request/context` | 否 | 请求头快照（config/system/tools）与路由元数据 |
| `session/end-seed` | 否 | 种子边界标记，区分继承历史与本次生命周期产出 |

### "表面"（Surface）机制 —— 压缩的基石

只有 `user/message`、`assistant/message`、`tool/result` 三种事件能上"有序表面"（ordered surface），即真正投影为模型历史。它们携带 `surfaceOp`：

```ts
type SurfaceOp = 'append' | { op: 'replace'; start: number; end: number }
```

`replace` 就是**压缩（compaction）的实现原语**：一条摘要消息替换表面上 start..end 的节点，被遮蔽的节点 seq 记入 `sourceEventSeqs`。日志本身不删任何东西——**表面变了，历史还在**，回放和审计永远完整。

### 铁律：模型可见 ⟺ 已落日志

任何到达模型请求的内容都必须能从日志重建，运行时不变量（invariant）会断言这一点。所以**给模型加新可见输入 = 加新会话事件类型**，没有旁路。这条铁律换来的能力：
- 无损 resume/fork（`sessions.fork(source, boundary?)`）
- 可重放的快照测试（keyless snapshot：录一次真 API，之后离线回放）
- UI 与模型视角永远一致

### 版本与兼容策略

`SESSION_FORMAT_VERSION = 0`（未发布期无兼容承诺）。事件级兼容用 `ignorable: true` 标记：读者遇到不认识且未标记 ignorable 的事件类型时**必须拒绝重建会话**而不是静默跳过——宁可"过度拒绝"（不便），不可"悄悄读坏"（灾难）。这是一个值得抄的防御性设计。

## 📌 rc.8 增量（rc.5 → rc.8，commit 47f9438 → 141eb6f）

### 取消的流也要"定稿"已送达前缀

rc.5 的问题：用户中途点停止，屏幕上已经渲染出的半截回答只存在于 `assistant/chunk`，没有 `assistant/message` 收口，`deriveMessages()` 会把它排除——下一句"第二点展开讲讲"时模型根本不知道自己说过什么，分支也继承这个缺口。

rc.8 的修复（[官方 Note](../deepseek-harness/.agents/notes/implemented/architecture/2026-08-10-cancelled-stream-prefix-finalize.zh.md)）：`ReactLoopAgent.step()` 在消费模型流时捕捉取消，用 `BlockAssembler.interruptedBlocks()` 取出**内容非空白的 text/reasoning 块**（省略工具调用——它们从未派发），追加为带 `interrupted: true`、`surfaceOp: 'append'`、`sourceEventSeqs` = 恰好已记录 chunk 的 `assistant/message`，然后才 `step/end` → aborted `turn/end`。

三个值得记住的细节：
- **用户取消 ≠ 提供方失败**：终局 provider error 仍丢弃已流出前缀——error 轮次的结束不是用户决定，不对称是有意保留的。
- UI 从持久的 `interrupted` 标记渲染 Stopped 标签，回放同样成立（模型可见 ⟺ 已落日志的又一次胜利）。
- 工具执行期取消不受影响：assistant 消息已提交，未派发的调用拿 `ABORTED_BEFORE_DISPATCH` 结果。

### SQLite 持久化：schema 17 物理分片打包

token 级 `assistant/chunk` 让标量 SQLite 布局一行一事件，105 会话语料膨胀到 709 MB。rc.8 的 schema 17（[官方 Note](../deepseek-harness/.agents/notes/implemented/architecture/2026-08-18-sqlite-physical-chunk-row-compression.zh.md)）引入**物理打包行**：

- 一个物理行打包最多 **1024 个连续 chunk 事件 / 1 MiB 原文**，存储标签 `text-chunks` / `reasoning-chunks` / `tool-call-chunks`（这是**存储词汇，不是 SessionEventMap 成员**——逻辑事件流一个字都没变）。
- `data` ≥ 4 KiB 时用 **Zstandard level 3** 压缩（仅在压得更小时保留）；`sourceEventSeqs` 用 varint + ZigZag 差值编码。
- 实测：**体积 -89.4%**（709.57→75.01 MB）、写入快 19.4%、完整读取 p50 快 56%、250 万物理行 → 65,810 行。
- 防御性依旧拉满：`synchronous=FULL` 显式钉死（防 SQLite 构建默认值削弱持久性）；预发布**不做迁移**，旧库直接拒绝；外部 SQL 工具必须用提供方解码器。

**教学价值**：这是"物理表示与逻辑契约分离"的教科书案例——回放、`sourceEventSeqs`、UI 保真、恢复语义全部不变，变的只是磁盘布局。对比被否掉的方案（合并逻辑事件、周期性压缩器、逐 payload 压缩）比结论本身更值得读。

## 与上层的关系

- **UI/SDK 消费 `session/event`**（可回放的事实流），**live 协调走 `agent/*`**（inbox/status/pre-step/request/turn-stopping）——两个域职责分明。
- 子代理（subagent）、goal 续跑、Ralph 循环都不改这个循环——它们要么造新 agent，要么通过 `followup()`/事件监听在外面"包"一层。**"新行为 = 挂插件，永不改循环"** 是整个仓库的第一架构纪律。
