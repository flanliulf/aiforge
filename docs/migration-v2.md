# Migrating to aiforge v2.0

## Overview

aiforge v2.0 introduces one **Breaking Change**: the `vscode` tool ID has been removed and its functionality has been merged into the GitHub Copilot context.

**Your existing `~/.vscode/` files are safe — aiforge v2.0 will NOT overwrite or delete them.**

---

## What Changed

### Version Differences

| Area | v1.x | v2.0 |
|------|------|------|
| Supported tools | copilot, claude, cursor, **vscode** | copilot, claude, cursor |
| `vscode` tool ID | ✅ Available | ❌ Removed |
| VS Code MCP config | `vscode:global → ~/.vscode/` | `copilot:project → .vscode/` |
| Claude instructions | Not installed | ✅ `~/.claude/` + `.claude/` |
| Cursor global agents | Not installed | ✅ `~/.cursor/rules/` |
| BUILTIN_RULES count | 16 | 19 |

### Old vs New Rule Mapping

| Old Rule (v1.x) | New Rule (v2.0) | Notes |
|-----------------|-----------------|-------|
| `vscode:global:mcp-tools → ~/.vscode/` | **Removed** | Global VS Code MCP path is deprecated |
| *(none)* | `copilot:project:mcp-tools → .vscode/` | Project-level `.vscode/` via Copilot (filename follows source in `mcp-tools/`) |
| *(none)* | `claude:global:instructions → ~/.claude/` | New in v2.0 |
| *(none)* | `claude:project:instructions → .claude/` | New in v2.0 |
| *(none)* | `cursor:global:agents → ~/.cursor/rules/` | New in v2.0 |

---

## How to Upgrade

### 1. Upgrade aiforge

```bash
npm install -g aiforge@2.0.0
# or
npx aiforge@2.0.0 --help
```

### 2. Install the GitHub Copilot Extension and Create the `~/.copilot/` Marker

If you previously used aiforge with VS Code and want to continue managing MCP configurations:

- **VS Code**: Install the [GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) extension
- **Then create the aiforge marker directory**: `mkdir -p ~/.copilot/`
  - This is an aiforge convention path; the extension itself does **not** automatically create this directory.
  - See the "Note on `~/.copilot/`" section below for full context.
- After both are in place, `aiforge install` will detect Copilot (via `~/.copilot/` marker) and apply the `.vscode/` MCP rule (copying files from `mcp-tools/`).

### 3. Re-run aiforge install

```bash
aiforge install
```

aiforge will now detect the Copilot context via `~/.copilot/` marker or project `.github/` and apply the updated rules.

---

## What Happens to My Existing `~/.vscode/` Files?

**Nothing.** aiforge v2.0 will not touch your existing `~/.vscode/` directory. Your configuration files are preserved.

If aiforge detects `~/.vscode/` but no Copilot context (`~/.copilot/` marker or project `.github/`), it will display a warning:

```
⚠️ Detected ~/.vscode/ without ~/.copilot/. Since v2.0, VS Code has been merged
   into the GitHub Copilot context.
   ① VS Code MCP is now handled by the Copilot project-level rule (target: .vscode/<filename>)
   ② Install the GitHub Copilot extension
   ③ Create ~/.copilot/ as an aiforge marker (see note below), then re-run aiforge install
   ④ Existing ~/.vscode/ files will not be overwritten or deleted
```

> **Note on `~/.copilot/`**: This path is an aiforge convention marker — it is **not** the actual GitHub Copilot extension installation directory. GitHub Copilot itself writes to `~/.vscode/extensions/github.copilot-*/` and your IDE config directories. To tell aiforge you are using Copilot, create the marker manually:
> ```bash
> mkdir -p ~/.copilot/
> ```
> After that, `aiforge install` will detect Copilot and apply the relevant rules.

This warning is informational only. The migration note itself does not block installation; however, if no supported AI tool is detected (e.g. neither Copilot, Claude Code, nor Cursor), aiforge will still fail with `NO_TOOLS` until you install one of the supported tools.

---

## FAQ

**Q: I used `--tools vscode` in my scripts. What should I use now?**

A: Replace `--tools vscode` with `--tools copilot`. GitHub Copilot now handles VS Code MCP configuration.

```bash
# Before (v1.x)
aiforge install --tools vscode

# After (v2.0)
aiforge install --tools copilot
```

---

**Q: Will my `.vscode/` MCP config files be overwritten if I run `aiforge install` with Copilot?**

A: Only if the file exists and was previously managed by aiforge (tracked in the manifest). If it's a user-written file, aiforge will prompt before overwriting; choose "skip" in the prompt to preserve the file. `--force` skips the confirmation prompt and will overwrite managed/conflicting files without asking — do not use `--force` if you want to keep hand-written files in `.vscode/`.

> **Note**: The filename written to `.vscode/` matches the source filename in the `mcp-tools/` directory of your knowledge repo (e.g. if the source file is `mcp.json`, the target is `.vscode/mcp.json`).

---

**Q: I don't use GitHub Copilot. Do I lose VS Code MCP support entirely?**

A: Yes, for the global `~/.vscode/` path. However, if you install GitHub Copilot and run `aiforge install`, the MCP config will be written to `.vscode/` in your project directory (filename follows the source file in `mcp-tools/`) — which VS Code also reads. The project-level config path (`.vscode/`) is the same; only the detection mechanism changed.

---

**Q: What if I still want to use the old `vscode` rule manually?**

A: The `vscode` tool ID no longer exists in v2.0. For now, use `--tools copilot` to get `.vscode/` project-level MCP support. If you need per-project rule overrides beyond what the built-in rules provide, [please file an issue](https://github.com/anthropics/claude-code/issues).
