# Install Rules Matrix

Complete reference of the built-in install rules shipped in aiforge v2.0.

> v2.0 breaking change: the `vscode` tool ID has been removed. Project-level VS Code MCP files are now handled by the `copilot` rule set. See [migration-v2.md](migration-v2.md) and [migration-v2.zh.md](migration-v2.zh.md).

## Overview

- Current implementation ships **55 built-in tool rules** across **11 tools**.
- Universal directories add **4 extra project-only rules** (`.agents/` + `.agent/`) on top of the 55 tool rules.
- Resource types: **agents**, **skills**, **instructions**, **mcp-tools / rules**.
- Install types: **Files**, **Directories**, **Flatten**.
- Scopes: **global** and **project**.

| Tool | Global Rules | Project Rules | Total | Detect Paths |
|------|:------------:|:-------------:|:-----:|--------------|
| GitHub Copilot | 4 | 5 | 9 | `~/.copilot`, `.github` |
| Claude Code | 3 | 4 | 7 | `~/.claude`, `.claude` |
| Cursor | 2 | 2 | 4 | `~/.cursor`, `.cursor` |
| Codex CLI | 3 | 2 | 5 | `~/.codex`, `.codex` |
| OpenCode | 4 | 3 | 7 | `~/.config/opencode`, `.opencode` |
| Auggie (Augment Code) | 2 | 3 | 5 | `~/.augment`, `.augment` |
| Gemini CLI | 2 | 2 | 4 | `~/.gemini`, `.gemini` |
| Windsurf | 2 | 3 | 5 | `~/.codeium/windsurf`, `.windsurf` |
| Kiro (AWS) | 2 | 2 | 4 | `~/.kiro`, `.kiro` |
| Antigravity | 2 | 1 | 3 | `~/.gemini/antigravity`, `.agents` |
| Trae (ByteDance) | 0 | 2 | 2 | `~/.trae`, `.trae` |

## Tool Matrix

### GitHub Copilot

Detect paths:
- Global: `~/.copilot`
- Project: `.github`

Supported resources:
- Agents, Skills, Instructions (`AGENTS.md` only), MCP tools

| Scope | Source Dir | Install Type | Target Dir | Description |
|-------|------------|:------------:|------------|-------------|
| global | `agents/` | Files | `~/.copilot/agents/` | Agent markdown files |
| global | `skills/` | Directories | `~/.copilot/skills/` | Skill package directories |
| global | `instructions/` | Files | `~/.copilot/` | Installs `AGENTS.md` only |
| global | `mcp-tools/` | Files | `~/.copilot/` | MCP template files |
| project | `agents/` | Files | `.github/agents/` | Project agent files |
| project | `skills/` | Directories | `.github/skills/` | Project skill packages |
| project | `instructions/` | Files | `.github/` | Installs `AGENTS.md` only |
| project | `mcp-tools/` | Files | `.github/` | Copilot project MCP templates |
| project | `mcp-tools/` | Files | `.vscode/` | VS Code project MCP files under Copilot semantics |

Special constraints:
- The old `vscode` tool no longer exists.
- `.vscode/` is now written through the Copilot project rule only.

### Claude Code

Detect paths:
- Global: `~/.claude`
- Project: `.claude`

Supported resources:
- Agents, Skills, Instructions (`CLAUDE.md` only)

| Scope | Source Dir | Install Type | Target Dir | Description |
|-------|------------|:------------:|------------|-------------|
| global | `agents/` | Files | `~/.claude/agents/` | Global sub-agents |
| global | `skills/` | Directories | `~/.claude/skills/` | Global skill packages |
| global | `instructions/` | Files | `~/.claude/` | Installs `CLAUDE.md` only |
| project | `agents/` | Files | `.claude/agents/` | Project sub-agents |
| project | `skills/` | Directories | `.claude/skills/` | Project skills |
| project | `instructions/` | Files | `.claude/` | Installs `CLAUDE.md` into the Claude project dir |
| project | `instructions/` | Files | `./` | Installs `CLAUDE.md` at repository root |

Special constraints:
- Claude reserved filenames are protected during install.
- Project installs intentionally distribute `CLAUDE.md` to both `.claude/` and repository root.

### Cursor

Detect paths:
- Global: `~/.cursor`
- Project: `.cursor`

Supported resources:
- Agents, Skills

| Scope | Source Dir | Install Type | Target Dir | Description |
|-------|------------|:------------:|------------|-------------|
| global | `agents/` | Files | `~/.cursor/rules/` | Global agent files as rules |
| global | `skills/` | Flatten | `~/.cursor/rules/` | Extracts each skill main file into a single rule file |
| project | `skills/` | Flatten | `.cursor/rules/` | Project flatten install |
| project | `agents/` | Files | `.cursor/rules/` | Project agent rules |

Special constraints:
- Cursor is the only built-in tool using `Flatten` for skills.

### Codex CLI

Detect paths:
- Global: `~/.codex`
- Project: `.codex`

Supported resources:
- Skills, Agents, MCP tools

| Scope | Source Dir | Install Type | Target Dir | Description |
|-------|------------|:------------:|------------|-------------|
| global | `skills/` | Directories | `~/.codex/skills/` | Global skill packages |
| global | `agents/` | Files | `~/.codex/agents/` | Global agents |
| project | `skills/` | Directories | `.codex/skills/` | Project skill packages |
| project | `agents/` | Files | `.codex/agents/` | Project agents |
| global | `mcp-tools/` | Files | `~/.codex/` | MCP template files copied for manual merge |

Special constraints:
- MCP config is a downgrade strategy: copy templates, then manually merge into `~/.codex/config.toml` under `[mcp]`.

### OpenCode

Detect paths:
- Global: `~/.config/opencode`
- Project: `.opencode`

Supported resources:
- Skills, Agents, Instructions (`AGENTS.md` only), MCP tools

| Scope | Source Dir | Install Type | Target Dir | Description |
|-------|------------|:------------:|------------|-------------|
| global | `skills/` | Directories | `~/.config/opencode/skills/` | Global skill packages |
| global | `agents/` | Files | `~/.config/opencode/agents/` | Global agents |
| global | `instructions/` | Files | `~/.config/opencode/` | Installs `AGENTS.md` only |
| global | `mcp-tools/` | Files | `~/.config/opencode/` | MCP template files copied for manual merge |
| project | `skills/` | Directories | `.opencode/skills/` | Project skill packages |
| project | `agents/` | Files | `.opencode/agents/` | Project agents |
| project | `mcp-tools/` | Files | `.opencode/` | Project MCP templates |

Special constraints:
- Uses the XDG global path (`~/.config/opencode`), not `~/.opencode/`.
- Global MCP templates are manually merged into `~/.config/opencode/opencode.json` under the `"mcp"` field.

### Auggie (Augment Code)

Detect paths:
- Global: `~/.augment`
- Project: `.augment`

Supported resources:
- Skills, Agents, Instructions (`AGENTS.md` only)

| Scope | Source Dir | Install Type | Target Dir | Description |
|-------|------------|:------------:|------------|-------------|
| global | `skills/` | Directories | `~/.augment/skills/` | Global skills |
| global | `agents/` | Files | `~/.augment/agents/` | Global agents |
| project | `skills/` | Directories | `.augment/skills/` | Project skills |
| project | `agents/` | Files | `.augment/agents/` | Project agents |
| project | `instructions/` | Files | `./` | Installs `AGENTS.md` at project root |

Special constraints:
- No global instructions rule.

### Gemini CLI

Detect paths:
- Global: `~/.gemini`
- Project: `.gemini`

Supported resources:
- Skills, Instructions (`AGENTS.md`, `GEMINI.md`)

| Scope | Source Dir | Install Type | Target Dir | Description |
|-------|------------|:------------:|------------|-------------|
| global | `skills/` | Directories | `~/.gemini/skills/` | Global skill packages |
| global | `instructions/` | Files | `~/.gemini/` | Installs `AGENTS.md` and `GEMINI.md` |
| project | `skills/` | Directories | `.gemini/skills/` | Project skills |
| project | `instructions/` | Files | `./` | Installs `AGENTS.md` and `GEMINI.md` at root |

Special constraints:
- Skills installation is gated by `TOOL_PRECONDITIONS`: Gemini CLI must be `v0.26.0+`.

### Windsurf

Detect paths:
- Global: `~/.codeium/windsurf`
- Project: `.windsurf`

Supported resources:
- Skills, Rules, Agents

| Scope | Source Dir | Install Type | Target Dir | Description |
|-------|------------|:------------:|------------|-------------|
| global | `skills/` | Directories | `~/.codeium/windsurf/skills/` | Global skills |
| global | `rules/` | Files | `~/.codeium/windsurf/rules/` | Global rules |
| project | `skills/` | Directories | `.windsurf/skills/` | Project skills |
| project | `rules/` | Files | `.windsurf/rules/` | Project rules |
| project | `agents/` | Files | `.windsurf/workflows/` | Agent files mapped into workflows |

Special constraints:
- Installing `agents/` triggers the semantic warning `windsurfAgentsToWorkflows` because Windsurf workflows are not identical to generic agents.

### Kiro (AWS)

Detect paths:
- Global: `~/.kiro`
- Project: `.kiro`

Supported resources:
- Skills, Instructions (`AGENTS.md` only)

| Scope | Source Dir | Install Type | Target Dir | Description |
|-------|------------|:------------:|------------|-------------|
| global | `skills/` | Directories | `~/.kiro/skills/` | Global skill packages |
| global | `instructions/` | Files | `~/.kiro/steering/` | Installs `AGENTS.md` into steering |
| project | `skills/` | Directories | `.kiro/skills/` | Project skills |
| project | `instructions/` | Files | `.kiro/steering/` | Installs `AGENTS.md` into project steering |

Special constraints:
- Instructions are mapped into the `steering/` subdirectory, not tool root.

### Antigravity

Detect paths:
- Global: `~/.gemini/antigravity`
- Project: `.agents`

Supported resources:
- Skills, Agents

| Scope | Source Dir | Install Type | Target Dir | Description |
|-------|------------|:------------:|------------|-------------|
| global | `skills/` | Directories | `~/.gemini/antigravity/skills/` | Global antigravity skills |
| global | `agents/` | Files | `~/.gemini/antigravity/agents/` | Global antigravity agents |
| project | `skills/` | Directories | `.agents/skills/` | Project skills reuse the universal `.agents` location |

Special constraints:
- Global installs are isolated under the dedicated `antigravity/` subdirectory inside Gemini's home tree.
- Project-level support is intentionally limited to skills.

### Trae (ByteDance)

Detect paths:
- Global: `~/.trae`
- Project: `.trae`

Supported resources:
- Rules, Instructions (`AGENTS.md` only)

| Scope | Source Dir | Install Type | Target Dir | Description |
|-------|------------|:------------:|------------|-------------|
| project | `rules/` | Files | `.trae/rules/` | Project rules |
| project | `instructions/` | Files | `./` | Installs `AGENTS.md` at project root |

Special constraints:
- `skills/` are intentionally unsupported because Trae manages skills through a UI flow without a stable filesystem contract.

## Universal Directories

Universal directories are project-only and run in parallel with the tool-specific matrix unless disabled by `--no-universal` or `universalDirs: false`.

| Scope | Source Dir | Install Type | Target Dir | Description |
|-------|------------|:------------:|------------|-------------|
| project | `skills/` | Directories | `.agents/skills/` | Universal skills |
| project | `agents/` | Files | `.agents/agents/` | Universal agents |
| project | `skills/` | Directories | `.agent/skills/` | Alternate singular universal skills |
| project | `agents/` | Files | `.agent/agents/` | Alternate singular universal agents |

## Install Type Notes

- `Files`: copy or link each file individually.
- `Directories`: copy or link each subdirectory as a package.
- `Flatten`: extract the main file from each subdirectory and rename it to the directory name.

## Special-Constraint Index

| Topic | Tools | Notes |
|------|-------|-------|
| MCP manual merge | Codex CLI, OpenCode | Template copy only; user merges into tool config |
| Version precondition | Gemini CLI | Skills require `v0.26.0+` |
| Semantic warning | Windsurf | `agents/` are mapped to `workflows/` |
| Unsupported resource type | Trae | `skills/` not installed |
| Nested global namespace | Antigravity | Installs into `~/.gemini/antigravity/` |
| VS Code merge | GitHub Copilot | `.vscode/` handled through Copilot project rules |
