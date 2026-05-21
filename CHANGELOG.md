# Changelog

All notable changes to aiforge are documented in this file.

## [2.0.4] - 2026-05-21

### Changed

- Updated npm publishing guidance to verify the published CLI from a clean temporary directory, avoiding npm/npx local package resolution conflicts inside this repository.

## [2.0.3] - 2026-05-21

### Changed

- Updated README release metadata to the next npm-publishable patch version.
- Documented the release rule that any npm-bound code or documentation change must bump `package.json` and `package-lock.json` before publishing.

## [2.0.2] - 2026-05-21

### Fixed

- Fixed garbled Chinese text in the npm package page README preview by pointing the Chinese README link to a jsDelivr URL that serves Markdown with an explicit UTF-8 charset.

## [2.0.1] - 2026-05-20

### Fixed

- Fixed the Chinese README link on the npm package page by pointing it to the published `README.zh.md` asset on unpkg.

## [2.0.0] - 2026-05-11

### ⚠️ BREAKING CHANGES

- **`vscode` tool ID removed**: VS Code has been merged into the GitHub Copilot context. Project-level VS Code MCP configuration is now written by `copilot:project:mcp-tools -> .vscode/`. Replace `--tools vscode` with `--tools copilot`.
- **Tool matrix expanded from 4 to 11 tools**: v2.0 adds Codex CLI, OpenCode, Auggie, Gemini CLI, Windsurf, Kiro, Antigravity, and Trae.
- **Migration guide**: See [docs/migration-v2.md](docs/migration-v2.md) / [docs/migration-v2.zh.md](docs/migration-v2.zh.md).
- **Existing files under `~/.vscode/` are not modified** (NFR-C7). Home-level VS Code MCP is no longer managed.

### Added

- **npm distribution**: The package is published as `@fancyliu/aiforge`; the installed CLI command remains `aiforge`.
- **Copilot project MCP rule** (`copilot:project:mcp-tools → .vscode/`): Inherits the VS Code project-level MCP configuration semantics. Activates when aiforge detects the Copilot context (via `~/.copilot/` marker or project `.github/`).
- **Claude instructions dual-path rules**:
  - `claude:global:instructions → ~/.claude/` — global-scope instruction files
  - `claude:project:instructions → .claude/` — project-scope instruction files
- **Cursor global agents rule** (`cursor:global:agents → ~/.cursor/rules/`): Symmetric with existing cursor project agents rule.
- **New tool integrations**:
  - Codex CLI
  - OpenCode
  - Auggie (Augment Code)
  - Gemini CLI
  - Windsurf
  - Kiro (AWS)
  - Antigravity
  - Trae (ByteDance)
- **MCP downgrade strategy**: Codex and OpenCode now copy MCP template files and emit manual merge guidance instead of mutating tool-owned config files directly.
- **`fileFilter` coverage expansion**: Instructions rules now use file filters to target `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` where required.
- **`TOOL_PRECONDITIONS`**: Gemini CLI skills installation is gated by a version check (`v0.26.0+`).
- **`semanticWarning` support**: Windsurf emits an explicit warning when generic `agents/` are mapped to `.windsurf/workflows/`.
- **iFlow stale-tool notice**: Detecting leftover `.iflow/` prints an informational message that iFlow CLI was retired on 2026-04-17 and is no longer supported.
- **Coexisting instruction distribution**: `CLAUDE.md` and `AGENTS.md` can now coexist across tool-specific target paths, including Claude dual-path distribution and root-level instruction installs where defined.
- **Migration warning**: When `~/.vscode/` is detected without `~/.copilot/`, a `⚠️` warning is emitted explaining the v2.0 VS Code merge. Install flow is not blocked.

### Changed

- `BUILTIN_RULES` count: 16 → 55
- `TOOL_DEFINITIONS` count: 4 → 11 (`vscode` removed, 8 new tools added)
- Install matrix documentation expanded to the full 11-tool rule set.
- Migration documentation now includes version-diff tables, upgrade and rollback commands, and tool-specific FAQ.

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
