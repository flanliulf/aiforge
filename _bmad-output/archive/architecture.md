---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
status: 'complete'
completedAt: '2026-03-12'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/product-brief-ai-forge-2026-03-11.md
  - _bmad-output/analysis/brainstorming-session-2026-03-04.md
  - docs/architec(draft).md
  - docs/AI Coding IDE 工具对比.md
  - docs/AI Coding IDE 工具概念目录对比.md
  - docs/AI Coding IDE 工具统一路径映射矩阵.md
workflowType: 'architecture'
project_name: 'ai-forge'
user_name: 'chunxiao'
date: '2026-03-12'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**功能需求（46 条 FR）：**

aiforge 的功能需求围绕一条核心管道展开，可归纳为 8 个架构域：

| 架构域 | FR 范围 | 核心能力 | 架构影响 |
|--------|---------|---------|---------|
| 仓库获取 | FR-001~005 | Git 克隆、浅克隆、增量更新、持久化路径 | 需要 Git 操作抽象层，隔离 simple-git 依赖 |
| 认证 | FR-006~012 | SSH/Token/环境变量/系统凭据四层优先级 | 认证解析器需独立模块，支持链式降级 |
| 工具检测 | FR-013~015 | 自动扫描 + 手动指定 + 零结果诊断 | 平台感知的检测引擎，基于标志性文件/目录 |
| 安装引擎 | FR-016~024 | 全局/项目 × 复制/符号链接 × files/directories/flatten | 管道核心——规则匹配 + 执行策略 |
| 冲突处理 | FR-025~032 | manifest 状态追踪、冲突检测、备份、fail-fast | manifest.json 是状态管理核心，需原子写入 |
| 用户交互 | FR-033~039 | init 引导、dry-run、阶段式进度、树形结果、三段式错误 | 输出层需抽象，支持 TTY/非TTY/quiet 三种模式 |
| 配置管理 | FR-040~042 | config.json 持久化、按 host 认证、首次引导 | 配置读写独立模块，文件权限 0o600 |
| 可扩展性 | FR-043~046 | 配置驱动规则表、全局排除、国际化 | 规则表数据化，引擎与规则解耦 |

<!-- APPEND_MARKER_1 -->

**非功能需求（32 条 NFR）——架构驱动力：**

| 质量属性 | 关键约束 | 架构决策影响 |
|---------|---------|------------|
| 性能 | 首次 <30s，更新 <15s，启动 <1s | 浅克隆、懒加载依赖、避免不必要的 I/O |
| 安全 | npm 包零敏感信息、Token 仅内存 | 工具与知识完全解耦、认证信息生命周期管理 |
| 可靠性 | fail-fast、manifest 损坏降级、断链警告 | 每个管道阶段独立错误处理、防御性编程 |
| 兼容性 | macOS + Linux（MVP）、Node ≥18、Git ≥2.20 | path.join() 统一路径、os.homedir()、平台能力检测 |
| 用户体验 | 三段式错误、dry-run 一致性、非 TTY 降级 | 输出层抽象、渲染策略模式 |

### Scale & Complexity

- **主要技术域：** CLI / 开发者工具
- **复杂度等级：** 中等
- **预估架构组件数：** 8-10 个核心模块
- **技术栈：** Node.js ESM + commander.js + simple-git + ora + chalk
- **运行形态：** npx 零安装分发，单进程同步执行
- **目标用户规模：** 公司内部 ~100 人（MVP），未来开源

### Technical Constraints & Dependencies

**硬约束：**

1. **npx 分发** — 包体积需控制，依赖需精简，不能有 native addon
2. **零敏感信息** — npm 包源码不含任何公司域名、仓库 URL、Token
3. **Git 依赖** — 依赖用户本地 Git（≥2.20），不内嵌 Git 实现
4. **单人开发** — 架构需简洁可维护，避免过度抽象
5. **Node.js ESM** — 纯 ESM 模块，不支持 CommonJS

**外部依赖风险：**

| 依赖 | 用途 | 风险 | 缓解 |
|------|------|------|------|
| simple-git | Git 操作 | API 变更、性能 | 薄封装层隔离 |
| commander.js | CLI 参数解析 | 低风险，成熟稳定 | — |
| ora | spinner 动画 | ESM 兼容性 | 版本锁定 |
| chalk | 彩色输出 | ESM 兼容性（v5+纯ESM） | 版本锁定 |

<!-- APPEND_MARKER_2 -->

### Cross-Cutting Concerns

**贯穿所有模块的关注点：**

1. **错误处理策略** — 三段式提示（什么坏了/为什么/怎么修）需要统一的错误类型体系，区分"整体失败"（认证失败→停止）和"部分失败"（单文件权限错误→继续）
2. **Token 安全** — 认证、克隆、日志、错误输出所有环节都需脱敏，需要统一的 sanitize 工具函数
3. **输出格式抽象** — TTY（spinner+彩色）/ 非TTY（纯文本）/ quiet（精简）三种模式影响所有用户可见输出，需要统一的 Reporter 抽象
4. **跨平台路径** — 工具检测路径、安装目标路径、配置文件路径全部平台相关，需要统一的 PathResolver
5. **manifest 状态管理** — 安装、冲突检测、未来的更新和卸载全部依赖 manifest.json，需要原子读写和损坏降级

### Architecture Risks & Recommendations

**风险 1：管道阶段间的数据契约**

管道式架构的核心风险是阶段间数据传递的隐式耦合。建议为每个阶段定义明确的输入/输出 TypeScript 接口（如 `CloneResult`、`DetectResult`、`MatchResult`），让管道数据流可追踪、可测试。

**风险 2：安装规则的组合爆炸**

4 工具 × 4 资源类型 × 2 范围 × 3 安装类型 = 理论上 96 种组合。MVP 实际用到 16 条规则，但需要确保规则匹配引擎的设计能优雅处理规则增长（M2 新增工具、M3 自定义规则）。

**风险 3：符号链接的生命周期管理**

符号链接模式引入了"源仓库必须持续存在"的隐含依赖。需要在架构层面考虑：断链检测、源仓库被移动/删除时的用户提示、manifest 中记录链接源路径。

**风险 4：manifest.json 的并发安全**

MVP 单进程无并发问题，但 M2 的 CI/CD 场景可能出现多个 aiforge 实例同时写 manifest。建议 MVP 阶段就在 manifest 模块预留文件锁接口，即使不实现锁逻辑。

**风险 5：flatten 安装类型的语义损失**

flatten 模式（如 Cursor 的 skills → .cursor/rules/）将目录结构扁平化为单文件，可能丢失上下文信息。需要明确 flatten 的"主文件选择规则"和"文件重命名策略"。

<!-- APPEND_MARKER_3 -->

### Extensibility Considerations (User Supplemented)

> **MVP 边界声明：** 以下扩展方向是架构层面的前瞻性设计记录，用于指导接口预留和避免硬编码。MVP 实现只需遵循接口约定（如 SourceResolver、数据驱动注册表），不需要实现这些扩展能力本身。在 create-epics-and-stories 时，这些内容不应作为 MVP story，而应作为 M2+/P3 的 backlog 参考。

**扩展方向 1：知识源的多样性——不止 Git 仓库**

PRD 中"知识仓库"定义为遵循 aiforge 约定目录结构的 Git 仓库。但实际场景中，知识源不仅限于 Git：

- **系统本地目录**：如 Obsidian vault、本地文件夹等，无需 Git 克隆，直接从本地路径读取
- **其他版本控制系统**：SVN、Mercurial 等（低优先级但不应排除）
- **远程非 Git 源**：HTTP 归档、S3 存储等（远期可能）

**架构影响：** 管道的"仓库获取"阶段不应硬绑定 Git 操作，而应抽象为"知识源解析器"（SourceResolver）接口。MVP 只实现 GitSourceResolver，但接口设计需预留 LocalSourceResolver 等扩展点。克隆/更新逻辑应封装在 resolver 内部，管道只关心"获取到本地路径"这个结果。

**扩展方向 2：知识仓库目录结构的多样性——不硬编码 4 目录约定**

当前 aicoding-base 仓库采用 `agents/skills/instructions/mcp-tools` 四目录结构，但这只是一种参考实现。不同组织可能有完全不同的目录命名和组织方式（如 `our-agents/`、`team-skills/`、`prompts/` 等）。

**架构影响：** 安装引擎的规则匹配不应假设固定的源目录名。头脑风暴中已提出"双层自描述机制"（Layer 1 智能检测 + Layer 2 aiforge.json 显式声明），架构设计需确保：
- MVP 的内置规则表以"语义类型"（agent/skill/instruction/mcp-tool）为键，而非物理目录名
- 规则匹配引擎接受"语义类型 → 物理目录"的映射作为输入，映射来源可以是内置默认、智能检测或 aiforge.json
- 未来新增语义类型（如 workflow、template）不需要改引擎代码

**扩展方向 3：AI 工具生态的快速演变——适配层需高度可配置**

各 AI 编程 IDE 工具（Claude Code、Copilot、Cursor、VS Code、Windsurf、Trae、Codex CLI、Gemini CLI、Augment、Kiro、OpenCode、iFlow 等）对资源概念的定义和目录组织存在显著差异：

- **概念映射不一致**：Claude 的 skills 对应 Cursor 的 rules（flatten 模式）、Windsurf 的 skills、Codex 的 .agents/skills 等
- **目录路径不统一**：同一概念在不同工具中的全局/项目路径完全不同
- **能力边界不同**：有些工具有 hooks/plugins 概念，有些没有；有些用目录驱动，有些用设置页驱动
- **生态快速变化**：工具版本更新可能改变目录约定（如 Claude Code 的 commands 已并入 skills）

**架构影响：** 安装规则映射表是 aiforge 的核心数据资产，需要设计为：
- **高度数据化**：规则表是纯数据（JSON/YAML），不是代码逻辑
- **版本化管理**：规则表变更可独立于引擎代码发布
- **工具检测可配置**：每个工具的检测逻辑（标志性文件/目录）也应数据化，而非硬编码
- **统一抽象层**：参考 `docs/AI Coding IDE 工具统一路径映射矩阵.md` 中提出的 8 个标准槽位（GUIDE_FILE、SKILLS_DIR、AGENTS_DIR、COMMANDS_DIR、WORKFLOWS_DIR、HOOKS_CONFIG、MCP_CONFIG、PLUGIN_BUNDLE），aiforge 的内部模型应基于类似的统一语义槽位，再通过适配层映射到各工具的具体路径

## Starter Template Evaluation

### Primary Technology Domain

CLI 工具（Node.js ESM）— aiforge 不适用 Web 框架脚手架，需要手动搭建 CLI 项目结构。

### Starter Options Considered

**方案 A：社区 CLI TypeScript Starter 模板**

如 cli-typescript-starter 等社区模板，提供 TypeScript + commander + 基础项目结构。
- 优点：快速起步
- 缺点：模板可能包含不需要的依赖、结构不匹配 aiforge 的管道架构、后续需要大量裁剪

**方案 B：手动搭建（选定）**

基于 PRD 已确定的技术栈，手动初始化项目。aiforge 的架构（管道式 + 语义适配层）足够独特，社区模板反而会引入不必要的约束。

### Selected Starter: 手动搭建

**Rationale:**
1. PRD 已明确核心依赖（commander + simple-git + ora + chalk），不需要模板帮选
2. 管道式架构的项目结构需要定制，通用模板无法提供
3. 单人开发，搭建成本低，但裁剪模板的成本可能更高
4. 遵循 Node.js CLI Apps Best Practices

<!-- STARTER_APPEND_1 -->

### Architectural Decisions Provided by Starter

**Language & Runtime: TypeScript (ESM)**

- TypeScript 提供管道阶段间数据契约的类型安全（PRD 已定义 `InstallRule` 等接口）
- 纯 ESM 模块（`"type": "module"`），不支持 CommonJS
- 构建工具：tsup（基于 esbuild，零配置打包 TS → ESM）
- 开发运行：tsx（直接运行 TypeScript，无需编译步骤）

**Linting / Formatting: ESLint + Prettier**

- ESLint：代码质量检查，配合 typescript-eslint 插件
- Prettier：代码格式化，统一风格
- 行业标准组合，生态成熟，插件丰富

**Testing Framework: Vitest**

- 2026 年 ESM 项目的标准测试框架
- 原生 ESM 支持，无需额外配置
- Jest 兼容 API，学习成本低
- 原生 TypeScript 集成

**Build Tooling: tsup**

- 基于 esbuild，零配置打包 TypeScript
- 输出纯 ESM（aiforge 不需要 CJS 兼容）
- 生成 `dist/` 目录，`package.json` 的 `bin` 指向编译产物

**Core Dependencies (Current Stable):**

| 依赖 | 版本 | 用途 |
|------|------|------|
| commander | latest stable | CLI 参数解析 |
| simple-git | ~3.32.x | Git 操作 |
| ora | v8+ (ESM) | spinner 动画 |
| chalk | v5+ (ESM) | 彩色输出 |
| tsup | latest | TypeScript 构建 |
| tsx | latest | 开发时 TS 直接运行 |
| vitest | latest | 测试框架 |
| eslint | latest | 代码检查 |
| prettier | latest | 代码格式化 |
| typescript-eslint | latest | TS ESLint 插件 |
| @inquirer/prompts | latest | 交互式 CLI 引导（aiforge init） |

<!-- STARTER_APPEND_2 -->

**Code Organization:**

```
aiforge/
├── src/
│   ├── index.ts              # CLI 入口（commander 定义）
│   ├── pipeline.ts           # 管道编排器
│   ├── stages/               # 管道阶段（按执行顺序）
│   │   ├── resolve-source.ts # 知识源解析（Git/本地）
│   │   ├── authenticate.ts   # 四层认证解析
│   │   ├── clone.ts          # 克隆/更新
│   │   ├── detect-tools.ts   # AI 工具检测
│   │   ├── match-rules.ts    # 规则匹配引擎
│   │   ├── execute-install.ts# 执行安装（复制/符号链接/flatten）
│   │   └── report.ts         # 结果汇总
│   ├── core/                 # 核心抽象
│   │   ├── types.ts          # 管道数据契约（TypeScript 接口）
│   │   ├── errors.ts         # 统一错误类型体系
│   │   ├── reporter.ts       # 输出抽象（TTY/非TTY/quiet）
│   │   └── path-resolver.ts  # 跨平台路径解析
│   ├── data/                 # 数据化配置
│   │   ├── install-rules.ts  # 安装规则映射表
│   │   ├── tool-registry.ts  # 工具检测规则
│   │   └── excludes.ts       # 全局排除列表
│   └── services/             # 外部服务封装
│       ├── git.ts            # simple-git 薄封装
│       ├── config.ts         # config.json 读写
│       └── manifest.ts       # manifest.json 状态管理
├── tests/                    # 测试
├── .eslintrc.cjs             # ESLint 配置
├── .prettierrc               # Prettier 配置
├── tsconfig.json             # TypeScript 配置
├── tsup.config.ts            # 构建配置
├── vitest.config.ts          # 测试配置
├── package.json
└── README.md
```

**Initialization Command:**

```bash
mkdir aiforge && cd aiforge
npm init -y
npm install commander simple-git ora chalk @inquirer/prompts
npm install -D typescript tsup tsx vitest eslint prettier typescript-eslint @types/node
npx tsc --init
```

**Note:** 项目初始化应作为第一个实施 Story。

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
| D4a | 错误类型 | 单一 AiforgeError + severity | fatal/partial 区分，三段式内嵌 |
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
  mode: 'copy' | 'symlink';
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
  severity: 'fatal' | 'partial'; // fatal=停止管道, partial=继续
  why: string;                 // 为什么（简短原因）
  fix: string[];               // 怎么修（可复制的命令列表）
}
```

- 管道编排器：`fatal` → 立即停止并报告；`partial` → 收集错误继续执行
- Reporter 渲染三段式：`❌ ${message}` → `${why}` → `${fix.join('\n')}`

**输出抽象 — Reporter 接口 + 三种实现：**

```typescript
interface Reporter {
  startPhase(name: string): void;
  updatePhase(message: string): void;
  completePhase(): void;
  reportResult(results: InstallResult[]): void;
  reportError(error: AiforgeError): void;
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

这确保 `npx aiforge --dry-run 2>/dev/null` 只输出纯安装计划，可被 `grep`/`awk`/`jq` 解析。

#### D5: Tool Detection & Platform Abstraction

**工具检测 — 数据驱动注册表：**

```typescript
interface ToolDefinition {
  id: string;                  // 'copilot' | 'claude' | 'cursor' | 'vscode'
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

#### D6: Pipeline Orchestration

**类型安全的阶段链：**

```typescript
type ResolveStage   = (args: ParsedArgs) => Promise<ResolvedSource>;
type AuthStage      = (source: ResolvedSource) => Promise<AuthenticatedSource>;
type CloneStage     = (source: AuthenticatedSource) => Promise<LocalRepo>;
type DetectStage    = (repo: LocalRepo, args: ParsedArgs) => Promise<DetectedEnv>;
type MatchStage     = (env: DetectedEnv, args: ParsedArgs) => Promise<MatchedPlan>;
type InstallStage   = (plan: MatchedPlan) => Promise<InstallResult[]>;
type ReportStage    = (results: InstallResult[]) => void;
```

**ParsedArgs 贯穿说明：**

`ParsedArgs` 包含用户 CLI 输入（`--dirs`、`--tools`、`--force`、`--dry-run` 等），需要在多个阶段被访问：
- `ResolveStage`：读取 repo-url、`--clone-dir`、`--ssh`、`--token`
- `DetectStage`：读取 `--tools` 手动指定（FR-014）
- `MatchStage`：读取 `--dirs` 过滤源目录（FR-024），只匹配用户指定的资源类型
- 管道编排器：读取 `--dry-run`、`--quiet`、`--force` 控制流程分叉和 Reporter 选择

`ParsedArgs` 不通过阶段链逐级传递，而是由管道编排器持有，按需注入到需要的阶段。

**dry-run 管道分叉：**

```
正常模式: Resolve → Auth → Clone → Detect → Match → Install → Report(results)
dry-run:  Resolve → Auth → Clone → Detect → Match → Report(plan)
```

- 管道编排器根据 `dryRun` 标志决定是否执行 Install 阶段
- dry-run 与正常模式共享 Resolve~Match 全部阶段，架构保证预览一致性

**预检查(preflight)设计决策：**

PRD 执行流程中"预检查"（目标路径可写性、权限验证，FR-030）不作为独立管道阶段，而是作为 Install 阶段的第一步执行。理由：
1. 预检查的输入数据（MatchedPlan 中的目标路径列表）与 Install 阶段完全相同，拆分为独立阶段会引入冗余的类型定义
2. 预检查失败时的行为（抛出 `severity: 'fatal'` 的 AiforgeError）与 Install 阶段的错误处理一致，无需独立的错误流
3. 保持管道阶段数最小化，降低编排器复杂度

实现要求：`execute-install.ts` 必须在执行任何文件操作前，先对 MatchedPlan 中所有目标路径执行预检查（可写性 + 权限），全部通过后才开始实际安装。预检查失败应立即 fail-fast。

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

## Implementation Patterns & Consistency Rules

### Potential Conflict Points

AI agent 可能做出不同选择的 6 个关键领域：代码命名、模块组织、数据格式、错误处理、CLI 输出、测试策略。

### Naming Patterns

**文件命名：** kebab-case

```
✅ resolve-source.ts, detect-tools.ts, install-rules.ts
❌ resolveSource.ts, DetectTools.ts, installRules.ts
```

**TypeScript 命名：**

- 接口/类型：PascalCase，不加 `I` 前缀（`SourceResolver` 而非 `ISourceResolver`）
- 函数/变量：camelCase（`loadRules()`、`ruleIndex`）
- 常量：UPPER_SNAKE_CASE（`BUILTIN_RULES`、`DEFAULT_EXCLUDES`）
- 枚举值：PascalCase（`InstallType.Files`、`Severity.Fatal`）

**导出模式：** 命名导出，不用默认导出

```typescript
✅ export function loadRules(): InstallRule[] { ... }
✅ export class AiforgeError extends Error { ... }
❌ export default function loadRules() { ... }
```

### Structure Patterns

**测试组织：** `tests/` 镜像 `src/` 结构

```
src/stages/clone.ts       → tests/stages/clone.test.ts
src/core/errors.ts        → tests/core/errors.test.ts
src/services/manifest.ts  → tests/services/manifest.test.ts
```

**模块导出：** 每个目录可选 `index.ts` 作为公共 API 入口

```typescript
// src/core/index.ts — 只导出公共接口
export { AiforgeError } from './errors.js';
export { type Reporter } from './reporter.js';
export { type PathResolver } from './path-resolver.js';
export type { ResolvedSource, InstallResult, MatchedPlan } from './types.js';
```

**ESM 导入路径：** 必须带 `.js` 扩展名

```typescript
✅ import { loadRules } from './data/install-rules.js';
❌ import { loadRules } from './data/install-rules';
```

<!-- PATTERNS_APPEND_1 -->

### Data Format Patterns

**JSON 文件字段命名：** camelCase（与 TypeScript 接口一致）

```json
✅ { "defaultRepo": "...", "cloneDir": "...", "preferSSH": true }
❌ { "default_repo": "...", "clone_dir": "...", "prefer_ssh": true }
```

**日期格式：** ISO 8601 字符串

```typescript
✅ installedAt: "2026-03-12T10:30:00Z"
❌ installedAt: 1741776600
```

### Error Handling Patterns

**何时抛 AiforgeError：**

- 管道阶段内部遇到可预期的业务错误 → 抛 `AiforgeError`
- 不可预期的系统错误（如 fs 权限）→ 包装为 `AiforgeError` 后抛出
- 绝不吞掉错误或返回 null 代替错误

**错误创建模式：**

```typescript
✅ throw new AiforgeError({
     code: 'AUTH_FAILED',
     exitCode: 2,
     severity: 'fatal',
     message: '无法访问仓库',
     why: 'Git 服务器返回 401（认证失败）',
     fix: ['npx aiforge --ssh', 'npx aiforge --token <your-token>']
   });
❌ throw new Error('auth failed');
```

### CLI Output Patterns

**进度阶段命名：** 动词 + 宾语，中文

```
✅ "解析仓库地址..." / "验证认证信息..." / "克隆仓库..."
❌ "Resolving..." / "Step 1..." / "正在处理中..."
```

**结果状态图标：**

```
✅ 新建成功    🔄 更新    ⏭️ 跳过（已是最新）    ❌ 失败
```

**统计行格式：**

```
安装: 7 项  更新: 1 项  跳过: 1 项  失败: 0 项
```

<!-- PATTERNS_APPEND_2 -->

### Testing Patterns

**测试命名：** `describe` 用模块名，`it` 用行为描述

```typescript
describe('authenticate', () => {
  it('should prefer CLI token over env variable', () => { ... });
  it('should fallback to system credentials when no config', () => { ... });
});
```

**Mock 策略：**

- 外部依赖（simple-git、fs）→ 使用 vitest mock
- 内部模块 → 优先用真实实现，只在必要时 mock
- PathResolver → 测试时注入 mock 实现（固定路径）

**测试分层：**

- 单元测试：每个管道阶段独立测试，mock 外部依赖
- 集成测试：管道端到端测试，使用临时目录和 fixture 仓库

### Enforcement Guidelines

**所有 AI Agent 必须遵守：**

1. 文件命名 kebab-case，TypeScript 命名遵循上述约定
2. 所有错误必须通过 AiforgeError 抛出，包含三段式信息
3. 所有用户可见输出必须通过 Reporter 接口，不直接 console.log
4. JSON 文件字段一律 camelCase
5. ESM 导入路径必须带 `.js` 扩展名
6. 命名导出，不用默认导出

## Project Structure & Boundaries

### Complete Project Directory Structure

```
aiforge/
├── package.json                    # npm 包配置 + bin 入口
├── tsconfig.json                   # TypeScript 配置
├── tsup.config.ts                  # 构建配置（ESM 输出）
├── vitest.config.ts                # 测试配置
├── .eslintrc.cjs                   # ESLint 配置
├── .prettierrc                     # Prettier 配置
├── .gitignore
├── .npmignore                      # npm 发布排除（tests/、src/、.eslintrc 等）
├── README.md
├── LICENSE
│
├── src/
│   ├── index.ts                    # CLI 入口：commander 定义、参数解析、管道启动
│   ├── pipeline.ts                 # 管道编排器：阶段串联、dry-run 分叉、错误收集
│   │
│   ├── stages/                     # 管道阶段（按执行顺序）
│   │   ├── resolve-source.ts       # 阶段 1：知识源解析（SourceResolver 调度）
│   │   ├── authenticate.ts         # 阶段 2：四层认证解析链
│   │   ├── clone.ts                # 阶段 3：Git 克隆/更新
│   │   ├── detect-tools.ts         # 阶段 4：AI 工具自动检测
│   │   ├── match-rules.ts          # 阶段 5：规则匹配（Map 索引查找）
│   │   ├── execute-install.ts      # 阶段 6：执行安装（复制/符号链接/flatten）
│   │   └── report.ts              # 阶段 7：结果汇总（委托 Reporter）
│   │
│   ├── core/                       # 核心抽象（被所有模块依赖）
│   │   ├── types.ts                # 管道数据契约：所有阶段的输入/输出接口
│   │   ├── errors.ts               # AiforgeError 类（code + severity + 三段式）
│   │   ├── sanitize.ts             # Token 脱敏工具函数（sanitizeToken 等）
│   │   ├── reporter.ts             # Reporter 接口 + TtyReporter/PlainReporter/QuietReporter
│   │   └── path-resolver.ts        # PathResolver 接口 + UnixPathResolver（MVP）
│   │
│   ├── data/                       # 数据化配置（纯数据，无逻辑）
│   │   ├── install-rules.ts        # BUILTIN_RULES 常量 + RuleLoader 函数
│   │   ├── tool-registry.ts        # TOOL_DEFINITIONS 常量（检测注册表）
│   │   ├── excludes.ts             # DEFAULT_EXCLUDES 常量
│   │   └── messages.ts             # 输出字符串集中管理（MVP 中文，M2 扩展多语言）
│   │
│   ├── services/                   # 外部服务封装（有副作用的 I/O 操作）
│   │   ├── git.ts                  # GitSourceResolver（simple-git 薄封装）
│   │   ├── config.ts               # config.json 读写（~/.aiforge/config.json）
│   │   ├── manifest.ts             # manifest.json 状态管理（原子写入）
│   │   └── fs-utils.ts             # 文件操作工具（复制、符号链接、备份、权限）
│   │
│   └── commands/                   # 子命令（非管道流程）
│       └── init.ts                 # aiforge init 交互式配置
│
├── tests/
│   ├── stages/                     # 管道阶段单元测试
│   │   ├── resolve-source.test.ts
│   │   ├── authenticate.test.ts
│   │   ├── clone.test.ts
│   │   ├── detect-tools.test.ts
│   │   ├── match-rules.test.ts
│   │   ├── execute-install.test.ts
│   │   └── report.test.ts
│   ├── core/                       # 核心模块单元测试
│   │   ├── errors.test.ts
│   │   ├── reporter.test.ts
│   │   └── path-resolver.test.ts
│   ├── services/                   # 服务层单元测试
│   │   ├── git.test.ts
│   │   ├── config.test.ts
│   │   ├── manifest.test.ts
│   │   └── fs-utils.test.ts
│   ├── integration/                # 集成测试
│   │   └── pipeline.test.ts        # 管道端到端测试
│   └── fixtures/                   # 测试 fixtures
│       ├── sample-repo/            # 模拟知识仓库结构
│       ├── config-samples/         # 各种 config.json 样本
│       └── manifest-samples/       # 各种 manifest.json 样本
│
└── dist/                           # 构建输出（tsup 生成，git 忽略）
    └── index.js                    # 编译后的 ESM 入口
```

<!-- STRUCTURE_APPEND_1 -->

### Requirements to Structure Mapping

| FR 领域 | 主要文件 | 辅助文件 |
|---------|---------|---------|
| 仓库获取 FR-001~005 | `stages/resolve-source.ts`, `stages/clone.ts` | `services/git.ts` |
| 认证 FR-006~012 | `stages/authenticate.ts` | `services/config.ts`, `core/errors.ts` |
| 工具检测 FR-013~015 | `stages/detect-tools.ts` | `data/tool-registry.ts`, `core/path-resolver.ts` |
| 安装引擎 FR-016~024 | `stages/match-rules.ts`, `stages/execute-install.ts` | `data/install-rules.ts`, `services/fs-utils.ts` |
| 冲突处理 FR-025~032 | `stages/execute-install.ts` | `services/manifest.ts`, `services/fs-utils.ts` |
| 用户交互 FR-033~039 | `commands/init.ts`, `stages/report.ts` | `core/reporter.ts`, `core/errors.ts` |
| 配置管理 FR-040~042 | `services/config.ts` | `commands/init.ts` |
| 可扩展性 FR-043~046 | `data/install-rules.ts`, `data/tool-registry.ts` | `data/excludes.ts` |

### Architectural Boundaries

**模块依赖规则：**

```
index.ts ──→ pipeline.ts ──→ stages/* ──→ services/*
                                │              │
                                └──→ core/*  ←─┘
                                       │
                                  data/* (纯数据)
```

- `core/` 不依赖任何其他 src 目录（零依赖，被所有模块引用）
- `data/` 不依赖任何其他 src 目录（纯数据常量）
- `stages/` 可依赖 `core/`、`data/`、`services/`
- `services/` 只依赖 `core/`（不依赖 stages 或 data）
- `commands/` 可依赖 `core/`、`services/`
- `pipeline.ts` 编排 `stages/`，依赖 `core/`
- `index.ts` 只依赖 `pipeline.ts` 和 `commands/`

### Data Flow

```
CLI args (index.ts)
  → ParsedArgs
    → ResolvedSource (resolve-source)
      → AuthenticatedSource (authenticate)
        → LocalRepo (clone)
          → DetectedEnv (detect-tools)
            → MatchedPlan (match-rules)
              ├─ [dry-run] → Reporter.reportPlan()
              └─ [normal] → InstallResult[] (execute-install)
                           → Reporter.reportResult()
```

### External Integration Points

| 集成 | 模块 | 协议 |
|------|------|------|
| Git 服务器 | `services/git.ts` | HTTPS / SSH（simple-git） |
| 文件系统 | `services/fs-utils.ts`, `services/manifest.ts` | Node.js fs API |
| 用户配置 | `services/config.ts` | JSON 文件读写（~/.aiforge/） |
| 终端 | `core/reporter.ts` | stdout/stderr（ora + chalk） |

## Architecture Validation Results

### Coherence Validation ✅

**决策兼容性：** 通过
- TypeScript ESM + tsup + commander + simple-git + ora + chalk + @inquirer/prompts — 全部支持 ESM，版本兼容
- 管道式架构 + 类型安全阶段链 + Reporter 接口 — 设计一致
- SourceResolver + 数据驱动注册表 + Map 索引规则 — 统一的"配置驱动"理念
- AiforgeError(severity) + Reporter(三种实现) — 错误处理与输出策略对齐

**模式一致性：** 通过
- kebab-case 文件名 + PascalCase 接口 + camelCase 函数 — 无冲突
- 命名导出 + ESM .js 扩展名 — 与 TypeScript ESM 配置一致
- tests/ 镜像 src/ — 与项目结构对齐

**结构对齐：** 通过
- 模块依赖方向清晰（core ← stages/services ← pipeline ← index），无循环依赖
- data/ 纯数据层与 services/ I/O 层分离合理

### Requirements Coverage Validation ✅

**功能需求（46 条 FR）：** 全部覆盖

| FR 领域 | 状态 | 架构支撑 |
|---------|------|---------|
| 仓库获取 FR-001~005 | ✅ | resolve-source + clone + git service |
| 认证 FR-006~012 | ✅ | authenticate + config service + sanitize |
| 工具检测 FR-013~015 | ✅ | detect-tools + tool-registry + PathResolver |
| 安装引擎 FR-016~024 | ✅ | match-rules + execute-install + install-rules |
| 冲突处理 FR-025~032 | ✅ | execute-install + manifest service + fs-utils |
| 用户交互 FR-033~039 | ✅ | init command(@inquirer/prompts) + Reporter + errors |
| 配置管理 FR-040~042 | ✅ | config service |
| 可扩展性 FR-043~046 | ✅ | install-rules + tool-registry + excludes + messages |

**非功能需求（32 条 NFR）：** 全部覆盖

| NFR 类别 | 状态 | 架构支撑 |
|---------|------|---------|
| 性能 NFR-P1~P5 | ✅ | 浅克隆、管道式顺序执行、懒加载 |
| 安全 NFR-S1~S6 | ✅ | 零信任架构、Token 内存隔离、sanitize.ts 脱敏 |
| 可靠性 NFR-R1~R6 | ✅ | fail-fast(severity:fatal)、manifest 原子写入+降级 |
| 兼容性 NFR-C1~C6 | ✅ | PathResolver、ESM、Node≥18 |
| 集成 NFR-I1~I4 | ✅ | GitSourceResolver(HTTPS/SSH)、数据驱动检测 |
| 用户体验 NFR-U1~U5 | ✅ | Reporter 三种实现、三段式错误、dry-run 分叉、messages.ts |

<!-- VALIDATION_APPEND_1 -->

### Implementation Readiness Validation ✅

**决策完整性：** 通过 — 11 项关键决策全部含接口定义和代码示例
**结构完整性：** 通过 — 完整目录树含每个文件的职责注释
**模式完整性：** 通过 — 6 条强制执行规则覆盖命名/结构/错误/输出/测试

### Gap Analysis Results

**已修复的缺口：**

1. ✅ 补充 `@inquirer/prompts` 到依赖列表和初始化命令（FR-033 交互式引导）
2. ✅ 增加 `core/sanitize.ts`（NFR-S3 Token 脱敏工具函数）
3. ✅ 增加 `data/messages.ts`（FR-046 输出字符串集中管理，MVP 中文）

**无剩余 Critical 或 Important 缺口。**

### Architecture Completeness Checklist

**✅ 需求分析**
- [x] 项目上下文深入分析（46 FR + 32 NFR + 7 用户旅程）
- [x] 规模与复杂度评估（中等复杂度 CLI 工具）
- [x] 技术约束识别（npx 分发、零敏感信息、Git 依赖、单人开发、ESM）
- [x] 跨切面关注点映射（错误处理、Token 安全、输出格式、跨平台路径、manifest 状态）
- [x] 扩展性方向记录（知识源多样性、目录结构多样性、工具生态适配）

**✅ 架构决策**
- [x] 11 项关键决策已记录（含接口定义和代码示例）
- [x] 6 项延迟决策已记录（含理由和计划阶段）
- [x] 技术栈完整指定（含版本）
- [x] 实施顺序和依赖关系已定义

**✅ 实现模式**
- [x] 命名约定已建立（文件/TypeScript/导出/JSON/日期）
- [x] 结构模式已定义（测试组织/模块导出/ESM 导入）
- [x] 错误处理模式已规范（AiforgeError 创建模式）
- [x] CLI 输出模式已规范（进度命名/状态图标/统计格式）
- [x] 测试模式已规范（命名/Mock 策略/分层）
- [x] 6 条强制执行规则

**✅ 项目结构**
- [x] 完整目录树（含每个文件的职责注释）
- [x] 模块边界规则（依赖方向图）
- [x] 数据流图（管道阶段链 + dry-run 分叉）
- [x] 需求到文件的映射表（8 个 FR 领域 → 具体文件）
- [x] 外部集成点（Git/文件系统/配置/终端）

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** 高

**Key Strengths:**
- 管道式架构清晰，阶段间类型安全，编译时捕获数据流错误
- 配置驱动的可扩展性，新增工具/规则只改数据不改引擎
- 零信任安全模型，架构层面保证 Token 安全
- dry-run 一致性由架构保证（管道分叉），而非代码纪律
- 模块边界清晰，依赖方向单一，无循环依赖
- SourceResolver 接口为未来本地知识源扩展预留了口子

**Areas for Future Enhancement:**
- M2：Windows PathResolver、manifest 文件锁、外部规则加载
- M3：aiforge.json 自定义规则、LocalSourceResolver
- P3：语义类型系统、规则包生态系统

### Implementation Handoff

**AI Agent Guidelines:**
- 遵循所有架构决策，特别是管道阶段链的类型契约
- 使用实现模式中的 6 条强制规则
- 尊重模块边界（core 零依赖、data 纯数据、services 只依赖 core）
- 所有错误通过 AiforgeError 抛出，所有输出通过 Reporter 接口

**First Implementation Priority:**
项目初始化（npm init + 依赖安装 + TypeScript/tsup/vitest/eslint 配置 + 目录结构创建）

## Architecture Completion Summary

### Workflow Completion

**Architecture Decision Workflow:** COMPLETED ✅
**Total Steps Completed:** 8
**Date Completed:** 2026-03-12
**Document Location:** `_bmad-output/planning-artifacts/architecture.md`

### Final Architecture Deliverables

**Complete Architecture Document:**
- 11 项关键架构决策（含接口定义和代码示例）
- 6 项延迟决策（含理由和计划阶段）
- 6 条实现模式强制规则
- 完整项目目录结构（含每个文件的职责注释）
- 46 条 FR + 32 条 NFR 全部覆盖验证
- 模块边界规则 + 数据流图 + 需求映射表

### Implementation Handoff

**For AI Agents:**
本架构文档是实现 ai-forge 的完整指南。遵循所有决策、模式和结构。

**Development Sequence:**
1. 项目初始化（npm init + 依赖安装 + 工具链配置 + 目录结构）
2. 实现 core/ 基础设施（types + errors + sanitize + reporter + path-resolver）
3. 实现 data/ 数据层（install-rules + tool-registry + excludes + messages）
4. 实现 services/ 服务层（git + config + manifest + fs-utils）
5. 实现 stages/ 管道阶段（按执行顺序逐个实现）
6. 实现 pipeline.ts 管道编排器（串联阶段 + dry-run 分叉）
7. 实现 commands/init.ts 交互式配置
8. 实现 index.ts CLI 入口

**Document Maintenance:** 实施过程中如有重大技术决策变更，应同步更新本架构文档。

---

**Architecture Status:** READY FOR IMPLEMENTATION ✅
