---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
sharded: true
shards:
  - epic-1.md
  - epic-2.md
  - epic-3.md
  - epic-4.md
  - epic-5.md
  - epic-6.md
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

**精细化安装控制与通用目录（FR-047~053）：**
- FR-047: 用户可以通过 `--list <dir>` 列出仓库指定顶层目录下所有可安装子目录，不执行安装
- FR-048: 用户可以通过 `--filter <dir>/<glob>` 只安装名称匹配 glob 的子目录（单层匹配），零匹配时触发交互式询问
- FR-049: `--filter` 与 `--dirs` 可联合使用：有 `--dirs` 时 `--filter` 在其范围内筛选；无 `--dirs` 时对所有顶层目录筛选
- FR-050: 系统在执行安装时默认同时将资源完整复制到通用目标目录（`.agents/skills/`、`.agents/agents/`、`.agent/skills/`、`.agent/agents/`）
- FR-051: 用户可以通过 `--no-universal` 参数跳过通用目标目录的安装
- FR-052: 每次安装时检查通用目录中已安装文件是否有更新，有变更则重新同步
- FR-053: `aiforge init` 交互流程新增通用目录偏好询问（默认 yes），持久化到 `config.json`（`universalDirs: boolean`），CLI 参数可覆盖

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

**精细化控制与通用目录（NFR-P6, NFR-U6, NFR-C7）：**
- NFR-P6: `--list` 命令在持久化缓存命中场景下输出耗时 < 2 秒
- NFR-U6: `--filter` 零匹配时展示可用子目录列表，帮助用户修正 pattern
- NFR-C7: 通用目录写入复用现有安装引擎（复制模式），不引入新代码路径

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
| FR-047 | Epic 6 | `--list <dir>` 列举指定顶层目录下子目录 |
| FR-048 | Epic 6 | `--filter <dir>/<glob>` 精准安装，零匹配交互询问 |
| FR-049 | Epic 6 | `--filter` 与 `--dirs` 联合语义 |
| FR-050 | Epic 6 | 通用目录默认并行安装，完整结构复制 |
| FR-051 | Epic 6 | `--no-universal` opt-out 参数 |
| FR-052 | Epic 6 | 增量同步检查通用目录 |
| FR-053 | Epic 6 | `init` 交互新增通用目录偏好，持久化到 config.json |

## Epic List

### [Epic 1: 项目基础设施与核心框架（Foundation Sprint）](epic-1.md)

> **Sprint 性质说明：** 本 Epic 为技术基础设施准备（Foundation Sprint），不直接交付用户可感知的功能价值，但为所有后续 Epic 提供必要的项目骨架和核心抽象。

项目可构建、可测试，`npx aiforge --help` 可运行，核心抽象（错误体系、输出层、路径解析）就绪。所有后续 Epic 依赖此基础。

**覆盖：** Architecture 需求 1~20（基础设施部分）
**关键交付：** 项目初始化 + `core/*` + `data/*` + CLI 骨架（commander）+ 管道编排器骨架
**NFRs：** NFR-P4, NFR-C3~C6, NFR-S1

### [Epic 2: 知识仓库获取与认证](epic-2.md)

用户可以通过 `aiforge init` 配置认证，从私有 Git 仓库克隆知识内容。认证失败时获得友好的三段式修复建议。

**FRs 覆盖：** FR-001~012, FR-033, FR-040~042（共 17 条）
**关键交付：** `services/config.ts` + `stages/resolve-source.ts` + `services/git.ts` + `stages/authenticate.ts` + `stages/clone.ts` + `commands/init.ts`
**NFRs：** NFR-S2~S4, NFR-I1~I2, NFR-R1, NFR-P1~P3

### [Epic 3: 智能检测与安装规划](epic-3.md)

系统自动检测已安装的 AI 工具，生成安装计划。用户可以通过 `--dry-run` 预览"哪些文件会安装到哪里"，建立信任。

**FRs 覆盖：** FR-013~015, FR-023~024, FR-034, FR-043~045（共 9 条）
**关键交付：** `stages/detect-tools.ts` + `stages/match-rules.ts` + `stages/report.ts`（plan 模式）+ `pipeline.ts`（dry-run 分叉）
**NFRs：** NFR-P5, NFR-I3, NFR-U5

### [Epic 4: 安装执行与冲突保护](epic-4.md)

用户可以安全地将配置安装到所有检测到的工具中。支持复制/符号链接/flatten 三种模式，冲突时有备份保护，安装结果按工具分组展示。

**FRs 覆盖：** FR-016~022, FR-025~032（共 17 条）
**关键交付：** `stages/execute-install.ts`（含 preflight）+ `services/manifest.ts` + `services/fs-utils.ts` + `stages/report.ts`（result 模式）+ `pipeline.ts`（完整编排）
**NFRs：** NFR-R2~R6, NFR-S5~S6, NFR-I4

### [Epic 5: 端到端体验与发布就绪](epic-5.md)

精致的终端交互体验——阶段式 spinner 进度、按工具分组的树形结果、TTY/非TTY 自适应、quiet 模式、国际化支持。端到端集成测试通过，达到 MVP Go/No-Go 门禁标准。

**FRs 覆盖：** FR-035~039, FR-046（共 7 条）
**关键交付：** Reporter 三种实现完善 + `data/messages.ts` 完善 + 端到端集成测试 + 跨平台验证
**NFRs：** NFR-U1~U5, NFR-C1~C2

### [Epic 6: 精细化安装控制与通用目录适配](epic-6.md)

用户可以通过 `--list` 探索仓库结构、通过 `--filter` 精准安装指定子目录；aiforge 同时默认将配置写入行业新兴通用目标目录（`.agents/`、`.agent/`），确保跨工具兼容性。

**FRs 覆盖：** FR-047~053（共 7 条）
**关键交付：** `--list` 子命令逻辑 + `--filter` 参数解析与 Match 阶段过滤 + `BUILTIN_RULES` 通用目录规则 + `config.json universalDirs` 字段 + `aiforge init` 新增偏好步骤
**NFRs：** NFR-P6, NFR-U6, NFR-C7
