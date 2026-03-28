---
Story: 4-2
Round: 4
Date: 2026-03-27
Model Used: GPT-5.4 (gpt-5.4)
Type: Code Review Summary
---

## 审查结论

本轮为复审。Round 1 的 P0 symlink 外逃问题与 Round 2 的 lint 阻塞项维持已修复；Round 3 评估已将“fail-fast 已完成清单”降级为 CR TODO，并将 `InstallFn` 合约问题判定为误报。当前 `npm test`、`npm run lint`、`npm run build` 仍然全绿，但本轮又发现 **1 个新的阻塞问题 + 1 个新的中风险问题**，因此 **仍不建议通过**。

## 上轮问题回顾

### 已修复

1. Round 1 / Finding #1 — `destPath` 缺少 symlink 安全校验
   - `files` / `directories` 两个分支的 `validateDestPathSecurity()` 修复仍有效。

2. Round 2 / Finding #2 — Lint 未通过
   - 本轮复核 `npm run lint` 继续通过。

### 仍为非阻塞待办

1. Round 1 / Finding #2 — `targetPath` 为普通文件时 preflight 未提前拒绝
   - 维持 Round 1 / Round 2 评估结论：CR TODO / P2。

2. Round 2 / Finding #1 — 指向 allowedRoot 内部的 broken symlink 仍采用保守拒绝策略
   - 维持 Round 2 评估结论：CR TODO / P2。

3. Round 3 / Finding #1 — fail-fast 后无法直接输出“已完成操作清单”
   - 按 Round 3 评估结论，维持 CR TODO / P2，本轮不重复升级。

### 可忽略

1. Round 3 / Finding #2 — `executeInstall()` 与 `InstallFn` 合约不一致
   - 按 Round 3 评估结论维持“误报”，本轮不重复指出。

## 新发现

### 1. [中][新] `sourceFiles = []` 的 plan item 没有被真正“静默跳过”，反而会创建空目标目录，甚至在目标冲突时直接 fail-fast

- **证据**
  - `src/stages/match-rules.ts` 会无条件把每条规则 push 进 `plan.items`，即使 `sourceFiles` 为空。
  - `tests/stages/match-rules.test.ts` 已明确把这类场景定义为“空目录 / 源目录不存在时 sourceFiles 为空，静默跳过”。
  - 但 `src/stages/execute-install.ts` 在进入 `for (const srcPath of item.sourceFiles)` 之前，就会先对每个 item 执行 `preflight(plan)`，并在 item 级别无条件调用 `ensureDir(item.targetPath)`。
  - 实测复现 1：`sourceFiles=[]` 时返回 `{"items":0,"targetExists":true}`，说明虽然没有任何 `InstallResult`，目标目录仍被创建。
  - 实测复现 2：`sourceFiles=[]` 且 `targetPath` 恰好是一个已存在文件时，返回 `{"ok":false,"code":"ENSURE_DIR_FAILED","severity":"fatal"}`，说明本应 no-op 的空规则会直接阻断整个安装。

- **影响**
  - 这违背了 `matchRules` 对空源目录“静默跳过”的既有语义：没有可复制资源时，安装阶段本应 no-op。
  - 当前实现会在“没有任何东西要安装”的情况下污染用户文件系统（创建空目录），甚至让无关的空规则把整个安装流程 fail-fast 掉。
  - 现有 `execute-install` 测试只断言“空 item 不产生结果”，没有守住“空 item 不应产生副作用 / 不应报错”的关键边界。

- **建议**
  - 在 install 阶段显式跳过 `item.sourceFiles.length === 0` 的 item；至少要在 `preflight` / `ensureDir` 之前过滤空 item。
  - 补 2 条回归测试：
    - `sourceFiles=[]` 时不创建目标目录；
    - `sourceFiles=[]` 且目标路径冲突时，install 仍应安静跳过而不是抛 fatal。

### 2. [中][新] 成功路径从未调用 `reporter.completePhase()`，安装阶段的 phase lifecycle 未闭合

- **证据**
  - `src/stages/execute-install.ts` 成功路径只调用了 `reporter.startPhase()` 和 `reporter.updatePhase()`，没有任何 `reporter.completePhase()`。
  - 对照现有 stage 实现，`resolve-source.ts`、`detect-tools.ts`、`match-rules.ts` 都会在成功返回前调用 `reporter.completePhase()`。
  - `src/core/reporter.ts` 中，`TtyReporter.startPhase()` 会启动 ora spinner，而 `completePhase()` 才负责 `succeed()` 并清空 spinner；`reportResult()` 并不会补做这一步。
  - 实测复现：成功安装 1 个文件后统计调用次数为 `{"start":1,"update":1,"complete":0}`。

- **影响**
  - 当前安装阶段已经依赖 `Reporter`，但成功路径没有闭合 phase；一旦接入 `TtyReporter`，安装完成后会遗留未收口的 spinner / 阶段状态，导致终端输出生命周期与其它 stage 不一致。
  - 现有测试覆盖了 `startPhase` / `updatePhase`，但没有覆盖成功路径的 `completePhase`。

- **建议**
  - 在 install 成功返回前调用一次 `reporter.completePhase()`。
  - 增加 1 条回归测试：成功路径（含空 plan）应调用 `completePhase()`。

## 验证摘要

- `npm test` ✅（24 个测试文件，457 个测试全部通过）
- `npm run lint` ✅
- `npm run build` ✅
- 额外复核：
  - 空 `sourceFiles` 会创建空目录 ✅ 已复现
  - 空 `sourceFiles` 遇到目标冲突会抛 `ENSURE_DIR_FAILED` ✅ 已复现
  - 成功路径 `reporter.completePhase()` 未被调用 ✅ 已复现

## 通过项

- Round 1 修复的 `destPath` 级 symlink 安全校验保持有效。
- `files` / `directories` 基础复制、`new` / `updated` / `skipped` 判定、以及 fail-fast 基础行为在现有测试覆盖下仍工作正常。
- 当前问题集中在“空规则 no-op 语义”与“reporter 生命周期闭合”，不是基础 copy 主路径回归。

## 结论

- **结论：暂不通过**
- **阻塞项**：Finding #1
- **建议**：先把空 `sourceFiles` item 改成真正 no-op，再顺手补上 `reporter.completePhase()`；完成后进入第 5 轮复审。
