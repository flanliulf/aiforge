# Story 1.2 Code Review Summary

- Story: `_bmad-output/implementation-artifacts/1-2-core-types-and-error-system.md`
- Review Date: `2026-03-19`
- Review Round: `1`
- Reviewer: `Amelia`
- Scope: read-only review, no code or file modifications applied during review

## Review Outcome

**Changes Requested**

- Git vs Story discrepancy: `1`
- Issues found: `2 High` / `3 Medium` / `1 Low`

## Acceptance Criteria Assessment

- `AC1` Implemented, but core contract drift exists in `AiforgeConfig`
- `AC2` Partial: `AiforgeError` exists, but `exitCode` is not type-limited to `0|1|2|3`
- `AC3` Partial: `sanitizeToken()` has a 12-character boundary leak
- `AC4` Partial: `sanitizeUrl()` does not correctly cover the GitLab standard token URL form used by downstream stories
- `AC5` Implemented in code, but under-tested

## High Severity Findings

1. `src/core/sanitize.ts:8-10`
   - `sanitizeToken()` leaks the full original token when the token length is exactly 12.
   - Current behavior: `abcdefghijkl -> abcdefgh****ijkl`
   - This defeats masking because the entire token remains recoverable.
   - Related test also locks in the wrong behavior: `tests/core/sanitize.test.ts:9-10`

2. `src/core/sanitize.ts:14-18`
   - `sanitizeUrl()` only handles `https://token@host/...`.
   - Downstream Story 2.3 defines the GitLab standard token URL as `https://oauth2:${token}@${hostname}/${repoPath}.git`.
   - Current sanitization mixes `oauth2:` and token content together and does not correctly sanitize the actual credential segment.
   - Reference: `_bmad-output/implementation-artifacts/2-3-four-layer-auth-chain.md:31-33,104-106`

## Medium Severity Findings

1. `src/core/types.ts:98-103`
   - `AiforgeConfig.cloneDir` and `AiforgeConfig.preferSSH` are implemented as required fields.
   - Architecture and Story 2.1 define them as optional.
   - References:
     - `_bmad-output/planning-artifacts/architecture/03-core-decisions.md:65-73`
     - `_bmad-output/implementation-artifacts/2-1-config-management-service.md:40-48`

2. `src/core/types.ts:103`
   - `AiforgeConfig.auth` uses `AuthMethod`, which currently permits `'credential-manager'`.
   - Planning artifacts define persisted config auth methods as only `'ssh' | 'token'`.
   - This weakens the config contract and may cause future refactor churn.

3. `src/core/errors.ts:12`
   - `AiforgeError.exitCode` is typed as `number`, not a constrained union for `0|1|2|3`.
   - The story requirement is implemented at runtime convention level, not enforced at type level.

4. Story File List mismatch
   - Git shows an extra modified file: `_bmad-output/implementation-artifacts/sprint-status.yaml`
   - It is not listed in the story File List.
   - This is a documentation transparency gap.

## Low Severity Finding

1. Task 4 coverage claim is optimistic
   - Story Task 4 claims test coverage for `AC #1-5`.
   - Existing tests cover types, errors, and sanitization, but there is no automated check for the module-boundary rules in `AC5`.

## Validation Evidence

- Targeted tests passed:
  - `npm test -- tests/core/types.test.ts tests/core/errors.test.ts tests/core/sanitize.test.ts`
  - Result: `3 files / 41 tests passed`
- Full test suite passed:
  - `npm test`
  - Result: `4 files / 66 tests passed`

## Final Recommendation

This story should **not** be considered review-passed yet.

Blocking items:
1. Fix the 12-character masking leak in `sanitizeToken()`
2. Fix `sanitizeUrl()` so it correctly sanitizes GitLab standard token URLs
3. Reconcile `AiforgeConfig` with the architecture and Story 2.1 contract before downstream implementation continues

## Review Constraints Followed

- No code changes made
- No existing files modified by this review summary request
- Summary saved for reference only

