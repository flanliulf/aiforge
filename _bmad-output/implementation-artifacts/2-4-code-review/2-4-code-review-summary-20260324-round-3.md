---
Story: 2-4
Round: 3
Date: 2026-03-24
Model Used: GPT-5.4 (model ID: gpt-5.4)
Type: Code Review Summary
---

# Story 2-4 代码审查总结 — 第 3 轮

## 基本信息

- Story ID: `2-4`
- Story 文件: `_bmad-output/implementation-artifacts/2-4-git-clone-and-incremental-update.md`
- 审查类型: 复审
- 审查结论: **Changes Requested**

## 总体结论

Round 2 提出的 3 个问题已基本关闭：

- `dirExists()` 已改为只对白名单错误降级：`src/stages/clone.ts:154-178`
- `SANITIZE_REMOTE_FAILED` / `SCAN_FAILED` 已补负向测试：`tests/stages/clone.test.ts:500-529`
- Story 的 Dev Agent Record 已同步到当前实现状态：`_bmad-output/implementation-artifacts/2-4-git-clone-and-incremental-update.md:164-174`
- 质量门禁全绿：实测 `npm run lint` ✅ / `npm test` ✅（`317/317`）/ `npm run build` ✅

但复审仍发现 1 个此前未指出的残留问题：**`freshClone()` 在 clone 失败后的 cleanup 分支里，仍对 `rm()` 失败使用裸 `catch {}` 静默吞错**。这直接违反 `project-context.md` 的错误处理规则，也会在“克隆失败且清理失败”的场景下把“未清理干净的残留目录”隐藏起来。因此本轮仍建议 **Changes Requested**。

## 上轮问题复核结果

### 1. Finding #1：`dirExists()` 误判路径

**已修复。**

- `dirExists()` 现已与 `hasLocalRepo()` 对齐：仅对 `ENOENT` / `ENOTDIR` 返回 `false`，其他错误继续抛出：`src/stages/clone.ts:161-177`
- 对应负向测试已补：`tests/stages/clone.test.ts:479-497`

### 2. Finding #2：Story Dev Agent Record 文档漂移

**已修复。**

- Story 记录现已更新为 29 个 clone stage 测试、全仓 317 个测试通过，并补充了 CR Round 1 / Round 2 修复内容：`_bmad-output/implementation-artifacts/2-4-git-clone-and-incremental-update.md:166-174`

### 3. Finding #3：`SANITIZE_REMOTE_FAILED` / `SCAN_FAILED` 缺少回归测试

**已修复。**

- `git remote set-url` 失败 → `SANITIZE_REMOTE_FAILED`：`tests/stages/clone.test.ts:500-515`
- `readdir` 失败 → `SCAN_FAILED`：`tests/stages/clone.test.ts:517-529`

## 本轮问题

### 1. 低优先级【新发现】：cleanup 分支仍以裸 `catch {}` 吞掉 `rm()` 失败，违反错误处理规则并掩盖“未清理干净”状态

- 位置：
  - `src/stages/clone.ts:233-239`
  - `_bmad-output/project-context.md:103-110`
  - `tests/stages/clone.test.ts:200-278,479-529`
- 现状：
  - `freshClone()` 在 `git.clone()` 失败后，如果判断本次需要清理目标目录，会执行：
    - `await rm(targetDir, { recursive: true, force: true })`
    - 若 `rm()` 再次失败，则直接进入 `catch {}`，完全吞掉 cleanup 错误
- 为什么这是问题：
  - `project-context.md` 明确规定：
    - 所有错误必须使用 `AiforgeError`
    - 禁止使用 `catch {}` 或 `catch { /* ignore */ }`
  - 当前实现等于向用户报告“克隆失败”，但**不告知清理也失败了**。这会留下两个风险：
    1. 用户误以为不完整目录已被清理，实际可能仍残留半克隆目录
    2. 下次重试时，残留目录状态可能继续影响 clone / pull 路径判断
- 为什么现有测试没拦住：
  - 当前测试已覆盖：
    - clone 失败时会触发清理：`tests/stages/clone.test.ts:202-218`
    - 目录原本存在时不删除：`tests/stages/clone.test.ts:220-237`
    - `dirExists()` 的 EACCES 分支：`tests/stages/clone.test.ts:479-497`
    - `SANITIZE_REMOTE_FAILED` / `SCAN_FAILED`：`tests/stages/clone.test.ts:500-529`
  - 但没有任何用例让 `rm()` 本身抛错，并断言 cleanup 失败会被显式暴露
- 建议：
  - 不要继续使用裸 `catch {}`
  - 至少应在 cleanup 失败时抛出带明确信息的 `AiforgeError`（例如单独错误码，或把 cleanup 失败信息合并进 `CLONE_FAILED.why/fix`），避免把“清理未完成”静默吞掉
  - 补 1 条负向测试：`git.clone()` 失败 + `rm()` 失败，断言用户能收到明确的 cleanup 失败信息，而不是只有泛化的 clone 失败

## 已确认通过项

- `source.cloneUrl` 的内存清理仍保持正确：`src/stages/clone.ts:68-92`、`tests/stages/clone.test.ts:307-322`
- `hasLocalRepo()` / `dirExists()` 的白名单降级逻辑已闭环：`src/stages/clone.ts:133-178`
- `SANITIZE_REMOTE_FAILED` / `SCAN_FAILED` 的测试守护已补齐：`tests/stages/clone.test.ts:500-529`
- 本轮质量门禁全绿：`npm run lint` ✅ / `npm test` ✅（`317/317`）/ `npm run build` ✅

## 建议修复顺序

1. 先修 `freshClone()` 中 `rm()` 失败的错误处理，去掉裸 `catch {}`
2. 再补 cleanup-failure 的负向测试，确保后续不会回退
3. 重新执行 `npm run lint && npm test && npm run build`

## 最终建议

**本轮结论：Changes Requested。**

Story 2-4 的主要功能与前两轮修复都已经到位，目前只剩 1 个低优先级但明确的残留问题：cleanup 失败仍被静默吞掉。建议补齐这一点后，再做一轮快速复审即可收口。
