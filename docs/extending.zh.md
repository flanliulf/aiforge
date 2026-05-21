# 扩展指南

本指南说明如何为 aiforge 添加新 AI 工具的支持。

## 架构概览

aiforge 采用**数据驱动**方式：添加新 AI 工具只需修改两个数据文件，无需改动引擎代码。

```
工具检测 (tool-registry.ts)          安装规则 (install-rules.ts)
┌──────────────────────────┐        ┌──────────────────────────┐
│ ToolDefinition[]         │        │ InstallRule[]            │
│ - id: 'newtool'          │        │ - tool: 'newtool'        │
│ - detect.global: [...]   │        │ - scope: 'global'        │
│ - detect.project: [...]  │        │ - sourceDir: 'skills'    │
│                          │        │ - type: Flatten           │
│                          │        │ - targetDir: '~/.newtool/'│
└──────────────────────────┘        └──────────────────────────┘
```

## 第一步：注册工具

在 `src/data/tool-registry.ts` 中添加 `ToolDefinition` 条目：

```typescript
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  // ...已有工具...
  {
    id: 'newtool',           // 唯一标识符，用于 CLI (-t newtool)
    name: 'New AI Tool',     // 人类可读的显示名称
    detect: {
      global: ['~/.newtool'],         // 表示全局安装的检测路径
      project: ['.newtool'],          // 表示项目级使用的检测路径
    },
  },
]
```

**检测逻辑：** aiforge 检查列出的路径是否存在。如果至少一个路径存在，则认为该范围下检测到了该工具。

## 第二步：添加安装规则

在 `src/data/install-rules.ts` 中添加 `InstallRule` 条目：

```typescript
const Files: InstallType = 'Files' as InstallType
const Directories: InstallType = 'Directories' as InstallType
const Flatten: InstallType = 'Flatten' as InstallType

export const BUILTIN_RULES: InstallRule[] = [
  // ...已有规则...

  // New Tool：全局规则
  {
    tool: 'newtool',
    scope: 'global',
    sourceDir: 'skills',           // 知识仓库中的源目录
    type: Flatten,                 // 安装类型
    targetDir: '~/.newtool/rules/',  // 目标目录
  },
  {
    tool: 'newtool',
    scope: 'global',
    sourceDir: 'agents',
    type: Files,
    targetDir: '~/.newtool/agents/',
  },

  // New Tool：项目规则
  {
    tool: 'newtool',
    scope: 'project',
    sourceDir: 'skills',
    type: Flatten,
    targetDir: '.newtool/rules/',
  },
]
```

## 安装类型说明

| 类型 | 行为 | 示例 |
|------|------|------|
| `Files` | 逐个复制文件 | `agents/*.md` → `target/*.md` |
| `Directories` | 复制整个子目录 | `skills/code-review/` → `target/code-review/` |
| `Flatten` | 从子目录中提取主文件并重命名 | `skills/code-review/skill.md` → `target/code-review.md` |

### 何时使用哪种类型

- **Files** — 目标工具期望在扁平目录中接收独立文件（如 Copilot agents）
- **Directories** — 目标工具期望完整的目录结构（如 Copilot skills 及其子文件）
- **Flatten** — 目标工具期望按概念命名的扁平文件（如 Cursor rules）

## 第三步：测试变更

添加工具和规则后：

```bash
# 运行测试套件
npm test

# 验证检测功能
npx @fancyliu/aiforge --list skills

# 预览安装（不实际写入）
npx @fancyliu/aiforge -t newtool --dry-run
```

## 类型定义参考

### ToolDefinition

```typescript
interface ToolDefinition {
  id: string              // 工具标识符（用于 CLI --tools 参数）
  name: string            // 人类可读的显示名称
  detect: {
    global: string[]      // 全局检测路径
    project: string[]     // 项目级检测路径
  }
}
```

### InstallRule

```typescript
interface InstallRule {
  tool: string            // 工具 ID（必须匹配 ToolDefinition.id）
  scope: 'global' | 'project'
  sourceDir: string       // 知识仓库中的源目录名
  type: InstallType       // Files | Directories | Flatten
  targetDir: string       // 目标目录（~ 在运行时展开）
}
```

## 模块架构

```
src/
├── data/
│   ├── tool-registry.ts    ← 在此添加工具定义
│   └── install-rules.ts    ← 在此添加安装规则
├── stages/
│   ├── detect-tools.ts     # 读取 TOOL_DEFINITIONS，无需修改
│   ├── match-rules.ts      # 读取 BUILTIN_RULES，无需修改
│   └── execute-install.ts  # 通用安装器，无需修改
└── pipeline.ts             # 编排器，无需修改
```

**核心设计原则：** 检测引擎、规则匹配器和安装器都是通用的 — 它们基于数据数组运行，不包含硬编码的工具知识。这就是为什么添加新工具只需要修改数据。

## 通用目录规则

除了 `BUILTIN_RULES`，aiforge 还在 `install-rules.ts` 中单独定义了 `UNIVERSAL_RULES` 数组，用于安装到与具体工具无关的目录（`.agents/` 和 `.agent/`）。

```typescript
// 这些规则不加入 RULE_INDEX（不通过工具检测匹配）。
// Match 阶段在工具规则匹配完成后单独追加。
export const UNIVERSAL_RULES: InstallRule[] = [
  { tool: 'universal', scope: 'project', sourceDir: 'skills', type: Directories, targetDir: '.agents/skills/' },
  { tool: 'universal', scope: 'project', sourceDir: 'agents', type: Files,       targetDir: '.agents/agents/' },
  { tool: 'universal', scope: 'project', sourceDir: 'skills', type: Directories, targetDir: '.agent/skills/' },
  { tool: 'universal', scope: 'project', sourceDir: 'agents', type: Files,       targetDir: '.agent/agents/' },
]
```

**要点：**
- `tool: 'universal'` 是虚拟工具 ID — 不在 `TOOL_DEFINITIONS` 中注册，不会被自动检测
- 通用规则由 `universalDirs` 配置项和 `--no-universal` CLI 选项控制
- 它们与工具规则并行执行，而非替代
