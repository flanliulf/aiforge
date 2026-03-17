---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
---

# ai-forge - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for ai-forge, decomposing the requirements from the PRD and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

**仓库获取（FR-001~005）：**
- FR-001: 用户可以通过提供 Git 仓库 URL 获取知识仓库内容
- FR-002: 用户可以通过配置文件中的默认仓库地址免输入获取知识仓库
- FR-003: 系统在首次获取知识仓库时应最小化网络传输量，仅获取最新版本内容（不含完整历史）
- FR-004: 系统在检测到已有本地仓库副本时应优先执行增量更新，而非全量重新获取
- FR-005: 系统可以将持久化仓库克隆到固定位置（`~/.aiforge/repos/`），不使用临时目录

**认证（FR-006~012）：**
- FR-006: 用户可以通过 SSH Key 认证访问私有仓库
- FR-007: 用户可以通过 Personal Access Token 认证访问私有仓库
- FR-008: 用户可以通过环境变量（`AIFORGE_TOKEN`/`GITLAB_TOKEN`）提供认证凭据
- FR-009: 系统可以在无显式认证时降级到系统 Git 凭据管理器
- FR-010: 系统按优先级链解析认证方式（CLI 参数 > 环境变量 > 配置文件 > 系统凭据）
- FR-011: 系统在认证失败时提供可操作的修复建议（含多种替代方案和可复制的命令）
- FR-012: 系统在日志和错误输出中对 Token 进行脱敏处理

**工具检测（FR-013~015）：**
- FR-013: 系统可以自动扫描用户环境中已安装的 AI 编码工具（Copilot、Claude、Cursor、VS Code）
- FR-014: 用户可以通过 `--tools` 参数手动指定目标工具，覆盖自动检测
- FR-015: 系统在未检测到任何工具时触发诊断输出

**安装引擎（FR-016~024）：**
- FR-016: 用户可以将知识仓库资源安装到全局目录（`-g`）
- FR-017: 用户可以将知识仓库资源安装到当前项目目录（默认）
- FR-018: 系统支持四类资源的安装：agents、skills、instructions、mcp-tools
- FR-019: 系统支持复制模式（默认）
- FR-020: 系统支持符号链接模式（`-l`，仅全局安装）
- FR-021: 系统在项目级安装时禁用符号链接模式
- FR-022: 系统支持 flatten 安装类型
- FR-023: 系统根据内置安装规则映射表将资源安装到正确目标路径
- FR-024: 用户可以通过 `--dirs` 参数过滤只安装特定类型的资源

**冲突处理与安全（FR-025~032）：**
- FR-025: 系统通过 `manifest.json` 追踪所有已安装文件的状态
- FR-026: 系统可以区分"aiforge 安装的文件"和"用户手写的文件"
- FR-027: 系统在检测到文件冲突时提供交互式处理选项（覆盖/跳过/备份/查看差异/中止）
- FR-028: 系统可以在覆盖前自动备份用户文件
- FR-029: 用户可以通过 `--force` 参数跳过冲突确认直接覆盖
- FR-030: 系统在安装前执行预检查（目标路径可写性、权限验证）
- FR-031: 系统在任何安装步骤失败时立即停止（fail-fast），并输出已完成的操作清单
- FR-032: 系统在安装结果为零项时触发零结果诊断模式

**用户交互与体验（FR-033~039）：**
- FR-033: 用户可以通过 `aiforge init` 完成交互式首次配置（仓库 URL、认证方式、连接验证）
- FR-034: 用户可以通过 `--dry-run` 预览安装计划而不写入任何文件
- FR-035: 系统在安装过程中展示阶段式进度（spinner + 实时状态更新）
- FR-036: 系统在安装完成后展示按工具分组的树形结果汇总（含统计数字）
- FR-037: 系统在错误发生时展示三段式提示（什么坏了 / 为什么 / 怎么修）
- FR-038: 系统在 TTY 终端展示彩色输出，在非 TTY 环境自动降级为纯文本
- FR-039: 用户可以通过 `--quiet` 参数获取精简输出

**配置管理（FR-040~042）：**
- FR-040: 系统支持通过 `~/.aiforge/config.json` 持久化用户配置
- FR-041: 系统在首次运行且无配置时引导用户完成配置
- FR-042: 系统支持配置文件中按 Git host 存储不同的认证信息

**可扩展性与国际化（FR-043~046）：**
- FR-043: 平台维护者可以通过修改安装规则配置新增 AI 工具支持，无需修改引擎代码
- FR-044: 系统的安装规则映射表支持 files、directories、flatten 三种安装类型
- FR-045: 系统支持全局排除文件列表（README.md、.gitkeep、.DS_Store 等）
- FR-046: 用户可以在初始化时选择交互语言，并在安装后通过配置修改语言设置

### NonFunctional Requirements

**性能（NFR-P1~P5）：**
- NFR-P1: 首次克隆 + 安装耗时 < 30 秒
- NFR-P2: 持久化仓库更新 + 安装耗时 < 15 秒
- NFR-P3: 无网络环境处理已有仓库 < 3 秒
- NFR-P4: CLI 启动到首次输出 < 1 秒
- NFR-P5: 工具检测扫描耗时 < 500 毫秒

**安全（NFR-S1~S6）：**
- NFR-S1: npm 包不含任何仓库 URL、Token、Host 名、公司名称
- NFR-S2: Token 注入 URL 仅存在于内存，克隆完成后立即清除
- NFR-S3: 所有日志和错误输出中 Token 显示为脱敏格式
- NFR-S4: 配置文件权限为 600（仅用户可读写）
- NFR-S5: 安装目标路径不超出预期范围（防路径遍历）
- NFR-S6: 临时目录在安装完成后立即删除

**可靠性（NFR-R1~R6）：**
- NFR-R1: 网络中断时不留残余文件
- NFR-R2: 目标目录不存在时自动创建
- NFR-R3: 安装步骤失败时 fail-fast
- NFR-R4: 部分安装失败时输出已完成操作清单
- NFR-R5: `manifest.json` 损坏或丢失时降级为"所有文件视为未知来源"
- NFR-R6: 符号链接目标不存在时输出明确警告

**兼容性（NFR-C1~C6）：**
- NFR-C1: macOS 完整支持（MVP）
- NFR-C2: Linux 完整支持（MVP）
- NFR-C3: Node.js >= 18.0.0
- NFR-C4: Git >= 2.20
- NFR-C5: 路径处理使用 `path.join()`，不硬编码分隔符
- NFR-C6: Home 目录使用 `os.homedir()`，不存在时报错

**集成（NFR-I1~I4）：**
- NFR-I1: 支持 HTTPS 和 SSH 两种 Git 协议
- NFR-I2: 支持 GitLab 和 GitHub 仓库
- NFR-I3: AI 工具检测基于标志性文件/目录，不依赖工具进程
- NFR-I4: 安装结果不影响 AI 工具的正常运行

**用户体验质量（NFR-U1~U5）：**
- NFR-U1: 默认中文，支持 `aiforge init` 选择语言，安装后可通过配置修改
- NFR-U2: 错误信息包含可操作的修复建议
- NFR-U3: 进度展示使用 spinner 动画（TTY 环境）
- NFR-U4: 非 TTY 环境自动禁用 spinner 和彩色
- NFR-U5: `--dry-run` 输出与实际安装结果一致

### Additional Requirements

**来自 Architecture 的技术需求：**

1. **项目初始化**：手动搭建（非社区模板），项目初始化应作为第一个实施 Story（npm init + 依赖安装 + TypeScript/tsup/vitest/eslint 配置 + 目录结构创建）
2. **管道式架构**：类型安全的阶段链 `Resolve → Auth → Clone → Detect → Match → [Install(含preflight)] → Report`，每个阶段有明确的输入/输出 TypeScript 接口
3. **SourceResolver 接口抽象**：MVP 只实现 `GitSourceResolver`，预留 `LocalSourceResolver` 扩展点
4. **规则存储**：TypeScript 常量（`BUILTIN_RULES`）+ 预留 `RuleLoader` 函数接口（M3 加载 aiforge.json）
5. **规则匹配**：`Map<string, InstallRule[]>` 索引，key 为 `${tool}:${scope}`，O(1) 查找
6. **config.json 结构**：按 host 分层认证，`preferSSH` 全局默认偏好
7. **manifest.json 写入策略**：内存累积 + 临时文件 + `fs.rename()` 原子替换；损坏时降级为空
8. **错误类型**：单一 `AiforgeError` 类，含 `code`/`exitCode`/`severity`(fatal|partial)/`why`/`fix[]`
9. **输出抽象**：`Reporter` 接口 + `TtyReporter`/`PlainReporter`/`QuietReporter` 三种实现
10. **stdout/stderr 分工**：结果和计划 → stdout（可被管道消费），进度和错误 → stderr
11. **工具检测**：数据驱动 `TOOL_DEFINITIONS` 注册表，新增工具只加数据
12. **PathResolver**：集中管理跨平台路径，MVP 实现 macOS + Linux
13. **ParsedArgs**：由管道编排器持有，按需注入到需要的阶段（非逐级传递）
14. **dry-run 实现**：管道在 Match 后分叉，架构保证预览一致性
15. **preflight 设计**：作为 Install 阶段第一步执行（非独立管道阶段）
16. **模块边界**：`core/` 零依赖、`data/` 纯数据、`services/` 只依赖 `core/`、`stages/` 可依赖 `core/`+`data/`+`services/`
17. **ESM 规范**：导入必须带 `.js` 扩展名，命名导出不用默认导出
18. **文件命名**：kebab-case；接口 PascalCase 无 `I` 前缀；常量 UPPER_SNAKE_CASE
19. **测试组织**：`tests/` 镜像 `src/` 结构，外部依赖 mock，内部模块优先真实实现
20. **安全规范**：所有日志/错误使用 `sanitizeToken()`，config.json 权限 `0o600`

### FR Coverage Map

| FR | Epic | 简述 |
|----|------|------|
| FR-001 | Epic 2 | Git URL 获取知识仓库 |
| FR-002 | Epic 2 | 默认仓库地址免输入 |
| FR-003 | Epic 2 | 浅克隆最小化传输 |
| FR-004 | Epic 2 | 增量更新已有仓库 |
| FR-005 | Epic 2 | 持久化克隆到固定位置 |
| FR-006 | Epic 2 | SSH Key 认证 |
| FR-007 | Epic 2 | Token 认证 |
| FR-008 | Epic 2 | 环境变量认证 |
| FR-009 | Epic 2 | 降级到系统凭据 |
| FR-010 | Epic 2 | 四层认证优先级链 |
| FR-011 | Epic 2 | 认证失败修复建议 |
| FR-012 | Epic 2 | Token 脱敏 |
| FR-013 | Epic 3 | 自动扫描 AI 工具 |
| FR-014 | Epic 3 | --tools 手动指定 |
| FR-015 | Epic 3 | 零工具诊断输出 |
| FR-016 | Epic 4 | 全局安装（-g） |
| FR-017 | Epic 4 | 项目安装（默认） |
| FR-018 | Epic 4 | 四类资源安装 |
| FR-019 | Epic 4 | 复制模式 |
| FR-020 | Epic 4 | 符号链接模式 |
| FR-021 | Epic 4 | 项目级禁用符号链接 |
| FR-022 | Epic 4 | flatten 安装类型 |
| FR-023 | Epic 3 | 规则匹配引擎 |
| FR-024 | Epic 3 | --dirs 过滤 |
| FR-025 | Epic 4 | manifest.json 状态追踪 |
| FR-026 | Epic 4 | 区分安装文件与手写文件 |
| FR-027 | Epic 4 | 交互式冲突处理 |
| FR-028 | Epic 4 | 覆盖前自动备份 |
| FR-029 | Epic 4 | --force 跳过确认 |
| FR-030 | Epic 4 | 预检查（权限验证） |
| FR-031 | Epic 4 | fail-fast + 操作清单 |
| FR-032 | Epic 4 | 零结果诊断 |
| FR-033 | Epic 2 | aiforge init 交互式配置 |
| FR-034 | Epic 3 | --dry-run 预览 |
| FR-035 | Epic 5 | 阶段式进度展示 |
| FR-036 | Epic 5 | 树形结果汇总 |
| FR-037 | Epic 5 | 三段式错误提示 |
| FR-038 | Epic 5 | TTY/非TTY 自适应 |
| FR-039 | Epic 5 | --quiet 精简输出 |
| FR-040 | Epic 2 | config.json 持久化 |
| FR-041 | Epic 2 | 首次运行引导 |
| FR-042 | Epic 2 | 按 host 存储认证 |
| FR-043 | Epic 3 | 配置驱动新增工具 |
| FR-044 | Epic 3 | 三种安装类型规则 |
| FR-045 | Epic 3 | 全局排除文件列表 |
| FR-046 | Epic 5 | 国际化语言选择 |

## Epic List

### Epic 1: 项目基础设施与核心框架（Foundation Sprint）

> **Sprint 性质说明：** 本 Epic 为技术基础设施准备（Foundation Sprint），不直接交付用户可感知的功能价值，但为所有后续 Epic 提供必要的项目骨架和核心抽象。在 Sprint Planning 和进度汇报中应以"技术就绪"而非"用户价值交付"作为衡量标准。

项目可构建、可测试，`npx aiforge --help` 可运行，核心抽象（错误体系、输出层、路径解析）就绪。所有后续 Epic 依赖此基础。

**覆盖：** Architecture 需求 1~20（基础设施部分）
**关键交付：** 项目初始化 + `core/*` + `data/*` + CLI 骨架（commander）+ 管道编排器骨架
**NFRs：** NFR-P4, NFR-C3~C6, NFR-S1

### Epic 2: 知识仓库获取与认证

用户可以通过 `aiforge init` 配置认证，从私有 Git 仓库克隆知识内容。认证失败时获得友好的三段式修复建议。

**FRs 覆盖：** FR-001~012, FR-033, FR-040~042（共 17 条）
**关键交付：** `services/config.ts` + `stages/resolve-source.ts` + `services/git.ts` + `stages/authenticate.ts` + `stages/clone.ts` + `commands/init.ts`
**NFRs：** NFR-S2~S4, NFR-I1~I2, NFR-R1, NFR-P1~P3
**对应旅程：** 小李入职配置（旅程 2）、小李认证失败（旅程 6）

### Epic 3: 智能检测与安装规划

系统自动检测已安装的 AI 工具，生成安装计划。用户可以通过 `--dry-run` 预览"哪些文件会安装到哪里"，建立信任。

**FRs 覆盖：** FR-013~015, FR-023~024, FR-034, FR-043~045（共 9 条）
**关键交付：** `stages/detect-tools.ts` + `stages/match-rules.ts` + `stages/report.ts`（plan 模式）+ `pipeline.ts`（dry-run 分叉）
**NFRs：** NFR-P5, NFR-I3, NFR-U5
**对应旅程：** 小明首次安装的 dry-run 步骤（旅程 1）、chunxiao 维护验证（旅程 4）

### Epic 4: 安装执行与冲突保护

用户可以安全地将配置安装到所有检测到的工具中。支持复制/符号链接/flatten 三种模式，冲突时有备份保护，安装结果按工具分组展示。

**FRs 覆盖：** FR-016~022, FR-025~032（共 17 条）
**关键交付：** `stages/execute-install.ts`（含 preflight）+ `services/manifest.ts` + `services/fs-utils.ts` + `stages/report.ts`（result 模式）+ `pipeline.ts`（完整编排）
**NFRs：** NFR-R2~R6, NFR-S5~S6, NFR-I4
**对应旅程：** 小明首次安装（旅程 1）、小明冲突处理（旅程 3）、小明日常更新（旅程 5）

### Epic 5: 端到端体验与发布就绪

精致的终端交互体验——阶段式 spinner 进度、按工具分组的树形结果、TTY/非TTY 自适应、quiet 模式、国际化支持。端到端集成测试通过，达到 MVP Go/No-Go 门禁标准。

**FRs 覆盖：** FR-035~039, FR-046（共 7 条）
**关键交付：** Reporter 三种实现完善 + `data/messages.ts` 完善 + 端到端集成测试 + 跨平台验证
**NFRs：** NFR-U1~U5, NFR-C1~C2
**对应旅程：** 所有旅程的体验打磨，确保 MVP 发布就绪

---

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
**Then** 包含 PRD 定义的完整 MVP 规则映射表（14 条规则，覆盖 Copilot/Claude/Cursor/VS Code × 全局/项目）
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

## Epic 2: 知识仓库获取与认证

用户可以通过 `aiforge init` 配置认证，从私有 Git 仓库克隆知识内容。认证失败时获得友好的三段式修复建议。

### Story 2.1: 配置管理服务

As a 用户,
I want 系统持久化我的配置和认证信息,
So that 不需要每次运行都重新输入仓库地址和认证方式。

**Acceptance Criteria:**

**Given** `services/config.ts` 已创建
**When** 首次写入配置
**Then** 创建 `~/.aiforge/config.json`，文件权限为 `0o600`（NFR-S4）
**And** 目录 `~/.aiforge/` 不存在时自动创建

**Given** 配置文件已存在
**When** 读取配置
**Then** 正确解析 `AiforgeConfig` 结构：`defaultRepo`、`cloneDir`、`language`、`preferSSH`、`auth`（FR-040）

**Given** 用户配置了多个 Git host 的认证
**When** 读取特定 host 的认证信息
**Then** 返回该 host 对应的 `method` 和 `token`（FR-042）
**And** 不同 host 可以使用不同的认证方式

**Given** 配置文件损坏（非法 JSON）
**When** 读取配置
**Then** 抛出 `AiforgeError`，提示配置文件损坏并建议运行 `aiforge init` 重新配置

**Given** 配置文件不存在
**When** 用户运行主命令（非 init）
**Then** 提示用户先运行 `aiforge init` 完成配置（FR-041）

### Story 2.2: 知识源解析与 Git 服务封装

As a 用户,
I want 通过 Git URL 或默认配置指定知识仓库,
So that 系统知道从哪里获取 AI 编码配置内容。

**Acceptance Criteria:**

**Given** 用户提供了 Git 仓库 URL（如 `https://gitlab.com/org/repo.git`）
**When** 执行知识源解析
**Then** 正确解析出 hostname、仓库路径、协议类型（HTTPS/SSH）
**And** 返回 `ResolvedSource` 对象（FR-001）

**Given** 用户未提供 URL 但 `config.json` 中有 `defaultRepo`
**When** 执行知识源解析
**Then** 使用配置服务读取 `config.json` 中的默认仓库地址（FR-002）

**Given** 用户未提供 URL 且无默认配置
**When** 执行知识源解析
**Then** 抛出 `AiforgeError`（code: 'NO_REPO'，severity: 'fatal'），提示用户提供 URL 或运行 `aiforge init`

**Given** `services/git.ts` 已创建
**When** 检查 GitSourceResolver
**Then** 实现 `SourceResolver` 接口（`canHandle()`、`resolve()`）
**And** 对 simple-git 进行薄封装，隔离外部依赖

**Given** SSH 格式 URL（如 `git@gitlab.com:org/repo.git`）
**When** 执行知识源解析
**Then** 正确识别为 SSH 协议（NFR-I1）

### Story 2.3: 四层认证解析链

As a 用户,
I want 系统自动选择最合适的认证方式,
So that 无论在开发环境、CI 还是新电脑上都能顺利访问私有仓库。

**Acceptance Criteria:**

**Given** 用户通过 `--ssh` CLI 参数指定 SSH
**When** 执行认证解析
**Then** 使用 SSH Key 认证，忽略其他认证源（FR-006，优先级最高）

**Given** 用户通过 `--token <token>` CLI 参数提供 Token
**When** 执行认证解析
**Then** 使用提供的 Token 认证（FR-007，优先级最高）

**Given** 环境变量 `AIFORGE_TOKEN` 或 `GITLAB_TOKEN` 已设置
**When** 执行认证解析且无 CLI 参数
**Then** 使用环境变量中的 Token（FR-008，优先级第二）

**Given** 通过配置服务读取 `config.json` 中有对应 host 的认证配置
**When** 执行认证解析且无 CLI 参数和环境变量
**Then** 使用配置文件中的认证方式（FR-010，优先级第三）

**Given** 无任何显式认证配置
**When** 执行认证解析
**Then** 降级到系统 Git 凭据管理器（FR-009，优先级最低）

**Given** 认证过程中涉及 Token
**When** Token 出现在日志或错误输出中
**Then** 显示为脱敏格式 `glpat-ab****op`（FR-012，NFR-S3）

### Story 2.4: Git 克隆与增量更新

As a 用户,
I want 快速获取知识仓库内容到本地,
So that 首次克隆高效，后续更新只拉取变更。

**Acceptance Criteria:**

**Given** 本地无该仓库的副本
**When** 执行克隆
**Then** 使用浅克隆（`--depth 1`）最小化网络传输（FR-003）
**And** 克隆到持久化位置 `~/.aiforge/repos/{repo-name}/`（FR-005）

**Given** 本地已有该仓库的副本
**When** 执行获取
**Then** 执行 `git pull` 增量更新，而非全量重新克隆（FR-004）

**Given** 用户通过 `--clone-dir <path>` 指定自定义路径
**When** 执行克隆
**Then** 克隆到用户指定的路径

**Given** 克隆过程中网络中断
**When** 克隆失败
**Then** 清理不完整的克隆目录，不留残余文件（NFR-R1）
**And** 抛出 `AiforgeError`（severity: 'fatal'），包含网络错误的修复建议

**Given** Token 被注入到克隆 URL 中
**When** 克隆完成
**Then** Token 从内存中立即清除（NFR-S2）
**And** `.git/config` 中不包含 Token

**Given** 首次克隆 aicoding-base 规模的仓库
**When** 测量总耗时
**Then** < 30 秒（NFR-P1）

**Given** 已有本地仓库执行增量更新
**When** 测量总耗时
**Then** < 15 秒（NFR-P2）

### Story 2.5: aiforge init 交互式配置

As a 新用户,
I want 通过交互式引导完成首次配置,
So that 不需要手动编辑配置文件就能开始使用。

**Acceptance Criteria:**

**Given** 用户运行 `aiforge init`
**When** 交互式引导开始
**Then** 依次询问：默认仓库 URL、认证方式（SSH/Token）、连接验证（FR-033）

**Given** 用户选择 SSH 认证
**When** 执行连接验证
**Then** 尝试 SSH 连接到 Git 服务器
**And** 成功时显示确认信息
**And** 失败时显示三段式错误提示：什么坏了 → 为什么 → 怎么修（含 SSH Key 生成步骤和具体命令）（FR-011）

**Given** 用户选择 Token 认证
**When** 输入 Token 后执行连接验证
**Then** 验证 Token 有效性
**And** Token 存储到 `config.json` 的 `auth[host]` 中（按 host 分层）

**Given** 用户已有 `config.json`
**When** 再次运行 `aiforge init`
**Then** 显示当前配置，允许修改或保持不变

**Given** 非 TTY 环境
**When** 运行 `aiforge init`
**Then** 直接失败并提示需要交互式终端

---

## Epic 3: 智能检测与安装规划

系统自动检测已安装的 AI 工具，生成安装计划。用户可以通过 `--dry-run` 预览"哪些文件会安装到哪里"，建立信任。

### Story 3.1: AI 工具自动检测

As a 用户,
I want 系统自动识别我安装了哪些 AI 编码工具,
So that 不需要手动指定就能为所有工具安装配置。

**Acceptance Criteria:**

**Given** 用户环境中安装了 Copilot（存在 `~/.copilot/` 或 `.github/`）
**When** 执行工具检测
**Then** 检测到 copilot 工具，返回 `DetectedEnv` 包含该工具（FR-013）

**Given** 用户环境中安装了多个工具（Copilot + Claude + Cursor）
**When** 执行工具检测
**Then** 返回所有检测到的工具列表

**Given** 用户通过 `--tools copilot claude` 手动指定
**When** 执行工具检测
**Then** 跳过自动扫描，直接使用用户指定的工具列表（FR-014）
**And** 指定的工具 ID 在 `TOOL_DEFINITIONS` 中查找，无效 ID 报错

**Given** 自动检测未发现任何工具
**When** 检测完成
**Then** 触发诊断输出：列出扫描了哪些路径、检测了哪些标志文件、建议安装哪些工具（FR-015）
**And** 抛出 `AiforgeError`（severity: 'fatal'）

**Given** 工具检测过程
**When** 测量扫描耗时
**Then** 4 工具全扫描 < 500 毫秒（NFR-P5）

**Given** 工具检测逻辑
**When** 检查实现方式
**Then** 基于 `TOOL_DEFINITIONS` 注册表的标志路径检测，不依赖工具进程是否运行（NFR-I3）

### Story 3.2: 规则匹配引擎

As a 用户,
I want 系统根据检测到的工具和安装范围自动匹配安装规则,
So that 知道哪些文件需要安装到哪里。

**Acceptance Criteria:**

**Given** 检测到 copilot 工具，安装范围为全局（`-g`）
**When** 执行规则匹配
**Then** 从 `BUILTIN_RULES` 中匹配出 copilot:global 的所有规则（agents→files、skills→directories、instructions→files、mcp-tools→files）
**And** 返回 `MatchedPlan` 包含每条规则对应的源文件和目标路径（FR-023）

**Given** 用户指定 `--dirs skills agents`
**When** 执行规则匹配
**Then** 只匹配 `sourceDir` 为 skills 或 agents 的规则，过滤掉其他资源类型（FR-024）

**Given** 知识仓库中存在 `README.md`、`.gitkeep`、`.DS_Store`
**When** 执行规则匹配
**Then** 这些文件被全局排除列表过滤，不出现在 `MatchedPlan` 中（FR-045）

**Given** 规则匹配引擎
**When** 检查实现方式
**Then** 使用 `Map<string, InstallRule[]>` 索引，key 为 `${tool}:${scope}`，O(1) 查找
**And** 新增工具只需在 `BUILTIN_RULES` 添加数据，不改引擎代码（FR-043）

**Given** 规则映射表
**When** 检查支持的安装类型
**Then** 支持 `files`、`directories`、`flatten` 三种类型（FR-044）

### Story 3.3: dry-run 预览与安装计划输出

As a 用户,
I want 在实际安装前预览完整的安装计划,
So that 知道会发生什么，建立对工具的信任。

**Acceptance Criteria:**

**Given** 用户运行 `npx aiforge --dry-run`
**When** 管道执行到 Match 阶段完成
**Then** 跳过 Install 阶段，直接将 `MatchedPlan` 传给 Reporter（FR-034）
**And** 管道在 Match 后分叉，架构保证 dry-run 与实际安装使用相同的匹配结果

**Given** dry-run 模式
**When** Reporter 输出安装计划
**Then** 按工具分组展示每个文件的源路径和目标路径
**And** 标注安装类型（files/directories/flatten）和模式（copy/symlink）
**And** 输出到 stdout（可被管道消费）

**Given** dry-run 模式
**When** 检查文件系统
**Then** 没有任何文件被写入、复制或创建

**Given** dry-run 输出的安装计划
**When** 与实际安装结果对比
**Then** 两者一致（NFR-U5）——相同的文件列表、相同的目标路径

**Given** dry-run 模式下管道执行
**When** 检查管道编排器
**Then** Resolve → Auth → Clone → Detect → Match 全部正常执行
**And** 只有 Install 阶段被跳过

---

## Epic 4: 安装执行与冲突保护

用户可以安全地将配置安装到所有检测到的工具中。支持复制/符号链接/flatten 三种模式，冲突时有备份保护，安装结果按工具分组展示。

### Story 4.1: 文件操作工具与预检查

As a 用户,
I want 系统在安装前验证目标路径的可写性和权限,
So that 不会在安装过程中因权限问题半途失败。

**Acceptance Criteria:**

**Given** `services/fs-utils.ts` 已创建
**When** 检查提供的工具函数
**Then** 包含：文件复制、目录复制、符号链接创建、文件备份、权限检查等操作
**And** 所有路径操作使用 `path.join()`（NFR-C5）

**Given** `MatchedPlan` 中包含多个目标路径
**When** 执行预检查（preflight）
**Then** 验证所有目标路径的父目录可写
**And** 验证当前用户有足够权限创建/覆盖文件（FR-030）

**Given** 目标目录不存在
**When** 执行预检查
**Then** 标记该目录需要创建（NFR-R2）

**Given** 某个目标路径无写入权限
**When** 预检查失败
**Then** 立即 fail-fast，抛出 `AiforgeError`（severity: 'fatal'）
**And** 不执行任何文件操作

**Given** 目标路径包含 `../` 路径遍历
**When** 执行预检查
**Then** 检测到路径遍历并拒绝，抛出安全错误（NFR-S5）

### Story 4.2: 复制模式安装执行

As a 用户,
I want 将知识仓库的配置文件复制到 AI 工具的目标目录,
So that 各工具能读取到正确的配置内容。

**Acceptance Criteria:**

**Given** `MatchedPlan` 中有 `type: 'files'` 的规则（如 agents → `~/.copilot/agents/`）
**When** 执行安装
**Then** 将源文件逐个复制到目标目录（FR-019）
**And** 目标目录不存在时自动创建（NFR-R2）

**Given** `MatchedPlan` 中有 `type: 'directories'` 的规则（如 skills → `~/.copilot/skills/`）
**When** 执行安装
**Then** 将源目录整体复制到目标位置，保持目录结构

**Given** 安装范围为全局（`-g`）
**When** 执行安装
**Then** 目标路径为用户 Home 目录下的工具配置目录（FR-016）

**Given** 安装范围为项目（默认）
**When** 执行安装
**Then** 目标路径为当前项目目录下的工具配置目录（FR-017）

**Given** 知识仓库包含 agents、skills、instructions、mcp-tools 四类资源
**When** 执行安装
**Then** 四类资源全部正确安装到对应目标路径（FR-018）

**Given** 安装过程中某个文件操作失败
**When** 错误发生
**Then** 立即停止后续安装（fail-fast），输出已完成的操作清单（FR-031）

### Story 4.3: 符号链接与 flatten 模式

As a 用户,
I want 使用符号链接模式实现 git pull 即更新，使用 flatten 模式适配 Cursor 的目录约定,
So that 日常更新零额外操作，且每个工具都能正确读取配置。

**Acceptance Criteria:**

**Given** 用户指定 `-g -l`（全局 + 符号链接）
**When** 执行安装
**Then** 在目标位置创建指向持久化仓库文件的符号链接（FR-020）
**And** 后续 `git pull` 更新仓库后，符号链接自动指向新内容

**Given** 用户指定 `-l` 但未指定 `-g`（项目级 + 符号链接）
**When** 解析参数
**Then** 拒绝执行，抛出 `AiforgeError`（severity: 'fatal'），提示符号链接仅支持全局安装（FR-021）

**Given** Cursor 工具的 skills 规则（`type: 'flatten'`）
**When** 执行安装
**Then** 将 `skills/code-review/` 目录扁平化：提取主文件（如 `index.md`），重命名为 `code-review.md`，复制到 `.cursor/rules/`（FR-022）

**Given** flatten 模式下源目录包含多个文件
**When** 执行安装
**Then** 按 `mainFile` 规则选择主文件（默认 `index.md`），其他文件忽略

**Given** 符号链接目标文件被删除（源仓库被移动）
**When** 检查链接状态
**Then** 检测到断链并输出明确警告（NFR-R6）

### Story 4.4: manifest 状态管理与冲突检测

As a 用户,
I want 系统追踪所有已安装文件的状态,
So that 能区分"aiforge 安装的"和"我手写的"文件，避免意外覆盖。

**Acceptance Criteria:**

**Given** `services/manifest.ts` 已创建
**When** 安装完成后
**Then** 将所有已安装文件记录到 `~/.aiforge/manifest.json`（FR-025）
**And** 每条记录包含：`source`、`target`、`tool`、`scope`、`mode`、`hash`（SHA256）、`installedAt`

**Given** manifest.json 写入
**When** 执行写入操作
**Then** 使用原子写入：先写临时文件，再 `fs.rename()` 替换（防止写入中断导致损坏）

**Given** 目标路径已存在文件
**When** 检查 manifest.json
**Then** 如果文件在 manifest 中且 hash 匹配 → 标记为"aiforge 安装，已是最新"
**And** 如果文件在 manifest 中但 hash 不匹配 → 标记为"aiforge 安装，有更新"
**And** 如果文件不在 manifest 中 → 标记为"用户手写文件"（FR-026）

**Given** manifest.json 损坏或丢失
**When** 读取 manifest
**Then** 降级为空 manifest，所有已存在文件视为"未知来源"（NFR-R5）

### Story 4.5: 冲突处理与安全保护

As a 用户,
I want 系统在检测到文件冲突时保护我的手写文件,
So that 不会丢失花时间调试的自定义配置。

**Acceptance Criteria:**

**Given** 目标路径存在用户手写文件（不在 manifest 中）
**When** 安装需要写入该路径
**Then** 提供交互式选项：覆盖 / 跳过 / 备份后覆盖（推荐）/ 查看差异 / 中止（FR-027）

**Given** 用户选择"备份后覆盖"
**When** 执行安装
**Then** 将用户文件备份为 `{filename}.aiforge-backup-{YYYYMMDD}`（FR-028）
**And** 然后执行正常安装

**Given** 用户指定 `--force`
**When** 检测到冲突
**Then** 跳过交互式确认，直接覆盖（FR-029）

**Given** 非 TTY 环境下检测到冲突
**When** 需要用户决策
**Then** 直接失败（不进入交互式选择），exit code = 1

**Given** 安装结果为零项（无文件被安装）
**When** 安装完成
**Then** 触发零结果诊断：输出扫描了哪些目录、匹配了哪些模式、建议如何修复（FR-032）

**Given** 临时文件在安装过程中创建
**When** 安装完成（无论成功或失败）
**Then** 所有临时文件被清理删除（NFR-S6）

### Story 4.6a: 管道完整编排与错误流控制

As a 开发者,
I want 管道编排器串联所有已实现的阶段并正确处理错误流,
So that 正常模式下完整管道可端到端运行。

**Acceptance Criteria:**

**Given** 正常模式（非 dry-run）
**When** 执行管道
**Then** 完整执行 Resolve → Auth → Clone → Detect → Match → Install → Report
**And** `ParsedArgs` 由编排器持有，按需注入各阶段

**Given** 管道执行中某阶段抛出 `severity: 'fatal'` 错误
**When** 错误发生
**Then** 管道立即停止，输出已完成的操作清单（FR-031，NFR-R4）

**Given** 管道执行中某阶段抛出 `severity: 'partial'` 错误
**When** 错误被收集
**Then** 管道继续执行后续文件，最终汇总所有 partial 错误

### Story 4.6b: 安装结果汇总与输出流分工

As a 用户,
I want 看到清晰的安装结果汇总,
So that 知道哪些文件安装成功、更新、跳过或失败。

**Acceptance Criteria:**

**Given** 安装执行完成
**When** Reporter 输出结果
**Then** 按工具分组展示每个文件的状态：✅ 新建、🔄 更新、⏭️ 跳过、❌ 失败
**And** 显示统计行：`安装: N 项  更新: N 项  跳过: N 项  失败: N 项`

**Given** 安装结果
**When** 检查输出流
**Then** 结果输出到 stdout（可被 `grep`/`awk` 解析），错误输出到 stderr

---

## Epic 5: 端到端体验与发布就绪

精致的终端交互体验——阶段式 spinner 进度、按工具分组的树形结果、TTY/非TTY 自适应、quiet 模式、国际化支持。端到端集成测试通过，达到 MVP Go/No-Go 门禁标准。

### Story 5.1: 阶段式进度与 spinner 动画

As a 用户,
I want 在安装过程中看到实时进度,
So that 知道系统在做什么，不会以为卡住了。

**Acceptance Criteria:**

**Given** TTY 终端环境下执行安装
**When** 管道进入每个阶段
**Then** 显示 ora spinner + 中文阶段名（"解析仓库地址..."、"验证认证信息..."、"克隆仓库..."、"检测 AI 工具..."、"匹配安装规则..."、"执行安装..."）（FR-035）
**And** 阶段完成时 spinner 停止并显示 ✓ 标记

**Given** 安装阶段处理多个文件
**When** 每个文件处理完成
**Then** 更新 spinner 文本显示当前进度（如 "执行安装... (3/7)"）

**Given** 进度输出
**When** 检查输出流
**Then** 所有进度信息输出到 stderr（不污染 stdout 的数据流）

### Story 5.2: 树形结果汇总与统计

As a 用户,
I want 安装完成后看到按工具分组的树形结果,
So that 一目了然地知道每个工具安装了什么。

**Acceptance Criteria:**

**Given** 安装完成，涉及多个工具
**When** Reporter 输出结果
**Then** 按工具分组展示树形结构（FR-036）：
```
GitHub Copilot (7 项)
  ✅ agents/api-dev.agent.md → ~/.copilot/agents/
  ✅ skills/code-review/ → ~/.copilot/skills/
  ...
Claude Code (2 项)
  ✅ skills/code-review/ → ~/.claude/skills/
  ...
```

**Given** 结果汇总
**When** 所有文件展示完毕
**Then** 显示统计行：`安装: 7 项  更新: 1 项  跳过: 1 项  失败: 0 项`

**Given** 结果输出
**When** 检查输出流
**Then** 树形结果和统计行输出到 stdout（可被管道消费）

### Story 5.3: TTY 自适应与 quiet 模式

As a 用户,
I want 系统根据终端环境自动调整输出格式,
So that 在 CI 管道中也能正常工作，在脚本中输出可解析。

**Acceptance Criteria:**

**Given** 非 TTY 环境（如 `npx aiforge | grep copilot`）
**When** 执行安装
**Then** 自动禁用 spinner 动画和 ANSI 彩色码（FR-038，NFR-U4）
**And** 输出纯文本行，可被 `grep`/`awk` 解析

**Given** 用户指定 `--quiet`
**When** 执行安装
**Then** 只输出关键信息：最终成功/失败状态 + 统计行（FR-039）
**And** 不显示进度 spinner、不显示逐文件详情

**Given** `npx aiforge --dry-run 2>/dev/null`
**When** 执行
**Then** stdout 只输出纯安装计划（无进度信息），可被脚本解析

**Given** 非 TTY 环境下遇到需要用户决策的场景（如冲突处理）
**When** 需要交互
**Then** 直接失败，exit code 非 0，不挂起等待输入

### Story 5.4: 三段式错误提示完善

As a 用户,
I want 错误发生时看到清晰的修复指引,
So that 不需要搜索文档就能自己解决问题。

**Acceptance Criteria:**

**Given** 认证失败
**When** Reporter 输出错误
**Then** 显示三段式提示（FR-037，NFR-U2）：
```
❌ 无法访问仓库
   Git 服务器返回 401（认证失败）
   修复方法：
   npx aiforge --ssh
   npx aiforge --token <your-token>
   npx aiforge init
```

**Given** 任何 `AiforgeError`
**When** Reporter 渲染错误
**Then** 格式为：`❌ ${message}` → `${why}` → `${fix.join('\n')}`
**And** 修复命令可直接复制执行

**Given** 错误输出
**When** 检查输出流
**Then** 所有错误信息输出到 stderr

**Given** 各类错误场景（认证失败、网络错误、权限不足、参数错误）
**When** 触发错误
**Then** 每种错误都有针对性的 `why` 和 `fix` 内容，不是通用的"请检查配置"

### Story 5.5a: 国际化语言选择与配置

As a 用户,
I want 在初始化时选择界面语言，并能在安装后通过配置修改语言设置,
So that 中英文用户都能舒适使用，且后续无需重新初始化即可切换输出语言。

**Acceptance Criteria:**

**Given** 用户在 `aiforge init` 中选择语言
**When** 选择英文
**Then** 后续所有用户可见输出使用英文（FR-046）
**And** 语言设置保存到 `config.json` 的 `language` 字段

**Given** 默认配置
**When** 未设置语言
**Then** 系统默认使用中文输出（NFR-U1）

**Given** `data/messages.ts`
**When** 检查实现
**Then** 所有用户可见字符串通过 messages 模块获取
**And** 支持根据 `language` 配置切换中英文文案

**Given** 用户已完成安装，且 `config.json` 中的 `language` 从 `zh-CN` 修改为 `en`
**When** 再次执行任意包含用户可见输出的命令（如 `npx aiforge --dry-run`）
**Then** 系统使用英文输出
**And** 无需重新运行 `aiforge init`（FR-046）

**Given** `config.json` 中的 `language` 配置值非法、缺失或不受支持
**When** 系统加载语言配置
**Then** 自动回退到默认中文输出
**And** 给出明确提示，说明当前语言配置无效并已使用默认语言

### Story 5.5b: 端到端集成测试

As a 开发者,
I want 端到端集成测试覆盖核心安装流程、安装模式和目标平台,
So that 在发布前能够自动验证系统整体可用性，并及时发现回归问题。

**Acceptance Criteria:**

**Given** 一个符合约定目录结构的模拟知识仓库
**When** 执行全局安装和项目级安装
**Then** 4 个目标工具（Copilot、Claude、Cursor、VS Code）的安装流程均可成功完成
**And** 安装结果与规则映射一致

**Given** 三种安装模式
**When** 分别执行复制模式、符号链接模式和 flatten 模式
**Then** 三种模式均通过端到端验证
**And** 各自输出符合预期目标路径和文件形态

**Given** `--dry-run` 模式
**When** 执行端到端测试
**Then** 不发生任何文件写入、复制、覆盖或创建行为
**And** dry-run 输出的安装计划与实际安装结果一致（NFR-U5）

**Given** 存在文件冲突场景
**When** 执行安装测试
**Then** 系统触发冲突处理流程
**And** 备份、跳过、覆盖等行为符合设计预期

**Given** 安装结果为零项的场景
**When** 执行端到端测试
**Then** 系统触发零结果诊断输出
**And** 输出包含扫描路径、匹配结果和修复建议

**Given** macOS 环境
**When** 执行端到端测试
**Then** 所有测试通过（NFR-C1）

**Given** Linux 环境（CI）
**When** 执行端到端测试
**Then** 所有测试通过（NFR-C2）

**Given** 端到端测试完成
**When** 查看测试结果
**Then** 能明确区分通过项、失败项及失败原因
**And** 失败结果可作为发布阻塞依据

### Story 5.5c: MVP Go/No-Go 发布门禁验收

> **性质说明：** 本 Story 更偏发布门禁/验收清单，而非标准开发 Story。保留在 epics.md 中以确保发布验收有据可查。

As a PM / QA,
I want 一份明确的 MVP 发布门禁清单并逐项完成验证,
So that 团队对产品是否达到发布标准有客观、一致、可追溯的判断。

**Acceptance Criteria:**

**Given** MVP Go/No-Go 门禁清单
**When** 逐项执行发布前验证
**Then** 以下条件必须全部满足：
- 新员工首次配置旅程可完整走通
- `--dry-run` 输出与实际安装结果一致
- 冲突场景存在备份保护
- 零结果场景存在诊断输出
- npm 包中不包含公司域名、仓库地址、Token 或其他敏感信息（NFR-S1）

**Given** 端到端验证结果、关键旅程验证结果和发布检查结果
**When** 汇总发布评审材料
**Then** 每一项门禁都有明确状态：通过 / 未通过 / 阻塞
**And** 每个未通过项都附带对应风险说明和处理建议

**Given** 存在任一未通过的 blocker 项
**When** 执行 Go/No-Go 评审
**Then** 发布结论为 No-Go
**And** 不进入正式发布

**Given** 所有 blocker 项均已关闭
**When** 执行 Go/No-Go 评审
**Then** 发布结论为 Go
**And** 形成可追溯的发布验收记录

**Given** 发布门禁验收完成
**When** 复盘本次验收结果
**Then** 团队可以明确知道 MVP 当前的已知风险、剩余限制和上线边界

