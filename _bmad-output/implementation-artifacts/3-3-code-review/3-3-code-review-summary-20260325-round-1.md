---
Story: 3-3
Round: 1
Date: 2026-03-25
Model Used: GPT-5.4 (gpt-5.4)
Type: Code Review Summary
---

## 审查结论

本轮为首轮审查。当前实现存在 **2 个阻塞问题** 和 **1 个非阻塞问题**，暂不建议通过。

## 主要发现

### 1. [高] CLI 入口仍调用默认占位阶段，`--dry-run` 实际无法走到 Story 3.3 的新实现

- 证据：
  - `src/index.ts:41-49` 直接执行 `await runPipeline(args, reporter)`，未传入 `createProductionStages(...)`
  - `src/pipeline.ts:144-153` 的 `DEFAULT_STAGES` 仍全部指向占位实现
  - `src/pipeline.ts:166-183` 新增的 `createProductionStages()` 在生产代码中没有接线
  - 仓库中真实阶段已存在：`src/stages/resolve-source.ts:39`、`src/stages/authenticate.ts:43`、`src/stages/clone.ts:191`
- 复现：
  - 执行 `npm run build`
  - 执行 `node dist/index.js https://example.com/foo/bar.git --dry-run`
  - 实际输出：`✗ 阶段 "resolve" 未实现`
- 影响：
  - 用户态 `npx aiforge --dry-run` 无法真正达到 Match/Report，AC #1 / #5 未兑现
  - 当前属于“测试里可跑、CLI 实际不可用”的状态
- 建议：
  - CLI 入口改为显式构造并传入 production stages，避免继续走 `DEFAULT_STAGES`

### 2. [中] `reportPlan()` 输出的是规则级目标目录，不是“每个文件”的最终目标路径

- 证据：
  - Story 要求 `每个文件显示：源路径 → 目标路径`，示例为 `agents/coding-agent.md → ~/.copilot/agents/coding-agent.md`
    - `_bmad-output/implementation-artifacts/3-3-dry-run-preview-and-install-plan.md:34`
    - `_bmad-output/implementation-artifacts/3-3-dry-run-preview-and-install-plan.md:68-90`
  - 但 `src/core/reporter.ts:126-132` 与 `src/core/reporter.ts:202-207` 对每个文件都直接输出同一个 `${item.targetPath}`
  - `src/stages/match-rules.ts:65-77,170-173` 中的 `targetPath` 来自 `rule.targetDir` 解析，语义是目录级路径
  - `tests/stages/match-rules.test.ts:187-202` 也明确断言 `targetPath === '/home/user/.copilot/agents/'`
- 影响：
  - 对 `files` / `directories` 类型，dry-run 预览无法准确说明每个源项的最终落点
  - AC #2 与 AC #4（预览与实际安装结果一致）存在偏差，现有测试也未拦住该问题
- 建议：
  - 在 `MatchedPlan` 或 reporter 层补齐每个 source item 的最终 target path 计算，并同步更新输出测试

### 3. [低] 质量门禁未通过：`npm run lint` 仍失败

- 证据：
  - 本次验证结果：`npm test` 通过、`npm run build` 通过、`npm run lint` 失败
  - Prettier 报告 `src/core/reporter.ts`、`tests/integration/dry-run.test.ts` 存在格式问题
- 影响：
  - Story 文档中的“Lint：零错误零警告 ✅”与当前仓库状态不一致
  - PR / CI 会在样式检查阶段被拦截
- 建议：
  - 运行仓库既有格式化流程后重新执行 `npm run lint`

## 验证摘要

- `npm test` ✅（401 个测试通过）
- `npm run build` ✅
- `npm run lint` ❌（Prettier 指向 `src/core/reporter.ts`、`tests/integration/dry-run.test.ts`）

## 通过项

- `reportPlan()` 三种 Reporter 的基本分流、stdout/stderr 职责和统计行方向正确
- `matchRules()` 已补充 `mode` 字段，并新增 `LINK_PROJECT_REJECTED` 校验
- 测试覆盖面较广，但当前更偏向内部调用与局部格式校验，缺少 CLI 入口接线验证
