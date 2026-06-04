# aiforge

> Sync AI coding configurations from any Git repository to Copilot, Claude Code, Cursor, and more — one command, all tools.

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**English** | [中文](README.zh.md) | [Docs Hub](docs/index.md) | [Contributing](docs/contributing.md)

> **Current npm release: v2.0.5**. The `v2.0` line is the current stable major line; `vscode` has been merged into Copilot, support now covers 11 tools, and migration guidance is available in [docs/migration-v2.md](docs/migration-v2.md).

## What is aiforge?

**aiforge** is a CLI tool (runs via `npx`) that reads AI coding configurations — Agents, Skills, Instructions, and MCP Tools — from any Git repository and installs them to the correct locations for each AI tool automatically.

```
Knowledge Repo (Git)            aiforge              Local AI Tools
┌──────────────┐         ┌──────────────┐      ┌────────────────┐
│  agents/     │         │              │      │ GitHub Copilot │
│  skills/     │────────>│  Auto-detect │─────>│ Claude Code    │
│  instructions│         │  Rule-match  │      │ Cursor         │
│  mcp-tools/  │         │  Install     │      │                │
└──────────────┘         └──────────────┘      └────────────────┘
```

**The problem:** Each AI coding tool has its own directory conventions — Copilot uses `~/.copilot/agents/`, Cursor uses `~/.cursor/rules/`, Claude uses `~/.claude/skills/`. Maintaining configurations across all tools is tedious and error-prone.

**The solution:** aiforge acts as a **universal adapter** — your team maintains one knowledge repository, and aiforge handles the per-tool directory mapping, file placement, and update detection automatically.

## Features

- **11-tool support** — Auto-detects and installs to GitHub Copilot, Claude Code, Cursor, Codex CLI, OpenCode, Auggie, Gemini CLI, Windsurf, Kiro, Antigravity, and Trae
- **Global + Project scope** — User-level global install (`-g`) or project-level install (default)
- **Copy or Symlink** — Copy files by default; use `-l` for symlinks that auto-update with `git pull`
- **Four resource types** — Agents, Skills, Instructions, and MCP Tools
- **Smart detection** — Scans your environment to find installed AI tools automatically
- **Private repos** — Supports SSH, Token, environment variables, and system credential managers
- **Security-first** — npm package contains zero repository URLs or tokens; all credentials stay local
- **Preview mode** — `--dry-run` shows the installation plan without writing any files
- **Browse & filter** — `--list` browses installable subdirectories; `--filter` selects by glob pattern
- **Universal directories** — Parallel install to `.agents/` and `.agent/` for tool-agnostic access (opt-out via `--no-universal`)
- **Bilingual output** — Chinese and English interface (`zh-CN` / `en`)

## v2.0 Highlights

Recent Epic 7 commits completed the v2.0 tool matrix and release wrap-up:

- Tool coverage expanded from 4 to 11 tools: Codex CLI, OpenCode, Auggie, Gemini CLI, Windsurf, Kiro, Antigravity, and Trae were added while the `vscode` tool ID was merged into Copilot.
- Built-in install rules now cover 55 tool-specific rules plus 4 universal directory rules, with bilingual matrix and migration documentation.
- Codex CLI and OpenCode use a safer MCP downgrade strategy: aiforge copies template files and prints manual merge guidance instead of mutating tool-owned config directly.
- Tool-specific safeguards cover Gemini CLI version checks, Windsurf `agents/` to `workflows/` warnings, Trae skills unsupported notices, and stale iFlow detection.
- Regression coverage now includes the 11-tool matrix, detection, dry-run, rule matching, and tool-specific rule behavior.

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18.0.0
- [Git](https://git-scm.com/) >= 2.20

### First-time Setup

```bash
npx @fancyliu/aiforge init
```

Interactive wizard guides you through configuring your default repository and authentication method. Settings are saved to `~/.aiforge/config.json`.

### Install Globally (Recommended)

```bash
# Symlink mode: persistent repo + auto-updates via git pull
npx @fancyliu/aiforge -g -l
```

### Install to Current Project

```bash
cd your-project
npx @fancyliu/aiforge
```

## Usage

### Main Command

```bash
npx @fancyliu/aiforge [repo-url] [options]
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
| `--list <dir>` | List installable subdirectories under a top-level dir |
| `--filter <pattern>` | Filter subdirectories by glob pattern (e.g., `skills/git*`) |
| `--no-universal` | Skip universal directory installation (`.agents/`, `.agent/`) |

### Examples

```bash
# Use configured default repository
npx @fancyliu/aiforge

# Specify a repository URL
npx @fancyliu/aiforge https://your-git-host.com/team/ai-configs.git

# Global install with symlinks (recommended for long-term use)
npx @fancyliu/aiforge -g -l

# Install only Skills and Agents for Copilot
npx @fancyliu/aiforge -t copilot -d skills agents

# Preview what would be installed
npx @fancyliu/aiforge --dry-run

# Force overwrite all existing files
npx @fancyliu/aiforge --force

# Use SSH authentication
npx @fancyliu/aiforge --ssh

# List installable subdirectories under skills/
npx @fancyliu/aiforge --list skills

# Install only skills matching a glob pattern
npx @fancyliu/aiforge --filter "skills/git*"

# Skip universal directory installation
npx @fancyliu/aiforge --no-universal
```

### Subcommands

```bash
# Interactive initial configuration
npx @fancyliu/aiforge init

# Re-run a persisted symlink install to update the cloned repository
npx @fancyliu/aiforge -g -l
```

## Supported AI Tools

> **v2.0**: The `vscode` tool has been removed. VS Code MCP configuration is now managed via the `copilot` project rule. See [docs/migration-v2.md](docs/migration-v2.md).

| Tool | Global | Project | Primary Resource Types | Notes |
|------|:------:|:-------:|------------------------|-------|
| GitHub Copilot | ✅ | ✅ | Agents, Skills, Instructions, MCP Tools | `.vscode/` project MCP files are managed through Copilot |
| Claude Code | ✅ | ✅ | Agents, Skills, Instructions | Project instructions go to both `.claude/` and repo root |
| Cursor | ✅ | ✅ | Agents, Skills | Skills use Flatten mode |
| Codex CLI | ✅ | ✅ | Agents, Skills, MCP Tools | MCP templates require manual merge |
| OpenCode | ✅ | ✅ | Agents, Skills, Instructions, MCP Tools | Uses XDG global path |
| Auggie | ✅ | ✅ | Agents, Skills, Instructions | Project instructions install `AGENTS.md` at repo root |
| Gemini CLI | ✅ | ✅ | Skills, Instructions | Skills require Gemini CLI `v0.26.0+` |
| Windsurf | ✅ | ✅ | Skills, Rules, Agents | `agents/` map to `workflows/` with warning |
| Kiro | ✅ | ✅ | Skills, Instructions | Instructions install into `steering/` |
| Antigravity | ✅ | ✅ | Agents, Skills | Global files live under `~/.gemini/antigravity/` |
| Trae | — | ✅ | Rules, Instructions | Skills are intentionally unsupported |
| Universal (`.agents/`, `.agent/`) | — | ✅ | Agents, Skills | Extra parallel install path, separate from tool matrix |

### Detailed Install Rules

<details>
<summary>Click to expand the docs links for the full v2.0 matrix</summary>

- [docs/install-rules-matrix.md](docs/install-rules-matrix.md) — Full 55-rule tool matrix + 4 universal rules
- [docs/install-rules-matrix.zh.md](docs/install-rules-matrix.zh.md) — 中文版完整矩阵
- [docs/migration-v2.md](docs/migration-v2.md) — Upgrade guide
- [docs/migration-v2.zh.md](docs/migration-v2.zh.md) — 中文升级指南

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
npx @fancyliu/aiforge          # Project install, copy mode
npx @fancyliu/aiforge -g       # Global install, copy mode
```

### Symlink Mode

Persists the repository locally and creates symlinks in target directories. Updates automatically when you run `git pull` in the clone directory or re-run `npx @fancyliu/aiforge -g -l`.

```bash
npx @fancyliu/aiforge -g -l    # Global install, symlink mode
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
npx @fancyliu/aiforge https://your-git-host.com/team/repo.git --ssh

# Token authentication
npx @fancyliu/aiforge https://your-git-host.com/team/repo.git --token <your-access-token>

# Environment variable (recommended for CI/CD)
export GIT_TOKEN=<your-access-token>
npx @fancyliu/aiforge https://your-git-host.com/team/repo.git
```

## Configuration

After running `npx @fancyliu/aiforge init`, settings are saved to `~/.aiforge/config.json`:

```jsonc
{
  "defaultRepo": "https://your-git-host.com/team/ai-configs.git",
  "preferSSH": true,
  "cloneDir": "~/ai-configs",
  "language": "en",
  "universalDirs": true,
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
| `universalDirs` | Enable universal directory install (`.agents/`, `.agent/`). Default: `true` |
| `auth` | Per-hostname authentication settings |

## Compatibility

| Dimension | Requirement |
|-----------|-------------|
| Node.js | >= 18.0.0 |
| Git | >= 2.20 |
| OS | macOS, Linux (Windows support planned) |

## Documentation

### User Docs

- [Docs Hub](docs/index.md) — audience-based documentation entry point
- [Getting Started](docs/getting-started.md) — step-by-step first-use guide
- [Configuration Reference](docs/configuration.md) — all settings and environment variables
- [Troubleshooting](docs/troubleshooting.md) — common errors and solutions
- [Install Rules Matrix](docs/install-rules-matrix.md) — complete rule reference
- [Migration v2](docs/migration-v2.md) — upgrade guide for the `vscode` to Copilot merge

### Contributors And Maintainers

- [Contributing Guide](docs/contributing.md) — development setup, validation checklist, and docs sync expectations
- [Local Build Verification](docs/local-build-verification.md) — validate unpublished CLI fixes with `dist/index.js` or `npm link`
- [Extending aiforge](docs/extending.md) — adding support for new AI tools
- [npm Publishing Guide](docs/npm-publishing-guide.zh.md) — Chinese-only maintainer release runbook
- [Changelog](CHANGELOG.md) — release history and notable changes

## Contributing

If you plan to change code, docs, or package-bound artifacts, start with [docs/contributing.md](docs/contributing.md). It consolidates the local workflow, validation commands, documentation update expectations, and release entry points.

## Versioning

aiforge follows [Semantic Versioning](https://semver.org/) and is now in the stable `2.x` line:

| Version | Trigger | Example |
|---------|---------|---------|
| `v2.x.y` | Backward-compatible fixes and improvements on the current major line | `v2.0.5` — bug fix |
| `v2.y.0` | Backward-compatible feature release | `v2.1.0` — next milestone |
| `v3.0.0` | Breaking changes | `v3.0.0` — next major line |

Current npm release: `v2.0.5`. The `2.x` baseline starts at `v2.0.0`, the breaking release that removes the `vscode` tool ID, expands support to 11 tools, and moves VS Code project MCP handling under Copilot.

## AI-Assisted Setup

If you use an AI assistant (e.g., Copilot, Claude, Cursor) in your terminal or IDE, you can copy the following prompts to let it handle aiforge setup for you.

### First-time Setup

> I need to set up **aiforge** (an AI coding configuration installer CLI) for the first time on my machine.
>
> Context:
> - aiforge is installed via `npx` (no global install needed), requires Node.js >= 18 and Git >= 2.20
> - Configuration is stored at `~/.aiforge/config.json`
> - Our team's knowledge repository is: `<paste your repo URL here>`
> - Authentication method: SSH / Token (pick one)
>
> Please run the following steps in order:
> 1. Verify prerequisites: check `node -v` (>= 18) and `git -v` (>= 2.20)
> 2. Run `npx @fancyliu/aiforge init` and guide me through the interactive setup
> 3. Run `npx @fancyliu/aiforge -g -l --dry-run` to preview the global symlink installation plan
> 4. If the preview looks correct, run `npx @fancyliu/aiforge -g -l` to install
> 5. Show the installation summary and verify available skills with `npx @fancyliu/aiforge --list skills`
>
> If any step fails, show the full error output and suggest a fix before proceeding.

### Project-Level Install

> Set up **aiforge** for the current project. Run these steps:
> 1. Run `npx @fancyliu/aiforge --dry-run` to preview what will be installed
> 2. Show me the file list and target paths, ask for confirmation
> 3. Run `npx @fancyliu/aiforge` to install
> 4. Show the summary of installed/updated/skipped files
>
> Do NOT use `--force` unless I explicitly ask for it.

### Troubleshooting

> I'm having an issue with **aiforge**. Help me diagnose it:
> 1. Run `npx @fancyliu/aiforge --version` and record the version
> 2. Run `npx @fancyliu/aiforge --dry-run` and check for errors in the output
> 3. Check `~/.aiforge/config.json` for configuration issues
> 4. If the error is authentication-related, test with `ssh -T git@<host>` or `git ls-remote <repo-url>`
> 5. Summarize the findings and suggest a fix
>
> The error I'm seeing is: `<paste your error message here>`

## Reporting Issues

Found a bug or have a feature request? Please report it through your team's configured project tracker.

To help us resolve the issue quickly, please include:

1. **aiforge version** — `npx @fancyliu/aiforge --version`
2. **Environment** — OS, Node.js version (`node -v`), Git version (`git -v`)
3. **Steps to reproduce** — Exact commands you ran
4. **Expected vs actual behavior** — What you expected to happen and what actually happened
5. **Error output** — Full three-part error message (if applicable)

> **Tip:** Running `npx @fancyliu/aiforge --dry-run` and attaching the output can help us diagnose installation rule issues without any side effects.

### Issue Template

```markdown
**Type:** Bug / Feature Request

**Environment:**
- aiforge: <version>
- Node.js: <version>
- Git: <version>
- OS: <os and version>

**Description:**
<Clear description of the problem or feature request>

**Steps to Reproduce:** (Bug only)
1. Run `npx @fancyliu/aiforge ...`
2. ...

**Expected Behavior:**
<What you expected>

**Actual Behavior:**
<What actually happened>

**Error Output:** (if applicable)
<Paste the full three-part error message here>

**Dry-run Output:** (if applicable)
<Paste the output of `npx @fancyliu/aiforge --dry-run` here>
```

### AI-Assisted Issue Writing

If you use an AI assistant (e.g., Copilot, Claude, Cursor) to help draft issues, you can use the following prompt:

> Help me write a GitLab issue for the **aiforge** project (an AI coding configuration installer CLI). Follow this format strictly:
>
> 1. Title: concise summary in imperative form (e.g., "Fix auth failure when using SSH with proxy")
> 2. Type: Bug or Feature Request
> 3. Environment: aiforge version, Node.js version, Git version, OS
> 4. Description: 2-3 sentences explaining the problem or request
> 5. Steps to Reproduce (bugs only): numbered list of exact commands
> 6. Expected vs Actual Behavior: clearly separated
> 7. Error Output: full three-part error (What / Why / How to fix) if available
> 8. Dry-run Output: output of `npx @fancyliu/aiforge --dry-run` if relevant to install rules
>
> Keep the tone factual, avoid speculation on root cause, and include only verifiable information.

## License

[MIT](LICENSE)
