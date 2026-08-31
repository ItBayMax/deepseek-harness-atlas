# 浏览器内运行时（WebWorker）—— 把整个 harness 搬进浏览器

> 🆕 本篇是 0.1.2 增量（rc.8 → 0.1.2-alpha.2）新增内容。对应源码：`packages/experimental/webworker-runtime`（约 4.4 万行新增）+ `packages/experimental/webworker-packer`；决策档案 `.agents/notes/implemented/architecture/2026-08-20-webworker-node-face.zh.md`、`2026-08-20-webworker-pack-lowering-and-preview.zh.md`、`2026-08-23-webworker-vfs-watch-and-landlock.zh.md`。均为 `private: true` 实验包。

## 一句话总结

**整个 harness 的 Cordis 插件树跑在一个浏览器 Web Worker 里**——不是子集、不是 mock、不是重写，而是**逐字节相同的 web profile 配置**跑在浏览器里。源码注释自己说得最清楚：

```ts
// packages/experimental/webworker-runtime/src/worker-host.ts:1
/**
 * Worker assembly entry: the whole harness Cordis tree inside one dedicated
 * Web Worker.
 */
```

## 为什么这件事很难，以及它凭什么成立

难点在于：浏览器没有 `node:fs`、没有进程、没有 PTY、没有 sandbox。常规做法是给每个能力写"浏览器实现"，于是产生一套平行的插件世界——两份代码、两份 bug、永久分叉。

dsh 选了另一条路，也是 02 篇讲的 Cordis 模块层机制的极限应用：**替换的不是插件，而是模块**。

> 官方 Note 的原话（意译）：worker 跑 web profile 的配置，**没有 worker 专属的行**——所以浏览器缺失的每个平台能力都必须在**模块层**替换，"被代理的模块保持身份、换掉实现"。

这带来一张**唯一的平台分叉表**：

```ts
// packages/experimental/webworker-runtime/src/module-proxies.ts:18
/**
 * Module proxy table — the ONLY platform fork of the worker host. Every entry
 * replaces a Node builtin or an external npm package; workspace and vendored
 * modules are always mounted as-is. Keys are exact module specifiers.
 */
export const MODULE_PROXIES: Record<string, string> = {
  // VFS-backed real implementations.
  'node:fs': './node/builtin_modules/implemented/fs.ts',
  // …
}
```

**结果是所有 dsh 能力包原样运行**：`dsh-fs-local`、`dsh-subprocess-local`、`dsh-bash-sandbox`、`sandbox-local`、`dsh-permission-presets`，甚至 Chokidar 和 `node-addon-landlock-run` 都不改一行。这是 05 篇"能力接缝"设计的终极回报——**接缝下面换掉整个操作系统，接缝上面毫无感知**。

| 能力接缝 | 在浏览器里怎么落地 |
|---|---|
| `ctx.fs` | `dsh-fs-local` 不变 → `node:fs` 走 `MemoryVfs` |
| `ctx.subprocess` / `ctx.shell` | `dsh-subprocess-local` + bash 执行器不变 → `node:child_process` 是**真实现**，不是桩 |
| `ctx.sandbox` | `sandbox-local` 的 Linux 选择链不变；`landlock-run` 解析为**虚拟可执行文件** |
| HTTP 服务器 | 假 `node:http` 捕获请求监听器，postMessage 隧道喂给它 |
| `ctx.codeRuntime` | ⚠️ **这里断了**：`node:worker_threads` 是结构桩，插件挂得上、一用就报错 |

**分类写在路径里**：`implemented/<模块>.ts` = 真语义；`mock/<模块>.ts` = 结构占位（挂载时静默，真调用时报告缺失能力）。桩是**函数而不是省略**，因为"缺失的 CommonJS 符号会在调用时退化成 `undefined`，而不是在链接时失败"——宁可在调用点炸响。

## 三个最精彩的实现细节

### 1. Cordis 的模块接缝被二次复用

07 篇讲过浏览器复用同一个 Loader 的关键一行 `loader.internal = 模块表`。WebWorker 运行时把同一招用在了 Node 侧：

```ts
// packages/experimental/webworker-runtime/src/worker-host.ts:234
const ctx = await appBoot.boot('dsh-webworker', configPath, patches, (hostCtx) => {
  // Before any entry mounts: the Loader would otherwise fall back to the
  // runtime's own dynamic import for every row.
  hostCtx.loader.internal = loader.internal
  installLogSink(hostCtx, require)
  // …
})
```

注意 `appBoot` 是**镜像里那份** `@deepseek-ai/dsh-app-boot`——也就是说，浏览器里跑的是 Node 部署跑的同一套启动胶水。

### 2. 真进程语义：子 Worker 当进程用

```ts
// packages/experimental/webworker-runtime/src/shell/process/host.ts:4
 * A process is a Web Worker started from this same bundle, told by its first
 * frame to be a shell process rather than a host. That is what buys real
 * process semantics in a browser: the command runs off the host's thread, and
 * `terminate()` stops it even mid-loop — the one thing a cooperative in-thread
 * interpreter can never do.
```

于是信号阶梯是真的：`SIGTERM` 请求在下一个命令边界停止，**`SIGKILL` 无论它在干什么都终止**（哪怕死循环）。语法解析买现成的（`@yarnpkg/parsers`），求值器和 coreutils 命令表自己写——理由很实在："每个候选解释器都自带文件系统，而那恰恰是不能复用的部分。"

### 3. BigInt stats 必须携带真信息

最微妙的一处。`dsh-fs-local` 的**陈旧写入守卫**依赖 `ino` 和 `mtimeMs`，而内存写入经常落在同一毫秒内——时间戳相等就会让陈旧覆盖溜过去。所以：

```ts
// packages/experimental/webworker-runtime/src/storage/memory.ts:457
/** @returns A modification time strictly newer than one file node's current value. */
private touchNode(node?: FileNode): number {
  const previous = node?.mtimeMs
  const now = Date.now()
  return previous === undefined ? now : Math.max(now, previous + 1)
}
```

**每个 entry 的 mtime 严格单增**，`ino` 是每路径单调身份，描述符跨 rename/replace/unlink 保持打开时的文件身份。这是"模拟一个平台"和"模拟到能骗过并发守卫"之间的差距。

同类细节还有：worker 自己在装模块表之前先装 `process` 全局（含 `process.title`——`@xterm/headless` 之类靠这个属性存在与否判断自己在 Node 还是浏览器，缺了就会去摸 DOM-only 全局）；`node:stream` 直接用维护中的 `readable-stream` 浏览器构建（让 Chokidar/readdirp 拿到真的背压和拆卸顺序）。

## 文件系统与沙箱：诚实的边界

**一个提交型变更源**：`MemoryVfs` 在状态变更**之后**发布 `write`/`mkdir`/`remove`/`chmod`；失败不发布；**镜像播种刻意静默**；抛异常的订阅者既不能让操作失败也不能阻塞其他订阅者。同一条记录同时喂给 live watcher 和（尚未挂载的）持久 sink——**不是第二条通知路径**。

**watcher 是真的 Node watcher**：`watch` / `watchFile` / `FSWatcher` / `StatWatcher` 齐活，`fs/promises.watch` 是可中止异步迭代器。而 **Chokidar 与 readdirp 是普通镜像依赖，不是替代品**——它们的包代码原样跑在 worker 的 `node:fs` 上，于是初次扫描、`ready` 计数、原子写归一化、写稳定等待、共享 watcher 与拆卸仍然是 Chokidar 的问题，不是 harness 的问题。

**沙箱：解释启动器协议，而不是分叉包**。`node-addon-landlock-run` 原样运行并仍然独占 `launcherPath()`/`grantArgs()`/`probe()`；worker 提供一个**按 basename 解析的逻辑可执行文件**：

```ts
// packages/experimental/webworker-runtime/src/shell/process/landlock.ts:167
/** Virtual executable implementing the native launcher's CLI over VFS grants. */
export const LANDLOCK_EXECUTABLE: VirtualExecutable = {
  name: 'landlock-run',
  async prepare(args, context) { /* 解析授权 → 返回受限 ShellFileSystem */ },
}
```

授权是**逐进程逐调用**的（`landlockFileSystem` 闭包住这一次调用的授权集），拒绝抛 `EACCES` 以保住 `bash-sandbox` 的拒绝分类。因为 bwrap 探测不可用，未改动的 `sandbox-local` 会自然选中这个后端。

而**诚实声明**写在 README 里，值得整段引用其精神：

> **Worker 的限制是 VFS 边界，不是内核 Landlock**……`full` 只覆盖 Worker 命令表和已挂载的 VFS，不声称任意原生进程执行或 Linux 内核隔离。

这是全仓"诚实边界"哲学的又一次体现（对比 08 篇 Agent Teams 的 `writeScopes` 只警告不上锁）。

一个被实测否决的方案也很有教学价值：**用 `SharedArrayBuffer` + `Atomics.wait` 做同步子进程文件系统**——在部署目标上实测发现，没有 COOP/COEP 头时 `SharedArrayBuffer` 根本 undefined，而 GitHub Pages 无法设置响应头。异步面是超集，所以将来可以在下面垫一个 SAB 后端而**不碰任何一个程序**。

## 打包器：worker 里没有编译器

所有 ESM→CommonJS 转换在**构建期**完成，worker 拒绝任何未按其精确契约降级的镜像：

```ts
// packages/experimental/webworker-runtime/src/image-layout.ts:42
export const LOWERING_VERSION = 'dsh-worker-transform/1'

/**
 * Free variables a lowered body expects from its wrapper, in order.
 *
 * Part of the image layout rather than of the transform, because the loader
 * wraps bodies it never parses: the packer emits against these names and the
 * worker binds them, with no compiler in the worker bundle to agree with.
 */
export const WRAPPER_PARAMS = [
  'exports', 'require', 'module', '__filename', '__dirname', '__dsh$meta', '__als',
] as const
```

三个要点：
1. **契约常量刻意住在"镜像布局"模块而不是转换模块里**——否则 tree-shaking 会顺着 barrel 把 `acorn` 拖进 worker 包。丢掉加载期兜底编译器让 `lib/worker.js` 从 423.5 kB 降到 246.3 kB。
2. **一趟 acorn 做两件事**：CJS 降级 + 把每个挂起点接进 AsyncLocalStorage 的快照/恢复协议（`__als`），用区间拼接保证**行号不变**，栈帧还能指对行。
3. 挂载前门禁：镜像由旧转换器降级过 → `image was lowered by X, this build runs Y; rebuild the image` 直接抛。

投递是**确定性的 gzip ustar**（MTIME 0、OS 字节 0xff），因为静态主机不会压缩二进制 content-type，所以**压缩必须随产物一起走**；worker 用原生 `DecompressionStream` 边下边解。

## 部署：browser-only dsh 是怎么发出去的

每个 PR 推送都部署到 Cloudflare Pages（项目 `dsh-build-preview`，分支别名 `pr-<号>`，Cloudflare Access 保护）。有两步"塑形"值得学：

```yaml
# .github/workflows/build-preview-cloudflare.yml:80
# Sourcemaps carry complete sources and stay off the deployment platform.
# index.html is the served page, which cannot boot without a host
# injecting window.__DSH_BOOT__; replacing it with the worker page makes
# the deployment root the usable entry instead of a page that never boots.
- name: Shape the upload
  run: |
    find apps/web/dist -name '*.map' -delete
    cp apps/web/dist/preview.html apps/web/dist/index.html
```

1. **`preview.html` 成为根**——常规 `index.html` 需要 Node 宿主注入 `window.__DSH_BOOT__` 才能启动，只有 worker 页能自举，所以"browser-only dsh"的入口必须是它。
2. **平台永远拿不到源码**：只上构建产物，sourcemap 上传前删除。
3. **每次部署都断言字节路径**：HTTP 200（302 说明 Access 策略缺 Service Auth 规则）、**没有 `content-encoding`**（平台若声称传输压缩，浏览器会先解一层，worker 的 `DecompressionStream` 就会去解一个纯 tar）、gzip 魔数 `1f 8b`。**平台行为变化让 CI 失败，而不是让某人浏览器里的 worker 启动失败**。

## 已知边界（README 自己列的，逐条诚实）

- **结构桩**：`node:dns/promises`、`node:vm`、`node:net`、`node:sqlite`、`node:worker_threads` ——每次调用在控制台报告拒绝并抛错。需要真 DNS、真进程或领域隔离的行**跑不了**（所以 workflow 与 code-runtime 插件挂得上、一用就失败）。
- **shell 不是 bash**：没有循环、函数、`case`、作业控制、进程替换；语法止于管道、`&&`/`||`、子 shell、分组、重定向与展开。`sed` 只接受替换脚本，命令表只有 coreutils（**没有 git，没有网络工具**）。
- **shell 进程没有同步文件系统**：靠消息读写宿主 VFS（阻塞需要 SAB，而 GitHub Pages 给不了跨源隔离）。所以目录遍历命令**每个条目一次往返**，两个并发命令可能交错写入。
- **watcher 只观察挂载的 VFS**：镜像播种静默，VFS 没有符号链接也没有外部写入者。
- **会话日志是明文**（`compression: 'none'` 启动补丁）：worker 不带 Zstandard codec，导出永远是 `.jsonl`。
- 传输/worker-host/页面半侧的覆盖率门禁**尚未达标**（需要浏览器级 harness）。

## 教学价值：为什么这一篇值得读

这不只是"跑在浏览器里"的炫技，它是对全仓架构的一次**压力测试与验证**：

1. **接缝设计是否真的解耦**——答案是能换掉整个操作系统。
2. **模块层与插件层分离的价值**——平台差异被压进一张表，插件层零改动。
3. **"诚实边界"文化**——不把 VFS 限制吹成内核沙箱，不把 mock 说成实现。
4. **被否决方案比结论更有信息量**——SAB 方案的实测否决过程，教你怎么在设计里为未来留门（异步面是超集）。
