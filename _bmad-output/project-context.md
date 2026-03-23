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

## Rule Document Registry

**凡是确认/修改/新增任何规则、约定或豁免，必须同步更新以下所有文档：**

| 文档 | 职责 |
|------|------|
| `_bmad-output/project-context.md` | AI agent 主规则文件（本文件），优化为 LLM 消费 |
| `_bmad-output/planning-artifacts/architecture/04-implementation-patterns.md` | 命名/导出/测试/错误处理等实现模式，面向人类可读 |

> 两份文档内容互为镜像，任何一处规则变更必须同时更新另一处。

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
- **Named exports only, NO default exports:** `export function foo()` (not `export default`) — **仅约束业务代码**；工具配置文件（`tsup.config.ts`、`vitest.config.ts` 等）使用工具官方 API 的 `export default defineConfig(...)` 形式，豁免此规则
- **Interfaces: PascalCase, no `I` prefix:** `SourceResolver` (not `ISourceResolver`)
- **Constants: UPPER_SNAKE_CASE:** `BUILTIN_RULES`, `DEFAULT_EXCLUDES`
- **Functions/variables: camelCase:** `loadRules()`, `ruleIndex`
- **Enums: PascalCase values:** `InstallType.Files`, `Severity.Fatal`
- **File naming: kebab-case:** `resolve-source.ts`, `detect-tools.ts`
- **字符串联合类型 vs enum 选型规则：**
  - 当值域小（2-3 个值）、值本身是有意义的字符串、且需要与外部数据（JSON/YAML/manifest）序列化交互时，优先使用**字符串字面量联合类型**（如 `'global' | 'project'`）——零运行时开销、JSON 直接可用
  - 当值域作为引擎核心概念需要命名空间组织、或需要反向映射时，使用 **enum**（如 `InstallType.Files`）
  - **关键约束：** `data/` 模块有零运行时依赖要求，引用 enum 会产生运行时 import，因此 data/ 内使用 `import type` + 字符串字面量断言（`'Files' as InstallType`）来避免运行时依赖

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

### Type Semantic Layers（类型语义分层）

- **`AuthMethod` 类型区分两个语义层：**
  - 运行时认证方式（`AuthenticatedSource.authMethod`）：`'ssh' | 'token' | 'credential-manager'`
  - 持久化配置（`AiforgeConfig.auth[host].method`）：仅 `'ssh' | 'token'`
- **不要直接复用运行时类型到持久化接口**，应使用内联字面量类型收窄
- 同理适用于其他存在运行时/持久化语义差异的类型

### Error Handling Rules

- **ALL errors MUST use `AiforgeError`** — never throw raw `Error`
- AiforgeError has: `code`, `exitCode: ExitCode`, `severity` ('fatal'), `why`, `fix[]`
- **`ExitCode` 是类型级约束：** `type ExitCode = 0 | 1 | 2 | 3`，不接受任意 `number`
- `severity: 'fatal'` → pipeline stops immediately (Install 阶段 fail-fast，无 partial 概念)
- **Three-part error messages:** what broke → why → how to fix (copyable commands)
- Exit codes: `0`=success, `1`=install failure, `2`=auth failure, `3`=arg error
- **Never swallow errors or return null instead of throwing**
- **InstallResult status 只有三种：** `'new'` | `'updated'` | `'skipped'`（无 `'failed'`——I/O 错误直接抛 fatal，hash 相同或用户选择跳过为 `'skipped'`）

### Output Rules

- **ALL user-visible output MUST go through Reporter interface** — never `console.log` directly
- **Exceptions (formally allowed):**
  - `aiforge init` 交互式命令：使用 `console.log` + `@inquirer/prompts` 直接输出（init 不走管道，不适用 Reporter）
  - Reporter 创建前的语言回退提示：允许 `process.stderr.write()`（此时 Reporter 尚未实例化）
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
- Token display format: `glpat-ab****mnop` (first 8 + `****` + last 4 chars); short tokens (<= 12 chars): first 4 + `****` (no tail)
- **sanitizeToken 边界验证：** 实现脱敏逻辑时，必须验证阈值边界处（token 长度恰好等于阈值）脱敏后不可逆推原文
- **sanitizeUrl 必须处理 `oauth2:token@host` 格式：** GitLab 标准 token URL 为 `https://oauth2:${token}@host/repo.git`，脱敏时只处理冒号后的凭据部分，保留 `oauth2:` 前缀

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
- **当 story Dev Notes 中的代码片段与架构文档（`architecture/*.md`）存在差异时，以架构文档为准。** Story 代码片段仅为示意，不保证字段的 optional/required 标记完整

**For Humans:**

- Keep this file lean and focused on agent needs
- Update when technology stack or patterns change
- Remove rules that become obvious over time

Last Updated: 2026-03-19
