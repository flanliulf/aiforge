---
Story: 7-1
Round: 8
Date: 2026-05-12
Model Used: GPT-5.5 (github-copilot/gpt-5.5)
Type: Code Review Summary
---

## 审查结论

本轮为复审（Round 8）。三层审查（Blind Hunter / Edge Case Hunter / Acceptance Auditor）全部正常返回，无失败审查层。Round 7 的 3 项修复在工作区内容中已有明显落地：migration 文档已改为 Copilot context / marker 口径，install-rules matrix 与 migration 文档已改为 `.vscode/` + 源文件名沿用语义，`tests/stages/detect-tools.test.ts` 已增加 `afterEach(() => setLanguage('zh-CN'))`。

但本轮仍发现阻塞性交付问题：路径 A 裁决未同步到 Story AC，用户可见 `vscodeMergedNote` 仍硬编码 `.vscode/mcp.json`，且部分 Round 7 修复存在 staged/unstaged 分裂，当前按 staged 交付会遗漏最新修复。因此建议暂不通过。

## 上轮问题回顾

### 已修复

1. Round 7 / Finding #1 — migration 文档 Copilot 检测与 warning 触发条件不准确
   - 修复位置：`docs/migration-v2.md:62` / `docs/migration-v2.zh.md:62` 已改为通过 `~/.copilot/` marker 或项目 `.github/` 检测 Copilot context。
   - 修复位置：`docs/migration-v2.md:70` / `docs/migration-v2.zh.md:70` 已补充 “no Copilot context (`~/.copilot/` marker or project `.github/`)” 条件。
   - 验证结果：migration 文档主体已与检测逻辑对齐。

2. Round 7 / Finding #2 — `.vscode/mcp.json` 文档与 Files 复制实现不一致
   - 修复位置：`docs/migration-v2.md:29,54,75,107-117` 与中文对应位置已改为 `.vscode/` / `.vscode/<filename>` / 源文件名沿用语义。
   - 修复位置：`docs/install-rules-matrix.md:25` / `docs/install-rules-matrix.zh.md:25` 已改为 filename follows source 口径。
   - 验证结果：迁移文档和规则矩阵已基本闭合；但 Story AC 与运行时 warning 文案未同步，见本轮发现 #1 和 #3。

3. Round 7 / Finding #3 — 英文语言切换测试缺少 `afterEach` 恢复语言
   - 修复位置：`tests/stages/detect-tools.test.ts:1` 已导入 `afterEach`，`tests/stages/detect-tools.test.ts:94-98` 已新增文件级语言恢复兜底。
   - 验证结果：测试语言状态污染风险已基本闭合；测试内部重复清理只是非阻塞冗余。

### 仍为非阻塞待办

1. Round 4 / Finding #2 — Unicode 同形字符与 NFC/NFD 规范化风险
   - 维持既有评估结论：CR TODO / 非阻塞。

2. Round 4 / Finding #4 — 全部 reserved-skip 时 `ensureDir(item.targetPath)` 仍可能创建空目录
   - 维持既有评估结论：CR TODO / 非阻塞。

3. Round 5 / Finding #4 延伸项 — Story 7-10 补全多工具矩阵端到端集成测试
   - 维持为 Story 7-10 延伸覆盖项。

## 新发现

### 1. [高][新] 路径 A 裁决未同步 Story AC，Story 仍把固定 `.vscode/mcp.json` 当作验收契约

- **来源**：auditor
- **分类**：patch

- **证据**
  - Round 7 评估明确记录用户裁决为路径 A：保持 Files 复制语义，修改文档/Story AC：`_bmad-output/implementation-artifacts/code-reviews/7-1-code-review/7-1-code-review-evaluation-20260512-round-7.md:285-303`。
  - Story AC #1 仍写原 vscode 规则为 “`.vscode/mcp.json` 项目级 MCP”：`_bmad-output/implementation-artifacts/stories/7-1-vscode-merge-and-mvp-rules-completion.md:18`。
  - Story AC #2 仍写 copilot 缺失/新增的是 “`.vscode/mcp.json` 项目级 MCP 规则”：`_bmad-output/implementation-artifacts/stories/7-1-vscode-merge-and-mvp-rules-completion.md:20-22`。
  - 实现仍是 Files 复制到 `.vscode/`，不会重命名源文件：`src/data/install-rules.ts:73-76`。
  - 集成测试断言当前 fixture 写入 `.vscode/server.json`：`tests/integration/pipeline.test.ts:958-960`。

- **影响**
  - Story AC 作为验收合同仍要求固定 `.vscode/mcp.json`，而实现与测试证明当前交付为 `.vscode/<源文件名>`。
  - 下游 finalizer 或验收人员按 Story AC 复核时，会认为 AC #1/#2 未满足。
  - 这是规格-实现-测试三方不一致，阻塞 Story 7-1 关闭。

- **建议**
  - 按路径 A 同步 Story AC #1/#2：将 `.vscode/mcp.json` 改为 `.vscode/` 项目级 MCP 目录，或明确“文件名沿用 `mcp-tools/` 源目录文件名”。
  - 同步 Story Dev Notes 中仍使用 `.vscode/mcp.json` 固定口径的说明，避免二次误解。

### 2. [高][新] Round 7 修复存在 staged/unstaged 分裂，当前 staged 交付会遗漏最新修复

- **来源**：auditor
- **分类**：patch

- **证据**
  - `git status --short` 显示多个相关文件为 `MM` / `AM`：`docs/install-rules-matrix.md`、`docs/install-rules-matrix.zh.md`、`docs/migration-v2.md`、`docs/migration-v2.zh.md`、`tests/stages/detect-tools.test.ts`。
  - `git diff --cached -- docs/migration-v2.md docs/migration-v2.zh.md ...` 仍显示已暂存版本中保留旧口径，例如 `Project-level .vscode/mcp.json via Copilot`、`target: .vscode/mcp.json`、`detect GitHub Copilot (if installed)`。
  - `git diff -- docs/migration-v2.md docs/migration-v2.zh.md ...` 显示 Round 7 的最新修复只存在于 unstaged diff 中，例如 `.vscode/<filename>`、Copilot context 检测说明、`afterEach` 导入与 hook。

- **影响**
  - 若当前直接提交 staged 内容，Round 7 Fix #1/#2/#3 的关键修复不会完整进入交付。
  - 复审看到的工作区内容与实际可提交内容不一致，会导致发布/PR 中复现旧问题。
  - 这是交付完整性阻塞项。

- **建议**
  - 重新 `git add` Round 7/Round 8 相关文件，尤其是 `docs/migration-v2*.md`、`docs/install-rules-matrix*.md`、`tests/stages/detect-tools.test.ts`、Story AC 修订文件和 `src/core/messages.ts` 后续修复。
  - 复核 `git diff --cached` 不再包含旧口径后再进入下一轮 CR。

### 3. [中][新] 用户可见 `vscodeMergedNote` 仍硬编码 `.vscode/mcp.json`，未跟随路径 A 文件名沿用语义

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - 中文运行时 warning 仍写目标路径 `.vscode/mcp.json`：`src/core/messages.ts:538-543`。
  - 英文运行时 warning 仍写 target `.vscode/mcp.json`：`src/core/messages.ts:826-831`。
  - 当前路径 A 文档已改为 `.vscode/<filename>` / 源文件名沿用语义：`docs/migration-v2.md:75` / `docs/migration-v2.zh.md:74`。
  - 实现与测试实际为 `.vscode/server.json`：`src/data/install-rules.ts:73-76`，`tests/integration/pipeline.test.ts:958-960`。

- **影响**
  - 用户看到 CLI warning 后会以为固定写入 `.vscode/mcp.json`，但实际文件名取决于 `mcp-tools/` 源文件。
  - 该问题重复制造 Round 7 #2 已修复的文档/实现口径不一致，只是残留在运行时消息中。

- **建议**
  - 将 `detectTools.vscodeMergedNote` 中的目标路径改为 `.vscode/<文件名>` / `.vscode/<filename>`，或更保守地写成 `.vscode/`。
  - 同步更新相关测试断言（如果有精确匹配目标路径的测试）。

### 4. [中][新] Round 7 最新修复后缺少完整质量门禁记录

- **来源**：auditor
- **分类**：patch

- **证据**
  - Story AC #6 要求执行 `npm test && npm run lint:src && npm run build` 全部通过：`_bmad-output/implementation-artifacts/stories/7-1-vscode-merge-and-mvp-rules-completion.md:40-42`。
  - Round 7 修复记录只声明针对 `tests/stages/detect-tools.test.ts` 的局部测试通过：`_bmad-output/implementation-artifacts/code-reviews/7-1-code-review/7-1-code-review-evaluation-20260512-round-7.md:321`。
  - 未看到 Round 7 文档、测试 hook、文件名口径修复后重新运行完整 `npm test && npm run lint:src && npm run build` 的记录。

- **影响**
  - 当前最新变更包含测试文件、文档和 staged 状态变化；缺少完整门禁记录时，AC #6 不能按最新工作区状态确认。
  - 这不是代码缺陷，但阻塞最终 CR 通过判定。

- **建议**
  - 在修复本轮发现后执行完整 `npm test && npm run lint:src && npm run build`。
  - 将最新结果记录到后续 evaluation 修复记录或 Story Dev Agent Record 中。

### 5. [低][新] 测试内部语言清理已被 `afterEach` 覆盖，存在轻微冗余

- **来源**：blind
- **分类**：defer

- **证据**
  - 文件级 `afterEach(() => setLanguage('zh-CN'))` 已存在：`tests/stages/detect-tools.test.ts:94-98`。
  - 英文 vscodeMergedNote 测试末尾仍手动 `setLanguage('zh-CN')`：`tests/stages/detect-tools.test.ts:516-518`。

- **影响**
  - 不影响测试正确性，也不阻塞交付。
  - 仅为维护噪音。

- **建议**
  - 可保留冗余清理；如后续清理测试风格，可删除测试内部重复清理。

## 验证摘要

- `npm test` 本轮未重新执行；Round 7 修复记录仅显示局部测试 `tests/stages/detect-tools.test.ts` 通过。
- `npm run lint:src` 本轮未重新执行；未见 Round 7 最新修复后的完整记录。
- `npm run build` 本轮未重新执行；未见 Round 7 最新修复后的完整记录。
- 额外复核：
  - 三层审查全部返回，无失败层。
  - `git diff HEAD -- <Story 7-1 相关文件>` 已用于本轮审查输入。
  - `git status --short`、`git diff --cached`、`git diff` 已用于确认 staged/unstaged 分裂。

## 通过项

- Round 7 Fix #1 在工作区内容中已修复 migration 文档 Copilot context 检测口径。
- Round 7 Fix #2 在 migration 文档与 install-rules matrix 中已基本修复 `.vscode/` 文件名沿用源文件语义。
- Round 7 Fix #3 已添加 `afterEach(() => setLanguage('zh-CN'))`，语言状态污染风险基本闭合。
- AC #1/#2 主实现仍保持：`vscode` ToolDefinition 删除，`BUILTIN_RULES` 包含 copilot `.vscode/`、claude instructions 双路径、cursor global agents。
- AC #3 运行时主逻辑仍保持：未检测到 copilot 且存在 home `~/.vscode/` 时输出 migration warning。

## 结论

- **结论：不通过**
- **阻塞项**：Story AC 未同步路径 A；Round 7 修复 staged/unstaged 分裂；运行时 warning 仍硬编码 `.vscode/mcp.json`。
- **建议**：同步 Story AC 与 `vscodeMergedNote` 运行时文案到 `.vscode/` / 源文件名沿用语义；重新 stage 最新修复；执行完整质量门禁后进入 Round 9 快速复审。
