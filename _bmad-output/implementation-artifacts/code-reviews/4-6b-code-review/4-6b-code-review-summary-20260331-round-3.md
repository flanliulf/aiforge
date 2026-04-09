---
Story: 4-6b
Round: 3
Date: 2026-03-31
Model Used: GPT-5.4
Type: Code Review Summary
---

## 审查结论

本轮为 **第 3 轮复审**。

Round 2 指出的两项问题已经关闭：

- `sourcePath` 的 repo-relative 转换已接入真实生产链路
- `npm run lint` 已恢复通过

但本轮又发现 **2 个新的中等级问题**，都与测试/类型契约完整性相关。它们不影响当前运行时主流程通过，但说明本 Story 的修复收口还不完整，**建议再修一轮后结束 CR**。

## 上轮问题复核

### 1. 上轮残留：`sourcePath` 绝对路径输出问题 → 已关闭

- **上轮结论**：需要把输出从绝对 clone 路径改为 repo-relative 路径
- **本轮复核结果**：✅ **已关闭**

**证据：**

- 真实修复不在 `reporter.ts`，而是在生产闭包 `createProductionStages().report` 中完成：
  - `src/pipeline.ts:348-360`
- 该闭包在 `saveManifest()` 之后、真正调用 `report()` 之前，将 `sourcePath` 从 `lastRepo.repoDir` 前缀裁剪为 repo-relative 路径：
  - `item.sourcePath = item.sourcePath.slice(prefix.length)`
- `tests/core/reporter.test.ts` 的 fixture 与断言也已同步切换为 repo-relative 形式：
  - fixture：`tests/core/reporter.test.ts:9-64`
  - Plain 断言：`tests/core/reporter.test.ts:199-218`
  - TTY 断言：`tests/core/reporter.test.ts:333-350`

**说明：**

当前 `reporter.ts` 仍然只是“原样打印 `item.sourcePath`”：

- `src/core/reporter.ts:137-140`
- `src/core/reporter.ts:269-271`

但在真实生产阶段链中，进入 Reporter 前已经由 `pipeline.ts` 先完成了 repo-relative 归一化；这与 Round 2 evaluation 中记录的修复方案一致。

### 2. 上轮新发现：`npm run lint` 失败 → 已关闭

- **上轮结论**：Prettier 门禁不通过
- **本轮复核结果**：✅ **已关闭**

**证据：**

- 本轮独立执行 `npm run lint`，结果通过
- 输出为 `All matched files use Prettier code style!`

## 本轮新发现

### 1. `InstallResult` 的测试 fixture 仍有漏网之鱼：`tests/integration/pipeline.test.ts` 里的 `mockResult` 继续缺少 `tool`

- 严重级别：**Medium**
- 证据：
  - 当前类型契约已要求 `InstallResult.items[].tool` 为必填：`src/core/types.ts:70-79`
  - 但 `tests/integration/pipeline.test.ts` 中的 `mockResult: InstallResult` 仍然缺少 `tool` 字段：
    - `tests/integration/pipeline.test.ts:96-114`
  - 我做了定向静态检查，明确命中了这 3 处报错：
    - `tests/integration/pipeline.test.ts(98)`
    - `tests/integration/pipeline.test.ts(103)`
    - `tests/integration/pipeline.test.ts(108)`

**问题说明：**

Round 1 / Round 2 已经修过 `tests/pipeline.test.ts` 中同类问题，但 `tests/integration/pipeline.test.ts` 这份 `InstallResult` fixture 没有同步更新，仍然停留在旧契约上。

这与之前发现的类型漂移属于同一类问题：运行时测试能过，只是因为仓库当前不对 `tests/` 做完整 typecheck；但从接口一致性看，这仍然是未收口的修复。

**建议：**

- 给 `tests/integration/pipeline.test.ts:96-114` 中的 3 个 result item 补齐 `tool`
- 与现有测试场景保持一致即可，例如统一填 `'claude'` 或 `'test-tool'`

### 2. 真实生产链路里的 repo-relative 转换缺少自动化覆盖，核心修复仍主要依赖代码阅读

- 严重级别：**Medium**
- 证据：
  - Round 2 的关键修复逻辑位于 `src/pipeline.ts:348-360`
  - 但现有测试并没有直接锁定这段真实生产闭包行为：
    - `tests/core/reporter.test.ts` 只验证 Reporter 在“输入已是 relative path”时的格式化输出：`tests/core/reporter.test.ts:9-64`、`199-218`、`333-350`
    - `tests/pipeline.test.ts` 只验证默认 `report()` 分派与 `createProductionStages()` 函数存在性，不验证闭包中的路径裁剪：
      - 默认 report：`tests/pipeline.test.ts:171-210`
      - createProductionStages 基本形状：`tests/pipeline.test.ts:377-410`
    - `tests/integration/pipeline.test.ts` 只断言 `stages.report` 被调用，不检查传给 Reporter 的结果内容：`tests/integration/pipeline.test.ts:211-218`
    - `tests/integration/pipeline-production-stages.test.ts` 聚焦 `saveManifest`，未对 `stages.report()` / `reporter.reportResult()` 的 sourcePath 内容做断言：`tests/integration/pipeline-production-stages.test.ts:95-340`

**问题说明：**

目前“真实 CLI 输出使用 repo-relative sourcePath”这一点，主要靠：

- 代码路径阅读
- Round 2 修复说明
- Reporter 自身的 component-level 测试

但缺少一条真正覆盖 `createProductionStages().report` 闭包的自动化测试。也就是说，如果后续有人删掉或改坏 `src/pipeline.ts:348-360` 这段转换逻辑，现有测试仍有较大概率全绿。

**影响：**

- Story 4.6b 的核心输出契约虽然当前实现正确，但其**生产链路保障**仍不够强
- 这类“修复落在 pipeline 闭包、而测试只测 Reporter 组件”的结构，很容易在后续重构中回归

**建议：**

- 至少补一条针对 `createProductionStages().report` 的测试
- 更理想的是补一条真实生产阶段链集成测试，断言最终传给 `reporter.reportResult()` 的 `sourcePath` 已是 repo-relative

## 验证记录

本轮实际执行并通过：

- `npm test` ✅（576 / 576）
- `npm run build` ✅
- `npm run lint` ✅

本轮额外执行：

- `npx tsc --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext tests/integration/pipeline.test.ts`
  - 命中本 Story 相关的 `mockResult` 缺少 `tool` 报错
  - 同时还存在若干与本 Story 无关的仓库既有类型错误（未纳入本轮结论）

## 最终建议

本轮复审确认：Round 2 的核心修复已经真正落地，Story 4.6b 距离收口只差最后一小步。

建议下一轮优先修复：

1. `tests/integration/pipeline.test.ts` 中 `mockResult` 的 `tool` 字段遗漏
2. 为 `createProductionStages().report` 的 repo-relative 转换补一条真正命中生产闭包的测试

完成这两点后，再做一次短平快复审，预期即可结束本 Story 的 CR 流程。
