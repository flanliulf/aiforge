---
Story: 4-2
Round: 3
Date: 2026-03-27
Model Used: GPT-5.4 (gpt-5.4)
Type: Code Review Summary
---

## 审查结论

本轮为复审。Round 1 的 P0 symlink 外逃问题与 Round 2 的 lint 阻塞项均已修复，`npm test`、`npm run lint`、`npm run build` 当前全绿；但仍存在 **1 个阻塞问题 + 1 个中风险新问题**，因此 **仍不建议通过**。

## 上轮问题回顾

### 已修复

1. Round 1 / Finding #1 — `destPath` 缺少 symlink 安全校验
   - `files` / `directories` 两个写入分支都已补齐 `validateDestPathSecurity()`，实测对指向 allowedRoot 外部的有效 symlink 会抛 `PATH_TRAVERSAL`。

2. Round 2 / Finding #2 — Lint 未通过
   - 本轮复核 `npm run lint` 已通过，不再是阻塞项。

### 仍为非阻塞待办

1. Round 1 / Finding #2 — `targetPath` 为普通文件时 preflight 未提前拒绝
   - 维持上一轮评估结论：CR TODO / P2，不阻塞本 Story。

2. Round 2 / Finding #1 — 指向 allowedRoot 内部的 broken symlink 仍采用保守拒绝策略
   - 维持上一轮评估结论：CR TODO / P2，不阻塞本 Story。

## 新发现

### 1. [高][新] fail-fast 抛错后无法输出“已完成操作清单”，直接违背 AC #6 / FR-031

- **证据**
  - `src/stages/execute-install.ts` 仅在本地变量 `resultItems` 中累计成功项；一旦 `copyFile()` / `copyDir()` 抛错，函数会直接退出，`resultItems` 不会返回给调用方。
  - `src/core/errors.ts` 的 `AiforgeError` 不承载任何已完成结果；`src/core/reporter.ts` 的 `reportError()` 也只输出 `message / why / fix[]`。
  - 实测复现：先成功复制第 1 个文件，再让第 2 个文件失败，输出为 `{"isAiforgeError":true,"code":"FILE_COPY_FAILED","hasItems":false,"errorKeys":["code","exitCode","severity","why","fix","name"],"firstFileCopied":true}`。这说明“前一个文件已经写入磁盘”，但错误对象中没有任何已完成清单可供后续报告。

- **影响**
  - 用户在半完成失败场景下无法知道哪些文件已经落盘，无法满足 FR-031 “立即停止并输出已完成的操作清单”的要求。
  - 当前测试只断言“会 reject”，没有覆盖“失败时仍可拿到已完成操作列表”的关键验收点。

- **建议**
  - 为 install 失败路径增加显式结果传递通道：例如给 `AiforgeError` 增加已完成项 payload，或改为抛出包含 `completedItems` 的专用错误类型 / 结果封装。
  - 补 1 条回归测试：第一项成功、第二项失败时，调用方仍能取得第一项的 `InstallResult`。

### 2. [中][新] `executeInstall()` 不符合当前 `InstallFn` 合约，阶段实现暂时不能直接接入管道

- **证据**
  - `src/pipeline.ts` 中 `InstallFn` 的签名为 `(plan, args, reporter) => Promise<InstallResult>`。
  - `src/stages/execute-install.ts` 当前导出的 `executeInstall()` 需要第 4 个必填参数 `pathResolver`。
  - 独立类型检查可直接复现：`Type '(plan, _args, reporter, pathResolver) => Promise<InstallResult>' is not assignable to type 'InstallFn'. Target signature provides too few arguments. Expected 4 or more, but got 3.`

- **影响**
  - 当前实现还不是一个可直接替换 `pipeline.install` 占位函数的 stage；后续 Story 4.6a/4.6b 一旦接线，必须额外写 wrapper / factory，否则类型层面就会报错。
  - 现有测试只覆盖了“直接调用 `executeInstall()`”，没有守住“满足 pipeline stage contract”的边界。

- **建议**
  - 统一为 stage factory（如 `createExecuteInstall(pathResolver): InstallFn`）或在现有生产 stage 工厂里闭包注入 `pathResolver` 后导出符合 `InstallFn` 的函数。
  - 增加 1 条类型 / 编译级回归校验，避免后续接线时才暴露。

## 验证摘要

- `npm test` ✅（24 个测试文件，457 个测试全部通过）
- `npm run lint` ✅
- `npm run build` ✅
- 复审重点确认：
  - 上轮 symlink 外逃修复已保持有效
  - 上轮 lint 阻塞项已清除
  - 本轮新增问题集中在 **错误结果传递** 与 **stage 合约对齐**，而不是基础 copy 逻辑

## 结论

- **结论：暂不通过**
- **阻塞项**：Finding #1
- **建议**：先补齐 fail-fast 的“已完成操作清单”传递能力，再处理 `InstallFn` 合约对齐；完成后再进入第 4 轮复审。
