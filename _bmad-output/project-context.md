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

### Cross-Cutting Concern Checklist（横切关注点检查清单）

当 Story 被识别为横切关注点（满足以下**任一**标准即触发）时，开发前**必须**执行三步检查清单，否则 CR 反复发现遗漏的轮数会显著增加。

**识别标准：**
- 改动涉及 ≥4 个 `src/` 子目录
- 修改共享资源（`core/types.ts`、`core/messages.ts`、`data/` 下的常量注册表）
- Story 描述含"全仓/跨模块/横切"类关键词

**三步清单：**

1. **影响面 grep 扫描**：`grep -rn "<关键函数/类型/字符串>" src/ --include="*.ts"` — 生成受影响文件列表
2. **逐文件标注处置方式**：对每个受影响文件标注 `改动 / 审查无需改 / 不涉及`，形成核查清单
3. **模块分组检查报告**：按 `core/ → data/ → services/ → stages/ → commands/` 顺序分组列出改动计划，每组完成后打勾确认，作为 CR 自查附件提交

> 来源：Epic 5 Retrospective — Story 5-5a（i18n）经历 6 轮 CR，根因是横切关注点影响面跨 10 个生产代码文件，传统线性执行模式不适配，每轮 CR 逐个发现遗漏。

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
- **新增错误处理分支必须全功能对标同函数内已有并行分支：** 在 catch 块或同一函数中新增错误处理分支（如 `if (isAuthFailure) { throw new AiforgeError(...) }`）时，**禁止只实现核心字段（message/why/code）而忽略辅助功能字段**。必须找到同函数中已有的同类分支（如 `CLONE_FAILED`），逐字段对比，确保新分支在行为上与已有分支完全对等（如 cleanupWarning 透传、额外上下文追加等）。否则同函数内两个并行分支行为不一致，会造成特定场景下用户收不到应有的修复提示。（来源：Story 5-4 CR Round 2 — 新增 `AUTH_FAILED` 分支时未复制 `CLONE_FAILED` 分支的 cleanupWarning 透传逻辑，导致"认证失败 + 清理也失败"时用户看不到手动删除残留目录的提示）
- **新增 AiforgeError 错误码必须同步补负向测试：** 新增 `try/catch` + `throw new AiforgeError(NEW_CODE)` 的错误处理分支时，必须同步补至少 1 条负向测试，强制触发该分支并断言 `code` 和 `severity`。否则回归保护为零，后续重构可能无感知地回退为 raw Error。（来源：Story 2-4 CR — Round 1 修复新增 `SANITIZE_REMOTE_FAILED`/`SCAN_FAILED` 但无测试，Round 2 发现）
- **错误码测试必须覆盖"真实生产创建链路"，禁止在 Reporter 层手工构造错误对象伪造 AC 满足：** 为新错误码（如 `AUTH_FAILED`、`NO_TOOLS`、`PERMISSION_DENIED`）编写测试时，必须从该错误码的**真实创建模块**（如 `clone.ts`、`detect-tools.ts`、`fs-utils.ts`）的入口触发，断言最终抛出的 `AiforgeError.code` 和关键字段值。禁止"在 reporter 测试中手工 `new AiforgeError('...', 'NEW_CODE')` 构造错误对象"——这只证明 Reporter 能渲染该类型的错误，**不能证明生产代码会在正确时机创建该错误**，导致测试全绿但 AC 实质未满足。（来源：Story 5-4 CR Round 1 — `AUTH_FAILED` 只存在于 reporter 手工构造的单测中，生产代码 clone.ts 根本不存在创建该错误的链路，全仓测试全绿但真实认证失败仍输出 `CLONE_FAILED`）
- **禁止对必填数据字段使用空值兜底（`?? ''` / `?? 0` / `?? false`）：** 当从 `Map.get()` 或可选链取值、且该值语义上为必填（如 hash、ID、路径等数据完整性关键字段）时，禁止使用 `?? ''`（或 `?? 0`、`?? false`、`?? []`）兜底。必须显式检查 `undefined` 并抛错，包含足够的上下文信息（如路径、key 值）便于排查。否则"看起来成功、但数据已损坏"，下游逻辑会系统性误判。（来源：Story 4-4 CR R1 — `hashes.get(targetPath) ?? ''` 导致空 hash 写入 manifest，下游冲突检测全面误判）
- **InstallResult status 只有三种：** `'new'` | `'updated'` | `'skipped'`（无 `'failed'`——I/O 错误直接抛 fatal，hash 相同或用户选择跳过为 `'skipped'`）
- **复用函数接入新类型时必须审查内部所有分支的类型兼容性：** 当一个已有函数（如 `processConflict()`）被新的调用方类型（如从仅 files 扩展到 directories）复用时，必须逐条审查该函数内部所有执行分支（如 `backup` / `skip` / `overwrite`）对新类型的兼容性：(1) 函数内部调用的子函数是否支持新类型（如 `backupFile()` 不支持目录）；(2) 交互式选项是否在新类型下全部有意义；(3) 新增修复代码时自查清单——对被复用函数的每个 `case`/`if` 分支，逐条回答"在新类型下是否安全/正确？"。（来源：Story 4-5 CR — R1 Directories 未接入冲突检测 + R2 修复后目录冲突 backup 走文件级 API `backupFile()` 崩溃，2 轮才收敛）
- **跨层共享字段禁止语义扩展——新语义必须用新字段：** 当一个字段（如 `mode`）被多个模块/阶段消费时，禁止通过扩展该字段的值域来承载新语义。新语义必须使用新字段或独立映射。修改字段类型定义前，必须列出该字段的所有消费方（grep 所有引用），逐个回答"新增的值在该消费方是否有意义/安全？"——如果任何一个消费方的分支逻辑不处理新值，则不能扩展原字段。（来源：Story 4-6a CR — R1 修复将 `MatchedPlan.mode` 从 `'copy' | 'symlink'` 扩展为 `'copy' | 'symlink' | 'flatten'`，导致 `executeInstall()` 的 `if (mode === 'symlink')` 分支不处理 `'flatten'`，Flatten + --link 功能回归；需要 3 轮 CR 才收敛）
- **CR 修复变更类型定义或函数签名时，必须全仓 grep 受影响引用并逐个评估，且必须在修复记录中提供搜索证据：** CR 修复中如果修改了类型定义（interface/type/enum 的字段增删改）或函数签名（参数增减、返回类型变更），修复者必须执行全仓 grep，列出所有受影响的引用点，并在修复记录中**附上搜索命令及其输出**，逐个标注"该引用是否兼容变更？"→ 是/否 + 理由。禁止只修复 CR 指出的具体文件而不做全仓搜索——这是导致"同类问题跨多轮 CR 反复出现"的直接原因。建议搜索格式：`grep -rn "TypeName" tests/ src/ --include="*.ts"` 并逐行标注处理结论。（来源：Story 4-6a CR — R1 修复变更了 `MatchedPlan.mode` 类型和 `getInstallMode()` 签名，但未评估 `executeInstall()` 和 `reporter` 中的 `.mode` 引用，导致 R2 发现功能回归；Story 4-6b CR — `InstallResult.tool` 字段全仓同步遗漏贯穿 R1→R5 共 4 轮 CR，每轮只修复被指出的文件而非全仓扫清）

### Input Validation Rules

- **输入校验必须在归一化之后执行：** 正则/格式匹配只保证输入"在语法上有效"，不保证"在语义上有效"。所有关键校验（非空、格式合法性、范围约束）必须在标准化处理（如 `stripGitSuffix()`、`pathname.replace()`）之后执行，不能以"正则已限制输入范围"为由跳过归一化后的语义校验
- **多分支校验一致性原则：** 当函数包含多个条件分支（如协议分发、URL 格式判断）时，新增任何校验逻辑必须审查所有并行分支是否需要同步应用。优先将校验逻辑抽取为公共辅助函数（如 `assertRepoPath()`），然后在所有分支中调用——避免"逐分支复制"导致遗漏
- **修复校验类 bug 时，必须验证相关约束不被扩大：** 修复是否意外扩大了输入的合法范围（如白名单新增了不该有的选项）；若修改涉及白名单/黑名单类逻辑，必须列出完整的预期接受/拒绝列表并逐条验证
- **可选 CLI 分叉选项的条件判断必须使用 `!== undefined`：** 当 CLI 选项触发命令行为分叉时（如 `--list` 触发列举模式），分叉条件必须使用 `if (args.option !== undefined)` 而非 `if (args.option)`。Commander 解析 `--list ""` 的结果为 `{ list: "", hasOwn: true }`（已明确提供但值为空字符串），truthy 判断会将其误判为"未提供"，导致静默降级到默认流程（如安装）违反最小意外原则；在 CI/CD 脚本化场景中 `$DIR_VAR` 为空时有误安装风险。值合法性校验由被调用函数入口负责（统一抛出错误码），分叉条件只负责区分"是否提供了该选项"。（来源：Story 6-1 CR R2 — `if (args.list)` 使 `--list ""` 跳过 list 分叉直接进入安装流程）
- **CLI 字符串参数（目录名/标识符类）必须同时校验三重防护：** 接受"目录名/文件名/标识符"类字符串的 CLI 选项，在函数入口必须同时执行：(1) **空值防护**：`!val.trim()` → 拒绝空字符串和纯空白字符串；(2) **路径分隔符防护**：`/[/\\]/.test(val)` → 防止路径穿越（含绝对路径引用）；(3) **点号前缀防护**：`val.startsWith('.')` → 防止 `.` 或 `..` 相对路径引用。三重防护缺一不可——只防路径字符而遗漏空字符串会被迂回，只防空字符串而遗漏路径字符会被路径穿越利用。（来源：Story 6-1 CR R1 只修复了路径分隔符，R2 发现空字符串绕过，两次修复本可在首轮一并完成）

### Output Rules

- **ALL user-visible output MUST go through Reporter interface** — never `console.log` directly
- **Exceptions (formally allowed):**
  - `aiforge init` 交互式命令：使用 `console.log` + `@inquirer/prompts` 直接输出（init 不走管道，不适用 Reporter）
  - Reporter 创建前的语言回退提示：允许 `process.stderr.write()`（此时 Reporter 尚未实例化）
- Three Reporter implementations: `TtyReporter` (spinner+color), `PlainReporter` (CI/non-TTY), `QuietReporter` (--quiet)
- Progress phase names: verb + object in Chinese (`"解析仓库地址..."`, `"克隆仓库..."`)
- Result icons: `✅` new, `🔄` updated, `⏭️` skipped
- Stats line: `安装: N 项  更新: N 项  跳过: N 项`
- Output strings centralized in `core/messages.ts` (moved from `data/messages.ts` in Story 5-5a — `data/messages.ts` now re-exports for backward compatibility)
- **i18n 字符串覆盖完整性：** 实现多语言输出时，`AiforgeError.fix[]`、`reporter.warn()` 文案、Reporter 量词/标签（如 `(N 项)`）、诊断输出（如 `emitDiagnostics`）与 `message`/`why` 字段具有**同等用户可见性**，必须全部接入 `msg()`。禁止只国际化主展示字段而遗漏 `fix[]` 或量词。实现完成后，按以下清单逐项自查：(1) `AiforgeError.fix[]` 数组 → 全接入 `msg()`？(2) `reporter.warn()` 所有调用点 → 全接入 `msg()`？(3) Reporter 量词/标签（如 `(${n} 项)`）→ 使用模板键？(4) 诊断输出 → 接入 `msg()`？(5) CLI help 文案 → 英文硬编码（不做国际化）？（来源：Story 5-5a CR R1~R5 — 每轮修复后仍被发现新的中文残留，原因均是分层遗漏 fix[]/warn/量词）
- **子命令独立语言初始化：** 具有独立 `action()` handler 的子命令（如 `aiforge init`）不走主管道的语言预加载路径（`index.ts` 的 `setLanguage(config.language)` 仅覆盖主命令路径）。子命令 handler 必须在自己内部完成 `setLanguage()` 初始化，时机为 `loadConfig()` 成功后、首次用户可见输出之前。（来源：Story 5-5a CR R2 — `init` 子命令有独立 `action()`，`config.language = 'en'` 时运行 `aiforge init` 仍先输出中文配置摘要）
- **CLI help 文案不做国际化：** Commander `.description()` / `.option()` 描述统一使用英文硬编码，**不通过 `msg()` 动态获取**——Commander 在模块加载时求值 description，此时 `currentLanguage` 始终为默认值，动态获取无效。（来源：Story 5-5a CR R2 评估 — `.description(msg('init.descInit') || ...)` fallback 因 `msg()` 返回非空中文而永远不生效）
- **进度计数变量的分子/分母必须绑定到同一语义单元：** 实现 `processedCount / totalFiles` 类进度显示时，必须在代码注释中明确"进度单位"语义，并确保所有"已处理的终态"（`new`/`updated`/`skipped`/`conflictAction === 'skip'`/`warn+skip`）统一推进分子计数。若某终态不推进，用户会看到进度停滞后突然结束，误以为还有文件未处理。注意：`processedCount++` 和 `reporter.updatePhase(...)` 必须在 `resultItems.push()` 和 `continue` 之前执行。（来源：Story 5-1 CR R1 — 3 类 skipped 终态均未推进计数，进度显示失真）
- **输出通道与 TTY 能力判定必须绑定到同一 fd：** 当功能模块将输出定向到特定 fd（如 `process.stderr`）时，判定该 fd 的终端能力（如 `isTTY`、颜色支持）必须使用**同一个 fd** 的属性。具体到 spinner/Reporter 创建场景：spinner 用 `stderr` 输出则 `isTty: process.stderr.isTTY === true`，禁止混用 `process.stdout.isTTY`。否则在 `aiforge ... > result.txt` 或 `aiforge ... | cmd` 场景下，stderr 仍在终端但 spinner 被错误禁用。（来源：Story 5-1 CR R1 — `ora({ stream: process.stderr })` 与入口层 `process.stdout.isTTY` fd 不一致）
- **PlainReporter 输出方法内所有行必须遵从同一分隔符契约：** 当方法要求"制表符分隔输出"时，该方法内的**所有** `stdout.write()` 调用（含明细行、统计行、汇总行）均须使用 `\t` 分隔，不能只修改主数据行而遗漏统计行或汇总行。实现完成后必须横向比对方法内**全部输出行**，逐行确认分隔符一致性；同一 Reporter 类中多个输出方法（`reportResult()` / `reportPlan()`）的分隔规则也必须相互对齐。（来源：Story 5-3 CR R1 — `reportPlan()` 主数据行用双空格而非 `\t`；CR R2 — `reportResult()` 明细行已用 `\t` 但统计行仍用双空格，同一方法内两套分隔规则）

### Security Rules

- **npm package MUST contain ZERO company info:**
  - no company/internal repo URLs (generic placeholder URLs like `your-host.com` are allowed for documentation examples)
  - no real tokens or credentials (placeholder tokens like `<your-token>` are allowed for documentation examples)
  - no company hostnames or internal domain names
  - no platform-specific token prefixes that reveal internal toolchain (e.g. `glpat-`, `ghp_`)
- **npm 包安全验证方法必须扫描入包文件的实际内容：** 禁止仅扫描 `npm pack --dry-run` 的输出流（仅含文件名+大小）。必须用 `npm pack --json` 获取入包文件列表后，逐个 `grep -in <pattern> <file>` 扫描文件内容。`README.md` 是 npm 硬编码始终包含的文件，无法通过 `.npmignore` 或 `files` 字段排除，因此 README.md 的内容安全必须作为验证项。（来源：Story 5-5c CR R1 — B5 验证方法只扫 `npm pack` 输出流，README.md 中的 `gitlab.example.com` 和 `glpat-xxxx` 未被检出）
- Token exists in memory ONLY during clone; cleared immediately after
- All logs/errors use `sanitizeToken()` from `core/sanitize.ts`
- config.json file permissions: `0o600` (user-only read/write)
- Token display format: `glpat-ab****mnop` (first 8 + `****` + last 4 chars); short tokens (<= 12 chars): first 4 + `****` (no tail)
- **symlink 感知的文件系统 API 选用规则：** 当代码路径链中涉及"判断文件系统条目类型"和"对同一路径执行操作"两步时，必须确保两步的 symlink 跟随语义一致。`lstat()` 不跟随 symlink（用于识别 symlink 本身）；`stat()` 跟随 symlink（用于获取最终目标类型）；`access()` 跟随 symlink（对 broken symlink 返回 ENOENT，不是权限错误）；`realpath()` 解析 symlink 返回物理路径（用于路径安全校验）。引入这些 API 时必须自查：(1) 后续对同一路径的操作是否跟随 symlink？若是，前面的判断也应使用 `stat`；(2) 使用 `lstat` 判断类型时，是否需要对 `isSymbolicLink()` 单独分支处理？(3) 路径安全校验是否使用了 `realpath()` 而非 `resolve()`？（来源：Story 4-1 CR — `lstat + isDirectory` 未处理 symlink→directory 祖先导致 3 轮回归）
- **路径安全校验必须使用 `realpath()` 双边比较：** 路径安全边界校验（如 `startsWith` 前缀检查防止路径遍历）必须对被校验路径和安全根路径分别执行 `realpath()`，然后对物理路径做比较。禁止使用 `resolve()` 做安全校验——`resolve()` 是纯字符串操作，不解析 symlink，无法防止 symlink 逃逸。对不存在的路径，应对路径链中已存在的最深祖先目录执行 `realpath()`，拼接不存在的尾部部分后做前缀比较。（来源：Story 4-1 CR — `validatePathSecurity` 使用 `resolve()` 做字符串前缀匹配，symlink 指向外部的路径绕过安全检查，2 轮 CR 才完全修复）
- **sanitizeToken 边界验证：** 实现脱敏逻辑时，必须验证阈值边界处（token 长度恰好等于阈值）脱敏后不可逆推原文
- **sanitizeUrl 必须处理 `oauth2:token@host` 格式：** GitLab 标准 token URL 为 `https://oauth2:${token}@host/repo.git`，脱敏时只处理冒号后的凭据部分，保留 `oauth2:` 前缀
- **脱敏函数必须覆盖边界形态输入：** sanitizeToken/sanitizeUrl 的正则/匹配逻辑必须覆盖用户可能构造的边界形态输入（如不完整 URL、缺少 host 的 URL、尾部截断的 token）。新增任何 `AiforgeError` 的 `why` 字段时，检查是否包含用户原始输入——如果是，必须通过 sanitizeUrl/sanitizeToken 处理，不能有"漏调"
- **三种脱敏函数适用场景不可混用：** `sanitizeToken()` 适用于独立 token 字符串脱敏；`sanitizeUrl()` 适用于纯 URL 字符串脱敏（内部使用带 `^` 锚点的正则，仅匹配纯 URL 格式）；`sanitizeMessage()` 适用于**任意字符串**（如 git/simple-git 错误消息）中嵌入 token-bearing URL 的场景（使用全局替换正则，无锚点）。将底层异常的 `error.message` 写入 `AiforgeError.why` 时，**必须使用 `sanitizeMessage()` 而非 `sanitizeUrl()`**——git 错误消息中 URL 嵌入在任意位置，`sanitizeUrl()` 无法处理。（来源：Story 5-4 CR Round 1 — `CLONE_FAILED`/`PULL_FAILED` 的 `why` 直接透传 `error.message`，simple-git 错误回显完整 clone URL（含 token），导致 token 通过 reporter 输出到 stderr；修复时新增 `sanitizeMessage()` 函数专门处理此场景）
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
- **标记为集成测试的文件必须至少覆盖一条真实闭包/工厂函数路径：** 当测试文件放在 `tests/integration/` 目录且标记为集成测试时，至少有一条测试必须使用真实的工厂函数（如 `createProductionStages()`）而非全部 mock。全 Mock 编排测试只验证调用顺序，不验证阶段内部逻辑——工厂函数返回的闭包、共享状态变量的读写一致性，只有通过真实路径才能覆盖。如果确有"纯编排"测试的需求，应在文件或 describe 块中显式标注 `(orchestration-only)`，与真实集成测试区分。（来源：Story 4-6a CR R1 — `tests/integration/pipeline.test.ts` 8 个阶段全部 mock，553/553 全绿但 manifest mode 类型不匹配和空值兜底两个缺陷全部漏过）
- **Mock 断言必须验证被测函数的实际调用链：** 当测试涉及安全关键行为（如 Token 脱敏、权限检查）时，禁止在测试中直接调用 mock 函数来验证其行为。必须通过被测函数的入口触发 mock，然后断言：(1) mock 函数被调用且参数正确（`toHaveBeenCalledWith`）；(2) 被测函数的输出/副作用中包含 mock 处理结果而非原始输入。（来源：Story 2-3 CR — AC #7 脱敏测试直接调用 mock 的 `sanitizeToken()`，无法守住安全回归）
- **测试断言必须基于 Story 契约而非当前实现行为：** 新增或修改测试断言时，断言的期望值必须基于 Story 文档中定义的输出契约（如示例输出格式、字段语义），而非当前实现的实际输出。如果实现与 Story 契约不一致，应先修复实现使其符合契约，再编写断言——禁止"先让测试绿了、再说契约的事"。否则测试会将错误行为固化，后续修正时还需连带修改测试。（来源：Story 4-6b CR R1→R2 — 修复 `reportResult()` 后新增测试直接使用绝对路径作为断言基准，将错误的 `sourcePath` 行为固化，R2 审查发现后才纠正为 Story 约定的 repo-relative 路径）
- **CR 修复改变行为后必须同步更新所有与"旧行为"绑定的测试断言：** 当 CR 修复使某个行为发生变化时，必须搜索测试文件中所有基于旧行为编写的断言并将其更新为正确行为的断言。特别注意：原本"通过"的测试若因修复而变为"失败"，禁止为了"让测试重新变绿"而回退修复或注释断言——应更新断言以匹配正确行为，同时在注释中说明语义变更原因（如"skipped 仍是已处理的终态，应推进进度计数"）。（来源：Story 5-1 CR 修复 — 修复进度计数后，2 个旧断言 `not.toHaveBeenCalled()` 需同步更新为正确预期）
- **Story Dev Notes 的 UI/格式代码示例是实现契约，不是参考风格：** 当 Story Dev Notes 给出具体的输出示例（含颜色方案、图标映射、格式结构）时，该示例为**强制实现契约**：(1) 实现完成后必须逐项比对 Dev Notes 示例与实际输出；(2) 对应测试必须断言格式契约本身（如颜色语义、图标映射），而非仅断言文本内容；(3) 如实现与示例存在合理偏差，必须在代码注释或 Story 中明确记录偏差原因。禁止将 Dev Notes 中的具体着色方案视为"建议风格"而仅部分实现。（来源：Story 5-2 CR R1 — Dev Notes 第 58-65 行给出 `chalk.green/blue/gray` 状态着色示例，实现仅对标题着色，结果行和统计行均未落地；配套测试也只验证文本结构而未验证颜色语义）
- **i18n 测试必须验证"实际输出内容切换"，而非只验证"配置被持久化"：** 测试多语言输出时，断言目标必须是相关模块在 `setLanguage('en')` 后的实际输出字符串（Reporter 统计行、`AiforgeError.message`/`fix[]`、`warn` 文案），而非 `saveConfig()` 调用或 `language` 字段值。禁止以"语言配置被正确保存"替代"输出内容真正切换"作为 i18n AC 的满足依据。（来源：Story 5-5a CR R1/R3 — 新增测试只断言 `saveConfig()` 中的 `language` 字段值，未验证英文模式下实际输出是否变为英文；阶段级测试将中文输出固化为正确行为，无法捕获运行时中文残留）
- **禁止通过选择性测试路径绕行已知缺陷——已知缺陷必须修复或显式豁免：** 当开发阶段发现某条代码路径存在 bug，禁止通过"选用不触发该路径的测试工具/参数"使测试变绿。正确处理方式必须三选一：(1) **修复缺陷**（推荐）：修复生产代码，补充覆盖该路径的回归测试；(2) **显式跳过**：用 `it.skip(...)` 标记，在描述中注明"已知缺陷，Issue #XXX"，并在 Story Dev Agent Record 中记录为已知限制；(3) **PR 阻塞**：在 Story Dev Agent Record 中明确记录为"阻塞项，不可交付"。禁止隐式绕行，也禁止在 Dev Agent Record 中记录"规避策略"而不标注为技术债。**测试全绿不代表功能可用——隐式绕行只是将缺陷推迟到 CR 阶段发现，浪费审查资源。**（来源：Story 5-5b CR R1 — `saveManifest` 对 `InstallType.Directories` 目录路径调用 `fileHash()` 的已知缺陷，通过将 saveManifest E2E 测试改用只含 Flatten+Files 的 cursor 工具绕行，导致全量 691/691 全绿但 claude/copilot skills 安装链路在生产中 fatal）

### CR Workflow Rules

- **CR 修复后必须同步更新 Story Dev Agent Record：** CR 修复涉及新增/删除测试用例或代码变更导致全仓测试数变化时，修复完毕后必须同步更新 Story 的 Completion Notes：(1) 当前 Story 测试用例数；(2) 全仓测试通过数；(3) Lint 状态。更新时应标注变更原因（如"原 18 + CR Round-1 修复新增 3"）。**同时必须更新 `File List`，确保列出 CR 修复过程中所有改动文件，包括规则文档**（`project-context.md`、`03-core-decisions.md`、`04-implementation-patterns.md`）——仅列出代码文件而遗漏规则文档是常见遗漏点。（来源：Story 2-3 CR — 修复新增 3 个测试后 Story 记录仍写"18 个测试"，延续一整轮 CR 才关闭；Story 5-2 CR R3 — CR 修复同步了 3 份规则文档但 File List 未追加）
- **CR 修复后必须执行完整质量门禁三件套：** 每次 CR 修复完成后，必须按顺序执行 `npm test` → `npm run lint` → `npm run build`，并将每项结果逐行记录到修复记录中。禁止：(1) 只执行部分验证（如只跑 test 不跑 lint）；(2) 复用上轮验证结果（每次修复后必须重新执行）；(3) 在验证未全部通过时声称"通过"。Prettier 格式化应作为修复的最后一步自动执行：`npx prettier --write <修改过的文件>`。（来源：Story 4-2 CR — R2 和 R5 各出现一次 Prettier 格式未通过；Story 4-1 CR 也出现同类问题，共 3 次重复）
- **CR 修复验证结论必须可独立复现：** CR 修复记录中的"验证通过"结论必须附带可独立复现的验证命令和输出摘要（如测试通过数、lint 状态）。禁止只写"✅ npm run lint 通过"而不附带任何证据。后续审查轮次必须能通过重新执行相同命令来验证结论的真实性。修复记录中如果声称验证通过，但下一轮审查独立执行后发现未通过，视为修复记录不合规。（来源：Story 4-6b CR R1→R2 — R1 修复记录声称"npm run lint ✅ 通过"，但 R2 审查独立执行后发现 lint 实际未通过，说明 R1 验证结论不可靠）
- **Rule Document Registry 同步时必须扫描示例代码块和格式示例，不限于文字规则段落：** 执行 Rule Document Registry 三文档同步时，除更新文字规则段落外，还必须检查：(1) **示例代码块**（`` ``` `` 块内的接口签名、类型定义、枚举值）；(2) **格式示例/图标枚举**（如 Result icons 枚举列表、统计行格式示例）。搜索关键词：同步目标的字段名、枚举值、状态词（如 `failed`、`InstallResult`）。遗漏"非文字规则"内容是多轮 CR 中持续出现的同步缺口。（来源：Story 5-2 CR R1 — `failed` 图标/统计行示例未同步；R2 — `InstallResult[]` 接口示例未同步，均属文字规则已同步但示例内容遗漏的模式）
- **lint 门禁作用域必须使用 `npm run lint:src`：** Story 开发及 CR 修复的质量门禁验证必须使用 `npm run lint:src`（作用域：`src/` + `tests/`），而非 `npm run lint`（全仓，包含外部 AI 工具目录等非发布产物）。Dev Agent Record 中声称 "lint 通过" 时，必须注明执行的是 `npm run lint:src`。`npm run lint` 用于确认全仓无 Prettier 污染，在发布前和 `.prettierignore` 修改后执行。（来源：Story 5-5c CR TODO-016，Story 5-6 落地 `lint:src` 脚本）

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

Last Updated: 2026-04-01
