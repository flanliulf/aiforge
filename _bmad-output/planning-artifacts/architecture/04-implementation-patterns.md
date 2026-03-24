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

### CR Workflow Patterns

**CR 修复后必须同步更新 Story Dev Agent Record：**

CR 修复涉及新增/删除测试用例或代码变更导致全仓测试数变化时，修复完毕后必须同步更新 Story 的 Completion Notes：

1. 当前 Story 测试用例数
2. 全仓测试通过数
3. Lint 状态

更新时应标注变更原因（如"原 18 + CR Round-1 修复新增 3"），便于追溯。

> 来源：Story 2-3 CR — 修复新增 3 个测试后 Story 记录仍写"18 个测试用例"和"285 tests pass"，延续一整轮 CR 才关闭。

### Enforcement Guidelines

**所有 AI Agent 必须遵守：**

1. 文件命名 kebab-case，TypeScript 命名遵循上述约定
2. 所有错误必须通过 AiforgeError 抛出，包含三段式信息
3. 所有用户可见输出必须通过 Reporter 接口，不直接 console.log
4. JSON 文件字段一律 camelCase
5. ESM 导入路径必须带 `.js` 扩展名
6. 命名导出，不用默认导出（工具配置文件如 `tsup.config.ts`、`vitest.config.ts` 豁免）
7. **当 story Dev Notes 中的代码片段与架构文档（`architecture/*.md`）存在差异时，以架构文档为准。** Story 代码片段仅为示意，不保证字段的 optional/required 标记完整

