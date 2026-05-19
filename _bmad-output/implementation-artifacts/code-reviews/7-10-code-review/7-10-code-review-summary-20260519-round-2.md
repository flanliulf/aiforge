---
Story: 7-10
Round: 2
Date: 2026-05-19
Model Used: GPT-5.5
Type: Code Review Summary
---

## 审查结论

本轮为复审。由于当前工具面没有通用 Agent 工具，本轮按 bmenhance-cr-01-reviewer 的降级策略执行串行三层审查：Blind Hunter、Edge Case Hunter、Acceptance Auditor 均已覆盖，审查层无失败。上轮 2 个 P1 patch 项均已关闭：手动 `--tools` 分支现在会输出 `.iflow/` stale-tool 提示，且 `.iflow/` 存在性检查已改为非阻断。

当前复审结论：不通过。原因不是上轮 P1 未关闭，而是本轮发现 1 个新的 patch 阻塞项：全量 `npm test` 在当前仓库存在 `.iflow/` 残留目录时失败，`tests/integration/dry-run.test.ts` 的测试 Reporter mock 缺少 `info()`，导致 dry-run 测试未走到 `reportPlan` 断言路径。该问题影响 AC #5 的最终质量门禁，需要进入 evaluator/fixer。

## 上轮问题回顾

### 已修复

1. Round 1 / Finding #1 — 手动指定工具模式会绕过 `.iflow/` stale-tool 提示
   - 修复位置：`src/stages/detect-tools.ts:207-213`。手动 `args.tools` 分支在 `reporter.completePhase()` 和返回前调用 `await emitIflowStaleNoticeIfNeeded(reporter, pathResolver)`。
   - 回归测试：`tests/stages/detect-tools.test.ts:499-514` 覆盖 `args.tools = ['copilot']` 且 home `.iflow/` 存在时输出包含 `.iflow/` 与 `2026-04-17` 的提示。
   - 验证结果：`npm test -- tests/stages/detect-tools.test.ts` 通过，47 tests passed。

2. Round 1 / Finding #2 — `.iflow/` 信息性检查可能因权限/I/O 错误阻断安装流程
   - 修复位置：`src/stages/detect-tools.ts:103-120`。新增 `pathExistsNonBlocking()`，仅用于 `.iflow/` stale-tool 提示路径；该 helper 捕获存在性检查异常并返回 `false`，不改变通用 `pathExists()` 的严格错误传播语义。
   - 回归测试：`tests/stages/detect-tools.test.ts:885-899` 覆盖 home/project `.iflow/` 检查抛出 `EACCES` 时 `detectTools()` 仍返回有效工具结果，且不输出 stale notice。
   - 验证结果：`npm test -- tests/stages/detect-tools.test.ts` 通过，47 tests passed。

### 仍为非阻塞待办

无。

## 新发现

### 1. [中][新] dry-run 测试 Reporter mock 缺少 `info()`，当前仓库存在 `.iflow/` 时全量测试失败

- **来源**：blind+edge+auditor
- **分类**：patch

- **证据**
  - 当前工作区存在项目级 `.iflow/commands/` 残留目录；这会使 `detectIflowResidue()` 的项目级检查命中。
  - `src/stages/detect-tools.ts:123-128` 中 `emitIflowStaleNoticeIfNeeded()` 在检测到 `.iflow/` 后直接调用 `reporter.info(msg('detectTools.iflowStale'))`。
  - `src/stages/detect-tools.ts:207-213` 中手动 `--tools` 分支也会调用该 helper；`tests/integration/dry-run.test.ts:117` 的失败用例正是 `tools: ['claude']` 的手动模式。
  - `src/core/reporter.ts:9-18` 的 `Reporter` 接口包含 `info(message: string): void`，但 `tests/integration/dry-run.test.ts:36-56` 的 `createMockReporter()` 没有提供 `info` 方法。
  - 全量验证结果：`npm test` 失败，`1 failed | 34 passed` test files，`1 failed | 975 passed` tests；失败项为 `tests/integration/dry-run.test.ts > dry-run 管道路径（AC #1, #5） > AC #1: dryRun=true 时调用 reportPlan，不调用 reportResult`，断言 `mockReporter.reportPlan` 未被调用。
  - 隔离验证结果：`npm test -- tests/integration/dry-run.test.ts -t "AC #1: dryRun=true 时调用 reportPlan"` 同样失败，说明不是全量并发或其他测试污染导致。

- **影响**
  - AC #5 要求最终质量门禁 `npm test && npm run lint:src && npm run build` 全部通过；当前全量 `npm test` 已失败，Story 不能进入 Done。
  - 该问题由本轮 `.iflow/` 提示覆盖手动 `--tools` 分支后暴露：生产 `Reporter` 合约本身有 `info()`，但测试 mock 未跟随接口补全，导致存在项目级 `.iflow/` 的环境下 dry-run 集成测试提前进入错误处理路径。

- **建议**
  - 在 `tests/integration/dry-run.test.ts` 的 `createMockReporter()` 中补齐 `info: vi.fn()`，并检查同文件或其他集成测试中的 Reporter mock 是否同样缺少 `info` / `reportList` 等当前接口成员。
  - 保留 `detectTools()` 对 `reporter.info()` 的直接调用；生产接口已声明该方法，不建议为了测试 mock 不完整而降低实现合约。
  - 修复后重新执行 `npm test`、`npm run lint:src`；如允许触碰构建产物，再执行 `npm run build`。

## 验证摘要

- `npm test` ❌ 失败（1 failed / 976 total）
  - 失败：`tests/integration/dry-run.test.ts` 中 `mockReporter.reportPlan` 未被调用。
- `npm test -- tests/stages/detect-tools.test.ts` ✅ 通过（47 tests passed，约 211ms）
  - 覆盖手动 `--tools` stale notice、home/project `.iflow/`、`EACCES` 非阻断等上轮 P1 回归场景。
- `npm run lint:src` ✅ 通过
  - ESLint 与 Prettier check 均无错误。
- `npm run build` ✅ 当前会话上下文显示最近一次执行退出码 0
  - 本轮复审未重新执行 build，以避免在只读复审步骤中重新写入 `dist/` 构建产物。
- 额外复核：
  - `src/**` 中 `.iflow` 只出现在 `detect-tools.ts` 的只读存在性检查与 `messages.ts` 文案中，未新增 `.iflow/` 安装规则或写入路径。
  - `tests/stages/detect-tools.test.ts` 已覆盖上轮 2 个 P1 的回归路径。

## 通过项

- Round 1 的两个 P1 均已被当前实现和定向测试覆盖。
- `.iflow/` stale-tool 提示仍为信息性输出，不新增安装目标，不向 `.iflow/` 写入任何文件。
- `pathExists()` 的通用严格错误传播语义保持不变；非阻断降级仅限 stale-tool 提示路径。
- 文档与消息层对 iFlow 停服日期 `2026-04-17` 的描述一致。
- dismiss：未将“生产 Reporter 直接调用 `info()`”视为源码缺陷；`Reporter` 接口已经声明 `info()`，本轮问题根因是测试 mock 未实现完整接口。

## 结论

- **结论：不通过**
- **阻塞项**：1 个新 patch 项，全量 `npm test` 失败，需修复 dry-run 集成测试 Reporter mock。
- **四桶摘要**：decision_needed 0；patch 1；defer 0；dismiss 1。
- **上轮问题关闭情况**：2/2 已关闭。
- **建议**：进入 evaluator 评估本轮新发现；若采纳，进入 fixer 仅修复测试 mock / 质量门禁问题，不扩大到源码重构或 Story 状态流转。