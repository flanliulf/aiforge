---
Story: 7-6
Round: 1
Date: 2026-05-19
Model Used: Claude Sonnet 4.6 (claude-sonnet-4-5)
Type: Code Review Summary
---

## 审查结论

首轮审查（串行降级模式：Agent 工具不可用，已串行执行三层审查）。
测试/lint/build 全部通过（AC#5 质量门禁通过）。
存在 1 个 `decision_needed` 问题（AC#5 内部数量不一致 + 超范围 Claude 规则），2 个低优先级 `patch` 问题，1 个 `defer` 历史约定问题。

**建议**：**不通过（需决策）** — `decision_needed` 问题需要 PM/SM 确认后才能进入评估流程；两个 `patch` 问题建议同步修复。

## 新发现

### 1. [高] AC#5 内部不一致 + 超范围 Claude 项目根 CLAUDE.md 规则

- **来源**：blind + auditor
- **分类**：decision_needed

- **证据**
  - AC#5 声明"新增规则 +5 条，`BUILTIN_RULES` 总量为 46 条"，但 Story 7-5 基线为 40 条，40 + 5 = 45 ≠ 46（逻辑矛盾）
  - 实际实现新增了 **6 条**规则：5 条 Windsurf（符合 Tasks 声明）+ 1 条 Claude 项目根 CLAUDE.md 规则（**Tasks 中未声明**）
  - 超范围改动位于 `src/data/install-rules.ts`：
    ```typescript
    // Epic 7 规则矩阵补齐：Claude 项目级还需支持仓库根 CLAUDE.md
    {
      tool: 'claude',
      scope: 'project',
      sourceDir: 'instructions',
      type: Files,
      targetDir: './',
      fileFilter: ['CLAUDE.md'],
    },
    ```
  - Completion Notes 中解释为"为满足 Epic 7 累计规则矩阵的 46 条总量"，但该需求来源未在 Story Tasks 中体现

- **影响**
  - AC#5 的"+5 条"与"总量 46 条"两者只能有一个正确，若 PM 认可 46 条目标则 AC 文字错误；若认为本 Story 只应新增 5 条则 Claude 规则超范围
  - Claude 项目根 `./` 的 `CLAUDE.md` 安装行为对现有用户可能产生意外覆盖副作用（`.claude/CLAUDE.md` 与根目录 `CLAUDE.md` 共存）
  - 无单元测试专门覆盖两条 claude:project 规则并存场景下的安装行为差异

- **建议**
  - 选项 A：PM 确认 46 总量为 Epic 7 目标，AC#5 修正为"新增规则 +6 条，`BUILTIN_RULES` 总量为 46 条"，并补充 Task 2.2 说明
  - 选项 B：撤回 Claude 项目根规则，AC#5 保持"+5 条，总量 45 条"，将该规则移入独立 Story 或 Epic 7 矩阵修正 Story
  - 无论选哪个选项，建议补充一个集成测试验证 `claude:project` 两条规则并存时的安装行为

---

### 2. [低] `applySemanticWarnings` 未捕获 `confirm()` 中断异常

- **来源**：blind + edge
- **分类**：patch

- **证据**
  - `src/stages/semantic-warnings.ts:33`：`const shouldContinue = await confirm({ ... })`
  - `src/stages/match-rules.ts:401-403`：
    ```typescript
    const filteredItems = await applySemanticWarnings(items, reporter)
    reporter.completePhase()
    return { items: filteredItems }
    ```
  - 若用户在 TTY 环境下按 Ctrl+C 中断 `confirm()` 提示，`@inquirer/prompts` 会抛出 `ExitPromptError`
  - 该异常未被捕获，导致 `reporter.completePhase()` 永远不会被调用，Reporter 可能停留在进行中状态

- **影响**
  - CLI 界面可能显示未完成的进度指示符（spinner 不关闭）
  - 同类问题在 `filter-utils.ts` 中通过 `FilterCancelledSignal` 机制单独处理，此处缺乏对等处理

- **建议**
  - 在 `applySemanticWarnings` 内部捕获中断异常，重新抛出为 `FilterCancelledSignal` 或专用取消信号
  - 或在 `match-rules.ts` 的调用侧添加 try/catch，确保 `completePhase()` 在中断时仍被调用（参考现有 `FilterCancelledSignal` 的处理模式）

---

### 3. [低] `msg()` 动态键路径无防护，新 i18n 键缺失时静默返回空字符串

- **来源**：blind
- **分类**：patch

- **证据**
  - `src/stages/semantic-warnings.ts:29,33`：
    ```typescript
    reporter.warn(msg(`semanticWarning.${warningKey}.skipped`))
    // ...
    const shouldContinue = await confirm({
      message: msg(`semanticWarning.${warningKey}.prompt`),
    ```
  - `src/core/messages.ts:950`：`export function msg(key: string): string` — 找不到键时返回空字符串 `''`，不抛出异常
  - `warningKey` 来自运行时数据 `item.rule.semanticWarning`（`string` 类型），无编译时约束

- **影响**
  - 若未来开发者在 `BUILTIN_RULES` 中添加新 `semanticWarning` 值但忘记同步添加 i18n 条目，`confirm()` 将显示空白提示，用户看到空字符串"？"但不会报错
  - 现有 `msg()` 对静态键无此风险，但此处引入了动态键模式，是新增的脆弱性

- **建议**
  - 方案一（推荐）：在 `applySemanticWarnings` 中添加键存在性断言：若 `msg()` 返回空字符串则 warn + skip（替代显示空提示）
  - 方案二：将 `semanticWarning` 字段类型从 `string` 收窄为已知键字面量联合类型（如 `'windsurfAgentsToWorkflows'`），结合 `msg()` 类型重载实现编译时验证

## 验证摘要

- `npm test` ✅（新增测试：install-rules 3条、tool-registry 2条、messages 2条、detect-tools 2条、match-rules 3条）
- `npm run lint:src` ✅（Completion Notes 声明通过）
- `npm run build` ✅（Completion Notes 声明通过）
- 定向复现
  - TTY confirm=false → agents item 从 plan 中移除 ✅（有测试覆盖）
  - TTY confirm=true → agents item 保留 ✅（有测试覆盖）
  - 非 TTY → 自动跳过 + reporter.warn 正确文案 ✅（有测试覆盖）

## 通过项

- **AC#1**：`windsurf` 注册为 TOOL_DEFINITIONS 第 8 个工具，`detect.global = ['~/.codeium/windsurf']`（正确路径，非 `~/Library/...`），`detect.project = ['.windsurf']` ✅
- **AC#2**：项目级 skills→`.windsurf/skills/`、rules→`.windsurf/rules/` 规则正确注册 ✅
- **AC#3**：agents→`.windsurf/workflows/` 含 `semanticWarning: 'windsurfAgentsToWorkflows'`，TTY 下显示语义差异说明并提供继续/跳过选择；中文提示文案完整 ✅
- **AC#4**：非 TTY 自动跳过 + `reporter.warn` 输出原因，测试验证通过 ✅
- **AC#5（部分）**：质量门禁三项通过；总量 46 条数字正确（但"+5条"文字存在 decision_needed 问题）✅
- **NFR-I5 边界**：`semanticWarning` 通过扩展 `InstallRule` 数据字段 + 新建 `semantic-warnings.ts` stage helper 实现，未修改 install/preflight/fs-utils 核心引擎逻辑 ✅
- **双语 i18n**：`windsurfAgentsToWorkflows.prompt` 和 `.skipped` 中英文双语均已添加并有单元测试覆盖 ✅
- **测试隔离**：TTY 状态修改测试均使用 try/finally 正确还原 `process.stdout.isTTY` ✅

## 已知既有问题（defer）

- `process.stdout.isTTY`（用于 TTY 检测）与 `process.stdin.isTTY`（`@inquirer/prompts` 实际交互所需）可能在特定场景（如 stdout piped to file 但 stdin 仍是 TTY，或反之）下状态不一致。此为与 Reporter 共用的历史约定，非本 Story 引入。建议记入 CR TODO 待后续统一治理。
