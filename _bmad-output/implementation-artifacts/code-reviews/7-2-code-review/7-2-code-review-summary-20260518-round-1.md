---
Story: 7-2
Round: 1
Date: 2026-05-18
Model Used: GPT-5.5 (gpt-5.5)
Type: Code Review Summary
---

## 审查结论

首轮审查。Agent 并行调度工具不可用，本轮按 Blind Hunter / Edge Case Hunter / Acceptance Auditor 三个视角降级为串行审查；审查层无失败。`npm test`、`npm run lint:src`、`npm run build` 均通过，但存在 1 个 decision_needed 规格裁决项和 1 个 patch 项。建议：不通过，需先裁决 Codex instructions 与规则总数口径，并修正 mcp-tools 安装结果摘要标记。

## 新发现

### 1. [高] Story AC 与实现方案冲突：Codex instructions 与规则总数无法同时满足

- **来源**：auditor
- **分类**：decision_needed

- **证据**
  - `_bmad-output/implementation-artifacts/stories/7-2-codex-cli-integration.md:18-26` 明确要求全局/项目安装均包含 `instructions/`：全局到 `~/.codex/`，项目级到 `.codex/`。
  - `_bmad-output/implementation-artifacts/stories/7-2-codex-cli-integration.md:36-37` 同时要求新增规则 +5 且 `BUILTIN_RULES` 总量为 25；但 `_bmad-output/implementation-artifacts/stories/7-2-codex-cli-integration.md:53` 又记录采用 +5 方案并将 instructions 下放到后续 Story。
  - `src/data/install-rules.ts:156-194` 当前 Codex 规则只有 skills global/project、agents global/project、mcp-tools global 共 5 条，没有 `sourceDir: 'instructions'` 的 Codex 规则。
  - `tests/data/install-rules.test.ts:14` 将当前期望固化为 24 条规则，`_bmad-output/implementation-artifacts/stories/7-2-codex-cli-integration.md:165` 也记录实际总量为 24，和 AC #5 的 25 不一致。

- **影响**
  - 如果 AC #2/#3 仍为准，当前实现会漏装 Codex instructions，用户执行 `aiforge install --tools codex` 后无法获得 Story 开头承诺的 instructions 配置。
  - 如果 +5/24 为准，则 Story 的 AC #2/#3/#5 和测试计划仍是过期规格，后续 CR/Finalizer 可能把未对齐的范围误判为完成。

- **建议**
  - 先由产品/SM 明确 7-2 的最终边界：要么把 Codex instructions 纳入本 Story，并同步调整规则总数与测试；要么正式修订 AC #2/#3/#5，声明 instructions 延后到指定 Story，且 `BUILTIN_RULES` 总数为 24。
  - 在裁决前不建议标记 Story Done。

### 2. [中] mcp-tools 安装结果摘要仍显示普通安装状态，未标注“需手动合并”

- **来源**：blind+auditor
- **分类**：patch

- **证据**
  - `_bmad-output/implementation-artifacts/stories/7-2-codex-cli-integration.md:32` 要求安装结果摘要中将 mcp-tools 标注为“需手动合并”状态，而不是 ✅ 直接完成。
  - `src/stages/execute-install.ts:357-371` 仅根据 plan 额外输出 `Reporter.warn(...)` 合并提示，`src/stages/execute-install.ts:781` 在安装阶段调用该提示；这没有改变后续安装结果摘要的单项展示。
  - `src/core/reporter.ts:319-324` TTY 摘要仍按 `item.status` 选择图标与输出行，`new` 会显示 ✅；`src/core/reporter.ts:511` Plain 摘要仍输出 `new/updated/skipped`，没有任何 manual-merge 标记。
  - `tests/stages/execute-install.test.ts:605-614` 和 `tests/pipeline.test.ts:294-319` 只断言 warning 包含 `~/.codex/config.toml` 与 `[mcp]`，没有覆盖“安装结果摘要不显示 ✅ 直接完成”的 AC。

- **影响**
  - 用户会同时看到手动合并 warning 和普通安装成功摘要；在 TTY 输出中 mcp-tools 仍可能呈现为 ✅ 已完成，违背 AC #4 的“需手动合并”状态要求。
  - CI/plain 输出也无法从结果行区分 mcp-tools 是“模板已复制但仍需人工合并”，自动化消费方会把它当作普通 new/updated 文件。

- **建议**
  - 保持 `InstallResult.items[].status` 三态不变，但在结果项中补充可展示的附加标记（例如 optional `manualAction` / `requiresManualMerge`），或在 reporter 层基于可追溯元数据识别 mcp-tools 并显示“需手动合并”。
  - 同步补充 TTY、Plain、Quiet 或至少 Story 覆盖的 reporter 测试，断言 mcp-tools 摘要不再以普通 ✅/`new` 语义作为唯一状态。

## 验证摘要

- `npm test` ✅ 通过（864 / 864）
- `npm run lint:src` ✅ 通过
- `npm run build` ✅ 通过
- 定向复核 ✅ 完成
  - 对照 Story AC #1-#5、Codex 规则矩阵、MCP merge hint 输出路径、Reporter 摘要输出路径和相关测试断言。

## 通过项

- Codex 工具注册已覆盖 `~/.codex` 与 `.codex` 检测标志，自动检测测试覆盖全局/项目命中。
- Codex skills 与 agents 的全局/项目规则已按 +5 方案落地，RULE_INDEX 可查。
- MCP merge hint 文案包含目标文件 `~/.codex/config.toml` 与 `[mcp]` 段，并覆盖 dry-run 与实际安装路径的 warning 输出。
- `InstallResult.items[].status` 未扩展，仍保持 `new | updated | skipped` 三态。
