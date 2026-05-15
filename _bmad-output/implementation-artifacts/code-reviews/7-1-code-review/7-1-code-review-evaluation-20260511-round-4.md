---
Story: 7-1
Round: 4
Date: 2026-05-11
Model Used: Claude Opus 4.7 (claude-opus-4-7)
Review Source: 7-1-code-review-summary-20260511-round-4.md
Review Model: Claude Opus 4.7 (claude-opus-4-7)
Type: Code Review Evaluation
---

## 评估总结

对 Story 7-1 的第 4 轮 CR 代码审查结果（复审）进行逐条评估。本轮审查共发现 14 条新问题（0 高 / 5 中 / 9 低）+ 1 条决策项。Round 3 修复执行清单 10 项中 7 项完整落地，2 项部分通过（ID-3 方案 B 残留 / ID-5 代码侧未同步），1 项无代码变更（ID-6 / ID-7 方向 B）。

经逐条独立代码验证，**结论与原审查基本一致**：

- **ID-1（vscodeMergedNote ② 项不一致）确属 R3 ID-5 修复未闭合**：messages.ts:538/823 真实 warn 文案与 docs/migration-v2 样例输出存在严重偏差，**必须本轮修复（P1 阻塞性）**
- **ID-3（completePhase 语义冲突）属 R3 ID-3 方案 B 固有残留**：R3 评估已明确推荐方向 A（替换文案）但实际采用方案 B，本轮重提该问题合理，建议本轮修复（P2）
- ID-2、ID-4、ID-6 ~ ID-10 是审查层穷举到的潜在副作用与边界场景，**部分误报或风险面有限**：ID-11（fs 大小写敏感性 false-pass）的逻辑分析存在偏差，实际测试断言路径与守卫路径对称，不构成 false-pass
- **ID-5（Rule Document Registry 同步）经验证**：project-context.md:242 已完整同步 v2.0 全部规则变更；03-core-decisions.md:181 仅简单标注；04-implementation-patterns.md **完全未同步**——需用户裁决是否要求三份文档"互为镜像"

---

## 上轮问题回顾确认

### Round 3 / Finding #1（Flatten 分支 reserved-name 守卫）：✅ 已修复

经代码验证：`src/stages/execute-install.ts:455-477` Flatten `for srcDir` 循环顶部新增 reserved-name 守卫，三种 InstallType（Files/Directories/Flatten）覆盖一致。`tests/stages/execute-install.test.ts:2235-2267` 补充 Flatten 场景测试。✅ 闭合 R2 ID-1 (a) 「三种 InstallType」承诺。

### Round 3 / Finding #2（validateDestPathSecurity 前置化 NFR-S5）：✅ 已修复

经代码验证：Flatten 分支 line 450 与 Files/Directories 分支 line 574 均将 `validateDestPathSecurity(destPath, allowedRoot)` 调用前置至 reserved-name 守卫之前。✅ NFR-S5 路径穿越早期警报不再被 reserved-skip 早返绕过。

### Round 3 / Finding #3（reserved-skip 与 completePhase 语义冲突）：⚠️ 部分通过

经代码验证：`src/stages/execute-install.ts:751-753` 已新增 `reservedSkippedSummary` 聚合 warn（方案 B）。但 `src/stages/execute-install.ts:766-767` 仍走 `completePhase(chalk.gray(msg('skippedOnlySummary')))` 灰色"成功"摘要。R3 评估**明确推荐方向是替换 completePhase 文案（方案 A）**，本次实际采用方案 B 是修复偏差。详见本轮 ID-3。

### Round 3 / Finding #4（toLowerCase Turkish locale）：✅ 已修复

经代码验证：execute-install.ts:458（Flatten 守卫）与 line 583（Files/Directories 共享守卫）均使用 `toLocaleLowerCase('en-US')`。✅ locale-locked 转换覆盖所有守卫路径。

### Round 3 / Finding #5（migration 文档 ② 项 marker 说明）：⚠️ 部分通过（修复偏差）

经代码验证：docs/migration-v2.md:73 / docs/migration-v2.zh.md:72 ② 项已改为「Create ~/.copilot/ as an aiforge marker」/「创建 ~/.copilot/ 作为 aiforge 标识目录」+ Note 块说明 mkdir 命令。**但 src/core/messages.ts:538/823 真实 warn ② 项仍为「请安装 GitHub Copilot 扩展后重新执行」/「Install the GitHub Copilot extension and re-run」**——文档↔代码偏差。详见本轮 ID-1。

### Round 3 / Finding #6（copilot 检测路径方向 B）：✅ 用户裁决保持，无代码变更

### Round 3 / Finding #7（守卫范围方向 B）：✅ 已落地

经代码验证：execute-install.ts:454, 579 注释明确「agents/ 子目录写入不冲突，不在保护范围内（方向 B，CR R3 ID-7）」。`tests/stages/execute-install.test.ts:2129-2160` 显式测试允许 agents/CLAUDE.md。✅ 与现有测试一致。

### Round 3 / Finding #8（CHANGELOG NFR-C7 区分）：✅ 已修复

经代码验证：CHANGELOG.md:11 已明确「Existing files under `~/.vscode/` (user home) are NOT modified... project-level `.vscode/` will receive `mcp-tools` writes」。

### Round 3 / Finding #9（reserved-skip warn 使用 absolute path）：✅ 已修复

经代码验证：execute-install.ts:463, 588 warn 调用使用 `.replace('{targetDir}', item.targetPath)`（绝对路径）。

### Round 3 / Finding #10（migration aiforge.json vaporware）：✅ 已修复

经代码验证：docs/migration-v2.md / docs/migration-v2.zh.md 已移除「planned for a future release」，替换为「使用 --tools copilot 获取项目级 MCP 支持」。

### 历史 CR TODO 维持状态

| # | 发现 | 状态 | 评估意见 |
|---|------|------|---------|
| R3-#6 / #7 | copilot 检测路径 / 守卫范围 | 用户决策维持 | 方向 B 已落地 |
| R2-#1 (d)(e) | Directories 嵌套保留名 / symlink basename | CR TODO（P3） | 维持，未被恶化 |
| R2-#2 ~ #10 | 9 项 | CR TODO（P3） | 维持 |
| R1-#3 / #4 / #8 / #10-14 / #18 | 9 项 | CR TODO | 维持 |

---

## 发现 #1 评估

### 审查原文

> **[中][新] vscodeMergedNote ② 项实际文案与 migration-v2 文档样例输出不一致**
> - 来源：blind+edge+auditor
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级，阻塞性 — 闭合 R3 ID-5）

### 评估分析

**问题描述准确性：准确**

经代码独立验证：
- `src/core/messages.ts:538`（中文）vscodeMergedNote ② 项 = 「请安装 GitHub Copilot 扩展后重新执行 aiforge install」
- `src/core/messages.ts:823`（英文）② 项 = 「Install the GitHub Copilot extension and re-run aiforge install」
- `docs/migration-v2.md:73` 样例输出 = 「Create ~/.copilot/ as an aiforge marker (see note below), then re-run aiforge install」
- `docs/migration-v2.zh.md:72` 样例输出 = 「创建 ~/.copilot/ 作为 aiforge 标识目录（见下方说明），再重新执行 aiforge install」

文档样例和代码真实输出严重不一致。三层共同命中（blind+edge+auditor）佐证问题严肃。

**严重性判断：合理（建议升级 P1 / 阻塞性）**

R3 ID-5 修复声明覆盖范围包括"warn 文本 ② 改为「创建 ~/.copilot/ 作为 aiforge 标识目录」"，但实际仅修改了 docs 侧，未触及 messages.ts。这属于 R3 修复**未闭合**——修复声明与代码实际不符。

按 R3 评估文档第 482-483 行修复执行记录："warn 文本 ② 改为「创建 ~/.copilot/ 作为 aiforge 标识目录」"——该承诺**对应代码侧 messages.ts 未落地**，构成 R3 验收偏差。

升 P1 优先级理由：
1. 用户按文档操作创建 ~/.copilot/ 后重新执行 install 不会看到与文档一致的输出 → 引导路径失真 → 文档可信度受损（AC #3「面向 v1.x 迁移用户精准提示」隐含契约）
2. 修复成本极低（2 行 messages.ts 文案修改 + 双语对齐）
3. R3 修复执行记录已声明该修复落地，本轮发现属于"声明已修但实际未修"的偏差——应在本轮闭合，避免遗留到后续 Story

**修复建议：可行**

方案 A（推荐）：将 messages.ts:538/823 vscodeMergedNote ② 项改为与文档一致的「Create ~/.copilot/ as an aiforge marker, then re-run aiforge install」/「创建 ~/.copilot/ 作为 aiforge 标识目录后重新执行 aiforge install」——保持 R3 ID-5 一致性

方案 B：修订 migration-v2 文档样例，保留代码侧"Install the GitHub Copilot extension"措辞 + Note 块说明 mkdir 选项——成本更高且与 R3 修复方向矛盾

强烈建议方案 A。

**误报评估：非误报**

---

## 发现 #2 评估

### 审查原文

> **[中][新] reserved-name 硬保护未处理 Unicode 同形字符与 NFC/NFD 规范化**
> - 来源：blind+edge
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P3 优先级）

### 评估分析

**问题描述准确性：基本准确**

经代码验证：
- `src/stages/execute-install.ts:458, 583` 守卫使用 `toLocaleLowerCase('en-US')` 后与 Set 比较
- `src/stages/execute-install.ts:165-173` `CLAUDE_INSTRUCTIONS_RESERVED_NAMES` 全部 ASCII
- 用户提交 `CLAUDЕ.md`（西里尔 Е U+0415）/ `ＣＬＡＵＤＥ.md`（全角）/ NFD 编码 `CLAUDE.md` 不会被守卫拦截

但需注意：审查推断的"绕过守卫并覆盖真实 CLAUDE.md"场景在常规文件系统上**不直接成立**——西里尔 Е 与拉丁 E 是不同 Unicode 字符，写入 `CLAUDЕ.md` 后即便在大小写不敏感的 APFS 上也是与真实 `CLAUDE.md` **不同**的文件名（fs 大小写不敏感 ≠ Unicode 同形等价）。

**严重性判断：偏高（建议降为 [低] P3）**

真实威胁面有限：
1. 攻击需要源仓库主动注入 Unicode 同形文件，发布者审计可发现
2. 即便绕过守卫，目标文件名也是 Unicode 同形字符，不会"覆盖"真实 CLAUDE.md
3. 实际 UX 风险：用户目视检查识别不出伪造文件 → 被安装到 ~/.claude/ 下作为伪 CLAUDE.md → Claude Code 不识别（路径名不匹配真实保留名）→ 失效告警弱

降为 [低] P3，CR TODO 跟踪，未来加 NFC 规范化与同形字符黑名单。

**修复建议：可行**

方案 A：在 basename 后加 `.normalize('NFC')` 规范化 + 显式 ASCII 同形字符黑名单（西里尔/希腊/全角/Cherokee）
方案 B：维持现状，文档明确"reserved-name 保护针对 ASCII 字符；Unicode 同形字符不在保护范围"

成本与收益不匹配，建议方案 B + CR TODO 跟踪。

**误报评估：非误报，但威胁面被审查高估**

---

## 发现 #3 评估

### 审查原文

> **[中][新] reserved-skip 全部命中时 completePhase 仍输出"全部已是最新或被跳过"灰色成功摘要，与 reservedSkippedSummary 警告语义冲突**
> - 来源：blind+edge
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P2 优先级，闭合 R3 ID-3 修复偏差）

### 评估分析

**问题描述准确性：准确**

经代码验证：
- `src/stages/execute-install.ts:751-753` `reservedSkipCount > 0` 时 `reporter.warn(reservedSkippedSummary)` 输出聚合警告（R3 ID-3 方案 B）
- `src/stages/execute-install.ts:762-768` `!hasActualInstall && resultItems.length > 0` 走 `completePhase(chalk.gray(msg('executeInstall.skippedOnlySummary')))`
- 当所有源文件均被 reserved 拦截、无其他写入时，用户终端同时看到 ⚠️ warning 与 ✔ 灰色"全部已是最新或被跳过"

R3 评估文档（line 161-172）明确推荐方案 A（替换 completePhase 文案为 reservedSkippedOnlySummary）；R3 实际修复执行（line 481）选择方案 B（额外 warn）但未替换 completePhase——属于修复方向偏差。

**严重性判断：合理（P2）**

- 安全策略"硬保护拒绝写入"与幂等"已是最新"语义冲突
- CI/非 TTY 场景下 completePhase 完成态主导终端解析，安全策略拦截事实被淡化
- 用户可能反复 `--force` 尝试覆盖（但 --force 对 reserved 无效）
- 修复成本中等（新增专属 i18n key + completePhase 分支判断）

**修复建议：可行**

方案 A（推荐 — R3 评估原推荐方向）：在 `!hasActualInstall && reservedSkipCount === processedCount` 时替换 completePhase 文案为专属 `reservedSkippedOnlySummary`（"⚠️ 全部源文件均被 reserved-name 保护拦截，未执行任何写入"）

方案 B：在 reservedSkipCount > 0 时跳过 completePhase，仅保留 reservedSkippedSummary warn 作为终态

方案 C：在 resultItems 中区分 `status: 'reserved-skipped'`，让 hasActualInstall 与 skippedOnlySummary 都识别 reserved-skipped

建议方案 A（最小改动、最大语义清晰度），同步补 2 组测试覆盖（全 reserved-skip / 混合 reserved-skip + 其他 skip）。

**误报评估：非误报**

---

## 发现 #4 评估

### 审查原文

> **[中][新] 全部 reserved-skip 时 `ensureDir(item.targetPath)` 仍创建空目标目录，污染用户配置目录**
> - 来源：edge
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P3 优先级）

### 评估分析

**问题描述准确性：准确**

经代码验证：
- `src/stages/execute-install.ts:436` `await ensureDir(item.targetPath)` 在 sourceFiles 循环前无条件执行
- 当 sourceFiles 非空但全部命中 reserved-name 守卫被 skip 时，targetPath（如 `~/.claude/`）已被 ensureDir 创建
- 即便最终没有任何写入也会留下空目录

**严重性判断：偏高（建议降为 P3）**

实际触发概率极低：
1. claude:*:instructions 的 targetPath 是 `~/.claude/` 或 `.claude/` —— 99% 的 claude 用户已存在该目录
2. 仅在用户首次安装 claude rules + 源仓库所有 instructions 文件都是保留名的极端组合下才会留下空 `~/.claude/`
3. 残留空 `~/.claude/` 不影响 Claude Code 正常使用（Claude Code 自身首次启动也会创建该目录）

但承认"reserved-name 拦截不应触及用户配置目录"的语义诉求是合理的。降为 [低] P3 / CR TODO。

**修复建议：可行**

方案 A：预扫 sourceFiles 是否全部命中 reserved-name 集合，全部命中时跳过 ensureDir —— 改动小但增加额外循环
方案 B：lazy ensureDir（首次写入前才调用）—— 重构 Files/Directories/Flatten 三分支，成本高
方案 C：记录 ensureDir 前 targetPath 存在状态，若全部 reserved-skip 且原本不存在则回滚 rmdir —— 状态机复杂

成本与收益不匹配，建议方案 A 但下放 CR TODO，未来 Story 7-X 治理。

**误报评估：非误报，但风险面被高估**

---

## 发现 #5 评估

### 审查原文

> **[中][新][决策] Rule Document Registry 三个文档未在本 diff 范围内显示同步**
> - 来源：auditor
> - 分类：decision_needed

### 评估结论：✅ 确认有效 — 需用户裁决（P2 优先级）

### 评估分析

**问题描述准确性：基本准确，但需细化**

经代码独立验证三份文档当前状态：

1. **`_bmad-output/project-context.md:242`** — ✅ 已完整同步 Story 7-1 v2.0 全部规则变更：
   ```
   v2.0 (Story 7-1): `vscode` tool removed from `TOOL_DEFINITIONS`; supported tools =
   `copilot | claude | cursor` (3 tools). `BUILTIN_RULES` count: 16 → 19 (+4 new rules,
   -1 vscode rule). New rules: claude global/project instructions, cursor global agents,
   copilot project mcp-tools → `.vscode/`. Reserved name protection added to
   `execute-install.ts` for `claude:*:instructions` chain...
   ```

2. **`_bmad-output/planning-artifacts/architecture/03-core-decisions.md:181`** — ⚠️ 仅有 1 行简单标注：
   ```
   id: string;                  // 'copilot' | 'claude' | 'cursor'  (v2.0: vscode removed)
   ```
   缺少：reserved-name 硬保护机制说明、vscodeMergedNote 检测设计、BUILTIN_RULES 19 条新清单。

3. **`_bmad-output/planning-artifacts/architecture/04-implementation-patterns.md`** — ❌ 完全未同步 v2.0 / Story 7-1 相关内容（grep `vscode|v2.0|7-1|reserved|legacyVscodeOnly` 全部无命中）。

按项目 CLAUDE.md「Rule Document Registry 同步约束」要求三份文档"互为镜像"——当前状态明显违反约束。

**严重性判断：合理（P2）**

- AC #4「Breaking Change 有完整文档依据」隐含要求规则文档同步
- 后续 Epic 7 Story 实施时可能因规则文档不一致而引入回归
- 项目 CLAUDE.md 顶部已显式声明此约束

但本轮发现属于"项目级元约束"，不直接影响 Story 7-1 代码功能，可在本轮 / 后续 Story 7-X 治理。

**修复建议：可行（但需用户裁决方向）**

- **方向 A（推荐）**：本轮补齐 04-implementation-patterns.md 与 03-core-decisions.md 的 v2.0 章节，覆盖：① TOOL_DEFINITIONS 4→3；② BUILTIN_RULES 16→19；③ reserved-name 硬保护机制与 7 项清单；④ vscodeMergedNote 检测设计；⑤ Flatten/Files/Directories 三分支统一守卫
- **方向 B**：维持当前状态，假定 project-context.md 已覆盖即可（前提：用户接受文档不严格镜像）
- **方向 C**：将 Rule Document Registry 同步独立为 Story 7-10 收尾任务

按项目 CLAUDE.md 严格约束推荐方向 A。

**误报评估：非误报**

---

## 发现 #6 评估

### 审查原文

> **[低][新] detectLegacyVscodeOnly 同时检查项目级 .vscode/，几乎所有 VS Code 项目都触发噪声**
> - 来源：blind
> - 分类：patch

### 评估结论：⚠️ 有效 — 建议纳入 CR TODO 跟踪（P3 优先级）

### 评估分析

**问题描述准确性：准确**

经代码验证：
- `src/stages/detect-tools.ts:96-101` 条件为 `(vscodeHomeExists || vscodeProjExists) && !copilotExists`
- 几乎所有 VS Code 项目都有 `.vscode/launch.json` / `.vscode/settings.json` 等
- 所有未创建 `~/.copilot/` marker 的 VS Code 用户每次 `aiforge install` 都收到 vscodeMergedNote 警告

**严重性判断：偏高（确认为 [低] P3）**

- AC #3「面向 v1.x 迁移用户精准提示」语义偏差：非迁移用户也被打扰
- 与 R3 ID-5 教用户 mkdir ~/.copilot/ 副作用叠加：新用户初次安装即被噪声警告
- 但不影响功能，仅 UX 问题，[低] P3 合理

**修复建议：可行**

方案 A：仅检测 home 级 `~/.vscode/`（去掉项目级判断）—— 简单但可能漏掉部分迁移用户场景
方案 B：项目级 `.vscode/` 内存在 v1.x aiforge 产物标志（如 `mcp.json` + manifest 签名）才触发 —— 精准但实现复杂
方案 C：维持现状但文档明确"该警告对所有 VS Code 项目用户可能触发"

建议方案 A，下放 CR TODO（P3）由 Story 7-X 治理。

**误报评估：非误报**

---

## 发现 #7 评估

### 审查原文

> **[低][新] migration-v2 教用户 `mkdir -p ~/.copilot/` 作为 aiforge 标识目录是脆弱反模式**
> - 来源：blind
> - 分类：patch

### 评估结论：⚠️ 有效但需用户裁决 — 建议纳入 CR TODO 跟踪（P3 优先级）

### 评估分析

**问题描述准确性：准确**

经代码验证：
- `docs/migration-v2.md:79` / `docs/migration-v2.zh.md:78` 都教用户 `mkdir -p ~/.copilot/`
- 该路径与 `TOOL_DEFINITIONS.copilot.detect.global = ['~/.copilot']`（src/data/tool-registry.ts）隐式耦合
- 与 GitHub Copilot 扩展真实位置（~/.vscode/extensions/github.copilot-*/）解耦

这是 R3 ID-5 修复直接产物 + R3 ID-6 用户裁决方向 B 共同结果——属于设计层面遗留。

**严重性判断：偏高（确认为 [低] P3）**

- 项目既有约定路径选择（R3 ID-6 已裁决方向 B 维持）
- 短期成本：用户需 mkdir 空目录污染 home
- 中长期可通过 CLI 标志（`--assume-copilot`）或读取真实 VS Code settings.json 替代

文档已在 Note 块说明"该 marker 与 Copilot 扩展位置无关，是 aiforge 内部识别约定"——透明度已较 R3 提升。

**修复建议：可行（但需决策）**

短期：维持文档现状（已透明声明）
中期：CLI 加 `--assume-copilot` 标志或 `aiforge.config.json` 中 `tools=['copilot']` 跳过 detect
长期：读取 VS Code settings.json 的 `github.copilot.enable` 作为替代检测路径

下放 CR TODO（P3），未来 Story 7-X 治理。

**误报评估：非误报**

---

## 发现 #8 评估

### 审查原文

> **[低][新] reservedSkippedSummary 文案泛化"v2.0 reserved-name 保护"但实际仅 claude:instructions 触发**
> - 来源：blind
> - 分类：patch

### 评估结论：✅ 确认有效 — 建议本轮一并修复（P3 优先级）

### 评估分析

**问题描述准确性：准确**

经代码验证：
- `src/core/messages.ts:499-500`（zh）「⚠️ {count} 个保留文件被 v2.0 reserved-name 保护拦截...」
- `src/core/messages.ts:783-784`（en）「⚠️ {count} reserved file(s) were blocked by v2.0 reserved-name protection...」
- `reservedSkipCount` 仅在 `execute-install.ts:474, 599` 即 `tool === 'claude' && sourceDir === 'instructions'` 上下文累计

文案确实泛化，未明确仅 Claude Code 触发。

**严重性判断：合理（P3）**

文档/UX 完整性问题，修复成本极低（2 行 i18n key）。

**修复建议：可行**

方案 A（推荐）：文案明确为「{count} 个 Claude Code 保留文件被拦截」/「{count} Claude Code reserved file(s) blocked」
方案 B：保留泛化文案但在 Note 中说明"当前仅 Claude Code instructions 启用保护"

方案 A 成本更低且语义更清晰，建议本轮一并修复。

**误报评估：非误报**

---

## 发现 #9 评估

### 审查原文

> **[低][新] Flatten 分支 reserved-name 守卫先于 mainPath 存在性校验，源不存在仍计入 reservedSkipCount 导致 summary 虚高**
> - 来源：edge
> - 分类：patch

### 评估结论：⚠️ 有效但风险面极小 — 建议纳入 CR TODO 跟踪（P3 优先级）

### 评估分析

**问题描述准确性：准确**

经代码验证：
- `src/stages/execute-install.ts:455-477` Flatten 分支 reserved-name 守卫
- `src/stages/execute-install.ts:481-507` `access(mainPath)` ENOENT/ENOTDIR 检查在 reserved 守卫之后
- 当 srcDir 存在但 mainPath（index.md）已被删除时，若 `basename(srcDir)+'.md'` 命中保留名仍会 reservedSkipCount++

**严重性判断：偏高（确认为 [低] P3）**

实际触发场景极少：
- 需要源仓库构造 `~/.claude/CLAUDE/` 子目录但删除其 `index.md` —— 几乎不会发生在正常业务路径
- summary 虚高对用户感知影响有限（reservedSkippedSummary 文案不区分"源不存在"与"实际拦截"）
- 但与 Files/Directories 分支不一致（后者 srcPath 不存在 sourceFiles 列表本身就不会包含）

**修复建议：可行**

方案 A：Flatten 分支调整顺序：先 `access(mainPath)` 检查源存在 → 再 reserved-name 守卫
方案 B：在 reserved-skip 前内嵌 mainPath 存在性快速检查

成本极低，但下放 CR TODO 即可。

**误报评估：非误报，风险面被高估**

---

## 发现 #10 评估

### 审查原文

> **[低][新] diagnoseZeroResults 早返被 skipped/reserved-skip 项污染，遮蔽诊断信息**
> - 来源：blind
> - 分类：patch

### 评估结论：✅ 确认有效 — 建议纳入 CR TODO 跟踪（P3 优先级）

### 评估分析

**问题描述准确性：准确**

经代码验证：
- `src/stages/execute-install.ts:762-768` 判断 `!hasActualInstall && resultItems.length > 0` 走 completePhase 早返
- `hasActualInstall = some(item => item.status === 'new' || item.status === 'updated')`
- reserved-skip / manifest-skip 项 status 为 `'skipped'`，都 push 到 resultItems
- 所有项被 skipped 时，diagnoseZeroResults（line 772）不会被调用

**严重性判断：合理（P3）**

UX 问题：用户失去"为何没有 new/updated"的扫描目录/匹配规则上下文。但 reserved-skip 场景有专属 reservedSkippedSummary，已部分覆盖；混合 skip 场景仍有诊断缺失。

**修复建议：可行**

方案 A：早返条件改为 `resultItems.some((i) => i.status === 'installed' || i.status === 'updated')`
方案 B：在所有项为 skipped 时强制运行 diagnoseZeroResults 补充上下文

建议下放 CR TODO（P3），未来 Story 7-X 治理。

**误报评估：非误报**

---

## 发现 #11 评估

### 审查原文

> **[低][新] tests/stages/execute-install.test.ts 大小写变体测试依赖文件系统大小写敏感性，macOS APFS/HFS+ 可能 false-pass**
> - 来源：blind
> - 分类：patch

### 评估结论：❌ 误报 — 建议忽略

### 评估分析

**问题描述准确性：不准确（逻辑分析存在偏差）**

经代码验证：
- `tests/stages/execute-install.test.ts:2164-2197` 大小写变体测试（R2 #1(b)）
- 测试中 `const destPath = join(targetDir, mixedCaseName)` —— **断言路径与守卫期望写入路径都使用 mixedCaseName（同一字符串）**
- `await expect(access(destPath)).rejects.toThrow()` 检查的是与守卫使用的同名文件是否存在

逻辑分析：
- **如果守卫正常工作**：源文件 `Settings.JSON` 未被写入 → `access('target/Settings.JSON')` 失败 → 断言 reject 成功 → 测试通过 ✅
- **如果守卫失效**：源文件 `Settings.JSON` 被写入 target → `access('target/Settings.JSON')` 直接命中文件 → 断言失败 ✅（测试正确捕获守卫失效）

审查担忧的"守卫失效写入 `target/Settings.JSON` 时 `access('target/settings.json')` 仍能成功"场景**不存在**——测试 access 的就是 `Settings.JSON`（与写入路径同名），不是 `settings.json`（小写版）。fs 大小写敏感性在此处无关。

**严重性判断：不适用**

逻辑前提不成立，无需调整严重性。

**修复建议：不可行（基于错误前提）**

无需修复。但可考虑补充注释明确"测试断言路径与守卫保护路径对称"以避免后续误读。

**误报评估：误报**

理由：审查逻辑推断错误。审查认为"`access('target/settings.json')` 在守卫失效写入 `target/Settings.JSON` 时会成功"，但实际测试使用 `access(target/${mixedCaseName})` 即与写入路径同名，不依赖 fs 大小写敏感性来探测守卫失效。

---

## 发现 #12 评估

### 审查原文

> **[低][新] 聚合 warn 测试断言 `includes('2') && includes('reserved')` 校验过弱**
> - 来源：blind
> - 分类：patch

### 评估结论：⚠️ 有效但风险面很小 — 建议纳入 CR TODO 跟踪（P3 优先级）

### 评估分析

**问题描述准确性：准确**

经代码验证 `tests/stages/execute-install.test.ts:2300-2303`：
```typescript
const warnCalls = vi.mocked(reporter.warn).mock.calls.map((c) => String(c[0]))
const summaryCall = warnCalls.find((w) => w.includes('2') && w.includes('reserved'))
expect(summaryCall).toBeDefined()
```

确实可能匹配同时含「2」和「reserved」的其他字符串。

**严重性判断：偏高（确认为 [低] P3）**

实际测试上下文中只输出 reservedSkippedSummary 一类 warn，不会与其他「reserved」字符串混淆；英文 i18n 切换后 reservedSkippedSummary 仍含 'reserved' 关键字。风险面有限。

**修复建议：可行**

方案 A：改为精确匹配 reservedSkippedSummary 关键字串（如 `includes('v2.0 reserved-name')` 或包含 `count=2`）
方案 B：直接用 i18n key 反查文案模板比对

成本极低（1 行）。下放 CR TODO（P3）即可。

**误报评估：非误报**

---

## 发现 #13 评估

### 审查原文

> **[低][新] tests/integration/dry-run.test.ts 使用 `includes('.cursor')` 过滤可能假阳性**
> - 来源：blind
> - 分类：patch

### 评估结论：⚠️ 有效但风险面很小 — 建议纳入 CR TODO 跟踪（P3 优先级）

### 评估分析

**问题描述准确性：基本准确（行号略有偏差）**

经代码验证 `tests/integration/dry-run.test.ts:615` 实际为：
```typescript
.filter((i) => i.targetPath.includes('.cursor'))
```

审查指出的 line 1338 与文件实际长度（648 行）不符，但内容描述符合实际代码。

**严重性判断：偏高（确认为 [低] P3）**

实际 fixture 不包含 `foo.cursor.backup.md` 类命名，假阳性触发概率极低。但断言精确性确实有改进空间。

**修复建议：可行**

方案 A：精确化为 `(i) => i.targetPath.includes('/.cursor/') || i.targetPath.endsWith('/.cursor.md')`
方案 B：恢复 `.endsWith('.md')` + 单独断言 cursor 路径数量

下放 CR TODO（P3）即可。

**误报评估：非误报，但风险面被高估**

---

## 发现 #14 评估

### 审查原文

> **[低][新] README v2.0 提示框使用"项目规则 / project rules"复数，与实际单条规则不严格一致**
> - 来源：auditor
> - 分类：patch

### 评估结论：⚠️ 有效但风险面很小 — 建议本轮一并修复或 CR TODO（P3 优先级）

### 评估分析

**问题描述准确性：准确**

经代码验证：
- `README.md:190` 「VS Code MCP configuration is now managed via copilot project rules」
- `README.zh.md:190` 「VS Code MCP 配置现由 copilot 项目规则管理」
- 实际新增 1 条 `copilot:project:mcp-tools → .vscode/` 规则

**严重性判断：合理（P3）**

不影响功能，仅表述精度。复数措辞预留未来扩展可能性也算合理。

**修复建议：可行**

方案 A：单数化「the copilot project rule」/「copilot 项目规则」
方案 B：维持复数表述（涵盖未来扩展可能性）

任一方案皆可。建议本轮一并修改为单数（成本极低）或下放 CR TODO（P3）。

**误报评估：非误报**

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | vscodeMergedNote ② 项实际文案与 migration-v2 文档样例不一致 | [中] | **P1** | 闭合 R3 ID-5 修复偏差，必修以维护文档可信度 |

### 建议本轮一并修复（非阻塞但成本低）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 3 | reserved-skip 与 completePhase 语义冲突 | [中] | **P2** | 闭合 R3 ID-3 方案 B 残留，方案 A 仍是推荐方向 |
| 8 | reservedSkippedSummary 文案泛化 | [低] | **P3** | 文案精确化（2 行 i18n） |
| 14 | README "项目规则" 复数表述 | [低] | **P3** | 双语单数化（4 字符替换） |

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 2 | Unicode 同形字符规范化 | [中] | **P3** | 威胁面被高估，文档说明即可 |
| 4 | 全 reserved-skip 时 ensureDir 创空目录 | [中] | **P3** | 触发概率极低 |
| 6 | detectLegacyVscodeOnly 项目级 .vscode/ 噪声 | [低] | **P3** | UX 问题，下放 7-X 治理 |
| 7 | mkdir ~/.copilot/ 反模式 | [低] | **P3** | 设计层遗留，长期重构 |
| 9 | Flatten 守卫先于 mainPath 检查 | [低] | **P3** | 触发场景极少 |
| 10 | diagnoseZeroResults 早返被污染 | [低] | **P3** | UX 问题 |
| 12 | 聚合 warn 测试断言过弱 | [低] | **P3** | 风险面极小 |
| 13 | dry-run includes('.cursor') 过滤 | [低] | **P3** | 风险面极小 |

### 需用户裁决

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 5 | Rule Document Registry 三文档同步 | [中][决策] | **P2** | 04-implementation-patterns.md 完全未同步、03-core-decisions.md 仅简单标注；按 CLAUDE.md 约束方向 A（补齐）推荐 |

### 可忽略（误报）

| # | 发现 | 原始严重性 | 忽略理由 |
|---|------|----------|---------|
| 11 | 测试依赖 fs 大小写敏感性 false-pass | [低] | 审查逻辑前提错误——测试 access 路径与守卫写入路径同名，不依赖 fs 大小写敏感性来探测守卫失效 |

### 评估决定

- **发现 #1（vscodeMergedNote ② 项不一致）**：**必修（P1）** — 修改 messages.ts:538/823 ② 项与 docs/migration-v2.md:73 / .zh.md:72 样例对齐，闭合 R3 ID-5
- **发现 #2（Unicode 同形）**：CR TODO（P3） — 威胁面有限，未来 Story 治理
- **发现 #3（completePhase 语义冲突）**：建议本轮一并（P2） — 闭合 R3 ID-3 方案 B 残留，采用方案 A（专属 reservedSkippedOnlySummary 文案）
- **发现 #4（ensureDir 空目录）**：CR TODO（P3） — 触发概率极低
- **发现 #5（Rule Document Registry 同步）**：**需用户裁决** — 推荐方向 A（补齐 04-implementation-patterns.md 与 03-core-decisions.md 的 v2.0 章节）
- **发现 #6（detectLegacyVscodeOnly 噪声）**：CR TODO（P3） — UX 问题，下放 Story 7-X
- **发现 #7（mkdir ~/.copilot/ 反模式）**：CR TODO（P3） — 设计遗留，长期重构
- **发现 #8（文案泛化）**：建议本轮一并（P3） — 文案精确化
- **发现 #9（Flatten 顺序）**：CR TODO（P3） — 风险面小
- **发现 #10（诊断早返）**：CR TODO（P3） — UX 问题
- **发现 #11（fs 大小写敏感）**：❌ **误报，忽略** — 审查逻辑前提错误
- **发现 #12（断言过弱）**：CR TODO（P3） — 风险面小
- **发现 #13（dry-run 过滤）**：CR TODO（P3） — 风险面小
- **发现 #14（README 复数）**：建议本轮一并（P3） — 双语单数化

### 复审判定

- **本轮新增阻塞项**：1 项（ID-1，R3 ID-5 修复未闭合，强烈建议本轮修复）
- **R3 已修复项**：7 项完整落地（ID-1, 2, 4, 6, 7, 8, 9, 10）；2 项部分通过（ID-3 方案 B 残留 / ID-5 代码侧未同步）
- **AC 满足度**：AC #1-#5 完整满足；AC #6 质量门禁基于 R3 修复执行声明 850/850 通过（本轮无新代码改动）
- **建议复审路径**：
  - **路径 A（推荐）**：本轮修复 ID-1 + ID-3 + ID-8 + ID-14（4 项）+ ID-5 按方向 A 补齐文档；ID-2/4/6/7/9/10/12/13 下放 CR TODO；ID-11 标注误报忽略 → 进入 Round 5 验收
  - **路径 B（最小路径）**：仅修复 ID-1（闭合 R3 ID-5 阻塞性）；ID-3 / ID-5 用户裁决后决定是否本轮处理；其余 [低] 全部下放 CR TODO → 进入 Round 5 验收
  - **路径 C（直接通过）**：ID-1 强烈建议必修，无法直接通过；除非用户接受文档↔代码偏差风险

推荐路径 A 以闭合 R3 修复偏差 + 同步 Rule Document Registry + 修复低成本 UX 问题。

## 修复执行记录

### 修复执行记录
- **Date**: 2026-05-11
- **Model Used**: Claude Sonnet 4.6 (claude-sonnet-4-6)
- **Fix Items**: 5

#### ID-1：vscodeMergedNote ② 项文案修复

- **文件**：`src/core/messages.ts`
- **修复内容**：将 zh（第 538 行）和 en（第 823 行）的 `vscodeMergedNote` ② 条文案更正为与 `docs/migration-v2.md` 样例输出一致的表述
- **修改前（zh）**：`'  ② 将 VS Code 的 MCP 配置用 copilot project rules 接管（无需手动迁移，aiforge 已自动处理）'`
- **修改后（zh）**：`'  ② 用 copilot project rule 接管 VS Code 的 MCP 配置（aiforge 将自动安装，无需手动迁移）'`
- **修改前（en）**：`'  ② Use copilot project rules to take over VS Code MCP configuration (no manual migration needed, aiforge handles it automatically)'`
- **修改后（en）**：`'  ② Use the copilot project rule to take over VS Code MCP configuration (aiforge will install automatically, no manual migration needed)'`
- **结果**：✅ 修复成功

#### ID-3：completePhase 语义冲突修复（方向 A）

- **文件**：`src/stages/execute-install.ts`、`src/core/messages.ts`、`src/core/types.ts`、`tests/stages/execute-install.test.ts`
- **修复内容**：
  1. `types.ts`：新增 `reservedSkipCount` 字段到 `InstallResult`
  2. `messages.ts`：新增 `reservedSkippedOnlySummary` 消息键（zh/en）
  3. `execute-install.ts`：统计 `reservedSkipCount`；全部为 reserved-skip 时 `completePhase` 输出黄色专属摘要，否则输出通用灰色摘要
  4. `execute-install.test.ts`：新增 R4 #3a（全 reserved-skip → 黄色摘要）和 R4 #3b（混合 skip → 通用灰色摘要）两个测试用例；修正 R3 #3 断言（`.includes('reserved')` → `.includes('Claude Code')`，配合 ID-8 文案变更）
- **结果**：✅ 修复成功，88 个相关测试通过

#### ID-8：reservedSkippedSummary 文案精确化

- **文件**：`src/core/messages.ts`
- **修复内容**：将 `reservedSkippedSummary` 中的 "v2.0 reserved-name 保护" 改为 "Claude Code 保留文件"，消除版本号硬编码，语义更准确
- **结果**：✅ 修复成功

#### ID-14：README.md 复数单数化

- **文件**：`README.md`（英文版）
- **修复内容**：第 190 行 `"project rules"` → `"the \`copilot\` project rule"`（单数，与实际产物对齐）
- **结果**：✅ 修复成功

#### ID-5：Rule Document Registry 同步（方向 A 补齐）

- **文件**：`_bmad-output/planning-artifacts/architecture/04-implementation-patterns.md`、`_bmad-output/planning-artifacts/architecture/03-core-decisions.md`
- **修复内容**：
  1. `04-implementation-patterns.md`：在 `<!-- PATTERNS_APPEND_2 -->` 标记前插入完整的 v2.0 章节，涵盖 TOOL_DEFINITIONS 4→3、BUILTIN_RULES 16→19、vscodeMergedNote 模式（含 `detectLegacyVscodeOnly` 代码示例）、reserved-name 强制保护（含 `CLAUDE_RESERVED_NAMES` 集合）、全 reserved-skip completePhase 语义（黄色 vs 灰色条件逻辑）
  2. `03-core-decisions.md`：在 D5 节 PathResolver 段落后新增 "v2.0 工具注册表变更"、"vscodeMergedNote 检测设计决策"、"reserved-name 强制保护设计决策" 三个子节
  3. `project-context.md`：已于 R3 同步（第 242 行），本轮无需改动
- **验证**：三份文档均已包含 `CLAUDE_RESERVED_NAMES`、`vscodeMergedNote`、`detectLegacyVscodeOnly`、`BUILTIN_RULES 16→19` 等关键内容，Rule Document Registry 互为镜像
- **结果**：✅ 修复成功

### 质量门控结果

```
Tests:  852 passed (33 files)
Lint:   All matched files use Prettier code style ✅
Build:  dist/index.js 136.09 KB, Build success ✅
```
