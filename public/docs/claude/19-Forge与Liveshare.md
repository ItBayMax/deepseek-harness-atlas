# 19 · Forge 与 Liveshare

> 基线：`dsh@0.2.3-alpha.2`（上游 commit `4b399c3`）· 本篇为 0.2.3 全新
> 两个在 0.2.1 → 0.2.3 之间从无到有的子系统，各自带官方 `docs/subsystems/` 文档。

## 〇、一句话

| | 是什么 | 默认状态 |
|---|---|---|
| **Forge** | 从代码托管平台读取**变更请求**（PR / MR）的 provider-neutral 能力接缝 + 把它们绑到 Session + 一整套评审 GUI | 可选 bundle，**出厂关闭** |
| **Liveshare** | 把自己的 Session **单向分享**给外部 viewer，viewer 在 owner 的页面里驱动那个 Session | **更深的关闭**——连插件页都不列它 |

## 一、Forge

### 名字不是比喻

`forge` 用的是业界既有术语 **software forge**（SourceForge 之后泛指代码托管 + 协作平台）。
代码里它就是一个家族名字段，取值 `'github'` / `'gitlab'`。

配套的命名决策更值得注意：用 **change request** 这个中立名词统一 GitHub 的 pull request
和 GitLab 的 merge request，再由 `ForgeProvider.changeRequestNoun: 'pull-request' | 'merge-request'`
决定界面上显示哪个词。

> **可抄的做法**：接多个平台时，**先给概念起一个两边都不偏的名字**，
> 再把"叫法"降级成 provider 的一个字段。而不是选一边的词当通用词。

### 五个包的分工

官方文档一行写死（`docs/subsystems/forge.md:5`）：

| 包 | 角色 | 接缝 |
|---|---|---|
| `experimental/forge` | Service Definition | `ctx.forge`（33 个方法，Host 本地，无 `@Remote`） |
| `forge-github` / `forge-gitlab` | Service Provider | — |
| `experimental/forge-session` | Consumer | `ctx.forgeSession`（6 个方法） |
| `experimental/client-ui-forge` | GUI Consumer | `ctx.forgePanel`（约 50 个 `@Remote`） |
| `experimental/forge-bundle` | 组合上述五个 + worktree 工具/服务 | — |

挂载本身只要两行 YAML：

```yaml
- name: '@deepseek-ai/dsh-experimental-forge'
- name: '@deepseek-ai/dsh-experimental-forge-github'
```

### 它最"巧"也最容易误判的一块：绑定来源

`forge-session` 把 Session ↔ change request 的绑定，**从 Session log 里的 shell 结果折叠出来**：

| origin | 怎么来的 |
|---|---|
| `created` | `gh pr create` 的输出里出现了 URL |
| `referenced` | `gh pr view` 之类引用命令 |
| `discovered` | `git push` 之后按 head 分支反查 |
| `tracked` | 调用方显式绑定 |

绑定本身是 Session log 里的插件记录（`plugin:forge-session/binding`，
payload 只有 `action: 'track' | 'dismiss' | 'discover' | 'reference'` 和 `url`），
**在 model-visible conversation 之外，不进模型请求**。

> **这是"事后记账"而不是"事前编排"**：它观测 agent 自己跑过的命令，倒推出绑定关系。
> 好处是零侵入——agent 不需要知道 Forge 存在；代价是误绑，
> `forge-session` 的 Known Limitations 列了 9 条。

### ⚠️ 它目前是给人看的，不是给模型用的

两处白纸黑字：

- 📄 `packages/experimental/forge-bundle/README.md:67` —— **"The model has no tool for bound change requests yet."**
- 📄 `packages/experimental/forge-session/README.md` —— *"Model Experience: **None**, as bindings,
  discovery records, and polled status never enter model requests"*

`forge-bundle` 目前**唯一**的 Model Experience 是它顺带带进来的
`enter_worktree` / `exit_worktree` 两个工具。

### 它没有"谁可以让它干活"的概念

Forge **没有任何 Policy / Mandate / 允许名单 / 准入表**。它只借力三层既有机制：

1. **凭据 = 宿主机已登录的 CLI**。`readiness()` 返回 `'ready' | 'unauthenticated' | 'unavailable'`，
   未登录时把 `gh auth login --hostname <host>` 原样给用户。没有 token 托管、没有 per-user 授权。
2. **Git 查询用 Session 自己的权限**。决策记录明确否掉了"面板自己搞一套只读策略"的做法——
   *"The Session remains the authority for filesystem permissions"*。
3. **评审页的 Remote 走 remote-access**：`review*` 方法**不绑 Session 资源**，
   因此只有有权使用宿主代码托管凭据的 Peer 能调到——这正是 Liveshare 的 `share-viewer` 被挡在外面的机制。

## 二、Liveshare

### 是"单向外分享"，不是对等协作

owner 把一个或多个自己的 Session 发布出去，外部 viewer 通过**独立部署的 Liveshare server（Relay）**
打开 **owner 自己的 Web 页面**并驱动那个 Session。Relay 自己从不加载 owner 代码。

安全姿态写在子系统文档第一句（`docs/subsystems/liveshare.md:5`）：

> A viewer **never receives the owner's tools**: the owner host reads each viewer request itself,
> dispatches it as that viewer's own Peer, whose `share-viewer` principal the Gateway decides
> through the remote access policy this package registers, and **constrains everything a shared
> Session runs on the viewer's behalf to the workspace the share granted**.

### 权限分级：两档 tier + 一个独立的 fork 开关

| Tier | viewer 能做 | 执行限制 |
|---|---|---|
| `view` | 给源 Session 发提示词、停掉它正在跑的轮次 | **只读沙箱**：`read`/`read_image`/`glob`/`grep`/`present`、无本地文件副作用的工具、以及 PTC 传输 `run_code`；每个调用声明的路径都对照被授予的 workspace 检查 |
| 两档皆可 | 管理源 Session 的 goal（建/改/暂停/恢复/完成/清空） | 无额外限制——goal 是 Session 数据，不是 workspace 内容 |
| `write` | 外加在该 workspace 内改文件 | 可写沙箱：view 的面 + 受限的 `edit`/`write` |

**天花板是代码里的常量，不是配置**（`packages/experimental/liveshare/src/host/fork-policy.ts:141-162`）：

```ts
export const READ_ONLY_FORK_CEILING: ForkCeiling = {
  readOnly: true,
  allowedTools: sharedToolNames('view'),
  deniedCapabilities: [
    'bash', 'pwsh', 'cua', 'plugin_manager',
    'schedule_create', 'schedule_list', 'schedule_delete', 'schedule_update',
    'write', 'edit', 'settings-write', 'credentials',
    'plugin-self-modification', 'subagent', 'workspace-write', 'share-management',
  ],
}
```

类型注释写明：这是 **"the ceiling the Host enforces on the child, not a set of settings a client may raise"**。

### 三个值得单独记的设计

**① 按 turn 限制，不按 Session 限制。** 约束层挂在 Session 上，但只约束
**share viewer 发起的那些轮次**。`agent/pre-step` 在 **Host 内存**里记下这一轮的
admitted input 是不是 viewer 发起的，**永不写进 Session log**。
owner 自己发起的轮次保留原生工具（含 `bash`）；owner 在 viewer 的轮次里插话也一起被限制。

**② 撤销语义分得很细。** 只有 Relay 回 **404/410**（"我没有这个 share"）才算撤销；
**401/403** 只结束 admission（不再服务新输入，已开的调用/流释放，owner 自己的轮次继续）；
**超时或读不懂则什么都不动**，但 viewer 入口保持拒绝直到读成功。

> 这个三分法值得抄：**"对方明确说没有" ≠ "我暂时问不到"**。
> 很多系统把两者都当成"撤销"，于是一次网络抖动就误伤。

**③ 文档自己加粗标出了一个大洞**（`packages/experimental/liveshare/README.md:94`）：

> **Shared PTC programs are not sandboxed to the share.** `run_code` is admitted at both tiers
> because a viewer may need programmatic tool use, but the program runs under the owner's
> standing file policy rather than a share tier: it can read and write files outside the shared
> workspace… **Share only with people you trust** until a PTC sandbox can be bounded to a share.

还有两条次要但会咬人的：
- **降级不保证立即生效**：`write` → `view` 只让后续写被拒，*"does not promise immediate cancellation of a running turn"*
- **viewer 的 stop 会停掉 owner 的轮次**：取消不做 per-viewer 比较

### 默认关闭的程度比 Forge 更深

> 📄 `packages/experimental/liveshare/README.md:38`
> A dsh installation ships this package as a runtime dependency, but no shipped profile selects
> its bundle, so none of its plugins run and **the plugin manager lists it in neither Built-in
> plugin settings nor Experimental plugins, including the More page**.

必须手工往 profile 的 `cordis.patch.yml` 插一条带
`ownerIdentityProvider` / `ownerIdentityTenant` / `ownerIdentitySubject` /
`allowedSubjectIds` / `ownerStateFile` 的 entry。

## 三、顺带：`action-cards` —— 本轮唯一默认开启的新原语

`packages/interaction/action-cards`（注意：**无 `experimental-` 前缀**，在 `interaction/` 组下）。

机制一句话（`README.md:12`）：

> The model loads the feature's skill and **ends its answer with an `action-card` block** that
> names the action; the browser half hides the block, **the card appears after the turn ends,
> and nothing runs until the user acts on it**.

- 卡片 = 回答末尾一个 ` ```action-card ` 围栏块，内容是 JSON（`action` / `title` / `brief` / `details`）
- **一个 turn 只认第一个合法块**；reasoning 里的、被打断的、subagent 里的、标题为空的，统统不生成卡片，**而且不告诉模型**
- 用户点了之后记录 decision，下一次请求带一条状态通知，前缀原文是：
  *"These are status facts, **not a request to start or retry work**."*
- **Token 成本极低**：无 tool 声明、无 tool result，块本身就是回答文本的一部分（实测两个 kind 分别 237 / 525 字符），**KV cache 影响为 None**

> **这是一个很漂亮的原语**：想让模型"提议一个动作"，常规做法是加一个 tool——
> 要付 tool 声明的常驻 token、要处理 tool result、还要防止模型自作主张直接执行。
> action-card 把"提议"降级成**回答文本的一部分**，把"执行"留给用户点击，
> 两头的成本都省掉了。

## 四、⚠️ 对我们自己项目的三条结论

### ① Forge **不是** `dsh-superagent-prototype` 的收编

这条我亲自核过。证据：

- **整个 harness 仓库里 `superagent` 零命中**（`.md` / `.ts` / `.yml` / `.json` 全扫）
- Forge 是**纯拉模式**：没有 webhook、没有事件入口、没有自动建 Session 的路径
- **它连给模型的工具都还没有**（上面引过原文）
- 它的绑定是**观测 agent 跑过的 shell 事后记账**，方向和 superagent 的
  「外部事件 → 决策 → 开工」完全相反
- 它**没有任何授权概念**（见上节）

**主线里和 superagent 同层的其实是 `experimental/webhook` + `webhook-github`
——而这两个包在上一基线就已存在，本轮没动。**

> 所以 superagent 方向的 **Policy / Mandate / 准入表 / strength 这套授权资产，
> 主线这一轮完全没碰**。这是差异化仍然成立的地方。
>
> 但 Forge 提供了一块**可以吃掉的基础设施红利**：
> `ctx.forge` 已经把「GitHub/GitLab 抽象、批量状态轮询 + 退避、diff/文件读、
> review thread 读写、mergeability/checks 归一化、`ForgeFailure` 错误码体系」做成了可注册接缝。
> 自建 GitHub 客户端那一层可以换成挂在 `ctx.forge` 上。

### ② `experimental/timeline` 与 `dsh-replay-theater` 功能重叠接近 0

Timeline 是**任务树 + 进度条 + 定时报告**，不是回放：

- 它**不读 `assistant/message.stream`**，不碰 `AssistantStreamRecord` / `dt`，没有 token 级时序概念
- 没有传输条、没有 play/pause/seek/speed、没有标记轨、没有两份日志的分叉比对
- 唯一字面撞车的是 CSS 类名 `.timeline-playback`——但那是**任务的暂停/继续按钮**

重叠只在三个非功能层面：**右侧栏地产之争**（同期还新增了 `ui-session-panel`、
`ui-session-status`、`terminal-panel`，右栏越来越挤）、都走 Session projection、
以及概念上都是"这个 Session 的时间维度视图"。

> 命名上建议继续强调 **replay / 原速回放 / token 节奏**，避免用 "timeline" 一词。

### ③ ⭐ 但有一个**先例信号**，比功能重叠更值得注意

📄 `packages/experimental/timeline/README.md:79`：

> The report scheduler **adapts ideas from
> [dsh-progress-check](https://github.com/kermanx/dsh-progress-check), under the MIT license**.

以及 `:63` 的迁移说明：

> Export a tree from **the standalone plugin** before switching to this edition,
> then import the file here. **Disable the standalone plugin before enabling this edition.**

**上游这一轮确实做过一次「把一个社区独立插件吸收成第一方 experimental 包」的动作**，
并给出了"先导出、禁用旧插件、再启用官方版"的完整迁移路径。

Timeline 这次吸收的不是回放，但**这个模式本身说明：一个做得好、被团队用起来的 dsh 插件，
有被官方做成第一方包的实际路径**。

> 对 `dsh-replay-theater` 的含义：**功能上现在安全，但"没人做过"不是壁垒**。
> 差异化应该押在上游目前明显不碰的地方——**精确到 `dt` 的原速重放、两次运行的分叉比对**，
> 而不是押在"这个方向还没人进"。
