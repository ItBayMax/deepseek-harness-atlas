# Web 客户端与外部协议 —— 浏览器里也是一棵 Cordis 树

> 本文是 Claude 基于源码阅读的独立解读，非官方文档。对应源码：
> `packages/client/web/src/boot.tsx`、`packages/client/modules/`、`packages/client/ui-conversation/`、`packages/client/ui-slots/`、`packages/api/gateway/`、`packages/sdk/`、`packages/acp/acp/`、`python/sdk/`。

## 最反直觉也最漂亮的设计：浏览器端复用同一个 Loader

`dsh web` 的前端不是普通 SPA。`apps/web/src/main.ts` 只有一行——真正的引导在 `packages/client/web/src/boot.tsx`（`AppWebEntry`）：

```text
1. 解析服务端注入的 window.__DSH_BOOT__（{ rev, modules[], plugins[] }）
2. 构建 ClientModuleSystem（浏览器版模块表）
3. 挂 vendored Loader，然后关键一步：
      loader.internal = this.modules   // 浏览器模块表冒充 Node 的 ESM loader
4. 每个 graph 行 loader.create({ name })，loader.await()，fail-loud 巡检
```

**同一套 Loader/fiber/inject 机制在浏览器里原样运转**——服务端 Cordis 树和浏览器 Cordis 树是"同构"的，只是代码到达方式换成了 HTTP。

- 哪些插件进浏览器，由**宿主组合决定**：`bundle/web-app/cordis.patch.yml` 里的行只要 package.json 声明了 `dsh.client`，模块宿主（`ctx.clientModules`）就扫进 `__DSH_BOOT__` 并在 `/plugins/<id>/client.js` 提供 bundle。删一行 yml，对应 UI 面板消失。**前端壳零组合决策。**
- 客户端 bundle 是"懒 CJS 闭包工厂"：脚本只注册 factory，副作用（含 CSS 注入 `<style data-plugin>`）在物化时才发生——这让 HMR 能先预取新 bundle 再拆旧 fiber，失败不留半成品。
- 客户端 HMR：宿主轮询 bundle 变化 → SSE `/plugins/events` 推 `{type:'rebuilt', id, rev}` → 浏览器 invalidate → prefetch → `registry.delete` → 拆旧样式 → `entry.refresh()`。依赖级联靠 Cordis 纪元机制自动完成，客户端不做图分析。

## 浏览器 ↔ 宿主：四层通信栈

> ⚠️ **本节的 rc.8 描述已被 0.1.2 推翻**：`apiproxy` 包与 `ctx.apiProxy` 已删除、两条下行 WebSocket 合为一条多路复用通道、特权方法 loopback 名单被浏览器令牌认证取代。原文保留以对照演进，**新架构见本篇末尾的 0.1.2 增量**。

```text
remotes（显式选择哪些 Remote 暴露） 
  → gateway（Typert 描述符 → 校验/查找/派发）
    → connection（/api 路由 + 两条只下行 WebSocket）
      → webserver（哑 node:http 载体）
```

**Typert** 是这套里最有野心的部件：编译期用 TypeScript Program 反射（`typert/generator`，3000 行 analyzer）从 `@Remote` 装饰的服务方法生成调用描述符 + Zod 编解码器，产物写进各包 `lib/typert.host.js` 与 `typert.remote-client.js`。运行时：

- 复杂宿主对象**从不过线**：参数类型是 `Agent` 的，wire 上变成 `agentId`，网关在宿主侧解析回真对象（`TypertLookupMap`）。
- 客户端 `ctx.remote.<namespace>.<method>()` 不是 JS Proxy，是把生成的描述符装成**具体函数**。
- 错误分类稳定：`arguments-invalid` / `lookup-unavailable` / `service-unavailable` / `result-invalid`……
- 没有描述符的旧端点回落到 `apiproxy`（手写 BFF，Zod 双层校验）。

安全细节：每个 `/api` 入口必须是 loopback Host 或声明过的 `trustedHosts`（防 DNS rebinding）；特权方法（目录选择、settings/credentials 全平面）钉死 loopback。

## Chat UI：三段式渲染管线

1. **事件折叠（framework 无关）**：`ConversationNodeDefinition` 声明 `match/start/update`，把 `session/event` 流折成带稳定 key 的节点上下文。内建定义（`ui-conversation/src/client/conversation-nodes/`）：inbox、message、assistant、tool、command、compaction、retry、turn-error、fallback……
2. **声明合并类型**：每个节点 kind 往 `ChatNodeDataMap` merge 自己的 payload 类型——和 `SessionEventMap` 同一招。
3. **keyed slot 渲染**：`ui-slots` 是零依赖内核，slot 有 `single/list/keyed/chain` 四种；**声明即认领**（只有声明子 key 的 entry 才能渲染它）。派发点 `ChatNodeSeat.tsx` 每节点一个 seat——assistant 增量不会重渲染兄弟节点。未注册的 kind 渲染 JSON 兜底，**绝不崩**。

职责分离的范本：`ui-conversation` 拥有**布局位**（`conversation.chat.node`），`ui-tool` 作为独立插件认领 `tool-call` key 并再开子 slot `tool.call.toolview` 给每工具视图（bash/read/diff/search/web/todo…）。加一种新聊天行 = 挂一个插件，不改任何内建代码。

## 外部协议：三张脸

| 面 | 包 | 协议 | 语义要点 |
|---|---|---|---|
| **JSON-RPC SDK** | `sdk/{protocol,server,client}` | stdio 换行分隔 JSON-RPC | 3 请求（initialize/session·prompt/shutdown）+ 4 通知；`session/prompt` 返回**入队回执**（messageId），不等 turn 结束 |
| **Python SDK** | `python/sdk` + `sdk-runtime` | 同上（设计孪生，独立实现） | 唯一带**捆绑运行时**的：单文件 Node exe + 内置 cordis.yml，`with DeepSeekHarness() as h: h.run("Say hi.")` 零配置可用 |
| **ACP** | `acp/acp` | Agent Client Protocol（Zed 系编辑器） | 纯自动化：只发**已提交**的 assistant 文本（不发原始 delta/推理），`session/prompt` 等到整体 idle 才返回 stopReason |

对比记忆：SDK 是"回执 + 事实流"（订阅 `session.event` 自己拼），ACP 是"等待到静止 + 摘要区间"。两种模式在 `docs/cookbook/extension-cookbook.md` 的协议驱动一节里被点名为两条正统路径。

值得注意的闭环：`dsh-subagent-acp` 让 dsh 可以作为 ACP **客户端**驱动另一个 dsh（或任何 ACP agent）——协议既是对外接口，也是子代理传输。

## 📌 rc.8 增量（rc.5 → rc.8）：客户端壳层大重构

这是本次版本差异里改动最大的区域。`web-react` 和 `schema-form` 两个包被**删除**，客户端重排成五层（[官方 Note](../deepseek-harness/.agents/notes/implemented/architecture/2026-08-15-client-shells-and-dynamic-packages.zh.md)）：

| 层 | 成员 | 形态 |
|---|---|---|
| Vite 编译壳 | `apps/web` | 只消费**已构建**的包产物，不 alias 源码 |
| 启动内核 | `client/web` | **React-free** 纯 DOM 引导页 + 模块系统接线；不再是 Loader entry |
| 静态装配库 | Cordis、`ui-primitives`、`ui-slots` | `staticLinked`：bare import 交给 Vite 宿主去重合并 |
| 模块自举 | `client/modules` | 动态包，但 factory 以阻塞式 classic script 提前到达 |
| 动态插件 | `runtime`、🆕 `ui-renderer`、全部 `ui-*` | 自注册 `lib/client.js`，由宿主图治理 |

**`ui-renderer`（新包）拿走了 React 本身**：React root 生命周期、slot 渲染、`SessionProvider`、hydrate 交接全归它，内核零 React。交接是一个依赖 fiber 而不是一次调用——替换/重载 ui-renderer 会自动重挂整个应用：

```ts
// packages/client/web/src/boot.ts:79
const mounted = ctx.inject(['uiRenderer'], (scope) => {
  scope.effect(() => scope.uiRenderer.mount(this.container), 'web boot: application mount')
})
```

`web-react` 的内容一分为二：React-free 数据引擎进 `client/runtime`（"零 React import，grep 可断言"），ctx↔React 绑定进 `ui-renderer`；仓库还留了块墓碑测试——bundle 纯度门禁断言解析 `dsh-client-web-react` 必须 throw。`schema-form` 则是被**决策删除**："Nothing renders a form it was not given"——schema 反渲染的通用表单不如手写卡片，而且 secret 默认值会经 `toJSON()` 泄漏。

其余五件新事物，各一句话：

- **插件自有设置卡**：设置页从"宿主白名单"翻转为"注册即暴露"——插件一个包两半（host 半 `installSettingsSection()`，browser 半向 `settings.plugin.item` keyed slot 注册卡片），详见官方新 cookbook `adding-a-settings-card`。真正的安全边界从来在别处：settings.* 全部是 loopback-only 特权方法 + `role('secret')` 逐层剥除。
- **describe 镜像**：浏览器端 `SettingsDescribeMirror` 把冷启动的 `settings.describe` RPC 从 **15 次压到 2 次**，且有 e2e 预算测试钉住——新代码直接调 describe 就是预算回归。
- **文件/会话引用（@提及）**：输入框 `@` 同时并发查文件（`ctx.fileReferences`，新接缝，file-reference-local 有界模糊索引）和会话（`dsh-session:` 不透明 URI）；选中只是引用，**模型必须自己调 read**；会话引用在 `agent/pre-step` 展开为"直接消息+紧随其后的不可信快照消息"（带防注入框架），预算超限整步拒绝。
- **部署品牌插槽**：`ui-brand-official` 是纯占位包——一次性向三个品牌 slot（侧栏 mark/name + hero mark）注册**声明感知的整组**占用，HMR 期间绝不出现半套品牌；无品牌构建靠 slot fallback 自足。
- **客户端构建环境**：`DSH_CLIENT_*` 是唯一可进浏览器业务代码的环境命名空间（静态替换，非动态查找）；`build:official` 钉三个值并写 `.dsh-build/` 构建记录（全产物 SHA-256），消费前校验漂移——**发布产物的字节可审计**。

多模态图像管线也在本次落地（横跨 07/05）：Composer 信封计数 → 附件准入（尺寸 ≤2000px/边，`IMAGE_DIMENSION_TOO_LARGE` 防"一张大图毒化整个会话"）→ 请求级 20 MiB 上界（`offloadRequestImages()` 纯函数按最旧优先换占位符，回放可复现、不落日志事件）→ llm-deepseek 直连视觉输入（按**精确模型元数据** `inputModalities` 门控，缺 `image` 能力在任何 I/O 之前就抛）。

## 📌 0.1.2 增量（rc.8 → 0.1.2-alpha.2，commit 141eb6f → 0a53fb5）：传输层大重构

这是本次版本最深刻的改造：**中心化 BFF 网关被拆解，`ctx.apiProxy` 与 `packages/host/apiproxy` 整包删除**。

### 一、从"一个大网关"到"业务自持 + 传输自持"

rc.8 的 apiProxy 同时持有**传输**和**业务语义**，于是每个简单端点要写五遍（业务服务 → apiProxy 接口 → Zod schema → 路由表 → 客户端 stub → 调用方）。0.1.2 沿两条正交轴拆开（[官方 Note](../deepseek-harness/.agents/notes/implemented/architecture/2026-08-10-unary-apiproxy-remote-migration.zh.md)）：

- **传输轴（保留但收窄）**：`ctx.typertGateway`（宿主）+ `ctx.remote`（客户端）仍在 `packages/api/gateway`，但**卸掉了全部领域知识**，只管认证、传输信封、精确 Fetch 路由、generation 状态。
- **业务轴（新增）**：五个 controller 服务，每个把一个 Cordis 服务键绑到一个 wire 命名空间：

| ctx key | 包 | 命名空间 |
|---|---|---|
| `ctx.sessionController` | `api/session-controller` | `session`、`skills`、`fileReferences` |
| `ctx.settingsController` / `ctx.credentialsController` | `api/settings-controller` | `settings` / `credentials` |
| `ctx.workspaceController` / `ctx.directoryPickerController` | `api/workspace-controller` | `workspace` / `directoryPicker` |

20+ 个端点按"归属其自然的业务 owner"迁移：`session.rename` → `sessionTitle/rename`、`llm.models` → `session/modelCatalog`、`host.openPath` → `session/openWorkspacePath`……

**为什么必须拆**（比"去重"更硬的理由）：**激活策略必须逐方法而非逐载体**。rc.8 的通用 Typert lookup 只要参数里出现 `Session`/`Agent` 就会恢复 Agent——于是"开个标签页"或"重连"都会静默唤醒 Agent。现在 session-controller 用一张显式表钉死：`list`/`search`/`page`/`skills.list` **永不恢复**；`follow` 先发预备快照再后台提升为冷 Session；`updateQueue`/`cancel` 仅限 live；只有 `create`/fork 才是直接创建者。**这张表只能住在领域 owner 里**——这是把业务从网关里赶出去的真正动机。

顺带删掉了 `host.describe`：一次 bootstrap 调用不该把连接就绪与互不相关的进程/业务事实耦合起来。现在 `$events` 的 ready 帧只带 `host.home`，各能力 owner 在自己页面显示时回答自己的当前能力。

### 二、两条 WebSocket → 一条多路复用 + 三种流原语

```text
/api/remote.mux            ← 唯一物理 socket（RFC 6455 Ping 心跳，默认 2s）
  ├── $events              ← 网关内部逻辑流（generation 源，ready 帧）
  ├── session.follow       ← RemoteJournalStream（seq 游标 + 缺页修复）
  ├── session.control      ← RemoteSnapshotStream（每 generation 全量基线替换）
  └── workspace.follow     ← RemoteSnapshotStream
$events/result             ← 普通 HTTP 一元（上行事件结果，不开第二条 duplex）
```

**`@Remote` 现在支持流模式**，这是最需要更新的认知：

```ts
// packages/api/session-controller/src/index.ts:374
@Remote({ mode: 'stream' })
follow(request: SessionFollowRequest, signal: AbortSignal): AsyncIterable<SessionFollowFrame> {
  return this.history.follow(request, signal)
}
```

三种流原语（`RemoteStream` / `RemoteSnapshotStream` / `RemoteJournalStream`）**组合而非继承**，单消费者、React-free；每个 item 带单调 generation + 该 generation 的 `AbortSignal` + `accept()`——领域消费者验证过开局游标/基线**之后**才 accept。**恢复语义按数据类型选择**：持久日志用游标+缺页修复，live 控制态用全量基线替换，普通通知不重放。

一个漂亮的竞态消除：`session.follow` **先开流拿到开局游标，再读首页**——首页请求期间产生的 live 条目已经排在队列里，所以经典的"先读历史再订阅"窗口根本不存在。

### 三、打包历史：把 41 万事件压成 696 条记录

`assistant/chunk` 的 token 级粒度让长会话的首屏成为浏览器杀手。0.1.2 让历史页与 follow 开局快照携带 `records: SessionHistoryRecord[]` 判别联合（[官方 Note](../deepseek-harness/.agents/notes/implemented/architecture/2026-08-15-packed-session-history-transport.zh.md)）：`{ type: 'event' }` 或 `{ type: 'chunks', event: ChunkRowEvent }`（连续同块的 delta 打成一行，复用 03 篇讲的 SQLite 打包同一套无损 codec）。

实测（一份生产规模样本）：尾页 **416,756 个逻辑事件 → 696 条顶层记录**（116 个打包行），未压缩 JSON 小 90.8%，Brotli 后小 73.2%；客户端"解析+校验+保留+双 Definition 折叠" **4682ms → 276ms**，采样 V8 堆峰值 612MB → 199MB。

无损性怎么保证：Journal 在发布前校验每条记录的**闭合逻辑 seq 区间**——普通事件覆盖 `[seq, seq]`，打包行覆盖 `[seq, seq + memberCount - 1]`——所以打包记录既不能伪造缺口也不能隐藏部分重叠。live follow 帧仍是标量单事件，**可见的流式节奏一点没变**。注意 `ChunkRowEvent` 是**客户端专属的历史数据**，永不进入 `SessionEventMap`（又一次"物理表示与逻辑契约分离"）。

### 四、统一失败词汇：一个类、一张码表

rc.8 每个码有三个家（owner 的 DetailsMap + 派生 union + 映射函数），protocol 还有两个失败类，connection 里又有第二套 typed view——而网关自己的 17 种装配故障全部以 `code: 'internal'` 上线，**"方法没挂载"和"业务拒绝"无法区分**。

现在只有 `RemoteError`，码是 `<语义域>/<原因>` 字符串：

```ts
export class RemoteError<Code extends RemoteErrorCode = RemoteErrorCode> extends Error {
  readonly isDSHRemoteError: true = true
  constructor(readonly code: Code, message: string,
    readonly details: RemoteErrorDetailsMap[Code], options?: ErrorOptions)
}
export type RemoteResult<T> = { ok: true; value: T } | { ok: false; error: RemoteFailure }
```

三个设计点值得抄：
1. **判别永远靠 `code` 字符串，不靠 `instanceof`**——宿主与客户端是分别打包的程序，worker 传输又把页面侧再切一刀，同一个类存在多份拷贝，原型身份毫无意义。连 `instanceof Error` 都不要求。
2. **码的声明位置由所有权规则决定**：跨包共同生产的码降到"两个生产者都已依赖的最低层"（`session/not-found` 落 `dsh-session`，`workspace/not-found` 落 `dsh-workspace`——两个 controller 之间没有依赖边，能力包是唯一公共地板）。
3. **装配 bug 不再假装成业务拒绝**：owner 不再预折未分类异常，网关只在一处折成 `gateway/internal` 并保留诊断字符串。

### 五、浏览器令牌认证：loopback 名单被彻底删除

rc.8 把"loopback Host 头"当本地权威——但 HTTP 客户端可以自己写这个头。能连到 socket 的人就能声称 localhost、进配置方法、用模型发现能力套出已存的凭证。

0.1.2 的模型（[官方 Note](../deepseek-harness/.agents/notes/implemented/architecture/2026-08-24-browser-token-authentication.zh.md)）：**connection 在派发前认证整个 Host API**，顺序固定为 Host/Origin 信任栅栏（403）→ 浏览器会话（401）：

```ts
// packages/client/connection/src/rpc-host.ts:96
requestRejection(request: ConnectionTrustRequest): ConnectionRequestRejection {
  if (!isTrustedApiRequest(request, this.trustedHosts)) return 403
  return this.browserAuth.isAuthenticated(request) ? undefined : 401
}
```

- **进程令牌**：每个宿主进程随机生成、跨 Connection 热重载保留（HMR 不轮换）、**从不持久化**；`dsh-web-app` 每进程打印/打开一次带 `?token=…` 的 URL。
- **令牌只干一件事**：`GET /?token=…` 换取 cookie 并 303 跳到干净的 `/`。API 路径不接受令牌，`Authorization` 头也不接受。
- **cookie 才是真凭证**：签名的权威绑定 bearer——cookie 名与签名载荷都含规范化 hostname+port（一个 Harness home 可跑多端口不撞车）；HttpOnly / SameSite=Strict / 无 Secure（自带服务器是 loopback HTTP）。
- **HMAC 密钥是一条凭证记录**：`ctx.credentials` 的 `client-connection/browser-session`（存 `$DSH_HOME/.credentials.yaml`），激活期加载一次并保留用于**同步**验证。**全局吊销 = 删记录 + 重启进程**。
- **`PRIVILEGED_METHODS` 整体删除，不是收窄**。理由写得很直白：逐方法名单会漏掉新端点，也约束不了一个已经能创建 Session 的调用方——**持有 cookie 即获得完整的工具级 Host API 权限**，这与"能建会话就等于有那份权限"一致。认证明确**不等于**背书网络部署（CLI 仍拒绝 `--host 0.0.0.0`）。

配套的 `ctx.authorization`（新包 `credentials/authorization`）+ `CredentialKey` 第二键空间（`<scope>/<id>`，**scope 是注册插件名而非 provider 名**，所以两个插件服务同一 provider 也读不到对方载荷）：**写入归流程所有**——`run()` 返回即表示记录已提交，且接缝校验"本次尝试期间观察到的提交"（仅凭存在会让重新授权把陈旧记录当新的）。目前只在进程内可达，浏览器 UI 契约officially 延后。

### 六、`webserver/index-inject`：注入表取代 HTML 正则改写

rc.8 的 `webServer.tapIndex(html => html)` 让每个注册者正则找 `<head>`/`<body>` 改 HTML——而静态 worker 部署根本没有"serve HTML"这一步，同一份启动语义被写了三遍。现在改成**事件携带纯 JSON 行**（`global` / `script` / `script-src` / `script-preload` / `style` / `html`），一张表两个渲染器：serve 时确定性拼接，worker 时 `/__boot__` 载荷**就是**这张表，由页面侧小解释器执行。`tapIndex` 保留为原始 HTML 逃生舱（在行渲染之后跑），内部消费者全部迁走。

### 七、客户端再拆一层：`client/runtime` 被删除

rc.8 才刚把 React-free 数据引擎收进 `client/runtime`，0.1.2 就把这个包**整个删掉**了——因为它成了聚合槽：Session 与 Workspace 对象、事件窗口、Conversation 装配、React hooks、Slot 注册表、store 引擎全挤在一个依赖汇点里，任何一层的改动都能波及整个前端。

新法则是**单向链**：Controller/领域对象 → UI 适配器 → renderer → Slot 组件。官方明确**不留替代 facade、不留兼容导出**。内容去向：

| rc.8 位置 | 0.1.2 去向 |
|---|---|
| `runtime/client/sessions/*` | `api/session-controller/src/client/` |
| `runtime/client/workspaces/*` | `api/workspace-controller/src/client/` |
| `runtime/client/conversation/*` + 装配器 | `client/ui-conversation/src/client/` |
| `runtime/client/contract/store.ts` + store 引擎 | 🆕 **`client/store`** |
| `runtime/client/slots.ts` | `ui-slots` + `ui-renderer` |
| `ui-conversation/.../conversation-nodes/*` | 🆕 **`client/ui-chat`** |

> 📝 更正我们 rc.8 篇的一处不精确：那时 `ConversationNodeDefinition` 已经住在 `ui-conversation`（`ui-renderer` 只拿走 React root），本轮的迁移是 **ui-conversation → ui-chat**。

**`client/store` 的职责边界画得很清楚**：拥有 React-free 的 store 契约**与**引擎（`ObservableSnapshot`/`SnapshotStore`/`defineStore`，Immer 更新、同步或 animation-frame 发布、可选 localStorage 持久化）；**不拥有**领域对象、React hooks、Slot 生命周期。而且 store 实例**只准装"观看/交互态"**（草稿、视图选择、面板尺寸），会话、工作区、Conversation、远程流、连接代际**明令禁止**进 store。

四个新 UI 包各司其职：`ui-chat`（Chat 目标 + 节点定义 + `useChat`）、`ui-session`（**唯一**的 Session 适配器，提供 `ctx.uiSession` 与 `useSession`/`useProjection`，并按优先级聚合各包注册的**待处理交互**）、`ui-approval`（Agent 作用域 Remote Event waterfall 上的待批准，接管 composer）、`ui-schedule`（**只读**日程目录，零 RPC 零变更，状态与相对时间全在浏览器算，绝不进持久状态）。

一个收敛设计值得记：**Approval 与 Question 汇聚到同一份 `pendingInteractions` 快照**——所以侧栏和 composer 永远不可能选中不同的待处理请求（同键并发对象直接拒绝）。

### 八、Lexical 编辑器：让两类 bug 结构上不可表达

原来的输入框是三层耦合（隐藏自增长镜像 + 装饰背板 + 透明文字 textarea）外加**两个草稿真相源**（textarea 字符串 + 状态机 occurrence 表）。0.1.2 换成**每个会话外壳一个 Lexical 编辑器**，在 React 外创建（`createEditor` + `registerPlainText` + `registerHistory`）并持有整个会话生命周期——刻意**不用 `@lexical/react`**，因为它在 React 内部建编辑器，与"每会话外壳持有"冲突。

关键收益：引用 chip 是原子 `DecoratorNode`，而**NodeKey 就是 occurrence 身份**——于是"字符串 diff 猜编辑位置"和"装饰无身份、每次击键重建"这两类 bug **结构上不可表达**。一棵树三个投影：检测（chip = 一个 U+FFFC，恢复不透明引用不变量）、剪贴板（chip = clipboardText，且现在就是 `InputState.draft` 的值——这是刻意的行为变化）、模型形式（提交时按 chip 所属 codec 编码）。

退休的手写代码一长串：镜像/背板 CSS 耦合、Safari 软换行绕行、镜像 Range 光标测量、手写撤销环与打字合并时钟、手写边界 Backspace/Delete、`EditRange`/`diffEdit`/`reconcile`。代价：`ui-conversation` 包多 ~70 KB gzip。

最尖锐的坑（值得单独记）：**`chip.isKeyboardSelectable()` 必须是 `false`**，否则方向键会在 chip 边缘死锁（NodeSelection 会塌缩成 element point，而纯文本绑定遇到非 Range 选择就 bail）。

### 九、locale 拥有全部产品文案——遗漏变成类型错误

typed 命名空间 + 中英字典对等只能证明字典**完整**，不能证明显示代码**用了**它：JSX 文本、a11y 属性、格式化函数返回值、零 Cordis 原子的默认值全都能绕过 `t` 而所有 locale 检查照样绿。

0.1.2 的新规矩：**所有产品编写的客户端 UI 措辞归 locale 字典所有**（可见文本、可访问名、提示、占位、空态、状态标签、单位、格式模板），而用户/模型/供应商/插件/线上对端/OS 编写的值**保持数据**；协议标签、工具名、路径、URL、JSON 字面量、稳定内部 id **永不翻译**。

两个机制让它可执行：
1. **Cordis-free 原子必须传完整本地化文案 props 且不留兜底措辞**（`MarkdownText`、`TerminalBlock`、`DiffBlock`、`HoverCard`…）——**遗漏是类型错误，而不是静默的语言选择**。
2. **本地化文本永不承载身份**：渲染器**先匹配后翻译**；客户端合成的错误在视图模型里存稳定标记，只在显示时翻译——切换语言改变措辞，但绝不改变选择、分组、搜索身份或生命周期状态。

新增 AST 检查 `scripts/verify-client-ui-i18n.ts` 进了静态 CI，并且有个精彩的自我保护：**发现范围变窄就失败**（防止"少扫了目录所以全绿"的假绿）。

### 🔍 我们发现的官方文档漂移（高价值）

`docs/api-gateway.md:5` 与 `:160` 仍写着 "Remote handles **only unary** method calls…（流）must **not masquerade as Remote methods** or enter invocation descriptors"，但 `@Remote({ mode: 'stream' })` 已经在 session-controller / workspace-controller 里发货，且由网关自己的 `RemoteStream` 家族承载。这份参考页没跟上重构的流式那一半。（另：`packages/api/settings-controller/README.md` 仍用改名前的错误码 `bad-request`/`settings-conflict`，源码已是 `gateway/bad-request`/`settings/conflict`。）

## 学习建议

想理解"浏览器插件"怎么写：从 `packages/host/plugin-inventory` 入手（最干净的 Remote-only 示例：浏览器检视宿主插件树），再看 `ui-todo` 类小 UI 插件，最后读 `ui-tool` 的子 slot 模式。
