# Story 7-5 串行开发与 CR 流程计划

## 目标

按用户要求，对 Story 7-5 依次使用全新的 sub agent 完成开发、代码审查、审查评估、评估修复、循环复审、规则提炼/TODO 跟踪/收尾，以及最终按提交规范提交代码。所有步骤严格串行执行，不并行。

## Story 信息

- Story ID：7-5
- Story 文件：`_bmad-output/implementation-artifacts/stories/7-5-opencode-xdg-integration.md`
- Code Review 输出目录：`_bmad-output/implementation-artifacts/code-reviews/7-5-code-review/`
- 关键验收：OpenCode 使用 XDG 全局路径 `~/.config/opencode`，新增 7 条安装规则，`BUILTIN_RULES` 总量为 41，复用 MCP 手动合并提示机制。

## 串行执行计划

1. 启动开发 sub agent，使用模型 GPT-5.4，按 `/bmad-dev-story story 7-5` 执行 Story 开发。
2. 启动 CR reviewer sub agent，使用模型 GPT-5.5，按 `/bmenhance-cr-01-reviewer 7-5` 执行代码审查。
3. 启动 CR evaluator sub agent，使用模型 GPT-5.5，按 `/bmenhance-cr-02-evaluator 7-5` 执行审查结果评估。
4. 启动 CR fixer sub agent，使用模型 GPT-5.4，按 `/bmenhance-cr-03-fixer 7-5` 根据评估结论修复。
5. 重复第 2 至第 4 步，直到 reviewer 结论通过且 evaluator 评估也通过。
6. 启动收尾 sub agent，依次执行：
   - `bmenhance-cr-04-rules-extractor`
   - `bmenhance-cr-05-todo-tracker`
   - `bmenhance-cr-06-finalizer`
   并采用默认推荐决策继续执行。
7. 启动提交 sub agent，使用模型 GPT-5.4，按 `git-commit-convention` 默认中文、不推送提交代码。

## 决策原则

- 遇到需决策事项时，优先采用推荐/默认方案，不等待用户确认。
- 若 CR 或评估指出必须修复的问题，按评估结论优先修复功能正确性、验收缺口、测试失败和文档同步问题。
- 每轮结果写入 `EXPERIMENTS.md`，实时判断与临时思考写入 `EXPERIMENT_NOTES.md`。

