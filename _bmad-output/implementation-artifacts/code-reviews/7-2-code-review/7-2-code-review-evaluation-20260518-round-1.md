---
Story: 7-2
Round: 1
Date: 2026-05-18
Model Used: GPT-5.5 (gpt-5.5)
Review Source: 7-2-code-review-summary-20260518-round-1.md
Review Model: GPT-5.5 (gpt-5.5)
Type: Code Review Evaluation
---

## 评估总结

对 Story 7-2 的第 1 轮 CR 代码审查结果（首轮）进行逐条评估。审查共提出 2 条发现：1 条规格边界裁决项，1 条安装结果摘要展示缺陷。经只读代码与 Story 核验，两条发现均成立，均阻塞 Story Done；未发现可忽略误报。评估结论如下。

---

## 发现 #1 评估

### 审查原文

> **[高] Story AC 与实现方案冲突：Codex instructions 与规则总数无法同时满足**
> - 来源：auditor
> - 分类：decision_needed

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

CR 对 Story 内部冲突的描述准确。Story 叙述明确要求安装 `skills/agents/instructions`，AC #2 和 AC #3 分别要求全局与项目级安装包含 `instructions/`，但 AC #5 又要求新增规则 +5 且 `BUILTIN_RULES` 总量为 25 条。与此同时，Task 2.1 曾列出包含 instructions 与 project mcp-tools 的 8 条方案，Task 2.2 又要求若与 +5 条冲突则以 AC 为准，仅保留 skills、agents、mcp-tools 降级 5 条，并将 instructions 下放后续 Story。

代码实现与测试当前采用 +5/24 口径：`src/data/install-rules.ts:156-194` 仅包含 Codex skills global/project、agents global/project、mcp-tools global 共 5 条规则，没有 Codex `sourceDir: 'instructions'` 规则；`tests/data/install-rules.test.ts:14` 将 `BUILTIN_RULES` 总数固化为 24；`tests/data/install-rules.test.ts:112-146` 也只断言 Codex 5 条规则矩阵。Story 的 Dev Agent Record 同样记录当前实际总量为 24，并说明 instructions 未添加。

**严重性判断：合理**

原始严重性为 [高] 合理。该问题不是单纯代码 bug，而是验收标准、任务记录、实现与测试口径不一致。若直接进入 Done，后续 Finalizer 或验收审计会无法判断到底应以 instructions 安装能力还是 +5/24 规则边界为准。

**修复建议：可行**

CR 建议先由产品/SM 明确最终边界是可行且必要的。可接受的修复路径有两类：补齐 instructions 规则并同步规则总数与测试；或正式修订 Story AC/测试计划，明确 instructions 延后并将总数口径改为 24。由于本次 evaluator 被要求禁止修改 Story 和源码，本评估仅确认问题，不执行修复。

**误报评估：非误报**

不是误报。Story 与实现之间确实存在可被代码和测试反证的范围冲突。

---

## 发现 #2 评估

### 审查原文

> **[中] mcp-tools 安装结果摘要仍显示普通安装状态，未标注“需手动合并”**
> - 来源：blind+auditor
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

CR 对实现缺口的描述准确。Story AC #4 要求安装结果摘要中将 mcp-tools 标注为“需手动合并”状态，而不是 ✅ 直接完成。当前 `src/stages/execute-install.ts:357-371` 的 `emitMcpMergeHintsForPlan` 只基于 plan 输出一次 `Reporter.warn(...)` 合并提示，`src/stages/execute-install.ts:781` 在安装汇总后调用该提示函数，但没有改变 `InstallResult.items` 中的结果项展示数据。

`src/core/types.ts:73-86` 的 `InstallResult.items` 仅包含 `status: 'new' | 'updated' | 'skipped'` 以及路径、工具等字段，没有 `manualAction`、`requiresManualMerge` 或等价展示元数据；`src/core/reporter.ts:120-124` 将 `new` 映射为 `✅`，`src/core/reporter.ts:319-324` 的 TTY 明细仍按 `item.status` 输出图标与路径；`src/core/reporter.ts:511` 的 Plain 明细仍只输出 `new/updated/skipped`。因此 warning 已存在，但“安装结果摘要中的单项状态”仍无法表达“需手动合并”。

测试覆盖也支持该判断：`tests/stages/execute-install.test.ts:605-614` 与 `tests/pipeline.test.ts:294-319` 只断言 warning 包含 `~/.codex/config.toml` 和 `[mcp]`，没有断言 TTY/Plain/Quiet 摘要状态不再呈现为普通完成语义。

**严重性判断：合理**

原始严重性 [中] 对用户体验和输出语义风险基本合理；但因它直接违反 AC #4，本评估将交付优先级定为 P1，需在 Story Done 前修复。

**修复建议：可行**

CR 建议保持 `InstallResult.items[].status` 三态不变，同时补充可展示附加标记，或在 reporter 层基于可追溯元数据识别 mcp-tools 并显示“需手动合并”，是可行的。更稳妥的方案是增加结果项级别的显式元数据，再由 TTY/Plain/Quiet 输出统一消费，并补充对应 reporter 测试。

**误报评估：非误报**

不是误报。现有 warning 只能提供额外提示，不能满足 AC #4 对“安装结果摘要中标注 mcp-tools 状态”的要求。

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | Story AC 与实现方案冲突：Codex instructions 与规则总数无法同时满足 | [高] | **P1** | 需先裁决并同步 Story/测试/实现口径，否则验收边界不确定。 |
| 2 | mcp-tools 安装结果摘要仍显示普通安装状态，未标注“需手动合并” | [中] | **P1** | 直接违反 AC #4，warning 不等同于摘要状态标注。 |

### 建议纳入 CR TODO 跟踪（非阻塞）

无。

### 可忽略（误报）

无。

### 评估决定

- **发现 #1（Story AC 与实现方案冲突）**：确认有效。该项需要产品/SM 或 Story 维护方裁决最终范围，并同步修订 Story/测试/实现口径；在裁决前不应标记 Story Done。
- **发现 #2（mcp-tools 摘要状态缺失）**：确认有效。需补充结果摘要层面的“需手动合并”标记及对应测试；在修复前不应通过 CR。
- **总体决定**：本轮 CR 评估不通过。确认需修复项 2 个，可忽略项 0 个，非阻塞 CR TODO 0 个。

## 修复执行记录

### 修复执行记录
- **Date**: 2026-05-18
- **Model Used**: GPT-5.4
- **Fix Items**: 2（1 项已修复，1 项待确认）

#### 执行结果

| # | 评估发现 | 状态 | 修复说明 |
|---|----------|------|----------|
| 1 | Story AC 与实现方案冲突：Codex instructions 与规则总数无法同时满足 | 待确认 | 该项需要产品/SM 或 Story 维护方裁决最终范围；当前没有新的范围裁决，且 fixer 技能禁止修改 Story 文档，因此未擅自修改实现或 Story 口径。 |
| 2 | mcp-tools 安装结果摘要仍显示普通安装状态，未标注“需手动合并” | 已修复 | 为 `InstallResult.items[]` 增加 `manualAction: 'mcp-merge-required'` 元数据；`executeInstall` 对存在 MCP merge hint 的 `mcp-tools` 规则结果项打标；TTY 摘要显示 ⚠️ + “需手动合并”且不再显示普通 ✅，Plain 摘要追加 `manual-merge-required` 列，Quiet 摘要追加手动合并计数。 |

#### 修改文件

- `src/core/types.ts`：新增结果项级 `manualAction` 元数据。
- `src/stages/execute-install.ts`：为 Codex `mcp-tools` 安装结果项设置 `mcp-merge-required`。
- `src/core/reporter.ts`：在 TTY / Plain / Quiet 结果摘要中展示手动合并状态。
- `src/core/messages.ts`：补充中英文“需手动合并”摘要文案。
- `tests/stages/execute-install.test.ts`：断言 Codex `mcp-tools` 安装结果项被打标。
- `tests/core/reporter.test.ts`：补充 TTY / Plain / Quiet 输出回归断言。

#### 验证记录

- `npm test -- tests/core/reporter.test.ts --run`：通过（110 tests）。
- `npm test -- tests/stages/execute-install.test.ts --run`：通过（89 tests）。
- `npm run lint:src`：✅ 通过（All matched files use Prettier code style）。
- `npm run build`：✅ 通过（ESM `dist/index.js` 140.32 KB；DTS `dist/index.d.ts` 20.00 B）。
- `npm test`：✅ 通过（867/867 passed，33 files）。

#### 剩余阻塞

- 发现 #1 仍阻塞：需要产品/SM 或 Story 维护方明确 Codex instructions 是否纳入 Story 7-2，以及 `BUILTIN_RULES` 总数应为 24 还是 25；获得裁决前不应标记 Story Done。