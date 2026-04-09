---
Story: 4-2
Round: 4
Date: 2026-03-27
Model Used: Claude Opus 4 (claude-opus-4-20250514)
Review Source: 4-2-code-review-summary-20260327-round-4.md
Review Model: GPT-5.4 (gpt-5.4)
Type: Code Review Evaluation
---

## 评估总结

对 Story 4-2 的第 4 轮 CR 代码审查结果（复审）进行逐条评估。前几轮阻塞项已全部修复。本轮提出 2 个新发现。评估结论如下。

---

## 上轮问题回顾确认

历史阻塞项（R1-#1 symlink 逃逸、R2-#2 Lint）维持已修复。
历史 CR TODO（R1-#2、R2-#1、R3-#1）维持 P2 非阻塞。
R3-#2（InstallFn 合约）维持误报。
不再重复展开。

---

## 发现 #1 评估

### 审查原文

> **[中][新] `sourceFiles = []` 的 plan item 没有被真正"静默跳过"，反而会创建空目标目录，甚至在目标冲突时直接 fail-fast**

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

经代码验证：

1. `match-rules.ts:173` 无条件执行 `items.push({ rule, sourceFiles, targetPath, mode })`，不管 `sourceFiles` 是否为空数组。这是 Story 3-3（match-rules）的既有行为。
2. `execute-install.ts:124` 对每个 item 无条件调用 `ensureDir(item.targetPath)`，在 `for (const srcPath of item.sourceFiles)` 循环之前。当 `sourceFiles = []` 时，循环体不执行（无文件操作），但 `ensureDir` 已执行并创建了空目录。
3. 若 `targetPath` 恰好是已存在的普通文件，`ensureDir()` 会因 `ENOTDIR` 抛 `ENSURE_DIR_FAILED` fatal 错误——本应 no-op 的空规则变成了 fail-fast 的罪魁祸首。

**严重性判断：合理，P1**

1. **副作用确认**：创建空目标目录是真实的文件系统副作用。虽然在正常场景下创建一个空目录"无害"，但它违反了 match-rules 对空源目录"静默跳过"的语义契约。
2. **fail-fast 场景确认**：当 `targetPath` 碰巧是已存在文件时，空规则让整个安装 fatal——这是一个可复现的功能缺陷，不是理论问题。
3. **修复成本极低**：在 `for (const item of plan.items)` 循环开始处加一行 `if (item.sourceFiles.length === 0) continue` 即可。

审查标为 [中] 合理，评估升为 **P1 阻塞**。理由：虽然单独来看是边界场景，但它是一个可复现的功能性 bug（空规则不应产生副作用或报错），修复成本极低（一行代码），应当在本 Story 内修复。

**修复建议：可行**

在循环开始处跳过空 sourceFiles item，并补回归测试。完全可行。

**误报评估：非误报**

---

## 发现 #2 评估

### 审查原文

> **[中][新] 成功路径从未调用 `reporter.completePhase()`，安装阶段的 phase lifecycle 未闭合**

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

经代码验证：

1. `execute-install.ts:112` 调用了 `reporter.startPhase('执行安装...')`。
2. 成功路径（execute-install.ts:165）直接 `return { items: resultItems }`，没有调用 `reporter.completePhase()`。
3. 对照其他 stage 实现：
   - `resolve-source.ts:48`: `reporter.completePhase()` ✅
   - `detect-tools.ts:157,186`: `reporter.completePhase()` ✅
   - `match-rules.ts:177`: `reporter.completePhase()` ✅
4. `TtyReporter.completePhase()` (reporter.ts:81-85) 负责调用 `spinner.succeed()` 并清空 spinner。不调用 `completePhase()` 意味着 ora spinner 不会被标记为成功完成。

**严重性判断：合理，P1**

1. **一致性违规**：所有其他 stage 都遵循 `startPhase → completePhase` 的生命周期约定，唯独 execute-install 缺少 `completePhase`。这不是"可选优化"，而是 Reporter 契约的一致性要求。
2. **实际影响**：接入 `TtyReporter` 后，安装阶段的 spinner 不会显示成功状态（缺少 `✓` 标记），与其他阶段的用户体验不一致。
3. **修复成本极低**：在 `return` 语句前添加 `reporter.completePhase()` 一行即可。

审查标为 [中] 合理，评估确认为 **P1 阻塞**。理由：这是与其他 stage 明确不一致的遗漏，修复成本一行代码，应当在本 Story 内修复。

**修复建议：可行**

在 `return { items: resultItems }` 前添加 `reporter.completePhase()`，并补测试。完全可行。

**误报评估：非误报**

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| R4-#1 | 空 `sourceFiles` item 创建空目录 / 可能 fail-fast | [中] | **P1** | 功能缺陷，一行代码修复 |
| R4-#2 | 成功路径缺少 `reporter.completePhase()` | [中] | **P1** | Reporter 契约一致性遗漏，一行代码修复 |

### 维持 CR TODO 跟踪（非阻塞）

| # | 发现 | 优先级 | 说明 |
|---|------|--------|------|
| R3-#1 | fail-fast 后无法输出已完成清单 | P2 | 归属 Story 4-6a |
| R2-#1 | broken symlink 内部也被拒绝 | P2 | 安全保守策略 |
| R1-#2 | `targetPath` 是文件时 preflight 未拒绝 | P2 | fail-fast 体验优化 |

### 评估决定

- **发现 #1（空 sourceFiles）**：确认有效，P1 阻塞。在循环开始处加 `continue` 跳过空 item，补 2 条回归测试。
- **发现 #2（缺少 completePhase）**：确认有效，P1 阻塞。在 return 前调用 `reporter.completePhase()`，补 1 条回归测试。
- **两项修复均为一行代码级别，建议合并修复后进入第 5 轮复审。**

---

## 修复执行记录

### 修复执行记录
- **Date**: 2026-03-27
- **Model Used**: Claude Sonnet 4 (claude-sonnet-4-20250514)
- **Fix Items**: 2

---

### R4-#1 修复：空 `sourceFiles` item 跳过处理

**修改文件**：`src/stages/execute-install.ts`

**修改位置**：第 119 行，`for (const item of plan.items)` 循环开始处

**修改内容**：新增一行 `if (item.sourceFiles.length === 0) continue`，在进入 `ensureDir` 和文件操作之前跳过空 item。

**修改前**：
```typescript
for (const item of plan.items) {
    // 根据 scope 推导 allowedRoot（与 preflight 保持一致）
    const allowedRoot = ...
```

**修改后**：
```typescript
for (const item of plan.items) {
    // 空 sourceFiles 静默跳过：不创建目录、不产生副作用（CR R4-#1）
    if (item.sourceFiles.length === 0) continue

    // 根据 scope 推导 allowedRoot（与 preflight 保持一致）
    const allowedRoot = ...
```

**回归测试**（`tests/stages/execute-install.test.ts`）：
1. `sourceFiles 为空的 item 不创建目标目录（无副作用）` — 验证空 item 不调用 `ensureDir`，目标目录不存在
2. `sourceFiles 为空且 targetPath 是已存在文件时，静默跳过不抛错` — 验证之前会 fail-fast 的场景现在静默通过

**修复状态**：✅ 已完成

---

### R4-#2 修复：成功路径补 `reporter.completePhase()`

**修改文件**：`src/stages/execute-install.ts`

**修改位置**：第 165 行，`return` 语句前

**修改内容**：在 `return { items: resultItems }` 前新增 `reporter.completePhase()` 调用，闭合 phase 生命周期。

**修改前**：
```typescript
  return { items: resultItems }
```

**修改后**：
```typescript
  reporter.completePhase()
  return { items: resultItems }
```

**回归测试**（`tests/stages/execute-install.test.ts`）：
1. `成功路径调用 reporter.completePhase 恰好 1 次` — 验证 completePhase 在成功路径被精确调用一次

**修复状态**：✅ 已完成

---

### 测试验证

- execute-install 测试套件：**20/20 通过**（含 3 条新增回归测试）
- 完整测试套件：**460/460 通过**，零回归
