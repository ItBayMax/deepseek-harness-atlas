# 回归校验日志

按 codebase-analysis-visualizer 技能 Phase 4 要求，对可证伪断言逐条核对源码/机械计数。

## 2026-08-17

1. **包数量修正**（真实错误，已修）：早期分析与 Claude 解读文档写作时估算 deepseek-harness 为 "~130 个包"。机械计数（`find packages -mindepth 3 -maxdepth 3 -name package.json -not -path "*node_modules*"`）得 **219** 个 `packages/*/*` 包；加 vendored 9、apps 2、native 3、website/examples 等共 **236** 个 workspace 成员。已修正 `docs/00-学习路线与总览.md`、`docs/01-架构总览与启动组合.md`，站点统计使用 236（`public/extra-stats.json`）。
2. **文件计数**：站点所有模块文件数均由 `_meta/inventory/*.json` 清单求和（`FILE_MAP`），非手填。总计 4765 个在册文件（排除 node_modules/lib/dist/.git 等）。
3. **源码片段核对**：`modules-data.mjs` 的 SNIPPETS 中 agent.ts（Phase 类型 :38、send :113、step :332）、session types.ts（SessionEventMap :236）、tools index.ts（createExecution :1364）、events.ts waterfall、reflect.ts mixin :219 均在本会话中直接读取源文件核实；boot/preset/client/sdk 片段引自探索代理报告中的逐字引用（含真实文件路径）。
4. **包计数二次修正**（用户发现口径不一致，2026-08-17 复核）：PPT 封面把 219 误标为 "workspace 包"；且站点的 236 少算了 website。按 pnpm-workspace.yaml 逐 glob 精确计数：`packages/*/*` 219（dsh 功能包）+ vendor 9 + native 4（landlock-run 1 + 其 packages 3）+ apps 2 + website 1 + examples 1 + python/sdk-runtime 1 = **workspace 全成员 237**。已修：PPT 标签改 "dsh 功能包"、站点统计改为 "dsh 功能包 219（sub: workspace 全成员 237）"、解读文档 01 同步。
5. **rc.8 增量同步（2026-08-20）**：分析基线从 rc.5（47f9438）升到 rc.8（141eb6f，647 commits）。数据侧：模块 25→26（新增 agent-team）、文档 108→111、文件 4765→5014、包 219→226 / workspace 237→244；新增 team 数据流、2 个 pattern 关系、5 组 rc.8 源码片段；`data` 脚本补上 gen-inventory（原来漏跑导致文件数陈旧）。解读文档 00-07 增量更新 + 08 新增。上游发现两处漂移已记录在文档：tool-pwsh-persistent fork 修复前代码（快速就绪通道失效）、ui-renderer README 的 inject 列表过时。
8. **0.1.2-alpha.2 增量同步（2026-08-31，走 dsh-delta-sync 技能）**：基线 rc.8（141eb6f）→ 0.1.2-alpha.2（0a53fb5），**1520 commits**、上游新增 30 包删 5 包。数据侧：模块 26→29（新增 webhook / webworker / inspector）、文档 111→124、文件 5014→5255、包 226→251 / workspace 244→268；新增 2 条数据流（webhook-flow / browser-only）、6 条关系、4 个 pattern、7 组源码片段。解读文档：00/01/03/04/05/07 增量更新 + 09/10/11 三篇新增（共 12 篇）。**管线修复**：`experimental` 拆成 agent-team / webworker / inspector 三个清单分组（否则新模块 files=0）。上游漂移记录 5 处（api-gateway.md 称 Remote 仅一元、tools.md 呈现节未跟上客户端派生、settings-controller README 用改名前错误码、投影 Note 举例已删除的 ApiProxyService、持久化 Note 把 schema 19 成果归给 20）。
6. **开源准备（2026-08-20）**：原 .gitignore 忽略 public/data 与 public/docs——克隆者会拿到无数据空壳，已重写（分析数据/文档/清单必须提交；sqlite 二进制副产物、IDE 与 AI 工具目录忽略）。新增 scripts/data.mjs 管线守卫：缺 deepseek-harness 时跳过 gen-inventory，任一文档源缺失时跳过 sync-docs（其 rmSync 会删光已提交的 111 篇文档）；双模式已实测。README 增"克隆者零配置"说明。
9. **0.2.0-rc.2 增量同步（2026-09-30，走 dsh-delta-sync 技能）**：基线 0.1.2-alpha.2（0a53fb5）→ **0.2.0-rc.2（639ed01）**，**693 个主线提交**（含 PR 分支共 6010）、跨越 0.1.3/0.1.5/0.1.6/0.1.7 四个中间版本、**上游新增约 73 包删 13 包、新增 25 个 ctx 接缝**。数据侧：模块 29→**37**（新增 session-format / ptc-runtime / ssh-remote / modality / account / plugin-lifecycle / telemetry / sidebar-right）、关系 14→22、模式 20→26、源码片段 16→21 组（39 条）、在册文件 5255→**8619**、包 251→**316** / workspace 268→**338**、文档 124→**197**。解读文档：00/02/03/04/05/06/07/08 增量更新 + **12/13/14/15 四篇新增**（共 16 篇）；ops 运维文档同步修正 5 处。

   **管线修复三处**：① 移除已删除的 e2b / code-runtime / examples-pkg / examples-root 四个清单分组；② 新增 ssh / ptc-runtime / browser-use / computer-use / document / deliverables / telemetry / benchmarks / snapshots 九组；③ 误加的 `client` 分组与既有 `clientSplit()` 产生的 client-kernel + client-ui **重复计数 2385 文件**，已移除并清理孤儿 `_meta/inventory/client.json`。**教训：grep 清单配置时要同时匹配 `dir:` 和 `dirs:` 两种写法**——我第一次 grep 只匹配了 `dir:`，漏掉了用函数返回 `dirs` 的 client 分组，导致重复计数。`examples` 模块改指 `snapshots/`（上游已删 examples/ 与 packages/examples，snapshots 1278 文件取而代之）。

   **本轮推翻的旧结论 10 条**（已在各文档原地更正，并在 docs/00 文末集中列出）：
   (1) fail-loud 行为——只剩 7 个必需条目能中止启动，其余失败只 warn，且 Loader 明确非事务、失败不回滚；
   (2) SESSION_FORMAT_VERSION 0→4；
   (3) `tool/code-dispatch*` 已改名 `tool/ptc-dispatch*`（v2→v3），v4 硬拒旧名；
   (4) 打包 chunk row 顶层形态消失，`seq0`/`time0`/`dt`/`texts` 搬进 `assistant/message.data.stream[]`；
   (5) `$DSH_HOME/settings.yaml` 已删除，一次性导入 profile 后改名 `.imported`；
   (6) PTC 运行时换址 `packages/ptc-runtime/*` 且换实现（worker thread → OS 沙箱约束进程）；
   (7) E2B 整组删除，换 SSH provider family（但未在任何出厂 profile 挂载）；
   (8) 会话持久化只剩 JSONL，sqlite 包删除且无自动迁移；
   (9) Agent Teams 双 bundle 合并，**旧 profile 选过被删的 web-profile 升级会启动失败且无自动迁移**；
   (10) `llm-deepseek` 从插件降级为共享协议库。

   **经核验仍然成立**：Cordis 内核五个核心文件（context / service / registry / reflect / utils）**字节级未变**（blob hash 逐一比对），且官方 `docs/cordis-primer.md` 零 diff；`.credentials.yaml` 的 refs/records 两段式零语义变更（该文件 diff 仅 −18 行重复代码检测注释）；客户端 `conversation.view` 插槽仍有效（三处证据）。

   **上游发现（可提 issue）**：`2026-09-17-settings-pages-as-companion-packages` Note 写的是 `ctx.settingsScope`，实际服务名是 `ctx.configForms`（config-form.ts:266）；`ptc-runtime/src/index.ts:112` 与 `ptc-runtime-python/src/index.ts:800` 的 JSDoc 仍称 Python 后端 private/not published，但 package.json 的 publishConfig 与 `scripts/experimental-package-policy.ts` 的空 denylist 显示它已公开发布。

   **浏览器验证**：meta 徽章（0.2.0-rc.2 / 639ed01539 / 2026-09-30）、37 模块全部 files 非零、26 个模式、新增文档 HTTP 200、控制台零错误；`npm run build` 通过（25.13s）。

7. **浏览器验证**：首页/架构分层/依赖脉络（25 节点 45 边）/核心流程/模块详情（关键源码标签页）/双源文档库（108 篇，claude 8 + official 100）/mermaid 时序图（agent-lifecycle.zh.md，510×465 SVG）全部渲染正常，控制台零错误；`npm run build` 通过。


---

## 2026-10-22 · 基线 0.2.0-rc.2 → 0.2.1-rc.2（`639ed01` → `687f282`，1925 个主线 commit）

**数据规模变化**

| 项 | 上轮 | 本轮 |
|---|---|---|
| dsh 功能包（`packages/*/*`） | 316 | **342** |
| workspace 全成员 | 338 | **365** |
| `packages/experimental/` | 21 | **47**（新增 27、删除 1） |
| atlas 模块 | 37 | **41** |
| 清单文件合计 | 7341 | **10496** |
| 解读文档 | 16 篇 | **17 篇**（新增「17 实验层与包分类治理」；16 为本轮前半段新增） |

**本轮推翻的旧结论 5 条**（已在各文档原地更正，docs/00 文末新开一张表）：
(1) **局域网绑定**——`host` 从两值枚举（`127.0.0.1`/`0.0.0.0`）改为接受任意**具体** IPv4/IPv6 字面量，
    通配地址拒得更早；新增原生 TLS（`--tls-cert`/`--tls-key`）。**这意味着 socket 代理不再必要。**
(2) **凭据优先级翻转**——`.credentials.yaml` 现在压过导出的环境变量，`KEY=… dsh` 按次覆盖失效
    （出厂 headless profile 例外，它整个不挂载凭据存储）。
(3) **`engines.dsh` 语义反转**——从被忽略变成独自裁决，peers 失效，fail-closed。
(4) **会话格式版本号不再是充分判据**——版本号仍是 4，但事件词汇表扩张，
    0.2.0 读取器会**拒绝**含 `working-directory/change` 的 0.2.1 日志。
(5) **`ctx.invariants` 整包删除**——且职责**未转移而是被放弃**（见下）。

**经核验仍然成立**：`AssistantStreamRecord` 四变体与 `SessionEventLikeEntry` 二元
**字节级未变**（`git diff` 为空）；`.credentials.yaml` 两段式结构未变；
`conversation.view` 插槽仍有效；`dsh.manifestVersion` 仍只是声明、全仓无校验点。

**上游发现（可提 issue）**
1. `packages/client/AGENTS.md:108` 仍让实现者写 `chunkrow/*` 分支，该类型在 `.ts/.tsx` 里 0 命中
   —— 已提 Discussion #8540（本轮确认行号从 104 漂到 108，问题仍在）。
2. `packages/util/package-manifest/README.md:93` 仍写「不强制检查 `engines.dsh`」—— 已反。
3. 插件市场索引格式 Note 写 `engines` 必填，实现是可选（`plugin-market-index/src/types.ts:62-63`）。
4. `2026-10-06-web-desktop-plugin-identity-compatibility` 标题误导，内容与 web/desktop 身份无关。
5. `PRIVATE_EXPERIMENTAL_PACKAGE_DIRECTORIES` 是空数组，但 AGENTS.md 把它写得像有成员。
6. **invariants 删除（−15409 行）没有留下任何 `notes/implemented/` 决策记录**，
   违反该仓库自己 `docs/AGENTS.md` 的规定；要还原「为什么放弃运行时关系检查」
   只能读两篇旧 Note 的 **diff**。

**本轮修掉的自身缺陷**
- `gen-inventory.mjs` 三个分组指向已不存在的目录（`packages/webhook`、`packages/hooks`、
  `packages/runtime-diagnostics`）；`_meta/inventory/` 下留有对应的 3 个孤儿 JSON（91 条），
  已删。**与上轮 `client.json` 孤儿同一类错误。**
- `experimental/` 47 个包里此前只覆盖 3 个子组，**44 个包完全没进清单**；
  新增 `experimental-rest` 兜底组（758 文件），并按目录实际内容取补集以免重复计数。
- 第一版 `covered` 集合写错包名（写了不存在的 `agent-team-bundle`，漏了实际存在的
  `agent-team-profile`/`agent-team-web-profile`/`client-ui-agent-team`），虚增 28 个文件，已修。
- `FILE_MAP` 有 5 条悬空映射，其中 **2 条（`e2b`、`code-runtime`）是上一轮删分组时漏改的遗留**，
  已一并修正为 `ssh` / `ptc-runtime`。
- 新增一次性重叠校验脚本；它第一版因字段名写错（`entry.path` 实为 `entry.f`）解析出 0 条却报
  「✅ 无重叠」—— **一个只会通过的检查等于没有检查**，已加语料防护（合计为 0 即失败）。

**浏览器验证**：meta 徽章（dsh@0.2.1-rc.2 / 687f282e86 / 2026-10-22）、41 模块、
4 个新模块 doc 链接正确、新增两篇文档 HTTP 200（8244 / 10876 字节）、控制台零错误；
`npm run data` 10496 文件、重叠校验 0 重复；`npm run build` 通过。

**安全核查**：`public/` 与 `dist/` 下 ops 文档痕迹 **0 条**、
服务器 IP / 本地绝对路径命中 **0 个文件**。
> 注：dev server 对不存在路径返回 SPA 回退页（HTTP 200），
> 单看状态码会误判为泄漏——验证时必须带一个「确定不存在」的对照路径比对响应体。
