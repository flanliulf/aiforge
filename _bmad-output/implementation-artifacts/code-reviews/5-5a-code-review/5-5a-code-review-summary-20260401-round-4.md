---
Story: 5-5a
Round: 4
Date: 2026-04-01
Model Used: GPT-5.4 (model ID: gpt-5.4)
Type: Code Review Summary
---

## 审查结论

本轮为复审。Round 3 指出的绝大多数运行时 i18n 缺口已修复：`npm test` ✅ `655/655`、`npm run lint` ✅、`npm run build` ✅，`node dist/index.js --help` 与 `node dist/index.js init --help` 也均为英文；`clone`、`resolve-source`、`execute-install` 已新增部分英文场景测试。但复核后仍确认 2 处真实运行时中文输出残留，以及 1 处对应测试缺口，因此 Story 5.5a 仍未满足“英文配置下所有用户可见输出为英文 / 所有用户可见字符串统一经 `msg()` 获取”的闭环要求，本轮仍不建议通过。

## 上轮问题回顾

### 已修复

1. Round 3 中大部分模块级 i18n 缺口已收口
   - `src/stages/match-rules.ts:44-50` 已改用 `msg('matchRules.*')`。
   - `src/stages/execute-install.ts:271-284` 的 zero-results 诊断已改用 `msg('executeInstall.*')`。
   - `src/index.ts` / `src/commands/init.ts` 的帮助文案与语言加载行为保持正确。

2. 英文契约测试已有明显补强
   - `tests/stages/clone.test.ts:726-775` 已覆盖英文模式下的 `AUTH_FAILED` / `CLONE_FAILED` / `PULL_FAILED`。
   - `tests/stages/resolve-source.test.ts:349-370` 已覆盖英文模式下的 phase 文案与 `NO_REPO`。
   - `tests/stages/execute-install.test.ts:1600-1630` 已覆盖英文模式下的 zero-results 诊断。

3. CLI 帮助文案已稳定为英文
   - `node dist/index.js --help` → `init                    Initialize aiforge configuration`
   - `node dist/index.js init --help` → `Initialize aiforge configuration`

### 本轮判定为可接受，不记为阻塞

- `src/commands/init.ts` 中初始化前的语言选择提示仍为双语（如 `界面语言 / Display language`、`中文` / `English`）。该文案发生在“用户尚未选定界面语言”之前，属于可接受的启动引导，不构成 AC #1 / #4 违例。

## 新发现

### 1. [高][上轮遗留] `execute-install` 仍有两条真实 `warn` 路径直接输出中文，英文模式下会出现中英混杂

- **证据**
  - `src/stages/execute-install.ts:148-152`
    - `reporter.warn(\`⚠️ 断链: ${item.targetPath} → 目标文件不存在\`)`
  - `src/stages/execute-install.ts:372-374`
    - `reporter.warn(\`⚠️ flatten: ${basename(srcDir)}/ 中未找到 ${mainFile}，跳过\`)`
  - 与此同时，`src/core/messages.ts:629-637` 仅覆盖了 zero-results 诊断键，尚无对应 broken-link / flatten-missing-main-file 的消息键。

- **影响**
  - 这两条路径都属于真实用户可见的运行时警告，且由 `reporter.warn()` 直接输出。
  - 一旦 `language = en` 且命中断链复检或 flatten 缺主文件场景，CLI 仍会输出中文，直接违背 AC #1 / #3 / #4。

- **建议**
  - 在 `src/core/messages.ts` 的 `executeInstall` namespace 中新增对应键，并在上述两处分支统一改为 `msg()`。
  - 该类 warn 分支不要保留“最后一点硬编码中文”，否则会反复漏出混杂输出。

### 2. [中][上轮遗留] `clone` 的非-`Error` fallback 仍直接回落到中文字符串，绕过了现有 `clone.unknownError` 英文消息键

- **证据**
  - `src/stages/clone.ts:241`
    - `cleanupWarning = rmError instanceof Error ? rmError.message : '未知错误'`
  - `src/stages/clone.ts:244`
    - `const rawMessage = error instanceof Error ? error.message : '未知网络错误'`
  - `src/stages/clone.ts:309`
    - `const rawMessage = error instanceof Error ? error.message : '未知错误'`
  - `src/core/messages.ts:609-623` 已存在 `clone.unknownError = 'Unknown error'`，但上述 fallback 分支没有使用它；同时也没有 `unknownNetworkError` 英文键。

- **影响**
  - 当底层抛出的并非 `Error` 实例时，英文模式下仍会把最终错误细节拼成中文 fallback。
  - 这类分支虽然不常见，但一旦触发，会直接破坏“英文配置下所有用户可见输出为英文”的故事契约。

- **建议**
  - 将 fallback 全部收敛到 `msg('clone.unknownError')`，并按需要补充 `unknownNetworkError` 键；不要继续在阶段代码里写死 `'未知错误'` / `'未知网络错误'`。

### 3. [中][新] 剩余残留分支的英文契约测试仍未覆盖，现有门禁不足以防止回归

- **证据**
  - `tests/stages/execute-install.test.ts:864-957` 的断链复检测试仍只断言 `reporter.warn` 包含 `断链`，未验证 `language = en`。
  - 针对 `flatten` 缺主文件 warn，未检索到英文场景断言。
  - `tests/stages/clone.test.ts` 中未检索到 `Unknown error` / `未知错误` / `未知网络错误` 相关 fallback 场景测试。
  - `tests/stages/match-rules.test.ts` / `tests/integration/dry-run.test.ts` 仍未看到显式 `setLanguage('en')` 的 `LINK_PROJECT_REJECTED` 英文断言。

- **影响**
  - 这正是本轮两个残留问题仍能穿过 `655/655` 测试门禁的原因：主路径已有英文测试，但边缘 fallback / warn 路径尚未被英文契约锁住。
  - 如果不补这些测试，后续再做 i18n 清理时仍可能重复出现“主路径已英文化、边缘分支仍中文”的漏网问题。

- **建议**
  - 至少补齐以下英文测试：
    - `execute-install`：broken-link warn、flatten missing-main-file warn
    - `clone`：non-`Error` fallback / cleanup warning fallback
    - `match-rules`：`LINK_PROJECT_REJECTED` in `language = en`

## 验证摘要

- `npm test` ✅（`655 / 655`）
- `npm run lint` ✅
- `npm run build` ✅
- 定向复核：
  - `node dist/index.js --help` ✅ 英文
  - `node dist/index.js init --help` ✅ 英文
  - `tests/stages/clone.test.ts` / `resolve-source.test.ts` / `execute-install.test.ts` 已新增部分英文场景
  - 代码走查确认 `execute-install` 与 `clone` 仍留有少量硬编码中文 fallback / warn

## 通过项

- `init` 帮助文案、语言预加载、以及 `index.ts` 的语言回退提示保持正确。
- `match-rules` / `resolve-source` / `services/git` / 多数 `fs-utils` 的上轮 i18n 问题本轮未再复现为阻塞项。
- `execute-install` 的 zero-results 诊断已完成国际化并有英文测试。
- `clone` 的主错误路径（认证失败 / clone 失败 / pull 失败）已具备英文测试。
- 默认中文、配置英文、非法语言回退这三条主线能力整体已经成型；当前问题已收敛到少量边缘分支。

## 结论

- **结论：不通过（Changes Requested）**
- **阻塞项**
  - `execute-install` 的 broken-link / flatten warn 仍是硬编码中文
  - `clone` 的 non-`Error` fallback 仍会回落中文
- **建议**
  - 先完成上述 2 处运行时字符串收口；
  - 同步补齐对应英文测试；
  - 完成后再进入下一轮 CR，届时有较大概率可以收敛到通过。
