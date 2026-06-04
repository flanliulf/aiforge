# Local Build Verification Guide

Use this guide when you need to verify an unpublished `aiforge` change on your machine before publishing it to npm.

[中文版本](local-build-verification.zh.md)

## Why `npx @fancyliu/aiforge` Is Not Enough

`npx @fancyliu/aiforge ...` downloads and runs the version currently published to the npm registry. It does not run your local working tree.

That means `npx @fancyliu/aiforge ...` is useful for verifying the public release, but it cannot prove that a local fix in `src/` or `dist/` works until that fix has been published.

For local verification, run either:

- the built file directly with `node dist/index.js`
- a linked global command with `npm link`

## Prerequisites

- Node.js `>=18.0.0`
- Dependencies installed with `npm install`
- A local checkout of this repository

## Option 1: Run The Built CLI Directly

This is the safest way to validate a local fix because it does not modify your global npm links.

From the repository root:

```bash
cd /Users/fancyliu/IdeaProjects/wshoto-gitlab-workspace/ai-forge
npm run build
```

Then run the built CLI from the directory where you want to reproduce the behavior.

Example: verify that project-scope installs are rejected from a global skills directory:

```bash
cd ~/.agents/skills
node /Users/fancyliu/IdeaProjects/wshoto-gitlab-workspace/ai-forge/dist/index.js \
  https://github.com/fLanliulf/fancy-claude-code \
  -t codex -d skills --filter "skills-*" --dry-run
```

Expected result for the project-scope global-directory guard:

```text
ERROR: 项目级安装不能在全局 AI 目录内执行
```

The command should stop before printing a dry-run install plan with nested paths such as:

```text
~/.agents/skills/.codex/skills/
~/.agents/skills/.agents/skills/
~/.agents/skills/.agent/skills/
```

## Option 2: Simulate The Installed Global Command

Use `npm link` when you want the local checkout to behave like an installed `aiforge` command.

From the repository root:

```bash
cd /Users/fancyliu/IdeaProjects/wshoto-gitlab-workspace/ai-forge
npm run build
npm link
```

Then run `aiforge` from the reproduction directory:

```bash
cd ~/.agents/skills
aiforge https://github.com/fLanliulf/fancy-claude-code \
  -t codex -d skills --filter "skills-*" --dry-run
```

Expected result is the same as the direct `node dist/index.js` run: the local build should reject project-scope execution from the global skills directory.

## Remove The Local Global Link

After testing, remove the linked global package:

```bash
npm unlink -g @fancyliu/aiforge
```

If your npm version reports that the scoped package is not linked, inspect the active command path:

```bash
which aiforge
```

If it still points to a local npm link, remove the link using the package name npm reports in its error output.

## Recommended Verification Flow

For most fixes, use this order:

```bash
cd /Users/fancyliu/IdeaProjects/wshoto-gitlab-workspace/ai-forge
npm run build
npm test

cd ~/.agents/skills
node /Users/fancyliu/IdeaProjects/wshoto-gitlab-workspace/ai-forge/dist/index.js \
  https://github.com/fLanliulf/fancy-claude-code \
  -t codex -d skills --filter "skills-*" --dry-run
```

Use `npm link` only when you specifically need to verify the global `aiforge` command name.

