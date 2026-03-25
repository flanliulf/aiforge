---
Story: 3-1
Round: 1
Date: 2026-03-25
Model Used: GPT-5.4 (model ID: gpt-5.4)
Type: Code Review Summary
---

# Story 3-1 代码审查总结 — 第 1 轮

## 基本信息

- Story ID: `3-1`
- Story 文件: `_bmad-output/implementation-artifacts/3-1-ai-tool-auto-detection.md`
- 审查类型: 首轮
- 审查结论: **Changes Requested**

## 总体结论

`src/stages/detect-tools.ts` 的阶段级逻辑整体方向正确：双侧扫描、`UNKNOWN_TOOL` / `NO_TOOLS` 错误、`ENOENT` / `ENOTDIR` 白名单降级、16 个单元测试、`npm run build` / `npm run test` 均通过。

但本轮仍不建议通过，原因有 3 点：

1. detect 实现尚未接入真实 CLI / pipeline 主链路，Story 用户价值未真正可达。
2. Story 3.1 自身文件未通过仓库 lint（Prettier），质量门禁并非全绿。
3. AC #4 的诊断输出测试只做“`warn` 被调用”级别断言，未锁定必需的路径/建议内容，回归保护不足。

## 验证记录

- `npm run lint` → failed（Prettier 报 `src/stages/detect-tools.ts`、`tests/stages/detect-tools.test.ts`）
- `npm run build` → passed
- `npm run test` → passed（`346/346`）
- `node dist/index.js --dry-run` → `✗ 阶段 "resolve" 未实现`

## 当前 Findings

### High

1. **Detect 阶段实现仍是“孤岛代码”，未进入真实 CLI / pipeline 主链路**
   - `src/stages/detect-tools.ts:129-190` 已实现 `detectTools()`
   - 但生产代码没有任何地方导入/注册它；代码检索结果显示除测试外无生产引用
   - `src/pipeline.ts:116-117,139-147` 仍把 `detect` 保持为 `NOT_IMPLEMENTED` 占位阶段
   - `src/index.ts:42-49` 直接使用 `runPipeline(args, reporter)`，即默认占位 `stages`
   - `src/stages/index.ts:1` 仍是 placeholder
   - 实测 `node dist/index.js --dry-run` 直接在主链路报 `阶段 "resolve" 未实现`
   - 这意味着 Story 3.1 当前交付的是“单测通过的孤立函数”，不是用户可触达的 Detect 阶段；以 Story 用户价值标准看，交付未闭环

### Medium

2. **Story 3.1 自身文件未通过仓库 lint / Prettier，质量门禁并非全绿**
   - `npm run lint` 当前失败，直接点名：
     - `src/stages/detect-tools.ts`
     - `tests/stages/detect-tools.test.ts`
   - Prettier 差异位于：
     - `src/stages/detect-tools.ts:112-114`
     - `tests/stages/detect-tools.test.ts:205-247,315-319,372-375`
   - Story Dev Agent Record 仍写着 `Lint: 零报错`：`_bmad-output/implementation-artifacts/3-1-ai-tool-auto-detection.md:170-175`
   - 这同时构成代码质量门禁问题和 Story 记录失真问题

3. **AC #4 的诊断输出测试证据偏弱，无法锁定必须输出的内容**
   - Story Task 2.1-2.3 要求诊断里列出扫描路径、标志文件/检测结果、安装/手动指定建议
   - 当前测试只验证 `reporter.warn` 被调用：`tests/stages/detect-tools.test.ts:222-231`
   - 但没有断言告警文本中是否真的包含：
     - 全局 / 项目扫描路径
     - 各工具标志路径结果
     - `--tools ...` 建议
   - `emitDiagnostics()` 虽然当前实现了这些内容：`src/stages/detect-tools.ts:91-116`，但测试保护不足；后续若有人删掉明细只保留一句“未检测到工具”，这组测试仍会通过

## 已确认通过项

- 双侧扫描语义与 Story 修订后契约一致：`src/stages/detect-tools.ts:57-82`、`tests/stages/detect-tools.test.ts:124-169`
- `UNKNOWN_TOOL` / `NO_TOOLS` fatal 错误分支存在：`src/stages/detect-tools.ts:140-185`
- `fs.access()` 仅对 `ENOENT` / `ENOTDIR` 降级，其他错误上抛，符合项目规则：`src/stages/detect-tools.ts:24-45`、`tests/stages/detect-tools.test.ts:310-375`
- `npm run build` 与 `npm run test` 基线通过，说明实现本身未破坏当前编译与单测基线

## AC 复核

- AC #1：**阶段级实现满足，系统级交付未闭环**（逻辑正确，但未接入真实主链路）
- AC #2：**阶段级满足**
- AC #3：**阶段级满足**
- AC #4：**实现基本满足，但测试证据不足**
- AC #5：**满足**
- AC #6：**满足**

## 最终建议

**本轮结论：Changes Requested。**

建议先完成以下收口，再进入下一轮 CR：

1. 把真实阶段接入 CLI / pipeline 主链路，或明确说明该接线由哪个后续 Story 统一负责，并同步修正 Story 3.1 的“完成”表述；
2. 修复 `src/stages/detect-tools.ts` 与 `tests/stages/detect-tools.test.ts` 的 Prettier 问题，并更新 Story Dev Agent Record 的 lint 结论；
3. 强化 AC #4 测试，至少断言诊断输出包含扫描路径、标志路径结果和 `--tools` 建议。
