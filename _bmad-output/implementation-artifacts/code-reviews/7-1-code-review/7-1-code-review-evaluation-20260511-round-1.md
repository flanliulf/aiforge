---
Story: 7-1
Round: 1
Date: 2026-05-11
Model Used: Claude Opus 4.7 (claude-opus-4-7)
Review Source: 7-1-code-review-summary-20260511-round-1.md
Review Model: Claude Opus 4.7 (claude-opus-4-7)
Type: Code Review Evaluation
---

## 评估总结

对 Story 7-1 的第 1 轮 CR 代码审查结果（首轮）进行逐条评估。本次审查共发现 20 条问题（2 高 / 8 中 / 10 低）+ 2 条 defer 既有问题。经逐条验证，**结论与原审查总体一致**：ID 1、ID 5、ID 16、ID 20 为真实阻塞项，需修复后复审；ID 10 包含部分误报（新增 i18n 键并非"dead key"，实测在 `reporter.ts:94` 和 `execute-install.ts` 多个调用点被引用），但其揭示的「未声明 stages 文件变更范围蔓延」问题仍然有效需用户裁决；其余 [中]/[低] 项中大部分可降级为 CR TODO 跟踪。

---

## 发现 #1 评估

### 审查原文

> **[高] detectLegacyVscodeOnly 触发场景过窄：仅在 NO_TOOLS 分支调用 + 仅检查 home 目录**
> - 来源：blind+edge+auditor
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

经验证 `src/stages/detect-tools.ts:194-198`：调用点 `if (!detectedTools.includes('copilot') && (await detectLegacyVscodeOnly(pathResolver)))` 嵌入在 `if (detectedTools.length === 0) { ... }` 内部分支。同时 `detectLegacyVscodeOnly`（第 94-99 行）仅检查 `pathResolver.home()` 下的 `.vscode` 与 `.copilot`，未检查项目级 `.vscode/`。AC #3 的 Given 条款（Story 文件第 25-26 行）字面表述为「环境存在 `~/.vscode/` 目录但无 `~/.copilot/` 目录」，未限定其他工具不存在。三层共同命中（blind+edge+auditor）佐证其严肃性。

**严重性判断：合理**

AC #3 是 Story 7-1 的核心 migration 兼容性 AC，违反将直接影响"通知 vscode-only 用户为何 vscode 不再被识别"的 NFR-C7 友好迁移意图。「高」级别合理。

**修复建议：可行**

建议将 `detectLegacyVscodeOnly` 调用外移至 detectTools 主流程出口之前（无论 detectedTools 是否为空都检查一次），并在函数内补 `pathExists(join(process.cwd(), '.vscode'))` 检测项目级 `.vscode/`。修复成本低（约 20 行）。

**误报评估：非误报**

---

## 发现 #2 评估

### 审查原文

> **[低] detectLegacyVscodeOnly 调用点的 `!detectedTools.includes('copilot')` 死代码**
> - 来源：blind+edge
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P3 优先级，随 ID 1 同步处理）

### 评估分析

**问题描述准确性：准确**

`src/stages/detect-tools.ts:196` 的 `!detectedTools.includes('copilot')` 包裹在 `detectedTools.length === 0` 块内，确实恒为 true。

**严重性判断：合理**

低级别合理，本质上是 ID 1 的设计副产物。

**修复建议：可行**

若按 ID 1 外移调用点，此处守卫可保留为有效语义（外层场景下 detectedTools 可能非空），届时自然消失为合理判定。

**误报评估：非误报**

---

## 发现 #3 评估

### 审查原文

> **[中] copilot:project:mcp-tools 同 sourceDir 双规则（`.github/` + `.vscode/`），同源文件双倍安装/计数**
> - 来源：blind+edge
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P2 优先级）

### 评估分析

**问题描述准确性：基本准确**

经验证 `src/data/install-rules.ts:74,76`：确实同时存在 `{ sourceDir: 'mcp-tools', targetDir: '.github/' }` 与 `{ sourceDir: 'mcp-tools', targetDir: '.vscode/' }` 两条规则。双倍计数与 manifest 重复条目的论断技术上成立。

**严重性判断：偏高**

这一双写正是 AC #1「`.vscode/mcp.json` 项目级 MCP 被迁移并绑定到 copilot」的承接设计（既保留 `.github/` 历史路径，又新增 `.vscode/` 承接 v1 vscode 语义）。属于显式设计决策，不构成阻塞性缺陷；但其引发的 `totalFiles` 双倍计数与 manifest 重复确实需要专项测试或语义文档化。建议降为 P2，纳入 CR TODO 跟踪而非阻塞本 Story。

**修复建议：可行但非必要**

建议补充：(1) install-rules-matrix.md 与 migration-v2.md 显式说明 mcp-tools 在 copilot:project 下双写语义；(2) 单元测试断言 `totalFiles` 计数行为符合预期；(3) 若长期保留则评估 plan 层 (sourceDir, sourceFile) 去重或显式 multi-target 标注。

**误报评估：非误报**

---

## 发现 #4 评估

### 审查原文

> **[中] cursor:global agents(Files) 与 skills(Flatten) 共用 `~/.cursor/rules/`，basename 冲突会静默覆盖**
> - 来源：blind+edge
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P2 优先级）

### 评估分析

**问题描述准确性：准确**

经验证 `src/data/install-rules.ts:127-140`：cursor:global 新增 `agents → ~/.cursor/rules/` (Files) 与既有 `skills → ~/.cursor/rules/` (Flatten) 写入同一目标目录。若源仓库存在 `agents/foo.md` 与 `skills/foo/index.md`（Flatten 产物 `foo.md`），basename 一致时后写者覆盖先写者。

**严重性判断：合理**

cursor:project 同样存在该模式（既有，非本次引入），但本次 cursor:global 新增放大了影响面。conflict-resolver 在 user-file 场景下会触发交互确认，部分缓解；但 aiforge-current/outdated 状态或 --force 模式下仍存在静默覆盖风险。建议 P2 — 非阻塞但需后续治理。

**修复建议：可行**

建议在 plan 阶段对 (targetPath basename) 跨规则去重检测，命中时 `reporter.warn`；或采用 sub-folder 隔离（与 cursor:project 设计对齐讨论）。属于设计议题，建议下放 Story 7-3/7-9 或专项 backlog。

**误报评估：非误报**

---

## 发现 #5 评估

### 审查原文

> **[高] claude global/project instructions 写入 `~/.claude/` 与 `.claude/` 根目录，可能覆盖用户 CLAUDE.md / settings.json**
> - 来源：blind+edge
> - 分类：decision_needed

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级，需用户裁决）

### 评估分析

**问题描述准确性：准确**

经验证 `src/data/install-rules.ts:95-101, 117-123`：claude:global:instructions → `~/.claude/`、claude:project:instructions → `.claude/`，type 为 Files。Claude Code 在这两个位置确实维护 `CLAUDE.md`、`settings.json` 等用户最高优先级配置。Story 7-1 Task 2.3 自己已标注「CLAUDE.md/AGENTS.md 共存场景在 Story 7-3/7-9 进一步处理」，但本 Story 已经落地写入规则且未补充任何 reserved name 保护。

**严重性判断：合理**

`checkConflict` 会对不在 manifest 的目标识别为 `user-file` 并走 conflict-resolver 交互确认（`src/services/manifest.ts:113-135`），一定程度上避免静默覆盖；但 `--force` 模式与非 TTY 环境（CI/CD）下仍可绕过保护，存在直接覆盖 Claude Code 自身 `CLAUDE.md`/`settings.json` 的不可逆风险。涉及用户配置数据安全 + NFR-C7「不破坏用户既有配置」原则，[高] 级别合理。

**修复建议：可行**

建议方向 A 推荐：保留新规则，但在 `claude:*:instructions` 链路对目标路径中的 `CLAUDE.md`、`AGENTS.md`、`settings.json`、`settings.local.json` 等 reserved name 做硬冲突检测——存在则 `reporter.warn` 且跳过（即便 --force 也跳过）；同时本 Story 必须补对应测试用例。decision_needed 分类合理。

**误报评估：非误报**

---

## 发现 #6 评估

### 审查原文

> **[中] AC #2 规格文本 (16→20, +5/-1) 与实现 (16→19, +4/-1) 数量口径不一致，AC 主文未同步修订**
> - 来源：blind+auditor
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P3 优先级）

### 评估分析

**问题描述准确性：准确**

Story 文件第 23 行 AC #2 写「16 → 20（+5/-1）」；`src/data/install-rules.ts:9` 头注释「19 条规则」；`tests/data/install-rules.test.ts:636` 断言 `toHaveLength(19)`；Dev Notes Debug Log 第 2 条解释「Story 规格 +5 是笔误，净 +3」。

**严重性判断：偏高**

实现已 self-consistent（代码/测试/CHANGELOG/install-rules-matrix 一致 19），Dev Notes 已有解释。AC 文本与实现的数字差异属于文档遗漏修订，可降为 P3。

**修复建议：可行**

建议在本轮修订中同步更新 AC #2 文本为「16 → 19（+4/-1）」并附 Dev Notes 引用；同时在 install-rules-matrix.md 中明确「19 工具规则 + 4 通用规则 = 23」的口径分层。

**误报评估：非误报**

---

## 发现 #7 评估

### 审查原文

> **[低] README / README.zh.md ASCII 流程图右侧出现 Cursor 重复，丢失第四个工具槽位语义**
> - 来源：blind+auditor
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P3 优先级）

### 评估分析

**问题描述准确性：准确**

`README.md:19-20` 第 2、3 行实际渲染为 `│ Claude Code    │` 与 `│ Cursor         │`，但第 4 行也是 `│ Cursor         │`，确为 Cursor 重复。视觉缺陷在首要入口文档。

**严重性判断：合理**

P3 文档质量，可同步小修。

**修复建议：可行**

将第 4 槽位空白化或压缩为 3 行；中英文双语对称更新。

**误报评估：非误报**

---

## 发现 #8 评估

### 审查原文

> **[中] pipeline.test.ts 删除 vscode:global E2E 但未补齐 copilot:project:mcp-tools → `.vscode/` 新 E2E**
> - 来源：blind+auditor
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P2 优先级）

### 评估分析

**问题描述准确性：准确**

`tests/integration/pipeline.test.ts:874-908` 区块确认已删除旧 E2E，注释表明承接到 Story 7-10。新规则 `copilot:project:mcp-tools → .vscode/` 在本 Story 内单元测试已覆盖（`tests/data/install-rules.test.ts:636`），但端到端集成验证后置。

**严重性判断：合理**

E2E 覆盖率净下降一条；Story 5-5b 已建立 e2e 基线，本 Story 暂未补齐属于范围决策。鉴于决策已在 Story 文件和 Debug Log 中显式记录，并已计划在 Story 7-10 收尾，P2 — 非阻塞但应显式登记 CR TODO 防止 Story 7-10 延期/裁剪时遗忘。

**修复建议：可行**

若不在本 Story 补齐，必须立即将该 TODO 登记到 `cr-todo-backlog.md`，并在 Story 7-10 显式列入交付清单。

**误报评估：非误报**

---

## 发现 #9 评估

### 审查原文

> **[中] CHANGELOG / migration FAQ 与实现行为脱钩（install flow 阻塞性、manifest 行为、产物文件名）**
> - 来源：blind
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P2 优先级）

### 评估分析

**问题描述准确性：基本准确**

`docs/install-rules-matrix.md:20` 写「Install flow is not blocked」，但 `src/stages/detect-tools.ts:194-211` 在 detectedTools 为空时仍然 throw NO_TOOLS fatal。文案严格说"warning 先于 fatal 输出 + warning 本身不阻塞"，与 NO_TOOLS fatal 在同一条件下抛出存在叙述错位。

`docs/migration-v2.md:99` FAQ「previously managed by aiforge (tracked in the manifest)」的承诺与 manifest 实现行为基本相符（`src/services/manifest.ts:113` 的 user-file/aiforge-* 分类逻辑），措辞略微激进但有依据；FAQ「MCP config will be written to `.vscode/mcp.json` in your project」对产物文件名做了具体承诺，但 type=Files 规则确实是按源目录文件名复制，需源目录提供 `mcp.json` 才能精确兑现。

**严重性判断：偏高**

文档表述不严谨但未到产生用户实质误导的程度；建议降为 P2，与 ID 6/ID 19 文档治理一并处理。

**修复建议：可行**

(1) 校准「Install flow is not blocked」为「a migration note is shown first; install will still fail with NO_TOOLS until you install one of the supported tools」；(2) 校准 FAQ 产物文件名表述为「the file named `mcp.json` in your `mcp-tools/` source directory will be copied to `.vscode/`」；(3) 中英双语同步。

**误报评估：非误报**

---

## 发现 #10 评估

### 审查原文

> **[中] messages.ts 引入多条与 Story 7-1 无关的 i18n 键且无 reporter 调用点（范围蔓延 + dead key）**
> - 来源：blind+edge
> - 分类：decision_needed

### 评估结论：❌ 误报（dead key 部分） + ⚠️ 部分有效（范围蔓延部分，纳入 CR TODO，P2 优先级）

### 评估分析

**问题描述准确性：不准确（dead key）/ 部分准确（范围蔓延）**

实测 `grep -rn "collapsedItems\|skippedOnlySummary\|diagNoInstallSources\|diagEmptyDirectories\|suggestCheckSelection\|suggestCheckRepoContent\|suggestCheckEmptyDirectories\|suggestCheckDirectoryContents" src/`：
- `src/core/reporter.ts:94` 引用 `reporter.collapsedItems`
- `src/stages/execute-install.ts:176, 325, 326, 331, 332, 336, 337, 689` 引用全部新增键

故"dead key"判定为**误报** — 审查未充分扫描调用点。

但 `git diff HEAD --stat` 显示 `src/core/reporter.ts (+328/-...)`、`src/stages/execute-install.ts (+151/-...)`、`src/stages/authenticate.ts (+28/-...)`、`src/stages/clone.ts (+8/-...)`、`tests/core/reporter.test.ts (+174/-...)` 等大量未在 Story 7-1 File List 中声明的改动。这些变更与 messages.ts 新增的 i18n 键确实联动（属于 Install UX 收敛/零结果诊断重构），但**未纳入 Story 7-1 范围**也未在 Story 文件 Change Log/File List 中声明。该「范围蔓延」论断**有效**。

**严重性判断：偏高 → 调整为中**

若调用点已存在（不是 dead key），i18n 键本身正当；但调用点对应的 stages 文件不在 Story 7-1 文件清单中，属于工作目录中累积的未声明 commit/wip。需用户裁决：(a) 这些 stages 文件改动是否属于本 Story 范围（应补入 File List 与测试）；(b) 还是属于其他 Story 的遗留变更（应剥离到独立 commit）。

**修复建议：可行**

请用户确认 `src/core/reporter.ts`、`src/stages/execute-install.ts`、`src/stages/authenticate.ts`、`src/stages/clone.ts` 这些文件的修改归属：
- 若属于 Story 7-1：补入 File List，明确说明与 detect-tools.ts 的横切关系
- 若属于其他 Story 残留：从本 Story commit 范围中剥离，避免污染 Story 7-1 的提交边界

**误报评估：部分误报（dead key 错误，范围蔓延有效）**

---

## 发现 #11 评估

### 审查原文

> **[低] vscodeMergedNote 文案在保护范围、文件名承诺、排版方面存在歧义/兼容性问题**
> - 来源：blind
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P3 优先级）

### 评估分析

**问题描述准确性：基本准确**

`src/core/messages.ts:530-533` (zh-CN) 与 810-814 (en) 确实使用 ①②③ 圆圈数字，与同文件其他列表（`suggestion1`/`suggestCheckSelection` 等使用 `1.`/`2.`）风格不一致。「现有 ~/.vscode/ 文件不会被覆盖或删除」未显式区分 home 级与项目级 .vscode/，存在歧义。

**严重性判断：合理**

P3 文案改进。

**修复建议：可行**

建议本轮一并优化，但不阻塞。

**误报评估：非误报**

---

## 发现 #12 评估

### 审查原文

> **[低] `--tools vscode` 手动模式抛 UNKNOWN_TOOL 时不输出 vscodeMergedNote**
> - 来源：edge
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P3 优先级）

### 评估分析

**问题描述准确性：准确**

`src/stages/detect-tools.ts:158-178` 手动 `--tools` 校验分支若收到 `vscode` 直接 throw UNKNOWN_TOOL，无 migration 提示。

**严重性判断：合理**

AC #3 字面未限定"自动检测 vs 手动模式"，技术上应同样覆盖手动模式；但脚本/CI 用户继续使用 `--tools vscode` 的概率有限。P3 — CR TODO 跟踪即可。

**修复建议：可行**

手动模式分支命中 `vscode` 时先 `reporter.warn(msg('detectTools.vscodeMergedNote'))` 再 throw。

**误报评估：非误报**

---

## 发现 #13 评估

### 审查原文

> **[低] detectLegacyVscodeOnly 缺少非目录辨别 + pathExists 异常透传**
> - 来源：edge
> - 分类：patch

### 评估结论：⚠️ 部分有效 — 建议纳入 CR TODO 跟踪（P3 优先级）

### 评估分析

**问题描述准确性：部分准确**

- 「非目录辨别」准确：`~/.vscode` 为普通文件场景下 access 仍返回 true，可能误判。
- 「pathExists 异常透传」**部分误报**：`src/stages/detect-tools.ts:33-45` 的 pathExists 显式注释「project-context.md — fs 存在性检查必须使用 ENOENT/ENOTDIR 白名单降级；其他错误（EACCES 权限拒绝、EIO I/O 错误等）向上抛出」——这是**项目级架构规范**的预期行为，并非缺陷。若在 detectLegacyVscodeOnly 内捕获并降级会违反规范。

**严重性判断：偏高 → 「非目录辨别」P3 合理；「异常透传」非缺陷**

**修复建议：可行（仅针对非目录辨别）**

`stat()` + `isDirectory()` 替代 pathExists 即可；异常透传保留现状。

**误报评估：部分误报（异常透传是预期行为）**

---

## 发现 #14 评估

### 审查原文

> **[低] 测试中硬编码绝对路径 `String(p) === '/home/user/.vscode'`，缺乏路径规范化与跨平台覆盖**
> - 来源：blind
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P3 优先级）

### 评估分析

**问题描述准确性：准确**

`tests/stages/detect-tools.test.ts:414, 446` 字面比对 `'/home/user/.vscode'`；mockPathResolver.home 返回 `/home/user`（行 64），匹配是确定的。Windows 风格路径风险存在，但 mock 在 vitest 内运行时不会引入真实平台 path 差异。`includes('v2.0')` 与 `includes('~/.vscode/')` 的脆弱性确实存在。

**严重性判断：合理**

P3 测试健壮性，CR TODO 跟踪。

**修复建议：可行**

`path.join(pathResolver.home(), '.vscode')` 动态拼接；断言改为关键语义片段如「VS Code」/「v2.0」/「Copilot」组合判定。

**误报评估：非误报**

---

## 发现 #15 评估

### 审查原文

> **[低] CHANGELOG 中 `## [1.0.0] - 2026-03-XX` 日期占位符未替换**
> - 来源：blind
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P3 优先级）

### 评估分析

**问题描述准确性：准确**

`CHANGELOG.md:35` 写 `## [1.0.0] - 2026-03-XX`，占位符未替换。

**严重性判断：合理**

P3 文档完整性。

**修复建议：可行**

根据 `git log --grep "release.*1.0.0"` → `db6d15c chore(release): 发布 1.0.0 正式版本` 对应 commit 日期替换。

**误报评估：非误报**

---

## 发现 #16 评估

### 审查原文

> **[低] package.json 版本 1.0.0 → 2.0.0 跳级，但 package-lock.json 未在 diff 中显式同步**
> - 来源：blind
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级 — 阻塞发布）

### 评估分析

**问题描述准确性：准确**

实测 `grep -n "\"version\"" package-lock.json`：lockfile 顶层及 `"name": "aiforge"` 块 version 仍为 `1.0.0`，未升级。`git status` 显示 package-lock.json 处于 modified 状态但 Story 7-1 File List 中未声明。

**严重性判断：偏低 → 调整为 P1**

发布元数据完整性问题 — `npm publish` 时 lockfile 与 package.json 版本不一致会触发警告或锁定冲突，可能影响 v2.0.0 发布动作本身。建议升级到 P1（阻塞发布）。

**修复建议：可行**

`npm install` 重新生成 lockfile 或手动同步 lockfile 顶层 version 到 2.0.0；将 package-lock.json 加入 Story 7-1 File List。

**误报评估：非误报**

---

## 发现 #17 评估

### 审查原文

> **[低] detectLegacyVscodeOnly 两次串行 await pathExists，未使用 Promise.all 并行**
> - 来源：blind
> - 分类：patch

### 评估结论：⚠️ 有效但非必要 — 建议纳入 CR TODO 跟踪（P3 优先级）

### 评估分析

**问题描述准确性：准确**

`src/stages/detect-tools.ts:95-98` 串行 await。

**严重性判断：合理**

非关键路径，单次 detect 调用，I/O 开销忽略不计。P3 — 可与 ID 1 修复合并优化。

**修复建议：可行**

`Promise.all([pathExists(...), pathExists(...)])`。

**误报评估：非误报**

---

## 发现 #18 评估

### 审查原文

> **[低] dry-run 测试 filter `targetPath.includes('.cursor')` 缺 rule 维度过滤**
> - 来源：edge
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P3 优先级）

### 评估分析

**问题描述准确性：准确**

`tests/integration/dry-run.test.ts:613-616` 仅按 `targetPath.includes('.cursor')` 字符串过滤。

**严重性判断：合理**

mock 临时目录通常不会有 `.cursor` 子串，实际影响有限；但未来扩展（如新工具引入 `.cursor*` 形态目录）时易破。P3 — CR TODO 跟踪。

**修复建议：可行**

改为 `i.rule?.tool === 'cursor' && i.rule?.scope === 'global'`。

**误报评估：非误报**

---

## 发现 #19 评估

### 审查原文

> **[低] migration-v2.md / .zh.md 缺少「v1.x 中 vscode 共有 1 条规则」的显式表头声明**
> - 来源：auditor
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P3 优先级）

### 评估分析

**问题描述准确性：准确**

文档表格直接列出单条规则但缺少表头说明。

**严重性判断：合理**

P3 文档完整性。

**修复建议：可行**

在表格上方加「v1.x 中 `vscode` 共有 1 条规则，迁移映射如下：」中英双语同步。

**误报评估：非误报**

---

## 发现 #20 评估

### 审查原文

> **[中] CLAUDE.md Rule Document Registry 同步要求在本 PR 内未验证**
> - 来源：blind
> - 分类：decision_needed

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级，需用户裁决）

### 评估分析

**问题描述准确性：准确**

项目根 `CLAUDE.md` 明确「凡是确认/修改/新增任何规则、约定或豁免，必须同步更新 `project-context.md`、`04-implementation-patterns.md`、`03-core-decisions.md`」。Story 7-1 修改了 BUILTIN_RULES 数量（16→19）与 TOOL_DEFINITIONS（4→3），属于规则边界变更。实测：
- `_bmad-output/project-context.md`：Last Updated 2026-04-24，未含 19 工具规则或 3 工具列表更新
- `_bmad-output/planning-artifacts/architecture/04-implementation-patterns.md`：未含 v2.0 规则数量信息
- 两文件均显示 modified 但未纳入 Story 7-1 File List

**严重性判断：合理**

CLAUDE.md 顶部明确「同步规则」，违反将导致后续 AI Agent 读取过时规则文档做出不一致决策。P1 — 阻塞交付。

**修复建议：可行**

需用户裁决：(1) 确认 04-implementation-patterns.md / 03-core-decisions.md / project-context.md 是否已同步规则数量与工具列表变更（如已同步，需将这些文件加入 File List）；(2) 若未同步，需在本 Story 内补充。

**误报评估：非误报**

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | detectLegacyVscodeOnly 触发场景过窄 | [高] | **P1** | AC #3 字面被违反，需外移调用点 + 项目级 .vscode/ 检测 |
| 5 | claude instructions 可能覆盖用户 CLAUDE.md/settings.json | [高] | **P1** | 需补 reserved name 硬保护或推迟到 Story 7-3/7-9（用户裁决） |
| 16 | package-lock.json 未同步到 2.0.0 | [低] | **P1** | 阻塞 npm publish，升级到 P1 |
| 20 | CLAUDE.md Rule Document Registry 未同步 | [中] | **P1** | 项目级规则约束，需用户裁决归属 |
| 10 | stages/* 文件范围蔓延（dead key 部分误报） | [中] | **P2→需裁决** | 需用户确认 reporter/execute-install/authenticate/clone 改动归属 |

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 2 | detectLegacyVscodeOnly 调用点死代码 | [低] | **P3** | 随 ID 1 修复自然消失 |
| 3 | copilot:project mcp-tools 同源双规则 | [中] | **P2** | 设计承接，需补文档/测试 |
| 4 | cursor:global agents/skills basename 冲突 | [中] | **P2** | 设计议题，建议后置专项治理 |
| 6 | AC #2 数量口径 16→20 vs 16→19 | [中] | **P3** | AC 文本同步修订 |
| 7 | README 流程图 Cursor 重复 | [低] | **P3** | 文档小修 |
| 8 | E2E 后置 Story 7-10 | [中] | **P2** | 显式登记 CR TODO 防止遗忘 |
| 9 | CHANGELOG/FAQ 措辞脱钩 | [中] | **P2** | 文档措辞校准 |
| 11 | vscodeMergedNote 文案歧义/兼容性 | [低] | **P3** | 文案优化 |
| 12 | --tools vscode 手动模式无迁移提示 | [低] | **P3** | 手动模式覆盖缺口 |
| 13 | detectLegacyVscodeOnly 非目录辨别 | [低] | **P3** | 边缘场景，stat+isDirectory |
| 14 | 测试硬编码绝对路径 | [低] | **P3** | 测试健壮性 |
| 15 | CHANGELOG 1.0.0 日期占位符 | [低] | **P3** | 文档完整性 |
| 17 | detectLegacyVscodeOnly 串行 await | [低] | **P3** | 优化，非必要 |
| 18 | dry-run filter 维度 | [低] | **P3** | 测试健壮性 |
| 19 | migration-v2.md 缺少表头说明 | [低] | **P3** | 文档说明 |

### 可忽略（误报）

| # | 发现 | 原始严重性 | 忽略理由 |
|---|------|----------|---------|
| 10（dead key 部分） | messages.ts 新增 i18n 键无引用 | [中] | reporter.ts:94 与 execute-install.ts 多处实际引用，非 dead key；仅"范围蔓延"论断有效（已在上表跟踪） |
| 13（异常透传部分） | pathExists 异常向上冒泡掩盖 NO_TOOLS 诊断 | [低] | 项目级架构规范要求 ENOENT/ENOTDIR 白名单降级、其他异常透传；当前实现符合规范预期 |

### 评估决定

- **发现 #1（detectLegacyVscodeOnly 触发场景过窄）**：确认阻塞，需修复后复审 — 外移调用点 + 项目级 .vscode/ 检测，并补三组测试用例。
- **发现 #2（死代码）**：随 ID 1 修复自然消失，无需单独处理。
- **发现 #3（mcp-tools 双规则计数）**：纳入 CR TODO，本轮补 install-rules-matrix.md / migration-v2.md 说明 + 单元测试断言。
- **发现 #4（cursor:global basename 冲突）**：纳入 CR TODO，建议在 Story 7-3/7-9 或专项治理 backlog 处理。
- **发现 #5（claude instructions 覆盖风险）**：**需用户裁决** — 方向 A（补 reserved name 硬保护）/方向 B（推迟到 Story 7-3/7-9）。阻塞合并。
- **发现 #6（AC #2 数量口径）**：本轮一并修订 Story 文件 AC #2 文本。
- **发现 #7（README 流程图）**：本轮一并修订 README.md / README.zh.md。
- **发现 #8（E2E 后置）**：纳入 CR TODO 显式登记，确认 Story 7-10 范围。
- **发现 #9（CHANGELOG/FAQ）**：纳入 CR TODO，本轮一并校准措辞（成本低）。
- **发现 #10（messages.ts 范围蔓延）**：**需用户裁决** — stages/reporter 改动归属确认。dead key 部分为误报。
- **发现 #11/12/13(非目录)/14/17/18/19**：纳入 CR TODO，不阻塞本 Story。
- **发现 #13（异常透传）**：误报，无需处理。
- **发现 #15（CHANGELOG 1.0.0 日期）**：本轮一并修订（成本 1 行）。
- **发现 #16（package-lock 同步）**：本轮必须修订 — 影响 v2.0.0 npm publish。
- **发现 #20（Rule Document Registry）**：**需用户裁决** — 确认 project-context.md / 04-implementation-patterns.md / 03-core-decisions.md 同步状态。阻塞合并。

---

## 修复执行记录

### 修复执行记录
- **Date**: 2026-05-11
- **Model Used**: Claude Sonnet 4.6
- **Fix Items**: 11 项（含用户裁决后追加）

| 修复 ID | 发现描述 | 修复文件 | 修复结果 |
|---------|---------|---------|---------|
| ID-1 | detectLegacyVscodeOnly 触发场景过窄（仅在 NO_TOOLS 分支内，且仅检测 home 级） | `src/stages/detect-tools.ts` | ✅ 已修复：函数移至 `Promise.all` 并行检测 home + project `.vscode/`；调用点外移到 NO_TOOLS 分支之外，只要 `!detectedTools.includes('copilot')` 且 vscode 路径存在就输出 warn；补充 2 组新测试用例 |
| ID-5 | claude instructions 覆盖 CLAUDE.md 等保留文件风险（用户选方向 A：补硬保护） | `src/stages/execute-install.ts`、`src/core/messages.ts` | ✅ 已修复：新增 `CLAUDE_INSTRUCTIONS_RESERVED_NAMES` 常量（Set）；install 文件循环中在 `validateDestPathSecurity` 前插入检查，命中则 `reporter.warn` + 写 `status:'skipped'` + continue；messages.ts 补充 `claudeInstructionsReservedSkip` 中英文消息；补充 3 组测试（each reserved name / 非保留文件 / 非 instructions 规则） |
| ID-6 | AC #2 规则数量口径不一致（Story 文件写"16→20"但实际为+4/-1=19） | `_bmad-output/implementation-artifacts/stories/7-1-vscode-merge-and-mvp-rules-completion.md` | ✅ 已修复：AC #2 文本更新为"16 → 19（+4/-1；规格标注 20 为笔误，见 Dev Notes Debug Log #2）" |
| ID-7 | README ASCII art 第 4 格残留 VS Code 文字 | `README.md`、`README.zh.md` | ✅ 已修复：第 4 格改为空白 `│                │`；"Multi-tool support"描述及 Supported AI Tools 表格均同步移除 VS Code 行 |
| ID-9 | migration-v2.md FAQ 措辞模糊（未说明 NO_TOOLS 仍会失败） | `docs/migration-v2.md`、`docs/migration-v2.zh.md` | ✅ 已修复：FAQ 补充说明"migration note 不阻塞安装；但若无受支持工具（copilot/claude/cursor）则仍报 NO_TOOLS"，中英文双语一致 |
| ID-10 | messages.ts 范围蔓延（用户确认：属其他 Story 残留，纳入 CR TODO，不阻塞） | — | ⏭️ 跳过（用户决策：非本 Story 范围，已登记 cr-todo-backlog.md） |
| ID-15 | CHANGELOG 1.0.0 日期为占位符 `XX` | `CHANGELOG.md` | ✅ 已修复：`2026-03-XX` → `2026-04-21`（从 git log db6d15c 提取） |
| ID-16 | package-lock.json 版本与 package.json 不同步（仍为 1.0.0） | `package-lock.json` | ✅ 已修复：运行 `npm install` 重新生成，lockfile 顶级 version 字段更新为 2.0.0 |
| ID-20 | Rule Document Registry 同步（用户确认：需本轮更新 03-core-decisions.md + project-context.md） | `_bmad-output/planning-artifacts/architecture/03-core-decisions.md`、`_bmad-output/project-context.md` | ✅ 已修复：03-core-decisions.md D5 ToolDefinition 示例注释更新为"vscode removed"；project-context.md 新增 v2.0 变更说明段落（vscode 移除、规则数 16→19、reserved name 保护） |
| ID-2 | detectLegacyVscodeOnly 死代码随 ID-1 消失 | — | ✅ 自动消解（ID-1 修复后函数有效引用，死代码消失） |
| CR-TODO | 非阻塞 CR 发现批量登记 | `_bmad-output/implementation-artifacts/cr-rules/cr-todo-backlog.md` | ✅ 已登记 TODO-019～TODO-027（9 项），涉及：mcp-tools 双规则计数、cursor basename 冲突、E2E 后置覆盖、vscodeMergedNote 措辞、--tools vscode 提示缺失、detectLegacyVscodeOnly 非目录检查、测试硬编码路径、dry-run filter 维度、migration 表头说明） |

### 质量门禁验证结果

```
npm test:    839 tests passed (33 test files) ✅
npm run lint:src: ESLint + Prettier 全部通过 ✅
npm run build:  dist/index.js 134.23 KB，build success ✅
```
