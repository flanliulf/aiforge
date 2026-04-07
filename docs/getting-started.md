# Getting Started

This guide walks you through setting up aiforge for the first time and installing AI configurations to your tools.

## Prerequisites

Before you begin, make sure you have:

- **Node.js** >= 18.0.0 — [Download](https://nodejs.org/)
- **Git** >= 2.20 — [Download](https://git-scm.com/)

Verify your installations:

```bash
node --version   # Should print v18.x.x or higher
git --version    # Should print git version 2.20 or higher
```

## Step 1: Initialize Configuration

Run the interactive setup wizard:

```bash
npx aiforge init
```

The wizard will ask you:

1. **Default repository URL** — The Git repository containing your AI configurations
2. **Authentication method** — SSH key, personal access token, or system credentials
3. **Language preference** — Chinese (`zh-CN`) or English (`en`)

Your settings are saved to `~/.aiforge/config.json`.

> **Tip:** You can skip `init` and provide the repository URL directly via CLI arguments. But `init` is recommended for first-time setup since it validates your credentials.

## Step 2: Preview the Installation Plan

Before making any changes, preview what aiforge will install:

```bash
# Preview project-level installation
npx aiforge --dry-run

# Preview global installation
npx aiforge -g --dry-run
```

The dry-run output shows:
- Which AI tools were detected on your system
- Which resource types (Agents, Skills, etc.) will be installed
- The exact target paths for each file

## Step 3: Install

### Project-Level Install (Default)

Installs configurations to your current project directory:

```bash
cd your-project
npx aiforge
```

Files are **copied** into your project (e.g., `.github/agents/`, `.claude/skills/`). These are independent snapshots — changes to the knowledge repo don't affect installed files until you re-run aiforge.

### Global Install

Installs to your user-level tool directories:

```bash
# Copy mode (snapshot)
npx aiforge -g

# Symlink mode (recommended — auto-updates with git pull)
npx aiforge -g -l
```

**Symlink mode** (`-l`) is recommended for global installs because:
- The knowledge repo is cloned and persisted locally
- Target directories get symlinks pointing to the cloned files
- Running `git pull` in the clone directory or `npx aiforge update` instantly updates all tools

## Step 4: Verify

After installation, you should see a summary like:

```
✅ coding-agent.md        → ~/.copilot/agents/coding-agent.md
✅ code-review/           → ~/.copilot/skills/code-review/
🔄 mcp.json               → ~/.copilot/mcp.json
⏭️  security.instructions → ~/.copilot/security.instructions.md

Installed: 2  Updated: 1  Skipped: 1
```

Open your AI tool (e.g., VS Code with Copilot) and verify the configurations are available.

## Common Scenarios

### Scenario 1: Install Only Specific Resources

```bash
# Only install Skills and Agents
npx aiforge -d skills agents

# Only install to Copilot
npx aiforge -t copilot
```

### Scenario 2: Different Repository per Project

```bash
# Use a specific repository for this project
npx aiforge https://your-git-host.com/team-b/special-configs.git
```

### Scenario 3: CI/CD Pipeline

```bash
# Use environment variable for authentication
export GIT_TOKEN=<your-access-token>
npx aiforge --quiet
```

### Scenario 4: Force Update Everything

```bash
# Overwrite all existing files without confirmation
npx aiforge --force
```

## Next Steps

- [Configuration Reference](configuration.md) — Customize all settings
- [Troubleshooting](troubleshooting.md) — Fix common issues
- [Install Rules Matrix](install-rules-matrix.md) — See exactly where files go
