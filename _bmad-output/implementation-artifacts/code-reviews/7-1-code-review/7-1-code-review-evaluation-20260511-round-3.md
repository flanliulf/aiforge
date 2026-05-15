---
Story: 7-1
Round: 3
Date: 2026-05-11
Model Used: Claude Opus 4.7 (claude-opus-4-7)
Review Source: 7-1-code-review-summary-20260511-round-3.md
Review Model: Claude Opus 4.7 (claude-opus-4-7)
Type: Code Review Evaluation
---

## 评估总结

对 Story 7-1 的第 3 轮 CR 代码审查结果（复审）进行逐条评估。本轮审查共发现 10 条新问题（0 高 / 7 中 / 3 低）。Round 2 已修复项中：ID-1 (b)/(c) 经代码验证落地，ID-1 (a) 存在 **Flatten 覆盖偏差**（声明覆盖三种 InstallType，实际只覆盖 Files+Directories）。

经逐条验证，**结论与原审查总体一致**：
- 本轮**无单点 [高] 阻塞**，但 ID-1/ID-2/ID-3 三项联动揭示 R2 修复的「未完全闭合」（spec/code 一致性 + NFR-S5 早返回绕过 + 用户感知误导），建议本轮一并修复
- ID-6（copilot 检测路径与实际不符）属于项目既有设计选择（aiforge 自定义约定路径），非本 Story 引入，**需用户裁决**
- ID-7（守卫仅覆盖 instructions）测试已显式允许 `agents/CLAUDE.md` 复制（`tests/stages/execute-install.test.ts:1840-1860`），属于设计决策范围
- 其余 [中]/[低] 项中大部分可纳入 CR TODO 跟踪

---

## 上轮问题回顾确认

### Round 2 / Finding #1 (b)（CLAUDE_INSTRUCTIONS_RESERVED_NAMES 大小写不敏感）：✅ 已修复

经代码验证：`src/stages/execute-install.ts:165-173` 常量改为全小写；line 549 改用 `basename(srcPath).toLowerCase()` 与 Set 比较。`tests/stages/execute-install.test.ts:1880-1903` 5 组大小写变体测试覆盖。本轮 ID-4 揭示 Turkish locale 边界，建议追加处理。

### Round 2 / Finding #1 (c)（保留名清单扩展为 7 项）：✅ 已修复

经代码验证：常量集合扩展为 7 项 (`claude.md` / `agents.md` / `settings.json` / `settings.local.json` / `claude.local.md` / `agents.local.md` / `.claudeignore`)；测试 `RESERVED_NAMES` 数组同步。

### Round 2 / Finding #1 (a)（reserved-name 守卫前置化）：⚠️ 部分通过 — Flatten 覆盖偏差

经代码验证：守卫从 Files 分支内移至 `src/stages/execute-install.ts:539-568` `else` 分支顶部（Files + Directories 共享），但 Flatten 分支（line 437-538）内部**无守卫**。代码注释 line 545「Files + Directories 共享前置守卫」与 R2 修复声明（覆盖三种 InstallType）矛盾。详见本轮 ID-1。

### 历史 CR TODO 维持状态

| # | 发现 | 状态 | 评估意见 |
|---|------|------|---------|
| R2-#1 (d) | Directories 嵌套保留名 | CR TODO | 维持（P3）— 未被恶化 |
| R2-#1 (e) | symlink basename 绕过 | CR TODO | 维持（P3）— 未被恶化 |
| R2-#2 | 守卫不等价 | CR TODO | 维持（P3） |
| R2-#3 | process.cwd() 直接调用 | CR TODO | 维持（P3） |
| R2-#4 | Promise.all 单点失败 | CR TODO | 维持（P3） |
| R2-#5 | reserved-skip 不更新 manifest | CR TODO | 维持（P3） |
| R2-#6 | migration-v2 触发条件信息缺口 | CR TODO | 维持（P3） |
| R2-#7 | mcp-tools 双写文档说明 | CR TODO | 维持（合并 R1-#3） |
| R2-#8 | AC #5 version 测试断言 | CR TODO | 维持（P3） |
| R2-#9 | install-rules.test.ts it title | CR TODO | 维持（P3） |
| R2-#10 | CHANGELOG migration 步骤索引 | CR TODO | 维持（P3） |
| R1-#3 | mcp-tools 双规则计数 | CR TODO | 维持（合并 R2-#7） |
| R1-#4 | cursor:global basename 冲突 | CR TODO | 维持 |
| R1-#8 | pipeline.test.ts E2E 后置 | CR TODO | 维持 |
| R1-#10 | messages.ts/stages 范围蔓延 | CR TODO | 用户决策维持现状 |
| R1-#11 | vscodeMergedNote 文案歧义 | CR TODO | 维持 |
| R1-#12 | --tools vscode 手动模式 | CR TODO | 维持 |
| R1-#13（非目录） | 非目录辨别 | CR TODO | 维持 |
| R1-#14 | 测试硬编码绝对路径 | CR TODO | 维持 |
| R1-#18 | dry-run filter 维度 | CR TODO | 维持 |
| R1-#17 | 串行 await | 已隐式解决 | 同 R2 评估 |
| R1-#19 | migration-v2 vscode 规则数量表头 | 已隐式解决 | 同 R2 评估 |

---

## 发现 #1 评估

### 审查原文

> **[中][新] Round 2 ID-1 (a) 「Files/Directories/Flatten 三种 InstallType 统一守卫」声明与实现存在 Flatten 分支覆盖偏差**
> - 来源：blind+edge+auditor
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P2 优先级）

### 评估分析

**问题描述准确性：准确**

经验证：
- `src/stages/execute-install.ts:437-538` Flatten 分支内对 `mainPath` / `destPath` 处理，**无 reserved-name 守卫**
- `src/stages/execute-install.ts:544-545` 注释明确写「Files + Directories 共享前置守卫」
- Round 2 评估文件「修复执行记录」声明覆盖 Files / Directories / Flatten 三种 InstallType
- 当前 BUILTIN_RULES 中 `claude:instructions` 规则均为 Files 类型（`src/data/install-rules.ts:95-101, 117-123`），实际业务路径不会走 Flatten 分支

三层共同命中（blind+edge+auditor）佐证一致性问题严肃。

**严重性判断：合理**

属于「spec/code 一致性」问题，而非功能正确性缺陷——当前 BUILTIN_RULES 不会触发 Flatten 路径。但 R2 修复声明的明文承诺与代码实际覆盖范围存在矛盾，会让未来引入 `claude:*:Flatten` 规则时保护失效。[中] 级别合理。

**修复建议：可行**

方案 A（推荐）：在 Flatten 分支（line 437-538）每个 srcDir 处理循环顶部加同样的 reserved-name 守卫——保持 R2 声明完全一致；
方案 B：修订 R2 修复声明 + 代码注释，明确「覆盖 Files + Directories；当前无 Flatten 业务路径」——成本最小但留下技术债。

建议选方案 A（防御性编程一致性 + 闭合 R2 承诺）。

**误报评估：非误报**

---

## 发现 #2 评估

### 审查原文

> **[中][新] reserved-name 命中后 continue 早返回，跳过 `validateDestPathSecurity(destPath, allowedRoot)` 安全校验**
> - 来源：blind
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P2 优先级）

### 评估分析

**问题描述准确性：准确**

经验证：
- `src/stages/execute-install.ts:546-568` reserved-name 命中后 push skipped + `processedCount++` + `continue`
- `src/stages/execute-install.ts:572` `await validateDestPathSecurity(destPath, allowedRoot)` 在 reserved 守卫之后才被调用——continue 跳过
- 这是 NFR-S5（路径穿越保护）的早期警报点

**严重性判断：合理**

虽然 reserved-name 命中场景下 push 'skipped' 实际并未真正落盘，但：
1. 跳过 validateDestPathSecurity 意味着任何潜在 path-traversal 载荷（如恶意源仓库设置 `srcPath` 为 `../CLAUDE.md`）的早期警报点被绕过
2. 攻击者可借此探测目标系统是否启用 reserved-name 保护
3. 防御深度（defense in depth）原则要求 NFR-S5 不应被早返回绕过

P2 — 修复成本极低（移动两行），建议本轮一并修复。

**修复建议：可行**

将 reserved-name 守卫顺序调整为：先 `validateDestPathSecurity(destPath, allowedRoot)` → 再 reserved-name 检查；或在 reserved-skip 内部先调一次 validate 再 continue。考虑 destPath 是 `join(item.targetPath, basename(srcPath))` 派生，validate 失败应按 NFR-S5 路径穿越错误处理而非简单 skip。

**误报评估：非误报**

---

## 发现 #3 评估

### 审查原文

> **[中][新] reserved-skip 让 `resultItems.length>0`，触发 completePhase「全部已是最新或被跳过」摘要，对用户隐藏拦截事实**
> - 来源：blind+edge
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P2 优先级）

### 评估分析

**问题描述准确性：准确**

经验证：
- reserved-name 命中后 push `{status: 'skipped'}` 到 resultItems（line 556-564）
- `src/stages/execute-install.ts:724-731`：`hasActualInstall === false && resultItems.length > 0` 走 `reporter.completePhase(chalk.gray(msg('executeInstall.skippedOnlySummary')))` — 「全部已是最新或被跳过」

**严重性判断：合理**

「被硬保护拒绝写入」与「文件已经最新」语义完全不同——前者是 v2.0 显式安全策略，后者是 idempotent 安装结果。混为一谈会：
- 让用户对 `--force` 无效感到困惑（hard-protected 不响应 --force，但摘要文案不提示）
- 让安全策略的拦截事实不可见，违反「明示拒绝」原则
- 用户可能反复尝试或误认为安装成功

虽然 reporter.warn 已在 reserved-skip 时输出一次提示，但 completePhase 的总结性文案会主导用户对结果的理解。P2 — 用户体验缺陷，建议修复。

**修复建议：可行**

方案 A：在 completePhase 分支前检查 `resultItems.some(i => i.status === 'skipped' && i.sourcePath 对应 reserved-name)`，命中则换用专属摘要文案（如 `executeInstall.reservedSkippedSummary`）
方案 B：reporter.warn 额外输出聚合提示「N 个保留文件因 v2.0 reserved-name 保护被拒绝写入；--force 也无法覆盖」
方案 C：在 resultItem 中增加 `status: 'reserved-skipped'` 区分 status

任意一方案均可，方案 B 实现最简。

**误报评估：非误报**

---

## 发现 #4 评估

### 审查原文

> **[中][新] toLowerCase() 在 Turkish 等特殊 locale 下可能将 `I`/`İ` 误转，导致 reserved-name 大小写比较失效**
> - 来源：blind+edge
> - 分类：patch

### 评估结论：✅ 确认有效 — 建议本轮一并修复（P2 优先级）

### 评估分析

**问题描述准确性：准确**

经验证 `src/stages/execute-install.ts:549` `basename(srcPath).toLowerCase()`。JavaScript `String.prototype.toLowerCase()` 受运行时 ICU/locale 影响：
- 在 Turkish (tr-TR) / Azerbaijani locale 下，`I.toLowerCase()` → `ı`（dotless i, U+0131）
- 而 Set 中常量 `claude.md` 使用 ASCII `i`，两者不匹配
- 因此 Turkish locale 用户的 `CLAUDE.MD`（含 `D` 大写）→ `claude.md` 是匹配的，但若文件名为 `CLAUDIA.md`（含 `I`）→ `claudıa.md` 则不会命中（与本场景关联较弱）

更严格地，`AGENTS.MD` 中的 `S` 不涉及；`SETTINGS.JSON` → `settings.json` 在 tr 下也正常（无 `I`）；唯一明显风险是清单中可能未来引入含 `I` 的保留名。

但**最佳实践仍是显式锁定 locale**，避免环境依赖。

**严重性判断：合理**

当前清单中无 `I` 字符的保留名（claude.md, agents.md, settings.json, settings.local.json, claude.local.md, agents.local.md, .claudeignore），实际触发概率极低；但属于已知 JS 大小写陷阱，未来扩展保留名时易踩坑。P2 — 修复成本极低（1 个方法调用替换），建议本轮一并。

**修复建议：可行**

改用 `basename(srcPath).toLocaleLowerCase('en-US')` 锁定 locale；或显式 ASCII 转换（替换 [A-Z]→[a-z]）。补 i18n locale 测试（mock `process.env.LANG = 'tr_TR.UTF-8'`）。

**误报评估：非误报**

---

## 发现 #5 评估

### 审查原文

> **[中][新] migration 文档承诺「安装 Copilot 扩展后重新执行 aiforge install」会让 `~/.copilot/` 出现，与实际 Copilot 行为不符**
> - 来源：blind
> - 分类：patch

### 评估结论：✅ 确认有效 — 建议本轮一并修复（P2 优先级）

### 评估分析

**问题描述准确性：准确**

经验证：
- `docs/migration-v2.md:73` `② Install the GitHub Copilot extension and re-run aiforge install`
- `docs/migration-v2.zh.md:72` `② 请安装 GitHub Copilot 扩展后重新执行 aiforge install`
- GitHub Copilot 扩展实际配置位置在 IDE 配置目录（VS Code: `~/.vscode/extensions/github.copilot-*`、`~/.config/Code/User/...` 等），**不创建 `~/.copilot/`**
- TOOL_DEFINITIONS.copilot 的 detect.global 是 `['~/.copilot']`（aiforge 约定路径，非 Copilot 扩展实际位置）

按文档操作后用户仍 miss copilot 检测，vscodeMergedNote 仍触发——"文档承诺解决方案 → 用户操作 → 现象未消除"循环。

**严重性判断：合理**

文档可信度问题——首次接触 migration 的用户会被误导。与 ID-6 互为因果。P2 — 文档校准成本低，建议本轮一并修复。

**修复建议：可行**

短期方案：FAQ 增加澄清——「`~/.copilot/` 是 aiforge 自身约定的标志路径；如未存在，可手动 `mkdir -p ~/.copilot/` 作为标识占位以让 aiforge 识别 copilot 上下文」。中英双语同步。

长期方案：与 ID-6 一并通过扩展 TOOL_DEFINITIONS.copilot.detect 多路径解决。

**误报评估：非误报**

---

## 发现 #6 评估

### 审查原文

> **[中][新][决策] detectLegacyVscodeOnly 与 TOOL_DEFINITIONS 中 copilot 检测路径 `~/.copilot/` 都与 Copilot 实际安装位置不符**
> - 来源：blind
> - 分类：decision_needed

### 评估结论：⚠️ 有效但需用户裁决 — 建议方向 B + 短期文档补丁（P3 优先级）

### 评估分析

**问题描述准确性：准确**

经验证 `src/data/tool-registry.ts:11-17` copilot.detect.global = `['~/.copilot']`；`src/stages/detect-tools.ts:99` detectLegacyVscodeOnly 中 copilot 路径为 `join(home, '.copilot')`。

GitHub Copilot 扩展实际配置：
- VS Code 内置：`~/.vscode/extensions/github.copilot-*/`
- 配置文件：`~/.config/Code/User/settings.json`（含 copilot 配置）
- macOS：`~/Library/Application Support/Code/User/...`

`~/.copilot/` 是 aiforge 自定义的约定标识路径，**非** Copilot 扩展真实创建的位置。

**严重性判断：偏高**

这是 Story 3.1 设计阶段就确定的项目级既有设计选择（参见 `architecture/03-core-decisions.md#D5` ToolDefinition 设计），非 Story 7-1 引入。降为 P3 — 需用户裁决保留约定路径还是扩展为多路径检测。

**修复建议：可行（但需决策）**

- 方向 A：扩展 TOOL_DEFINITIONS.copilot.detect 支持多路径（含 IDE 实际位置）— 检测准确度提升但对 IDE/OS 矩阵敏感
- 方向 B（推荐）：保持当前约定路径，在 migration 文档中明确说明 `~/.copilot/` 是 aiforge 内部标识（已在 ID-5 修复中包含此澄清，方向 B 与 ID-5 重叠）
- 方向 C：推迟到 Story 7-2 或专项 Story 治理 copilot 检测路径

考虑到 Round 1/2 已默认保持约定路径，建议方向 B + 通过 ID-5 文档补丁解决本轮问题。

**误报评估：非误报**

---

## 发现 #7 评估

### 审查原文

> **[中][新][决策] reserved-name 保护仅覆盖 `claude:instructions`，未保护 `claude:agents` 写入 `.claude/agents/CLAUDE.md` 等场景**
> - 来源：blind
> - 分类：decision_needed

### 评估结论：⚠️ 有效但需用户裁决 — 建议方向 B（维持现状 + 文档说明，P3 优先级）

### 评估分析

**问题描述准确性：准确**

经验证 `src/stages/execute-install.ts:546-555` 守卫条件含 `item.rule.tool === 'claude' && item.rule.sourceDir === 'instructions'`。`tests/stages/execute-install.test.ts:1840-1860` 显式测试 `non-claude-instructions rules can install CLAUDE.md`——属于设计决策。

**严重性判断：偏高**

`.claude/agents/CLAUDE.md` 与 `.claude/CLAUDE.md` 不在同一路径——前者位于 `agents/` 子目录，Claude Code 不会把 `agents/CLAUDE.md` 视为顶级配置文件。守卫范围限定 `sourceDir === 'instructions'` 是合理的设计选择：

1. 只有 `instructions` 源目录的文件会直接写入 `~/.claude/` 或 `.claude/` 根目录（Claude Code 顶级配置位置）
2. `agents/` 源目录的文件写入 `~/.claude/agents/` 或 `.claude/agents/`（子目录，不与 Claude Code 顶级配置冲突）

因此「未保护 agents/CLAUDE.md」实际上不构成 Round 1 ID-5 的真实风险面。审查的扩展守卫论断更多是「防御性命名一致性」而非安全风险。P3 — CR TODO 跟踪。

**修复建议：可行（但需决策）**

- 方向 A：扩展守卫到所有 claude:* 规则（去 sourceDir 限定）— 防御过度
- 方向 B（推荐）：维持当前守卫范围，文档明确「reserved-name 保护针对 instructions 直接写入顶级配置目录场景；agents/CLAUDE.md 等子目录文件不受保护」
- 方向 C：维持现状 + 纳入 CR TODO 未来 Story 治理

测试已显式允许 `agents/CLAUDE.md` 复制，方向 B 与现状一致。

**误报评估：非误报**

---

## 发现 #8 评估

### 审查原文

> **[低][新] CHANGELOG 「Existing ~/.vscode/ files NOT modified」叙述与新规则 `copilot:project:mcp-tools → .vscode/` 写入项目根 `.vscode/` 存在歧义**
> - 来源：blind
> - 分类：patch

### 评估结论：✅ 确认有效 — 建议本轮一并修复（P3 优先级）

### 评估分析

**问题描述准确性：准确**

经验证 `CHANGELOG.md:11` `Existing ~/.vscode/ files are NOT modified (NFR-C7 compliance)`；新规则 `copilot:project:mcp-tools → .vscode/` 写入项目根。

home 级 `~/.vscode/` 与项目级 `.vscode/` 是两个完全不同的路径，但用户读 CHANGELOG 「~/.vscode/」时可能未仔细区分前缀，误以为 v2.0 不会写入任何 `.vscode/` 路径。

**严重性判断：合理**

文档完整性问题，P3。

**修复建议：可行**

CHANGELOG 改为：`Existing files under user's home directory (~/.vscode/) are NOT modified (NFR-C7 compliance). Note: project-level .vscode/ will receive mcp-tools writes via copilot project-scope rules when GitHub Copilot is detected.` 中英双语同步。与 R2 ID-7 双写文档说明合并处理可降本。

**误报评估：非误报**

---

## 发现 #9 评估

### 审查原文

> **[低][新] claudeInstructionsReservedSkip 警告消息使用 `{targetDir}` 渲染模板路径，与 resultItem 的 `targetGroupPath`（绝对路径）不一致**
> - 来源：blind+auditor
> - 分类：patch

### 评估结论：✅ 确认有效 — 建议本轮一并修复（P3 优先级）

### 评估分析

**问题描述准确性：准确**

经验证 `src/stages/execute-install.ts:551-555` reporter.warn 使用 `item.rule.targetDir`（模板路径如 `~/.claude/`）；line 560-561 push 到 resultItems 时 `targetGroupPath: item.targetPath`（pathResolver 解析后的绝对路径）。

**严重性判断：合理**

用户调试时 warning 显示模板路径、最终展示绝对路径——双重表述易产生「实际是哪个目录被保护？」困惑。P3 — 修复成本极低（一个字段替换）。

**修复建议：可行**

统一用 `item.targetPath` 渲染 warning（用户友好的绝对路径），或在 reporter 文案中同时呈现两种路径。

**误报评估：非误报**

---

## 发现 #10 评估

### 审查原文

> **[低][新] migration 文档 vaporware：「aiforge.json planned for a future release」无 issue 链接或里程碑**
> - 来源：blind
> - 分类：patch

### 评估结论：✅ 确认有效 — 建议本轮一并修复（P3 优先级）

### 评估分析

**问题描述准确性：准确**

经验证 `docs/migration-v2.md:111` `aiforge.json (planned for a future release)`；`docs/migration-v2.zh.md:110` `aiforge.json 覆盖规则（规划中的功能）`。无 GitHub issue 链接、Story 编号或里程碑。

**严重性判断：合理**

违背项目 `CLAUDE.md` 顶部「不假设不猜测 / 不为不可能的功能创建虚假实现」承诺。P3 — 文档完整性。

**修复建议：可行**

替换为「For now, use `--tools copilot` to get `.vscode/` project-level MCP support. (If you need per-project rule overrides, please file an issue.)」或附 GitHub issue/Story 链接。中英双语同步。

**误报评估：非误报**

---

## 整体评估结论

### 需要修复（阻塞交付）

无单点 [高] 阻塞项。但以下三项联动建议在本轮一并修复以闭合 R2 修复承诺并修复 NFR-S5 早返回：

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | Flatten 分支 reserved-name 守卫缺失 | [中] | **P2** | 闭合 R2 ID-1 (a) 「三种 InstallType」承诺 |
| 2 | reserved-skip 跳过 validateDestPathSecurity | [中] | **P2** | NFR-S5 早返回风险，防御深度 |
| 3 | reserved-skip 导致 completePhase 误导 | [中] | **P2** | 用户感知与拦截事实分离 |

### 建议本轮一并修复（非阻塞但成本低）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 4 | toLowerCase Turkish locale | [中] | **P2** | i18n locale 边界防御 |
| 5 | migration 文档与 Copilot 实际行为不符 | [中] | **P2** | 文档可信度，与 ID-6 合并 |
| 8 | CHANGELOG ~/.vscode/ 叙述歧义 | [低] | **P3** | 与 R2 ID-7 双写说明合并 |
| 9 | reserved-skip 消息路径不一致 | [低] | **P3** | 字段替换 |
| 10 | aiforge.json vaporware 表述 | [低] | **P3** | 文档完整性 |

### 需用户裁决

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 6 | copilot 检测路径与实际位置不符 | [中] | **P3** | 项目既有设计选择，建议方向 B + 通过 ID-5 文档解决 |
| 7 | reserved-name 守卫仅覆盖 instructions | [中] | **P3** | 测试已显式允许 agents/CLAUDE.md，建议方向 B 维持现状 + 文档说明 |

### 可忽略（误报）

本轮无明确误报项。

### 评估决定

- **发现 #1（Flatten 覆盖偏差）**：必修 — 在 Flatten 分支顶部加同样守卫，闭合 R2 承诺
- **发现 #2（NFR-S5 早返回）**：必修 — 调整守卫与 validateDestPathSecurity 顺序
- **发现 #3（completePhase 误导）**：必修 — reserved-skip 触发额外 warn 或区分摘要
- **发现 #4（Turkish locale）**：建议本轮一并 — `toLocaleLowerCase('en-US')`
- **发现 #5（migration Copilot 路径）**：建议本轮一并 — FAQ 澄清 + 与 ID-6 重叠
- **发现 #6（copilot 检测路径）**：**需用户裁决** — 方向 B（维持约定 + 文档说明）推荐
- **发现 #7（守卫范围）**：**需用户裁决** — 方向 B（维持现状 + 文档说明）推荐，与现有测试一致
- **发现 #8（CHANGELOG 叙述）**：建议本轮一并 — 与 R2 ID-7 合并
- **发现 #9（消息路径不一致）**：建议本轮一并 — 字段替换
- **发现 #10（vaporware）**：建议本轮一并 — 文档表述
- **R2 ID-1 (d)(e) / R2 ID-2~10 / R1 全部 CR TODO**：维持现状，未被恶化

### 复审判定

- **本轮新增阻塞项**：无单点 [高] 阻塞
- **R2 已修复项**：(b)(c) 完整落地；(a) 存在 Flatten 覆盖偏差（本轮 ID-1）
- **AC 满足度**：AC #1-#6 全部满足，质量门禁通过（848/848）
- **建议**：本轮可选择两条路径：
  - **路径 A（推荐）**：本轮内修复 ID-1 + ID-2 + ID-3 + ID-4 + ID-5 + ID-8 + ID-9 + ID-10（8 项中/低）+ ID-6/ID-7 用户裁决后通过；进入 Round 4 验收
  - **路径 B**：本轮全部 [中]/[低] 下放 CR TODO；直接通过（前提：用户对 Flatten 覆盖偏差与 NFR-S5 早返回风险知情同意）
- 推荐路径 A 以闭合 R2 承诺 + 修复 NFR-S5 风险 + 提升文档可信度

---

## 修复执行记录

### 修复执行记录
- **Date**: 2026-05-11
- **Model Used**: Claude Sonnet 4.6 (claude-sonnet-4-6)
- **Fix Items**: 8 项（ID-1, 2, 3, 4, 5, 8, 9, 10）+ ID-6/7 方向 B（用户裁决：不改代码）

| 修复 ID | 发现描述 | 修复文件 | 修复结果 |
|---------|---------|---------|---------|
| ID-1 (P2) | Flatten 分支缺少 reserved-name 守卫（R2 承诺未闭合） | `src/stages/execute-install.ts` | ✅ 已修复：在 Flatten `for srcDir` 循环顶部加 `validateDestPathSecurity` 前置 + reserved-name 守卫（`targetName.toLocaleLowerCase('en-US')` + `reservedSkipCount++`）；补 1 组 Flatten 场景测试 |
| ID-2 (P2) | reserved-skip early-return 跳过 `validateDestPathSecurity`（NFR-S5） | `src/stages/execute-install.ts` | ✅ 已修复：将 `validateDestPathSecurity(destPath, allowedRoot)` 移至 Files/Directories 共享循环顶部（reserved-name 守卫之前）；移除 Directories 分支内的冗余调用；Flatten 分支同步前置 |
| ID-3 (P2) | reserved-skip 导致 completePhase 输出"全部已是最新或被跳过"误导用户（方案 B） | `src/stages/execute-install.ts`, `src/core/messages.ts` | ✅ 已修复：新增 `reservedSkipCount` 计数器；安装循环结束后若 `reservedSkipCount > 0` 则 `reporter.warn(reservedSkippedSummary)`；messages.ts 新增中英双语 `reservedSkippedSummary` 消息；补 1 组聚合 warn 测试 |
| ID-4 (P2) | `toLowerCase()` 受 Turkish locale 影响 | `src/stages/execute-install.ts` | ✅ 已修复：Files/Directories 守卫改为 `toLocaleLowerCase('en-US')`；Flatten 守卫同步使用 `toLocaleLowerCase('en-US')` |
| ID-5 (P2) | migration 文档 Copilot 路径说明误导用户（② 提示"安装扩展"而非"mkdir marker"） | `docs/migration-v2.md`, `docs/migration-v2.zh.md` | ✅ 已修复：warn 文本 ② 改为「创建 ~/.copilot/ 作为 aiforge 标识目录」；中英双语均新增 Note 块说明 `~/.copilot/` 是 aiforge 约定标识而非 Copilot 实际安装位置，并提供 `mkdir -p ~/.copilot/` 命令 |
| ID-6 (P3) | copilot 检测路径与实际不符 | — | ⏭️ 用户选择方向 B：维持约定路径，ID-5 文档补丁已覆盖说明需求；无代码变更 |
| ID-7 (P3) | reserved-name 守卫仅覆盖 instructions | `src/stages/execute-install.ts` | ⏭️ 用户选择方向 B：维持现状；在守卫注释中明确说明「agents/ 子目录写入不冲突，不在保护范围内（方向 B，CR R3 ID-7）」 |
| ID-8 (P3) | CHANGELOG `~/.vscode/` 叙述与 copilot:project 写入项目 `.vscode/` 存在歧义 | `CHANGELOG.md` | ✅ 已修复：NFR-C7 行改为「Existing files under `~/.vscode/` (user home) are NOT modified... Note: project-level `.vscode/` will receive mcp-tools writes...」 |
| ID-9 (P3) | reserved-skip 消息使用模板路径 `{targetDir}` 而非绝对路径 | `src/stages/execute-install.ts`, `src/core/messages.ts` | ✅ 已修复：warn 调用改为 `.replace('{targetDir}', item.targetPath)`（绝对路径）；messages.ts 描述字段从「目标:」改为「目标目录:」保持可读性 |
| ID-10 (P3) | migration 文档 vaporware aiforge.json 表述 | `docs/migration-v2.md`, `docs/migration-v2.zh.md` | ✅ 已修复：中英双语均移除「planned for a future release」，替换为「使用 --tools copilot 获取项目级 MCP 支持；如需自定义能力请提交 Issue」 |

### 质量门禁验证结果

```
npm test:    850 tests passed (33 test files, 新增 2 个测试) ✅
npm run lint:src: ESLint + Prettier 全部通过 ✅
npm run build:  dist/index.js 135.54 KB，build success ✅
```
