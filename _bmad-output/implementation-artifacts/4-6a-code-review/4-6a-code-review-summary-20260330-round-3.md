---
Story: 4-6a
Round: 3
Date: 2026-03-30
Model Used: GPT-5.4
Type: Code Review Summary
---

# 审查结论

本轮结论：**复审通过，可合并**。

本轮为第 3 轮复审，重点验证 Round 2 的两项遗留问题：

1. `Flatten + --link` 是否仍会在真实链路中退化为 copy
2. 新增真实集成测试文件的 lint 失败是否已修复

## 上轮遗留问题复核

### 遗留问题 1：`Flatten + --link` 回归 → 已关闭

已确认修复完成，且修复方向正确：

- `MatchedPlan.mode` 已恢复为只表示安装方式：`'copy' | 'symlink'`
  - `src/core/types.ts:59-66`
- `matchRules()` 不再把 Flatten 规则强制写成 `mode: 'flatten'`，`--link + global` 会正常产出 `mode: 'symlink'`
  - `src/stages/match-rules.ts:31-55`
  - `src/stages/match-rules.ts:171-182`
- pipeline 层写 manifest 时，改由 `rule.type === InstallType.Flatten` 决定 manifest 中的 `mode: 'flatten'`
  - `src/pipeline.ts:223-240`
  - `src/pipeline.ts:321-333`

验证证据：

- 仓库新增了真实闭包集成测试：
  - `tests/integration/pipeline-production-stages.test.ts:301-342`
- 该测试同时验证：
  - plan 中 Flatten 规则 `mode === 'symlink'`
  - 实际安装结果是符号链接
  - manifest 中记录仍为 `mode === 'flatten'`

我另外做了独立最小复现，结果为：

- `PLAN_MODE [ { type: 'Flatten', mode: 'symlink' } ]`
- `IS_SYMLINK true`
- `MANIFEST_MODE flatten`

说明 Round 2 指出的语义冲突已彻底解除，真实运行行为与 manifest 语义现在一致。

### 遗留问题 2：新增测试文件 lint 失败 → 已关闭

已确认修复完成：

- `tests/integration/pipeline-production-stages.test.ts` 中未使用变量问题已消除
- `npm run lint` 现已通过

## 更早轮次问题复核

Round 1 的 3 个问题在 Round 2 已被评估为关闭，本轮再次抽样复核后仍保持关闭状态：

- manifest 共享 target root 元数据覆盖 → 关闭
- manifest 必填字段空值兜底 → 关闭
- 缺少真实 `createProductionStages()` / manifest 集成覆盖 → 关闭

本轮未发现这些问题回归。

## 本轮新发现

**无新发现。**

## 验证结果

本轮实际执行验证结果：

- `npm run lint` ✅
- `npm run build` ✅
- `npm test` ✅（557/557）

## 总体评价

- AC #1：完整阶段链与参数注入保持正确
- AC #2：fatal 错误流保持正确
- AC #3：pipeline 层 manifest 持久化职责正确，且 Flatten / shared target root / `--link` 语义现已同时成立

**建议状态：通过，可进入下一阶段或合并。**
