# 安装规则矩阵

aiforge 全部内置安装规则的完整参考：16 条工具规则 + 4 条通用目录规则。

## 概览

aiforge 将知识仓库中的 **4 种资源类型**映射到 **4 个 AI 工具**，跨 **2 个范围**（全局/项目），使用 **3 种安装模式**（Files/Directories/Flatten）。另外，**4 条通用目录规则**提供与具体工具无关的 `.agents/` 和 `.agent/` 访问。

## 完整矩阵

### GitHub Copilot

| 范围 | 源目录 | 安装类型 | 目标目录 | 说明 |
|------|--------|:--------:|----------|------|
| 全局 | `agents/` | Files | `~/.copilot/agents/` | Agent 定义（独立 .md 文件） |
| 全局 | `skills/` | Directories | `~/.copilot/skills/` | Skill 包（每个 skill 一个目录） |
| 全局 | `instructions/` | Files | `~/.copilot/` | 全局指令文件 |
| 全局 | `mcp-tools/` | Files | `~/.copilot/` | MCP 服务器配置 |
| 项目 | `agents/` | Files | `.github/agents/` | 项目级 Agent 定义 |
| 项目 | `skills/` | Directories | `.github/skills/` | 项目级 Skill 包 |
| 项目 | `instructions/` | Files | `.github/` | 项目级指令 |
| 项目 | `mcp-tools/` | Files | `.github/` | 项目级 MCP 配置 |

### Claude Code

| 范围 | 源目录 | 安装类型 | 目标目录 | 说明 |
|------|--------|:--------:|----------|------|
| 全局 | `agents/` | Files | `~/.claude/agents/` | 子代理定义 |
| 全局 | `skills/` | Directories | `~/.claude/skills/` | Skill 包 |
| 项目 | `agents/` | Files | `.claude/agents/` | 项目级子代理 |
| 项目 | `skills/` | Directories | `.claude/skills/` | 项目级 Skills |

### Cursor

| 范围 | 源目录 | 安装类型 | 目标目录 | 说明 |
|------|--------|:--------:|----------|------|
| 全局 | `skills/` | Flatten | `~/.cursor/rules/` | Skills 展平为规则文件 |
| 项目 | `skills/` | Flatten | `.cursor/rules/` | 项目 Skills 展平为规则 |
| 项目 | `agents/` | Files | `.cursor/rules/` | Agent 文件作为规则 |

### VS Code

| 范围 | 源目录 | 安装类型 | 目标目录 | 说明 |
|------|--------|:--------:|----------|------|
| 全局 | `mcp-tools/` | Files | `~/.vscode/` | MCP 服务器配置 |

### 通用目录（Universal）

通用目录规则默认与工具规则**并行执行**。安装到项目根目录下的 `.agents/` 和 `.agent/`，提供与具体工具无关的资源访问。使用 `--no-universal` 或在配置中设置 `universalDirs: false` 可禁用。

| 范围 | 源目录 | 安装类型 | 目标目录 | 说明 |
|------|--------|:--------:|----------|------|
| 项目 | `skills/` | Directories | `.agents/skills/` | .agents/ 下的 Skill 包 |
| 项目 | `agents/` | Files | `.agents/agents/` | .agents/ 下的 Agent 文件 |
| 项目 | `skills/` | Directories | `.agent/skills/` | .agent/ 下的 Skill 包 |
| 项目 | `agents/` | Files | `.agent/agents/` | .agent/ 下的 Agent 文件 |

## 安装类型说明

### Files

源目录中的每个文件被单独复制/链接到目标目录。

```
知识仓库                            目标
agents/                          ~/.copilot/agents/
├── coding-agent.md    ────→     ├── coding-agent.md
└── review-agent.md    ────→     └── review-agent.md
```

### Directories

源目录中的每个子目录被完整复制/链接到目标。

```
知识仓库                            目标
skills/                          ~/.copilot/skills/
├── code-review/       ────→     ├── code-review/
│   ├── skill.md                 │   ├── skill.md
│   └── templates/               │   └── templates/
└── testing/           ────→     └── testing/
    └── skill.md                     └── skill.md
```

### Flatten

从每个子目录中提取主文件（`skill.md`）并重命名为目录名。

```
知识仓库                            目标
skills/                          ~/.cursor/rules/
├── code-review/                 ├── code-review.md      ← 从 skill.md 提取
│   ├── skill.md       ────→    └── testing.md           ← 从 skill.md 提取
│   └── templates/
└── testing/
    └── skill.md       ────→
```

## 覆盖率总结

| 工具 | 全局规则 | 项目规则 | 合计 |
|------|:--------:|:--------:|:----:|
| GitHub Copilot | 4 | 4 | **8** |
| Claude Code | 2 | 2 | **4** |
| Cursor | 1 | 2 | **3** |
| VS Code | 1 | 0 | **1** |
| 通用目录 | 0 | 4 | **4** |
| **合计** | **8** | **12** | **20** |

## 资源类型覆盖

| 资源 | Copilot | Claude | Cursor | VS Code |
|------|:-------:|:------:|:------:|:-------:|
| Agents | ✅ 全局+项目 | ✅ 全局+项目 | ✅ 项目 | — |
| Skills | ✅ 全局+项目 | ✅ 全局+项目 | ✅ 全局+项目 | — |
| Instructions | ✅ 全局+项目 | — | — | — |
| MCP Tools | ✅ 全局+项目 | — | — | ✅ 全局 |

## 精细化安装控制

### 浏览子目录（`--list`）

列举指定顶层资源目录下的可安装子目录：

```bash
# 列举知识仓库中所有可用的 skills
npx aiforge --list skills

# 输出示例：
# skills/ 下的可安装子目录：
#   1. code-review
#   2. git-commit-convention
#   3. testing
```

### 按模式筛选（`--filter`）

只安装匹配 glob 模式的子目录：

```bash
# 只安装以 "git" 开头的 skills
npx aiforge --filter "skills/git*"

# 安装所有 agent 文件
npx aiforge --filter "agents/*"
```

支持的 glob 字符：`*`（匹配任意字符串）、`?`（匹配单个字符）。

### 禁用通用目录（`--no-universal`）

跳过并行安装到 `.agents/` 和 `.agent/`：

```bash
npx aiforge --no-universal
```

或在 `~/.aiforge/config.json` 中永久设置：

```jsonc
{
  "universalDirs": false
}
```
