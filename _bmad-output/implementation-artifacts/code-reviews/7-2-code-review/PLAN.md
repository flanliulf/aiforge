# Story 7-2 CR Orchestration Plan

Date: 2026-05-18
Story: 7-2-codex-cli-integration
Story File: `_bmad-output/implementation-artifacts/stories/7-2-codex-cli-integration.md`

## Goal

Execute Story 7-2 end to end using fresh sub agents in strict sequence:

1. `/bmad-dev-story story 7-2` with model GPT-5.4.
2. `/bmenhance-cr-01-reviewer 7-2` with model GPT-5.5.
3. `/bmenhance-cr-02-evaluator 7-2` with model GPT-5.5.
4. `/bmenhance-cr-03-fixer 7-2` with model GPT-5.4.
5. Repeat steps 2-4 until both reviewer and evaluator conclude approval/pass.
6. Run finalization sub agent with model GPT-5.4, sequentially using:
   - `bmenhance-cr-04-rules-extractor`
   - `bmenhance-cr-05-todo-tracker`
   - `bmenhance-cr-06-finalizer`
   - `git-commit-convention` in Chinese, local commit only, no push.

## Serial Execution Rule

No two skill invocations may run in parallel. Each sub agent must finish before the next sub agent starts. The CR reviewer skill may internally launch its own three review layers, as designed by that skill.

## Known Decision

Story 7-2 contains an internal mismatch: AC #5 says新增规则 +5 and `BUILTIN_RULES` total 25, while Task 2.1 lists 8 possible codex rules. Task 2.2 explicitly says to prefer AC if inconsistent. Decision: implement the +5 AC-aligned path unless the dev sub agent finds stronger project evidence requiring escalation.

## Planned Progress Updates

- Record each sub agent attempt in `EXPERIMENTS.md` with inputs, rationale, result, and next action.
- Record live notes and decisions in `EXPERIMENT_NOTES.md`.
- After every CR/evaluation/fix round, inspect generated files enough to decide whether to continue the loop or finalize.
