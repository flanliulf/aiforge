---
Story: 7-5
Round: 1
Date: 2026-05-18
Model Used: GitHub Copilot CLI (model not exposed)
Review Source: 7-5-code-review-summary-20260518-round-1.md
Review Model: GitHub Copilot CLI (model not exposed)
Type: Code Review Evaluation
---

## 评估总结

对 Story 7-5 的第 1 轮 CR 代码审查结果（首轮）进行逐条评估。审查仅提出 1 个发现：Story AC #5 中 `BUILTIN_RULES` 总量 41 条，与当前实现、测试和 Dev Agent Record 的 40 条口径不一致。经独立核对，OpenCode 本身要求的 7 条新增规则已完整实现，当前 `40 = 33 条既有基线 + 7 条 OpenCode 新增规则` 的口径成立。评估结论如下：**通过；无需代码修复；建议将 41 作为规格累计计数误差，在后续文档维护中澄清为 40**。

---

## 发现 #1 评估

### 审查原文

> **[高] AC #5 的 `BUILTIN_RULES` 总量与实现/测试口径不一致**
> - 来源：auditor
> - 分类：decision_needed

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P2 优先级）

### 评估分析

**问题描述准确性：准确**

审查指出的文本冲突真实存在：

- Story AC #5 写明“新增规则 +7 条，`BUILTIN_RULES` 总量为 41 条”：`_bmad-output/implementation-artifacts/stories/7-5-opencode-xdg-integration.md:32-34`。
- Epic 规划中同样保留 41 条口径：`_bmad-output/planning-artifacts/epics/epic-7.md:351-353`。
- 当前实现注释声明 40 条规则覆盖 7 工具：`src/data/install-rules.ts:8-10`。
- 当前测试明确断言 40 条：`tests/data/install-rules.test.ts:14-17`。
- Dev Agent Record 已记录当前仓库 33 条既有规则基线 + 7 条 OpenCode 后为 40，并说明 41 为累计计数误差：`_bmad-output/implementation-artifacts/stories/7-5-opencode-xdg-integration.md:119-126`。

同时，独立核对 `src/data/install-rules.ts:200-251` 后确认 OpenCode 规则矩阵完整覆盖 Story 要求的 7 条：

1. global skills → `~/.config/opencode/skills/`
2. global agents → `~/.config/opencode/agents/`
3. global instructions → `~/.config/opencode/`
4. global mcp-tools → `~/.config/opencode/`
5. project skills → `.opencode/skills/`
6. project agents → `.opencode/agents/`
7. project mcp-tools → `.opencode/`

`tests/data/install-rules.test.ts:187-252` 也逐项验证了上述 7 条规则和 `MCP_MERGE_HINTS.opencode`。

**严重性判断：偏高**

该发现属于验收口径/文档计数冲突，不是 OpenCode 接入功能缺陷。若机械坚持 AC 文本中的 41，确实会造成验收误判；但从实现证据看，Story 7-5 的实际业务增量是“新增 7 条 OpenCode 规则”，当前代码已经完整满足。额外补 1 条规则只为达到 41，会引入没有需求来源的安装行为，风险高于收益。

因此，原始严重性 `[高]` 可降级为 **P2 非阻塞文档澄清项**。

**修复建议：可行但非必要**

审查建议中的两种分支需区分处理：

- “若 41 仍为有效验收标准：补齐缺失规则并同步更新测试”——经评估不采纳。当前不存在可被需求证明的第 8 条 OpenCode 规则，强行补齐会制造错误规则。
- “若 40 为正确口径：明确接受 33+7=40，并作为非代码修复的规格澄清项处理”——采纳。当前评估即明确接受 40 口径。

如后续允许文档维护，建议把 Story/Epic/PLAN 中的“41 条”统一澄清为“40 条（33 条当前基线 + 7 条 OpenCode）”；测试无需调整，因为已按正确口径覆盖。

**误报评估：非误报**

该发现不是误报，因为 AC 文本与实现/测试确有冲突。但冲突根因是规格累计计数误差，不是本次实现缺失规则。

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 无 | 无阻塞修复项 | - | - | 当前实现已满足 OpenCode 7 条规则、XDG 路径与 MCP 降级提示要求 |

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | `BUILTIN_RULES` 总量 41 vs 40 的规格口径冲突 | [高] | **P2** | 接受 40 为正确实现口径；建议后续文档维护统一修正 41 的累计计数误差 |

### 评估决定

- **发现 #1（`BUILTIN_RULES` 总量 41 vs 40）**：确认发现有效，但不构成代码阻塞。评估采纳 `33 + 7 = 40` 作为 Story 7-5 的验收口径；41 判定为规格累计计数误差。无需 fixer 执行代码修复；如后续进入文档整理，可同步修正 Story/Epic/PLAN 中的 41 口径。
- **最终结论**：通过。Story 7-5 可继续后续 CR 流程；fixer 无必须处理事项。

## 修复执行记录

### 修复执行记录
- **Date**: 2026-05-18
- **Model Used**: GitHub Copilot CLI (model not exposed)
- **Fix Items**: 0

- 本轮 fixer 读取最新 evaluation 后确认“需要修复（阻塞交付）”为空，按评估结论执行零代码修复。
- 未修改源码、Story 文档或规划文档；仅追加本节执行记录，并同步更新 `EXPERIMENTS.md`、`EXPERIMENT_NOTES.md` 留痕。
- 默认采纳 evaluation 已确认的口径：`33 + 7 = 40`；“41” 视为后续文档维护阶段处理的累计计数误差，不在本轮 fixer 范围内。
- 验证结论：沿用 evaluation 阶段已完成的针对性验证结果 `TMPDIR=$PWD/.test-tmp npm test -- tests/data/install-rules.test.ts`，50/50 通过；因 fixer 无代码变更，本轮未重复执行新的构建或测试。
