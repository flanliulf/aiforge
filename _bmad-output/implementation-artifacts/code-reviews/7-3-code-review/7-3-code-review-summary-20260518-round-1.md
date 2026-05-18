---
Story: 7-3
Round: 1
Date: 2026-05-18
Model Used: GPT-5.5
Type: Code Review Summary
---

## 审查结论

首轮审查。本轮按 `bmenhance-cr-01-reviewer` 执行；当前环境未提供独立 Agent 子代理调度能力，因此降级为单一审查模式，按 Blind Hunter / Edge Case Hunter / Acceptance Auditor 三个视角串行复核。`npm test`、`npm run lint:src`、`npm run build` 均通过；Auggie 工具定义、安装规则、`InstallRule.fileFilter` 白名单设计和核心单元测试整体成立。

结论：不通过。原因不是质量门禁失败，而是 Story AC #5 的 `BUILTIN_RULES` 总量仍写 30，与当前仓库已采用的 29 条基线不一致；同时 Auggie 自身缺少端到端安装测试，尚未覆盖 `instructions/AGENTS.md -> ./AGENTS.md` 的真实写入路径。

## 新发现

### 1. [高] Story AC #5 的 `BUILTIN_RULES` 总量与当前仓库基线不一致

- **来源**：auditor
- **分类**：decision_needed

- **证据**
  - `_bmad-output/implementation-artifacts/stories/7-3-auggie-augment-code-integration.md:33` 明确要求 Story 7-3 完成后 `BUILTIN_RULES` 总量为 30 条。
  - `tests/data/install-rules.test.ts:14-15` 断言当前实现应为 29 条：当前 24-rule baseline + 5 Auggie rules。
  - `_bmad-output/implementation-artifacts/stories/7-3-auggie-augment-code-integration.md:131` 的 Dev completion notes 也确认该差异未解决，并说明实际总量为 29。

- **影响**
  - 如果按 AC #5 字面验收，当前实现失败；如果按 Story 7-2 后的当前仓库基线验收，当前实现正确。这个分歧会阻塞后续 CR evaluation / finalizer 对“是否满足 AC #5”的一致判断。
  - 该问题不应通过额外添加超范围规则来凑 30，否则会破坏 Story 7-3 仅新增 Auggie 5 条规则的边界。

- **建议**
  - 由 PO/PM 或 Story owner 明确裁决：将 AC #5 的总量口径更新为 29，或提供 30 条规则的来源说明。
  - 在裁决前，不建议将 Story 标记为 Done。

### 2. [中] Auggie 缺少端到端安装测试覆盖项目根 `AGENTS.md` 写入路径

- **来源**：auditor
- **分类**：patch

- **证据**
  - `tests/stages/match-rules.test.ts:612-636` 已验证 Auggie project instructions 规则在 match 阶段只匹配 `AGENTS.md`，不包含 `CLAUDE.md`。
  - `tests/integration/pipeline.test.ts:861-872` 和 `tests/integration/pipeline.test.ts:950-960` 仅覆盖 Copilot 的 `AGENTS.md` 端到端安装路径。
  - 对 `tests/integration/**` 检索 `auggie` 无命中，说明当前没有 Auggie 自身的 pipeline/install 级集成测试。

- **影响**
  - AC #2/#3/#4 是安装行为验收，不只是规则矩阵验收。当前测试能证明规则匹配正确，但不能直接证明 Auggie 全局 skills、项目 skills/agents，以及 `instructions/AGENTS.md -> ./AGENTS.md` 在真实安装阶段都按预期落盘。
  - `targetDir: './'` 是本 Story 的特殊路径，值得用端到端测试锁住，避免后续 path resolver、reserved-name 保护或安装汇总改动造成回归。

- **建议**
  - 增加至少一个 Auggie project 端到端测试：使用 sample repo 同时包含 `instructions/AGENTS.md` 与 `instructions/CLAUDE.md`，执行 `tools: ['auggie'], global: false`，断言项目根只生成 `AGENTS.md`，不生成/覆盖 `CLAUDE.md`。
  - 另补一个 Auggie global 端到端测试或定向安装测试，断言 skills 目录安装到 `~/.augment/skills/`。

## 验证摘要

- `npm test` 通过：33 个测试文件，877 / 877 passed。
- `npm run lint:src` 通过：ESLint 与 Prettier 检查无错误。
- `npm run build` 通过：构建成功，产物生成完成。
- 定向复核：
  - `TOOL_DEFINITIONS` 包含 `auggie`，检测路径为 `~/.augment` / `.augment`。
  - `BUILTIN_RULES` 包含 5 条 Auggie 规则：global skills/agents，project skills/agents/instructions。
  - `InstallRule.fileFilter?: string[]` 已加入类型定义，并在 `scanSourceFiles()` 末尾按 basename 白名单过滤。
  - Auggie project instructions 规则设置 `fileFilter: ['AGENTS.md']`，Claude instructions 规则设置 `fileFilter: ['CLAUDE.md']`，Copilot instructions 规则设置 `fileFilter: ['AGENTS.md']`。
  - 零匹配恢复候选路径复用 `scanSourceFiles()`，不会绕过 `fileFilter` 泄漏白名单外文件名。

## 通过项

- Auggie 工具注册符合 AC #1：`id/name/detect` 均与 Story 要求一致。
- Auggie 安装规则数量和目标路径符合当前实现边界：5 条规则覆盖 global/project 的 skills、agents，以及 project instructions。
- `fileFilter` 作为 `InstallRule` 可选字段的设计边界合理：默认无过滤，只有显式配置的 rules 启用白名单；过滤位置位于 `scanSourceFiles()` 末尾，可同时服务主匹配和零匹配恢复候选。
- instructions 白名单行为在 match 阶段已有针对性测试：Auggie/Copilot 只取 `AGENTS.md`，Claude 只取 `CLAUDE.md`。
