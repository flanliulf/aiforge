# aiforge — 产品需求文档（PRD）

---

## 文档信息

| 字段 | 值 |
|------|-----|
| 产品名称 | aiforge |
| 版本 | v0.1.0 |
| 作者 | chunxiao |
| 创建日期 | 2025-07 |
| 状态 | 草稿 |

---

## 目录

1. [项目概述](#1-项目概述)
2. [背景与动机](#2-背景与动机)
3. [核心理念](#3-核心理念)
4. [架构设计](#4-架构设计)
5. [用户画像](#5-用户画像)
6. [用户旅程](#6-用户旅程)
7. [功能需求](#7-功能需求)
8. [CLI 接口设计](#8-cli-接口设计)
9. [配置文件规范](#9-配置文件规范)
10. [安装规则映射表](#10-安装规则映射表)
11. [认证方案](#11-认证方案)
12. [安全性要求](#12-安全性要求)
13. [非功能性需求](#13-非功能性需求)
14. [可扩展性设计](#14-可扩展性设计)
15. [发布与分发](#15-发布与分发)
16. [里程碑计划](#16-里程碑计划)
17. [成功指标](#17-成功指标)
18. [术语表](#18-术语表)

---

## 1. 项目概述

### 1.1 一句话定义

**aiforge** 是一个通过 `npx` 运行的命令行工具，能够从任意 Git 仓库中读取 AI 编码辅助配置（Instructions、Skills、Agents、MCP Tools），并按照各 AI 工具（GitHub Copilot、Claude Code、Cursor、VS Code、Windsurf 等）的目录约定，自动安装到用户全局目录或项目目录。

### 1.2 核心价值

| 维度 | 价值 |
|------|------|
| **标准化** | 统一多个 AI 工具的配置分发方式，一次定义，多端安装 |
| **自动化** | 自动检测环境中使用的 AI 工具，自动匹配安装路径，无需人工记忆 |
| **解耦** | 工具逻辑（aiforge）与知识内容（aicoding-base）完全分离，各自独立迭代 |
| **安全** | CLI 工具本身不含任何公司敏感信息，私有仓库认证完全在用户侧完成 |

### 1.3 关系定位

```
aiforge（本项目）          aicoding-base（知识仓库）
─────────────────         ─────────────────────
角色: 安装工具              角色: 知识文档源头
发布: npm 公网              托管: 公司内网 GitLab
迭代: 工具能力增强           迭代: AI 编码规范演进
依赖: 无                   依赖: 无
关系: aiforge 在运行时读取 aicoding-base 的内容进行安装
```

aiforge 本身是一个通用工具，不绑定任何特定仓库。公司内部的 `aicoding-base` 只是其中一个「知识仓库」。理论上任何人、任何组织都可以创建自己的知识仓库，并通过 `npx aiforge <repo-url>` 安装。

---

## 2. 背景与动机

### 2.1 现状问题

公司采用 `aicoding-base` 仓库统一管理 AI 编码辅助配置。目前已经提供了初始的安装方式，即通过 Shell 脚本（`setup.sh`、`setup-project.sh`）创建符号链接。从长期维护和方便使用的角度来看，该初始方案需要解决以下痛点：

| 痛点 | 说明 |
|------|------|
| **只支持符号链接** | 要求仓库必须持久存在于本地特定路径，无法按需复制 |
| **只支持单一工具** | Shell 脚本硬编码了 Copilot / Claude 的路径，不支持 Cursor / Windsurf 等新兴工具 |
| **跨平台差异** | Shell 脚本在 Windows 上需要 WSL，门槛高 |
| **无自动检测** | 开发者需要知道自己用了哪些 AI 工具，手动选择安装 |
| **无增量更新判断** | 每次 setup 都是全量覆盖，无法判断哪些文件已是最新 |
| **安装体验碎片化** | 全局安装和项目安装是两个不同的脚本，参数不同 |

### 2.2 目标

构建一个通用的、跨平台的、支持多 AI 工具的配置安装 CLI，替代现有 Shell 脚本，同时保持工具与知识内容的工程解耦。

### 2.3 非目标

| 不做的事情 | 原因 |
|-----------|------|
| 不做 AI 配置编辑器/IDE 插件 | 聚焦「安装分发」这一个职责 |
| 不做配置内容的语法校验 | 由各 AI 工具自身负责 |
| 不做 Git 仓库管理（创建/推送） | 由 Git 本身负责 |
| 不在工具内嵌入公司仓库地址 | 保持工具的通用性和安全性 |
| 不做不同格式间的内容转换（v0.1） | 留作后续迭代 |

---

## 3. 核心理念

### 3.1 知识仓库约定结构

aiforge 定义了一套「知识仓库」的目录约定。任何遵循此约定的 Git 仓库都可以被 aiforge 安装：

```
<knowledge-repo>/
├── aiforge.json            # 可选：安装清单文件
├── agents/                 # Agent 定义（专家角色）
│   └── *.agent.md
├── skills/                 # Skill 定义（操作手册）
│   └── <skill-name>/
│       └── skill.md        # 主文件
├── instructions/           # 全局/场景化指令
│   ├── copilot-instructions.md
│   └── *.instructions.md
└── mcp-tools/              # MCP 服务器配置
    └── mcp.json
```

### 3.2 三层资源模型

与 `aicoding-base` 的三层架构对齐：

| 层次 | 目录 | 激活方式 | 职责 |
|------|------|---------|------|
| Instructions | `instructions/` | 始终激活 | 全局底线约束 |
| Skills | `skills/` | 触发词自动激活 | 特定工具/领域操作手册 |
| Agents | `agents/` | 用户显式调用 | 承担完整任务流程的专家角色 |
| MCP Tools | `mcp-tools/` | 工具注册 | 外部系统 API 集成 |

### 3.3 安装策略

```
               源仓库目录
              ┌─────────┐
              │ agents/  │
              │ skills/  │
              │ instr./  │
              │ mcp/     │
              └────┬─────┘
                   │
         ┌─────── │ ──────────────┐
         │        │               │
    ┌────▼────┐ ┌─▼──────┐  ┌────▼────┐
    │ Copilot │ │ Claude  │  │ Cursor  │
    │         │ │         │  │         │
    │ 全局/项目│ │ 全局/项目│  │ 全局/项目│   ...更多工具
    └─────────┘ └─────────┘  └─────────┘
```

每个 AI 工具对资源的存放路径和格式要求不同，aiforge 内部维护一张「安装规则映射表」来处理这种差异。

### 3.4 两种安装模式

| 模式 | 命令标志 | 行为 | 适用场景 |
|------|---------|------|---------|
| **复制模式**（默认） | 无 | 将文件复制到目标目录 | 项目级安装，一次性使用 |
| **符号链接模式** | `-l` / `--link` | 将仓库持久化到本地，目标目录创建符号链接 | 全局安装，需要 `git pull` 自动生效 |

---

## 4. 架构设计

### 4.1 整体架构

```
┌──────────────────────────────────────────────────────────────────┐
│                          npm 公网                                │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐    │
│   │  aiforge (npm package)                                  │    │
│   │                                                         │    │
│   │  bin/aiforge.js            CLI 入口                      │    │
│   │  src/auth.js               认证 + 配置管理               │    │
│   │  src/clone.js              Git 克隆（带认证）             │    │
│   │  src/config.js             工具定义 + 安装规则映射表       │    │
│   │  src/detect.js             AI 工具自动检测               │    │
│   │  src/installer.js          安装引擎                      │    │
│   │  src/utils.js              文件操作工具                   │    │
│   └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│   不含任何仓库 URL / Token / 公司信息                              │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                       用户本地环境                                │
│                                                                  │
│   ~/.aiforge/config.json       用户配置（默认仓库、认证信息）       │
│   ~/aicoding-base/             持久化仓库克隆（符号链接模式）       │
│                                                                  │
│   ~/.copilot/agents/           ┐                                 │
│   ~/.copilot/skills/           │                                 │
│   ~/.claude/skills/            ├── 安装目标目录                    │
│   ~/.cursor/rules/             │                                 │
│   ...                          ┘                                 │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                     公司内网 GitLab                               │
│                                                                  │
│   aicoding-base                知识文档仓库（私有，需认证）         │
│   ├── agents/                                                    │
│   ├── skills/                                                    │
│   ├── instructions/                                              │
│   └── mcp-tools/                                                 │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 执行流程

```
npx aiforge [repo-url] [options]
        │
        ▼
┌──────────────────┐
│ 1. 解析 CLI 参数   │  解析命令、选项和参数（依赖 commander.js）
└───────┬──────────┘
        ▼
┌──────────────────┐
│ 2. 解析仓库地址    │  参数 > config.json defaultRepo
└───────┬──────────┘
        ▼
┌──────────────────┐
│ 3. 解析认证方式    │  CLI --token/--ssh > 环境变量 > config.json > 系统凭据
└───────┬──────────┘
        ▼
┌──────────────────┐
│ 4. 克隆/更新仓库   │  浅克隆到临时目录或持久目录
└───────┬──────────┘
        ▼
┌──────────────────┐
│ 5. 检测目标工具    │  扫描标志文件，或使用 --tools 指定
└───────┬──────────┘
        ▼
┌──────────────────┐
│ 6. 匹配安装规则    │  按工具、范围、源目录过滤规则表
└───────┬──────────┘
        ▼
┌──────────────────┐
│ 7. 执行安装       │  复制/链接文件到目标目录
└───────┬──────────┘
        ▼
┌──────────────────┐
│ 8. 输出结果汇总    │  统计 + .gitignore 建议
└───────┬──────────┘
        ▼
┌──────────────────┐
│ 9. 清理临时文件    │  非持久模式下删除临时目录
└──────────────────┘
```

### 4.3 模块职责

| 模块 | 职责 | 输入 | 输出 |
|------|------|------|------|
| `bin/aiforge.js` | CLI 入口，定义命令和参数 | 用户命令行输入 | 调用对应处理函数 |
| `src/auth.js` | 认证配置管理 | CLI 参数、环境变量、配置文件 | 认证信息对象 |
| `src/clone.js` | Git 仓库克隆/更新 | 仓库 URL、认证信息 | 本地仓库目录路径 |
| `src/config.js` | 工具定义 + 安装规则映射表 | 无（静态配置） | 规则列表、工具元数据 |
| `src/detect.js` | AI 工具检测 + 交互式选择 | 项目根目录 | 目标工具 ID 列表 |
| `src/installer.js` | 安装引擎（核心协调器） | 所有参数 | 安装结果列表 |
| `src/utils.js` | 文件扫描、复制、链接 | 源路径、目标路径、规则 | 安装操作结果 |

---

## 5. 用户画像

### 5.1 主要用户：公司开发者

| 特征 | 描述 |
|------|------|
| 技术水平 | 中高级开发者，熟悉命令行和 Git |
| 日常工具 | VS Code + GitHub Copilot 为主，部分使用 Cursor / Claude Code |
| 使用场景 | 新项目初始化、换电脑后环境搭建、团队配置更新 |
| 期望 | 一条命令完成配置安装，不需要记路径和文件名 |

### 5.2 次要用户：平台团队维护者

| 特征 | 描述 |
|------|------|
| 技术水平 | 高级，负责 aicoding-base 仓库维护 |
| 使用场景 | 验证新增 skill/agent 是否能正确安装到各工具 |
| 期望 | 预览模式（`--dry-run`）快速验证，清晰的安装日志 |

### 5.3 潜在用户：外部开发者/社区

| 特征 | 描述 |
|------|------|
| 使用场景 | 创建自己的 AI 编码知识仓库，使用 aiforge 分发 |
| 期望 | 工具足够通用，不绑定某公司的仓库结构 |

---

## 6. 用户旅程

### 6.1 首次使用（新员工入职）

```
时间线    操作                              系统行为
──────   ─────────────────────────          ──────────────────────
Day 1    npm/node 已安装                    —
         ↓
         npx aiforge init                  交互式引导：
                                            → 输入公司仓库 URL
                                            → 选择认证方式（SSH/Token）
                                            → 验证连接
                                            → 保存 ~/.aiforge/config.json
         ↓
         npx aiforge -g -l                 → 克隆仓库到 ~/aicoding-base
                                            → 检测已安装工具（Copilot, Claude）
                                            → 创建符号链接到全局目录
                                            → 输出安装汇总
         ↓
         打开 VS Code，Copilot 已生效       工作完成
```

### 6.2 日常更新（团队配置变更）

```
时间线    操作                              系统行为
──────   ─────────────────────────          ──────────────────────
团队通知  "aicoding-base 更新了新 Skill"     —
         ↓
         npx aiforge update                → cd ~/aicoding-base && git pull
                                            → 符号链接自动指向新内容
         ↓
         （或 npx aiforge -g -l）           → 检测到仓库已存在
                                            → git pull 更新
                                            → 检查是否有新工具被安装
                                            → 安装/更新符号链接
```

### 6.3 新项目初始化

```
时间线    操作                              系统行为
──────   ─────────────────────────          ──────────────────────
         cd ~/new-project
         git init
         ↓
         npx aiforge                       → 检测到 .git（项目根目录）
                                            → 克隆知识仓库到临时目录
                                            → 检测到 .github/（Copilot）
                                            → 复制文件到 .github/agents/, .github/skills/ 等
                                            → 输出 .gitignore 建议
                                            → 清理临时目录
```

### 6.4 安装新 AI 工具后

```
时间线    操作                              系统行为
──────   ─────────────────────────          ──────────────────────
         安装了 Cursor                      —
         ↓
         npx aiforge                       → 自动检测到 .cursor/
                                            → 将 skills/ 扁平化安装到 .cursor/rules/
                                            → 将 agents/ 安装到 .cursor/rules/
```

---

## 7. 功能需求

### 7.1 P0（MVP，必须实现）

| 编号 | 功能 | 描述 |
|------|------|------|
| F-001 | **Git 仓库克隆** | 支持 HTTPS 和 SSH 协议克隆远程仓库，浅克隆（`--depth 1`）降低耗时 |
| F-002 | **多 AI 工具支持** | 支持 GitHub Copilot、Claude Code、Cursor 至少三种工具的目录映射 |
| F-003 | **全局/项目安装** | 支持安装到用户全局目录（`-g`）和当前项目目录（默认） |
| F-004 | **四类资源安装** | 支持 agents、skills、instructions、mcp-tools 四类源目录 |
| F-005 | **自动工具检测** | 通过扫描标志性文件/目录自动判断用户环境中安装了哪些 AI 工具 |
| F-006 | **复制模式** | 将文件从源仓库复制到目标目录 |
| F-007 | **符号链接模式** | 将仓库持久化到本地，在目标目录创建符号链接（`-l`） |
| F-008 | **私有仓库认证** | 支持 SSH Key、Personal Access Token、环境变量、系统凭据管理器四种认证方式 |
| F-009 | **配置文件** | 支持 `~/.aiforge/config.json` 保存默认仓库和认证方式 |
| F-010 | **交互式初始化** | `aiforge init` 引导用户完成首次配置 |
| F-011 | **预览模式** | `--dry-run` 仅展示安装计划，不写入任何文件 |
| F-012 | **安装结果汇总** | 安装完成后打印清晰的结果统计和路径列表 |
| F-013 | **文件冲突处理** | 目标文件已存在时，支持备份、覆盖、跳过策略 |

### 7.2 P1（重要，首版后迭代）

| 编号 | 功能 | 描述 |
|------|------|------|
| F-101 | **仓库更新命令** | `aiforge update` 拉取已持久化仓库的最新内容 |
| F-102 | **工具路径列表** | `aiforge list` 展示所有支持的工具及其安装路径映射 |
| F-103 | **目标工具过滤** | `--tools` 参数指定只安装到特定工具 |
| F-104 | **源目录过滤** | `--dirs` 参数指定只安装特定类型的资源 |
| F-105 | **VS Code MCP 支持** | 将 mcp.json 安装到 VS Code 用户级 MCP 路径（跨平台） |
| F-106 | **Windsurf 支持** | 将 Skills 扁平化安装到 Windsurf 规则目录 |
| F-107 | **.gitignore 建议** | 项目级安装后，提示用户应添加到 .gitignore 的路径 |
| F-108 | **GitHub 简写** | 支持 `user/repo` 简写自动展开为 GitHub HTTPS URL |
| F-109 | **连接验证** | `aiforge init` 完成后自动验证 Git 连接是否成功 |
| F-110 | **认证错误友好提示** | 认证失败时给出清晰的修复建议，而非原始 git 错误 |

### 7.3 P2（有价值，中期迭代）

| 编号 | 功能 | 描述 |
|------|------|------|
| F-201 | **aiforge.json 清单** | 源仓库可通过 aiforge.json 自定义安装规则（覆盖默认映射） |
| F-202 | **卸载命令** | `aiforge uninstall` 根据安装日志精确移除已安装的资源 |
| F-203 | **安装日志** | 每次安装记录到 `~/.aiforge/install-log.json`，用于卸载和审计 |
| F-204 | **格式转换** | Skills 安装到 Cursor 时自动添加 `.mdc` frontmatter 头 |
| F-205 | **交互式文件选择** | 安装前让用户勾选要安装的具体文件 |
| F-206 | **多仓库支持** | `config.json` 支持注册多个知识仓库，按别名引用 |
| F-207 | **版本锁定** | 支持安装知识仓库的特定 tag/branch/commit |
| F-208 | **增量更新** | 通过文件哈希判断是否需要更新，跳过未变更的文件 |

### 7.4 P3（远期愿景）

| 编号 | 功能 | 描述 |
|------|------|------|
| F-301 | **插件系统** | 允许第三方编写插件适配新的 AI 工具 |
| F-302 | **知识仓库脚手架** | `aiforge create` 生成知识仓库骨架 |
| F-303 | **CI/CD 集成** | 提供 GitHub Action / GitLab CI 模板 |
| F-304 | **跨平台 GUI** | 提供简单的图形界面（Electron 或 Web） |

---

## 8. CLI 接口设计

### 8.1 命令结构

```
aiforge [command] [arguments] [options]
```

### 8.2 主命令：安装

```
aiforge [repo-url]
```

| 参数/选项 | 类型 | 必填 | 默认值 | 说明 |
|----------|------|------|--------|------|
| `repo-url` | argument | 否 | `config.json` 中的 `defaultRepo` | Git 仓库 URL 或 GitHub 简写 |
| `-g, --global` | flag | 否 | `false` | 安装到用户全局目录 |
| `-t, --tools <tools...>` | option | 否 | 自动检测 | 目标工具列表 |
| `-d, --dirs <dirs...>` | option | 否 | 全部 | 源目录列表 |
| `-l, --link` | flag | 否 | `false` | 使用符号链接模式 |
| `--clone-dir <path>` | option | 否 | `~/仓库名` | 持久化克隆路径 |
| `--ssh` | flag | 否 | `false` | 强制使用 SSH 协议 |
| `--token <token>` | option | 否 | 无 | Git Personal Access Token（仅开发/调试模式允许，生产模式禁用） |
| `--force` | flag | 否 | `false` | 覆盖已存在文件不备份 |
| `--dry-run` | flag | 否 | `false` | 预览模式 |

**使用示例：**

```bash
# 最简用法（已配置 defaultRepo）
npx aiforge

# 指定仓库
npx aiforge https://gitlab.wshmi.com/chunxiao/aicoding-base.git

# 全局 + 符号链接
npx aiforge -g -l

# 精确控制
npx aiforge -t copilot claude -d skills agents

# 预览
npx aiforge --dry-run
```

### 8.3 子命令：init

```
aiforge init
```

无参数。交互式引导用户完成：

1. 输入默认仓库 URL
2. 选择认证方式（SSH / Token / 系统凭据）
3. 输入 Token（若选择 Token 方式）
4. 设置持久化路径
5. 自动验证 Git 连接
6. 保存到 `~/.aiforge/config.json`

### 8.4 子命令：update

```
aiforge update [--clone-dir <path>]
```

拉取已持久化仓库的最新内容。若使用符号链接模式安装，更新后自动生效。

### 8.5 子命令：list

```
aiforge list
```

打印所有支持的 AI 工具名称及其安装路径映射，供用户参考。

---

## 9. 配置文件规范

### 9.1 用户配置：`~/.aiforge/config.json`

```jsonc
{
  // 默认仓库 URL，执行 aiforge 不传参时使用
  "defaultRepo": "https://gitlab.wshmi.com/chunxiao/aicoding-base.git",

  // 是否偏好 SSH 协议
  "preferSSH": true,

  // 符号链接模式的默认持久化路径
  "cloneDir": "~/aicoding-base",

  // 按 host 存储的认证信息
  "auth": {
    "gitlab.wshmi.com": {
      "method": "token",
      "token": "glpat-xxxxxxxxxxxx"
    }
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `defaultRepo` | string | 默认仓库 URL |
| `preferSSH` | boolean | 全局 SSH 偏好 |
| `cloneDir` | string | 符号链接模式持久化路径，支持 `~` 展开 |
| `auth` | object | 按 Git host 存储认证信息 |
| `auth.<host>.method` | `"token"` \| `"ssh"` | 该 host 的认证方式 |
| `auth.<host>.token` | string | Personal Access Token |

### 9.2 安装状态文件：`~/.aiforge/manifest.json`

记录每次安装的状态信息，用于卸载、增量更新和安装审计：

```jsonc
{
  // 已安装的文件清单
  "installed": [
    {
      "source": "agents/api-dev.agent.md",
      "target": "~/.copilot/agents/api-dev.agent.md",
      "tool": "copilot",
      "scope": "global",
      "mode": "symlink",
      "installedAt": "2025-07-15T10:30:00Z",
      "hash": "sha256:abc123..."
    }
  ],
  // 安装来源仓库
  "repo": "https://gitlab.wshmi.com/chunxiao/aicoding-base.git",
  // 最后安装时间
  "lastInstall": "2025-07-15T10:30:00Z"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `installed` | array | 已安装文件的详细记录 |
| `installed[].source` | string | 源文件在知识仓库中的相对路径 |
| `installed[].target` | string | 安装目标的完整路径 |
| `installed[].tool` | string | 目标工具 ID |
| `installed[].scope` | `"global"` \| `"project"` | 安装范围 |
| `installed[].mode` | `"copy"` \| `"symlink"` | 安装模式 |
| `installed[].hash` | string | 文件内容的 SHA-256 哈希（用于增量更新判断） |
| `repo` | string | 安装来源仓库 URL |
| `lastInstall` | string | 最后安装时间（ISO 8601） |

> 注：`manifest.json` 与 `config.json` 职责分离——`config.json` 存储用户配置和认证信息，`manifest.json` 存储安装状态和文件清单。

### 9.3 知识仓库清单（可选）：`aiforge.json`

源仓库根目录可放置 `aiforge.json` 自定义安装行为（P2 功能）：

```jsonc
{
  "name": "aicoding-base",
  "version": "1.0.0",
  "description": "公司 AI 编码流程基础库",

  // 声明本仓库包含哪些源目录
  "sources": ["agents", "skills", "instructions", "mcp-tools"],

  // 未来可自定义安装规则（覆盖默认映射）
  "install": {
    "skills": {
      "cursor": {
        "type": "flatten",
        "mainFile": "skill.md",
        "transform": "mdc"
      }
    }
  }
}
```

---

## 10. 安装规则映射表

### 10.1 规则定义模型

每条安装规则描述一个「从哪来 → 到哪去」的映射：

```typescript
interface InstallRule {
  tool: string;           // 目标工具 ID
  scope: 'global' | 'project';  // 安装范围
  sourceDir: string;      // 源仓库中的目录名
  type: 'files' | 'directories' | 'flatten'; // 安装类型
  include?: string[];     // 白名单文件名列表
  match?: RegExp;         // 正则匹配文件名
  exclude?: string[];     // 黑名单文件名列表
  mainFile?: string;      // flatten 模式下子目录的主文件
  targetDir: string;      // 目标路径（绝对=全局，相对=项目根）
  desc: string;           // 人类可读描述
}
```

### 10.2 安装类型说明

| 类型 | 行为 | 示例 |
|------|------|------|
| `files` | 扫描源目录中匹配的文件，逐个复制/链接 | `agents/*.agent.md` → 逐个复制 |
| `directories` | 扫描源目录中的子目录，整目录复制/链接 | `skills/tapd/` → 整目录复制 |
| `flatten` | 提取子目录中的主文件，以目录名重命名后复制 | `skills/tapd/skill.md` → `tapd.md` |

### 10.3 完整映射表

#### GitHub Copilot

| 范围 | 源目录 | 安装类型 | 匹配规则 | 目标路径 |
|------|--------|---------|---------|---------|
| 全局 | `agents/` | files | `*.agent.md` | `~/.copilot/agents/` |
| 全局 | `skills/` | directories | 所有子目录 | `~/.copilot/skills/` |
| 全局 | `instructions/` | files | 白名单: `copilot-instructions.md`, `copilot-doc-instructions.md` | `~/.copilot/` |
| 全局 | `mcp-tools/` | files | 白名单: `mcp.json` | `~/.copilot/` |
| 项目 | `agents/` | files | `*.agent.md` | `.github/agents/` |
| 项目 | `skills/` | directories | 所有子目录 | `.github/skills/` |
| 项目 | `instructions/` | files | 白名单: `copilot-instructions.md`, `copilot-doc-instructions.md` | `.github/` |
| 项目 | `instructions/` | files | `*.instructions.md`（排除上述两个） | `.github/instructions/` |
| 项目 | `mcp-tools/` | files | 白名单: `mcp.json` | `.github/` |

#### Claude Code

| 范围 | 源目录 | 安装类型 | 匹配规则 | 目标路径 |
|------|--------|---------|---------|---------|
| 全局 | `skills/` | directories | 所有子目录 | `~/.claude/skills/` |
| 项目 | `skills/` | directories | 所有子目录 | `.claude/skills/` |

#### Cursor

| 范围 | 源目录 | 安装类型 | 匹配规则 | 目标路径 |
|------|--------|---------|---------|---------|
| 全局 | `skills/` | flatten | 子目录主文件 `skill.md` | `~/.cursor/rules/` |
| 项目 | `skills/` | flatten | 子目录主文件 `skill.md` | `.cursor/rules/` |
| 项目 | `agents/` | files | `*.agent.md` | `.cursor/rules/` |
| 项目 | `instructions/` | files | 白名单: `copilot-instructions.md`, `copilot-doc-instructions.md` | `.cursor/rules/` |

#### VS Code

| 范围 | 源目录 | 安装类型 | 匹配规则 | 目标路径 |
|------|--------|---------|---------|---------|
| 全局 | `mcp-tools/` | files | 白名单: `mcp.json` | 跨平台 VS Code 用户目录 |

VS Code 用户目录：
- macOS: `~/Library/Application Support/Code/User/`
- Linux: `~/.config/Code/User/`
- Windows: `%APPDATA%\Code\User\`

#### Windsurf

| 范围 | 源目录 | 安装类型 | 匹配规则 | 目标路径 |
|------|--------|---------|---------|---------|
| 项目 | `skills/` | flatten | 子目录主文件 `skill.md` | `.windsurf/rules/` |

### 10.4 全局排除文件

以下文件在任何安装规则中都会被自动跳过：

```
README.md, README, readme.md,
.gitkeep, .DS_Store,
mcp.json.example
```

---

## 11. 认证方案

### 11.1 认证优先级

aiforge 按以下优先级解析认证信息（高优先 → 低优先）：

```
1. CLI 参数         --token <value> 或 --ssh
         ↓
2. 环境变量          AIFORGE_TOKEN / GITLAB_TOKEN / GIT_TOKEN
         ↓
3. 配置文件          ~/.aiforge/config.json → auth.<host>
         ↓
4. 全局偏好          ~/.aiforge/config.json → preferSSH
         ↓
5. 系统 Git 凭据     macOS Keychain / Windows 凭据管理器 / git-credential-store
```

### 11.2 认证方式详细说明

| 方式 | URL 变换 | 适用场景 |
|------|---------|---------|
| SSH Key | `https://host/path.git` → `git@host:path.git` | 开发者已在 GitLab 添加 SSH Key |
| Token 注入 | `https://host/path.git` → `https://oauth2:TOKEN@host/path.git` | 无 SSH Key，使用 Personal Access Token |
| 系统凭据 | 不做变换，由 `git` 命令自行调用凭据管理器 | 开发者之前已 clone 过并保存了密码 |

### 11.3 Token 安全处理

- Token 注入 URL **仅存在于内存中**，用于传递给 `git clone` 命令
- 克隆完成后，**立即将 remote URL 恢复为不含 Token 的原始 URL**
- 配置文件中的 Token 仅存于用户 Home 目录，建议文件权限设为 `600`
- 日志输出中 Token 显示为 `glpat-ab****xy` 格式

### 11.4 CLI Token 传递的环境感知

`--token` 参数在不同环境下的行为：

| 环境模式 | `--token` 行为 | 触发方式 |
|---------|---------------|---------|
| 开发/调试模式（默认） | 允许使用，输出安全提示 | 默认行为 |
| 生产/部署模式 | 禁止使用，提示使用环境变量或配置文件 | `AIFORGE_MODE=production` 或 `config.json` 中 `"mode": "production"` |

生产模式下的提示：
```
❌ 生产模式下不允许通过 CLI 参数传递 Token
   请使用以下方式之一：
   1. 环境变量：export AIFORGE_TOKEN=<your-token>
   2. 配置文件：npx aiforge init
   3. SSH 认证：npx aiforge --ssh
```

> 此设计来源于混沌工程攻击向量 #3 的安全评估：CLI 传 Token 存在进程列表泄露和 shell 历史记录风险，但在开发调试场景下仍有便利性价值。

---

## 12. 安全性要求

### 12.1 安全边界

| 层面 | 要求 |
|------|------|
| **npm 包内容** | 不含任何仓库 URL、Token、Host 名、公司名称或业务信息 |
| **源代码** | 不含默认的仓库地址或认证信息模板 |
| **配置文件** | 仅存在于用户本地 `~/.aiforge/`，不随 npm 包分发 |
| **Git 操作** | Token 注入 URL 仅在内存中短暂存在，操作完成后清除 |
| **日志输出** | 任何涉及 Token 的日志显示均做脱敏处理 |
| **临时文件** | 非持久模式下，临时目录在安装完成后立即删除 |

### 12.2 审计友好

- 安装日志（P2 功能）记录每次安装的时间、来源、目标路径
- `--dry-run` 允许在不写入文件的情况下审查安装计划

### 12.3 安装安全（来源：混沌工程攻击向量 #1、#2）

| 风险 | 说明 | 防护措施 |
|------|------|---------|
| 静默失败 | 检测到 0 个匹配目录时无任何输出，用户误以为安装成功 | 零结果时输出诊断信息：扫描了哪些目录、匹配了哪些模式、建议检查仓库结构 |
| 文件冲突 | 目标路径已存在同名文件，默认行为不明确 | 默认备份（`.bak`）+ 提示；`--force` 覆盖不备份；冲突时输出差异摘要 |
| 符号链接脆弱性 | 符号链接目标被删除/移动后，链接悬空导致工具加载失败 | 安装后验证链接有效性；`aiforge doctor` 命令检查所有符号链接状态（P2） |
| 路径遍历 | 恶意 aiforge.json 中的 `../` 路径可能写入任意位置 | 安装前校验所有目标路径不超出预期范围（`~/.copilot/`、项目目录等） |

---

## 13. 非功能性需求

### 13.1 性能

| 指标 | 目标值 |
|------|--------|
| 首次克隆 + 安装（私有仓库） | < 30 秒 |
| 持久化仓库更新 + 安装 | < 10 秒 |
| 无网络环境下处理已有持久化仓库 | < 3 秒 |

### 13.2 兼容性

| 维度 | 要求 |
|------|------|
| Node.js | >= 18.0.0 |
| 操作系统 | macOS、Linux（Windows 为 P2，需解决符号链接权限） |
| Git | >= 2.20（支持 `--depth` 浅克隆） |

### 13.3 可靠性

| 场景 | 处理方式 |
|------|---------|
| 网络中断 | 克隆失败时给出明确错误，不留残余文件 |
| 目标目录不存在 | 自动创建（`fs.ensureDir`） |
| 目标文件已存在 | 默认备份后覆盖；`--force` 直接覆盖；`--dry-run` 仅提示 |
| 源目录不存在 | 静默跳过，日志标注 |
| 认证失败 | 给出多种修复方式提示 |
| Git host 不可达 | 提示检查网络/VPN |

### 13.4 用户体验

| 要求 | 说明 |
|------|------|
| 进度展示 | 克隆过程显示 spinner 动画 |
| 分层日志 | 按工具和源目录分组，树形缩进展示 |
| 彩色输出 | 成功(绿)、警告(黄)、错误(红)、信息(蓝/青) |
| 中文输出 | CLI 所有提示信息为中文（匹配目标用户群） |
| 零配置可用 | 除 init 外的所有命令，未配置时通过交互式提示引导用户 |

---

## 14. 可扩展性设计

### 14.1 新增 AI 工具

新增一个 AI 工具只需修改 `src/config.js`：

```javascript
// 1. 在 TOOLS 中注册工具
export const TOOLS = {
  // ...现有工具...
  newTool: {
    name: 'New AI Tool',
    detect: {
      global: [path.join(HOME, '.newtool')],
      project: ['.newtool', '.newtoolrc'],
    },
  },
};

// 2. 在 INSTALL_RULES 中添加规则
export const INSTALL_RULES = [
  // ...现有规则...
  {
    tool: 'newTool',
    scope: 'project',
    sourceDir: 'skills',
    type: 'flatten',
    mainFile: 'skill.md',
    targetDir: '.newtool/rules',
    desc: 'New Tool 规则',
  },
];
```

不需要修改安装引擎或其他模块。

### 14.2 新增源目录类型

如果知识仓库新增了一种资源类型（例如 `prompts/`）：

1. 在 `ALL_SOURCE_DIRS` 中添加
2. 在 `INSTALL_RULES` 中添加对应的映射规则

### 14.3 新增安装类型

当前支持 `files`、`directories`、`flatten` 三种。如需新增（例如 `merge` 合并多文件为一）：

1. 在 `src/installer.js` 的 `executeRule()` 函数的 `switch` 中添加新 case
2. 在规则定义中使用新的 `type` 值

### 14.4 aiforge.json 覆盖机制（P2）

知识仓库可通过 `aiforge.json` 覆盖默认规则，允许仓库维护者：

- 自定义哪些文件安装到哪个工具
- 指定格式转换方式
- 声明安装后脚本

### 14.5 语义类型系统（P3）

当前 Layer 1 智能检测基于目录名匹配（DETECTION_PATTERNS），未来可增强为语义类型系统：

- 文件粒度的类型检测：不仅识别目录类型，还能识别单个 `.ts`/`.md` 文件的语义类型
- 类型映射规则：将语义类型映射到不同 AI 工具的安装路径
- 规则冲突检测：多个规则包对同一文件有不同处理时，检测并解决冲突
- 可观测性：输出类型检测过程的详细日志，便于调试

> 详见混沌工程攻击向量 #4：语义类型系统

### 14.6 规则包生态系统（P3）

当前 aiforge 从单一 Git 仓库安装配置，未来可演进为规则包生态系统：

- 依赖解析：规则包之间的依赖关系管理（循环检测、版本冲突解决）
- 版本管理：语义化版本、Lockfile、更新策略
- 安全防护：恶意包检测（Typosquatting、代码混淆、沙箱执行）、包签名验证
- 包发现：搜索、评分、推荐（含虚假评分/下载量检测）
- 生态治理：包废弃认领、维护者资质检查、关键包监控

> 详见混沌工程攻击向量 #5：规则包生态系统

---

## 15. 发布与分发

### 15.1 npm 发布

```bash
# 发布到 npm 公网
npm publish
```

包名候选：`aiforge`（如被占用则 `ai-forge` / `@aiforge/cli`）

### 15.2 包内容审查

`package.json` 中通过 `files` 字段严格限制发布内容：

```json
{
  "files": ["bin/", "src/", "README.md", "LICENSE"]
}
```

发布前需自查：

- [ ] 源代码中不含任何公司域名、仓库地址
- [ ] 源代码中不含任何 Token / 密钥
- [ ] `README.md` 中的示例使用通用占位仓库
- [ ] `config.json` 不在 `files` 列表中

### 15.3 版本管理

遵循 Semantic Versioning：

- **Patch (0.1.x)**: Bug 修复
- **Minor (0.x.0)**: 新增工具支持、新安装类型
- **Major (x.0.0)**: CLI 参数不兼容变更、配置文件格式变更

---

## 16. 里程碑计划

### M1: MVP（2 周）

| 交付物 | 说明 |
|--------|------|
| 核心 CLI | `aiforge <url>` 主命令可用 |
| 三工具支持 | Copilot + Claude + Cursor |
| 两种模式 | 复制模式 + 符号链接模式 |
| 认证支持 | SSH + Token + 环境变量 |
| `aiforge init` | 交互式配置 |
| 本地测试通过 | 对 aicoding-base 仓库完成端到端测试 |

### M2: 完善（2 周）

| 交付物 | 说明 |
|--------|------|
| `aiforge update` | 仓库更新命令 |
| `aiforge list` | 工具路径列表 |
| VS Code + Windsurf | 补全工具矩阵 |
| .gitignore 建议 | 项目级安装后自动提示 |
| 友好错误提示 | 认证失败、网络不可达等场景 |
| npm 发布 | 第一版发布到公网 npm |

### M3: 增强（4 周）

| 交付物 | 说明 |
|--------|------|
| `aiforge.json` 清单 | 知识仓库可自定义安装规则 |
| 安装日志 | 记录安装历史 |
| `aiforge uninstall` | 卸载命令 |
| 格式转换 | Skills → Cursor .mdc 转换 |
| Windows 支持 | 测试并适配 Windows 环境 |

---

## 17. 成功指标

### 17.1 定量指标

| 指标 | 目标 | 衡量方式 |
|------|------|---------|
| 公司开发者采用率 | 首月 > 50% | 内部调研 |
| 安装成功率 | > 95% | 用户反馈 |
| 平均安装耗时 | < 15 秒 | 日志统计 |
| npm 周下载量（公司内） | > 50 | npm stats |

### 17.2 定性指标

| 指标 | 目标 |
|------|------|
| 替代 shell 脚本 | 新员工不再需要阅读 shell 脚本即可完成配置 |
| 多工具覆盖 | Cursor/Windsurf 用户也能享受统一配置 |
| 更新体验 | 知识仓库更新后，员工一条命令即可同步 |

---

## 18. 术语表

| 术语 | 定义 |
|------|------|
| **知识仓库** | 遵循 aiforge 约定目录结构的 Git 仓库，包含 AI 编码配置内容 |
| **源目录** | 知识仓库中的顶层资源目录：agents、skills、instructions、mcp-tools |
| **目标工具** | 用户本地安装的 AI 编码工具：Copilot、Claude、Cursor 等 |
| **安装规则** | 一条从「源目录 + 工具 + 范围」到「目标路径 + 安装方式」的映射 |
| **安装类型** | 资源从源到目标的处理方式：files（文件复制）、directories（目录复制）、flatten（扁平化提取） |
| **复制模式** | 将文件从临时目录复制到目标位置 |
| **符号链接模式** | 将仓库持久化到本地，目标位置创建符号链接 |
| **全局安装** | 安装到用户 Home 目录下的 AI 工具配置目录 |
| **项目安装** | 安装到当前项目目录下的 AI 工具配置目录 |
| **aiforge.json** | 知识仓库中可选的安装清单文件，用于自定义安装行为 |
| **manifest.json** | `~/.aiforge/manifest.json`，记录安装状态和文件清单，用于卸载、增量更新和审计 |
| **preflight** | 执行前的安全检查机制。认证 preflight 检查 Token 健康和权限；更新 preflight 检查签名和完整性。两者独立触发 |
| **语义类型** | 文件粒度的类型识别（P3），将 .ts/.md 等文件映射到 agent/skill/instruction 等语义类型 |
| **规则包** | 可独立分发的 AI 编码配置单元（P3），包含 manifest、规则定义、文档，支持依赖管理和版本控制 |