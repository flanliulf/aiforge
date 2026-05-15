# Story 5.2: 树形结果汇总与统计

Status: done

## Story

As a 用户,
I want 安装完成后看到按工具分组的树形结果,
So that 一目了然地知道每个工具安装了什么。

## Acceptance Criteria

1. **Given** 安装完成，涉及多个工具 **When** Reporter 输出结果 **Then** 按工具分组展示树形结构（FR-036），每个工具显示安装项数
2. **Given** 结果汇总 **When** 所有文件展示完毕 **Then** 显示统计行：`安装: 7 项  更新: 1 项  跳过: 1 项`
3. **Given** 结果输出 **When** 检查输出流 **Then** 树形结果和统计行输出到 stdout

## Tasks / Subtasks

- [x] Task 1: 完善 `TtyReporter.reportResult()` — 树形彩色输出 (AC: #1-3)
  - [x] 1.1 按工具分组 `InstallResult[]`
  - [x] 1.2 每个工具组标题：工具显示名 + 项数（使用 chalk 着色）
  - [x] 1.3 树形缩进：`├──` 和 `└──` 连接符
  - [x] 1.4 每行：状态图标 + 源路径 → 目标路径
  - [x] 1.5 底部统计行使用 chalk 着色
  - [x] 1.6 输出到 stdout
- [x] Task 2: 完善 `PlainReporter.reportResult()` — 纯文本输出 (AC: #3)
  - [x] 2.1 制表符分隔格式：`status\ttool\tsource\ttarget`
  - [x] 2.2 底部统计行：`installed: N  updated: N  skipped: N`
  - [x] 2.3 无颜色、无树形符号，可被 `grep`/`awk`/`cut` 解析
- [x] Task 3: 编写单元测试 (AC: #1-3)
  - [x] 3.1 扩展 `tests/core/reporter.test.ts`
  - [x] 3.2 测试用例：单工具树形、多工具分组、统计行计算、stdout 输出验证
  - [x] 3.3 捕获 stdout 输出进行格式验证

## Dev Notes

### 与 Story 4.6b 的边界

Story 4.6b 提供最小可用的 `reportResult()` 实现（按工具分组逐行输出 + 统计行）。本 Story 在此基础上增强 TtyReporter 为树形展示（`├──`/`└──` 连接符 + chalk 着色）。PlainReporter 的制表符分隔格式已在 4.6b 中完成，本 Story 不重复实现，只在需要时微调格式。

### 树形输出格式 [Source: FR-036]

TtyReporter：
```
🔧 GitHub Copilot (4 项)
  ├── ✅ agents/coding-agent.md     → ~/.copilot/agents/coding-agent.md
  ├── ✅ agents/review-agent.md     → ~/.copilot/agents/review-agent.md
  ├── 🔄 skills/refactor/           → ~/.copilot/skills/refactor/
  └── ⏭️ skills/testing/            → ~/.copilot/skills/testing/

🔧 Claude Code (2 项)
  ├── ✅ instructions/CLAUDE.md     → ~/.claude/instructions/CLAUDE.md
  └── ✅ mcp-tools/server.json      → ~/.claude/mcp-tools/server.json

安装: 5 项  更新: 1 项  跳过: 1 项
```

### chalk v5+ 使用 [Source: project-context.md#Technology-Stack]

```typescript
import chalk from 'chalk';

const toolHeader = chalk.bold(`🔧 ${toolName} (${count} 项)`);
const newItem = chalk.green(`✅ ${source} → ${target}`);
const statsLine = `${chalk.green(`安装: ${chalk.green(stats.installed)} 项`)}  ${chalk.blue(`更新: ${chalk.blue(stats.updated)} 项`)}  ${chalk.gray(`跳过: ${chalk.yellow(stats.skipped)} 项`)}`;
// 双层语义：明细行 skipped=green（成功）；汇总数字 skipped=yellow（需关注）
```

chalk v5+ 是 ESM-only，与项目配置兼容。

### 工具显示名映射

使用 `TOOL_DEFINITIONS` 中的 `name` 字段：
```typescript
const toolName = TOOL_DEFINITIONS.find(t => t.id === toolId)?.name || toolId;
```

### 模块边界

- 修改 `core/reporter.ts`（完善 reportResult 的树形输出）
- 依赖 chalk v5+、`data/messages.ts`、`data/tool-registry.ts`

### 依赖关系

- 依赖 Story 1.3（Reporter 框架）
- 依赖 Story 1.4（图标常量、工具注册表）
- 依赖 Story 4.6b（reportResult 基础实现）
- 被 Story 5.3（TTY 自适应完善）依赖

### 本 Story 不做的事

- 不实现结果的文件导出（如 JSON 输出）
- 不实现结果的交互式浏览
- 不实现路径缩短（如 `~` 替代 home 路径）— 可作为后续优化

### References

- [Source: architecture/03-core-decisions.md#D4] — Reporter stdout/stderr 分工
- [Source: architecture/04-implementation-patterns.md] — CLI 输出格式规范
- [Source: project-context.md#Output-Rules] — 状态图标和统计行格式
- [Source: project-context.md#Technology-Stack] — chalk v5+

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

无

### Completion Notes List

- **Task 1 (TtyReporter.reportResult 树形输出)**：
  - 在 `src/core/reporter.ts` 中增强 `TtyReporter.reportResult()`：工具标题行追加项数 `(N 项)`，每个工具组内文件行使用 `├──`/`└──` 树形连接符
  - chalk 着色（TTY 双层语义）：工具标题用 `chalk.bold`；**明细行**按状态着色（`new → chalk.green`，`updated → chalk.blue`，`skipped → chalk.green` 同 new，成功语义）；**汇总数字**按语义着色（安装=green、更新=blue、跳过=yellow）——yellow 仅作用于「跳过数量」提示「需关注」；明细行超 5 条折叠为「… 其余 N 项已折叠」（`MAX_TTY_RESULT_DETAILS_PER_TOOL = 5`）
  - 输出到 stdout，符合 Reporter stdout/stderr 分工规范（architecture/03-core-decisions.md#D4）

- **Task 2 (PlainReporter.reportResult)**：4.6b 已完整实现，本 Story 无需改动

- **Task 3 (单元测试)**：
  - 在 `tests/core/reporter.test.ts` 中新增 11 个 TtyReporter 测试用例：
    - **树形结构测试（Story 初始实现，6 个）：**
      1. 工具标题包含项数 `(N 项)`
      2. 多工具各自显示正确项数
      3. 非最后一项使用 `├──`
      4. 最后一项使用 `└──`
      5. 多项工具下同时存在 `├──` 和 `└──`
      6. 单文件时只有 `└──` 无 `├──`
    - **颜色语义测试（CR 修复新增，5 个）：**
      7. 工具标题使用 chalk.bold（ANSI bold 码验证）
      8. new 状态行使用 chalk.green（ANSI green 码验证）
      9. updated 状态行使用 chalk.blue（ANSI blue 码验证）
      10. skipped 状态明细行使用 chalk.green（ANSI green 码验证）；汇总数字「跳过: N 项」中的数字使用 chalk.yellow（ANSI yellow 码验证）
      11. 统计行安装部分使用 chalk.green（ANSI green 码验证）

- **质量门禁验证**：
  - `npm test`：595 passed，28 test files，零回归 ✅（原 590 + CR 修复新增 5 个颜色语义测试）
  - `npm run lint`：ESLint + Prettier 全部通过 ✅
  - `npm run build`：ESM build success ✅

### File List

- `src/core/reporter.ts` — 增强 `TtyReporter.reportResult()`（树形连接符 + 工具项数标题 + chalk 彩色语义）
- `tests/core/reporter.test.ts` — 新增 11 个测试用例（6 个树形结构 + 5 个颜色语义）
- `_bmad-output/project-context.md` — Output Rules：移除 `❌ failed` 图标和统计行 `失败: N 项`（CR 修复）
- `_bmad-output/planning-artifacts/architecture/04-implementation-patterns.md` — 结果状态图标和统计行：移除 `❌ 失败`（CR 修复）
- `_bmad-output/planning-artifacts/architecture/03-core-decisions.md` — Reporter 接口和 Stage 类型签名：`InstallResult[]` → `InstallResult`（CR 修复）

---

## 后续修订（2026-04-24 UX 收敛）

> 本次修订源于 TTY 颜色双层语义及明细折叠阈值。已原地更新上文 chalk 代码示例、Dev Notes、AC #10，本块保留变更对照供审计追溯。

| 章节 / 行 | 变更前 | 变更后 | 依据 |
|----------|--------|--------|------|
| chalk 使用示例（L65） | `跳过: ${stats.skipped}` 整体 chalk.gray | 明细行 skipped=green；汇总数字 skipped=yellow（仅数字，異口 「需关注」） | 代码：src/core/reporter.ts |
| Dev Notes·chalk 着色（L116） | skipped=gray、跳过=gray | 明细行与汇总数字双层语义分离；补充明细超 5 条折叠 | 代码：src/core/reporter.ts `MAX_TTY_RESULT_DETAILS_PER_TOOL=5` |
| AC #10（L134） | skipped 状态行=chalk.gray | skipped 明细行=chalk.green；汇总「跳过」数字=chalk.yellow | 测试：tests/core/reporter.test.ts |
