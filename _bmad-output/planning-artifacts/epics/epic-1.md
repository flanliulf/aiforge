## Epic 1: 项目基础设施与核心框架（Foundation Sprint）

项目可构建、可测试，`npx aiforge --help` 可运行，核心抽象（错误体系、输出层、路径解析）就绪。

### Story 1.1: 项目初始化与工具链配置

As a 开发者,
I want 一个完整配置的 TypeScript ESM 项目骨架,
So that 后续所有模块可以在统一的构建、测试、lint 环境中开发。

**Acceptance Criteria:**

**Given** 一个空目录
**When** 执行项目初始化脚本
**Then** 生成完整的项目结构（`src/`、`tests/`、`dist/` 目录）
**And** `package.json` 配置 `"type": "module"`，`engines.node >= 18`
**And** TypeScript 配置启用 strict 模式，目标 ESM 输出

**Given** 项目已初始化
**When** 运行 `npm run build`
**Then** tsup 成功编译 TypeScript 到 `dist/` 目录（ESM 格式）

**Given** 项目已初始化
**When** 运行 `npm test`
**Then** vitest 成功执行（即使无测试用例也不报错）

**Given** 项目已初始化
**When** 运行 `npm run lint`
**Then** ESLint + Prettier 检查通过，无报错

**Given** 项目已初始化
**When** 检查依赖列表
**Then** 包含所有核心依赖：commander、simple-git、ora(v8+)、chalk(v5+)、@inquirer/prompts
**And** 包含所有开发依赖：typescript、tsup、tsx、vitest、eslint、prettier、typescript-eslint、@types/node
**And** npm 包源码不含任何公司域名、仓库地址（NFR-S1）

### Story 1.2: 核心类型定义与错误体系

As a 开发者,
I want 管道数据契约的 TypeScript 接口和统一的错误类型,
So that 所有管道阶段有明确的输入/输出类型，错误处理一致且信息丰富。

**Acceptance Criteria:**

**Given** `core/types.ts` 已创建
**When** 检查类型定义
**Then** 包含所有管道阶段的输入/输出接口：`ParsedArgs`、`ResolvedSource`、`AuthenticatedSource`、`LocalRepo`、`DetectedEnv`、`MatchedPlan`、`InstallResult`
**And** 包含 `InstallRule`、`ToolDefinition`、`ManifestEntry`、`AiforgeConfig` 等数据结构接口
**And** 接口命名 PascalCase，无 `I` 前缀

**Given** `core/errors.ts` 已创建
**When** 创建一个 `AiforgeError` 实例
**Then** 包含 `code`（字符串错误码）、`exitCode`（0/1/2/3）、`severity`（'fatal'|'partial'）、`why`（原因）、`fix`（修复命令数组）
**And** `severity: 'fatal'` 表示管道应立即停止
**And** `severity: 'partial'` 表示管道应收集错误继续执行

**Given** `core/sanitize.ts` 已创建
**When** 调用 `sanitizeToken('glpat-abcdefghijklmnop')`
**Then** 返回 `glpat-ab****op`（前 8 + 后 4 字符，中间用 `****` 替代）

**Given** 任意包含 Token 的字符串
**When** 调用 `sanitizeUrl('https://glpat-abc123@gitlab.com/repo.git')`
**Then** URL 中的 Token 部分被脱敏处理

**Given** 所有核心类型文件
**When** 检查模块依赖
**Then** `core/` 目录不依赖 `src/` 下任何其他目录（零依赖原则）
**And** 所有导出使用命名导出，ESM 导入带 `.js` 扩展名

### Story 1.3: 输出抽象与路径解析

As a 开发者,
I want 统一的输出抽象层和跨平台路径解析器,
So that 所有用户可见输出通过 Reporter 接口管理，路径处理跨平台一致。

**Acceptance Criteria:**

**Given** `core/reporter.ts` 已创建
**When** 检查 Reporter 接口
**Then** 包含方法：`startPhase(name)`、`updatePhase(message)`、`completePhase()`、`reportResult(results)`、`reportPlan(plan)`、`reportError(error)`
**And** 进度方法输出到 stderr，结果/计划方法输出到 stdout

**Given** TTY 终端环境
**When** 使用 `TtyReporter`
**Then** `startPhase` 启动 ora spinner，`updatePhase` 更新 spinner 文本，`completePhase` 停止 spinner 并显示成功标记

**Given** 非 TTY 环境（如 CI 管道）
**When** 使用 `PlainReporter`
**Then** 输出纯文本行，无 spinner、无 ANSI 彩色码

**Given** `--quiet` 模式
**When** 使用 `QuietReporter`
**Then** 只输出关键信息（最终成功/失败 + 统计行）

**Given** `core/path-resolver.ts` 已创建
**When** 检查 PathResolver 接口
**Then** 包含方法：`home()`、`toolGlobalDir(toolId)`、`toolProjectDir(toolId)`、`configDir()`、`reposDir()`
**And** `UnixPathResolver` 实现使用 `os.homedir()` + `path.join()`（NFR-C5, NFR-C6）

**Given** macOS 或 Linux 环境
**When** 调用 `pathResolver.configDir()`
**Then** 返回 `~/.aiforge/`（展开为绝对路径）

**Given** `os.homedir()` 返回空或未定义
**When** 创建 PathResolver
**Then** 抛出 `AiforgeError`，提示 HOME 环境变量未设置

### Story 1.4: 数据层配置

As a 开发者,
I want 数据化的安装规则表、工具检测注册表和排除列表,
So that 新增工具或规则只需修改数据，不需要改引擎代码。

**Acceptance Criteria:**

**Given** `data/install-rules.ts` 已创建
**When** 检查 `BUILTIN_RULES` 常量
**Then** 包含 PRD 定义的完整 MVP 规则映射表（16 条规则，覆盖 Copilot/Claude/Cursor/VS Code × 全局/项目）
**And** 每条规则包含 `tool`、`scope`、`sourceDir`、`type`、`targetDir` 等字段
**And** 预留 `loadRules()` 函数接口，MVP 返回 `BUILTIN_RULES`

**Given** `data/tool-registry.ts` 已创建
**When** 检查 `TOOL_DEFINITIONS` 常量
**Then** 包含 4 个工具定义：copilot、claude、cursor、vscode
**And** 每个工具包含 `id`、`name`、`detect.global[]`、`detect.project[]`（标志路径）

**Given** `data/excludes.ts` 已创建
**When** 检查 `DEFAULT_EXCLUDES` 常量
**Then** 包含：`README.md`、`README`、`.gitkeep`、`.DS_Store`、`mcp.json.example`

**Given** `data/messages.ts` 已创建
**When** 检查输出字符串
**Then** 包含中文进度阶段名（"解析仓库地址..."、"验证认证信息..."、"克隆仓库..."等）
**And** 包含结果状态图标（✅ 新建、🔄 更新、⏭️ 跳过、❌ 失败）
**And** 包含统计行格式模板

**Given** 所有数据文件
**When** 检查模块依赖
**Then** `data/` 目录不依赖 `src/` 下任何其他目录（纯数据原则）

### Story 1.5: CLI 入口与管道骨架

As a 开发者,
I want CLI 命令定义和管道编排器骨架,
So that `npx aiforge --help` 可运行，管道框架就绪可逐步填充阶段实现。

**Acceptance Criteria:**

**Given** `index.ts` 已创建
**When** 运行 `npx aiforge --help`
**Then** 显示完整的命令帮助，包含所有参数和选项定义
**And** 包含主命令 `aiforge [repo-url]` 和子命令 `aiforge init`

**Given** `index.ts` 已创建
**When** 运行 `npx aiforge --version`
**Then** 显示 `package.json` 中的版本号

**Given** CLI 参数解析
**When** 传入 `-g -l -t copilot claude -d skills agents --dry-run --quiet --force`
**Then** 正确解析为 `ParsedArgs` 对象，所有字段值正确

**Given** `pipeline.ts` 已创建
**When** 检查管道编排器
**Then** 定义了完整的阶段链类型签名（Resolve → Auth → Clone → Detect → Match → Install → Report）
**And** 每个阶段为占位函数（抛出"未实现"错误）
**And** `dryRun` 标志控制 Install 阶段是否执行
**And** `ParsedArgs` 由编排器持有，按需注入到各阶段

**Given** 管道编排器
**When** 某阶段抛出 `severity: 'fatal'` 的 AiforgeError
**Then** 管道立即停止，通过 Reporter 输出错误

**Given** CLI 启动
**When** 测量从执行到首次输出的时间
**Then** < 1 秒（NFR-P4）

---
