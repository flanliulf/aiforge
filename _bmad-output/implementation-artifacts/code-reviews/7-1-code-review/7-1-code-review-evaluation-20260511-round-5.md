---
Story: 7-1
Round: 5
Date: 2026-05-11
Model Used: Claude Opus 4.7 (claude-opus-4-7)
Review Source: 7-1-code-review-summary-20260512-round-5.md
Review Model: GPT-5 Codex (gpt-5)
Type: Code Review Evaluation
---

## 评估总结

对 Story 7-1 的第 5 轮 CR 代码审查结果（复审）进行逐条评估。本轮审查共发现 7 条新问题（0 高 / 6 中 / 1 低），无审查层失败。Round 4 的两个核心修复点（`vscodeMergedNote` 文档/代码不一致、全 reserved-skip 的 `completePhase` 语义冲突）已经过代码独立验证并实际闭合；但 R4 ID-1 在做文档对齐时把 AC #3 明确要求的 “GitHub Copilot 扩展安装指引” 挤掉，构成新的 AC #3 回归。

经逐条独立代码验证，**结论与原审查基本一致**：

- 发现 #1（AC #3 回归）：`messages.ts:538-542` / `:825-829` ① ② ③ 均不再提到 “安装 GitHub Copilot 扩展”，与 AC #3 明文契约相违，**必修（P1 阻塞性）**
- 发现 #2（项目级 `.vscode/` 误触发）：`detect-tools.ts:101` 条件 `(vscodeHomeExists || vscodeProjExists) && !copilotExists` 已被测试固化，影响几乎所有 VS Code 项目用户的首次安装体验，**必修（P2）**
- 发现 #3（配置文档 `vscode` 残留）：`docs/configuration.md:78` / `docs/configuration.zh.md:78` 仍把 `vscode` 列为合法 `--tools` 值，与 `TOOL_DEFINITIONS` 实际 3 工具直接矛盾，违反 AC #4 “Breaking Change 有完整文档依据”，**必修（P2）**
- 发现 #4（`.vscode/` 集成测试缺失）：`pipeline.test.ts:961-963` 显式声明推迟到 Story 7-10；AC #2 “生效” 语义对 “数据层有规则 vs 端到端写入” 含糊，**需用户裁决**是否本轮补一个最小集成用例
- 发现 #5（Rule Document Registry 同步不完整）：`project-context.md:242` 仅列 4 个示例保留名，与 03/04 两份文档的 7 项完整清单不一致，且缺多条规则边界说明，**必修（P2）**
- 发现 #6（migration FAQ `--force` “skip” 措辞）：英文版 `migration-v2.md:105` 措辞易被读为 “保留文件”，中文版相对清楚，**建议本轮一并修复（P3）**
- 发现 #7（CHANGELOG / migration-v2 仍为 untracked）：经 `git status --short` 验证属实，属交付完整性而非代码缺陷，**建议本轮 `git add` 或纳入发布 checklist（P3）**

**整体结论**：本轮无审查误报；建议本轮一并闭合 #1 + #2 + #3 + #5 + #6 + #7；#4 用户裁决方向（本轮补最小集成用例 / 维持推迟到 7-10）后再决定。

---

## 上轮问题回顾确认

### Round 4 / Finding #1（`vscodeMergedNote` ② 项与 migration-v2 文档样例不一致）：✅ 已修复 — 但引入本轮 #1 回归

经代码独立验证：
- `src/core/messages.ts:538-542`（zh）② 项 = 「创建 ~/.copilot/ 作为 aiforge 标识目录后重新执行 aiforge install」
- `src/core/messages.ts:825-829`（en）② 项 = 「Create ~/.copilot/ as an aiforge marker, then re-run aiforge install」
- `docs/migration-v2.md:70-74` / `docs/migration-v2.zh.md:70-73` 样例输出已与 messages 实际文案对齐

文档↔代码一致性问题闭合。但代价是删除了原 ② 项 “安装 GitHub Copilot 扩展” 指引，构成本轮 #1（AC #3 回归）。

### Round 4 / Finding #3（reserved-skip 全部命中时 `completePhase` 语义冲突）：✅ 已修复

经代码独立验证：
- `src/stages/execute-install.ts:766-770` 在 `reservedSkipCount === processedCount` 时使用 `reservedSkippedOnlySummary`，已脱离通用灰色 `skippedOnlySummary`
- `src/core/messages.ts:502-503`（zh）/ `:788-789`（en）已新增专属文案
- `src/core/types.ts` `InstallResult` 增加 `reservedSkipCount` 字段
- `tests/stages/execute-install.test.ts:2308-2366` 覆盖全 reserved-skip 与 mixed reserved-skip 两个场景

R3 ID-3 → R4 ID-3 修复方向 A 已彻底落地，语义冲突闭合。

### Round 4 / Finding #5（Rule Document Registry 三文档同步）：⚠️ 部分通过 — `project-context.md` 仍有缺项

经代码独立验证：
- `_bmad-output/planning-artifacts/architecture/03-core-decisions.md:215-231` 已补齐 vscodeMergedNote 检测设计与 reserved-name 强制保护，包含完整 7 项保留名清单与 `--force` 无效 / 黄色摘要 / 三种 InstallType 等规则边界
- `_bmad-output/planning-artifacts/architecture/04-implementation-patterns.md:730-754` 已补齐对应章节与 7 项保留名集合
- `_bmad-output/project-context.md:242` 仅列出 4 项保留名示例（`CLAUDE.md, AGENTS.md, settings.json, settings.local.json`），缺 `claude.local.md` / `agents.local.md` / `.claudeignore`；且未说明 “三种 InstallType 受保护 / `--force` 无效 / 全 reserved-skip 黄色摘要”

R4 修复执行记录里也写明 “project-context.md 已于 R3 同步，本轮无需改动”，但未注意到 R3 同步的内容相对 03/04 文档不完整。本轮 #5 是合理的后续发现。

### Round 4 / Finding #2（Unicode 同形字符与 NFC/NFD 规范化风险）：维持 CR TODO（P3）

未在本轮 R5 重新出现，与 R4 评估结论一致：威胁面有限，建议 CR TODO 跟踪。

### Round 4 / Finding #4（全部 reserved-skip 时 `ensureDir` 仍创建空目录）：维持 CR TODO（P3）

未在本轮 R5 重新出现，与 R4 评估结论一致：触发概率低，建议 CR TODO 跟踪。

### 历史 CR TODO（非阻塞）

| # | 发现 | 状态 | 评估意见 |
|---|------|------|---------|
| R4-#2 | Unicode 同形字符与 NFC/NFD 规范化 | CR TODO（P3） | 维持，本轮无变化 |
| R4-#4 | 全 reserved-skip 时 `ensureDir` 创空目录 | CR TODO（P3） | 维持，本轮无变化 |
| R4-#6 | `detectLegacyVscodeOnly` 项目级 `.vscode/` 噪声 | 已升级为本轮 #2 必修 | 由于测试已显式固化错误行为，且影响面被进一步确认，建议从 P3 升至 P2 本轮闭合 |
| R4-#7 | `mkdir ~/.copilot/` 反模式 | CR TODO（P3） | 维持，长期重构 |
| R4-#9 | Flatten 守卫先于 `mainPath` 检查 | CR TODO（P3） | 维持 |
| R4-#10 | `diagnoseZeroResults` 早返被污染 | CR TODO（P3） | 维持 |
| R4-#12 | 聚合 warn 测试断言过弱 | CR TODO（P3） | 维持 |
| R4-#13 | dry-run `includes('.cursor')` 过滤 | CR TODO（P3） | 维持 |

---

## 发现 #1 评估

### 审查原文

> **[中][新] AC #3 回归：migration 警告不再包含 “如何安装 GitHub Copilot 扩展”**
> - 来源：auditor
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（**P1 阻塞性优先级**，闭合 AC #3 契约）

### 评估分析

**问题描述准确性：准确**

经代码独立验证：
- Story AC #3（`_bmad-output/implementation-artifacts/stories/7-1-vscode-merge-and-mvp-rules-completion.md:25-29`）明确要求：「提示内容包含：如何安装 GitHub Copilot 扩展以继续使用 aiforge MCP 管理」
- Story Task 4.4（同文件 `:62-64`）原始设计 ② 项即为「安装 GitHub Copilot 扩展后重新执行 `aiforge install`」
- 当前 zh 文案（`src/core/messages.ts:538-542`）三项：
  - ① VS Code MCP 现由 Copilot 项目级规则承接（目标路径 `.vscode/mcp.json`）
  - ② 创建 `~/.copilot/` 作为 aiforge 标识目录后重新执行 `aiforge install`
  - ③ 现有 `~/.vscode/` 文件不会被覆盖或删除
- 当前 en 文案（`src/core/messages.ts:825-829`）三项与 zh 等价；均不再提及 “Install the GitHub Copilot extension”

AC #3 明文契约（“包含：如何安装 GitHub Copilot 扩展”）在 R4 修复期间被错误删除。多来源审查（auditor）单独命中，但代码侧证据完整且唯一，可信度高。

**严重性判断：合理（应升级 P1 阻塞性）**

理由：
1. AC #3 是本 Story 的核心验收点之一（vscode-only 用户迁移路径），代码与 AC 明文不符属于 false-pass 风险
2. 用户在不安装 Copilot 扩展的情况下只 `mkdir ~/.copilot/` marker，会再次走到 NO_TOOLS 路径或 copilot 规则匹配为空，安装结果不可预期
3. 修复成本极低（每个语言增加 1 行 ② 项即可，原 ② 项变为新 ②，原 ③ 顺延为 ④；或在现有 ② 中合并 “安装扩展 + 创建 marker” 两步）

**修复建议：可行**

方案 A（推荐 — 三步并列）：
```
① VS Code MCP 现由 Copilot 项目级规则承接（目标路径 .vscode/mcp.json）
② 安装 GitHub Copilot 扩展
③ 创建 ~/.copilot/ 作为 aiforge 标识目录后重新执行 aiforge install
④ 现有 ~/.vscode/ 文件不会被覆盖或删除
```
- 同步更新 `docs/migration-v2.md` / `docs/migration-v2.zh.md` 样例输出

方案 B（在现 ② 中合并两步，结构更紧凑）：
```
② 安装 GitHub Copilot 扩展，并创建 ~/.copilot/ 作为 aiforge 标识目录后重新执行 aiforge install
```
- 优点：保持三项结构、改动最小
- 缺点：可读性略差

**强烈建议方案 A**（结构清晰、与 AC #3 用词对齐）。同步补 `tests/stages/detect-tools.test.ts` 断言 warn 文本包含 “Copilot 扩展 / Copilot extension” 关键词，避免后续再次回归。

**误报评估：非误报**

---

## 发现 #2 评估

### 审查原文

> **[中][新] 项目级 `.vscode/` 会误触发 legacy VS Code migration 提示**
> - 来源：blind+edge
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（**P2 优先级**，本轮闭合）

### 评估分析

**问题描述准确性：准确**

经代码独立验证：
- `src/stages/detect-tools.ts:94-101` `detectLegacyVscodeOnly()` 条件：`(vscodeHomeExists || vscodeProjExists) && !copilotExists`
- `src/stages/detect-tools.ts:85-92` 注释表述为 “vscode-only 用户”，但实际 OR 条件包含项目级 `.vscode/`
- `tests/stages/detect-tools.test.ts:483-497` 用例 “CR Fix #1：项目级 `.vscode/` 存在 + `~/.copilot/` 不存在 → vscodeMergedNote 输出” 显式固化该行为
- 文案声明 “Detected `~/.vscode/`” 但触发时实际可能只是 `<cwd>/.vscode`，存在文案/事实偏差

普通 VS Code 项目几乎都有 `.vscode/launch.json` / `.vscode/settings.json` —— 该测试用例实际等于把 “任何 VS Code 项目” 都视为 v1.x 迁移用户。

**严重性判断：合理（P2，建议本轮闭合）**

理由：
1. AC #3 明文限定迁移场景为 “存在 `~/.vscode/` 目录但无 `~/.copilot/` 目录”（**home 级**）
2. 当前实现违反 AC #3 中 `~/.vscode/`（home）的明文表达，扩大了触发面
3. 与 #1（AC #3 回归）共同形成 “提示内容不准 + 触发面不准” 双重 AC #3 偏差
4. 文案声明 home 路径但触发实际包含项目路径，对用户具有误导性
5. 该误报在测试中**被显式固化**，仅修代码不修测试会失败；修复需同步调整测试，成本中等但可控
6. R4 评估对此问题给的判断是 “[低] P3”，但当时基于 “影响 UX、不影响功能” 的判断；本轮重新审视后，结合测试已固化错误行为 + 文案/事实不一致 + AC #3 表述不符 三重因素，应升至 P2

**修复建议：可行**

方案 A（推荐 — 收窄到 AC #3 文字契约）：
```typescript
async function detectLegacyVscodeOnly(pathResolver: PathResolver): Promise<boolean> {
  const home = pathResolver.home()
  const [vscodeHomeExists, copilotExists] = await Promise.all([
    pathExists(join(home, '.vscode')),
    pathExists(join(home, '.copilot')),
  ])
  return vscodeHomeExists && !copilotExists
}
```
- 同步删除/调整 `tests/stages/detect-tools.test.ts:483-497` 的 “CR Fix #1” 用例（或改为反向断言：仅项目级 `.vscode/` 不触发 vscodeMergedNote）

方案 B（保留项目级触发但拆分文案）：
- 增加独立提示 “Detected `<cwd>/.vscode` … 这是项目级 VS Code 配置，不在 v1.x aiforge 管理范围” 与 home 级文案分开
- 实现复杂度高，且不解决 AC #3 表述偏差，不推荐

强烈建议方案 A。

**误报评估：非误报**

---

## 发现 #3 评估

### 审查原文

> **[中][新] 配置文档仍把 `vscode` 列为合法 `--tools` 值**
> - 来源：edge+auditor
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（**P2 优先级**，闭合 AC #4 完整性）

### 评估分析

**问题描述准确性：准确**

经代码独立验证：
- `docs/configuration.md:78`：`Target tools: \`copilot\`, \`claude\`, \`cursor\`, \`vscode\``
- `docs/configuration.zh.md:78`：`目标工具：\`copilot\`、\`claude\`、\`cursor\`、\`vscode\``
- `src/data/tool-registry.ts:9-34` 真实 `TOOL_DEFINITIONS` 仅 3 个：copilot / claude / cursor
- `src/stages/detect-tools.ts:160-181` 手动 `--tools vscode` → 抛 `AiforgeError('UNKNOWN_TOOL', EXIT_ARG_ERROR, 'fatal')`

文档↔代码偏差直接可观察。两层审查（edge + auditor）同时命中，可信度高。

**严重性判断：合理（P2）**

理由：
1. AC #4 要求 “Breaking Change 有完整文档依据”，`docs/configuration.md` 是项目核心 CLI 参考；按文档执行直接命中 fatal 错误，违反 AC #4 完整性契约
2. README 已更新 v2.0 迁移说明，但 configuration.md 是用户首要查阅的 CLI 参考；不一致会让用户怀疑 “是否文档先更新而代码未跟上”
3. 修复成本极低（双语两行 `vscode` 词项移除 + 半句 v2.0 注解）

**修复建议：可行**

方案 A（推荐）：
- 移除 “`vscode`” 词项
- 在表格脚注或同段落补一句：`v2.0 起 vscode 已归并到 copilot：使用 --tools copilot 获取 .vscode/ 项目级 MCP 支持。详见 docs/migration-v2.md`

方案 B：在 README 已有 v2.0 提示框基础上单独在 configuration.md 顶部加入 “v2.0 工具列表变更” 提示框，但内容会与 README 重复。

建议方案 A。

**误报评估：非误报**

---

## 发现 #4 评估

### 审查原文

> **[中][新] `copilot:project:mcp-tools -> .vscode/` 缺少集成测试门禁**
> - 来源：blind+edge
> - 分类：patch

### 评估结论：⚠️ 有效但需用户裁决 — 建议方向 A（本轮补最小集成用例，P2）

### 评估分析

**问题描述准确性：准确**

经代码独立验证：
- `tests/data/install-rules.test.ts:42-56` 仅验证规则存在（数据层）：copilot 项目级 9 条规则、`.vscode/` targetDir 规则存在
- `tests/integration/pipeline.test.ts:928-958` 现有 `copilot:project` 集成测试断言：
  - `.github/skills/code-review`（skills Directories）
  - `.github/CLAUDE.md`（instructions Files）
  - `.github/server.json`（mcp-tools Files → `.github/`）
  - **未断言**：`.vscode/server.json` 或 `.vscode/<任意 mcp-tools 内容>`
- `tests/integration/pipeline.test.ts:961-963` 显式注释 “copilot:project mcp-tools → .vscode/ 的集成测试在 Story 7-10 统一补齐”
- AC #2 要求 “copilot 新增 `.vscode/mcp.json` 项目级 MCP 规则**生效**” —— “生效” 在 Story 范围内的可观察证据应是端到端写入

**严重性判断：合理（建议 P2）**

理由：
1. AC #2 端到端语义：当前仅有 unit 级证据（规则存在），缺端到端证据（write happens）
2. 引擎层逻辑虽对所有 Files 类型规则统一处理，但 `.vscode/` 是从 vscode 归并而来的 v2.0 替代路径，是 Breaking Change 的核心 “等价替代”，本 Story 不验证就难以闭合 AC #2 与 AC #4
3. `pipeline.test.ts:942` `expect(plan.items.length).toBe(copilotProjectRules.length + UNIVERSAL_RULES.length)` 仅证明 plan 包含规则，没有断言 install 阶段 `.vscode/` 路径文件是否写出

**反方观点**：
- Story 7-10 “统一补齐 MVP 工具集成测试” 是计划内的工程权衡，推迟一个版本不影响真实业务（pipeline 引擎对所有 Files 规则同质处理）
- 现有 `copilot:project` 集成测试已覆盖 mcp-tools → `.github/`，间接验证引擎 Files 路径写入

**最终建议**：
- 用户裁决方向 A（推荐）：本轮补一个最小集成断言（约 3 行：在现有 `copilot:project` 测试中追加 `.vscode/<file>` 存在性断言或新增一个独立 it block）
- 用户裁决方向 B：维持 R5 审查接受的推迟方案，但应：① 在 `pipeline.test.ts:961-963` 注释中补一个明确的 7-10 Story 引用编号；② 在 cr-todo-backlog 中显式登记 “AC #2 `.vscode/` 端到端验证：跨 Story 推迟到 7-10” 以保持可追溯性

**修复建议：可行（方向 A 成本极低）**

方案 A 实现示意（在 `tests/integration/pipeline.test.ts:928-958` 现有 `it('copilot:project — ... 全链路安装')` 中追加）：
```typescript
// v2.0: mcp-tools 同时写入 .github/ 与 .vscode/（fixture mcp-tools 至少 1 个文件）
const vscodeMcpTarget = pathJoin(tmpDir, '.vscode', '<fixture-filename>.json')
await expect(fsAccess(vscodeMcpTarget)).resolves.toBeUndefined()
```
（需确保 fixture `mcp-tools` 目录至少含一个文件）

**误报评估：非误报**

---

## 发现 #5 评估

### 审查原文

> **[中][新] Rule Document Registry 同步不完整：`project-context.md` 的 reserved-name 清单缺项**
> - 来源：auditor
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（**P2 优先级**，闭合 Rule Document Registry 镜像约束）

### 评估分析

**问题描述准确性：准确**

经代码独立验证三份文档当前状态：

1. `_bmad-output/project-context.md:242`：
   ```
   v2.0 (Story 7-1): ... Reserved name protection added to execute-install.ts
   for claude:*:instructions chain (CLAUDE.md, AGENTS.md, settings.json,
   settings.local.json are always skipped even with --force).
   ```
   - 列出 **4 项** 示例：`CLAUDE.md` / `AGENTS.md` / `settings.json` / `settings.local.json`
   - 缺：`claude.local.md` / `agents.local.md` / `.claudeignore` 三项
   - 缺：三种 InstallType（Files / Directories / Flatten）均受保护的说明
   - 缺：全 reserved-skip 时 `completePhase` 走黄色专属摘要的语义

2. `_bmad-output/planning-artifacts/architecture/03-core-decisions.md:223-231`：
   - 完整列出 **7 项** 保留名集合
   - 完整描述三种 InstallType 覆盖、`--force` 无效、`validateDestPathSecurity` 与守卫顺序、全 reserved-skip 黄色摘要

3. `_bmad-output/planning-artifacts/architecture/04-implementation-patterns.md:740-754`：
   - 完整列出 **7 项** 保留名集合
   - 完整描述守卫应用于三种 InstallType 的代码示例

三文档清单与边界描述不一致，违反项目 CLAUDE.md 顶部 “Rule Document Registry 互为镜像” 约束。

R4 修复执行记录称 “project-context.md 已于 R3 同步，本轮无需改动”，但 R3 同步时只列了 4 项示例 + 总体描述，没有覆盖 R4 才补到 03/04 文档中的细节（三种 InstallType / `--force` 无效 / 黄色摘要等），所以本轮才暴露镜像缺口。

**严重性判断：合理（P2）**

理由：
1. 项目 CLAUDE.md 顶部明文规则：“凡是确认/修改/新增任何规则、约定或豁免，必须同步更新以下所有文档”
2. 后续 agent 若只读取主规则文件 `project-context.md`，会漏掉 3 项 reserved-name 边界与多条规则约束
3. 修复成本极低（在 `project-context.md:242` 已有句末追加完整 7 项清单与三条规则边界即可）
4. 与 R4 #5 决策方向 A 一脉相承（用户已选择补齐镜像），本轮是收尾镜像同步的最后一公里

**修复建议：可行**

方案 A（推荐）：在 `project-context.md:242` 现有段落末尾追加：
```
Full reserved-name set (case-insensitive, 7 items): claude.md, claude.local.md,
agents.md, agents.local.md, settings.json, settings.local.json, .claudeignore.
Protection applies to all three InstallType (Files / Directories / Flatten) for
claude:*:instructions; --force has no effect. When all source files are blocked,
completePhase outputs the dedicated yellow `reservedSkippedOnlySummary` instead
of the generic gray skipped summary.
```

方案 B：将 `project-context.md` reserved-name 段落抽出独立小节，结构上与 03/04 文档完全对齐 —— 成本更高但可读性提升

建议方案 A（最小改动 + 满足镜像约束）。

**误报评估：非误报**

---

## 发现 #6 评估

### 审查原文

> **[中][新] migration FAQ 将 `--force` 描述为 “skip”，可能误导用户覆盖手写 `.vscode/mcp.json`**
> - 来源：blind
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议本轮一并修复（**P3 优先级**）

### 评估分析

**问题描述准确性：基本准确（中英版风险不等）**

经代码独立验证：
- `docs/migration-v2.md:103-105`（en FAQ）：
  > **Q: Will my `.vscode/mcp.json` be overwritten if I run `aiforge install` with Copilot?**
  > A: Only if the file exists and was previously managed by aiforge (tracked in the manifest). If it's a user-written file, aiforge will prompt you before overwriting (or skip it with `--force`).
- `docs/migration-v2.zh.md:102-104`（zh FAQ）：
  > A：仅当该文件存在且之前由 aiforge 管理（记录在清单中）时才会覆盖。如果是用户手动创建的文件，aiforge 会在覆盖前提示确认（或使用 `--force` 跳过确认）。
- `src/core/messages.ts:520-522`（zh）/ `:807-809`（en）`--force` 真实语义 = “跳过交互式确认 / 跳过冲突确认”，即 “不再询问、直接按既定动作执行”（覆盖或继续安装）

**英文版风险点**：“skip it with `--force`” 中 “it” 指代不清，最自然的语法读法是 “skip the file with `--force`”（即跳过该文件），但实际语义是 “skip the prompt”（跳过确认 → 继续覆盖）。对 `.vscode/mcp.json` 这种用户配置文件，误读可能直接造成配置丢失。

**中文版相对清晰**：“跳过确认” 已经明确指向 prompt 而非 file，但与上下文 “在覆盖前提示确认” 并列，仍可能让部分用户认为 `--force` 是 “保留文件 / 跳过覆盖”，存在弱误导。

**严重性判断：偏高（建议降为 P3）**

理由：
1. 中文版语义较清楚，主要风险集中在英文版
2. 真实触发链路是 “用户手写 `.vscode/mcp.json` + Copilot 已检测 + 用户主动 `--force`”，链路较长且通常发生在熟练用户身上
3. 修复成本极低（每语言改写 1 行 FAQ），符合 “低成本高 ROI 一并修复” 标准

**修复建议：可行**

方案 A（推荐 — 英文版重写明确 “prompt” 与 “file” 的区分）：
```
If it's a user-written file, aiforge will prompt before overwriting; choose
"skip" in the prompt to preserve the file. `--force` skips the confirmation
prompt and will overwrite managed/conflicting files without asking — do not
use `--force` if you want to keep a hand-written `.vscode/mcp.json`.
```
（中文版同步改写：明确 “`--force` 是跳过确认提示，不是跳过文件写入；如需保留文件，请在交互提示中选择 ‘跳过’，不要使用 `--force`。”）

方案 B：维持原表述但在脚注或 Note 块追加 1 句 “`--force` = skip confirmation, not skip the file” 风险声明 —— 改动更小但仍易被忽略，不推荐

建议方案 A。

**误报评估：非误报，但中文版风险被审查略高估**

---

## 发现 #7 评估

### 审查原文

> **[低][新] 新增迁移文档和 CHANGELOG 仍为未跟踪文件，存在发布断链风险**
> - 来源：edge
> - 分类：patch

### 评估结论：⚠️ 有效但属交付工作流问题 — 建议本轮 `git add` 或纳入发布 checklist（**P3 优先级**）

### 评估分析

**问题描述准确性：准确**

经独立 `git status --short` 验证：
```
M README.md
 M README.zh.md
?? CHANGELOG.md
?? docs/migration-v2.md
?? docs/migration-v2.zh.md
```
- `CHANGELOG.md` / `docs/migration-v2.md` / `docs/migration-v2.zh.md` 均为 untracked
- `README.md:190` / `README.zh.md:190` 已经在 modified 状态中包含到 `migration-v2.md` 的链接 → 一旦提交只包含 tracked diff，将变成断链

**严重性判断：合理（P3）**

理由：
1. 该问题不是代码缺陷，是 git workflow 完整性问题
2. Story 7-1 Status 仍为 `review`，尚未到提交阶段，部分团队约定为 “待 CR 通过后再 stage”，因此严格意义上的违反点尚未发生
3. 但审查方提示 “发布或 PR 只包含 tracked diff” 的风险确实存在，且发布检查清单层面是合理的提前提醒
4. 修复成本接近 0（一次 `git add` 即可）

**修复建议：可行**

方案 A（推荐）：在本轮修复或 Story 7-1 status → done 之前执行：
```bash
git add CHANGELOG.md docs/migration-v2.md docs/migration-v2.zh.md
git status --short  # 确认无 ?? 项关联 v2.0 发布
```
并在 Story `bmm-workflow-status.yaml` / sprint-status 完成态前补一项 “release file integrity check”。

方案 B：纳入 cr-todo-backlog 作为 “release checklist” 提醒，由发布流程负责

建议方案 A。

**误报评估：非误报**

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | AC #3 回归：`vscodeMergedNote` 不含 “安装 Copilot 扩展” 指引 | [中] | **P1** | 直接违反 AC #3 明文契约，闭合本 Story 验收 |

### 建议本轮一并修复（非阻塞但成本低且收益高）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 2 | 项目级 `.vscode/` 误触发 legacy 提示（含测试固化） | [中] | **P2** | 测试已固化错误行为；与 #1 共同形成 AC #3 双重偏差 |
| 3 | `docs/configuration.md` 仍把 `vscode` 列为 `--tools` 值 | [中] | **P2** | AC #4 完整性，双语两行修复 |
| 5 | `project-context.md` reserved-name 清单缺 3 项 + 边界 | [中] | **P2** | 闭合 Rule Document Registry 镜像约束 |
| 6 | migration FAQ `--force` “skip” 措辞 | [中] | **P3** | 英文版重写 + 中文版同步澄清 |
| 7 | CHANGELOG / migration-v2 仍 untracked | [低] | **P3** | 一次 `git add` 修复 |

### 需用户裁决

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 4 | `copilot:project:mcp-tools → .vscode/` 缺集成测试 | [中] | **P2 / 推迟** | 推荐方向 A（本轮补最小集成断言）；方向 B 维持 7-10 推迟但需在 cr-todo-backlog 显式登记 |

### 可忽略（误报）

无。本轮审查 7 条全部经代码验证为真实问题。

### 评估决定

- **发现 #1（AC #3 回归）**：**必修（P1）** — 在 `src/core/messages.ts:538-542` / `:825-829` `vscodeMergedNote` 中加入 “安装 GitHub Copilot 扩展” 项；同步更新 `docs/migration-v2.md` / `.zh.md` 样例输出；同步补 `tests/stages/detect-tools.test.ts` 断言含 “Copilot 扩展 / extension” 关键词
- **发现 #2（项目级 `.vscode/` 误触发）**：**建议本轮（P2）** — `src/stages/detect-tools.ts:94-101` 收窄为仅检测 home `~/.vscode/`；删除或反转 `tests/stages/detect-tools.test.ts:483-497` 测试；同步删除 `detectLegacyVscodeOnly` 注释中 “或项目级 `.vscode/`” 表述
- **发现 #3（配置文档 vscode 残留）**：**建议本轮（P2）** — `docs/configuration.md:78` / `.zh.md:78` 移除 `vscode`，并补 v2.0 注解
- **发现 #4（`.vscode/` 集成测试）**：**需用户裁决** — 推荐方向 A（本轮补一个 `.vscode/<file>` 存在性断言到现有 `copilot:project` 集成 it block）；如选择方向 B，则需补 cr-todo-backlog 显式登记
- **发现 #5（Rule Document Registry 同步）**：**建议本轮（P2）** — `_bmad-output/project-context.md:242` 追加完整 7 项保留名 + 三种 InstallType + `--force` 无效 + 黄色摘要说明
- **发现 #6（FAQ `--force` 措辞）**：**建议本轮（P3）** — 英文 `migration-v2.md:103-105` 重写澄清 “skip prompt vs skip file”；中文同步澄清
- **发现 #7（untracked 文件）**：**建议本轮（P3）** — `git add CHANGELOG.md docs/migration-v2.md docs/migration-v2.zh.md`，发布前确认 `git status --short` 干净

### 复审判定

- **本轮新增阻塞项**：1 项（#1 AC #3 回归）
- **R4 已修复项**：3 项（R4 #1 `vscodeMergedNote` 文档对齐 / R4 #3 `completePhase` 语义冲突 / R4 #5 03+04 文档同步）；遗留 1 项收尾（R4 #5 `project-context.md` 镜像收尾 = 本轮 #5）
- **R4 CR TODO 维持**：6 项（R4 #2、#4、#7、#9、#10、#12、#13）
- **AC 满足度**：
  - AC #1（vscode 工具 ID 删除）：✅
  - AC #2（copilot/claude/cursor 新规则）：⚠️ 数据层 ✅；端到端验证 `.vscode/` 取决于 #4 裁决
  - AC #3（vscode-only 提示）：❌ 文案缺 “安装扩展” + 触发面误扩到项目级 `.vscode/`，本轮必修
  - AC #4（Breaking Change 文档依据）：⚠️ CHANGELOG / migration-v2 已有内容但 untracked（#7）；configuration.md 残留 vscode（#3）
  - AC #5（version 2.0.0）：✅
  - AC #6（质量门禁）：✅ Round 5 已实际执行 `npm test` 852/852、`npm run lint:src`、`npm run build`，全部通过

- **建议复审路径**：
  - **路径 A（推荐）**：本轮修复 #1 + #2 + #3 + #5 + #6 + #7（6 项），#4 用户裁决；CR TODO 维持 → 进入 Round 6 验收
  - **路径 B（最小路径）**：仅修复 #1（AC #3 阻塞性）+ #3（AC #4 文档残留）+ #7（git add）；#2 / #5 / #6 用户裁决；#4 维持推迟 → 进入 Round 6 验收
  - **路径 C（直接通过）**：不可行 — #1 直接违反 AC #3，不修复无法通过

强烈推荐路径 A：6 项一并修复成本可控（约 30-50 行代码 + 文档改动），但能完整闭合本 Story 全部 AC；#4 是唯一需要权衡 “扩散范围 vs 本 Story 完整性” 的裁决项，建议方向 A（本轮补最小集成断言）。

## 修复执行记录

### 修复执行记录
- **Date**: 2026-05-12
- **Model Used**: Claude Sonnet 4.6 (claude-sonnet-4-6)
- **Fix Items**: 7

#### #1（P1）：AC #3 回归 — vscodeMergedNote 补 "安装 GitHub Copilot 扩展" 步骤

- **文件**：`src/core/messages.ts`、`docs/migration-v2.md`、`docs/migration-v2.zh.md`、`tests/stages/detect-tools.test.ts`
- **修复内容**：
  - zh（`:538-542`）与 en（`:825-829`）各增加 `② 安装 GitHub Copilot 扩展 / Install the GitHub Copilot extension` 项；原 ② → ③，原 ③ → ④（共 4 步）
  - `migration-v2.md` / `.zh.md` 样例输出代码块同步更新为 4 步结构
  - `detect-tools.test.ts`："CR Fix #1: ~/.vscode/ + claude 已检测" 测试新增 `expect(String(vscodeMergedCall![0])).toMatch(/Copilot/i)` 断言，防止文案再次回归
- **结果**：✅ 修复成功

#### #2（P2）：项目级 `.vscode/` 误触发 vscodeMergedNote

- **文件**：`src/stages/detect-tools.ts`、`tests/stages/detect-tools.test.ts`
- **修复内容**：
  - `detectLegacyVscodeOnly` 收窄为仅检测 home 级 `~/.vscode/`，移除 `vscodeProjExists` OR 条件（`Promise.all` 从 3 项降为 2 项）
  - 更新注释说明"仅检测 home 级，项目级不触发（AC #3 明文限定 home 路径）"
  - `detect-tools.test.ts`："CR Fix #1: 项目级 .vscode/ → vscodeMergedNote 输出" 改为反向测试 "R5 Fix #2: 仅项目级 .vscode/ 存在 → vscodeMergedNote 不输出"
- **结果**：✅ 修复成功

#### #3（P2）：configuration.md 双语仍把 `vscode` 列为合法 `--tools` 值

- **文件**：`docs/configuration.md`、`docs/configuration.zh.md`
- **修复内容**：双语 `:78` 行移除 `vscode` 词项，并在描述中补充 v2.0 变更注解及迁移指南链接
- **结果**：✅ 修复成功

#### #4（P2，方向 A + backlog 登记）：`copilot:project:mcp-tools → .vscode/` 缺集成测试

- **文件**：`tests/integration/pipeline.test.ts`、`_bmad-output/implementation-artifacts/cr-rules/cr-todo-backlog.md`
- **修复内容**：
  - `pipeline.test.ts` 的 `copilot:project` 全链路 it block 中追加 `.vscode/server.json` 存在性断言（v2.0 AC #2 闭合）
  - 更新 `:961-963` 注释说明 AC #2 已在上方验证
  - `cr-todo-backlog.md` 新增 **TODO-037**（open 计数 29 → 30），登记 Story 7-10 补全多工具矩阵 E2E 测试的追踪项
- **结果**：✅ 修复成功

#### #5（P2）：`project-context.md` reserved-name 清单缺 3 项 + 边界说明

- **文件**：`_bmad-output/project-context.md`
- **修复内容**：`:242` 行扩展为完整 7 项清单（新增 `claude.local.md`、`agents.local.md`、`.claudeignore`）+ 三种 InstallType 覆盖 + `--force` 无效 + 黄色摘要语义说明；Rule Document Registry 三份文档互为镜像
- **结果**：✅ 修复成功

#### #6（P3）：migration FAQ `--force` "skip" 措辞

- **文件**：`docs/migration-v2.md`、`docs/migration-v2.zh.md`
- **修复内容**：英文版 FAQ 重写澄清 "skip prompt vs skip file"，明确警示 "do not use `--force` if you want to keep a hand-written `.vscode/mcp.json`"；中文版同步澄清 "`--force` 是跳过确认提示（而非跳过文件写入）"
- **结果**：✅ 修复成功

#### #7（P3）：CHANGELOG / migration-v2 仍为 untracked

- **操作**：`git add CHANGELOG.md docs/migration-v2.md docs/migration-v2.zh.md`
- **结果**：✅ 三文件均已 stage（状态 `A`），发布断链风险消除

### 质量门控结果

```
Tests:  852 passed (33 files)
Lint:   All matched files use Prettier code style ✅
Build:  dist/index.js 136.10 KB, Build success ✅
```
