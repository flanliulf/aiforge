---
Story: 6-3
Round: 2
Date: 2026-04-20
Model Used: GPT-5.4 (gpt-5.4)
Type: Code Review Summary
---

## 审查结论

本轮为复审。上轮两个阻塞问题已经修复：目录复制路径在逐文件写入前补上了边界校验，`--filter` 零命中后的交互恢复也会重新并入 universal rules。三层审查均可用，`npx vitest run`、`npm run lint:src`、`npm run build` 通过；但本轮仍发现 1 个新的中优先级功能缺口，因此当前不建议通过。

## 上轮问题回顾

### 已修复

1. Round 1 / Finding #2 — 嵌套文件写入未重做边界校验
   - 修复位置：`src/stages/execute-install.ts` 的 Directories copy 循环现在会在每个 `destFilePath` 写入前执行 `validateDestPathSecurity(destFilePath, allowedRoot)`。
   - 验证结果：人工复核代码路径后确认修复存在，相关测试通过。

2. Round 1 / Finding #4 — `--filter` 零命中后的交互恢复没有重新并入通用目录规则
   - 修复位置：`src/stages/match-rules.ts` 的交互恢复分支现在会按 `rPrefix/rGlob` 语义重新追加 `UNIVERSAL_RULES`。
   - 验证结果：人工复核重放逻辑后确认修复存在，相关测试通过。

### 仍为非阻塞待办

1. Round 1 / Finding #1 — Directories copy 模式会静默覆盖同名用户文件，并绕过原有冲突决策链路
   - 维持既有评估结论：CR TODO / 非阻塞。

2. Round 1 / Finding #3 — 无条件读取 config，使全局安装和 `--no-universal` 也会被无关配置错误阻断
   - 维持既有评估结论：CR TODO / 非阻塞。

## 新发现

### 1. [中][新] Directories copy 的文件级重构会静默丢失空目录和符号链接条目

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `src/stages/execute-install.ts:94-106` 中的 `walkDirFiles()` 只递归 `isDirectory()` 并收集 `isFile()` 条目，没有为 empty directory 创建目标节点，也完全忽略 `isSymbolicLink()`。
  - `src/stages/execute-install.ts:579-602` 的 copy 分支只对 `walkDirFiles()` 返回的文件执行 `ensureDir(dirname(destFilePath))` 和 `copyFile(...)`；除了顶层 `ensureDir(destPath)` 之外，不会为嵌套空目录建树。
  - 旧实现通过 `src/services/fs-utils.ts:68-82` 的 `copyDir(src, dest)` 调用 `cp(..., { recursive: true })`，语义上是递归复制目录结构；本次重构把目录复制收窄成了“仅复制常规文件”。

- **影响**
  - 一旦 skill 目录包含 empty subdirectory 或 symlink resource，通用目录安装结果将不再是 AC #1 所要求的“完整复制”，目录结构也无法与原目录保持一致。
  - 这类条目既不会进入 `result.items`，也不会进入 manifest 跟踪，当前测试集对该回归没有保护。

- **建议**
  - 在 file-level copy 路径中显式保留目录节点，并对 source symlink 选择确定策略：要么复制/重建，要么 fail-fast 明确报不支持，不能静默跳过。
  - 补两条回归测试：包含 nested empty directory 的 skills fixture，以及包含 source symlink 的 directory-copy fixture。

## 验证摘要

- `npx vitest run tests/stages/execute-install.test.ts tests/stages/match-rules.test.ts tests/integration/universal-dirs-sync.test.ts tests/integration/pipeline.test.ts tests/cli-args.test.ts tests/data/install-rules.test.ts` ✅（169 / 169）
- `npm run lint:src` ✅
- `npm run build` ✅
- 额外复核：
  - `src/stages/execute-install.ts` 中逐文件边界校验仍在 copy loop 内生效。
  - `src/stages/match-rules.ts` 的交互恢复路径已重新并入 `UNIVERSAL_RULES`，与主路径过滤语义保持一致。

## 通过项

- 上轮两个阻塞修复点都已落地，且当前代码中未发现回退。
- `executeInstall()` 的 file-level hash 增量同步、`matchRules()` 的 universal replay、以及相关结果/manifest 链路在现有测试范围内运行正常。
- 相关源码、单测、集成测试和构建均通过，没有出现新的显性编译或运行失败。

## 结论

- **结论：不通过**
- **阻塞项**：1 个新的中优先级问题：Directories copy 重构后会静默丢失空目录和符号链接条目。
- **建议**：先修复目录复制语义缺口并补回归测试，再进入下一轮 CR。
