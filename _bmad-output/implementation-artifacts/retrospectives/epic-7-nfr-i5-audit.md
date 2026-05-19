# Epic 7 NFR-I5 审计

日期：2026-05-19
Story：7-10
审计目标：验证 Epic 7 在 AI IDE 工具扩展期间，对引擎核心代码的改动是否保持在已批准、可解释、可审计的边界内。

## 审计范围

- 时间窗口：自 Epic 7 规划与 Story 文件首次提交开始，取 2026-04-23 作为 `git log --since` 基线。
- 命令：`git log --since='2026-04-23' --name-only -- src/stages/ src/commands/ src/services/ src/core/`
- 补充：纳入当前未提交的 Story 7-10 改动，用于覆盖本轮新增的 iFlow stale-tool 提示。

## Epic 7 起始日期依据

下列最早提交确认 Epic 7 于 2026-04-23 进入仓库：

- 2026-04-23 `1ffbd44`：新增 Epic 7 规划文档与 PRD v2.0 草案。
- 2026-04-23 `700a0fd`：创建 Epic 7 Story 7-1 ~ 7-10 并更新 sprint 状态。

因此，本审计使用 2026-04-23 作为 Epic 7 合理起始点。

## 审计结论

结论：**通过，且带注释说明**。

- Epic 7 的工具扩展没有改动 `src/commands/`。
- 没有触碰 `preflight`、`fs-utils`、`pipeline` 编排、`conflict-resolver` 这些 NFR-I5 明确关注的核心引擎面。
- 发生改动的核心代码集中在受控扩展点：工具检测提示、规则匹配扩展、版本前置条件、语义提示、MCP merge 提示输出、以及相应的消息/类型声明。
- 时间窗口内存在 1 次非 Epic 7 需求本身的阶段层重构：`authenticate.ts` 与 `clone.ts` 引入 `finish()` 辅助函数统一 `completePhase` 调用。该变更属于行为保持性整理，不属于工具矩阵扩展逻辑。
- Story 7-10 当前新增的引擎改动仅为：`detectTools.iflowStale` 信息提示与对应 i18n 文案；该变更为信息性提示，不新增 `.iflow/` 安装路径，不阻断安装流程。

## 改动清单与边界归因

- `src/stages/detect-tools.ts`：Story 7-1 / `7fd2c9a`，边界扩展类型为 `vscodeMergedNote` 检测与 warn；仅扩展信息提示，不改变工具检测主流程。
- `src/stages/detect-tools.ts`：Story 7-10 / working tree，边界扩展类型为 `iflowStale` 检测与 info；仅检查 `~/.iflow/` / `.iflow/` 是否存在，并输出无操作提示。
- `src/stages/match-rules.ts`：Story 7-3 / `ac315dc`，边界扩展类型为 `fileFilter` 过滤逻辑；用于更精细的 instructions/resource 分发。
- `src/stages/match-rules.ts`：Story 7-4 / `c7b416d`，边界扩展类型为 `TOOL_PRECONDITIONS`；用于 Gemini skills 安装前置版本校验。
- `src/stages/match-rules.ts`：Story 7-6 / `837180e`，边界扩展类型为 `semanticWarning`；用于 Windsurf `agents -> workflows` 的语义提示。
- `src/stages/match-rules.ts`：Story 7-9 / `cf80e09`，边界扩展类型为 `TOOL_UNSUPPORTED_NOTICES`；用于 Trae `skills/` 不支持提示。
- `src/stages/semantic-warnings.ts`：Story 7-6 / `837180e`，边界扩展类型为语义提示处理器；独立承接 Windsurf 语义确认逻辑。
- `src/stages/execute-install.ts`：Story 7-2 / `a0c8228`，边界扩展类型为 MCP merge hint output；仅输出 Codex/OpenCode 的手动合并提示，不直接改写工具自管配置。
- `src/services/version-check.ts`：Story 7-4 / `c7b416d`，边界扩展类型为版本前置条件支持；只服务 Gemini CLI 版本门禁。
- `src/core/messages.ts`：Story 7-1 / 7-2 / 7-4 / 7-5 / 7-6 / 7-9 / 7-10，边界扩展类型为 i18n 文案扩展；所有工具提示、迁移说明、iflow stale 提示均为消息层扩展。
- `src/core/types.ts`：Story 7-2 / 7-3 / 7-6，边界扩展类型为类型字段扩展；为 `fileFilter`、`semanticWarning`、手动动作等数据驱动能力提供类型承载。
- `src/core/reporter.ts`：Story 7-1 / 7-2 / 7-9，边界扩展类型为输出层补充；仅影响结果/提示展示，不改变安装判定。
- `src/stages/authenticate.ts`：`ac3c295`，属于非 Epic 7 的阶段层整理；引入 `finish()` 统一 `completePhase` 路径，未引入工具规则语义。
- `src/stages/clone.ts`：`ac3c295`，属于非 Epic 7 的阶段层整理；同上，属于行为保持性重构。

## 未发生改动的核心引擎面

以下面向在 Epic 7 审计窗口内未出现工具扩展型改动，符合 NFR-I5 的“核心逻辑不被工具接入牵动”目标：

- `src/commands/`：无改动。
- `src/services/fs-utils.ts`：无改动。
- `src/pipeline.ts`：无改动。
- `src/stages/conflict-resolver.ts`：无改动。
- `src/stages/preflight` 相关逻辑：无改动。

## Story 7-10 本轮核验

Story 7-10 在核心代码中的实际新增仅有两处：

- `src/stages/detect-tools.ts`：新增 `.iflow/` 残留目录检测与 `reporter.info` 输出，风险判定为低风险信息性提示。
- `src/core/messages.ts`：新增 `detectTools.iflowStale` 中英文文案，风险判定为低风险纯消息层。

与 `.iflow/` 相关的安装规则、目标路径、写文件逻辑均未新增；因此 AC #6 的“不安装任何文件到 `.iflow/` 相关路径”成立。

## 证据摘要

- `git log --since='2026-04-23' --name-only -- src/stages/ src/commands/ src/services/ src/core/` 显示：Epic 7 时间窗内的改动集中于 `detect-tools.ts`、`match-rules.ts`、`semantic-warnings.ts`、`execute-install.ts`、`version-check.ts` 与消息/类型/输出层。
- 当前 working tree 额外改动显示：Story 7-10 对核心代码只新增 `detect-tools.ts` 和 `messages.ts`。
- 本轮新增测试已覆盖：
  - `.iflow/` home / project 残留提示
  - 11 工具全局 + 项目级集成场景
  - `detectTools()` 11 工具检测性能 `< 1000ms`

## 审计结论说明

若严格按“Epic 7 时间窗内是否存在任何 stage 文件变动”理解，答案不是绝对零变更，因为存在：

1. 已批准的受控扩展点变更，用于支持新工具矩阵。
2. 一个与 Epic 7 需求无关的行为保持性 `finish()` 重构。

若按 NFR-I5 的真实意图“新工具接入是否迫使核心引擎无边界扩张”理解，则本次审计结论为：**未发生未授权的核心引擎扩张，边界受控，符合发布要求**。
