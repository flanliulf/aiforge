# AI-Forge CLI 工具 — 功能接口执行摘要

## 📋 快速概览

**aiforge** 是一个 npm CLI 工具，用于将 AI 编码配置（agents、skills、instructions、MCP tools）从集中知识仓库自动分发到用户本地的多个 AI 工具。

**版本**: 0.1.0  
**状态**: MVP 阶段（支持 4 个工具，16 条内置规则）

---

## 🎯 核心能力（5 个）

### 1. 多工具自动检测 & 配置分发
- **4 个支持工具**: Copilot、Claude Code、Cursor、VS Code
- **自动检测机制**: 扫描标志性目录（`~/.copilot`, `.github`, `~/.claude` 等）
- **智能映射**: 根据工具约定自动将配置文件安装到正确位置

### 2. 双模安装方式
| 模式 | 命令 | 特性 | 场景 |
|------|------|------|------|
| **复制模式**（默认） | `npx aiforge` / `npx aiforge -g` | 独立副本，项目级/全局都支持 | 项目快照、隔离环境 |
| **符号链接模式** | `npx aiforge -g -l` | 指向持久仓库，`git pull` 自动更新 | 全局长期使用、频繁更新 |

### 3. 四层认证系统
1. CLI 参数 → 2. 环境变量 → 3. 配置文件 → 4. 系统凭据
- 支持 SSH Key 和 Personal Access Token
- Token 脱敏保存，防止信息泄露

### 4. 交互式初始化 + 预览模式
- **`aiforge init`**: 引导式配置，验证认证有效性，保存到 `~/.aiforge/config.json`
- **`--dry-run`**: 预览安装计划，不写入文件，建立用户信任

### 5. 细粒度控制
- `--tools <tools...>`: 只安装到指定工具（如只装 Copilot）
- `--dirs <dirs...>`: 只安装指定资源类型（如只装 skills + agents）
- `--force`: 覆盖冲突文件，不备份

---

## 📊 支持的工具矩阵

```
┌──────────────────┬──────────┬──────────┬────────────────────────────┐
│ 工具             │ 全局安装 │ 项目安装 │ 支持的资源类型             │
├──────────────────┼──────────┼──────────┼────────────────────────────┤
│ GitHub Copilot   │ ✅       │ ✅       │ agents skills inst. mcp    │
│ Claude Code      │ ✅       │ ✅       │ agents skills              │
│ Cursor           │ ✅       │ ✅       │ agents skills              │
│ VS Code          │ ✅       │ —        │ mcp-tools                  │
└──────────────────┴──────────┴──────────┴────────────────────────────┘
```

**MVP 规则统计**: 16 条规则
- Copilot: 8 条（4 全局 + 4 项目）
- Claude: 4 条（2 全局 + 2 项目）
- Cursor: 3 条（1 全局 + 2 项目）
- VS Code: 1 条（仅全局）

---

## 🔧 CLI 命令速览

### 主命令: `aiforge [repo-url] [options]`

**核心选项**:
```bash
aiforge                                    # 用默认仓库安装到项目
aiforge -g                                 # 用默认仓库安装到全局
aiforge -g -l                              # 全局 + 符号链接（推荐）
aiforge <url>                              # 指定仓库 URL
aiforge -t copilot -d skills agents        # 只装 Copilot 的 skills + agents
aiforge --dry-run                          # 预览计划，不实际安装
aiforge --force                            # 强制覆盖冲突文件
aiforge --token <token>                    # 用 Token 认证
```

### 子命令: `aiforge init`

**交互流程** (TTY 仅):
```
选择语言 (中文/English)
    ↓
输入仓库 URL
    ↓
选择认证方式 (SSH/Token)
    ↓
验证连接 (ls-remote)
    ↓
保存到 ~/.aiforge/config.json
```

### 计划中的子命令:
- `aiforge update`: 更新持久化仓库（M2）
- `aiforge list`: 查看工具路径映射（M2）

---

## 📁 知识仓库目录约定

```
your-knowledge-repo/
├── agents/                    # Agent 定义（*.agent.md）
├── skills/                    # Skill 定义（目录树，主文件 skill.md）
├── instructions/              # 指令（*-instructions.md / *.instructions.md）
├── mcp-tools/                 # MCP 配置（mcp.json）
└── aiforge.json              # 可选：自定义规则（M3）
```

### 资源类型详解

| 资源 | 目录 | 安装类型 | 说明 |
|-----|------|---------|------|
| **Agent** | `agents/` | Files | 专家角色，逐文件复制 |
| **Skill** | `skills/*/` | Directories | 操作手册，保留目录结构 |
| **Instruction** | `instructions/` | Files | 提示词和指令 |
| **MCP Tool** | `mcp-tools/` | Files | 服务器配置 |

**Flatten 模式** (Cursor skills):
```
源: skills/skill-name/
     └── skill.md (主文件)
目标: ~/.cursor/rules/
     └── skill-name.md (重命名后)
```

---

## 🌍 核心数据流管道

```
CLI 参数解析
    ↓
仓库地址解析 (HTTPS/SSH/SCP)
    ↓
认证验证 (四层优先级)
    ↓
Git 克隆/更新
    ↓
AI 工具检测 (全局 → 项目)
    ↓
规则匹配 (RULE_INDEX O(1) 查询)
    ↓
安装计划生成 (干运行或实际执行)
    ↓
Manifest 更新 (冲突检测 + 增量判断)
    ↓
结果汇总 (按工具分组，统计数字)
```

---

## 👥 三类用户 & 成功指标

### 用户 1: 小明（中高级开发者）
- **痛点**: 每个工具都要手动配置、版本不一致
- **成功愿景**: `npx aiforge -g -l` 一次搞定，后续 `git pull` 自动更新
- **关键需求**: `--dry-run` 预览、符号链接自动更新

### 用户 2: 小李（新员工）
- **痛点**: Shell 脚本复杂、认证配置困难、害怕搞坏
- **成功愿景**: 跟着入职文档跑 `aiforge init` → `aiforge -g -l`，看到成功提示
- **关键需求**: TTY 交互式引导、三段式错误提示（什么坏了→为什么→怎么修）

### 用户 3: chunxiao（平台维护者）
- **痛点**: 每新增工具都要改脚本、测试多个平台、采用率难推
- **成功愿景**: 新工具只需加配置规则；`--dry-run` 快速验证
- **关键需求**: 配置驱动可扩展性、按工具分组的结果展示、零结果诊断

### MVP 质量门禁
- ✅ 安装结果 0 项时触发诊断
- ✅ 文件冲突时备份 + 提示
- ✅ Token 脱敏，不出现在进程/日志
- ✅ npm 包零敏感信息
- ✅ 认证失败给出修复建议
- ✅ `--dry-run` 预览准确

---

## 🎨 安装结果输出示例

```
✅ 安装完成
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GitHub Copilot
  ✅ agents/copilot-expert.agent.md → ~/.copilot/agents/copilot-expert.agent.md [新]
  🔄 skills/typescript → ~/.copilot/skills/typescript [更新]
  ⏭️  instructions/general.md → ~/.copilot/general.md [跳过]
  ✅ mcp-tools/mcp.json → ~/.copilot/mcp.json [新]

Claude Code
  ✅ agents/claude-refactor.agent.md → ~/.claude/agents/claude-refactor.agent.md [新]
  ✅ skills/testing → ~/.claude/skills/testing [新]

Cursor
  🔄 skills/typescript [Flatten] → ~/.cursor/rules/typescript.md [更新]
  ✅ agents/cursor-rules.agent.md → ~/.cursor/rules/cursor-rules.agent.md [新]

VS Code
  ✅ mcp-tools/mcp.json → ~/.vscode/mcp.json [新]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 统计: 新 8 项 | 更新 2 项 | 跳过 1 项 | 失败 0 项
```

---

## 📈 核心架构亮点

### 1. 管道式架构 (Pipeline)
- 7 个阶段，严格分离关注点
- 每个阶段清晰的输入/输出数据结构
- 易于测试、扩展、调试

### 2. 规则驱动设计
- `BUILTIN_RULES` 数组 + `RULE_INDEX` Map
- 新增工具支持**仅需修改配置**，无需改引擎代码
- O(1) 规则查询性能

### 3. 四层认证优先级
```
CLI 参数 (--token, --ssh)
  ↓
环境变量 (AIFORGE_TOKEN, GITLAB_TOKEN, GIT_TOKEN)
  ↓
配置文件 (~/.aiforge/config.json)
  ↓
系统凭据 (macOS Keychain, Windows 凭据管理器)
```

### 4. 安全设计
- ✅ Token 脱敏存储（`glpat-ab****xy`）
- ✅ npm 包零敏感信息（可直接开源）
- ✅ manifest.json 冲突检测 + 备份 (`.bak`)
- ✅ 符号链接沙箱验证（防止路径遍历）

### 5. 可靠性基础设施
- manifest.json: 记录已安装文件、哈希、时间戳
- 零结果诊断: 扫描了哪些目录、为什么没安装、建议修复
- fail-fast: 任何错误立即停止，输出已完成清单

---

## 🚀 快速入门三步

### Step 1: 初始化配置（仅需一次）
```bash
npx aiforge init
# 交互式选择语言、输入仓库 URL、选择认证方式、验证连接
# 保存到 ~/.aiforge/config.json
```

### Step 2: 全局安装（推荐）
```bash
npx aiforge -g -l
# - 克隆知识仓库到 ~/.aiforge/repos/
# - 在各工具目录创建符号链接
# - 后续只需 git pull 即可自动更新
```

### Step 3: 验证 & 日常更新
```bash
# 验证：打开各工具，确认规范已生效
# 更新：git pull 自动生效（符号链接模式）
cd ~/.aiforge/repos/
git pull origin main
```

---

## 📚 核心数据结构（11 个）

| 接口 | 说明 | 关键字段 |
|------|------|---------|
| **ParsedArgs** | CLI 参数解析后 | source, global, link, tools, dirs, dryRun, force, token |
| **ResolvedSource** | 仓库地址解析后 | hostname, repoPath, protocol |
| **AuthenticatedSource** | 认证后的源 | authMethod, cloneUrl |
| **LocalRepo** | 本地克隆仓库 | repoDir, isNew, sourceFiles |
| **DetectedEnv** | 检测的工具环境 | tools[], scope |
| **MatchedPlan** | 匹配的安装计划 | items[], mode, targetPath |
| **InstallResult** | 最终安装结果 | status, tool, sourcePath, targetPath |
| **InstallRule** | 安装规则定义 | tool, scope, sourceDir, type, targetDir |
| **ToolDefinition** | 工具检测定义 | id, name, detect.global[], detect.project[] |
| **AiforgeConfig** | 配置文件结构 | defaultRepo, language, auth, preferSSH |
| **ManifestEntry** | 安装清单条目 | source, target, hash, installedAt |

---

## 🎯 MVP 成功指标

### 质量门禁（上市条件）
- ✅ 4 个工具全部正常工作（16 条规则）
- ✅ 新员工能通过 init → 安装 → 验证完整旅程
- ✅ `--dry-run` 预览准确无误
- ✅ 冲突时自动备份，`--force` 强制覆盖
- ✅ Token 脱敏，npm 包零敏感信息

### 运营指标（发布后持续跟踪）
- 🎯 周活跃安装次数 > 50 次
- 🎯 安装失败率 < 10%
- 🎯 平均安装耗时 < 15 秒
- 🎯 公司开发者采用率：首月 > 50%，3 个月 > 80%
- 🎯 新员工入职首日即完成配置

---

## 📝 源文件映射

| 功能 | 源文件 | 行数 |
|------|--------|------|
| CLI 入口 + 主命令 | `src/index.ts` | 94 |
| init 子命令 | `src/commands/init.ts` | 232 |
| 内置规则表 | `src/data/install-rules.ts` | 152 |
| 工具检测注册表 | `src/data/tool-registry.ts` | 42 |
| 核心数据结构 | `src/core/types.ts` | 128 |
| 管道实现 | `src/pipeline.ts` | 400+ |

**总代码量**: ~2000 行 TypeScript

---

## 🔮 未来路线（M2/M3）

### M2（MVP 后 2-3 周）
- ✅ `aiforge update` 命令
- ✅ `aiforge list` 命令
- ✅ Windsurf、Codex CLI、Gemini CLI 支持
- ✅ Windows 基础支持
- ✅ 认证安全加固

### M3（M2 后 4 周）
- ✅ `aiforge.json` 自定义规则
- ✅ `aiforge uninstall` 命令
- ✅ 增量更新（哈希比对）
- ✅ 格式转换（Skills → .mdc）
- ✅ 交互式文件选择

### 远期愿景（P3）
- 🎯 语义类型系统（文件级类型检测）
- 🎯 规则包生态系统（可分发的配置包）
- 🎯 插件系统（第三方工具适配）
- 🎯 知识仓库脚手架

---

**文档日期**: 2026-04-07  
**文档版本**: 1.0  
**维护者**: chunxiao  

