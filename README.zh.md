# aiforge

> 从任意 Git 仓库安装 AI 编码配置到 Copilot / Claude / Cursor 等工具 — 一条命令，多端生效。

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[English](README.md) | **中文**

> **当前 npm 发布版本：v2.0.4**。`v2.0` 是当前稳定主版本线；`vscode` 工具 ID 已归并到 Copilot，当前支持 11 个工具，迁移说明见 [docs/migration-v2.zh.md](docs/migration-v2.zh.md)。

## 简介

**aiforge** 是一个通过 `npx` 运行的命令行工具，能够从任意 Git 仓库中读取 AI 编码辅助配置（Agents、Skills、Instructions、MCP Tools），并按照各 AI 工具的目录约定，自动安装到用户全局目录或项目目录。

```
知识仓库（Git）             aiforge               本地 AI 工具
┌──────────────┐     ┌──────────────┐     ┌────────────────┐
│  agents/     │     │              │     │ GitHub Copilot │
│  skills/     │────→│  自动检测     │────→│ Claude Code    │
│  instructions│     │  规则匹配     │     │ Cursor         │
│  mcp-tools/  │     │  安装分发     │     │                │
└──────────────┘     └──────────────┘     └────────────────┘
```

**问题**：每个 AI 编码工具都有独立的目录约定 — Copilot 使用 `~/.copilot/agents/`，Cursor 使用 `~/.cursor/rules/`，Claude 使用 `~/.claude/skills/`。跨工具维护配置既繁琐又容易出错。

**方案**：aiforge 充当**通用适配器** — 团队只需维护一份知识仓库，aiforge 自动处理各工具的目录映射、文件放置和增量更新。

## 特性

- **11 工具支持** — 自动检测并安装到 GitHub Copilot、Claude Code、Cursor、Codex CLI、OpenCode、Auggie、Gemini CLI、Windsurf、Kiro、Antigravity、Trae
- **全局 + 项目** — 支持用户级全局安装（`-g`）和项目级安装（默认）
- **复制 / 符号链接** — 默认复制文件；`-l` 使用符号链接，`git pull` 即可自动更新
- **四类资源** — Agents、Skills、Instructions、MCP Tools 全覆盖
- **自动检测** — 扫描本地环境，自动判断已安装的 AI 工具
- **私有仓库** — 支持 SSH Key、Token、环境变量、系统凭据管理器四种认证方式
- **安全优先** — npm 包不含任何仓库 URL 或 Token，配置仅存于本地
- **预览模式** — `--dry-run` 查看安装计划，不写入任何文件
- **浏览与筛选** — `--list` 浏览可安装的子目录；`--filter` 按 glob 模式精准筛选
- **通用目录** — 默认并行安装到 `.agents/` 和 `.agent/` 目录，与具体工具无关（可通过 `--no-universal` 禁用）
- **中英双语** — 支持 `zh-CN` 和 `en` 输出语言

## v2.0 更新摘要

最近的 Epic 7 提交完成了 v2.0 工具矩阵与发布收尾：

- 工具支持从 4 个扩展到 11 个：新增 Codex CLI、OpenCode、Auggie、Gemini CLI、Windsurf、Kiro、Antigravity、Trae，同时 `vscode` 工具 ID 归并到 Copilot。
- 内置安装规则扩展为 55 条工具规则 + 4 条通用目录规则，并同步中英矩阵和迁移文档。
- Codex CLI 与 OpenCode 的 MCP 处理采用更稳妥的降级策略：复制模板并输出手动合并提示，不直接改写工具自有配置。
- 新增 Gemini CLI 版本前置检查、Windsurf `agents/` 到 `workflows/` 语义提示、Trae skills 不支持提示、iFlow 遗留目录提醒。
- 回归测试覆盖 11 工具矩阵、检测、dry-run、规则匹配和工具特定规则。

## 快速开始

### 前置要求

- [Node.js](https://nodejs.org/) >= 18.0.0
- [Git](https://git-scm.com/) >= 2.20

### 首次配置

```bash
npx @fancyliu/aiforge init
```

交互式引导你完成默认仓库和认证方式的配置，信息保存到 `~/.aiforge/config.json`。

### 安装到全局（推荐）

```bash
# 符号链接模式：持久化仓库 + 自动更新
npx @fancyliu/aiforge -g -l
```

### 安装到当前项目

```bash
cd your-project
npx @fancyliu/aiforge
```

## 本地开发运行

npm 包名为 `@fancyliu/aiforge`。安装后的 CLI 命令仍然是 `aiforge`；如果需要在本仓库中开发或调试源码，
请使用以下本地运行方式。

### 源码运行（推荐用于开发）

```bash
# 安装依赖
npm install

# 通过 tsx 直接运行（无需构建）
npm run dev -- [repo-url] [options]

# 示例
npm run dev -- init
npm run dev -- -g -l --dry-run
npm run dev -- --help
```

### 构建后运行

```bash
# 先构建
npm run build

# 运行编译后的 CLI
node dist/index.js [repo-url] [options]

# 示例
node dist/index.js init
node dist/index.js -g -l --dry-run
```

### 注册为全局命令

```bash
# 构建并注册为全局命令
npm run build
npm link

# 之后可直接使用 aiforge 命令
aiforge init
aiforge -g -l

# 不再需要时取消注册
npm unlink -g aiforge
```

## 使用方式

### 主命令：安装

```bash
npx @fancyliu/aiforge [repo-url] [options]
```

| 参数/选项                | 说明                                       |
| ------------------------ | ------------------------------------------ |
| `repo-url`               | Git 仓库 URL（可省略，使用默认仓库）       |
| `-g, --global`           | 安装到用户全局目录                         |
| `-l, --link`             | 使用符号链接模式                           |
| `-t, --tools <tools...>` | 指定目标工具（如 `copilot claude cursor`） |
| `-d, --dirs <dirs...>`   | 指定源目录（如 `skills agents`）           |
| `--dry-run`              | 预览模式，不写入文件                       |
| `--quiet`                | 极简输出                                   |
| `--force`                | 覆盖已存在文件，不备份                     |
| `--ssh`                  | 强制使用 SSH 协议                          |
| `--token <token>`        | 使用 Personal Access Token                 |
| `--clone-dir <path>`     | 指定持久化克隆路径                         |
| `--list <dir>`           | 列举指定顶层目录下的可安装子目录           |
| `--filter <pattern>`     | 按 glob 模式筛选子目录（如 `skills/git*`） |
| `--no-universal`         | 跳过通用目录安装（`.agents/`、`.agent/`）  |

### 使用示例

```bash
# 使用已配置的默认仓库
npx @fancyliu/aiforge

# 指定仓库 URL
npx @fancyliu/aiforge https://your-git-host.com/team/ai-configs.git

# 全局 + 符号链接（推荐长期使用）
npx @fancyliu/aiforge -g -l

# 只安装 Skills 和 Agents 到 Copilot
npx @fancyliu/aiforge -t copilot -d skills agents

# 预览安装计划
npx @fancyliu/aiforge --dry-run

# 强制覆盖所有文件
npx @fancyliu/aiforge --force

# 使用 SSH 认证
npx @fancyliu/aiforge --ssh

# 列举 skills/ 下的可安装子目录
npx @fancyliu/aiforge --list skills

# 只安装匹配 glob 模式的 skills
npx @fancyliu/aiforge --filter "skills/git*"

# 跳过通用目录安装
npx @fancyliu/aiforge --no-universal
```

### 子命令

```bash
# 交互式初始化配置
npx @fancyliu/aiforge init

# 重新运行持久化符号链接安装以更新克隆仓库
npx @fancyliu/aiforge -g -l
```

## 支持的 AI 工具

> **v2.0**：`vscode` 工具已移除，VS Code MCP 配置现由 `copilot` 项目规则管理。详见 [docs/migration-v2.zh.md](docs/migration-v2.zh.md)。

| 工具                             | 全局安装 | 项目安装 | 主要资源类型                            | 备注                                             |
| -------------------------------- | :------: | :------: | --------------------------------------- | ------------------------------------------------ |
| GitHub Copilot                   |    ✅    |    ✅    | Agents、Skills、Instructions、MCP Tools | `.vscode/` 项目 MCP 文件由 Copilot 管理          |
| Claude Code                      |    ✅    |    ✅    | Agents、Skills、Instructions            | 项目 instructions 会同时写入 `.claude/` 与仓库根 |
| Cursor                           |    ✅    |    ✅    | Agents、Skills                          | skills 使用 Flatten 模式                         |
| Codex CLI                        |    ✅    |    ✅    | Agents、Skills、MCP Tools               | MCP 模板需要手动合并                             |
| OpenCode                         |    ✅    |    ✅    | Agents、Skills、Instructions、MCP Tools | 使用 XDG 全局路径                                |
| Auggie                           |    ✅    |    ✅    | Agents、Skills、Instructions            | 项目 instructions 把 `AGENTS.md` 写到仓库根      |
| Gemini CLI                       |    ✅    |    ✅    | Skills、Instructions                    | skills 需要 Gemini CLI `v0.26.0+`                |
| Windsurf                         |    ✅    |    ✅    | Skills、Rules、Agents                   | `agents/` 会映射到 `workflows/` 并提示           |
| Kiro                             |    ✅    |    ✅    | Skills、Instructions                    | instructions 写入 `steering/`                    |
| Antigravity                      |    ✅    |    ✅    | Agents、Skills                          | 全局路径位于 `~/.gemini/antigravity/`            |
| Trae                             |    —     |    ✅    | Rules、Instructions                     | 明确不支持 skills                                |
| 通用目录 (`.agents/`, `.agent/`) |    —     |    ✅    | Agents、Skills                          | 与工具矩阵并行执行的附加路径                     |

### 完整安装规则矩阵

<details>
<summary>点击展开 v2.0 完整矩阵文档链接</summary>

- [docs/install-rules-matrix.md](docs/install-rules-matrix.md) — 英文完整 55 条工具规则 + 4 条通用规则
- [docs/install-rules-matrix.zh.md](docs/install-rules-matrix.zh.md) — 中文完整矩阵
- [docs/migration-v2.md](docs/migration-v2.md) — 英文升级指南
- [docs/migration-v2.zh.md](docs/migration-v2.zh.md) — 中文升级指南

</details>

## 知识仓库结构

任何遵循以下目录约定的 Git 仓库都可以作为 aiforge 的知识源：

```
your-knowledge-repo/
├── agents/                 # Agent 定义（专家角色）
│   ├── coding-agent.md
│   └── review-agent.md
├── skills/                 # Skill 定义（操作手册）
│   └── code-review/
│       ├── skill.md        # 主文件（Flatten 模式使用）
│       └── templates/
├── instructions/           # 全局/场景化指令
│   ├── copilot-instructions.md
│   └── security.instructions.md
└── mcp-tools/              # MCP 服务器配置
    └── mcp.json
```

## 安装模式

### 复制模式（默认）

将文件从仓库复制到目标目录。文件作为独立副本存在，适合项目级安装。

```bash
npx @fancyliu/aiforge          # 项目安装，复制文件
npx @fancyliu/aiforge -g       # 全局安装，复制文件
```

### 符号链接模式

将仓库持久化到本地，在目标目录创建符号链接。后续在克隆目录运行 `git pull`，或重新运行 `npx @fancyliu/aiforge -g -l` 即可更新。

```bash
npx @fancyliu/aiforge -g -l    # 全局安装，符号链接
```

> **注意：** 符号链接模式仅支持全局安装。项目级安装始终使用复制模式。

### Flatten 模式

特定规则（如 Cursor skills）自动使用。将子目录中的主文件提取并重命名 — 例如 `skills/code-review/skill.md` 会变为目标目录中的 `code-review.md`。

## 认证

aiforge 按以下优先级解析认证信息：

1. **CLI 参数** — `--token <value>` 或 `--ssh`
2. **环境变量** — `AIFORGE_TOKEN` / `GITLAB_TOKEN` / `GIT_TOKEN`
3. **配置文件** — `~/.aiforge/config.json` 中的 `auth` 字段（按 hostname 索引）
4. **系统凭据** — macOS Keychain / 系统凭据管理器

```bash
# SSH 方式
npx @fancyliu/aiforge https://your-git-host.com/team/repo.git --ssh

# Token 方式
npx @fancyliu/aiforge https://your-git-host.com/team/repo.git --token <your-access-token>

# 环境变量方式（适合 CI/CD）
export GIT_TOKEN=<your-access-token>
npx @fancyliu/aiforge https://your-git-host.com/team/repo.git
```

## 配置文件

首次运行 `npx @fancyliu/aiforge init` 后，配置保存在 `~/.aiforge/config.json`：

```jsonc
{
  "defaultRepo": "https://your-git-host.com/team/ai-configs.git",
  "preferSSH": true,
  "cloneDir": "~/ai-configs",
  "language": "zh-CN",
  "universalDirs": true,
  "auth": {
    "your-git-host.com": {
      "method": "ssh",
    },
  },
}
```

| 字段            | 说明                                                    |
| --------------- | ------------------------------------------------------- |
| `defaultRepo`   | 默认仓库 URL（省略 repo-url 参数时使用）                |
| `preferSSH`     | 全局 SSH 偏好                                           |
| `cloneDir`      | 持久化克隆目录路径                                      |
| `language`      | 输出语言：`zh-CN`（默认）或 `en`                        |
| `universalDirs` | 启用通用目录安装（`.agents/`、`.agent/`）。默认：`true` |
| `auth`          | 按 hostname 索引的认证配置                              |

## 项目架构

```
aiforge/
├── src/
│   ├── index.ts              # CLI 入口 (commander.js)
│   ├── pipeline.ts           # 管道编排器
│   ├── core/                 # 核心模块（零外部依赖）
│   │   ├── types.ts          # 类型定义
│   │   ├── errors.ts         # AiforgeError 统一错误
│   │   ├── reporter.ts       # 输出抽象（Tty/Plain/Quiet）
│   │   ├── messages.ts       # i18n 消息字符串
│   │   ├── path-resolver.ts  # 平台路径解析
│   │   └── sanitize.ts       # Token 脱敏
│   ├── stages/               # 管道阶段
│   │   ├── resolve-source.ts # 解析仓库地址
│   │   ├── authenticate.ts   # 四层认证链
│   │   ├── clone.ts          # Git 克隆/增量更新
│   │   ├── detect-tools.ts   # AI 工具检测
│   │   ├── match-rules.ts    # 规则匹配引擎
│   │   └── execute-install.ts# 安装执行（含 preflight）
│   ├── services/             # 服务层
│   │   ├── config.ts         # 配置管理
│   │   ├── git.ts            # simple-git 封装
│   │   ├── manifest.ts       # manifest.json 管理
│   │   └── fs-utils.ts       # 文件系统工具
│   ├── data/                 # 纯数据（零运行时依赖）
│   │   ├── tool-registry.ts  # 工具检测注册表
│   │   └── install-rules.ts  # 安装规则常量
│   └── commands/
│       └── init.ts           # aiforge init 子命令
├── tests/                    # 976 测试（镜像 src/ 结构）
└── dist/                     # 构建输出（ESM）
```

### 管道流程

```
Resolve → Auth → Clone → Detect → Match → [Install(含preflight)] → Report
                                            ↑ dry-run 在此跳过
```

## 扩展新的 AI 工具

只需在两个数据文件中添加配置，无需修改引擎代码：

```typescript
// 1. 在 src/data/tool-registry.ts 注册工具
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  // ...existing tools...
  {
    id: 'newtool',
    name: 'New AI Tool',
    detect: {
      global: ['~/.newtool'],
      project: ['.newtool'],
    },
  },
]

// 2. 在 src/data/install-rules.ts 添加规则
export const BUILTIN_RULES: InstallRule[] = [
  // ...existing rules...
  {
    tool: 'newtool',
    scope: 'project',
    sourceDir: 'skills',
    type: 'Flatten' as InstallType,
    targetDir: '.newtool/rules/',
  },
]
```

## 技术栈

| 技术                                                                 | 用途                      |
| -------------------------------------------------------------------- | ------------------------- |
| TypeScript (ESM)                                                     | 开发语言，严格模式        |
| [tsup](https://www.npmjs.com/package/tsup)                           | 构建工具（esbuild-based） |
| [commander](https://www.npmjs.com/package/commander)                 | CLI 参数解析              |
| [chalk](https://www.npmjs.com/package/chalk) v5+                     | 终端彩色输出              |
| [ora](https://www.npmjs.com/package/ora) v8+                         | Spinner 动画              |
| [@inquirer/prompts](https://www.npmjs.com/package/@inquirer/prompts) | 交互式提示                |
| [simple-git](https://www.npmjs.com/package/simple-git) ~3.32         | Git 操作封装              |
| [vitest](https://www.npmjs.com/package/vitest)                       | 测试框架（976 测试）      |

## 兼容性

| 维度     | 要求                               |
| -------- | ---------------------------------- |
| Node.js  | >= 18.0.0                          |
| Git      | >= 2.20                            |
| 操作系统 | macOS、Linux（Windows 支持计划中） |

## 文档

- [快速入门](docs/getting-started.zh.md) — 分步首次使用指南
- [配置参考](docs/configuration.zh.md) — 完整配置和环境变量
- [故障排除](docs/troubleshooting.zh.md) — 常见错误及解决方案
- [扩展指南](docs/extending.zh.md) — 添加新 AI 工具支持
- [安装规则矩阵](docs/install-rules-matrix.zh.md) — 完整规则参考
- [v2 迁移指南](docs/migration-v2.zh.md) — `vscode` 归并到 Copilot 的升级说明
- [npm 发布指南](docs/npm-publishing-guide.zh.md) — npm 构建、发布、验证与常见问题手册
- [变更日志](CHANGELOG.md) — 发布历史与重要变更

## 版本号规则

aiforge 遵循 [语义化版本](https://semver.org/)，当前已进入稳定的 `2.x` 主线：

| 版本     | 触发场景                               | 示例                        |
| -------- | -------------------------------------- | --------------------------- |
| `v2.x.y` | 当前主版本线上的向后兼容修复与小幅改进 | `v2.0.4` — bug 修复         |
| `v2.y.0` | 向后兼容的新功能发布                   | `v2.1.0` — 下一个 milestone |
| `v3.0.0` | 存在破坏性变更                         | `v3.0.0` — 下一条主版本线   |

当前 npm 发布版本为 `v2.0.4`。`2.x` 基线始于 `v2.0.0`，这是移除 `vscode` 工具 ID、扩展到 11 工具、并将 VS Code 项目级 MCP 处理归并到 Copilot 的破坏性变更版本。

## AI 辅助配置

如果你在终端或 IDE 中使用 AI 助手（如 Copilot、Claude、Cursor），可以直接复制以下提示词，让 AI 帮你完成 aiforge 的配置和安装。

### 首次配置

> 我需要在本机首次配置 **aiforge**（一个 AI 编码配置安装 CLI 工具）。
>
> 背景信息：
>
> - aiforge 通过 `npx` 运行（无需全局安装），要求 Node.js >= 18、Git >= 2.20
> - 配置文件存储在 `~/.aiforge/config.json`
> - 我们团队的知识仓库地址是：`<在此粘贴你的仓库 URL>`
> - 认证方式：SSH / Token（选一个）
>
> 请按顺序执行以下步骤：
>
> 1. 检查前置条件：确认 `node -v`（>= 18）和 `git -v`（>= 2.20）
> 2. 运行 `npx @fancyliu/aiforge init`，引导我完成交互式配置
> 3. 运行 `npx @fancyliu/aiforge -g -l --dry-run` 预览全局符号链接安装计划
> 4. 如果预览结果正确，运行 `npx @fancyliu/aiforge -g -l` 执行安装
> 5. 展示安装摘要，并用 `npx @fancyliu/aiforge --list skills` 验证可用 skills
>
> 如果任何步骤失败，先展示完整的错误输出并给出修复建议，再继续下一步。

### 项目级安装

> 为当前项目配置 **aiforge**，请按以下步骤执行：
>
> 1. 运行 `npx @fancyliu/aiforge --dry-run` 预览将要安装的内容
> 2. 展示文件列表和目标路径，等我确认
> 3. 运行 `npx @fancyliu/aiforge` 执行安装
> 4. 展示已安装/已更新/已跳过的文件摘要
>
> 除非我明确要求，否则不要使用 `--force`。

### 排查问题

> 我在使用 **aiforge** 时遇到了问题，请帮我诊断：
>
> 1. 运行 `npx @fancyliu/aiforge --version` 记录版本号
> 2. 运行 `npx @fancyliu/aiforge --dry-run` 检查输出中是否有错误
> 3. 检查 `~/.aiforge/config.json` 是否存在配置问题
> 4. 如果是认证相关错误，用 `ssh -T git@<host>` 或 `git ls-remote <repo-url>` 测试
> 5. 汇总发现并给出修复建议
>
> 我看到的错误是：`<在此粘贴你的错误信息>`

## 提交 Issue

发现 Bug 或有功能建议？请通过你所在团队配置的项目跟踪系统提交。

为了帮助我们快速定位问题，请在 Issue 中包含以下信息：

1. **aiforge 版本** — `npx @fancyliu/aiforge --version`
2. **运行环境** — 操作系统、Node.js 版本（`node -v`）、Git 版本（`git -v`）
3. **复现步骤** — 你执行的完整命令
4. **期望 vs 实际行为** — 你期望发生什么，实际发生了什么
5. **错误输出** — 完整的三段式错误提示（如有）

> **提示：** 运行 `npx @fancyliu/aiforge --dry-run` 并附上输出，可以帮助我们在不产生副作用的情况下诊断安装规则问题。

### Issue 模板

```markdown
**类型：** Bug / 功能建议

**运行环境：**

- aiforge: <版本号>
- Node.js: <版本号>
- Git: <版本号>
- 操作系统: <系统及版本>

**问题描述：**
<清晰描述问题或功能建议>

**复现步骤：**（仅 Bug）

1. 运行 `npx @fancyliu/aiforge ...`
2. ...

**期望行为：**
<你期望发生什么>

**实际行为：**
<实际发生了什么>

**错误输出：**（如有）
<粘贴完整的三段式错误提示>

**Dry-run 输出：**（如有）
<粘贴 `npx @fancyliu/aiforge --dry-run` 的输出>
```

### AI 辅助撰写 Issue

如果你使用 AI 助手（如 Copilot、Claude、Cursor）辅助撰写 Issue，可以使用以下提示词：

> 帮我为 **aiforge** 项目（一个 AI 编码配置安装 CLI 工具）撰写一个 GitLab Issue。请严格遵循以下格式：
>
> 1. 标题：祈使句式的简洁摘要（如"修复使用 SSH 代理时的认证失败"）
> 2. 类型：Bug 或 功能建议
> 3. 运行环境：aiforge 版本、Node.js 版本、Git 版本、操作系统
> 4. 问题描述：2-3 句话说明问题或需求
> 5. 复现步骤（仅 Bug）：编号列出确切命令
> 6. 期望 vs 实际行为：明确区分
> 7. 错误输出：如有，粘贴完整的三段式错误提示（发生了什么 / 为什么 / 怎么修）
> 8. Dry-run 输出：如果与安装规则相关，附上 `npx @fancyliu/aiforge --dry-run` 的输出
>
> 保持客观陈述，不要猜测根因，只包含可验证的信息。

## License

[MIT](LICENSE)
