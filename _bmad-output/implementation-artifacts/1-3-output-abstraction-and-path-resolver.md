# Story 1.3: 输出抽象与路径解析

Status: ready-for-dev

## Story

As a 开发者,
I want 统一的输出抽象层和跨平台路径解析器,
so that 所有用户可见输出通过 Reporter 接口管理，路径处理跨平台一致。

## Acceptance Criteria

1. **Given** `core/reporter.ts` 已创建 **When** 检查 Reporter 接口 **Then** 包含方法：`startPhase(name)`、`updatePhase(message)`、`completePhase()`、`reportResult(results)`、`reportPlan(plan)`、`reportError(error)`，进度方法输出到 stderr，结果/计划方法输出到 stdout
2. **Given** TTY 终端环境 **When** 使用 `TtyReporter` **Then** `startPhase` 启动 ora spinner，`updatePhase` 更新 spinner 文本，`completePhase` 停止 spinner 并显示 ✓
3. **Given** 非 TTY 环境 **When** 使用 `PlainReporter` **Then** 输出纯文本行，无 spinner、无 ANSI 彩色码
4. **Given** `--quiet` 模式 **When** 使用 `QuietReporter` **Then** 只输出关键信息（最终成功/失败 + 统计行）
5. **Given** `core/path-resolver.ts` 已创建 **When** 检查 PathResolver 接口 **Then** 包含方法：`home()`、`toolGlobalDir(toolId)`、`toolProjectDir(toolId)`、`configDir()`、`reposDir()`，`UnixPathResolver` 使用 `os.homedir()` + `path.join()`
6. **Given** `os.homedir()` 返回空或未定义 **When** 创建 PathResolver **Then** 抛出 `AiforgeError`，提示 HOME 环境变量未设置

## Tasks / Subtasks

- [ ] Task 1: 创建 `src/core/reporter.ts` — Reporter 接口定义 (AC: #1)
  - [ ] 1.1 定义 `Reporter` 接口：`startPhase`, `updatePhase`, `completePhase`, `reportResult`, `reportPlan`, `reportError`
  - [ ] 1.2 定义 `createReporter(options: { quiet: boolean; isTty: boolean }): Reporter` 工厂函数
- [ ] Task 2: 实现 `TtyReporter` (AC: #2)
  - [ ] 2.1 使用 ora 创建 spinner，chalk 着色
  - [ ] 2.2 进度输出到 `process.stderr`
  - [ ] 2.3 结果/计划输出到 `process.stdout`
- [ ] Task 3: 实现 `PlainReporter` (AC: #3)
  - [ ] 3.1 纯文本行输出，无 ANSI 转义码
  - [ ] 3.2 进度输出到 `process.stderr`，结果到 `process.stdout`
- [ ] Task 4: 实现 `QuietReporter` (AC: #4)
  - [ ] 4.1 `startPhase`/`updatePhase`/`completePhase` 为空操作
  - [ ] 4.2 只在 `reportResult`/`reportError` 时输出精简信息
- [ ] Task 5: 创建 `src/core/path-resolver.ts` — PathResolver (AC: #5, #6)
  - [ ] 5.1 定义 `PathResolver` 接口
  - [ ] 5.2 实现 `UnixPathResolver`：`home()` → `os.homedir()`，`configDir()` → `~/.aiforge/`，`reposDir()` → `~/.aiforge/repos/`
  - [ ] 5.3 `toolGlobalDir(toolId)` 和 `toolProjectDir(toolId)` 返回对应工具的配置目录
  - [ ] 5.4 构造函数中检查 `os.homedir()` 有效性，无效时抛出 `AiforgeError`
- [ ] Task 6: 编写单元测试 (AC: #1-6)
  - [ ] 6.1 `tests/core/reporter.test.ts` — 工厂函数返回正确实现、各 Reporter 输出流验证
  - [ ] 6.2 `tests/core/path-resolver.test.ts` — 路径拼接正确性、homedir 异常处理

## Dev Notes

### Reporter 架构 [Source: architecture/03-core-decisions.md#D4]

```typescript
export interface Reporter {
  startPhase(name: string): void;
  updatePhase(message: string): void;
  completePhase(): void;
  reportResult(results: InstallResult): void;
  reportPlan(plan: MatchedPlan): void;
  reportError(error: AiforgeError): void;
}
```

**输出流分工**（架构强制）：
- `process.stderr` ← 进度信息（spinner、阶段名）
- `process.stdout` ← 结果数据、安装计划（可被管道消费）

这意味着 `npx aiforge --dry-run 2>/dev/null` 只输出纯安装计划。

### Reporter 选择逻辑

```
isTty && !quiet → TtyReporter
!isTty && !quiet → PlainReporter
quiet → QuietReporter
```

检测 TTY：`process.stdout.isTTY`

### PathResolver 架构 [Source: architecture/03-core-decisions.md#D5]

```typescript
export interface PathResolver {
  home(): string;
  configDir(): string;        // ~/.aiforge/
  reposDir(): string;         // ~/.aiforge/repos/
  toolGlobalDir(toolId: string): string;
  toolProjectDir(toolId: string): string;
}
```

- MVP 只实现 `UnixPathResolver`（macOS + Linux）
- 所有路径使用 `path.join()`（NFR-C5），不硬编码 `/`
- `os.homedir()` 使用 `os.homedir()`（NFR-C6），不用 `process.env.HOME`

### 工具目录映射

`toolGlobalDir(toolId)` 和 `toolProjectDir(toolId)` 在本 Story 中使用基于 toolId 的固定路径拼接规则，不依赖 Story 1.4 的 `TOOL_DEFINITIONS`：

- `toolGlobalDir(toolId)` → `~/.aiforge/tools/${toolId}/`（全局工具配置目录）
- `toolProjectDir(toolId)` → `.aiforge/tools/${toolId}/`（项目级工具配置目录，相对于项目根）

这是 PathResolver 自身的路径约定，与工具检测注册表无关。后续如需调整映射规则，只需修改 PathResolver 实现。

### 依赖关系

- 依赖 Story 1.1（项目骨架）
- 依赖 Story 1.2（`AiforgeError`、`InstallResult`、`MatchedPlan` 类型）
- `Reporter` 的 `reportResult` 和 `reportPlan` 方法签名引用 Story 1.2 的类型

### ora 和 chalk 使用注意

- ora v8+ 和 chalk v5+ 是**纯 ESM 包**
- 导入方式：`import ora from 'ora'`（ora 是默认导出的例外，这是第三方库的约定）
- chalk：`import chalk from 'chalk'`（同上，第三方库约定）
- 我们自己的代码仍然只用命名导出

### 本 Story 不做的事

- 不实现 Reporter 的完整格式化逻辑（树形结果、统计行等在 Story 5.1/5.2 完善）
- 本 Story 的 `reportResult`/`reportPlan` 可以是基础实现（如简单的 JSON.stringify 或逐行输出）
- 不实现 Windows 路径支持（延迟决策，M2+）

### References

- [Source: architecture/03-core-decisions.md#D4] — Reporter 接口设计
- [Source: architecture/03-core-decisions.md#D5] — PathResolver 接口设计
- [Source: architecture/04-implementation-patterns.md] — CLI 输出规范（中文阶段名、状态图标）
- [Source: architecture/05-project-structure.md] — stdout/stderr 分工
- [Source: project-context.md#Output-Rules] — 输出规则

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
