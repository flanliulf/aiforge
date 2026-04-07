下面表格以 **“工具为行、路径槽位为列”** 的对比方式展示各个 AI Coding IDE 工具之间的目录概念对比。
为了便于横向比较，我统一用了这些路径维度：

* **规则 / 指令文件**
* **Skills**
* **Agents / Subagents**
* **Commands / Prompts / Workflows**
* **Hooks**
* **MCP**
* **Plugins / Extensions / Marketplaces**

说明：

* `全局` = 用户级 / home 目录级
* `项目` = 仓库 / workspace 级
* `—` = 这轮官方资料中未见公开稳定路径，或主要通过 UI / settings 管理
* `兼容` = 官方明确兼容别家约定路径，而不是自身主路径

---

## 路径维度总表
| 工具                               | 规则 / 指令文件                                                                                        | Skills                                                                                                            | Agents / Subagents                                                                         | Commands / Prompts / Workflows                                                                                  | Hooks                                                                                                        | MCP                                                                                  | Plugins / Extensions / Marketplaces                                                | 备注                                                                             |                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| **Claude Code**                  | 全局：`~/.claude/CLAUDE.md`；项目：`CLAUDE.md`、`.claude/` 下配置。([Claude API Docs][1])                    | 全局：`~/.claude/skills/<name>/SKILL.md`；项目：`.claude/skills/<name>/SKILL.md`。([Claude API Docs][2])                  | 全局：`~/.claude/agents/`；项目：`.claude/agents/`。([Claude API Docs][1])                         | 旧式兼容：`.claude/commands/*.md`；现已并入 skills。([Claude API Docs][2])                                                 | 全局：`~/.claude/settings.json`；项目：`.claude/settings.json`、`.claude/settings.local.json`。([Claude API Docs][1]) | 项目：`.mcp.json`；也有全局配置层。([Claude API Docs][3])                                        | 插件根含 `plugin.json`，并可打包 skills / hooks / MCP 等。([Claude API Docs][1])              | Claude Code 现在最推荐的主线是 **CLAUDE.md + skills + agents + hooks + MCP + plugins**。 |                                                                 |
| **GitHub Copilot / Copilot CLI** | 项目：`.github/copilot-instructions.md`、`.github/instructions/*.instructions.md`。([GitHub Docs][4]) | 全局：`~/.copilot/skills/<name>/SKILL.md`；项目：`.github/skills/<name>/SKILL.md`；兼容 `.claude/skills`。([GitHub Docs][5]) | 项目：`.github/agents/*.agent.md`；CLI/VS Code 也支持用户级 agent 文件。([GitHub Docs][6])              | IDE 侧有 prompt files；CLI 侧主要通过 slash commands / agents / skills。([GitHub Docs][7])                               | 项目：`.github/hooks/*.json`。([GitHub Docs][8])                                                                 | 常见项目级入口：`.vscode/mcp.json`；GitHub coding agent 也支持仓库/设置页管理。([Visual Studio Code][9]) | CLI plugin 根至少有 `plugin.json`，可打包 agents / skills / hooks / MCP。([GitHub Docs][8]) | Copilot 目前是最接近 Claude Code 六件套的另一条官方体系。                                        |                                                                 |
| **VS Code（宿主层）**                 | 工作区常见：`.github/copilot-instructions.md`；也支持组织/设置层。([Visual Studio Code][10])                     | 默认搜索：`.github/skills`、`.claude/skills`、`~/.copilot/skills`、`~/.claude/skills`。([Visual Studio Code][11])          | 工作区默认：`.github/agents/*.agent.md`；用户级：profile 中的 agent files 目录。([Visual Studio Code][12]) | 工作区：`.github/prompts`；用户级：当前 VS Code profile 的 `prompts` 目录。([Visual Studio Code][13])                          | 有 hooks 分类与管理 UI，但这轮片段未给出默认固定路径。([Visual Studio Code][14])                                                   | 工作区：`.vscode/mcp.json`。([Visual Studio Code][9])                                     | 支持 Agent plugins / 扩展贡献 agents、skills、hooks 等。([Visual Studio Code][14])           | VS Code 更像统一宿主，会兼容 `.github/*`、`.claude/*`、`~/.copilot/*`。                     |                                                                 |
| **Cursor**                       | 项目：`.cursor/rules`。([Cursor][15])                                                                | 全局：`~/.cursor/skills/`；项目：`.cursor/skills/`；兼容 `.claude/skills`。([Cursor][16])                                    | 项目：`.cursor/agents/`。([Cursor][17])                                                        | 项目：`.cursor/commands/`。([Cursor][17])                                                                           | 项目：`.cursor/hooks.json`。([Cursor][18])                                                                       | 项目：`.cursor/mcp.json`。([Cursor][19])                                                 | 插件可打包 rules / skills / agents / commands / MCP / hooks。([Cursor][20])              | Cursor 与 Claude Code 的目录化思路高度同构。                                               |                                                                 |
| **Windsurf**                     | 全局：`~/.codeium/windsurf/...`；项目：`.windsurf/rules/*.md`。([Windsurf Docs][21])                     | 全局：`~/.codeium/windsurf/skills/<name>/SKILL.md`；项目：`.windsurf/skills/<name>/SKILL.md`。([Windsurf Docs][22])       | 这轮未见公开稳定的“用户自定义 agents 目录”文档。                                                              | 全局：`~/.codeium/windsurf/global_workflows/*.md`；项目：`.windsurf/workflows/*.md`，以 `/name` 触发。([Windsurf Docs][23]) | 系统级 hooks 文件见 `/etc/windsurf/hooks.json` 等。([Windsurf Docs][24])                                             | 支持 MCP；这轮片段未给出明确项目级固定文件名。([Windsurf Docs][25])                                       | 更偏 Marketplace / 推荐插件 / MCP 目录，而不是 Claude 式单一 plugin 包。([Windsurf Docs][25])       | Windsurf 更像 **rules + skills + workflows + hooks + MCP** 组合。                   |                                                                 |
| **Trae**                         | 项目：`.trae/rules`。([TRAE 文档][26])                                                                 | 全局：`~/.trae/skills`；项目：`.trae/skills/`。([TRAE 文档][27])                                                            | 有 agents / custom agents，但这轮未拿到像 `.claude/agents/` 那么明确的公开目录片段。([TRAE 文档][28])             | 官方有 slash commands，但这轮未拿到明确公开的项目 commands 目录。([TRAE 文档][29])                                                    | 这轮未见官方公开稳定 hooks 路径。                                                                                         | 支持 MCP servers，主要通过 IDE 设置页管理。([TRAE 文档][30])                                        | 有插件体系，但更偏 IDE 插件。([TRAE 文档][28])                                                   | Trae 已有 rules / skills / MCP / agents，但“目录即规范”没 Claude/Cursor 那么彻底。            |                                                                 |
| **Codex CLI**                    | 全局：`~/.codex/AGENTS.md`；项目：`AGENTS.md`；并有 `.codex/` 配置层。([OpenAI Developer Portal][31])          | 项目主路径：`.agents/skills/`。([OpenAI Developer Portal][32])                                                           | 有 sub-agent 运行时能力，但这轮未见公开的用户自定义 agent 目录规范。([OpenAI Developer Portal][33])                 | 内置 slash commands；这轮未见官方自定义 commands 目录主规范。([OpenAI Developer Portal][33])                                      | 这轮未见公开 hooks 文件路径。                                                                                           | 全局 / 项目：`~/.codex/config.toml`、`.codex/config.toml`。([OpenAI Developer Portal][34])  | 这轮未见 Claude/Cursor 式 plugins 目录主规范。                                                | Codex 很强在 **AGENTS.md + .agents/skills + .codex/config.toml**。                 |                                                                 |
| **Gemini CLI**                   | 全局：`~/.gemini/GEMINI.md`；项目：通常是项目根的 `GEMINI.md`，并支持 `.gemini/settings.json` 配置上下文。([GitHub][35]) | 这轮未见官方一等 `skills` 目录。                                                                                             | 这轮未见官方一等 `agents` 目录。                                                                      | 全局：`~/.gemini/commands/`；项目：`<project>/.gemini/commands/`。([GitHub][36])                                        | 没有 Claude 式 hooks；更接近 policy engine。([GitHub][37])                                                           | 全局：`~/.gemini/settings.json`；项目：`./.gemini/settings.json`。([GitHub][38])             | 全局扩展目录：`~/.gemini/extensions`，根文件 `gemini-extension.json`。([GitHub][39])           | Gemini CLI 的主线是 **GEMINI.md + commands + settings.json + extensions + MCP**。   |                                                                 |
| **Augment / Auggie CLI**         | Rules 独立存在；官方主打 rules 与 skills 区分。([Augment][40])                                                | 全局 / 项目：`.augment/skills/`。([Augment][41])                                                                        | 支持 subagents；路径可由创建向导选择，常见是 `.augment/agents/`。([Augment][42])                             | 全局 / 项目：`.augment/commands/`。([Augment][43])                                                                    | 支持 hooks。([Augment][44])                                                                                     | 支持 native integrations 与 MCP。([Augment][45])                                         | 官方插件可打包 commands / subagents / rules / hooks / skills / MCP。([Augment][46])        | Augment 是另一个和 Claude/Cursor 很像的“全栈目录化”体系。                                      |                                                                 |
| **Kiro**                         | 全局：`~/.kiro/steering/`；项目：workspace 根的 `AGENTS.md` 或 `.kiro/steering/`。([Kiro][47])              | 官方支持 skills，但这轮片段未给出明确 skills 目录路径。                                                                               | 全局 / 项目：`<home                                                                             | project>/.kiro/agents`。([Kiro][48])                                                                             | 全局：`~/.kiro/prompts/`；项目还有 `.kiro/specs/`。([Kiro][48])                                                       | 支持 hooks，但这轮未拿到固定路径片段。                                                               | 全局：`~/.kiro/settings/mcp.json`；项目：`.kiro/settings/...`。([Kiro][49])                | 更接近 powers / capabilities 组合，而不是单一 plugin 主目录。([Kiro][48])                     | Kiro 的主轴更像 **steering + agents + prompts/specs + hooks + MCP**。 |
| **OpenCode**                     | 项目：`AGENTS.md`；兼容 `CLAUDE.md`。([OpenCode][50])                                                   | 全局：`~/.config/opencode/skills/<name>/SKILL.md`；项目：`.opencode/skills/<name>/SKILL.md`。([OpenCode][51])             | 全局：`~/.config/opencode/agents/`；项目：`.opencode/agents/`。([OpenCode][52])                    | 全局：`~/.config/opencode/commands/`；项目：`.opencode/commands/`。([OpenCode][53])                                     | hooks 更偏通过 plugins 扩展。([OpenCode][54])                                                                       | 通过 `opencode.json` 配置 MCP。([OpenCode][50])                                           | 全局：`~/.config/opencode/plugins/`；项目：`.opencode/plugins/`。([OpenCode][54])          | OpenCode 也是典型“目录驱动型 agent 平台”。                                                 |                                                                 |
| **iFlow**                        | 全局：`~/.iflow/settings.json`；项目：`{project}/.iflow/config.json`；项目上下文文件：`IFLOW.md`。([心流开放平台][55])  | 全局：`~/.iflow/skills/`；项目：`{project}/.iflow/skills/`。([心流开放平台][56])                                                | 项目：`.iflow/agents/`，一 agent 一 md。([心流开放平台][57])                                            | 全局：`~/.iflow/commands/`；项目：`{project}/.iflow/commands/`。([心流开放平台][57])                                          | 一等 hooks，支持 user / project 分层；这轮片段未给出单一固定文件名。([心流开放平台][57])                                                  | 项目常见：`.iflow/settings.json`；也支持平台安装 MCP。([心流开放平台][57])                               | 更像 workflow / marketplace 组合，而不是单一 plugin manifest。([心流开放平台][57])                  | iFlow 的目录非常完整，几乎可直接映射 Claude 六件套。                                              |                                                                 |

---

## 如果只看“路径规范成熟度”，可以粗分成 4 档

**第一档：最接近 Claude Code**

* **Cursor**
* **Augment / Auggie CLI**
* **GitHub Copilot CLI**
* **OpenCode**
* **iFlow**

它们都已经把多个能力拆成了**明确目录**，例如 skills、agents、commands、hooks、MCP、plugins 中的大部分。([Cursor][20])

**第二档：强目录化，但概念命名不同**

* **Kiro**
* **Windsurf**

这两家也很强，但会把 Claude 的一部分概念映射成 **steering / prompts / specs / workflows / powers**。([Kiro][48])

**第三档：部分目录化，部分设置页化**

* **Trae**
* **VS Code**

核心能力有，但不少能力通过 UI / settings editor 管理，公开“固定路径规范”没有 Claude/Cursor 那么强。([TRAE 文档][30])

**第四档：主线更偏“说明文件 + 配置文件 + 命令 / 扩展”**

* **Codex CLI**
* **Gemini CLI**

Codex 强在 `AGENTS.md + .agents/skills + .codex/config.toml`；Gemini 强在 `GEMINI.md + .gemini/settings.json + .gemini/commands + extensions`。([OpenAI Developer Portal][31])

---

## 给你一个更适合后续落地的读法

如果你接下来是要做 **统一 SDD 目录模板**，我建议直接把这些路径抽象成下面这组“公共槽位”：

* `PROJECT_INSTRUCTIONS`：`CLAUDE.md / AGENTS.md / GEMINI.md / IFLOW.md / steering`
* `SKILLS_DIR`：`.claude/skills / .cursor/skills / .augment/skills / .opencode/skills / .iflow/skills`
* `AGENTS_DIR`：`.claude/agents / .cursor/agents / .opencode/agents / .iflow/agents / .kiro/agents`
* `COMMANDS_DIR`：`.cursor/commands / .augment/commands / .opencode/commands / .iflow/commands / .gemini/commands`
* `WORKFLOWS_DIR`：`.windsurf/workflows / .kiro/specs`
* `HOOKS_CONFIG`：`.claude/settings.json / .cursor/hooks.json / hooks config / policy engine`
* `MCP_CONFIG`：`.mcp.json / .cursor/mcp.json / .vscode/mcp.json / .codex/config.toml / .gemini/settings.json / .iflow/settings.json`
* `PLUGIN_ROOT`：`plugin.json / gemini-extension.json / .opencode/plugins / marketplace repo`

这样你后面无论要做 **跨工具兼容目录模板**，还是做你前面提到的 **SDD workflow 标准层**，都更容易统一。([Claude API Docs][1])


[1]: https://docs.anthropic.com/en/docs/claude-code/settings?utm_source=chatgpt.com "Claude Code settings - Claude Code Docs"
[2]: https://docs.anthropic.com/en/docs/claude-code/slash-commands?utm_source=chatgpt.com "Agent Skills - Claude Code"
[3]: https://docs.anthropic.com/en/docs/claude-code/mcp?utm_source=chatgpt.com "Connect Claude Code to tools via MCP"
[4]: https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-custom-instructions?utm_source=chatgpt.com "Adding custom instructions for GitHub Copilot CLI"
[5]: https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/create-skills?utm_source=chatgpt.com "Creating agent skills for GitHub Copilot"
[6]: https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/create-custom-agents?utm_source=chatgpt.com "Creating custom agents for Copilot coding agent"
[7]: https://docs.github.com/en/copilot/tutorials/customization-library/prompt-files?utm_source=chatgpt.com "Prompt files"
[8]: https://docs.github.com/en/copilot/reference/cli-plugin-reference?utm_source=chatgpt.com "GitHub Copilot CLI plugin reference"
[9]: https://code.visualstudio.com/docs/copilot/customization/mcp-servers?utm_source=chatgpt.com "Add and manage MCP servers in VS Code"
[10]: https://code.visualstudio.com/docs/copilot/customization/custom-instructions?utm_source=chatgpt.com "Use custom instructions in VS Code"
[11]: https://code.visualstudio.com/docs/copilot/reference/copilot-settings?utm_source=chatgpt.com "GitHub Copilot in VS Code settings reference"
[12]: https://code.visualstudio.com/docs/copilot/customization/custom-agents?utm_source=chatgpt.com "Custom agents in VS Code"
[13]: https://code.visualstudio.com/docs/copilot/customization/prompt-files?utm_source=chatgpt.com "Use prompt files in VS Code"
[14]: https://code.visualstudio.com/docs/copilot/customization/overview?utm_source=chatgpt.com "Customize AI in Visual Studio Code"
[15]: https://cursor.com/docs/rules?utm_source=chatgpt.com "Rules | Cursor Docs"
[16]: https://cursor.com/docs/skills?utm_source=chatgpt.com "Agent Skills | Cursor Docs"
[17]: https://cursor.com/docs?utm_source=chatgpt.com "Cursor Docs"
[18]: https://cursor.com/docs/hooks?utm_source=chatgpt.com "Hooks | Cursor Docs"
[19]: https://cursor.com/docs/mcp?utm_source=chatgpt.com "Model Context Protocol (MCP) | Cursor Docs"
[20]: https://cursor.com/docs/plugins?utm_source=chatgpt.com "Plugins | Cursor Docs"
[21]: https://docs.windsurf.com/windsurf/cascade/memories?utm_source=chatgpt.com "Cascade Memories"
[22]: https://docs.windsurf.com/windsurf/cascade/skills?utm_source=chatgpt.com "Cascade Skills"
[23]: https://docs.windsurf.com/windsurf/cascade/workflows?utm_source=chatgpt.com "Workflows - Windsurf Docs"
[24]: https://docs.windsurf.com/windsurf/cascade/hooks?utm_source=chatgpt.com "Cascade Hooks"
[25]: https://docs.windsurf.com/windsurf/cascade/mcp?utm_source=chatgpt.com "Cascade MCP Integration"
[26]: https://docs.trae.ai/ide/ide-settings-overview?utm_source=chatgpt.com "IDE settings overview - Documentation"
[27]: https://docs.trae.ai/ide/skills?utm_source=chatgpt.com "Skills"
[28]: https://docs.trae.ai/?utm_source=chatgpt.com "What is TRAE? - Documentation - TRAE"
[29]: https://docs.trae.ai/ide/changelog?utm_source=chatgpt.com "Changelog"
[30]: https://docs.trae.ai/ide/model-context-protocol?utm_source=chatgpt.com "In Trae IDE, MCP servers support three transport types"
[31]: https://developers.openai.com/codex/guides/agents-md/?utm_source=chatgpt.com "Custom instructions with AGENTS.md"
[32]: https://developers.openai.com/codex/skills/?utm_source=chatgpt.com "Agent Skills"
[33]: https://developers.openai.com/codex/cli/slash-commands/?utm_source=chatgpt.com "Slash commands in Codex CLI"
[34]: https://developers.openai.com/codex/config-advanced/?utm_source=chatgpt.com "Advanced Configuration"
[35]: https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/configuration.md?utm_source=chatgpt.com "gemini-cli/docs/reference/configuration.md at main"
[36]: https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/commands.md?utm_source=chatgpt.com "gemini-cli/docs/reference/commands.md at main"
[37]: https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/policy-engine.md?utm_source=chatgpt.com "gemini-cli/docs/reference/policy-engine.md at main"
[38]: https://github.com/google-gemini/gemini-cli/blob/main/docs/resources/faq.md?utm_source=chatgpt.com "gemini-cli/docs/resources/faq.md at main"
[39]: https://github.com/google-gemini/gemini-cli/blob/main/docs/extensions/reference.md?utm_source=chatgpt.com "gemini-cli/docs/extensions/reference.md at main"
[40]: https://docs.augmentcode.com/cli/rules?utm_source=chatgpt.com "Rules & Guidelines - Introduction - Augment Code"
[41]: https://docs.augmentcode.com/cli/skills?utm_source=chatgpt.com "Agent Skills - Augment - Introduction"
[42]: https://docs.augmentcode.com/cli/subagents?utm_source=chatgpt.com "Subagents - Augment - Introduction"
[43]: https://docs.augmentcode.com/cli/custom-commands?utm_source=chatgpt.com "Custom Slash Commands - Augment - Introduction"
[44]: https://docs.augmentcode.com/cli/hooks?utm_source=chatgpt.com "Hooks - Augment - Introduction"
[45]: https://docs.augmentcode.com/cli/integrations?utm_source=chatgpt.com "Integrations and MCP - Augment - Introduction"
[46]: https://docs.augmentcode.com/cli/plugins?utm_source=chatgpt.com "Plugins and Marketplaces - Augment - Introduction - Augment Code"
[47]: https://kiro.dev/docs/steering/?utm_source=chatgpt.com "Steering - IDE - Docs"
[48]: https://kiro.dev/docs/cli/chat/configuration/?utm_source=chatgpt.com "Configuration - CLI - Docs"
[49]: https://kiro.dev/docs/mcp/configuration/?utm_source=chatgpt.com "Configuration - IDE - Docs"
[50]: https://opencode.ai/docs/?utm_source=chatgpt.com "Intro | AI coding agent built for the terminal"
[51]: https://opencode.ai/docs/skills/?utm_source=chatgpt.com "Agent Skills"
[52]: https://opencode.ai/docs/agents/?utm_source=chatgpt.com "Agents"
[53]: https://opencode.ai/docs/commands/?utm_source=chatgpt.com "Commands"
[54]: https://opencode.ai/docs/plugins/?utm_source=chatgpt.com "Plugins"
[55]: https://platform.iflow.cn/en/cli/glossary?utm_source=chatgpt.com "Terminology Glossary"
[56]: https://platform.iflow.cn/en/cli/changelog?utm_source=chatgpt.com "Changelog"
[57]: https://platform.iflow.cn/en/cli/examples/workflow?utm_source=chatgpt.com "Workflow"
