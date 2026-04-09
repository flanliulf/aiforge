# Story 1.5 Code Review Summary — Round 2

## 基本信息

- Story ID: `1-5`
- Story 文件: `_bmad-output/implementation-artifacts/1-5-cli-entry-and-pipeline-skeleton.md`
- 审核日期: `2026-03-23`
- 审核结论: **Changes Requested**

## 总体结论

相较 Round 1，本轮实现已有明显改进：

- `dist/index.js --help` 与 `src/index.ts --help` 现在一致，AC1 已恢复成立
- TTY 检测已改为基于 `process.stdout.isTTY`
- `index.ts` 已只依赖 `pipeline.ts` 与 `commands/`
- `PipelineStages` 已补齐 `report` 阶段
- 已新增 CLI 参数解析测试，且全量测试达到 `203/203`

但本轮复审后，**仍不建议直接标记为 done**，原因是仍存在 3 个需要处理的问题，其中 1 个为质量门禁问题。

## 主要问题

### 1. 高优先级：Lint 当前失败，代码质量门禁未通过

实际运行 `npm run lint` 返回失败，错误集中在 `tests/pipeline.test.ts`：

- 未使用的导入：`EXIT_INSTALL_FAILURE`
- 未使用的参数：`_result`、`_reporter`

这说明“修复后 ESLint 通过”的结论与当前仓库现实不一致。本 Story 目前虽然测试通过，但**lint 未通过**，不适合视为完成态。

### 2. 中优先级：`report` 默认实现对空 `InstallResult` 的分流逻辑错误

`src/pipeline.ts` 当前通过检查 `items[0].status` 来区分 `InstallResult` 与 `MatchedPlan`。当 `InstallResult.items` 为空时，会错误走到 `reportPlan()` 分支。

更重要的是，`tests/pipeline.test.ts` 还把这一行为固化成了预期，说明这不是偶发遗漏，而是当前实现/测试共同接受了一个错误分支。

这会导致“正常安装但结果为空”的场景被当成 dry-run 计划输出处理，语义不正确。

### 3. 中优先级：AC3 的新增测试仍是“复制实现”式测试，验收证据仍偏弱

`tests/cli-args.test.ts` 明确写明是在**复刻 `src/index.ts` 的映射逻辑**，它并没有直接调用真实 CLI 入口中的参数转换代码，而是在测试文件中复制了一份同样的 commander 配置和映射逻辑。

这类测试可以验证“复制出来的逻辑”是对的，但不能充分证明生产代码中的真实映射不会与测试副本发生漂移。因此，Round 1 中“AC3 缺少直接自动化验证”的问题，只能算**部分缓解，未彻底解决**。

## 已确认修复项

以下 Round 1 问题已确认解决：

- AC1 / bin 产物帮助输出不完整：**已修复**
- TTY 判定基于 stderr：**已修复**
- `index.ts` 模块边界不合规：**已修复**
- `PipelineStages` 缺少 `report`：**已修复**
- Story File List 缺少 `sprint-status.yaml`：**已修复**

## 验证结果摘要

- `npx tsx src/index.ts --help`：✅
- `node dist/index.js --help`：✅
- `npx tsx src/index.ts --version`：✅ `0.1.0`
- `node dist/index.js --version`：✅ `0.1.0`
- 首次输出时间：✅ `0.406s < 1s`
- 相关测试：✅ `57/57`
- 全量测试：✅ `203/203`
- Lint：❌ 未通过

## 最终建议

本轮建议继续保持 **Changes Requested**。

建议优先顺序：

1. 先修复 lint 失败项
2. 修正 `report` 对空 `InstallResult` 的类型判定/分流逻辑
3. 将 CLI 参数测试改为直接复用或驱动真实 `src/index.ts` 参数映射逻辑，而不是在测试中复制一份实现

完成以上问题后，再进行 Round 3 复审会更稳妥。

## 修复执行记录

- 执行日期: `2026-03-23`
- 执行者: Dev Agent (Amelia / Opus)

### 问题 #1 修复：Lint/Prettier 格式失败

**问题**: `npm run lint` 中 Prettier 格式检查失败，涉及 10 个文件。

**修复**:

- 对 `src/core/errors.ts`、`src/core/path-resolver.ts`、`src/core/reporter.ts`、`src/pipeline.ts`、`tests/cli-args.test.ts`、`tests/core/errors.test.ts`、`tests/core/reporter.test.ts`、`tests/core/types.test.ts`、`tests/pipeline.test.ts` 执行 `prettier --write`
- ESLint 本就已通过（Round 2 summary 中描述的 ESLint 错误在本次运行中未复现，可能已在 Round 1 修复后被提交）

**验证**: `npm run lint` — ESLint ✅ + Prettier ✅（仅 `CLAUDE.md` 格式差异，非源代码文件，不修改）

### 问题 #2 修复：`report` 对空 `InstallResult` 的分流逻辑错误

**问题**: `pipeline.ts` 中 `report` 函数通过 `items[0].status` 区分类型，空 `InstallResult.items` 数组时无法判断，错误走入 `reportPlan()` 分支。

**修复**:

- `ReportFn` 类型签名新增可选 `mode?: 'result' | 'plan'` 参数
- `report` 默认实现改为三级判定：(1) 显式 `mode` 优先 → (2) items 非空时用 `items[0].status` 推断 → (3) 兜底走 plan（向后兼容）
- `runPipeline` 在两个调用点显式传入 `mode`：`stages.report(result, reporter, 'result')` / `stages.report(plan, reporter, 'plan')`
- 测试修正：
  - 原"空 items 走 reportPlan"测试改为"空 items + mode=result 正确走 reportResult"
  - 保留"空 items 无 mode 时兜底走 plan"的向后兼容测试
  - 新增 `mode=plan` 覆盖测试
  - `runPipeline` 测试增加对 `mode` 参数传递的断言

**变更文件**: `src/pipeline.ts`、`tests/pipeline.test.ts`

**验证**: 全量测试 206/206 ✅

### 问题 #3 修复：CLI 参数测试"复制实现"式漂移风险

**问题**: `tests/cli-args.test.ts` 在测试文件中复制了 `src/index.ts` 的 `opts → ParsedArgs` 映射逻辑，无法防止生产代码与测试副本漂移。

**修复**:

- 从 `src/index.ts` 提取 `mapOptsToArgs(repoUrl, opts)` 纯函数到 `src/pipeline.ts` 导出（保持 index.ts 模块边界约束：`index.ts → pipeline.ts + commands/`）
- `src/index.ts` 改为从 `pipeline.ts` 导入 `mapOptsToArgs`，action 回调中直接调用
- `tests/cli-args.test.ts` 完全重写：
  - 导入 `mapOptsToArgs` from `../src/pipeline.js`（真实生产代码）
  - `parseCliArgs` 辅助函数：commander 解析 → 调用真实 `mapOptsToArgs`，不再复制映射逻辑
  - 新增 `mapOptsToArgs 直接调用` 测试用例，验证纯映射函数行为

**变更文件**: `src/index.ts`、`src/pipeline.ts`、`tests/cli-args.test.ts`

**验证**: 全量测试 206/206 ✅、`npm run build` ✅、`node dist/index.js --help` 输出正确 ✅

### 修复后验证结果摘要

| 验证项 | 结果 |
|--------|------|
| `npx tsc --noEmit` | ✅ 通过 |
| `npm test` (vitest) | ✅ 206/206 |
| `npm run lint` (ESLint) | ✅ 通过 |
| `npm run lint` (Prettier) | ✅ 源代码全部通过 |
| `npm run build` (tsup) | ✅ dist/index.js 7.58 KB |
| `node dist/index.js --help` | ✅ 输出完整 |
| `node dist/index.js --version` | ✅ 0.1.0 |

### 变更文件清单

| 文件 | 变更类型 |
|------|----------|
| `src/pipeline.ts` | 修改：新增 `mapOptsToArgs` 导出函数；`ReportFn` 增加 `mode` 参数；`report` 三级判定逻辑；`runPipeline` 显式传入 mode |
| `src/index.ts` | 修改：移除内联映射逻辑，改为导入 `mapOptsToArgs`；移除未使用的 `ParsedArgs` type import |
| `tests/pipeline.test.ts` | 修改：修正空 InstallResult 测试；新增 mode 参数测试；runPipeline mode 传递断言 |
| `tests/cli-args.test.ts` | 重写：改为导入真实 `mapOptsToArgs`；新增直接函数调用测试 |