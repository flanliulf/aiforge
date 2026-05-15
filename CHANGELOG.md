# Changelog

All notable changes to aiforge are documented in this file.

## [2.0.0] - 2026-05-11

### ⚠️ BREAKING CHANGES

- **`vscode` tool ID removed**: The `vscode` tool has been merged into the GitHub Copilot context. VS Code MCP configuration is now managed via the `copilot` project-level rule targeting `.vscode/`. If you relied on `--tools vscode`, switch to `--tools copilot`.
  - **Migration**: See [docs/migration-v2.md](docs/migration-v2.md) / [docs/migration-v2.zh.md](docs/migration-v2.zh.md)
  - **Existing files under `~/.vscode/` (user home) are NOT modified** (NFR-C7 compliance). Note: project-level `.vscode/` will receive `mcp-tools` writes via the new `copilot:project:mcp-tools` rule when GitHub Copilot is detected.

### Added

- **Copilot project MCP rule** (`copilot:project:mcp-tools → .vscode/`): Inherits the VS Code project-level MCP configuration semantics. Activates when aiforge detects the Copilot context (via `~/.copilot/` marker or project `.github/`).
- **Claude instructions dual-path rules**:
  - `claude:global:instructions → ~/.claude/` — global-scope instruction files
  - `claude:project:instructions → .claude/` — project-scope instruction files
- **Cursor global agents rule** (`cursor:global:agents → ~/.cursor/rules/`): Symmetric with existing cursor project agents rule.
- **Migration warning**: When `~/.vscode/` is detected without `~/.copilot/`, a `⚠️` warning is emitted explaining the v2.0 VS Code merge. Install flow is not blocked.

### Changed

- `BUILTIN_RULES` count: 16 → 19 (4 new rules, 1 deleted)
- `TOOL_DEFINITIONS` count: 4 → 3 (vscode removed)
- Suggestion messages updated to reference 3 tools (GitHub Copilot, Claude Code, Cursor)

### Removed

- `vscode` ToolDefinition from `TOOL_DEFINITIONS`
- `vscode:global:mcp-tools → ~/.vscode/` rule from `BUILTIN_RULES`

---

## [1.0.0] - 2026-04-21

Initial stable release covering Epics 1–6.

- Full pipeline: Resolve → Auth → Clone → Detect → Match → Install → Report
- Supported tools: GitHub Copilot, Claude Code, Cursor, VS Code
- Fine-grained install control (`--list`, `--filter`, `--dirs`)
- Universal directory install (`.agents/`, `.agent/`)
- Conflict resolution (interactive + `--force`)
- i18n support (zh-CN / en)
