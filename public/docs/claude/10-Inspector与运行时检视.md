# Inspector 与运行时检视 —— 用 Chrome DevTools 看活着的插件树

> 🆕 本篇是 0.1.2 增量新增内容。对应源码：`packages/experimental/inspector`（`private: true` 实验包）；决策档案 `.agents/notes/implemented/architecture/2026-08-23-cross-realm-cdp-inspector.zh.md`、`2026-08-26-inspector-execution-realms-and-protocol-planes.zh.md`、`2026-08-27-inspector-development-mount.zh.md`、`2026-08-24-cordis-runtime-tree-inspection.zh.md`。

## 一句话总结

把**运行中的 dsh 宿主和它的浏览器客户端**同时挂到 Chrome DevTools 上：Host + Client 两个 Console 上下文、带真断点的 Host Sources、完整 Host fetch 抓包，以及**在 Elements 面板里渲染的共享 Cordis 插件树**。

## 起点是一个刁钻的死锁

官方 Note 开篇的问题一句话就说清了：

> **宿主主线程上的调试器传输，在该线程已经暂停时无法投递 `Debugger.resume`。**

也就是说，如果 CDP 端点住在宿主主线程，你一旦断在断点上就再也没法叫它继续——调试器把自己锁死了。两个设计决定由此而来：

1. **Worker 是唯一的 CDP 端点，也是 CDP 状态的唯一所有者。** 宿主生产者用专用 `MessagePort`，**从不构造 CDP 消息**；客户端开一条**直连 Worker 的已认证 ingest WebSocket**，完全绕过宿主 Web 服务器——于是宿主暂停既不能阻塞客户端投递，也不能阻塞客户端运行。Chrome 连的是 Worker 的 CDP socket，每个 DevTools 连接拿到自己的 `node:inspector.Session` 挂到宿主 isolate 上。
2. **生产者发布领域观测，不发布协议。** 版本化内部帧携带 `{源 id, generation, 序号, 源时钟时间, 主题, JSON 载荷}`。投递有序但尽力而为；生产者在应用路径上**从不等待确认**；有界队列把丢弃的前缀报成**序号缺口**，而无法解释的缺口会让 Worker 请求一份新快照。

结果：`Runtime.enable` 发布真实的宿主执行上下文，外加**每个已连客户端一个负 id 的合成执行上下文**。宿主脚本保留原生调试能力；客户端脚本是只读内容且**明确拒绝**活跃调试——因为"页面 JavaScript 无法一边暂停自己的领域一边处理控制消息"。

## 两个可复用的组织手法

### 执行领域：顶层目录说的是"在哪运行"，不是"做什么"

```
src/
  shared/   环境无关的数据与接口
  client/   浏览器客户端生产者与适配器
  host/     宿主 Node 主线程生产者与适配器
  worker/   Worker 传输、仓库、领域后端、CDP 端点
```

有牙齿的规则：**即使一个模块"代表"客户端，只要它在 Worker 里执行，就归 `worker/`**——于是有 `worker/realms/client/` 与 `worker/realms/host/` 对称并列。`client/` 与 `host/` 持有**完全相同的相对文件名**，不支持的操作保留为返回"类型化不支持结果"的薄镜像文件，而不是干脆省略——**让能力不对称体现在类型里，而不是藏在缺失的文件里**。`client/` 与 `host/` 互不 import，也不 import `worker/`。

### 协议平面：四个不相交的所有权区

| 平面 | 拥有 | 禁止出现 |
|---|---|---|
| `shared/cordis/` | 语义模型、不可变快照、领域本地对象登记、投影、reader | 传输句柄、CDP id |
| `shared/network/` | fetch/网络观测、抓取的 body、header 归一化 | CDP request id、enable 状态 |
| `shared/cdp/` | 归一化的领域**后端**接口 + 能力声明 + 类型化不支持结果 | Chrome 的 `RemoteObjectId`/`ScriptId`… |
| `shared/bridge/` | 版本化内部载体：信封、编解码、校验、RPC 关联 | 任何 CDP 消息转换 |
| `worker/cdp/ids.ts` | **Chrome 连接本地标识符的唯一所有者** | — |

品牌类型纪律做得很彻底：

```ts
// packages/experimental/inspector/src/worker/cdp/ids.ts:1
/** Opaque identifiers owned by one Worker-side Chrome DevTools connection. */
declare const cdpNumericIdBrand: unique symbol
/** Number branded with one Chrome CDP identity role. */
export type CdpNumericId<Role extends string> = number & { readonly [cdpNumericIdBrand]: Role }
```

理由写得很清楚：源、generation、序号、请求、Cordis Fiber uid、领域对象引用、后端句柄、Chrome id **必须保持不同类型，因为它们的所有者和生命周期都不同**。这是 05 篇 `Branded<B>` 纪律在一个复杂子系统里的完整展开——五种身份被刻意**不统一**：

| 身份 | 所有者 / 生命周期 |
|---|---|
| Fiber `uid` | 来自 Cordis。Context 没有 Cordis id，Inspector **拒绝发明一个** |
| `InspectorObjectReference` | 领域本地不透明句柄，仅路由用，绝不当语义 id |
| `BackendNodeId` | Worker 按 `(源 id, generation, 对象引用)` 分配，跨 DevTools 连接共享 |
| `NodeId` | 每 DevTools 连接、每前端文档 |
| `RemoteObjectId` | 由所选 Runtime 会话在 `DOM.resolveNode` 时分配 |

## `ctx.inspector`：故意与 CDP 无关

服务面只有两个成员，而且**宿主与客户端两个插件面拿到的是同一个工厂产出的同一种服务对象**：

```ts
// packages/experimental/inspector/src/shared/service.ts:8
/** Shared Host/Client service façade over the realm's source publisher. */
export interface InspectorService {
  /** Publish one JSON observation without waiting for Worker delivery. */
  publish(topic: string, payload: InspectorJsonValue, monotonicMs?: number): void

  /** Read-only Cordis topology queries independent of CDP sessions. */
  readonly cordis: CordisRuntimeTreeReader
}
```

`cordis.getTree()` **读取 Worker 最新的脱离态语义快照，不创建任何 CDP 会话**，也不 enable Runtime/Debugger/Sources。

### 与自修改故事的汇合（这是最有想象力的一处）

`ctx.inspector` 已经进了 `dsh-tool-cordis` 教给模型的 Cordis API 目录（`packages/extensions/tool-cordis/src/api-catalog.ts` 有 `key: 'inspector'` 及其两个成员）。也就是说——**模型写的动态 Cordis 插件**（rc.8 就有的自修改能力：七个工具检视活运行时、定义/运行/停止/移除内存包、定义在重启后消失）可以：

- 调 `ctx.inspector.publish(topic, payload)` 把**自己的观测**发进 DevTools；
- 调 `ctx.inspector.cordis.getTree()` **读取它正在改的那棵插件树**。

官方 Note 画的图把这个设计意图说得很明白：

```text
Host Context/Fiber ─┐
                    ├─ CordisTreeCollector ─ CordisTreeSnapshot ─ 源传输 ─ CordisTreeStore ─┬─ CDP DOM 适配器
Client Context/Fiber┘                                                                       └─ 未来的模型适配器
```

CDP-无关的 reader **正是为此存在**：将来给模型的适配器消费的是 Elements 面板消费的同一个 Worker 仓库，而不是去反解 Chrome 的节点序列化。（注意 `ctx.inspector` **不是工具**：无模型体验、无 KV 缓存影响，它只观测。）

## Cordis 树检视：能看到什么

`CordisTreeSnapshot` 是无损、CDP 无关的 JSON：schema 版本 + 单调 revision + 对象注册 id + 截断标记 + **以 Context 为根的嵌套树**。结构规则：

- 检视从根 Context 开始，**排除 Cordis 根 Fiber**
- 其他插件：父 Context 含该 Fiber，Fiber 含恰好一个代表 `fiber.ctx` 的 Context 子节点
- `extend()`/`isolate()`/`intercept()` 造出但没产生新 Fiber 的 Context，保持为**直接 Context 子节点**
- **嵌套表达父子关系而不生成节点 id**，也避免序列化 `Fiber.ctx ↔ Context.fiber` 这个环

**刻意不放进树里的**：生成的 Context id、插件元数据、服务数据、任意属性值、对象预览。Fiber 元素只暴露 Cordis 自己的 `uid`，**Context 元素没有任何属性**。

发现过程（这段代码本身就是一份 Cordis 内部结构教材）：

```ts
// packages/experimental/inspector/src/shared/cordis/collector.ts:149
const rootInfo = ensure(root) as ContextInfo
for (const runtime of root.registry.values()) {
  for (const fiber of runtime.fibers) {
    if (fiber.uid === null) continue      // 跳过已释放
    ensure(fiber.parent); ensure(fiber.ctx)
  }
}
for (const key of Reflect.ownKeys(root.events._hooks)) {
  for (const hook of root.events._hooks[key] ?? []) ensure(hook.ctx)   // 事件钩子的 owner 也是入口
}
```

**同一份采集器编译进两个面**，宿主与客户端各自对自己的 `ctx.root` 实例化——没有第二套分类实现。

Elements 投影是个合成文档：`<host>` 容器放宿主根 Context，`<clients>` 容器每个客户端源一个 `<client>`。**源发布全量快照，Worker 按稳定后端节点身份做 diff 再通知 DevTools**——只改 revision 不发 DOM 事件，插入/删除/属性变化发节点级事件，兄弟重排只替换该父节点的 children。所以**Elements 的展开状态和选中项不会被刷掉**。

断连是保数据的：关闭的源把树从"已连接"移到"已断连"而**不删最后一份快照**——对象查询排除断连树（"新的连接 generation 无法证明任何先前的活对象仍存在"），但快照仍可检视。

**明说的盲区**：Cordis 没有完整的全局 Context 注册表，采集器只能恢复"从活 fiber 和事件钩子可达的" Context；一个创建后从未使用、只被应用代码持有的 Context **刻意缺席**。

## 开发期挂载：一个漂亮的组合难题

矛盾是这样的：Inspector 是私有包，**任何已发布的 dsh 安装都不带它**；但开发启动时又要把它挂进出厂的 web 组合。而出厂 bundle 补丁里**不能**写这一行——`verify-cordis-config` 要求 bundle 补丁里每个具名行都能从该 bundle 自己的 `dependencies` 解析出来（**`disabled` 的行也不豁免**），而已发布的清单又不允许依赖未发布的包。

解法：包自己持有**两个开发期 overlay**，每个只有一行 insert，相对入口锚定到 overlay 文件自身所在目录：

```yaml
# packages/experimental/inspector/cordis.source.patch.yml
# Source overlay for `pnpm run demo:inspector`. The relative entry is anchored
# to this file and runs through the CLI's tsx loader without a profile install.
- insert:
    - id: experimental-inspector
      name: './src/index.ts'
```

（`cordis.patch.yml` 是它的构建版孪生，指向 `'./lib/index.js'`。）于是：

```bash
pnpm run demo:inspector    # tsx 直跑源码，无需 profile 安装
```

两种方式都**不读也不改 profile 的已安装插件状态**；缺文件时 Loader 导入直接 fail loud，而不是静默跳过 Inspector。被否决的方案很有教学价值：出厂 web 补丁里写 `disabled: !!js` 行、给启动器加 `--inspector` flag（"启动器既不拥有应用 flag 也不拥有插件包名"）、给 `dsh-web-app` 加可选 peerDependency + 动态 `ctx.loader.create`。

**后果**：已发布的包里**没有任何痕迹**——无清单条目、无组合行、无启动器 flag，挂载始终是"某次启动由某个配置层声明"的选择。这是 01 篇"配置即产品"哲学处理"开发期专属能力"的标准答案。

## 安全姿态：说得非常直白

README 的 Security 一节和 Note 都不打折扣：CDP target 通过 `Runtime.evaluate` **授予在宿主与已连客户端领域里任意执行代码的能力**，而完整 fetch 抓包**包含机密**——不对凭证、cookie、query 值或载荷做任何脱敏。

因此：`host` 被钉成 `z.const('127.0.0.1')`，客户端 ingest 要求宿主注入的**随机 WebSocket 子协议令牌**，非 loopback 源默认拒绝。Note 自己那句话值得记住：

> **loopback 监听是必须的，但它不是认证。**

## 已知边界（README 逐条列的）

- **客户端活跃调试不支持**——客户端脚本的调试器请求返回明确的不支持错误；target 级暂停/恢复只作用于宿主
- **客户端 Sources 只暴露 Inspector 自己的 bundle**，页面其他脚本不编入目录
- **客户端求值用页面 JavaScript**——页面 CSP 可能禁掉动态求值；合成上下文不提供 DevTools 命令行助手
- **客户端身份仲裁依赖 Web Locks**——没有该 API 的浏览器能靠 `sessionStorage` 保住刷新/重连身份，但**无法区分同一存储状态复制出的两个同时存活的标签页**
- **fetch 拦截范围是 `globalThis.fetch`**——直接 Undici API 调用和激活前拿到的 fetch 引用观察不到
- **body 克隆有运行时代价**——完整抓包会 tee 请求与响应流至配置上限，而该上限不含 tee 内部缓冲
- **Worker 意外退出不自动重启**——生命周期恢复延后

## 教学价值

1. **一个死锁如何塑造整个架构**：把 CDP 端点移出主线程这一个约束，推导出了"生产者发布观测、Worker 独占协议"的分层。
2. **"在哪执行"作为目录划分原则**：比按功能分目录更适合跨领域系统——它让"不能 import 谁"变成可静态检查的规则。
3. **拒绝发明身份**：Context 没有 Cordis id，Inspector 就不给它造一个（宁可用嵌套表达父子关系）。这与全仓"不伪造事实"的姿态一致。
4. **开发期能力的零痕迹挂载**：想给自己的项目加"仅开发期"插件时，这套 overlay 手法可以直接抄。
