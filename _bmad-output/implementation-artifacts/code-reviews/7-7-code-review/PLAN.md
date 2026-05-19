# Story 7-7 串行执行计划

日期：2026-05-19
Story：7-7-kiro-aws-integration
目标：按用户要求使用全新 sub agent 串行完成开发、CR、评估、修复循环、规则/TODO/收尾处理，并最终本地提交代码（不推送）。

## 执行原则

- 每一步必须等待前一步完成后再开始，禁止并行执行 workflow 步骤。
- 涉及决策时优先采用推荐默认决策，并在进度文件记录原因，避免流程挂起。
- 每个 sub agent 在自己的步骤中读取并遵循对应 skill 指令。
- CR 循环终止条件：最新一轮 reviewer 结论通过，且最新一轮 evaluator 评估结果也通过。
- 进度记录文件始终使用中文维护。

## 计划步骤

1. 使用全新 sub agent 执行 `/bmad-dev-story story 7-7`，模型按用户要求标记为 GPT-5.4。
2. 使用全新 sub agent 执行 `/bmenhance-cr-01-reviewer 7-7`，模型按用户要求标记为 GPT-5.5。
3. 使用全新 sub agent 执行 `/bmenhance-cr-02-evaluator 7-7`，模型按用户要求标记为 GPT-5.5。
4. 使用全新 sub agent 执行 `/bmenhance-cr-03-fixer 7-7`，模型按用户要求标记为 GPT-5.4。
5. 重复步骤 2-4，直到 reviewer 和 evaluator 均通过。
6. 使用全新 sub agent 顺序执行：`bmenhance-cr-04-rules-extractor`、`bmenhance-cr-05-todo-tracker`、`bmenhance-cr-06-finalizer`；前两个默认采用推荐的落地决策。
7. 使用全新 sub agent 执行 `git-commit-convention`，默认中文提交信息，本地提交，不推送。

## 当前状态

- 已定位 Story 文件：`_bmad-output/implementation-artifacts/stories/7-7-kiro-aws-integration.md`
- 已创建/使用 CR 输出目录：`_bmad-output/implementation-artifacts/code-reviews/7-7-code-review/`
- 下一步：启动开发 sub agent。
