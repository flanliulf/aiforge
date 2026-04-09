# Story 3.3: dry-run 预览与安装计划输出

Status: done

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

- [x] Task 1: 实现 `Reporter.reportPlan()` 方法 — 安装计划输出 (AC: #2)
  - [x] 1.1 在 `core/reporter.ts` 的 Reporter 接口中确认 `reportPlan(plan: MatchedPlan): void` 方法存在（Story 1.3 已定义）。注意：`architecture/03-core-decisions.md` 的 Reporter 接口代码块中漏掉了 `reportPlan()`，但同文档的 stdout/stderr 分工表已引用该方法——实现时以 Story 1.3 为准，架构文档需同步补齐。
  - [x] 1.2 实现 `TtyReporter.reportPlan()` — 彩色分组输出
  - [x] 1.3 实现 `PlainReporter.reportPlan()` — 纯文本输出（CI 友好）
  - [x] 1.4 实现 `QuietReporter.reportPlan()` — 只输出统计摘要
  - [x] 1.5 所有实现输出到 stdout（可被管道消费）
- [x] Task 2: 完善管道编排器 dry-run 分叉 (AC: #1, #3, #5)
  - [x] 2.1 确认 `pipeline.ts` 中 `dryRun` 分叉逻辑正确（Story 1.5 已搭建骨架）
  - [x] 2.2 替换 Match 阶段占位函数为真实的 `matchRules()` 调用
  - [x] 2.3 替换 Detect 阶段占位函数为真实的 `detectTools()` 调用
  - [x] 2.4 确保 dry-run 路径不触发任何文件写入操作
- [x] Task 3: 实现安装计划格式化 (AC: #2)
  - [x] 3.1 按工具分组展示
  - [x] 3.2 每个文件显示：源路径 → 目标路径
  - [x] 3.3 标注安装类型（files/directories/flatten）
  - [x] 3.4 标注安装模式（copy/symlink）
  - [x] 3.5 底部统计行：`计划安装: N 项 (M 个工具)`
- [x] Task 4: 编写单元测试 (AC: #1-5)
  - [x] 4.1 `tests/stages/report.test.ts` — reportPlan 各 Reporter 实现的输出格式
  - [x] 4.2 `tests/integration/dry-run.test.ts` — 管道 dry-run 路径端到端测试
  - [x] 4.3 验证 dry-run 不产生文件系统副作用

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

claude-sonnet-4.6

### Debug Log References

- `MatchedPlan` 类型扩展：在 `core/types.ts` 的 `MatchedPlan.items` 中新增 `mode: 'copy' | 'symlink'` 字段，由 `matchRules` 阶段负责推导（持有 args 上下文）。
- 模块边界问题：`reporter.ts`（core/）不得从 `data/` 导入，将 `PLAN_STATS_FORMAT` 内联为 `planStatsLine()` 私有函数，保持 `core/` 零外部依赖约束。
- `pipeline.ts` 的 `MatchFn` 类型签名不含 `pathResolver` 参数，无法直接替换为 `matchRules`。解决方案：新增 `createProductionStages(pathResolver)` 工厂函数，通过闭包注入 `pathResolver`，并用共享变量 `lastRepo` 传递 clone 阶段输出给 match 阶段（因 `MatchFn` 签名不含 `repo` 参数）。
- 占位实现（resolve/auth/clone/install）保持不变，由 Epic 2/4 负责替换。

### Completion Notes List

**实现内容：**
1. **`src/core/types.ts`**：`MatchedPlan.items` 新增 `mode: 'copy' | 'symlink'` 字段
2. **`src/core/reporter.ts`**：完整重写 `reportPlan` 三种实现：
   - `TtyReporter`：彩色分组输出，含标题、工具分组、文件树、`[type/mode]` 标注、统计行
   - `PlainReporter`：每行一个文件，`tool  src/file  →  target  type  mode` 格式，CI 友好
   - `QuietReporter`：只输出 `计划安装: N 项 (M 个工具)` 统计摘要
   - 内联 `planStatsLine()` 辅助函数（不引用 data/）
3. **`src/data/messages.ts`**：新增 `PLAN_STATS_FORMAT` 导出函数（供未来 stages/ 使用）
4. **`src/stages/match-rules.ts`**：新增 `getInstallMode()` 推导安装模式（含 `LINK_PROJECT_REJECTED` 校验），为每个 item 注入 `mode` 字段
5. **`src/pipeline.ts`**：新增 `createProductionStages(pathResolver)` 工厂函数，将 detect/match 替换为真实实现；新增 `detectTools`/`matchRules` import

**测试数量：**
- 新增 `tests/stages/report.test.ts`：27 个测试（PlainReporter×12、TtyReporter×9、QuietReporter×6）
- 新增 `tests/integration/dry-run.test.ts`：8 个测试（管道 dry-run 路径、mode 推导、FS 无副作用）
- 全仓测试：401 个（原 366 + 新增 35），全部通过 ✅
- Lint：ESLint 零错误零警告 ✅

### File List

- `src/core/types.ts`（修改）
- `src/core/reporter.ts`（修改）
- `src/data/messages.ts`（修改）
- `src/stages/match-rules.ts`（修改）
- `src/pipeline.ts`（修改）
- `tests/stages/report.test.ts`（新增）
- `tests/integration/dry-run.test.ts`（新增）
