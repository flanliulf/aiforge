## Implementation Patterns & Consistency Rules

### Potential Conflict Points

AI agent 可能做出不同选择的 6 个关键领域：代码命名、模块组织、数据格式、错误处理、CLI 输出、测试策略。

### Naming Patterns

**文件命名：** kebab-case

```
✅ resolve-source.ts, detect-tools.ts, install-rules.ts
❌ resolveSource.ts, DetectTools.ts, installRules.ts
```

**TypeScript 命名：**

- 接口/类型：PascalCase，不加 `I` 前缀（`SourceResolver` 而非 `ISourceResolver`）
- 函数/变量：camelCase（`loadRules()`、`ruleIndex`）
- 常量：UPPER_SNAKE_CASE（`BUILTIN_RULES`、`DEFAULT_EXCLUDES`）
- 枚举值：PascalCase（`InstallType.Files`、`Severity.Fatal`）

**字符串联合类型 vs enum 选型规则：**

- 当值域小（2-3 个值）、值本身是有意义的字符串、且需要与外部数据（JSON/YAML/manifest）序列化交互时，优先使用**字符串字面量联合类型**（如 `'global' | 'project'`）——零运行时开销、JSON 直接可用
- 当值域作为引擎核心概念需要命名空间组织、或需要反向映射时，使用 **enum**（如 `InstallType.Files`）
- **关键约束：** `data/` 模块有零运行时依赖要求，引用 enum 会产生运行时 import，因此 data/ 内使用 `import type` + 字符串字面量断言（`'Files' as InstallType`）来避免运行时依赖

**导出模式：** 命名导出，不用默认导出（**仅约束业务代码**；工具配置文件如 `tsup.config.ts`、`vitest.config.ts` 使用工具官方 API 的 `export default defineConfig(...)` 形式，豁免此规则）

```typescript
✅ export function loadRules(): InstallRule[] { ... }
✅ export class AiforgeError extends Error { ... }
❌ export default function loadRules() { ... }
// 豁免：tsup.config.ts / vitest.config.ts 等工具配置文件
```

### Structure Patterns

**测试组织：** `tests/` 镜像 `src/` 结构

```
src/stages/clone.ts       → tests/stages/clone.test.ts
src/core/errors.ts        → tests/core/errors.test.ts
src/services/manifest.ts  → tests/services/manifest.test.ts
```

**模块导出：** 每个目录可选 `index.ts` 作为公共 API 入口

```typescript
// src/core/index.ts — 只导出公共接口
export { AiforgeError } from './errors.js';
export { type Reporter } from './reporter.js';
export { type PathResolver } from './path-resolver.js';
export type { ResolvedSource, InstallResult, MatchedPlan } from './types.js';
```

**ESM 导入路径：** 必须带 `.js` 扩展名

```typescript
✅ import { loadRules } from './data/install-rules.js';
❌ import { loadRules } from './data/install-rules';
```

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

```bash
# 示例：Story 5-5a i18n 影响面扫描
grep -rn "console\.log\|硬编码中文" src/ --include="*.ts"
# 结果按目录分组：
# core/  — messages.ts: 改动（新增 msg() 函数）
# data/  — messages.ts: 改动（迁移消息键到 core/）
# stages/ — 6 个文件: 改动（reporter 调用点接入 msg()）
# services/ — fs-utils.ts: 改动（7 个函数 14 条 fix 消息）
# commands/ — init.ts: 改动（子命令独立 setLanguage）
```

> 来源：Epic 5 Retrospective — Story 5-5a（i18n）经历 6 轮 CR，根因是横切关注点影响面跨 10 个生产代码文件，传统线性执行模式不适配，每轮 CR 逐个发现遗漏。

### Recovery/Fallback Path Patterns（恢复/回退路径模式）

**恢复/回退路径必须与主路径的匹配空间语义对齐：**

当功能包含"正常执行路径"和"恢复/回退/重试路径"两条执行链时，恢复路径的候选空间必须是主路径匹配空间的超集或等集，不能更窄。

```typescript
❌ // 恢复路径使用不同的扫描函数，候选空间比主路径更窄
   const candidates = scanAvailableTopDirs(repoDir) // 只返回目录名
   // 主路径匹配 basename（含文件），恢复路径候选仅含目录 → 语义不一致

✅ // 恢复路径复用主路径的扫描逻辑，按类型区分
   const candidates = rules.flatMap(rule =>
     scanSourceFiles(rule.sourceDir, rule.type) // 与主路径一致
       .map(entry => `${rule.sourceDir}/${entry.name}`)
   )
```

禁止在恢复路径中引入主路径没有的额外过滤条件。特别注意：当主路径在核心匹配循环之后还有**追加步骤**（如追加通用规则、附加默认配置等），恢复路径也必须包含等效的追加步骤——自查时不仅要比较"收集循环"的语义一致性，还要检查"循环后的追加逻辑"是否被一并复制。

实现恢复路径后，必须自查："主路径能匹配到的项，恢复路径的候选列表中是否都包含？"

> 来源：Story 6-2 CR R1 — 3/5 条发现均源于恢复路径与主路径语义不一致；Story 6-3 CR R1-#4 — 交互恢复路径只重建了 RULE_INDEX 循环，遗漏了主路径循环后的 UNIVERSAL_RULES 追加步骤，导致通用目录静默漏装。

**恢复/重试路径必须包含二次成功校验：**

每次恢复/重试后，必须对结果执行与首次尝试相同的成功条件校验。禁止假设"用户做了选择 → 重试一定成功"。

```typescript
❌ // 重试后直接返回，可能为空
   const retryItems = retryMatch(userSelection)
   return { items: retryItems } // 可能为空，用户无提示

✅ // 重试后重新校验
   const retryItems = retryMatch(userSelection)
   if (retryItems.length === 0) {
     throw new AiforgeError(msg('filter.noMatch'), ...)
   }
   return { items: retryItems }
```

> 来源：Story 6-2 CR R1 — TTY 零匹配恢复后未二次检查 items 是否仍为空，静默返回空计划。

### Story Scope Discipline（Story 作用域纪律）

**Story 作用域内的行为变更不得超出 AC 定义：**

禁止将仅适用于新功能路径的守卫/优化"提升"为全局行为，除非 AC 明确要求。新增的代码守卫条件必须精确限定在 Story 功能的作用域内。

```typescript
❌ // 守卫条件无条件生效，影响非 Story 路径
   if (sourceFiles.length === 0) continue  // 所有场景都跳过，回归既有语义

✅ // 守卫条件限定在 Story 功能作用域内
   if (args.filter && sourceFiles.length === 0) continue  // 仅 --filter 路径跳过
```

**修改既有测试必须证明为合法适配：**

修改任何既有测试时，必须回答："该测试原本保护的行为是否应当被变更？"——如果答案是"否"，则旧测试应保持原样作为回归保护，新行为需要在不破坏旧行为的前提下实现。

> 来源：Story 6-2 CR R1 — 空 item 守卫被提升为通用行为，超出 AC 要求，且 8 个既有测试被改写吸收回归而非保护回归。

<!-- PATTERNS_APPEND_1 -->

### Pipeline Stage Patterns

**新 stage 必须遵循 Reporter 生命周期契约：**

每个管道 stage 必须完成 `reporter.startPhase()` → `reporter.completePhase()` 的配对调用。`TtyReporter.startPhase()` 启动 ora spinner，`completePhase()` 调用 `succeed()` 并清空 spinner——漏调 `completePhase()` 会导致 spinner 状态泄漏。

```typescript
✅ // 成功路径闭合 phase 生命周期
   export async function executeInstall(plan, args, reporter, pathResolver) {
     reporter.startPhase('执行安装...')
     // ... 执行安装逻辑 ...
     reporter.completePhase()  // ← 成功路径必须调用
     return { items: resultItems }
   }

❌ // 成功路径缺少 completePhase()，spinner 状态泄漏
   export async function executeInstall(plan, args, reporter, pathResolver) {
     reporter.startPhase('执行安装...')
     // ... 执行安装逻辑 ...
     return { items: resultItems }  // ← spinner 未关闭
   }
```

实现新 stage 时，必须对照至少一个已有 stage（如 `detect-tools.ts`、`match-rules.ts`）确认 Reporter 调用模式一致性。异常路径由管道编排层处理，stage 不需自行调用 `completePhase()`。

> 来源：Story 4-2 CR R4 — `executeInstall()` 成功路径未调用 `completePhase()`，而其他 3 个 stage 均已正确配对。

**跨阶段数据契约边界值必须显式处理：**

当上游 stage 的输出可能包含边界值（如 `matchRules` 产出 `sourceFiles = []` 的 item）时，下游 stage 必须显式处理该边界值并在注释中说明语义。禁止假设上游输出"总是非空"。

```typescript
✅ // 显式处理空 sourceFiles 的边界值
   for (const item of plan.items) {
     // 空 sourceFiles = 源目录不存在，静默跳过（CR R4-#1）
     if (item.sourceFiles.length === 0) continue

     await ensureDir(item.targetPath)
     for (const srcPath of item.sourceFiles) { ... }
   }

❌ // 假设所有 item 都有内容，空 item 会创建无用目录
   for (const item of plan.items) {
     await ensureDir(item.targetPath)  // ← 空 item 也会执行
     for (const srcPath of item.sourceFiles) { ... }  // 循环不执行，但目录已创建
   }
```

> 来源：Story 4-2 CR R4 — `matchRules` 产出 `sourceFiles = []` 的 item，`executeInstall` 未跳过，导致空 item 创建无用目录甚至 fail-fast。

### Type Semantic Layers（类型语义分层）

**`AuthMethod` 类型区分两个语义层：**

- 运行时认证方式（`AuthenticatedSource.authMethod`）：`'ssh' | 'token' | 'credential-manager'`
- 持久化配置（`AiforgeConfig.auth[host].method`）：仅 `'ssh' | 'token'`

不要直接复用运行时类型到持久化接口，应使用内联字面量类型收窄。同理适用于其他存在运行时/持久化语义差异的类型。

### Data Format Patterns

**JSON 文件字段命名：** camelCase（与 TypeScript 接口一致）

```json
✅ { "defaultRepo": "...", "cloneDir": "...", "preferSSH": true }
❌ { "default_repo": "...", "clone_dir": "...", "prefer_ssh": true }
```

**日期格式：** ISO 8601 字符串

```typescript
✅ installedAt: "2026-03-12T10:30:00Z"
❌ installedAt: 1741776600
```

### Error Handling Patterns

**何时抛 AiforgeError：**

- 管道阶段内部遇到可预期的业务错误 → 抛 `AiforgeError`
- 不可预期的系统错误（如 fs 权限）→ 包装为 `AiforgeError` 后抛出
- 绝不吞掉错误或返回 null 代替错误

**catch 块必须区分错误类型：**

- 禁止使用 `catch {}` 或 `catch { /* ignore */ }`
- 如需对特定错误降级，必须使用以下模式：

```typescript
✅ catch (error) {
     if (error instanceof AiforgeError && error.code === 'CONFIG_NOT_FOUND') {
       // 仅此错误码降级为无默认配置，注释说明理由
     } else {
       throw error  // 默认行为：透传
     }
   }
❌ catch {}
❌ catch { /* ignore */ }
```

- 默认行为是 `throw`（透传），降级是例外且必须在注释中说明理由

**catch 降级必须逐码白名单：**

- 禁止创建辅助函数（如 `isConfigError()`）将多个错误码归类后批量降级
- 每个被降级的错误码必须逐个 `error.code === 'XXX'` 匹配，并在注释中单独说明降级理由
- 如需对新错误码降级，逐码新增 `||` 条件并附带独立注释

```typescript
✅ catch (error) {
     if (error instanceof AiforgeError && error.code === 'CONFIG_NOT_FOUND') {
       // 配置不存在 = 首次使用，降级到系统凭据合理
     } else {
       throw error
     }
   }

❌ // 辅助函数批量归类，掩盖了不该降级的错误
   function isConfigError(code: string): boolean {
     return code === 'CONFIG_NOT_FOUND' || code === 'CONFIG_CORRUPT' || code === 'CONFIG_READ_FAILED'
   }
   catch (error) {
     if (error instanceof AiforgeError && isConfigError(error.code)) { ... }
   }
```

> 来源：Story 2-3 CR — `isConfigError()` 将三种错误码统一降级，`CONFIG_CORRUPT` 被静默吞掉，掩盖了配置损坏的真实根因。

**fs 存在性检查必须使用 ENOENT/ENOTDIR 白名单降级：**

使用 `fs.access()` / `fs.stat()` 判断文件/目录是否存在时，禁止 `catch { return false }` 无差别降级。

```typescript
✅ async function dirExists(path: string): Promise<boolean> {
     try {
       await access(path)
       return true
     } catch (error) {
       if (error instanceof Error && 'code' in error &&
           (error.code === 'ENOENT' || error.code === 'ENOTDIR')) {
         return false  // 不存在 / 路径组件非目录：正常
       }
       throw error  // EACCES 权限拒绝、EIO 等：必须向上抛出
     }
   }

❌ async function dirExists(path: string): Promise<boolean> {
     try { await access(path); return true }
     catch { return false }  // 权限拒绝也被误判为"不存在"
   }
```

> 来源：Story 2-4 CR — `hasLocalRepo()` 和 `dirExists()` 各出现一次同样问题，3 轮 CR 才彻底收敛。

**CR 修复引入的新代码必须贯彻同等规则标准：**

修复 A 函数的问题时若新增了 B 辅助函数，B 必须遵循与 A 相同的规则。修复者提交前应自查：新增的每个函数/分支是否与项目规则一致。

```typescript
❌ // 修复 hasLocalRepo() 的 catch {} 问题，但新增的 dirExists() 又用了 catch {}
   // → 被下一轮 CR 发现，多浪费一轮审查
```

> 来源：Story 2-4 CR Round 2 — 修复 `hasLocalRepo()` 时新增 `dirExists()`，重复了同样的 `catch {}` 错误。

**CR 修复必须审查同一函数中所有并行分支：**

修复某个函数的特定分支时，必须审查同一函数中所有并行分支是否存在同类问题，并在修复记录中逐分支列出审查结论（"该分支是否需要同等修复？"→ 是/否 + 理由）。禁止只修复被 CR 指出的具体分支而不审查并行分支——这是导致"修复引入对称性回归"的主要原因。

```typescript
✅ // 修复 targetStat === null 分支的 realpath 校验后，审查所有并行分支：
   // - isDirectory() 分支：需要同等修复 → 已补 validateAncestorRealpath()
   // - isSymbolicLink() 分支：需要同等修复 → 已补 validateAncestorRealpath()
   // - else (普通文件) 分支：不需要 → 普通文件无 symlink 跟随问题

❌ // 只修复被 CR 指出的 targetStat === null 分支
   // → 下一轮 CR 发现 isSymbolicLink() 分支同样缺少校验，P0 问题延续
```

> 来源：Story 4-1 CR — Round 3 修复 symlink 逃逸仅在 `targetStat === null` 分支添加 realpath 校验，遗漏 `isSymbolicLink()` 和 `isDirectory()` 分支，导致 P0 安全问题延续到 Round 4 才关闭。

**新增错误处理分支必须全功能对标同函数内已有并行分支：**

在 catch 块或同一函数中新增错误处理分支时，**禁止只实现核心字段（message/why/code）而忽略辅助功能字段**。必须找到同函数中已有的同类分支，逐字段对比，确保新分支在行为上与已有分支完全对等（如 cleanupWarning 透传、额外上下文追加等）。

```typescript
✅ // 新增 AUTH_FAILED 分支时，比对 CLONE_FAILED 分支的完整 fix 构建逻辑
   if (isAuthFailure) {
     throw new AiforgeError('无法访问仓库', 'AUTH_FAILED', EXIT_AUTH_FAILURE, 'fatal',
       `Git 服务器返回 401（认证失败）`,
       [
         ...(cleanupWarning   // ← 与 CLONE_FAILED 分支对齐，不能遗漏
           ? [`⚠️ 清理未完成目录也失败: ${cleanupWarning}，请手动删除: rm -rf ${targetDir}`]
           : []),
         'npx aiforge --ssh',
         'npx aiforge --token <your-token>',
         'npx aiforge init',
       ]
     )
   }

❌ // 新增 AUTH_FAILED 时只实现核心字段，忽略 cleanupWarning 透传
   if (isAuthFailure) {
     throw new AiforgeError('无法访问仓库', 'AUTH_FAILED', EXIT_AUTH_FAILURE, 'fatal',
       `Git 服务器返回 401（认证失败）`,
       ['npx aiforge --ssh', 'npx aiforge --token <your-token>', 'npx aiforge init']
       // ← 缺少 cleanupWarning 透传：认证失败+清理失败时用户收不到手动删除提示
     )
   }
```

> 来源：Story 5-4 CR Round 2 — 新增 `AUTH_FAILED` 分支时未复制 `CLONE_FAILED` 分支的 cleanupWarning 透传逻辑，导致"认证失败 + 清理也失败"时用户看不到手动删除残留目录的提示。

**复用函数接入新类型时必须审查内部所有分支的类型兼容性：**

当一个已有函数（如 `processConflict()`）被新的调用方类型（如从仅 files 扩展到 directories）复用时，必须逐条审查该函数内部所有执行分支对新类型的兼容性。

```typescript
✅ // processConflict() 被 Directories 分支复用前，审查所有 case：
   // - case 'backup'：backupFile() 不支持目录 → 需新增 backupDir() 分发
   // - case 'skip'：返回 'skip'，通用 → 兼容
   // - case 'overwrite'：返回 'proceed'，通用 → 兼容
   case 'backup': {
     const destStat = await stat(destPath)
     if (destStat.isDirectory()) {
       await backupDir(destPath)   // ← 目录级备份
     } else {
       await backupFile(destPath)  // ← 文件级备份（原逻辑）
     }
     return 'proceed'
   }

❌ // 直接复用，未审查 backup 分支对目录的兼容性
   case 'backup':
     await backupFile(destPath)  // ← 传入目录路径，EISDIR 崩溃
     return 'proceed'
```

自查清单：对被复用函数的每个 `case`/`if` 分支，逐条回答"在新类型下是否安全/正确？"——(1) 函数内部调用的子函数是否支持新类型；(2) 交互式选项是否在新类型下全部有意义；(3) 类型判断和分发逻辑是否需要适配。

> 来源：Story 4-5 CR — R1 Directories 未接入冲突检测 + R2 修复后目录冲突 backup 走文件级 API `backupFile()` 崩溃，2 轮才收敛。

**跨层共享字段禁止语义扩展——新语义必须用新字段：**

当一个字段（如 `mode`）被多个模块/阶段消费时，禁止通过扩展该字段的值域来承载新语义。新语义必须使用新字段或独立映射。修改字段类型定义前，必须列出该字段的所有消费方（grep 所有引用），逐个回答"新增的值在该消费方是否有意义/安全？"——如果任何一个消费方的分支逻辑不处理新值，则不能扩展原字段。

```typescript
❌ // MatchedPlan.mode 原本只有 'copy' | 'symlink'，为了 manifest 写入 'flatten' 而直接扩展
   // → executeInstall() 中 if (mode === 'symlink') 不处理 'flatten'，Flatten + --link 回归
   mode: 'copy' | 'symlink' | 'flatten'  // 语义冲突：安装方式 vs 规则类型

✅ // mode 只表示安装方式，manifest 写入时通过 rule.type 独立判断
   // MatchedPlan.mode: 'copy' | 'symlink'  ← 语义不变
   // pipeline saveManifest: mode = (ruleType === Flatten ? 'flatten' : planInfo.mode)
```

> 来源：Story 4-6a CR — R1 修复将 `MatchedPlan.mode` 从 `'copy' | 'symlink'` 扩展为三值，导致 `executeInstall()` 的 `if (mode === 'symlink')` 分支不处理 `'flatten'`，Flatten + --link 功能回归；需要 3 轮 CR 才收敛。

**CR 修复变更类型定义或函数签名时，必须全仓 grep 受影响引用并逐个评估，且必须在修复记录中提供搜索证据：**

CR 修复中如果修改了类型定义（interface/type/enum 的字段增删改）或函数签名（参数增减、返回类型变更），修复者必须执行全仓 grep，列出所有受影响的引用点，并在修复记录中**附上搜索命令及其输出**，逐个标注"该引用是否兼容变更？"→ 是/否 + 理由。禁止只修复 CR 指出的具体文件而不做全仓搜索——这是导致"同类问题跨多轮 CR 反复出现"的直接原因。

```bash
✅ # 修复记录中必须包含搜索证据
   grep -rn "InstallResult" tests/ src/ --include="*.ts"
   # 结果：
   # - tests/pipeline.test.ts:174 — ✅ 已包含 tool 字段
   # - tests/integration/pipeline.test.ts:98 — ❌ 缺失 tool，本次修复
   # - tests/core/types.test.ts:96 — ❌ 缺失 tool，本次修复
   # - tests/services/manifest.test.ts:324 — ✅ 不涉及（tool 作为独立参数传入）

❌ # 只修复 CR 指出的具体文件，不做全仓搜索
   # → 下一轮 CR 发现其他文件也缺失同样字段
```

> 来源：Story 4-6a CR — R1 修复变更了 `MatchedPlan.mode` 类型，但未评估 `executeInstall()` 和 `reporter` 中的 `.mode` 引用，导致 R2 发现功能回归；Story 4-6b CR — `InstallResult.tool` 字段全仓同步遗漏贯穿 R1→R5 共 4 轮 CR，每轮只修复被指出的文件而非全仓扫清。

**新增 AiforgeError 错误码必须同步补负向测试：**

新增 `try/catch` + `throw new AiforgeError(NEW_CODE)` 的错误处理分支时，必须同步补至少 1 条负向测试。

```typescript
✅ // 源码新增了 SANITIZE_REMOTE_FAILED
   // 同时补测试：
   it('remote set-url 失败时抛出 SANITIZE_REMOTE_FAILED', async () => {
     mockGit.remote.mockRejectedValue(new Error('git error'))
     await expect(cloneRepo(...)).rejects.toMatchObject({
       code: 'SANITIZE_REMOTE_FAILED', severity: 'fatal'
     })
   })

❌ // 新增了错误码但没补测试 → 后续重构可能无感知回退为 raw Error
```

> 来源：Story 2-4 CR Round 2 — Round 1 修复新增 `SANITIZE_REMOTE_FAILED`/`SCAN_FAILED` 但无测试。

**错误码测试必须覆盖"真实生产创建链路"，禁止在 Reporter 层手工构造错误对象伪造 AC 满足：**

为新错误码编写测试时，必须从该错误码的**真实创建模块**（如 `clone.ts`、`detect-tools.ts`、`fs-utils.ts`）的入口触发，断言最终抛出的 `AiforgeError.code` 和关键字段值。禁止"在 reporter 测试中手工 `new AiforgeError('...', 'NEW_CODE')` 构造错误对象"——这只证明 Reporter 能渲染该类型的错误，不能证明生产代码会在正确时机创建该错误。

```typescript
✅ // 从真实创建模块入口触发，断言生产链路
   it('clone 认证失败（401）时抛出 AUTH_FAILED', async () => {
     mockGit.clone.mockRejectedValue(new Error('Authentication failed for https://...'))
     await expect(freshClone(source, targetDir)).rejects.toMatchObject({
       code: 'AUTH_FAILED',
       message: '无法访问仓库',
       severity: 'fatal',
     })
   })

❌ // 在 reporter 测试中手工构造错误对象 — 只验证渲染，不验证生产链路
   it('AUTH_FAILED 错误渲染正确', async () => {
     const error = new AiforgeError('无法访问仓库', 'AUTH_FAILED', ...)  // ← 手工构造
     reporter.reportError(error)
     expect(output).toContain('无法访问仓库')
     // ← 即使 clone.ts 从未创建 AUTH_FAILED，此测试也会通过
   })
```

> 来源：Story 5-4 CR Round 1 — `AUTH_FAILED` 只存在于 reporter 手工构造的单测中，生产代码 `clone.ts` 根本不存在创建该错误的链路，全仓测试全绿但真实认证失败仍输出 `CLONE_FAILED`。

**错误创建模式：**

`exitCode` 使用类型级约束 `type ExitCode = 0 | 1 | 2 | 3`，不接受任意 `number`。

```typescript
✅ throw new AiforgeError({
     code: 'AUTH_FAILED',
     exitCode: 2,
     severity: 'fatal',
     message: '无法访问仓库',
     why: 'Git 服务器返回 401（认证失败）',
     fix: ['npx aiforge --ssh', 'npx aiforge --token <your-token>']
   });
❌ throw new Error('auth failed');
```

### CLI Output Patterns

**进度阶段命名：** 动词 + 宾语，中文

```
✅ "解析仓库地址..." / "验证认证信息..." / "克隆仓库..."
❌ "Resolving..." / "Step 1..." / "正在处理中..."
```

**结果状态图标：**

```
✅ 新建成功    🔄 更新    ⏭️ 跳过（已是最新）
```

**统计行格式：**

```
安装: 7 项  更新: 1 项  跳过: 1 项
```

**TTY 结果着色双重语义（Updated 2026-04-24）：**

明细行按状态着色，汇总数字另用差异化色彩：

| 元素 | 颜色 | 说明 |
|------|------|------|
| 明细行 `new` | `chalk.green` | 新建成功 |
| 明细行 `updated` | `chalk.blue` | 更新成功 |
| 明细行 `skipped` | `chalk.green` | **跳过视为成功结果，与 new 同色** |
| 折叠摘要 / 底部统计 `安装: N 项` | `chalk.green` | |
| 折叠摘要 / 底部统计 `更新: N 项` | `chalk.blue` | |
| 折叠摘要 / 底部统计 `跳过: N 项` | `chalk.yellow` | **数字层面差异化，提示「需要关注的非新增量」** |

禁止将明细行 skipped 着为 `chalk.gray` 或 `chalk.yellow`——会被误读为告警/被忽略状态。

> 来源：Story 5-2 + Install UX 收敛（2026-04-24）。原 Story 5-2 规则为「明细行 skipped = chalk.gray」，UX 收敛中先改为 yellow（与 warn 同色，造成混淆）后定为 green（与 new 同色，体现成功语义）。

**TTY 结果折叠阈值（Updated 2026-04-24）：**

常量：`MAX_TTY_RESULT_DETAILS_PER_TOOL = 5`（位于 `src/core/reporter.ts`）

分组规则：按「工具 → 本地安装根目录」二级分组（`targetGroupLabel` / `targetGroupPath`），每组超 5 条明细折叠：

```
🔧 Claude Code (273 项)
  📁 .claude/skills/ (273 项)
    ├── ⏭️ skills/tapd/.DS_Store → ...
    ├── ⏭️ skills/tapd/SKILL.md → ...
    ├── ⏭️ skills/tapd/...
    ├── ⏭️ skills/tapd/...
    └── ⏭️ skills/tapd/...
    └── … 其余 268 项已折叠 (安装: 0 项 / 更新: 0 项 / 跳过: 268 项)
```

> 来源：Install UX 收敛（2026-04-24）。原阈值经历 12→10→5 三次调整，最终 5 项可见 + 折叠摘要被验证为单屏可读最优值。

**零结果诊断双分支（Updated 2026-04-24）：**

`executeInstall()` 完成后必须判定两类零结果场景，选择不同的输出通道：

```typescript
const hasActualInstall = resultItems.some(
  (item) => item.status === 'new' || item.status === 'updated',
)

if (!hasActualInstall && resultItems.length > 0) {
  // 分支 1：全部跳过 → 成功路径
  reporter.completePhase(chalk.gray(msg('executeInstall.skippedOnlySummary')))
  return { items: resultItems }
}

// 分支 2：真·零结果（resultItems.length === 0）→ 诊断警告
diagnoseZeroResults(plan, resultItems, reporter)
reporter.completePhase()
```

| 分支 | 触发条件 | 输出通道 | 输出文案 |
|------|---------|---------|---------|
| **全部跳过** | `resultItems.length > 0` 且无 `new`/`updated` | `reporter.completePhase()` 成功摘要（灰色） | `没有新增/更新文件，全部已是最新或被跳过` |
| **真·零结果** | `resultItems.length === 0` | `reporter.warn()` 诊断（4 级颜色层级：warning/header/detail/suggestion） | 扫描目录 + 匹配规则（超 5 条折叠为「… 其余 N 项已折叠」）+ 分类建议（`noInstallSources` / `emptyDirectories`） |

**关键约束：**
- 真·零结果的修复建议**禁止包含 `--force`**——`--force` 解决冲突而非「找不到源」
- `ZERO_RESULT_DIAG_DETAIL_THRESHOLD = 5`（位于 `src/stages/execute-install.ts`），扫描目录与匹配规则列表超 5 条均折叠
- TTY warn 输出使用 4 级颜色层级（`formatTtyWarnMessage`）：主警告=yellow、章节头=bold.cyan、明细=gray、修复建议=cyan

> 来源：Install UX 收敛（2026-04-24）。原 Story 4.5 设计为「全部 skipped 也触发零结果诊断」，UX 实测时该分支误导用户（用户已主动选 skip，再触发 warn 显得系统不理解用户意图）；改为「全部 skipped 走成功路径，仅真·零结果触发 warn」后语义自洽。

**输出字符串集中管理：** 所有用户可见字符串统一通过 `src/core/messages.ts` 的 `msg()` 函数获取（Story 5-5a 将 `data/messages.ts` 迁移至 `core/messages.ts`，`data/messages.ts` 现为向后兼容 re-export 垫片）。

**CLI help 文案不做国际化：** Commander `.description()` / `.option()` 描述统一使用英文硬编码，不通过 `msg()` 动态获取——Commander 在模块加载时求值 description，此时 `currentLanguage` 始终为默认值，动态获取无效。

```typescript
✅ command.description('Initialize aiforge configuration')  // 英文硬编码

❌ command.description(msg('init.descInit') || 'Initialize aiforge configuration')
// → msg() 模块加载时求值，currentLanguage = 'zh-CN'，fallback 永远不生效
```

> 来源：Story 5-5a CR R2 评估 — `.description(msg('init.descInit') || ...)` fallback 因 `msg()` 返回非空中文而永远不生效。

**i18n 字符串覆盖完整性：** 实现多语言输出时，`AiforgeError.fix[]`、`reporter.warn()` 文案、Reporter 量词/标签（如 `(N 项)`）、诊断输出（如 `emitDiagnostics`）与 `message`/`why` 字段具有**同等用户可见性**，必须全部接入 `msg()`。

自查清单（实现完成后逐项确认）：

| # | 检查项 | 说明 |
|---|--------|------|
| 1 | `AiforgeError.fix[]` 数组 | 错误修复建议通过 Reporter FIX 行展示给用户 |
| 2 | `reporter.warn()` 所有调用点 | 运行时警告文案 |
| 3 | Reporter 量词/标签（如 `(${n} 项)`） | 使用 `msg()` 模板键，支持 `{count} 项` / `{count} items` |
| 4 | 诊断输出（如 `emitDiagnostics`） | 工具检测失败时的建议文案 |
| 5 | CLI help 文案 | 英文硬编码，不接入国际化 |

```typescript
✅ // fix[] 数组全部接入 msg()
   throw new AiforgeError('克隆失败', 'CLONE_FAILED', ..., msg('clone.cloneFailedWhy'), [
     msg('clone.fixCheckNetwork'),
     msg('clone.fixCheckAuth'),
   ])

❌ // fix[] 数组硬编码中文，message/why 已国际化但 fix 遗漏
   throw new AiforgeError('克隆失败', 'CLONE_FAILED', ..., msg('clone.cloneFailedWhy'), [
     '检查网络连接',   // ← 英文模式下仍输出中文
     '检查认证信息',
   ])
```

> 来源：Story 5-5a CR R2~R5 — 每轮修复后仍被发现新的中文残留，均属 fix[]/warn/量词分层遗漏模式；经 5 轮才完全收口。

**子命令独立语言初始化：** 具有独立 `action()` handler 的子命令（如 `aiforge init`）不走主管道的语言预加载路径。子命令 handler 必须在 `loadConfig()` 成功后、首次用户可见输出之前，独立调用 `setLanguage()`。

```typescript
✅ async function runInit() {
     let existingConfig
     try {
       existingConfig = await loadConfig(...)
       setLanguage(existingConfig.language ?? 'zh-CN')  // ← 在输出前预加载
       console.log(msg('init.currentConfig'))            // ← 此时语言已正确
     } catch { ... }
   }

❌ // 依赖 index.ts 的全局 setLanguage() — init 子命令路径下不执行
   // config.language = 'en' 时，init 仍先以中文输出配置摘要
```

> 来源：Story 5-5a CR R2 — `init` 子命令有独立 `action()`，不经过 `index.ts` 语言预加载路径，导致已有 `config.language = 'en'` 时仍先输出中文。

**进度计数变量的分子/分母必须绑定到同一语义单元：**

实现 `processedCount / totalFiles` 类进度显示时，必须在代码注释中明确"进度单位"语义，并确保所有"已处理的终态"统一推进分子计数。

```typescript
✅ // 进度单位 = "已处理的 source item 数量"（与 status 值无关）
   // 所有终态分支（new / updated / skipped / conflictAction==='skip' / warn+skip）均推进计数
   processedCount++
   reporter.updatePhase(`执行安装... (${processedCount}/${totalFiles})`)
   resultItems.push({ status: 'skipped', ... })
   continue  // ← processedCount++ 必须在 continue 之前

❌ // 分子只统计"实际执行 I/O 的项目"，分母却统计"所有计划项"
   // → skipped 终态不推进，进度永远到不了总数，用户误以为还有文件未处理
   if (status !== 'skipped') {
     await copyFile(...)
     processedCount++  // ← 只在非 skipped 时递增
   }
   resultItems.push({ status, ... })
```

> 来源：Story 5-1 CR R1 — 3 类 skipped 终态（hash 相同/冲突跳过/flatten 主文件缺失）均未推进计数，进度显示在 `(1/3)` 后直接结束，用户体验失真。

**输出通道与 TTY 能力判定必须绑定到同一 fd：**

当功能模块将输出定向到特定 fd（如 `process.stderr`）时，判定该 fd 的终端能力（如 `isTTY`、颜色支持）必须使用**同一个 fd** 的属性，禁止混用其他 fd 的属性。

```typescript
✅ // spinner 用 stderr 输出 → TTY 判定用 stderr.isTTY
   createReporter({
     quiet: args.quiet,
     isTty: process.stderr.isTTY === true,  // ← 与 ora({ stream: process.stderr }) 同一 fd
   })

❌ // spinner 用 stderr 输出，但 TTY 判定却用 stdout.isTTY
   createReporter({
     quiet: args.quiet,
     isTty: process.stdout.isTTY === true,  // ← fd 不一致
   })
   // → aiforge ... > result.txt 时，stderr 仍在终端但 spinner 被错误禁用
   // → aiforge ... | cmd 时，用户在终端看不到 spinner 动画
```

> 来源：Story 5-1 CR R1 — `TtyReporter` 内部 `ora({ stream: process.stderr })`，但入口层使用 `process.stdout.isTTY`；在 stdout 被重定向但 stderr 仍在终端的场景下，spinner 意外退化为 PlainReporter。

**PlainReporter 输出方法内所有行必须遵从同一分隔符契约：**

当方法要求"制表符分隔输出"时，该方法内的**所有** `stdout.write()` 调用（含明细行、统计行、汇总行）均须使用 `\t` 分隔，不能只修改主数据行而遗漏统计行或汇总行。实现完成后必须横向比对方法内全部输出行，逐行确认分隔符一致性；同一 Reporter 类中多个输出方法（`reportResult()` / `reportPlan()`）的分隔规则也必须相互对齐。

```typescript
✅ // reportResult() — 明细行和统计行均使用 \t 分隔
   process.stdout.write(`${item.status}\t${tool}\t${item.sourcePath}\t${item.targetPath}\n`)
   // ... 统计行同样 \t 分隔
   process.stdout.write(`---\ninstalled: ${installed}\tupdated: ${updated}\tskipped: ${skipped}\n`)

❌ // 明细行已修复为 \t，统计行仍遗留双空格 — 同一方法两套分隔规则
   process.stdout.write(`${item.status}\t${tool}\t${item.sourcePath}\t${item.targetPath}\n`)
   process.stdout.write(`---\ninstalled: ${installed}  updated: ${updated}  skipped: ${skipped}\n`)
   // → 调用方 awk -F '\t' 解析统计行时，整行退化为单字段
```

> 来源：Story 5-3 CR R1 — `reportPlan()` 主数据行用双空格而非 `\t`；CR R2 — `reportResult()` 明细行已用 `\t` 但统计行仍用双空格，同一方法内两套分隔规则，两轮 CR 才全部收口。

**v2.0 工具注册表变更（Story 7-1）：**

- `TOOL_DEFINITIONS`：4 工具 → 3 工具（移除 `vscode`，保留 `copilot | claude | cursor`）
- `BUILTIN_RULES`：16 条 → 19 条（+4 新规则，-1 vscode 规则）
  - 新增：claude 全局 instructions（`~/.claude/`）
  - 新增：claude 项目 instructions（`.claude/`）
  - 新增：cursor 全局 agents（`~/.cursor/rules/`）
  - 新增：copilot 项目 mcp-tools → `.vscode/`（承接原 vscode 项目级 MCP 语义）
  - 删除：vscode 全局 mcp（`~/.vscode/`）
- 新增/删除工具只修改 `src/data/tool-registry.ts` + `src/data/install-rules.ts`，引擎层（`src/stages/`）零改动（NFR-I5）

**删除工具时必须提供一次性 migration 提示（vscodeMergedNote 模式）：**

当工具从注册表删除时，若用户环境仍存在该工具的历史标志路径（如 `~/.vscode/`），必须在 `detect-tools.ts` 中通过 `reporter.warn()` 输出迁移提示。

```typescript
// detect-tools.ts：legacy 检测辅助函数 + warn 注入
async function detectLegacyVscodeOnly(pathResolver: PathResolver): Promise<boolean> {
  return (await pathExists(join(pathResolver.home(), '.vscode'))) &&
    !(await pathExists(join(pathResolver.home(), '.copilot')))
}

// 在自动检测分支：新工具未检测到时输出 warn（非阻断，绝不修改 detectedTools）
if (!detectedTools.includes('copilot') && await detectLegacyVscodeOnly(pathResolver)) {
  reporter.warn(msg('detectTools.vscodeMergedNote'))
}
```

约束：
- 提示**不阻断**安装流程（不 throw，不修改 `detectedTools` 数组）
- 绝不对历史工具目录执行任何读写操作（NFR-C7）
- 提示内容须包含：① 新工具承接路径说明；② 明确的用户操作步骤（如 `mkdir ~/.copilot/`）

**reserved-name 强制保护（claude:\*:instructions 专用）：**

`claude:*:instructions` 规则的安装路径对 7 个 Claude Code 保留文件执行硬拦截，`--force` 无效：

```typescript
// src/stages/execute-install.ts — 保留文件名集合（大小写不敏感比较）
const CLAUDE_RESERVED_NAMES = new Set([
  'claude.md', 'claude.local.md',
  'agents.md', 'agents.local.md',
  'settings.json', 'settings.local.json',
  '.claudeignore',
])

// 守卫应用于三种 InstallType（Files / Directories / Flatten）
const destName = basename(srcPath).toLocaleLowerCase('en-US')  // locale-locked
if (
  item.rule.tool === 'claude' &&
  item.rule.sourceDir === 'instructions' &&
  CLAUDE_RESERVED_NAMES.has(destName)
) {
  reporter.warn(msg('executeInstall.reservedSkipWarn', { targetDir: item.targetPath }))
  reservedSkipCount++
  continue  // 不执行任何文件 I/O
}
```

三种 `InstallType` **必须全部包含此守卫**，且执行顺序必须是：`validateDestPathSecurity` → **reserved-name 守卫** → `stat` / `copyFile`（安全校验先于守卫，防止路径穿越绕过）。

**全 reserved-skip 时 completePhase 语义必须区分：**

当本次安装的全部文件都被 reserved-name 拦截时，`completePhase` 使用黄色专属告警，而非灰色"已是最新"：

```typescript
if (!hasActualInstall && resultItems.length > 0) {
  if (reservedSkipCount > 0 && reservedSkipCount === processedCount) {
    // 全部被 Claude Code reserved-name 保护拦截 → 黄色告警
    reporter.completePhase(chalk.yellow(msg('executeInstall.reservedSkippedOnlySummary')))
  } else {
    // 正常 skip（内容相同 / 链接已存在）→ 灰色中性
    reporter.completePhase(chalk.gray(msg('executeInstall.skippedOnlySummary')))
  }
  return { items: resultItems }
}
```

| 场景 | `completePhase` 颜色 | 语义 |
|------|---------------------|------|
| 全部被 reserved 拦截 | `chalk.yellow` | 告警：未执行任何写入，需用户知晓 |
| 混合（reserved + 其他 skip） | `chalk.gray` | 中性：整体成功路径 |
| 全部已是最新 | `chalk.gray` | 中性：无新内容 |

> 来源：Story 7-1 CR R4 ID-3 — R3 修复采用方案 B（仅加聚合 warn），导致"全部被保护拦截"时仍输出灰色成功摘要，语义误导用户；R4 修复替换为方案 A（黄色专属 completePhase）。

<!-- PATTERNS_APPEND_2 -->

### Input Validation Patterns

**输入校验必须在归一化之后执行：**

正则/格式匹配只保证输入"在语法上有效"，不保证"在语义上有效"。所有关键校验（非空、格式合法性、范围约束）必须在标准化处理（如 `stripGitSuffix()`、`pathname.replace()`）之后执行。

```typescript
✅ const repoPath = stripGitSuffix(scpMatch[2]!)
   assertRepoPath(repoPath, url)  // 归一化之后校验
   return { hostname, repoPath, protocol: 'ssh' }

❌ // 仅依赖正则 .+ 保证非空，跳过归一化后校验
   return { hostname, repoPath: stripGitSuffix(scpMatch[2]!), protocol: 'ssh' }
```

**多分支校验一致性原则：**

当函数包含多个条件分支（如协议分发、URL 格式判断）时：

1. 新增任何校验逻辑必须审查**所有并行分支**是否需要同步应用
2. 优先将校验逻辑抽取为公共辅助函数，然后在所有分支中调用

```typescript
✅ // 三个分支统一调用 assertRepoPath()
   // ssh:// 分支
   assertRepoPath(repoPath, url)
   // SCP-style 分支
   assertRepoPath(repoPath, url)
   // HTTPS 分支
   assertRepoPath(repoPath, url)

❌ // 只在 HTTPS 和 ssh:// 分支加了校验，SCP-style 遗漏
```

**修复校验类 bug 时，验证约束不被扩大：**

- 修复是否意外扩大了输入的合法范围（如白名单新增了不该有的选项）
- 若修改涉及白名单/黑名单类逻辑，必须列出完整的预期接受/拒绝列表并逐条验证

```typescript
✅ // 修复 UNSUPPORTED_PROTOCOL 时，白名单仅保留 https:
   if (parsed.protocol !== 'https:') { throw ... }

❌ // 修复时无意中将 http: 也纳入白名单
   if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') { throw ... }
```

**可选 CLI 分叉选项的条件判断必须使用 `!== undefined`：**

当 CLI 选项触发命令行为分叉时，分叉条件必须使用严格的 `!== undefined` 判断，而非 truthy 判断。Commander 解析 `--list ""` 的结果为 `{ list: "", hasOwn: true }`——用户明确表达了操作意图，但值为空字符串。truthy 判断会将其误判为"未提供选项"，导致静默降级到默认流程，违反最小意外原则。

```typescript
✅ // 区分"选项未提供"与"选项已提供但值可能无效"
   if (args.list !== undefined) {
     await listContents(repo, args, reporter)  // listContents 内部负责值合法性校验
     return
   }

❌ // truthy 判断：--list "" 被误判为"未提供"，静默降级为安装流程
   if (args.list) {
     await listContents(repo, args, reporter)
     return
   }
   // → aiforge install repo-url --list ""  会触发安装而非报错
   // → CI 脚本 $DIR_VAR 为空时：--list "$DIR_VAR" 展开为 --list "" → 误安装
```

> 来源：Story 6-1 CR R2 — `pipeline.ts` 中 `if (args.list)` 导致 `--list ""` 跳过 list 分叉直接进入安装流程；修复为 `if (args.list !== undefined)` 后，空字符串进入分叉由 `listContents` 统一抛出 `LIST_INVALID_INPUT`。

**CLI 字符串参数（目录名/标识符类）必须同时执行三重防护校验：**

接受"目录名/文件名/标识符"类字符串的 CLI 选项，在函数入口必须同时校验三重防护。三重防护缺一不可——只防路径字符而遗漏空字符串会被迂回，只防空字符串而遗漏路径字符会被路径穿越利用。

```typescript
✅ // 三重防护一次性到位
   const val = args.list!  // 此处调用方已确保 list !== undefined
   if (
     !val.trim() ||              // 1. 空值防护：空字符串/纯空白字符串
     /[/\\]/.test(val) ||        // 2. 路径分隔符防护：防路径穿越（/ 或 \）
     val.startsWith('.')         // 3. 点号前缀防护：防 . / .. 相对引用
   ) {
     throw new AiforgeError(
       msg('list.invalidInput').replace('{dir}', val),
       'LIST_INVALID_INPUT',
       EXIT_ARG_ERROR, 'fatal',
       msg('list.invalidInputWhy'),
       [msg('list.fixUseSimpleName')],
     )
   }

❌ // 只防路径字符，遗漏空字符串
   if (/[/\\]/.test(args.list!) || args.list!.startsWith('.')) { ... }
   // → --list "" 被分叉条件 if (args.list) 过滤后，此校验永远不执行

❌ // 只防空字符串，遗漏路径字符
   if (!args.list!.trim()) { ... }
   // → --list "../.." 通过校验，直接 readdir('/repo/../..')，枚举系统根目录
```

**实现清单（三重防护自查）：**
1. `!val.trim()` — 空字符串和纯空白字符串被拒绝？
2. `/[/\\]/.test(val)` — 含 `/` 或 `\` 的路径被拒绝？
3. `val.startsWith('.')` — 以 `.` 开头（含 `.` 和 `..`）的路径被拒绝？
4. 对应的分叉条件是否使用了 `!== undefined` 而非 truthy？
5. 三种非法输入均有负向测试用例覆盖（确保 `readdir` 未被调用）？

> 来源：Story 6-1 CR R1 — 首轮修复 `list-contents.ts` 只添加了路径分隔符和点号前缀校验，遗漏空字符串；R2 发现 `--list ""` 因 truthy 分叉条件绕过校验后直接进入安装流程，需再次修复。两次修复等效于首轮一并实施三重防护——规则提炼自此教训。

### Security Patterns

**Token 脱敏规则：**

- token 长度 > 12：first 8 + `****` + last 4（如 `glpat-ab****mnop`）
- token 长度 <= 12：first 4 + `****`（无尾部）
- **边界验证：** 实现脱敏逻辑时，必须验证阈值边界处（token 长度恰好等于阈值）脱敏后不可逆推原文

**URL 脱敏规则：**

- `sanitizeUrl` 必须处理 GitLab 标准 `oauth2:token@host` 格式：`https://oauth2:${token}@host/repo.git`
- 脱敏时只处理冒号后的凭据部分，保留 `oauth2:` 前缀

**脱敏函数必须覆盖边界形态输入：**

- sanitizeToken/sanitizeUrl 的正则/匹配逻辑必须覆盖用户可能构造的边界形态输入（如不完整 URL、缺少 host 的 URL、尾部截断的 token）
- 新增任何 `AiforgeError` 的 `why` 字段时，检查是否包含用户原始输入——如果是，必须通过 sanitizeUrl/sanitizeToken 处理，不能有"漏调"

```typescript
✅ // 新增 AiforgeError 时，why 字段使用 sanitizeUrl
   throw new AiforgeError(
     '仓库地址缺少仓库路径',
     'INVALID_URL', EXIT_ARG_ERROR, 'fatal',
     `仓库地址缺少仓库路径: ${sanitizeUrl(url)}`,  // ← 脱敏
     [...]
   )

❌ // why 字段直接拼接原始 URL
   `仓库地址缺少仓库路径: ${url}`
```

**三种脱敏函数适用场景不可混用：**

| 函数 | 适用场景 | 实现特点 |
|------|---------|---------|
| `sanitizeToken()` | 独立 token 字符串 | 按长度截断+掩码 |
| `sanitizeUrl()` | 纯 URL 字符串 | 带 `^` 锚点正则，仅匹配纯 URL 格式 |
| `sanitizeMessage()` | 任意字符串（如 git 错误消息） | 全局替换正则，无锚点，处理嵌入在任意位置的 token-bearing URL |

将底层异常的 `error.message` 写入 `AiforgeError.why` 时，**必须使用 `sanitizeMessage()` 而非 `sanitizeUrl()`**——git 错误消息中 URL 嵌入在任意位置，`sanitizeUrl()` 的锚点正则无法匹配。

```typescript
✅ // 处理底层 git 异常消息（URL 可能嵌在任意位置）
   const rawMessage = error instanceof Error ? error.message : '未知网络错误'
   const safeMessage = sanitizeMessage(rawMessage)  // ← 全局替换，无锚点
   throw new AiforgeError('克隆仓库失败', 'CLONE_FAILED', ..., safeMessage, [...])

❌ // sanitizeUrl 带 ^ 锚点，无法处理嵌入在错误消息中的 URL
   const safeMessage = sanitizeUrl(rawMessage)
   // → "fatal: repository 'https://oauth2:glpat-xxx@host/repo.git' not found"
   //   → 脱敏失败，token 仍暴露
```

> 来源：Story 5-4 CR Round 1 — `CLONE_FAILED`/`PULL_FAILED` 的 `why` 直接透传 `error.message`，simple-git 错误回显完整 clone URL（含 token），导致 token 通过 reporter 输出到 stderr；修复时新增 `sanitizeMessage()` 函数专门处理此场景。

**symlink 感知的文件系统 API 选用规则：**

当代码路径链中涉及"判断文件系统条目类型"和"对同一路径执行操作"两步时，必须确保两步的 symlink 跟随语义一致：

| API | symlink 行为 | 适用场景 |
|-----|-------------|---------|
| `lstat()` | **不跟随** symlink，返回条目本身信息 | 需要识别 symlink 本身 |
| `stat()` | **跟随** symlink，返回目标信息 | 需要知道最终目标类型 |
| `access()` | **跟随** symlink | 对 broken symlink 返回 ENOENT（不是权限错误） |
| `realpath()` | **解析** symlink，返回物理路径 | 路径安全校验 |

```typescript
✅ // 需要判断祖先是否为目录（含 symlink→目录 的合法场景）
   const entryStat = await lstat(current)
   if (entryStat.isSymbolicLink()) {
     const targetStat = await stat(current)  // 跟随 symlink 确认目标类型
     if (!targetStat.isDirectory()) { throw ... }
   } else if (!entryStat.isDirectory()) {
     throw ...
   }

❌ // lstat 不跟随 symlink，symlink→directory 会被误判为非目录
   const entryStat = await lstat(current)
   if (!entryStat.isDirectory()) { throw ... }  // symlink→dir 误判！
```

> 来源：Story 4-1 CR — `lstat + isDirectory` 未处理 symlink→directory 祖先导致 3 轮回归。

**路径安全校验必须使用 `realpath()` 双边比较：**

路径安全边界校验（如 `startsWith` 前缀检查防止路径遍历）必须对被校验路径和安全根路径分别执行 `realpath()`，然后对物理路径做比较。禁止使用 `resolve()` 做安全校验——`resolve()` 是纯字符串操作，不解析 symlink，无法防止 symlink 逃逸。

```typescript
✅ // realpath 双边比较
   const realTarget = await realpath(ancestorDir)
   const realRoot = await realpath(allowedRoot)
   if (!realTarget.startsWith(realRoot + '/') && realTarget !== realRoot) {
     throw new AiforgeError('PATH_TRAVERSAL', ...)
   }

❌ // resolve() 不跟随 symlink，symlink 指向外部的路径会绕过安全检查
   const resolved = resolve(targetPath)
   if (!resolved.startsWith(resolve(allowedRoot) + '/')) { ... }
```

对不存在的路径，`realpath()` 会抛 ENOENT。此时应对路径链中已存在的最深祖先目录执行 `realpath()`，拼接不存在的尾部部分后做前缀比较。

> 来源：Story 4-1 CR — `validatePathSecurity` 使用 `resolve()` 做字符串前缀匹配，symlink 指向外部的路径绕过安全检查，2 轮 CR 才完全修复。

**安全校验必须在最终 I/O 操作路径上执行：**

当预检阶段的校验路径（如 `targetPath` = 目录）与实际 I/O 操作路径（如 `destPath` = `join(targetPath, basename(srcPath))`）不同时，必须在实际操作前对最终路径再次执行安全校验。"preflight 通过 ≠ 操作安全"——中间路径合法不代表最终路径合法。

```typescript
✅ // preflight 校验 targetPath（目录级）
   await preflight(plan, pathResolver)
   // execute 阶段对每个最终 destPath 再次校验
   for (const item of plan.items) {
     const destPath = join(item.targetPath, basename(srcPath))
     await validateDestPathSecurity(destPath, allowedRoot)  // ← 最终路径校验
     await copyFile(srcPath, destPath)
   }

❌ // 只校验 targetPath，直接操作 destPath
   await preflight(plan, pathResolver)  // 只校验了目录
   for (const item of plan.items) {
     const destPath = join(item.targetPath, basename(srcPath))
     await copyFile(srcPath, destPath)  // ← 目录下可能有 symlink 指向外部
   }
```

> 来源：Story 4-2 CR R1 — `preflight()` 校验 `targetPath` 通过，但 `copyFile()` 操作的 `destPath` 可被预置 symlink 重定向到 `allowedRoot` 外部，导致 P0 安全漏洞。

**路径安全校验必须覆盖所有递归展开层级的最终写入路径：**

当安装/复制操作涉及递归目录遍历时，安全校验不能只在最外层目录路径上执行一次。对于递归展开的每个子文件/子目录路径（如 `join(destPath, relPath)`），在执行 I/O 操作前必须对该路径重新执行边界校验。

```typescript
✅ // 对递归展开的每个嵌套文件路径逐一校验
   const relPaths = await walkDirFiles(srcPath)
   for (const relPath of relPaths) {
     const destFilePath = join(destPath, relPath)
     await validateDestPathSecurity(destFilePath, allowedRoot)  // ← 逐文件校验
     await ensureDir(dirname(destFilePath))
     await copyFile(srcFilePath, destFilePath)
   }

❌ // 只校验最外层目录，嵌套文件路径不校验
   await validateDestPathSecurity(destPath, allowedRoot)  // ← 仅目录根
   const relPaths = await walkDirFiles(srcPath)
   for (const relPath of relPaths) {
     const destFilePath = join(destPath, relPath)
     await ensureDir(dirname(destFilePath))  // ← 中间 symlink 可逃逸
     await copyFile(srcFilePath, destFilePath)
   }
```

理由："外层目录合法 ≠ 内层文件合法"——目录内部的中间节点可能是指向外部的 symlink，只校验最外层目录无法防御内部 symlink 逃逸。此规则是上一条"安全校验必须在最终 I/O 操作路径上执行"的递归场景扩展。

> 来源：Story 6-3 CR R1-#2 — Directories copy 只对 `destPath` 校验了一次，嵌套文件路径 `destFilePath` 未经校验直接 `ensureDir`+`copyFile`，中间 symlink 可逃逸 `allowedRoot`。

**npm 包安全规则 — 公司信息零容忍 + 通用占位符豁免：**

npm package MUST contain ZERO company info：

- no company/internal repo URLs（通用教学占位符如 `your-host.com` 允许）
- no real tokens or credentials（占位符如 `<your-token>` 允许）
- no company hostnames or internal domain names
- no platform-specific token prefixes that reveal internal toolchain（如 `glpat-`、`ghp_`）

关键澄清：规则的保护对象是**公司信息**（company info），不是"所有看起来像 URL 的字符串"。通用教学占位符（如 `your-git-host.com`、`<your-access-token>`）不包含任何公司身份信息，不在禁止范围内。

> 来源：Story 5-5c CR R2 — GPT-5.4 将 `your-git-host.com` 判定为违反 "no repo URLs" 规则，Claude Opus 4.6 评估判定为误报：规则限定语为 "company info"，通用占位符不构成信息泄露。

**npm 包安全验证方法必须扫描入包文件的实际内容：**

禁止仅扫描 `npm pack --dry-run` 的输出流（仅含文件名+大小），必须扫描入包文件的实际内容。

```bash
✅ # 正确的验证方法：逐个扫描入包文件内容
   npm pack --dry-run --json  # 获取入包文件列表
   grep -in "gitlab\|wshoto\|glpat" README.md       # 扫描 README 内容
   grep -in "wshoto\|glpat-" dist/index.js           # 扫描构建产物内容
   grep -in "repository\|bugs\|homepage" package.json # 扫描包元数据

❌ # 错误的验证方法：只扫描 npm pack 输出流（文件名+大小）
   npm pack --dry-run 2>&1 | grep -i "gitlab|wshoto|token|glpat"
   # → npm pack 输出流只含文件名，不含文件内容
   # → grep 无匹配 ≠ 入包文件内容安全
```

**npm 硬编码行为：** `README.md`、`package.json`、`LICENSE` 是 npm 硬编码始终包含的文件，无法通过 `.npmignore` 或 `files` 字段排除。因此 README.md 的内容安全必须作为独立验证项覆盖。

> 来源：Story 5-5c CR R1 — B5 验证方法 `npm pack --dry-run 2>&1 | grep` 只扫描了 npm 输出流中的文件名，README.md 中的 `gitlab.example.com` 和 `glpat-xxxx` 未被检出，产生假阴性。

### Testing Patterns

**测试命名：** `describe` 用模块名，`it` 用行为描述

```typescript
describe('authenticate', () => {
  it('should prefer CLI token over env variable', () => { ... });
  it('should fallback to system credentials when no config', () => { ... });
});
```

**Mock 策略：**

- 外部依赖（simple-git、fs）→ 使用 vitest mock
- 内部模块 → 优先用真实实现，只在必要时 mock
- PathResolver → 测试时注入 mock 实现（固定路径）

**测试分层：**

- 单元测试：每个管道阶段独立测试，mock 外部依赖
- 集成测试：管道端到端测试，使用临时目录和 fixture 仓库

**标记为集成测试的文件必须至少覆盖一条真实闭包/工厂函数路径：**

当测试文件放在 `tests/integration/` 目录且标记为集成测试时，至少有一条测试必须使用真实的工厂函数（如 `createProductionStages()`）而非全部 mock。全 Mock 编排测试只验证调用顺序，不验证阶段内部逻辑——工厂函数返回的闭包、共享状态变量（如 `lastPlan`、`lastRepo`）的读写一致性，只有通过真实路径才能覆盖。如果确有"纯编排"测试的需求，应在文件或 describe 块中显式标注 `(orchestration-only)`，与真实集成测试区分。

```typescript
✅ // 真实集成测试：使用 createProductionStages() 工厂函数
   const stages = createProductionStages(mockPathResolver)
   const plan = await stages.match(env, args, mockReporter)
   const result = await stages.install(plan, args, mockReporter)
   await stages.saveManifest(result)
   // 断言 manifest 文件内容（真实闭包逻辑）
   const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'))
   expect(manifest.filter(e => e.mode === 'flatten')).toHaveLength(2)

❌ // 全 Mock "集成测试"：所有阶段都是 vi.fn()，只验证调用顺序
   const stages = {
     resolve: vi.fn(async () => mockSource),
     match: vi.fn(async () => mockPlan),
     install: vi.fn(async () => mockResult),
     saveManifest: vi.fn(async () => {}),  // ← 闭包内部逻辑完全绕开
   }
   // 553/553 全绿，但 manifest 数据损坏漏过
```

> 来源：Story 4-6a CR R1 — `tests/integration/pipeline.test.ts` 8 个阶段全部 mock，553/553 全绿但 manifest mode 类型不匹配和空值兜底两个缺陷全部漏过。

**Mock 断言必须验证被测函数的实际调用链：**

当测试涉及安全关键行为（如 Token 脱敏、权限检查）时，禁止在测试中直接调用 mock 函数来验证其行为。必须通过被测函数的入口触发 mock，然后断言调用链完整性。

```typescript
✅ // 通过被测函数入口触发，验证完整调用链
   it('环境变量分支：sanitizeToken 被调用且 reporter 收到脱敏 token', async () => {
     process.env['AIFORGE_TOKEN'] = 'glpat-secrettoken9999'
     await authenticate(mockSource, makeArgs(), mockReporter)
     // (1) mock 被调用且参数正确
     expect(vi.mocked(sanitizeToken)).toHaveBeenCalledWith('glpat-secrettoken9999')
     // (2) 输出包含 mock 处理结果，而非原始输入
     const arg = (mockReporter.updatePhase as any).mock.calls[0]?.[0]
     expect(arg).not.toContain('glpat-secrettoken9999')
     expect(arg).toContain('****')
   })

❌ // 直接调用 mock 函数，只验证了 mock 自身行为
   it('sanitizeToken 格式正确', () => {
     const result = sanitizeToken('glpat-abcdefgh1234')  // ← 直接调用 mock
     expect(result).toMatch(/^.{8}\*{4}.{4}$/)
   })
```

> 来源：Story 2-3 CR — AC #7 脱敏测试直接调用 mock 的 `sanitizeToken()`，如果被测函数删掉脱敏调用，测试仍然通过，无法守住安全回归。

**测试断言必须基于 Story 契约而非当前实现行为：**

新增或修改测试断言时，断言的期望值必须基于 Story 文档中定义的输出契约（如示例输出格式、字段语义），而非当前实现的实际输出。如果实现与 Story 契约不一致，应先修复实现使其符合契约，再编写断言——禁止"先让测试绿了、再说契约的事"。否则测试会将错误行为固化，后续修正时还需连带修改测试。

```typescript
✅ // 断言基于 Story 契约（repo-relative 路径）
   expect(output).toContain('agents/coding-agent.md')
   expect(output).toContain('agents/coding-agent.md → ~/.copilot/agents/coding-agent.md')

❌ // 断言基于当前实现行为（绝对 clone 路径），将错误行为固化
   expect(output).toContain('/tmp/aiforge-xxx/agents/coding-agent.md')
   // → 测试绿了，但锁定了错误的输出格式，下一轮 CR 指出后还需连带改测试
```

> 来源：Story 4-6b CR R1→R2 — 修复 `reportResult()` 后新增测试直接使用绝对路径作为断言基准，将错误的 `sourcePath` 行为固化，R2 审查发现后才纠正为 Story 约定的 repo-relative 路径。

**CR 修复改变行为后必须同步更新所有与"旧行为"绑定的测试断言：**

当 CR 修复使某个行为发生变化时，必须搜索测试文件中所有基于旧行为编写的断言并将其更新为反映正确行为的断言。特别注意：原本"通过"的测试若因修复而变为"失败"，禁止为了"让测试重新变绿"而回退修复或注释断言——应更新断言以匹配正确行为，同时在注释中说明语义变更原因。

```typescript
✅ // 修复 processedCount 后，将旧断言更新为正确预期，并补充注释说明语义变更
   it('skipped 文件仍调用 reporter.updatePhase 推进进度计数', async () => {
     // skipped 仍是已处理的终态，应推进进度计数
     expect(reporter.updatePhase).toHaveBeenCalledWith('执行安装... (1/1)')
   })

❌ // 修复后测试失败，注释掉断言或回退修复，将旧行为固化
   // expect(reporter.updatePhase).not.toHaveBeenCalled() // 暂时注释，待确认

❌ // 为了让测试通过而回退修复代码，恢复"skipped 不推进计数"的错误行为
```

> 来源：Story 5-1 CR 修复 — 修复进度计数后，2 个旧断言 `not.toHaveBeenCalled()` 需同步更新为 `toHaveBeenCalledWith('执行安装... (1/1)')`，否则测试会将"skipped 不推进进度"的错误行为固化。

**Story Dev Notes 的 UI/格式代码示例是实现契约，不是参考风格：**

当 Story Dev Notes 给出具体的输出示例（含颜色方案、图标映射、格式结构）时，该示例为**强制实现契约**：

1. 实现完成后必须逐项比对 Dev Notes 示例与实际输出
2. 对应测试必须断言格式契约本身（如颜色语义、图标映射），而非仅断言文本内容
3. 如实现与示例存在合理偏差，必须在代码注释或 Story 中明确记录偏差原因

禁止将 Dev Notes 中的具体着色方案视为"建议风格"而仅部分实现。

```typescript
✅ // 测试颜色语义契约（断言 chalk ANSI 码）
   it('new 状态行使用 chalk.green', () => {
     chalk.level = 1 // 强制启用 ANSI 输出
     const output = reporter.reportResult(result)
     expect(output).toContain('\x1B[32m') // chalk.green ANSI 码
   })

❌ // 只验证文本内容，不验证颜色语义
   it('new 状态行包含文件名', () => {
     const output = reporter.reportResult(result)
     expect(output).toContain('file.md') // ← 颜色实现错误也会通过
   })
```

> 来源：Story 5-2 CR R1 — Dev Notes 第 58-65 行给出 `chalk.green/blue/gray` 状态着色示例，实现仅对标题着色，结果行和统计行均未落地；配套测试也只验证文本结构而未验证颜色语义，导致缺口延续到 CR 才被发现。

**i18n 测试必须验证"实际输出内容切换"，而非只验证"配置被持久化"：**

测试多语言输出时，断言目标必须是相关模块在 `setLanguage('en')` 后的**实际输出字符串**（Reporter 统计行、`AiforgeError.message`/`fix[]`、`warn` 文案），而非 `saveConfig()` 调用或 `language` 字段值。禁止以"语言配置被正确保存"替代"输出内容真正切换"作为 i18n AC 的满足依据。

```typescript
✅ // 验证实际输出内容在语言切换后变为英文
   it('英文模式下 warn 输出英文', async () => {
     setLanguage('en')
     await checkBrokenLinks(...)
     expect(reporter.warn).toHaveBeenCalledWith(
       expect.stringContaining('Broken link')
     )
     expect(reporter.warn).not.toHaveBeenCalledWith(
       expect.stringContaining('断链')
     )
   })

   it('英文模式下 reportPlan 量词为英文', () => {
     setLanguage('en')
     reporter.reportPlan(plan)
     expect(allOutput).toContain('items')
     expect(allOutput).not.toContain('项')
   })

❌ // 只验证配置持久化，不验证输出内容
   it('保存语言选择', async () => {
     await runInit(...)
     expect(saveConfig).toHaveBeenCalledWith(
       expect.objectContaining({ language: 'en' })
     )
     // ← 即使 init 整个过程仍输出中文，此测试也通过
   })
```

> 来源：Story 5-5a CR R1/R3 — 新增测试只断言 `saveConfig()` 中的 `language` 字段值和 `select` 调用顺序，未验证英文模式下实际输出是否变为英文；阶段级测试也将中文输出固化为正确行为，无法在门禁中捕获运行时中文残留。

**禁止通过选择性测试路径绕行已知缺陷——已知缺陷必须修复或显式豁免：**

当开发阶段发现某条代码路径存在 bug，禁止通过"选用不触发该路径的测试工具/参数"使测试变绿。正确处理方式必须三选一：

1. **修复缺陷**（推荐）：修复生产代码，补充覆盖该路径的回归测试
2. **显式跳过**：用 `it.skip(...)` 标记，在描述中注明"已知缺陷，Issue #XXX"，并在 Story Dev Agent Record 中记录为已知限制
3. **PR 阻塞**：在 Story Dev Agent Record 中明确记录为"阻塞项，不可交付"

禁止隐式绕行，也禁止在 Dev Agent Record 中记录"规避策略"而不标注为技术债。**测试全绿不代表功能可用——隐式绕行只是将缺陷推迟到 CR 阶段发现，浪费审查资源。**

```typescript
✅ // 方式 1：修复生产代码并补充回归测试
   // src/pipeline.ts — saveManifest 中区分 Directories 类型，跳过 fileHash()
   if (isDirectoryType) {
     hashes.set(item.targetPath, '')  // 目录型占位值，不调用 fileHash()
   } else {
     const hash = await fileHash(item.targetPath)
     hashes.set(item.targetPath, hash)
   }
   // tests/integration/pipeline.test.ts — 补充全链路回归测试
   it('saveManifest：claude:global（含 Directories 类型 skills）全链路不抛 FILE_HASH_FAILED', ...)

✅ // 方式 2：显式跳过，明确标注技术债
   it.skip('saveManifest：Directories 类型全链路（已知缺陷：fileHash 对目录失败，待修复）', ...)

❌ // 隐式绕行：换用不触发缺陷路径的参数，测试全绿但生产缺陷未修复
   // Story Dev Agent Record 注释："使用 cursor 工具（skills=Flatten, agents=Files），
   // 避免 Directories 类型目录 hash 问题"
   // → claude/copilot users 安装 skills 时生产路径仍然 fatal
   const args = createE2ETestArgs({ tools: ['cursor'], global: true })  // ← 刻意规避
```

> 来源：Story 5-5b CR R1 — `saveManifest` 对 `InstallType.Directories` 目录路径调用 `fileHash()` 的已知缺陷，通过将 saveManifest E2E 测试改用只含 Flatten+Files 的 cursor 工具绕行，导致全量 691/691 全绿但 claude/copilot skills 安装链路在生产中 fatal。Round 1 Not Pass，修复后 Round 2 通过。

### CR Workflow Patterns

**CR 修复后必须同步更新 Story Dev Agent Record：**

CR 修复涉及新增/删除测试用例或代码变更导致全仓测试数变化时，修复完毕后必须同步更新 Story 的 Completion Notes：

1. 当前 Story 测试用例数
2. 全仓测试通过数
3. Lint 状态

更新时应标注变更原因（如"原 18 + CR Round-1 修复新增 3"），便于追溯。

**同时必须更新 `File List`，确保列出 CR 修复过程中所有改动文件，包括规则文档**（`project-context.md`、`03-core-decisions.md`、`04-implementation-patterns.md`）——仅列出代码文件而遗漏规则文档是常见遗漏点。

> 来源：Story 2-3 CR — 修复新增 3 个测试后 Story 记录仍写"18 个测试用例"和"285 tests pass"，延续一整轮 CR 才关闭；Story 5-2 CR R3 — CR 修复同步了 3 份规则文档但 File List 未追加。

**CR 修复后必须执行完整质量门禁三件套：**

每次 CR 修复完成后，必须按顺序执行完整验证并将每项结果逐行记录到修复记录中：

1. `npm test` — 记录通过数（含新增测试的增量说明）
2. `npm run lint` — 记录 error/warning 数（含 Prettier 格式检查）
3. `npm run build` — 记录构建状态

禁止：
- 只执行部分验证（如只跑 test 不跑 lint）
- 复用上轮验证结果（每次修复后必须重新执行）
- 在验证未全部通过时声称"通过"

Prettier 格式化应作为修复的最后一步自动执行：

```bash
✅ # 修复代码后，先格式化再验证
   npx prettier --write src/stages/execute-install.ts tests/stages/execute-install.test.ts
   npm test && npm run lint && npm run build

❌ # 修复代码后只跑 test，忘记 lint
   npm test  # ✅
   # npm run lint  ← 忘了跑，Prettier 格式问题被遗漏到下一轮 CR
```

> 来源：Story 4-2 CR — R2 和 R5 各出现一次 Prettier 格式未通过；Story 4-1 CR 也出现同类问题，共 3 次重复。

**CR 修复验证结论必须可独立复现：**

CR 修复记录中的"验证通过"结论必须附带可独立复现的验证命令和输出摘要（如测试通过数、lint 状态）。禁止只写"✅ npm run lint 通过"而不附带任何证据。后续审查轮次必须能通过重新执行相同命令来验证结论的真实性。修复记录中如果声称验证通过，但下一轮审查独立执行后发现未通过，视为修复记录不合规。

```bash
✅ # 修复验证记录（可独立复现）
   ### 修复验证
   - `npm test` ✅ — 576/576 passed（28 test files）
   - `npm run lint` ✅ — All matched files use Prettier code style!
   - `npm run build` ✅ — dist/ 产出正常

❌ # 修复验证记录（不可复现，缺乏证据）
   ### 修复验证
   - npm test ✅
   - npm run lint ✅
   - npm run build ✅
   # → 下一轮审查独立执行 lint 发现实际未通过，修复记录不可信
```

> 来源：Story 4-6b CR R1→R2 — R1 修复记录声称"npm run lint ✅ 通过"，但 R2 审查独立执行后发现 lint 实际未通过，说明 R1 验证结论不可靠。

**Rule Document Registry 同步时必须扫描示例代码块和格式示例，不限于文字规则段落：**

执行 Rule Document Registry 三文档同步时，除更新文字规则段落外，还必须检查：

1. **示例代码块**（`` ``` `` 块内的接口签名、类型定义、枚举值）
2. **格式示例/图标枚举**（如 Result icons 枚举列表、统计行格式示例）

搜索关键词：同步目标的字段名、枚举值、状态词（如 `failed`、`InstallResult`）。遗漏"非文字规则"内容是多轮 CR 中持续出现的同步缺口。

```bash
✅ # 规则同步检查清单
   # 1. 搜索文字规则段落（已有约束）
   grep -n "failed" _bmad-output/project-context.md
   # 2. 搜索示例代码块中的枚举值/类型签名
   grep -n "InstallResult\[\]" _bmad-output/planning-artifacts/architecture/03-core-decisions.md
   # 3. 搜索格式示例（图标列表、统计行）
   grep -n "❌ failed\|失败: N 项" _bmad-output/planning-artifacts/architecture/04-implementation-patterns.md
```

> 来源：Story 5-2 CR R1 — `failed` 图标/统计行示例未同步；R2 — `InstallResult[]` 接口示例未同步，均属文字规则已同步但示例内容遗漏的模式。

**lint 门禁作用域必须使用 `npm run lint:src`：**

Story 开发及 CR 修复的质量门禁验证必须使用 `npm run lint:src`（作用域：`src/` + `tests/`），而非 `npm run lint`（全仓，包含外部 AI 工具目录等非发布产物）。Dev Agent Record 中声称 "lint 通过" 时，必须注明执行的是 `npm run lint:src`。`npm run lint` 用于确认全仓无 Prettier 污染，在发布前和 `.prettierignore` 修改后执行。

```bash
✅ # Story 开发和 CR 修复的质量门禁
   npm test && npm run lint:src && npm run build

✅ # 发布前或 .prettierignore 修改后，额外执行全仓检查
   npm run lint   # 覆盖全仓（含外部工具目录）

❌ # 以 npm run lint（全仓）作为 Story 开发的日常门禁
   # → 外部 AI 工具目录（.agent/.agents/.gemini）的格式噪音影响退出码
   # → Dev Agent Record 中的 "lint 通过" 语义模糊，无法精确复现
```

> 来源：Story 5-5c CR TODO-016 — `npm run lint` 全仓作用域包含 339 个非发布文件，导致退出码非零；Story 5-6 落地 `lint:src` 脚本后正式区分两种 lint 目标。

**[CR-001] 多触点字面量修复必须全局扫描，一次性闭合所有触点：**

修复包含字面量（路径名、关键词、特定字符串）的不一致问题时，禁止只修审查指出的单一位置。修复前先全局扫描，修复后再次确认无残留：

```bash
✅ # 修复前：找出所有触点
   grep -rn "\.vscode/mcp\.json" src/ docs/ tests/ _bmad-output/
   # 对每个命中位置评估：是历史注解（保留）还是语义不一致（需修复）
   # 一次性提交所有需修复的触点

❌ # 只修 CR 指出的具体文件
   # → 其他触点残留，下轮 CR 继续发现，循环不止
```

> 来源：Story 7-1 CR R7→R8 — `.vscode/mcp.json` 字面量散布 4 个触点（docs/migration-v2、install-rules-matrix、Story AC、messages.ts）；R7 Fixer 只闭合前两个，R8 再次发现后两个；识别此模式为"8 轮循环的根因"。

**[CR-002] 修复完成后立即 `git add`，禁止跨轮留存 unstaged 修复：**

每轮修复完成后必须立即 stage，并验证无分裂：

```bash
✅ # 修复完成后立即 stage + 验证
   git add <all-modified-files>
   git status --short | grep -E "MM|AM"   # 期望：无输出
   git diff --cached -- src/core/messages.ts docs/migration-v2.md  # 期望：显示本轮修复

❌ # 修复完但没有 git add，等"全部确认后"再 stage
   # git status: MM src/core/messages.ts
   # → 复审看到最新内容，commit 却只包含旧 staged 版本，本轮全部修复丢失
```

> 来源：Story 7-1 CR R5/R6/R8 — 连续 3 轮出现 unstaged 修复；R8 的 staged/unstaged 分裂被评为 P1 交付阻塞项。

**[CR-003] 每次修复后必须检查 AC 满足度不回退：**

修复文案或行为时，修改完成后必须逐条对照 Story AC 确认关键文本/行为仍然存在：

```bash
✅ # 修复文案后，逐条检查 AC
   # AC #3: 提示必须包含"如何安装 GitHub Copilot 扩展"
   grep -n "GitHub Copilot 扩展\|GitHub Copilot extension" src/core/messages.ts
   # → 期望：命中，否则此轮修复意外破坏了 AC #3

❌ # 修复 vscodeMergedNote 文案对齐时，删除了 ② 项"安装扩展"
   # → AC #3 被意外破坏，下轮 CR 升级为 P1 阻塞项
```

> 来源：Story 7-1 CR R4→R5 — R4 修复文档对齐时意外删除 vscodeMergedNote ② 项"安装 GitHub Copilot 扩展"，直接导致 AC #3 回归，R5 必须再修一轮。

**[CR-004] 回归保护测试断言必须精确到关键词，禁止使用宽泛正则：**

注释为"防止文案回归"或"AC #X 保护"的测试断言，必须精确到 AC 要求的关键短语：

```typescript
✅ // AC #3: 提示内容必须包含"如何安装 GitHub Copilot 扩展"（防止文案回归）
   expect(String(vscodeMergedCall![0])).toContain('GitHub Copilot 扩展')
   // 心算验证：如果把 ② 项"安装扩展"删掉，这条断言会失败 ✅

❌ // 太宽泛——删除"安装扩展"后文案仍含"Copilot 项目级规则"，断言仍通过
   expect(String(vscodeMergedCall![0])).toMatch(/Copilot/i)
```

自查方法：心算"如果把 AC 要求的文案删掉，断言还会通过吗？"若答案是"会"，断言不够强。

> 来源：Story 7-1 CR R5→R6 — vscodeMergedNote 回归保护用 `.toMatch(/Copilot/i)`，AC #3 再次被删时断言仍通过；R6 升级为 `.toContain('GitHub Copilot 扩展')` 才真正形成门禁。

**[CR-005] CR 超过 4 轮未通过时，Evaluator 必须主动诊断根因并给出突围路径：**

当 CR 达到第 5 轮仍未通过，Evaluator 必须完成三件事：

1. **根因分析**：指出"为何同类问题反复出现"（根因，不是症状）
2. **突围路径**：给出 Fixer 的具体行动指引（如"执行全局 grep + 一次性闭合所有触点"）
3. **严重性重评**：对本轮发现重新评级，避免非阻塞项被审查疲劳放大

禁止：轮数 ≥5 时仍只做"本轮发现有效/无效"的逐条确认而不给突围路径。

> 来源：Story 7-1 CR R8 评估 — 第 8 轮主动诊断"多触点字面量未全局扫描"为根因，给出全局 grep + 一次性闭合的突围路径，R9 完整执行后一轮通过。此前 7 轮均为逐条确认，循环不止。

**[CR-006] 每轮修复执行记录必须包含质量门禁三件套的执行结果（补充：必须记录完整运行结果）：**

本条是已有「CR 修复后必须执行完整质量门禁三件套」规则的补充约束：缺少完整运行结果会导致 Auditor 将"缺质量门禁记录"列为阻塞项，制造额外 CR 轮次。记录格式：

```
| 检查项 | 结果 |
|--------|------|
| npm run lint:src | ✅ All matched files use Prettier code style! |
| npm run build    | ✅ ESM 136.26 KB |
| npm test         | ✅ 853/853 passed (33 test files) |
```

即使修改内容看似与测试无关也必须重新执行（文档类修改不能"借用"上轮结果）。

> 来源：Story 7-1 CR R8 Finding #4 — R7 修复记录只记录局部测试（24 tests），未记录全量 npm test/lint/build，被 Auditor 列为 P3 阻塞项需另轮修复。

### Enforcement Guidelines

**所有 AI Agent 必须遵守：**

1. 文件命名 kebab-case，TypeScript 命名遵循上述约定
2. 所有错误必须通过 AiforgeError 抛出，包含三段式信息
3. 所有用户可见输出必须通过 Reporter 接口，不直接 console.log（例外：`aiforge init` 交互式命令使用 `console.log` + `@inquirer/prompts`；Reporter 创建前的语言回退提示使用 `process.stderr.write()`）
4. JSON 文件字段一律 camelCase
5. ESM 导入路径必须带 `.js` 扩展名
6. 命名导出，不用默认导出（工具配置文件如 `tsup.config.ts`、`vitest.config.ts` 豁免）
7. **当 story Dev Notes 中的代码片段与架构文档（`architecture/*.md`）存在差异时，以架构文档为准。** Story 代码片段仅为示意，不保证字段的 optional/required 标记完整

---

## 后续修订（2026-04-24 UX 收敛）

> 本次修订源于安装阶段 UX 收敛（spinner 修复、明细折叠阈值、零结果诊断分支拆分、TTY 颜色层级）。
> 已原地更新上文 CLI Output Patterns 区域，本块保留变更对照供审计追溯。

| 章节 / 项 | 变更前 | 变更后 | 依据 |
|----------|--------|--------|------|
| CLI Output Patterns — 结果状态图标 | 仅列出图标类型，未明确颜色语义 | 新增「TTY 结果着色双重语义」表：明细行 new/updated/skipped = green/blue/green；汇总数字 安装/更新/跳过 = green/blue/yellow | 代码 `src/core/reporter.ts` |
| CLI Output Patterns — 折叠阈值 | 未设定 | 新增「TTY 结果折叠阈值」区域：`MAX_TTY_RESULT_DETAILS_PER_TOOL = 5`，工具+本地根二级分组 | 代码 `src/core/reporter.ts` |
| CLI Output Patterns — 零结果诊断 | 未拆分零结果与全部跳过两种场景 | 新增「零结果诊断双分支」区域：拆为真·零结果（warn）与全部跳过（completePhase 成功路径）；修复建议禁含 `--force`；diag 明细超 5 条折叠 | 代码 `src/stages/execute-install.ts`、`src/core/messages.ts` |

