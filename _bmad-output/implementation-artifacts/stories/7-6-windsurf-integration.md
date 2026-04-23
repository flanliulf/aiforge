# Story 7.6: Windsurf 接入（Agents→Workflows 语义差异处理）

Status: ready-for-dev

## Story

As a 使用 Windsurf 的开发者,
I want 通过 `aiforge install` 安装 skills/rules/agents 配置,
So that 对于 agents→workflows 的语义映射，我收到清晰的声明和选择权，而不是被静默安装到歧义路径。

## Acceptance Criteria

1. **Given** 用户环境存在 `~/.codeium/windsurf/` 目录（全局）或 `.windsurf/` 目录（项目）  
   **When** 执行 `aiforge install`（自动检测）或 `aiforge install --tools windsurf`  
   **Then** `windsurf` 出现在检测到的工具列表中  
   **And** `TOOL_DEFINITIONS` 包含 detect.global 为 `['~/.codeium/windsurf']`（路径修正，**非** `~/Library/...`）

2. **Given** 知识仓库包含 `skills/` 和 `rules/` 目录  
   **When** 对 windsurf 执行项目级安装  
   **Then** skills 安装到 `.windsurf/skills/`（如有），rules 安装到 `.windsurf/rules/`

3. **Given** 知识仓库包含 `agents/` 目录  
   **When** 对 windsurf 执行安装（TTY 交互模式）  
   **Then** 安装前 Reporter 输出语义声明：`agents` 将映射到 `.windsurf/workflows/`，Windsurf Workflow 与通用 Agent 概念存在语义差异  
   **And** 提供选项：[继续安装] / [跳过 agents 类别]  
   **And** 用户选择继续时，agents 安装到 `.windsurf/workflows/`

4. **Given** 用户在非 TTY 环境（CI/CD）执行安装，知识仓库包含 `agents/`  
   **When** `aiforge install --tools windsurf`（非交互）  
   **Then** 自动跳过 agents 类别（非 TTY 下不进入交互式选择）  
   **And** 在输出中注明 agents 已跳过及原因

5. **Given** 执行 `npm test && npm run lint:src && npm run build`  
   **When** Story 7-6 实施完成  
   **Then** 全部通过，新增规则 +5 条，`BUILTIN_RULES` 总量为 46 条，零引擎代码改动

## Tasks / Subtasks

- [ ] Task 1: 注册 windsurf 工具定义 (AC: #1)
  - [ ] 1.1 在 `src/data/tool-registry.ts` 追加：`{ id: 'windsurf', name: 'Windsurf', detect: { global: ['~/.codeium/windsurf'], project: ['.windsurf'] } }`
  - [ ] 1.2 路径必须是 `~/.codeium/windsurf`（**不是** `~/Library/Application Support/...`，那是错误的早期文档）
- [ ] Task 2: 添加 windsurf 安装规则 (AC: #2, #3)
  - [ ] 2.1 在 `src/data/install-rules.ts` 追加：
    - `{ tool: 'windsurf', scope: 'global', sourceDir: 'skills', type: Directories, targetDir: '~/.codeium/windsurf/skills/' }`
    - `{ tool: 'windsurf', scope: 'global', sourceDir: 'rules', type: Files, targetDir: '~/.codeium/windsurf/rules/' }`
    - `{ tool: 'windsurf', scope: 'project', sourceDir: 'skills', type: Directories, targetDir: '.windsurf/skills/' }`
    - `{ tool: 'windsurf', scope: 'project', sourceDir: 'rules', type: Files, targetDir: '.windsurf/rules/' }`
    - `{ tool: 'windsurf', scope: 'project', sourceDir: 'agents', type: Files, targetDir: '.windsurf/workflows/', semanticWarning: 'windsurfAgentsToWorkflows' }`（agents → workflows 语义映射）
  - [ ] 2.2 共 5 条；与 epic AC #5 一致
  - [ ] 2.3 **新源目录类型 `rules/`**：MVP 仓库可能不存在 `rules/` 目录，scanSourceFiles 现有 ENOENT 静默降级会处理
- [ ] Task 3: 实现 semanticWarning 字段与交互式跳过 (AC: #3, #4)
  - [ ] 3.1 **设计决策**：扩展 `InstallRule` 增加可选 `semanticWarning?: string` 字段（i18n 键名）—— 与 7-3 fileFilter 字段一脉相承，属于"数据驱动 + 工具特异性"扩展
  - [ ] 3.2 在 `src/stages/match-rules.ts` 末尾追加 semanticWarning 处理循环：遍历 items，若 rule.semanticWarning 存在：
    - TTY 环境：调用 `@inquirer/prompts` 的 `confirm()` 提示用户继续/跳过；跳过则从 items 剔除该 item
    - 非 TTY 环境：自动跳过该 item，并通过 reporter.warn 输出 `msg('semanticWarning.{warningKey}.skipped')`
  - [ ] 3.3 i18n 键新增：
    - `semanticWarning.windsurfAgentsToWorkflows.prompt`：`"⚠️  agents 将安装到 .windsurf/workflows/。Windsurf Workflow 是工作流概念，与通用 Agent 不同。是否继续？"` / 英文对应
    - `semanticWarning.windsurfAgentsToWorkflows.skipped`：`"已跳过 windsurf agents → workflows 安装（非 TTY 自动跳过）"` / 英文对应
  - [ ] 3.4 TTY 检测复用 `process.stdout.isTTY`（已在 reporter 实现中使用）
  - [ ] 3.5 **NFR-I5 边界讨论**：semanticWarning 处理涉及 `match-rules.ts` 改动 + `@inquirer/prompts` 引入 stages/。**Dev 阶段开工前必须发起评审**：是否将该交互逻辑放在 stages/match-rules.ts，还是新建 `stages/semantic-warnings.ts`？建议新建独立 stage helper（更符合单一职责）
- [ ] Task 4: 编写单元测试 (AC: #1-5)
  - [ ] 4.1 扩展 `tests/data/install-rules.test.ts`：`BUILTIN_RULES.length === 46`，包含 5 条 windsurf 规则；agents 规则 semanticWarning 字段为 `'windsurfAgentsToWorkflows'`
  - [ ] 4.2 扩展 `tests/stages/detect-tools.test.ts`：mock `~/.codeium/windsurf/` → 检测命中
  - [ ] 4.3 扩展 `tests/stages/match-rules.test.ts`（如方案采纳）：
    - mock TTY=true + mock confirm 返回 false → MatchedPlan 不含 windsurf agents item
    - mock TTY=true + mock confirm 返回 true → MatchedPlan 包含 windsurf agents item
    - mock TTY=false → MatchedPlan 不含 windsurf agents item，reporter.warn 被调用
  - [ ] 4.4 mock @inquirer/prompts 使用现有 `aiforge init` 测试中的模式
- [ ] Task 5: 质量门禁 (AC: #5)
  - [ ] 5.1 `npm test` — 全绿
  - [ ] 5.2 `npm run lint:src` — 退出码 0
  - [ ] 5.3 `npm run build` — 构建通过

## Dev Notes

### Windsurf agents→workflows 语义差异详解 [Source: 技术调研, prd.md FR-053]

Windsurf 的 `.windsurf/workflows/` 目录承载的是"工作流"概念（多步骤自动化），与通用 AI Agent（Claude/Codex 的 sub-agent / 单独执行单元）是**不同的语义**。直接静默安装会让用户产生"aiforge 把我的 agent 装错地方了"的困惑。

正确处理：
- TTY 环境：交互式确认，让用户选择
- 非 TTY 环境（CI/CD）：保守跳过 + 明确告知

### NFR-I5 边界与 Story 7-3/7-4 对齐

本 Story 与 7-3 (fileFilter) / 7-4 (TOOL_PRECONDITIONS) 共同构成 Epic 7 三类"数据驱动扩展"：
1. fileFilter（白名单文件名）
2. precondition（前置条件检查）
3. semanticWarning（语义差异确认）

三者均通过扩展 InstallRule / 新增数据结构实现，不修改 install / preflight / fs-utils 核心逻辑。**这是 NFR-I5 精神的合理延伸**，但需 PM 在 7-3/7-4/7-6 任意一个 Dev 阶段统一拍板。

### 已有模式参考

- ✅ @inquirer/prompts 使用模式参考 `src/commands/init.ts` 现有 confirm/select 调用
- ✅ TTY 检测参考 `src/core/reporter.ts` 中 TtyReporter 的 isTTY 判定

### 文件清单

**改动**：
- `src/data/tool-registry.ts`
- `src/data/install-rules.ts`
- `src/core/types.ts`（如方案采纳：扩展 InstallRule.semanticWarning）
- `src/core/messages.ts`
- `src/stages/match-rules.ts` 或新建 `src/stages/semantic-warnings.ts`
- `tests/data/install-rules.test.ts`
- `tests/stages/detect-tools.test.ts`
- `tests/stages/match-rules.test.ts` 或对应新文件

### Project Structure Notes

- 与 7-3/7-4 共同构成 Epic 7 数据驱动扩展三件套，文件影响范围一致

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-7.md#Story 7-6]
- [Source: _bmad-output/planning-artifacts/prd.md#FR-053, NFR-I5]
- [Source: src/data/install-rules.ts]
- [Source: _bmad-output/implementation-artifacts/stories/7-3-auggie-augment-code-integration.md (设计模式参考)]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
