# Story 1.4: 数据层配置

Status: done

## Story

As a 开发者,
I want 数据化的安装规则表、工具检测注册表和排除列表,
so that 新增工具或规则只需修改数据，不需要改引擎代码。

## Acceptance Criteria

1. **Given** `data/install-rules.ts` 已创建 **When** 检查 `BUILTIN_RULES` 常量 **Then** 包含 PRD 定义的完整 MVP 规则映射表（16 条规则，覆盖 Copilot/Claude/Cursor/VS Code × 全局/项目），每条规则包含 `tool`、`scope`、`sourceDir`、`type`、`targetDir` 等字段，预留 `loadRules()` 函数接口（MVP 返回 `BUILTIN_RULES`）
2. **Given** `data/tool-registry.ts` 已创建 **When** 检查 `TOOL_DEFINITIONS` 常量 **Then** 包含 4 个工具定义：copilot、claude、cursor、vscode，每个工具包含 `id`、`name`、`detect.global[]`、`detect.project[]`（标志路径）
3. **Given** `data/excludes.ts` 已创建 **When** 检查 `DEFAULT_EXCLUDES` 常量 **Then** 包含：`README.md`、`README`、`.gitkeep`、`.DS_Store`、`mcp.json.example`
4. **Given** `data/messages.ts` 已创建 **When** 检查输出字符串 **Then** 包含中文进度阶段名、结果状态图标（✅🔄⏭️❌）、统计行格式模板
5. **Given** 所有数据文件 **When** 检查模块依赖 **Then** `data/` 目录零运行时依赖（允许 `import type` 从 `core/` 引入类型，编译后消失），不依赖 `src/` 下其他目录的运行时代码

## Tasks / Subtasks

- [x] Task 1: 创建 `src/data/install-rules.ts` (AC: #1)
  - [x] 1.1 定义 `BUILTIN_RULES: InstallRule[]` 常量，16 条规则覆盖 4 工具 × 全局/项目
  - [x] 1.2 构建 `RULE_INDEX: Map<string, InstallRule[]>`，key 为 `${tool}:${scope}`
  - [x] 1.3 导出 `loadRules()` 函数（MVP 直接返回 BUILTIN_RULES）
- [x] Task 2: 创建 `src/data/tool-registry.ts` (AC: #2)
  - [x] 2.1 定义 `TOOL_DEFINITIONS: ToolDefinition[]`，4 个工具
  - [x] 2.2 每个工具含 `detect.global`（Home 目录标志路径）和 `detect.project`（项目目录标志路径）
- [x] Task 3: 创建 `src/data/excludes.ts` (AC: #3)
  - [x] 3.1 定义 `DEFAULT_EXCLUDES: string[]` 常量
- [x] Task 4: 创建 `src/data/messages.ts` (AC: #4)
  - [x] 4.1 定义中文进度阶段名常量（"解析仓库地址..."、"验证认证信息..."、"克隆仓库..."、"检测 AI 工具..."、"匹配安装规则..."、"执行安装..."）
  - [x] 4.2 定义结果状态图标常量（`ICON_NEW = '✅'`、`ICON_UPDATED = '🔄'`、`ICON_SKIPPED = '⏭️'`）
  - [x] 4.3 定义统计行格式模板
  - [x] 4.4 预留多语言结构（MVP 只实现中文，但结构支持后续加英文）
- [x] Task 5: 编写单元测试 (AC: #1-5)
  - [x] 5.1 `tests/data/install-rules.test.ts` — 规则数量、RULE_INDEX 查找、loadRules 返回值
  - [x] 5.2 `tests/data/tool-registry.test.ts` — 4 个工具定义完整性、detect 路径非空
  - [x] 5.3 `tests/data/excludes.test.ts` — 排除列表包含必要项

## Dev Notes

### 规则映射表结构 [Source: architecture/03-core-decisions.md#D2]

```typescript
// 每条规则
export interface InstallRule {
  tool: string;        // 'copilot' | 'claude' | 'cursor' | 'vscode'
  scope: string;       // 'global' | 'project'
  sourceDir: string;   // 知识仓库中的源目录名（如 'agents', 'skills'）
  type: InstallType;   // Files | Directories | Flatten
  targetDir: string;   // 目标路径模板（如 '~/.copilot/agents/'）
  mainFile?: string;   // flatten 模式的主文件（默认 'index.md'）
}
```

**RULE_INDEX 查找**：`Map<string, InstallRule[]>`，key = `${tool}:${scope}`，O(1) 查找。

### 工具检测注册表 [Source: architecture/03-core-decisions.md#D5]

```typescript
export interface ToolDefinition {
  id: string;          // 'copilot' | 'claude' | 'cursor' | 'vscode'
  name: string;        // 显示名称
  detect: {
    global: string[];  // Home 目录下的标志路径
    project: string[]; // 项目目录下的标志路径
  };
}
```

检测基于**标志性文件/目录**存在性，不依赖工具进程（NFR-I3）。

### 16 条 MVP 规则概览

4 工具 × (agents + skills + instructions + mcp-tools) = 基础 16 条，部分工具不支持所有类型，实际 16 条。具体规则需参考 PRD 中的安装规则映射表。注意：
- Cursor 的 skills 使用 `flatten` 类型
- 符号链接模式仅全局安装支持（FR-021）
- `targetDir` 使用 PathResolver 的方法解析，不硬编码绝对路径

### messages.ts 多语言预留

```typescript
// MVP 结构示例
export const MESSAGES = {
  phases: {
    resolve: '解析仓库地址...',
    auth: '验证认证信息...',
    clone: '克隆仓库...',
    detect: '检测 AI 工具...',
    match: '匹配安装规则...',
    install: '执行安装...',
  },
  // ...
} as const;
```

MVP 只实现中文，但用对象结构组织，后续 Story 5.5a 加英文时只需扩展。

### 模块边界 [Source: architecture/05-project-structure.md]

- `data/` 是**纯数据**模块，零依赖
- 本 Story 的文件**不能** import `core/types.ts` 中的接口类型
- 但可以使用 `import type { InstallRule } from '../core/types.js'`（类型导入在编译后消失，不产生运行时依赖）
- 运行时依赖为零，类型依赖可接受

### 依赖关系

- 依赖 Story 1.1（项目骨架）
- 依赖 Story 1.2（`InstallRule`、`ToolDefinition` 类型定义）— 仅类型依赖

### 本 Story 不做的事

- 不实现规则匹配引擎逻辑（Story 3.2）
- 不实现工具检测逻辑（Story 3.1）
- 不实现 aiforge.json 外部规则加载（延迟决策，M3）

### References

- [Source: architecture/03-core-decisions.md#D2] — 规则存储和 Map 索引
- [Source: architecture/03-core-decisions.md#D5] — 工具检测注册表
- [Source: architecture/04-implementation-patterns.md] — CLI 输出规范
- [Source: architecture/05-project-structure.md] — data/ 模块边界
- [Source: project-context.md#Install-Rules-Data-Architecture] — 安装规则数据架构

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- install-rules.ts 中 InstallType enum 的运行时依赖问题：改用 `import type` + 本地字符串常量 `as InstallType` 断言，避免 data/ 模块对 core/ 的运行时依赖（AC#5）

### Completion Notes List

- ✅ Task 1: 创建 `src/data/install-rules.ts` — 16 条 BUILTIN_RULES（Copilot 8 + Claude 4 + Cursor 3 + VS Code 1），RULE_INDEX Map 索引，loadRules() 预留接口
- ✅ Task 2: 创建 `src/data/tool-registry.ts` — 4 个 TOOL_DEFINITIONS（copilot/claude/cursor/vscode），含 detect.global 和 detect.project 检测路径
- ✅ Task 3: 创建 `src/data/excludes.ts` — DEFAULT_EXCLUDES 包含 5 项排除文件
- ✅ Task 4: 创建 `src/data/messages.ts` — MESSAGES 中文进度阶段名，ICONS 结果状态图标（✅🔄⏭️❌），STATS_FORMAT 统计行模板（含失败计数），`as const` 结构预留多语言扩展
- ✅ Task 5: 编写单元测试 — 54 个测试覆盖所有 AC，含模块边界验证
- ✅ 更新 `src/data/index.ts` — 导出所有新模块的 public API
- 全量测试 178 通过，0 回归，lint 通过

### Change Log

- 2026-03-23: Story 1.4 完成 — 数据层配置（install-rules, tool-registry, excludes, messages）+ 54 个单元测试
- 2026-03-23: CR Round 1 修复 — 补齐 ICONS.failed ❌ + STATS_FORMAT 失败计数 + 4 个测试用例 + Prettier 格式修复

### File List

#### 新增文件
- `src/data/install-rules.ts` — 16 条 MVP 安装规则 + RULE_INDEX + loadRules()
- `src/data/tool-registry.ts` — 4 个 AI 工具检测定义
- `src/data/excludes.ts` — 全局排除文件列表
- `src/data/messages.ts` — 中文输出字符串（阶段名、图标、统计格式）
- `tests/data/install-rules.test.ts` — 20 个测试
- `tests/data/tool-registry.test.ts` — 11 个测试
- `tests/data/excludes.test.ts` — 9 个测试
- `tests/data/messages.test.ts` — 14 个测试

#### 修改文件
- `src/data/index.ts` — 从 placeholder 更新为导出所有 data 模块
