---
Story: 5-1
Round: 1
Date: 2026-03-31
Model Used: GPT-5.4 (gpt-5.4)
Type: Code Review Summary
---

# 审查结论

结论：**需修复后复审**。

本次首轮 CR 聚焦 `src/stages/execute-install.ts`、`src/core/reporter.ts`、`src/index.ts` 以及对应测试。当前实现已经补齐了 spinner、stderr 输出、进度文案与测试覆盖，且 `npm run lint`、`npm run build`、`npm test` 均通过；但仍有 2 个与 Story 5.1 验收目标直接相关的问题，建议修复后进入第 2 轮审查。

# 主要发现

## 1. 进度分母按全部 sourceFiles 计算，但分子只统计实际执行安装的项目，导致 skipped 场景下进度失真

- **严重级别**：中
- **位置**：`src/stages/execute-install.ts:334-339, 367-377, 395-403, 408-426, 455-463, 469-488, 513-545`

### 问题说明

当前 `totalFiles` 直接对所有 `item.sourceFiles.length` 求和；但 `processedCount` 只在真正执行 `copyFile` / `copyDir` / `createSymlink` 后递增。

这会导致以下“已处理但未执行安装”的分支不会推进进度：

- `status === 'skipped'`
- 冲突处理后 `conflictAction === 'skip'`
- flatten 子目录缺少 `mainFile` 时告警跳过
- `aiforge-current` 等自动跳过路径

结果是：当计划内存在 skipped/跳过项时，spinner 文本中的 `(当前/总数)` 可能永远到不了总数，例如 3 个文件里 2 个被跳过时，最后一次更新可能停在 `(1/3)`，随后阶段直接成功结束。

### 为什么这是问题

Story 5.1 的 AC #2 要求：**“每个文件处理完成”** 时更新 spinner 文本显示当前进度。`skipped` 也是明确的处理结果，不应让进度条卡在比总数更小的值，否则用户会误判还有文件未处理。

### 建议修复

二选一，且建议统一语义后补测试：

1. 将“进度单位”定义为“已处理的 source item”，在所有终态分支（`new` / `updated` / `skipped` / `warn+skip` / `conflict skip`）都推进计数。
2. 如果产品语义坚持“只统计实际安装动作”，则需要把分母改成“预计执行安装的项目数”，并在预扫描阶段准确排除所有 skip 分支；否则 `(当前/总数)` 语义不成立。

同时建议新增“混合 installed + skipped”场景测试，防止回归。

## 2. Reporter 的 TTY 判定使用了 `stdout.isTTY`，与 spinner 实际输出流 `stderr` 不一致

- **严重级别**：中
- **位置**：`src/index.ts:45-48`, `src/core/reporter.ts:85-86, 356-363`

### 问题说明

`TtyReporter` 已经明确通过 `ora({ stream: process.stderr })` 把 spinner 输出到 `stderr`，这与 AC #3 和项目的 stdout/stderr 分工是一致的。

但 CLI 入口在创建 reporter 时，使用的是：

```ts
createReporter({
  quiet: args.quiet,
  isTty: process.stdout.isTTY === true,
})
```

这意味着：只要 `stdout` 被重定向/管道，即使 `stderr` 仍连接在真实终端上，程序也会退化成 `PlainReporter`，从而失去 Story 5.1 需要的 ora spinner 动画。

### 为什么这是问题

本 Story 明确要求进度信息输出到 `stderr`，目的之一就是不污染 `stdout` 数据流。既然 spinner 的承载通道是 `stderr`，那么是否启用 TTY spinner 也应以 `stderr` 的终端能力为准。

典型受影响场景：

- `aiforge ... > result.txt`
- `aiforge ... | some-command`

在这些场景中，用户仍可能在终端看到 `stderr`，按预期应该继续看到 spinner；但当前实现不会启用 `TtyReporter`。

### 建议修复

- 将 reporter 选择条件改为基于 `process.stderr.isTTY`
- 或显式分别传入 stdout/stderr 的 TTY 状态，并以 stderr 作为进度通道的判定依据
- 补一条入口层或 reporter 工厂层测试，覆盖“stdout 非 TTY、stderr 为 TTY”场景

# 通过项

以下内容本轮审查确认已满足预期：

- `TtyReporter.startPhase()` 已使用 `ora({ stream: process.stderr })`
- `TtyReporter.completePhase()` / `reportError()` 的成功、失败标记行为正确
- 进度信息未写入 `stdout`
- 相关新增测试可通过，且全仓校验通过：`npm run lint`、`npm run build`、`npm test`

# 建议结论

**建议先修复以上 2 项，再发起第 2 轮 CR。**
