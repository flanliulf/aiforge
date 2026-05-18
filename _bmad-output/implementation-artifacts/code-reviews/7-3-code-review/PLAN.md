# Story 7-3 CR Orchestration Plan

Date: 2026-05-18
Story: 7-3-auggie-augment-code-integration
Story File: `_bmad-output/implementation-artifacts/stories/7-3-auggie-augment-code-integration.md`

## Goal

Execute Story 7-3 end to end using fresh sub agents in strict sequence:

1. `/bmad-dev-story story 7-3` with model GPT-5.4.
2. `/bmenhance-cr-01-reviewer 7-3` with model GPT-5.5.
3. `/bmenhance-cr-02-evaluator 7-3` with model GPT-5.5.
4. `/bmenhance-cr-03-fixer 7-3` with model GPT-5.4.
5. Repeat steps 2-4 until both reviewer and evaluator conclude approval/pass.
6. Run a fresh finalization sub agent with model GPT-5.4, sequentially using:
   - `bmenhance-cr-04-rules-extractor`
   - `bmenhance-cr-05-todo-tracker`
   - `bmenhance-cr-06-finalizer`
7. Run a fresh commit sub agent with model GPT-5.4 using `git-commit-convention`, default Chinese message, local commit only, no push.

## Serial Execution Rule

No two skill invocations may run in parallel. Each sub agent must finish before the next sub agent starts. The CR reviewer skill may internally launch its own three review layers, as designed by that skill.

## Known Decision

Story 7-3 explicitly asks for a pre-dev decision around instructions file filtering. Decision: adopt方案 A, extending `InstallRule.fileFilter?: string[]` and filtering `Files` scans by whitelist for instructions rules. This is the story's default, the smallest reusable implementation for FR-058, and avoids blocking on user confirmation. Record any follow-up CR concerns here rather than pausing the flow.

## Planned Progress Updates

- Record each sub agent attempt in `EXPERIMENTS.md` with inputs, rationale, result, and next action.
- Record live notes and decisions in `EXPERIMENT_NOTES.md`.
- After every CR/evaluation/fix round, inspect generated files enough to decide whether to continue the loop or finalize.
- Exclude unrelated pre-existing worktree changes from the final commit unless they are directly part of Story 7-3.
