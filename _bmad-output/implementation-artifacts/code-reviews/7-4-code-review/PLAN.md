# Story 7-4 CR 编排计划

日期：2026-05-18
Story：7-4-gemini-cli-integration
Story 文件：`_bmad-output/implementation-artifacts/stories/7-4-gemini-cli-integration.md`

## 目标

按用户要求，以全新的 sub agent 严格串行完成 Story 7-4 的开发、代码审查、评估、修复、复审循环、规则/TODO/收尾处理和本地 Git 提交。

## 执行顺序

1. 使用全新 sub agent 执行 `/bmad-dev-story story 7-4`，模型 GPT-5.4。
2. 使用全新 sub agent 执行 `/bmenhance-cr-01-reviewer 7-4`，模型 GPT-5.5。
3. 使用全新 sub agent 执行 `/bmenhance-cr-02-evaluator 7-4`，模型 GPT-5.5。
4. 使用全新 sub agent 执行 `/bmenhance-cr-03-fixer 7-4`，模型 GPT-5.4。
5. 重复步骤 2-4，直到 reviewer 结论通过，且 evaluator 评估结果也通过。
6. 通过后，使用全新 sub agent 依次执行：
   - `bmenhance-cr-04-rules-extractor`
   - `bmenhance-cr-05-todo-tracker`
   - `bmenhance-cr-06-finalizer`
7. 最后使用全新 sub agent 执行 `git-commit-convention`，默认中文提交信息，仅本地提交，不推送，模型 GPT-5.4。

## 串行约束

- 每一个 sub agent 完成后，才允许启动下一个 sub agent。
- CR reviewer skill 内部可以按其技能定义启动三个审查层；这是该 skill 的内部机制，不视为外层流程并行。
- 每轮 reviewer/evaluator/fixer 后，主编排读取最新输出，判断是否进入下一轮或进入最终收尾。

## 默认决策原则

- 遇到需要决策但不影响安全边界的事项，优先采用 Story 文档、项目上下文和现有模式中风险最低、改动最小、最符合验收标准的方案。
- Story 7-4 的版本前置校验采用 Story 推荐的优先方案：`TOOL_PRECONDITIONS` 数据驱动结构 + `src/services/version-check.ts`，除非开发/审查阶段证明该方案不可行。
- 不等待用户确认可避免流程挂起，但所有决策都必须记录在 `EXPERIMENTS.md` 或 `EXPERIMENT_NOTES.md`。
- 最终提交只包含 Story 7-4 相关变更，排除已存在且无关的工作区变更。

## 进度记录规则

- `PLAN.md` 记录整体流程和约束。
- `EXPERIMENTS.md` 记录每次尝试的方案、选择理由、结果和下一步。
- `EXPERIMENT_NOTES.md` 记录实时思考、发现、风险和临时决策。
