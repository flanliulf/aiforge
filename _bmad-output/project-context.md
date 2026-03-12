---
project_name: 'ai-forge'
user_name: 'chunxiao'
date: '2026-03-12'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
status: 'complete'
rule_count: 32
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in ai-forge. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

- **Runtime:** Node.js >= 18.0.0 (ESM only, `"type": "module"`)
- **Language:** TypeScript (strict mode)
- **Build:** tsup (esbuild-based, output ESM to `dist/`)
- **Dev runner:** tsx (direct TS execution)
- **Test:** Vitest (ESM native, Jest-compatible API)
- **Lint/Format:** ESLint + Prettier + typescript-eslint
- **CLI:** commander.js
- **Git ops:** simple-git ~3.32.x
- **Terminal UI:** ora v8+ (spinner) + chalk v5+ (colors)
- **Interactive prompts:** @inquirer/prompts
- **Distribution:** npx (npm public registry)

## Critical Implementation Rules

### TypeScript & ESM Rules

- **ESM imports MUST include `.js` extension:** `import { foo } from './bar.js'` (not `'./bar'`)
- **Named exports only, NO default exports:** `export function foo()` (not `export default`)
- **Interfaces: PascalCase, no `I` prefix:** `SourceResolver` (not `ISourceResolver`)
- **Constants: UPPER_SNAKE_CASE:** `BUILTIN_RULES`, `DEFAULT_EXCLUDES`
- **Functions/variables: camelCase:** `loadRules()`, `ruleIndex`
- **Enums: PascalCase values:** `InstallType.Files`, `Severity.Fatal`
- **File naming: kebab-case:** `resolve-source.ts`, `detect-tools.ts`

### Architecture Rules — Pipeline

ai-forge uses a **pipeline architecture** with type-safe stage chain:

```
Resolve → Auth → Clone → Detect → Match → [Install(含preflight)] → Report
                                            ↑ dry-run skips this
```

- Each stage has explicit input/output TypeScript types
- Pipeline orchestrator chains stages; `dryRun` flag skips Install stage
- **dry-run consistency is guaranteed by architecture** (same Match output feeds both Install and Report)

### Architecture Rules — Module Boundaries

```
index.ts → pipeline.ts → stages/* → services/*
                            │            │
                            └→ core/*  ←─┘
                                 │
                            data/* (pure data)
```

- `core/` has ZERO dependencies on other src dirs (referenced by all)
- `data/` has ZERO dependencies (pure constants)
- `stages/` may depend on `core/`, `data/`, `services/`
- `services/` depends ONLY on `core/`
- `commands/` may depend on `core/`, `services/`
- **NEVER create circular dependencies**

<!-- PLACEHOLDER_APPEND -->

### Error Handling Rules

- **ALL errors MUST use `AiforgeError`** — never throw raw `Error`
- AiforgeError has: `code`, `exitCode`, `severity` ('fatal'|'partial'), `why`, `fix[]`
- `severity: 'fatal'` → pipeline stops immediately
- `severity: 'partial'` → pipeline collects error and continues
- **Three-part error messages:** what broke → why → how to fix (copyable commands)
- Exit codes: `0`=success, `1`=install failure, `2`=auth failure, `3`=arg error
- **Never swallow errors or return null instead of throwing**

### Output Rules

- **ALL user-visible output MUST go through Reporter interface** — never `console.log` directly
- Three Reporter implementations: `TtyReporter` (spinner+color), `PlainReporter` (CI/non-TTY), `QuietReporter` (--quiet)
- Progress phase names: verb + object in Chinese (`"解析仓库地址..."`, `"克隆仓库..."`)
- Result icons: `✅` new, `🔄` updated, `⏭️` skipped, `❌` failed
- Stats line: `安装: N 项  更新: N 项  跳过: N 项  失败: N 项`
- Output strings centralized in `data/messages.ts`

### Security Rules

- **npm package MUST contain ZERO company info** — no repo URLs, tokens, hostnames
- Token exists in memory ONLY during clone; cleared immediately after
- All logs/errors use `sanitizeToken()` from `core/sanitize.ts`
- config.json file permissions: `0o600` (user-only read/write)
- Token display format: `glpat-ab****xy` (first 8 + last 4 chars)

### Data Format Rules

- **JSON fields: camelCase** — `defaultRepo`, `cloneDir`, `preferSSH`
- **Dates: ISO 8601 strings** — `"2026-03-12T10:30:00Z"`
- config.json: auth keyed by hostname (`auth: { "gitlab.xxx.com": { method: "ssh" } }`)
- manifest.json: atomic write via temp file + `fs.rename()`; corrupted → treat as empty

### Testing Rules

- Test files mirror src: `src/stages/clone.ts` → `tests/stages/clone.test.ts`
- `describe` uses module name, `it` uses behavior description
- External deps (simple-git, fs) → vitest mock
- Internal modules → prefer real implementation, mock only when necessary
- PathResolver → inject mock with fixed paths in tests
- Unit tests: each pipeline stage independently, mock external deps
- Integration tests: end-to-end pipeline with temp dirs and fixture repos

### Install Rules Data Architecture

- MVP: rules as TypeScript constants (`BUILTIN_RULES`) with type safety
- Rule lookup: `Map<string, InstallRule[]>` indexed by `${tool}:${scope}`
- Tool detection: data-driven `TOOL_DEFINITIONS` registry (not hardcoded functions)
- Path resolution: `PathResolver` interface centralizes all platform-specific paths
- **Adding a new AI tool = add data to registry + add rules to BUILTIN_RULES, no engine changes**

### Critical Don't-Miss Rules

- **Never hardcode source directory names** (agents/skills/instructions/mcp-tools) — use semantic type mapping
- **Never assume knowledge repo structure** — different orgs have different directory conventions
- **SourceResolver interface** abstracts knowledge source; MVP = Git only, future = local dirs
- **RuleLoader function** abstracts rule loading; MVP = builtin constants, M3 = aiforge.json merge
- **manifest.json crash recovery:** if unreadable, treat all files as unknown origin (NFR-R5)
- **Symlink mode (`-l`) is global-only** — project-level install MUST reject `-l` flag (FR-021)
- **Non-TTY environments:** no spinner, no color, no interactive prompts; fail on decisions needing human input

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Refer to `_bmad-output/planning-artifacts/architecture.md` for full architectural decisions

**For Humans:**

- Keep this file lean and focused on agent needs
- Update when technology stack or patterns change
- Remove rules that become obvious over time

Last Updated: 2026-03-12
