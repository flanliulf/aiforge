---
Story: 4-1
Round: 3
Date: 2026-03-26
Model Used: GPT-5.4 (gpt-5.4)
Type: Code Review Summary
---

## 审查结论

本轮为复审。Round 2 提出的 3 条实现/质量问题已修复，`npm test`、`npm run lint`、`npm run build` 均已通过；但当前仍存在 **2 个新的阻塞问题**，另有 **1 条低优先级遗留记录问题**，暂不建议通过。

## 上轮问题回顾

### 已修复

1. **Round 2 / Finding #1：`findExistingAncestor()` 对 symlink→directory 祖先的误判**
   - `src/services/fs-utils.ts:271-299` 已改为先 `lstat()` 再对 symlink 分支使用 `stat()` 跟随链接确认目录类型。
   - `tests/services/fs-utils.test.ts:405-415` 已新增回归测试。
   - 结论：✅ 已修复

2. **Round 2 / Finding #2：现有 symlink 目标被错误按普通文件可写性处理**
   - `src/services/fs-utils.ts:377-378` 已对 `targetStat.isSymbolicLink()` 单独放行。
   - `tests/services/fs-utils.test.ts:418-435` 已补 broken symlink / valid symlink 回归测试。
   - 结论：✅ 已修复

3. **Round 2 / Finding #3：Prettier / lint 质量门禁**
   - 实测 `npm run lint` ✅，`npm run build` ✅，`npm test` ✅（436 / 436）。
   - 结论：✅ 已修复

## 新发现

### 1. [高][新] 现存 symlink 可把安装根目录转移到 `allowedRoot` 之外，`preflight` 仍会放行

- 证据：
  - `src/services/fs-utils.ts:246-249` 仅校验 `resolve(targetPath)` 的字符串前缀，没有校验现存 symlink 的真实落点是否仍在 `allowedRoot` 内。
  - `src/services/fs-utils.ts:377-378` 对现存 symlink 直接放行。
  - 定向复现：创建 `link=<home>/escape-link -> <outside>`，再以该 `link` 调用 `preflight()`，实际返回：
    ```json
    {
      "ok": true,
      "dirsToCreate": []
    }
    ```
  - 下游 copy 安装会把 `targetDir` 当真实目标目录继续 `join(targetDir, filename)`：`_bmad-output/implementation-artifacts/4-2-copy-mode-install.md:24-28,70-79`。这意味着后续写入会沿 symlink 落到 `allowedRoot` 之外。
- 影响：
  - 违反 AC #5 / NFR-S5 的路径安全边界。
  - 预先存在的 symlink 即可绕过 Home / Project root 限制，把后续安装写到外部目录。
  - 不仅“目标本身是 symlink”受影响，“缺失目标位于 symlink 祖先之下”的场景同样存在相同绕过面。
- 建议：
  - 对任何现存目标或现存祖先，基于 `realpath`（或等价的跟随链接路径解析）验证其真实目录仍位于 `allowedRoot` 内，再决定是否放行。
  - 至少补 2 条负向测试：`targetPath` 是指向 root 外部的 symlink；路径链祖先是指向 root 外部的 symlink。

### 2. [中][新] `isWritable()` 只检查 `W_OK`，会把“可写但不可遍历”的目录误判为可安装

- 证据：
  - `src/services/fs-utils.ts:163-166` 使用的是 `access(dirPath, constants.W_OK)`，没有同时要求目录的 `X_OK`（search/execute）权限。
  - `src/services/fs-utils.ts:356-374` 把该结果直接作为不存在目标时的最终权限判定。
  - 定向复现（macOS）：
    - 目录权限设为 `0o222`（只有写位、没有执行位）时，`access(dir, W_OK)` 返回成功；
    - 但 `access(dir, W_OK | X_OK)` 和真实 `writeFile(dir/x.txt)` 都返回 `EACCES`；
    - 同一目录下的 `preflight()` 实际仍返回：
      ```json
      {
        "ok": true,
        "dirsToCreate": [
          ".../w-only/new-dir"
        ]
      }
      ```
  - 当前测试只覆盖了只读目录 `0o444`：`tests/services/fs-utils.test.ts:330-380`，没有覆盖“可写但不可遍历”这一 POSIX 边界。
- 影响：
  - `preflight` 会把后续必然失败的目录误判为可安装，破坏 FR-030 / AC #4 的 fail-fast 承诺。
  - 安装阶段将延迟到真实 I/O 时才失败，用户体验上回到了“半途失败”。
- 建议：
  - 对目录可创建性至少同时校验 `W_OK | X_OK`，或采用与真实安装动作一致的安全探测方式。
  - 补 1 条回归测试：目录为 `0o222` 时，`preflight()` 应抛 `PERMISSION_DENIED`。

## 遗留问题

### 1. [低][遗留] Story Dev Agent Record 仍停留在 Round 1 状态，与当前仓库实际不一致

- 证据：
  - `_bmad-output/implementation-artifacts/4-1-fs-utils-and-preflight-check.md:166-174` 仍记录“30 个测试 / 431 passed / 433 passed”，且没有 Round 2 修复记录。
  - 当前实际 `tests/services/fs-utils.test.ts` 已有 35 条测试，`npm test` 结果为 436 / 436。
- 影响：
  - Story 交付记录与真实仓库状态脱节，后续 CR 评估 / 修复追踪会被误导。
- 建议：
  - 修复本轮问题后，同步更新 Story 的 Completion Notes / Change Log / 测试计数与验证结果。

## 验证摘要

- `npm test` ✅（436 / 436）
- `npm run lint` ✅
- `npm run build` ✅
- 定向复现 ❌
  - 现存 symlink 指向 `allowedRoot` 外部时，`preflight()` 仍返回 `ok: true`
  - 目录权限为 `0o222` 时，`preflight()` 仍返回 `ok: true`，但真实写入返回 `EACCES`

## 通过项

- Round 2 提出的 symlink 回归问题（symlink→directory 祖先、broken symlink 目标）均已修复并有回归测试守护。
- 当前仓库的测试、lint、build 均已恢复为绿色，说明问题集中在剩余安全边界与权限语义，而非整体实现稳定性。
- `findExistingAncestor()` 当前已能正确拒绝“祖先存在但非目录”的路径链，Round 1 的核心回归未再出现。
