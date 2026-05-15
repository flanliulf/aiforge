# 迁移到 aiforge v2.0

## 概述

aiforge v2.0 引入了一项**破坏性变更**：`vscode` 工具 ID 已被移除，其功能已合并到 GitHub Copilot 语境中。

**您现有的 `~/.vscode/` 文件完全安全 — aiforge v2.0 不会覆盖或删除它们。**

---

## 变更内容

### 版本差异对照表

| 区域 | v1.x | v2.0 |
|------|------|------|
| 支持的工具 | copilot、claude、cursor、**vscode** | copilot、claude、cursor |
| `vscode` 工具 ID | ✅ 可用 | ❌ 已移除 |
| VS Code MCP 配置 | `vscode:global → ~/.vscode/` | `copilot:project → .vscode/` |
| Claude 指令文件 | 未安装 | ✅ `~/.claude/` + `.claude/` |
| Cursor 全局 agents | 未安装 | ✅ `~/.cursor/rules/` |
| BUILTIN_RULES 数量 | 16 | 19 |

### 旧规则 → 新规则映射表

| 旧规则（v1.x） | 新规则（v2.0） | 说明 |
|----------------|----------------|------|
| `vscode:global:mcp-tools → ~/.vscode/` | **已移除** | 全局 VS Code MCP 路径已废弃 |
| *（无）* | `copilot:project:mcp-tools → .vscode/` | 通过 Copilot 管理项目级 `.vscode/`（文件名沿用 `mcp-tools/` 源目录的文件名） |
| *（无）* | `claude:global:instructions → ~/.claude/` | v2.0 新增 |
| *（无）* | `claude:project:instructions → .claude/` | v2.0 新增 |
| *（无）* | `cursor:global:agents → ~/.cursor/rules/` | v2.0 新增 |

---

## 升级步骤

### 1. 升级 aiforge

```bash
npm install -g aiforge@2.0.0
# 或
npx aiforge@2.0.0 --help
```

### 2. 安装 GitHub Copilot 扩展并创建 `~/.copilot/` 标识目录

如果您之前使用 aiforge 配合 VS Code 管理 MCP 配置，需要继续使用该功能：

- **VS Code**：安装 [GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) 扩展
- **然后创建 aiforge 标识目录**：`mkdir -p ~/.copilot/`
  - 这是 aiforge 的约定路径；扩展本身**不会**自动创建此目录。
  - 详情请参见下方「关于 `~/.copilot/`」说明。
- 两者都就绪后，`aiforge install` 将检测到 Copilot（通过 `~/.copilot/` 标识目录）并应用 `.vscode/` MCP 规则（将 `mcp-tools/` 中的文件复制到项目 `.vscode/` 目录）。

### 3. 重新执行 aiforge install

```bash
aiforge install
```

aiforge 现在会通过 `~/.copilot/` 标识目录或项目 `.github/` 检测 Copilot 语境并应用更新后的规则。

---

## 我现有的 `~/.vscode/` 文件会怎样？

**什么都不会发生。** aiforge v2.0 不会修改您的 `~/.vscode/` 目录。您的配置文件将被完整保留。

如果 aiforge 检测到 `~/.vscode/` 但未检测到 Copilot 语境（`~/.copilot/` 标识目录或项目 `.github/`），将显示以下警告：

```
⚠️ 检测到 ~/.vscode/ 但未检测到 ~/.copilot/。从 v2.0 起 VS Code 已归并到 GitHub Copilot 语境。
  ① VS Code MCP 现由 Copilot 项目级规则承接（目标路径 .vscode/<文件名>）
  ② 安装 GitHub Copilot 扩展
  ③ 创建 ~/.copilot/ 作为 aiforge 标识目录（见下方说明），再重新执行 aiforge install
  ④ 现有 ~/.vscode/ 文件不会被覆盖或删除
```

> **关于 `~/.copilot/`**：该路径是 aiforge 自定义的约定标识目录 — **并非** GitHub Copilot 扩展的实际安装位置。GitHub Copilot 本身将文件写入 `~/.vscode/extensions/github.copilot-*/` 及 IDE 配置目录。要让 aiforge 识别您正在使用 Copilot，请手动创建该标识目录：
> ```bash
> mkdir -p ~/.copilot/
> ```
> 创建后，`aiforge install` 即可检测到 Copilot 并应用相应规则。

此警告仅为提示信息。迁移提示本身不会阻断安装流程；但如果未检测到任何受支持的 AI 工具（即 Copilot、Claude Code、Cursor 均未安装），aiforge 仍会因 `NO_TOOLS` 错误退出，直至您安装其中一个工具。

---

## 常见问题（FAQ）

**Q：我的脚本中使用了 `--tools vscode`，应该改成什么？**

A：将 `--tools vscode` 替换为 `--tools copilot`。GitHub Copilot 现在负责管理 VS Code MCP 配置。

```bash
# 之前（v1.x）
aiforge install --tools vscode

# 之后（v2.0）
aiforge install --tools copilot
```

---

**Q：使用 Copilot 执行 `aiforge install` 时，我 `.vscode/` 目录下的 MCP 配置文件会被覆盖吗？**

A：仅当该文件存在且之前由 aiforge 管理（记录在清单中）时才会覆盖。如果是用户手动创建的文件，aiforge 会在覆盖前提示确认；在提示中选择"跳过"可保留该文件。`--force` 是跳过确认提示（而非跳过文件写入）；如需保留手动编写的 `.vscode/` 配置文件，请勿使用 `--force`。

> **注意**：写入 `.vscode/` 的文件名与知识库 `mcp-tools/` 源目录中的文件名一致（例如源文件为 `mcp.json`，则目标为 `.vscode/mcp.json`）。

---

**Q：我不使用 GitHub Copilot，是否完全失去 VS Code MCP 支持？**

A：对于全局 `~/.vscode/` 路径，是的。但如果您安装 GitHub Copilot 并执行 `aiforge install`，MCP 配置将写入项目目录下的 `.vscode/`（文件名沿用 `mcp-tools/` 源目录的文件名）— VS Code 同样读取该路径。项目级配置路径（`.vscode/`）保持不变，只是检测机制有所改变。

---

**Q：我还想使用旧的 `vscode` 规则，该怎么办？**

A：v2.0 中 `vscode` 工具 ID 已不再存在。目前请使用 `--tools copilot` 获取 `.vscode/` 项目级 MCP 支持。如果您需要内置规则以外的自定义能力，欢迎[提交 Issue](https://github.com/anthropics/claude-code/issues) 说明需求。
