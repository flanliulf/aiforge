---
Story: 7-5
Round: 1
Date: 2026-05-18
Model Used: GitHub Copilot CLI (model not exposed)
Type: Code Review Summary
---

## 审查结论

首轮审查。因用户要求“不要并行调用其它 workflow sub agent”，本轮未启动独立三层 Agent，已降级为当前 reviewer 串行三视角审查（blind / edge / auditor）。`npm test`、`npm run lint:src`、`npm run build` 均通过；实现本身未发现明确代码缺陷。但 Story AC #5 与实现/测试/Dev Agent Record 对 `BUILTIN_RULES` 总量存在 41 vs 40 的验收口径冲突，本轮结论为：**有待 evaluator 判定**。

## 新发现

### 1. [高] AC #5 的 `BUILTIN_RULES` 总量与实现/测试口径不一致

- **来源**：auditor
- **分类**：decision_needed

- **证据**
  - `_bmad-output/implementation-artifacts/stories/7-5-opencode-xdg-integration.md:32-34`：AC #5 明确要求“新增规则 +7 条，`BUILTIN_RULES` 总量为 41 条”。
  - `src/data/install-rules.ts:9`：实现注释声明“40 条规则覆盖 7 工具”。
  - `tests/data/install-rules.test.ts:14-17`：测试断言 `BUILTIN_RULES` 长度为 40。
  - `_bmad-output/implementation-artifacts/stories/7-5-opencode-xdg-integration.md:119-126`：Dev Agent Record 记录当前仓库 33 条基线 + 7 条 OpenCode 规则后为 40，并说明 41 为规格累计计数误差。

- **影响**
  - 严格按 Story AC #5 验收时，当前实现不满足“总量为 41 条”。
  - 若 41 确认为规格笔误，则代码实现与测试是自洽的，但需要 evaluator 明确采纳该验收口径豁免/修正，避免后续 finalizer 或审计误判。

- **建议**
  - evaluator 判定 AC #5 中 41 是否为规格累计误差。
  - 若 41 仍为有效验收标准：补齐缺失规则并同步更新对应测试。
  - 若 40 为正确口径：在评估结论中明确接受 33+7=40 的规则总量，并将该项作为非代码修复的规格澄清项处理。

## 验证摘要

- `npm test` ✅ 通过（904 / 904）
- `npm run lint:src` ✅ 通过（ESLint + Prettier check 通过）
- `npm run build` ✅ 通过（tsup ESM + DTS 构建通过）
- 定向复核 ✅
  - `TOOL_DEFINITIONS` 包含 `opencode`，global detect 为 `['~/.config/opencode']`，project detect 为 `['.opencode']`。
  - OpenCode 7 条安装规则覆盖 global skills/agents/instructions/mcp-tools 与 project skills/agents/mcp-tools。
  - `MCP_MERGE_HINTS.opencode` 指向 `~/.config/opencode/opencode.json` 与 `"mcp"` 字段。
  - OpenCode MCP 安装测试验证 reporter warning 包含目标配置文件与 `"mcp"` 文本，并标记 `manualAction: 'mcp-merge-required'`。

## 通过项

- OpenCode XDG 全局检测路径未使用旧式 `~/.opencode`，且测试覆盖“旧路径不检测”。
- 全局 OpenCode skills / agents / instructions / mcp-tools 规则目标路径符合 Story 7-5 描述。
- 项目级 OpenCode skills / agents 安装目标符合 `.opencode/skills/` 与 `.opencode/agents/`。
- MCP 降级提示复用既有 `MCP_MERGE_HINTS` + `execute-install.ts` 汇总输出链路，未引入新的安装引擎逻辑。
- 未发现与本 Story 直接相关的安全、路径解析或运行时逻辑回归。
