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

**导出模式：** 命名导出，不用默认导出

```typescript
✅ export function loadRules(): InstallRule[] { ... }
✅ export class AiforgeError extends Error { ... }
❌ export default function loadRules() { ... }
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

**错误创建模式：**

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

### Enforcement Guidelines

**所有 AI Agent 必须遵守：**

1. 文件命名 kebab-case，TypeScript 命名遵循上述约定
2. 所有错误必须通过 AiforgeError 抛出，包含三段式信息
3. 所有用户可见输出必须通过 Reporter 接口，不直接 console.log
4. JSON 文件字段一律 camelCase
5. ESM 导入路径必须带 `.js` 扩展名
6. 命名导出，不用默认导出

