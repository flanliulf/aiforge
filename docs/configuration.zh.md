# 配置参考

## 配置文件

位置：`~/.aiforge/config.json`

由 `npx aiforge init` 创建。文件权限：`0o600`（仅用户可读写）。

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

### 字段说明

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `defaultRepo` | `string` | — | 默认仓库 URL。未提供 `repo-url` 参数时使用。 |
| `preferSSH` | `boolean` | `false` | 全局 SSH 偏好。可被按主机名配置的 `auth` 覆盖。 |
| `cloneDir` | `string` | `~/.aiforge/repos/` | 持久化克隆目录（符号链接模式使用）。 |
| `language` | `string` | `zh-CN` | 输出语言。支持：`zh-CN`、`en`。 |
| `universalDirs` | `boolean` | `true` | 启用通用目录并行安装（`.agents/`、`.agent/`）。设为 `false` 禁用。 |
| `auth` | `object` | `{}` | 按主机名索引的认证配置。 |
| `auth[host].method` | `'ssh' \| 'token'` | — | 该主机的认证方式。 |
| `auth[host].token` | `string` | — | 个人访问令牌（仅当 `method: 'token'` 时使用）。 |

### 认证优先级

aiforge 按以下顺序解析认证信息：

```
1. CLI 参数          --ssh / --token <value>
2. 环境变量          AIFORGE_TOKEN > GITLAB_TOKEN > GIT_TOKEN
3. 按主机名配置      auth["hostname"].method + .token
4. 全局偏好          preferSSH: true → SSH
5. 系统凭据          macOS Keychain / 凭据管理器
```

上层配置覆盖下层。例如，`--ssh` 参数始终优先于配置文件中的设置。

## 环境变量

| 变量 | 说明 |
|------|------|
| `AIFORGE_TOKEN` | 个人访问令牌（最高环境变量优先级） |
| `GITLAB_TOKEN` | GitLab 个人访问令牌 |
| `GIT_TOKEN` | 通用 Git 令牌（最低环境变量优先级） |

```bash
# CI/CD 示例
export GIT_TOKEN=<your-access-token>
npx aiforge --quiet
```

## CLI 选项参考

### 主命令

```bash
npx aiforge [repo-url] [options]
```

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `repo-url` | `string` | `config.defaultRepo` | Git 仓库 URL 或 GitHub 简写 |
| `-g, --global` | `boolean` | `false` | 安装到用户级全局目录 |
| `-l, --link` | `boolean` | `false` | 使用符号链接模式（仅限全局） |
| `-t, --tools <tools...>` | `string[]` | 自动检测 | 目标工具：`copilot`、`claude`、`cursor`（v2.0 起 `vscode` 已移除，请改用 `copilot`；详见[迁移指南](migration-v2.zh.md)） |
| `-d, --dirs <dirs...>` | `string[]` | 全部 | 资源类型：`agents`、`skills`、`instructions`、`mcp-tools` |
| `--dry-run` | `boolean` | `false` | 仅预览，不写入文件 |
| `--quiet` | `boolean` | `false` | 极简输出 |
| `--force` | `boolean` | `false` | 覆盖已存在文件，不确认 |
| `--ssh` | `boolean` | `false` | 强制使用 SSH 认证 |
| `--token <token>` | `string` | — | 提供访问令牌 |
| `--clone-dir <path>` | `string` | `config.cloneDir` | 自定义克隆目录 |
| `--list <dir>` | `string` | — | 列举指定顶层目录下的可安装子目录 |
| `--filter <pattern>` | `string` | — | 按 glob 模式筛选子目录（如 `skills/git*`） |
| `--no-universal` | `boolean` | `false` | 跳过通用目录安装（`.agents/`、`.agent/`） |

### 子命令

| 命令 | 说明 |
|------|------|
| `aiforge init` | 交互式首次配置 |
| `aiforge update` | 拉取已克隆仓库的最新变更 |

## Manifest 文件

位置：`~/.aiforge/manifest.json`

用于跟踪已安装的文件，支持冲突检测和更新管理。由 aiforge 自动维护，请勿手动编辑。

```jsonc
[
  {
    "source": "agents/coding-agent.md",    // 知识仓库中的相对路径
    "target": "/Users/you/.copilot/agents/coding-agent.md",
    "tool": "copilot",
    "scope": "global",
    "mode": "copy",
    "hash": "sha256:abc123...",
    "installedAt": "2026-04-07T10:30:00Z"
  }
]
```

如果 manifest 文件损坏，aiforge 会将所有文件视为来源未知，并在覆盖前请求用户确认。

## 语言设置

aiforge 支持双语输出：

| 语言代码 | 显示 |
|----------|------|
| `zh-CN` | 中文（默认） |
| `en` | English |

通过 `npx aiforge init` 设置，或手动修改 `config.json`：

```jsonc
{
  "language": "en"
}
```

语言设置影响：
- 进度阶段名称（如 "Cloning repository..." vs "克隆仓库..."）
- 错误提示（三段式格式：发生了什么 / 为什么 / 怎么修）
- 结果摘要标签
- CLI 帮助文本始终为英文，不受语言设置影响

## 文件路径

| 路径 | 用途 |
|------|------|
| `~/.aiforge/config.json` | 用户配置 |
| `~/.aiforge/manifest.json` | 已安装文件跟踪 |
| `~/.aiforge/repos/` | 默认克隆目录 |
