# Install Rules Matrix | 安装规则矩阵

Complete reference of all 16 built-in install rules in aiforge MVP.

## Overview | 概览

aiforge maps **4 resource types** from the knowledge repository to **4 AI tools** across **2 scopes** (global/project), using **3 install modes** (Files/Directories/Flatten).

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

### Claude Code

| Scope | Source Dir | Install Type | Target Dir | Description |
|-------|-----------|:------------:|------------|-------------|
| global | `agents/` | Files | `~/.claude/agents/` | Sub-agent definitions |
| global | `skills/` | Directories | `~/.claude/skills/` | Skill packages |
| project | `agents/` | Files | `.claude/agents/` | Project-level sub-agents |
| project | `skills/` | Directories | `.claude/skills/` | Project-level skills |

### Cursor

| Scope | Source Dir | Install Type | Target Dir | Description |
|-------|-----------|:------------:|------------|-------------|
| global | `skills/` | Flatten | `~/.cursor/rules/` | Skills flattened to rule files |
| project | `skills/` | Flatten | `.cursor/rules/` | Project skills flattened to rules |
| project | `agents/` | Files | `.cursor/rules/` | Agent files as rules |

### VS Code

| Scope | Source Dir | Install Type | Target Dir | Description |
|-------|-----------|:------------:|------------|-------------|
| global | `mcp-tools/` | Files | `~/.vscode/` | MCP server configurations |

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
| GitHub Copilot | 4 | 4 | **8** |
| Claude Code | 2 | 2 | **4** |
| Cursor | 1 | 2 | **3** |
| VS Code | 1 | 0 | **1** |
| **Total** | **8** | **8** | **16** |

## Resource Type Coverage | 资源类型覆盖

| Resource | Copilot | Claude | Cursor | VS Code |
|----------|:-------:|:------:|:------:|:-------:|
| Agents | ✅ G+P | ✅ G+P | ✅ P | — |
| Skills | ✅ G+P | ✅ G+P | ✅ G+P | — |
| Instructions | ✅ G+P | — | — | — |
| MCP Tools | ✅ G+P | — | — | ✅ G |

G = Global, P = Project
