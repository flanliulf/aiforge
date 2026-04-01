---
Story: 5-4
Round: 1
Date: 2026-04-01
Model Used: GPT-5.4 (model ID: gpt-5.4)
Type: Code Review Summary
---

## 审查结论

本轮为 **第 1 轮首轮审查**。

结论：**不建议通过（Changes Requested）**。`reportError()` 三个实现的三段式排版本身已完成，`stderr` 输出分工、构建与测试也均通过；但 Story 5.4 的核心目标不只是“排版正确”，还要求真实错误链路产出可自助修复的业务级错误提示。当前至少仍有 3 个问题：认证失败未映射为 AC #1 要求的业务错误、clone/pull 错误存在脱敏缺口、跨模块错误文案审计与测试仍有“手工伪造错误对象代替真实错误源”的覆盖空洞。

## 本轮新增问题

### 1. [高] 认证失败真实链路没有生成 AC #1 要求的 `无法访问仓库 / 401 / 修复命令`

- **影响 AC**：#1、#4
- **位置**：
  - `src/stages/clone.ts:245-260`
  - `tests/core/reporter.test.ts:981-1001`
  - `tests/stages/clone.test.ts:585-627`
- **说明**：
  - 生产代码里 `git.clone()` 失败被统一包装为 `CLONE_FAILED`，message 固定为 `克隆仓库失败`，`why` 直接使用底层 `error.message`；没有根据 401/认证失败创建 `AUTH_FAILED` 或 `无法访问仓库` 这一业务级错误对象。
  - 目前 `AUTH_FAILED` / `无法访问仓库` 的验证只存在于 reporter 层手工构造的 `AiforgeError` 单测，证明的是“reporter 会排版”，不是“真实认证失败链路能产出 AC #1 要求的文案”。
  - 因此用户在真实认证失败时，看到的大概率仍是 `克隆仓库失败` + git 原始报错，而不是 Story 要求的三段式业务提示。
- **建议**：
  - 在 clone/pull 失败处识别认证失败（401、`Authentication failed`、`HTTP Basic: Access denied` 等）并映射为专门的 `AiforgeError`，使 `message` / `why` / `fix` 对齐 AC #1。
  - 增加阶段级或管道级测试，直接从真实失败链路断言最终错误对象，而不是只测 reporter 对手工对象的渲染。

### 2. [高] `CLONE_FAILED` / `PULL_FAILED` 直接透传底层 git 错误，存在 token 泄露风险

- **影响 AC**：#4；同时违反项目脱敏规则
- **位置**：
  - `src/stages/authenticate.ts:24-25`
  - `src/stages/clone.ts:245-260`
  - `src/stages/clone.ts:275-281`
  - `_bmad-output/project-context.md:149`
  - `_bmad-output/project-context.md:155-156`
- **说明**：
  - token 模式会构造 `https://oauth2:${token}@host/repo.git` 形式的 `cloneUrl`。
  - 但 clone/pull 失败时，`why` 直接使用 `error.message`，没有经过 `sanitizeUrl()` / `sanitizeToken()`。
  - 一旦底层 git/simple-git 错误回显远端 URL 或命令行，token 将被 reporter 原样输出到 `stderr`；这既是安全风险，也直接违反项目明确要求的“所有 logs/errors 脱敏”规则。
- **建议**：
  - 在所有把 git/URL 相关底层异常写入 `AiforgeError.why` 的位置统一做脱敏。
  - 增补负向测试：构造含 token 的底层错误消息，断言最终错误对象与 reporter 输出中都不包含原始 token。

### 3. [中] “跨模块错误文案审计”并未真正收口到生产错误源，`NO_TOOLS` / `PERMISSION_DENIED` 等场景仍与 Story 约定不一致

- **影响 AC**：#4
- **位置**：
  - `src/stages/detect-tools.ts:173-182`
  - `src/services/fs-utils.ts:423-432`
  - `src/services/fs-utils.ts:476-482`
  - `tests/core/reporter.test.ts:1008-1021`
  - `tests/core/reporter.test.ts:1067-1081`
  - `tests/stages/detect-tools.test.ts:205-230`
- **说明**：
  - Story 任务明确要求 `NO_TOOLS` 给出可复制命令 `npx aiforge --tools copilot claude`，但生产代码仍返回占位式说明 `使用 --tools <id> 手动指定工具，支持: ...`。
  - Story 任务明确要求权限不足给出 `chmod 755 <target-dir>` / `sudo npx aiforge -g`，但生产代码仍是 `ls -la` + 泛化 sudo 提示。
  - 更关键的是，reporter 测试是手工构造出“理想文案”的 `AiforgeError` 来断言输出，而不是直接断言 `detect-tools.ts` / `fs-utils.ts` 真正抛出的错误对象，所以这些不一致没有被测试体系捕获。
- **建议**：
  - 回到真实错误创建点逐个对齐 Story 5.4 约定的 `why` / `fix`。
  - 把测试重心从“手工 `new AiforgeError` 渲染”补到“真实模块抛错内容 + reporter 输出”两层联动，避免再次出现测试绿但生产文案未收口的问题。

## AC 复核结论

- **AC #1**：❌ 未满足。排版样式已具备，但真实认证失败链路没有稳定产出 `无法访问仓库` / `Git 服务器返回 401` / 三条修复命令。
- **AC #2**：✅ 基本满足。`TtyReporter` / `PlainReporter` / `QuietReporter` 的三段式格式与 stdout/stderr 分工实现正确。
- **AC #3**：✅ 满足。错误输出位于 `stderr`；相关测试、lint、build 均未发现回归。
- **AC #4**：⚠️ 部分满足。已有部分错误文案完善，但至少 `NO_TOOLS`、`PERMISSION_DENIED`、认证失败真实链路仍未完全达到 Story 承诺的“针对性 + 可复制修复命令”。

## 验证记录

本轮已执行并确认：

- `npm test` ✅ `620/620`
- `npm run build` ✅
- `npm run lint` ✅

## 最终建议

建议先修复上述 3 个问题后再进入下一轮 CR。优先级建议：先补认证失败映射与脱敏，再回收跨模块 `fix` 文案与真实链路测试。
