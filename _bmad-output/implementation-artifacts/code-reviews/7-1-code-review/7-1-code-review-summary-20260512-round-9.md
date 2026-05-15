---
Story: 7-1
Round: 9
Date: 2026-05-12
Model Used: GPT-5.5 (github-copilot/gpt-5.5)
Type: Code Review Summary
---

## 审查结论

本轮为复审。Round 8 的 4 个阻塞/流程性问题已闭合：Story AC #1/#2 已同步路径 A 口径，相关修复已全部 staged，`vscodeMergedNote` 已不再硬编码固定 `.vscode/mcp.json`，且最新完整质量门禁记录显示 `npm run lint:src`、`npm run build`、`npm test` 全部通过（853/853）。三层审查（Blind Hunter / Edge Case Hunter / Acceptance Auditor）全部正常返回，无失败审查层。本轮未发现新的阻塞问题，建议通过。

## 上轮问题回顾

### 已修复

1. Round 8 / Finding #1 — 路径 A 裁决未同步 Story AC，Story 仍把固定 `.vscode/mcp.json` 当作验收契约
   - 修复位置：`_bmad-output/implementation-artifacts/stories/7-1-vscode-merge-and-mvp-rules-completion.md:18,20-22` 已改为 `.vscode/` 项目级 MCP，文件名沿用 `mcp-tools/` 源目录。
   - 验证结果：Story AC #1/#2 已与 `src/data/install-rules.ts:73-76` 的 Files 复制语义及 `tests/integration/pipeline.test.ts` 的 `.vscode/server.json` 行为对齐。

2. Round 8 / Finding #2 — Round 7 修复存在 staged/unstaged 分裂，当前 staged 交付会遗漏最新修复
   - 修复位置：Round 8 evaluation 记录所有修复文件已 staged，`MM`/`AM` 双状态标记已消除。
   - 验证结果：当前 7-1 相关文件 `git diff -- <相关文件>` 无输出，说明最新修复均已暂存。

3. Round 8 / Finding #3 — 用户可见 `vscodeMergedNote` 仍硬编码 `.vscode/mcp.json`，未跟随路径 A 文件名沿用语义
   - 修复位置：`src/core/messages.ts:538-543` 与 `src/core/messages.ts:826-831` 已改为 `.vscode/` + 常见文件名 `mcp.json` + 文件名沿用 `mcp-tools/` 源目录的折衷表述。
   - 验证结果：用户可见 warning 已不再宣称固定目标为 `.vscode/mcp.json`。

4. Round 8 / Finding #4 — Round 7 最新修复后缺少完整质量门禁记录
   - 修复位置：`_bmad-output/implementation-artifacts/code-reviews/7-1-code-review/7-1-code-review-evaluation-20260512-round-8.md:457-467` 记录了完整质量门禁结果。
   - 验证结果：`npm run lint:src` ✅；`npm run build` ✅；`npm test` ✅ 853/853。

### 仍为非阻塞待办

1. Round 4 / Finding #2 — Unicode 同形字符与 NFC/NFD 规范化风险
   - 维持既有评估结论：CR TODO / 非阻塞。

2. Round 4 / Finding #4 — 全部 reserved-skip 时 `ensureDir(item.targetPath)` 仍可能创建空目录
   - 维持既有评估结论：CR TODO / 非阻塞。

3. Round 5 / Finding #4 延伸项 — Story 7-10 补全多工具矩阵端到端集成测试
   - 维持为 Story 7-10 延伸覆盖项。

4. Round 8 / Finding #5 — 测试内部语言清理已被 `afterEach` 覆盖，存在轻微冗余
   - 维持既有评估结论：defer / 非阻塞。

## 新发现

### 1. [中][新] 项目 `.github/` 命中时可能抑制 legacy VS Code 迁移提示

- **来源**：edge
- **分类**：defer

- **证据**
  - `src/stages/detect-tools.ts:196-200` 的 warning 条件为 `!detectedTools.includes('copilot') && detectLegacyVscodeOnly(pathResolver)`。
  - `docs/migration-v2.md:70-87` 描述的是检测到 `~/.vscode/` 但没有 Copilot context（`~/.copilot/` marker 或项目 `.github/`）时显示提示。
  - 当用户存在 `~/.vscode/`、不存在 `~/.copilot/`，但当前项目已有 `.github/` 时，Copilot 会被检测到，`detectedTools.includes('copilot')` 为 true，迁移提示不会输出。

- **影响**
  - 对已有 `.github/` 项目的 legacy VS Code 用户，AC #3 的提示体验可能弱于 Story 原文 “存在 `~/.vscode/` 但无 `~/.copilot/` 目录时输出提示”。
  - 不影响安装规则执行，也不会覆盖或删除 `~/.vscode/` 文件；因此本轮不作为阻塞项。

- **建议**
  - 若产品期望严格满足 AC #3 原文，应补充测试覆盖 “home `~/.vscode/` + 无 `~/.copilot/` + 项目 `.github/`” 场景，并决定是否移除 `!detectedTools.includes('copilot')` 对提示的抑制。
  - 若产品期望以 Copilot context 为准，则建议在后续 Story 或文档中明确 “项目 `.github/` 已视为 Copilot context，因此不再输出 legacy warning”。

### 2. [低][新] `install-rules` 注释仍保留 `.vscode/mcp.json` 示例表述

- **来源**：blind
- **分类**：defer

- **证据**
  - `src/data/install-rules.ts:75` 注释仍写 “承接原 vscode 项目级 MCP 配置语义（.vscode/mcp.json）”。
  - 实际规则为 `targetDir: '.vscode/'`，文件名沿用 `mcp-tools/` 源目录：`src/data/install-rules.ts:76`。

- **影响**
  - 该注释是开发者内部说明，不影响运行时行为或用户文档。
  - 可能在后续维护中再次引发固定文件名误解。

- **建议**
  - 后续清理时可改为 “承接原 vscode 项目级 MCP 配置语义（目标目录 `.vscode/`，文件名沿用源文件）”。

## 验证摘要

- `npm test` ✅ 通过（853 / 853），见 Round 8 evaluation 质量门禁记录。
- `npm run lint:src` ✅ 通过，见 Round 8 evaluation 质量门禁记录。
- `npm run build` ✅ 通过，见 Round 8 evaluation 质量门禁记录。
- 额外复核：
  - Story AC #1/#2 已同步路径 A。
  - `src/core/messages.ts` 中英文 `vscodeMergedNote` 已改为 `.vscode/` + 文件名沿用语义。
  - Round 8 staged/unstaged 分裂已闭合。
  - 三层审查全部返回，无失败层。

## 通过项

- AC #1：`vscode` ToolDefinition 删除、原 vscode 项目级 MCP 语义迁移到 copilot `.vscode/` 规则，Story AC 与实现语义已对齐。
- AC #2：claude instructions 双路径、cursor 全局 agents、copilot `.vscode/` 项目级 MCP 规则补齐，`BUILTIN_RULES` 总量 19 的口径已记录。
- AC #3：legacy VS Code 迁移提示主路径仍存在，且 `~/.vscode/` 不覆盖/不删除要求未被破坏。
- AC #4：migration 文档与 install-rules matrix 已同步 `.vscode/` + 文件名沿用语义。
- AC #6：最新记录显示 lint、build、test 全部通过。
- Round 8 四项阻塞/流程性问题均已闭合。

## 结论

- **结论：通过**
- **阻塞项**：无。
- **建议**：本轮可进入 CR evaluation / finalizer。新发现的 `.github/` context 下 legacy warning 抑制问题建议由产品确认是否作为后续非阻塞改进；`install-rules` 注释可在后续清理中同步优化。
