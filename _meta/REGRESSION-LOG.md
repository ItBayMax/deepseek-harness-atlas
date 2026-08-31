# 回归校验日志

按 codebase-analysis-visualizer 技能 Phase 4 要求，对可证伪断言逐条核对源码/机械计数。

## 2026-08-17

1. **包数量修正**（真实错误，已修）：早期分析与 Claude 解读文档写作时估算 deepseek-harness 为 "~130 个包"。机械计数（`find packages -mindepth 3 -maxdepth 3 -name package.json -not -path "*node_modules*"`）得 **219** 个 `packages/*/*` 包；加 vendored 9、apps 2、native 3、website/examples 等共 **236** 个 workspace 成员。已修正 `docs/00-学习路线与总览.md`、`docs/01-架构总览与启动组合.md`，站点统计使用 236（`public/extra-stats.json`）。
2. **文件计数**：站点所有模块文件数均由 `_meta/inventory/*.json` 清单求和（`FILE_MAP`），非手填。总计 4765 个在册文件（排除 node_modules/lib/dist/.git 等）。
3. **源码片段核对**：`modules-data.mjs` 的 SNIPPETS 中 agent.ts（Phase 类型 :38、send :113、step :332）、session types.ts（SessionEventMap :236）、tools index.ts（createExecution :1364）、events.ts waterfall、reflect.ts mixin :219 均在本会话中直接读取源文件核实；boot/preset/client/sdk 片段引自探索代理报告中的逐字引用（含真实文件路径）。
4. **包计数二次修正**（用户发现口径不一致，2026-08-17 复核）：PPT 封面把 219 误标为 "workspace 包"；且站点的 236 少算了 website。按 pnpm-workspace.yaml 逐 glob 精确计数：`packages/*/*` 219（dsh 功能包）+ vendor 9 + native 4（landlock-run 1 + 其 packages 3）+ apps 2 + website 1 + examples 1 + python/sdk-runtime 1 = **workspace 全成员 237**。已修：PPT 标签改 "dsh 功能包"、站点统计改为 "dsh 功能包 219（sub: workspace 全成员 237）"、解读文档 01 同步。
5. **rc.8 增量同步（2026-08-20）**：分析基线从 rc.5（47f9438）升到 rc.8（141eb6f，647 commits）。数据侧：模块 25→26（新增 agent-team）、文档 108→111、文件 4765→5014、包 219→226 / workspace 237→244；新增 team 数据流、2 个 pattern 关系、5 组 rc.8 源码片段；`data` 脚本补上 gen-inventory（原来漏跑导致文件数陈旧）。解读文档 00-07 增量更新 + 08 新增。上游发现两处漂移已记录在文档：tool-pwsh-persistent fork 修复前代码（快速就绪通道失效）、ui-renderer README 的 inject 列表过时。
7. **0.1.2-alpha.2 增量同步（2026-09-03，走 dsh-delta-sync 技能）**：基线 rc.8（141eb6f）→ 0.1.2-alpha.2（0a53fb5），**1520 commits**、上游新增 30 包删 5 包。数据侧：模块 26→29（新增 webhook / webworker / inspector）、文档 111→124、文件 5014→5255、包 226→251 / workspace 244→268；新增 2 条数据流（webhook-flow / browser-only）、6 条关系、4 个 pattern、7 组源码片段。解读文档：00/01/03/04/05/07 增量更新 + 09/10/11 三篇新增（共 12 篇）。**管线修复**：`experimental` 拆成 agent-team / webworker / inspector 三个清单分组（否则新模块 files=0）。上游漂移记录 5 处（api-gateway.md 称 Remote 仅一元、tools.md 呈现节未跟上客户端派生、settings-controller README 用改名前错误码、投影 Note 举例已删除的 ApiProxyService、持久化 Note 把 schema 19 成果归给 20）。
6. **开源准备（2026-08-20）**：原 .gitignore 忽略 public/data 与 public/docs——克隆者会拿到无数据空壳，已重写（分析数据/文档/清单必须提交；sqlite 二进制副产物、IDE 与 AI 工具目录忽略）。新增 scripts/data.mjs 管线守卫：缺 deepseek-harness 时跳过 gen-inventory，任一文档源缺失时跳过 sync-docs（其 rmSync 会删光已提交的 111 篇文档）；双模式已实测。README 增"克隆者零配置"说明。
7. **浏览器验证**：首页/架构分层/依赖脉络（25 节点 45 边）/核心流程/模块详情（关键源码标签页）/双源文档库（108 篇，claude 8 + official 100）/mermaid 时序图（agent-lifecycle.zh.md，510×465 SVG）全部渲染正常，控制台零错误；`npm run build` 通过。
