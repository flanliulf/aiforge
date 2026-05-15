---
Story: 7-1
Round: 5
Date: 2026-05-12
Model Used: GPT-5 Codex (gpt-5)
Type: Code Review Summary
---

## 审查结论

本轮为复审（Round 5）。三层审查（Blind Hunter / Edge Case Hunter / Acceptance Auditor）全部正常返回，无失败审查层。Round 4 的两个核心修复点中，`vscodeMergedNote` 文档/代码不一致和全 reserved-skip 的 `completePhase` 语义冲突已基本闭合；但复审发现新的验收偏差与文档残留：AC #3 的 Copilot 扩展安装指引被 marker 文案替换、项目级 `.vscode/` 会误触发 legacy 提示、配置文档仍声明 `--tools vscode` 可用、Rule Document Registry 三文档仍不完全一致。

质量门禁已在本轮实际执行并通过：`npm test` 852/852 通过，`npm run lint:src` 通过，`npm run build` 通过。

**建议：暂不通过。** 本轮没有新增高危代码缺陷，但存在 6 个需要本 Story 闭合的中优先级问题，均属于用户可见迁移路径、文档契约或测试门禁。

## 上轮问题回顾

### 已修复

1. Round 4 / Finding #1 — `vscodeMergedNote` ② 项实际文案与 migration-v2 文档样例输出不一致
   - 修复位置：`src/core/messages.ts:538-542` / `src/core/messages.ts:825-829` 已改为创建 `~/.copilot/` marker 后重新执行 `aiforge install`，与 `docs/migration-v2.md:70-74` / `docs/migration-v2.zh.md:70-73` 的样例方向一致。
   - 验证结果：文档/代码不一致已闭合；但该修复引入 AC #3 新偏差，见本轮发现 #1。

2. Round 4 / Finding #3 — 全部 reserved-skip 时 `completePhase` 仍输出通用 skipped 成功摘要
   - 修复位置：`src/stages/execute-install.ts:766-770` 在 `reservedSkipCount === processedCount` 时输出 `reservedSkippedOnlySummary`，不再走通用灰色 skipped 摘要。
   - 测试位置：`tests/stages/execute-install.test.ts:2308-2366` 覆盖全 reserved-skip 与 mixed reserved-skip 场景。
   - 验证结果：语义冲突已闭合。

### 仍为非阻塞待办

1. Round 4 / Finding #2 — Unicode 同形字符与 NFC/NFD 规范化风险
   - 维持上轮评估结论：真实存在但威胁面有限，建议 CR TODO / P3 跟踪。

2. Round 4 / Finding #4 — 全部 reserved-skip 时 `ensureDir(item.targetPath)` 仍可能创建空目录
   - 维持上轮评估结论：真实存在但触发概率低，建议 CR TODO / P3 跟踪。

## 新发现

### 1. [中][新] AC #3 回归：migration 警告不再包含“如何安装 GitHub Copilot 扩展”

- **来源**：auditor
- **分类**：patch

- **证据**
  - Story AC #3 明确要求提示内容包含“如何安装 GitHub Copilot 扩展以继续使用 aiforge MCP 管理”：`_bmad-output/implementation-artifacts/stories/7-1-vscode-merge-and-mvp-rules-completion.md:25-29`
  - 当前中文 warn 第 ② 项仅提示创建 marker：`src/core/messages.ts:538-542`
  - 当前英文 warn 第 ② 项仅提示创建 marker：`src/core/messages.ts:825-829`
  - migration 文档仍在步骤里提到安装扩展：`_bmad-output/implementation-artifacts/stories/7-1-vscode-merge-and-mvp-rules-completion.md:82-86`

- **影响**
  - Round 4 的文档/代码一致性问题已修好，但把 AC #3 要求的“安装 GitHub Copilot 扩展”指引挤掉了。
  - vscode-only 用户只看 CLI warning 时，可能只创建 `~/.copilot/` marker，却不知道还需要安装/启用 GitHub Copilot 扩展才能继续使用 VS Code MCP 管理。

- **建议**
  - 将 warning 第 ② 项改为同时包含两步：安装 GitHub Copilot 扩展，并创建/确认 `~/.copilot/` marker 后重新执行 `aiforge install`。
  - 同步更新中英文 migration 样例，避免再次出现文档/代码偏差。

### 2. [中][新] 项目级 `.vscode/` 会误触发 legacy VS Code migration 提示

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `detectLegacyVscodeOnly()` 同时检查 home 与项目级 `.vscode/`：`src/stages/detect-tools.ts:94-101`
  - 注释称“vscode-only 用户”，但条件写为 `~/.vscode/（或项目级 .vscode/）存在且 ~/.copilot/ 不存在`：`src/stages/detect-tools.ts:85-92`
  - 测试固化了“仅项目级 `.vscode/` 存在也输出 `~/.vscode/` 文案”的行为：`tests/stages/detect-tools.test.ts:483-497`

- **影响**
  - 普通 VS Code 项目常见 `.vscode/launch.json` / `.vscode/settings.json`，即使用户不是 v1.x `vscode` tool 用户，也会收到 “Detected ~/.vscode/ without ~/.copilot/” 的 legacy 提示。
  - 文案声明检测到的是 `~/.vscode/`，但实际可能只存在项目 `.vscode/`，会造成误导和噪声。

- **建议**
  - 按 AC #3 收窄为仅检测 `~/.vscode/ && !~/.copilot/`。
  - 如果确实要覆盖项目级 `.vscode/`，需拆成独立文案与独立测试，不能冒充 `~/.vscode/` legacy 场景。

### 3. [中][新] 配置文档仍把 `vscode` 列为合法 `--tools` 值

- **来源**：edge+auditor
- **分类**：patch

- **证据**
  - 英文配置文档仍写 `Target tools: copilot, claude, cursor, vscode`：`docs/configuration.md:78`
  - 中文配置文档仍写 `目标工具：copilot、claude、cursor、vscode`：`docs/configuration.zh.md:78`
  - 实际 `TOOL_DEFINITIONS` 只有 `copilot` / `claude` / `cursor`：`src/data/tool-registry.ts:9-34`
  - 手动 `--tools vscode` 会进入 `UNKNOWN_TOOL`：`src/stages/detect-tools.ts:160-170`

- **影响**
  - README 已更新 v2.0 迁移说明，但核心配置参考仍指示用户可使用已删除的工具 ID。
  - 用户按配置文档执行 `--tools vscode` 会得到 fatal 错误，削弱 AC #4 “Breaking Change 有完整文档依据”的完整性。

- **建议**
  - 同步更新 `docs/configuration.md` 和 `docs/configuration.zh.md`，移除 `vscode`，并补一句 v2.0 起请使用 `--tools copilot` 获取 VS Code MCP 项目级支持。

### 4. [中][新] `copilot:project:mcp-tools -> .vscode/` 缺少集成测试门禁

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - 数据层测试只验证规则存在：`tests/data/install-rules.test.ts:49-55`
  - 现有 copilot project 集成测试只断言 `.github/server.json`，未断言 `.vscode/server.json`：`tests/integration/pipeline.test.ts:940-958`
  - 原 `vscode:global` 集成测试被移除，并注释声明 `.vscode/` 集成测试推迟到 Story 7-10：`tests/integration/pipeline.test.ts:961-963`
  - AC #2 要求本 Story 中 copilot 新增 `.vscode/mcp.json` 项目级 MCP 规则生效：`_bmad-output/implementation-artifacts/stories/7-1-vscode-merge-and-mvp-rules-completion.md:20-23`

- **影响**
  - 当前测试能证明规则表里有 `.vscode/`，但不能证明 match/install/report 实际链路会把 `mcp-tools/*` 写到项目 `.vscode/`。
  - 这是 v2.0 删除 `vscode` 后的核心替代路径，推迟到 7-10 会让 Story 7-1 AC #2 存在 false-pass 风险。

- **建议**
  - 在当前 Story 测试集中补一个最小集成用例：project scope + `copilot` + fixture `mcp-tools`，断言实际生成 `<project>/.vscode/<filename>`。

### 5. [中][新] Rule Document Registry 同步不完整：`project-context.md` 的 reserved-name 清单缺项

- **来源**：auditor
- **分类**：patch

- **证据**
  - Rule Document Registry 要求规则变更同步 `_bmad-output/project-context.md`、`03-core-decisions.md`、`04-implementation-patterns.md`：`_bmad-output/project-context.md:17-31`
  - `project-context.md` 仅列出 `CLAUDE.md`、`AGENTS.md`、`settings.json`、`settings.local.json` 四个示例：`_bmad-output/project-context.md:242`
  - `03-core-decisions.md` 与 `04-implementation-patterns.md` 均描述 7 个完整保留名集合，包括 `claude.local.md`、`agents.local.md`、`.claudeignore`：`_bmad-output/planning-artifacts/architecture/03-core-decisions.md:223` / `_bmad-output/planning-artifacts/architecture/04-implementation-patterns.md:740`

- **影响**
  - 后续 agent 若只读取主规则文件 `project-context.md`，会漏掉 3 个 reserved-name 边界。
  - 违反项目级 Rule Document Registry “互为镜像”的同步约束。

- **建议**
  - 将 `project-context.md` 同步为完整 7 项 reserved-name 清单。
  - 同步补充三种 InstallType 均受保护、`--force` 无效、全 reserved-skip 使用黄色专属摘要等已在另外两份文档中记录的规则边界。

### 6. [中][新] migration FAQ 将 `--force` 描述为“skip”，可能误导用户覆盖手写 `.vscode/mcp.json`

- **来源**：blind
- **分类**：patch

- **证据**
  - 英文 FAQ 写 user-written file 会 prompt，“or skip it with `--force`”：`docs/migration-v2.md:103-105`
  - 中文 FAQ 写“或使用 `--force` 跳过确认”：`docs/migration-v2.zh.md:102-104`
  - CLI 消息中 `--force` 的语义是跳过交互确认/冲突确认：`src/core/messages.ts:520-522`

- **影响**
  - 英文 “skip it with `--force`” 容易被理解为保护性跳过该文件；实际 `--force` 更接近“不确认地继续覆盖/重装”。
  - 对 `.vscode/mcp.json` 这种用户配置文件，错误理解可能造成配置被覆盖。

- **建议**
  - 英文 FAQ 改为“prompt before overwriting; choosing skip in the prompt preserves the file. `--force` skips confirmation and may overwrite managed/conflicting files.”
  - 中文 FAQ 明确“`--force` 是跳过确认，不是跳过写入；如需保留文件，应在交互提示中选择跳过或不要使用 `--force`。”

### 7. [低][新] 新增迁移文档和 CHANGELOG 仍为未跟踪文件，存在发布断链风险

- **来源**：edge
- **分类**：patch

- **证据**
  - `git status --short -- CHANGELOG.md docs/migration-v2.md docs/migration-v2.zh.md README.md README.zh.md` 显示 `CHANGELOG.md`、`docs/migration-v2.md`、`docs/migration-v2.zh.md` 仍为未跟踪文件。
  - README 已链接新增迁移文档：`README.md:190` / `README.zh.md:190`

- **影响**
  - 如果发布或 PR 只包含 tracked diff，README 中的 migration 链接会变成断链，CHANGELOG 也不会随 v2.0.0 发布。
  - 该问题不影响当前本地测试，但影响交付完整性。

- **建议**
  - 提交前显式纳入 `CHANGELOG.md`、`docs/migration-v2.md`、`docs/migration-v2.zh.md`。
  - 发布前执行 `git status --short` 作为交付检查。

## 验证摘要

- `npm test` ✅ 通过（852 / 852）
- `npm run lint:src` ✅ 通过（ESLint + Prettier check）
- `npm run build` ✅ 通过（ESM + DTS build）
- 额外复核：
  - `src/core/messages.ts` 的 marker 文案与 migration 样例方向已对齐，但 AC #3 安装扩展指引缺失。
  - `src/stages/execute-install.ts` 的全 reserved-skip `completePhase` 分支已落地，并有对应测试覆盖。
  - 三层审查结果已去重；“缺少质量门禁证据”因本轮已实际执行完整命令链，未列为新发现。

## 通过项

- `vscode` 已从 `TOOL_DEFINITIONS` 移除，当前注册表仅包含 3 个工具。
- `BUILTIN_RULES` 规则总数与 Story 修正后的 19 条一致。
- `vscodeMergedNote` 的 Round 4 文档/代码不一致问题已闭合。
- reserved-name 全 reserved-skip 的完成态语义已从通用 skipped 摘要切换为专属黄色摘要。
- 三份 Rule Document Registry 文档均已包含 v2.0 工具注册表与 reserved-name 规则的主体描述；剩余问题是 `project-context.md` 清单缺项和细节不完整。

## 结论

- **结论：不通过**
- **阻塞项**：无 [高] 级阻塞项；但发现 #1-#6 建议作为本 Story 交付前必须修复的中优先级问题。
- **建议**：先修复 AC #3 warning 文案、`.vscode` 误报、配置文档残留、`.vscode` 集成测试、Rule Document Registry 主规则文件缺项，再进入下一轮 CR。
