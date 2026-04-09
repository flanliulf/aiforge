---
Story: 4-1
Round: 4
Date: 2026-03-26
Model Used: GPT-5.4 (gpt-5.4)
Type: Code Review Summary
---

## 审查结论

本轮为复审。Round 3 的 3 项修复中，**P1 权限精确性修复已完成，P2 Story 记录同步已完成；但 P0 symlink 逃逸仅部分修复**。当前仍存在 1 个阻塞性安全问题，**暂不建议通过**。

## 上轮问题回顾

### 已修复

1. **Round 3 / Finding #2：`isWritable()` 缺少 `X_OK` 检查**
   - `src/services/fs-utils.ts:166-179` 已改为 `access(dirPath, constants.W_OK | constants.X_OK)`。
   - `tests/services/fs-utils.test.ts:257-271` 已新增 `0o222` 边界测试。
   - 实测 `npm test` ✅（439 / 439），`npm run lint` ✅，`npm run build` ✅。
   - 结论：✅ 已修复

2. **Round 3 / Finding #3：Story Dev Agent Record 未同步**
   - `_bmad-output/implementation-artifacts/4-1-fs-utils-and-preflight-check.md:175-181,192` 已补 Round 2/3 修复记录、439 测试结果与 Build 状态。
   - 结论：✅ 已修复

### 部分修复 / 遗留

1. **Round 3 / Finding #1：symlink 逃逸绕过 `allowedRoot`**
   - `src/services/fs-utils.ts:391-396` 仅在 `targetStat === null` 分支对祖先目录执行 `validateAncestorRealpath()`。
   - 但 `src/services/fs-utils.ts:412-415` 对“已存在目录”与“已存在 symlink”仍直接放行，未做任何 realpath 安全校验。
   - `src/stages/match-rules.ts:170-173` 明确将 `MatchedPlan.targetPath` 构造成**目标目录**；下游安装也会把该目录作为写入根继续 `join(targetDir, filename)`：`_bmad-output/implementation-artifacts/4-2-copy-mode-install.md:24-28,75-79`。
   - 结论：⚠️ 仅部分修复，P0 仍未关闭

## 遗留阻塞问题

### 1. [高][遗留] 现存 `targetPath` 若本身是指向 `allowedRoot` 外部的 symlink 目录，`preflight()` 仍会放行

- 证据：
  - `src/services/fs-utils.ts:391-396` 的 realpath 安全校验只覆盖“目标不存在”分支。
  - `src/services/fs-utils.ts:414-415` 对现存 symlink 目录直接 `pass`。
  - `src/stages/match-rules.ts:170-173` 产出的 `targetPath` 是目标目录，不是最终文件路径。
  - 定向复现（`targetPath = <home>/escape-target-dir`，其中 `escape-target-dir -> <outside>`）：
    ```json
    {
      "result": {
        "ok": true,
        "dirsToCreate": []
      }
    }
    ```
  - Round 3 新增回归测试 `tests/services/fs-utils.test.ts:454-489` 覆盖的是 `join(escapeLink, 'output.md')` 这类**缺失子路径**场景，并未覆盖 `matchRules()` 实际产出的“目标目录本身就是现存 symlink”场景。
- 影响：
  - P0 安全问题仍可复现：现存 symlink 目标目录可以把后续 copy/symlink 安装写入 `allowedRoot` 之外。
  - 这直接违反 AC #5 / NFR-S5；且由于下游会基于该目录继续 `join(targetDir, filename)`，影响不是理论上的，而是实际写入边界失守。
- 建议：
  - 将 realpath 安全校验扩展到**所有可作为安装写入根的现存目标路径分支**，至少包括 `targetStat.isSymbolicLink()`，并重新审视 `targetStat.isDirectory()` 在 symlink 祖先已存在时是否也需要同类校验。
  - 补 1 条与实际 contract 对齐的回归测试：`targetPath = escapeLink`（现存目标目录本身为 symlink）时，`preflight()` 应抛 `PATH_TRAVERSAL`。

## 验证摘要

- `npm test` ✅（439 / 439）
- `npm run lint` ✅
- `npm run build` ✅
- 定向复现 ❌
  - `targetPath` 为现存 symlink 目标目录时，`preflight()` 仍返回 `ok: true`

## 通过项

- Round 3 的 P1 修复（`W_OK | X_OK`）有效，POSIX 权限误判已消失。
- Story Dev Agent Record 已补最新修复记录和质量门禁结果。
- 本轮未发现新的独立问题；当前阻塞点集中在 **Round 3 P0 修复不完整** 这一项。
