# Story 5.3: TTY 自适应与 quiet 模式

Status: ready-for-dev

## Story

As a 用户,
I want 系统根据终端环境自动调整输出格式,
So that 在 CI 管道中也能正常工作，在脚本中输出可解析。

## Acceptance Criteria

1. **Given** 非 TTY 环境（如 `npx aiforge | grep copilot`）**When** 执行安装 **Then** 自动禁用 spinner 和 ANSI 彩色码（FR-038，NFR-U4），输出纯文本行可被 `grep`/`awk` 解析
2. **Given** 用户指定 `--quiet` **When** 执行安装 **Then** 只输出关键信息：最终成功/失败状态 + 统计行（FR-039），不显示进度 spinner 和逐文件详情
3. **Given** `npx aiforge --dry-run 2>/dev/null` **When** 执行 **Then** stdout 只输出纯安装计划，无进度信息
4. **Given** 非 TTY 环境下遇到需要用户决策的场景 **When** 需要交互 **Then** 验证 Epic 4 Story 4.5 的非 TTY 冲突策略在 CLI 层正确生效（直接失败，exit code 非 0）。本 Story 不重新定义冲突处理规则，只确保 Reporter/CLI 层行为一致。

## Tasks / Subtasks

- [ ] Task 1: 完善 Reporter 工厂函数 `createReporter` (AC: #1, #2)
  - [ ] 1.1 检测逻辑：`--quiet` → QuietReporter；`!process.stdout.isTTY` → PlainReporter；否则 → TtyReporter
  - [ ] 1.2 确保工厂函数在 `index.ts` 中正确调用
- [ ] Task 2: 完善 `PlainReporter` 实现 (AC: #1, #3)
  - [ ] 2.1 `startPhase()` → 输出纯文本行到 stderr（如 `[PHASE] 解析仓库地址...`）
  - [ ] 2.2 `updatePhase()` → 不输出（避免刷屏）
  - [ ] 2.3 `completePhase()` → 输出 `[DONE] 阶段名`
  - [ ] 2.4 `reportResult()` → 制表符分隔纯文本到 stdout
  - [ ] 2.5 `reportPlan()` → 制表符分隔纯文本到 stdout
  - [ ] 2.6 `reportError()` → 纯文本三段式到 stderr
  - [ ] 2.7 无 ANSI 转义码、无 spinner、无 emoji（CI 兼容）
- [ ] Task 3: 完善 `QuietReporter` 实现 (AC: #2)
  - [ ] 3.1 `startPhase()` → 不输出
  - [ ] 3.2 `updatePhase()` → 不输出
  - [ ] 3.3 `completePhase()` → 不输出
  - [ ] 3.4 `reportResult()` → 只输出统计行到 stdout
  - [ ] 3.5 `reportPlan()` → 只输出计划摘要（N 项，M 个工具）
  - [ ] 3.6 `reportError()` → 输出错误到 stderr（错误不能被静默）
- [ ] Task 4: 编写单元测试 (AC: #1-4)
  - [ ] 4.1 `tests/core/reporter.test.ts` — 扩展 PlainReporter 和 QuietReporter 测试
  - [ ] 4.2 测试用例：PlainReporter 无 ANSI 码、QuietReporter 只输出统计、createReporter 工厂选择逻辑
  - [ ] 4.3 Mock `process.stdout.isTTY`

## Dev Notes

### Reporter 选择逻辑 [Source: architecture/03-core-decisions.md#D4]

> **重要**：`createReporter` 保持 Story 1.3 定义的签名 `createReporter(options: { quiet: boolean; isTty: boolean }): Reporter`，不接受 `ParsedArgs`（避免 core 层反向依赖 CLI 层类型）。在 `index.ts` 中从 `ParsedArgs` 提取参数后传入：

```typescript
// index.ts 中调用
const reporter = createReporter({
  quiet: args.quiet,
  isTty: process.stdout.isTTY ?? false,
});

// core/reporter.ts 中实现（签名不变）
export function createReporter(options: { quiet: boolean; isTty: boolean }): Reporter {
  if (options.quiet) return new QuietReporter();
  if (!options.isTty) return new PlainReporter();
  return new TtyReporter();
}
```

| 条件 | Reporter | 行为 |
|------|----------|------|
| `--quiet` | QuietReporter | 只输出统计行和错误 |
| 非 TTY | PlainReporter | 纯文本，无颜色/spinner |
| TTY | TtyReporter | spinner + 彩色 + 树形 |

### PlainReporter 输出示例

```
[PHASE] 解析仓库地址...
[DONE] 解析仓库地址
[PHASE] 验证认证信息...
[DONE] 验证认证信息
...
new	copilot	agents/coding-agent.md	~/.copilot/agents/coding-agent.md
updated	copilot	agents/review-agent.md	~/.copilot/agents/review-agent.md
---
installed: 1	updated: 1	skipped: 0
```

### QuietReporter 输出示例

```
安装: 3 项  更新: 1 项  跳过: 1 项
```

错误时：
```
❌ 无法访问仓库
   Git 服务器返回 401
   npx aiforge --ssh
```

### 模块边界

- 修改 `core/reporter.ts`（完善 PlainReporter 和 QuietReporter）
- 修改 `index.ts`（确保 createReporter 正确调用）

### 依赖关系

- 依赖 Story 1.3（Reporter 接口和三种实现框架）
- 依赖 Story 5.1（TtyReporter spinner 实现）
- 依赖 Story 5.2（reportResult 树形输出）

### 本 Story 不做的事

- 不实现 JSON 输出模式（`--json`）
- 不实现日志级别控制（`--verbose`）
- 不实现输出到文件（`--log-file`）

### References

- [Source: architecture/03-core-decisions.md#D4] — Reporter 三种实现和选择逻辑
- [Source: project-context.md#Output-Rules] — Reporter 输出规则
- [Source: project-context.md#Critical-Dont-Miss-Rules] — 非 TTY 环境处理

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
