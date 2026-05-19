# 安装规则矩阵

aiforge v2.0 内置安装规则的完整参考。

> v2.0 破坏性变更：`vscode` 工具 ID 已移除。项目级 VS Code MCP 文件现由 `copilot` 规则集承接。升级说明参见 [migration-v2.md](migration-v2.md) 与 [migration-v2.zh.md](migration-v2.zh.md)。

## 概览

- 当前实现包含 **55 条内置工具规则**，覆盖 **11 个工具**。
- 通用目录还额外提供 **4 条项目级规则**（`.agents/` + `.agent/`），与 55 条工具规则分开统计。
- 资源类型：**agents**、**skills**、**instructions**、**mcp-tools / rules**。
- 安装类型：**Files**、**Directories**、**Flatten**。
- 安装范围：**global** 与 **project**。

| 工具 | 全局规则 | 项目规则 | 合计 | Detect 路径 |
|------|:--------:|:--------:|:----:|-------------|
| GitHub Copilot | 4 | 5 | 9 | `~/.copilot`、`.github` |
| Claude Code | 3 | 4 | 7 | `~/.claude`、`.claude` |
| Cursor | 2 | 2 | 4 | `~/.cursor`、`.cursor` |
| Codex CLI | 3 | 2 | 5 | `~/.codex`、`.codex` |
| OpenCode | 4 | 3 | 7 | `~/.config/opencode`、`.opencode` |
| Auggie (Augment Code) | 2 | 3 | 5 | `~/.augment`、`.augment` |
| Gemini CLI | 2 | 2 | 4 | `~/.gemini`、`.gemini` |
| Windsurf | 2 | 3 | 5 | `~/.codeium/windsurf`、`.windsurf` |
| Kiro (AWS) | 2 | 2 | 4 | `~/.kiro`、`.kiro` |
| Antigravity | 2 | 1 | 3 | `~/.gemini/antigravity`、`.agents` |
| Trae (ByteDance) | 0 | 2 | 2 | `~/.trae`、`.trae` |

## 工具矩阵

### GitHub Copilot

Detect 路径：
- 全局：`~/.copilot`
- 项目：`.github`

支持资源类型：
- Agents、Skills、Instructions（仅 `AGENTS.md`）、MCP tools

| 范围 | 源目录 | 安装类型 | 目标目录 | 说明 |
|------|--------|:--------:|----------|------|
| global | `agents/` | Files | `~/.copilot/agents/` | Agent Markdown 文件 |
| global | `skills/` | Directories | `~/.copilot/skills/` | Skill 包目录 |
| global | `instructions/` | Files | `~/.copilot/` | 仅安装 `AGENTS.md` |
| global | `mcp-tools/` | Files | `~/.copilot/` | MCP 模板文件 |
| project | `agents/` | Files | `.github/agents/` | 项目级 agent |
| project | `skills/` | Directories | `.github/skills/` | 项目级 skill 包 |
| project | `instructions/` | Files | `.github/` | 仅安装 `AGENTS.md` |
| project | `mcp-tools/` | Files | `.github/` | Copilot 项目级 MCP 模板 |
| project | `mcp-tools/` | Files | `.vscode/` | Copilot 语境下的 VS Code 项目 MCP 文件 |

特殊约束：
- 旧的 `vscode` 工具已完全移除。
- `.vscode/` 现在只通过 Copilot 项目规则写入。

### Claude Code

Detect 路径：
- 全局：`~/.claude`
- 项目：`.claude`

支持资源类型：
- Agents、Skills、Instructions（仅 `CLAUDE.md`）

| 范围 | 源目录 | 安装类型 | 目标目录 | 说明 |
|------|--------|:--------:|----------|------|
| global | `agents/` | Files | `~/.claude/agents/` | 全局 sub-agents |
| global | `skills/` | Directories | `~/.claude/skills/` | 全局 skill 包 |
| global | `instructions/` | Files | `~/.claude/` | 仅安装 `CLAUDE.md` |
| project | `agents/` | Files | `.claude/agents/` | 项目级 sub-agents |
| project | `skills/` | Directories | `.claude/skills/` | 项目级 skills |
| project | `instructions/` | Files | `.claude/` | 向 `.claude/` 安装 `CLAUDE.md` |
| project | `instructions/` | Files | `./` | 同时向仓库根安装 `CLAUDE.md` |

特殊约束：
- Claude 保留文件名受保护，安装时不会覆盖。
- 项目级 `CLAUDE.md` 会同时分发到 `.claude/` 与仓库根目录。

### Cursor

Detect 路径：
- 全局：`~/.cursor`
- 项目：`.cursor`

支持资源类型：
- Agents、Skills

| 范围 | 源目录 | 安装类型 | 目标目录 | 说明 |
|------|--------|:--------:|----------|------|
| global | `agents/` | Files | `~/.cursor/rules/` | 全局 agent 以 rules 形式分发 |
| global | `skills/` | Flatten | `~/.cursor/rules/` | 提取每个 skill 主文件为单一 rule 文件 |
| project | `skills/` | Flatten | `.cursor/rules/` | 项目级 flatten 安装 |
| project | `agents/` | Files | `.cursor/rules/` | 项目级 agent rules |

特殊约束：
- Cursor 是当前唯一对 `skills/` 使用 `Flatten` 的内置工具。

### Codex CLI

Detect 路径：
- 全局：`~/.codex`
- 项目：`.codex`

支持资源类型：
- Skills、Agents、MCP tools

| 范围 | 源目录 | 安装类型 | 目标目录 | 说明 |
|------|--------|:--------:|----------|------|
| global | `skills/` | Directories | `~/.codex/skills/` | 全局 skill 包 |
| global | `agents/` | Files | `~/.codex/agents/` | 全局 agents |
| project | `skills/` | Directories | `.codex/skills/` | 项目级 skill 包 |
| project | `agents/` | Files | `.codex/agents/` | 项目级 agents |
| global | `mcp-tools/` | Files | `~/.codex/` | 复制 MCP 模板，供手动合并 |

特殊约束：
- MCP 采用降级策略：复制模板后，用户手动合并到 `~/.codex/config.toml` 的 `[mcp]` 段落。

### OpenCode

Detect 路径：
- 全局：`~/.config/opencode`
- 项目：`.opencode`

支持资源类型：
- Skills、Agents、Instructions（仅 `AGENTS.md`）、MCP tools

| 范围 | 源目录 | 安装类型 | 目标目录 | 说明 |
|------|--------|:--------:|----------|------|
| global | `skills/` | Directories | `~/.config/opencode/skills/` | 全局 skill 包 |
| global | `agents/` | Files | `~/.config/opencode/agents/` | 全局 agents |
| global | `instructions/` | Files | `~/.config/opencode/` | 仅安装 `AGENTS.md` |
| global | `mcp-tools/` | Files | `~/.config/opencode/` | 复制 MCP 模板，供手动合并 |
| project | `skills/` | Directories | `.opencode/skills/` | 项目级 skills |
| project | `agents/` | Files | `.opencode/agents/` | 项目级 agents |
| project | `mcp-tools/` | Files | `.opencode/` | 项目级 MCP 模板 |

特殊约束：
- 全局路径遵循 XDG：`~/.config/opencode`，不是 `~/.opencode/`。
- 全局 MCP 模板需手动合并到 `~/.config/opencode/opencode.json` 的 `"mcp"` 字段。

### Auggie (Augment Code)

Detect 路径：
- 全局：`~/.augment`
- 项目：`.augment`

支持资源类型：
- Skills、Agents、Instructions（仅 `AGENTS.md`）

| 范围 | 源目录 | 安装类型 | 目标目录 | 说明 |
|------|--------|:--------:|----------|------|
| global | `skills/` | Directories | `~/.augment/skills/` | 全局 skills |
| global | `agents/` | Files | `~/.augment/agents/` | 全局 agents |
| project | `skills/` | Directories | `.augment/skills/` | 项目级 skills |
| project | `agents/` | Files | `.augment/agents/` | 项目级 agents |
| project | `instructions/` | Files | `./` | 在项目根安装 `AGENTS.md` |

特殊约束：
- Auggie 没有全局 instructions 规则。

### Gemini CLI

Detect 路径：
- 全局：`~/.gemini`
- 项目：`.gemini`

支持资源类型：
- Skills、Instructions（`AGENTS.md`、`GEMINI.md`）

| 范围 | 源目录 | 安装类型 | 目标目录 | 说明 |
|------|--------|:--------:|----------|------|
| global | `skills/` | Directories | `~/.gemini/skills/` | 全局 skill 包 |
| global | `instructions/` | Files | `~/.gemini/` | 安装 `AGENTS.md` 与 `GEMINI.md` |
| project | `skills/` | Directories | `.gemini/skills/` | 项目级 skills |
| project | `instructions/` | Files | `./` | 在仓库根安装 `AGENTS.md` 与 `GEMINI.md` |

特殊约束：
- `skills/` 安装受 `TOOL_PRECONDITIONS` 约束：Gemini CLI 必须为 `v0.26.0+`。

### Windsurf

Detect 路径：
- 全局：`~/.codeium/windsurf`
- 项目：`.windsurf`

支持资源类型：
- Skills、Rules、Agents

| 范围 | 源目录 | 安装类型 | 目标目录 | 说明 |
|------|--------|:--------:|----------|------|
| global | `skills/` | Directories | `~/.codeium/windsurf/skills/` | 全局 skills |
| global | `rules/` | Files | `~/.codeium/windsurf/rules/` | 全局 rules |
| project | `skills/` | Directories | `.windsurf/skills/` | 项目级 skills |
| project | `rules/` | Files | `.windsurf/rules/` | 项目级 rules |
| project | `agents/` | Files | `.windsurf/workflows/` | 将 agents 映射到 workflows |

特殊约束：
- 安装 `agents/` 时会触发 `windsurfAgentsToWorkflows` 语义提示，因为 workflow 不等同于通用 agent。

### Kiro (AWS)

Detect 路径：
- 全局：`~/.kiro`
- 项目：`.kiro`

支持资源类型：
- Skills、Instructions（仅 `AGENTS.md`）

| 范围 | 源目录 | 安装类型 | 目标目录 | 说明 |
|------|--------|:--------:|----------|------|
| global | `skills/` | Directories | `~/.kiro/skills/` | 全局 skills |
| global | `instructions/` | Files | `~/.kiro/steering/` | 向 steering 目录安装 `AGENTS.md` |
| project | `skills/` | Directories | `.kiro/skills/` | 项目级 skills |
| project | `instructions/` | Files | `.kiro/steering/` | 向项目 steering 安装 `AGENTS.md` |

特殊约束：
- instructions 映射到 `steering/` 子目录，而不是工具根目录。

### Antigravity

Detect 路径：
- 全局：`~/.gemini/antigravity`
- 项目：`.agents`

支持资源类型：
- Skills、Agents

| 范围 | 源目录 | 安装类型 | 目标目录 | 说明 |
|------|--------|:--------:|----------|------|
| global | `skills/` | Directories | `~/.gemini/antigravity/skills/` | 全局 antigravity skills |
| global | `agents/` | Files | `~/.gemini/antigravity/agents/` | 全局 antigravity agents |
| project | `skills/` | Directories | `.agents/skills/` | 项目级 skills 复用通用 `.agents` 目录 |

特殊约束：
- 全局安装被隔离到 Gemini 目录树下的 `antigravity/` 子目录。
- 项目级只支持 skills。

### Trae (ByteDance)

Detect 路径：
- 全局：`~/.trae`
- 项目：`.trae`

支持资源类型：
- Rules、Instructions（仅 `AGENTS.md`）

| 范围 | 源目录 | 安装类型 | 目标目录 | 说明 |
|------|--------|:--------:|----------|------|
| project | `rules/` | Files | `.trae/rules/` | 项目级 rules |
| project | `instructions/` | Files | `./` | 在项目根安装 `AGENTS.md` |

特殊约束：
- `skills/` 明确不支持，因为 Trae 通过 UI 流程管理 skills，缺少稳定文件系统契约。

## 通用目录

通用目录是项目级附加规则，默认与工具规则并行执行；可通过 `--no-universal` 或 `universalDirs: false` 禁用。

| 范围 | 源目录 | 安装类型 | 目标目录 | 说明 |
|------|--------|:--------:|----------|------|
| project | `skills/` | Directories | `.agents/skills/` | 通用 skills |
| project | `agents/` | Files | `.agents/agents/` | 通用 agents |
| project | `skills/` | Directories | `.agent/skills/` | 单数通用 skills |
| project | `agents/` | Files | `.agent/agents/` | 单数通用 agents |

## 安装类型说明

- `Files`：逐文件复制或链接。
- `Directories`：逐子目录作为完整包复制或链接。
- `Flatten`：从每个子目录提取主文件并按目录名重命名。

## 特殊约束索引

| 主题 | 工具 | 说明 |
|------|------|------|
| MCP 手动合并 | Codex CLI、OpenCode | 仅复制模板，用户手动合并到工具配置 |
| 版本前置条件 | Gemini CLI | `skills/` 需要 `v0.26.0+` |
| 语义提示 | Windsurf | `agents/` 会映射到 `workflows/` |
| 不支持的资源类型 | Trae | 不安装 `skills/` |
| 嵌套全局命名空间 | Antigravity | 安装到 `~/.gemini/antigravity/` |
| VS Code 归并 | GitHub Copilot | `.vscode/` 由 Copilot 项目规则承接 |
