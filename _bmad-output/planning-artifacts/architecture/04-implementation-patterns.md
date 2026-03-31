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
✅ 新建成功    🔄 更新    ⏭️ 跳过（已是最新）    ❌ 失败
```

**统计行格式：**

```
安装: 7 项  更新: 1 项  跳过: 1 项  失败: 0 项
```

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

### CR Workflow Patterns

**CR 修复后必须同步更新 Story Dev Agent Record：**

CR 修复涉及新增/删除测试用例或代码变更导致全仓测试数变化时，修复完毕后必须同步更新 Story 的 Completion Notes：

1. 当前 Story 测试用例数
2. 全仓测试通过数
3. Lint 状态

更新时应标注变更原因（如"原 18 + CR Round-1 修复新增 3"），便于追溯。

> 来源：Story 2-3 CR — 修复新增 3 个测试后 Story 记录仍写"18 个测试用例"和"285 tests pass"，延续一整轮 CR 才关闭。

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

### Enforcement Guidelines

**所有 AI Agent 必须遵守：**

1. 文件命名 kebab-case，TypeScript 命名遵循上述约定
2. 所有错误必须通过 AiforgeError 抛出，包含三段式信息
3. 所有用户可见输出必须通过 Reporter 接口，不直接 console.log
4. JSON 文件字段一律 camelCase
5. ESM 导入路径必须带 `.js` 扩展名
6. 命名导出，不用默认导出（工具配置文件如 `tsup.config.ts`、`vitest.config.ts` 豁免）
7. **当 story Dev Notes 中的代码片段与架构文档（`architecture/*.md`）存在差异时，以架构文档为准。** Story 代码片段仅为示意，不保证字段的 optional/required 标记完整

