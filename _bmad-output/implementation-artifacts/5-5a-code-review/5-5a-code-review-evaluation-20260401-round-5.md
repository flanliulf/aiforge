---
Story: 5-5a
Round: 5
Date: 2026-04-01
Model Used: Claude Sonnet 4 (claude-sonnet-4-20250514)
Review Source: 5-5a-code-review-summary-20260401-round-5.md
Review Model: GPT-5.4 (model ID: gpt-5.4)
Type: Code Review Evaluation
---

## 评估总结

对 Story 5-5a 的第 5 轮 CR 代码审查结果（复审）进行逐条评估。审查共提出 3 项新发现：reporter 量词中文（高）、detect-tools fix 中文（高）、fs-utils 多处 fix 中文（高）。经独立代码验证，问题均真实存在，但严重性需差异化评估。评估结论如下。

---

## 上轮问题回顾确认

### Round 4 / Finding #1 — execute-install 断链/flatten warn 硬编码中文：✅ 已修复

经代码验证：
- `src/stages/execute-install.ts:148-152` 已改为 `msg('executeInstall.brokenLink')`。✅ 确认
- `src/stages/execute-install.ts:374-377` 已改为 `msg('executeInstall.flattenMissingMainFile')`。✅ 确认
- `tests/stages/execute-install.test.ts` 已新增英文场景断言。✅ 确认

### Round 4 / Finding #2 — clone 非-Error fallback 中文：✅ 已修复

经代码验证：
- `src/stages/clone.ts:241,244,309` 已分别改用 `msg('clone.unknownError')` / `msg('clone.unknownNetworkError')`。✅ 确认
- `tests/stages/clone.test.ts:777-807` 已新增英文场景断言。✅ 确认

### Round 4 / Finding #3 — 边缘路径英文契约测试缺口：✅ 已修复

- clone / execute-install / match-rules 英文契约测试均已补齐。✅ 确认
- 全量测试 661/661 通过。✅ 确认

### 历史 CR TODO（非阻塞）

无。

---

## 发现 #1 评估

### 审查原文

> **[高][新] `reporter` 计划输出标题仍硬编码中文量词 `项`，英文模式下会出现中英混杂**

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

经独立代码验证：

- `src/core/reporter.ts:139`：`process.stdout.write(chalk.bold(\`\\n🔧 ${displayName} (${items.length} 项)\\n\`))` — 硬编码中文量词 `项`。✅ 确认
- `tests/core/reporter.test.ts:1106-1134`：英文模式 `reportPlan` 测试断言了 `dry-run`、`global`、`Plan:` 等关键词，但**没有断言量词是否为英文**，也没有 `expect(allOutput).not.toContain('项')` 这类负面断言。✅ 确认
- `tests/core/reporter.test.ts:523,530,531`：中文模式测试直接断言 `'(3 项)'` / `'(2 项)'` / `'(1 项)'`。✅ 确认

**严重性判断：合理**

`reportPlan()` 是 dry-run 模式下的核心用户界面输出，每次使用 `--dry-run` 都会触发。这不是边缘路径，而是高频路径。英文模式下显示 `GitHub Copilot (3 项)` 属于显著的中英混杂。判为高严重性合理。

**修复建议：可行**

将量词抽到 `msg()` 键中（如 `msg('reporter.itemCount').replace('{count}', ...)`），修改量极小（1 行源码 + 消息键 + 测试断言更新）。

**误报评估：非误报**

---

## 发现 #2 评估

### 审查原文

> **[高][新] `detect-tools` 的 `UNKNOWN_TOOL` fix 数组仍写死中文，英文模式下错误修复建议不会切换**

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

经独立代码验证：

- `src/stages/detect-tools.ts:152-155`：fix 数组第一条为 `` `支持的工具: ${TOOL_DEFINITIONS.map((t) => t.id).join(', ')}` `` — 硬编码中文 `支持的工具`。✅ 确认
- `message`（第 147 行）和 `why`（第 151 行）已使用 `msg('detectTools.unknownTool')` 和 `msg('detectTools.unknownToolWhy')`，仅 fix 数组遗漏。✅ 确认
- `tests/stages/detect-tools.test.ts:192-197`：UNKNOWN_TOOL 测试仅断言错误码和 severity，未检查 fix 文案语言，无 `setLanguage('en')` 场景。✅ 确认

**严重性判断：合理**

`--tools` 是用户可能传入的命令行参数，传入无效工具 ID 时的错误提示属于真实用户可见输出路径。fix 中 `支持的工具: ...` 是最重要的引导信息，英文模式下输出中文会让用户困惑。判为高严重性合理。

**修复建议：可行**

将 `支持的工具` 提示抽成 `detectTools.supportedTools` 消息键，修改量小。

**误报评估：非误报**

---

## 发现 #3 评估

### 审查原文

> **[高][新] `fs-utils` 多个 `AiforgeError.fix[]` 仍保留中文提示，英文模式下底层文件系统错误会继续输出中文**

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

经独立代码验证，以下 7 个函数的 fix 数组均为硬编码中文：

| 函数 | 行号 | fix 内容（中文） |
|------|------|----------------|
| `copyFile()` | :55 | `检查源文件是否存在: ...` / `检查目标目录是否可写: ...` |
| `copyDir()` | :75 | `检查源目录是否存在: ...` / `检查目标目录是否可写: ...` |
| `createSymlink()` | :107 | `检查 linkPath 的父目录是否可写` / `检查 target 路径是否有效: ...` |
| `backupFile()` | :130 | `检查源文件是否存在: ...` / `检查目录是否可写: ...` |
| `backupDir()` | :153 | `检查源目录是否存在: ...` / `检查父目录是否可写: ...` |
| `ensureDir()` | :178 | `检查父目录是否可写: ...` / `检查路径是否与已存在的文件冲突` |
| `fileHash()` | :228 | `检查文件是否存在: ...` / `检查文件是否可读` |

所有 7 个函数的 `message` 和 `why` 字段已使用 `msg('fsUtils.*')` 调用。✅ 确认仅 fix 数组遗漏。

`tests/services/fs-utils.test.ts` 中仅有错误码断言（如 `FILE_COPY_FAILED`），未见任何 `setLanguage('en')` 或 fix 文案语言断言。✅ 确认

**严重性判断：偏高，建议分层处理**

审查将这 7 处统一判为 [高]。评估认为应区分对待：

1. **`copyFile` / `copyDir` / `createSymlink`**：这三个函数是安装主路径的底层操作，在文件复制失败、目录复制失败、链接创建失败时直接面向用户。触发频率相对较高，判为 P1 合理。
2. **`backupFile` / `backupDir`**：备份操作仅在文件冲突时触发，属于中等频率路径。但 fix 修改模式与上述完全一致，统一处理更合理。
3. **`ensureDir` / `fileHash`**：`ensureDir` 使用 `recursive: true`，几乎不会失败；`fileHash` 失败场景也较少见。但鉴于修改模式统一，建议一并处理。

综合考虑：这 7 个函数修改模式完全一致（fix 数组 → `msg()` 键），应在一次批量修改中全部完成，不宜拆分。整体判为 P1 合理。

**修复建议：可行**

在 `messages.ts` 的 `fsUtils` namespace 中批量新增 fix 消息键（如 `fixCheckSourceFile`、`fixCheckTargetDirWritable` 等），然后逐个替换。部分 fix 提示内容高度相似（如 `检查源文件是否存在` / `检查源目录是否存在`），可考虑复用同一消息键并通过占位符区分。

**误报评估：非误报**

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | `reporter.ts` 计划标题硬编码中文量词 `项` | [高] | **P1** | 高频 dry-run 路径，1 行源码修改 |
| 2 | `detect-tools.ts` UNKNOWN_TOOL fix 数组中文 | [高] | **P1** | 真实错误路径，1 处 fix 修改 |
| 3 | `fs-utils.ts` 7 个函数 fix 数组中文（共 14 条） | [高] | **P1** | 公共底层依赖，批量修改模式统一 |

### 建议纳入 CR TODO 跟踪（非阻塞）

无新增 CR TODO。

### 评估决定

- **发现 #1（reporter 量词中文）**：确认有效，P1 阻塞交付。需将 `(${items.length} 项)` 中的量词 `项` 抽到 `msg()` 键中（或整个计数表达式模板化），并在英文测试中补充 `expect(allOutput).not.toContain('项')` 断言。
- **发现 #2（detect-tools UNKNOWN_TOOL fix 中文）**：确认有效，P1 阻塞交付。需将 `支持的工具` 提示抽成 `detectTools` namespace 下的消息键，并补充英文场景测试。
- **发现 #3（fs-utils 7 处 fix 数组中文）**：确认有效，P1 阻塞交付。建议批量处理——在 `fsUtils` namespace 中新增 fix 消息键（可通过占位符复用），一次性替换全部 14 条中文 fix 提示，并至少补 1-2 组英文 fix 断言。

**整体进展评估**：Story 5-5a 的 i18n 主路径已基本完成，剩余问题集中在 fix 数组层面。本轮 3 项发现的修改模式高度统一（fix 中文 → `msg()` 键），预计一轮批量修改即可收敛到通过。

---

## 修复执行记录

### 修复执行记录
- **Date**: 2026-04-01
- **Model Used**: Claude Sonnet 4 (claude-sonnet-4-20250514)
- **Fix Items**: 3

---

### Fix #1 — reporter.ts 量词 `项` 硬编码中文

**问题**：`src/core/reporter.ts:139` — `reportPlan()` 工具标题中 `(${items.length} 项)` 硬编码中文量词

**修复方案**：
1. 在 `src/core/messages.ts` 的 `MessageSet.reporter` 接口新增 `itemCount: string` 字段
2. 在 zh-CN 消息集新增 `itemCount: '{count} 项'`
3. 在 en 消息集新增 `itemCount: '{count} items'`
4. 将 `reporter.ts:139` 的 `${items.length} 项` 替换为 `${msg('reporter.itemCount').replace('{count}', String(items.length))}`

**修改文件**：
- `src/core/messages.ts` — 类型定义 + 双语消息键
- `src/core/reporter.ts` — 替换硬编码量词

**测试**：
- `tests/core/reporter.test.ts` — 在 `TtyReporter: setLanguage("en") 后 reportPlan 输出英文标题` 测试中追加量词断言：`expect(allOutput).toContain('items')` + `expect(allOutput).not.toContain('项')`

**修复状态**：✅ 完成

---

### Fix #2 — detect-tools.ts UNKNOWN_TOOL fix 数组中文

**问题**：`src/stages/detect-tools.ts:153` — UNKNOWN_TOOL 错误的 fix 数组第一条 `` `支持的工具: ${...}` `` 硬编码中文

**修复方案**：
1. 在 `src/core/messages.ts` 的 `MessageSet.detectTools` 接口新增 `fixSupportedTools: string` 字段
2. 在 zh-CN 消息集新增 `fixSupportedTools: '支持的工具: {tools}'`
3. 在 en 消息集新增 `fixSupportedTools: 'Supported tools: {tools}'`
4. 将 `detect-tools.ts:153` 的硬编码替换为 `msg('detectTools.fixSupportedTools').replace('{tools}', ...)`

**修改文件**：
- `src/core/messages.ts` — 类型定义 + 双语消息键
- `src/stages/detect-tools.ts` — 替换 fix 数组第一条

**测试**：
- `tests/stages/detect-tools.test.ts` — 新增 `setLanguage("en") 后 UNKNOWN_TOOL fix 包含英文 "Supported tools"` 测试，断言 `fix[0]` 含 `Supported tools` 且不含 `支持的工具`

**修复状态**：✅ 完成

---

### Fix #3 — fs-utils.ts 7 个函数 fix 数组中文（14 条）

**问题**：`src/services/fs-utils.ts` 中 7 个函数（copyFile、copyDir、createSymlink、backupFile、backupDir、ensureDir、fileHash）的 fix 数组共 14 条硬编码中文提示

**修复方案**：
1. 在 `src/core/messages.ts` 的 `MessageSet.fsUtils` 接口新增 9 个 fix 消息键字段：
   - `fixCheckSourceFile` / `fixCheckTargetDirWritable` / `fixCheckSourceDir` / `fixCheckLinkParentWritable` / `fixCheckTargetValid` / `fixCheckDirWritable` / `fixCheckPathConflict` / `fixCheckFileExists` / `fixCheckFileReadable`
2. zh-CN 和 en 消息集分别添加对应翻译
3. 逐一替换 7 个函数中的 14 条硬编码 fix 为 `msg('fsUtils.fixXxx').replace('{...}', ...)` 调用

**修改文件**：
- `src/core/messages.ts` — 类型定义 + 18 条双语消息键（9 zh-CN + 9 en）
- `src/services/fs-utils.ts` — 7 个函数的 fix 数组全部替换

**测试**：
- `tests/services/fs-utils.test.ts` — 新增 `英文模式 fix 数组` describe 块，包含 2 个测试：
  1. `setLanguage("en") 后 copyFile 错误 fix 包含英文提示` — 断言 fix[0]/fix[1] 为英文
  2. `setLanguage("en") 后 ensureDir 错误 fix 包含英文提示` — 断言 fix[0]/fix[1] 为英文

**修复状态**：✅ 完成

---

### 质量门禁验证

| 验证项 | 结果 |
|--------|------|
| `npm test` | ✅ 664/664 通过（原 661 + 本次新增 3 条英文 fix 断言测试） |
| `npm run lint` | ✅ ESLint 通过（Prettier warn 为 .agent/.gemini 目录历史问题，非本次修改引入） |
| `npm run build` | ✅ Build 成功 |
| `npx prettier --write` | ✅ 全部已格式化 |

### 修改文件清单

| 文件 | 变更类型 |
|------|---------|
| `src/core/messages.ts` | 新增 `reporter.itemCount` / `detectTools.fixSupportedTools` / `fsUtils.fixCheck*` 等 11 个消息键（类型 + zh-CN + en） |
| `src/core/reporter.ts` | `reportPlan()` 量词 `项` → `msg('reporter.itemCount')` |
| `src/stages/detect-tools.ts` | UNKNOWN_TOOL fix[0] → `msg('detectTools.fixSupportedTools')` |
| `src/services/fs-utils.ts` | 7 函数共 14 条 fix → `msg('fsUtils.fixCheck*')` |
| `tests/core/reporter.test.ts` | 英文 reportPlan 测试追加量词断言 |
| `tests/stages/detect-tools.test.ts` | 新增英文 UNKNOWN_TOOL fix 断言测试 |
| `tests/services/fs-utils.test.ts` | 新增英文 fix 数组断言测试（2 条） |
