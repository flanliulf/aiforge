# Story 5.1: 阶段式进度与 spinner 动画

Status: done

## Story

As a 用户,
I want 在安装过程中看到实时进度,
So that 知道系统在做什么，不会以为卡住了。

## Acceptance Criteria

1. **Given** TTY 终端环境下执行安装 **When** 管道进入每个阶段 **Then** 显示 ora spinner + 中文阶段名（"解析仓库地址..."、"验证认证信息..."、"克隆仓库..."、"检测 AI 工具..."、"匹配安装规则..."、"执行安装..."）（FR-035），阶段完成时 spinner 停止并显示 ✓ 标记
2. **Given** 安装阶段处理多个文件 **When** 每个文件处理完成 **Then** 更新 spinner 文本显示当前进度（如 "执行安装... (3/7)"）
3. **Given** 进度输出 **When** 检查输出流 **Then** 所有进度信息输出到 stderr（不污染 stdout 的数据流）

## Tasks / Subtasks

- [x] Task 1: 完善 `TtyReporter` 的 spinner 实现 (AC: #1, #2, #3)
  - [x] 1.1 在 `startPhase(name)` 中启动 ora spinner，文本为阶段名
  - [x] 1.2 在 `updatePhase(message)` 中更新 spinner 文本（追加进度信息）
  - [x] 1.3 在 `completePhase()` 中停止 spinner，显示 ✓ + 阶段名
  - [x] 1.4 spinner 输出到 stderr：`ora({ stream: process.stderr })`
  - [x] 1.5 错误时 spinner 显示 ✗ 标记：由 `reportError()` 内部触发——如果当前有活跃 spinner，先调用 `this.spinner.fail()` 显示 ✗，再渲染三段式错误。这是 TtyReporter 的内部实现细节，不需要扩展 Reporter 接口。
- [x] Task 2: 实现进度计数 (AC: #2)
  - [x] 2.1 在 Install 阶段传递总数和当前索引到 `updatePhase`
  - [x] 2.2 格式：`"执行安装... (3/7)"` — 当前项/总项数
- [x] Task 3: 编写单元测试 (AC: #1-3)
  - [x] 3.1 `tests/core/reporter.test.ts` — 扩展 TtyReporter spinner 测试
  - [x] 3.2 测试用例：startPhase 启动 spinner、updatePhase 更新文本、completePhase 停止、stderr 输出验证
  - [x] 3.3 Mock ora 模块

## Dev Notes

### ora v8+ 使用 [Source: project-context.md#Technology-Stack]

```typescript
import ora, { type Ora } from 'ora';

class TtyReporter implements Reporter {
  private spinner: Ora | null = null;

  startPhase(name: string): void {
    this.spinner = ora({
      text: name,
      stream: process.stderr,  // 进度信息 → stderr
    }).start();
  }

  updatePhase(message: string): void {
    if (this.spinner) {
      this.spinner.text = message;
    }
  }

  completePhase(): void {
    this.spinner?.succeed();
    this.spinner = null;
  }
}
```

ora v8+ 是 ESM-only，与项目 ESM 配置兼容。

### 阶段名常量 [Source: data/messages.ts, Story 1.4]

使用 Story 1.4 定义的 `MESSAGES.phases` 常量：
```typescript
import { MESSAGES } from '../data/messages.js';
// MESSAGES.phases.resolve → '解析仓库地址...'
// MESSAGES.phases.auth → '验证认证信息...'
// ...
```

### stderr 输出原则 [Source: architecture/03-core-decisions.md#D4]

进度信息是诊断性质，必须输出到 stderr。这确保 `npx aiforge 2>/dev/null` 只显示结果，`npx aiforge --dry-run 2>/dev/null` 只输出安装计划。

### 模块边界

- 修改 `core/reporter.ts`（完善 TtyReporter 的 spinner 实现）
- 依赖 ora v8+（已在 package.json 中）

### 依赖关系

- 依赖 Story 1.3（Reporter 接口和 TtyReporter 框架）
- 依赖 Story 1.4（`MESSAGES.phases` 阶段名常量）
- 被 Story 5.3（TTY 自适应）依赖

### 本 Story 不做的事

- 不实现非 TTY 环境的进度输出（Story 5.3 的 PlainReporter）
- 不实现 quiet 模式（Story 5.3）
- 不实现进度百分比或进度条（MVP 用 spinner + 计数即可）

### References

- [Source: architecture/03-core-decisions.md#D4] — Reporter 和 stderr 分工
- [Source: architecture/04-implementation-patterns.md] — CLI 输出格式规范
- [Source: project-context.md#Output-Rules] — 进度阶段名格式
- [Source: project-context.md#Technology-Stack] — ora v8+

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

无

### Completion Notes List

**Story 5.1 实现完成（2026-03-31）**

**Task 1 (TtyReporter spinner)：**
- 已在 `src/core/reporter.ts` 中完整实现（Story 1.3 已完成的代码）
- `TtyReporter.startPhase()`: `ora({ text: name, stream: process.stderr }).start()`
- `TtyReporter.updatePhase()`: 更新 `this.spinner.text`，有 spinner 时走 spinner 路径，无 spinner 时 fallback 到 `process.stderr.write`
- `TtyReporter.completePhase()`: `this.spinner.succeed()` 后清空 `this.spinner = null`
- `TtyReporter.reportError()`: 有活跃 spinner 时先调用 `this.spinner.fail()` 显示 ✗，再渲染三段式错误到 stderr

**Task 2 (进度计数)：**
- 修改 `src/stages/execute-install.ts`
- 在主循环前计算 `totalFiles`（排除空 sourceFiles 的 item）
- 声明 `processedCount = 0` 计数器
- 每次实际执行文件操作（非 skipped）后递增计数器
- `reporter.updatePhase(\`执行安装... (${processedCount}/${totalFiles})\`)`
- 覆盖 Files(copy/symlink)、Directories(copy/symlink)、Flatten(copy/symlink) 全部 6 条路径

**Task 3 (测试)：**
- `tests/core/reporter.test.ts`：新增 6 条 TtyReporter spinner 测试（AC #1, #3）
  - startPhase 仅输出到 stderr（不污染 stdout）
  - completePhase 仅输出到 stderr
  - completePhase 显示 ✔ 完成标记
  - reportError 有活跃 spinner 时显示 ✖/✗
  - updatePhase 激活时不触发额外 stderr.write
- `tests/stages/execute-install.test.ts`：新增 3 条进度计数格式测试（AC #2）
  - 3 文件时依次输出 (1/3) (2/3) (3/3)
  - 单文件时输出 (1/1)
  - 格式匹配正则 `/执行安装.*\(n\/total\)/`

**测试统计：**
- Story 本次新增测试：9 条（reporter.test.ts +6, execute-install.test.ts +3）
- 全仓测试：584 passed / 0 failed
- Lint: ✅ All matched files use Prettier code style!
- Build: ✅ ESM Build success

### File List

- `src/stages/execute-install.ts` — 新增 totalFiles 计算、processedCount 计数器，修改所有 updatePhase 调用为进度计数格式
- `tests/core/reporter.test.ts` — 新增 6 条 TtyReporter spinner/stderr 专项测试（AC #1, #3）
- `tests/stages/execute-install.test.ts` — 新增 Story 5.1 进度计数格式测试 describe 块（3 条，AC #2）
