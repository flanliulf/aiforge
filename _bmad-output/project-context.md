---
project_name: 'ai-forge'
user_name: 'chunxiao'
date: '2026-03-12'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
status: 'complete'
rule_count: 45
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
- **新 stage 必须遵循 Reporter 生命周期契约：** 每个管道 stage 必须完成 `reporter.startPhase()` → `reporter.completePhase()` 的配对调用。实现新 stage 时，必须对照至少一个已有 stage（如 `detect-tools.ts`、`match-rules.ts`）确认 Reporter 调用模式一致性：(1) 成功路径必须调用 `completePhase()`；(2) 异常路径由管道编排层处理，stage 不需自行调用 `completePhase()`。`TtyReporter.startPhase()` 启动 ora spinner，`completePhase()` 调用 `succeed()` 并清空 spinner——漏调 `completePhase()` 会导致 spinner 状态泄漏。（来源：Story 4-2 CR R4 — `executeInstall()` 成功路径未调用 `completePhase()`，而其他 3 个 stage 均已正确配对）
- **跨阶段数据契约边界值必须显式处理：** 当上游 stage 的输出可能包含边界值（如 `matchRules` 产出 `sourceFiles = []` 的 item）时，下游 stage 必须显式处理该边界值并在注释中说明语义（如 `// 空 sourceFiles = 源目录不存在，静默跳过`）。禁止假设上游输出"总是非空"——如果需要非空保证，应在上游 stage 中添加过滤而非在下游隐式依赖。（来源：Story 4-2 CR R4 — `matchRules` 产出 `sourceFiles = []` 的 item，`executeInstall` 未跳过，导致空 item 创建无用目录甚至 fail-fast）

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
- **catch 块必须区分错误类型：** 禁止使用 `catch {}` 或 `catch { /* ignore */ }`。如需对特定错误降级，必须使用 `catch (error) { if (error instanceof AiforgeError && error.code === 'SPECIFIC_CODE') { ... } else { throw error } }` 模式。默认行为是 `throw`（透传），降级是例外且必须在注释中说明理由
- **catch 降级必须逐码白名单：** 禁止创建辅助函数（如 `isConfigError()`）将多个错误码归类后批量降级。每个被降级的错误码必须逐个 `error.code === 'XXX'` 匹配，并在注释中单独说明降级理由。如需对新错误码降级，逐码新增 `||` 条件并附带独立注释。（来源：Story 2-3 CR — `isConfigError()` 将 `CONFIG_NOT_FOUND`/`CONFIG_CORRUPT`/`CONFIG_READ_FAILED` 统一降级，掩盖了配置损坏的真实根因）
- **fs 存在性检查必须使用 ENOENT/ENOTDIR 白名单降级：** 使用 `fs.access()` / `fs.stat()` 判断文件/目录是否存在时，禁止 `catch { return false }` 无差别降级。仅对 `error.code === 'ENOENT'`（不存在）和 `error.code === 'ENOTDIR'`（路径组件非目录）降级为 `false`，其他错误（`EACCES` 权限拒绝、`EIO` I/O 错误等）必须向上抛出。否则权限问题会被误判为"不存在"，导致后续逻辑走错分支。（来源：Story 2-4 CR — `hasLocalRepo()` 和 `dirExists()` 各出现一次同样问题，共 3 轮 CR 才彻底收敛）
- **CR 修复引入的新函数/新代码必须贯彻同等规则标准：** 修复 A 函数的问题时若新增了 B 辅助函数，B 必须遵循与 A 相同的规则。修复者提交前应自查：新增的每个函数/分支是否与项目规则一致。（来源：Story 2-4 CR — 修复 `hasLocalRepo()` 的 catch 问题时新增 `dirExists()`，但 `dirExists()` 重复了同样的 `catch {}` 错误，被下一轮 CR 发现）
- **CR 修复必须审查同一函数中所有并行分支：** 修复某个函数的特定分支时，必须审查同一函数中所有并行分支是否存在同类问题，并在修复记录中逐分支列出审查结论（"该分支是否需要同等修复？"→ 是/否 + 理由）。禁止只修复被 CR 指出的具体分支而不审查并行分支——这是导致"修复引入对称性回归"的主要原因。（来源：Story 4-1 CR — Round 3 修复 symlink 逃逸仅在 `targetStat === null` 分支添加 realpath 校验，遗漏 `isSymbolicLink()` 和 `isDirectory()` 分支，导致 P0 安全问题延续到 Round 4 才关闭）
- **新增 AiforgeError 错误码必须同步补负向测试：** 新增 `try/catch` + `throw new AiforgeError(NEW_CODE)` 的错误处理分支时，必须同步补至少 1 条负向测试，强制触发该分支并断言 `code` 和 `severity`。否则回归保护为零，后续重构可能无感知地回退为 raw Error。（来源：Story 2-4 CR — Round 1 修复新增 `SANITIZE_REMOTE_FAILED`/`SCAN_FAILED` 但无测试，Round 2 发现）
- **禁止对必填数据字段使用空值兜底（`?? ''` / `?? 0` / `?? false`）：** 当从 `Map.get()` 或可选链取值、且该值语义上为必填（如 hash、ID、路径等数据完整性关键字段）时，禁止使用 `?? ''`（或 `?? 0`、`?? false`、`?? []`）兜底。必须显式检查 `undefined` 并抛错，包含足够的上下文信息（如路径、key 值）便于排查。否则"看起来成功、但数据已损坏"，下游逻辑会系统性误判。（来源：Story 4-4 CR R1 — `hashes.get(targetPath) ?? ''` 导致空 hash 写入 manifest，下游冲突检测全面误判）
- **InstallResult status 只有三种：** `'new'` | `'updated'` | `'skipped'`（无 `'failed'`——I/O 错误直接抛 fatal，hash 相同或用户选择跳过为 `'skipped'`）
- **复用函数接入新类型时必须审查内部所有分支的类型兼容性：** 当一个已有函数（如 `processConflict()`）被新的调用方类型（如从仅 files 扩展到 directories）复用时，必须逐条审查该函数内部所有执行分支（如 `backup` / `skip` / `overwrite`）对新类型的兼容性：(1) 函数内部调用的子函数是否支持新类型（如 `backupFile()` 不支持目录）；(2) 交互式选项是否在新类型下全部有意义；(3) 新增修复代码时自查清单——对被复用函数的每个 `case`/`if` 分支，逐条回答"在新类型下是否安全/正确？"。（来源：Story 4-5 CR — R1 Directories 未接入冲突检测 + R2 修复后目录冲突 backup 走文件级 API `backupFile()` 崩溃，2 轮才收敛）

### Input Validation Rules

- **输入校验必须在归一化之后执行：** 正则/格式匹配只保证输入"在语法上有效"，不保证"在语义上有效"。所有关键校验（非空、格式合法性、范围约束）必须在标准化处理（如 `stripGitSuffix()`、`pathname.replace()`）之后执行，不能以"正则已限制输入范围"为由跳过归一化后的语义校验
- **多分支校验一致性原则：** 当函数包含多个条件分支（如协议分发、URL 格式判断）时，新增任何校验逻辑必须审查所有并行分支是否需要同步应用。优先将校验逻辑抽取为公共辅助函数（如 `assertRepoPath()`），然后在所有分支中调用——避免"逐分支复制"导致遗漏
- **修复校验类 bug 时，必须验证相关约束不被扩大：** 修复是否意外扩大了输入的合法范围（如白名单新增了不该有的选项）；若修改涉及白名单/黑名单类逻辑，必须列出完整的预期接受/拒绝列表并逐条验证

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
- **symlink 感知的文件系统 API 选用规则：** 当代码路径链中涉及"判断文件系统条目类型"和"对同一路径执行操作"两步时，必须确保两步的 symlink 跟随语义一致。`lstat()` 不跟随 symlink（用于识别 symlink 本身）；`stat()` 跟随 symlink（用于获取最终目标类型）；`access()` 跟随 symlink（对 broken symlink 返回 ENOENT，不是权限错误）；`realpath()` 解析 symlink 返回物理路径（用于路径安全校验）。引入这些 API 时必须自查：(1) 后续对同一路径的操作是否跟随 symlink？若是，前面的判断也应使用 `stat`；(2) 使用 `lstat` 判断类型时，是否需要对 `isSymbolicLink()` 单独分支处理？(3) 路径安全校验是否使用了 `realpath()` 而非 `resolve()`？（来源：Story 4-1 CR — `lstat + isDirectory` 未处理 symlink→directory 祖先导致 3 轮回归）
- **路径安全校验必须使用 `realpath()` 双边比较：** 路径安全边界校验（如 `startsWith` 前缀检查防止路径遍历）必须对被校验路径和安全根路径分别执行 `realpath()`，然后对物理路径做比较。禁止使用 `resolve()` 做安全校验——`resolve()` 是纯字符串操作，不解析 symlink，无法防止 symlink 逃逸。对不存在的路径，应对路径链中已存在的最深祖先目录执行 `realpath()`，拼接不存在的尾部部分后做前缀比较。（来源：Story 4-1 CR — `validatePathSecurity` 使用 `resolve()` 做字符串前缀匹配，symlink 指向外部的路径绕过安全检查，2 轮 CR 才完全修复）
- **sanitizeToken 边界验证：** 实现脱敏逻辑时，必须验证阈值边界处（token 长度恰好等于阈值）脱敏后不可逆推原文
- **sanitizeUrl 必须处理 `oauth2:token@host` 格式：** GitLab 标准 token URL 为 `https://oauth2:${token}@host/repo.git`，脱敏时只处理冒号后的凭据部分，保留 `oauth2:` 前缀
- **脱敏函数必须覆盖边界形态输入：** sanitizeToken/sanitizeUrl 的正则/匹配逻辑必须覆盖用户可能构造的边界形态输入（如不完整 URL、缺少 host 的 URL、尾部截断的 token）。新增任何 `AiforgeError` 的 `why` 字段时，检查是否包含用户原始输入——如果是，必须通过 sanitizeUrl/sanitizeToken 处理，不能有"漏调"
- **安全校验必须在最终 I/O 操作路径上执行：** 当预检阶段的校验路径（如 `targetPath` = 目录）与实际 I/O 操作路径（如 `destPath` = `join(targetPath, basename(srcPath))`）不同时，必须在实际操作前对最终路径再次执行安全校验。"preflight 通过 ≠ 操作安全"——中间路径合法不代表最终路径合法（合法目录下可能存在指向外部的 symlink 文件）。此规则适用于所有涉及"先校验目录、再操作目录下文件"的场景。（来源：Story 4-2 CR R1 — `preflight()` 校验 `targetPath` 通过，但 `copyFile()` 操作的 `destPath` 可被预置 symlink 重定向到 `allowedRoot` 外部，导致 P0 安全漏洞）

### Data Format Rules

- **JSON fields: camelCase** — `defaultRepo`, `cloneDir`, `preferSSH`
- **Dates: ISO 8601 strings** — `"2026-03-12T10:30:00Z"`
- config.json: auth keyed by hostname (`auth: { "gitlab.xxx.com": { method: "ssh" } }`)
- manifest.json: atomic write via temp file + `fs.rename()`; corrupted → treat as empty
- **持久化数据字段必须在类型定义中标注路径语义：** 当接口字段的值为文件路径时，必须在 `core/types.ts` 的类型定义中通过 JSDoc 注释明确标注路径语义（绝对路径 / 相对路径 / 相对于哪个根目录）。禁止仅在 Story Dev Notes 中标注而在类型定义中留空 — Dev Agent 实现时优先参考类型定义，语义标注缺失会导致数据契约不一致。（来源：Story 4-4 CR R1 — `ManifestEntry.source` 应为相对路径但实现写入绝对路径，因类型定义未标注语义）

### Testing Rules

- Test files mirror src: `src/stages/clone.ts` → `tests/stages/clone.test.ts`
- `describe` uses module name, `it` uses behavior description
- External deps (simple-git, fs) → vitest mock
- Internal modules → prefer real implementation, mock only when necessary
- PathResolver → inject mock with fixed paths in tests
- Unit tests: each pipeline stage independently, mock external deps
- Integration tests: end-to-end pipeline with temp dirs and fixture repos
- **Mock 断言必须验证被测函数的实际调用链：** 当测试涉及安全关键行为（如 Token 脱敏、权限检查）时，禁止在测试中直接调用 mock 函数来验证其行为。必须通过被测函数的入口触发 mock，然后断言：(1) mock 函数被调用且参数正确（`toHaveBeenCalledWith`）；(2) 被测函数的输出/副作用中包含 mock 处理结果而非原始输入。（来源：Story 2-3 CR — AC #7 脱敏测试直接调用 mock 的 `sanitizeToken()`，无法守住安全回归）

### CR Workflow Rules

- **CR 修复后必须同步更新 Story Dev Agent Record：** CR 修复涉及新增/删除测试用例或代码变更导致全仓测试数变化时，修复完毕后必须同步更新 Story 的 Completion Notes：(1) 当前 Story 测试用例数；(2) 全仓测试通过数；(3) Lint 状态。更新时应标注变更原因（如"原 18 + CR Round-1 修复新增 3"）。（来源：Story 2-3 CR — 修复新增 3 个测试后 Story 记录仍写"18 个测试"，延续一整轮 CR 才关闭）
- **CR 修复后必须执行完整质量门禁三件套：** 每次 CR 修复完成后，必须按顺序执行 `npm test` → `npm run lint` → `npm run build`，并将每项结果逐行记录到修复记录中。禁止：(1) 只执行部分验证（如只跑 test 不跑 lint）；(2) 复用上轮验证结果（每次修复后必须重新执行）；(3) 在验证未全部通过时声称"通过"。Prettier 格式化应作为修复的最后一步自动执行：`npx prettier --write <修改过的文件>`。（来源：Story 4-2 CR — R2 和 R5 各出现一次 Prettier 格式未通过；Story 4-1 CR 也出现同类问题，共 3 次重复）

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

Last Updated: 2026-03-30
