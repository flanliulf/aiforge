# aiforge

> 从任意 Git 仓库安装 AI 编码配置到 Copilot / Claude / Cursor 等工具 — 一条命令，多端生效。

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## 简介

**aiforge** 是一个通过 `npx` 运行的命令行工具，能够从任意 Git 仓库中读取 AI 编码辅助配置（Instructions、Skills、Agents、MCP Tools），并按照各 AI 工具的目录约定，自动安装到用户全局目录或项目目录。

```
知识仓库（Git）             aiforge               本地 AI 工具
┌──────────────┐     ┌──────────────┐     ┌────────────────┐
│  agents/     │     │              │     │ GitHub Copilot │
│  skills/     │────→│  自动检测     │────→│ Claude Code    │
│  instructions│     │  规则匹配     │     │ Cursor         │
│  mcp-tools/  │     │  安装分发     │     │ VS Code        │
└──────────────┘     └──────────────┘     │ Windsurf       │
                                          └────────────────┘
```

## 特性

- **多工具支持** — 自动检测并安装到 GitHub Copilot、Claude Code、Cursor、VS Code、Windsurf
- **全局 + 项目** — 支持用户级全局安装（`-g`）和项目级安装（默认）
- **复制 / 符号链接** — 默认复制文件；`-l` 使用符号链接，`git pull` 即可自动更新
- **四类资源** — Agents、Skills、Instructions、MCP Tools 全覆盖
- **自动检测** — 扫描本地环境，自动判断已安装的 AI 工具
- **私有仓库** — 支持 SSH Key、Token、环境变量、系统凭据管理器四种认证方式
- **安全优先** — npm 包不含任何仓库 URL 或 Token，配置仅存于本地
- **预览模式** — `--dry-run` 查看安装计划，不写入任何文件

## 快速开始

### 前置要求

- [Node.js](https://nodejs.org/) >= 18.0.0
- [Git](https://git-scm.com/) >= 2.20

### 首次配置

```bash
npx aiforge init
```

交互式引导你完成默认仓库和认证方式的配置，信息保存到 `~/.aiforge/config.json`。

### 安装到全局（推荐）

```bash
# 符号链接模式：持久化仓库 + 自动更新
npx aiforge -g -l
```

### 安装到当前项目

```bash
cd your-project
npx aiforge
```

## 使用方式

### 主命令：安装

```bash
aiforge [repo-url] [options]
```

| 参数/选项 | 说明 |
|----------|------|
| `repo-url` | Git 仓库 URL 或 GitHub 简写（可省略，使用默认仓库） |
| `-g, --global` | 安装到用户全局目录 |
| `-l, --link` | 使用符号链接模式 |
| `-t, --tools <tools...>` | 指定目标工具（如 `copilot claude cursor`） |
| `-d, --dirs <dirs...>` | 指定源目录（如 `skills agents`） |
| `--dry-run` | 预览模式，不写入文件 |
| `--force` | 覆盖已存在文件，不备份 |
| `--ssh` | 强制使用 SSH 协议 |
| `--token <token>` | 使用 Personal Access Token |
| `--clone-dir <path>` | 指定持久化克隆路径 |

### 使用示例

```bash
# 使用已配置的默认仓库
npx aiforge

# 指定仓库 URL
npx aiforge https://your-git-host.com/team/ai-configs.git

# 全局 + 符号链接（推荐长期使用）
npx aiforge -g -l

# 只安装 Skills 和 Agents 到 Copilot
npx aiforge -t copilot -d skills agents

# 预览安装计划
npx aiforge --dry-run
```

### 子命令

```bash
# 交互式初始化配置
aiforge init

# 更新已持久化的仓库
aiforge update

# 查看支持的工具及路径映射
aiforge list
```

## 支持的 AI 工具

| 工具 | 全局安装 | 项目安装 | 支持的资源类型 |
|------|:------:|:------:|-------------|
| GitHub Copilot | ✅ | ✅ | Agents, Skills, Instructions, MCP |
| Claude Code | ✅ | ✅ | Skills |
| Cursor | ✅ | ✅ | Skills, Agents, Instructions |
| VS Code | ✅ | — | MCP |
| Windsurf | — | ✅ | Skills |

## 知识仓库结构

任何遵循以下目录约定的 Git 仓库都可以作为 aiforge 的知识源：

```
your-knowledge-repo/
├── aiforge.json            # 可选：自定义安装清单
├── agents/                 # Agent 定义（专家角色）
│   └── *.agent.md
├── skills/                 # Skill 定义（操作手册）
│   └── <skill-name>/
│       └── skill.md
├── instructions/           # 全局/场景化指令
│   ├── copilot-instructions.md
│   └── *.instructions.md
└── mcp-tools/              # MCP 服务器配置
    └── mcp.json
```

## 安装模式

### 复制模式（默认）

将文件从仓库复制到目标目录。适合项目级安装，文件作为独立副本存在。

```bash
npx aiforge          # 项目安装，复制文件
npx aiforge -g       # 全局安装，复制文件
```

### 符号链接模式

将仓库持久化到本地，在目标目录创建符号链接。后续通过 `git pull` 或 `aiforge update` 即可自动更新。

```bash
npx aiforge -g -l    # 全局安装，符号链接
```

## 认证

aiforge 按以下优先级解析认证信息：

1. **CLI 参数** — `--token <value>` 或 `--ssh`
2. **环境变量** — `AIFORGE_TOKEN` / `GITLAB_TOKEN` / `GIT_TOKEN`
3. **配置文件** — `~/.aiforge/config.json` 中的 `auth` 字段
4. **全局偏好** — `config.json` 中的 `preferSSH`
5. **系统凭据** — macOS Keychain / Windows 凭据管理器

```bash
# SSH 方式
npx aiforge https://your-git-host.com/team/repo.git --ssh

# Token 方式
npx aiforge https://your-git-host.com/team/repo.git --token <your-access-token>

# 环境变量方式（适合 CI/CD）
export GIT_TOKEN=<your-access-token>
npx aiforge https://your-git-host.com/team/repo.git
```

## 配置文件

首次运行 `aiforge init` 后，配置保存在 `~/.aiforge/config.json`：

```jsonc
{
  "defaultRepo": "https://your-git-host.com/team/ai-configs.git",
  "preferSSH": true,
  "cloneDir": "~/ai-configs",
  "auth": {
    "your-git-host.com": {
      "method": "token",
      "token": "<your-access-token>"
    }
  }
}
```

## 项目架构

```
aiforge/
├── bin/
│   └── aiforge.js          # CLI 入口
├── src/
│   ├── auth.js             # 认证与配置管理
│   ├── clone.js            # Git 仓库克隆/更新
│   ├── config.js           # 工具定义 + 安装规则映射表
│   ├── detect.js           # AI 工具检测
│   ├── installer.js        # 安装引擎（核心协调器）
│   └── utils.js            # 文件操作工具
├── docs/
│   ├── PRD.md              # 产品需求文档
│   └── architect.md        # 架构设计文档
└── test/                   # 测试
```

## 扩展新的 AI 工具

只需在 `src/config.js` 中注册工具并添加安装规则，无需修改其他模块：

```javascript
// 1. 注册工具
TOOLS.newTool = {
  name: 'New AI Tool',
  detect: {
    global: [path.join(HOME, '.newtool')],
    project: ['.newtool'],
  },
};

// 2. 添加安装规则
INSTALL_RULES.push({
  tool: 'newTool',
  scope: 'project',
  sourceDir: 'skills',
  type: 'flatten',
  mainFile: 'skill.md',
  targetDir: '.newtool/rules',
  desc: 'New Tool 规则',
});
```

## 技术栈

| 技术 | 用途 |
|------|------|
| Node.js (ESM) | 运行时 |
| [commander](https://www.npmjs.com/package/commander) | CLI 参数解析 |
| [chalk](https://www.npmjs.com/package/chalk) | 终端彩色输出 |
| [ora](https://www.npmjs.com/package/ora) | Spinner 动画 |
| [inquirer](https://www.npmjs.com/package/inquirer) | 交互式提示 |
| [simple-git](https://www.npmjs.com/package/simple-git) | Git 操作封装 |
| [fs-extra](https://www.npmjs.com/package/fs-extra) | 增强文件操作 |
| [vitest](https://www.npmjs.com/package/vitest) | 单元测试 |

## 兼容性

| 维度 | 要求 |
|------|------|
| Node.js | >= 18.0.0 |
| Git | >= 2.20 |
| 操作系统 | macOS、Linux（Windows 支持计划中） |

## License

[MIT](LICENSE)
