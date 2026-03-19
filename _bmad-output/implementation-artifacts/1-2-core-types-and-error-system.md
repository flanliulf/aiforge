# Story 1.2: 核心类型定义与错误体系

Status: review

## Story

As a 开发者,
I want 管道数据契约的 TypeScript 接口和统一的错误类型,
so that 所有管道阶段有明确的输入/输出类型，错误处理一致且信息丰富。

## Acceptance Criteria

1. **Given** `core/types.ts` 已创建 **When** 检查类型定义 **Then** 包含所有管道阶段的输入/输出接口：`ParsedArgs`、`ResolvedSource`、`AuthenticatedSource`、`LocalRepo`、`DetectedEnv`、`MatchedPlan`、`InstallResult`，以及 `InstallRule`、`ToolDefinition`、`ManifestEntry`、`AiforgeConfig` 等数据结构接口，接口命名 PascalCase 无 `I` 前缀
2. **Given** `core/errors.ts` 已创建 **When** 创建一个 `AiforgeError` 实例 **Then** 包含 `code`（字符串错误码）、`exitCode`（0/1/2/3）、`severity`（'fatal'|'partial'）、`why`（原因）、`fix`（修复命令数组），`severity: 'fatal'` 表示管道立即停止，`severity: 'partial'` 表示管道收集错误继续执行
3. **Given** `core/sanitize.ts` 已创建 **When** 调用 `sanitizeToken('glpat-abcdefghijklmnop')` **Then** 返回 `glpat-ab****mnop`（前 8 + `****` + 后 4 字符）；Token 长度 < 12 时返回前 4 + `****`（不显示尾部）
4. **Given** 任意包含 Token 的 URL **When** 调用 `sanitizeUrl()` **Then** URL 中的 Token 部分被脱敏处理
5. **Given** 所有核心类型文件 **When** 检查模块依赖 **Then** `core/` 目录不依赖 `src/` 下任何其他目录，所有导出使用命名导出，ESM 导入带 `.js` 扩展名

## Tasks / Subtasks

- [x] Task 1: 创建 `src/core/types.ts` — 管道数据契约 (AC: #1)
  - [x] 1.1 定义 `ParsedArgs` 接口（CLI 参数解析结果）
  - [x] 1.2 定义 `ResolvedSource` 接口（知识源解析结果：hostname, repoPath, protocol）
  - [x] 1.3 定义 `AuthenticatedSource` 接口（认证后的源：含 authMethod, cloneUrl）
  - [x] 1.4 定义 `LocalRepo` 接口（本地仓库：repoDir, isNew, sourceFiles[]）
  - [x] 1.5 定义 `DetectedEnv` 接口（检测到的工具环境：tools[], scope）
  - [x] 1.6 定义 `MatchedPlan` 接口（匹配的安装计划：items[]，每项含 rule, sourceFiles, targetPath）
  - [x] 1.7 定义 `InstallResult` 接口（安装结果：items[]，每项含 status, sourcePath, targetPath）
  - [x] 1.8 定义 `InstallRule` 接口（安装规则：tool, scope, sourceDir, type, targetDir）
  - [x] 1.9 定义 `ToolDefinition` 接口（工具定义：id, name, detect.global[], detect.project[]）
  - [x] 1.10 定义 `ManifestEntry` 接口（manifest 条目：source, target, tool, scope, mode, hash, installedAt）
  - [x] 1.11 定义 `AiforgeConfig` 接口（配置：defaultRepo, cloneDir, language, preferSSH, auth）
  - [x] 1.12 定义 `Severity` 类型：`'fatal' | 'partial'`
  - [x] 1.13 定义 `InstallType` 枚举：`Files`, `Directories`, `Flatten`（PascalCase 值）
  - [x] 1.14 定义 `AuthMethod` 类型：`'ssh' | 'token' | 'credential-manager'`
- [x] Task 2: 创建 `src/core/errors.ts` — 统一错误类型 (AC: #2)
  - [x] 2.1 实现 `AiforgeError extends Error`，含 `code`, `exitCode`, `severity`, `why`, `fix[]`
  - [x] 2.2 定义退出码常量：`EXIT_SUCCESS = 0`, `EXIT_INSTALL_FAILURE = 1`, `EXIT_AUTH_FAILURE = 2`, `EXIT_ARG_ERROR = 3`
  - [x] 2.3 提供工厂函数简化常见错误创建（如 `authError()`, `argError()`）
- [x] Task 3: 创建 `src/core/sanitize.ts` — Token 脱敏 (AC: #3, #4)
  - [x] 3.1 实现 `sanitizeToken(token: string): string` — 前 8 + `****` + 后 4
  - [x] 3.2 实现 `sanitizeUrl(url: string): string` — 检测 URL 中嵌入的 Token 并脱敏
- [x] Task 4: 编写单元测试 (AC: #1-5)
  - [x] 4.1 `tests/core/errors.test.ts` — AiforgeError 构造、属性、工厂函数
  - [x] 4.2 `tests/core/sanitize.test.ts` — sanitizeToken 各种长度、sanitizeUrl 各种格式
- [x] Task 5: 验证模块边界 (AC: #5)
  - [x] 5.1 确认 core/ 下所有文件无 `import from '../stages'` 等外部依赖
  - [x] 5.2 确认所有 import 带 `.js` 扩展名
  - [x] 5.3 确认只使用命名导出

## Dev Notes

### 架构决策 [Source: architecture/03-core-decisions.md#D4]

AiforgeError 是整个项目**唯一的错误类型**，绝不使用原生 `Error`：

```typescript
export class AiforgeError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly exitCode: number,
    public readonly severity: 'fatal' | 'partial',
    public readonly why: string,
    public readonly fix: string[]
  ) {
    super(message);
    this.name = 'AiforgeError';
  }
}
```

三段式错误信息模式：`message`（什么坏了）→ `why`（为什么）→ `fix[]`（怎么修，可复制命令）

### 管道数据流 [Source: architecture/05-project-structure.md]

```
ParsedArgs → ResolvedSource → AuthenticatedSource → LocalRepo → DetectedEnv → MatchedPlan → InstallResult
```

每个阶段的输出是下一阶段的输入，类型必须精确匹配。

### Token 脱敏规则 [Source: architecture/03-core-decisions.md, NFR-S3]

- `sanitizeToken('glpat-abcdefghijklmnop')` → `glpat-ab****mnop`（前 8 + `****` + 后 4）
- Token 长度 < 12 时：前 4 + `****`（不显示尾部），如 `sanitizeToken('short_tok')` → `shor****`
- URL 中的 Token：`https://glpat-abcdefghijklmnop@gitlab.com/repo.git` → `https://glpat-ab****mnop@gitlab.com/repo.git`

### 模块边界 [Source: architecture/05-project-structure.md]

- `core/` 是**零依赖**模块，被所有其他模块引用
- 本 Story 创建的文件只能 import `core/` 内部的其他文件
- 绝不 import `stages/`、`services/`、`data/`、`commands/`

### 命名约定 [Source: architecture/04-implementation-patterns.md]

- 接口: PascalCase 无 `I` 前缀（`SourceResolver` 不是 `ISourceResolver`）
- 枚举值: PascalCase（`InstallType.Files`）
- 常量: UPPER_SNAKE_CASE（`EXIT_SUCCESS`）
- 文件名: kebab-case（`types.ts`, `errors.ts`, `sanitize.ts`）

### 依赖 Story 1.1

- 需要 Story 1.1 的项目骨架已就绪（TypeScript 编译环境、vitest 测试环境）
- 在 Story 1.1 创建的 `src/core/` 目录下工作

### 本 Story 不做的事

- 不实现 Reporter 接口（Story 1.3）
- 不实现 PathResolver（Story 1.3）
- 不实现数据常量（Story 1.4）
- 不实现 CLI 或管道编排（Story 1.5）

### References

- [Source: architecture/03-core-decisions.md#D4] — AiforgeError 设计和退出码
- [Source: architecture/03-core-decisions.md#D1] — SourceResolver 接口
- [Source: architecture/04-implementation-patterns.md] — 命名约定
- [Source: architecture/05-project-structure.md] — 模块边界和数据流
- [Source: project-context.md#Error-Handling-Rules] — 错误处理规则

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6, claude-opus-4-6 (CR follow-up)

### Debug Log References

- 修复 types.test.ts 中 `expect` 未导入问题（仅导入了 `expectTypeOf`）

### Completion Notes List

- 创建 `src/core/types.ts`：14 个接口/类型/枚举，覆盖完整管道数据契约
- 创建 `src/core/errors.ts`：`AiforgeError` 类、4 个退出码常量、`authError()`/`argError()` 工厂函数
- 创建 `src/core/sanitize.ts`：`sanitizeToken()` 和 `sanitizeUrl()` 脱敏函数
- 全套 81 个测试通过，无回归

### Change Log

- 2026-03-19: CR Round 1 follow-up — 修复 7 项审查发现
  - [High] 修复 `sanitizeToken()` 12 字符边界泄漏（`>=` → `>`）
  - [High] 修复 `sanitizeUrl()` 支持 GitLab `oauth2:token@host` 格式
  - [Med] `AiforgeConfig.cloneDir`/`preferSSH` 改为 optional，对齐架构文档
  - [Med] `AiforgeConfig.auth.method` 收窄为 `'ssh' | 'token'`，排除 `credential-manager`
  - [Med] `exitCode` 类型从 `number` 收窄为 `ExitCode = 0 | 1 | 2 | 3`
  - [Med] File List 补充 `sprint-status.yaml`
  - [Low] 新增 AC#5 模块边界自动化测试

### File List

- `src/core/types.ts` (新增)
- `src/core/errors.ts` (新增)
- `src/core/sanitize.ts` (新增)
- `tests/core/types.test.ts` (新增)
- `tests/core/errors.test.ts` (新增)
- `tests/core/sanitize.test.ts` (新增)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (修改)
