---
Story: 4-1
Round: 5
Date: 2026-03-26
Model Used: GPT-5.4 (gpt-5.4)
Type: Code Review Summary
---

## 审查结论

本轮为复审。Round 4 的 `P0 symlink` 逃逸修复已验证生效，`npm test` / `npm run lint` / `npm run build` 全部通过；但当前又发现 **1 个新的阻塞问题**。在实际运行 contract 下，`preflight()` 仍会把“目标目录路径已被普通文件占用”的场景误判为可安装，**暂不建议通过**。

## 上轮问题回顾

### 已修复

1. **Round 4 / Finding #1：现存 `targetPath` symlink 目录逃逸 `allowedRoot`**
   - `src/services/fs-utils.ts:413-433` 已在 `isDirectory()` / `isSymbolicLink()` 分支补 `validateAncestorRealpath(...)` 安全校验。
   - `tests/services/fs-utils.test.ts:492-509` 已新增“`targetPath` 本身是现存外部 symlink”回归测试。
   - 定向复现现已返回 `PATH_TRAVERSAL`，不再放行。
   - 结论：✅ 已修复

2. **Round 4 / 质量门禁**
   - `npm test` ✅（440 / 440）
   - `npm run lint` ✅
   - `npm run build` ✅
   - 结论：✅ 已修复

## 新发现

### 1. [中][新] 在实际 `MatchedPlan` contract 下，`targetPath` 若被普通文件占用，`preflight()` 仍误判通过

- 证据：
  - `src/stages/match-rules.ts:170-173` 将 `MatchedPlan.targetPath` 构造成规则目标目录 `resolveTargetDir(...)` 的结果。
  - `src/core/reporter.ts:20-28` 后续又用 `join(targetPath, basename(srcFile))` 计算文件级目标路径，进一步印证 `targetPath` 的运行时语义是**目标目录**而非最终文件路径。
  - 但 `src/services/fs-utils.ts:435-441` 对“`targetPath` 已存在且是普通文件”的分支，仅执行 `access(targetPath, W_OK)`；只要文件可写就直接通过。
  - 定向复现：
    ```json
    [
      {
        "label": "existing-file-at-target-dir",
        "result": {
          "ok": true,
          "dirsToCreate": []
        }
      }
    ]
    ```
  - 同仓库中 `ensureDir()` 已明确把“目录路径被普通文件占用”视为 fatal：`src/services/fs-utils.ts:143-155`，并有回归测试 `tests/services/fs-utils.test.ts:233-241`。
- 影响：
  - `preflight()` 会把后续必然失败的安装根路径误判为“可安装”，破坏 AC #2 / AC #4 的 fail-fast 承诺。
  - 一旦执行安装阶段，后续 `ensureDir(targetDir)` / `join(targetPath, basename(srcFile))` 相关操作会因“目标目录位置实际是文件”而失败，用户仍会在安装过程中而不是预检查阶段看到 fatal 错误。
  - 该问题不是理论边界，而是当前运行 contract 下的真实路径冲突漏洞。
- 建议：
  - 在 `checkTargetWritability()` 中区分“普通文件作为最终安装文件目标”与“普通文件占用了目标目录路径”两种语义；对当前 `matchRules()` 产出的目录型 `targetPath`，应将该场景视为 `PATH_NOT_DIRECTORY`（或等价 fatal 错误），而不是按“可写文件”放行。
  - 至少补 1 条回归测试：`targetPath` 为现存普通文件且语义上充当目标目录时，`preflight()` 应 fail-fast。

## 验证摘要

- `npm test` ✅（440 / 440）
- `npm run lint` ✅
- `npm run build` ✅
- 定向复现 ❌
  - `targetPath` 为现存外部 symlink 目录 → 已正确抛 `PATH_TRAVERSAL`
  - `targetPath` 为现存普通文件（充当目标目录）→ `preflight()` 仍返回 `ok: true`

## 通过项

- Round 4 的 `P0 symlink` 逃逸修复已真正闭环，外部 symlink 目标目录不再绕过 `allowedRoot`。
- Story Dev Agent Record 已同步到 `440 passed / lint green / build green` 的最新状态。
- 本轮未发现新的安全逃逸问题；当前剩余问题集中在 **targetPath 目录语义与普通文件分支判定不一致**。
