# Migrating to aiforge v2.0

## Overview

aiforge v2.0 is the first release that expands the built-in tool matrix from 3 primary tools to 11 tool integrations. It also introduces one explicit breaking change: the `vscode` tool ID is removed and folded into the GitHub Copilot context.

Your existing `~/.vscode/` files remain untouched.

## Version Differences

| Area | v1.x | v2.0 |
|------|------|------|
| Supported tools | 4 (`copilot`, `claude`, `cursor`, `vscode`) | 11 (`copilot`, `claude`, `cursor`, `codex`, `opencode`, `auggie`, `gemini`, `windsurf`, `kiro`, `antigravity`, `trae`) |
| Built-in tool rules | 16 | 55 |
| Universal rules | 4 | 4 |
| MCP behavior | VS Code global rule, limited MCP coverage | Copilot project MCP + Codex/OpenCode downgrade merge strategy |
| Instructions coverage | Partial | Claude, Gemini, Kiro, Auggie, Trae all have explicit instruction behavior |
| Preconditions | None | Gemini skills require `v0.26.0+` |
| Semantic warnings | None | Windsurf agents -> workflows warning |
| Unsupported notices | None | Trae skills unsupported notice |

## New Tool Summary

| Tool | What v2.0 Adds | Quick Usage Note |
|------|----------------|------------------|
| Codex CLI | Skills, agents, MCP downgrade templates | `--tools codex` |
| OpenCode | XDG global path, skills, agents, MCP templates | `--tools opencode` |
| Auggie | Skills, agents, root `AGENTS.md` | `--tools auggie` |
| Gemini CLI | Skills + `AGENTS.md` / `GEMINI.md` | Upgrade Gemini CLI before installing skills |
| Windsurf | Skills, rules, workflows mapping | Review the workflows warning before confirming |
| Kiro | Skills + steering instructions | Instructions go into `steering/` |
| Antigravity | Nested Gemini namespace integration | Global install stays under `~/.gemini/antigravity/` |
| Trae | Rules + root `AGENTS.md` only | Skills stay UI-managed and are not installed |

## Breaking Change: `vscode` -> `copilot`

### Old and New Mapping

| v1.x | v2.0 | Notes |
|------|------|-------|
| `--tools vscode` | `--tools copilot` | Replace in scripts and CI |
| `vscode:global:mcp-tools -> ~/.vscode/` | Removed | Home-level VS Code MCP path is no longer managed |
| None | `copilot:project:mcp-tools -> .vscode/` | Project-level MCP files are now written through Copilot |

### Recommended Upgrade Steps

1. Install or link aiforge v2.0.
2. If you use VS Code MCP files, install the GitHub Copilot extension.
3. Create the aiforge Copilot marker directory:

```bash
mkdir -p ~/.copilot/
```

4. Re-run installation with the new tool ID:

```bash
npx aiforge --tools copilot
```

5. Verify that project-level MCP files land in `.vscode/`.

### Upgrade Commands

```bash
# local source workflow
npm install
npm run build

# preview before writing
npx aiforge --dry-run

# targeted migration for VS Code users
npx aiforge --tools copilot --dry-run
npx aiforge --tools copilot
```

### Rollback Commands

```bash
# run the previous major locally if you still need v1 behavior for comparison
npx aiforge@1 --help

# clean and rebuild this repo if a local test run changed build output
rm -rf dist
npm run build
```

## Tool-Specific Migration Notes

### Gemini CLI

- `skills/` installation is skipped unless Gemini CLI is `v0.26.0+`.
- Upgrade command:

```bash
npm install -g @google/gemini-cli@latest
```

### Windsurf

- v2.0 maps generic `agents/` into Windsurf `workflows/`.
- This is a semantic bridge, not a 1:1 identity. Review generated workflows before relying on them in production.

### Trae

- v2.0 intentionally does not install `skills/` for Trae.
- Keep configuring Trae skills in the product UI; aiforge only handles `rules/` and root-level `AGENTS.md`.

### Codex CLI and OpenCode MCP Strategy

- aiforge copies MCP template files for these tools.
- You still need to merge them manually into the real config files:
  - Codex: `~/.codex/config.toml` under `[mcp]`
  - OpenCode: `~/.config/opencode/opencode.json` under `"mcp"`

### iFlow Retirement

- If aiforge detects a leftover `.iflow/` directory, v2.0 prints an informational stale-tool notice.
- iFlow CLI was shut down on `2026-04-17`; aiforge will not install anything into `.iflow/`.

## FAQ

**Q: I still have `~/.vscode/` from v1.x. Will v2.0 remove it?**

A: No. v2.0 only emits a migration notice. It does not delete or overwrite your home-level `~/.vscode/` files.

**Q: What replaces `--tools vscode`?**

A: Use `--tools copilot`.

**Q: Why does Gemini skip my skills install?**

A: Your Gemini CLI version is below `v0.26.0`, or the `gemini` binary is missing from `PATH`.

**Q: Why does Windsurf ask about workflows?**

A: aiforge maps `agents/` into `.windsurf/workflows/` and warns because Windsurf workflows are not identical to generic agents.

**Q: Why are Trae skills missing after install?**

A: That is expected. Trae skills are not file-installable in v2.0.

**Q: Why do Codex or OpenCode MCP settings still need manual work?**

A: Their production config formats require merging into existing tool-owned config files, so aiforge intentionally uses a downgrade template-copy strategy.

**Q: Can I validate the migration without writing files?**

A: Yes. Run `npx aiforge --dry-run` or `npx aiforge --tools <tool> --dry-run` first.
