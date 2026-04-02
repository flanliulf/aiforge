---
Story: 5-5a
Round: 3
Date: 2026-04-01
Model Used: GPT-5.4 (model ID: gpt-5.4)
Type: Code Review Summary
---

## 审查结论

本轮为复审。Round 2 指出的 `init` 语言预加载、`init` 帮助文案英文化、以及 `lint` 门禁问题均已修复；当前 `npm test` ✅ `649/649`、`npm run lint` ✅、`npm run build` ✅。但本轮仍发现一组**新的阻塞项**：若 `language = en`，`clone` / `execute-install` / `match-rules` / `resolve-source` / `services/git` / `fs-utils` 的多条真实运行时错误/警告路径仍会输出中文，Story 5.5a 的 AC #1 / #3 / #4 还没有完全闭合，因此**本轮仍不建议通过**。

## 上轮问题回顾

### 已修复

1. Round 2 / Finding #1a — `init` 配置摘要在语言预加载前输出
   - `src/commands/init.ts:55-68` 已在输出当前配置摘要前执行 `setLanguage(existingConfig.language ?? 'zh-CN')`。
   - **验证结果**：已有配置路径下，`msg('init.currentConfig')` / `msg('init.modifyPrompt')` 不再固定走默认中文。

2. Round 2 / Finding #1b — `init` description 仍通过 `msg()` 求值
   - `src/commands/init.ts:26-31` 已改为硬编码英文 `.description('Initialize aiforge configuration')`。
   - **验证结果**：
     - `node dist/index.js --help` → `init                    Initialize aiforge configuration`
     - `node dist/index.js init --help` → `Initialize aiforge configuration`

3. Round 2 / Finding #2（已列举位置）— `config.ts` / `path-resolver.ts` / `conflict-resolver.ts` / `detect-tools.ts` / `init.ts` / `index.ts` / 多数 `fs-utils.ts` fix 文本国际化
   - `src/services/config.ts:24-38,47-63`
   - `src/core/path-resolver.ts:21-27`
   - `src/stages/conflict-resolver.ts:132-150`
   - `src/stages/detect-tools.ts:178-185`
   - `src/commands/init.ts:189-227`
   - `src/index.ts:58-73`
   - `src/services/fs-utils.ts:281-318`
   - **验证结果**：这些位置已改用 `msg('*.fix*')` 或对应英文消息键输出。

4. Round 2 / Finding #3 — lint 门禁失败
   - 当前 `npm run lint` 已恢复通过。

### 仍为非阻塞待办

无。

## 新发现

### 1. [高][新] 仍有多条真实运行时错误/警告路径未接入 `msg()`，英文模式下会继续向用户输出中文

- **证据**
  - `src/stages/clone.ts:78-87`：`SANITIZE_REMOTE_FAILED` 仍直接构造中文 `AiforgeError`，fix 也为中文。
  - `src/stages/clone.ts:114-120`：`SCAN_FAILED` 仍直接输出中文 message / why / fix。
  - `src/stages/clone.ts:257-289`、`313-330`：`AUTH_FAILED` / `CLONE_FAILED` / `PULL_FAILED` 仍是中文 message / why / fix。
  - `src/stages/execute-install.ts:271-280`：零结果诊断 `reporter.warn()` 全部为中文（`未安装任何文件`、`诊断信息：`、`建议：` 等）。
  - `src/stages/match-rules.ts:44-50`：`LINK_PROJECT_REJECTED` 的 message / why / fix 仍为中文。
  - `src/stages/resolve-source.ts:79-85`：`NO_REPO` 的 fix 数组仍为中文。
  - `src/services/git.ts:113-121`、`139-147`、`164-172`：`UNSUPPORTED_PROTOCOL` / `INVALID_URL` 相关 fix 数组仍保留中文注释（`HTTPS 格式` / `SSH 格式`）。
  - `src/services/fs-utils.ts:558-569`、`588-599`：`symlinkEscape` 的两条后置 realpath 分支 fix 数组仍是中文。

- **影响**
  - 这些字符串都会通过 `reporter.reportError()` 或 `reporter.warn()` 直接面向用户输出；即使 `setLanguage('en')` 已生效，实际运行时仍会出现中英混杂。
  - 这直接违反 AC #3“所有用户可见字符串通过 `msg()` 获取”，并使 AC #1 / AC #4“英文配置下输出英文”在真实错误/诊断路径上失效。

- **建议**
  - 对 `clone.ts`、`execute-install.ts`、`match-rules.ts`、`resolve-source.ts`、`services/git.ts`、`fs-utils.ts` 剩余用户可见字符串做**完整收口**，不要只修 `message` / `why`，也要覆盖 `fix[]` / `warn()` 文案。
  - 在 `src/core/messages.ts` 中补足对应 message namespace / key，避免继续散落硬编码。

### 2. [中][新] 阶段级测试仍主要固化中文契约，未能守住上述英文运行时残留

- **证据**
  - `tests/stages/clone.test.ts:625-650,689-690` 仍直接断言中文 `message = '无法访问仓库'`。
  - `tests/stages/execute-install.test.ts:1202-1245` 仍直接断言 `reporter.warn` 包含 `未安装任何文件`。
  - `tests/stages/resolve-source.test.ts:228-235` 仅断言中文 phase 文案 `解析仓库地址...`。
  - 定向搜索 `tests/stages tests/services tests/integration` 中的英文 stage 断言未命中：当前并没有覆盖 `clone` / `execute-install` / `match-rules` / `resolve-source` 等模块在 `setLanguage('en')` 下的英文输出。

- **影响**
  - 这解释了为何本轮残留问题未被测试门禁捕获：测试仍将部分中文输出视为正确行为。
  - 继续保持这种测试结构，会在后续修复时重复出现“Reporter 已英文化、真实阶段链路仍中文”的漏网模式。

- **建议**
  - 为 `clone` / `execute-install` / `match-rules` / `resolve-source` / `services/git` 的关键错误与 warn 路径补充 `setLanguage('en')` 断言。
  - 对已有中文断言，按 Story 5.5a 的 AC 契约改写为“双语可切换”或英文场景专测，而不是继续固化中文。

## 验证摘要

- `npm test` ✅（`649 / 649`）
- `npm run lint` ✅
- `npm run build` ✅
- 定向复核：
  - `node dist/index.js --help` ✅ `init` 子命令帮助文案已为英文
  - `node dist/index.js init --help` ✅ `init` 子命令描述已为英文
  - 代码走查确认上述 `clone` / `execute-install` / `match-rules` / `resolve-source` / `services/git` / `fs-utils` 位置仍存在运行时中文输出

## 通过项

- `init` 的语言预加载与 `--help` 文案问题已修复。
- `index.ts` 的非法语言 / 语言加载失败提示已接入 `msg('index.*')`。
- `config.ts`、`path-resolver.ts`、`conflict-resolver.ts`、`detect-tools.ts`、多数 `fs-utils.ts` 的 fix 文本已英文化。
- `reporter.ts` 的标题、统计行、scope、Fix 标签英文化持续有效。
- 当前仓库的测试、lint、build 全部通过。

## 结论

- **结论：不通过（Changes Requested）**
- **阻塞项**：
  - `clone` / `execute-install` / `match-rules` / `resolve-source` / `services/git` / `fs-utils` 仍有真实用户可见中文输出
  - 阶段级测试尚未编码这些模块的英文输出契约
- **建议**：
  - 先完成上述运行时字符串的全量 i18n 收口；
  - 再补齐对应英文场景测试；
  - 完成后进入下一轮 CR。
