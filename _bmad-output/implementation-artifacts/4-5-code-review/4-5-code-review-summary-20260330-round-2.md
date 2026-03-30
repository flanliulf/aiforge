---
Story: 4-5
Round: 2
Date: 2026-03-30
Model Used: GPT-5.4
Type: Code Review Summary
---

## 审查结论

本轮为 **第 2 轮复审**。

结论：**仍不通过**。上轮 2 个问题已修复，但本轮发现 1 个新的高优先级功能缺陷，且当前格式门禁失败，暂不建议结束 Story 4.5 的 CR 流程。

## 上轮问题复核

### 1. 上轮问题 #1 已修复：`Directories` 分支已接入冲突检测与处理

- **上轮结论**：有效，需修复
- **本轮复核结果**：✅ 已修复
- **验证位置**：
  - `src/stages/execute-install.ts:196-203`
  - `src/stages/execute-install.ts:432-467`
  - `src/services/manifest.ts:151-192`
  - `tests/stages/execute-install.test.ts:1252-1391`
  - `tests/services/manifest.test.ts:256-310`
- **说明**：
  - 当前 `Directories` 分支已新增 `detectDirConflict()`，并在目录安装前统一接入 `processConflict()`。
  - `checkDirConflict()` 已提供目录级冲突判定。
  - 已新增目录冲突相关单元/集成测试，覆盖 `skip`、`overwrite`、`--force`、无冲突、无 `manifestContext`、`symlink` 无冲突等路径。

### 2. 上轮问题 #2 已修复：移除了 `tmpFiles` 空壳清理结构，改为说明由原子写入自清理

- **上轮结论**：有效，需修复
- **本轮复核结果**：✅ 已修复
- **验证位置**：
  - `src/stages/execute-install.ts:302`
  - `src/services/manifest.ts:79-92`
  - `tests/stages/execute-install.test.ts:1393-1415`
- **说明**：
  - `executeInstall()` 中的 `tmpFiles` / `finally unlink()` 已移除，不再保留误导性的空壳实现。
  - 当前唯一 `.tmp` 场景仍由 `saveManifest()` 的 write-then-rename 原子写入内部处理，和修订后的说明一致。

## 本轮新增问题

### 1. [高] 目录冲突选择“备份后覆盖”会走到 `backupFile(dir)` 并直接失败

- **位置**：
  - `src/stages/execute-install.ts:225-230`
  - `src/stages/execute-install.ts:432-446`
  - `src/stages/conflict-resolver.ts:73-81`
- **问题**：
  - `Directories` 冲突现已接入 `processConflict()`，而 `processConflict()` 的 `backup` 分支无类型区分，固定执行 `backupFile(destPath)`。
  - `backupFile()` 是文件级 API；当 `destPath` 为目录时，底层会走 `copyFile(dir, ...)`，对目录直接报错。
  - 但 `handleConflict()/resolveConflict()` 复用于目录冲突时，仍向用户暴露“备份后覆盖（推荐）”这个选项，因此这是可达路径，不是死代码。
- **证据**：
  - `Directories` 冲突已在 `src/stages/execute-install.ts:438-446` 进入 `processConflict()`。
  - `processConflict()` 在 `backup` 分支直接调用 `backupFile(destPath)`：`src/stages/execute-install.ts:228-230`。
  - 冲突菜单固定包含 `backup`：`src/stages/conflict-resolver.ts:75-80`。
  - 现有新增目录冲突测试未覆盖 `backup` 路径：`tests/stages/execute-install.test.ts:1252-1391`。
  - 独立验证 `copyFile(directory, ...)` 会报错（本轮 shell 验证返回 `ENOTSUP`）。
- **影响**：
  - 用户在目录冲突场景选择“备份后覆盖”时，安装会以 fatal 错误中断，和交互文案承诺不一致。
  - 由于 `skills` 安装真实使用 `Directories` 规则，该问题具备真实触发面。
- **建议**：
  - 对目录冲突单独定义策略：
    - 要么禁止目录场景出现 `backup` 选项；
    - 要么实现目录级备份（递归复制到 `<dir>.aiforge-backup-YYYYMMDD` 等）；
    - 并补充目录 `backup` 路径测试。

### 2. [低] 当前 `npm run lint` 失败，格式门禁未通过

- **位置**：
  - `src/stages/execute-install.ts`
  - `tests/stages/execute-install.test.ts`
- **问题**：
  - 本轮独立执行 `npm run lint` 失败，Prettier 明确报告上述 2 个文件存在 code style 问题。
- **影响**：
  - 当前分支未满足项目质量门禁；即使功能修复完成，也不能按“lint 通过”交付。
- **建议**：
  - 先对上述 2 个文件执行格式修复，再重新运行 `npm run lint` 复核。

## 验证记录

本轮已执行：

- `npx vitest run tests/services/manifest.test.ts tests/stages/conflict-resolver.test.ts tests/stages/execute-install.test.ts`
- `npm run build`
- `npm test`
- `npm run lint`

结果：

- 定向测试通过：`91 passed`
- 全量测试通过：`531 passed`
- Build 通过
- **Lint 失败**：Prettier 报告 `src/stages/execute-install.ts`、`tests/stages/execute-install.test.ts`

## 最终建议

建议先修复本轮新增的目录 `backup` 缺陷，并完成格式修复后，再进入下一轮 CR。当前不建议收口 Story 4.5。
