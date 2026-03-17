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

4 工具 × 4 资源类型 × 2 范围 × 3 安装类型 = 理论上 96 种组合。MVP 实际只用到约 14 条规则，但需要确保规则匹配引擎的设计能优雅处理规则增长（M2 新增工具、M3 自定义规则）。

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

