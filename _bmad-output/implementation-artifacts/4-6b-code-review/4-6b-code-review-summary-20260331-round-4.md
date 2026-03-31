---
Story: 4-6b
Round: 4
Date: 2026-03-31
Model Used: GPT-5.4
Type: Code Review Summary
---

## 审查结论

本轮为 **第 4 轮复审**。

Round 3 指出的主问题已经基本收口：

- `tests/integration/pipeline.test.ts` 中缺失的 `tool` 字段已补齐
- `npm test` / `npm run build` / `npm run lint` 均通过

当前未再发现新的 AC / 运行时正确性问题；但 **`InstallResult` 契约的全仓同步仍未完全做完**，还剩 2 处测试 fixture 漏改。建议把这两处补齐后，结束本 Story 的 CR 流程。

## 上轮问题复核

### 1. 上轮问题 #1：`tests/integration/pipeline.test.ts` 的 `mockResult` 缺少 `tool` → 已关闭

- **上轮结论**：需要修复
- **本轮复核结果**：✅ **已关闭**

**证据：**

- `mockResult` 的 3 个 item 均已补齐 `tool: 'claude'`
  - `tests/integration/pipeline.test.ts:96-115`
- 我额外做了定向静态检查，Round 3 指出的 `tests/integration/pipeline.test.ts(98/103/108)` 的 `tool` 缺失报错已不再出现

### 2. 上轮问题 #2：`createProductionStages().report` 缺少自动化覆盖 → 维持 TODO，不作为本轮阻断项

- **上轮结论**：建议降级为 TODO backlog
- **本轮复核结果**：ℹ️ **维持非阻断 TODO**

本轮未看到针对 `src/pipeline.ts:348-360` 新增直接测试；但根据上一轮 evaluation，这一项应视为低优先级覆盖缺口，而不是当前 Story 的阻断问题。本轮也未见相关运行时回归，因此不重新升级为阻断项。

## 本轮新发现

### 1. `InstallResult` 类型变更的全仓同步仍不完整，尚有 2 处测试 fixture 缺少必填 `tool`

- 严重级别：**Medium**
- 证据：
  - `InstallResult.items[].tool` 当前为必填字段：`src/core/types.ts:70-79`
  - `tests/core/types.test.ts` 的 `InstallResult` fixture 仍缺 `tool`
    - `tests/core/types.test.ts:93-103`
  - `tests/integration/pipeline-production-stages.test.ts` 中传给 `stages.saveManifest()` 的 `badResult` 仍缺 `tool`
    - `tests/integration/pipeline-production-stages.test.ts:287-298`

**问题说明：**

这与 Round 1 / Round 3 发现的是同一类问题：`InstallResult` 契约从 `{ status, sourcePath, targetPath }` 扩展为必须包含 `tool` 后，修复者已经补了部分测试 fixture，但**没有完成全仓同步**。

我做了定向静态检查，命中了这两处 story-related 报错：

- `tests/core/types.test.ts(96)`：`tool` 缺失
- `tests/integration/pipeline-production-stages.test.ts(297/298)`：传入 `InstallResult` 形状不满足要求

**影响：**

- 运行时测试仍会全绿，因为仓库当前没有把 `tests/` 纳入正式 typecheck
- 但从类型契约和 CR 收口质量来看，这两处仍属于未完成的同步工作
- 同时，这也再次印证了项目规则里“变更共享类型后必须全仓 grep 受影响引用并逐个评估”的要求，本次修复仍未完全满足

**建议：**

- 给 `tests/core/types.test.ts:94-101` 中的 fixture 补上 `tool`
  - 并同步把测试标题从“status/sourcePath/targetPath”更新为包含 `tool`
- 给 `tests/integration/pipeline-production-stages.test.ts:287-295` 的 `badResult.items[0]` 补上一个占位 `tool`
  - 例如 `'cursor'` 或 `'test-tool'`，即可满足类型契约；该测试断言的核心仍是 `manifest plan info missing`

## 验证记录

本轮实际执行并通过：

- `npm test` ✅（576 / 576）
- `npm run build` ✅
- `npm run lint` ✅

本轮额外执行的定向检查：

- `npx tsc --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext tests/integration/pipeline.test.ts`
  - 已不再出现 Round 3 指出的 `tool` 缺失报错
- `npx tsc --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext tests/integration/pipeline-production-stages.test.ts`
  - 命中 story-related 的 `badResult` 缺少 `tool`
- `npx tsc --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext tests/core/types.test.ts`
  - 命中 story-related 的 `InstallResult` fixture 缺少 `tool`
  - 同一文件中还存在一个与本 Story 无关的旧测试漂移（`MatchedPlan.mode`），未纳入本轮结论

## 最终建议

当前 `4-6b` 已没有新的输出格式/门禁问题，剩余问题只是在测试层补齐 `InstallResult.tool` 的最后两处漏网之鱼。

建议下一步：

1. 修复 `tests/core/types.test.ts`
2. 修复 `tests/integration/pipeline-production-stages.test.ts`

完成后再做一次快速复审，预期即可结束本 Story 的 CR。
