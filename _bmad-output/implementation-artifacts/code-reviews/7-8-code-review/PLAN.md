# Story 7-8 CR 串行执行计划

## 目标

对 Story 7-8（Antigravity / Google 接入）完成开发、代码审查、评估、修复循环、规则提炼、TODO 跟踪、最终收尾，并按 git-commit-convention 进行本地提交（中文提交信息，不推送）。

## 串行约束

- 所有 sub agent 调用严格串行，前一步完成后才启动下一步。
- CR review / evaluation / fixer 按轮次循环，直到 reviewer 结论通过且 evaluator 评估结果通过。
- 每轮关键决策、尝试结果、阻塞与验证命令同步记录到本目录下的进度文件。

## 执行步骤

1. 使用全新 sub agent 执行 `/bmad-dev-story story 7-8`，模型指定为 GPT-5.4。
2. 使用全新 sub agent 执行 `/bmenhance-cr-01-reviewer 7-8`，模型指定为 GPT-5.5。
3. 使用全新 sub agent 执行 `/bmenhance-cr-02-evaluator 7-8`，模型指定为 GPT-5.5。
4. 若评估确认需要修复，使用全新 sub agent 执行 `/bmenhance-cr-03-fixer 7-8`，模型指定为 GPT-5.4。
5. 重复步骤 2-4，直到 CR summary 与 CR evaluation 均为通过。
6. 通过后依次执行：`bmenhance-cr-04-rules-extractor`、`bmenhance-cr-05-todo-tracker`、`bmenhance-cr-06-finalizer`。涉及默认决策时优先采用推荐动作，并记录原因。
7. 最后使用 `git-commit-convention` 进行本地提交，默认中文，不推送，模型指定为 GPT-5.4。

## 默认决策

- Story 7-8 中 Task 2 存在方案 A/B/C 讨论，但 AC #5 明确要求新增规则 +3、`BUILTIN_RULES` 总量 53。默认让开发代理优先满足当前 Story AC；若实现或 CR 发现项目级 antigravity 与 universal `.agents/skills/` 存在重复 manifest 风险，则在评估/修复阶段按最小变更收敛并记录理由。
- `bmenhance-cr-04-rules-extractor` 默认是 analysis-only，但本流程要求根据结果继续执行；除非提炼结果明确建议写入并无需额外人工确认，否则默认不改全局规则文档，只将可延迟项交给 TODO tracker。
- `bmenhance-cr-05-todo-tracker` 若发现明确非阻塞项，默认执行 extract/add 到 backlog；若无候选项，记录无新增 TODO。
- `bmenhance-cr-06-finalizer` 仅在最新评估明确 Approved/通过后执行状态收尾。

## 进度检查点

- [x] 创建 Story 7-8 CR 工作目录与进度文件
- [x] Dev story 完成，Story 进入 review
- [x] CR Round 1 summary 生成
- [x] CR Round 1 evaluation 生成
- [x] 必要修复完成并记录
- [x] 最终 CR 与 evaluation 均通过
- [x] 规则提炼 / TODO 跟踪 / finalizer 完成
- [x] 本地 git commit 完成

> 注：最终 git commit 步骤将在本记录更新后立即执行；本条记录随最终提交一并纳入版本历史。