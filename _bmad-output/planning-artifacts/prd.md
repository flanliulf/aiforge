---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-complete']
classification:
  projectType: cli_tool
  domain: developer_tooling
  complexity: medium
  projectContext: greenfield
date: 2026-03-11
inputDocuments:
  - _bmad-output/planning-artifacts/product-brief-ai-forge-2026-03-11.md
  - _bmad-output/analysis/brainstorming-session-2026-03-04.md
  - _bmad-output/analysis/chaos-engineering-report.md
  - docs/PRD(draft).md
  - docs/PRD(draft) - 两种安装方式详解.md
  - docs/architec(draft).md
  - docs/混沌工程报告审核总结与修订清单.md
  - docs/混沌工程攻击向量 #1～#6
documentCounts:
  briefs: 1
  research: 0
  brainstorming: 2
  projectDocs: 10
workflowType: 'prd'
---

# Product Requirements Document - ai-forge

**Author:** chunxiao
**Date:** 2026-03-11
**Version:** v1.0.0
**Status:** Draft

## Executive Summary

aiforge 是一个通过 `npx` 运行的命令行工具，解决 AI 编码工具配置碎片化的核心痛点。在 AI 编码辅助工具（GitHub Copilot、Claude Code、Cursor、VS Code 等）爆发式增长的当下，每个工具对 Instructions、Skills、Agents、MCP Tools 等配置资源有着完全不同的目录约定和格式要求。aiforge 让团队只需维护一份知识仓库，一条命令即可将配置自动安装到所有 AI 工具中。

**核心设计哲学：**
- **标准适配器** — 不推行标准，而是翻译标准。知识仓库保持自己的组织方式，aiforge 负责映射到每个工具的约定
- **工具与知识零信任解耦** — npm 包零敏感信息，知识仓库托管在私有 Git，认证完全在用户侧完成
- **终端输出即对话** — 每一行输出回答用户脑中的一个问题，而非面向开发者的日志流

**MVP 聚焦：** 公司内部开发者和平台维护者的核心场景，支持 Copilot + Claude + Cursor + VS Code 四个工具，同时按社区级通用工具的标准进行架构设计。


## 术语表

| 术语 | 定义 |
|------|------|
| **知识仓库** | 遵循 aiforge 约定目录结构的 Git 仓库，包含 AI 编码配置内容（agents/skills/instructions/mcp-tools） |
| **源目录** | 知识仓库中的顶层资源目录：`agents/`、`skills/`、`instructions/`、`mcp-tools/` |
| **目标工具** | 用户本地安装的 AI 编码工具：Copilot、Claude Code、Cursor、VS Code 等 |
| **语义适配层** | aiforge 的核心架构——在"知识"（跨平台配置）和"平台"（工具特定约定）之间的翻译层 |
| **安装规则** | 一条从「源目录 + 工具 + 范围」到「目标路径 + 安装方式」的映射 |
| **安装类型** | 资源从源到目标的处理方式：`files`（文件复制）、`directories`（目录复制）、`flatten`（扁平化提取主文件并重命名） |
| **复制模式** | 默认安装模式，将文件从临时/持久化目录复制到目标位置，产生独立副本 |
| **符号链接模式** | `-l` 参数触发，在目标位置创建指向持久化仓库的符号链接，`git pull` 后自动生效 |
| **全局安装** | `-g` 参数触发，安装到用户 Home 目录下的 AI 工具配置目录（如 `~/.copilot/`） |
| **项目安装** | 默认模式，安装到当前项目目录下的 AI 工具配置目录（如 `.github/`） |
| **config.json** | `~/.aiforge/config.json`，存储用户配置和认证信息（默认仓库、Token、SSH 偏好） |
| **manifest.json** | `~/.aiforge/manifest.json`，存储安装状态和文件清单（已安装文件、哈希、时间戳），用于冲突检测和增量更新 |
| **aiforge.json** | 知识仓库根目录的可选配置文件，用于自定义安装规则（M3 功能） |
| **零结果诊断** | 当安装结果为 0 项时自动触发的诊断模式，输出扫描了哪些目录、匹配了哪些模式、建议如何修复 |
| **三段式错误提示** | aiforge 的错误输出格式：什么坏了（用户语言）→ 为什么（简短原因）→ 怎么修（可复制的命令） |
| **预检查 (preflight)** | 在执行文件操作前的验证步骤，包括目标路径可写性、权限验证等。认证 preflight 验证 Token 健康和权限 |
| **fail-fast** | 错误处理策略——任何安装步骤失败时立即停止，不继续后续步骤，输出已完成的操作清单 |
| **管道式架构** | aiforge 的执行架构——将安装过程分解为有序阶段（参数解析→认证→克隆→检测→安装→汇总），数据沿管道流动 |
| **四层认证优先级** | CLI 参数 > 环境变量 > 配置文件 > 系统凭据，适配开发、CI/CD、新用户等不同执行上下文 |
| **Token 脱敏** | 在日志和错误输出中将 Token 显示为部分隐藏格式（如 `glpat-ab****xy`），防止泄露 |
| **规则包** | 可独立分发的 AI 编码配置单元（P3 远期），支持依赖管理和版本控制 |
| **语义类型系统** | 文件粒度的类型识别能力（P3 远期），将文件映射到 agent/skill/instruction 等语义类型 |


## Success Criteria

### 用户成功

| 指标 | 目标 | 衡量方式 |
|------|------|---------|
| 首次安装成功率 | > 90%（MVP）→ > 95%（M2） | 安装结果日志（成功/失败/部分成功） |
| 首次安装耗时 | < 3 分钟（含 init 配置） | 从运行命令到看到成功输出 |
| 配置相关求助量 | 趋近于零 | "怎么配置 AI 工具"类问题的出现频率 |
| 多工具覆盖率 | 100% 已检测工具被配置 | 已安装工具数 / 已检测工具数 |
| 信任建立 | `--dry-run` 预览准确，冲突时有备份 | 手动测试边缘场景 |

**Aha Moment：** 用户运行一条命令后，看到按工具分组的树形结果——"安装完成：Copilot 6 项、Claude 4 项、VS Code 1 项"，打开 VS Code 发现 Copilot 已生效。

### 业务成功

| 指标 | 目标 | 时间框架 | 衡量方式 |
|------|------|---------|---------|
| 公司开发者采用率（北极星） | > 50% | MVP 首月 | 内部人工调研 |
| 公司开发者采用率 | > 80% | 发布 3 个月 | 内部人工调研 |
| 替代 Shell 脚本 | setup.sh 使用量降为 0 | MVP 后 2 个月 | 观察 |
| 新员工入职配置 | 入职首日即完成 | 发布 6 个月 | 入职流程反馈 |
| 维护成本 | 新增工具支持从"改脚本"降为"加配置" | MVP 即实现 | 实际操作验证 |
| 开源就绪 | npm 包零公司信息，通过安全审计 | MVP 发布时 | 代码审查 + `npm pack` 检查 |

### 技术成功

| 类别 | 指标 | 目标 |
|------|------|------|
| 安全性 | Token 不出现在进程列表、Shell 历史、错误日志 | 100% |
| 安全性 | npm 包不含公司域名、仓库地址、Token | 100% |
| 可靠性 | 安装结果为 0 项时触发诊断输出 | 100% |
| 可靠性 | 文件冲突时提示并备份 | 100% |
| 用户体验 | 认证失败时给出可操作的修复建议 | 100% |
| 用户体验 | `--dry-run` 预览模式可用 | 100% |
| 性能 | 首次克隆 + 安装 | < 30 秒 |
| 性能 | 持久化仓库更新 + 安装 | < 15 秒 |
| 兼容性 | macOS + Linux 测试通过 | MVP |

### 可量化结果

| 结果 | 基线（当前） | 目标（MVP 后） |
|------|------------|--------------|
| AI 工具配置覆盖 | 仅 Copilot（Shell 脚本） | Copilot + Claude + Cursor + VS Code |
| 安装方式 | 2 个独立脚本 | 1 条命令 |
| 跨平台 | 仅 macOS（WSL for Windows） | macOS + Linux（Windows M2） |
| 新工具接入成本 | 编写新脚本 + 多平台测试 | 添加配置规则 |

### 需求追踪矩阵

| 成功指标 | 用户旅程 | 功能需求 | 非功能需求 |
|---------|---------|---------|-----------|
| 首次安装成功率 > 90% | 旅程 1, 2 | FR-001~FR-005, FR-016~FR-024 | NFR-P1, NFR-U2, NFR-U5 |
| 多工具覆盖率 100% | 旅程 1, 4 | FR-013~FR-015, FR-043~FR-045 | NFR-I3, NFR-I4 |
| 冲突不丢文件 | 旅程 3 | FR-025~FR-031 | NFR-R4, NFR-R5 |
| 信任可建立 | 旅程 1, 3 | FR-027~FR-028, FR-034 | NFR-U5 |
| 配置求助量趋零 | 旅程 2, 6 | FR-011, FR-033, FR-037 | NFR-U1, NFR-U2 |
| 日常更新低成本 | 旅程 5 | FR-020, FR-023 | — |
| 安全底线 | 全部 | FR-012, FR-030 | NFR-S1~NFR-S6 |


## User Journeys

### 旅程 1：小明的首次安装（主要用户 - 成功路径）

**Opening Scene：** 小明是后端开发，3 年经验，日常用 VS Code + Copilot，偶尔用 Claude Code 处理复杂重构。周一早上打开 Slack，看到平台团队的通知："setup.sh 已废弃，请改用 `npx aiforge -g -l` 安装 AI 配置。"

**Rising Action：** 小明先跑了 `npx aiforge --dry-run`——他不信任任何会往自己电脑写文件的工具。终端输出了清晰的安装计划，按工具分组展示每个文件的去向。他注意到没有 Cursor 的条目——因为他没装 Cursor。自动检测是对的。

**Climax：** 去掉 `--dry-run`，执行 `npx aiforge -g -l`。spinner 转了几秒，看到按工具分组的树形结果：Copilot 7 项、Claude 4 项，全部成功。打开 VS Code，在 Copilot Chat 里输入 `@api-dev`——agent 已经可用了。

**Resolution：** "一条命令，两个工具都配好了。" 下次团队更新配置，只需 `cd ~/aicoding-base && git pull`，符号链接自动生效。

**揭示的能力需求：** 自动工具检测、`--dry-run` 预览、符号链接模式、按工具分组的结果展示、阶段式进度

---

### 旅程 2：小李的入职配置（主要用户 - 新手路径）

**Opening Scene：** 小李是应届生，入职第一天。入职文档第 7 步写着："运行以下命令配置 AI 编码工具"。

**Rising Action：** 执行 `npx aiforge init`，交互式引导开始。小李选了 SSH Key 但还没配过，aiforge 检测到连接失败，输出三段式错误提示：什么坏了 → 为什么 → 怎么修（三步操作 + 具体命令）。按步骤配好 SSH Key 后重新运行，连接验证通过。

**Climax：** 执行 `npx aiforge -g -l`，看到 "✅ 安装完成" 和具体的文件列表。

**Resolution：** 整个过程不到 3 分钟，他没有问任何人。

**揭示的能力需求：** `aiforge init` 交互式引导、三段式错误提示、连接验证、新手友好的输出

---

### 旅程 3：小明的冲突处理（主要用户 - 边缘场景）

**Opening Scene：** 小明之前手动写了一个自定义的 `api-dev.agent.md`，花了两小时调试 prompt。一个月后团队更新了 aicoding-base。

**Rising Action：** aiforge 通过 manifest.json 检测到冲突：本地文件非 aiforge 安装，与仓库文件同名。提示交互式选择：覆盖 / 跳过 / 备份后覆盖（推荐）/ 查看差异 / 中止。

**Climax：** 选了备份后覆盖，自己的文件被保存为 `.aiforge-backup-20260311`。安装完成后手动合并。

**Resolution：** "至少没丢东西。" 下次可以先 `--dry-run` 看看有没有冲突。

**揭示的能力需求：** manifest.json 状态管理、冲突检测、备份机制、差异查看、交互式冲突处理


---

### 旅程 4：chunxiao 的维护验证（次要用户 - 平台维护者）

**Opening Scene：** chunxiao 刚给 aicoding-base 新增了 `skills/code-review/` 目录，需要验证新 skill 能正确安装到所有工具。

**Rising Action：** 执行 `npx aiforge --dry-run -g -l`，输出显示新 skill 出现在 Copilot（directories 模式）和 Cursor（flatten 模式）的安装计划中，已有文件标记为"已是最新"被跳过。

**Climax：** 去掉 `--dry-run` 执行安装，分别验证 VS Code 和 Cursor 中 skill 生效。

**Resolution：** 整个验证过程不到 1 分钟。以前需要改 shell 脚本、测试多平台——现在只需要把文件放到正确的目录。

**揭示的能力需求：** `--dry-run` 预览（维护者视角）、增量检测、flatten 模式正确性、配置驱动的可扩展性

---

### 旅程 5：小明的日常更新（主要用户 - 持续使用）

**场景：** Slack 通知 aicoding-base 更新了 TAPD skill。小明执行 `cd ~/aicoding-base && git pull`。没有第二步——符号链接指向的文件内容已经更新了。整个过程 5 秒。

**揭示的能力需求：** 符号链接模式的核心价值——`git pull` 即更新、零额外操作

---

### 旅程 6：小李的认证失败（主要用户 - 错误恢复）

**场景：** 小李换了电脑，忘了重新配置。认证失败后 aiforge 输出三段式提示，附带三种修复方法和可复制的命令。选了 `npx aiforge init` 重新配置，30 秒搞定。

**揭示的能力需求：** 认证失败的友好提示、多种修复路径、`aiforge init` 的可重复性

---

### 旅程 7：CI/CD 自动化安装（后续阶段 - M2/M3）

> 此旅程不在 MVP 范围内，记录为后续阶段的设计参考。

**场景概述：** DevOps 工程师在 GitLab CI 流水线中配置 aiforge。需要处理：非交互式模式、环境变量认证（`CI_JOB_TOKEN`）、临时容器环境、并发安全。

**揭示的能力需求（M2/M3）：** CI 环境自动检测、非交互式模式、`CI_JOB_TOKEN` 支持、并发安全

**M2 验收标准：**
- 在 GitLab CI 容器中通过 `CI_JOB_TOKEN` 环境变量完成非交互式安装
- 并发流水线不产生文件锁冲突
- 安装失败时 exit code 非 0，CI 流水线正确标红

### Journey Requirements Summary

| 旅程 | 核心能力 | 优先级 |
|------|---------|--------|
| 小明首次安装 | 自动检测、`--dry-run`、符号链接、树形结果 | MVP |
| 小李入职配置 | `aiforge init`、三段式错误提示、连接验证 | MVP |
| 小明冲突处理 | manifest.json、冲突检测、备份、交互式处理 | MVP |
| chunxiao 维护验证 | `--dry-run`（维护者视角）、增量检测、flatten | MVP |
| 小明日常更新 | 符号链接 + git pull 自动生效 | MVP |
| 小李认证失败 | 友好错误提示、多修复路径 | MVP |
| CI/CD 自动化 | 非交互式、环境变量认证、并发安全 | M2/M3 |


## Functional Requirements

### 仓库获取

- FR-001: 用户可以通过提供 Git 仓库 URL 获取知识仓库内容
- FR-002: 用户可以通过配置文件中的默认仓库地址免输入获取知识仓库
- FR-003: 系统在首次获取知识仓库时应最小化网络传输量，仅获取最新版本内容（不含完整历史）
- FR-004: 系统在检测到已有本地仓库副本时应优先执行增量更新，而非全量重新获取
- FR-005: 系统可以将持久化仓库克隆到固定位置（`~/.aiforge/repos/`），不使用临时目录

### 认证

- FR-006: 用户可以通过 SSH Key 认证访问私有仓库
- FR-007: 用户可以通过 Personal Access Token 认证访问私有仓库
- FR-008: 用户可以通过环境变量（`AIFORGE_TOKEN`/`GITLAB_TOKEN`）提供认证凭据
- FR-009: 系统可以在无显式认证时降级到系统 Git 凭据管理器
- FR-010: 系统按优先级链解析认证方式（CLI 参数 > 环境变量 > 配置文件 > 系统凭据）
- FR-011: 系统在认证失败时提供可操作的修复建议（含多种替代方案和可复制的命令）
- FR-012: 系统在日志和错误输出中对 Token 进行脱敏处理

### 工具检测

- FR-013: 系统可以自动扫描用户环境中已安装的 AI 编码工具（Copilot、Claude、Cursor、VS Code）
- FR-014: 用户可以通过 `--tools` 参数手动指定目标工具，覆盖自动检测
- FR-015: 系统在未检测到任何工具时触发诊断输出

### 安装引擎

- FR-016: 用户可以将知识仓库资源安装到全局目录（`-g`）
- FR-017: 用户可以将知识仓库资源安装到当前项目目录（默认）
- FR-018: 系统支持四类资源的安装：agents、skills、instructions、mcp-tools
- FR-019: 系统支持复制模式（默认）
- FR-020: 系统支持符号链接模式（`-l`，仅全局安装）
- FR-021: 系统在项目级安装时禁用符号链接模式
- FR-022: 系统支持 flatten 安装类型
- FR-023: 系统根据内置安装规则映射表将资源安装到正确目标路径
- FR-024: 用户可以通过 `--dirs` 参数过滤只安装特定类型的资源

### 冲突处理与安全

- FR-025: 系统通过 manifest.json 追踪所有已安装文件的状态
- FR-026: 系统可以区分"aiforge 安装的文件"和"用户手写的文件"
- FR-027: 系统在检测到文件冲突时提供交互式处理选项（覆盖/跳过/备份/查看差异/中止）
- FR-028: 系统可以在覆盖前自动备份用户文件
- FR-029: 用户可以通过 `--force` 参数跳过冲突确认直接覆盖
- FR-030: 系统在安装前执行预检查（目标路径可写性、权限验证）
- FR-031: 系统在任何安装步骤失败时立即停止（fail-fast），并输出已完成的操作清单
- FR-032: 系统在安装结果为零项时触发零结果诊断模式


### 用户交互与体验

- FR-033: 用户可以通过 `aiforge init` 完成交互式首次配置（仓库 URL、认证方式、连接验证）
- FR-034: 用户可以通过 `--dry-run` 预览安装计划而不写入任何文件
- FR-035: 系统在安装过程中展示阶段式进度（spinner + 实时状态更新）
- FR-036: 系统在安装完成后展示按工具分组的树形结果汇总（含统计数字）
- FR-037: 系统在错误发生时展示三段式提示（什么坏了 / 为什么 / 怎么修）
- FR-038: 系统在 TTY 终端展示彩色输出，在非 TTY 环境自动降级为纯文本
- FR-039: 用户可以通过 `--quiet` 参数获取精简输出

### 配置管理

- FR-040: 系统支持通过 `~/.aiforge/config.json` 持久化用户配置
- FR-041: 系统在首次运行且无配置时引导用户完成配置
- FR-042: 系统支持配置文件中按 Git host 存储不同的认证信息

### 可扩展性与国际化

- FR-043: 平台维护者可以通过修改安装规则配置新增 AI 工具支持，无需修改引擎代码
- FR-044: 系统的安装规则映射表支持 files、directories、flatten 三种安装类型
- FR-045: 系统支持全局排除文件列表（README.md、.gitkeep、.DS_Store 等）
- FR-046: 用户可以在初始化时选择交互语言，并在安装后通过配置修改语言设置


## CLI 接口与技术规范

### 命令结构

**主命令：** `aiforge [repo-url] [options]`

| 参数/选项 | 类型 | 默认值 | 说明 |
|----------|------|--------|------|
| `repo-url` | argument | config.json defaultRepo | Git 仓库 URL |
| `-g, --global` | flag | false | 安装到用户全局目录 |
| `-l, --link` | flag | false | 符号链接模式（仅全局） |
| `-t, --tools <tools...>` | option | 自动检测 | 目标工具列表 |
| `-d, --dirs <dirs...>` | option | 全部 | 源目录过滤 |
| `--clone-dir <path>` | option | `~/.aiforge/repos/` | 持久化克隆路径 |
| `--ssh` | flag | false | 强制 SSH 协议 |
| `--token <token>` | option | — | Token（仅开发模式） |
| `--force` | flag | false | 覆盖不备份 |
| `--dry-run` | flag | false | 预览模式 |
| `--quiet` | flag | false | 精简输出 |

**子命令：**

| 命令 | 说明 | 阶段 |
|------|------|------|
| `aiforge init` | 交互式首次配置 | MVP |
| `aiforge update` | 拉取仓库最新内容 | M2 |
| `aiforge list` | 展示工具路径映射 | M2 |
| `aiforge uninstall` | 精确移除已安装资源 | M3 |

### 输出格式设计

| 模式 | 触发条件 | 行为 |
|------|---------|------|
| 默认 | TTY 终端 | spinner 动画 + 彩色 + 详细提示 |
| 精简 | `--quiet` | 无 spinner，只输出关键信息 |
| CI | `!process.stdout.isTTY` | 禁用 spinner/彩色，纯文本，失败 exit code = 1 |

**输出结构：** 阶段式进度 → 按工具分组的树形结果 → 统计数字 → 下一步提示

**错误输出：** `❌ [什么坏了]` → `[为什么]` → `[怎么修（可复制的命令）]`

### 脚本化与非交互支持

aiforge 作为 CLI 工具，必须在脚本化和非交互环境中可预测地工作。

| 约束 | 说明 | 阶段 |
|------|------|------|
| 非 TTY 禁用交互 | 非 TTY 环境下不进入交互式选择（如冲突处理），遇到需要人工决策的场景直接失败 | MVP |
| 退出码约定 | `0`=成功，`1`=安装失败，`2`=认证失败，`3`=参数错误 | MVP |
| 输出流分工 | stdout 用于安装结果和计划输出（可被管道消费），stderr 用于诊断和错误信息 | MVP |
| 非 TTY 纯文本 | 禁用 spinner、彩色、进度动画，输出可被 `grep`/`awk` 解析 | MVP |
| 环境变量认证 | 支持 `AIFORGE_TOKEN`/`GITLAB_TOKEN` 环境变量，适配 CI 场景 | MVP |
| 完整 CI/CD 自动化 | `CI_JOB_TOKEN` 支持、并发安全（文件锁）、非交互式批量安装 | M2/M3 |

### 配置文件规范

**用户配置 `~/.aiforge/config.json`：** 存储默认仓库 URL、SSH 偏好、克隆路径、按 host 的认证信息。

**安装状态 `~/.aiforge/manifest.json`：** 存储已安装文件清单（来源、目标、工具、范围、模式、时间戳、哈希）。

**职责分离：** config.json 存用户配置和认证，manifest.json 存安装状态和文件清单。


### 安装规则映射表

每条规则描述一个"从哪来 → 到哪去"的映射：

```typescript
interface InstallRule {
  tool: string;           // 目标工具 ID
  scope: 'global' | 'project';
  sourceDir: string;      // 源仓库中的目录名
  type: 'files' | 'directories' | 'flatten';
  include?: string[];     // 白名单
  match?: string;         // 匹配模式
  exclude?: string[];     // 黑名单
  mainFile?: string;      // flatten 模式主文件
  targetDir: string;      // 目标路径
}
```

**完整映射表（MVP 四工具）：**

| 工具 | 范围 | 源目录 | 类型 | 目标路径 |
|------|------|--------|------|---------|
| Copilot | 全局 | agents/ | files | `~/.copilot/agents/` |
| Copilot | 全局 | skills/ | directories | `~/.copilot/skills/` |
| Copilot | 全局 | instructions/ | files | `~/.copilot/` |
| Copilot | 全局 | mcp-tools/ | files | `~/.copilot/` |
| Copilot | 项目 | agents/ | files | `.github/agents/` |
| Copilot | 项目 | skills/ | directories | `.github/skills/` |
| Copilot | 项目 | instructions/ | files | `.github/` |
| Copilot | 项目 | mcp-tools/ | files | `.github/` |
| Claude | 全局 | agents/ | files | `~/.claude/agents/` |
| Claude | 全局 | skills/ | directories | `~/.claude/skills/` |
| Claude | 项目 | agents/ | files | `.claude/agents/` |
| Claude | 项目 | skills/ | directories | `.claude/skills/` |
| Cursor | 全局 | skills/ | flatten | `~/.cursor/rules/` |
| Cursor | 项目 | skills/ | flatten | `.cursor/rules/` |
| Cursor | 项目 | agents/ | files | `.cursor/rules/` |
| VS Code | 全局 | mcp-tools/ | files | `~/.vscode/` (macOS/Linux), `%APPDATA%/Code/User/` (Windows) |

**全局排除文件：** `README.md`, `README`, `.gitkeep`, `.DS_Store`, `mcp.json.example`

### 安装引擎执行流程

```
CLI 参数解析 → 仓库地址解析 → 认证解析 → 克隆/更新
    → 工具检测 → 规则匹配 → 预检查 → 执行安装 → 结果汇总
```

**关键设计决策：** 管道式架构（阶段独立）、配置驱动（新增工具只改规则表）、fail-fast、预检查。

**实现备注：**
- 克隆阶段：推荐使用浅克隆（`--depth 1`）最小化网络传输量（对应 FR-003）
- 更新阶段：已有本地仓库时推荐使用 `git pull` 执行增量更新（对应 FR-004）

### 包分发

| 维度 | 规范 |
|------|------|
| 包名 | `aiforge`（候选：`ai-forge`、`@aiforge/cli`） |
| 运行方式 | `npx aiforge`（零安装） |
| Node.js | >= 18.0.0 |
| Git | >= 2.20 |
| 发布内容 | `bin/`、`src/`、`README.md`、`LICENSE` |
| 安全审查 | 源码不含公司域名/仓库地址/Token |


## Non-Functional Requirements

### 性能

| NFR | 指标 | 目标 | 测试方式 |
|-----|------|------|---------|
| NFR-P1 | 首次克隆 + 安装耗时 | < 30 秒 | 对 aicoding-base 仓库计时 |
| NFR-P2 | 持久化仓库更新 + 安装耗时 | < 15 秒 | git pull + 安装计时 |
| NFR-P3 | 无网络环境处理已有仓库 | < 3 秒 | 离线模式计时 |
| NFR-P4 | CLI 启动到首次输出 | < 1 秒 | npx 缓存后冷启动计时 |
| NFR-P5 | 工具检测扫描耗时 | < 500 毫秒 | 4 工具全扫描计时 |

### 安全

| NFR | 要求 | 验证方式 |
|-----|------|---------|
| NFR-S1 | npm 包不含任何仓库 URL、Token、Host 名、公司名称 | `npm pack` + 内容审查 |
| NFR-S2 | Token 注入 URL 仅存在于内存，克隆完成后立即清除 | 代码审查 + 克隆后检查 `.git/config` |
| NFR-S3 | 所有日志和错误输出中 Token 显示为脱敏格式 | 故意触发认证错误，检查输出 |
| NFR-S4 | 配置文件权限为 600（仅用户可读写） | 创建后检查文件权限 |
| NFR-S5 | 安装目标路径不超出预期范围（防路径遍历） | 构造 `../` 路径测试 |
| NFR-S6 | 临时目录在安装完成后立即删除 | 安装后检查 `/tmp` |

### 可靠性

| NFR | 要求 | 验证方式 |
|-----|------|---------|
| NFR-R1 | 网络中断时不留残余文件 | 克隆过程中断网，检查文件系统 |
| NFR-R2 | 目标目录不存在时自动创建 | 删除目标目录后安装 |
| NFR-R3 | 安装步骤失败时 fail-fast | 模拟权限不足场景 |
| NFR-R4 | 部分安装失败时输出已完成操作清单 | 模拟中途失败 |
| NFR-R5 | manifest.json 损坏或丢失时降级为"所有文件视为未知来源" | 删除/损坏 manifest 后安装 |
| NFR-R6 | 符号链接目标不存在时输出明确警告 | 删除源文件后检查链接状态 |

### 兼容性

| NFR | 要求 | 验证方式 |
|-----|------|---------|
| NFR-C1 | macOS 完整支持（MVP） | macOS 端到端测试 |
| NFR-C2 | Linux 完整支持（MVP） | Linux CI 端到端测试 |
| NFR-C3 | Node.js >= 18.0.0 | 在 Node 18/20/22 上测试 |
| NFR-C4 | Git >= 2.20 | 验证浅克隆支持 |
| NFR-C5 | 路径处理使用 `path.join()`，不硬编码分隔符 | 代码审查 |
| NFR-C6 | Home 目录使用 `os.homedir()`，不存在时报错 | 模拟 HOME 未设置 |

### 集成

| NFR | 要求 | 验证方式 |
|-----|------|---------|
| NFR-I1 | 支持 HTTPS 和 SSH 两种 Git 协议 | 分别用两种协议克隆 |
| NFR-I2 | 支持 GitLab 和 GitHub 仓库 | 分别从两个平台克隆 |
| NFR-I3 | AI 工具检测基于标志性文件/目录，不依赖工具进程 | 工具未运行时检测 |
| NFR-I4 | 安装结果不影响 AI 工具的正常运行 | 安装后验证各工具功能 |

### 用户体验质量

| NFR | 要求 | 验证方式 |
|-----|------|---------|
| NFR-U1 | 默认中文，支持 `aiforge init` 选择语言，安装后可通过配置修改 | 切换语言后验证所有输出 |
| NFR-U2 | 错误信息包含可操作的修复建议 | 触发各类错误场景 |
| NFR-U3 | 进度展示使用 spinner 动画（TTY 环境） | 视觉验证 |
| NFR-U4 | 非 TTY 环境自动禁用 spinner 和彩色 | 管道输出测试 |
| NFR-U5 | `--dry-run` 输出与实际安装结果一致 | 对比 dry-run 和实际安装 |


## Innovation & Differentiators

**1. 标准适配器设计哲学** — 不推行标准，做标准翻译器。知识仓库保持自己的组织方式，aiforge 映射到每个工具的约定。新增工具只需添加翻译规则，不改引擎。

**2. 语义适配层架构** — 类似编译器前后端分离：前端理解四类资源语义，后端为每个工具生成正确的安装操作。新增资源类型或工具互不影响。

**3. 工具与知识的零信任解耦** — npm 包零敏感信息，知识仓库独立迭代，Token 仅在克隆过程中存在于内存。类似 Git 本身的设计：工具公开，仓库私有。

**4. 终端输出即对话** — 每一行输出回答用户脑中的一个问题：阶段式 spinner（在干嘛）、树形结果（装了什么）、三段式错误（什么坏了/为什么/怎么修）、零结果诊断（为什么什么都没装）。

### 竞品对比

| 维度 | Shell 脚本 | dotfiles 工具 | aiforge |
|------|-----------|--------------|---------|
| AI 工具语义理解 | ❌ | ❌ | ✅ |
| 多工具适配 | 单工具硬编码 | 通用文件管理 | 配置驱动规则映射 |
| 零配置可用 | ❌ | ❌ | ✅ 自动检测 |
| 安全性 | Token 硬编码 | 不涉及认证 | 零信任 + 四层认证 |
| 可扩展性 | 改脚本 | 改配置 | 加规则（不改引擎） |

### 验证与风险

| 创新点 | 验证方式 | 风险 | 降级方案 |
|--------|---------|------|---------|
| 标准适配器 | 4 工具全部正确安装 | 工具约定变更 | 更新规则配置 |
| 语义适配层 | 新增第 5 个工具只改配置 | 安装模式超出三种类型 | 扩展安装类型 |
| 零信任解耦 | `npm pack` 零公司信息 | 用户不理解分离配置 | `aiforge init` 引导 |
| 终端输出即对话 | 新员工不问人即完成配置 | 信息过载 | `--quiet` 模式 |


## Product Scope & Phased Development

### MVP 策略

**MVP 类型：问题解决型 MVP** — 不是"最小功能集"，而是"完整解决一个具体问题的最小产品"。核心路径必须端到端可用、可靠、安全。

**三原则：**
1. 一条命令解决问题
2. 安全不妥协（Token 安全、冲突保护、零结果诊断全部 MVP 实现）
3. 可扩展但不过度设计（配置驱动留接口，MVP 只实现内置规则）

**资源配置：** 1 人（chunxiao），Node.js (ESM)，核心依赖 commander.js + simple-git + ora + chalk。

### MVP Go/No-Go 门禁（全部通过才发布）

1. 端到端可用：对 aicoding-base 仓库完成全局 + 项目级安装，4 个工具全部正确
2. 新员工可用：小李画像的入职旅程可走通（init → 安装 → 确认生效）
3. 信任可建立：`--dry-run` 预览准确，冲突时有备份，零结果有诊断
4. 安全底线：npm 包零公司信息，Token 不出现在错误日志
5. 采用率信号：首批 5-10 人试用后愿意继续使用

### MVP 旅程支撑

| 旅程 | 支撑程度 | 说明 |
|------|---------|------|
| 小明首次安装 | 完整 | 核心价值路径 |
| 小李入职配置 | 完整 | 新用户获取路径 |
| 小明冲突处理 | 完整 | 信任建立的关键 |
| chunxiao 维护验证 | 完整 | 维护者效率提升 |
| 小明日常更新 | 部分 | 符号链接下 git pull 即可；`aiforge update` 在 M2 |
| 小李认证失败 | 完整 | 错误恢复体验 |
| CI/CD 自动化 | 不支撑 | M2/M3 |

### 范围决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| Windows 支持 | M2 | 公司以 macOS 为主 |
| `aiforge update` | M2 | 符号链接下 git pull 够用 |
| `aiforge.json` 自定义 | M3 | 内置规则映射表够用 |
| 格式转换（.mdc） | M3 | MVP 只做路径映射 |
| 增量更新（哈希比对） | M3 | manifest.json 奠基，MVP 不实现比对 |
| 语义类型系统 | P3 | MVP 用目录名匹配 |
| 规则包生态 | P3 | MVP 只支持单一 Git 仓库 |
| GIT_ASKPASS | M2 | MVP 基础认证可用 |
| keytar 密钥链 | M2 | MVP 用配置文件 + 环境变量 |

### MVP 范围裁剪与替代路径

以下能力被有意排除在 MVP 之外，并非遗漏：

| 裁剪项 | MVP 替代路径 | 风险 | 后续计划 |
|--------|------------|------|---------|
| `aiforge update` 命令 | 符号链接模式下 `cd ~/aicoding-base && git pull` 即可更新 | 项目级复制模式无自动更新路径，用户需手动重新安装 | M2 补齐 |
| CI/CD 完整自动化 | MVP 已支持：非 TTY 纯文本 + 退出码 + 环境变量认证，可基本用于 CI | 无并发安全、无 `CI_JOB_TOKEN` 原生支持 | M2/M3 补齐 |
| Windows 支持 | 公司以 macOS 为主，Windows 用户可通过 WSL 使用 | WSL 体验不如原生 | M2 补齐 |


### Growth Features（M2）

- `aiforge update` 仓库更新命令
- `aiforge list` 工具路径列表
- 补全工具矩阵：Windsurf、Codex CLI、Gemini CLI、Trae
- `.gitignore` 建议（项目级安装后自动提示）
- 认证安全加固（GIT_ASKPASS、keytar 密钥链）
- Windows 基础支持（符号链接自动降级到复制）
- 友好错误提示增强（VPN/代理/SSL 场景）
- CI/CD 基础支持（非交互式模式、环境变量认证）

### Enhancement Features（M3）

- `aiforge.json` 知识仓库自定义清单
- `aiforge uninstall` 卸载命令
- 增量更新（基于 manifest.json 的哈希比对）
- 格式转换（Skills → Cursor .mdc frontmatter）
- 安装日志审计
- 交互式文件选择
- 并发安全（文件锁）

### Vision（P3 远期）

- 语义类型系统：文件粒度的类型检测和映射
- 规则包生态系统：可独立分发的配置包，支持依赖管理和版本控制
- 插件系统：第三方编写插件适配新 AI 工具
- 知识仓库脚手架：`aiforge create` 生成仓库骨架
- CI/CD 集成模板

### 风险缓解策略

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| AI 工具目录约定变更 | 中 | 安装失败 | 配置驱动规则表，变化只改配置 |
| 开发者对"又一个工具"的疲劳 | 中 | 采用率不达标 | 零安装（npx）+ 一条命令 + `--dry-run` 建立信任 |
| Token 泄露 | 低 | 致命 | 错误脱敏 + 配置文件 0o600 + 克隆后清除 URL |
| 静默失败导致用户流失 | 高 | 高 | 零结果诊断 + 冲突检测 + 预检查 + fail-fast |
