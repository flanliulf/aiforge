---
Story: 5-5a
Round: 2
Date: 2026-04-01
Model Used: GPT-5.4 (model ID: gpt-5.4)
Type: Code Review Summary
---

## 审查结论

本轮为复审。Round 1 指出的主体问题已完成大半修复：`messages.ts` 已迁入 `src/core/messages.ts`，`reporter.ts` 已接入 `msg()`，`services/config.ts` / `services/git.ts` / `stages/detect-tools.ts` 等核心链路已开始按语言切换，新增英文输出测试也已落地。当前 `npm test` ✅ `649/649`、`npm run build` ✅，但 `npm run lint` ❌，且仍有 2 个与 AC #1/#3/#4 直接相关的遗留问题，因此**本轮仍不建议通过**。

## 上轮问题回顾

### 已修复

1. Round 1 / Finding #2 — Reporter 与主要运行时消息源已完成第一轮国际化接线
   - `src/core/reporter.ts:160-167,188-246` 已使用 `msg('reporter.*')` 渲染统计行、plan 标题、scope 标签和 `Fix:` 标签。
   - `src/services/config.ts:23-66`、`src/services/git.ts:113-168`、`src/stages/detect-tools.ts:95-182` 已将主要 `AiforgeError` / 诊断文案切到 `msg()`。
   - `src/data/messages.ts:1-56` 已退化为兼容垫片，主实现迁至 `src/core/messages.ts`。
   - **验证结果**：`tests/core/reporter.test.ts:1088-1175` 已新增英文模式断言，`QuietReporter` / `TtyReporter` / `PlainReporter` 的关键英文输出均有覆盖。

2. Round 1 / Finding #3 — “英文真的被输出”的测试覆盖已有明显补强
   - `tests/commands/init.test.ts:660-715` 已新增 `setLanguage("en"|"zh-CN")` 调用断言。
   - `tests/core/reporter.test.ts:1071-1175` 已新增 Reporter 英文输出断言。
   - **验证结果**：`npm test` 通过，相关新增用例均为绿。

### 仍有遗留

1. Round 1 / Finding #1 — `init` 在“语言选择之前”的用户可见路径仍未按既有语言/既定决策输出
   - **证据**
     - `src/commands/init.ts:55-64` 在 `loadConfig()` 成功后立即输出 `msg('init.currentConfig')` / `msg('init.modifyPrompt')`，但直到 `src/commands/init.ts:94-95` 才首次调用 `setLanguage(language)`。这意味着已有 `config.language = 'en'` 时，本次 `aiforge init` 的“当前配置/是否修改”仍先按默认中文渲染。
     - `src/commands/init.ts:29` 在命令注册阶段直接使用 `msg('init.descInit')`；此时没有任何 config preload，fresh process 中 `currentLanguage` 仍是默认 `zh-CN`。
     - 定向复现：
       - `node dist/index.js --help` 输出 `init                    初始化 aiforge 配置`
       - `node dist/index.js init --help` 输出 `初始化 aiforge 配置`
   - **影响**
     - 直接违反上轮评估已确认的“CLI help 仅英文”决策。
     - 也使 AC #1 / AC #4 的“选择英文后 / 配置为 en 后输出英文”在 `init` 入口上仍不成立。
   - **建议**
     - `runInit()` 读取到 `existingConfig` 后，先按 `existingConfig.language` 预加载一次语言，再输出当前配置摘要。
     - `init` 子命令 description 不应依赖默认语言状态；要么固定为英文，要么在注册前显式完成语言初始化。

2. Round 1 / Finding #2 — 仍有多处 fix / 建议文本绕过 `msg()`，英文模式下会继续泄漏中文
   - **证据**
     - `src/services/config.ts:29,39-40,55,66` 的 fix 命令注释仍是中文。
     - `src/services/fs-utils.ts:286,316` 的 fix 数组仍是中文。
     - `src/stages/conflict-resolver.ts:137,150` 的 fix 数组仍是中文。
     - `src/stages/detect-tools.ts:183-185` 的 `NO_TOOLS` 修复建议首项仍是中文。
     - `src/commands/init.ts:192-194,222-223` 的 SSH / Token 修复建议仍是中文。
     - `src/core/path-resolver.ts:27` 的 fix 数组仍是中文。
   - **影响**
     - 这些字符串都会直接进入 `AiforgeError.fix` 或 `console.log`，属于用户可见输出；在 `language = en` 时仍会出现中英混杂，AC #3“所有用户可见字符串通过 messages 模块获取”尚未完全满足。
   - **建议**
     - 将所有 fix / suggestion 文本（含 shell comment）纳入 `msg()` 键管理；不要只国际化 `message` / `why`，遗漏 `fix[]`。
     - 为至少一个错误链路补充英文 fix 断言，避免再次只测标题不测建议文本。

## 新发现

### 1. [中][新] 当前分支的 lint 门禁未通过，和 Story/评估中的“lint 已绿”结论不一致

- **证据**
  - `npm run lint` 实际失败。
  - 输出中明确标记了 story 相关文件的 Prettier 问题：`src/core/messages.ts`、`src/services/fs-utils.ts`、`tests/core/reporter.test.ts`。
  - 同时还存在 `_analysis_output/*.md` 的格式问题，导致仓库当前工作区整体不满足 lint 门禁。

- **影响**
  - Story 当前不满足“验证全绿”交付标准。
  - 上轮评估/修复记录声称 lint 已通过，但当前状态无法复现该结论。

- **建议**
  - 先格式化 story 相关源码/测试文件，确保 `npm run lint` 对核心改动恢复绿色。
  - 若 `_analysis_output/` 仅为临时分析产物，应从门禁范围清理、忽略或规范化，避免污染项目 lint 结果。

## 验证摘要

- `npm test` ✅（`649 / 649`）
- `npm run lint` ❌
- `npm run build` ✅
- 额外复核：
  - `node dist/index.js --help` ✅ 复现 `init                    初始化 aiforge 配置`
  - `node dist/index.js init --help` ✅ 复现子命令描述仍为中文
  - 代码走查确认 `src/commands/init.ts:55-64` 发生在首次 `setLanguage()` 之前

## 通过项

- `src/core/messages.ts` 已成为集中式双语消息源，`src/data/messages.ts` 兼容层合理。
- `src/core/reporter.ts` 的标题、scope、统计行、`Fix:` 标签已能随 `setLanguage('en')` 切换。
- `services/config.ts`、`services/git.ts`、`stages/detect-tools.ts` 等核心错误/诊断链路已从“纯中文硬编码”明显前进到“多数文案走 `msg()`”。
- 英文模式测试较上一轮明显增强，`tests/core/reporter.test.ts` 已不再只锁中文输出。

## 结论

- **结论：不通过（Changes Requested）**
- **阻塞项**：
  - `init` 的 pre-selection / help 路径仍未满足 AC #1 / AC #4
  - 多处 fix / 建议文本仍未国际化，AC #3 未完全闭合
  - `npm run lint` 当前失败
- **建议**：
  - 先修复 `init` 的语言预加载与 help 描述问题；
  - 再收口所有 `fix[]` / console 建议文本的 i18n；
  - 最后恢复 `npm run lint` 全绿后再进入下一轮 CR。
