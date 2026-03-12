下面不再按“工具自带概念”来列，而是先定义一组**统一标准槽位**，再把每个工具映射进去。这样你后面无论是写 **SDD 目录规范**，还是做 **跨工具兼容层**，都能直接复用。相关路径与能力均基于我刚刚核验的官方文档 / 官方仓库。([Claude API Docs][1])

先约定统一槽位名：

* `GUIDE_FILE`：项目 / 用户级持久指令文件
* `SKILLS_DIR`：可复用能力包目录
* `AGENTS_DIR`：自定义 agent / subagent 目录
* `COMMANDS_DIR`：slash command / prompt / command 目录
* `WORKFLOWS_DIR`：流程编排目录
* `HOOKS_CONFIG`：hook 配置入口
* `MCP_CONFIG`：MCP 配置入口
* `PLUGIN_BUNDLE`：插件 / 扩展 / bundle / marketplace 包入口

其中有些工具并不把所有能力都文件化；这类我会明确标成 **UI / settings 主导**，不硬凑路径。([TRAE 文档][2])

---

## 1）统一路径映射矩阵：说明 / 规则 / 能力 / 角色

| 标准槽位           | Claude Code                                                               | GitHub Copilot / Copilot CLI                                                                                                                                            | VS Code                                                                                                                  | Cursor                                                                              | Windsurf                                                                              | Trae                                           | Codex CLI                                                                                       | Gemini CLI                                      | Augment / Auggie CLI                                                        | Kiro                                                         | OpenCode                                                                                                                    | iFlow                                                                                   | 备注 / 统一抽象建议                                                         | 主要依据                   |
| -------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------- |
| `GUIDE_FILE`   | U: `~/.claude/CLAUDE.md`；P: `CLAUDE.md` 或 `.claude/CLAUDE.md`             | P: `.github/copilot-instructions.md`、`.github/instructions/**/*.instructions.md`；CLI 也认 `AGENTS.md`、`CLAUDE.md`、`GEMINI.md`；U: `$HOME/.copilot/copilot-instructions.md` | P: `.github/copilot-instructions.md`、`.github/instructions/**/*.instructions.md`；也支持组织级 instructions                     | 项目 rules / `AGENTS.md` 体系；可统一抽象为 `.cursor/rules` + `AGENTS.md`                      | 全局 `global_rules.md`；工作区 `.windsurf/rules`                                            | 项目规则存在，但本轮公开摘要未稳定展开固定文件名；技能页独立                 | U: `~/.codex/AGENTS.md`；P: `AGENTS.md`，并支持 fallback filenames                                   | U: `~/.gemini/GEMINI.md`；P: 项目根 `GEMINI.md`     | 以 `AGENTS.md` / `CLAUDE.md` 分层规则为主                                          | U: `~/.kiro/steering/`；P: `.kiro/steering/`；兼容 `AGENTS.md`   | P: `AGENTS.md`；也可在 `opencode.json` / `~/.config/opencode/opencode.json` 指定额外 instructions                                   | U: `~/.iflow/settings.json`；P: `{project}/.iflow/config.json`；项目说明文件 `IFLOW.md`         | 统一映射到 `GUIDE_FILE`；对 Windsurf/Kiro 可再细分 `rules/steering` 子槽位        | ([Claude API Docs][1]) |
| `SKILLS_DIR`   | U: `~/.claude/skills/<name>/SKILL.md`；P: `.claude/skills/<name>/SKILL.md` | P: `.github/skills/<name>/SKILL.md`、`.claude/skills/<name>/SKILL.md`、`.agents/skills/<name>/SKILL.md`；U: `~/.copilot/skills/...`、`~/.claude/skills/...`                 | P: `.github/skills/`、`.claude/skills/`、`.agents/skills/`；U: `~/.copilot/skills/`、`~/.claude/skills/`、`~/.agents/skills/` | **`.cursor/skills/` 路径族**（官方确认 skills 为一等概念；具体磁盘路径本轮搜索摘要未逐项展开）                      | U: `~/.codeium/windsurf/skills/<name>/SKILL.md`；P: `.windsurf/skills/<name>/SKILL.md` | U: `~/.trae/skills`；P: `.trae/skills/`         | P: `.agents/skills/`（从 cwd 到 repo root 扫描）；U: `$HOME/.agents/skills`；Admin: `/etc/codex/skills` | 无一等 skills 目录                                   | P: `.augment/skills/<name>/SKILL.md`；也自动加载 `.claude/skills/`；U: home 下同名目录族 | 本轮只核到“支持 skills / skill-like 能力”；未核到单独公开固定 `skills` 目录       | P: `.opencode/skills/<name>/SKILL.md`；U: `~/.config/opencode/skills/<name>/SKILL.md`；兼容 `.claude/skills` / `.agents/skills` | P / U 均支持 skills，且支持 marketplace；本轮片段对 scope 明确、对 project/global 结构说明充分，但未单独给出完整技能目录树示例 | 统一映射到 `SKILLS_DIR`；这是目前跨生态最容易收敛的一层                                  | ([Claude API Docs][2]) |
| `AGENTS_DIR`   | U: `~/.claude/agents/`；P: `.claude/agents/`                               | P: `.github/agents/` 或 `.claude/agents/`；U: `~/.copilot/agents/` 或 `~/.claude/agents/`；插件也可带 `agents/`                                                                  | 默认项目目录 `.github/agents/`；可通过 `chat.agentFilesLocations` 扩展；用户也可放在 profile / 自定义目录                                        | **`.cursor/agents/` 路径族**（docs 已确认 subagents 为一等概念；路径细节建议再逐页复核）                     | 本轮未核到公开稳定“用户自定义 agents 目录”                                                            | 有 custom agents，但公开摘要主要表现为设置页创建 / 导入，未核到稳定文件目录 | 多代理角色主要配在 `~/.codex/config.toml` / `.codex/config.toml` 的 `[agents]`；不是独立 agent 文件目录主线          | 无一等 agents 目录                                   | P: `./.augment/agents/`；官方明确建议把团队共享 subagents 放这里                           | U: `~/.kiro/agents`；P: `.kiro/agents`                        | U: `~/.config/opencode/agents/`；P: `.opencode/agents/`                                                                      | P: `.iflow/agents/`，workflow 文档明确一 agent 一 md                                           | 如果要统一抽象，建议拆成两层：`AGENTS_DIR`（文件型）+ `AGENT_CONFIG`（Codex 这种 config 型） | ([Claude API Docs][1]) |
| `COMMANDS_DIR` | 旧式兼容 `.claude/commands/*.md`；现在主推 skills                                  | CLI / agent 侧主推 skills 与 prompt-like 入口，不以独立 commands 目录为核心                                                                                                             | P: `.github/prompts/`；U: 当前 profile 的 `prompts/` 目录；prompt files 可直接变 slash commands                                     | **`.cursor/commands/` 路径族**（由 Cursor docs / plugin 体系确认 commands 是一等对象；具体磁盘路径建议再复核） | P: `.windsurf/workflows/*.md` 更接近 commands                                            | 本轮未核到稳定公开 commands 目录                          | 内置 slash commands 为主；未核到独立自定义 commands 目录主线                                                     | U: `~/.gemini/commands/`；P: `.gemini/commands/` | P / U: `.augment/commands/` 路径族                                             | U: `~/.kiro/prompts/`；P: `.kiro/prompts/`，更接近 prompt/command | U: `~/.config/opencode/commands/`；P: `.opencode/commands/`                                                                  | U: `~/.iflow/commands/`；P: `{project}/.iflow/commands/`，`.toml` 文件                      | 建议统一为 `COMMANDS_DIR`；对 VS Code / Kiro 用 `PROMPTS_DIR` 作为别名          | ([Claude API Docs][2]) |


---

## 2）统一路径映射矩阵：流程 / 自动化 / 工具接入 / 扩展分发


| 标准槽位            | Claude Code                                                                             | GitHub Copilot / Copilot CLI                                                    | VS Code                                                       | Cursor                                                              | Windsurf                                                                                                                                                                                 | Trae                           | Codex CLI                                         | Gemini CLI                                                    | Augment / Auggie CLI                                                           | Kiro                                                        | OpenCode                                                         | iFlow                                                                                         | 备注 / 统一抽象建议                                                                   | 主要依据                   |
| --------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------- |
| `WORKFLOWS_DIR` | 无独立顶层主路径，通常由 skills 承担                                                                  | 无独立顶层主路径，常由 skills / prompts / agents 组合承担                                      | `prompts` 更像轻量 workflow                                       | Commands / agents / skills 组合承担                                     | U: `~/.codeium/windsurf/global_workflows/*.md`；P: `.windsurf/workflows/*.md`                                                                                                             | 暂未见独立公开 workflow 目录            | 无独立顶层主路径                                          | extensions / commands 组合承担                                    | commands + subagents + skills 组合承担                                             | P: `.kiro/specs/` 更接近规范驱动流程；prompts 也可承载步骤化流程               | commands + agents + plugins 组合承担                                 | `IFLOW.md` + `.iflow/agents/` + `.iflow/commands/` + `.iflow/settings.json` 构成完整 workflow 目录树 | 建议把 Windsurf / iFlow / Kiro 单独抽象成 `WORKFLOWS_DIR` 或 `SPECS_DIR`               | ([Windsurf Docs][1])   |
| `HOOKS_CONFIG`  | U: `~/.claude/settings.json`；P: `.claude/settings.json` / `.claude/settings.local.json` | P: `.github/hooks/*.json`；CLI 从当前工作目录加载仓库 hooks                                 | VS Code 已有 hooks 能力与 customization 入口，但本轮未核到固定默认文件路径          | **`.cursor/hooks.json` 路径族**（概念明确，路径建议再复核）                          | U: `~/.codeium/windsurf/hooks.json`；W: `.windsurf/hooks.json`；System: `/etc/windsurf/hooks.json`、`/Library/Application Support/Windsurf/hooks.json`、`C:\ProgramData\Windsurf\hooks.json` | 本轮未核到公开固定 hooks 文件路径           | 本轮未核到公开 hooks 文件路径                                | 无 Claude 式 hooks 主线；更接近 settings / policy / extensions        | 支持 hooks；官方示例出现系统级 `/etc/augment/hooks/...`；项目级配置细节需再逐页核                       | powers / steering / hooks 组合，但本轮未核到单一固定 hooks 文件路径          | hooks 更偏放进 plugin 机制；不是独立顶层主线                                    | 支持 hooks 且有 user / project 分层；本轮未核到单一固定文件名                                                    | 建议抽象为 `HOOKS_CONFIG` + `HOOK_SCRIPTS_DIR` 两层；有些工具只有一层                         | ([Claude API Docs][2]) |
| `MCP_CONFIG`    | U / local 状态在 `~/.claude.json`；P: `.mcp.json`                                           | IDE 常见是 `.vscode/mcp.json`；GitHub coding agent 也可走 repo settings / agent config | P: `.vscode/mcp.json`；也支持安装到 workspace config                 | **`.cursor/mcp.json` 路径族**（MCP 是一等概念；路径细节建议再复核）                     | 原生支持 MCP；企业 / UI 管理主导，本轮未核到统一项目文件名                                                                                                                                                       | 主要通过设置页 MCP 管理                 | U: `~/.codex/config.toml`；P: `.codex/config.toml` | U: `~/.gemini/settings.json`；P: `.gemini/settings.json`       | integrations / MCP 主导；配置入口在 CLI 配置体系中                                          | U: `~/.kiro/settings/mcp.json`；P: `.kiro/settings/mcp.json` | `opencode.json` / `~/.config/opencode/opencode.json` 里的 `mcp` 字段 | 可 project / user 安装，workflow 中常见 `.iflow/settings.json`；全局 `~/.iflow/settings.json`           | 建议统一抽象成 `MCP_CONFIG`，而不是强行统一为 `mcp.json`                                      | ([Claude API Docs][2]) |
| `PLUGIN_BUNDLE` | plugin 根可打包 skills / hooks / MCP 等；插件启用策略走 settings                                     | CLI plugin：`plugin.json`，可含 agents / skills / hooks / MCP；技能也可来自 plugin 目录      | Agent plugins / 扩展可贡献 prompts / agents / skills / hooks / MCP | Cursor plugins 可打包 rules / skills / agents / commands / MCP / hooks | 更偏 marketplace / MCP directory / 推荐插件；不是单一 Claude 式 plugin root                                                                                                                          | 有 IDE 插件生态，但非统一 AI bundle 目录主线 | 暂未见 Claude 式插件目录主线                                | U: `<home>/.gemini/extensions`；每个扩展根含 `gemini-extension.json` | 插件 / marketplace 是一等概念，可打包 commands / subagents / rules / hooks / skills / MCP | Kiro 更接近 `powers`：把 MCP + steering + hooks 打成统一 bundle      | U: `~/.config/opencode/plugins/`；P: `.opencode/plugins/`         | marketplace + workflow/component 组合；不是单一 manifest 主线                                          | 建议统一抽象成 `BUNDLE_ROOT`：plugin / extension / power / marketplace package 都映射到这里 | ([GitHub Docs][3])     |

---

## 3）我建议你最终落地时采用的“标准目录槽位”

这套最适合做成你后面的 **统一 SDD 规范层**：

```text
AI_GUIDE/
├── GUIDE_FILE            # CLAUDE.md / AGENTS.md / GEMINI.md / IFLOW.md / steering
├── SKILLS_DIR/           # skills/*/SKILL.md
├── AGENTS_DIR/           # agents/*.md | agents/*.agent.md | config-based agents
├── COMMANDS_DIR/         # commands/*.md | prompts/*.prompt.md | commands/*.toml
├── WORKFLOWS_DIR/        # workflows/*.md | specs/
├── HOOKS_CONFIG          # hooks.json | settings.json(hooks) | plugin hooks
├── MCP_CONFIG            # .mcp.json | mcp.json | config.toml | settings.json | opencode.json
└── BUNDLE_ROOT/          # plugin.json | gemini-extension.json | plugins/ | powers/
```

这不是在说所有工具都长这样，而是在说：**你自己的规范层应该长这样**，然后再给每个工具做一层 adapter。因为现在公开生态已经明显分成三类：

* **Claude / Cursor / Augment / OpenCode / iFlow**：更接近“目录即规范”
* **Copilot / VS Code / Codex**：更接近“开放标准 + 宿主配置”
* **Windsurf / Kiro / Gemini / Trae**：更偏“工作流 / steering / extension / settings 驱动” ([Claude API Docs][1])

---

## 4）给你一个“直接能写进规范”的统一映射建议

建议把不同工具映射成下面这组标准键：

| 统一键             | 优先承载工具                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `guide.primary` | `CLAUDE.md` / `AGENTS.md` / `GEMINI.md` / `IFLOW.md` / `steering`                                                               |
| `skills.dir`    | `.claude/skills` / `.github/skills` / `.agents/skills` / `.augment/skills` / `.opencode/skills`                                 |
| `agents.dir`    | `.claude/agents` / `.github/agents` / `.augment/agents` / `.opencode/agents` / `.iflow/agents`                                  |
| `commands.dir`  | `.github/prompts` / `.gemini/commands` / `.augment/commands` / `.opencode/commands` / `.iflow/commands`                         |
| `workflows.dir` | `.windsurf/workflows` / `.kiro/specs` / `IFLOW.md + .iflow/*`                                                                   |
| `hooks.config`  | `.claude/settings.json` / `.github/hooks/*.json` / `.windsurf/hooks.json` / plugin hooks                                        |
| `mcp.config`    | `.mcp.json` / `.vscode/mcp.json` / `.codex/config.toml` / `.gemini/settings.json` / `.kiro/settings/mcp.json` / `opencode.json` |
| `bundle.root`   | `plugin.json` / `gemini-extension.json` / `plugins/` / `powers/` / marketplace package                                          |

这套统一键最大的好处是：你后面做 **SDD workflow 模板** 时，不需要关心具体是 Claude 还是 Cursor，只要按槽位落内容，再由工具适配层渲染成具体目录即可。([Cursor][6])

image.png
[1]: https://docs.anthropic.com/en/docs/claude-code/settings?utm_source=chatgpt.com "Claude Code settings - Claude Code Docs"
[2]: https://docs.trae.ai/ide/model-context-protocol?utm_source=chatgpt.com "In Trae IDE, MCP servers support three transport types"
[3]: https://docs.anthropic.com/en/docs/claude-code/slash-commands?utm_source=chatgpt.com "Extend Claude with skills - Claude Code Docs"
[4]: https://docs.windsurf.com/windsurf/cascade/workflows?utm_source=chatgpt.com "Workflows - Windsurf Docs"
[5]: https://docs.github.com/en/copilot/concepts/agents/copilot-cli/about-cli-plugins?utm_source=chatgpt.com "About plugins for GitHub Copilot CLI"
[6]: https://cursor.com/docs/plugins?utm_source=chatgpt.com "Plugins | Cursor Docs"
