# 20 · Connector 体系与 MCP 管理器

> 基线：`dsh@0.2.3-alpha.2`（上游 commit `4b399c3`）· 本篇为 0.2.3 全新
> 全新的 `packages/connector/` 包组（9 个包）+ 被重写的 MCP 支持。

## 〇、时间线先定位

整个 connector 包组是**发版前 6 天内集中落地的**：

| 包 | 落主干 |
|---|---|
| `mcp/mcp-manager` | 2026-11-03 |
| `client/ui-connector-account` | 2026-11-16 |
| `mcp/mcp-account`、`connector/cli-account`、`connector/upstream-skills` | 2026-11-17 |
| `connector/notion` / `linear` / `tencent-docs` | 2026-11-18 |
| `connector/feishu` / `wecom` / `tencent-meeting` | 2026-11-19 |
| `connector/dingtalk` | 2026-11-20 |

> ⚠️ **方法论提醒**：`.agents/notes/` 的**文件名日期是 authoring 日期，不是落主干日期**。
> 例如 `2026-08-31-mcp-manager-plugin` 这篇，功能分支 2026-11-03 才合入——
> 按文件名日期筛"基线之后"会**漏掉**它。
> 正确做法是 `git log --first-parent --diff-filter=A <基线>..<HEAD>`。

## 一、connector 不是新的能力接缝，是一个**产品分组**

`packages/connector/README.zh.md` 开宗明义：每个包"组合 skill、注册到共用管理器的 MCP 服务器、
运行时上下文和 subprocess 等**现有能力**，并把应用特有的配置和模型指引保留在自己的包内"。

它内部是**两种完全不同的接入形态**：

| 形态 | 包 | 模型实际拿到什么 | 账号归谁管 |
|---|---|---|---|
| **CLI 应用插件** | 飞书 / 企微 / 钉钉 / 腾讯会议 | 一个 **skill** + 一条**运行时上下文**（CLI 绝对路径），用普通 `Bash`/`PowerShell` 跑厂商 CLI | **厂商 CLI 自己的配置和钥匙串** |
| **MCP 连接器** | Notion / Linear / 腾讯文档 | 该 server 的 `mcp__<server>__*` **工具** + 一段称呼指引 | DSH 凭据接缝里的 OAuth grant |

**CLI 连接器一个工具都不注册**——它靠 skill + shell。

### 为什么不做成普通插件或纯 MCP

三条理由都写在代码和决策记录里：

1. **CLI 形态根本做不成 MCP。** 厂商的官方交付物是 CLI + 一堆 Markdown 指南。
   决策记录统计过上游指南里按名字调用 CLI 的行数：
   **钉钉 3004 行、飞书 2542 行、企微 321 行、腾讯会议 248 行**，钉钉还有 33 个脚本按名字调 `dws`。
   把这些重写成 MCP 等于重写厂商文档。
2. **它们确实需要一个共享的 Host 侧注册表。** `packages/client/AGENTS.md` 第 3 条
   **禁止 client 插件之间共享运行时代码**——不抽注册表，每类 connector 的浏览器代码会被抄两遍并逐渐不一致。
3. **它们是"产品分组"而非"架构层"**：`kind: "package-group"`，
   组内 7 个是可被 `dsh plugin add` 安装的 bundle，2 个是共享 Service。

> 📌 一个容易搞混的点：**`ctx.connectorAccounts` 不在 `packages/connector/` 里**，
> 它在 `packages/client/ui-connector-account/`。
> connector 包组只有 `ctx.cliAccounts` 和 `ctx.upstreamSkills` 两个 ctx 键。

## 二、三套账号：不是平行的三套，是 1 个注册表 + 2 个适配器

```
                ctx.connectorAccounts          ← 唯一的 Host 注册表 + 唯一的 Remote + 唯一的浏览器一半
                (client/ui-connector-account)
                    ↑                ↑
         register(key=包名)      register(key=`mcp:<server>`)
                    │                │
             ctx.cliAccounts    ctx.mcpAccounts
             飞书/企微/钉钉/      Notion/Linear/
             腾讯会议             腾讯文档
```

**为什么要分三套？** 决策记录给的理由是**账号状态的拥有者不同**，而注册表只接受"来源 + 展示函数"：

| | 状态在哪 | 于是需要 |
|---|---|---|
| `cliAccounts` | **厂商 CLI 进程**里，只能靠跑命令 + 解析 JSON 得到 | 子进程执行器、串行化、超时、链接白名单、退出码失败模型 |
| `mcpAccounts` | **管理器已经有了**（`list()` + 状态事件 + 进行中的授权尝试） | 几乎什么都不用做——`refresh()` 是空的，`start()` 直接复用管理器的 attempt id |
| `connectorAccounts` | — | 只负责"插件页该画什么、哪个浏览器能打开授权页" |

五个统一阶段：`checking` / `connecting` / `connected` / `disconnected` / `unavailable`。
按钮命令只有三种：`start` / `cancel` / `open`。

> **这个分层值得抄**：三类东西状态来源完全不同（跑命令拿 / 现成有 / 不拥有），
> 但**对界面而言只有五个阶段和三个按钮**。
> 注册表不关心你怎么知道自己连没连上，只要你能 `snapshot()` 和 `observe()`。

## 三、⚠️ 凭据：我们记过的规则多了一个**成规模的例外**

我们此前核实过「dsh 的凭据统一走 `$DSH_HOME/.credentials.yaml` 的 `refs`/`records` 两段式」。
现在要分两半说：

### MCP 连接器 ✅ 仍然沿用

OAuth grant 落在 `.credentials.yaml` 的 `mcp-client/<server>` 记录里，
而且 schema **强制了命名空间前缀**（`mcp-client/src/oauth-options.ts:24`）：

```ts
credentialKey: z.string().pattern(/^mcp-client\//).required(),
```

卸载插件**不删** grant，重装复用。

### CLI 连接器 ❌ **完全不在 DSH 凭据体系内**

📄 `packages/connector/feishu/README.zh.md:12`：

> **CLI 把凭据保存在默认配置中，用户自己的终端也共用这份配置。**

以及 `:58`：

> 运行 DSH 的进程需要能访问 CLI 配置和系统凭据存储；**`DSH_HOME` 不会迁移这两者**。

**后果（必须向运维讲清楚）**：

- 在 DSH 里登录/登出**会影响用户自己终端里的登录状态**
- 没有 DSH 私有账号
- 插件不提供"解绑"操作
- 换一台机器 / 换 `DSH_HOME` 都不会带走它们

### 账号操作路径上的脱敏做得很硬

`cli-account/src/types.ts:109-113` 的 `perform` 契约原文：

> Throwing fails it… **What it throws is neither logged nor shown, because exceptions and
> native output may contain credentials**; a failed operation reports only its last command
> and that command's exit code.

授权链接还要过主机白名单（飞书 `['feishu.cn', 'larksuite.com']`，企微 `['work.weixin.qq.com']`）。

### ⚠️ 但有一个缺口

**这条脱敏规则只覆盖插件页的账号操作。**
模型在对话里用普通 Shell 工具跑 `lark-cli` / `wecom-cli` / `dws` 时，
CLI 的 stdout/stderr 是**普通工具结果，没有任何脱敏层**。

> "凭据不进模型上下文"这条，在 CLI connector 上**依赖厂商 CLI 自己不打印凭据**，DSH 没有兜底。

## 四、`upstream-skills`：本轮最硬的一处信任链

**问题**：企微有 180 个指南文件约 1.75 MB、腾讯会议 11 个，厂商只在自己 GitHub 仓库发布。
决策记录原话：**"DeepSeek 不发布这类副本"**——把它们 copy 进仓库等于用 npm 包发布别家公司内容。

**机制**：插件只带 DSH 自己写的入口 `SKILL.md`，上游文件按固定信息钉死：

```ts
// packages/connector/wecom/src/skills.ts:10-18
export const WECOM_SKILLS: UpstreamSkillSet = {
  repository: 'WecomTeam/wecom-cli',
  commit: '4c74ff28838d8fba267eaab5179d9d56f9ca61ae',
  directory: 'skills',
  exclude: [],
  license: 'LICENSE',
  bytes: 1_754_686,
  sha256: 'c75045cc5297d5886c8a7ff01c993a782e50cbd4aa6f6559394b695157d52e10',
}
```

### 六道信任链

| # | 机制 | 细节 |
|---|---|---|
| 1 | **固定 commit** | 不是 tag / branch |
| 2 | **SHA-256 覆盖的是保留文件的路径+内容**，不是归档字节 | 理由写在决策记录里：**GitHub 不保证压缩字节稳定** |
| 3 | 总字节上限 | 超过就停止读取 |
| 4 | 路径检查 | 拒绝空、`.`、`..`、含反斜杠的条目 |
| 5 | **必须带 LICENSE** | 缺就抛错 |
| 6 | **人工审核** | 更新固定 commit 需要改代码：跑 digest 脚本 → 更新入口索引 → **用真实模型运行一次** |

> 第 2 条特别讲究：**对内容做摘要，不对传输产物做摘要。**
> 很多"校验下载"的实现摘要的是 tarball 字节，结果上游换个压缩参数就全盘失效。

### 缺口要写明

- **没有签名、没有 provenance**
- `skillsUrls` 可被配置替换成任意 HTTPS 主机
  （digest 仍保护内容完整性，但不保护"这个 commit 本身是否可信"）
- `skillsDir` 一旦设置就**完全跳过下载和校验**（给测试/离线安装用）

> 钉钉**不用**这个 Service——它自己下载带校验和的 release 资产（钉死 `dws 1.0.64`，
> 5 个平台归档各带 `bytes` + `sha256`）。理由是企微/腾讯会议没有 release 资产，CLI 从 npm 装。

## 五、MCP 支持被整个重写

### 0.2.1 时期是什么样

- 一台 server = `cordis.yml` 里一条静态行，**只能静态配置**
- `mcp-client/src/` **只有 5 个文件**：没有 OAuth、没有 probe、没有状态、没有凭据模板、没有按需加载
- 决策记录自陈：*"客户端插件除日志外没有任何状态出口，激活继承了无界的 SDK 启动等待，
  也没有任何『不挂载就测试一份配置』的途径。"*

### 现在

`mcp-client/src/` 有 **19 个文件**。新增 `ctx.mcpManager` + `ctx.mcpClientHost`：

| 维度 | 变化 |
|---|---|
| 配置 | manager 拥有 volatile `servers` 配置，Settings 页直接 CRUD，**不需要新 API** |
| 插件注册 | `register(name, entry)` 按调用方插件生命周期加入；释放时**等待实例卸载**，插件卸载完成时工具已撤回 |
| 实例模型 | 每个启用条目是经 `ctx.plugin()` 挂在 manager fiber 下的**真 `dsh-mcp-client` 实例**，不是库调用 |
| probe | `probe(name)` 连接→读身份→列工具→关闭，**不预留名称、不注册工具**，可以 probe 已停用条目 |
| 密钥 | `${credential:REF}` 模板；诊断与工具错误里已解析值替换为 `[redacted]`；**manager 不提供写入方法**，浏览器无法定义 server 命令 |
| OAuth | `startAuthorization` / `cancelAuthorization` / `signOut` 是**不带 Remote 的 Host 方法**——避免浏览器指定要授权的 server |
| **按需加载** | `toolLoading: 'on-demand'`：server 不注册工具，改注册 `mcp__<server>__load_tools`；加载注册到 **agent 自己的作用域**，子 agent / fork / 恢复会话都从"零已加载工具"开始 |

按需加载的价值用 Notion 的数字说最清楚：

| 模式 | 模型上下文里的体积 |
|---|---|
| 未授权时的称呼指引 | 约 **70 token**，恒在不变（保 KV cache 前缀稳定） |
| `on-demand` 授权后 | 加载器 + **46 个工具的目录约 6400 字符** |
| `eager` | 全部定义 **约 214500 字符**（单个工具的输入 schema 就约 83000 字符） |

> **约 33 倍的差距。** 这也解释了为什么三个 MCP 连接器的默认都是 `on-demand`。

### ⚠️ 凡是基于 0.2.1 的「MCP 怎么配」的结论都要作废

## 六、🔄 一条我自己的错误推断，记下来

我在派发调研时推断：「`web-search-exa` / `web-search-perplexity` 被删，
是不是被 connector 取代了？」

**不是。** 升级指南 `v0.2.2-alpha.2/web-search-default-provider/guide.zh.md`
里 **connector 零次提及**。真实理由是 Web Search 自己的一条收敛线：

> 过去…… `web.searchProvider` 设为 `deepseek-official`：每次搜索都是发往
> `web-search-deepseek` 端点的一次**辅助 Messages 请求**，调用带服务端 `web_search` 工具的
> `deepseek-v4-flash`，**按模型 token 计费**。现在它设为 `deepseek-search-api`：
> 每次搜索是一次**直接发往 DeepSeek Search API 的请求，不调用模型**，
> 可能产生 Search API 费用而非模型 token 费用。

两件事时间重叠（都在 11 月）但**因果无关**，Search/Fetch provider 和 connector 也不共用任何 ctx 键。

> 记在这里是因为：**时间上挨着 ≠ 有因果**。
> 一轮里同时发生几十件事时，这类"顺手归因"最容易混进文档。

## 七、各连接器的已知限制（落地前要知道）

| 连接器 | 限制 |
|---|---|
| 飞书 / 企微 | **仅 macOS + Windows x64**；命令必须在本 Host 跑（SSH 组合会因路径不存在失败） |
| 飞书 | 入口索引**绑死 `lark-cli` 1.0.97** |
| Notion / Linear / 腾讯文档 | **授权必须在 Host 本机浏览器完成**（回调是 `http://127.0.0.1:<port>`）——**远程访问的 Web Host 无法完成授权** |
| Notion | Desktop 每次启动监听 OS 分配端口，重启后再授权会**注册一个新的 OAuth 客户端**并保留旧注册 |
| Notion | 一次授权供整个 Host 使用，**无账号/工作区选择器** |
| 全部 | **没有任何速率/配额处理**——我在 `packages/connector/**` 和 mcp 包里全量 grep `429` / `rate limit` / `quota` / `Retry-After`，**零命中**。只有时间与体积预算（命令超时默认 30s、等用户固定 10 分钟、stdout 上限 1 MiB） |
