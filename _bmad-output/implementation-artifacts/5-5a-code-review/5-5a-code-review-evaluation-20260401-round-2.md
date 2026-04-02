---
Story: 5-5a
Round: 2
Date: 2026-04-01
Model Used: Claude Sonnet 4 (claude-sonnet-4-20250514)
Review Source: 5-5a-code-review-summary-20260401-round-2.md
Review Model: GPT-5.4 (model ID: gpt-5.4)
Type: Code Review Evaluation
---

## 评估总结

对 Story 5-5a 的第 2 轮 CR 代码审查结果（复审）进行逐条评估。本轮审查确认了 Round 1 的主体修复进展，同时指出了 2 个遗留问题和 1 个新发现。经独立代码验证，审查发现全部准确，评估结论如下。

---

## 上轮问题回顾确认

### Round 1 / Finding #2（Reporter/Error i18n）：✅ 已修复

经代码验证：
- `src/core/reporter.ts` 已通过 `msg('reporter.*')` 输出统计行、plan 标题、scope 标签和 Fix 标签。
- `src/services/config.ts` 已使用 `msg('config.*')` 输出所有 AiforgeError（第 24、28、33、37、50、54、61、65 行）。
- `src/services/git.ts` 已使用 `msg('git.*')` 输出 AiforgeError。
- `src/stages/detect-tools.ts` 的 `emitDiagnostics` 和 AiforgeError 已部分接入 `msg('detectTools.*')`。
- `src/data/messages.ts` 已退化为兼容垫片，主实现在 `src/core/messages.ts`。

审查确认结论**同意**。

### Round 1 / Finding #3（测试覆盖补强）：✅ 已修复

经代码验证：
- `tests/commands/init.test.ts` 新增了 `setLanguage` spy 测试。
- `tests/core/reporter.test.ts` 新增了英文模式输出断言。

审查确认结论**同意**。

### 历史 CR TODO（非阻塞）

无上轮遗留 CR TODO。

---

## 发现 #1 评估（遗留 — Round 1 / Finding #1 后续）

### 审查原文

> **[遗留] `init` 在"语言选择之前"的用户可见路径仍未按既有语言/既定决策输出**

两个子问题：
- (a) `init.ts:55-64` 的"当前配置/是否修改"在 `setLanguage()` 之前输出，`config.language = 'en'` 时仍渲染中文。
- (b) `init.ts:29` 的 `.description(msg('init.descInit'))` 在模块加载时求值，fresh process 中 `currentLanguage` 始终为 `zh-CN`。

### 评估结论：⚠️ 部分有效 — 需要拆分处理

### 评估分析

**问题描述准确性：基本准确，但子问题 (a) 和 (b) 性质不同**

**(a) init 配置摘要在 setLanguage() 之前输出**

经代码验证：`init.ts:55-64` 在 `loadConfig()` 成功后立即输出 `msg('init.currentConfig')` / `msg('init.modifyPrompt')`，而 `setLanguage(language)` 发生在第 95 行。当 `existingConfig.language = 'en'` 时，配置摘要确实会以默认中文输出。

然而注意：`index.ts:51-60` 中主命令的 `.action()` handler **已经**在管道启动前从 config 读取 language 并调用 `setLanguage(config.language)`。但 `init` 子命令有独立的 `.action()` handler（`init.ts:30`），不走 `index.ts` 的语言预加载路径。

**这是真实问题。** 修复方案：在 `runInit()` 的 `loadConfig()` 成功后、输出配置摘要前，先调用 `setLanguage(existingConfig.language ?? 'zh-CN')`。

**(b) init 子命令 description 使用 msg() 在模块加载时求值**

经代码验证：`init.ts:29` — `.description(msg('init.descInit') || 'Initialize aiforge configuration')` 确实在模块加载（`registerInitCommand` 被调用）时求值。此时 `currentLanguage = 'zh-CN'`（默认值），所以描述始终为"初始化 aiforge 配置"。

但这里有一个 **`|| 'Initialize aiforge configuration'` fallback**，它不会生效，因为 `msg('init.descInit')` 在中文模式下返回非空字符串。

**然而**，Round 1 评估已确认决策："CLI help 仅英文，不国际化"。当前实现实际上是通过 `msg()` 动态获取 description，这与"仅英文"决策矛盾。正确做法是直接硬编码英文字符串，而不是用 `msg()`。

**严重性判断：(a) 合理 — 直接影响 AC #1/#4；(b) 偏高 — 属于已确认决策的执行偏差**

审查将两者合并为同一个遗留问题。(a) 是真实的功能缺陷（配置为英文时 init 摘要仍中文），影响 AC #1/#4。(b) 是决策执行偏差——description 应该直接用英文字符串而非 `msg()`。

**修复建议：可行**

- (a)：在 `runInit()` 的 `loadConfig()` 成功后添加 `setLanguage(existingConfig.language ?? 'zh-CN')`。
- (b)：将 `.description(msg('init.descInit') || ...)` 改为 `.description('Initialize aiforge configuration')`。

**误报评估：非误报**

---

## 发现 #2 评估（遗留 — Round 1 / Finding #2 后续）

### 审查原文

> **[遗留] 仍有多处 fix / 建议文本绕过 `msg()`，英文模式下会继续泄漏中文**

涉及文件：
- `src/services/config.ts:29,39-40,55,66` — fix 数组中文
- `src/services/fs-utils.ts:286,316` — fix 数组中文
- `src/stages/conflict-resolver.ts:137,150` — fix 数组中文
- `src/stages/detect-tools.ts:183-185` — NO_TOOLS fix 首项中文
- `src/commands/init.ts:192-194,222-223` — SSH/Token 修复建议中文
- `src/core/path-resolver.ts:27` — fix 数组中文

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

经代码逐一验证：

1. **`config.ts:29`**：`['npx aiforge init  # 首次配置']` — ✅ 确认，中文注释
2. **`config.ts:39-40`**：`['ls -la ~/.aiforge/config.json  # 检查文件权限', 'chmod 600 ~/.aiforge/config.json  # 修复权限']` — ✅ 确认，中文注释
3. **`config.ts:55`**：`['npx aiforge init  # 重新配置']` — ✅ 确认
4. **`config.ts:66`**：`['npx aiforge init  # 重新配置']` — ✅ 确认
5. **`fs-utils.ts:286`**：`['检查安装规则中的 targetDir 配置']` — ✅ 确认
6. **`fs-utils.ts:316`**：`['检查路径链中是否存在指向 allowedRoot 之外的符号链接', '检查安装规则中的 targetDir 配置']` — ✅ 确认
7. **`conflict-resolver.ts:137`**：`['在终端中运行此命令', '使用 --force 跳过交互式确认']` — ✅ 确认
8. **`conflict-resolver.ts:150`**：`['重新运行安装命令', '使用 --force 跳过冲突确认']` — ✅ 确认
9. **`detect-tools.ts:184`**：`'安装 GitHub Copilot、Claude Code、Cursor 或 VS Code'` — ✅ 确认
10. **`init.ts:46`**：`['在本地终端运行 aiforge init', '或手动创建 ~/.aiforge/config.json']` — ✅ 确认（审查原文引用为 192-194,222-223 行号偏差，但问题本身存在）
11. **`init.ts:192-194`**：SSH 修复建议 `'  cat ~/.ssh/id_ed25519.pub  # 复制公钥到 GitLab Settings > SSH Keys'` — ✅ 确认
12. **`init.ts:222-223`**：Token 修复建议 `'  访问 GitLab Settings > Access Tokens 生成新 Token'` / `'  确保 Token 具有 read_repository 权限'` — ✅ 确认
13. **`path-resolver.ts:27`**：`['请确保 HOME 环境变量已正确设置', '例如: export HOME=/home/youruser']` — ✅ 确认

**补充发现（审查遗漏）：**

14. **`index.ts:58`**：`process.stderr.write('⚠️ 不支持的语言 "${config.language}"，使用默认中文\n')` — 中文硬编码
15. **`index.ts:68`**：`process.stderr.write('⚠️ 读取语言配置失败，使用默认中文: ...\n')` — 中文硬编码
16. **`init.ts:215`**：Token 成功后 `（${sanitized}）` 使用了中文括号

**严重性判断：合理**

AC #3 明确要求"所有用户可见字符串通过 messages 模块的 `msg()` 函数获取"。`fix[]` 数组中的文本会经 Reporter 输出给用户，属于用户可见输出。在 `language = en` 时这些中文 fix 建议会导致中英混杂。

**修复建议：可行**

将所有 fix 文本纳入 `msg()` 键管理。需要在 `messages.ts` 的 MessageSet 中为每个模块的 fix 文本添加对应键。

**误报评估：非误报**

---

## 发现 #3 评估（新发现）

### 审查原文

> **[中][新] 当前分支的 lint 门禁未通过，和 Story/评估中的"lint 已绿"结论不一致**

涉及文件：`src/core/messages.ts`、`src/services/fs-utils.ts`、`tests/core/reporter.test.ts`、`_analysis_output/*.md`

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

经独立验证：`npm run lint` 确实失败，Prettier 报告 7 个文件格式问题：
- `src/core/messages.ts` — Story 改动文件
- `src/services/fs-utils.ts` — Story 改动文件
- `tests/core/reporter.test.ts` — Story 改动文件
- `_analysis_output/*.md`（4 个）— 非 Story 文件，是之前评估讨论中 explore agent 生成的临时分析产物

**严重性判断：合理，但需拆分**

- Story 相关的 3 个源码/测试文件的 Prettier 格式问题：**P1 — 阻塞交付**，必须修复。
- `_analysis_output/*.md` 的格式问题：**不阻塞 Story 交付** — 这些是临时分析产物，不属于 Story 改动范围。应在修复时一并清理（删除或加入 `.prettierignore`），但不应计为 Story 缺陷。

**修复建议：可行**

- 对 Story 相关文件运行 `npx prettier --write src/core/messages.ts src/services/fs-utils.ts tests/core/reporter.test.ts`。
- 对 `_analysis_output/` 目录：删除或加入 `.prettierignore`。

**误报评估：非误报**

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1a | init 配置摘要在 setLanguage() 之前输出 | [遗留] | **P1** | `runInit()` 需在 loadConfig 后预加载语言再输出摘要 |
| 1b | init description 用 msg() 而非英文硬编码 | [遗留] | **P2** | 与"CLI help 仅英文"决策矛盾，改为硬编码英文 |
| 2 | 全仓 fix[] 数组仍大量中文硬编码 | [遗留] | **P1** | 至少 13 处 fix 文本 + 3 处 index.ts/init.ts 中文硬编码 |
| 3 | npm run lint 失败（Story 改动文件） | [中][新] | **P1** | 3 个 Story 文件需 Prettier 格式化 |

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 3b | `_analysis_output/` 临时产物污染 lint | [中][新] | **P3** | 非 Story 改动，删除或加入 .prettierignore |

### 评估决定

- **发现 #1a（init 配置摘要语言预加载）**：确认需要修复。在 `runInit()` 中 `loadConfig()` 成功后、输出摘要前插入 `setLanguage(existingConfig.language ?? 'zh-CN')`。
- **发现 #1b（init description 硬编码）**：确认需要修复。将 `.description(msg('init.descInit') || ...)` 改为 `.description('Initialize aiforge configuration')`，与"CLI help 仅英文"决策对齐。
- **发现 #2（fix[] 中文硬编码）**：确认需要修复。将所有 fix/建议文本纳入 `msg()` 键管理，在 `messages.ts` 中补充对应 fix 键的中英文文案。同时修复 `index.ts:58,68` 的中文 stderr 提示和 `init.ts:215` 的中文括号。
- **发现 #3（lint 失败）**：确认需要修复。对 3 个 Story 文件运行 Prettier 格式化；`_analysis_output/` 作为 CR TODO 清理。

---

## 修复执行记录

### 修复执行记录
- **Date**: 2026-04-01
- **Model Used**: Claude Opus 4.5
- **Fix Items**: 4

---

### 发现 #1a — init 配置摘要在 setLanguage() 之前输出

**修复状态**: ✅ 完成

**涉及文件**: `src/commands/init.ts`

**修改内容**:
- 在 `runInit()` 的 `try { existingConfig = await loadConfig(...) }` 成功后，输出配置摘要 `console.log(msg('init.currentConfig'))` 之前，插入：
  ```typescript
  setLanguage(existingConfig.language ?? 'zh-CN')
  ```
- 确保 `init` 子命令走自己独立的 `action()` handler 时（不经过 `index.ts` 语言预加载路径），也能在摘要输出前正确设置语言

---

### 发现 #1b — init description 使用 msg() 而非英文硬编码

**修复状态**: ✅ 完成

**涉及文件**: `src/commands/init.ts`

**修改内容**:
- 将 `.description(msg('init.descInit') || 'Initialize aiforge configuration')` 改为：
  ```typescript
  .description('Initialize aiforge configuration')
  ```
- 与评估确认的"CLI help 仅英文，不国际化"决策对齐
- 同步更新 `tests/commands/init.test.ts:563` 中断言 description 为英文

---

### 发现 #2 — fix[] 数组及其他中文硬编码

**修复状态**: ✅ 完成

**涉及文件**:
- `src/core/messages.ts` — 新增双语 fix 键
- `src/commands/init.ts` — SSH/Token fix 数组 + init 非 TTY fix + 中文括号
- `src/index.ts` — 两处中文 stderr 警告（新增 `index` 命名空间）
- `src/services/config.ts` — 4 处 fix 数组
- `src/services/fs-utils.ts` — 5 处 fix 数组（pathTraversal、symlinkEscape、brokenSymlink×3、checkTargetWritability×2）
- `src/stages/conflict-resolver.ts` — 2 处 fix 数组
- `src/stages/detect-tools.ts` — NO_TOOLS fix 首项
- `src/core/path-resolver.ts` — 1 处 fix 数组

**新增 messages.ts 键（各含 zh-CN + en 双语）**:
- `errors.fixRunInTerminal`、`errors.fixManualConfig`
- `init.fixSshKeygen`、`init.fixSshCopyKey`、`init.fixSshTest`、`init.fixTokenGenerate`、`init.fixTokenPermission`
- `config.fixInit`、`config.fixCheckPerms`、`config.fixPermsCmd`、`config.fixReinit`
- `fsUtils.fixCheckTargetDir`、`fsUtils.fixCheckSymlink`、`fsUtils.fixCheckPathConfig`、`fsUtils.fixChmod`、`fsUtils.fixSudo`、`fsUtils.fixChmodFile`
- `pathResolver.fixHomeEnv`、`pathResolver.fixHomeExample`
- `conflictResolver.fixRunInTerminal`、`conflictResolver.fixUseForce`、`conflictResolver.fixRerun`、`conflictResolver.fixForceConflict`
- `detectTools.fixInstallTools`
- `index.unsupportedLanguage`、`index.languageLoadFailed`（新命名空间）

---

### 发现 #3 — lint 失败（Prettier + _analysis_output/）

**修复状态**: ✅ 完成

**涉及文件**:
- `.prettierignore` — 新增 `_analysis_output/` 排除规则（非 Story 改动，临时分析产物）
- `src/core/messages.ts`、`src/index.ts`、`src/services/fs-utils.ts`、`tests/core/reporter.test.ts` — 运行 `npx prettier --write` 格式化

---

### 测试验证

```
npm run lint  → All matched files use Prettier code style! ✅
npm test      → Test Files: 28 passed (28), Tests: 649 passed (649) ✅
```

全部 649 个测试通过，lint 完全通过。
