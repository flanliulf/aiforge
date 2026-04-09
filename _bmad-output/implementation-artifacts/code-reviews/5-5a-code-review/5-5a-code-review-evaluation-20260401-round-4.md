---
Story: 5-5a
Round: 4
Date: 2026-04-01
Model Used: Claude Sonnet 4 (claude-sonnet-4-20250514)
Review Source: 5-5a-code-review-summary-20260401-round-4.md
Review Model: GPT-5.4 (model ID: gpt-5.4)
Type: Code Review Evaluation
---

## 评估总结

对 Story 5-5a 的第 4 轮 CR 代码审查结果（复审）进行逐条评估。审查共提出 3 项发现：2 项运行时中文残留（1 高 + 1 中）和 1 项对应测试缺口（中）。经独立代码验证，问题范围已显著收敛至少量边缘分支。评估结论如下。

---

## 上轮问题回顾确认

### Round 3 / Finding #1 — 多模块运行时路径 i18n 全量收口：✅ 大部分已修复

经代码验证：
- `src/stages/match-rules.ts:44-50` 已改用 `msg('matchRules.*')`。✅ 确认
- `src/stages/execute-install.ts:271-284` zero-results 诊断已改用 `msg('executeInstall.*')`。✅ 确认
- `clone.ts` 主错误路径（AUTH_FAILED/CLONE_FAILED/PULL_FAILED）的 message/why 已用 `msg()`。✅ 确认
- `resolve-source.ts`、`git.ts`、`fs-utils.ts` 的上轮问题本轮未再复现为阻塞项。✅ 确认

**残留**：`execute-install.ts` 的断链 warn / flatten warn 两处、`clone.ts` 的非-Error fallback 三处仍有中文（详见新发现）。

### Round 3 / Finding #2 — 阶段级测试英文场景补强：✅ 已有明显改善

- `tests/stages/clone.test.ts` 新增英文模式 AUTH_FAILED / CLONE_FAILED / PULL_FAILED 测试。✅ 确认
- `tests/stages/resolve-source.test.ts` 新增英文模式 phase 文案 + NO_REPO 测试。✅ 确认
- `tests/stages/execute-install.test.ts` 新增英文模式 zero-results 诊断测试。✅ 确认

### init 双语引导提示判定：同意可接受

`init` 命令中语言选择步骤的双语提示（如 `界面语言 / Display language`）发生在用户尚未选定语言之前，不构成 AC #1/#4 违例。审查判定合理。

### 历史 CR TODO（非阻塞）

| # | 发现 | 状态 | 评估意见 |
|---|------|------|---------|
| R3-#2 | 阶段级测试固化中文契约 | CR TODO / 非阻塞 | 主路径已补强，残余边缘分支见本轮发现 #3 |

---

## 发现 #1 评估

### 审查原文

> **[高][上轮遗留] `execute-install` 仍有两条真实 `warn` 路径直接输出中文，英文模式下会出现中英混杂**

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

经独立代码验证：

- `src/stages/execute-install.ts:152`：`reporter.warn(\`⚠️ 断链: ${item.targetPath} → 目标文件不存在\`)` — 硬编码中文 `断链` 和 `目标文件不存在`。✅ 确认
- `src/stages/execute-install.ts:374`：`reporter.warn(\`⚠️ flatten: ${basename(srcDir)}/ 中未找到 ${mainFile}，跳过\`)` — 硬编码中文 `中未找到` 和 `跳过`。✅ 确认
- `src/core/messages.ts` 中 `executeInstall` namespace 搜索不到 `断链` / `brokenLink` / `flatten` 相关消息键。✅ 确认

这两条路径通过 `reporter.warn()` 直接面向用户输出。当 `language=en` 且命中断链复检或 flatten 缺主文件场景时，CLI 会输出中文，违反 AC #1/#3/#4。

**严重性判断：合理**

虽然这两条路径是边缘场景（断链复检、flatten 缺主文件），但它们都是设计好的用户警告路径，不是异常兜底。实际使用中，symlink 安装模式的断链检测是 Story 4.4 AC #5 的核心功能，触发概率不低。判为高严重性合理。

**修复建议：可行**

在 `messages.ts` 的 `executeInstall` namespace 中新增对应键并替换硬编码，方案清晰、修改量小、风险低。

**误报评估：非误报**

---

## 发现 #2 评估

### 审查原文

> **[中][上轮遗留] `clone` 的非-`Error` fallback 仍直接回落到中文字符串，绕过了现有 `clone.unknownError` 英文消息键**

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P2 优先级）

### 评估分析

**问题描述准确性：准确**

经独立代码验证：

- `src/stages/clone.ts:241`：`cleanupWarning = rmError instanceof Error ? rmError.message : '未知错误'` — 当 `rmError` 非 `Error` 实例时，硬编码中文 `'未知错误'` 会通过 `msg('clone.cleanupFailedWarning').replace('{msg}', cleanupWarning)` 嵌入 fix 数组输出给用户。✅ 确认
- `src/stages/clone.ts:244`：`const rawMessage = error instanceof Error ? error.message : '未知网络错误'` — 硬编码中文 `'未知网络错误'`，经 `sanitizeMessage()` 后作为 `safeMessage` 传给 `why` 参数。✅ 确认
- `src/stages/clone.ts:309`：`const rawMessage = error instanceof Error ? error.message : '未知错误'` — 同上逻辑，硬编码中文 `'未知错误'`。✅ 确认
- `src/core/messages.ts` 中已存在 `clone.unknownError = '未知错误'`（zh-CN）/ `'Unknown error'`（en），但上述三处均未使用 `msg('clone.unknownError')`。✅ 确认

**严重性判断：偏高**

审查判为 [中]，但考虑以下因素建议降为 P2：

1. **触发条件极为罕见**：这些 fallback 仅在底层抛出的非 `Error` 实例时触发。在 Node.js 生态中，`git` 库（simple-git）和 `fs.rm()` 几乎总是抛出 `Error` 实例，非 `Error` throw 属于极端异常（如手动 `throw 'string'`、`throw undefined`）
2. **输出位置为错误详情**：`cleanupWarning` 嵌入 fix 行的 `{msg}` 占位符中（`⚠️ cleanup failed: {msg}`），`rawMessage` 作为 `why` 参数——这些是错误附加信息，不是主要用户界面文案
3. **已有消息键可直接复用**：`msg('clone.unknownError')` 已存在，修复成本极低

建议降级为 P2 CR TODO——修复成本极低（3 处 `'未知错误'`/`'未知网络错误'` → `msg('clone.unknownError')`），但不应阻塞交付。

**修复建议：可行**

直接替换为 `msg('clone.unknownError')` 即可，还需补充 `clone.unknownNetworkError` 键以区分网络场景。

**误报评估：非误报**

---

## 发现 #3 评估

### 审查原文

> **[中][新] 剩余残留分支的英文契约测试仍未覆盖，现有门禁不足以防止回归**

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P2 优先级）

### 评估分析

**问题描述准确性：准确**

经独立验证：

- `tests/stages/execute-install.test.ts:864-957`：断链检测测试（共 4 个用例）全部断言中文 `'断链'`，无 `setLanguage('en')` 场景。✅ 确认
- `tests/stages/execute-install.test.ts`：搜索 `flatten.*missing` / `flatten.*跳过` 无英文场景断言。✅ 确认
- `tests/stages/clone.test.ts`：搜索 `未知错误` / `Unknown error` / `unknownError` 无匹配——即没有任何测试覆盖非-Error fallback 场景。✅ 确认
- `tests/stages/match-rules.test.ts`：搜索 `setLanguage` 无匹配——`LINK_PROJECT_REJECTED` 无英文场景测试。✅ 确认

审查分析逻辑正确：正是因为这些边缘路径缺少英文契约测试，655 个测试全绿却无法捕获残留中文。

**严重性判断：合理**

判为 [中] 合理。这些测试缺口是发现 #1/#2 修复的伴随工作，不应独立阻塞交付，但应在修复源码时同步补齐。

**修复建议：可行**

建议的补测范围清晰：断链 warn、flatten warn、非-Error fallback、LINK_PROJECT_REJECTED 的英文场景。工作量可控。

**误报评估：非误报**

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | `execute-install` 断链 warn / flatten warn 硬编码中文 | [高] | **P1** | 两条真实用户可见 warn 路径，修改量小但直接违反 AC |

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 2 | `clone` 非-Error fallback 硬编码中文 | [中] | **P2** | 触发条件极罕见，已有消息键可复用，建议伴随 #1 一并修复 |
| 3 | 边缘路径英文契约测试缺口 | [中] | **P2** | 应伴随 #1/#2 修复同步补齐测试 |

### 评估决定

- **发现 #1（execute-install 断链/flatten warn 中文残留）**：确认有效，P1 阻塞交付。需在 `messages.ts` 新增 `executeInstall.brokenLink` / `executeInstall.flattenMissingMainFile` 等键并替换硬编码。
- **发现 #2（clone 非-Error fallback 中文）**：确认有效但降级为 P2 CR TODO。触发条件极罕见，建议伴随 #1 一并修复——将 3 处 `'未知错误'`/`'未知网络错误'` 替换为 `msg('clone.unknownError')`，补充 `unknownNetworkError` 键。
- **发现 #3（边缘路径测试缺口）**：确认有效但降级为 P2 CR TODO。应伴随源码修复同步补齐断链/flatten/fallback 的英文场景测试。

---

## 修复执行记录

### 修复执行记录
- **Date**: 2026-04-01
- **Model Used**: Claude Sonnet 4 (claude-sonnet-4-20250514)
- **Fix Items**: 3 项（P1 × 1，P2 × 2）

### 修复项 #1（P1）：execute-install 断链/flatten warn 接入 `msg()`

**修改文件：**

| 文件 | 修改内容 |
|------|---------|
| `src/core/messages.ts` | 在 `executeInstall` namespace 新增 `brokenLink`（含 `{targetPath}` 占位）和 `flattenMissingMainFile`（含 `{srcDir}` / `{mainFile}` 占位）双语键；在 `clone` namespace 新增 `unknownNetworkError` 双语键 |
| `src/stages/execute-install.ts` | `checkBrokenLinks()` Line 152：`reporter.warn(...)` 改用 `msg('executeInstall.brokenLink').replace('{targetPath}', ...)` |
| `src/stages/execute-install.ts` | `executeInstall()` flatten 分支 Line 374：`reporter.warn(...)` 改用 `msg('executeInstall.flattenMissingMainFile').replace('{srcDir}', ...).replace('{mainFile}', ...)` |

### 修复项 #2（P2）：clone 非-Error fallback 接入 `msg()`

**修改文件：**

| 文件 | 修改内容 |
|------|---------|
| `src/core/messages.ts` | `clone.unknownNetworkError` 键已在修复 #1 中同步新增（zh-CN：`'未知网络错误'`，en：`'Unknown network error'`） |
| `src/stages/clone.ts` | `freshClone()` Line 241：`cleanupWarning` fallback `'未知错误'` → `msg('clone.unknownError')` |
| `src/stages/clone.ts` | `freshClone()` Line 244：`rawMessage` fallback `'未知网络错误'` → `msg('clone.unknownNetworkError')` |
| `src/stages/clone.ts` | `incrementalUpdate()` Line 309：`rawMessage` fallback `'未知错误'` → `msg('clone.unknownError')` |

### 修复项 #3（P2）：补充边缘路径英文契约测试

**修改文件：**

| 文件 | 新增测试 | 测试内容 |
|------|---------|---------|
| `tests/stages/execute-install.test.ts` | `broken link warn is in English when language=en` | 验证断链检测输出英文 `'Broken link'` |
| `tests/stages/execute-install.test.ts` | `flatten missing mainFile warn is in English when language=en` | 验证 flatten 缺主文件输出英文 `'not found'` |
| `tests/stages/clone.test.ts` | `CLONE_FAILED why is English "Unknown network error" when non-Error thrown and language=en` | 验证 freshClone 非-Error fallback 输出英文 |
| `tests/stages/clone.test.ts` | `PULL_FAILED why is English "Unknown error" when non-Error thrown and language=en` | 验证 incrementalUpdate 非-Error fallback 输出英文 |
| `tests/stages/match-rules.test.ts` | `LINK_PROJECT_REJECTED message is in Chinese when language=zh-CN (default)` | 验证默认中文场景 LINK_PROJECT_REJECTED |
| `tests/stages/match-rules.test.ts` | `LINK_PROJECT_REJECTED message is in English when language=en` | 验证英文场景 LINK_PROJECT_REJECTED |

**验证结果：**
- `npm run build` ✅ 编译通过
- `npm run lint` ✅ ESLint + Prettier 全绿
- `npm test` ✅ 661 tests passed（28 test files）

