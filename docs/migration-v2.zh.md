# 迁移到 aiforge v2.0

## 概述

aiforge v2.0 是首个将内置工具矩阵从 3 个主工具扩展到 11 个工具集成的版本。同时它引入了一项明确的破坏性变更：`vscode` 工具 ID 被移除，并归并到 GitHub Copilot 语境。

您现有的 `~/.vscode/` 文件不会被触碰。

## 版本差异对照

| 项目 | v1.x | v2.0 |
|------|------|------|
| 支持的工具 | 4 个：`copilot`、`claude`、`cursor`、`vscode` | 11 个：`copilot`、`claude`、`cursor`、`codex`、`opencode`、`auggie`、`gemini`、`windsurf`、`kiro`、`antigravity`、`trae` |
| 内置工具规则 | 16 | 55 |
| 通用目录规则 | 4 | 4 |
| MCP 行为 | 依赖 VS Code 全局规则，覆盖面有限 | Copilot 项目 MCP + Codex/OpenCode 手动合并降级策略 |
| Instructions 覆盖 | 部分支持 | Claude、Gemini、Kiro、Auggie、Trae 都有明确行为 |
| Preconditions | 无 | Gemini skills 需要 `v0.26.0+` |
| Semantic warnings | 无 | Windsurf agents -> workflows 提示 |
| Unsupported notices | 无 | Trae skills 不支持提示 |

## 新工具清单

| 工具 | v2.0 新增能力 | 快速使用说明 |
|------|---------------|--------------|
| Codex CLI | Skills、agents、MCP 模板降级 | `--tools codex` |
| OpenCode | XDG 全局路径、skills、agents、MCP 模板 | `--tools opencode` |
| Auggie | Skills、agents、根目录 `AGENTS.md` | `--tools auggie` |
| Gemini CLI | Skills 与 `AGENTS.md` / `GEMINI.md` | 安装 skills 前先升级 Gemini CLI |
| Windsurf | Skills、rules、workflows 映射 | 关注 workflows 语义提示 |
| Kiro | Skills 与 steering instructions | instructions 写入 `steering/` |
| Antigravity | Gemini 子命名空间集成 | 全局安装落在 `~/.gemini/antigravity/` |
| Trae | 仅 rules 与根目录 `AGENTS.md` | skills 仍由 UI 管理，不走文件安装 |

## 破坏性变更：`vscode` -> `copilot`

### 旧行为与新行为映射

| v1.x | v2.0 | 说明 |
|------|------|------|
| `--tools vscode` | `--tools copilot` | 请同步替换脚本与 CI 配置 |
| `vscode:global:mcp-tools -> ~/.vscode/` | 移除 | 不再管理 home 级 VS Code MCP 路径 |
| 无 | `copilot:project:mcp-tools -> .vscode/` | 项目级 MCP 文件改由 Copilot 规则落地 |

### 推荐升级步骤

1. 安装或构建 aiforge v2.0。
2. 如需继续使用 VS Code MCP 文件，安装 GitHub Copilot 扩展。
3. 创建 aiforge 约定的 Copilot 标记目录：

```bash
mkdir -p ~/.copilot/
```

4. 使用新的工具 ID 重新执行安装：

```bash
npx aiforge --tools copilot
```

5. 验证项目级 MCP 文件是否写入 `.vscode/`。

### 升级命令

```bash
# 本地源码工作流
npm install
npm run build

# 正式写入前先预览
npx aiforge --dry-run

# 面向 VS Code 旧用户的定向迁移
npx aiforge --tools copilot --dry-run
npx aiforge --tools copilot
```

### 回滚命令

```bash
# 如需对照旧版本行为，可临时查看上一个大版本
npx aiforge@1 --help

# 如果本地测试改动了构建产物，可清理后重建
rm -rf dist
npm run build
```

## 工具级迁移提示

### Gemini CLI

- `skills/` 安装会在 Gemini CLI 低于 `v0.26.0` 时被跳过。
- 升级命令：

```bash
npm install -g @google/gemini-cli@latest
```

### Windsurf

- v2.0 会把通用 `agents/` 映射到 Windsurf 的 `workflows/`。
- 这是语义桥接，不是完全等价。用于生产前请检查生成结果。

### Trae

- v2.0 明确不安装 Trae 的 `skills/`。
- 仍需在产品 UI 中配置 Trae skills；aiforge 只处理 `rules/` 和根级 `AGENTS.md`。

### Codex CLI 与 OpenCode 的 MCP 策略

- aiforge 只复制 MCP 模板文件。
- 您仍需手动合并到真实配置：
  - Codex：`~/.codex/config.toml` 的 `[mcp]`
  - OpenCode：`~/.config/opencode/opencode.json` 的 `"mcp"` 字段

### iFlow 停服提示

- 当 aiforge 检测到残留 `.iflow/` 目录时，v2.0 会输出 stale-tool 信息提示。
- iFlow CLI 已于 `2026-04-17` 停服；aiforge 不会向 `.iflow/` 安装任何内容。

## 常见问题

**Q：我还保留着 v1.x 的 `~/.vscode/`，v2.0 会删掉吗？**

A：不会。v2.0 只会输出迁移提示，不会删除或覆盖 home 级 `~/.vscode/` 文件。

**Q：`--tools vscode` 现在该替换成什么？**

A：改为 `--tools copilot`。

**Q：为什么 Gemini 跳过了我的 skills 安装？**

A：通常是 Gemini CLI 版本低于 `v0.26.0`，或者系统 `PATH` 中没有 `gemini` 命令。

**Q：为什么 Windsurf 会提示 workflows？**

A：因为 aiforge 会把 `agents/` 映射到 `.windsurf/workflows/`，并明确提醒 workflow 与通用 agent 并不完全相同。

**Q：为什么安装后看不到 Trae skills？**

A：这是预期行为。v2.0 不支持通过文件系统安装 Trae skills。

**Q：为什么 Codex 或 OpenCode 的 MCP 还需要手动处理？**

A：因为它们的正式配置文件需要与工具自管配置合并，aiforge 故意采用“复制模板 + 手动合并”的降级策略。

**Q：有没有不写文件的迁移验证方式？**

A：有。先执行 `npx aiforge --dry-run`，或者执行 `npx aiforge --tools <tool> --dry-run`。
