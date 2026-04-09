---
Story: 4-6b
Round: 2
Date: 2026-03-31
Model Used: GPT-5.4
Type: Code Review Summary
---

## 审查结论

本轮为 **第 2 轮复审**。

Round 1 的 3 个问题里：

- **#3 已关闭**：`tests/pipeline.test.ts` 中缺失的 `tool` 字段已补齐。
- **#1 / #2 仅部分关闭**：display name、`source → target`、Plain 四列输出都已补上，但当前实现仍把**绝对 clone 路径**暴露到用户输出里，且新增测试把这一偏差固化了。

另外，本轮还发现一个新的质量门禁问题：**`npm run lint` 失败**。

**结论：仍需修复后再进入下一轮 CR。**

## 上轮问题复核

### 1. 上轮问题 #1 / #2：部分修复，但仍有残留

- **上轮结论**：`reportResult()` 输出格式未对齐 Story；测试未锁定关键输出契约
- **本轮复核结果**：⚠️ **部分修复，未完全关闭**

**已修复部分：**

- TTY 标题已改为 display name：`src/core/reporter.ts:133-136`
- TTY 已输出 `sourcePath → targetPath`：`src/core/reporter.ts:137-140`
- Plain 已输出四列 `status\ttool\tsource\ttarget`：`src/core/reporter.ts:269-271`
- `reporter.test.ts` 已新增对 display name、source 列、四列格式的断言：`tests/core/reporter.test.ts:199-213`、`tests/core/reporter.test.ts:327-342`

**残留问题：**

Story 示例要求的是 repo-relative 展示：

- `agents/coding-agent.md  → ~/.copilot/agents/coding-agent.md`
- `instructions/CLAUDE.md → ~/.claude/instructions/CLAUDE.md`

证据：`_bmad-output/implementation-artifacts/4-6b-install-result-summary-and-output.md:38-56`

但当前运行链路里：

- `matchRules()` 明确把 `sourceFiles` 生成为**绝对路径**：`src/stages/match-rules.ts:92-129`
- `executeInstall()` 继续把这些绝对路径直接写入 `InstallResult.sourcePath`：`src/stages/execute-install.ts:362-367`、`src/stages/execute-install.ts:389-393`、`src/stages/execute-install.ts:406-410`
- Reporter 又直接把 `item.sourcePath` 原样输出到 stdout：`src/core/reporter.ts:139`、`src/core/reporter.ts:271`

我做的独立 smoke 验证，实际输出为：

- `✅ /repo/agents/coding-agent.md     → ~/.copilot/agents/coding-agent.md`
- `new\tcopilot\t/repo/agents/coding-agent.md\t~/.copilot/agents/coding-agent.md`

也就是说，当前用户看到的是**绝对 clone 路径**，不是 Story 示例中的稳定相对路径。

同时，新增测试已经把这个偏差锁死：

- Plain 测试断言 `/repo/agents/...`：`tests/core/reporter.test.ts:199-213`
- TTY 测试断言 `/repo/agents/...`：`tests/core/reporter.test.ts:334-342`

**影响：**

- 用户输出仍未完全对齐 Story 约定；
- source 列会暴露临时 clone 根目录，结果随机器/运行目录变化，不稳定；
- 新测试当前保护的是“错误契约”，后续修正时还得一起改测试。

**建议：**

- 不要直接把内部绝对 `sourcePath` 暴露给 Reporter；
- 为结果输出补一个 repo-relative 的 display source（例如 `agents/coding-agent.md` / `skills/refactor/`），再由 Reporter 渲染；
- 同步把 `tests/core/reporter.test.ts` 的断言改为 Story 示例约定的相对路径。

### 2. 上轮问题 #3：已修复并关闭

- **上轮结论**：`tests/pipeline.test.ts` 中 `InstallResult` fixture 缺少 `tool` 字段
- **本轮复核结果**：✅ **已关闭**

**证据：**

- 行 174 已补 `tool: 'test-tool'`：`tests/pipeline.test.ts:173-175`
- 行 204 已补 `tool: 'test-tool'`：`tests/pipeline.test.ts:203-205`
- mixed result 的 3 个 item 也都已补齐：`tests/pipeline.test.ts:325-329`

我额外重跑了定向静态检查：

- `npx tsc --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext tests/pipeline.test.ts`

结果里**已不再出现** Round 1 指出的 `Property 'tool' is missing` 报错。当前剩余的 `simple-git` / `clone.ts` / `globalToolDir` 错误与本 Story 本轮修复无关。

## 本轮新发现

### 新发现 1：`npm run lint` 仍失败，当前分支不满足质量门禁

- 严重级别：**Medium**
- 证据：
  - 我独立执行 `npm run lint`，结果失败
  - 失败原因聚焦为 Prettier 格式问题：`tests/core/reporter.test.ts`、`tests/pipeline.test.ts`
  - 进一步执行 `npx prettier --check tests/core/reporter.test.ts tests/pipeline.test.ts`，同样失败

**问题说明：**

本轮代码虽然已经做到：

- `npm test` ✅（576 / 576）
- `npm run build` ✅

但 `lint` 仍未通过，所以“可合并 / review ready”的结论还不能成立。

**影响：**

- 当前分支无法通过仓库既有质量门禁；
- Round 1 evaluation 中“修复验证已通过 lint”的结论，在当前工作树状态下不成立。

**建议：**

- 先整理并格式化 `tests/core/reporter.test.ts`、`tests/pipeline.test.ts`
- 再重跑 `npm run lint`

## 验证记录

本轮实际执行：

- `npm test` ✅（576 / 576）
- `npm run build` ✅
- `npm run lint` ❌
- `npx prettier --check tests/core/reporter.test.ts tests/pipeline.test.ts` ❌
- `npx tsc --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext tests/pipeline.test.ts` ✅（Round 1 的缺 `tool` 报错已消失）

## 最终建议

当前 `4-6b` 的主要修复方向是对的，但还**不能判定为通过**。

建议下一轮优先收口两件事：

1. 把结果输出里的 source 列从“绝对 clone 路径”改成 Story 示例要求的 repo-relative 路径，并同步修正相关测试
2. 修复 `tests/core/reporter.test.ts`、`tests/pipeline.test.ts` 的格式问题，确保 `npm run lint` 通过
