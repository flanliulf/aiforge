---
Story: 3-2
Round: 1
Date: 2026-03-25
Model Used: GPT-5.4 (model ID: gpt-5.4)
Type: Code Review Summary
---

## 审查结论

结论：**需修复后再通过**。

本轮为首轮审查，全部为**新发现**。当前实现的核心匹配逻辑基本正确，`build` 与全量测试也通过；但仍有 2 个问题影响交付完成度：1 个中等问题（阶段契约无法直接接入主流程），1 个低等问题（仓库既有 lint 未通过）。

## 审查范围

- Story：`_bmad-output/implementation-artifacts/3-2-rule-matching-engine.md`
- 实现：`src/stages/match-rules.ts`
- 测试：`tests/stages/match-rules.test.ts`
- 相关契约：`src/pipeline.ts`、`src/core/types.ts`

## 发现清单

### 1. [中] `matchRules()` 与 pipeline `MatchFn` 契约不一致，主流程暂时无法直接接线

- 类型：新发现
- 证据：
  - Story Task 1.1 将目标签名定义为 `matchRules(env: DetectedEnv, args: ParsedArgs, reporter: Reporter): Promise<MatchedPlan>`：`_bmad-output/implementation-artifacts/3-2-rule-matching-engine.md:21-29`
  - pipeline 当前 `MatchFn` 也是三参签名：`src/pipeline.ts:73-77`
  - 实际实现却把 `repo: LocalRepo` 与 `pathResolver: PathResolver` 也设为必填参数：`src/stages/match-rules.ts:101-113`
- 影响：
  - Story 4.6a 若按“替换 match 占位 → `import { matchRules }`”直接接线，将无法把该函数直接赋给 `PipelineStages.match`。
  - 现有测试只覆盖独立调用 `matchRules()`，没有覆盖进入 `runPipeline()` 的真实集成路径，因此该问题不会在当前测试中暴露。
- 建议：
  - 统一阶段契约：要么更新 `pipeline.ts` 的 `MatchFn` / `runPipeline()`，显式把 `repo` 和 `pathResolver` 传入 Match 阶段；要么保留三参阶段签名，并在外层提供闭包/工厂包装来注入依赖。

### 2. [低] Story 3-2 新增文件未通过仓库 lint，当前 `review` 状态的完成度说明不准确

- 类型：新发现
- 证据：
  - `npx prettier --check src/stages/match-rules.ts tests/stages/match-rules.test.ts` 失败，告警仅落在本 Story 新增的两个文件。
  - Story Dev Agent Record 记录为 `- **Lint:** ESLint 无警告`：`_bmad-output/implementation-artifacts/3-2-rule-matching-engine.md:193-199`
- 影响：
  - 仓库既有 `npm run lint` 当前为红灯，说明该 Story 尚未满足仓库 lint 门禁。
  - 审阅者容易被 Story 记录误导，以为本 Story 已完成完整 lint 校验。
- 建议：
  - 先对两文件执行 Prettier / `npm run lint` 至绿，再将 Story 中的校验记录更新为仓库实际结果。

## 通过项

- `RULE_INDEX` 的 `${tool}:${scope}` O(1) 查找实现正确，且 `--dirs` 的 MVP 临时约束已在 Story 中明确。
- `files` / `directories` / `flatten` 三种扫描分支与 AC 对齐。
- `ENOENT` / `ENOTDIR` 白名单降级、其他错误继续抛出，边界处理方向正确。
- `npm run build` 通过。
- `npm test` 通过，当前全量为 `366` 个测试通过。

## 验证摘要

- `npm run build` ✅
- `npm test` ✅
- `npm run lint` ❌
- `npx prettier --check src/stages/match-rules.ts tests/stages/match-rules.test.ts` ❌
