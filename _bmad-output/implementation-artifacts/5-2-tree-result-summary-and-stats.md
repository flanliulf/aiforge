# Story 5.2: 树形结果汇总与统计

Status: ready-for-dev

## Story

As a 用户,
I want 安装完成后看到按工具分组的树形结果,
So that 一目了然地知道每个工具安装了什么。

## Acceptance Criteria

1. **Given** 安装完成，涉及多个工具 **When** Reporter 输出结果 **Then** 按工具分组展示树形结构（FR-036），每个工具显示安装项数
2. **Given** 结果汇总 **When** 所有文件展示完毕 **Then** 显示统计行：`安装: 7 项  更新: 1 项  跳过: 1 项  失败: 0 项`
3. **Given** 结果输出 **When** 检查输出流 **Then** 树形结果和统计行输出到 stdout

## Tasks / Subtasks

- [ ] Task 1: 完善 `TtyReporter.reportResult()` — 树形彩色输出 (AC: #1-3)
  - [ ] 1.1 按工具分组 `InstallResult[]`
  - [ ] 1.2 每个工具组标题：工具显示名 + 项数（使用 chalk 着色）
  - [ ] 1.3 树形缩进：`├──` 和 `└──` 连接符
  - [ ] 1.4 每行：状态图标 + 源路径 → 目标路径
  - [ ] 1.5 failed 项额外显示红色错误信息
  - [ ] 1.6 底部统计行使用 chalk 着色
  - [ ] 1.7 输出到 stdout
- [ ] Task 2: 完善 `PlainReporter.reportResult()` — 纯文本输出 (AC: #3)
  - [ ] 2.1 制表符分隔格式：`status\ttool\tsource\ttarget`
  - [ ] 2.2 底部统计行：`installed: N  updated: N  skipped: N  failed: N`
  - [ ] 2.3 无颜色、无树形符号，可被 `grep`/`awk`/`cut` 解析
- [ ] Task 3: 编写单元测试 (AC: #1-3)
  - [ ] 3.1 扩展 `tests/core/reporter.test.ts`
  - [ ] 3.2 测试用例：单工具树形、多工具分组、统计行计算、stdout 输出验证
  - [ ] 3.3 捕获 stdout 输出进行格式验证

## Dev Notes

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
  └── ❌ mcp-tools/server.json      → ~/.claude/mcp-tools/server.json
       权限不足

安装: 3 项  更新: 1 项  跳过: 1 项  失败: 1 项
```

### chalk v5+ 使用 [Source: project-context.md#Technology-Stack]

```typescript
import chalk from 'chalk';

const toolHeader = chalk.bold(`🔧 ${toolName} (${count} 项)`);
const newItem = chalk.green(`✅ ${source} → ${target}`);
const failedItem = chalk.red(`❌ ${source} → ${target}`);
const statsLine = `${chalk.green(`安装: ${stats.installed} 项`)}  ${chalk.blue(`更新: ${stats.updated} 项`)}  ${chalk.gray(`跳过: ${stats.skipped} 项`)}  ${chalk.red(`失败: ${stats.failed} 项`)}`;
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

### Debug Log References

### Completion Notes List

### File List
