---
Story: 7-1
Round: 2
Date: 2026-05-11
Model Used: Claude Opus 4.7 (claude-opus-4-7)
Review Source: 7-1-code-review-summary-20260511-round-2.md
Review Model: Claude Opus 4.7 (claude-opus-4-7)
Type: Code Review Evaluation
---

## 评估总结

对 Story 7-1 的第 2 轮 CR 代码审查结果（复审）进行逐条评估。本轮审查共发现 11 条新问题（1 高 / 6 中 / 4 低）。经逐条验证，**结论与原审查总体一致**：
- ID-1 是真实阻塞项（CLAUDE_INSTRUCTIONS_RESERVED_NAMES 多绕过路径），其中 (a)(b) 项必须在本轮修复，(c)(d)(e) 可下放 CR TODO。
- ID-11（package-lock.json 顶层 version 0.1.0 → 2.0.0 漂移）为**误报**——实测 `head package-lock.json` 顶层 version 字段已为 `2.0.0`，无 0.1.0 起点漂移；审查可能基于旧快照。
- ID-3（process.cwd 直接调用）与项目既有 detectSingleTool / emitDiagnostics 模式一致，**部分误报**：「与既有 mock 模式不一致」论断合理，但「项目其他检测路径都从 pathResolver 获取」不准确；建议降级 CR TODO。
- 其余 [中]/[低] 项中大部分可纳入 CR TODO 跟踪。Round 1 已修复项（9 项）经本轮复核确认未发生回归。

---

## 上轮问题回顾确认

### Round 1 / Finding #1（detectLegacyVscodeOnly 触发场景过窄）：✅ 已修复

经代码验证：`src/stages/detect-tools.ts:94-102` 已用 `Promise.all` 并行检测 home `~/.vscode/` + 项目 `.vscode/` + `~/.copilot/`；调用点（line 198）已外移至 NO_TOOLS 分支之外，无论 detectedTools 是否为空都会检查。本轮 ID-2/ID-3/ID-4 揭示衍生细化问题，但主修复成立。

### Round 1 / Finding #2（detectLegacyVscodeOnly 死代码）：✅ 自动消解

随 ID-1 修复，调用点 `!detectedTools.includes('copilot')` 在 length>0 场景下不再恒为 true。

### Round 1 / Finding #5（claude instructions 覆盖风险）：✅ 主修复落地，但本轮 ID-1 揭示绕过路径

经代码验证：`src/stages/execute-install.ts:165-170` 定义 `CLAUDE_INSTRUCTIONS_RESERVED_NAMES`（4 名）；line 542-566 在 Files 分支前置检查 + 即便 --force 也跳过。`tests/stages/execute-install.test.ts:1828-1859` 测试覆盖。但保护边界存在 5 个绕过路径（见本轮 ID-1）。

### Round 1 / Finding #6（AC #2 数量口径）：✅ 已修复

Story 文件第 23 行 AC #2 文本已更新为「16 → 19（+4/-1；规格标注 20 为笔误，见 Dev Notes Debug Log #2）」。本轮 ID-9 指出测试 it title 仍为旧表述，是同步遗漏。

### Round 1 / Finding #7（README 流程图 Cursor 重复）：✅ 已修复

`README.md` / `README.zh.md` 第 4 槽位已清空 `│                │`；中英双语对称落地。

### Round 1 / Finding #9（CHANGELOG/FAQ 措辞脱钩）：✅ 已修复

`docs/migration-v2.md:77` / `docs/migration-v2.zh.md:76` FAQ 已补充「migration note 不阻塞安装；但若无受支持工具仍报 NO_TOOLS」。本轮 ID-6 指出措辞与 Round 1 ID-1 修复后触发条件存在新错位，需细化。

### Round 1 / Finding #15（CHANGELOG 1.0.0 日期占位符）：✅ 已修复

`CHANGELOG.md:35` 已更新为 `## [1.0.0] - 2026-04-21`。

### Round 1 / Finding #16（package-lock.json 同步）：✅ 已修复

`head package-lock.json` 顶层 + name 块 version 均为 `2.0.0`。本轮 ID-11 论断「顶层 0.1.0 → 2.0.0」与实测不符（见 ID-11 评估），属误报。

### Round 1 / Finding #20（Rule Document Registry 同步）：✅ 已修复

`_bmad-output/planning-artifacts/architecture/03-core-decisions.md` D5 注释已含「vscode removed」；`_bmad-output/project-context.md` 已新增 v2.0 变更说明段落。

### 历史 CR TODO（非阻塞）

| # | 发现 | 状态 | 评估意见 |
|---|------|------|---------|
| R1-#3 | copilot:project:mcp-tools 同源双规则 | CR TODO | 维持。本轮 ID-7 为细化项，建议合并到同一 TODO |
| R1-#4 | cursor:global agents/skills basename 冲突 | CR TODO | 维持 |
| R1-#8 | pipeline.test.ts E2E 后置 Story 7-10 | CR TODO | 维持 |
| R1-#10 | messages.ts/stages 范围蔓延 | CR TODO | 用户已决策不在本 Story 处理。本轮 ID-12 揭示该 stages 区域内部还有更多缺陷，需在归属决策后纳入相应 Story |
| R1-#11 | vscodeMergedNote 文案歧义 | CR TODO | 维持 |
| R1-#12 | --tools vscode 手动模式 | CR TODO | 维持，建议在 TODO 文档中按本轮 Auditor F-7 重命名为「UNKNOWN_TOOL 文案可补 v2.0 迁移提示」 |
| R1-#13（非目录） | detectLegacyVscodeOnly 非目录辨别 | CR TODO | 维持 |
| R1-#14 | 测试硬编码绝对路径 | CR TODO | 维持 |
| R1-#17 | detectLegacyVscodeOnly 串行 await | 已隐式解决 | 同意标注「已隐式解决」 — Round 1 ID-1 修复中已改 Promise.all |
| R1-#18 | dry-run filter 维度 | CR TODO | 维持 |
| R1-#19 | migration-v2 vscode 规则数量表头 | 已隐式解决 | 同意标注「已隐式解决」 — migration-v2.md 表格已含 `BUILTIN_RULES count 16 → 19` |

---

## 发现 #1 评估

### 审查原文

> **[高][新] CLAUDE_INSTRUCTIONS_RESERVED_NAMES 保护机制存在多个绕过路径**
> - 来源：blind+edge+auditor
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：基本准确**

经验证：
- (a) **仅 Files 分支**：`src/stages/execute-install.ts:539` `if (item.rule.type === InstallType.Files)` 是 reserved-name 守卫的外层条件之一，Directories/Flatten 分支不触发保护。当前 claude:*:instructions 规则 type 均为 Files（`src/data/install-rules.ts:95-101, 117-123`），实际链路不会走 Directories/Flatten 分支；但作为防御性编程，未来若 instructions 切换或衍生其他 type 时，保护失效。**准确**。
- (b) **大小写敏感**：`CLAUDE_INSTRUCTIONS_RESERVED_NAMES.has(basename(srcPath))` 用 Set.has 精确比较，macOS / Windows 默认 case-insensitive FS 上 `claude.md` / `Settings.json` / `SETTINGS.LOCAL.JSON` 可绕过守卫但仍命中目标文件。**准确**。
- (c) **清单不完整**：Claude Code 同样维护 `CLAUDE.local.md`、`AGENTS.local.md` 等本地覆盖文件，建议扩展。**准确**。
- (d) **嵌套子目录**：当前 Files 分支按 `basename(srcPath)` 检查，可命中扁平文件；但若 instructions 切换为 Directories type 复制目录结构，basename 检查不覆盖子目录内的 CLAUDE.md。论断有效但当前不触发。
- (e) **symlink 绕过**：basename 不做 realpath 解析，攻击者控制的源仓库可通过软链接绕过；属于真实但低概率风险（需要恶意 Git 仓库）。**准确**。

三层共同命中（blind+edge+auditor）佐证严肃性。

**严重性判断：合理**

涉及用户最高优先级配置（CLAUDE.md / settings.json）覆盖风险 + NFR-C7「不破坏用户既有配置」+ 供应链安全（symlink）。[高] 合理。

**修复建议：可行**

- (a)(b) 必须本轮修复：将 reserved-name 检查移至 Files / Directories / Flatten 分支共享前置守卫；basename 比较改为 `.toLowerCase()` 与 lowercased 集合比较
- (c) 建议本轮一并：扩展集合至 `CLAUDE.local.md` / `AGENTS.local.md` / `.claudeignore`
- (d)(e) 可下放 CR TODO：嵌套子目录保留名识别 + realpath 解析 symlink 绕过

补对应测试每个绕过路径一组覆盖。

**误报评估：非误报**

---

## 发现 #2 评估

### 审查原文

> **[中][新] detectLegacyVscodeOnly 调用点守卫 `!detectedTools.includes('copilot')` 与函数内 `!copilotExists` 检查口径不等价**
> - 来源：blind+edge
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P3 优先级）

### 评估分析

**问题描述准确性：准确**

经验证 `src/stages/detect-tools.ts:198` 外层 `!detectedTools.includes('copilot') && (await detectLegacyVscodeOnly(pathResolver))`，函数内（line 95-101）末尾返回 `(vscodeHomeExists || vscodeProjExists) && !copilotExists`，其中 `copilotExists = pathExists(join(home, '.copilot'))`。当 copilot 通过项目级 `.github/` 自动识别时（`TOOL_DEFINITIONS` 的 copilot detect.project 含 `.github`），detectedTools 含 'copilot' 但 `~/.copilot/` 可能不存在；反之亦然——两条件不等价。

**严重性判断：偏高**

虽然两条件存在分歧，但外层守卫已先短路（`!detectedTools.includes('copilot')` 不成立时直接跳过），函数内 `!copilotExists` 实际是冗余检查而非冲突；只有当外层守卫被改写或函数被独立调用时才会暴露不等价问题。属于代码质量而非功能正确性问题。建议降为 P3 — CR TODO 跟踪。

**修复建议：可行**

建议在函数内移除 `copilotExists` 判定，仅返回「home 或 project `.vscode/` 是否存在」；将"copilot 是否已检测"完全交给外层调用方（单一职责）。或反之，函数自包含完整判定，移除外层守卫。二选一。

**误报评估：非误报**

---

## 发现 #3 评估

### 审查原文

> **[中][新] detectLegacyVscodeOnly 直接调用 `process.cwd()` 而非通过 pathResolver 注入项目根**
> - 来源：blind+edge
> - 分类：patch

### 评估结论：⚠️ 部分有效 — 建议纳入 CR TODO 跟踪（P3 优先级）

### 评估分析

**问题描述准确性：部分准确**

经验证 `src/stages/detect-tools.ts:98` `pathExists(join(process.cwd(), '.vscode'))`。但同文件 line 62 `detectSingleTool` 内 `const projectBase = process.cwd()` 与 line 112 `emitDiagnostics` 也直接调用 `process.cwd()`——属于既有模式而非本次引入。审查论断「项目其他检测路径都从 pathResolver / mockRepo 获取项目根」**不准确**——既有的项目根检测代码同样直接用 `process.cwd()`。

但「测试需要 patch process.cwd 才能稳定测试」论断成立——detectLegacyVscodeOnly 单元测试为达到可控性需 mock process.cwd 而非 pathResolver。

**严重性判断：偏高**

与项目既有模式一致，并非新引入的不规范。降为 P3 — CR TODO 跟踪。

**修复建议：可行**

若决定改进，需同步重构 detectSingleTool / emitDiagnostics，避免单点不一致。建议作为专项治理（pathResolver 扩展 `projectRoot()` 方法）后批量替换。

**误报评估：部分误报（与既有模式一致论断不准确）**

---

## 发现 #4 评估

### 审查原文

> **[中][新] Promise.all 在三次 pathExists 任一抛 EACCES/ELOOP 时整体 reject，阻塞 detect 流程**
> - 来源：edge
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P3 优先级）

### 评估分析

**问题描述准确性：准确**

经验证 `src/stages/detect-tools.ts:96-100`：`Promise.all([pathExists(~/.vscode), pathExists(.vscode), pathExists(~/.copilot)])`。pathExists（line 33-45）显式按项目规范对 ENOENT/ENOTDIR 降级、其他 errno（EACCES/ELOOP/EIO）向上抛出。Promise.all 在任一 reject 时整体 reject。

**严重性判断：偏高**

边缘场景概率较低（用户 home 下三个目录都不可访问的场景罕见）；且既有 `detectSingleTool`（line 65-80）也顺序 await pathExists，同样存在 EACCES 阻塞风险——属于既有架构选择而非本次新增。建议降为 P3 — CR TODO 跟踪，与 detectSingleTool 一同治理或专项 backlog 处理。

**修复建议：可行**

`Promise.allSettled` + rejected 视为「未检测到」；或函数内 try/catch 包裹整个 Promise.all，异常降级为 false。但若改 `allSettled`，需评估对既有 detectSingleTool 行为一致性。

**误报评估：非误报**

---

## 发现 #5 评估

### 审查原文

> **[低][新] reserved-name skip 路径写入 resultItems（status: 'skipped'）但不更新 manifest，可能留下 stale 条目**
> - 来源：edge
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P3 优先级）

### 评估分析

**问题描述准确性：基本准确**

`src/stages/execute-install.ts:549-566` reserved-name 命中时 `reporter.warn` + push skipped resultItem + continue，未调用 manifest API。但 manifest 在 install 流程中由 `executeInstall` 主流程统一管理（不通过单步函数调用），需细查是否在结尾统一 reconcile。skipped 状态目前对 manifest 行为的影响有限——manifest 不会因 skipped 而新增条目，但若上一次 install 已写入该 reserved-name（即升级前的旧版本）+ 本次跳过，确实可能留下 stale 条目。

**严重性判断：合理**

触发链路：(a) v1.x 时用户使用了同名 instructions/CLAUDE.md（已写入 manifest）；(b) 升级到 v2.0 后 reserved 保护跳过；(c) 旧 manifest 条目残留。触发概率较低但语义不洁。P3 — CR TODO 跟踪。

**修复建议：可行**

在 skip 分支前调用 manifest 查询，若存在同 target 条目则 `manifest.remove`；或显式记录为 `status: 'reserved-skipped'` 用于诊断。

**误报评估：非误报**

---

## 发现 #6 评估

### 审查原文

> **[中][新] migration-v2.md 措辞与代码 vscodeMergedNote 实际触发条件存在错位**
> - 来源：blind+auditor
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P3 优先级）

### 评估分析

**问题描述准确性：部分准确**

经验证 `docs/migration-v2.md:77` / `docs/migration-v2.zh.md:76` FAQ：「This warning is informational only. The migration note itself does not block installation; however, if no supported AI tool is detected (e.g. neither Copilot, Claude Code, nor Cursor), aiforge will still fail with `NO_TOOLS` until you install one of the supported tools.」

FAQ 实际讨论的是「**NO_TOOLS 错误是否会触发**」（即 detectedTools.length === 0 场景），不是「**migration note 是否输出**」（仅依赖 !detectedTools.includes('copilot')）。审查论断「读者会推断只要检测到 claude/cursor 就不会出现 vscodeMergedNote」存在解读跳跃——FAQ 文本本身并未对 vscodeMergedNote 触发条件做承诺。

但文档**确实**未明确说明 migration note 在「detectedTools 含 claude/cursor 但不含 copilot」场景下仍会输出，存在文档信息缺口。读者可能基于第 76/77 行措辞产生误判。

**严重性判断：偏高**

并非措辞错位，而是信息缺口。建议降为 P3 — CR TODO 文档补全。

**修复建议：可行**

在 FAQ 增加一句：「migration note 在 detect 阶段当 copilot 未被识别且检测到 `~/.vscode/` 或项目级 `.vscode/` 时输出（与是否同时检测到 claude/cursor 无关）；不阻塞安装；但若同时未检测到任何受支持工具，仍会因 NO_TOOLS 退出」。中英双语同步。

**误报评估：非误报**

---

## 发现 #7 评估

### 审查原文

> **[中][新] copilot:project:mcp-tools 同源双写 `.github/` 与 `.vscode/` 行为未在 migration-v2 / install-rules-matrix 显式说明**
> - 来源：blind
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议合并到 R1-#3 CR TODO 跟踪（P3 优先级）

### 评估分析

**问题描述准确性：准确**

经验证：
- `docs/install-rules-matrix.md:24-25` 列出 `mcp-tools → .github/` 与 `mcp-tools → .vscode/` 两行，但无并行执行/双写语义注释
- `docs/migration-v2.md` 仅说 vscode 规则迁移到 copilot，未明示双写

**严重性判断：偏高**

文档完整性问题，未直接影响功能正确性。建议降为 P3。与 Round 1 / Finding #3 的 CR TODO（mcp-tools 双规则计数）合并管理。

**修复建议：可行**

migration-v2.md 增加 FAQ「为什么我的 mcp-tools 文件同时出现在 .github/ 和 .vscode/？」；install-rules-matrix.md 表格上方加注双写语义。

**误报评估：非误报**

---

## 发现 #8 评估

### 审查原文

> **[低][新] AC #5（package.json version = 2.0.0）未由测试覆盖**
> - 来源：auditor (F-3)
> - 分类：patch

### 评估结论：✅ 确认有效 — 建议纳入 CR TODO 跟踪（P3 优先级）

### 评估分析

**问题描述准确性：准确**

实测 `grep -rn '"2\.0\.0"' tests/` 无结果。AC #5 字面要求「package.json version 字段更新为 '2.0.0'」是源验证而非运行时断言，但补一个测试断言成本极低（一行）且有回归保障价值（防止未来误改 version）。

**严重性判断：合理**

P3 — CR TODO 跟踪，可在 Story 7-2 或专项 release 测试中补齐。

**修复建议：可行**

新增 `tests/version.test.ts` 或在 `tests/data/install-rules.test.ts` 末尾加 `expect((await import('../../package.json', { assert: { type: 'json' } })).default.version).toBe('2.0.0')`（注意 vitest ESM JSON import 支持）。

**误报评估：非误报**

---

## 发现 #9 评估

### 审查原文

> **[低][新] tests/data/install-rules.test.ts 描述 `+4 new rules -1 vscode = 16+3` 在 AC 文本修订后未同步**
> - 来源：blind
> - 分类：patch

### 评估结论：✅ 确认有效 — 建议纳入 CR TODO 跟踪（P3 优先级）

### 评估分析

**问题描述准确性：准确**

经验证 `tests/data/install-rules.test.ts:13` `it('contains exactly 19 rules (v2.0: +4 new rules -1 vscode = 16+3)', ...)`。Round 1 ID-6 已将 AC #2 修订为「16 → 19（+4/-1）」，但 it title 未同步。`+4 -1 = +3` 与 `16+3 = 19` 算术吻合，但表述形式不直观。

**严重性判断：合理**

P3 — 文档同步遗漏，CR TODO 跟踪。

**修复建议：可行**

it title 改为 `contains exactly 19 rules (v2.0: 16 - 1 + 4 = 19)`，与 AC 文本表述一致。

**误报评估：非误报**

---

## 发现 #10 评估

### 审查原文

> **[低][新] CHANGELOG v2.0.0 Breaking Change 缺少 migration 步骤索引摘要**
> - 来源：auditor (F-5)
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P3 优先级）

### 评估分析

**问题描述准确性：部分准确**

`CHANGELOG.md:10` 写「**Migration**: See [docs/migration-v2.md] / [docs/migration-v2.zh.md]」——确实是「指向 migration 文档的索引」。AC #4 字面要求「migration **步骤索引**」存在解读争议：
- 解读 A（链接索引）：当前实现已满足
- 解读 B（步骤摘要）：当前未提供

按 Keep a Changelog 最佳实践，提供"upgrade → install copilot extension → re-run aiforge install"步骤摘要可提升用户体验，但非强制。

**严重性判断：偏高**

文档完整性建议，非阻塞。P3 — CR TODO 跟踪。

**修复建议：可行**

CHANGELOG Migration 行尾加摘要：`(steps: 1. upgrade aiforge → 2. install Copilot extension → 3. re-run aiforge install)`。

**误报评估：非误报**

---

## 发现 #11 评估

### 审查原文

> **[低][新] package-lock.json 顶层 version 字段从 0.1.0 跳到 2.0.0 显示历史漂移**
> - 来源：blind
> - 分类：patch

### 评估结论：❌ 误报 — 建议忽略

### 评估分析

**问题描述准确性：不准确**

实测 `head -5 package-lock.json`：
```
{
  "name": "aiforge",
  "version": "2.0.0",
  "lockfileVersion": 3,
  "requires": true,
```

并 `grep -n '"version"' package-lock.json` 前五条：
```
3:  "version": "2.0.0",
9:      "version": "2.0.0",
37:      "version": "1.9.0",  (npm 依赖)
49:      "version": "1.9.0",  (npm 依赖)
60:      "version": "1.2.0",  (npm 依赖)
```

顶层 version 字段就是 `2.0.0`，无 0.1.0 起点。审查者可能将 `lockfileVersion: 3` 误读为 `version: 0.1.0`，或基于 Round 1 修复前的旧快照判断。

**严重性判断：N/A**

**修复建议：N/A**

**误报评估：误报**

审查 ID-11 自身备注「既有 lockfile 维护问题，非本次 ID-16 修复引入」表明审查者已意识到该点弱化为既有问题；但论断的事实前提（顶层 version 0.1.0）与实测不符，建议忽略。

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 (a)(b) | reserved-name 保护：仅 Files 分支 + 大小写敏感 | [高] | **P1** | macOS/Windows 默认 case-insensitive FS 上可绕过守卫；必须本轮修复 |
| 1 (c) | reserved-name 清单不完整（CLAUDE.local.md / AGENTS.local.md / .claudeignore） | [高] | **P2** | 建议本轮一并扩展集合 |

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 (d) | Directories 分支嵌套保留名检查 | [高] | **P3** | 当前 type=Files 不触发，未来防御 |
| 1 (e) | symlink basename 绕过 | [高] | **P3** | 需 realpath 解析，性能权衡 |
| 2 | detectLegacyVscodeOnly 守卫与函数内 copilotExists 不等价 | [中] | **P3** | 单一职责改进，非功能正确性 |
| 3 | process.cwd 直接调用 | [中] | **P3** | 与既有模式一致，需专项治理 |
| 4 | Promise.all 单点失败阻塞 | [中] | **P3** | 边缘场景，与既有 detectSingleTool 同病相怜 |
| 5 | reserved-skip 不更新 manifest | [低] | **P3** | 升级场景 stale 条目，触发概率低 |
| 6 | migration-v2 FAQ 触发条件信息缺口 | [中] | **P3** | 文档信息缺口，非措辞错位 |
| 7 | mcp-tools 双写文档说明缺失 | [中] | **P3** | 合并到 R1-#3 CR TODO |
| 8 | AC #5 version 测试断言缺失 | [低] | **P3** | release 回归保障，成本低 |
| 9 | install-rules.test.ts it title 同步遗漏 | [低] | **P3** | 与 AC 文本同步 |
| 10 | CHANGELOG migration 步骤索引摘要 | [低] | **P3** | 解读争议，文档完整性建议 |

### 可忽略（误报）

| # | 发现 | 原始严重性 | 忽略理由 |
|---|------|----------|---------|
| 3（部分） | 「项目其他检测路径都从 pathResolver 获取项目根」 | [中] | 既有 detectSingleTool / emitDiagnostics 同样直接用 process.cwd()，论断的事实前提不准确；改进建议本身仍有价值（已纳入 CR TODO） |
| 11 | package-lock.json 顶层 version 0.1.0 → 2.0.0 漂移 | [低] | 实测顶层 version 字段为 2.0.0，无 0.1.0 起点；审查者可能误读 lockfileVersion 字段或基于旧快照 |

### 评估决定

- **发现 #1（reserved-name 保护多绕过路径）**：
  - (a)(b) **必须本轮修复（P1）** — 移至 Files / Directories / Flatten 前置守卫 + 大小写不敏感比较 + 补对应测试
  - (c) **建议本轮一并（P2）** — 扩展集合至 CLAUDE.local.md / AGENTS.local.md / .claudeignore
  - (d)(e) **下放 CR TODO（P3）** — 嵌套子目录保留名 + symlink realpath 解析
- **发现 #2（守卫不等价）**：CR TODO（P3），单一职责改进
- **发现 #3（process.cwd 直接调用）**：CR TODO（P3），部分论断误报但改进建议合理
- **发现 #4（Promise.all 单点失败）**：CR TODO（P3），与 detectSingleTool 同病相怜
- **发现 #5（reserved-skip manifest）**：CR TODO（P3），升级场景概率低
- **发现 #6（migration-v2 触发条件信息缺口）**：CR TODO（P3），文档补全
- **发现 #7（mcp-tools 双写说明）**：CR TODO（P3），合并到 R1-#3
- **发现 #8（AC #5 测试断言）**：CR TODO（P3），release 回归保障
- **发现 #9（it title 同步遗漏）**：CR TODO（P3），文档同步
- **发现 #10（CHANGELOG migration 步骤索引）**：CR TODO（P3），文档完整性
- **发现 #11（lockfile 顶层 version 漂移）**：**误报** — 实测顶层 version 已为 2.0.0，无需处理

### 复审判定

- **本轮新增阻塞项**：1 项（ID-1 (a)(b)，可在本轮内一并修复）+ 1 项强烈建议（ID-1 (c)）
- **Round 1 已修复项无回归**：9 项全部确认
- **R1-#10 范围蔓延**：用户已决策不在本 Story 处理；本轮 ID-12（execute-install 内部细节问题清单）维持该决策
- **建议**：Round 3 复审前，至少完成 ID-1 (a)(b)(c) 三项修复 + 测试覆盖；其余 [中]/[低] 项可下放 CR TODO，不阻塞合并

---

## 修复执行记录

### 修复执行记录
- **Date**: 2026-05-11
- **Model Used**: Claude Sonnet 4.6 (claude-sonnet-4-6)
- **Fix Items**: 3 项（ID-1 (a)(b)(c)）+ CR TODO 9 项（TODO-028～036）

| 修复 ID | 发现描述 | 修复文件 | 修复结果 |
|---------|---------|---------|---------|
| ID-1 (a) | reserved-name 守卫仅在 Files 分支内，Directories/Flatten 不触发 | `src/stages/execute-install.ts` | ✅ 已修复：将 `const destPath = join(...)` 与 reserved-name 守卫移至 `for (const srcPath of item.sourceFiles)` 循环顶部（Files/Directories 分支之前），移除 Files/Directories 分支内冗余的 `const destPath` 声明；补充 Directories 类型测试用例 |
| ID-1 (b) | `CLAUDE_INSTRUCTIONS_RESERVED_NAMES.has(basename(srcPath))` 大小写敏感，macOS/Windows 上 `claude.md`/`CLAUDE.MD` 可绕过 | `src/stages/execute-install.ts` | ✅ 已修复：常量改为全小写 Set；比较时改用 `basename(srcPath).toLowerCase()`；补充 `it.each(['claude.md', 'Claude.MD', 'CLAUDE.MD', 'Settings.JSON', '.ClaudeIgnore'])` 大小写变体测试 5 组 |
| ID-1 (c) | 保留名清单不完整（缺 `CLAUDE.local.md` / `AGENTS.local.md` / `.claudeignore`） | `src/stages/execute-install.ts` | ✅ 已修复：Set 扩展为 7 项（新增 `claude.local.md` / `agents.local.md` / `.claudeignore`）；RESERVED_NAMES 测试数组同步扩展为 7 项 |
| CR-TODO R2 | 非阻塞发现批量登记（ID-2, 3, 4, 5, 6, 7, 8, 9, 10） | `_bmad-output/implementation-artifacts/cr-rules/cr-todo-backlog.md` | ✅ 已登记 TODO-028～036（9 项），open 数量 20 → 29 |

### 质量门禁验证结果

```
npm test:    848 tests passed (33 test files, 新增 9 个测试) ✅
npm run lint:src: ESLint + Prettier 全部通过 ✅
npm run build:  dist/index.js 134.20 KB，build success ✅
```
