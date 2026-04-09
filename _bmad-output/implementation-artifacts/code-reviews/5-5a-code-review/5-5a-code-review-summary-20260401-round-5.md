---
Story: 5-5a
Round: 5
Date: 2026-04-01
Model Used: GPT-5.4 (model ID: gpt-5.4)
Type: Code Review Summary
---

## 审查结论

本轮为复审。Round 4 评估中列出的两项主要阻塞点已经修复：`execute-install` 的 broken-link / flatten warn 已接入 `msg()`，`clone` 的 non-`Error` fallback 也已改为走消息键；对应英文测试已补齐。当前 `npm test` ✅ `661/661`、`npm run lint` ✅、`npm run build` ✅，根命令与 `init` 的帮助文案也保持英文。但本轮继续做残余中文扫描与运行时上下文复核时，又确认出 3 组**新的真实用户可见字符串残留**，因此 Story 5.5a 仍未达到 AC #1 / #3 / #4 的完全闭环，本轮仍不建议通过。

## 上轮问题回顾

### 已修复

1. Round 4 / Finding #1 — `execute-install` 的断链 warn / flatten warn 硬编码中文
   - `src/stages/execute-install.ts:148-152` 已改为 `msg('executeInstall.brokenLink')`。
   - `src/stages/execute-install.ts:374-377` 已改为 `msg('executeInstall.flattenMissingMainFile')`。
   - `src/core/messages.ts:411-421,636-646` 已补齐中英双语键。
   - **验证结果**：`tests/stages/execute-install.test.ts:1686-1690+` 已新增英文断言，`reporter.warn` 可输出 `Broken link` / `not found ... skipping`。

2. Round 4 / Finding #2 — `clone` 的 non-`Error` fallback 仍会回落中文
   - `src/stages/clone.ts:241,244,309` 已分别改用 `msg('clone.unknownError')` / `msg('clone.unknownNetworkError')`。
   - `src/core/messages.ts:391-405,615-630` 已新增 `unknownNetworkError` 双语键。
   - **验证结果**：`tests/stages/clone.test.ts:777-807` 已新增英文场景断言，非 `Error` throw 时 `why` 为 `Unknown network error` / `Unknown error`。

3. Round 4 / Finding #3 — 剩余边缘路径英文契约测试缺口
   - `tests/stages/execute-install.test.ts` 已新增 broken-link / flatten missing-main-file 的英文测试。
   - `tests/stages/clone.test.ts` 已新增 non-`Error` fallback 英文测试。
   - `tests/stages/match-rules.test.ts:570-608` 已新增 `LINK_PROJECT_REJECTED` 的中英文双语测试。
   - **验证结果**：全量测试提升到 `661/661` 通过。

### 仍为非阻塞待办

无。

## 新发现

### 1. [高][新] `reporter` 计划输出标题仍硬编码中文量词 `项`，英文模式下会出现中英混杂

- **证据**
  - `src/core/reporter.ts:135-139`
    - `process.stdout.write(chalk.bold(\`\\n🔧 ${displayName} (${items.length} 项)\\n\`))`
  - `tests/core/reporter.test.ts:1106-1134` 虽然新增了 `setLanguage('en')` 下的 `reportPlan` 测试，但仅断言了 `dry-run` / `global` / `Plan:`，**没有断言标题计数量词是否为英文**。
  - 现有中文模式测试仍直接断言 `'(3 项)'` / `'(2 项)'` / `'(1 项)'`（`tests/core/reporter.test.ts:523,530,531`）。

- **影响**
  - `reportPlan()` 是高频用户可见输出。即使 `language = en`，工具分组标题仍会显示 `GitHub Copilot (1 项)` 这类中英混杂字符串。
  - 这直接违反 AC #1 / #3 / #4。

- **建议**
  - 将标题中的计数量词抽到 `msg()` / 模板键中，例如 `{count} items`。
  - 为 `reportPlan()` 的英文模式补充显式断言，确保不再出现 `项`。

### 2. [高][新] `detect-tools` 的 `UNKNOWN_TOOL` fix 数组仍写死中文，英文模式下错误修复建议不会切换

- **证据**
  - `src/stages/detect-tools.ts:146-155`
    - `fix = [\`支持的工具: ...\`, \`npx aiforge --tools ...\`]`
  - 这里的第 1 条 fix 是直接面向用户的错误修复建议，未通过 `msg('detectTools.*')` 获取。
  - `tests/stages/detect-tools.test.ts` 仅检索到 `UNKNOWN_TOOL` 抛错测试，未见 `setLanguage('en')` 的 fix 文案断言。

- **影响**
  - 当用户在英文模式下传入非法 `--tools` 值时，主错误 message/why 虽可本地化，但 fix 建议仍会输出中文 `支持的工具: ...`。
  - 这属于真实错误链路中的用户可见字符串，违反 AC #3，并导致 AC #1 / #4 在参数错误路径上失效。

- **建议**
  - 将“支持的工具”提示抽成 `detectTools` namespace 下的消息键，并补一条英文测试覆盖 `UNKNOWN_TOOL` 的 fix 输出。

### 3. [高][新] `fs-utils` 多个 `AiforgeError.fix[]` 仍保留中文提示，英文模式下底层文件系统错误会继续输出中文

- **证据**
  - `src/services/fs-utils.ts:49-56`
    - `copyFile()` 的 fix 数组仍为 `检查源文件是否存在...` / `检查目标目录是否可写...`
  - `src/services/fs-utils.ts:69-76`
    - `copyDir()` 的 fix 数组仍为中文
  - `src/services/fs-utils.ts:101-108`
    - `createSymlink()` 的 fix 数组仍为中文
  - `src/services/fs-utils.ts:124-130`
    - `backupFile()` 的 fix 数组仍为中文
  - `src/services/fs-utils.ts:148-154`
    - `backupDir()` 的 fix 数组仍为中文
  - `src/services/fs-utils.ts:172-178`
    - `ensureDir()` 的 fix 数组仍为中文
  - `src/services/fs-utils.ts:222-228`
    - `fileHash()` 的 fix 数组仍为中文
  - `src/core/messages.ts:338-374,559-592` 已对 `message` / `why` 与部分安全类 fix 做了双语化，但**上述基础文件操作 fix 提示尚未抽取**。
  - `tests/services/fs-utils.test.ts` 只看到错误码断言（如 `FILE_COPY_FAILED` / `DIR_COPY_FAILED` / `SYMLINK_CREATE_FAILED` 等），未见英文模式 fix 文案覆盖。

- **影响**
  - `fs-utils` 是多个安装/备份/校验路径的底层公共依赖。一旦英文模式下触发复制、备份、建链、建目录、hash 等失败，CLI 会继续输出中文 fix 建议。
  - 这不是孤立边缘点，而是**横跨多个阶段的公共运行时链路**，因此对 Story 5.5a 的 AC #3 构成持续阻塞。

- **建议**
  - 将这些 fix 提示统一收口到 `src/core/messages.ts` 的 `fsUtils` namespace。
  - 补充至少一组 `setLanguage('en')` 的 `fs-utils` 错误断言，防止后续再次遗漏公共依赖层。

## 验证摘要

- `npm test` ✅（`661 / 661`）
- `npm run lint` ✅
- `npm run build` ✅
- 额外复核：
  - `node dist/index.js --help` ✅ 英文
  - `node dist/index.js init --help` ✅ 英文
  - `execute-install` / `clone` / `match-rules` 的 Round 4 修复项已通过代码走查与测试确认持续有效
  - 进一步定向扫描确认 `reporter.ts`、`detect-tools.ts`、`fs-utils.ts` 仍残留真实运行时中文字符串

## 通过项

- Round 4 指出的 `execute-install` 与 `clone` 残留问题已全部修复，并有英文测试守护。
- `match-rules` 英文契约测试已补齐。
- `init` 帮助文案、语言预加载、`index.ts` 的语言回退提示持续正确。
- 当前测试、lint、build 门禁全部通过，说明本轮修改未引入回归。

## 结论

- **结论：不通过（Changes Requested）**
- **阻塞项**
  - `src/core/reporter.ts` 计划标题仍硬编码中文量词 `项`
  - `src/stages/detect-tools.ts` 的 `UNKNOWN_TOOL` fix 文案仍含中文
  - `src/services/fs-utils.ts` 多个 `fix[]` 仍为中文
- **建议**
  - 先完成上述 3 组残留的统一 `msg()` 收口；
  - 同步补齐 `reporter` / `detect-tools` / `fs-utils` 的英文契约测试；
  - 再进入下一轮 CR。
