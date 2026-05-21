# Configuration Reference | 配置参考

## Config File | 配置文件

Location: `~/.aiforge/config.json`

Created by `npx @fancyliu/aiforge init`. Permissions: `0o600` (user-only read/write).

```jsonc
{
  "defaultRepo": "https://your-git-host.com/team/ai-configs.git",
  "preferSSH": true,
  "cloneDir": "~/ai-configs",
  "language": "zh-CN",
  "universalDirs": true,
  "auth": {
    "your-git-host.com": {
      "method": "ssh"
    }
  }
}
```

### Fields | 字段说明

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `defaultRepo` | `string` | — | Default repository URL. Used when no `repo-url` argument is provided. |
| `preferSSH` | `boolean` | `false` | Global preference for SSH authentication. Overridden by per-host `auth` settings. |
| `cloneDir` | `string` | `~/.aiforge/repos/` | Directory for persistent repository clones (symlink mode). |
| `language` | `string` | `zh-CN` | Output language. Supported: `zh-CN`, `en`. |
| `universalDirs` | `boolean` | `true` | Enable parallel install to universal directories (`.agents/`, `.agent/`). Set to `false` to disable. |
| `auth` | `object` | `{}` | Per-hostname authentication settings. |
| `auth[host].method` | `'ssh' \| 'token'` | — | Authentication method for this hostname. |
| `auth[host].token` | `string` | — | Personal access token (only when `method: 'token'`). |

### Authentication Priority | 认证优先级

When resolving authentication, aiforge checks in this order:

```
1. CLI arguments    --ssh / --token <value>
2. Environment vars  AIFORGE_TOKEN > GITLAB_TOKEN > GIT_TOKEN
3. Per-host config   auth["hostname"].method + .token
4. Global preference  preferSSH: true → SSH
5. System credentials macOS Keychain / credential managers
```

Higher layers override lower layers. For example, `--ssh` always wins regardless of config file settings.

## Environment Variables | 环境变量

| Variable | Description |
|----------|-------------|
| `AIFORGE_TOKEN` | Personal access token (highest env priority) |
| `GITLAB_TOKEN` | GitLab personal access token |
| `GIT_TOKEN` | Generic Git token (lowest env priority) |

```bash
# CI/CD example
export GIT_TOKEN=<your-access-token>
npx @fancyliu/aiforge --quiet
```

## CLI Options Reference | CLI 选项参考

### Main Command | 主命令

```bash
npx @fancyliu/aiforge [repo-url] [options]
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `repo-url` | `string` | `config.defaultRepo` | Git repository URL or GitHub shorthand |
| `-g, --global` | `boolean` | `false` | Install to user-level global directories |
| `-l, --link` | `boolean` | `false` | Use symlink mode (global only) |
| `-t, --tools <tools...>` | `string[]` | auto-detect | Target tools: `copilot`, `claude`, `cursor` (v2.0: `vscode` removed — use `copilot` instead; see [migration guide](migration-v2.md)) |
| `-d, --dirs <dirs...>` | `string[]` | all | Resource types: `agents`, `skills`, `instructions`, `mcp-tools` |
| `--dry-run` | `boolean` | `false` | Preview only, write nothing |
| `--quiet` | `boolean` | `false` | Minimal output |
| `--force` | `boolean` | `false` | Overwrite without confirmation |
| `--ssh` | `boolean` | `false` | Force SSH authentication |
| `--token <token>` | `string` | — | Provide access token |
| `--clone-dir <path>` | `string` | `config.cloneDir` | Custom clone directory |
| `--list <dir>` | `string` | — | List installable subdirectories under a top-level dir |
| `--filter <pattern>` | `string` | — | Filter subdirectories by glob pattern (e.g., `skills/git*`) |
| `--no-universal` | `boolean` | `false` | Skip universal directory installation (`.agents/`, `.agent/`) |

### Subcommands | 子命令

| Command | Description |
|---------|-------------|
| `aiforge init` | Interactive first-time configuration |
| `aiforge update` | Pull latest changes to cloned repository |

## Manifest File | Manifest 文件

Location: `~/.aiforge/manifest.json`

Tracks installed files for conflict detection and update management. Automatically maintained by aiforge — do not edit manually.

```jsonc
[
  {
    "source": "agents/coding-agent.md",    // Relative path in knowledge repo
    "target": "/Users/you/.copilot/agents/coding-agent.md",
    "tool": "copilot",
    "scope": "global",
    "mode": "copy",
    "hash": "sha256:abc123...",
    "installedAt": "2026-04-07T10:30:00Z"
  }
]
```

If the manifest becomes corrupted, aiforge treats all files as unknown origin and prompts for confirmation before overwriting.

## Language Settings | 语言设置

aiforge supports bilingual output:

| Language Code | Display |
|--------------|---------|
| `zh-CN` | 中文（默认） |
| `en` | English |

Set via `npx @fancyliu/aiforge init` or manually in `config.json`:

```jsonc
{
  "language": "en"
}
```

The language setting affects:
- Progress phase names (e.g., "Cloning repository..." vs "克隆仓库...")
- Error messages (three-part format: what / why / how to fix)
- Result summary labels
- CLI help text remains in English regardless of language setting

## File Paths | 文件路径

| Path | Purpose |
|------|---------|
| `~/.aiforge/config.json` | User configuration |
| `~/.aiforge/manifest.json` | Installed file tracking |
| `~/.aiforge/repos/` | Default clone directory |
