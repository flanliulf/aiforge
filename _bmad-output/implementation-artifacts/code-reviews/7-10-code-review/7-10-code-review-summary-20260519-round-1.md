---
Story: 7-10
Round: 1
Date: 2026-05-19
Model Used: GPT-5.5
Type: Code Review Summary
---

## 审查结论

首轮审查。由于当前执行环境没有可用的通用 Agent 工具，本轮按 bmenhance-cr-01-reviewer 降级为串行三层审查：Blind Hunter、Edge Case Hunter、Acceptance Auditor 均由当前 reviewer 按对应 skill 规则执行。按本次只读约束，未重新执行 `npm test`、`npm run lint:src`、`npm run build`；Story 记录中声明三项质量门禁已通过（`npm test` 974 tests passed、`npm run lint:src`、`npm run build`，`dist/` = 172K）。

审查结论：不通过。当前存在 2 个需要 patch 的 AC #6 相关缺口，均集中在 `.iflow/` stale-tool 提示路径；文档矩阵、迁移指南、README/CHANGELOG 与 11 工具 / 55 内置规则基线整体一致，未发现新的 decision_needed 项。

## 新发现

### 1. [中] 手动指定工具模式会绕过 `.iflow/` stale-tool 提示

- **来源**：auditor+edge
- **分类**：patch

- **证据**
  - `src/stages/detect-tools.ts:168-194` 中手动 `args.tools` 分支在校验工具 ID 后直接 `reporter.completePhase()` 并 `return { tools, scope }`。
  - `.iflow/` 残留目录检测只出现在自动检测路径之后的 `src/stages/detect-tools.ts:213-215`，因此 `aiforge install --tools copilot` / `--tools <id>` 时不会触发 `detectTools.iflowStale`。
  - `tests/stages/detect-tools.test.ts:832-858` 只覆盖自动检测路径下 home / project `.iflow/` 的提示，没有覆盖手动指定工具模式。

- **影响**
  - AC #6 的触发条件是“检测到残留 `.iflow/` 目录的用户环境，执行 `aiforge install`”，未限定自动检测模式。当前实现会让手动指定工具的用户看不到 iFlow 已停服且不支持的无操作提示，属于验收覆盖缺口。

- **建议**
  - 将 `.iflow/` stale-tool 检测移动到手动/自动分支都会经过的位置，例如 `reporter.startPhase()` 后、手动分支返回前也执行同一提示逻辑。
  - 增加单元测试：`args.tools = ['copilot']` 且 home 或 project `.iflow/` 存在时，`reporter.info` 应包含 `.iflow/` 与 `2026-04-17`。

### 2. [中] `.iflow/` 信息性检查可能因权限/I/O 错误阻断安装流程

- **来源**：edge+auditor
- **分类**：patch

- **证据**
  - `src/stages/detect-tools.ts:34-44` 的 `pathExists()` 只把 `ENOENT` / `ENOTDIR` 降级为 `false`，其他错误会继续抛出。
  - `src/stages/detect-tools.ts:104-112` 的 `detectIflowResidue()` 使用同一个 `pathExists()` 检查 `~/.iflow` 与项目 `.iflow`。
  - `src/stages/detect-tools.ts:213-215` 在自动检测流程中直接 `await detectIflowResidue(pathResolver)`，没有对 stale-tool 提示做降级保护。
  - `tests/stages/detect-tools.test.ts:832-858` 只覆盖 `.iflow/` 存在的正常路径，没有覆盖 `.iflow/` 权限拒绝或 I/O 异常。

- **影响**
  - Story Task 5.3 明确要求 iFlow stale-tool 提示“不阻断安装流程，仅信息性提示”。如果残留 `.iflow/` 目录不可访问（例如权限拒绝、损坏挂载、企业环境目录策略），当前实现会让信息提示检查抛错并中断后续安装，和“仅信息性提示”语义冲突。

- **建议**
  - 为 `detectIflowResidue()` 使用专用的非阻断存在性检查：`ENOENT` / `ENOTDIR` 返回 `false`，其他异常也不要阻断安装，可选择静默跳过 stale notice 或输出低优先级诊断。
  - 增加单元测试：home 或 project `.iflow/` 检查抛出 `EACCES` 时，`detectTools()` 不应因 stale-tool 检查失败而抛错；如果存在其他有效工具，应继续返回检测结果。

## 验证摘要

- `npm test` 未在本轮重新执行（本轮按用户要求保持只读；Story 记录声明 ✅ 974 tests passed）。
- `npm run lint:src` 未在本轮重新执行（Story 记录声明 ✅ 退出码 0）。
- `npm run build` 未在本轮重新执行（Story 记录声明 ✅ 构建通过）。
- 只读复核：
  - `docs/install-rules-matrix.md` / `.zh.md` 顶部统计为 55 条内置工具规则 + 4 条通用项目规则，覆盖 11 工具。
  - `src/data/install-rules.ts` 当前 `BUILTIN_RULES` 注释与规则表为 55 条，和规则矩阵一致。
  - `CHANGELOG.md` 存在 v2.0.0 Breaking Changes、新增 8 工具、migration 链接、iFlow stale-tool notice。
  - `docs/migration-v2.md` / `.zh.md` 覆盖版本差异、`vscode` -> `copilot`、升级/回滚命令、Gemini/Windsurf/Trae/iFlow FAQ。
  - `tests/integration/epic-7-eleven-tools.test.ts` 覆盖 11 工具 global/project 场景和 `< 1000ms` 检测性能断言；Trae global 明确按 0 条全局安装规则验证无安装项，和规则矩阵一致。

## 通过项

- 文档侧覆盖完整：规则矩阵中 11 工具、detect 路径、资源类型、安装路径、特殊约束均有中英文条目。
- v2.0.0 CHANGELOG 包含 `vscode` 工具 ID 删除、Copilot 归并、8 个新增工具、MCP 降级策略、migration 文档链接。
- migration guide 中英文均包含版本差异表、升级命令、回滚命令、`vscode` -> `copilot` 操作步骤、Gemini 版本要求、Windsurf 语义提示、Trae skills 不支持、iFlow 停服说明与 FAQ。
- NFR-I5 审计文档确认 Story 7-10 的核心代码变更仅限 `.iflow/` 信息提示与 i18n 文案，未新增 `.iflow/` 安装规则或写入路径。
- dismiss：Trae global 场景不校验全局安装路径这一点已对照规则矩阵驳回为误报；矩阵明确 Trae Global Rules = 0，测试中的 `expectMatches: false` 与该约束一致。

## 结论

- **结论：不通过**
- **阻塞项**：2 个 patch 项，均与 AC #6 的 iFlow stale-tool 提示路径有关。
- **建议**：进入 evaluator 评估上述发现；若 evaluator 采纳，进入 fixer 修复手动模式提示覆盖与非阻断错误处理，并补充对应单元测试。
