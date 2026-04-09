---
Story: 4-2
Round: 3
Date: 2026-03-27
Model Used: Claude Opus 4 (claude-opus-4-20250514)
Review Source: 4-2-code-review-summary-20260327-round-3.md
Review Model: GPT-5.4 (gpt-5.4)
Type: Code Review Evaluation
---

## 评估总结

对 Story 4-2 的第 3 轮 CR 代码审查结果（复审）进行逐条评估。本轮审查确认前两轮阻塞项均已修复，提出 2 个新发现。评估结论如下。

---

## 上轮问题回顾确认

### Round 1 / Finding #1（P0 symlink 逃逸）：✅ 确认已修复

与 Round 2 评估结论一致，不再重复。

### Round 2 / Finding #2（Lint 未通过）：✅ 确认已修复

实测 `npm run lint` 已全绿。

### Round 1 / Finding #2（preflight 对普通文件放行）：维持 CR TODO / P2

与 Round 1/2 评估结论一致，不再重复。

### Round 2 / Finding #1（broken symlink 保守拒绝）：维持 CR TODO / P2

与 Round 2 评估结论一致，不再重复。

---

## 发现 #1 评估

### 审查原文

> **[高][新] fail-fast 抛错后无法输出"已完成操作清单"，直接违背 AC #6 / FR-031**

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P2 优先级）

### 评估分析

**问题描述准确性：基本准确，但对 AC #6 的解读存在过度演绎**

经代码验证：

1. `executeInstall()` (execute-install.ts:117-165) 确实将结果累积在本地变量 `resultItems` 中，异常抛出时该变量不会返回给调用方。描述本身准确。
2. `AiforgeError` (errors.ts:10-22) 确实不包含 `completedItems` 等附加 payload 字段。描述准确。

然而，对 AC #6 "违背"的判断存在过度演绎：

**严重性判断：偏高，建议降至 [中] / P2，理由如下：**

1. **AC #6 原文分析**：AC #6 写道"抛出 `AiforgeError(severity: 'fatal')`，管道立即终止，返回已完成的操作清单（FR-031）"。此处"返回已完成的操作清单"的行为主体并不一定是 `executeInstall()` 本身——这是管道层（pipeline orchestrator）的职责。Story 4-6a 正是负责"管道编排与错误流控制"，其 AC #2 明确要求编排器处理 fatal 错误后通过 `reporter.reportError()` 输出错误。

2. **Story 4-6a 的设计决策**：Story 4-6a Task 2.3 明确写道："Install 阶段的文件 I/O 错误统一为 fatal（fail-fast），**不存在 partial 错误概念**——hash 相同跳过是正常结果 `status: 'skipped'`，不是错误"。这表明架构层面已决定 Install 阶段只负责抛异常，partial results 的处理留给管道编排层。

3. **Story 4-2 Task 1.8 的实现**："fail-fast：文件操作异常时停止后续安装，返回已完成的结果列表"——这里的"返回"在 throw 模式下确实无法通过函数返回值实现。但这是一个 **实现方式问题**（如何传递 partial results），而非 **功能缺失**。当前行为是：异常发生 → 管道终止 → 未继续执行后续文件。这满足了 fail-fast 的核心语义。

4. **已完成文件实际已落盘**：审查自己也承认"前一个文件已经写入磁盘"。用户可以通过重新执行 install 来查看哪些文件已安装（因为这些文件会被标记为 `skipped`）。虽然不是理想的用户体验，但不构成数据丢失或安全问题。

5. **跨 Story 职责边界**：在 `AiforgeError` 上附加 `completedItems` payload 是一个跨多个模块的架构变更（影响 `core/errors.ts`、`stages/execute-install.ts`、`pipeline.ts`、`core/reporter.ts`），超出 Story 4-2 "复制模式安装执行" 的单一职责范围。这类改动更适合在 Story 4-6a（管道编排与错误流控制）中统一处理。

**修复建议：可行但归属于 Story 4-6a**

审查建议"给 `AiforgeError` 增加已完成项 payload"技术上可行，但从架构职责角度应由 Story 4-6a 在编排层统一设计 partial results 传递方案，而非在 Story 4-2 中局部修补。

**误报评估：非误报，但严重性过高且归属错误**

---

## 发现 #2 评估

### 审查原文

> **[中][新] `executeInstall()` 不符合当前 `InstallFn` 合约，阶段实现暂时不能直接接入管道**

### 评估结论：❌ 误报 — 可忽略

### 评估分析

**问题描述准确性：描述准确，但结论为误报**

经代码验证：

1. `InstallFn` (pipeline.ts:84-88) 签名为 `(plan: MatchedPlan, args: ParsedArgs, reporter: Reporter) => Promise<InstallResult>`，3 个参数。
2. `executeInstall()` (execute-install.ts:106-111) 签名为 `(plan, _args, reporter, pathResolver) => Promise<InstallResult>`，4 个参数。
3. 类型不匹配确实存在。描述准确。

**然而，这是一个设计正确的、已被后续 Story 明确覆盖的预期差异：**

1. **Story 4-6a Task 1.6 已明确规划接线方案**：`"替换 install 占位 → import { executeInstall } from './stages/execute-install.js'"`。这意味着接线时必然会处理签名适配问题（通过 factory / wrapper / 闭包注入等方式）。

2. **当前 `InstallFn` 是占位类型**：`pipeline.ts:124` 的 `install` 实现是 `async () => notImplemented('install')`——一个什么都不做的占位函数。当前阶段 `InstallFn` 类型签名本身就是"最终设计前的临时占位"，随着各 stage 实现逐步推进，pipeline 类型签名必然会在 4-6a 中统一调整。

3. **不影响当前 Story 的功能和测试**：Story 4-2 的所有测试直接调用 `executeInstall()` 并传入 4 个参数，测试全绿。签名差异只在未来接线时需要处理，而这正是 4-6a 的职责。

4. **Story 4-2 的 AC 中没有要求满足 `InstallFn` 合约**：6 条 AC 均关注安装执行逻辑本身，没有一条要求"符合 pipeline stage contract"。

**误报评估：误报 — 超出 Story 4-2 范围的前瞻性观察，已被 Story 4-6a 覆盖**

---

## 整体评估结论

### 需要修复（阻塞交付）

**无。**

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| R3-#1 | fail-fast 后无法输出已完成清单 | [高] | **P2** | 跨 Story 职责，应由 4-6a 统一设计 |
| R2-#1 | broken symlink 内部也被拒绝 | [中] | **P2** | 延续 Round 2 评估结论 |
| R1-#2 | `targetPath` 是文件时 preflight 未拒绝 | [中]→[低] | **P2** | 延续 Round 1 评估结论 |

### 可忽略（误报）

| # | 发现 | 原始严重性 | 评估结论 | 说明 |
|---|------|----------|---------|------|
| R3-#2 | `executeInstall()` 不符合 `InstallFn` 合约 | [中] | **误报** | 预期的临时差异，Story 4-6a 已规划接线适配 |

### 评估决定

- **发现 #1（fail-fast 已完成清单）**：有效但降级至 P2，非 Story 4-2 职责范围。partial results 传递方案应由 Story 4-6a（管道编排与错误流控制）统一设计，不阻塞 Story 4-2 交付。
- **发现 #2（InstallFn 合约不匹配）**：误报。当前签名差异是预期的、已被 Story 4-6a 明确覆盖的临时状态。
- **整体结论：Story 4-2 所有阻塞项已修复，本轮无新增阻塞项，建议通过。**

---

## 修复执行记录

### 修复执行记录
- **Date**: 2026-03-27
- **Model Used**: Claude Sonnet 4 (claude-sonnet-4-20250514)
- **Fix Items**: 0

### 执行说明

本轮评估结论为 **"无阻塞项需要修复"**，因此未执行任何代码修改。

| 类别 | 条目数 | 处理方式 |
|------|--------|---------|
| 需要修复（阻塞交付） | 0 | — |
| CR TODO 跟踪（P2 非阻塞） | 3 | 保持 CR TODO 状态，归属后续 Story 处理 |
| 可忽略（误报） | 1 | 已忽略 |

**详细说明：**

- **R3-#1**（fail-fast 后无法输出已完成清单）：P2 非阻塞，跨 Story 职责，应由 Story 4-6a 统一设计 partial results 传递方案。不修复。
- **R3-#2**（`executeInstall()` 不符合 `InstallFn` 合约）：误报，预期的临时差异，Story 4-6a 已规划接线适配。不修复。
- **R2-#1**（broken symlink 内部也被拒绝）：P2 延续，已进入 CR TODO 跟踪。不修复。
- **R1-#2**（`targetPath` 是文件时 preflight 未拒绝）：P2 延续，已进入 CR TODO 跟踪。不修复。

### 结论

✅ Story 4-2 第 3 轮 CR 评估无阻塞修复项，CR 修复执行完成。
