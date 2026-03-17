# Story 4.6b: 安装结果汇总与输出流分工

Status: ready-for-dev

## Story

As a 用户,
I want 看到清晰的安装结果汇总,
So that 知道哪些文件安装成功、更新、跳过或失败。

## Acceptance Criteria

1. **Given** 安装执行完成 **When** Reporter 输出结果 **Then** 按工具分组展示每个文件的状态：✅ 新建、🔄 更新、⏭️ 跳过、❌ 失败，显示统计行 `安装: N 项  更新: N 项  跳过: N 项  失败: N 项`
2. **Given** 安装结果 **When** 检查输出流 **Then** 结果输出到 stdout（可被 `grep`/`awk` 解析），错误输出到 stderr

## Tasks / Subtasks

- [ ] Task 1: 实现 `Reporter.reportResult()` 方法 — 最小可用版本 (AC: #1, #2)
  - [ ] 1.1 实现 `TtyReporter.reportResult()` — 按工具分组逐行输出，状态图标 + 统计行（基础格式，树形美化留给 Epic 5 Story 5.2）
  - [ ] 1.2 实现 `PlainReporter.reportResult()` — 纯文本行输出（CI 友好，可被管道解析）
  - [ ] 1.3 实现 `QuietReporter.reportResult()` — 只输出统计行
  - [ ] 1.4 所有实现：结果 → stdout，错误 → stderr
- [ ] Task 2: 实现结果格式化 — 基础版本 (AC: #1)
  - [ ] 2.1 按工具分组：`Map<string, InstallResult[]>`
  - [ ] 2.2 状态图标映射：使用 `data/messages.ts` 中的 `ICON_NEW`、`ICON_UPDATED`、`ICON_SKIPPED`
  - [ ] 2.3 统计行计算：按 status 分类计数
- [ ] Task 3: 编写单元测试 (AC: #1, #2)
  - [ ] 3.1 `tests/core/reporter.test.ts` — 扩展 reportResult 测试
  - [ ] 3.2 测试用例：单工具结果、多工具分组、全部成功、有失败项、统计行正确性
  - [ ] 3.3 捕获 stdout/stderr 输出验证流分工

## Dev Notes

### 结果输出格式

TtyReporter（彩色终端）：
```
🔧 GitHub Copilot
  ✅ agents/coding-agent.md     → ~/.copilot/agents/coding-agent.md
  🔄 agents/review-agent.md     → ~/.copilot/agents/review-agent.md
  ⏭️ skills/refactor/           → ~/.copilot/skills/refactor/

🔧 Claude Code
  ✅ instructions/CLAUDE.md     → ~/.claude/instructions/CLAUDE.md
  ❌ mcp-tools/server.json      → ~/.claude/mcp-tools/server.json
     错误: 权限不足

安装: 2 项  更新: 1 项  跳过: 1 项  失败: 1 项
```

PlainReporter（CI/管道）：
```
new     copilot  agents/coding-agent.md  ~/.copilot/agents/coding-agent.md
updated copilot  agents/review-agent.md  ~/.copilot/agents/review-agent.md
skipped copilot  skills/refactor/        ~/.copilot/skills/refactor/
new     claude   instructions/CLAUDE.md  ~/.claude/instructions/CLAUDE.md
failed  claude   mcp-tools/server.json   ~/.claude/mcp-tools/server.json
---
installed: 2  updated: 1  skipped: 1  failed: 1
```

### stdout/stderr 分工 [Source: architecture/03-core-decisions.md#D4]

| 方法 | 输出流 | 理由 |
|------|--------|------|
| `reportResult()` | stdout | 安装结果可被管道消费 |
| `reportPlan()` | stdout | dry-run 计划同理 |
| `reportError()` | stderr | 错误信息写 stderr 是 CLI 标准 |
| `startPhase()` | stderr | 进度信息是诊断性质 |

### 统计行计算

```typescript
function buildStats(results: InstallResult[]): Stats {
  return {
    installed: results.filter(r => r.status === 'new').length,
    updated: results.filter(r => r.status === 'updated').length,
    skipped: results.filter(r => r.status === 'skipped').length,
    failed: results.filter(r => r.status === 'failed').length,
  };
}
```

### 使用 data/messages.ts 的常量 [Source: Story 1.4]

```typescript
import { ICON_NEW, ICON_UPDATED, ICON_SKIPPED, ICON_FAILED, STATS_TEMPLATE } from '../data/messages.js';

const STATUS_ICONS: Record<string, string> = {
  new: ICON_NEW,       // ✅
  updated: ICON_UPDATED, // 🔄
  skipped: ICON_SKIPPED, // ⏭️
  failed: ICON_FAILED,   // ❌
};
```

### 模块边界

- 修改 `core/reporter.ts`（实现 reportResult 方法）
- 可能创建 `src/stages/report.ts`（如果格式化逻辑复杂）
- 依赖 `data/messages.ts`（图标和模板常量）

### 依赖关系

- 依赖 Story 1.3（Reporter 接口和三种实现框架）
- 依赖 Story 1.4（`ICON_*` 常量、`STATS_TEMPLATE`）
- 依赖 Story 4.6a（管道编排调用 reportResult）
- 被 Epic 5（输出体验优化）进一步完善

### 本 Story 不做的事

- 不实现 spinner 动画（Story 5.1）
- 不实现树形结构的高级格式化（Story 5.2）——本 Story 只做逐行输出 + 统计行的基础版本
- 不实现 TTY 自适应和 quiet 模式的完整逻辑（Story 5.3）——本 Story 的 QuietReporter 只输出统计行
- 不实现三段式错误信息的完整渲染（Story 5.4）

> **与 Epic 5 的边界**：本 Story 交付最小可用的 `reportResult()` 实现（按工具分组逐行输出 + 统计行），确保安装结果可见。Epic 5 在此基础上增强为树形美化、彩色高亮、TTY 自适应等完整输出体验。

### References

- [Source: architecture/03-core-decisions.md#D4] — Reporter 接口和 stdout/stderr 分工
- [Source: architecture/04-implementation-patterns.md] — CLI 输出格式规范
- [Source: project-context.md#Output-Rules] — Reporter 输出规则和状态图标

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
