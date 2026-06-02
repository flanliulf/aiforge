## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**

| # | 决策 | 选择 | 理由 |
|---|------|------|------|
| D1 | 知识源抽象 | SourceResolver 接口 + GitResolver | 最小成本预留本地源扩展 |
| D2a | 规则存储 | TS 常量 + 预留外部加载接口 | 类型安全 + M3 扩展路径 |
| D2b | 规则匹配 | Map 索引（tool:scope） | O(1) 查找，规则增长友好 |
| D3a | config.json 结构 | 按 host 分层认证 | FR-042 要求，多仓库就绪 |
| D3b | manifest.json 写入 | 内存累积 + 原子写入 + 崩溃降级 | 平衡性能与可靠性 |
| D4a | 错误类型 | 单一 AiforgeError + severity | fatal only，Install fail-fast |
| D4b | 输出抽象 | Reporter 接口 + 三种实现 | TTY/Plain/Quiet 集中管理 |
| D5a | 工具检测 | 数据驱动注册表 | 配置驱动，新增工具只加数据 |
| D5b | 路径解析 | PathResolver 集中管理 | 平台差异封装一处 |
| D6a | 管道数据流 | 类型安全的阶段链 | 编译时捕获数据流错误 |
| D6b | dry-run 实现 | 管道在 Match 后分叉 | 架构保证一致性 |

<!-- DECISIONS_APPEND_1 -->

### Decision Details

#### D1: Knowledge Source Abstraction — SourceResolver 接口

```typescript
interface SourceResolver {
  canHandle(source: string): boolean;
  resolve(source: string, options: ResolveOptions): Promise<ResolvedSource>;
}
```

- MVP 实现 `GitSourceResolver`（simple-git 封装）
- 未来扩展 `LocalSourceResolver`（Obsidian vault 等本地目录）
- 管道只依赖接口，不依赖具体实现

#### D2: Install Rules Data Architecture

**存储：** TypeScript 常量（MVP）+ 预留 `RuleLoader` 函数接口（M3 加载 aiforge.json）

**匹配：** Map 索引，key 为 `${tool}:${scope}`，启动时预构建

```typescript
// 规则加载抽象
function loadRules(): InstallRule[] {
  // MVP: 返回内置规则常量
  // M3: 合并内置规则 + aiforge.json 自定义规则
  return BUILTIN_RULES;
}

// 规则索引
const ruleIndex = new Map<string, InstallRule[]>();
for (const rule of loadRules()) {
  const key = `${rule.tool}:${rule.scope}`;
  ruleIndex.get(key)?.push(rule) ?? ruleIndex.set(key, [rule]);
}
```

#### D3: State Management

**config.json — 按 host 分层：**

```typescript
interface AiforgeConfig {
  defaultRepo?: string;
  cloneDir?: string;           // 默认 ~/.aiforge/repos/
  language?: string;           // 默认 zh-CN
  preferSSH?: boolean;         // 全局默认认证偏好（aiforge init 时设置）
  auth: Record<string, {       // 按 hostname 索引
    method: 'ssh' | 'token';
    token?: string;
  }>;
}
```

- `preferSSH` 是全局默认偏好，`aiforge init` 时用户选择 SSH 则设为 `true`
- 认证优先级链：CLI `--ssh`/`--token` > 环境变量 > `auth[host].method`（per-host） > `preferSSH`（全局默认） > 系统凭据
- per-host 的 `method` 覆盖全局 `preferSSH`，允许不同 Git 服务器使用不同认证方式

**manifest.json — 内存累积 + 原子写入：**

```typescript
interface ManifestEntry {
  source: string;              // 源文件相对路径
  target: string;              // 目标绝对路径
  tool: string;                // 工具 ID
  scope: 'global' | 'project';
  mode: 'copy' | 'symlink' | 'flatten';
  hash: string;                // 文件内容 SHA256
  installedAt: string;         // ISO 时间戳
}
```

- 写入策略：写临时文件 → `fs.rename()` 原子替换
- 损坏降级：manifest 不可读时视为空（所有文件为未知来源）

<!-- DECISIONS_APPEND_2 -->

#### D4: Error Handling & Output Strategy

**错误类型 — 单一类 + severity：**

```typescript
class AiforgeError extends Error {
  code: string;                // 'AUTH_FAILED' | 'CLONE_FAILED' | ...
  exitCode: number;            // 0=成功, 1=安装失败, 2=认证失败, 3=参数错误
  severity: 'fatal';           // 始终为 fatal（Install fail-fast，无 partial 概念）
  why: string;                 // 为什么（简短原因）
  fix: string[];               // 怎么修（可复制的命令列表）
}
```

- 管道编排器：`fatal` → 立即停止并报告
- Install 阶段 I/O 错误直接抛 `AiforgeError(severity: 'fatal')`，管道终止
- `InstallResult` 只有 `'new'` | `'updated'` | `'skipped'` 三种状态（无 `'failed'`）
- Reporter 渲染三段式：`❌ ${message}` → `${why}` → `${fix.join('\n')}`

**输出抽象 — Reporter 接口 + 三种实现：**

```typescript
interface Reporter {
  startPhase(name: string): void;
  updatePhase(message: string): void;
  completePhase(): void;
  reportResult(results: InstallResult): void;
  reportPlan(plan: MatchedPlan): void;
  reportError(error: AiforgeError): void;
  info(message: string): void;
  warn(message: string): void;
}
```

| 实现 | 触发条件 | 行为 |
|------|---------|------|
| TtyReporter | `process.stdout.isTTY && !quiet` | spinner + 彩色 + 树形结果 |
| PlainReporter | `!process.stdout.isTTY` | 纯文本行输出，无 spinner/彩色 |
| QuietReporter | `--quiet` | 只输出关键信息（成功/失败 + 统计） |

**stdout/stderr 分工规则（对齐 PRD 脚本化与非交互支持要求）：**

| 方法 | 输出流 | 理由 |
|------|--------|------|
| `reportResult()` | stdout | 安装结果可被管道消费（`npx aiforge \| grep copilot`） |
| `reportPlan()` | stdout | dry-run 计划输出同理，支持脚本化处理 |
| `startPhase()` | stderr | 进度信息是诊断性质，不应污染管道数据流 |
| `updatePhase()` | stderr | 同上 |
| `completePhase()` | stderr | 同上 |
| `reportError()` | stderr | 错误信息写 stderr 是 CLI 标准约定 |
| `info()` | stderr | 非失败信息提示（unsupported/stale/迁移说明等），诊断性质 |
| `warn()` | stderr | 非致命警告（断链、mainFile 缺失等），诊断性质 |

这确保 `npx aiforge --dry-run 2>/dev/null` 只输出纯安装计划，可被 `grep`/`awk`/`jq` 解析。

**PlainReporter 输出方法内所有行必须遵从同一分隔符契约：**

当方法要求"制表符分隔输出"时，该方法内的**所有** `stdout.write()` 调用（含明细行、统计行、汇总行）均须使用 `\t` 分隔，不能只修改主数据行而遗漏统计行或汇总行。实现完成后必须横向比对方法内全部输出行，逐行确认分隔符一致性；同一 Reporter 类中多个输出方法（`reportResult()` / `reportPlan()`）的分隔规则也必须相互对齐。（来源：Story 5-3 CR R1 — `reportPlan()` 主数据行用双空格而非 `\t`；CR R2 — `reportResult()` 明细行已用 `\t` 但统计行仍用双空格，同一方法内两套分隔规则）

**错误码测试必须覆盖"真实生产创建链路"，禁止在 Reporter 层手工构造错误对象伪造 AC 满足：**

为新错误码（如 `AUTH_FAILED`、`NO_TOOLS`、`PERMISSION_DENIED`）编写测试时，必须从该错误码的**真实创建模块**（如 `clone.ts`、`detect-tools.ts`、`fs-utils.ts`）的入口触发，断言最终抛出的 `AiforgeError.code` 和关键字段值。禁止"在 reporter 测试中手工 `new AiforgeError('...', 'NEW_CODE')` 构造错误对象"——这只证明 Reporter 能渲染该类型的错误，不能证明生产代码会在正确时机创建该错误，导致测试全绿但 AC 实质未满足。（来源：Story 5-4 CR Round 1 — `AUTH_FAILED` 只存在于 reporter 手工构造的单测中，生产代码根本不存在创建该错误的链路）

**新增错误处理分支必须全功能对标同函数内已有并行分支：**

在 catch 块或同一函数中新增错误处理分支时，**禁止只实现核心字段（message/why/code）而忽略辅助功能字段**。必须找到同函数中已有的同类分支，逐字段对比，确保新分支行为与已有分支完全对等（如 cleanupWarning 透传、额外上下文追加等）。（来源：Story 5-4 CR Round 2 — 新增 `AUTH_FAILED` 分支时未复制 `CLONE_FAILED` 分支的 cleanupWarning 透传逻辑）

**交互式提示中断统一决策（Prompt Cancellation Unification）：**

当阶段逻辑使用 `@inquirer/prompts`（如 `confirm()`）处理用户交互时，Ctrl+C 触发的 `ExitPromptError` 必须在交互调用点被捕获，并转换为项目统一取消信号（当前为 `FilterCancelledSignal`）。

该决策的目标是维持 D4a/D4b 的单一错误与输出语义：
- pipeline 仅识别统一取消信号，不处理多种“局部取消异常”
- 取消行为与 reporter 生命周期保持一致，不引入并行分支
- 取消路径具备可测试性（可通过固定信号断言）

反模式：将 `ExitPromptError` 原样上抛，依赖外层兜底识别。该做法会让交互中断语义散落在多处，增加后续 stage 扩展的不一致风险。

> 来源：Story 7-6 CR R1→R2 — `applySemanticWarnings` 首轮因未捕获中断被判定为需修复；修复为统一转换后通过复审。

**三种脱敏函数适用场景不可混用：**

`sanitizeToken()` 适用于独立 token 字符串；`sanitizeUrl()` 适用于纯 URL 字符串（带 `^` 锚点正则）；`sanitizeMessage()` 适用于任意字符串（如 git 错误消息）中嵌入 token-bearing URL 的场景（全局替换正则，无锚点）。将底层异常的 `error.message` 写入 `AiforgeError.why` 时，**必须使用 `sanitizeMessage()` 而非 `sanitizeUrl()`**。（来源：Story 5-4 CR Round 1 — `CLONE_FAILED`/`PULL_FAILED` 的 `why` 直接透传 `error.message` 导致 token 泄露；修复时新增 `sanitizeMessage()` 处理此场景）

**npm 包安全规则 — 公司信息零容忍 + 通用占位符豁免：**

npm package MUST contain ZERO company info：no company/internal repo URLs、no real tokens or credentials、no company hostnames、no platform-specific token prefixes（如 `glpat-`、`ghp_`）。通用教学占位符（如 `your-git-host.com`、`<your-access-token>`）不包含公司身份信息，不在禁止范围内。（来源：Story 5-5c CR R2 评估 — 规则限定语为 "company info"，通用占位符不构成信息泄露）

**npm 包安全验证方法必须扫描入包文件的实际内容：** 禁止仅扫描 `npm pack --dry-run` 的输出流（仅含文件名+大小）。必须用 `npm pack --json` 获取入包文件列表后，逐个 `grep -in <pattern> <file>` 扫描文件内容。`README.md` 是 npm 硬编码始终包含的文件，无法通过 `.npmignore` 或 `files` 字段排除，因此 README.md 的内容安全必须作为独立验证项。（来源：Story 5-5c CR R1 — B5 验证方法只扫 `npm pack` 输出流，README.md 中的敏感示例未被检出）

#### D5: Tool Detection & Platform Abstraction

**工具检测 — 数据驱动注册表：**

```typescript
interface ToolDefinition {
  id: string;                  // 'copilot' | 'claude' | ... | 'trae'（当前基线 11 个工具）
  name: string;                // 'GitHub Copilot'
  detect: {
    global: string[];          // ['~/.copilot'] — 标志路径
    project: string[];         // ['.github'] — 标志路径
  };
}
```

- 检测逻辑统一：遍历注册表，检查标志路径是否存在
- `--tools` 手动指定时按 id 查找，跳过检测
- 新增工具只需在注册表加一条数据

**路径解析 — PathResolver 集中管理：**

```typescript
interface PathResolver {
  home(): string;
  toolGlobalDir(toolId: string): string;
  toolProjectDir(toolId: string): string;
  configDir(): string;         // ~/.aiforge/
  reposDir(): string;          // ~/.aiforge/repos/
}
```

- MVP 实现 macOS + Linux（`os.homedir()` + `path.join()`）
- M2 扩展 Windows（AppData 路径映射）
- 测试时可注入 mock 实现

**2026-05-24 工具注册表基线与演化约束：**

- 当前 `TOOL_DEFINITIONS` = 11：`copilot`、`claude`、`cursor`、`codex`、`opencode`、`windsurf`、`auggie`、`gemini`、`antigravity`、`kiro`、`trae`
- 当前 `BUILTIN_RULES` = 55，`UNIVERSAL_RULES` = 4；`UNIVERSAL_RULES` 使用虚拟 tool id `universal`，不进入 `TOOL_DEFINITIONS`
- `BUILTIN_RULES` 当前分布：copilot 9、claude 7、cursor 4、codex 5、opencode 7、windsurf 5、auggie 5、gemini 4、antigravity 3、kiro 4、trae 2
- `vscode` 不再是注册工具；项目级 MCP 规则由 `copilot` 的 `.vscode/` 目标路径承接，但 `vscode` 在 `--tools` 中仍必须报 `UNKNOWN_TOOL`
- NFR-I5 约束保持不变：工具增删、路径映射和规则总量调整只修改 `src/data/tool-registry.ts`、`src/data/install-rules.ts`，不触及 `src/stages/`
- 工具规则总量验收口径必须按“已批准基线 + 当前 Story 明确增减范围”推导；不得为满足过期规格数字新增无需求来源的规则。若 Story/Epic/PLAN 的累计数字与实现/测试自洽口径冲突，应将其裁定为规格澄清或 CR TODO，而不是扩大工具注册表行为。（来源：Story 7-3 CR — 30 vs 29；Story 7-5 CR — 41 vs 40）

**Legacy VS Code 迁移提示（`vscodeMergedNote`）仍保留：**

- 场景：用户历史上仅用 VS Code 工具，`~/.vscode/` 存在但 `~/.copilot/` 不存在
- 检测函数 `detectLegacyVscodeOnly(pathResolver)` 封装在 `detect-tools.ts`，不作为独立管道阶段
- 检测结果为非阻塞警告（`reporter.warn`），不影响安装继续执行
- NFR-C7 约束：aiforge 不读写 `~/.vscode/` 等旧工具目录，仅检测路径是否存在

**工具专用契约纳入 D5 决策基线：**

- `codex` global `mcp-tools` 只复制模板到 `~/.codex/` 并输出 `[mcp]` 合并提示，绝不修改 `~/.codex/config.toml`
- `opencode` global 路径采用 XDG（`~/.config/opencode`），不是 `~/.opencode`；其 MCP 模板需要手工 merge 到 `opencode.json` 的 `"mcp"` 字段
- `gemini` 的 `skills/` 规则必须先通过 CLI 版本前置条件（`v0.26.0+`）；前置条件失败时移除受影响项并 warn，而不是整体安装失败
- `windsurf` 项目级 `agents/` 目标目录语义映射为 `workflows/`，必须走 `semanticWarning: 'windsurfAgentsToWorkflows'`
- `trae` 仅支持 project `rules` 与根 `AGENTS.md`；若知识仓库存在 `skills/`，只发 unsupported notice，不改变安装语义
- `antigravity` global 命名空间嵌套在 `~/.gemini/antigravity/...`，project `skills/` 继续复用 `.agents/skills/`
- `.iflow/` stale notice 仅为信息提示；home/project `.iflow` 的存在不能阻断自动检测或手动 `--tools` 路径

**unsupported/stale/迁移类 notice 触发契约与非阻断边界：**

- notice 触发条件必须直接对应 Story/AC 契约（目录存在、配置文件存在、工具命中或历史路径存在等），不得用“可安装项扫描结果”等下游副产品代替。
- 若契约适用于 `aiforge install`，必须同时覆盖自动检测路径和手动 `--tools` 路径；手动分支提前返回前也必须执行同一 notice helper。
- notice 通过 `reporter.info()` 或 `reporter.warn()` 输出，不得改变检测结果、安装计划或错误语义。
- 仅当 notice 是纯信息性且明确要求非阻断时，允许使用专用存在性 helper 将 `EACCES`/`EIO` 等异常降级为“跳过提示”；该 helper 禁止复用到工具识别、安全校验、安装决策或数据完整性路径，主决策路径仍遵守 ENOENT/ENOTDIR 白名单降级。
- 对目录存在性触发的 notice，必须覆盖空目录、仅占位文件、手动/自动入口和存在性检查异常等边界测试。

> 来源：Story 7-9 CR — Trae `skills/` 空目录未触发 unsupported notice；Story 7-10 CR — 手动 `--tools` 分支绕过 `.iflow/` stale-tool notice，且信息性 `.iflow/` 检查曾可能因权限/I/O 错误阻断安装。

**reserved-name 强制保护设计决策（Story 7-1）：**

- 问题：Claude Code 保留文件（如 `CLAUDE.md`、`AGENTS.md`、`settings.json` 等）若被安装工具覆盖，将破坏用户的本地配置
- 决策：在 `execute-install.ts` 中对 `claude:*:instructions` 类型的规则加硬保护，拦截写入保留文件名的操作
- 保留名称集合 `CLAUDE_RESERVED_NAMES`（7 个，大小写不敏感）：`claude.md`、`claude.local.md`、`agents.md`、`agents.local.md`、`settings.json`、`settings.local.json`、`.claudeignore`
- 覆盖范围：`InstallType.Files`、`InstallType.Directories`（主文件）、`InstallType.Flatten` 三种安装类型
- `--force` 对此保护**无效**；被拦截的文件记为 `reservedSkip` 而非普通 `skip`
- 保护检查在 `validateDestPathSecurity` 之后执行，不影响路径穿越检测的优先级
- 全部文件均为 `reservedSkip` 时，`completePhase` 输出黄色专属摘要而非通用灰色 skipped 摘要

#### D6: Pipeline Orchestration

**类型安全的阶段链与分叉点：**

```typescript
type ResolveStage   = (args: ParsedArgs) => Promise<ResolvedSource>;
type AuthStage      = (source: ResolvedSource) => Promise<AuthenticatedSource>;
type CloneStage     = (source: AuthenticatedSource) => Promise<LocalRepo>;
type ListStage      = (repo: LocalRepo, args: ParsedArgs) => Promise<void>;
type DetectStage    = (repo: LocalRepo, args: ParsedArgs) => Promise<DetectedEnv>;
type MatchStage     = (env: DetectedEnv, args: ParsedArgs) => Promise<MatchedPlan>;
type InstallStage   = (plan: MatchedPlan, args: ParsedArgs) => Promise<InstallResult>;
type SaveManifestStage = (result: InstallResult) => Promise<void>;
type ReportStage    = (results: InstallResult | MatchedPlan) => void;
```

**ParsedArgs 贯穿说明：**

`ParsedArgs` 包含用户 CLI 输入（`--dirs`、`--tools`、`--force`、`--dry-run` 等），需要在多个阶段被访问：
- `ResolveStage`：读取 repo-url、`--clone-dir`、`--ssh`、`--token`
- `ListStage`：读取 `--list`，且调用分叉判定必须使用 `args.list !== undefined`
- `DetectStage`：读取 `--tools` 手动指定（FR-014）
- `MatchStage`：读取 `--dirs` 过滤源目录（FR-024），只匹配用户指定的资源类型
- `InstallStage`：读取 `--force`、`--link`、`--flatten`、`--no-universal`
- 管道编排器：读取 `--dry-run`、`--quiet`、`--force` 控制流程分叉和 Reporter 选择

`ParsedArgs` 不通过阶段链逐级传递，而是由管道编排器持有，按需注入到需要的阶段。

**当前管道分叉：**

```
list 模式:   Resolve → Auth → Clone → List
正常模式:   Resolve → Auth → Clone → Detect → Match → Install → SaveManifest → Report(results)
dry-run:    Resolve → Auth → Clone → Detect → Match → Report(plan)
```

- `args.list !== undefined` 必须在 `Clone` 后直接分叉到 `listContents()`，不能继续落到 detect/match/install
- 管道编排器根据 `dryRun` 标志决定是否执行 `Install` / `SaveManifest`
- dry-run 与正常模式共享 `Resolve~Match` 全部阶段，架构保证预览一致性
- `SaveManifest` 是 install 成功后的独立后处理步骤，不参与 dry-run，也不在 list 模式下执行

**预检查(preflight)设计决策：**

PRD 执行流程中"预检查"（目标路径可写性、权限验证，FR-030）不作为独立管道阶段，而是作为 Install 阶段的第一步执行。理由：
1. 预检查的输入数据（MatchedPlan 中的目标路径列表）与 Install 阶段完全相同，拆分为独立阶段会引入冗余的类型定义
2. 预检查失败时的行为（抛出 `severity: 'fatal'` 的 AiforgeError）与 Install 阶段的错误处理一致，无需独立的错误流
3. 保持管道阶段数最小化，降低编排器复杂度

实现要求：`execute-install.ts` 必须在执行任何文件操作前，先对 MatchedPlan 中所有目标路径执行预检查（可写性 + 权限），全部通过后才开始实际安装。预检查失败应立即 fail-fast。

#### D7: Cross-LLM CR Workflow Rules（Story 7-1 CR 九轮复盘正式确立）

**决策背景：** Story 7-1 经历 9 轮 CR 才通过，暴露了多触点修复漏检、staged/unstaged 分裂、AC 条目回退、测试断言过宽等系统性工作流缺陷。2026-05-12 由 CR evaluator（Claude Opus 4.7）主动诊断根因并给出突围路径，成功在第 9 轮闭合。复盘结论作为 CR-001～CR-006 正式纳入项目工作流规则。

| 规则 | 触发场景 | 核心约束 |
|------|---------|---------|
| **CR-001** | 修复包含多处字面量的不一致 | 先全局 grep 扫描所有触点，一次性全部修复后再 stage |
| **CR-002** | 每次修复完成后 | 立即 `git add` 相关文件，禁止跨轮留存 unstaged 修复 |
| **CR-003** | 每次修复后 | 重新逐条对照 Story AC，确认无 AC 条目回退 |
| **CR-004** | 编写回归保护测试断言 | 断言字符串必须精确匹配关键词，禁止宽泛正则（如 `.*` 通配） |
| **CR-005** | CR 超过 4 轮未通过 | Evaluator 必须切换模式：诊断根因 + 给出一次性突围路径，不再只评审单条发现 |
| **CR-006** | 每轮修复执行记录 | 必须包含 `npm run lint:src`、`npm run build`、`npm test` 三件套的执行结果（含通过数量） |

**关联文档：** 实现模式与代码示例见 `04-implementation-patterns.md § CR Workflow Patterns`；可操作规则见 `project-context.md § CR Workflow Rules`。

---

### Deferred Decisions (Post-MVP)

| 决策 | 延迟到 | 理由 |
|------|--------|------|
| 外部规则加载（aiforge.json） | M3 | MVP 内置规则够用 |
| Windows PathResolver | M2 | 公司以 macOS 为主 |
| manifest 文件锁（并发安全） | M2 | MVP 单进程无并发 |
| 规则包生态系统 | P3 | 远期愿景 |
| 语义类型系统 | P3 | MVP 用目录名匹配 |
| LocalSourceResolver | M2+ | MVP 只支持 Git 仓库 |

### Decision Impact Analysis

**Implementation Sequence:**

1. D4a/D4b（错误类型 + Reporter）→ 所有模块依赖
2. D5b（PathResolver）→ 工具检测和安装都依赖
3. D1（SourceResolver + GitResolver）→ 管道第一阶段
4. D3a（config.json）→ 认证阶段依赖
5. D5a（工具注册表）→ 检测阶段依赖
6. D2a/D2b（规则存储 + 索引）→ 匹配阶段依赖
7. D3b（manifest.json）→ 安装阶段依赖
8. D6a/D6b（管道编排 + dry-run）→ 串联所有阶段

**Cross-Component Dependencies:**

- Reporter 被所有阶段引用（输出进度和错误）
- PathResolver 被工具检测、安装执行、配置管理引用
- AiforgeError 被所有阶段抛出，管道编排器统一处理
- MatchedPlan 是 Install 和 dry-run Report 的共享数据结构
