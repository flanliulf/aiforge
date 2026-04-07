# aiforge

> Sync AI coding configurations from any Git repository to Copilot, Claude Code, Cursor, and more — one command, all tools.

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**English** | [中文](README.zh.md)

## What is aiforge?

**aiforge** is a CLI tool (runs via `npx`) that reads AI coding configurations — Agents, Skills, Instructions, and MCP Tools — from any Git repository and installs them to the correct locations for each AI tool automatically.

```
Knowledge Repo (Git)            aiforge              Local AI Tools
┌──────────────┐         ┌──────────────┐      ┌────────────────┐
│  agents/     │         │              │      │ GitHub Copilot │
│  skills/     │────────>│  Auto-detect │─────>│ Claude Code    │
│  instructions│         │  Rule-match  │      │ Cursor         │
│  mcp-tools/  │         │  Install     │      │ VS Code        │
└──────────────┘         └──────────────┘      └────────────────┘
```

**The problem:** Each AI coding tool has its own directory conventions — Copilot uses `~/.copilot/agents/`, Cursor uses `~/.cursor/rules/`, Claude uses `~/.claude/skills/`. Maintaining configurations across all tools is tedious and error-prone.

**The solution:** aiforge acts as a **universal adapter** — your team maintains one knowledge repository, and aiforge handles the per-tool directory mapping, file placement, and update detection automatically.

## Features

- **Multi-tool support** — Auto-detects and installs to GitHub Copilot, Claude Code, Cursor, and VS Code
- **Global + Project scope** — User-level global install (`-g`) or project-level install (default)
- **Copy or Symlink** — Copy files by default; use `-l` for symlinks that auto-update with `git pull`
- **Four resource types** — Agents, Skills, Instructions, and MCP Tools
- **Smart detection** — Scans your environment to find installed AI tools automatically
- **Private repos** — Supports SSH, Token, environment variables, and system credential managers
- **Security-first** — npm package contains zero repository URLs or tokens; all credentials stay local
- **Preview mode** — `--dry-run` shows the installation plan without writing any files
- **Bilingual output** — Chinese and English interface (`zh-CN` / `en`)

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18.0.0
- [Git](https://git-scm.com/) >= 2.20

### First-time Setup

```bash
npx aiforge init
```

Interactive wizard guides you through configuring your default repository and authentication method. Settings are saved to `~/.aiforge/config.json`.

### Install Globally (Recommended)

```bash
# Symlink mode: persistent repo + auto-updates via git pull
npx aiforge -g -l
```

### Install to Current Project

```bash
cd your-project
npx aiforge
```

## Usage

### Main Command

```bash
npx aiforge [repo-url] [options]
```

| Option | Description |
|--------|-------------|
| `repo-url` | Git repository URL (optional if default repo is configured) |
| `-g, --global` | Install to user-level global directories |
| `-l, --link` | Use symlink mode instead of copy |
| `-t, --tools <tools...>` | Specify target tools (e.g., `copilot claude cursor`) |
| `-d, --dirs <dirs...>` | Filter resource types (e.g., `skills agents`) |
| `--dry-run` | Preview installation plan without writing files |
| `--quiet` | Minimal output |
| `--force` | Overwrite existing files without confirmation |
| `--ssh` | Force SSH authentication |
| `--token <token>` | Provide a personal access token |
| `--clone-dir <path>` | Custom persistent clone directory |

### Examples

```bash
# Use configured default repository
npx aiforge

# Specify a repository URL
npx aiforge https://your-git-host.com/team/ai-configs.git

# Global install with symlinks (recommended for long-term use)
npx aiforge -g -l

# Install only Skills and Agents for Copilot
npx aiforge -t copilot -d skills agents

# Preview what would be installed
npx aiforge --dry-run

# Force overwrite all existing files
npx aiforge --force

# Use SSH authentication
npx aiforge --ssh
```

### Subcommands

```bash
# Interactive initial configuration
npx aiforge init

# Update a previously cloned repository
npx aiforge update

# List supported tools and their path mappings
npx aiforge list
```

## Supported AI Tools

| Tool | Global | Project | Resource Types |
|------|:------:|:-------:|----------------|
| GitHub Copilot | ✅ | ✅ | Agents, Skills, Instructions, MCP Tools |
| Claude Code | ✅ | ✅ | Agents, Skills |
| Cursor | ✅ | ✅ | Skills, Agents |
| VS Code | ✅ | — | MCP Tools |

### Detailed Install Rules

<details>
<summary>Click to expand the full 16-rule matrix</summary>

| Tool | Scope | Source Dir | Install Type | Target Dir |
|------|-------|-----------|:------------:|------------|
| Copilot | global | `agents/` | Files | `~/.copilot/agents/` |
| Copilot | global | `skills/` | Directories | `~/.copilot/skills/` |
| Copilot | global | `instructions/` | Files | `~/.copilot/` |
| Copilot | global | `mcp-tools/` | Files | `~/.copilot/` |
| Copilot | project | `agents/` | Files | `.github/agents/` |
| Copilot | project | `skills/` | Directories | `.github/skills/` |
| Copilot | project | `instructions/` | Files | `.github/` |
| Copilot | project | `mcp-tools/` | Files | `.github/` |
| Claude | global | `agents/` | Files | `~/.claude/agents/` |
| Claude | global | `skills/` | Directories | `~/.claude/skills/` |
| Claude | project | `agents/` | Files | `.claude/agents/` |
| Claude | project | `skills/` | Directories | `.claude/skills/` |
| Cursor | global | `skills/` | Flatten | `~/.cursor/rules/` |
| Cursor | project | `skills/` | Flatten | `.cursor/rules/` |
| Cursor | project | `agents/` | Files | `.cursor/rules/` |
| VS Code | global | `mcp-tools/` | Files | `~/.vscode/` |

</details>

## Knowledge Repository Structure

Any Git repository following this directory convention can be used as an aiforge knowledge source:

```
your-knowledge-repo/
├── agents/                 # Agent definitions (expert roles)
│   ├── coding-agent.md
│   └── review-agent.md
├── skills/                 # Skill definitions (operational guides)
│   └── code-review/
│       ├── skill.md        # Main file (used for Flatten mode)
│       └── templates/
├── instructions/           # Global/contextual instructions
│   ├── copilot-instructions.md
│   └── security.instructions.md
└── mcp-tools/              # MCP server configurations
    └── mcp.json
```

## Install Modes

### Copy Mode (Default)

Copies files from the repository to target directories. Files are independent snapshots.

```bash
npx aiforge          # Project install, copy mode
npx aiforge -g       # Global install, copy mode
```

### Symlink Mode

Persists the repository locally and creates symlinks in target directories. Updates automatically when you run `git pull` or `npx aiforge update`.

```bash
npx aiforge -g -l    # Global install, symlink mode
```

> **Note:** Symlink mode is available for global installs only. Project-level installs always use copy mode.

### Flatten Mode

Automatically applied to specific rules (e.g., Cursor skills). Extracts the main file from each skill directory and renames it to the skill directory name — so `skills/code-review/skill.md` becomes `code-review.md` in the target directory.

## Authentication

aiforge resolves authentication in the following priority order:

1. **CLI arguments** — `--token <value>` or `--ssh`
2. **Environment variables** — `AIFORGE_TOKEN` / `GITLAB_TOKEN` / `GIT_TOKEN`
3. **Config file** — `~/.aiforge/config.json` (`auth` field per hostname)
4. **System credentials** — macOS Keychain / credential managers

```bash
# SSH authentication
npx aiforge https://your-git-host.com/team/repo.git --ssh

# Token authentication
npx aiforge https://your-git-host.com/team/repo.git --token <your-access-token>

# Environment variable (recommended for CI/CD)
export GIT_TOKEN=<your-access-token>
npx aiforge https://your-git-host.com/team/repo.git
```

## Configuration

After running `npx aiforge init`, settings are saved to `~/.aiforge/config.json`:

```jsonc
{
  "defaultRepo": "https://your-git-host.com/team/ai-configs.git",
  "preferSSH": true,
  "cloneDir": "~/ai-configs",
  "language": "en",
  "auth": {
    "your-git-host.com": {
      "method": "ssh"
    }
  }
}
```

| Field | Description |
|-------|-------------|
| `defaultRepo` | Default repository URL (used when no repo-url argument is provided) |
| `preferSSH` | Global preference for SSH authentication |
| `cloneDir` | Directory for persistent repository clones |
| `language` | Output language: `zh-CN` (default) or `en` |
| `auth` | Per-hostname authentication settings |

## Compatibility

| Dimension | Requirement |
|-----------|-------------|
| Node.js | >= 18.0.0 |
| Git | >= 2.20 |
| OS | macOS, Linux (Windows support planned) |

## Documentation

- [Getting Started](docs/getting-started.md) — Step-by-step first-use guide
- [Configuration Reference](docs/configuration.md) — All settings and environment variables
- [Troubleshooting](docs/troubleshooting.md) — Common errors and solutions
- [Extending aiforge](docs/extending.md) — Adding support for new AI tools
- [Install Rules Matrix](docs/install-rules-matrix.md) — Complete rule reference

## License

[MIT](LICENSE)
