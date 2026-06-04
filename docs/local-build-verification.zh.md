# 本地构建验证指南

当你需要在发布到 npm 之前，在本机验证尚未发布的 `aiforge` 修改时，使用本指南。

[English Version](local-build-verification.md)

## 为什么不能只用 `npx @fancyliu/aiforge`

`npx @fancyliu/aiforge ...` 会下载并运行 npm registry 上当前已发布的版本，不会运行你本地工作区里的代码。

因此，`npx @fancyliu/aiforge ...` 适合验证公开发布版本，但不能证明 `src/` 或 `dist/` 中的本地修复已经生效，除非这个修复已经发布到 npm。

验证本地修改时，使用下面两种方式之一：

- 用 `node dist/index.js` 直接运行本地构建产物
- 用 `npm link` 模拟安装后的全局 `aiforge` 命令

## 前置条件

- Node.js `>=18.0.0`
- 已执行 `npm install`
- 已有本仓库的本地 checkout

## 方式一：直接运行本地构建 CLI

这是验证本地修复最稳妥的方式，因为它不会改动你的全局 npm link。

先在仓库根目录构建：

```bash
cd /Users/fancyliu/IdeaProjects/wshoto-gitlab-workspace/ai-forge
npm run build
```

然后在你要复现行为的目录中运行构建产物。

示例：验证在全局 skills 目录下执行 project-scope 安装时会被拒绝：

```bash
cd ~/.agents/skills
node /Users/fancyliu/IdeaProjects/wshoto-gitlab-workspace/ai-forge/dist/index.js \
  https://github.com/fLanliulf/fancy-claude-code \
  -t codex -d skills --filter "skills-*" --dry-run
```

对 project-scope 全局目录护栏而言，预期结果是：

```text
ERROR: 项目级安装不能在全局 AI 目录内执行
```

命令应在输出 dry-run 安装计划前停止，不应再出现下面这类嵌套路径：

```text
~/.agents/skills/.codex/skills/
~/.agents/skills/.agents/skills/
~/.agents/skills/.agent/skills/
```

## 方式二：模拟安装后的全局命令

当你需要验证本地 checkout 是否能像已安装的 `aiforge` 命令一样工作时，使用 `npm link`。

先在仓库根目录执行：

```bash
cd /Users/fancyliu/IdeaProjects/wshoto-gitlab-workspace/ai-forge
npm run build
npm link
```

然后在复现目录中运行 `aiforge`：

```bash
cd ~/.agents/skills
aiforge https://github.com/fLanliulf/fancy-claude-code \
  -t codex -d skills --filter "skills-*" --dry-run
```

预期结果与直接运行 `node dist/index.js` 一致：本地构建应拒绝在全局 skills 目录中执行 project-scope 安装。

## 取消本地全局链接

验证完成后，移除全局 link：

```bash
npm unlink -g @fancyliu/aiforge
```

如果你的 npm 版本提示 scoped package 未被 link，先检查当前命令路径：

```bash
which aiforge
```

如果它仍指向本地 npm link，按 npm 错误输出中显示的 package 名称移除对应 link。

## 推荐验证流程

大多数修复建议按下面顺序验证：

```bash
cd /Users/fancyliu/IdeaProjects/wshoto-gitlab-workspace/ai-forge
npm run build
npm test

cd ~/.agents/skills
node /Users/fancyliu/IdeaProjects/wshoto-gitlab-workspace/ai-forge/dist/index.js \
  https://github.com/fLanliulf/fancy-claude-code \
  -t codex -d skills --filter "skills-*" --dry-run
```

只有在确实需要验证全局 `aiforge` 命令名时，再使用 `npm link`。

