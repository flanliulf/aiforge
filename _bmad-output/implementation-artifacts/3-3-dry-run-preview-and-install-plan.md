# Story 3.3: dry-run 预览与安装计划输出

Status: ready-for-dev

## Story

As a 用户,
I want 在实际安装前预览完整的安装计划,
So that 知道会发生什么，建立对工具的信任。

## Acceptance Criteria

1. **Given** 用户运行 `npx aiforge --dry-run` **When** 管道执行到 Match 阶段完成 **Then** 跳过 Install 阶段，直接将 `MatchedPlan` 传给 Reporter（FR-034），管道在 Match 后分叉
2. **Given** dry-run 模式 **When** Reporter 输出安装计划 **Then** 按工具分组展示每个文件的源路径和目标路径，标注安装类型和模式，输出到 stdout
3. **Given** dry-run 模式 **When** 检查文件系统 **Then** 没有任何文件被写入、复制或创建
4. **Given** dry-run 输出的安装计划 **When** 与实际安装结果对比 **Then** 两者一致（NFR-U5）
5. **Given** dry-run 模式下管道执行 **When** 检查管道编排器 **Then** Detect → Match 阶段使用真实实现，dry-run 在 Match 后分叉调用 `reportPlan()`，Install 阶段被跳过。Resolve → Auth → Clone 阶段的真实接入由 Epic 2 完成后自然生效，本 Story 验收不要求前序阶段为真实实现。

## Tasks / Subtasks

- [ ] Task 1: 实现 `Reporter.reportPlan()` 方法 — 安装计划输出 (AC: #2)
  - [ ] 1.1 在 `core/reporter.ts` 的 Reporter 接口中确认 `reportPlan(plan: MatchedPlan): void` 方法存在（Story 1.3 已定义）。注意：`architecture/03-core-decisions.md` 的 Reporter 接口代码块中漏掉了 `reportPlan()`，但同文档的 stdout/stderr 分工表已引用该方法——实现时以 Story 1.3 为准，架构文档需同步补齐。
  - [ ] 1.2 实现 `TtyReporter.reportPlan()` — 彩色分组输出
  - [ ] 1.3 实现 `PlainReporter.reportPlan()` — 纯文本输出（CI 友好）
  - [ ] 1.4 实现 `QuietReporter.reportPlan()` — 只输出统计摘要
  - [ ] 1.5 所有实现输出到 stdout（可被管道消费）
- [ ] Task 2: 完善管道编排器 dry-run 分叉 (AC: #1, #3, #5)
  - [ ] 2.1 确认 `pipeline.ts` 中 `dryRun` 分叉逻辑正确（Story 1.5 已搭建骨架）
  - [ ] 2.2 替换 Match 阶段占位函数为真实的 `matchRules()` 调用
  - [ ] 2.3 替换 Detect 阶段占位函数为真实的 `detectTools()` 调用
  - [ ] 2.4 确保 dry-run 路径不触发任何文件写入操作
- [ ] Task 3: 实现安装计划格式化 (AC: #2)
  - [ ] 3.1 按工具分组展示
  - [ ] 3.2 每个文件显示：源路径 → 目标路径
  - [ ] 3.3 标注安装类型（files/directories/flatten）
  - [ ] 3.4 标注安装模式（copy/symlink）
  - [ ] 3.5 底部统计行：`计划安装: N 项 (M 个工具)`
- [ ] Task 4: 编写单元测试 (AC: #1-5)
  - [ ] 4.1 `tests/stages/report.test.ts` — reportPlan 各 Reporter 实现的输出格式
  - [ ] 4.2 `tests/integration/dry-run.test.ts` — 管道 dry-run 路径端到端测试
  - [ ] 4.3 验证 dry-run 不产生文件系统副作用

## Dev Notes

### dry-run 管道分叉 [Source: architecture/03-core-decisions.md#D6]

```
正常模式: Resolve → Auth → Clone → Detect → Match → Install → Report(results)
dry-run:  Resolve → Auth → Clone → Detect → Match → Report(plan)
```

Story 1.5 已搭建骨架，本 Story 将 Detect 和 Match 阶段的占位函数替换为真实实现，并完善 reportPlan。

```typescript
// pipeline.ts 中的关键分叉（已有骨架）
const plan = await match(env, args, reporter);

if (!args.dryRun) {
  const result = await install(plan, args, reporter);
  reporter.reportResult(result);
} else {
  reporter.reportPlan(plan);  // ← 本 Story 实现此方法
}
```

### reportPlan 输出格式

TtyReporter（彩色终端）：
```
📋 安装计划预览 (dry-run)

🔧 GitHub Copilot (全局)
  agents/
    ├── coding-agent.md     → ~/.copilot/agents/coding-agent.md      [files/copy]
    └── review-agent.md     → ~/.copilot/agents/review-agent.md      [files/copy]
  skills/
    ├── refactor/           → ~/.copilot/skills/refactor/            [directories/copy]
    └── testing/            → ~/.copilot/skills/testing/             [directories/copy]

🔧 Claude Code (全局)
  instructions/
    └── CLAUDE.md           → ~/.claude/instructions/CLAUDE.md       [files/copy]

计划安装: 5 项 (2 个工具)
```

PlainReporter（CI/管道）：
```
copilot  agents/coding-agent.md  →  ~/.copilot/agents/coding-agent.md  files  copy
copilot  agents/review-agent.md  →  ~/.copilot/agents/review-agent.md  files  copy
copilot  skills/refactor/        →  ~/.copilot/skills/refactor/        directories  copy
```

纯文本格式可被 `grep`/`awk` 解析。

### stdout/stderr 分工 [Source: architecture/03-core-decisions.md#D4]

- `reportPlan()` → stdout（安装计划是数据输出，支持管道消费）
- `startPhase()` → stderr（进度信息是诊断性质）

这确保 `npx aiforge --dry-run 2>/dev/null` 只输出纯安装计划。

### 安装模式确定

dry-run 必须与真实安装共享同一套参数校验，不能在预览时放宽规则。

- `scope === 'project' && args.link` → **必须报错**，抛出 `AiforgeError(code: 'LINK_PROJECT_REJECTED', severity: 'fatal')`，提示 `-l` 仅支持全局安装（FR-021，project-context.md 明确要求）
- `args.link && scope === 'global'` → symlink
- 否则 → copy

```typescript
function getInstallMode(args: ParsedArgs, scope: 'global' | 'project'): 'copy' | 'symlink' {
  if (args.link && scope === 'project') {
    throw new AiforgeError(
      '符号链接模式不支持项目级安装',
      'LINK_PROJECT_REJECTED',
      3,
      'fatal',
      '-l/--link 仅支持全局安装模式（-g）',
      ['npx aiforge -g -l <repo>  # 全局 + 符号链接']
    );
  }
  if (args.link && scope === 'global') return 'symlink';
  return 'copy';
}
```

### 管道阶段替换

本 Story 需要将 pipeline.ts 中以下占位函数替换为真实调用：
- `detect` → `import { detectTools } from './stages/detect-tools.js'`
- `match` → `import { matchRules } from './stages/match-rules.js'`

Resolve、Auth、Clone 阶段的替换由 Epic 2 的 Story 负责。本 Story 中这些阶段保持占位不影响验收——验收重点是 Detect + Match + Reporter 分叉路径的正确性。

### 模块边界

- 修改 `core/reporter.ts`（添加 reportPlan 实现）
- 修改 `pipeline.ts`（替换占位函数）
- 可能创建 `src/stages/report.ts`（如果格式化逻辑复杂，从 reporter 中分离）

### 依赖关系

- 依赖 Story 1.3（`Reporter` 接口和三种实现）
- 依赖 Story 1.5（管道编排器骨架和 dry-run 分叉）
- 依赖 Story 3.1（`detectTools` 真实实现）
- 依赖 Story 3.2（`matchRules` 真实实现、`MatchedPlan` 数据）
- 被 Epic 4（安装执行）依赖（共享 MatchedPlan 数据结构）

### 本 Story 不做的事

- 不实现 Install 阶段（Epic 4）
- 不实现 reportResult（安装结果输出，Epic 4/5）
- 不实现冲突检测预览（Story 4.4/4.5）
- 不替换 Resolve/Auth/Clone 占位函数（Epic 2 负责）

### References

- [Source: architecture/03-core-decisions.md#D6] — dry-run 管道分叉
- [Source: architecture/03-core-decisions.md#D4] — Reporter 接口和 stdout/stderr 分工
- [Source: architecture/04-implementation-patterns.md] — CLI 输出格式规范
- [Source: architecture/05-project-structure.md] — 数据流 MatchedPlan → Reporter
- [Source: project-context.md#Output-Rules] — Reporter 输出规则

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
