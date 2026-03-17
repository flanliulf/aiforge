# Story 5.1: 阶段式进度与 spinner 动画

Status: ready-for-dev

## Story

As a 用户,
I want 在安装过程中看到实时进度,
So that 知道系统在做什么，不会以为卡住了。

## Acceptance Criteria

1. **Given** TTY 终端环境下执行安装 **When** 管道进入每个阶段 **Then** 显示 ora spinner + 中文阶段名（"解析仓库地址..."、"验证认证信息..."、"克隆仓库..."、"检测 AI 工具..."、"匹配安装规则..."、"执行安装..."）（FR-035），阶段完成时 spinner 停止并显示 ✓ 标记
2. **Given** 安装阶段处理多个文件 **When** 每个文件处理完成 **Then** 更新 spinner 文本显示当前进度（如 "执行安装... (3/7)"）
3. **Given** 进度输出 **When** 检查输出流 **Then** 所有进度信息输出到 stderr（不污染 stdout 的数据流）

## Tasks / Subtasks

- [ ] Task 1: 完善 `TtyReporter` 的 spinner 实现 (AC: #1, #2, #3)
  - [ ] 1.1 在 `startPhase(name)` 中启动 ora spinner，文本为阶段名
  - [ ] 1.2 在 `updatePhase(message)` 中更新 spinner 文本（追加进度信息）
  - [ ] 1.3 在 `completePhase()` 中停止 spinner，显示 ✓ + 阶段名
  - [ ] 1.4 spinner 输出到 stderr：`ora({ stream: process.stderr })`
  - [ ] 1.5 错误时 spinner 显示 ✗ 标记：由 `reportError()` 内部触发——如果当前有活跃 spinner，先调用 `this.spinner.fail()` 显示 ✗，再渲染三段式错误。这是 TtyReporter 的内部实现细节，不需要扩展 Reporter 接口。
- [ ] Task 2: 实现进度计数 (AC: #2)
  - [ ] 2.1 在 Install 阶段传递总数和当前索引到 `updatePhase`
  - [ ] 2.2 格式：`"执行安装... (3/7)"` — 当前项/总项数
- [ ] Task 3: 编写单元测试 (AC: #1-3)
  - [ ] 3.1 `tests/core/reporter.test.ts` — 扩展 TtyReporter spinner 测试
  - [ ] 3.2 测试用例：startPhase 启动 spinner、updatePhase 更新文本、completePhase 停止、stderr 输出验证
  - [ ] 3.3 Mock ora 模块

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

### Debug Log References

### Completion Notes List

### File List
