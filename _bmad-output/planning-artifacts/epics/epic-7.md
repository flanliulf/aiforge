---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories']
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture/03-core-decisions.md
  - _bmad-output/planning-artifacts/architecture/04-implementation-patterns.md
  - _bmad-output/planning-artifacts/research/technical-ai-ide-tools-coverage-research-2026-04-20.md
  - _bmad-output/planning-artifacts/epic-7-progress.md
project_name: 'ai-forge'
scope: 'Epic 7 专项（Epic 1-6 已完成，本文件专注 Epic 7 需求提取与 Story 设计）'
---

# ai-forge — Epic 7 Story 规划

## 背景

**Epic 1-6 状态：全部 Done**（见 `sprint-status.yaml`）。本文件专门为 **Epic 7：AI IDE 工具覆盖扩展（v2.0）** 提取需求并拆解 Story。

Epic 7 是 ai-forge 从"4 工具 MVP"进化为"AI 编码助手生态标准化安装器"的关键里程碑（Breaking Change，v1.x → v2.0）。

---

## Requirements Inventory

### Functional Requirements

> Epic 7 直接关联的 FR（全量 FR-001~FR-046 属于 MVP 基线，已由 Epic 1-6 实现；以下仅列出 Epic 7 相关 FR）

**MVP 基线受 Epic 7 影响的 FR（需微调或验证）：**

- FR-013: 系统可以自动扫描用户环境中已安装的 AI 编码工具（详见 FR-047 工具清单，Epic 7 共 11 个工具）
- FR-043: 平台维护者可以通过修改安装规则配置新增 AI 工具支持，无需修改引擎代码
- FR-044: 系统的安装规则映射表支持 files、directories、flatten 三种安装类型

**Epic 7 新增 FR（FR-047~FR-058）：**

**工具支持扩展：**
- FR-047: 系统支持 11 个 AI IDE / 代码助手工具的检测与安装：`copilot`、`claude`、`cursor`（MVP 既有）以及 `codex`、`auggie`、`gemini`、`opencode`、`windsurf`、`kiro`、`antigravity`、`trae`（Epic 7 新增）
- FR-048: 系统在检测工具全局配置路径时遵循 XDG_CONFIG_HOME 约定（如 OpenCode 使用 `~/.config/opencode/` 而非 `~/.opencode/`）
- FR-049: 系统对 Antigravity 工具使用 `~/.gemini/antigravity/` 子目录作为独占检测路径，避免与 Gemini CLI 共享 `~/.gemini/` 时的工具识别冲突
- FR-050: 系统在检测到用户环境仅存在 `~/.vscode/` 而无 `~/.copilot/` 时，输出明确的 migration 指引，说明 VS Code 不再作为独立 AI 工具（归并到 Copilot 语境下的 `.vscode/mcp.json` 项目级 MCP 配置）
- FR-051: 系统明确不支持 iFlow CLI（已于 2026-04-17 全服停机，API + 模型库同步关闭）；在检测到 `.iflow/` 残留目录时给出无操作提示

**降级策略与能力约束：**
- FR-052: 系统对需写入结构化配置文件的 MCP 资源（Codex `~/.codex/config.toml` 的 `[mcp]` 块、OpenCode `~/.config/opencode/opencode.json` 的 `"mcp"` 块）采用"模板文件复制 + Reporter 输出手动合并提示"的降级策略，不引入 TOML/JSON 结构化编辑能力
- FR-053: 系统将 Windsurf 的 `agents` 资源映射到 `.windsurf/workflows/`，在 Reporter 明确声明语义差异（Windsurf Workflow ≠ 通用 Agent 概念），允许用户选择跳过
- FR-054: 系统明确 Trae 工具的 Skills 资源不支持文件系统安装（Trae Skills 通过 UI 驱动管理，无稳定文件路径）；Trae 仅支持项目级 `.trae/rules/` 和项目根 `AGENTS.md` 的安装

**工具版本与前置条件：**
- FR-055: 系统要求 Gemini CLI 最低版本 v0.26.0+（Skills 稳定版），低版本用户在检测阶段给出版本不足的明确提示
- FR-056: 系统提示 GitHub Copilot Skills 的启用前置条件：付费计划（Copilot Pro/Business/Enterprise）+ 启用 VS Code 设置 `chat.useAgentSkills`（VS Code 1.108+），该能力处于 experimental 状态

**行业标准协同：**
- FR-057: 系统支持 `AGENTS.md` 作为跨工具指令文件标准（11 个候选工具中 10 个兼容，Claude Code 坚持 `CLAUDE.md`），在 instructions 源目录下按工具分发到各自目标路径
- FR-058: 系统允许知识仓库 `instructions/` 目录同时存在 `CLAUDE.md` 与 `AGENTS.md` 两个指令文件，按目标工具的约定分发（Claude Code 分发 `CLAUDE.md`，其他工具分发 `AGENTS.md`），避免用户重复维护

---

### NonFunctional Requirements

> Epic 7 新增 3 条 NFR，依托 D5a（数据驱动注册表）架构约束：

- NFR-P6: Epic 7 扩展后 11 工具检测总耗时 **< 1000 毫秒**（≤ NFR-P5 基线 2 倍）— 测试：11 工具全扫描计时（并行检测方式）
- NFR-I5: 新增 AI 工具或安装规则无需修改引擎代码，仅通过工具注册表与规则配置变更完成（Epic 7 验证：8 个新工具接入不改引擎实现层）— 测试：代码审查 + 集成测试覆盖率统计
- NFR-C7: 从 MVP（v1.0）升级到 Epic 7（v2.0）的现有用户需平滑迁移：`aiforge` 运行不得破坏性覆盖或删除 `~/.vscode/` 中 MVP 已安装的 MCP 配置；归并语义变更通过 migration note + CHANGELOG + `--dry-run` 提示显式化 — 测试：模拟 MVP 用户环境升级到 v2.0 后运行全流程

---

### Additional Requirements

> 架构文档（03-core-decisions.md / 04-implementation-patterns.md）提炼的 Epic 7 实施约束：

**来自 D5a（数据驱动注册表）：**
- 每个新工具只需在 `src/data/tool-registry.ts` 的 `TOOL_DEFINITIONS` 数组中新增一条 `ToolDefinition`（含 `id`、`name`、`detect.global[]`、`detect.project[]`），不修改检测引擎逻辑
- `--tools` 手动指定时按 id 查找，跳过 fs 检测
- 检测逻辑统一：遍历注册表，并行检查标志路径是否存在（parallel fs.access）

**来自 D2a/D2b（规则存储 + 索引）：**
- 每条新规则在 `src/data/install-rules.ts` 的 `BUILTIN_RULES` 数组中新增一个 `InstallRule` 对象
- 规则 Map 索引 key 为 `${tool}:${scope}`，运行时 O(1) 查找
- `data/` 模块有零运行时依赖要求，引用 enum 需使用 `import type` + 字符串字面量断言

**来自 D5b（PathResolver）：**
- 新工具路径必须通过 `PathResolver.toolGlobalDir(toolId)` 和 `PathResolver.toolProjectDir(toolId)` 集中管理
- XDG_CONFIG_HOME 路径（如 OpenCode `~/.config/opencode/`）需在 PathResolver 层正确展开

**来自 04-implementation-patterns.md（横切关注点检查清单）：**
- Epic 7 涉及修改 `src/data/tool-registry.ts` + `src/data/install-rules.ts` 等共享资源，Story 7-1（尤其 Breaking Change）属于横切关注点，必须执行三步清单（影响面 grep → 逐文件处置 → 分组检查报告）
- 新增 TOOL_DEFINITION 后必须同步检查：PathResolver 是否需要更新、BUILTIN_RULES 是否有对应规则、检测逻辑是否有分支依赖旧 ID

**TOOL_DEFINITIONS 最终形态（研究文档 §6.2 代码级输入）：**
```
MVP 既有（Story 7-1 微调）：copilot / claude / cursor
Epic 7 新增（按 Story 顺序）：codex(7-2) / auggie(7-3) / gemini(7-4) /
  opencode(7-5) / windsurf(7-6) / kiro(7-7) / antigravity(7-8) / trae(7-9)
弃用（Story 7-1 删除）：vscode（归并到 copilot）
```

**BUILTIN_RULES 规模变化（研究文档 §6.3）：**
```
MVP 既有：16 条
Story 7-1 微调：+5 条 / -1 条（vscode 删除）
Story 7-2~7-9 新增：+34 条
Epic 7 完成：~54 条总量
```

---

### UX Design Requirements

不适用（ai-forge 为纯 CLI 工具，无视觉 UX 设计文档）。

**CLI 行为约束（来自 Epic 7 新增场景）：**
- MCP 降级策略场景：Reporter 必须输出清晰的手动合并步骤提示（含文件路径 + 块内容结构）
- VS Code 归并场景：检测到 `~/.vscode/` 时输出 migration 提示，格式遵循现有三段式错误模板（不用 ❌，用 ⚠️ warning 级别）
- Windsurf Agents→Workflows 语义差异场景：Reporter 在 agents 安装到 `.windsurf/workflows/` 前给出语义声明并提供"跳过该类别"选项
- Trae Skills 不可安装场景：给出明确说明（UI 驱动，无稳定路径）+ 指向 Trae 文档

---

### FR Coverage Map

| 需求编号 | 故事 | 实现 Story |
|---------|------|-----------|
| FR-013（微调） | 工具检测引用 FR-047 全清单 | Story 7-1 |
| FR-047 | 11 工具全支持 | Story 7-1 ~ 7-9 各自新增工具 |
| FR-048（XDG） | `~/.config/opencode/` 路径修正 | Story 7-5 |
| FR-049（Antigravity 隔离） | `~/.gemini/antigravity/` | Story 7-8 |
| FR-050（VS Code migration） | migration 提示 + Breaking Change | Story 7-1 |
| FR-051（iFlow 停服） | 检测到残留时提示 | Story 7-1 或 7-10 |
| FR-052（MCP 降级） | 模板 + 手动合并提示 | Story 7-2（Codex）+ 7-5（OpenCode） |
| FR-053（Windsurf 语义差异） | agents→workflows 映射 + 告知 | Story 7-6 |
| FR-054（Trae Skills 不可安装） | 明确约束 + 说明 | Story 7-9 |
| FR-055（Gemini 版本要求） | 版本检测 + 提示 | Story 7-4 |
| FR-056（Copilot Skills 前置） | 付费 + 设置提示 | Story 7-1 |
| FR-057（AGENTS.md 标准） | 分发到各工具 | Story 7-3/4/5/6/7/8/9 |
| FR-058（CLAUDE.md + AGENTS.md 共存） | 指令文件双分发 | Story 7-1 + 跨 Story |
| NFR-P6 | 11 工具检测 < 1000ms | Story 7-10 集成测试验证 |
| NFR-I5 | 零引擎改动 | Story 7-2~7-9 每个 Story 的 AC |
| NFR-C7 | 平滑迁移 | Story 7-1 Breaking Change 处置 |

---

## Epic List

### Epic 7: AI IDE 工具覆盖扩展（v2.0，Breaking Change）

**用户价值：** 开发者可以使用 `aiforge` 为主流 11 个 AI 编码助手工具一键安装标准化配置，从"MVP 4 工具"进化为"覆盖完整 AI 编码助手生态"。

**前置条件：** Epic 1-6 全部 Done ✅

**规模：** 10 个 Story / +38 条规则 / -1 条删除 / ~54 条总量 / 约 2-3 Sprint

**FRs covered：** FR-013（微调）、FR-047~FR-058、NFR-P6、NFR-I5、NFR-C7

**Story 清单：**

| Story | 用户价值摘要 | 主 FR |
|-------|------------|-------|
| 7-1 | 完成 v1→v2 归并；已有用户平滑迁移；Breaking Change 文档化 | FR-050, NFR-C7 |
| 7-2 | Codex CLI 用户可安装配置；MCP 有降级提示 | FR-047, FR-052 |
| 7-3 | Auggie 用户可安装配置；支持 AGENTS.md | FR-047, FR-057 |
| 7-4 | Gemini CLI 用户可安装配置；版本不足有提示 | FR-047, FR-055 |
| 7-5 | OpenCode 用户可安装 4 类配置；XDG 路径正确 | FR-047, FR-048 |
| 7-6 | Windsurf 用户可安装配置；语义差异明确告知 | FR-047, FR-053 |
| 7-7 | Kiro 用户可安装 skills/instructions | FR-047, FR-057 |
| 7-8 | Antigravity 用户可安装配置；不与 Gemini 冲突 | FR-047, FR-049 |
| 7-9 | Trae 用户可安装 rules/AGENTS.md；Skills 限制明确 | FR-047, FR-054 |
| 7-10 | 维护者得到完整 v2.0 文档 + 集成测试覆盖 | NFR-P6, NFR-I5 |

---

## Epic 7: AI IDE 工具覆盖扩展（v2.0，Breaking Change）

将 ai-forge 从"MVP 阶段 4 工具支持（copilot/claude/cursor/vscode）"演进为"AI 编码助手生态的标准化安装器（11 工具）"。通过数据驱动架构（D5a 工具注册表 + D2a/D2b 规则索引）零入侵地扩展工具支持，同时处理 VS Code 归并这一 Breaking Change（v1.x → v2.0.0）。

**前置条件：** Epic 1-6 全部 Done ✅  
**版本：** v2.0.0（Breaking Change，需 CHANGELOG + migration guide）  
**架构约束：** 所有新工具仅修改 `src/data/tool-registry.ts` + `src/data/install-rules.ts`，不触及引擎实现层

---

### Story 7-1: VS Code 归并 + MVP 三工具规则补齐（Breaking Change）

As a 平台维护者（chunxiao），
I want 将 VS Code 从独立 AI 工具注册表中归并、补齐 copilot/claude/cursor 的缺失规则、并输出清晰的 migration 指引，
So that v2.0.0 版本无破坏性地覆盖 MVP 已安装配置，已有用户收到明确提示，Breaking Change 有完整文档依据。

**Acceptance Criteria:**

**Given** `src/data/tool-registry.ts` 当前包含 `vscode` ToolDefinition  
**When** Story 7-1 实施完成  
**Then** `TOOL_DEFINITIONS` 中不再包含 `id: 'vscode'` 的条目  
**And** `BUILTIN_RULES` 中原 vscode 规则（`.vscode/mcp.json` 项目级 MCP）被迁移并绑定到 `copilot` 工具

**Given** MVP 阶段 copilot/claude/cursor 的规则存在缺失（claude 缺 instructions 双路径、cursor 缺全局 agents 路径、copilot 缺 `.vscode/mcp.json` 项目级 MCP）  
**When** 用户执行 `aiforge install`  
**Then** 新增规则生效：claude instructions 支持全局 `~/.claude/` 和项目根双路径；cursor agents 支持 `~/.cursor/rules/` 全局；copilot 新增 `.vscode/mcp.json` 项目级 MCP 规则  
**And** 规则总量从 16 条变为 20 条（+5/-1）

**Given** 已安装 MVP v1.x 的用户，其环境存在 `~/.vscode/` 目录但无 `~/.copilot/` 目录  
**When** 用户执行 `aiforge install`（工具检测阶段）  
**Then** 系统输出 ⚠️ 级别提示，说明 VS Code 已归并到 Copilot 语境  
**And** 不执行任何对 `~/.vscode/` 现有文件的覆盖或删除操作（NFR-C7）  
**And** 提示内容包含：如何安装 GitHub Copilot 扩展以继续使用 aiforge MCP 管理

**Given** 开发者查看 `CHANGELOG.md`  
**When** 参考 v2.0.0 变更记录  
**Then** Breaking Change 条目明确记录：`vscode` 工具 ID 删除、归并路径、migration 步骤索引  
**And** `docs/migration-v2.md`（或等效文件）存在且包含：旧 `vscode` 规则清单、新 Copilot 承接说明、用户操作步骤

**Given** `package.json` 当前 version 为 `1.x.x`  
**When** Story 7-1 实施完成  
**Then** `package.json` version 字段更新为 `2.0.0`

**Given** 执行 `npm test && npm run lint:src && npm run build`  
**When** Story 7-1 实施完成  
**Then** 全部通过，无回归

---

### Story 7-2: Codex CLI 接入（含 MCP 降级策略）

As a 使用 OpenAI Codex CLI 的开发者，
I want 通过 `aiforge install` 安装 skills/agents/instructions 配置到 Codex 的标准路径，
So that 我的 AI 配置保持最新，同时对于需要手动合并的 MCP 配置，我收到清晰的操作步骤。

**Acceptance Criteria:**

**Given** 用户环境存在 `~/.codex/` 目录（全局检测标志）或 `.codex/` 目录（项目检测标志）  
**When** 执行 `aiforge install`（自动检测）或 `aiforge install --tools codex`  
**Then** `codex` 出现在检测到的工具列表中  
**And** `TOOL_DEFINITIONS` 包含 `{ id: 'codex', detect: { global: ['~/.codex'], project: ['.codex'] } }`

**Given** 知识仓库包含 `skills/`、`agents/`、`instructions/` 目录  
**When** 对 codex 工具执行全局安装（`-g`）  
**Then** skills 以 Directories 类型安装到 `~/.codex/skills/`  
**And** agents 以 Directories 类型安装到 `~/.codex/agents/`  
**And** instructions 以 Files 类型安装到 `~/.codex/`

**Given** 知识仓库包含 `skills/`、`agents/`、`instructions/` 目录  
**When** 对 codex 工具执行项目级安装（默认）  
**Then** skills 安装到 `.codex/skills/`，agents 安装到 `.codex/agents/`，instructions 安装到 `.codex/`（项目根）

**Given** 知识仓库包含 `mcp-tools/` 目录（含模板文件）  
**When** 对 codex 工具执行安装（全局 `-g`）  
**Then** 模板文件复制到 `~/.codex/`（不修改 `config.toml` 现有内容）  
**And** Reporter 输出手动合并提示，内容包含：目标文件路径（`~/.codex/config.toml`）、需要合并的块结构（`[mcp]` 段）  
**And** 安装结果摘要中标注 mcp-tools 为"需手动合并"状态，而非 ✅ 直接完成

**Given** 执行 `npm test && npm run lint:src && npm run build`  
**When** Story 7-2 实施完成  
**Then** 全部通过，新增规则 +5 条（skills global/project、agents global/project、mcp-tools 降级）  
**And** `BUILTIN_RULES` 总量为 25 条（20 + 5），零引擎代码改动（NFR-I5）

---

### Story 7-3: Auggie (Augment Code) 接入

As a 使用 Augment Code 的开发者，
I want 通过 `aiforge install` 安装 skills/agents/instructions 配置到 Auggie 的标准路径，
So that 我的 AI 配置保持同步，instructions 符合 AGENTS.md 跨工具标准。

**Acceptance Criteria:**

**Given** 用户环境存在 `~/.augment/` 目录（全局）或 `.augment/` 目录（项目）  
**When** 执行 `aiforge install`（自动检测）或 `aiforge install --tools auggie`  
**Then** `auggie` 出现在检测到的工具列表中  
**And** `TOOL_DEFINITIONS` 包含 `{ id: 'auggie', name: 'Auggie (Augment Code)', detect: { global: ['~/.augment'], project: ['.augment'] } }`

**Given** 知识仓库包含 `skills/` 目录  
**When** 对 auggie 执行全局安装  
**Then** skills 以 Directories 类型安装到 `~/.augment/skills/`

**Given** 知识仓库包含 `skills/` 和 `agents/` 目录  
**When** 对 auggie 执行项目级安装  
**Then** skills 安装到 `.augment/skills/`，agents 安装到 `.augment/agents/`

**Given** 知识仓库 `instructions/` 目录包含 `AGENTS.md`  
**When** 对 auggie 执行项目级安装  
**Then** `AGENTS.md` 分发到项目根目录（AGENTS.md 跨工具标准）  
**And** 若同目录也存在 `CLAUDE.md`，不影响 AGENTS.md 的分发（CLAUDE.md + AGENTS.md 共存）

**Given** 执行 `npm test && npm run lint:src && npm run build`  
**When** Story 7-3 实施完成  
**Then** 全部通过，新增规则 +5 条，`BUILTIN_RULES` 总量为 30 条，零引擎代码改动

---

### Story 7-4: Gemini CLI 接入（含版本前置校验）

As a 使用 Google Gemini CLI 的开发者，
I want 通过 `aiforge install` 安装 skills/instructions 配置，并在版本不足时收到明确提示，
So that 我不会因工具版本问题而安装出现不可用的 Skills 配置。

**Acceptance Criteria:**

**Given** 用户环境存在 `~/.gemini/` 目录（全局）或 `.gemini/` 目录（项目）  
**When** 执行 `aiforge install`（自动检测）或 `aiforge install --tools gemini`  
**Then** `gemini` 出现在检测到的工具列表中  
**And** `TOOL_DEFINITIONS` 包含 `{ id: 'gemini', detect: { global: ['~/.gemini'], project: ['.gemini'] } }`

**Given** 已安装 Gemini CLI 版本 >= v0.26.0  
**When** 对 gemini 工具执行全局安装  
**Then** skills 以 Directories 类型安装到 `~/.gemini/skills/`  
**And** instructions（如 `GEMINI.md`）以 Files 类型安装到 `~/.gemini/`（全局）和项目根（项目级）

**Given** Gemini CLI 版本 < v0.26.0（通过 `gemini --version` 检测，或该命令不存在）  
**When** 对 gemini 工具执行安装  
**Then** 系统跳过 skills 类别的安装  
**And** Reporter 输出明确版本提示：当前版本、要求版本（v0.26.0+）、升级命令  
**And** 其他类别（如 instructions）不受影响，正常安装

**Given** 用户同时使用 gemini 和 antigravity 工具（均依赖 `~/.gemini/` 路径）  
**When** 对两个工具执行安装  
**Then** gemini skills 安装到 `~/.gemini/skills/`，antigravity skills 安装到 `~/.gemini/antigravity/skills/`，两者路径无冲突

**Given** 执行 `npm test && npm run lint:src && npm run build`  
**When** Story 7-4 实施完成  
**Then** 全部通过，新增规则 +4 条，`BUILTIN_RULES` 总量为 34 条，零引擎代码改动

---

### Story 7-5: OpenCode 接入（XDG 路径规范化）

As a 使用 OpenCode 的开发者，
I want 通过 `aiforge install` 安装 skills/agents/instructions/mcp-tools 四类配置到符合 XDG 标准的路径，
So that 我的配置安装位置正确（非旧式 `~/.opencode/`），MCP 配置有清晰的手动合并指引。

**Acceptance Criteria:**

**Given** 用户环境存在 `~/.config/opencode/` 目录（全局，XDG 路径）或 `.opencode/` 目录（项目）  
**When** 执行 `aiforge install`（自动检测）或 `aiforge install --tools opencode`  
**Then** `opencode` 出现在检测到的工具列表中  
**And** `TOOL_DEFINITIONS` 包含 detect.global 为 `['~/.config/opencode']`（而非 `~/.opencode/`，XDG 规范）

**Given** 知识仓库包含 `skills/`、`agents/`、`instructions/` 目录  
**When** 对 opencode 执行全局安装（`-g`）  
**Then** skills 安装到 `~/.config/opencode/skills/`，agents 安装到 `~/.config/opencode/agents/`  
**And** instructions（如 `AGENTS.md`）安装到 `~/.config/opencode/`

**Given** 知识仓库包含 `mcp-tools/` 目录  
**When** 对 opencode 执行全局安装  
**Then** 降级策略生效：模板文件复制到 `~/.config/opencode/`，不修改现有 `opencode.json`  
**And** Reporter 输出手动合并提示，指明 `"mcp"` 块结构和 `opencode.json` 路径

**Given** 用户执行项目级安装（默认模式）  
**When** `aiforge install`  
**Then** skills 安装到 `.opencode/skills/`，agents 安装到 `.opencode/agents/`

**Given** 执行 `npm test && npm run lint:src && npm run build`  
**When** Story 7-5 实施完成  
**Then** 全部通过，新增规则 +7 条，`BUILTIN_RULES` 总量为 41 条，零引擎代码改动

---

### Story 7-6: Windsurf 接入（Agents→Workflows 语义差异处理）

As a 使用 Windsurf 的开发者，
I want 通过 `aiforge install` 安装 skills/rules/agents 配置，
So that 对于 agents→workflows 的语义映射，我收到清晰的声明和选择权，而不是被静默安装到歧义路径。

**Acceptance Criteria:**

**Given** 用户环境存在 `~/.codeium/windsurf/` 目录（全局）或 `.windsurf/` 目录（项目）  
**When** 执行 `aiforge install`（自动检测）或 `aiforge install --tools windsurf`  
**Then** `windsurf` 出现在检测到的工具列表中  
**And** `TOOL_DEFINITIONS` 包含 detect.global 为 `['~/.codeium/windsurf']`（路径修正，非 `~/Library/...`）

**Given** 知识仓库包含 `skills/` 和 `rules/` 目录  
**When** 对 windsurf 执行项目级安装  
**Then** skills 安装到 `.windsurf/skills/`（如有），rules 安装到 `.windsurf/rules/`

**Given** 知识仓库包含 `agents/` 目录  
**When** 对 windsurf 执行安装（TTY 交互模式）  
**Then** 安装前 Reporter 输出语义声明：`agents` 将映射到 `.windsurf/workflows/`，Windsurf Workflow 与通用 Agent 概念存在语义差异  
**And** 提供选项：[继续安装] / [跳过 agents 类别]  
**And** 用户选择继续时，agents 安装到 `.windsurf/workflows/`

**Given** 用户在非 TTY 环境（CI/CD）执行安装，知识仓库包含 `agents/`  
**When** `aiforge install --tools windsurf`（非交互）  
**Then** 自动跳过 agents 类别（非 TTY 下不进入交互式选择）  
**And** 在输出中注明 agents 已跳过及原因

**Given** 执行 `npm test && npm run lint:src && npm run build`  
**When** Story 7-6 实施完成  
**Then** 全部通过，新增规则 +5 条，`BUILTIN_RULES` 总量为 46 条，零引擎代码改动

---

### Story 7-7: Kiro (AWS) 接入

As a 使用 AWS Kiro 的开发者，
I want 通过 `aiforge install` 安装 skills/instructions/steering 配置到 Kiro 标准路径，
So that 我的 AI 编码辅助配置保持最新同步。

**Acceptance Criteria:**

**Given** 用户环境存在 `~/.kiro/` 目录（全局）或 `.kiro/` 目录（项目）  
**When** 执行 `aiforge install`（自动检测）或 `aiforge install --tools kiro`  
**Then** `kiro` 出现在检测到的工具列表中  
**And** `TOOL_DEFINITIONS` 包含 `{ id: 'kiro', name: 'Kiro (AWS)', detect: { global: ['~/.kiro'], project: ['.kiro'] } }`

**Given** 知识仓库包含 `skills/` 目录  
**When** 对 kiro 执行项目级安装  
**Then** skills 以 Directories 类型安装到 `.kiro/skills/`

**Given** 知识仓库包含 `instructions/` 目录  
**When** 对 kiro 执行全局安装（`-g`）  
**Then** instructions（如 `AGENTS.md`）安装到 `~/.kiro/steering/`（全局 steering 目录）

**Given** 知识仓库包含 `instructions/` 目录  
**When** 对 kiro 执行项目级安装  
**Then** instructions 安装到 `.kiro/steering/`（项目 steering 目录）

**Given** 执行 `npm test && npm run lint:src && npm run build`  
**When** Story 7-7 实施完成  
**Then** 全部通过，新增规则 +4 条，`BUILTIN_RULES` 总量为 50 条，零引擎代码改动

---

### Story 7-8: Antigravity (Google) 接入（子目录隔离策略）

As a 使用 Google Antigravity 的开发者，
I want 通过 `aiforge install` 安装 skills 配置，且配置路径与 Gemini CLI 相互隔离，
So that 同时使用两个工具时，配置文件不会相互干扰或触发错误的工具识别。

**Acceptance Criteria:**

**Given** 用户环境存在 `~/.gemini/antigravity/` 目录（全局专属子目录）或 `.agents/` 目录（项目）  
**When** 执行 `aiforge install`（自动检测）或 `aiforge install --tools antigravity`  
**Then** `antigravity` 出现在检测到的工具列表中，与 `gemini` 独立检测  
**And** `TOOL_DEFINITIONS` 包含 `{ id: 'antigravity', detect: { global: ['~/.gemini/antigravity'], project: ['.agents'] } }`

**Given** 用户同时安装了 `gemini` 和 `antigravity` 工具  
**When** 执行 `aiforge install`  
**Then** gemini skills 安装到 `~/.gemini/skills/`，antigravity skills 安装到 `~/.gemini/antigravity/skills/`  
**And** 两者路径无重叠，manifest.json 中各自的 tool 字段正确区分

**Given** 知识仓库包含 `skills/` 目录，用户执行项目级安装  
**When** `aiforge install --tools antigravity`  
**Then** skills 安装到 `.agents/skills/`（与通用目录 Story 6-3 协同）

**Given** 环境只有 `~/.gemini/` 目录但无 `~/.gemini/antigravity/` 子目录  
**When** 执行 `aiforge install`（自动检测）  
**Then** `antigravity` 不出现在检测到的工具列表（`~/.gemini/` 存在不触发 antigravity，仅触发 gemini）

**Given** 执行 `npm test && npm run lint:src && npm run build`  
**When** Story 7-8 实施完成  
**Then** 全部通过，新增规则 +3 条，`BUILTIN_RULES` 总量为 53 条，零引擎代码改动

---

### Story 7-9: Trae (ByteDance) 部分接入（不含 Skills）

As a 使用 Trae 的开发者，
I want 通过 `aiforge install` 安装 `.trae/rules/` 和 `AGENTS.md`，并清楚了解 Trae Skills 无法通过文件系统安装的原因，
So that 我能使用 aiforge 管理可安装的 Trae 配置，同时对能力边界有正确预期。

**Acceptance Criteria:**

**Given** 用户环境存在 `~/.trae/` 目录（全局）或 `.trae/` 目录（项目）  
**When** 执行 `aiforge install`（自动检测）或 `aiforge install --tools trae`  
**Then** `trae` 出现在检测到的工具列表中  
**And** `TOOL_DEFINITIONS` 包含 `{ id: 'trae', name: 'Trae (ByteDance)', detect: { global: ['~/.trae'], project: ['.trae'] } }`

**Given** 知识仓库包含 `instructions/` 目录（含 `AGENTS.md`）  
**When** 对 trae 执行项目级安装  
**Then** `AGENTS.md` 以 Files 类型分发到项目根  
**And** 若知识仓库有 rules 类资源，安装到 `.trae/rules/`

**Given** 知识仓库包含 `skills/` 目录  
**When** 对 trae 执行安装（全局或项目级）  
**Then** 系统跳过 trae 的 skills 安装（无对应规则）  
**And** Reporter 输出说明：Trae Skills 通过 UI 驱动管理，无稳定文件路径，无法通过 aiforge 安装  
**And** 安装结果摘要不包含 skills 类别（而非显示失败）

**Given** 执行 `npm test && npm run lint:src && npm run build`  
**When** Story 7-9 实施完成  
**Then** 全部通过，新增规则 +2 条（rules + AGENTS.md），`BUILTIN_RULES` 总量为 ~55 条，零引擎代码改动

---

### Story 7-10: Epic 7 收尾（文档 + 规则矩阵 + 集成测试）

As a 平台维护者（chunxiao），
I want 完整的 v2.0.0 文档体系（migration guide、规则矩阵、CHANGELOG）和覆盖全部 11 工具的集成测试，
So that v2.0.0 正式发布具有充分的文档支撑和测试信心，用户可以从 v1.0 平滑迁移。

**Acceptance Criteria:**

**Given** Epic 7（Story 7-1~7-9）全部 Done  
**When** Story 7-10 完成  
**Then** `docs/install-rules-matrix.md` 更新为 ~54 条规则，涵盖全部 11 工具  
**And** 对应中文版 `docs/install-rules-matrix.zh.md` 同步更新  
**And** 每工具至少包含：detect 路径、支持资源类型、安装路径、特殊约束说明

**Given** v2.0.0 是 Breaking Change 版本  
**When** 查看 `CHANGELOG.md`  
**Then** v2.0.0 条目存在且包含：Breaking Changes 段落（vscode 工具删除、归并说明）、新增工具列表（8 个）、migration 文档链接

**Given** 开发者从 v1.x 升级到 v2.0.0  
**When** 查看 migration guide（`docs/migration-v2.md` 或等效路径）  
**Then** 文档包含：版本差异对照表、`vscode` → `copilot` 归并操作步骤、升级命令、常见问题

**Given** 测试套件  
**When** 执行 `npm test`  
**Then** 存在覆盖全部 11 工具的集成测试（全局 + 项目级各至少 1 个场景）  
**And** 11 工具检测阶段总耗时 < 1000ms（NFR-P6 性能测试通过）

**Given** 执行最终质量门禁  
**When** `npm test && npm run lint:src && npm run build`  
**Then** 全部通过，Epic 7 零引擎代码改动验证（代码审查确认 `src/stages/` 和 `src/commands/` 无新改动，仅 `src/data/` 有变更，NFR-I5）

**Given** 检测到残留 `.iflow/` 目录的用户环境  
**When** 执行 `aiforge install`  
**Then** 系统输出无操作提示：iFlow CLI 已停服（2026-04-17），aiforge 不支持该工具  
**And** 不安装任何文件到 `.iflow/` 相关路径
