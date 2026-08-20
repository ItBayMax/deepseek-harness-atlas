# Cordis 内核机制 —— "一切皆插件"的地基

> 本文是 Claude 基于源码阅读的独立解读，非官方文档。对应源码：
> `vendor/cordis/src/`（context/reflect/fiber/registry/events/service）、`vendor/loader/`、`vendor/include/`、`vendor/hmr/`、`vendor/schemastery/`。
> 注意 vendor 是**钉版本的源码拷贝**（基于 cordis@4.0.0-rc.7），本地修改清单在 `vendor/README.md`。

## 五个核心概念（源码视角）

### 1. Context：原型派生的服务仓库

`new Context()`（`vendor/cordis/src/context.ts`）创建根上下文：本体套一层 `Proxy`（`ReflectService.handler`），按序装入四个内建服务 `fiber`、`reflect`、`registry`、`events`（外加 logger）。

Context **从不被修改，只被派生**（原型链）：
- `extend(meta)` → `Object.create(...)` + 自有属性
- `isolate(name)` → 子上下文遮蔽 `[symbols.isolate]` 映射（`name → symbol`）——**领域隔离**的机制
- `intercept(name, config)` → 遮蔽拦截配置

访问 `ctx.tools` 这类属性时走 Proxy get 陷阱 → `internal/get` waterfall → 沿 **fiber 链**向上找 `fiber.store[prop]`。找不到时报错分两种：`cannot get property "x" without inject`（没声明注入）与 `... in inactive context`（声明了但服务未激活）——**新手最常见的两个报错，根因都在这里**。

### 2. Service 与 provide/mixin

- `reflect.provide(name, value)` 在根 isolate 映射里分配 `Symbol(name)`，重复注册直接报错；**它本身是个 effect**，随 fiber 卸载而反注册并 `notify` 所有依赖方。
- `reflect.mixin(source, keys)` 解释了一个"魔法"：`ctx.on`/`ctx.emit`/`ctx.plugin`/`ctx.effect` 其实都是 mixin 出来的转发访问器：

```ts
// vendor/cordis/src/reflect.ts:219
this.mixin('reflect', ['get', 'set', 'provide', 'accessor', 'mixin'])
this.mixin('fiber', ['runtime', 'effect'])
this.mixin('registry', ['inject', 'plugin'])
this.mixin('events', ['on', 'once', 'parallel', 'emit', 'serial', 'bail', 'waterfall'])
```

- `Service` 子类在构造时 `ctx.reflect.provide(name, this)` 自动占坑；带 `[Service.invoke]` 的服务实例**可直接调用**（`ctx.logger('name')` 就是这么来的）。

### 3. Fiber：纪元驱动的生命周期

每次 `ctx.plugin()` 产生一个 Fiber（旧名 EffectScope），状态机：`PENDING → LOADING → ACTIVE → UNLOADING → DISPOSED`（+ `FAILED`）。

最精妙的设计是**纪元（epoch）驱动激活**（`fiber.ts` `_refresh()`）：把所有被注入服务的提供者 fiber uid 拼成纪元字符串，任何一个依赖的提供者换人/消失，纪元变化 → 自动调度 reload/unload。**"提供者被替换"和"提供者消失"是同一个机制**——这就是热替换 provider 后所有消费者自动重载的原理。

插件的三种形态由 `RegistryService.resolve()` 统一：函数、`{ apply(ctx, config) }` 对象、`Service` 子类构造器。`inject` 声明可以是数组或对象（可带 required/optional）。

### 4. Effect：可逆效果

`ctx.effect(execute, label)` 接受：disposer、Promise<disposer>、同步/异步生成器（每 yield 一个 disposer 就登记一个）。析构逆序执行。

两个本地加固值得注意（`vendor/README.md` 条目 6）：
- wrapper 在 `execute()` **运行前**就压入 `_disposables`——setup 内部重入 unload 也能等到它
- fiber 处于 UNLOADING/已销毁时 `effect()` 抛 `INACTIVE_EFFECT`

`ctx.on()` 本身就是 effect（`events.ts:254`），`ctx.plugin()` 也是——所以**整个插件树是一棵 effect 树**，任何子树可以干净卸载。这是 HMR 能"暴力但正确"的根本原因。

### 5. 事件派发四模式

全部实现在 `vendor/cordis/src/events.ts`。`dispatch()` 统一前端：剥出可选 `thisArg`（scope 过滤靠它）、按 `[Context.filter]` 过滤监听器、绑定后返回回调数组。

| 模式 | 实现 | 语义 |
|---|---|---|
| `emit` | 同步逐个调用，不 await，不取返回值 | 纯广播 |
| `parallel` | `Promise.allSettled` + 聚合重抛 | 并发扇出 |
| `serial` | 顺序 await，遇非空返回值即"保释"返回 | 按序决策 |
| `waterfall` | 见下 | 环绕中间件 |

waterfall 的链式实现非常紧凑，值得一读：

```ts
// vendor/cordis/src/events.ts
waterfall(...args: any[]) {
  const cbs = this.dispatch('waterfall', args)
  const inner = args.pop()          // 调用方传入的"默认行为"是最内层
  const next = () => {
    const cb = cbs.shift() ?? inner // 监听器从最外层开始消费
    return cb(...args)              // args 尾部始终是 next
  }
  args.push(next)
  return next()
}
```

**共享一个 args 数组 + 尾部 next**：监听器调 `next()` 委托下游，不调则短路（连默认行为一起被否决）。这就是 dsh 全部策略点（`agent/pre-step`、`tools/pre-execute`、`llm/stream`…）的底层机制，也解释了仓库铁律"**waterfall 监听器必须调 next() 才能委托**"。

## Loader：cordis.yml 如何变成插件树

`vendor/loader` + `vendor/include`。整个引导只有 15 行（`vendor/cordis/bin.js`）：根 Context → 挂 Loader → 挂一个 include 指向 `cordis.yml`。

关键机制：

- **Entry 行**：`{ id, name, config?, group?, disabled?, inject?, isolate?, intercept? }`。省略 `id` 会得到随机 8 位 hex——于是每次改配置看起来都是"删了重加"，**所以务必写 id**。
- **`!!js` 表达式**：YAML 自定义标签构造 `{ __jsExpr }` 节点，求值是简单粗暴的 `new Function('ctx', 'expr', 'with (ctx) { return eval(expr) }')`。插值是**懒惰、按行**的：钩在 `internal/config` waterfall 上，等该行声明的注入激活后才求值，且跳过 Group/Include 这类"树载体"（它们的 config 是别的行）。`disabled` 是唯一被插值的元数据字段，在每次挂载决策时求值。
- **`cordis:group`**：config 就是子行数组，整棵子树作为一个单元挂卸；`isolate: { planMode: true }` 给子树一个私有服务领域——agent preset 靠它防止服务泄漏进根领域。
- **写回**：运行时改配置会 `simplify`（剥离等于默认值的字段）后写回 yml 文件（tmp + rename 原子写）。`Include.write()` 在 preset 场景被覆写为 no-op——**Loader 永远不能把运行时状态写回出厂组合**。

## HMR：暴力但正确

`vendor/hmr` 的哲学：**从不修补活对象**。文件变了 → 清 ESM/CJS 双缓存 → 重新 import → `registry.delete(plugin)`（所有 fiber 销毁、所有 effect 逆序回卷）→ 用**原始 config**（`!!js` 重新求值）在原父上下文重挂。失败则整体回滚（恢复缓存、重挂旧插件）。

正确性完全押在 effect 契约上——这也是为什么仓库纪律要求"每个注册必须有 disposer"。

## Schemastery：Config 校验 + 表单元数据

Schema 是**可调用函数对象**：`schema(data)` 即校验。与 cordis 的桥是 Standard Schema 适配器（cordis 只依赖 `@standard-schema/spec`，不依赖 schemastery 本体）。

对插件作者的意义：
- `z.object({...})` 声明的 Config 在 fiber reload 时自动校验，失败 → fiber FAILED → loader 报 `failed to apply loader entry <id>`——**配置错误在加载时炸响**（fail loud），呼应仓库纪律。
- `.default()` 提供默认值；`simplify` 让写回文件只留用户改过的字段。
- `.description()/.role()/.hidden()` 等链式元数据直接驱动 Web 控制台的**配置表单渲染**——schema 即 UI。

```ts
// vendor/hmr/src/index.ts:560 真实示例
export const Config: z<Config> = z.object({
  base: z.string(),
  root: z.array(String).role('table').default(['.']),
  debounce: z.natural().role('ms').default(100),
})
```

## 对 dsh 的意义：为什么这套地基撑得起"大平台"

1. **服务名即接口**：`ctx.tools`/`ctx.llm`/`ctx.fs` 这些 key 是稳定 API，实现随便换（epoch 机制自动波及消费者）。
2. **配置即组合**：整个产品形态（web/headless/自定义）就是 yml 行的堆叠与补丁，见 01 篇的 profile/bundle 分层。
3. **effect 树保证可卸载**：任何插件、任何子树都能干净拔掉——运行时自我修改（`tool-cordis`：agent 检视/挂载自己的插件）因此是安全的。
4. **isolate 领域**：同一服务可以在子树里有私有实现——per-session 的 agent preset 组合靠它成立。
