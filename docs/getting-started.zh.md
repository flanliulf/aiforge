# 快速入门

本指南帮助你完成 aiforge 的首次配置和使用。

## 前置要求

- **Node.js** >= 18.0.0 — [下载](https://nodejs.org/)
- **Git** >= 2.20 — [下载](https://git-scm.com/)

验证安装：

```bash
node --version   # 应输出 v18.x.x 或更高
git --version    # 应输出 git version 2.20 或更高
```

## 第一步：初始化配置

运行交互式设置向导：

```bash
npx @fancyliu/aiforge init
```

向导会引导你完成：

1. **默认仓库 URL** — 存放 AI 配置的 Git 仓库地址
2. **认证方式** — SSH 密钥、个人访问令牌或系统凭据
3. **语言偏好** — 中文（`zh-CN`）或英文（`en`）
4. **通用目录** — 是否并行安装到 `.agents/` 和 `.agent/` 目录（默认：是）

配置保存到 `~/.aiforge/config.json`。

> **提示：** 可以跳过 `init`，直接通过命令行参数指定仓库 URL。但首次使用建议使用 `init`，它会验证你的认证信息。

## 第二步：预览安装计划

在实际写入文件前，先预览 aiforge 将会安装什么：

```bash
# 预览项目级安装
npx @fancyliu/aiforge --dry-run

# 预览全局安装
npx @fancyliu/aiforge -g --dry-run
```

预览输出会展示：
- 系统中检测到的 AI 工具
- 将要安装的资源类型（Agents、Skills 等）
- 每个文件的确切目标路径

## 第三步：安装

### 项目级安装（默认）

将配置安装到当前项目目录：

```bash
cd your-project
npx @fancyliu/aiforge
```

文件以**复制**方式放入项目（如 `.github/agents/`、`.claude/skills/`）。这些是独立副本 — 知识仓库的变更不会影响已安装的文件，除非重新运行 aiforge。

### 全局安装

安装到用户级工具目录：

```bash
# 复制模式（快照）
npx @fancyliu/aiforge -g

# 符号链接模式（推荐 — git pull 自动更新）
npx @fancyliu/aiforge -g -l
```

**符号链接模式**（`-l`）推荐用于全局安装，因为：
- 知识仓库会被克隆并持久化到本地
- 目标目录通过符号链接指向克隆的文件
- 在克隆目录运行 `git pull`，或重新运行 `npx @fancyliu/aiforge -g -l` 即可立即更新所有工具

## 第四步：验证

安装完成后，你会看到类似的总结：

```
✅ coding-agent.md        → ~/.copilot/agents/coding-agent.md
✅ code-review/           → ~/.copilot/skills/code-review/
🔄 mcp.json               → ~/.copilot/mcp.json
⏭️  security.instructions → ~/.copilot/security.instructions.md

安装: 2 项  更新: 1 项  跳过: 1 项
```

打开你的 AI 工具（如 VS Code + Copilot）确认配置已生效。

## 新员工入职 3 分钟指南

如果你是新员工，只需要三步：

```bash
# 1. 初始化（选 SSH，输入你的 Git 仓库地址）
npx @fancyliu/aiforge init

# 2. 全局安装 + 符号链接
npx @fancyliu/aiforge -g -l

# 3. 验证（可选）
npx @fancyliu/aiforge --dry-run
```

> **本地开发？** 如果你正在本仓库中调试源码，请将上述 `npx @fancyliu/aiforge` 替换为 `npm run dev --`，例如 `npm run dev -- init`。详见下方[本地开发运行](#本地开发运行)章节。

遇到认证问题？查看 [故障排除](troubleshooting.zh.md)。

## 本地开发运行

npm 包名为 `@fancyliu/aiforge`。安装后的 CLI 命令仍然是 `aiforge`；以下命令仅用于在本地 checkout 中开发或调试源码。

### 源码运行（推荐）

```bash
# 安装依赖
npm install

# 通过 tsx 直接运行（无需构建）
npm run dev -- [repo-url] [options]

# 示例
npm run dev -- init
npm run dev -- -g -l --dry-run
npm run dev -- --list skills
npm run dev -- --help
```

### 构建后运行

```bash
# 先构建
npm run build

# 运行编译后的 CLI
node dist/index.js [repo-url] [options]
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

## 常见场景

### 场景一：只安装特定资源

```bash
# 只安装 Skills 和 Agents
npx @fancyliu/aiforge -d skills agents

# 只安装到 Copilot
npx @fancyliu/aiforge -t copilot
```

### 场景二：浏览并选择特定子目录

```bash
# 列举 skills/ 下所有可安装的子目录
npx @fancyliu/aiforge --list skills

# 只安装匹配模式的 skills
npx @fancyliu/aiforge --filter "skills/git*"
```

### 场景三：不同项目用不同仓库

```bash
# 为当前项目使用特定仓库
npx @fancyliu/aiforge https://your-git-host.com/team-b/special-configs.git
```

### 场景四：CI/CD 管道中使用

```bash
# 使用环境变量认证
export GIT_TOKEN=<your-access-token>
npx @fancyliu/aiforge --quiet
```

### 场景五：强制更新所有文件

```bash
# 覆盖所有已存在文件，不确认
npx @fancyliu/aiforge --force
```

## 下一步

- [配置参考](configuration.zh.md) — 完整配置选项说明
- [故障排除](troubleshooting.zh.md) — 解决常见问题
- [安装规则矩阵](install-rules-matrix.zh.md) — 查看文件会被安装到哪里
