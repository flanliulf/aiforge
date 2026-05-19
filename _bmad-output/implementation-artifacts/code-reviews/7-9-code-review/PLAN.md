# Story 7-9 串行执行计划

日期：2026-05-19

## 目标

按用户要求，对 Story 7-9 依次使用全新的 sub agent 完成开发、代码审查、审查评估、修复、复审循环、规则提炼、TODO 跟踪、收尾和本地 Git 提交。所有步骤严格串行，禁止并行。

## Story 信息

- Story ID：7-9
- Story 文件：`_bmad-output/implementation-artifacts/stories/7-9-trae-bytedance-partial-integration.md`
- CR 输出目录：`_bmad-output/implementation-artifacts/code-reviews/7-9-code-review/`
- 初始状态：ready-for-dev

## 执行顺序

1. 使用全新 sub agent 执行 `/bmad-dev-story story 7-9`，模型指定为 GPT-5.4。
2. 使用全新 sub agent 执行 `/bmenhance-cr-01-reviewer 7-9`，模型指定为 GPT-5.5。
3. 使用全新 sub agent 执行 `/bmenhance-cr-02-evaluator 7-9`，模型指定为 GPT-5.5。
4. 使用全新 sub agent 执行 `/bmenhance-cr-03-fixer 7-9`，模型指定为 GPT-5.4。
5. 根据最新 CR 与评估结论判断是否通过：
   - 若 reviewer 结论未通过，或 evaluator 评估未通过，则继续重复第 2-4 步。
   - 若 reviewer 与 evaluator 均通过，则退出循环。
6. 使用第五个全新 sub agent 依次执行：
   - `bmenhance-cr-04-rules-extractor`
   - `bmenhance-cr-05-todo-tracker`
   - `bmenhance-cr-06-finalizer`
   并采用推荐默认决策执行，避免等待用户决策导致流程挂起。
7. 使用全新 sub agent 执行 `git-commit-convention`，模型指定为 GPT-5.4，默认中文提交信息，仅提交本地，不推送。

## 决策原则

- 每一步必须等待前一步完成后再开始。
- 若 skill 内部出现可选决策，默认采用最保守且符合 Story/CR 流程的推荐决策，并在 `EXPERIMENT_NOTES.md` 记录。
- 若发现阻塞性歧义，优先让对应 sub agent按技能规则处理；主流程只在无法继续时中止并说明原因。
- 不主动扩大修改范围；开发和修复均以 Story 7-9 及 CR 评估结论为边界。

## 通过判定

- 最新一轮 `bmenhance-cr-01-reviewer` 输出结论为通过或 Approved。
- 最新一轮 `bmenhance-cr-02-evaluator` 输出评估决定为通过或 Approved。
- Story 收尾后状态同步为 Done。
- Git 本地提交完成且未推送。