---
Story: 7-1
Round: 6
Date: 2026-05-12
Model Used: GPT-5.5 (github-copilot/gpt-5.5)
Type: Code Review Summary
---

## 审查结论

本轮为复审（Round 6）。三层审查（Blind Hunter / Edge Case Hunter / Acceptance Auditor）全部正常返回，无失败审查层。Round 5 的 7 项修复主体已落地：`vscodeMergedNote` 已恢复 Copilot 扩展安装指引，legacy 检测已收窄到 home 级 `~/.vscode/`，配置文档已移除 `vscode`，`.vscode/server.json` 端到端断言已补充，`project-context.md` reserved-name 清单已补齐，FAQ `--force` 措辞已澄清，新增迁移文档已进入 staged 状态。

本轮未发现 [高] 阻塞项。仍发现 2 个 [中] 级迁移契约/测试门禁问题和 2 个 [低] 级维护/交付风险。建议暂不标记 Done，先修复下列低成本问题后进入下一轮快速复审。

## 上轮问题回顾

### 已修复

1. Round 5 / Finding #1 — AC #3 回归：migration 警告不再包含“如何安装 GitHub Copilot 扩展”
   - 修复位置：`src/core/messages.ts:538-543` / `src/core/messages.ts:826-831` 已加入“安装 GitHub Copilot 扩展 / Install the GitHub Copilot extension”。
   - 文档样例：`docs/migration-v2.md:70-75` / `docs/migration-v2.zh.md:70-75` 已同步为 4 步结构。
   - 验证结果：AC #3 主文案已闭合；但迁移主步骤仍存在检测机制表述矛盾，见本轮发现 #1。

2. Round 5 / Finding #2 — 项目级 `.vscode/` 会误触发 legacy VS Code migration 提示
   - 修复位置：`src/stages/detect-tools.ts:95-101` 已只检查 home 级 `~/.vscode/` 与 `~/.copilot/`。
   - 测试位置：`tests/stages/detect-tools.test.ts:485-499` 已覆盖“仅项目级 `.vscode/` 不输出提示”。
   - 验证结果：运行行为已闭合；调用处注释仍残留旧描述，见本轮发现 #3。

3. Round 5 / Finding #3 — 配置文档仍把 `vscode` 列为合法 `--tools` 值
   - 修复位置：`docs/configuration.md:78` / `docs/configuration.zh.md:78` 已移除 `vscode` 并指向迁移指南。
   - 验证结果：文档残留已闭合。

4. Round 5 / Finding #4 — `copilot:project:mcp-tools -> .vscode/` 缺少集成测试门禁
   - 修复位置：`tests/integration/pipeline.test.ts:958-960` 已新增 `.vscode/server.json` 存在性断言。
   - 追踪项：`_bmad-output/implementation-artifacts/cr-rules/cr-todo-backlog.md` 已新增 Story 7-10 的延伸 E2E 覆盖 TODO。
   - 验证结果：Story 7-1 最小端到端断言已闭合。

5. Round 5 / Finding #5 — Rule Document Registry 同步不完整：`project-context.md` reserved-name 清单缺项
   - 修复位置：`_bmad-output/project-context.md:242` 已补齐 7 项 reserved-name、三种 InstallType 覆盖、`--force` 无效和黄色摘要语义。
   - 验证结果：三份规则文档主体已对齐。

6. Round 5 / Finding #6 — migration FAQ 将 `--force` 描述为“skip”可能误导用户
   - 修复位置：`docs/migration-v2.md:104-106` / `docs/migration-v2.zh.md:103-105` 已澄清 `--force` 是跳过确认提示，不是跳过文件写入。
   - 验证结果：FAQ 风险已闭合。

7. Round 5 / Finding #7 — 新增迁移文档和 CHANGELOG 仍为未跟踪文件
   - 修复位置：`git diff --cached --name-status` 显示 `CHANGELOG.md`、`docs/migration-v2.md`、`docs/migration-v2.zh.md` 已为 `A` 状态。
   - 验证结果：三份新增文件不再 untracked；但当前 staging 仍未包含本轮相关代码/测试/配置文档改动，见本轮发现 #4。

### 仍为非阻塞待办

1. Round 4 / Finding #2 — Unicode 同形字符与 NFC/NFD 规范化风险
   - 维持既有评估结论：CR TODO / 非阻塞。

2. Round 4 / Finding #4 — 全部 reserved-skip 时 `ensureDir(item.targetPath)` 仍可能创建空目录
   - 维持既有评估结论：CR TODO / 非阻塞。

3. Round 5 / Finding #4 延伸项 — Story 7-10 补全多工具矩阵端到端集成测试
   - 维持为 Story 7-10 延伸覆盖项；Story 7-1 已有最小 `.vscode/server.json` 端到端断言。

## 新发现

### 1. [中][新] migration 文档与 CHANGELOG 仍暗示“安装 Copilot 扩展后即可被检测”，与实际 marker 检测机制矛盾

- **来源**：blind+auditor
- **分类**：patch

- **证据**
  - Copilot 工具检测依赖 `~/.copilot` 或项目 `.github` marker，而不是检测 VS Code 扩展本身：`src/data/tool-registry.ts:11-16`
  - 英文迁移步骤写“After installing, aiforge will detect `~/.copilot/`”：`docs/migration-v2.md:50-51`
  - 同一文档后文又说明 `~/.copilot/` 是 aiforge 约定 marker，需要手动创建：`docs/migration-v2.md:78-82`
  - 中文迁移步骤存在同样矛盾：`docs/migration-v2.zh.md:50-51` 与 `docs/migration-v2.zh.md:77-82`
  - CHANGELOG 写“Activates only when GitHub Copilot extension is detected”，与实际检测机制不一致：`CHANGELOG.md:15`

- **影响**
  - 用户可能只安装 GitHub Copilot 扩展后直接重跑 `aiforge install`，但如果没有 `~/.copilot/` marker 或项目 `.github/`，仍可能无法检测到 Copilot。
  - 这会削弱 AC #4 要求的 migration 指引完整性，也会让 Round 5 对 AC #3 的修复仍留下执行路径歧义。

- **建议**
  - 将主升级步骤改为“安装 GitHub Copilot 扩展，并创建/确认 `~/.copilot/` marker 后重新执行 `aiforge install`”。
  - 将 CHANGELOG 的“extension is detected”改为“Copilot marker/project context is detected”或等价表述。
  - 中英文文档同步修改。

### 2. [中][新] AC #3 回归测试断言过弱，无法真正保护“安装 Copilot 扩展”文案

- **来源**：auditor
- **分类**：patch

- **证据**
  - 当前产品文案确实包含 AC #3 要求的扩展安装指引：`src/core/messages.ts:538-543` / `src/core/messages.ts:826-831`
  - 测试注释声明要防止“如何安装 GitHub Copilot 扩展”回归：`tests/stages/detect-tools.test.ts:481`
  - 实际断言仅为 `toMatch(/Copilot/i)`：`tests/stages/detect-tools.test.ts:482`

- **影响**
  - 未来如果删除“扩展 / extension”步骤，只保留“Copilot 项目级规则”或“Copilot marker”字样，测试仍会通过。
  - AC #3 的核心迁移指引可能再次回归而不会被自动化发现。

- **建议**
  - 中文默认测试断言应包含 `GitHub Copilot 扩展` 或至少 `扩展`。
  - 如需覆盖英文文案，增加 `setLanguage('en')` 场景并断言 `GitHub Copilot extension`。

### 3. [低][新] `detectTools` 调用处注释仍残留“或项目级 .vscode/”旧语义

- **来源**：blind+auditor
- **分类**：patch

- **证据**
  - 实现已只检查 home 级 `~/.vscode/`：`src/stages/detect-tools.ts:95-101`
  - 函数注释也已说明项目级 `.vscode/` 不触发：`src/stages/detect-tools.ts:90-93`
  - 调用处注释仍写“只要 `~/.vscode/`（或项目级 `.vscode/`）存在且 `~/.copilot/` 不存在”：`src/stages/detect-tools.ts:196-197`

- **影响**
  - 不影响当前运行行为，但会误导后续维护者，增加重新扩大触发面、恢复 Round 5 #2 回归的风险。

- **建议**
  - 将调用处注释改为只描述 home 级 `~/.vscode/`，与实现和测试保持一致。

### 4. [低][新] staged 状态仍不完整，若直接提交 staged 内容会遗漏 R5 代码/测试修复

- **来源**：auditor
- **分类**：patch

- **证据**
  - `git diff --cached --name-status` 仅显示 `CHANGELOG.md`、`docs/migration-v2.md`、`docs/migration-v2.zh.md` 为新增 staged 文件。
  - `git diff --name-status` 仍显示 R5/R6 相关文件未暂存，包括 `src/core/messages.ts`、`src/stages/detect-tools.ts`、`tests/stages/detect-tools.test.ts`、`tests/integration/pipeline.test.ts`、`docs/configuration.md`、`docs/configuration.zh.md`、`_bmad-output/project-context.md`、`_bmad-output/implementation-artifacts/cr-rules/cr-todo-backlog.md` 等。

- **影响**
  - 如果后续只提交 staged 内容，迁移文档会被提交，但实际代码、测试和配置文档修复不会进入提交，导致复审结论与交付内容不一致。
  - 这是交付流程风险，不是运行时缺陷。

- **建议**
  - 提交前统一 staging Story 7-1 / R5 修复涉及的全部文件，或采用明确的分批提交策略，并确保每批提交均自洽。

## 验证摘要

- `npm test` 本轮未重新执行（CR 只读复审）；Round 5 修复记录显示 ✅ 通过（852 / 852）。
- `npm run lint:src` 本轮未重新执行；Round 5 修复记录显示 ✅ 通过。
- `npm run build` 本轮未重新执行；Round 5 修复记录显示 ✅ 通过。
- 额外复核：
  - 三层审查全部返回，无失败层。
  - `git diff HEAD -- <Story 7-1 相关文件>` 已用于本轮审查输入。
  - `git diff --cached --name-status` / `git diff --name-status` 已用于确认 staged 与 unstaged 状态。

## 通过项

- `vscode` 工具删除、`BUILTIN_RULES` 19 条、`package.json` 2.0.0 等 Story 主体实现未发现新回归。
- `vscodeMergedNote` 当前代码文案已包含安装 GitHub Copilot 扩展指引。
- legacy migration 提示当前实现仅按 home 级 `~/.vscode/` 触发，项目级 `.vscode/` 不触发。
- `copilot:project:mcp-tools -> .vscode/` 已有最小端到端集成断言。
- Rule Document Registry 中 `project-context.md` 的 reserved-name 缺项已补齐。
- `--force` FAQ 误导性措辞已修正。

## 结论

- **结论：不通过**
- **阻塞项**：无 [高] 级阻塞项；但发现 #1 和 #2 建议作为 Story 7-1 完成前必须修复的中优先级问题。
- **建议**：先修复 migration/CHANGELOG 检测机制表述、增强 AC #3 文案测试断言、清理 `detectTools` 注释，并在提交前统一 staging 相关修复文件；随后进入 Round 7 快速复审。
