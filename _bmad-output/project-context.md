---
project_name: 'ai-forge'
user_name: 'Fancyliu'
date: '2026-05-24'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
status: 'complete'
rule_count: 128
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in ai-forge. Focus on unobvious details that agents might otherwise miss._

---

## Rule Document Registry

**凡是确认/修改/新增任何规则、约定或豁免，必须同步更新以下所有文档：**

| 文档 | 职责 |
|------|------|
| `_bmad-output/project-context.md` | AI agent 主规则文件（本文件），优化为 LLM 消费 |
| `_bmad-output/planning-artifacts/architecture/04-implementation-patterns.md` | 命名/导出/测试/错误处理等实现模式，面向人类可读 |
| `_bmad-output/planning-artifacts/architecture/03-core-decisions.md` | 技术决策事项记录，面向人类可读 |

> 三份规则文档必须保持语义一致。同步时不仅更新文字段落，也要检查代码块、接口示例、输出格式示例、表格数字和枚举值。

---

## Technology Stack & Versions

- **Package:** `@fancyliu/aiforge@2.0.4`
- **Runtime:** Node.js `>=18.0.0`, ESM only (`"type": "module"`)
- **Language:** TypeScript `^5.9.3`, `strict: true`, `module/moduleResolution: NodeNext`
- **Build:** `tsup ^8.5.1`, ESM output to `dist/`, declarations enabled
- **Dev runner:** `tsx ^4.21.0`
- **Test:** `vitest ^4.1.0`, Node environment, `tests/**/*.test.ts`
- **Lint/Format:** ESLint `^10.0.3`, `typescript-eslint ^8.57.1`, Prettier `^3.8.1`
- **CLI:** `commander ^14.0.3`
- **Git ops:** `simple-git ~3.32`
- **Terminal UI:** `ora ^8.2.0`, `chalk ^5.6.2`
- **Interactive prompts:** `@inquirer/prompts ^8.3.2`
- **Distribution:** npm public registry via `npx`, package `files` include `dist`, `README.md`, `README.zh.md`, `docs/*.md`, `CHANGELOG.md`

## Current Codebase Shape

- `src/` currently has 33 TypeScript files across `core/`, `data/`, `services/`, `stages/`, `commands/`, plus `index.ts` and `pipeline.ts`.
- `tests/` currently has 42 Vitest files, mirroring `src/` plus integration coverage.
- Supported tool registry currently contains 11 tools: `copilot`, `claude`, `cursor`, `codex`, `opencode`, `windsurf`, `auggie`, `gemini`, `antigravity`, `kiro`, `trae`.
- Install rules currently contain 55 `BUILTIN_RULES` plus 4 project-only `UNIVERSAL_RULES`.

## Critical Implementation Rules

### TypeScript & ESM Rules

- **ESM imports must include `.js` extension:** use `import { foo } from './bar.js'`, not `import { foo } from './bar'`.
- **Business code uses named exports only:** no default exports in `src/`; tool config files such as `tsup.config.ts` and `vitest.config.ts` may use `export default defineConfig(...)`.
- **Naming conventions:** interfaces/types use PascalCase without `I` prefix; functions/variables use camelCase; constants use UPPER_SNAKE_CASE; files use kebab-case.
- **String union vs enum:** use small string literal unions for JSON/YAML/manifest-facing values; use enum only for engine-level namespacing such as `InstallType`.
- **`data/` must avoid runtime dependencies on `core/`:** use `import type` and string assertions such as `'Files' as InstallType` so data constants stay runtime-pure.
- **Do not broaden shared field semantics:** `MatchedPlan.mode` means install mechanism only (`'copy' | 'symlink'`); manifest `mode: 'flatten'` is derived later from `rule.type`, not by expanding `MatchedPlan.mode`.

### Architecture Rules

- **Pipeline order:** `Resolve -> Auth -> Clone -> [List] | Detect -> Match -> [Install -> SaveManifest] -> Report`; dry-run skips Install/SaveManifest and reports the plan.
- **List mode branches after Clone:** `args.list !== undefined` enters `listContents()` and must not fall through to detect/match/install, even when the value is an empty string.
- **Each stage owns explicit input/output types:** `ParsedArgs`, `ResolvedSource`, `AuthenticatedSource`, `LocalRepo`, `DetectedEnv`, `MatchedPlan`, `InstallResult`.
- **Reporter lifecycle must pair:** every successful pipeline stage that calls `reporter.startPhase()` must call `reporter.completePhase()` on success; exception paths are handled by `runPipeline()`.
- **Pipeline cancellation is a normal flow:** `FilterCancelledSignal` exits with code `0` and should not be wrapped as `AiforgeError`.
- **Module boundaries:** `core/` has zero dependencies on other `src` dirs; `data/` is pure constants; `services/` depends only on `core/`; `stages/` may depend on `core/`, `data/`, `services/`; `commands/` may depend on `core/`, `services/`.
- **No circular dependencies:** preserve the direction `index.ts -> pipeline.ts -> stages/* -> services/*`, with shared contracts in `core/*` and data constants in `data/*`.
- **Preflight remains inside Install:** target writability and path security checks are part of `execute-install.ts`, not a separate pipeline stage.
- **Cross-stage boundary values must be explicit:** if `matchRules()` can emit `sourceFiles = []`, downstream stages must handle it intentionally and explain the semantics in code comments.

### Source, Tool, And Rule Mapping

- **Tool detection is data-driven:** add or remove tools through `src/data/tool-registry.ts`; engine stages must not hardcode tool IDs.
- **Rule mapping is data-driven:** install behavior lives in `src/data/install-rules.ts`; lookup uses `RULE_INDEX` with key `${tool}:${scope}`.
- **Current `BUILTIN_RULES` counts by tool:** copilot 9, claude 7, cursor 4, codex 5, opencode 7, auggie 5, gemini 4, antigravity 3, windsurf 5, kiro 4, trae 2.
- **Universal rules are separate from tool detection:** `UNIVERSAL_RULES` use virtual tool id `universal`, are not in `TOOL_DEFINITIONS`, and only append in project scope when enabled.
- **Universal dirs default on:** final enablement is `!args.noUniversal && config.universalDirs !== false`; `CONFIG_NOT_FOUND` alone may degrade to default enabled.
- **`--dirs` and `--filter` must also apply to universal rules:** recovery/retry paths must repeat the same universal append logic, not only the normal `RULE_INDEX` loop.
- **Do not hardcode source directories:** use rule data for `agents`, `skills`, `instructions`, `mcp-tools`, `rules`; code must not assume every knowledge repo has every directory.
- **Rule total acceptance must use approved baseline plus current story delta:** do not add behavior solely to satisfy stale count numbers in old specs.
- **VS Code is not a registered tool:** VS Code project MCP is handled by Copilot project `mcp-tools -> .vscode/`; `vscode` in `--tools` must remain `UNKNOWN_TOOL`.

### Tool-Specific Contracts

- **Claude reserved-name protection:** for `claude:*:instructions`, block case-insensitive writes to `claude.md`, `claude.local.md`, `agents.md`, `agents.local.md`, `settings.json`, `settings.local.json`, `.claudeignore`; `--force` does not override this.
- **Claude project instructions are intentionally dual-target:** project `CLAUDE.md` is installed both to `.claude/` and repository root when the matching rules apply.
- **Cursor skills use Flatten:** each skill directory is converted to a single rule file from `mainFile` (`index.md` by default) with target name based on the directory name.
- **Codex MCP is manual-merge only:** copy MCP templates to `~/.codex/` and emit `[mcp]` merge hints; never mutate `~/.codex/config.toml`.
- **OpenCode global path follows XDG:** use `~/.config/opencode`, not `~/.opencode`; global MCP templates require manual merge into `opencode.json` under `"mcp"`.
- **Gemini skills require precondition:** `skills/` rules require Gemini CLI `v0.26.0+`; failed precondition removes affected skill items and warns instead of failing the install.
- **Windsurf project `agents/` maps to `workflows/`:** this carries semantic risk and must run through `semanticWarning: 'windsurfAgentsToWorkflows'`.
- **Semantic warnings are conservative:** TTY asks for confirmation with default `false`; non-TTY skips the item and warns; Ctrl+C must become `FilterCancelledSignal`.
- **Trae skills are unsupported:** Trae has project `rules` and root `AGENTS.md` rules only; if the knowledge repo contains `skills/`, emit the unsupported notice without changing install semantics.
- **Antigravity global namespace is nested:** global installs target `~/.gemini/antigravity/...`; project skills reuse `.agents/skills/`.
- **iFlow stale notice is informational:** existence of home/project `.iflow` triggers a nonblocking notice in both manual and auto tool detection paths; optional notice checks may swallow I/O errors only for this purpose.
- **Legacy VS Code migration notice is home-only:** warn when `~/.vscode/` exists and `~/.copilot/` does not; do not read or write `~/.vscode/`.

### Error Handling Rules

- **Expected errors use `AiforgeError`:** include `code`, `exitCode`, `severity`, `why`, `fix[]`; avoid raw `Error` for user-facing failure paths.
- **Exit codes are typed:** `ExitCode = 0 | 1 | 2 | 3`; use `EXIT_SUCCESS`, `EXIT_INSTALL_FAILURE`, `EXIT_AUTH_FAILURE`, `EXIT_ARG_ERROR`.
- **Install is fail-fast:** `InstallResult.status` has only `'new' | 'updated' | 'skipped'`; there is no `'failed'` status.
- **Errors follow three-part messaging:** what broke, why it broke, copyable fix commands.
- **Never swallow errors silently:** `catch {}` and `catch { return false }` are forbidden outside explicitly documented nonblocking notice helpers.
- **Degrade only by exact code:** if a catch block downgrades an error, match exact `AiforgeError.code` and comment the reason; do not use broad grouping helpers such as `isConfigError()`.
- **File existence helpers use ENOENT/ENOTDIR whitelist:** only `ENOENT` and `ENOTDIR` become `false`; `EACCES`, `EIO`, and other errors must propagate in decision paths.
- **Optional notice helpers must stay isolated:** nonblocking helpers that swallow errors may only feed unsupported/stale/migration notices, never tool detection, security checks, install decisions, or data integrity paths.
- **New error codes need production-path tests:** trigger the real module entrypoint that creates the error; reporter-only tests with hand-constructed errors do not prove AC satisfaction.
- **New branches must match sibling behavior:** when adding a catch branch, compare all fields and cleanup/context behavior with existing sibling branches in the same function.
- **No empty fallback for required data:** for required map/lookup values such as hashes, IDs, paths, or plan info, explicitly throw on `undefined`; never use `?? ''`, `?? 0`, `?? false`, or `?? []`.

### Input And CLI Rules

- **Validate after normalization:** URL/path syntax checks are not enough; validate semantic emptiness and path parts after transformations such as `.git` suffix stripping.
- **Branch option detection must use `!== undefined`:** options like `--list ""` are intentionally present and should enter the feature branch for validation, not fall through to install.
- **Directory-like CLI args need three guards:** reject empty/blank strings, `/` or `\` path separators, and dot-prefixed names such as `.`, `..`, `.hidden`.
- **`--link` is global-only:** `args.link && env.scope === 'project'` must throw `LINK_PROJECT_REJECTED` before install.
- **Manual `--tools` must validate against `TOOL_DEFINITIONS`:** unknown IDs throw `UNKNOWN_TOOL` and list current supported IDs.
- **`aiforge init` is a command outside the pipeline:** it may use `console.log` and direct `@inquirer/prompts`, but must still use centralized messages and sanitization.

### Output And i18n Rules

- **Pipeline output goes through `Reporter`:** do not use `console.log` in pipeline stages; allowed exceptions are `aiforge init` and language fallback before reporter creation.
- **stdout/stderr split is contractual:** result and plan data go to stdout; progress, warnings, info, and errors go to stderr.
- **Reporter implementations:** TTY uses spinner/color, Plain uses stable CI-friendly text, Quiet emits only summaries and errors.
- **TTY detection must match the output fd:** spinner writes to stderr, so spinner capability must use `process.stderr.isTTY`, not stdout.
- **PlainReporter tab contract is all-or-nothing:** every line in a tabular method, including stats/summary lines, must use the same delimiter contract.
- **TTY result grouping:** group by tool and local install root; show at most 5 details per target group, then fold the rest into a compact status summary.
- **Skipped result details are successful:** TTY detail rows for `skipped` are green like `new`; only aggregate skipped counts use yellow for contrast.
- **Zero-result diagnostics have two branches:** true zero (`resultItems.length === 0`) warns with diagnostics and never suggests `--force`; skipped-only results complete as success with a skipped-only summary.
- **All user-visible strings use `core/messages.ts`:** include `AiforgeError.fix[]`, reporter labels, warning text, diagnostics, quantities, and precondition notices.
- **CLI help stays English literals:** Commander descriptions/options are evaluated at module load time and should not use `msg()`.
- **Subcommands initialize language themselves:** independent command handlers such as `init` must call `setLanguage()` before their first user-visible output.
- **Manual action annotations are not status values:** MCP merge-required appears via `manualAction: 'mcp-merge-required'`, while status remains `new`/`updated`/`skipped`.

### Security Rules

- **npm package must contain zero company info:** no company/internal URLs, hostnames, real credentials, or platform-specific token prefixes such as `glpat-`/`ghp_`; generic placeholders like `your-git-host.com` are allowed.
- **Package security verification scans content, not pack summary:** use `npm pack --json` to get files, then grep actual packed file contents; `README.md` is always included by npm and must be scanned.
- **README language switch must be dual-environment safe:** source `README.md` uses `[中文](README.zh.md)` for GitHub rendering; npm packaging relies on `prepack/postpack` via `scripts/prepare-npm-readme.mjs` to temporarily rewrite that link to jsDelivr and restore it. Do not commit the jsDelivr link into source `README.md`.
- **Token handling is memory-only during clone:** tokens must be sanitized before logs/errors and removed from persisted git remote URLs after clone/update.
- **Use the right sanitizer:** `sanitizeToken()` for standalone tokens, `sanitizeUrl()` for pure URLs, `sanitizeMessage()` for arbitrary error messages containing token-bearing URLs.
- **`oauth2:token@host` needs special treatment:** keep the `oauth2:` prefix and sanitize only the credential portion.
- **config permissions:** `~/.aiforge/config.json` must be written with `0o600`.
- **Path traversal checks need string and realpath layers:** `resolve()` catches textual `..`; `realpath()` on both allowed root and existing ancestors catches symlink escape.
- **Security checks must run on final I/O paths:** preflight on a target directory is insufficient; validate each final `destPath` before copy/symlink/write.
- **Recursive directory copy must validate every expanded write path:** outer directory safety does not prove nested entries are safe.
- **Symlink API choices must match later operations:** if the following operation follows symlinks, use `stat()` or `realpath()` accordingly; `lstat()` alone only tells you about the link itself.
- **Broken symlinks are explicit cases:** allow only when the stored target resolves inside the allowed root or when the specific symlink replacement flow makes that safe.

### Data Format And Persistence Rules

- **JSON fields use camelCase:** examples include `defaultRepo`, `cloneDir`, `preferSSH`, `universalDirs`.
- **Dates use ISO 8601 strings:** use `new Date().toISOString()` for persisted timestamps.
- **Auth config is keyed by hostname:** `auth: { "host": { method: "ssh" | "token", token?: string } }`.
- **Runtime auth method and persisted auth method differ:** runtime may include `'credential-manager'`; persisted `HostAuth.method` is only `'ssh' | 'token'`.
- **Config writes are atomic:** write temp file, rename, then chmod `0o600`.
- **Manifest reads degrade:** missing, corrupt, non-array, or unreadable `manifest.json` returns empty entries with `degraded: true`.
- **Manifest writes are atomic:** ensure config dir, write `.tmp`, then rename.
- **Manifest source paths are repo-relative:** target paths are absolute; flatten mode is recorded as `'flatten'` even if the physical operation is copy or symlink.
- **Skipped install items do not update manifest:** only `new` and `updated` are persisted.
- **Persistent path fields require JSDoc semantics in `core/types.ts`:** path fields must state absolute vs relative and the root they are relative to.

### Testing Rules

- **Test files mirror source structure:** `src/stages/clone.ts` -> `tests/stages/clone.test.ts`; keep new module tests in the matching directory.
- **External dependencies are mocked:** mock simple-git, filesystem, child_process, and prompts where needed; prefer real internal modules unless isolation requires mocks.
- **PathResolver should be injected:** tests should use fixed mock paths instead of depending on the developer machine.
- **Integration tests must include at least one real production factory/closure path:** all-mock orchestration tests belong in explicit orchestration-only cases.
- **Security tests must trigger the tested entrypoint:** do not directly call a mocked sanitizer or helper and claim the production path is protected.
- **Assertions should target story contracts, not incidental current output:** if implementation disagrees with the contract, fix implementation before freezing the behavior in tests.
- **When a fix changes behavior, update all old-behavior assertions:** search the test suite for old assumptions and adjust them deliberately.
- **i18n tests verify actual emitted strings:** persistence of `language` config alone does not prove output switched language.
- **Known defects cannot be bypassed with selective test paths:** fix them, mark explicit `it.skip(...)` with issue context, or record the story as blocked.
- **Regression assertions need exact keywords:** avoid broad regex like `/Copilot/i` when the AC requires a phrase such as `GitHub Copilot 扩展`.

### Development Workflow Rules

- **Use `rg`/`rg --files` for impact scans:** especially for cross-cutting changes, shared types, literals, messages, rule IDs, output strings, and path names.
- **Cross-cutting changes need a three-step checklist:** grep impacted symbols, mark each file as changed/reviewed/not applicable, then group the plan by `core -> data -> services -> stages -> commands`.
- **Story scope must not expand silently:** new guards or behavior changes must stay scoped to the AC path; do not convert feature-specific rules into global behavior without approval.
- **If changing a type or function signature, grep all consumers:** include search evidence and compatibility notes in the fix record.
- **If changing shared literals, scan all layers:** source, tests, docs, story files, and `_bmad-output/` must be checked together.
- **CR fixes must stage immediately:** after a fix, run `git add` for related files and verify no `MM`/`AM` split remains before handing off.
- **CR validation uses `npm run lint:src && npm run build && npm test`:** record command results with test counts; do not reuse previous-round results.
- **`npm run lint` has a broader role:** use it for full-repo Prettier pollution checks and release readiness, not as the default story/CR gate when generated tool dirs exist.
- **Rule registry sync is part of CR scope:** when rules change, update `project-context.md`, `03-core-decisions.md`, and `04-implementation-patterns.md`, including examples and tables.

### Critical Don't-Miss Rules

- **Recovery paths must match main path candidate space:** retry/interactive recovery must include the same rule filtering, source scanning, post-loop universal append, and success checks as the normal path.
- **Retry paths need second success validation:** after user selection or fallback, re-check that items exist; otherwise throw the same user-facing failure.
- **Do not mutate `args.filter` during recovery:** use a local resolved value so parsed args remain stable.
- **Preconditions and notices happen after matching:** preconditions remove affected items only when there are actual source files; notices should be based on contract triggers, not downstream side effects.
- **Non-TTY means no prompts:** semantic-risk items are skipped with warnings; conflicts needing decisions fail with actionable errors unless `--force` has defined semantics.
- **`--force` does not solve source absence, semantic warnings, or Claude reserved names:** do not suggest it in those contexts.
- **Directories copy is file-level for conflict/hash semantics:** avoid treating a copied directory as one opaque file unless the symlink directory mode explicitly does so.
- **`SourceResolver` abstracts source acquisition:** current production source is Git, but pipeline code should depend on the interface, not `GitSourceResolver`.
- **RuleLoader remains an extension point:** current `loadRules()` returns built-ins; future external rules must preserve existing type and matching contracts.
- **Do not edit unrelated generated AI tool directories during feature work:** `.github/skills`, `.kiro/skills`, `.opencode/skills`, `.trae/skills`, `.windsurf/skills`, and similar install outputs may be present as workspace artifacts.

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing code in this repository.
- Treat the rules above as constraints, not suggestions.
- Prefer the narrower behavior when a rule and a convenience shortcut conflict.
- Use architecture docs for expanded human-readable rationale, but keep this file optimized for fast agent consumption.
- If a story Dev Notes snippet conflicts with architecture docs, prefer the architecture docs unless the story explicitly supersedes them.

**For Humans:**

- Keep this file focused on implementation pitfalls and project-specific constraints.
- Refresh it when `src/data/`, pipeline contracts, reporter output, security rules, or test workflow changes.
- When updating rules, synchronize the Rule Document Registry files in the same change.
- Remove obsolete audit notes once their lessons are folded into actionable rules.

Last Updated: 2026-05-24
