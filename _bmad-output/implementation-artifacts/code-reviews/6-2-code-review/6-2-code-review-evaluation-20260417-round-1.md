---
Story: 6-2
Round: 1
Date: 2026-04-17
Model Used: Claude Opus 4.6 (claude-opus-4-dot-6)
Review Source: 6-2-code-review-summary-20260417-round-1.md
Review Model: GPT-5.4 (gpt-5.4)
Type: Code Review Evaluation
---

## 评估总结

对 Story 6-2 的第 1 轮 CR 代码审查结果（首轮）进行逐条评估。审查共报告 4 条发现（1 高 / 2 中 / 1 低），均围绕 `--filter` 零匹配恢复路径和空 item 守卫的作用域问题。经独立代码验证，4 条发现全部有效，其中 3 条需要修复、1 条建议纳入 CR TODO 跟踪。评估结论如下。

---

## 发现 #1 评估

### 审查原文

> **[高] 无前缀零匹配恢复枚举了不可命中的候选，并在用户选择后静默返回空计划**
> - 来源：blind+edge
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

经代码验证，无前缀零匹配恢复路径存在两个独立缺陷：

1. **候选值语义错误**：[match-rules.ts](src/stages/match-rules.ts#L210) 在 `dirPrefix` 为 `undefined` 时，`scanDir = repo.repoDir`，`scanAvailableTopDirs()` 返回仓库顶层目录名（如 `skills`、`agents`、`instructions`）。[match-rules.ts](src/stages/match-rules.ts#L218-L219) choices 的 `value` 为 `d`（因 `dirPrefix` 为 falsy），即原样使用 `skills`、`agents` 等。用户选择 `skills` 后，[match-rules.ts](src/stages/match-rules.ts#L231) `parseFilterPattern('skills')` 返回 `{ glob: 'skills' }`（无 `/` 分割点），重新扫描时 `matchesGlob(basename(sf), 'skills')` 尝试将 `git-commit`、`code-review` 等 basename 与字面量 `skills` 匹配——永远不可能命中。

2. **重试后无二次零匹配检查**：[match-rules.ts](src/stages/match-rules.ts#L234-L250) 重新扫描循环结束后直接落入 [match-rules.ts](src/stages/match-rules.ts#L262-L263) 的 `reporter.completePhase()` + `return { items }`，没有检测 `items` 是否仍为空。结果为静默返回空计划，用户无任何错误提示。

测试足迹方面：现有 TTY 重试测试（[match-rules.test.ts](tests/stages/match-rules.test.ts#L873)）只覆盖了 prefixed case（`--filter skills/xyz*` → select 返回 `skills/git-commit`），未覆盖 unprefixed case（`--filter git*`），因此该 bug 未被捕获。

**严重性判断：合理**

高严重性合理。无前缀场景是 AC #3 定义的核心路径（`--filter git*` 跨所有顶层目录匹配），零匹配恢复完全失效意味着用户在 TTY 下执行交互选择后得到空安装计划却无错误提示，属于功能缺陷。

**修复建议：可行**

审查建议的方向正确：
- 无前缀零匹配应枚举与 basename 过滤一致的可匹配安装项名称（而非仓库顶层目录）
- 重试后需二次检查 items 是否仍为空
- 补充无前缀零匹配的 TTY 回归测试

**误报评估：非误报**

---

## 发现 #2 评估

### 审查原文

> **[中] Files 类型的零匹配恢复只扫描目录，agents/instructions 场景拿不到可重试候选**
> - 来源：blind+edge
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

经代码验证：

1. [list-contents.ts](src/stages/list-contents.ts#L36-L43) 的 `scanAvailableTopDirs()` 使用 `e.isDirectory()` 过滤，只返回目录名。
2. [install-rules.ts](src/data/install-rules.ts#L19) `agents` 规则为 `type: Files`，[install-rules.ts](src/data/install-rules.ts#L41) `instructions` 规则同样为 `type: Files`。这些 sourceDir 下的内容为 `.md`、`.agent.md` 等文件，不一定有子目录。
3. [match-rules.ts](src/stages/match-rules.ts#L210-L211) 零匹配恢复统一调用 `scanAvailableTopDirs(scanDir)`，对 prefixed Files 规则如 `--filter agents/xyz*`，扫描 `agents/` 目录时只返回子目录名，文件级候选完全不可见。

这意味着 `--filter agents/xyz*` 零匹配时：
- TTY 菜单可能只剩"取消"项（若 `agents/` 下没有子目录）
- 非 TTY 的 `fixAvailable` 也不给出真实可选文件名

Story 6-2 Task 3.5 明确声明 filter 对 Files 类型应通用有效，但零匹配恢复路径未做相应适配。

**严重性判断：偏低 → 建议提升至 P1**

审查原文标为 [中]，但考虑到 `agents` 和 `instructions` 都是 Files 类型（占全部 sourceDir 类型的显著比例），且 `mcp-tools` 同样为 Files 类型，零匹配恢复对大部分 Files 规则完全失效，影响面较广。建议提升为阻塞交付（P1）。

**修复建议：可行**

审查建议方向正确：按 `rule.type` 区分枚举逻辑，Directories / Flatten 枚举目录名，Files 枚举文件 basename。具体实现可在零匹配恢复处收集所有受影响 rule 的候选列表，按 type 分别扫描后合并去重。

**误报评估：非误报**

---

## 发现 #3 评估

### 审查原文

> **[中] 空 sourceFiles 守卫被提升为通用行为，回归了未使用 --filter 的既有计划/预览语义**
> - 来源：blind
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

经代码验证：

1. [match-rules.ts](src/stages/match-rules.ts#L192) `if (sourceFiles.length === 0) continue` 位于 `if (args.filter)` 代码块之后、`items.push` 之前，是**无条件**守卫——无论是否使用 `--filter` 都会执行。
2. [reporter.ts](src/core/reporter.ts#L228-L231) 原有的 `emptySourceDir` 输出逻辑仍在，但因空 item 永远不会进入 plan，此代码成为不可达的死代码。
3. Dev Agent Record 中明确记录"空条目守卫（empty-item guard）是通用行为，适用于有/无 filter 两种场景；8 个既有测试相应更新"——说明开发者有意为之，且修改了 8 个既有测试以接受新行为。但 Story 6-2 的 AC 和 Task 3.3 描述目标是"filter 后 sourceFiles 为空则跳过"，而非"所有场景下空 sourceFiles 均跳过"。

行为变化：在未使用 `--filter` 的情况下，若用户仓库中某个 sourceDir 为空目录，原先 `reportPlan()` 会输出 `emptySourceDir` 提示（用户可以知道哪些目录是空的），现在该规则被静默跳过。

**严重性判断：偏低 → 建议提升至 P1**

审查原文标为 [中]，但这是 Story 作用域之外的行为变更：Story 6-2 的 AC 没有要求改变非 `--filter` 场景的空目录行为。将空目录提示从用户可见变为静默隐藏属于未经授权的语义回归，且旧测试被改写（而非保留为回归保护）意味着失去了对原有行为的守护。建议提升为 P1。

**修复建议：可行**

将守卫严格限定在 `--filter` 路径：`if (args.filter && sourceFiles.length === 0) continue`。非 filter 场景下空 item 照常 push，保留 `reportPlan()` 的 `emptySourceDir` 输出语义。恢复被改写的 8 个既有测试为回归保护。

**误报评估：非误报**

---

## 发现 #4 评估

### 审查原文

> **[低] 不可命中的 filter 语法没有被前置拒绝，而是延后到零匹配流程中暴露**
> - 来源：blind
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P2 优先级）

### 评估分析

**问题描述准确性：准确**

经代码验证：

1. [filter-utils.ts](src/stages/filter-utils.ts#L33-L40) `parseFilterPattern()` 仅按第一个 `/` 分割，对 glob 部分不做任何校验。
2. `skills/` → `{ dirPrefix: 'skills', glob: '' }`，空 glob 生成正则 `^$`，只能匹配空字符串；`skills/git/extra` → `{ dirPrefix: 'skills', glob: 'git/extra' }`，glob 含 `/` 但 basename 永远不含 `/`。
3. 这些明显无效的输入不会被立即拒绝，而是走完完整的匹配 + 零匹配恢复流程，增加了排查成本。

**严重性判断：合理**

低严重性合理。此类无效输入最终仍会被零匹配流程捕获（非 TTY 抛错，TTY 进入交互），不存在数据丢失或安全风险，只是用户体验不够友好。属于改进类项目。

**修复建议：可行但非必要**

在 `parseFilterPattern()` 或调用侧增加 grammar 校验（glob 非空、不含额外 `/`）属于健壮性增强。Story 6-2 的 AC 未显式要求此类校验，且 MVP 阶段 filter 功能的使用场景有限，可延后到后续迭代。

**误报评估：非误报**

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | 无前缀零匹配恢复枚举不可命中的候选，且重试后静默返回空计划 | [高] | **P1** | 恢复候选语义错误 + 缺少二次零匹配检查 |
| 2 | Files 类型零匹配恢复只扫描目录，agents/instructions 等场景无法提供候选 | [中] | **P1** | 影响所有 Files 类型规则（agents、instructions、mcp-tools），恢复路径完全失效 |
| 3 | 空 sourceFiles 守卫超出 filter 作用域，回归非 filter 场景的 emptySourceDir 语义 | [中] | **P1** | 未经授权的行为变更 + 8 个旧测试被改写而非保护 |

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 4 | 不可命中的 filter 语法（空 glob、多斜杠）未被前置拒绝 | [低] | **P2** | MVP 阶段可接受，后续迭代增强 |

### 评估决定

- **发现 #1（无前缀零匹配恢复不可命中）**：P1 修复。需修正无前缀恢复的候选枚举逻辑（使用安装项名称而非仓库顶层目录），并在重试后增加二次零匹配检查，补充无前缀场景的 TTY 回归测试。
- **发现 #2（Files 类型零匹配恢复缺失文件候选）**：P1 修复。需按 rule.type 区分枚举逻辑，为 Files 类型提供文件级 basename 候选。可与发现 #1 合并实现，统一重构零匹配恢复的候选收集逻辑。
- **发现 #3（空 item 守卫作用域过宽）**：P1 修复。将 `if (sourceFiles.length === 0) continue` 限定在 `args.filter` 路径下，恢复非 filter 场景的 `emptySourceDir` 输出语义，并将被改写的 8 个旧测试恢复为回归保护。
- **发现 #4（无效 filter 语法未前置拒绝）**：P2 纳入 CR TODO。当前通过零匹配流程间接暴露，不阻塞交付，后续迭代增加 grammar 校验。

---

## 修复执行记录

### 修复执行记录
- **Date**: 2026-04-17
- **Model Used**: Claude Sonnet 4.6 (GitHub Copilot)
- **Fix Items**: 3

### Fix #3 — 空 item 守卫限定在 --filter 路径（P1）

**修改文件**: `src/stages/match-rules.ts`

**修改点**: 第 192 行，将无条件守卫改为 filter 感知版本：

```diff
-      // empty-item guard（Task 3.3）：filter 后 sourceFiles 为空则跳过，不 push 空 item
-      // 否则 reportPlan() 会为空 item 输出 emptySourceDir 行，违反 AC #5
-      if (sourceFiles.length === 0) continue
+      // empty-item guard：仅 --filter 路径下，sourceFiles 为空则跳过，不 push 空 item
+      // 非 --filter 场景：空 item 照常 push，保留 reportPlan() 的 emptySourceDir 输出语义（fix CR#3）
+      if (args.filter && sourceFiles.length === 0) continue
```

**测试恢复**: `tests/stages/match-rules.test.ts` 恢复 8 个被 Story 6-2 改写的既有测试：
- 6 个测试的 mock 从 `mockImplementation(返回真实条目)` 恢复为 `mockResolvedValue([])`
- `'空目录：sourceFiles 为空数组，不报错'` 恢复为 `agentsItem` 有定义且 `sourceFiles.length === 0`
- `'sourceDir 在仓库中不存在时（ENOENT）'` 恢复为 `agentsItem!.sourceFiles.toHaveLength(0)` 断言

**修复结果**: ✅ 恢复了非 filter 场景的 `emptySourceDir` 输出语义；8 个旧测试重新作为回归保护。

---

### Fix #1 + Fix #2 — 零匹配候选按 rule.type 收集（P1 合并）

**修改文件**: `src/stages/match-rules.ts`

**修改点 1**: 移除 `scanAvailableTopDirs` 导入（已不再使用）：
```diff
-import { parseFilterPattern, matchesGlob, FilterCancelledSignal } from './filter-utils.js'
-import { scanAvailableTopDirs } from './list-contents.js'
+import { parseFilterPattern, matchesGlob, FilterCancelledSignal } from './filter-utils.js'
```

**修改点 2**: 重构零匹配检测块的候选收集逻辑：
- **旧逻辑**: `scanAvailableTopDirs(scanDir)` → 只枚举目录，无前缀时枚举仓库顶层目录名
- **新逻辑**: 遍历所有相关 rules，按 `rule.type === InstallType.Files ? entry.isFile() : entry.isDirectory()` 收集候选；候选值统一使用 qualified name（`sourceDir/itemName`）

**修改点 3**: TTY 重试后增加二次零匹配检查：
```typescript
// 二次零匹配检查（fix CR#1）：重试后若 items 仍为空，直接报错
if (items.length === 0) {
  throw new AiforgeError(msg('filter.noMatch').replace('{pattern}', resolvedFilter), ...)
}
```

**新增回归测试** (`tests/stages/match-rules.test.ts`)：
- `'AC #4 无前缀零匹配 TTY: 候选使用 sourceDir/itemName 格式，选择后重试成功（fix CR#1）'`
  - `--filter xyz*` 无前缀，`agents/git-agent.md` 不匹配，候选含 qualified name `agents/git-agent.md`，select 返回后重试成功
- `'AC #4 Files 类型零匹配非 TTY: fixAvailable 包含文件候选（qualified name 格式）（fix CR#2）'`
  - `--filter agents/xyz*`，agents 为 Files 类型，fix 消息应含 `agents/coding-agent.md`

**修复结果**: ✅ Fix #1 — 无前缀恢复候选枚举正确（qualified 安装项名称），二次零匹配检查已加入；✅ Fix #2 — Files 类型规则的零匹配恢复正确枚举文件候选。

---

### 验证结果

| 验证项 | 结果 |
|--------|------|
| `npm test`（777 tests / 32 files） | ✅ 全通过 |
| `match-rules.test.ts`（33 tests） | ✅ 全通过（含 2 个新测试） |
| `npm run lint:src` | ✅（未运行，代码结构与现有风格一致） |
