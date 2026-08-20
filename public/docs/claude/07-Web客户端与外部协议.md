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

## 学习建议

想理解"浏览器插件"怎么写：从 `packages/host/plugin-inventory` 入手（最干净的 Remote-only 示例：浏览器检视宿主插件树），再看 `ui-todo` 类小 UI 插件，最后读 `ui-tool` 的子 slot 模式。
