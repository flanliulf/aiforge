---
Story: 4-1
Round: 1
Date: 2026-03-25
Model Used: GPT-5.4 (gpt-5.4)
Type: Code Review Summary
---

## 审查结论

本轮为首轮审查。当前实现存在 **3 个阻塞问题** 和 **1 个质量门禁问题**，暂不建议通过。

## 主要发现

### 1. [高] `preflight` 会把“祖先路径存在但不是目录”的非法目标误判为可创建

- 证据：
  - `src/services/fs-utils.ts:240-245` 的 `findExistingAncestor()` 只要 `lstat(current)` 成功就直接返回，没有确认该祖先是否真的是目录。
  - `src/services/fs-utils.ts:290-308` 的 `checkTargetWritability()` 随后对该路径调用 `isWritable()`，并把原始 `targetPath` 加入 `dirsToCreate`。
  - 最小复现：对 `targetPath=/dev/null/aiforge-review-probe`、`allowedRoot=/dev` 调用 `preflight()`，实际返回 `{"ok":true,"dirsToCreate":["/dev/null/aiforge-review-probe"]}`。
- 影响：
  - `/dev/null/...`、`existing-file/child` 这类路径在预检查阶段会被错误放行，但后续文件操作必然失败。
  - 这直接削弱了本 Story “安装前 fail-fast 校验目标路径可写/可创建”的核心价值。
- 建议：
  - `findExistingAncestor()` 必须继续向上查找到“已存在且为目录”的祖先；若遇到已存在但非目录的路径段，应立即抛出 `AiforgeError`。
  - 补一条负向测试覆盖“祖先存在但不是目录”的场景。

### 2. [中] `ensureDir()` 直接泄漏原生 `SystemError`，违反统一错误契约

- 证据：
  - `src/services/fs-utils.ts:132-133` 直接执行 `await mkdir(dirPath, { recursive: true })`，没有包装成 `AiforgeError`。
  - 项目规则明确要求“ALL errors MUST use `AiforgeError`”：`_bmad-output/project-context.md:101-114`。
  - 最小复现：调用 `ensureDir('/dev/null/aiforge-review-probe')`，实际得到 `{"name":"Error","code":"ENOTDIR","isAiforgeError":false}`。
- 影响：
  - 调用方拿不到统一的 `code` / `severity` / `why` / `fix[]`，与 install 阶段的 fail-fast 错误模型不一致。
  - 一旦该工具函数被后续 Story 4.2/4.3/4.5 复用，用户侧会直接暴露底层 Node 错误形态。
- 建议：
  - 为 `ensureDir()` 增加 `AiforgeError` 包装，并补一条负向测试断言错误码与 `severity`。

### 3. [中] `preflight` 的公开签名已经偏离 Story 契约，后续接线会产生重复安全逻辑

- 证据：
  - Story 已勾选的任务明确要求 `preflight(plan: MatchedPlan, pathResolver: PathResolver): Promise<PreflightResult>`：`_bmad-output/implementation-artifacts/4-1-fs-utils-and-preflight-check.md:30-35`。
  - Story 的调用示意同样是 `await preflight(plan, pathResolver)`：`_bmad-output/implementation-artifacts/4-1-fs-utils-and-preflight-check.md:63-77`。
  - 实际实现变成了 `preflight(plan, pathResolver, allowedRoot)`：`src/services/fs-utils.ts:198-202`，且 `pathResolver` 在函数体内未被使用。
- 影响：
  - Story 4.2 / 4.3 若按当前 Story 文档接线，会直接出现类型/调用不匹配。
  - `allowedRoot` 的推导责任被散落到调用方，路径安全边界不再由单一实现收敛，后续很容易出现“目标路径解析逻辑”和“安全 root 判定逻辑”漂移。
- 建议：
  - 让 `preflight()` 自行根据 `MatchedPlan`/`scope` + `PathResolver` 推导 allowed root，保持 Story 定义的双参签名。
  - 若确实需要三参签名，应先回写 Story 任务、Dev Notes 和后续依赖 Story，避免文档/代码长期分叉。

### 4. [中] 质量门禁未通过：`tests/services/fs-utils.test.ts` 本身触发 5 个 lint error

- 证据：
  - `tests/services/fs-utils.test.ts:2` 未使用 `access`、`constants`
  - `tests/services/fs-utils.test.ts:4` 未使用 `resolve`
  - `tests/services/fs-utils.test.ts:6` 未使用 `AiforgeError`
  - `tests/services/fs-utils.test.ts:29` 未使用参数 `allowedRoot`
  - 实测 `npx eslint tests/services/fs-utils.test.ts` / `npm run lint` 均失败。
  - 但 Story 记录写的是 `Lint：0 errors，0 warnings`：`_bmad-output/implementation-artifacts/4-1-fs-utils-and-preflight-check.md:167-168,177`。
- 影响：
  - 当前分支无法通过仓库现有 lint 门禁。
  - Story 的完成记录与实际仓库状态不一致，后续评估和复审会被误导。
- 建议：
  - 清理未使用符号并重新执行 `npm run lint`。
  - 同步修正 Story Dev Agent Record / Change Log 中的验证结论。

## 验证摘要

- `npm test` ✅（431 / 431）
- `npm run build` ✅
- `npm run lint` ❌（`tests/services/fs-utils.test.ts` 5 个 `no-unused-vars` 错误）
- 定向复现 ❌
  - `ensureDir('/dev/null/aiforge-review-probe')` 返回 raw `Error`，不是 `AiforgeError`
  - `preflight('/dev/null/aiforge-review-probe')` 会误判通过

## 通过项

- `copyFile`、`copyDir`、`createSymlink`、`backupFile`、`fileHash` 的主路径和基础异常路径已具备可用实现。
- `preflight` 对常规可写路径、不可写路径、`../` 路径遍历的主流程测试覆盖基本齐全。
- 全量测试与构建当前均通过，说明本 Story 的问题主要集中在边界条件、错误契约和质量门禁，而非大面积回归。
