# Install Rules Matrix | 安装规则矩阵

Complete reference of all built-in install rules in aiforge v2.0: 19 tool-specific rules + 4 universal directory rules.

> **v2.0 Breaking Change**: The `vscode` tool has been removed. VS Code MCP configuration is now managed via the `copilot` project-level rule. See [migration-v2.md](migration-v2.md) for upgrade instructions.

## Overview | 概览

aiforge maps **4 resource types** from the knowledge repository to **3 AI tools** across **2 scopes** (global/project), using **3 install modes** (Files/Directories/Flatten). Additionally, **4 universal directory rules** provide tool-agnostic access via `.agents/` and `.agent/`.

## Full Matrix | 完整矩阵

### GitHub Copilot

| Scope | Source Dir | Install Type | Target Dir | Description |
|-------|-----------|:------------:|------------|-------------|
| global | `agents/` | Files | `~/.copilot/agents/` | Agent definitions (individual .md files) |
| global | `skills/` | Directories | `~/.copilot/skills/` | Skill packages (directory per skill) |
| global | `instructions/` | Files | `~/.copilot/` | Global instruction files |
| global | `mcp-tools/` | Files | `~/.copilot/` | MCP server configurations |
| project | `agents/` | Files | `.github/agents/` | Project-level agent definitions |
| project | `skills/` | Directories | `.github/skills/` | Project-level skill packages |
| project | `instructions/` | Files | `.github/` | Project-level instructions |
| project | `mcp-tools/` | Files | `.github/` | Project-level MCP configurations |
| project | `mcp-tools/` | Files | `.vscode/` | VS Code project MCP config (filename follows source in `mcp-tools/`) — v2.0 |

### Claude Code

| Scope | Source Dir | Install Type | Target Dir | Description |
|-------|-----------|:------------:|------------|-------------|
| global | `agents/` | Files | `~/.claude/agents/` | Sub-agent definitions |
| global | `skills/` | Directories | `~/.claude/skills/` | Skill packages |
| global | `instructions/` | Files | `~/.claude/` | Global instruction files — v2.0 |
| project | `agents/` | Files | `.claude/agents/` | Project-level sub-agents |
| project | `skills/` | Directories | `.claude/skills/` | Project-level skills |
| project | `instructions/` | Files | `.claude/` | Project-level instruction files — v2.0 |

### Cursor

| Scope | Source Dir | Install Type | Target Dir | Description |
|-------|-----------|:------------:|------------|-------------|
| global | `agents/` | Files | `~/.cursor/rules/` | Global agent files as rules — v2.0 |
| global | `skills/` | Flatten | `~/.cursor/rules/` | Skills flattened to rule files |
| project | `skills/` | Flatten | `.cursor/rules/` | Project skills flattened to rules |
| project | `agents/` | Files | `.cursor/rules/` | Agent files as rules |

### Universal Directories

Universal directory rules run **in parallel** with tool-specific rules by default. They install to `.agents/` and `.agent/` in the project root, providing tool-agnostic access to resources. Use `--no-universal` or set `universalDirs: false` in config to disable.

| Scope | Source Dir | Install Type | Target Dir | Description |
|-------|-----------|:------------:|------------|-------------|
| project | `skills/` | Directories | `.agents/skills/` | Skill packages in .agents/ |
| project | `agents/` | Files | `.agents/agents/` | Agent files in .agents/ |
| project | `skills/` | Directories | `.agent/skills/` | Skill packages in .agent/ |
| project | `agents/` | Files | `.agent/agents/` | Agent files in .agent/ |

## Install Types Explained | 安装类型说明

### Files

Each file in the source directory is copied/linked individually to the target directory.

```
Knowledge Repo                    Target
agents/                          ~/.copilot/agents/
├── coding-agent.md    ────→     ├── coding-agent.md
└── review-agent.md    ────→     └── review-agent.md
```

### Directories

Each subdirectory in the source directory is copied/linked as a complete directory to the target.

```
Knowledge Repo                    Target
skills/                          ~/.copilot/skills/
├── code-review/       ────→     ├── code-review/
│   ├── skill.md                 │   ├── skill.md
│   └── templates/               │   └── templates/
└── testing/           ────→     └── testing/
    └── skill.md                     └── skill.md
```

### Flatten

The main file (`skill.md`) from each subdirectory is extracted and renamed to the directory name.

```
Knowledge Repo                    Target
skills/                          ~/.cursor/rules/
├── code-review/                 ├── code-review.md      ← extracted from skill.md
│   ├── skill.md       ────→    └── testing.md           ← extracted from skill.md
│   └── templates/
└── testing/
    └── skill.md       ────→
```

## Coverage Summary | 覆盖率总结

| Tool | Global Rules | Project Rules | Total |
|------|:-----------:|:------------:|:-----:|
| GitHub Copilot | 4 | 5 | **9** |
| Claude Code | 3 | 3 | **6** |
| Cursor | 2 | 2 | **4** |
| Universal | 0 | 4 | **4** |
| **Total** | **9** | **14** | **23** |

> Note: `vscode` tool removed in v2.0. Universal rules (4) are separate from the 19 tool-specific rules.

## Resource Type Coverage | 资源类型覆盖

| Resource | Copilot | Claude | Cursor |
|----------|:-------:|:------:|:------:|
| Agents | ✅ G+P | ✅ G+P | ✅ G+P |
| Skills | ✅ G+P | ✅ G+P | ✅ G+P |
| Instructions | ✅ G+P | ✅ G+P | — |
| MCP Tools | ✅ G+P | — | — |

G = Global, P = Project

## Fine-grained Install Control | 精细化安装控制

### Browse Subdirectories (`--list`)

List installable subdirectories under a top-level resource directory:

```bash
# List all skills available in the knowledge repo
npx aiforge --list skills

# Output example:
# skills/ 下的可安装子目录:
#   1. code-review
#   2. git-commit-convention
#   3. testing
```

### Filter by Pattern (`--filter`)

Install only subdirectories matching a glob pattern:

```bash
# Install only skills starting with "git"
npx aiforge --filter "skills/git*"

# Install all agent files
npx aiforge --filter "agents/*"
```

Supported glob characters: `*` (match any string), `?` (match single character).

### Disable Universal Directories (`--no-universal`)

Skip the parallel install to `.agents/` and `.agent/`:

```bash
npx aiforge --no-universal
```

Or set permanently in `~/.aiforge/config.json`:

```jsonc
{
  "universalDirs": false
}
```
