# Story 7-10 CR 工作流执行计划

日期：2026-05-19
Story：7-10（Epic 7 收尾：文档 + 规则矩阵 + 集成测试）
Story 文件：`_bmad-output/implementation-artifacts/stories/7-10-epic-7-finalization-docs-and-tests.md`
CR 输出目录：`_bmad-output/implementation-artifacts/code-reviews/7-10-code-review/`

## 总体原则

- 全流程严格串行执行；每一步必须等前一步完成后再开始。
- 每个主要操作使用全新的 sub agent。
- CR reviewer 内部允许按技能定义启动三个子审查层，但外层流程不并行。
- 如遇需要决策的事项，优先采用当前执行 agent 推荐的默认决策，并在本目录进度文件中记录。
- 每轮 CR 循环后检查 reviewer 结论与 evaluator 评估结论，二者均通过后才进入收尾步骤。
- 三份进度记录文件始终使用中文。

## 执行步骤

1. 使用全新 sub agent 执行 `/bmad-dev-story story 7-10`，模型：GPT-5.4。
2. 进入 CR 循环第 1 轮：
   - 使用全新 sub agent 执行 `/bmenhance-cr-01-reviewer 7-10`，模型：GPT-5.5。
   - 使用全新 sub agent 执行 `/bmenhance-cr-02-evaluator 7-10`，模型：GPT-5.5。
   - 使用全新 sub agent 执行 `/bmenhance-cr-03-fixer 7-10`，模型：GPT-5.4。
3. 若 reviewer 或 evaluator 未通过，则继续执行下一轮 2~4（reviewer → evaluator → fixer），直到 reviewer 结论通过且 evaluator 评估通过。
4. CR 通过后，依次执行收尾技能，每一步使用全新 sub agent：
   - `bmenhance-cr-04-rules-extractor`：按本次流程要求根据结果采用推荐默认决策执行。
   - `bmenhance-cr-05-todo-tracker`：按本次流程要求根据结果采用推荐默认决策执行。
   - `bmenhance-cr-06-finalizer`：在 CR Approved 后同步 Story 与流程状态。
5. 最后使用全新 sub agent 执行 `git-commit-convention`，模型：GPT-5.4；默认中文 commit message，不推送。

## 通过判定

- 最新一轮 CR reviewer 输出结论必须为通过/Approved/无阻塞问题。
- 最新一轮 CR evaluator 输出评估决定必须为通过/Approved/无需修复。
- 若 evaluator 判定存在需要修复项，则必须执行 fixer，并进入下一轮 reviewer。
- 若 fixer 无需修改，也必须把“无需修复”的判断记录到实验记录中。

## 进度状态

- [x] 确认 Story 文件与 CR 输出目录
- [x] 创建进度记录文件
- [x] Step 1：开发执行完成
- [x] Step 2~5：CR 循环完成并通过
- [x] Step 6：规则提炼、TODO 追踪、最终收尾完成
- [x] Step 7：本地 Git 提交完成
