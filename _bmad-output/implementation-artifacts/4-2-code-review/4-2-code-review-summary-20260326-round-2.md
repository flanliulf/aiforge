---
Story: 4-2
Round: 2
Date: 2026-03-26
Model Used: GPT-5.4 (gpt-5.4)
Type: Code Review Summary
---

## 审查结论

本轮为复审。Round 1 的 P0 symlink 外逃问题修复方向正确，`files` / `directories` 两条写入分支现在都能拦截写出 `allowedRoot` 外的有效 symlink；但当前补丁又引入了 **1 个新的功能回归**，且当前分支 **lint 未通过**，因此**仍不建议通过**。

## 上轮问题回顾

### 已修复

1. **Round 1 / Finding #1：`destPath` 缺少 symlink 安全校验**
   - `src/stages/execute-install.ts:122-145` 已在 `files` / `directories` 两个分支中，对每个最终 `destPath` 调用 `validateDestPathSecurity(destPath, allowedRoot)`。
   - `src/services/fs-utils.ts:482-576` 新增 `validateDestPathSecurity()`，对最终落点执行 symlink / realpath 校验。
   - 定向复现验证：
     - `files` 分支：`destPath` 为指向 `allowedRoot` 外部的**有效 symlink 文件**时，`executeInstall()` 现在抛 `PATH_TRAVERSAL`
     - `directories` 分支：`destPath` 为指向 `allowedRoot` 外部的**有效 symlink 目录**时，`executeInstall()` 现在抛 `PATH_TRAVERSAL`
   - 结论：✅ 已修复

### 仍为非阻塞待办

1. **Round 1 / Finding #2：`targetPath` 已存在且为普通文件时，preflight 未提前拒绝**
   - `src/services/fs-utils.ts:436-461` 仍维持“普通文件 → 检查可写性”的旧逻辑。
   - 按 `4-2-code-review-evaluation-20260326-round-1.md` 的评估结论，该项维持 **CR TODO / P2**，本轮未重新升级为阻塞。

## 新发现

### 1. [中][新] `validateDestPathSecurity()` 会把“指向 `allowedRoot` 内部的 broken symlink 文件”一律误判为 `PATH_TRAVERSAL`，阻断本可成功的 copy 安装

- **证据**
  - `src/services/fs-utils.ts:504-535` 的 symlink 分支中，若 `realpath(destPath)` 因 broken symlink 抛 `ENOENT`，代码会：
    1. 读取 `readlink(destPath)`：`src/services/fs-utils.ts:518`
    2. 用 `resolve(dirname(destPath), linkTarget)` 得到目标路径：`src/services/fs-utils.ts:520`
    3. 先执行 `validatePathSecurity(resolvedTarget, allowedRoot)`：`src/services/fs-utils.ts:521`
    4. **无论校验是否通过，都会在 `src/services/fs-utils.ts:525-535` 无条件抛 `PATH_TRAVERSAL`**
  - `src/stages/execute-install.ts:122-129` 在 `files` 分支里，会在 `determineStatus()` / `copyFile()` 之前无条件调用该校验，因此这一误判会直接阻断安装。
  - 定向复现：
    - 场景：`targetDir/config.md` 是一个 broken symlink，但其目标路径位于 `allowedRoot` 内部，且目标文件尚不存在。
    - 直接 Node 行为：`fs.copyFile(src, symlinkPath)` **可成功创建真实目标文件**
    - 当前 `executeInstall()` 行为：抛出 `AiforgeError(code: 'PATH_TRAVERSAL', severity: 'fatal')`
  - 新增测试 `tests/stages/execute-install.test.ts:259-315` 只覆盖了“指向 `allowedRoot` 外部”的 broken symlink；其中 `outsideTarget` / `outsideDir` 都没有被创建，因此并未覆盖“broken symlink 但目标仍在 `allowedRoot` 内”的安全场景。

- **影响**
  - 这是本轮修复引入的用户可见功能回归：某些本可安全完成的 file copy 安装，现在会被误判为路径攻击并 fail-fast。
  - 如果用户的配置目录里残留了指向安全根内部的 broken symlink 占位文件，Story 4.2 安装会异常失败。

- **建议**
  - 对 `files` 分支的 broken symlink，不能“一律拒绝”。应先将 symlink 目标规范化为绝对路径，再按 `allowedRoot` 做边界校验：
    - 目标落在 `allowedRoot` 内 → 允许继续执行 `copyFile()`
    - 目标逃逸到 `allowedRoot` 外 → 抛 `PATH_TRAVERSAL`
  - 同步补 1 条回归测试：broken symlink 目标位于 `allowedRoot` 内、目标文件尚不存在时，`executeInstall()` 应成功并写出内容。

### 2. [中][新] 当前提交未通过 lint，质量门禁仍为红灯

- **证据**
  - 实测 `npm run lint` 失败，Prettier 明确报告：
    - `src/services/fs-utils.ts`
    - `src/stages/execute-install.ts`
  - 与 Story 文档中的 “Lint：零报错” 当前不一致。

- **影响**
  - 当前分支不满足仓库既有质量门禁，无法视为 merge-ready。
  - 即使逻辑问题全部修复，未格式化代码也会阻塞交付。

- **建议**
  - 先格式化上述 2 个文件，再重新执行 `npm run lint`。
  - 修复完成后同步更新 Story 4.2 的验证记录，避免 Dev Agent Record 与仓库现状脱节。

## 验证摘要

- `npm test` ✅（457 / 457）
- `npm run lint` ❌
  - Prettier style issues: `src/services/fs-utils.ts`, `src/stages/execute-install.ts`
- `npm run build` ✅
- 定向复现：
  - `destPath` 为指向 `allowedRoot` 外部的**有效 symlink**（files / directories）→ `PATH_TRAVERSAL` ✅
  - `destPath` 为指向 `allowedRoot` 内部的 **broken symlink 文件** → `executeInstall()` 抛 `PATH_TRAVERSAL`，但底层 `fs.copyFile()` 实际可成功 ❌

## 通过项

- Round 1 的 P0 安全问题已在 `files` / `directories` 两个并行分支中同步补齐，不再出现“只修一支”的对称性遗漏。
- `tests/stages/execute-install.test.ts` 已从 15 条扩展到 17 条，新增了最终 `destPath` 级别的 symlink 逃逸负向覆盖。
- 全仓 `npm test` 与 `npm run build` 当前均保持绿色，说明问题集中在本轮新增的 broken symlink 判定策略和代码格式，而非基础安装主流程。
