我来为你进行深度调研。这需要大量搜索，让我逐步进行。

**第一轮：搜索核心工具的配置信息**

**第三轮：搜索更多细节配置路径**

现在我获得了足够的信息。下面为你整理一份**全面深度的调研报告**。

---

# 🔬 各 AI 编码工具对四大核心概念的支持深度调研报告

> **四大概念定义**（由 Anthropic 提出/推广，已成为行业事实标准）：
> 1. **Agents（智能体）** — 自定义的 AI 角色，具有独立的提示词、模型绑定和工具权限
> 2. **Skills（技能）** — 可复用的指令包（`SKILL.md` + 脚本/资源），按需加载的专业能力模块
> 3. **MCP（Model Context Protocol）** — 连接外部工具/数据源的标准化协议
> 4. **指令文件（CLAUDE.md / AGENTS.md / 等价物）** — 为 Agent 提供持久化上下文指令的 Markdown 文件

---

## 一、总览对比表

| 工具 | 类型 | Agents | Skills | MCP | 指令文件 | 指令文件名称 |
|------|------|--------|--------|-----|---------|-------------|
| **Claude Code** | CLI | ✅ 完整 | ✅ 原生 | ✅ 原生 | ✅ 原生 | `CLAUDE.md` |
| **GitHub Copilot** | IDE+CLI | ✅ 完整 | ✅ 原生 | ✅ 原生 | ✅ 多格式 | `AGENTS.md` / `copilot-instructions.md` |
| **Cursor** | IDE+CLI | ✅ 完整 | ✅ 原生 | ✅ 原生 | ✅ 多格式 | `.cursor/rules/*.mdc` / `AGENTS.md` |
| **Windsurf** | IDE | ✅ Cascade | ✅ 原生 | ✅ 原生 | ✅ 原生 | `AGENTS.md` / Windsurf Rules |
| **Augment (Auggie CLI)** | IDE+CLI | ✅ 支持 | ✅ 原生 | ✅ 原生 | ✅ 原生 | `AGENTS.md` |
| **OpenAI Codex** | CLI+IDE | ✅ 完整 | ✅ 原生 | ✅ 原生 | ✅ 原生 | `AGENTS.md` |
| **Gemini CLI** | CLI | ✅ 完整 | ✅ 原生 | ✅ 原生 | ✅ 原生 | `GEMINI.md` / `AGENTS.md` |
| **Kiro (AWS)** | IDE+CLI | ✅ 完整 | ✅ 原生 | ✅ 原生 | ✅ 原生 | Steering files / `AGENTS.md` |
| **OpenCode** | CLI | ✅ 完整 | ✅ 原生 | ✅ 原生 | ✅ 原生 | `AGENTS.md` |
| **Google Antigravity** | IDE | ✅ 完整 | ✅ 原生 | ✅ 原生 | ✅ 双支持 | `GEMINI.md` + `AGENTS.md` |
| **iFlow CLI** | CLI | ⚠️ 部分 | ⚠️ 自有规格 | ✅ 支持 | ❌ 无标准支持 | 自有方式 |
| **Trae (ByteDance)** | IDE | ✅ 支持 | ✅ 原生 | ✅ 原生 | ✅ 支持 | `.trae/rules/` / `AGENTS.md` |

---

## 二、各工具详细分析

---

### 1. 🟣 Claude Code (Anthropic)

> **定位**：CLI 原生 Agent，四大概念的首创者和标准制定者。

#### 四概念支持

| 概念 | 支持情况 | 说明 |
|------|---------|------|
| **Agents** | ✅ 完整 | 支持自定义 Subagent，通过 `.claude/agents/*.md` 定义，可指定模型、工具权限 |
| **Skills** | ✅ 原创 | Agent Skills 概念的首创者，每个 skill 是包含 `SKILL.md` 的目录 |
| **MCP** | ✅ 原创 | MCP 协议的发明者，通过 `claude mcp add` 管理，`settings.json` 配置 |
| **指令文件** | ✅ `CLAUDE.md` | 原创的 `CLAUDE.md` 分层上下文系统 |

#### 配置路径

| 作用域 | 路径 |
|--------|------|
| **全局指令文件** | `~/.claude/CLAUDE.md` |
| **全局设置** | `~/.claude/settings.json` |
| **全局 Skills** | `~/.claude/skills/<skill-name>/SKILL.md` |
| **全局 Agents** | `~/.claude/agents/<agent-name>.md` |
| **全局 Commands** | `~/.claude/commands/<cmd>.md` |
| **项目指令文件** | `<project-root>/CLAUDE.md` |
| **项目设置** | `<project-root>/.claude/settings.json` |
| **项目 Skills** | `<project-root>/.claude/skills/<skill-name>/SKILL.md` |
| **项目 Agents** | `<project-root>/.claude/agents/<agent-name>.md` |
| **项目 Commands** | `<project-root>/.claude/commands/<cmd>.md` |
| **MCP 配置** | `~/.claude/settings.json` 或 `<project>/.claude/settings.json` |

> ⚠️ **注意**：Claude Code 目前**不原生支持** `AGENTS.md` 标准文件名（社区有 Issue #31005 要求支持）。

---

### 2. 🔵 GitHub Copilot (Microsoft/GitHub)

> **定位**：跨 IDE（VS Code/JetBrains/Xcode）+ CLI，生态最广泛。

#### 四概念支持

| 概念 | 支持情况 | 说明 |
|------|---------|------|
| **Agents** | ✅ 完整 | 通过 `.agent.md` 文件定义自定义 Agent，可指定工具、MCP、指令 |
| **Skills** | ✅ 原生 | 2025年12月正式推出，遵循 `SKILL.md` 开放标准 |
| **MCP** | ✅ 原生 | VS Code/JetBrains/Xcode/CLI 全面支持 |
| **指令文件** | ✅ 多格式 | 同时支持 `AGENTS.md`、`copilot-instructions.md`、`.instructions.md` |

#### 配置路径

| 作用域 | 路径 |
|--------|------|
| **全局 Skills** | `~/.copilot/skills/<skill-name>/SKILL.md` 或 `~/.claude/skills/` 或 `~/.agents/skills/` |
| **项目指令文件** | `<project>/.github/copilot-instructions.md` |
| **项目 AGENTS.md** | `<project>/AGENTS.md` |
| **项目 Skills** | `<project>/.github/skills/<skill-name>/SKILL.md` |
| **项目 Agents** | `<project>/.github/agents/<agent-name>.agent.md` |
| **子目录指令** | `<any-dir>/.github/copilot-instructions.md`（monorepo 层级发现） |
| **MCP 配置（VS Code）** | `.vscode/mcp.json` 或 VS Code settings |
| **MCP 配置（CLI）** | `~/.config/github-copilot/` 相关配置 |

> 🔑 **亮点**：Copilot CLI 支持从 CWD 向上逐级发现配置，非常适合 monorepo。同时兼容 `.claude/skills/` 和 `.agents/skills/` 路径。

---

### 3. 🟢 Cursor

> **定位**：VS Code 分支的 AI-First IDE，Rules 系统最为精细。

#### 四概念支持

| 概念 | 支持情况 | 说明 |
|------|---------|------|
| **Agents** | ✅ 完整 | 子代理、Background Agents、Mission Control 多代理管理 |
| **Skills** | ✅ 原生 | 支持 `SKILL.md` 标准，`.cursor/skills/` 目录 |
| **MCP** | ✅ 原生 | 支持 stdio + Streamable HTTP，一键 MCP server 安装 |
| **指令文件** | ✅ 多层 | 四类规则：Always / Auto Attached / Agent Requested / Manual + `AGENTS.md` |

#### 配置路径

| 作用域 | 路径 |
|--------|------|
| **全局 User Rules** | Cursor Settings → Rules（UI 配置） |
| **全局 Skills** | `~/.cursor/skills/<skill-name>/SKILL.md`（也可读取 `~/.claude/skills/`） |
| **项目 Rules（新格式）** | `<project>/.cursor/rules/*.mdc` |
| **项目 Rules（旧格式）** | `<project>/.cursorrules`（已废弃但仍支持） |
| **项目 AGENTS.md** | `<project>/AGENTS.md` |
| **项目 Skills** | `<project>/.cursor/skills/<skill-name>/SKILL.md` |
| **项目 Agents** | `<project>/.cursor/agents/<agent-name>.md` |
| **MCP 配置** | `<project>/.cursor/mcp.json` 或全局 Cursor settings |
| **企业级** | 全局配置 model access、MCP controls、system-level agent rules |

> 🔑 **亮点**：`.mdc` 文件支持 YAML frontmatter 中设定 globs 模式，实现条件触发。Cursor 也能读取 `~/.claude/{skills,agents}` 的跨工具资源。

---

### 4. 🌊 Windsurf (Codeium)

> **定位**：以 Cascade 持续上下文引擎为核心的 Agentic IDE。

#### 四概念支持

| 概念 | 支持情况 | 说明 |
|------|---------|------|
| **Agents** | ✅ Cascade | Cascade 是核心 Agent，持续感知文件编辑、终端命令、剪贴板 |
| **Skills** | ✅ 原生 | 支持 Workspace 和 Global 两个作用域 |
| **MCP** | ✅ 原生 | 完整 MCP 支持 |
| **指令文件** | ✅ 原生 | 支持 `AGENTS.md` + Windsurf 自有 Rules 系统 |

#### 配置路径

| 作用域 | 路径 |
|--------|------|
| **全局 Rules** | Windsurf Settings → Global Rules（UI） |
| **全局 Skills（macOS）** | `~/Library/Application Support/Windsurf/skills/` |
| **全局 Skills（Linux）** | `/etc/windsurf/skills/` |
| **全局 Skills（Windows）** | `C:\ProgramData\Windsurf\skills\` |
| **项目 AGENTS.md** | `<project>/AGENTS.md`（根目录放置即自动生效） |
| **项目 Skills** | `<project>/.windsurf/skills/<skill-name>/SKILL.md`（Workspace Skills） |
| **项目 Rules** | 通过 UI 创建，存储在项目级配置中 |
| **MCP 配置** | Windsurf Settings → MCP（全局或每项目） |

> 🔑 **亮点**：`AGENTS.md` 支持放在项目任意子目录中，Cascade 根据位置自动关联到对应代码区域。

---

### 5. 🟡 Augment Code (Auggie CLI)

> **定位**：拥有业界领先上下文引擎的 IDE 插件 + CLI。

#### 四概念支持

| 概念 | 支持情况 | 说明 |
|------|---------|------|
| **Agents** | ✅ 支持 | 支持子代理、Plan Mode |
| **Skills** | ✅ 原生 | 遵循 agentskills.io 标准，多路径发现 |
| **MCP** | ✅ 原生 | 支持 MCP OAuth、ACP 协议 |
| **指令文件** | ✅ 原生 | 支持 `AGENTS.md` |

#### 配置路径

| 作用域 | 路径 |
|--------|------|
| **全局 Skills** | `~/.augment/skills/<skill-name>/SKILL.md` |
| **全局 Commands** | `~/.augment/commands/<cmd>.md` |
| **全局 Plans** | `~/.augment/plans/` |
| **项目 AGENTS.md** | `<project>/AGENTS.md` |
| **项目 Skills** | `<project>/.augment/skills/<skill-name>/SKILL.md` |
| **项目 Skills（兼容）** | `<project>/.claude/skills/` 或 `<project>/.agents/skills/` |
| **项目 Commands** | `<project>/.augment/commands/<cmd>.md` |
| **MCP 配置** | 项目级 `settings.json` |

> 🔑 **亮点**：Skills 同时从 `.augment/skills/`、`.claude/skills/`、`.agents/skills/` 三条路径发现，跨工具兼容性好。

---

### 6. 🔴 OpenAI Codex CLI

> **定位**：开源 Rust 构建的终端编码 Agent，沙盒安全执行。

#### 四概念支持

| 概念 | 支持情况 | 说明 |
|------|---------|------|
| **Agents** | ✅ 完整 | 通过 `AGENTS.md` 分层指令实现行为定制 |
| **Skills** | ✅ 原生 | 采用 Anthropic 开放标准的 `SKILL.md` 格式 |
| **MCP** | ✅ 原生 | `~/.codex/config.toml` 配置 MCP，支持 STDIO + Streamable HTTP |
| **指令文件** | ✅ `AGENTS.md` | 全局 + 项目层级 |

#### 配置路径

| 作用域 | 路径 |
|--------|------|
| **全局配置** | `~/.codex/config.toml` |
| **全局指令** | `~/.codex/AGENTS.md` |
| **全局 Skills** | `~/.codex/skills/<skill-name>/SKILL.md` |
| **项目指令** | `<project>/AGENTS.md` |
| **项目 Skills** | `<project>/.codex/skills/<skill-name>/SKILL.md` |
| **子目录指令** | `<subdir>/AGENTS.md`（向上合并） |
| **MCP 配置** | `~/.codex/config.toml` → `[mcp]` 块 |

> 🔑 **亮点**：Skills 支持 YAML frontmatter 中声明 MCP 依赖（`dependencies.tools`），实现 Skill + MCP 联动。

---

### 7. 🔷 Gemini CLI (Google)

> **定位**：Google 开源 CLI Agent，Gemini 模型原生集成。

#### 四概念支持

| 概念 | 支持情况 | 说明 |
|------|---------|------|
| **Agents** | ✅ 完整 | Extensions（MCP 集成）+ Agent Skills 架构 |
| **Skills** | ✅ 原生 | v0.24.0 起正式支持，遵循开放标准 |
| **MCP** | ✅ 原生 | Extensions 体系本身基于 MCP |
| **指令文件** | ✅ `GEMINI.md` | 层级发现：全局 → 项目根 → 子目录 |

#### 配置路径

| 作用域 | 路径 |
|--------|------|
| **全局指令** | `~/.gemini/GEMINI.md` |
| **全局 Settings** | `~/.gemini/settings.json` |
| **全局 Skills** | `~/.gemini/skills/<skill-name>/SKILL.md` |
| **全局环境变量** | `~/.gemini/.env` |
| **项目指令** | `<project>/GEMINI.md` |
| **项目 AGENTS.md** | `<project>/AGENTS.md`（部分版本支持） |
| **项目 Skills** | `<project>/.gemini/skills/<skill-name>/SKILL.md` 或 `<project>/.agents/skills/` |
| **子目录指令** | `<subdir>/GEMINI.md`（层级合并） |
| **MCP 配置** | `~/.gemini/settings.json` → MCP 块 |

> 🔑 **亮点**：层级化的 `GEMINI.md` 系统，从 CWD 向上逐级发现直到 `.git` 根目录，实现精细的 monorepo 指令分层。

---

### 8. 🟠 Kiro (AWS)

> **定位**：AWS 出品的 Spec-Driven Development IDE，强调从规格到生产的全流程。

#### 四概念支持

| 概念 | 支持情况 | 说明 |
|------|---------|------|
| **Agents** | ✅ 完整 | 内置 Spec Agent，支持自定义 Subagent |
| **Skills** | ✅ 原生 | 2026年2月起支持，遵循开放标准 |
| **MCP** | ✅ 原生 | 深度 AWS 集成 + 标准 MCP |
| **指令文件** | ✅ Steering | 自有 Steering 概念 + 兼容 `AGENTS.md` |

#### 配置路径

| 作用域 | 路径 |
|--------|------|
| **全局 Steering** | `~/.kiro/steering/*.md` |
| **全局 AGENTS.md** | `~/.kiro/steering/AGENTS.md` |
| **全局 Skills** | `~/.kiro/skills/<skill-name>/SKILL.md` |
| **项目 Steering** | `<project>/.kiro/steering/*.md` |
| **项目 AGENTS.md** | `<project>/AGENTS.md`（或放在 `.kiro/steering/`） |
| **项目 Skills** | `<project>/.kiro/skills/<skill-name>/SKILL.md` |
| **Powers（新概念）** | `<project>/.kiro/powers/<power-name>/POWER.md` |
| **MCP 配置** | Kiro Settings / `.kiro/` 目录 |

> 🔑 **亮点**：Kiro 独有 **Steering** 概念（更结构化的指令体系）和 **Powers** 概念（Skill + MCP 的更高级捆绑包），同时向下兼容 `AGENTS.md`。

---

### 9. 🟤 OpenCode

> **定位**：开源终端编码 Agent，高度可配置。

#### 四概念支持

| 概念 | 支持情况 | 说明 |
|------|---------|------|
| **Agents** | ✅ 完整 | 通过 `.md` + YAML frontmatter 定义自定义 Agent（可设 primary/subagent 模式） |
| **Skills** | ✅ 原生 | 多路径发现，兼容 Claude/Agents 标准路径 |
| **MCP** | ✅ 原生 | `opencode.json` 配置 |
| **指令文件** | ✅ `AGENTS.md` | `/init` 可自动生成 |

#### 配置路径

| 作用域 | 路径 |
|--------|------|
| **全局配置** | `~/.config/opencode/opencode.json` |
| **全局 Rules** | `~/.config/opencode/rules/` |
| **全局 Skills** | `~/.config/opencode/skills/<skill-name>/SKILL.md` |
| **全局 Agents** | `~/.config/opencode/agents/<agent-name>.md` |
| **项目配置** | `<project>/opencode.json` 或 `<project>/.opencode/opencode.json` |
| **项目 AGENTS.md** | `<project>/AGENTS.md` |
| **项目 Skills** | `<project>/.opencode/skills/` |
| **项目 Skills（兼容）** | `<project>/.claude/skills/` 或 `<project>/.agents/skills/` |
| **项目 Agents** | `<project>/.opencode/agents/<agent>.md` |
| **MCP 配置** | `opencode.json` → `"mcp"` 块 |

> 🔑 **亮点**：最灵活的跨工具兼容，同时从 `.opencode/`、`.claude/`、`.agents/` 三条路径发现 skills；支持 YAML frontmatter 精细控制 Agent 的模型、温度、权限。

---

### 10. 🌈 Google Antigravity

> **定位**：Google 的 Agent-First IDE 平台，2025年11月随 Gemini 3 Pro 发布。

#### 四概念支持

| 概念 | 支持情况 | 说明 |
|------|---------|------|
| **Agents** | ✅ 完整 | Agent Manager 界面编排自治 AI Agents |
| **Skills** | ✅ 原生 | 完整支持 `SKILL.md` 标准 |
| **MCP** | ✅ 原生 | 内置预配 MCP + 自定义 MCP |
| **指令文件** | ✅ 双支持 | `GEMINI.md` + `AGENTS.md`（v1.20.3 起） |

#### 配置路径

| 作用域 | 路径 |
|--------|------|
| **全局 Rules** | `~/.gemini/GEMINI.md` |
| **全局 Skills** | `~/.gemini/antigravity/skills/<skill-name>/SKILL.md` |
| **全局配置备份** | `~/.config/antigravity/` |
| **项目 Rules** | `<project>/GEMINI.md` 和/或 `<project>/AGENTS.md` |
| **项目 Skills** | `<project>/.agents/skills/<skill-name>/SKILL.md` |
| **项目 Workflows** | `<project>/.agents/workflows/` |
| **MCP 配置** | Antigravity Settings / 内置 + 自定义配置 |

> 🔑 **亮点**：v1.20.3 起同时读取 `AGENTS.md` 和 `GEMINI.md`，实现跨工具规则共享。内置 Data Cloud MCP 无需手动配置。

---

### 11. 💧 iFlow CLI

> **定位**：中国团队开发的终端 AI 助手（⚠️ **已于 2026年4月17日关闭服务**）。

#### 四概念支持

| 概念 | 支持情况 | 说明 |
|------|---------|------|
| **Agents** | ⚠️ 部分 | 内置 plan agent、explore agent 等 |
| **Skills** | ⚠️ 自有规格 | 不遵循 `SKILL.md` 标准，采用自有平台安装方式 |
| **MCP** | ✅ 支持 | SubAgents 和 MCP 可从 iFlow Open Market 一键安装 |
| **指令文件** | ❌ 无标准支持 | 不支持 `AGENTS.md` / `CLAUDE.md` 等标准 |

#### 配置路径

| 作用域 | 路径 |
|--------|------|
| **配置文件** | 自有配置系统（`lightWeightPlan: true` 等） |
| **MCP/Skills** | 通过 iFlow Open Market 平台安装 |

> ⚠️ **注意**：iFlow CLI 已宣布关闭，不建议新项目使用。生态标准兼容性差。

---

### 12. 🔮 Trae (ByteDance)

> **定位**：字节跳动出品的免费 AI IDE，VS Code 分支。

#### 四概念支持

| 概念 | 支持情况 | 说明 |
|------|---------|------|
| **Agents** | ✅ 支持 | 自定义 Agent 系统，Builder Mode 全自动项目生成 |
| **Skills** | ✅ 原生 | 支持 `SKILL.md` 标准，可通过 UI 创建/导入 |
| **MCP** | ✅ 原生 | v1.3.0 起正式支持 |
| **指令文件** | ✅ 支持 | `.trae/rules/` + `AGENTS.md` |

#### 配置路径

| 作用域 | 路径 |
|--------|------|
| **全局 Rules** | Settings → Rules & Skills → Global Rules（UI 管理） |
| **全局 Skills** | Settings → Rules & Skills → Skills → Global（UI 管理） |
| **项目 Rules** | `<project>/.trae/rules/*.md` |
| **项目 AGENTS.md** | `<project>/AGENTS.md` |
| **项目 Skills** | Settings → Rules & Skills → Skills → Project（UI 管理） |
| **MCP 配置** | Trae Settings / `mcp_servers` 配置块 |

> 🔑 **亮点**：UI 驱动的 Skills/Rules 管理方式更友好；免费提供 Claude、GPT-4o、DeepSeek 模型访问。

---

## 三、跨工具路径兼容性矩阵

**行业正在走向标准化**。Microsoft 发布了 [microsoft/skills](https://github.com/microsoft/skills) 仓库，Vercel 推出 skills.sh 包管理器。以下是各工具的路径发现兼容情况：

| 路径 | Claude Code | Copilot | Cursor | Windsurf | Auggie | Codex | Gemini | Kiro | OpenCode | Antigravity | Trae |
|------|------------|---------|--------|----------|--------|-------|--------|------|----------|-------------|------|
| `.claude/skills/` | ✅ 原生 | ✅ 兼容 | ✅ 兼容 | ❌ | ✅ 兼容 | ❌ | ❌ | ❌ | ✅ 兼容 | ❌ | ❌ |
| `.agents/skills/` | ❌ | ✅ 兼容 | ❌ | ❌ | ✅ 兼容 | ❌ | ✅ 兼容 | ❌ | ✅ 兼容 | ✅ 原生 | ❌ |
| `.github/skills/` | ❌ | ✅ 原生 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `.cursor/skills/` | ❌ | ❌ | ✅ 原生 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `.codex/skills/` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ 原生 | ❌ | ❌ | ❌ | ❌ | ❌ |
| `.gemini/skills/` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ 原生 | ❌ | ❌ | ❌ | ❌ |
| `.kiro/skills/` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ 原生 | ❌ | ❌ | ❌ |
| `.opencode/skills/` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ 原生 | ❌ | ❌ |
| `.windsurf/skills/` | ❌ | ❌ | ❌ | ✅ 原生 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `AGENTS.md` | ❌ ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️部分 | ✅ | ✅ | ✅ | ✅ |
| `CLAUDE.md` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `GEMINI.md` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ |

---

## 四、关键洞察与趋势总结

### 1. `AGENTS.md` 正成为事实标准
绝大多数工具（10/12）已支持或兼容 `AGENTS.md`。**唯一明显的例外是 Claude Code**——它作为四大概念的提出者，却坚持使用自有的 `CLAUDE.md`（这引发了社区争议，GitHub Issue #31005 明确要求 Anthropic 采纳标准）。

### 2. `SKILL.md` 格式已高度统一
所有主流工具都采用了相同的 Skill 格式：
```
skill-name/
├── SKILL.md          # 必须：YAML frontmatter + Markdown 指令
├── scripts/          # 可选：自动化脚本
├── references/       # 可选：参考文档
└── assets/           # 可选：模板/资源
```

### 3. 路径碎片化仍是主要痛点
每个工具都有自己的原生路径（`.claude/`、`.cursor/`、`.codex/`、`.gemini/` 等），但**多路径发现**（如 OpenCode、Auggie、Copilot 同时读取多个路径）正逐步缓解此问题。**最佳实践是使用符号链接**：
```bash
# 在项目中创建 symlink 共享 skills
ln -s .github/skills .claude/skills
ln -s .github/skills .opencode/skills
ln -s .github/skills .agents/skills
```

### 4. MCP 已成为100%标准配置
所有12个工具都支持 MCP，这是唯一一个零分歧的概念。自 2024年底 Anthropic 开源并捐赠给 Linux Foundation 后，MCP 已成为 AI 编码工具连接外部世界的"USB-C 接口"。

### 5. 三层架构成为共识
几乎所有工具都采用了**全局 → 项目 → 子目录**的三层配置层级，高优先级覆盖低优先级，这种设计模式已成为行业共识。
