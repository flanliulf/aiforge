# Story 3.1: AI 工具自动检测

Status: done

## Story

As a 用户,
I want 系统自动识别我安装了哪些 AI 编码工具,
So that 不需要手动指定就能为所有工具安装配置。

## Acceptance Criteria

1. **Given** 用户环境中安装了 Copilot（存在 `~/.copilot/` 或 `.github/`）**When** 执行工具检测 **Then** 同时扫描全局（`home()` 下）和项目（`cwd()` 下）的标志路径，任一侧命中即视为检测到该工具，返回 `DetectedEnv` 包含该工具（FR-013）
2. **Given** 用户环境中安装了多个工具（Copilot + Claude + Cursor）**When** 执行工具检测 **Then** 返回所有检测到的工具列表
3. **Given** 用户通过 `--tools copilot claude` 手动指定 **When** 执行工具检测 **Then** 跳过自动扫描，直接使用用户指定的工具列表（FR-014），无效 ID 报错
4. **Given** 自动检测未发现任何工具 **When** 检测完成 **Then** 触发诊断输出：列出扫描路径、检测标志文件、建议安装工具（FR-015），抛出 `AiforgeError`（severity: 'fatal'）
5. **Given** 工具检测过程 **When** 测量扫描耗时 **Then** 4 工具全扫描 < 500 毫秒（NFR-P5）
6. **Given** 工具检测逻辑 **When** 检查实现方式 **Then** 基于 `TOOL_DEFINITIONS` 注册表的标志路径检测，不依赖工具进程（NFR-I3）

## Tasks / Subtasks

- [x] Task 1: 创建 `src/stages/detect-tools.ts` — Detect 管道阶段 (AC: #1-6)
  - [x] 1.1 实现 `detectTools(repo: LocalRepo, args: ParsedArgs, reporter: Reporter): Promise<DetectedEnv>`
  - [x] 1.2 手动指定模式：`args.tools` 非空时，按 ID 在 `TOOL_DEFINITIONS` 中查找，无效 ID → `AiforgeError(code: 'UNKNOWN_TOOL', severity: 'fatal')`
  - [x] 1.3 自动检测模式：遍历 `TOOL_DEFINITIONS`，对每个工具同时检查全局和项目两侧的标志路径，任一侧命中即视为已安装
  - [x] 1.4 全局侧检测：使用 `pathResolver.home()` 作为基准路径，拼接 `detect.global[]` 中的标志路径检查存在性（注意：`pathResolver.toolGlobalDir()` 是 aiforge 自身的安装目标目录，不是真实工具目录，检测阶段不使用）
  - [x] 1.5 项目侧检测：使用 `process.cwd()` 作为基准路径，拼接 `detect.project[]` 中的标志路径检查存在性
  - [x] 1.6 确定安装范围 `scope`：`args.global` → 'global'，否则 → 'project'（scope 决定安装范围，不决定检测范围——检测始终扫描两侧）
  - [x] 1.7 无工具检测到 → 诊断输出 + `AiforgeError(code: 'NO_TOOLS', severity: 'fatal')`
  - [x] 1.8 调用 `reporter.startPhase('检测 AI 工具...')` 输出进度
- [x] Task 2: 实现诊断输出 (AC: #4)
  - [x] 2.1 列出所有扫描的路径（全局 + 项目）
  - [x] 2.2 列出每个工具的标志文件及检测结果
  - [x] 2.3 建议用户安装工具或使用 `--tools` 手动指定
- [x] Task 3: 编写单元测试 (AC: #1-6)
  - [x] 3.1 `tests/stages/detect-tools.test.ts`
  - [x] 3.2 测试用例：单工具检测、多工具检测、手动指定、无效 ID 报错、无工具诊断、性能 < 500ms
  - [x] 3.3 Mock `fs.access`/`fs.stat` 模拟标志路径存在/不存在，注入 mock PathResolver

## Dev Notes

### DetectedEnv 类型 [Source: core/types.ts, Story 1.2]

```typescript
interface DetectedEnv {
  tools: ToolDefinition[];  // 检测到的工具列表
  scope: 'global' | 'project';
  repo: LocalRepo;          // 透传仓库信息
}
```

### 检测逻辑 [Source: architecture/03-core-decisions.md#D5]

检测始终扫描全局 + 项目两侧，任一侧命中即视为已安装。`scope` 只决定后续安装范围，不影响检测范围。

> **重要**：检测使用 `pathResolver.home()` + `detect.global[]` 和 `process.cwd()` + `detect.project[]`。`pathResolver.toolGlobalDir(toolId)` 是 aiforge 自身的安装目标目录（`~/.aiforge/tools/${toolId}/`），与真实工具目录（如 `~/.copilot/`）无关，检测阶段不使用。

```typescript
import { TOOL_DEFINITIONS } from '../data/tool-registry.js';
import { access } from 'node:fs/promises';

async function detectSingleTool(
  tool: ToolDefinition,
  pathResolver: PathResolver
): Promise<boolean> {
  // 同时检查全局和项目两侧
  const globalBase = pathResolver.home();
  const projectBase = process.cwd();

  for (const flagPath of tool.detect.global) {
    try {
      await access(join(globalBase, flagPath));
      return true;
    } catch { continue; }
  }
  for (const flagPath of tool.detect.project) {
    try {
      await access(join(projectBase, flagPath));
      return true;
    } catch { continue; }
  }
  return false;
}
```

关键：使用 `fs.access` 而非 `fs.stat`，只检查存在性，不读取内容，保证性能。

### 手动指定模式 [Source: FR-014]

```typescript
if (args.tools && args.tools.length > 0) {
  const tools = args.tools.map(id => {
    const def = TOOL_DEFINITIONS.find(t => t.id === id);
    if (!def) {
      throw new AiforgeError(
        `未知的工具 ID: ${id}`,
        'UNKNOWN_TOOL',
        3,
        'fatal',
        `支持的工具: ${TOOL_DEFINITIONS.map(t => t.id).join(', ')}`,
        [`npx aiforge --tools ${TOOL_DEFINITIONS.map(t => t.id).join(' ')}`]
      );
    }
    return def;
  });
  return { tools, scope, repo };
}
```

### 诊断输出格式 [Source: FR-015]

```
❌ 未检测到任何 AI 编码工具

扫描路径：
  全局: ~/.copilot/ (不存在), ~/.claude/ (不存在), ...
  项目: .github/ (不存在), .cursor/ (不存在), ...

建议：
  1. 安装 GitHub Copilot、Claude Code 或 Cursor
  2. 使用 --tools copilot claude 手动指定工具
```

### TOOL_DEFINITIONS 注册表 [Source: data/tool-registry.ts, Story 1.4]

4 个工具的检测标志路径已在 Story 1.4 中定义。本 Story 只消费数据，不修改注册表。

### 模块边界

- `stages/detect-tools.ts` 依赖 `core/`（types、errors）、`data/tool-registry.ts`
- 使用 `PathResolver.home()` 获取全局检测基准路径（不使用 `toolGlobalDir()`）
- 不依赖 `services/`（检测不需要 Git 或配置服务）

### 依赖关系

- 依赖 Story 1.2（`DetectedEnv`、`ToolDefinition`、`ParsedArgs` 类型）
- 依赖 Story 1.3（`Reporter`、`PathResolver`）
- 依赖 Story 1.4（`TOOL_DEFINITIONS` 注册表）
- 依赖 Story 2.4（`LocalRepo` 作为输入）
- 被 Story 3.2（规则匹配）依赖（输出 DetectedEnv）

### 本 Story 不做的事

- 不实现规则匹配（Story 3.2）
- 不修改 TOOL_DEFINITIONS 数据（Story 1.4 已定义）
- 不实现工具版本检测（MVP 只检测存在性）

### References

- [Source: architecture/03-core-decisions.md#D5] — 工具检测注册表和 PathResolver
- [Source: architecture/03-core-decisions.md#D6] — 管道阶段类型签名
- [Source: architecture/04-implementation-patterns.md] — 错误创建模式
- [Source: architecture/05-project-structure.md] — stages/ 模块边界和数据流
- [Source: project-context.md#Install-Rules-Data-Architecture] — 数据驱动检测

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

无阻塞问题。关键实现决策：
- `DetectedEnv.tools` 实际类型为 `string[]`（工具 ID），以 `src/core/types.ts` 已定义代码为准（Story Dev Notes 中的 `ToolDefinition[]` 为示意）
- `TOOL_DEFINITIONS` global 路径带 `~` 前缀（如 `~/.copilot`），检测时通过 `replace(/^~[/\\]?/, '')` 去掉 `~`，再用 `pathResolver.home()` 拼接
- `pathResolver` 作为第 4 个参数注入（依赖注入），便于测试 mock
- fs 存在性检查遵循 ENOENT/ENOTDIR 白名单降级规则（project-context.md）

### Completion Notes List

- 实现 `src/stages/detect-tools.ts`：detectTools 主函数 + detectSingleTool 单工具检测 + emitDiagnostics 诊断输出 + pathExists ENOENT/ENOTDIR 白名单降级
- 创建 `tests/stages/detect-tools.test.ts`：16 个测试用例，覆盖全部 AC（#1-6）
- 测试结果：本 Story 16 个测试，全仓 346 个测试全部通过
- Lint: 零报错

### File List

- `src/stages/detect-tools.ts` (新增)
- `tests/stages/detect-tools.test.ts` (新增)

## Change Log

- 2026-03-25: Story 3.1 实现完成。新增 detect-tools 管道阶段及 16 个单元测试，覆盖手动指定、自动检测、多工具、无工具诊断、性能、fs 错误白名单降级等全部验收标准。
