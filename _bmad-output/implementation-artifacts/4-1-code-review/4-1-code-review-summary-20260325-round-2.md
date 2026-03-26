---
Story: 4-1
Round: 2
Date: 2026-03-25
Model Used: GPT-5.4 (gpt-5.4)
Type: Code Review Summary
---

## 审查结论

本轮为复审。上轮 4 条问题中，**3 条已完全修复，1 条仅部分修复**；同时本轮发现 **2 个新的独立问题**。当前仍 **不建议通过**。

## 上轮问题回顾

### 已修复

1. **Round 1 / Finding #1：祖先非目录误判放行**
   - `src/services/fs-utils.ts:258-274` 已补 `isDirectory()` 校验，并新增 `PATH_NOT_DIRECTORY`
   - `tests/services/fs-utils.test.ts:393-402` 已新增负向测试
   - 结论：✅ 原问题已修复

2. **Round 1 / Finding #2：`ensureDir()` 泄漏 raw `Error`**
   - `src/services/fs-utils.ts:132-145` 已统一包装为 `AiforgeError(code: 'ENSURE_DIR_FAILED')`
   - `tests/services/fs-utils.test.ts:233-241` 已新增负向测试
   - 结论：✅ 已修复

3. **Round 1 / Finding #3：`preflight` 签名偏离 Story 契约**
   - `src/services/fs-utils.ts:212-231` 已恢复为双参签名，并在函数内部按 `scope` 推导 `allowedRoot`
   - `tests/services/fs-utils.test.ts:299-404` 已同步改为 stub `PathResolver`
   - 结论：✅ 已修复

### 部分修复

1. **Round 1 / Finding #4：lint / 质量门禁未通过**
   - `tests/services/fs-utils.test.ts` 中 5 个未使用符号已清理
   - 但本轮复验 `npm run lint` 仍失败，`npx prettier --check src/services/fs-utils.ts` 直接指向 `src/services/fs-utils.ts`
   - Story 记录仍写有 `Lint：0 errors`：`_bmad-output/implementation-artifacts/4-1-fs-utils-and-preflight-check.md:170-177`
   - 结论：⚠️ 仅部分修复，质量门禁仍未恢复

## 新发现

### 1. [中][新] Round 1 的 `findExistingAncestor()` 修复把“指向目录的 symlink 祖先”也误判成非法路径

- 证据：
  - `src/services/fs-utils.ts:261-274` 对现存祖先执行 `lstat(current)` 后直接使用 `entryStat.isDirectory()` 判定。
  - 对“指向目录的符号链接”，`lstat()` 返回的是 symlink 本身，`isDirectory()` 为 `false`，于是代码抛 `PATH_NOT_DIRECTORY`。
  - 最小复现：创建 `link -> realDir`，再对 `targetPath=<tmp>/link/sub/out.md` 调用 `preflight()`，实际返回 `AiforgeError(code: 'PATH_NOT_DIRECTORY')`。
  - 对照验证：同一路径直接执行 `mkdir('<tmp>/link/sub', { recursive: true })` 可以成功，说明文件系统本身允许在该 symlink 目录下继续创建子路径。
- 影响：
  - 有效且可写的目标路径会在 preflight 阶段被错误拒绝。
  - 这违反 AC #2 / AC #3：父目录实际可写、目标目录实际可创建，但预检查错误 fail-fast。
- 建议：
  - 判断“祖先是否可作为目录继续向下创建”时，不要仅用 `lstat().isDirectory()`。
  - 可改为：`lstat()` 识别 symlink 后，再用 `stat()` 跟随链接确认其目标是否为目录；或直接对该分支使用 `stat()` 语义。
  - 补 1 条负向/正向测试覆盖“symlink → directory ancestor”。

### 2. [中][新] 现有目标若是 symlink，`preflight` 仍按“普通文件可写性”处理，和 Story 权限矩阵不一致

- 证据：
  - Story 权限矩阵明确写的是：`目标为符号链接 | fs.lstat 检测 | 通过（symlink 模式会先删除再创建）`：`_bmad-output/implementation-artifacts/4-1-fs-utils-and-preflight-check.md:47-54`
  - 但实现 `src/services/fs-utils.ts:339-358` 将“文件或符号链接”合并处理，统一执行 `access(targetPath, W_OK)`。
  - 对 broken symlink，`access()` 会跟随链接并返回 `ENOENT`，当前实现因此抛出 `PERMISSION_DENIED`。
  - 最小复现：创建 `existing-link -> missing-target`，再对该 `existing-link` 调用 `preflight()`，实际返回 `AiforgeError(code: 'PERMISSION_DENIED')`。
- 影响：
  - 合法的 symlink 覆盖/重建场景会被 preflight 提前拦截。
  - 这与 Story Dev Notes 的权限矩阵直接冲突，也会影响后续 Story 4.3 的 symlink 安装链路。
- 建议：
  - 在 `checkTargetWritability()` 中对 `targetStat.isSymbolicLink()` 单独分支处理，不要复用普通文件的 `access(targetPath, W_OK)` 逻辑。
  - 至少补 1 条测试覆盖“existing broken symlink 应通过 preflight”的场景。

## 遗留问题

### 1. [低][遗留] 质量门禁仍未通过：`src/services/fs-utils.ts` 存在 Prettier 格式问题

- 证据：
  - `npm run lint` ❌
  - `npx prettier --check src/services/fs-utils.ts` ❌
  - `npm test` ✅（433 / 433）
  - `npm run build` ✅
- 影响：
  - Story 仍不能以“lint 通过”状态交付。
  - Story Dev Agent Record 中关于 lint 的完成记录仍与仓库实际状态不一致。
- 建议：
  - 按仓库既有格式化流程修正 `src/services/fs-utils.ts`，然后重新执行 `npm run lint`。
  - 同步回写 Story 的 Completion Notes / Change Log。

## 验证摘要

- `npm test` ✅（433 / 433）
- `npm run build` ✅
- `npm run lint` ❌（Prettier 指向 `src/services/fs-utils.ts`）
- 定向复现 ❌
  - symlink 祖先目录场景：`mkdir` 可成功，但 `preflight()` 抛 `PATH_NOT_DIRECTORY`
  - existing broken symlink 场景：Story 矩阵要求通过，但 `preflight()` 抛 `PERMISSION_DENIED`

## 通过项

- Round 1 提出的三项核心实现问题（祖先非目录误判放行、`ensureDir` raw error、`preflight` 签名漂移）均已修复。
- `tests/services/fs-utils.test.ts` 已扩展到 32 条测试，并能守住 Round 1 修复点。
- 当前全量测试和构建均稳定通过，说明问题集中在 symlink 边界语义与最终质量门禁，而非大面积功能回退。
