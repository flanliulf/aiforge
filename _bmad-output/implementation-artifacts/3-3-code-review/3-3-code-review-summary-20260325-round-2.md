---
Story: 3-3
Round: 2
Date: 2026-03-25
Model Used: GPT-5.4 (gpt-5.4)
Type: Code Review Summary
---

## 审查结论

本轮为复审。上轮已确认的 2 条修复项中，**1 条已完全修复，1 条仅部分修复**；本轮**无新的独立问题**，但仍存在 **1 个遗留阻塞问题**，暂不建议通过。

## 上轮问题回顾

### 已修复

1. **Round 1 / 发现 #3：Prettier / lint 未通过**
   - 本轮复验：`npm run lint` 已通过
   - 结论：✅ 已修复

### 非阻塞建议（维持不变）

1. **Round 1 / 发现 #1：CLI 入口未接入 `createProductionStages()`**
   - 当前代码仍是 `src/index.ts:49` → `runPipeline(args, reporter)`
   - 依据上一轮 evaluation，此项继续视为 Epic 2 接线建议，不计入本 Story 阻塞项

## 新发现

本轮**无新的独立问题**。

## 遗留问题

### 1. [中][遗留] `flatten` 模式的目标路径仍不准确，`dry-run` 预览与设计语义不一致

- 背景：
  - 上轮问题 #2 指出 `reportPlan()` 输出的目标路径不够精确。
  - 当前修复已覆盖 `files` / `directories` 场景，但 **`flatten` 子场景仍然不正确**。

- 证据：
  - `src/core/reporter.ts:20-27` 新增的 `resolveFileTarget()` 统一执行 `join(targetPath, basename(srcFile))`
  - 对 `flatten` 来说，`srcFile` 当前是目录路径（如 `/repo/skills/code-review`），因此会输出：
    - `cursor  skills/code-review  →  /home/user/.cursor/rules/code-review  flatten  copy`
  - 但 PRD 明确将 `flatten` 定义为：**“扁平化提取主文件并重命名”**
    - `_bmad-output/planning-artifacts/prd.md:54`
    - `_bmad-output/planning-artifacts/prd.md:385`（`mainFile?: string`）
  - Epic 4 示例进一步明确：
    - `skills/code-review/` 应提取主文件（默认 `index.md`），重命名为 `.cursor/rules/code-review.md`
    - `_bmad-output/planning-artifacts/epics/epic-4.md:86-92`
  - 当前测试没有覆盖这一点：
    - `tests/stages/report.test.ts:65-77` 仅提供 flatten 测试数据
    - `tests/stages/report.test.ts:176-179` 只断言输出包含 `flatten` 标签，并未断言最终目标文件名

- 影响：
  - Cursor / flatten 规则的预览结果仍与文档定义的实际安装结果不一致
  - AC #2“每个文件显示源路径 → 目标路径”在 flatten 场景下仍未完全满足
  - AC #4“dry-run 输出与实际安装结果一致”在 flatten 场景下仍存在偏差

- 建议：
  - 不要把 `flatten` 当作 `directories` 同处理
  - 需要在 `MatchedPlan` 或 reporter 层补齐 flatten 专属目标文件名规则：
    - 基于 `mainFile`（默认 `index.md`）确定主文件
    - 将目标路径解析为 `<targetDir>/<source-dir-name>.md`
  - 补充测试，至少断言类似：
    - `skills/code-review/  →  ~/.cursor/rules/code-review.md`

## 验证摘要

- `npm run lint` ✅
- `npm test` ✅（401 / 401）
- `npm run build` ✅
- `PlainReporter` flatten 最小复现 ❌
  - 实际输出：`cursor  skills/code-review  →  /home/user/.cursor/rules/code-review  flatten  copy`
  - 期望语义：应体现为重命名后的目标文件（如 `code-review.md`）

## 通过项

- `files` / `directories` 的目标路径已提升到更精确的文件/目录级别
- `reportPlan()` 的 stdout 输出职责保持正确
- `npm run lint` 已恢复通过
- 本轮未发现除 flatten 语义以外的新回归问题
