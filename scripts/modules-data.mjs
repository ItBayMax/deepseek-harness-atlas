// DeepSeek Harness (dsh) 知识库数据集 —— 由 Claude 深度源码分析后人工整编。
// 文件数由 gen-inventory.mjs 的清单自动统计（FILE_MAP），不手填。
// doc 路径相对 public/docs/（claude/ = Claude 解读文档；official/ = 官方文档）。

export const LAYERS = [
  { id: 'entry',     side: '宿主（Node 进程）', name: '入口与组合',       color: '#f59e0b', order: 1 },
  { id: 'kernel',    side: '宿主（Node 进程）', name: 'Cordis 内核',      color: '#f43f5e', order: 2 },
  { id: 'core',      side: '宿主（Node 进程）', name: '核心脊柱',         color: '#ef4444', order: 3 },
  { id: 'model',     side: '宿主（Node 进程）', name: '模型域',           color: '#fb923c', order: 4 },
  { id: 'exec',      side: '宿主（Node 进程）', name: '执行世界',         color: '#8b5cf6', order: 5 },
  { id: 'feature',   side: '宿主（Node 进程）', name: '高阶能力',         color: '#ec4899', order: 6 },
  { id: 'data',      side: '宿主（Node 进程）', name: '会话与数据',       color: '#06b6d4', order: 7 },
  { id: 'protocol',  side: '宿主（Node 进程）', name: '宿主服务与外部协议', color: '#10b981', order: 8 },
  { id: 'support',   side: '宿主（Node 进程）', name: '支撑与质量',       color: '#64748b', order: 9 },
  { id: 'fe-kernel', side: '浏览器（Web 客户端）', name: '浏览器内核',    color: '#3b82f6', order: 10 },
  { id: 'fe-ui',     side: '浏览器（Web 客户端）', name: 'UI 插件族',     color: '#38bdf8', order: 11 },
];

export const MODULES = [
  { id: 'cli-boot', side: '宿主（Node 进程）', layer: 'entry', name: 'cli + boot', title: 'dsh 命令行入口与启动流水线',
    doc: 'claude/01-架构总览与启动组合.md',
    oneLiner: '从 `dsh web` 一条命令到插件树：分层 .env → composeProfile 叠补丁 → boot 挂 Loader → fail-loud 巡检 → 用户补丁热监听。',
    keyClasses: ['runProfile()', 'composeProfile()', 'boot()', 'mountRootInclude()', 'loadLayeredEnv()'],
    patterns: ['组合根', '分层配置补丁'], deps: ['bundles', 'cordis-vendor'],
    tags: ['entrypoint', 'profile', 'patch-layers'],
    risks: ['补丁替换的是目标行的整个 config，不做深合并——每个值只能住一层', '每次启动会把 profile 的 cordis.yml 重写为空列表根，别把配置写在那里'] },

  { id: 'bundles', side: '宿主（Node 进程）', layer: 'entry', name: 'bundle + preset', title: '发行组合层与 per-session 预设',
    doc: 'claude/01-架构总览与启动组合.md',
    oneLiner: 'dsh-base / dsh-web-app / dsh-headless 三个补丁层拼出产品形态；agent-presets 按会话组合 agent 面插件树（standard/code/cordis/minimal）。',
    keyClasses: ['cordis.patch.yml', 'dsh.profile.bundles', 'AgentPresets', 'ensureStanding()', 'PresetTree'],
    patterns: ['分层配置补丁', '领域隔离（isolate）'], deps: ['cordis-vendor'],
    tags: ['bundle', 'preset', 'composition'],
    risks: ['preset 组合审计：服务发布进根领域会被拒绝，必须包 isolate group', 'web-app 层 disable 掉 base 的约 25 个 agent 面行——工具改由 preset 挂载，排查"工具去哪了"先看这里'] },

  { id: 'cordis-vendor', side: '宿主（Node 进程）', layer: 'kernel', name: 'vendor (Cordis)', title: 'Cordis 框架源码拷贝（内核）',
    doc: 'claude/02-Cordis内核机制.md',
    oneLiner: '插件/服务/事件/效果四位一体：Context 原型派生、Fiber 纪元驱动生命周期、四种事件派发、effect 树支撑 HMR 与干净卸载。',
    keyClasses: ['Context', 'Service', 'Fiber', 'EventsService.waterfall', 'ReflectService', 'Loader', 'Include', 'Hmr', 'Schema(schemastery)'],
    patterns: ['微内核', 'Waterfall 中间件', '效果/析构器（RAII）', '纪元驱动重载'], deps: [],
    tags: ['framework', 'vendored', 'plugin-system'],
    risks: ['vendor 是钉版本拷贝（cordis@4.0.0-rc.7 + 本地修改清单在 vendor/README.md），别当 npm 依赖升级', 'cordis.yml 行省略 id 会得随机 id，每次改配置都像删了重加——务必写 id'] },

  { id: 'core-spine', side: '宿主（Node 进程）', layer: 'core', name: 'core', title: '核心脊柱：会话日志·Agent 循环·工具·提示词',
    doc: 'claude/03-Agent循环与会话日志.md',
    oneLiner: 'append-only SessionEvent 日志是唯一事实源；ReactLoopAgent 驱动 turn/step；ToolRuntime 六段守卫管线 + Code Mode；systemPrompt 组装分节与工具 schema。',
    keyClasses: ['ReactLoopAgent', 'Session', 'SessionEventMap', 'Inbox', 'ToolRuntime', 'defineTool', 'SystemPromptService', 'createScope'],
    patterns: ['事件溯源', 'Waterfall 中间件', '单调守卫', '声明合并扩展'], deps: ['llm', 'cordis-vendor'],
    tags: ['agent-loop', 'session-log', 'tools', 'scope'],
    risks: ['铁律：模型可见 ⟺ 已落日志——新模型可见输入必须新增会话事件', '改 agent-loop 本身需同步更新 docs/architecture.md；新行为一律挂扩展点'] },

  { id: 'llm', side: '宿主（Node 进程）', layer: 'model', name: 'llm', title: '模型接缝与适配器',
    doc: 'official/subsystems/llm-streaming.zh.md',
    oneLiner: '供应商中立的消息/流词汇 + 适配器注册表：llm-deepseek、llm-pi-ai、llm-replay（测试回放）；一切结局收敛为终结 finish chunk。rc.8：deepseek 直连视觉输入（按精确模型 inputModalities 门控）、reasoning_content 每推理轮回传、ReplayEnvelope 对齐修复、pi-ai 兼容字段漂移门（30 字段逐一 offer/withhold）。',
    keyClasses: ['LlmRuntime', 'LlmAdapter', 'BlockAssembler', 'ReplayEnvelope', 'offloadRequestImages()', 'inputModalities', 'StreamChunk', 'prepareCall()'],
    patterns: ['适配器', '能力接缝三角色'], deps: ['cordis-vendor'],
    tags: ['llm', 'adapter', 'streaming', 'multimodal'],
    risks: ['adapter 不得跨流 API 抛错：操作性失败用 finish{error/aborted}', 'llm/stream 包装器 emit 过 chunk 后重试没有持久尝试边界——重试策略应挂 agent/request-error', '请求级图像 20MiB 上界用"最旧优先换占位符"的纯函数保证——回放可复现所以不落日志事件'] },

  { id: 'compaction', side: '宿主（Node 进程）', layer: 'model', name: 'compaction + context', title: '上下文压缩与请求上下文',
    doc: 'official/subsystems/compaction.zh.md',
    oneLiner: '压力触发（agent/pre-step）+ 溢出恢复（agent/request-error）双路径；先剪超大工具结果再做摘要；surface replace 保历史完整。',
    keyClasses: ['CompactionService', 'compaction-basic', 'tool-result-pruner', 'token-meter', 'agent-instructions', 'time-context'],
    patterns: ['事件溯源', '策略与能力解耦'], deps: ['llm', 'core-spine'],
    tags: ['compaction', 'context-window'],
    risks: ['压缩从不删日志——它写 surface replace 节点；调试历史问题永远能回放'] },

  { id: 'fs', side: '宿主（Node 进程）', layer: 'exec', name: 'fs', title: '文件系统接缝',
    doc: 'official/subsystems/filesystem.zh.md',
    oneLiner: 'ctx.fs 三实现（local/sandbox/e2b）+ tool-fs 消费者；fs-observation-policy 用 fs/* 事件门做"读后改"校验。',
    keyClasses: ['FsService', 'fs-local', 'fs-sandbox', 'tool-fs', 'fs/write-intent', 'fs/observed'],
    patterns: ['能力接缝三角色', '事件门'], deps: ['core-spine', 'sandbox'],
    tags: ['filesystem', 'seam'],
    risks: ['fs-sandbox 与 bash-sandbox 共读 sandboxPolicy——两族强制器不会限制到不同根目录'] },

  { id: 'shell-exec', side: '宿主（Node 进程）', layer: 'exec', name: 'shell + subprocess + terminal', title: 'Shell 执行·进程树·持久终端',
    doc: 'official/subsystems/shell.zh.md',
    oneLiner: '官方钦定的接缝模板：dsh-shell（定义）/ bash-local·bash-sandbox·pwsh-local（实现）/ tool-bash（消费）；一切进程经 ctx.subprocess 生成。rc.8：terminal-bash 加 shellDialect 双方言（bash/pwsh 同一 OSC 133;D; 就绪协议），新增 tool-pwsh-persistent + Windows koffi 进程探测器。',
    keyClasses: ['ShellExecutor', 'bash-local', 'bash-sandbox', 'pwsh-local', 'tool-pwsh-persistent', 'shellDialect', 'SubprocessService', 'WindowsProcessInspector', 'TerminalRegistry', 'shell-env'],
    patterns: ['能力接缝三角色', '显式 resolve(request)→Spec'], deps: ['core-spine', 'sandbox'],
    tags: ['shell', 'pty', 'subprocess'],
    risks: ['补默认值是 owning 实现里的显式 resolve 步骤，别在 run() 里藏 ?? default——这是全仓库的模板纪律', 'rc.8 修复：tool-bash-persistent 曾覆盖受控提示符把快速就绪打死（3540ms→86ms）；⚠️ tool-pwsh-persistent fork 自修复前代码，同一问题在 pwsh 上仍在（src/index.ts:20 覆盖 dsh> 提示符）'] },

  { id: 'sandbox', side: '宿主（Node 进程）', layer: 'exec', name: 'sandbox + e2b + native', title: '进程沙箱与远程执行世界',
    doc: 'official/subsystems/sandbox.zh.md',
    oneLiner: '消费者交出 argv，backend 按策略包装（macOS sandbox-exec / Linux landlock / Windows ACL）；E2B 把 fs+subprocess 整体搬进远程 Linux 沙箱。',
    keyClasses: ['SandboxService', 'sandbox-policy', 'landlock-run', 'E2bService', 'fs-e2b', 'subprocess-e2b'],
    patterns: ['能力接缝三角色', '换 provider 换世界'], deps: ['cordis-vendor'],
    tags: ['sandbox', 'e2b', 'security'],
    risks: ['沙箱模式+workspaceRoot 只有一个家（sandboxPolicy）；bash-sandbox 在 win32 被 disabled——Windows 走 ACL 方案'] },

  { id: 'code-lsp', side: '宿主（Node 进程）', layer: 'exec', name: 'code-runtime + lsp', title: 'Code Mode 运行时与语言服务',
    doc: 'official/subsystems/code-runtime.zh.md',
    oneLiner: 'ctx.codeRuntime 在 worker 线程跑模型写的程序（Code Mode 的基底）；ctx.lsp 归一化四操作的语言服务导航。rc.8：Python 运行时起步——fd3 JSON-lines 帧协议先行（无版本字段，编译期 roster + 真 python3 镜像 e2e 抓漂移）。',
    keyClasses: ['CodeRuntime', 'code-runtime-worker', 'code-runtime-python(fd3)', 'validateChildFrame()', 'LspService', 'lsp-stdio', 'tool-lsp'],
    patterns: ['能力接缝三角色', '进程边界运行时验证'], deps: ['core-spine', 'shell-exec'],
    tags: ['code-mode', 'lsp', 'python'],
    risks: ['Code Mode 中间值不落日志、无字节上限——生产者的诚实获取边界和进程内存仍然要紧', '跨语言可移植靠构造保证：保留字集合 = ECMAScript ∪ Python 关键字，两后端同一套'] },

  { id: 'skill', side: '宿主（Node 进程）', layer: 'feature', name: 'skill', title: '技能系统',
    doc: 'official/subsystems/skills.zh.md',
    oneLiner: 'ctx.skills 合并多 provider 技能目录（filesystem/badge）；tool-skill 渲染会话前缀目录并按需加载完整技能体。',
    keyClasses: ['SkillService', 'skill-filesystem', 'tool-skill'],
    patterns: ['能力接缝三角色', '渐进披露'], deps: ['core-spine'],
    tags: ['skills', 'progressive-disclosure'],
    risks: ['技能内容经 inject() 落日志进下一请求——不是系统提示常驻'] },

  { id: 'subagent', side: '宿主（Node 进程）', layer: 'feature', name: 'subagent', title: '子代理委托（六种传输）',
    doc: 'official/subsystems/subagent.zh.md',
    oneLiner: '一个接缝六个 provider：同进程 spawn/fork、ACP、Codex CLI、Claude Code CLI、dsh SDK——模型工具无感知；可把 turn 委托给另一个产品。rc.8 四项产品化：providerName 具名多实例、one-shot 后台（复用 ctx.jobs）、产品原生 permissionMode（不进工具 schema，模型无法提权）、结构化失败诊断。',
    keyClasses: ['SubagentService', 'startContinuable({childId})', 'drainContinuableChildren()', 'providerName', 'SubagentResult.diagnostic', 'subagent-acp', 'subagent-claude-code', 'tool-subagent'],
    patterns: ['能力接缝三角色', '策略与传输分离'], deps: ['core-spine', 'shell-exec'],
    tags: ['delegation', 'multi-agent'],
    risks: ['delegationDepth 持久化在会话头——递归预算重启后仍生效，不会重置为顶层', 'permissionMode 按 provider 实例固定：想要不同权限=挂两行不同名 provider，不是加运行时开关'] },

  { id: 'agent-team', side: '宿主（Node 进程）', layer: 'feature', name: 'experimental/agent-team', title: '🆕 Agent Teams：持久花名册·信箱·任务板',
    doc: 'claude/08-AgentTeams多代理协作.md',
    oneLiner: 'rc.8 实验特性：每个根会话是隐式 Team 的 Lead（TeamId=SessionId，无 creation event）；四种 team/* 事件全落 Lead 日志——协作也是事件溯源的；十个 scoped 工具 + CAS 任务板 + queued/delivered 两段式信箱，全部叠在 subagent 接缝之上。',
    keyClasses: ['TeamService(ctx.agentTeams)', 'foldTeam()', 'team/member', 'team/message/queued|delivered', 'team/task', 'spawn_teammate', 'wait_agent', 'team_task_update(CAS)'],
    patterns: ['事件溯源', 'CAS 乐观并发', '实验包隔离'], deps: ['subagent', 'session', 'core-spine'],
    tags: ['experimental', 'agent-teams', 'multi-agent'],
    risks: ['writeScopes 只警告不上锁——共享 checkout 的并发要靠任务切分 + Lead 终审 diff', 'scoped 的 send_message/list_agents/interrupt_agent 遮蔽 tool-subagent-control 同名全局工具，同挂需 disable 旧行', '失败成员永久占用名字（可见性优先于回收）；quiet 消息发给 inactive 成员会一直等它因别的原因醒来'] },

  { id: 'webhook', side: '宿主（Node 进程）', layer: 'feature', name: 'webhook', title: '🆕 Webhook 自动化入口',
    doc: 'claude/11-Webhook与自动化入口.md',
    oneLiner: '0.1.2 新增：刻意只有两个方法（register/dispatch），唯一内建动作是"把验签的外部事件变成一个普通根会话"，然后退出画面。HMAC 在 JSON.parse 之前验；GitHub 评审示例的结果进 DSH 会话而非 PR 评论。',
    keyClasses: ['WebhookRuntime(ctx.webhookRuntime)', 'register(rule)', 'dispatch(delivery)', 'WebhookSessionRequest', 'webhook-github handler', 'MessageSourceMap.webhook'],
    patterns: ['能力接缝三角色', '领域隔离（isolate）', 'Fail-closed 审批'], deps: ['core-spine', 'storage-config', 'host-rpc'],
    tags: ['webhook', 'automation', 'github'],
    risks: ['202 故意弱于现实：它先于规则匹配与会话创建，从不表示"会话已存在"', '无去重、无重试、无完成结果——幂等是规则的责任；崩溃会丢未准入的调用', '规则是任意受信代码（Cordis 插件，全宿主权限），信任级别等同 shell 访问', '默认没有任何 bundle 挂载它，只能靠 patch overlay 激活'] },

  { id: 'webworker', side: '宿主（Node 进程）', layer: 'feature', name: 'experimental/webworker', title: '🆕 浏览器内运行时（WebWorker）',
    doc: 'claude/09-浏览器内运行时WebWorker.md',
    oneLiner: '0.1.2 实验特性：整棵 harness 插件树跑在一个浏览器 Web Worker 里，跑逐字节相同的 web profile 配置。唯一平台分叉是一张模块代理表——fs-local/subprocess-local/bash-sandbox/chokidar/landlock-run 全部原样运行。',
    keyClasses: ['createWorkerHost()', 'MODULE_PROXIES', 'MemoryVfs', 'LOWERING_VERSION', 'WRAPPER_PARAMS', 'LANDLOCK_EXECUTABLE', 'TunnelServer'],
    patterns: ['能力接缝三角色', '换 provider 换世界', '同构插件树', '实验包隔离'], deps: ['cordis-vendor', 'fs', 'shell-exec', 'sandbox'],
    tags: ['experimental', 'browser', 'webworker', 'vfs'],
    risks: ['worker_threads/vm/net/sqlite/dns 是结构桩——workflow 与 code-runtime 插件挂得上、一用就失败', 'shell 不是 bash：无循环/函数/作业控制，命令表只有 coreutils（无 git 无网络工具）', 'Worker 限制是 VFS 边界不是内核 Landlock——官方明确不声称原生进程隔离', 'shell 进程无同步文件系统（SAB 需要 COOP/COEP，GitHub Pages 给不了），目录遍历每条目一次往返'] },

  { id: 'inspector', side: '宿主（Node 进程）', layer: 'support', name: 'experimental/inspector', title: '🆕 Inspector：DevTools 看活插件树',
    doc: 'claude/10-Inspector与运行时检视.md',
    oneLiner: '0.1.2 实验特性：把运行中的宿主与浏览器客户端同时挂到 Chrome DevTools。Worker 是唯一 CDP 端点——因为宿主主线程暂停时无法投递 Debugger.resume；Elements 面板里渲染活的 Cordis 树。',
    keyClasses: ['InspectorService(ctx.inspector)', 'publish(topic,payload)', 'CordisTreeCollector', 'CordisTreeSnapshot', 'CdpNumericId<Role>', 'cordis.getTree()'],
    patterns: ['Branded 不透明 id', '效果/析构器（RAII）', '实验包隔离'], deps: ['cordis-vendor', 'extensions'],
    tags: ['experimental', 'devtools', 'observability', 'cdp'],
    risks: ['CDP target 授予宿主/客户端领域任意代码执行，fetch 抓包含机密且零脱敏——loopback 监听是必须的，但它不是认证', '客户端活跃调试不支持（页面 JS 无法一边暂停自己一边处理控制消息）', 'Cordis 没有全局 Context 注册表：只被应用代码持有的 Context 刻意缺席', 'Worker 意外退出不自动重启'] },

  { id: 'workflow', side: '宿主（Node 进程）', layer: 'feature', name: 'workflow + jobs', title: '工作流引擎与后台任务',
    doc: 'official/subsystems/workflow.zh.md',
    oneLiner: 'ctx.workflowEngine（worker 线程）跑编排脚本，agent() 扇出走 ctx.subagents；ctx.jobs 是后台工作的统一注册表（bash/PTY/子代理都是生产者）。',
    keyClasses: ['WorkflowEngine', 'tool-workflow', 'tool-ralph', 'JobsService', 'jobs-local', 'tool-jobs'],
    patterns: ['编排引擎', '统一任务注册表'], deps: ['subagent', 'core-spine'],
    tags: ['workflow', 'ralph', 'background-jobs'],
    risks: ['job id 一旦发布，外层调用取消不再杀死工作——job_kill/owner 销毁才拥有那条命', 'Ralph 每轮是全新子会话：不带父对话种子，只靠共享工作区+bounded handoff'] },

  { id: 'goal-plan', side: '宿主（Node 进程）', layer: 'feature', name: 'goal + plan + todo + schedule + guard', title: '目标·计划·待办·调度·防护',
    doc: 'official/subsystems/goal.zh.md',
    oneLiner: '同会话持久目标（goal round 续跑）、日志态计划模式、todo 全量快照、定时调度、循环卫生与工具超时策略。',
    keyClasses: ['GoalService', 'goal-round-driver', 'PlanMode', 'tool-todo', 'schedule', 'repeat-tool-reminder', 'timeout-policy'],
    patterns: ['事件溯源', '外层策略回合（round）'], deps: ['core-spine'],
    tags: ['goal', 'plan-mode', 'todo', 'cron'],
    risks: ['goal activation 故意不持久化——resume/fork 后必须人再授权才能自动续跑（安全设计）'] },

  { id: 'web-capability', side: '宿主（Node 进程）', layer: 'feature', name: 'web + spill', title: 'Web 检索与超大输出外溢',
    doc: 'official/subsystems/web.zh.md',
    oneLiner: 'ctx.web 一个接缝聚合 exa/perplexity/deepseek 搜索 + http fetch；spill 把超限工具文本外溢成定位符+取回提示。',
    keyClasses: ['WebRuntime', 'web-search-deepseek', 'web-fetch-http', 'tool-web', 'SpillStore', 'spill-policy'],
    patterns: ['能力接缝三角色'], deps: ['core-spine'],
    tags: ['web-search', 'spill'],
    risks: ['spill-policy 是 tools/post-execute 消费者——外溢决策在结果管线里，不在工具本体'] },

  { id: 'interaction', side: '宿主（Node 进程）', layer: 'feature', name: 'interaction + feedback + hooks', title: '审批·提问·命令·Hook 桥',
    doc: 'official/subsystems/approval.zh.md',
    oneLiner: 'approval/request waterfall 一次性审批（无应答者=fail-closed 拒绝）；ctx.commands 人类命令不经模型；hooks-claude-code/codex 把外部 hook 配置桥到原生扩展点。',
    keyClasses: ['ApprovalService', 'user-questions', 'tool-ask-user', 'CommandRegistry', 'permission-presets', 'hooks-claude-code'],
    patterns: ['Fail-closed', 'Waterfall 中间件', '协议桥'], deps: ['core-spine', 'shell-exec'],
    tags: ['approval', 'commands', 'hooks'],
    risks: ['审批解析先于单调守卫，但"不可重排的所有者策略"必须注册成 guard 而不是 pre-execute 监听器'] },

  { id: 'session', side: '宿主（Node 进程）', layer: 'data', name: 'session + session-query', title: '会话持久化·投影·标题·遥测·检索',
    doc: 'official/subsystems/persistence.zh.md',
    oneLiner: '同一 SessionEvent 词汇的两个后端（jsonl/sqlite）；投影单元把事件流折成 UI 状态；标题、OTel 遥测、全文检索各自成接缝。0.1.2：schema 17→20 三步曲（删 ignorable→存储优化→revert 恢复），字典压缩取消 4KiB 阈值、新库 64KiB 页；投影升级为强制接缝 + 每会话缓存文件。',
    keyClasses: ['session-persistence-jsonl', 'session-persistence-sqlite(schema20)', 'ChunkRow', 'SessionProjectionStateMap', 'SessionProjectionMap', 'stateOf()', 'session-log-deepseek', 'session-query-sqlite'],
    patterns: ['事件溯源', 'CQRS 式投影', '能力接缝三角色'], deps: ['core-spine', 'storage-config'],
    tags: ['persistence', 'projection', 'telemetry'],
    risks: ['SESSION_FORMAT_VERSION=0：未发布期无兼容承诺，后端直接拒旧格式', '未识别且未标 ignorable 的事件类型 → 拒绝重建会话（宁可过度拒绝）。0.1.2 曾删掉 ignorable（schema 18）又因漏查第三方插件而回滚（schema 20）——退休需先有替代机制', '投影现在是强制接缝：宿主 reader 不许在注册表/键缺失时降级，首次依赖访问即抛错'] },

  { id: 'storage-config', side: '宿主（Node 进程）', layer: 'data', name: 'storage + settings + credentials 等', title: '存储·设置·凭证·身份·附件·工作区',
    doc: 'official/subsystems/storage.zh.md',
    oneLiner: '非会话数据的 KV 存储枢纽（json/sqlite 后端并列）+ 域数据设施；分层设置；凭证"配置存引用、provider 存值"，轮换下个请求即生效。',
    keyClasses: ['StorageHub', 'storage-domain', 'SettingsService', 'settings-file', 'CredentialsService', 'attachment-local', 'workspace'],
    patterns: ['能力接缝三角色', '引用-值分离'], deps: ['cordis-vendor'],
    tags: ['storage', 'settings', 'credentials'],
    risks: ['凭证值绝不进配置与日志；web 网关只暴露无值视图 + 只写存储'] },

  { id: 'host-rpc', side: '宿主（Node 进程）', layer: 'protocol', name: 'host + api + typert', title: '宿主服务与 Typert RPC 网关',
    doc: 'claude/07-Web客户端与外部协议.md',
    oneLiner: '0.1.2 大重构：ctx.apiProxy 与 host/apiproxy 整包删除——传输归 gateway（ctx.remote），业务归五个 controller（session/settings/credentials/workspace/directoryPicker）。两条下行 WS 合为一条 /api/remote.mux；@Remote 新增 stream 模式；统一 RemoteError 码表；浏览器令牌认证取代 loopback 名单。',
    keyClasses: ['WebServer', 'TypertGateway(ctx.remote)', 'SessionController', 'SettingsController', 'WorkspaceController', '@Remote({mode:"stream"})', 'RemoteJournalStream', 'RemoteError', 'browserAuth'],
    patterns: ['编译期反射 RPC', '物理/逻辑表示分离', '信任围栏', 'Fail-closed 审批'], deps: ['core-spine', 'storage-config'],
    tags: ['rpc', 'typert', 'http'],
    risks: ['/api 信任围栏：非 loopback Host 需显式 trustedHosts（防 DNS rebinding）；特权方法钉死 loopback'] },

  { id: 'sdk-protocols', side: '宿主（Node 进程）', layer: 'protocol', name: 'sdk + acp + mcp + python', title: '外部协议：JSON-RPC SDK·ACP·MCP·Python',
    doc: 'claude/07-Web客户端与外部协议.md',
    oneLiner: 'SDK：3 请求 4 通知的 stdio JSON-RPC，prompt 返回入队回执；ACP：面向编辑器的自动化桥（等 idle 返回 stopReason）；Python SDK 是设计孪生并独家捆绑单文件运行时。',
    keyClasses: ['HarnessSdkRequestMap', 'HarnessClient(TS/Py)', 'DeepSeekHarness(py)', 'AcpServer', 'mcp-client'],
    patterns: ['协议驱动', '回执+事实流 vs 等待+摘要'], deps: ['core-spine', 'llm'],
    tags: ['sdk', 'acp', 'mcp', 'python'],
    risks: ['SDK 的 session/prompt 不等 turn 结束——想要结果请订阅 session.event 或用高层 run()', 'ACP 只发已提交 assistant 文本，不发原始 delta/推理'] },

  { id: 'extensions', side: '宿主（Node 进程）', layer: 'feature', name: 'extensions (tool-cordis)', title: '自修改：agent 检视/挂载自身插件',
    doc: 'official/subsystems/extensions.zh.md',
    oneLiner: 'ctx.dynamicCordisRunner 持内存定义注册表 + vm 沙箱跑宿主半件；tool-cordis 让 agent 在运行时检查并修改自己的插件树（demo:cordis）。',
    keyClasses: ['DynamicCordisRunner', 'CordisInspect', 'tool-cordis', 'cordis-host-runner'],
    patterns: ['自修改运行时', '微内核'], deps: ['core-spine', 'cordis-vendor'],
    tags: ['self-modification', 'dynamic-plugin'],
    risks: ['effect 树保证可卸载是自修改安全的前提——任何注册没有 disposer 都会破坏这个保证'] },

  { id: 'examples', side: '宿主（Node 进程）', layer: 'support', name: 'examples', title: '可运行示例（叶子树与补丁覆盖）',
    doc: 'official/cookbook/extension-cookbook.zh.md',
    oneLiner: '两类：独立叶子树（headless/acp/jsonrpc-agent 完整 cordis.yml）与 --patch 覆盖（web-cordis/web-schedule/mcp-memory）；配 cordis.snapshot.yml 支持无 key 回放。',
    keyClasses: ['examples/*/cordis.yml', 'agent-spine-demo', 'acp-demo', 'jsonrpc-demo'],
    patterns: ['配置即组合'], deps: ['bundles', 'cli-boot'],
    tags: ['examples', 'snapshot'],
    risks: ['叶子树可用 include 嵌套再叠层（cordis-tools.cordis.yml 包 cordis.yml 的写法值得抄）'] },

  { id: 'support', side: '宿主（Node 进程）', layer: 'support', name: 'util + test-support + diagnostics', title: '零依赖工具·测试设施·运行时不变量',
    doc: 'official/testing.zh.md',
    oneLiner: 'Branded 类型、原子写、超时等零依赖工具；llm-mock-server/llm-replay 支撑无 key 快照测试；invariants 服务承载各包自注册的运行时断言。',
    keyClasses: ['Branded', 'atomic-write', 'llm-replay', 'llm-mock-server', 'InvariantsService', 'agent-loop-testkit'],
    patterns: ['契约即代码', '回放测试'], deps: [],
    tags: ['testing', 'invariants', 'util'],
    risks: ['CI 覆盖率门禁是 test:coverage（packages/*/*/src 每文件 100%），不是 test'] },

  { id: 'client-kernel', side: '浏览器（Web 客户端）', layer: 'fe-kernel', name: 'client 内核', title: '浏览器引导·模块系统·连接·slot 内核',
    doc: 'claude/07-Web客户端与外部协议.md',
    oneLiner: '浏览器里跑同一个 vendored Loader（loader.internal = 浏览器模块表）；__DSH_BOOT__ 图由宿主扫描 dsh.client 生成；ui-slots 零依赖 slot 内核（声明即认领）；SSE 驱动客户端 HMR。rc.8 重排五层：内核变 React-free，新包 ui-renderer 拿走 React root（替换它=自动重挂应用）；web-react/schema-form 已删除。',
    keyClasses: ['AppWebEntry', 'ClientModuleSystem', 'ui-renderer(React root)', 'client/store(0.1.2 新)', 'PLATFORM_MODULES', 'DSH_CLIENT_* 构建环境', 'ui-slots SlotCore', 'client-hmr'],
    patterns: ['同构插件树', '声明即认领', '懒 CJS 闭包工厂'], deps: ['host-rpc', 'cordis-vendor'],
    tags: ['browser', 'boot', 'slots', 'hmr'],
    risks: ['前端壳零组合决策：哪些插件进浏览器由宿主 yml 决定', '裸 vite serve 被主动拒绝——页面必须由 dsh web 注入 boot 清单'] },

  { id: 'client-ui', side: '浏览器（Web 客户端）', layer: 'fe-ui', name: 'client UI 插件族', title: 'Chat 三段渲染与全部 UI 面板',
    doc: 'claude/07-Web客户端与外部协议.md',
    oneLiner: 'session/event → ConversationNodeDefinition 折叠 → ChatNodeDataMap 声明合并 → keyed slot 渲染。0.1.2：client/runtime 整包删除（内容散入 controller/ui-conversation/store）；新增 ui-chat（节点定义搬来）·ui-session（唯一 Session 适配器）·ui-approval·ui-schedule；工具卡改由客户端从原始事件派生；Lexical 编辑器取代三层耦合 textarea；locale 拥有全部文案（遗漏=类型错误）。',
    keyClasses: ['ConversationNodeDefinition', 'ui-chat', 'ui-session(ctx.uiSession)', 'ui-approval', 'ui-tool card models', 'ReferenceChipNode(Lexical)', 'pendingInteractions', 'ui-settings-*'],
    patterns: ['事件折叠', '声明合并扩展', 'keyed slot'], deps: ['client-kernel'],
    tags: ['chat', 'ui-plugins', 'react'],
    risks: ['未注册的节点 kind 渲染 JSON 兜底而不是崩——加新聊天行是挂插件不是改内建', '每节点一个 seat：assistant 增量不重渲染兄弟节点', '⚠️ 0.1.2 起给工具定义宿主侧 presentCall/presentResult 不再能得到 Web 卡片——必须在客户端插件注册 tool.call.toolview keyed renderer', 'Lexical chip 的 isKeyboardSelectable() 必须为 false，否则方向键在 chip 边缘死锁'] },
];

export const RELATIONS = [
  { from: 'cli-boot', to: 'bundles', type: 'calls', label: '叠补丁', desc: 'composeProfile 按 profile 声明顺序叠加各 bundle 的 cordis.patch.yml。' },
  { from: 'core-spine', to: 'llm', type: 'calls', label: 'llm.stream', desc: '循环经 agent/request → llm/stream waterfall 发起模型流。' },
  { from: 'compaction', to: 'core-spine', type: 'data-flow', label: 'surface replace', desc: '压缩以 surface replace 节点改写模型可见历史。' },
  { from: 'client-kernel', to: 'host-rpc', type: 'data-flow', label: '/api + WS', desc: '浏览器经 connection 的 HTTP POST 与两条下行 WebSocket 与宿主通信。' },
  { from: 'sdk-protocols', to: 'subagent', type: 'data-flow', label: 'ACP 双向', desc: 'dsh 既做 ACP 服务端，也经 subagent-acp 做 ACP 客户端驱动别的 agent。' },
  { from: 'interaction', to: 'core-spine', type: 'calls', label: 'tools/pre-execute', desc: '审批与 hook 桥挂在工具管线的 waterfall 扩展点上。' },
  { from: 'session', to: 'client-ui', type: 'data-flow', label: 'session/event', desc: 'UI 从持久事件流渲染，live 与回放同一条路径。' },
  { from: 'agent-team', to: 'subagent', type: 'calls', label: 'startContinuable', desc: 'Teams 不造第二套委托机制：创建/打断/排空全部委托回 subagent 接缝（rc.8 为此加了 childId 预留与精确排空）。' },
  { from: 'agent-team', to: 'session', type: 'data-flow', label: 'team/* 事件', desc: '花名册/信箱/任务板全部以四种 team/* 事件落 Lead 会话日志，恢复=对账重放。' },
  { from: 'webhook', to: 'core-spine', type: 'calls', label: 'agents.create + followup', desc: '验签投递 → 建普通根会话 → followup() 插入收件箱即提交点，之后运行时退出画面。' },
  { from: 'webhook', to: 'host-rpc', type: 'data-flow', label: '第二个 webServer 实例', desc: '同一个 node:http 载体，但在 isolate webServer 的 group 里——暴露 ingress 不必暴露 /api。' },
  { from: 'webworker', to: 'cordis-vendor', type: 'calls', label: 'loader.internal', desc: '浏览器 Worker 里复用同一个 Loader，模块表替换 node:* 内建，插件层零改动。' },
  { from: 'webworker', to: 'fs', type: 'data-flow', label: 'MemoryVfs', desc: 'fs-local 原样运行在 VFS 上；mtime 严格单增以骗过陈旧写入守卫。' },
  { from: 'inspector', to: 'extensions', type: 'data-flow', label: 'ctx.inspector 进 API 目录', desc: 'tool-cordis 把 ctx.inspector 教给模型：模型写的动态插件能发布观测、读它正在改的插件树。' },
];

export const DATAFLOWS = [
  { id: 'turn', name: '一次对话 turn 的完整旅程', desc: '从浏览器输入到 UI 渲染：所有中间态都落 append-only 会话日志。', steps: [
    { moduleId: 'client-kernel', label: '用户输入 → connection RPC → agent.followup(msg)（入队+唤醒）', type: 'input' },
    { moduleId: 'host-rpc', label: 'Typert 网关解析 agentId → 派发给活 Agent 句柄', type: 'process' },
    { moduleId: 'core-spine', label: 'turn/start → inbox.claim → systemPrompt.assemble → agent/pre-step waterfall（可改写/拒绝）', type: 'process' },
    { moduleId: 'core-spine', label: 'step/start → user/message 落日志 → deriveMessages() 从日志派生历史', type: 'process' },
    { moduleId: 'llm', label: 'agent/request → llm/stream → assistant/chunk* 逐 token 落日志 → assistant/message', type: 'process' },
    { moduleId: 'core-spine', label: 'tool/call → 工具管线（见另一条流）→ tool/result', type: 'process' },
    { moduleId: 'session', label: 'turn/end 落日志；持久化/投影/标题/遥测各自订阅事件流', type: 'storage' },
    { moduleId: 'client-ui', label: 'session/event 折叠为 Chat 节点 → keyed slot 渲染（live 与回放同路径）', type: 'output' },
  ]},
  { id: 'toolpipe', name: '一次工具调用的守卫管线', desc: '策略与能力解耦：沙箱/权限/hook 横跨所有工具族，工具本体零感知。', steps: [
    { moduleId: 'core-spine', label: 'tool/call 先落日志；参数无损 JSON 快照 + deepFreeze（身份保护）', type: 'input' },
    { moduleId: 'interaction', label: 'tools/pre-execute waterfall：allow / deny / ask（ask → ctx.approval，一次性，fail-closed）', type: 'decision' },
    { moduleId: 'core-spine', label: '单调守卫 guards：只能否决或弃权，后来者不可推翻', type: 'decision' },
    { moduleId: 'sandbox', label: 'tools/execute 环绕派发（超时/重试/指标）；沙箱执行器包装 argv', type: 'process' },
    { moduleId: 'fs', label: '工具本体 execute()：fs 变更过 fs/write-intent 门；自有事件落日志', type: 'process' },
    { moduleId: 'core-spine', label: 'tools/post-execute（改写/拦截/附加上下文）→ 外层规范化（throw→isError）→ finalizeContent → tools/result', type: 'process' },
    { moduleId: 'session', label: 'tool/result 落日志（meta 承载 UI 卡片回放数据）', type: 'storage' },
  ]},
  { id: 'boot', name: '启动组合：从命令到插件树', desc: '整棵运行时树 = 空根 + 一摞补丁；任何一层都能用 id 替换任意行。', steps: [
    { moduleId: 'cli-boot', label: 'dsh web → 分层 .env → composeProfile（修复 node_modules 符号链接、重写空根）', type: 'input' },
    { moduleId: 'bundles', label: '按序叠补丁：base → web-app → profile patch → 家目录 patch → --patch 覆盖', type: 'process' },
    { moduleId: 'cordis-vendor', label: 'boot()：new Context → 挂 Loader → mountRootInclude（一个 include 根 + 全部补丁）', type: 'process' },
    { moduleId: 'cordis-vendor', label: 'Fiber 纪元机制按 inject 依赖自动排序激活 130+ 包', type: 'process' },
    { moduleId: 'cli-boot', label: 'loader.await() → assertEntriesActivated：卡在 waiting for <service> 的行 fail-loud', type: 'decision' },
    { moduleId: 'bundles', label: '会话创建时 agent-presets 再按 preset 组合 agent 面插件树（isolate 领域）', type: 'output' },
  ]},
  { id: 'browser-boot', name: '浏览器引导与 RPC 通路', desc: '浏览器里跑同一个 Loader；哪些插件进浏览器由宿主 yml 决定。', steps: [
    { moduleId: 'host-rpc', label: 'frontend-static 渲染 index 时注入 __DSH_BOOT__（宿主扫描 dsh.client 生成的图）', type: 'input' },
    { moduleId: 'client-kernel', label: 'AppWebEntry：构建模块表 → 挂 Loader → loader.internal = 模块表（关键一步）', type: 'process' },
    { moduleId: 'client-kernel', label: '每 graph 行 loader.create({name}) → fail-loud 巡检（缺服务的 PENDING 行报出确切缺口）', type: 'process' },
    { moduleId: 'host-rpc', label: 'connection：/api POST 一元调用 + events.mux/events.host 双下行 WS', type: 'process' },
    { moduleId: 'client-ui', label: 'Chat 节点定义折叠 session/event → keyed slot 渲染各业务行', type: 'output' },
  ]},
  { id: 'team', name: '🆕 Agent Team 一次协作回合（rc.8）', desc: '日志先于现实：provisioning 快照先落盘、子代理后启动；信箱两段式事务；等待靠状态边不靠轮询。', steps: [
    { moduleId: 'agent-team', label: 'Lead 调 spawn_teammate("researcher")：先 append+flush team/member{provisioning} 快照', type: 'input' },
    { moduleId: 'subagent', label: 'startContinuable({childId: 预留id}) 启动 continuable 子代理 → 回填 active/failed 终态', type: 'process' },
    { moduleId: 'agent-team', label: 'teammate 调 team_task_create/claim（CAS：expectedRevision 不符即拒）干活', type: 'process' },
    { moduleId: 'agent-team', label: 'send_message → team/message/queued 先落盘 → target 记录后补 delivered 回执（进程内重试+去重）', type: 'process' },
    { moduleId: 'agent-team', label: 'Lead wait_agent 等下一条 roster/mailbox/task/status 边（无活跃对端立即返回 no-progress）', type: 'decision' },
    { moduleId: 'session', label: '崩溃恢复：queued−delivered 重试投递；未终结 provisioning 与子会话对账（三证齐全才转 active）', type: 'storage' },
    { moduleId: 'agent-team', label: 'Lead 检查最终 diff + 跑测试后汇总作答（writeScopes 只警告，集成边界在 Lead）', type: 'output' },
  ]},
  { id: 'webhook-flow', name: '🆕 外部事件 → Agent 会话（0.1.2）', desc: '验签在解析之前；followup 插入收件箱就是提交点，之后运行时不再参与。', steps: [
    { moduleId: 'webhook', label: 'POST /github（独立端口/独立 webServer 实例，isolate 只隔离 webServer）', type: 'input' },
    { moduleId: 'webhook', label: '读有界原始 body → 逐请求解析密钥 → HMAC-SHA256 验签（**在 JSON.parse 之前**）', type: 'decision' },
    { moduleId: 'webhook', label: '才 JSON.parse + snapshotJsonValue → dispatch(delivery) 同步派发 → 立刻 202', type: 'process' },
    { moduleId: 'webhook', label: '规则 run() 返回请求 → workspaceRegistry.create → agents.create（挂 preset）', type: 'process' },
    { moduleId: 'core-spine', label: 'attachSession 先于任何 prompt → 设权限预设 → 改标题 → followup() 插入收件箱＝提交点', type: 'output' },
    { moduleId: 'client-ui', label: '会话像手工开的对话一样出现在 Web UI 的 Workspace 下（无第二套自动化 UI）', type: 'output' },
  ]},
  { id: 'browser-only', name: '🆕 整个 harness 跑进浏览器（0.1.2）', desc: '同一份 web profile 配置逐字节跑在 Web Worker 里；替换的是模块，不是插件。', steps: [
    { moduleId: 'webworker', label: '打包器构建期做 pack lowering（ESM→CJS + AsyncLocalStorage 协议），产出 gzip ustar 镜像', type: 'input' },
    { moduleId: 'webworker', label: 'createWorkerHost() 同步返回（先能收 postMessage）→ start() 边下边解镜像进 MemoryVfs', type: 'process' },
    { moduleId: 'webworker', label: '校验 LOWERING_VERSION（旧转换器降级的镜像直接拒）→ 装 process 全局 + 模块代理表', type: 'decision' },
    { moduleId: 'cordis-vendor', label: '用镜像里那份 app-boot 启动：hostCtx.loader.internal = loader.internal', type: 'process' },
    { moduleId: 'shell-exec', label: 'spawn 启子 Worker 当进程：SIGKILL 能中断死循环（协作式解释器做不到）', type: 'process' },
    { moduleId: 'sandbox', label: 'landlock-run 解析为虚拟可执行文件，逐调用授权——但明说是 VFS 边界不是内核 Landlock', type: 'decision' },
    { moduleId: 'webworker', label: 'postMessage 隧道说 HTTP：合成 Request 喂给假 node:http 捕获的真路由表', type: 'output' },
  ]},
  { id: 'delegate', name: '子代理委托与外部协议闭环', desc: '一个接缝六种传输；dsh 可以驱动另一个产品的 agent。', steps: [
    { moduleId: 'core-spine', label: '模型调 subagent 工具（tool-subagent 暴露一个配置好的 provider）', type: 'input' },
    { moduleId: 'subagent', label: 'ctx.subagents 选传输：spawn/fork 同进程 · acp/codex/claude-code 子进程 · dsh-sdk 远程', type: 'decision' },
    { moduleId: 'shell-exec', label: '外进程后端经 ctx.subprocess 生成子进程（进程树生命周期归它管）', type: 'process' },
    { moduleId: 'sdk-protocols', label: '子代理若是 ACP/SDK 对端：走协议桥，回执/事件流回传', type: 'process' },
    { moduleId: 'workflow', label: '委托注册进 ctx.jobs；tool-jobs 可读取/杀死；结果作为 tool/result 回主会话', type: 'output' },
  ]},
];

export const TECH = [
  { name: 'TypeScript (strict)', category: '语言', side: '全栈', desc: '全仓 strict + noImplicitAny；每文件 100% 覆盖率门禁；ESM everywhere。', tags: ['esm', 'strict'] },
  { name: 'Node.js ^22.19 || >=24', category: '语言', side: '宿主', desc: '运行时基线；node:sqlite、worker_threads、vm 均有使用。', tags: [] },
  { name: 'Python 3', category: '语言', side: 'SDK', desc: 'Python SDK（pydantic 线上模型）+ 捆绑单文件 Node 运行时；rc.8 起 Code Mode 也有 Python 通道（python3 -I + fd3 帧协议）。', tags: ['pydantic', 'code-mode'] },
  { name: 'Cordis (vendored)', category: '框架', side: '宿主', desc: '插件/服务/事件/效果框架，仓库的地基；钉版本源码拷贝并带本地修改清单。', tags: ['plugin', 'di', 'events'] },
  { name: 'React 18 + Vite', category: '框架', side: '浏览器', desc: 'Web 客户端 UI；但组合与生命周期由浏览器端 Cordis 树主导，React 只是渲染绑定。', tags: ['spa'] },
  { name: 'schemastery', category: '框架', side: '宿主', desc: '插件 Config 声明+校验+默认值+表单元数据（schema 即 UI）。', tags: ['validation'] },
  { name: 'Zod (Typert 生成)', category: '框架', side: '宿主', desc: 'Typert 编译期反射生成的 RPC 编解码器；apiproxy 双层校验。', tags: ['rpc', 'codegen'] },
  { name: 'pnpm workspaces', category: '工程', side: '全栈', desc: '251 功能包 / 268 workspace 成员（0.1.2-alpha.2）；@deepseek-ai/dsh-<name> 命名，实验包 dsh-experimental-* 前缀；peerDependencies 表达运行时依赖。', tags: ['monorepo'] },
  { name: 'Lexical', category: '框架', side: '浏览器', desc: '0.1.2 起的 Web 输入框内核：每会话一个编辑器（在 React 外创建）；引用 chip 是原子 DecoratorNode，NodeKey 即 occurrence 身份——让"字符串 diff 猜位置"类 bug 结构上不可表达。刻意不用 @lexical/react。', tags: ['editor'] },
  { name: 'Chrome DevTools Protocol', category: '协议', side: '宿主', desc: 'Inspector 用 CDP 把宿主+客户端挂进 DevTools；Worker 是唯一 CDP 端点（宿主主线程暂停时无法投递 Debugger.resume）。', tags: ['cdp', 'experimental'] },
  { name: 'Web Worker + MemoryVfs', category: '框架', side: '浏览器', desc: '0.1.2 实验：整棵插件树跑在 Worker 里；node:* 内建由模块代理表替换（fs 走内存 VFS，child_process 启子 Worker 当真进程）。', tags: ['browser', 'experimental'] },
  { name: '@octokit/webhooks', category: '协议', side: '宿主', desc: 'webhook-github 用它做 HMAC-SHA256 验签——在 JSON.parse 之前、对未经改动的原始 body 验。', tags: ['webhook'] },
  { name: 'vitest + 快照回放', category: '工程', side: '全栈', desc: 'keyless snapshot：录一次真 API 之后离线回放（llm-replay/llm-mock-server）；e2e 无 key 自跳过。', tags: ['testing', 'replay'] },
  { name: 'tsdown / tsx', category: '工程', side: '宿主', desc: 'tsc 出类型、tsdown 打运行时；源码启动走 tsx ESM hook（全链路必须保持 ESM）。', tags: ['build'] },
  { name: 'JSONL + SQLite', category: '存储', side: '宿主', desc: '会话持久化双后端；storage 枢纽 json/sqlite 并列；session-query-sqlite 全文检索。rc.8：SQLite schema 17 物理打包行 + Zstandard level3（≥4KiB 才压，体积 -89.4%）。', tags: ['persistence', 'zstd'] },
  { name: 'OpenTelemetry', category: '存储', side: '宿主', desc: 'session-telemetry-otel：捕获、脱敏、交给一个后端，输出离开进程。', tags: ['telemetry'] },
  { name: 'sandbox-exec / landlock / Windows ACL', category: '安全', side: '宿主', desc: '三平台进程沙箱；landlock-run 是自研 Node addon（native/）。', tags: ['sandbox'] },
  { name: 'E2B', category: '安全', side: '宿主', desc: '远程 Linux 沙箱：fs+subprocess 两个 provider 共享一个 SDK 句柄，整个执行世界可搬迁。', tags: ['remote-sandbox'] },
  { name: 'Agent Client Protocol', category: '协议', side: '宿主', desc: 'ACP 服务端（编辑器对接）+ subagent-acp 客户端（驱动别的 agent）。', tags: ['acp'] },
  { name: 'MCP', category: '协议', side: '宿主', desc: 'dsh-mcp-client：每服务器一插件，发现工具 → ctx.tools.register()。', tags: ['mcp'] },
];

export const PATTERNS = [
  { name: '微内核 + 一切皆插件', cat: 'architectural', desc: '没有特权核心：模型适配器、工具注册表、会话日志、agent 循环本身都是插件，全部可从配置替换。扩展 = 在旁边挂插件。', modules: ['cordis-vendor', 'core-spine', 'cli-boot'] },
  { name: '能力接缝三角色', cat: 'architectural', desc: 'Service Definition / Provider / Consumer 缺一不叫接缝；换一个 provider 整个产品跟着走（E2B 搬迁执行世界、六种子代理传输）。', modules: ['shell-exec', 'fs', 'sandbox', 'subagent', 'llm'] },
  { name: '事件溯源（log-first）', cat: 'architectural', desc: 'append-only 会话日志是唯一事实源；模型历史、UI、恢复、遥测全部派生；压缩用 surface replace 而非删除。rc.8 的 Agent Teams 把协作状态（花名册/信箱/任务板）也放进同一条日志。', modules: ['core-spine', 'session', 'compaction', 'agent-team'] },
  { name: '物理/逻辑表示分离', cat: 'structural', desc: 'SQLite schema 20：磁盘上 1 行打包 1024 个 chunk（字典 Zstd），但逻辑事件流、seq 引用、回放语义一字不变。0.1.2 把同一手法用到线上：历史页传 records 判别联合，41 万事件压成 696 条记录（浏览器折叠 4682ms→276ms），而 ChunkRowEvent 永不进 SessionEventMap。', modules: ['session', 'host-rpc'] },
  { name: '模块层替换而非插件层分叉', cat: 'architectural', desc: '把整个 harness 搬进浏览器时，替换的是 node:* 模块身份而不是能力插件——于是 fs-local/subprocess-local/bash-sandbox/chokidar/landlock-run 全部原样运行，平台差异被压进一张 MODULE_PROXIES 表。接缝设计的终极回报。', modules: ['webworker', 'cordis-vendor'] },
  { name: '拒绝发明身份', cat: 'structural', desc: 'Cordis 的 Context 没有 id，Inspector 就不给它造一个——改用嵌套结构表达父子关系。同理五种身份（Fiber uid / 对象引用 / BackendNodeId / NodeId / RemoteObjectId）刻意不统一，因为所有者与生命周期都不同。', modules: ['inspector'] },
  { name: '克制的接缝', cat: 'architectural', desc: 'webhook 运行时只有两个方法、唯一内建动作是建一个普通会话，并承诺"执行记录/重试定时器/去重表/完成事件"持续缺席（有源码审计守着）。诚实地不长成任务引擎，把幂等与完成通知留给部署。', modules: ['webhook'] },
  { name: '分层配置补丁', cat: 'architectural', desc: '产品 = 空根 + bundle/profile/home/--patch 逐层补丁；每行有稳定 id，任何层可替换任意行。', modules: ['cli-boot', 'bundles', 'examples'] },
  { name: '同构插件树', cat: 'architectural', desc: '浏览器复用同一个 vendored Loader（loader.internal=浏览器模块表）；前端壳零组合决策。', modules: ['client-kernel', 'cordis-vendor'] },
  { name: 'Waterfall 中间件', cat: 'behavioral', desc: '共享 args 数组 + 尾部 next 的环绕链；调 next 委托、不调短路。全部策略点（pre-step/pre-execute/llm-stream）的底层机制。', modules: ['cordis-vendor', 'core-spine', 'interaction'] },
  { name: '效果/析构器（RAII）', cat: 'behavioral', desc: '每个注册经 ctx.effect/ctx.on 且有 disposer；插件树=effect 树，任何子树可干净卸载——HMR 与自修改的安全前提。', modules: ['cordis-vendor', 'extensions'] },
  { name: '纪元驱动重载', cat: 'behavioral', desc: '依赖服务的提供者 fiber uid 拼成纪元串；提供者换人/消失=纪元变化=消费者自动 reload/unload，一个机制两种语义。', modules: ['cordis-vendor'] },
  { name: '单调守卫', cat: 'behavioral', desc: '守卫只能否决或弃权、后来者不可推翻；concludeTurn 同为单调标记。用于不可绕过的不变量（plan mode 禁写）。', modules: ['core-spine', 'goal-plan'] },
  { name: 'Fail-closed 审批', cat: 'behavioral', desc: 'approval/request 无应答者=拒绝；误配置在加载时炸响；未识别事件拒绝重建会话。系统性的"宁可拒绝不可读坏"。', modules: ['interaction', 'session', 'cli-boot'] },
  { name: '声明合并扩展', cat: 'structural', desc: 'SessionEventMap / ContentBlockMap / ChatNodeDataMap / SlotMap 全靠 TS declaration merging 开放扩展——类型安全的开放词汇表。', modules: ['core-spine', 'client-ui'] },
  { name: 'Branded 不透明 id', cat: 'structural', desc: '跨界 id（SessionId/CallId/WorkspaceId）一律 Branded<B>，编译期防串；零运行时成本。', modules: ['support', 'core-spine'] },
  { name: '值与话术分离', cat: 'structural', desc: '工具返回规范 JSON 值（Code Mode 的 API），output.render 才是给模型的话术；UI 卡片是纯函数展示，回放安全。', modules: ['core-spine', 'client-ui'] },
  { name: '引用-值分离（凭证）', cat: 'structural', desc: '配置携带 secret 引用、provider 持值、消费者按操作解析——轮换即时生效且值不进日志。', modules: ['storage-config'] },
  { name: '编译期反射 RPC（Typert）', cat: 'structural', desc: '@Remote 装饰器 + ts.Program 分析生成调用描述符与 Zod 编解码；复杂宿主对象经 Lookup 翻译（Agent→agentId），不过线。', modules: ['host-rpc'] },
  { name: 'CQRS 式投影', cat: 'structural', desc: '投影单元把事件流折成 UI 状态并缓存检查点；冷读=缓存行+尾部回放，会话列表不加载全日志。', modules: ['session', 'client-ui'] },
];

// 模块 id → 清单 JSON 名列表（文件数 = 各清单长度之和）。清单由 gen-inventory.mjs 生成。
export const FILE_MAP = {
  'cli-boot': ['apps-cli', 'boot'],
  'bundles': ['bundle', 'preset'],
  'cordis-vendor': ['vendor'],
  'core-spine': ['core'],
  'llm': ['llm'],
  'compaction': ['compaction', 'context'],
  'fs': ['fs'],
  'shell-exec': ['shell', 'subprocess', 'terminal'],
  'sandbox': ['sandbox', 'e2b', 'native'],
  'code-lsp': ['code-runtime', 'lsp'],
  'skill': ['skill'],
  'subagent': ['subagent'],
  'agent-team': ['experimental-agent-team'],
  'webworker': ['experimental-webworker'],
  'inspector': ['experimental-inspector'],
  'webhook': ['webhook'],
  'workflow': ['workflow', 'jobs'],
  'goal-plan': ['goal', 'plan', 'todo', 'schedule', 'guard'],
  'web-capability': ['web', 'spill'],
  'interaction': ['interaction', 'feedback', 'hooks'],
  'session': ['session-pkg', 'session-query'],
  'storage-config': ['storage', 'settings', 'credentials', 'identity', 'attachment', 'workspace'],
  'host-rpc': ['host', 'api', 'typert'],
  'sdk-protocols': ['sdk', 'acp', 'mcp', 'python'],
  'extensions': ['extensions'],
  'examples': ['examples-root', 'examples-pkg'],
  'support': ['util', 'test-support', 'runtime-diagnostics'],
  'client-kernel': ['client-kernel', 'apps-web'],
  'client-ui': ['client-ui'],
};

// 模块 id → 关键源码片段（真实文件、真实代码；供"关键源码"标签页渲染）。
export const SNIPPETS = {
  'cordis-vendor': [
    { title: 'waterfall：20 行看懂全部策略机制', file: 'vendor/cordis/src/events.ts', lang: 'ts',
      note: '共享一个 args 数组 + 尾部 next：监听器从最外层开始消费，调 next() 委托下游，不调则短路（连调用方的默认行为一起否决）。dsh 全部策略点（agent/pre-step、tools/pre-execute、llm/stream）都建立在这上面。',
      code: `waterfall(...args: any[]) {
  const cbs = this.dispatch('waterfall', args)
  const inner = args.pop()          // 调用方传入的"默认行为"是最内层
  const next = () => {
    const cb = cbs.shift() ?? inner // 监听器从最外层开始消费
    return cb(...args)              // args 尾部始终是 next
  }
  args.push(next)
  return next()
}` },
    { title: 'mixin：ctx.on / ctx.plugin / ctx.effect 的来历', file: 'vendor/cordis/src/reflect.ts:219', lang: 'ts',
      note: 'ctx 上的"魔法方法"其实都是 mixin 出来的转发访问器——理解这四行，Context 的 API 表面就不神秘了。',
      code: `this.mixin('reflect', ['get', 'set', 'provide', 'accessor', 'mixin'])
this.mixin('fiber', ['runtime', 'effect'])
this.mixin('registry', ['inject', 'plugin'])
this.mixin('events', ['on', 'once', 'parallel', 'emit', 'serial', 'bail', 'waterfall'])` },
    { title: '!!js 表达式的求值：简单粗暴但被懒惰化约束', file: 'vendor/loader/src/config/utils.ts', lang: 'ts',
      note: '插值钩在 internal/config waterfall 上：等该行声明的注入激活后才求值，且跳过 Group/Include 树载体。disabled 是唯一被插值的元数据字段。',
      code: `export const evaluate = new Function('ctx', 'expr', \`with (ctx) { return eval(expr) }\`)
export function interpolate(ctx, value) { /* 递归遍历数组/对象，替换 { __jsExpr } 节点 */ }` },
  ],
  'core-spine': [
    { title: '驱动器三相状态机', file: 'packages/core/agent-loop/src/agent.ts:38', lang: 'ts',
      note: '对外只有 running/idle 两态（maintenance 表现为 idle）。wakeRequested 是"闩存唤醒"：维护/中止期间到达的唤醒等收敛后重放。',
      code: `type Phase =
  | { kind: 'idle'; lastTurn: number }
  | { kind: 'maintenance'; abort: AbortController; lastTurn: number; wakeRequested: boolean }
  | { kind: 'running'; abort: AbortController; turn: number; step: number; wakeRequested: boolean }` },
    { title: '输入三通道：followup / steer / inject', file: 'packages/core/agent-loop/src/agent.ts:113', lang: 'ts',
      note: 'inject 不唤醒（空闲的 agent 保持空闲）——文件变更通知、技能内容、定时提醒都走它。唤醒消息不能加入已中止的活动：分类在插入收件箱之前捕获，防重入 cancel 重分类。',
      code: `send(message: UserMessage, target: InboxTarget, wakeup: boolean): void {
  const wakingAfterAbort = wakeup && this.phase.kind !== 'idle' && this.phase.abort.signal.aborted
  const resolvedTarget = wakingAfterAbort ? 'next-turn' : target
  this.inbox.splice(resolvedTarget, Infinity, 0, [message])
  if (wakeup) this.wakeDriver(wakingAfterAbort)
}
followup(input: UserMessage): void { this.send(input, 'next-turn', true) }
steer(input: UserMessage): void { this.send(input, 'next-step', true) }
inject(input: UserMessage): void { this.send(input, 'next-step', false) }` },
    { title: '一个 step：从日志派生历史 → 流式 → 工具', file: 'packages/core/agent-loop/src/agent.ts:332', lang: 'ts',
      note: '注意 deriveMessages()——模型历史每步都从会话日志投影，这就是"模型可见 ⟺ 已落日志"的执行点。每个 chunk 单独落日志保证 token 级回放。',
      code: `const { request, preparedCall } = await this.buildRequest(
  turn, step, assembly.tools, system, this.session.deriveMessages(), signal,
)
const stream = preparedCall?.stream(request) ?? this.loopCtx.llm.stream(request)
for await (const chunk of stream) {
  chunkSeqs.push(this.session.append('assistant/chunk', { turn, step, chunk }).seq)
  assembler.push(chunk)
}
// ...assistant/message 引用全部 chunk seq 落日志，然后 executeToolCalls(...)` },
    { title: 'SessionEventMap：系统契约即事件词汇表', file: 'packages/core/session/src/types.ts:236', lang: 'ts',
      note: '插件加新事件 = 往这个 map 声明合并。只有 user/message、assistant/message、tool/result 三种能上"有序表面"（真正投影为模型历史）；surfaceOp.replace 是压缩的实现原语。',
      code: `export interface SessionEventMap {
  'turn/start': { turn: number }
  'turn/end': { turn: number; reason: TurnEndReason }
  'step/start': { turn: number; step: number }
  'user/message': UserMessage                      // 表面事件
  'assistant/chunk': { turn: number; step: number; chunk: StreamChunk }
  'assistant/message': { turn; step; message; usage? }  // 表面事件
  'tool/call': { turn; step; callId; name; arguments: string }
  'tool/result': { turn; step; message; error?; meta? }  // 表面事件
  // ...
}
export type SurfaceOp = 'append' | { op: 'replace'; start: number; end: number }` },
    { title: '工具执行的身份保护', file: 'packages/core/tools/src/index.ts:1364', lang: 'ts',
      note: '参数无损 JSON 快照后 deepFreeze；finalizeContent 在参数物化之前捕获（防恶意 getter 在快照期间替换回调）。防御级别值得学习。',
      code: `const capturedFinalizer = visible?.finalizeContent?.bind(visible)  // 先捕获
const detached = snapshotJsonValue(exec.arguments)                 // 无损快照
if (detached === undefined) throw new TypeError('tool execution arguments must be losslessly JSON-serializable')
const execution: MutableToolRunContext = { ...base, arguments: deepFreeze(detached) }` },
    { title: 'rc.8：被取消的流也要定稿已送达前缀', file: 'packages/core/agent-loop/src/agent.ts:342', lang: 'ts',
      note: '只在 signal.aborted 且在流消费范围内：把用户已读到的半截回答收口为 interrupted:true 的 assistant/message（sourceEventSeqs=恰好已记录的 chunk）。供应商 error/aborted 在此范围之外——用户取消≠提供方失败，不对称是有意的。',
      code: `} catch (error: unknown) {
  if (signal.aborted) {
    const content = assembler.interruptedBlocks()   // 非空白 text/reasoning，省略工具调用
    if (content.length > 0) {
      this.session.append('assistant/message', {
        turn, step,
        message: createAssistantMessage({ content, source: { provider, model } }),
        interrupted: true,
      }, { surfaceOp: 'append', sourceEventSeqs: chunkSeqs })
    }
  }
  throw error
}` },
  ],
  'webworker': [
    { title: '唯一的平台分叉：一张模块代理表', file: 'packages/experimental/webworker-runtime/src/module-proxies.ts:18', lang: 'ts',
      note: '这段注释就是整个设计的宣言：替换的是模块身份，不是能力插件。所以 fs-local、subprocess-local、bash-sandbox、chokidar、landlock-run 全部原样运行——接缝设计的终极回报。',
      code: `/**
 * Module proxy table — the ONLY platform fork of the worker host. Every entry
 * replaces a Node builtin or an external npm package; workspace and vendored
 * modules are always mounted as-is. Keys are exact module specifiers.
 */
export const MODULE_PROXIES: Record<string, string> = {
  // VFS-backed real implementations.
  'node:fs': './node/builtin_modules/implemented/fs.ts',
  // …分类写在路径里：implemented/ = 真语义，mock/ = 结构占位
}` },
    { title: '用镜像里那份 app-boot 启动整棵树', file: 'packages/experimental/webworker-runtime/src/worker-host.ts:234', lang: 'ts',
      note: '与 07 篇浏览器复用 Loader 是同一个接缝（loader.internal）。注意 appBoot 来自镜像本身——浏览器里跑的是 Node 部署跑的同一套启动胶水。',
      code: `const ctx = await appBoot.boot('dsh-webworker', configPath, patches, (hostCtx) => {
  // Before any entry mounts: the Loader would otherwise fall back to the
  // runtime's own dynamic import for every row.
  hostCtx.loader.internal = loader.internal
  installLogSink(hostCtx, require)
  cmdline.provideCmdline(hostCtx, { /* --host 127.0.0.1 --no-open … */ })
})` },
    { title: '模拟到能骗过并发守卫：mtime 严格单增', file: 'packages/experimental/webworker-runtime/src/storage/memory.ts:457', lang: 'ts',
      note: 'dsh-fs-local 的陈旧写入守卫依赖 ino 与 mtimeMs，而内存写入常落在同一毫秒——时间戳相等就会让陈旧覆盖溜过去。这是"模拟一个平台"和"模拟到能骗过守卫"之间的差距。',
      code: `/** @returns A modification time strictly newer than one file node's current value. */
private touchNode(node?: FileNode): number {
  const previous = node?.mtimeMs
  const now = Date.now()
  return previous === undefined ? now : Math.max(now, previous + 1)
}` },
  ],
  'inspector': [
    { title: 'ctx.inspector 故意与 CDP 无关', file: 'packages/experimental/inspector/src/shared/service.ts:8', lang: 'ts',
      note: '只有两个成员，宿主与客户端两个面拿到同一个工厂产出的同一种服务。这个 CDP-无关的 reader 已进 tool-cordis 的 API 目录——模型写的动态插件能读它正在改的那棵插件树。',
      code: `/** Shared Host/Client service façade over the realm's source publisher. */
export interface InspectorService {
  /** Publish one JSON observation without waiting for Worker delivery. */
  publish(topic: string, payload: InspectorJsonValue, monotonicMs?: number): void

  /** Read-only Cordis topology queries independent of CDP sessions. */
  readonly cordis: CordisRuntimeTreeReader
}` },
    { title: 'Cordis 树的发现过程（一份内部结构教材）', file: 'packages/experimental/inspector/src/shared/cordis/collector.ts:149', lang: 'ts',
      note: '入口有三类：根、注册表里每个活 Fiber、每个事件钩子的 owner Context。同一份采集器编译进宿主与客户端两个面，各自对自己的 ctx.root 实例化——没有第二套分类实现。',
      code: `const rootInfo = ensure(root) as ContextInfo
for (const runtime of root.registry.values()) {
  for (const fiber of runtime.fibers) {
    if (fiber.uid === null) continue      // 跳过已释放
    ensure(fiber.parent); ensure(fiber.ctx)
  }
}
for (const key of Reflect.ownKeys(root.events._hooks)) {
  for (const hook of root.events._hooks[key] ?? []) ensure(hook.ctx)
}` },
  ],
  'webhook': [
    { title: '验签在解析之前', file: 'packages/webhook/webhook-github/src/handler.ts:91', lang: 'ts',
      note: '顺序就是安全：读有界原始 body → 逐请求解析密钥（轮换下次投递即生效）→ HMAC 验签 → 才 JSON.parse。Octokit 的验签异常被刻意吞掉，因为"它不携带对发送方安全或有用的响应细节"。',
      code: `const body = await readBoundedUtf8Body(request, config.maxBodyBytes)
const signature = requiredHeader(request, 'x-hub-signature-256')
const credential = await ctx.credentials.resolve(config.secretEnv)
if (credential === undefined || credential.value === '') {
  throw new WebhookHttpError(503, 'GitHub webhook secret is unavailable')
}
let verified = false
try {
  verified = await new Webhooks({ secret: credential.value }).verify(body, signature)
} catch { /* 不回显任何细节 */ }
if (!verified) throw new WebhookHttpError(401, 'invalid webhook signature')
const payload = parsePayload(body)   // ← 只有验签通过才解析` },
    { title: '只隔离 webServer 的 isolate 实战', file: 'apps/cli/config/examples/github-review/cordis.yml:17', lang: 'yaml',
      note: '01 篇 isolate 领域机制最好的实战范例：适配器仍从父领域继承 credentials 与 webhookRuntime，却拿到自己的监听端口——于是暴露 ingress 不必暴露 /api、WebSocket 和前端文件。',
      code: `- id: github-webhook-ingress
  name: cordis:group
  group: true
  isolate:
    webServer: true          # ← 只隔离 webServer 领域
  config:
    - id: github-webhook-server
      name: '@deepseek-ai/dsh-host-webserver'
      config:
        host: '127.0.0.1'
        port: !!js Number(process.env.DSH_GITHUB_WEBHOOK_PORT ?? 3081)
    - id: github-webhook-adapter
      name: '@deepseek-ai/dsh-webhook-github'
      config: { source: primary-github, path: /github, secretEnv: DSH_GITHUB_WEBHOOK_SECRET }` },
  ],
  'agent-team': [
    { title: '四种 team/* 事件：协作也是事件溯源的', file: 'packages/experimental/agent-team/src/types.ts:203', lang: 'ts',
      note: '声明合并进 SessionEventMap，只存 Lead 会话。信箱是两段式事务：queued 先落盘，target 记录后才补 delivered 回执——恢复按 queued−delivered 重试。',
      code: `declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    'team/member':            { version: 1; teamId: TeamId; member: TeamMemberSnapshot }
    'team/task':              { version: 1; teamId: TeamId; task: TeamTaskSnapshot }
    'team/message/queued':    { version: 1; teamId: TeamId; message: TeamMessageSnapshot }
    'team/message/delivered': { version: 1; teamId: TeamId; messageId: TeamMessageId; targetId: SessionId }
  }
}` },
    { title: '日志先于现实：provisioning 快照先落盘', file: 'packages/experimental/agent-team/src/roster.ts:267', lang: 'ts',
      note: '子会话 id 由调用方预留（rc.8 给 subagent 接缝加的能力），成员快照先 flush 再启动子代理。崩溃恢复拿未终结记录与子会话独立持久化对账，三证齐全才转 active。',
      code: `await this.journal.transact(root.id, async () => {
  // 名字查重后：先追加并 flush 'provisioning' —— 子会话还不存在！
  await this.journal.appendAndFlush(root, 'team/member', { version: 1, teamId: TeamId(root.id), member })
})
started = await this.ctx.subagents.startContinuable({
  childId,          // 调用方预留的子会话 id
  provider: request.provider,
  request: { prompt: request.prompt, parent: root },
})` },
  ],
  'session': [
    { title: 'rc.8 schema 17：打包行的数据布局', file: 'packages/session/session-persistence-sqlite/src/codec.ts:15', lang: 'ts',
      note: '重复字段（turn/step/index/tool-call id）提升一次，seq 隐式（seq0+i）、时间戳存差值数组。物理表示变了，逻辑事件流一字不变——存储标签不进 SessionEventMap。',
      code: `export type ChunkRow =
  | { type: 'text-chunks';      seq0: number; time0: number; data: TextRunData }
  | { type: 'reasoning-chunks'; seq0: number; time0: number; data: TextRunData }
  | { type: 'tool-call-chunks'; seq0: number; time0: number; data: ToolCallRunData }

export const MIN_PACKED_ROW_MEMBERS = 3
export const MAX_PACKED_ROW_MEMBERS = 1_024
export const MAX_PACKED_DATA_BYTES = 1_048_576` },
    { title: '列级压缩：4KiB 阈值 + 只在更小时保留', file: 'packages/session/session-persistence-sqlite/src/compression.ts:99', lang: 'ts',
      note: '阈值扫描实测：1KiB→60.92MB、4KiB→75.01MB、16KiB→93.87MB，4KiB 是"接受的平衡点，不是严格支配"。level 3 显式钉死不继承库默认——同一 schema 版本的数据库必须独立于运行时可读。',
      code: `export const ZSTD_DATA_THRESHOLD_BYTES = 4_096
function encodeData(serialized: string): string | Uint8Array {
  const bytes = Buffer.from(serialized)
  if (bytes.length < ZSTD_DATA_THRESHOLD_BYTES) return serialized
  const compressed = zstdCompressSync(bytes, {
    params: { [constants.ZSTD_c_compressionLevel]: ZSTD_COMPRESSION_LEVEL },  // 3
  })
  return compressed.length < bytes.length ? compressed : serialized
}` },
  ],
  'code-lsp': [
    { title: 'rc.8 fd3 协议：把子进程当敌手', file: 'packages/code-runtime/code-runtime-python/src/protocol.ts:604', lang: 'ts',
      note: '进程边界必须运行时验证：伪造的 truncated 非字面 true 不算（否则真值静默关闭捕获）；1e400 的 id JSON.parse 后是 Infinity，回显进应答帧就编码不出严格 JSON——所以拒收非有限数。',
      code: `case 'log':
  if (typeof m.text !== 'string') return undefined
  // 重建而非透传：只有字面 true 才算 truncated
  return { type: 'log', text: m.text, ...m.truncated === true ? { truncated: true } : {} }
case 'call': {
  if (typeof m.id !== 'number' || !Number.isFinite(m.id) || Object.is(m.id, -0)
    || typeof m.global !== 'string' || typeof m.name !== 'string') return undefined
  if (!Object.hasOwn(m, 'args')) return undefined
  if (hasNonLosslessNumber(m.args)) return undefined
  return { type: 'call', id: m.id, global: m.global, name: m.name, args: m.args }
}` },
  ],
  'shell-exec': [
    { title: 'rc.8 双方言：同一个 OSC 就绪协议', file: 'packages/terminal/terminal-bash/src/index.ts', lang: 'ts',
      note: 'bash 靠 PROMPT_COMMAND 每次提示前自修复 PS1（命令内覆盖活不过一个提示符）；pwsh 用 prompt 函数发同一个 133;D; 标记。sanitize.ts 的就绪检测零改动复用两方言。',
      code: `// bash：PROMPT_COMMAND 自修复 PS1
PROMPT_COMMAND: \`printf "\\\\033]133;D;%s\\\\007" "$?"; PS1='\${CONTROLLED_PROMPT}'\`

// pwsh：prompt 函数发同一个标记
export const PWSH_PROMPT_SETUP =
  "function prompt { [Console]::Write([char]27 + ']133;D;' + [int]$LASTEXITCODE + [char]7); '"
  + CONTROLLED_PROMPT + "' }"` },
  ],
  'cli-boot': [
    { title: '补丁层叠加顺序（启动的本质）', file: 'apps/cli/src/profile-boot.ts', lang: 'text',
      note: '整棵运行时插件树 = 空根 + 这摞补丁。后层可用 id 替换前层任意行的整个 config 或 disable 它。dump-config 打印的就是合成结果。',
      code: `bundle 补丁（按 profile 声明顺序：dsh-base → dsh-web-app）
→ profile 自己的 cordis.patch.yml
→ $DSH_HOME/cordis.patch.yml（家目录层，权重更高）
→ --patch 命令行覆盖（按 argv 顺序）
→ 应用注入的覆盖（shipped preset 根、遥测开关）` },
    { title: '真实补丁行：!!js 懒求值 + 平台条件禁用', file: 'packages/bundle/base/cordis.patch.yml', lang: 'yaml',
      note: '!!js 表达式在该行声明的注入激活后才求值；disabled 在每次挂载决策时求值。',
      code: `- id: webserver
  name: '@deepseek-ai/dsh-host-webserver'
  inject: [webStartup]
  config:
    host: !!js ctx.webStartup.host ?? '127.0.0.1'
    port: !!js ctx.webStartup.port ?? 3080

- id: bash-sandbox
  name: '@deepseek-ai/dsh-bash-sandbox'
  disabled: !!js process.platform === 'win32'` },
  ],
  'bundles': [
    { title: 'bundle 自我声明：package.json 的 dsh 字段', file: 'packages/bundle/base/package.json', lang: 'json',
      note: 'profile 用 dsh.profile.bundles 列 bundle；bundle 用 dsh.bundle.patch 指补丁文件。web 模板 = [dsh-base, dsh-web-app]。',
      code: `"dsh": {
  "bundle": {
    "patch": "./cordis.patch.yml"
  }
}` },
    { title: 'preset 组合：isolate 领域防服务泄漏', file: 'apps/cli/config/agent-presets/cordis/agent.cordis.yml', lang: 'yaml',
      note: '挂载后审计：服务发布进根领域会被拒绝（"a preset service must sit behind an isolate realm"）。这就是 preset 里 cordis:group + isolate 的由来。',
      code: `- id: planning
  name: cordis:group
  group: true
  isolate: { planMode: true }
  config:
    - id: plan-mode
      name: '@deepseek-ai/dsh-plan-mode'` },
  ],
  'client-kernel': [
    { title: '浏览器引导的关键一步：模块表冒充 ESM loader', file: 'packages/client/web/src/boot.tsx', lang: 'ts',
      note: '同一个 vendored Loader 在浏览器原样运转：entry 治理（fiber/inject/refresh）保持 vendored，代码到达方式换成 HTTP。',
      code: `await ctx.plugin(Loader)
loader.internal = this.modules as never   // 浏览器模块表 = Node ESM loader 的对等物
// 之后每个 __DSH_BOOT__ graph 行：loader.create({ name })
// 最后 loader.await() + assertEntriesActive() fail-loud 巡检` },
    { title: '浏览器插件的自我声明', file: 'packages/client/ui-conversation/package.json', lang: 'json',
      note: '宿主扫描 loader entries 里声明了 dsh.client 的包 → 组成 __DSH_BOOT__ 图并服务 /plugins/<id>/client.js。删一行宿主 yml，对应 UI 面板消失。',
      code: `"dsh": { "client": { "platform": "web",
  "inject": ["@deepseek-ai/dsh-client-connection",
             "@deepseek-ai/dsh-client-runtime", "..."] } }` },
  ],
  'client-ui': [
    { title: 'Chat 节点的派发点：每节点一个 seat', file: 'packages/client/ui-conversation/src/client/chat/ChatNodeSeat.tsx', lang: 'tsx',
      note: 'assistant 增量只通知一个节点 key，不重渲染兄弟节点；未注册的 kind 渲染 JSON 兜底而不是崩。',
      code: `const node = useSession(snapshot => snapshot.chat.nodes.get(nodeKey))
renderSlot('conversation.chat.node', routedOwner, {
  entryKey: routedNode.kind, hookContext: nodeKey,
  fallback: <JsonBlock label={t('message.unknownSurface', { type: routedNode.kind })} ... />,
})` },
    { title: '声明合并扩展 Chat 节点 payload', file: 'packages/client/ui-conversation/src/client/conversation-nodes/tool.ts', lang: 'ts',
      note: '和 SessionEventMap 同一招：每个节点定义往 ChatNodeDataMap merge 自己的 key，类型安全的开放词汇表。',
      code: `declare module '@deepseek-ai/dsh-client-ui-conversation/client' {
  interface ChatNodeDataMap { 'tool-call': ToolChatData }
}` },
  ],
  'sdk-protocols': [
    { title: 'SDK 线上协议全貌：3 请求 + 4 通知', file: 'packages/sdk/protocol/src/types.ts', lang: 'ts',
      note: 'session/prompt 返回入队回执（messageId），不等 turn 结束——想要结果订阅 session.event 或用高层 run()（从回执到下一次整体 idle）。',
      code: `interface HarnessSdkRequestMap {
  'initialize':     { params: InitializeParams; result: InitializeResult }
  'session/prompt': { params: SessionPromptParams; result: SessionPromptResult }
  'shutdown':       { params: undefined; result: Record<string, never> }
}
interface HarnessSdkNotificationMap {
  'session.event': SessionEventNotification      // 完整 SessionEvent 信封
  'session.status': SessionStatusNotification    // 'idle' | 'running'
  'subagent.started': SubagentStartedNotification
  'subagent.finished': SubagentFinishedNotification
}` },
  ],
  'interaction': [
    { title: 'hook 插件骨架：权限门（waterfall 必须调 next）', file: 'docs/cookbook/extension-cookbook.md', lang: 'ts',
      note: '返回而不调 next() = 短路整条链。只观察不决策的监听器必须 return next()。这是新手第一坑。',
      code: `export function apply(ctx: Context) {
  ctx.on('tools/pre-execute', async (exec, next): Promise<PreToolDecision> => {
    if (!(await isAllowed(exec))) {
      return { kind: 'deny', reason: 'Denied by policy.' }
    }
    return next()   // ← 不调 next 就否决了下游和默认行为
  })
}` },
  ],
  'examples': [
    { title: '--patch 覆盖示例：给 web profile 加插件', file: 'examples/web-cordis/cordis.yml', lang: 'yaml',
      note: '这是补丁覆盖不是完整树：同层级于 bundle 补丁，能触达每个 bundle 行。持久化 = 把同样的 insert 合进 $DSH_HOME 的 patch 文件。',
      code: `- id: webserver
  config:
    host: 127.0.0.1
    port: 3081

- insert:
    - id: tool-cordis
      name: '@deepseek-ai/dsh-tool-cordis'` },
  ],
};
