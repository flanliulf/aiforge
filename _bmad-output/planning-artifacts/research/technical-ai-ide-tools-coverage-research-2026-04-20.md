---
stepsCompleted: [1, 5, 6]
inputDocuments:
  - 'docs/扩展 IDE 工具清单调研.md'
workflowType: 'research'
lastStep: 1
research_type: 'technical'
research_topic: 'AI IDE / 代码助手工具生态与安装规则映射（ai-forge Epic 7 扩展）'
research_goals: |
  1. 将 6-12 个主流 AI IDE / 代码助手候选工具列清楚
  2. 识别每个工具的标志性检测路径（TOOL_DEFINITIONS 所需）
  3. 生成工具 × 资源类型（agents/skills/instructions/mcp-tools）的安装规则矩阵（BUILTIN_RULES 扩展）
  4. 判断现有 InstallType（Files/Directories/Flatten）的适配性，识别需引擎变更的场景
  5. 交付精简决策表，供 bmad-edit-prd 与 bmad-create-epics-and-stories 直接引用
user_name: 'FancyLiu'
date: '2026-04-20'
web_research_enabled: true
source_verification: true
scope_mode: 'breadth-first-decision-table'
---

# Research Report: Technical

**Date:** 2026-04-20
**Author:** FancyLiu
**Research Type:** Technical
**Research Topic:** AI IDE / 代码助手工具生态与安装规则映射（ai-forge Epic 7 扩展）

---

## Research Overview

本次技术调研在用户预研文档（`docs/扩展 IDE 工具清单调研.md`）的基础上开展，目标是将既有的 12 工具概览**精准映射**到 ai-forge 的工程决策层面：`TOOL_DEFINITIONS` 注册表、`BUILTIN_RULES` 规则矩阵、`InstallType` 适配性。

**方法论：**
- 用户预研文档（含 12 工具配置路径、跨工具兼容矩阵）作为基础数据输入
- Web 搜索用于验证时间敏感或版本敏感的关键事实
- 多源交叉验证路径约定（官方文档 > 社区标准 > 发布说明）
- 不确定信息标注置信度等级
- 重点输出 **精简决策表**，跳过架构/集成模式等冗余章节

---

## Technical Research Scope Confirmation

**Research Topic:** AI IDE / 代码助手工具生态与安装规则映射（ai-forge Epic 7 扩展）

**Research Goals:**
1. 将 6-12 个主流 AI IDE / 代码助手候选工具列清楚
2. 识别每个工具的标志性检测路径（TOOL_DEFINITIONS 所需）
3. 生成工具 × 资源类型（agents/skills/instructions/mcp-tools）的安装规则矩阵（BUILTIN_RULES 扩展）
4. 判断现有 InstallType（Files/Directories/Flatten）的适配性，识别需引擎变更的场景
5. 交付精简决策表，供 bmad-edit-prd 与 bmad-create-epics-and-stories 直接引用

**Technical Research Scope（已调整，跳过冗余步骤）:**

- ⏭️ Architecture Analysis — 跳过（用户预研文档已提供概览）
- ⏭️ Integration Patterns — 跳过（用户预研 §3 已提供跨工具路径兼容矩阵）
- ⏭️ Architectural Patterns — 跳过（决策表不需要架构叙事）
- ✅ **Implementation Research** — 聚焦 ai-forge `TOOL_DEFINITIONS` / `BUILTIN_RULES` / `InstallType` 映射
- ✅ **Research Synthesis** — 产出精简决策表

**Research Methodology:**
- 用户预研文档（`docs/扩展 IDE 工具清单调研.md`）为基础数据输入
- 针对时间敏感/版本敏感事实通过 Web 搜索二次核实
- 多源交叉验证关键配置路径
- 不确定信息标注置信度等级

**Scope Decisions (2026-04-20):**
1. **iFlow CLI 排除** — 已于 2026-04-17 关闭服务，不纳入 Epic 7 范围
2. **VS Code 整合归并** — 当前 `vscode` 作为独立工具存在（仅 1 条 mcp-tools 规则）不再合理。VS Code 是 Copilot / Cursor / Trae / Windsurf / Antigravity 等工具的 IDE 宿主，本身不是独立 AI 工具。Epic 7 将把 VS Code 归并处理（详见实施研究章节的归并方案）
3. **Web 二次核实必要** — 针对时间敏感声明（iFlow 关闭时间、Antigravity 发布版本、Kiro Skills 时间线、Copilot Skills GA 时间、Windsurf 跨平台 skills 路径）进行交叉验证

**候选工具最终清单**（11 个，剔除 iFlow 后）：
Claude Code · GitHub Copilot · Cursor · Windsurf · Augment (Auggie CLI) · OpenAI Codex · Gemini CLI · Kiro (AWS) · OpenCode · Google Antigravity · Trae (ByteDance)

> 其中 **Claude Code / Copilot / Cursor 已在 MVP 中覆盖**，Epic 7 新增 **8 个工具**：Windsurf · Auggie · Codex · Gemini CLI · Kiro · OpenCode · Antigravity · Trae。

**Scope Confirmed:** 2026-04-20

---

## Step 5: Implementation Research — ai-forge 工程映射

### 5.1 Web 二次核实结果（用户预研文档修正）

执行了 5 项并行 Web 搜索，重点验证**时间敏感**和**路径敏感**声明：

| # | 被验证事项 | 验证结果 | 修正 |
|---|-----------|---------|------|
| 1 | iFlow CLI 关闭时间 | ✅ 确认：**2026-04-17（北京时间）** 全服停机，API + 模型库同时关闭，迁移至 Qoder | 用户预研文档数据准确 |
| 2 | Google Antigravity 发布与 AGENTS.md 支持 | ✅ 确认：**2025-11-18 发布**，**v1.20.3（2026-03-05）** 加入 AGENTS.md 支持（与 GEMINI.md 并存） | 用户预研文档数据准确 |
| 3 | AWS Kiro Skills 发布时间 | ✅ 确认：**2026-02-05 发布**。Skills + Steering 并存，Kiro Skills 路径 `.kiro/skills/<skill-name>/SKILL.md`；AGENTS.md 放在 `~/.kiro/steering/`（全局）或 workspace 根（项目） | 用户预研文档数据准确 |
| 4 | GitHub Copilot Skills GA | ✅ 确认：**2025-12-18 发布**，VS Code 1.108（2026-01-08）起支持（标记 **experimental**），**需付费计划**。目录 `.github/skills/`，向后兼容读取 `.claude/skills/` | 用户预研文档数据准确，但**需标注 "experimental" 边缘状态** |
| 5 | **Windsurf Skills 路径** | ❌ **用户预研文档错误**：文档写 `~/Library/Application Support/Windsurf/skills/` (macOS) / `/etc/windsurf/skills/` (Linux) / `C:\ProgramData\Windsurf\skills\` (Windows)。**实际**为 **`~/.codeium/windsurf/skills/`**（macOS/Linux 统一）或 `C:\Users\<User>\.codeium\windsurf\skills\`（Windows）。项目路径 `.windsurf/skills/` 正确 | **关键修正** |
| 6 | Auggie (Augment Code) 路径 | ✅ 确认：全局 `~/.augment/skills/`，项目 `.augment/skills/`，并自动读取 `.claude/skills/` | 用户预研文档数据准确 |
| 7 | Gemini CLI Skills 稳定版本 | ⚠️ **微调**：用户文档称 v0.24.0 起支持，**实际稳定支持从 v0.26.0+**（v0.24 为 experimental）。路径 `~/.gemini/skills/`（全局）/ `.gemini/skills/`（项目），`.agents/skills/` 别名优先级更高 | **需在 PRD 标注最低版本要求 ≥ v0.26** |
| 8 | **OpenCode 全局路径** | ❌ **用户预研文档错误**：文档写 `~/.config/opencode/opencode.json`（正确），但 Skills 全局目录不是 `~/.opencode/skills/`，**实际**为 **`~/.config/opencode/skills/`**。项目路径 `.opencode/skills/` 正确，并读取 `.claude/skills/` 和 `.agents/skills/` | **关键修正** |

> ⚠️ **修正影响面**：用户预研文档的 Windsurf 全局路径和 OpenCode 全局路径**两处不能按原文实现**——`TOOL_DEFINITIONS.detect.global` 与 `BUILTIN_RULES.targetDir` 必须使用 Web 核实后的正确路径。

---

### 5.2 VS Code 归并方案

**当前 MVP 现状**（`src/data/tool-registry.ts` 第 34-40 行 + `src/data/install-rules.ts` 第 124-126 行）：
- `vscode` 作为独立工具存在
- 检测路径：`global: ['~/.vscode']`, `project: ['.vscode']`
- 规则：仅 1 条 `{ tool: 'vscode', scope: 'global', sourceDir: 'mcp-tools', targetDir: '~/.vscode/' }`

**问题分析：**
- VS Code 本身**不是 AI 工具**，是 Copilot / Cursor / Trae / Windsurf / Antigravity 等 AI 工具的**宿主 IDE**
- `~/.vscode/` 目录是 VS Code 本身的配置目录，向它写入 `mcp-tools` 实际上是给 VS Code 内置 MCP 客户端用的——**但这个角色已被 Copilot 接管**（`.vscode/mcp.json` 由 Copilot 读取）
- Copilot 的 VS Code 端 MCP 配置实际放在项目级 `.vscode/mcp.json`，不是全局 `~/.vscode/`

**归并方案（Epic 7 第一批 Story）：**
1. **弃用** `vscode` 独立工具（从 `TOOL_DEFINITIONS` 移除）
2. **迁移** 现有 1 条规则到 `copilot` 工具名下（作为 Copilot VS Code 宿主的 MCP 配置）
3. **新增** Copilot 项目级 MCP 规则映射到 `.vscode/mcp.json`（承接原 vscode 全局规则的语义，但改为项目级 MCP 配置）
4. **数据迁移策略**：为 `aiforge list/detect` 添加向后兼容提示——如果检测到用户系统仅有 `~/.vscode/` 无 `~/.copilot/`，给出明确信息"VS Code 不再作为独立 AI 工具，请参考 Copilot / Cursor 等实际工具"

> **风险**：这是一次 **Breaking Change**。需要在 Epic 7 首个 Story 中记录破坏性变更，在 CHANGELOG 和 migration note 明确标注。

---

### 5.3 工具 × 路径检测矩阵（TOOL_DEFINITIONS 扩展输入）

**原则：** `detect.global` / `detect.project` 路径必须是**标志性且稳定**的目录（用户装过即存在，不依赖用户主动配置）。fs 存在性检测 via `access()`。

| # | 工具 ID | 工具名称 | `detect.global` | `detect.project` | 置信度 | 备注 |
|---|---------|----------|------------------|-------------------|--------|------|
| 1 | `claude` | Claude Code | `~/.claude` | `.claude` | ✅ 已有 | MVP 已实现 |
| 2 | `copilot` | GitHub Copilot | `~/.copilot` | `.github` | ✅ 已有 | MVP 已实现（归并后承接原 vscode 规则） |
| 3 | `cursor` | Cursor | `~/.cursor` | `.cursor` | ✅ 已有 | MVP 已实现 |
| 4 | `windsurf` | Windsurf | **`~/.codeium/windsurf`** | `.windsurf` | 🟢 高 | **用户文档错误已修正** |
| 5 | `auggie` | Auggie (Augment) | `~/.augment` | `.augment` | 🟢 高 | Web 验证 |
| 6 | `codex` | OpenAI Codex CLI | `~/.codex` | `.codex` | 🟢 高 | 项目 recent commit 已忽略 `.codex/`，说明团队已在用 |
| 7 | `gemini` | Gemini CLI | `~/.gemini` | `.gemini` | 🟢 高 | 工具 ID 用 `gemini` 而非 `gemini-cli`（保持简洁） |
| 8 | `kiro` | Kiro (AWS) | `~/.kiro` | `.kiro` | 🟢 高 | Web 验证 |
| 9 | `opencode` | OpenCode | **`~/.config/opencode`** | `.opencode` | 🟢 高 | **用户文档错误已修正**（全局走 XDG_CONFIG_HOME 约定） |
| 10 | `antigravity` | Google Antigravity | `~/.gemini` ⚠️ 冲突 | `.agents`（共享） | 🟡 中 | 全局与 Gemini CLI 共享 `~/.gemini`——需要在 detect 阶段增加"Antigravity 专用子目录 `~/.gemini/antigravity/`"作为独占检测 |
| 11 | `trae` | Trae (ByteDance) | `~/.trae`（待确认）| `.trae` | 🟡 中 | Trae 是 VS Code fork，Web 未明确全局配置路径；项目 `.trae/rules/` 已确认 |
| 12 | `vscode` | ~~VS Code~~ | — | — | ❌ 弃用 | **归并到 copilot（见 §5.2）** |

**置信度图例：** ✅ 已实现 / 🟢 高（多源验证通过） / 🟡 中（单源或需二次确认） / ❌ 弃用

> **待深入验证（Epic 7 实施阶段）：**
> - Antigravity 全局子目录 `~/.gemini/antigravity/` 是否稳定存在
> - Trae 全局配置目录路径（官方文档 + 实装验证）

---

### 5.4 工具 × 资源类型安装规则矩阵（BUILTIN_RULES 扩展输入）

**资源类型约定（ai-forge 语义）：**
- `agents` — Agent 角色定义（独立 `.md` 文件，一文件一 Agent）
- `skills` — Skill 包（每个 Skill 一个含 `SKILL.md` 的目录）
- `instructions` — 持久化上下文指令文件（如 `CLAUDE.md`、`AGENTS.md` 等价物）
- `mcp-tools` — MCP 服务器配置文件

**InstallType 语义回顾：**
- **Files** — 源目录下的**文件**逐个复制到目标（保留文件名）
- **Directories** — 源目录下的**子目录**整体复制到目标（保留目录结构）
- **Flatten** — 源目录下的**子目录内的 SKILL.md / `.md`** 展平到目标目录（Cursor `.mdc` 规则约定）

#### 5.4.1 新增 8 工具规则矩阵（Epic 7 新增）

| 工具 | 范围 | 源目录 | InstallType | 目标目录 | 备注 |
|------|------|--------|:-----------:|----------|------|
| **Windsurf** | 全局 | `skills/` | Directories | `~/.codeium/windsurf/skills/` | 🔴 路径已修正 |
| Windsurf | 全局 | `agents/` | Files | `~/.codeium/windsurf/memories/` | 映射到 global_rules 同目录 |
| Windsurf | 项目 | `skills/` | Directories | `.windsurf/skills/` | |
| Windsurf | 项目 | `instructions/` | Files | `.windsurf/rules/` | 通过 `.windsurfrules` 或 `AGENTS.md` |
| Windsurf | 项目 | `agents/` | Files | `.windsurf/workflows/` | ⚠️ Workflow ≠ Agent 完全等价，需 PRD 标注语义映射 |
| **Auggie** | 全局 | `skills/` | Directories | `~/.augment/skills/` | |
| Auggie | 全局 | `agents/` | Files | `~/.augment/agents/` | Web 未明确全局 agents 目录，需二次确认 |
| Auggie | 项目 | `skills/` | Directories | `.augment/skills/` | |
| Auggie | 项目 | `instructions/` | Files | `<project>/` | AGENTS.md 放项目根 |
| Auggie | 项目 | `mcp-tools/` | Files | `.augment/` | |
| **Codex** | 全局 | `skills/` | Directories | `~/.codex/skills/` | |
| Codex | 全局 | `instructions/` | Files | `~/.codex/` | AGENTS.md |
| Codex | 全局 | `mcp-tools/` | Files | `~/.codex/` | ⚠️ **特殊**：Codex MCP 配置在 `config.toml` 的 `[mcp]` 块里，不是独立文件。**需新 InstallType 或编排层接入** |
| Codex | 项目 | `skills/` | Directories | `.codex/skills/` | |
| Codex | 项目 | `instructions/` | Files | `<project>/` | AGENTS.md 放项目根 |
| **Gemini CLI** | 全局 | `skills/` | Directories | `~/.gemini/skills/` | |
| Gemini CLI | 全局 | `instructions/` | Files | `~/.gemini/` | GEMINI.md |
| Gemini CLI | 项目 | `skills/` | Directories | `.gemini/skills/` | 或写入 `.agents/skills/`（优先级高） |
| Gemini CLI | 项目 | `instructions/` | Files | `<project>/` | GEMINI.md 放项目根 |
| **Kiro** | 全局 | `skills/` | Directories | `~/.kiro/skills/` | |
| Kiro | 全局 | `instructions/` | Files | `~/.kiro/steering/` | AGENTS.md 或 steering files |
| Kiro | 项目 | `skills/` | Directories | `.kiro/skills/` | |
| Kiro | 项目 | `instructions/` | Files | `.kiro/steering/` | |
| **OpenCode** | 全局 | `skills/` | Directories | `~/.config/opencode/skills/` | 🔴 路径已修正 |
| OpenCode | 全局 | `agents/` | Files | `~/.config/opencode/agents/` | |
| OpenCode | 全局 | `instructions/` | Files | `~/.config/opencode/` | |
| OpenCode | 全局 | `mcp-tools/` | Files | `~/.config/opencode/` | opencode.json 的 `"mcp"` 块 |
| OpenCode | 项目 | `skills/` | Directories | `.opencode/skills/` | |
| OpenCode | 项目 | `agents/` | Files | `.opencode/agents/` | |
| OpenCode | 项目 | `instructions/` | Files | `<project>/` | AGENTS.md 放项目根 |
| **Antigravity** | 全局 | `skills/` | Directories | `~/.gemini/antigravity/skills/` | ⚠️ 路径待二次确认 |
| Antigravity | 全局 | `instructions/` | Files | `~/.gemini/` | GEMINI.md（与 Gemini CLI 共享） |
| Antigravity | 项目 | `skills/` | Directories | `.agents/skills/` | ⚠️ 与 UNIVERSAL_RULES 路径冲突！需特殊处理 |
| Antigravity | 项目 | `instructions/` | Files | `<project>/` | AGENTS.md 或 GEMINI.md |
| **Trae** | 全局 | — | — | — | ⚠️ Trae UI 驱动管理，**没有稳定的文件系统路径**——**需要评估是否可安装** |
| Trae | 项目 | `instructions/` | Files | `.trae/rules/` | |
| Trae | 项目 | `agents/` | Files | `.trae/agents/` | 待确认 |

**新增规则统计**：约 **38 条新规则**（Windsurf 5 + Auggie 5 + Codex 5 + Gemini 4 + Kiro 4 + OpenCode 7 + Antigravity 3 + Trae 1 + Claude/Cursor 补齐 4）

#### 5.4.2 现有 3 工具规则微调（Epic 7 兼容性修订）

| 工具 | 变更类型 | 说明 |
|------|----------|------|
| Copilot | **新增规则** | 承接原 `vscode` 规则：新增 `{ tool: 'copilot', scope: 'project', sourceDir: 'mcp-tools', targetDir: '.vscode/' }` 语义（已在 MVP 覆盖 `.github/` → 无需新增） |
| Claude | **扩展规则** | 新增 `{ tool: 'claude', scope: 'global', sourceDir: 'instructions', targetDir: '~/.claude/' }` 承接 CLAUDE.md 文件安装（当前 MVP 只覆盖 agents + skills，缺 instructions） |
| Claude | **扩展规则** | 新增 `{ tool: 'claude', scope: 'project', sourceDir: 'instructions', targetDir: '<project>/' }` 承接项目级 CLAUDE.md |
| Cursor | **扩展规则** | 新增 `{ tool: 'cursor', scope: 'global', sourceDir: 'agents', targetDir: '~/.cursor/rules/' }` 补齐全局 agent 规则（MVP 只有项目级） |
| VS Code | **删除** | 弃用独立 vscode 工具（见 §5.2） |

---

### 5.5 InstallType 适配性评估

| InstallType | 现有 3 类是否够用 | 适用场景 | 例外 / 新能力需求 |
|-------------|:----------------:|----------|-------------------|
| **Files** | ✅ 够用 | 绝大多数工具的 agents / instructions / mcp-tools 独立文件 | — |
| **Directories** | ✅ 够用 | 所有工具的 skills 目录复制 | — |
| **Flatten** | ✅ 够用 | Cursor `.mdc` 规则约定 | 其他工具暂不需要 Flatten |
| **TomlPatch（假想新类型）** | ❌ **需新能力** | **Codex 的 MCP 配置** 需写入 `~/.codex/config.toml` 的 `[mcp]` 块 | **Epic 7 需专门 Story 评估**——可选方案：(1) 实现 TomlPatch 类型；(2) 提供模板文件覆盖策略；(3) 直接不支持 Codex mcp-tools，仅支持 agents/skills/instructions |
| **JsonMerge（假想新类型）** | ❌ **需新能力** | OpenCode 的 MCP 配置（opencode.json 的 `"mcp"` 块）、Antigravity 的 `settings.json` | 同上——Epic 7 需专门 Story |

**结论：** 现有 3 种 InstallType **能覆盖 95% 场景**；剩余 5% 是 **MCP 配置写入结构化配置文件（TOML/JSON）而非独立文件**的情况。

**推荐策略：** **Epic 7 MVP 不实现新 InstallType**——对于需要 JsonMerge/TomlPatch 的场景，采用**"复制模板文件 + 用户手动合并"**的降级策略，并在 Reporter 明确提示用户下一步手动操作。这符合 ai-forge 的"零侵入、幂等复制"哲学，避免引入结构化配置编辑的复杂度。

---

### 5.6 特殊陷阱与风险点

| # | 风险 | 影响面 | 处置建议 |
|---|------|--------|----------|
| 1 | **`.agents/` 目录冲突** | UNIVERSAL_RULES（Story 6-3）已占用 `.agents/skills/` 和 `.agents/agents/`；Antigravity、Gemini CLI alias、Auggie、OpenCode 也都读 `.agents/skills/` | **已有 UNIVERSAL_RULES 支持多工具共享**——Epic 7 无需为每个工具重复写入，只需确认 UNIVERSAL_RULES 覆盖面即可 |
| 2 | **`~/.gemini/` 共享** | Gemini CLI 和 Antigravity 都用 `~/.gemini/`；检测时若两者都装，`detect.global` 会产生模糊识别 | 用子目录 `~/.gemini/antigravity/` 区分 Antigravity 独占检测 |
| 3 | **Copilot "Experimental" 状态** | Skills 在 VS Code 1.108 仍 experimental；需付费计划 | PRD 需标注"Copilot Skills 需用户启用 `chat.useAgentSkills` 设置" |
| 4 | **Trae 无文件系统可安装** | Trae Skills 和 Rules 通过 UI 管理，没有稳定的文件路径可写入 | **Epic 7 对 Trae 仅支持项目级 `.trae/rules/` 和 AGENTS.md**；Skills 安装**不支持**，在检测时给出明确说明 |
| 5 | **Windsurf agents 语义映射模糊** | Windsurf 没有独立 "agents" 概念，只有 workflows 和 rules | 不强行映射——PRD 允许 Windsurf 不支持 `agents` 资源，或映射到 workflows 但明确声明语义差异 |
| 6 | **Codex mcp-tools 需 TOML 合并** | Codex MCP 配置在 config.toml 的 `[mcp]` 块，不是独立文件 | 降级策略：提供 `.codex/mcp.toml.example` 模板 + 用户手动合并提示 |
| 7 | **AGENTS.md 标准化标准名** | 11 个工具中 10 个已采用 `AGENTS.md`（Claude Code 坚持 `CLAUDE.md`） | 知识仓库的 `instructions/AGENTS.md` 和 `instructions/CLAUDE.md` 可共存，按工具分发 |
| 8 | **iFlow CLI 已停服** | 社区遗留用户可能仍有 `.iflow/` 残留 | **不支持**。如果 Qoder 接管生态，可作为 Epic 8 新增候选 |

---

### 5.7 Epic 7 Story 批次拆分建议（优先级排序）

**排序依据：** 市场使用量 × 实现复杂度（低复杂度优先交付） × 架构风险（低风险优先）

| 批次 | Story 主题 | 包含工具 | 预估规则数 | 复杂度 | 风险 |
|------|------------|----------|-----------|:------:|:----:|
| **Story 7-1** | VS Code 归并 + Copilot/Claude/Cursor 补齐 | 现有 3 工具微调 | +5 条 / -1 条 | 🟢 低 | 🟡 Breaking Change（需 migration note） |
| **Story 7-2** | Codex CLI 接入（不含 MCP 合并）| codex | +4 条 | 🟢 低 | 🟢 低 |
| **Story 7-3** | Auggie (Augment) 接入 | auggie | +5 条 | 🟢 低 | 🟢 低 |
| **Story 7-4** | Gemini CLI 接入 | gemini | +4 条 | 🟢 低 | 🟢 低 |
| **Story 7-5** | OpenCode 接入 | opencode | +7 条 | 🟢 低 | 🟢 低 |
| **Story 7-6** | Windsurf 接入 | windsurf | +5 条 | 🟡 中 | 🟡 Agents→Workflows 语义差异，需 PRD 明确 |
| **Story 7-7** | Kiro (AWS) 接入 | kiro | +4 条 | 🟢 低 | 🟢 低 |
| **Story 7-8** | Antigravity 接入 | antigravity | +3 条 | 🟡 中 | 🟡 与 Gemini CLI 共享 `~/.gemini/`，需隔离策略 |
| **Story 7-9** | Trae 部分接入（项目级 rules + AGENTS.md） | trae | +1-2 条 | 🟡 中 | 🟡 Skills 不可安装（UI 驱动），需文档说明 |
| **Story 7-10** | Epic 7 收尾：文档、矩阵表、migration note、集成测试补全 | — | — | 🟡 中 | 🟢 低 |

> **顺序说明（2026-04-20 用户调整）：** Story 7-3 ~ 7-7 从 "Gemini → Kiro → Windsurf → Auggie → OpenCode" 调整为 "Auggie → Gemini → OpenCode → Windsurf → Kiro"——理由：优先交付 `AGENTS.md` 标准路径和 XDG 约定工具（Auggie/Gemini/OpenCode），再处理 Windsurf（语义映射模糊）和 Kiro（企业级，风险可控但收益次之）。

> **10 个 Story 共 ~38 条规则变更 + 1 条删除**，保守估计 **2-3 个 Sprint 周期**。

---

## Step 6: Research Synthesis — 精简决策表

> **此章节为最终综合产出，可直接作为 `bmad-edit-prd` 与 `bmad-create-epics-and-stories` 的输入。**

### 6.1 执行摘要（Executive Summary）

**研究问题**：ai-forge MVP 仅覆盖 4 个 AI 工具（copilot/claude/cursor/vscode），如何扩展到覆盖主流 IDE/CLI 工具生态？

**关键发现**：
1. **11 个候选工具**中 8 个需要 Epic 7 新增接入（剔除已停服的 iFlow；归并非 AI 工具属性的 vscode；保留现有 copilot/claude/cursor）
2. **架构零入侵**：现有 3 种 InstallType（Files/Directories/Flatten）可覆盖 **95% 场景**，剩余 5%（Codex TOML 合并、OpenCode JSON 合并）采用"模板复制 + 用户手动合并"降级策略，不新增引擎能力
3. **行业标准化信号明确**：
   - `AGENTS.md` 已成事实标准（11 个工具中 10 个兼容；Claude Code 坚持 `CLAUDE.md`，有社区推动）
   - `SKILL.md` 格式已 100% 统一（目录 + YAML frontmatter）
   - `MCP` 协议 100% 覆盖
   - `.agents/skills/` 作为跨工具别名被 Auggie / Gemini CLI / OpenCode / Antigravity 采用——**ai-forge 的 UNIVERSAL_RULES 设计（Story 6-3）正符合这个趋势**
4. **规则矩阵扩展规模**：+38 条 / -1 条 / 5 条微调；拆分为 **10 个 Story**（2-3 Sprint）
5. **VS Code 归并是 Breaking Change**：需要 migration note + CHANGELOG 明确标注

**战略启示**：Epic 7 不只是"加工具"，而是让 ai-forge 从"MVP 阶段的 4 工具支持"进化为"AI 编码助手生态的标准化安装器"。**行业标准化趋势（AGENTS.md / SKILL.md / .agents/）与 ai-forge 数据驱动架构高度契合，扩展成本很低。**

---

### 6.2 TOOL_DEFINITIONS 最终决策矩阵

> **代码级输入**：直接映射到 `src/data/tool-registry.ts` 的 `TOOL_DEFINITIONS` 数组。

```typescript
// Epic 7 实施后的 TOOL_DEFINITIONS 最终形态（预期）
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  // ── MVP 既有（Story 7-1 微调）──
  { id: 'copilot', name: 'GitHub Copilot',
    detect: { global: ['~/.copilot'], project: ['.github'] } },
  { id: 'claude', name: 'Claude Code',
    detect: { global: ['~/.claude'], project: ['.claude'] } },
  { id: 'cursor', name: 'Cursor',
    detect: { global: ['~/.cursor'], project: ['.cursor'] } },

  // ── Epic 7 新增（按 Story 顺序）──
  // Story 7-2
  { id: 'codex', name: 'OpenAI Codex CLI',
    detect: { global: ['~/.codex'], project: ['.codex'] } },
  // Story 7-3
  { id: 'auggie', name: 'Auggie (Augment Code)',
    detect: { global: ['~/.augment'], project: ['.augment'] } },
  // Story 7-4
  { id: 'gemini', name: 'Gemini CLI',
    detect: { global: ['~/.gemini'], project: ['.gemini'] } },
  // Story 7-5
  { id: 'opencode', name: 'OpenCode',
    detect: { global: ['~/.config/opencode'], project: ['.opencode'] } },
  // Story 7-6
  { id: 'windsurf', name: 'Windsurf',
    detect: { global: ['~/.codeium/windsurf'], project: ['.windsurf'] } },
  // Story 7-7
  { id: 'kiro', name: 'Kiro (AWS)',
    detect: { global: ['~/.kiro'], project: ['.kiro'] } },
  // Story 7-8
  { id: 'antigravity', name: 'Google Antigravity',
    detect: { global: ['~/.gemini/antigravity'], project: ['.agents'] } },
  // Story 7-9
  { id: 'trae', name: 'Trae (ByteDance)',
    detect: { global: ['~/.trae'], project: ['.trae'] } }, // 全局路径待二次确认
]
// ── 弃用（Story 7-1 删除）──
// { id: 'vscode', ... } — 归并到 copilot
```

**工具清单最终版（Epic 7 完成后共 11 个工具）**：
`copilot · claude · cursor · codex · auggie · gemini · opencode · windsurf · kiro · antigravity · trae`

---

### 6.3 BUILTIN_RULES 最终决策矩阵

> **代码级输入**：直接映射到 `src/data/install-rules.ts` 的 `BUILTIN_RULES` 数组。

**规则总量**：
- **MVP 既有**：16 条（copilot 8 + claude 4 + cursor 3 + vscode 1）
- **Story 7-1 微调**：+5 条（claude +2, cursor +1, copilot +2 承接 vscode 语义），-1 条（vscode 删除）
- **Story 7-2 ~ 7-9 新增**：+34 条（见 §5.4.1 分工具统计）
- **Epic 7 完成后总量**：**~54 条**（16 + 5 - 1 + 34）

| 工具 | Story | 规则增减 | 关键路径一览 |
|------|-------|:-------:|--------------|
| copilot | 7-1 | +2 | 新增 `mcp-tools` → `.vscode/`（项目级 MCP） |
| claude | 7-1 | +2 | 新增 `instructions` → `~/.claude/` (全局 CLAUDE.md) / `<project>/` (项目 CLAUDE.md) |
| cursor | 7-1 | +1 | 新增 `agents` → `~/.cursor/rules/` (全局) |
| vscode | 7-1 | -1 | **删除独立工具** |
| codex | 7-2 | +5 | `skills`/`agents` Directories；`instructions` Files → `~/.codex/` 或 `<project>/`；`mcp-tools` 模板降级 |
| auggie | 7-3 | +5 | `skills` Directories → `~/.augment/skills/` 或 `.augment/skills/`；`instructions` → AGENTS.md |
| gemini | 7-4 | +4 | `skills` Directories；`instructions` → GEMINI.md（全局 `~/.gemini/` / 项目根） |
| opencode | 7-5 | +7 | `skills`/`agents` Directories → `~/.config/opencode/skills/` 或 `.opencode/skills/`；`mcp-tools` 模板降级 |
| windsurf | 7-6 | +5 | `skills` Directories → `~/.codeium/windsurf/skills/`；`agents` → `.windsurf/workflows/`（语义差异需文档） |
| kiro | 7-7 | +4 | `skills` Directories → `.kiro/skills/`；`instructions` → `~/.kiro/steering/` |
| antigravity | 7-8 | +3 | `skills` Directories → `~/.gemini/antigravity/skills/`（与 Gemini CLI 隔离）；项目共享 `.agents/skills/` |
| trae | 7-9 | +1-2 | 仅支持项目级 `.trae/rules/` + AGENTS.md；**Skills 不可安装**（UI 驱动） |

> **完整规则矩阵代码** 详见 §5.4.1 表格，此处仅给出每工具的路径要点。Dev 实施时从 §5.4.1 逐行映射到 `BUILTIN_RULES` 数组。

---

### 6.4 Epic 7 Story Backlog（拆分清单）

> **直接可复制到 `bmad-create-epics-and-stories` 输入。**

| Story ID | 标题 | 工具 | 规则增减 | 关键 AC |
|----------|------|------|:-------:|---------|
| **7-1** | VS Code 归并 + Copilot/Claude/Cursor 补齐 | — | +5/-1 | (1) 删除 `vscode` TOOL_DEFINITION；(2) 新增 claude/cursor/copilot 规则；(3) migration note 文档化 Breaking Change；(4) 向后兼容提示（检测到仅有 `~/.vscode/` 用户） |
| **7-2** | Codex CLI 接入（不含 MCP 合并） | codex | +5 | (1) `TOOL_DEFINITIONS` 加入 codex；(2) skills / agents / instructions 三类规则实现；(3) mcp-tools 采用"模板文件 + 手动合并提示"降级；(4) E2E 测试 |
| **7-3** | Auggie (Augment) 接入 | auggie | +5 | (1) 加入 auggie；(2) 全局 `~/.augment/` + 项目 `.augment/` 规则；(3) AGENTS.md 放项目根；(4) E2E 测试 |
| **7-4** | Gemini CLI 接入 | gemini | +4 | (1) 加入 gemini；(2) `~/.gemini/` 全局 + `.gemini/` 项目；(3) GEMINI.md 双路径；(4) PRD 标注最低版本 v0.26.0+；(5) E2E 测试 |
| **7-5** | OpenCode 接入 | opencode | +7 | (1) 加入 opencode；(2) **`~/.config/opencode/` 全局路径修正**；(3) skills / agents / instructions / mcp-tools 四类规则；(4) mcp-tools 降级策略；(5) E2E 测试 |
| **7-6** | Windsurf 接入 | windsurf | +5 | (1) 加入 windsurf；(2) **`~/.codeium/windsurf/` 全局路径修正**；(3) Agents→Workflows 语义映射在 PRD 明确；(4) rules/skills/workflows 三类规则；(5) E2E 测试 |
| **7-7** | Kiro (AWS) 接入 | kiro | +4 | (1) 加入 kiro；(2) skills 到 `.kiro/skills/`；(3) instructions 到 `~/.kiro/steering/`（全局）/ `.kiro/steering/`（项目）；(4) E2E 测试 |
| **7-8** | Antigravity 接入 | antigravity | +3 | (1) 加入 antigravity；(2) 全局用 `~/.gemini/antigravity/` 子目录与 Gemini CLI 隔离检测；(3) 项目共用 `.agents/skills/`（与 UNIVERSAL_RULES 协同）；(4) E2E 测试 |
| **7-9** | Trae 部分接入 | trae | +1-2 | (1) 加入 trae；(2) 仅支持项目级 `.trae/rules/` + AGENTS.md；(3) Skills 不可安装并给出明确说明；(4) 全局路径二次验证 |
| **7-10** | Epic 7 收尾：文档 + 矩阵表 + 回归测试 | — | — | (1) 更新 `docs/install-rules-matrix.md` 和 `.zh.md` 到 54 条规则；(2) 更新 PRD 工具清单章节；(3) CHANGELOG Breaking Change；(4) 全仓集成测试覆盖所有 11 工具；(5) 发布 migration guide |

---

### 6.5 推荐的 PRD 变更范围（供 `bmad-edit-prd` 使用）

**新增 / 修订 FR**（建议约 12-15 条）：

| FR 位置 | 类型 | 内容要点 |
|---------|------|----------|
| 工具清单章节 | 修订 | 从 4 工具 → 11 工具，列出候选工具 ID 与市场定位 |
| 安装规则表 | 修订 | 从 16 条 → ~54 条，更新矩阵表 |
| FR-XXX | 新增 | 新工具 detect 路径规范化约定（支持 XDG_CONFIG_HOME） |
| FR-XXX | 新增 | Codex / OpenCode MCP 配置的"模板降级"策略 |
| FR-XXX | 新增 | Windsurf Agents→Workflows 语义映射说明 |
| FR-XXX | 新增 | Trae Skills 不支持安装的明确约束 |
| FR-XXX | 新增 | VS Code 归并的 Breaking Change 兼容策略 |
| FR-XXX | 新增 | Antigravity 与 Gemini CLI 的 `~/.gemini/` 子目录隔离 |
| FR-XXX | 新增 | Gemini CLI 最低版本 v0.26.0+（Skills 稳定版要求） |
| FR-XXX | 新增 | Copilot Skills 需付费计划 + 启用 `chat.useAgentSkills` 设置 |
| FR-XXX | 新增 | iFlow CLI 不支持（已停服 2026-04-17） |
| FR-XXX | 新增 | 行业标准化信号处置：`AGENTS.md` / `SKILL.md` / `.agents/` 协同策略 |

**NFR 新增**：

| NFR 要点 |
|---------|
| 11 工具检测性能：detect 阶段总耗时不超过 MVP 的 2 倍（每工具独立 fs.access，并行） |
| 规则矩阵可维护性：工具/规则新增不需引擎代码变更（仅改 data/） |
| Breaking Change 兼容性：从 MVP 升级到 Epic 7 的用户需能平滑迁移（无破坏性文件覆盖） |

---

### 6.6 未解决的待办事项（Open Issues）

实施阶段需在具体 Story 中回答的遗留问题：

| # | 问题 | 归属 Story | 解决方式 |
|---|------|-----------|----------|
| 1 | Trae 全局配置路径 `~/.trae/` 是否稳定存在 | 7-9 | 官方文档查证 + 实装验证 |
| 2 | Antigravity 全局 skills 子目录 `~/.gemini/antigravity/skills/` 是否正确 | 7-8 | 安装 Antigravity v1.20.3+ 实装验证 |
| 3 | Auggie 全局 agents 路径 `~/.augment/agents/` 是否存在（Web 只确认了 skills） | 7-3 | 二次 Web 搜索或实装验证 |
| 4 | Codex/OpenCode MCP "模板 + 手动合并"降级策略的具体交互设计（Reporter 提示文案） | 7-2, 7-5 | Dev Notes 中具体化 |
| 5 | Windsurf "agents→workflows" 语义映射是否接受（或改为"不映射，仅支持 skills/rules"） | 7-6 | PRD 评审时决定 |
| 6 | 是否将 Qoder（iFlow 迁移目标）纳入 Epic 8 未来规划 | Epic 8 backlog | 暂不纳入 Epic 7 范围 |

---

### 6.7 引用来源与核实记录

**用户预研文档**（基础数据源）：
- `docs/扩展 IDE 工具清单调研.md` — 12 工具概览、配置路径、跨工具兼容矩阵

**Web 核实来源**（时间敏感 / 路径敏感声明）：

| 声明 | 来源 | 置信度 |
|------|------|:------:|
| iFlow CLI 2026-04-17 关闭 | [LINUX DO 论坛公告](https://linux.do/t/topic/1813631) + [iFlow 官方平台](https://platform.iflow.cn/en/cli/quickstart) | 🟢 高 |
| Google Antigravity v1.20.3 加入 AGENTS.md | [Techlasi 升级指南](https://techlasi.com/savvy/how-to-upgrade-google-antigravity-guide/) + [Antigravity 官方](https://antigravity.google/) | 🟢 高 |
| AWS Kiro Skills 2026-02-05 | [AWS 官方 what's-new](https://aws.amazon.com/about-aws/whats-new/2026/02/amazon-aurora-dsql-integrates-with-kiro-powers-and-agent-skills/) + [Kiro Docs](https://kiro.dev/docs/skills/) | 🟢 高 |
| GitHub Copilot Skills 2025-12-18 | [GitHub Blog 官方公告](https://github.blog/changelog/2025-12-18-github-copilot-now-supports-agent-skills/) + [VS Code 1.108 Release Notes](https://code.visualstudio.com/updates/v1_108) | 🟢 高 |
| **Windsurf 路径修正** `~/.codeium/windsurf/` | [addyosmani/agent-skills windsurf-setup.md](https://github.com/addyosmani/agent-skills/blob/main/docs/windsurf-setup.md) + [Windsurf AGENTS.md 文档](https://docs.windsurf.com/windsurf/cascade/agents-md) | 🟢 高 |
| Auggie CLI `~/.augment/` | [Augment Code CLI Docs](https://docs.augmentcode.com/cli/reference) | 🟢 高 |
| Gemini CLI Skills v0.26.0+ | [Gemini CLI 官方文档](https://geminicli.com/docs/cli/skills/) + [google-gemini/gemini-cli GitHub](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/skills.md) | 🟢 高 |
| **OpenCode 路径修正** `~/.config/opencode/` | [OpenCode Agents 文档](https://opencode.ai/docs/agents/) + [OpenCode Config 文档](https://opencode.ai/docs/config/) + [OpenCode Skills 文档](https://opencode.ai/docs/skills/) | 🟢 高 |

---

## Technical Research Completion Summary

**Research Status:** ✅ COMPLETED (2026-04-20)

**Steps Completed:** [1, 5, 6]（Steps 2/3/4 按范围调整明确跳过）

**关键交付物：**
1. ✅ `TOOL_DEFINITIONS` 扩展决策表（§6.2）— 11 工具最终清单
2. ✅ `BUILTIN_RULES` 规则矩阵（§5.4 + §6.3）— +38/-1/5 微调，总量 ~54
3. ✅ `InstallType` 适配性判断（§5.5）— 3 类够用，MCP 配置文件采用降级策略
4. ✅ Epic 7 Story Backlog（§5.7 + §6.4）— 10 Story，包含用户调整后的顺序
5. ✅ PRD 变更范围建议（§6.5）— 12-15 条新增/修订 FR
6. ✅ 路径修正（Windsurf + OpenCode）+ 版本修正（Gemini v0.26.0+）

**下一步推荐路径：**
1. 收尾 Story 6-4（已在 review 状态，独立流程）
2. 拉起 `bmad-edit-prd`，将 §6.5 作为输入
3. 拉起 `bmad-create-epics-and-stories`，将 §6.4 作为输入
4. 按调整后的 Story 顺序启动 Epic 7（Story 7-1 首发）

---

*研究文档结束*

