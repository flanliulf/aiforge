# AI-Forge CLI 工具 — 完整功能接口文档

**项目名称**: aiforge  
**版本**: 0.1.0  
**描述**: AI rules installer - sync AI tool configurations from a knowledge repository  
**主入口**: `aiforge` (bin: `./dist/index.js`)  
**运行方式**: `npx aiforge` 或已安装后直接运行 `aiforge`  
**Node.js**: >= 18.0.0  
**许可证**: MIT

---

## 目录

1. [CLI 命令和选项](#1-cli-命令和选项)
2. [支持的 AI 工具](#2-支持的-ai-工具)
3. [安装规则和类型](#3-安装规则和类型)
4. [核心数据结构](#4-核心数据结构)
5. [知识仓库结构](#5-知识仓库结构)
6. [用户旅程和成功度量](#6-用户旅程和成功度量)

---

## 1. CLI 命令和选项

### 1.1 主命令：aiforge

```bash
aiforge [repo-url] [options]
```

**参数**:
| 参数 | 类型 | 可选 | 说明 |
|-----|------|------|------|
| `repo-url` | 字符串 | ✅ | Git 仓库 URL 或 GitHub 简写，可省略使用默认仓库 |

**选项**:
| 短选项 | 长选项 | 值 | 默认 | 说明 |
|-------|--------|-----|------|------|
| `-g` | `--global` | 布尔 | false | 安装到用户全局目录 |
| `-l` | `--link` | 布尔 | false | 使用符号链接模式（需配合 `-g` 使用，项目级不支持） |
| `-t` | `--tools` | 字符串... | - | 指定目标工具（如 `copilot claude cursor`），支持多个 |
| `-d` | `--dirs` | 字符串... | - | 指定源目录/资源类型（如 `skills agents`），支持多个 |
| - | `--dry-run` | 布尔 | false | 预览模式，不写入任何文件，显示安装计划 |
| - | `--quiet` | 布尔 | false | 最小输出模式 |
| - | `--force` | 布尔 | false | 覆盖已存在的文件，不显示冲突确认，不备份 |
| - | `--ssh` | 布尔 | false | 强制使用 SSH 协议认证 |
| - | `--token` | 字符串 | - | 提供 Personal Access Token（脱敏存储） |
| - | `--clone-dir` | 路径字符串 | - | 指定持久化仓库克隆路径（符号链接模式） |

**使用示例**:
```bash
# 使用已配置的默认仓库安装到项目
npx aiforge

# 指定仓库 URL
npx aiforge https://your-git-host.com/team/ai-configs.git

# 全局安装 + 符号链接（推荐）
npx aiforge -g -l

# 只安装 Skills 和 Agents 到 Copilot
npx aiforge -t copilot -d skills agents

# 预览安装计划
npx aiforge --dry-run

# 强制覆盖
npx aiforge --force
```

### 1.2 子命令：init

```bash
aiforge init
```

**功能**: 交互式初始化配置（仅 TTY 环境可用）

**交互步骤**:
1. **语言选择** — 中文 / English
2. **仓库 URL** — 输入 Git 仓库地址
3. **认证方式** — SSH 或 Token
4. **连接验证** — 验证 SSH Key 或 Token 有效性

**输出文件**: `~/.aiforge/config.json`

**配置文件示例**:
```json
{
  "defaultRepo": "https://your-git-host.com/team/ai-configs.git",
  "language": "zh-CN",
  "preferSSH": true,
  "cloneDir": "~/ai-configs",
  "auth": {
    "your-git-host.com": {
      "method": "ssh",
      "token": null
    },
    "gitlab.com": {
      "method": "token",
      "token": "<脱敏后的Token>"
    }
  }
}
```

### 1.3 子命令：update（计划中）

```bash
aiforge update
```

**功能**: 更新已持久化的知识仓库（通过 git pull）

**计划状态**: M2 阶段

### 1.4 子命令：list（计划中）

```bash
aiforge list
```

**功能**: 查看支持的工具及其路径映射

**计划状态**: M2 阶段

---

## 2. 支持的 AI 工具

### 2.1 工具列表及检测机制

| 工具 ID | 工具名称 | 全局安装 | 项目安装 | 检测标志 | 支持资源类型 |
|--------|---------|:------:|:------:|---------|-----------|
| `copilot` | GitHub Copilot | ✅ | ✅ | `~/.copilot` 或 `.github` 目录存在 | agents, skills, instructions, mcp-tools |
| `claude` | Claude Code | ✅ | ✅ | `~/.claude` 或 `.claude` 目录存在 | agents, skills |
| `cursor` | Cursor | ✅ | ✅ | `~/.cursor` 或 `.cursor` 目录存在 | agents, skills |
| `vscode` | VS Code | ✅ | — | `~/.vscode` 目录存在 | mcp-tools |

**计划支持**（M2 阶段）:
- Windsurf（项目级）
- Codex CLI（全局）
- Gemini CLI（全局）
- Trae（全局）

### 2.2 工具检测规则

检测机制基于**标志性文件/目录存在性**，不依赖工具进程：

```typescript
// 检测顺序：全局 → 项目
// 如果全局已检测到某工具，项目级不会再检测相同工具（避免重复）

Copilot:
  global: ~/.copilot
  project: .github

Claude Code:
  global: ~/.claude
  project: .claude

Cursor:
  global: ~/.cursor
  project: .cursor

VS Code:
  global: ~/.vscode
  project: (仅全局)
```

---

## 3. 安装规则和类型

### 3.1 安装类型（InstallType 枚举）

| 类型 | 枚举值 | 说明 | 使用场景 |
|-----|--------|------|---------|
| **Files** | `'Files'` | 逐文件复制或符号链接 | agents、instructions、mcp-tools（单文件） |
| **Directories** | `'Directories'` | 复制整个目录结构 | skills（目录结构需保留） |
| **Flatten** | `'Flatten'` | 扁平化提取+重命名 | cursor skills（提取主文件后重命名） |

### 3.2 内置安装规则映射表（BUILTIN_RULES）

**MVP 共 16 条规则，覆盖 4 工具 × 全局/项目**

```
格式: [工具] → [范围] → [源目录] → [安装类型] → [目标路径]
```

#### Copilot（4 全局 + 4 项目 = 8 条）

**全局安装**:
| 源 | 类型 | 目标 |
|----|------|------|
| agents | Files | ~/.copilot/agents/ |
| skills | Directories | ~/.copilot/skills/ |
| instructions | Files | ~/.copilot/ |
| mcp-tools | Files | ~/.copilot/ |

**项目安装**:
| 源 | 类型 | 目标 |
|----|------|------|
| agents | Files | .github/agents/ |
| skills | Directories | .github/skills/ |
| instructions | Files | .github/ |
| mcp-tools | Files | .github/ |

#### Claude Code（2 全局 + 2 项目 = 4 条）

**全局安装**:
| 源 | 类型 | 目标 |
|----|------|------|
| agents | Files | ~/.claude/agents/ |
| skills | Directories | ~/.claude/skills/ |

**项目安装**:
| 源 | 类型 | 目标 |
|----|------|------|
| agents | Files | .claude/agents/ |
| skills | Directories | .claude/skills/ |

#### Cursor（1 全局 + 2 项目 = 3 条）

**全局安装**:
| 源 | 类型 | 目标 |
|----|------|------|
| skills | Flatten | ~/.cursor/rules/ |

**项目安装**:
| 源 | 类型 | 目标 |
|----|------|------|
| skills | Flatten | .cursor/rules/ |
| agents | Files | .cursor/rules/ |

#### VS Code（1 全局）

| 源 | 类型 | 目标 |
|----|------|------|
| mcp-tools | Files | ~/.vscode/ |

### 3.3 规则查询索引

内部使用 `RULE_INDEX` Map 实现 O(1) 查找：

```typescript
key = `${tool}:${scope}`  // e.g., "copilot:global"
value = InstallRule[]     // 该工具该范围的所有规则
```

---

## 4. 核心数据结构

### 4.1 ParsedArgs（CLI 参数解析后）

```typescript
interface ParsedArgs {
  source: string              // 仓库 URL
  global: boolean             // 是否全局安装
  link: boolean               // 是否符号链接模式
  tools: string[]             // 指定工具列表
  dirs: string[]              // 指定资源目录列表
  dryRun: boolean             // 预览模式
  quiet: boolean              // 安静模式
  force: boolean              // 强制覆盖
  ssh: boolean                // 强制 SSH
  token?: string              // Token（CLI 参数）
  cloneDir?: string           // 自定义克隆路径
  symlink: boolean            // （内部别名）
  flatten: boolean            // （内部别名）
  language?: string           // 语言（从配置加载）
}
```

### 4.2 ResolvedSource（仓库地址解析后）

```typescript
interface ResolvedSource {
  hostname: string            // 主机名（如 gitlab.com）
  repoPath: string            // 仓库路径（如 team/repo）
  protocol: 'https' | 'ssh'   // 协议
}
```

### 4.3 AuthenticatedSource（认证后）

```typescript
interface AuthenticatedSource extends ResolvedSource {
  authMethod: 'ssh' | 'token' | 'credential-manager'
  cloneUrl: string            // 完整克隆 URL
}
```

### 4.4 LocalRepo（本地仓库）

```typescript
interface LocalRepo {
  repoDir: string             // 仓库目录路径
  isNew: boolean              // 是否新克隆
  sourceFiles: string[]       // 仓库内所有源文件路径
}
```

### 4.5 DetectedEnv（检测的工具环境）

```typescript
interface DetectedEnv {
  tools: string[]             // 已检测到的工具 ID 列表
  scope: 'global' | 'project' // 检测范围
}
```

### 4.6 MatchedPlan（匹配的安装计划）

```typescript
interface MatchedPlan {
  items: Array<{
    rule: InstallRule         // 关联的安装规则
    sourceFiles: string[]      // 源文件列表
    targetPath: string         // 目标路径（已展开 ~）
    mode: 'copy' | 'symlink'  // 安装方式
  }>
}
```

### 4.7 InstallResult（安装结果）

```typescript
interface InstallResult {
  items: Array<{
    status: 'new' | 'updated' | 'skipped'  // 安装状态
    tool: string                           // 工具 ID
    toolDisplayName?: string               // 工具显示名（如 'GitHub Copilot'）
    sourcePath: string                     // 源文件路径
    targetPath: string                     // 目标文件路径
  }>
}
```

### 4.8 InstallRule（安装规则定义）

```typescript
interface InstallRule {
  tool: string                // 工具 ID（如 'copilot'）
  scope: 'global' | 'project' // 范围
  sourceDir: string           // 源目录名（如 'skills'）
  type: InstallType           // 安装类型（Files/Directories/Flatten）
  targetDir: string           // 目标目录（支持 ~ 展开）
  mainFile?: string           // 主文件名（Flatten 模式，默认 'index.md'）
}
```

### 4.9 ToolDefinition（工具定义）

```typescript
interface ToolDefinition {
  id: string                  // 工具唯一标识符
  name: string                // 工具显示名称
  detect: {
    global: string[]          // 全局检测路径列表
    project: string[]         // 项目检测路径列表
  }
}
```

### 4.10 AiforgeConfig（配置文件结构）

```typescript
interface AiforgeConfig {
  defaultRepo?: string        // 默认知识仓库 URL
  cloneDir?: string           // 克隆目录路径（符号链接模式）
  language?: string           // 界面语言（'zh-CN' 或 'en'）
  preferSSH?: boolean         // 偏好 SSH 认证
  auth: Record<string, HostAuth>  // 按主机名的认证配置
}

interface HostAuth {
  method: 'ssh' | 'token'     // 认证方式
  token?: string              // Token（仅 token 方式有值）
}
```

### 4.11 ManifestEntry（安装清单条目）

```typescript
interface ManifestEntry {
  source: string              // 源文件路径
  target: string              // 目标文件路径
  tool: string                // 工具 ID
  scope: 'global' | 'project' // 范围
  mode: 'copy' | 'symlink' | 'flatten'
  hash: string                // 文件哈希（用于冲突检测）
  installedAt: string         // 安装时间戳
}
```

---

## 5. 知识仓库结构

### 5.1 标准目录约定

```
your-knowledge-repo/
├── aiforge.json              # （可选）自定义安装清单（M3 功能）
├── agents/                   # Agent 定义（专家角色）
│   ├── agent-1.agent.md
│   ├── agent-2.agent.md
│   └── ...
├── skills/                   # Skill 定义（操作手册）
│   ├── skill-name-1/
│   │   ├── skill.md         # 主文件
│   │   └── examples.md
│   ├── skill-name-2/
│   │   └── skill.md
│   └── ...
├── instructions/            # 全局/场景化指令
│   ├── copilot-instructions.md
│   ├── general-instructions.md
│   └── *.instructions.md
└── mcp-tools/               # MCP 服务器配置
    ├── mcp.json
    └── ...
```

### 5.2 各资源类型说明

| 资源类型 | 目录 | 文件命名 | 说明 |
|---------|------|---------|------|
| **Agent** | `agents/` | `*.agent.md` | 专家角色定义（Copilot、Claude、Cursor 支持） |
| **Skill** | `skills/*/` | `skill.md`（主文件） | 操作手册，支持子目录和附加文件 |
| **Instruction** | `instructions/` | `*-instructions.md` 或 `*.instructions.md` | 全局提示词和场景化指令 |
| **MCP Tool** | `mcp-tools/` | `mcp.json` | MCP 服务器配置（Copilot、VS Code 支持） |

### 5.3 Flatten 模式示例

**Cursor 对 Skill 使用 Flatten 模式**，提取主文件并重命名：

```
源: knowledge-repo/skills/
  ├── skill-a/
  │   ├── skill.md         ← 主文件（提取）
  │   └── examples.md      （忽略）
  ├── skill-b/
  │   └── skill.md
  └── ...

目标: ~/.cursor/rules/
  ├── skill-a.md          ← 提取后重命名
  ├── skill-b.md
  └── ...
```

---

## 6. 用户旅程和成功度量

### 6.1 核心用户画像

#### 用户 1：小明 — 中高级开发者（3-5 年经验）
- **背景**: 使用 VS Code + Copilot，偶尔尝试 Claude Code、Cursor 等新工具
- **痛点**: 每个工具都要手动配置，无法追踪配置版本，团队更新无法自动同步
- **成功愿景**: 一条命令完成所有工具配置，后续 `aiforge update` 即可同步最新规范

#### 用户 2：小李 — 初级开发者/新员工
- **背景**: 应届生或 1 年经验，对命令行有基本认知
- **痛点**: Shell 脚本复杂、认证问题不知道怎么排查、害怕搞坏环境
- **成功愿景**: 按照入职文档跑一条命令，看到成功提示即完成配置

#### 用户 3：chunxiao — 平台维护者
- **背景**: 维护公司 AI 编码规范知识仓库和 aiforge 工具
- **痛点**: 每新增工具都要改脚本+测试多个平台，采用率低
- **成功愿景**: 新增工具只需加配置规则；`--dry-run` 快速验证；采用率从被推广变为"一条命令，没有理由不用"

### 6.2 用户旅程 — 小明的首次使用

```
发现 → 信任建立 → 安装 → Aha Moment → 日常更新
```

| 阶段 | 触发 | 行为 | 产品响应 |
|------|------|------|---------|
| **发现** | 团队通知"用 aiforge 替代 setup.sh" | 阅读简短说明 | — |
| **信任建立** | 运行 `npx aiforge --dry-run` | 预览计划，确认无覆盖风险 | 清晰展示每文件去向，标注冲突+备份 |
| **安装** | 运行 `npx aiforge -g -l` | 观察进度输出 | spinner + 阶段式状态 + 按工具分组结果 |
| **Aha** | 看到"安装完成：Copilot 6 项、Claude 4 项、VS Code 1 项" | 打开工具验证 | ✅ 图标 + 统计数字 + 下一步提示 |
| **日常更新** | 团队更新规范通知 | 运行 `aiforge update` | git pull 自动生效（符号链接模式） |

### 6.3 用户旅程 — 小李的入职配置

```
入职文档 → aiforge init → 认证 → 一键安装 → 验证生效
```

| 步骤 | 行为 | 可能的阻塞 | 产品应对 |
|------|------|-----------|---------|
| **Step 1** | 看到入职文档：`npx aiforge init` | TTY 环境检查失败 | 提示"需在终端运行" |
| **Step 2** | 选择语言 + 输入仓库 URL | URL 格式不对 | 交互式验证提示 |
| **Step 3** | 选择认证方式（SSH / Token） | SSH Key 未配 | 三段式提示：什么坏了 → 为什么 → 怎么修（含链接） |
| **Step 4** | 运行 `npx aiforge -g -l` | 网络超时 | 网络诊断建议 |
| **Step 5** | 看到"✅ 安装完成" | — | 清晰的成功输出，新手能确认"装好了" |

### 6.4 成功指标

#### MVP 发布标准（质量门禁）

| 类别 | KPI | 目标 |
|------|-----|------|
| **可靠性** | 安装结果为 0 项时触发诊断输出 | 100% |
| **可靠性** | 文件冲突时提示并备份 | 100% |
| **安全性** | Token 不出现在进程列表、Shell 历史、日志 | 100% |
| **安全性** | npm 包不含公司信息、仓库 URL、Token | 100% |
| **用户体验** | 认证失败时给出可操作的修复建议 | 100% |
| **用户体验** | `--dry-run` 预览模式可用 | 100% |

#### 运营指标（发布后持续跟踪）

| 指标 | 目标 | 频率 |
|------|------|------|
| 周活跃安装次数 | > 50 次 | 周 |
| 安装失败率 | < 10% | 周 |
| 平均安装耗时 | < 15 秒（持久化仓库更新 + 安装） | 月 |
| 支持工具数量 | 每季度至少新增 1 个 | 季度 |
| **北极星指标** | 公司开发者采用率 | MVP 首月 > 50%，3 个月 > 80% |

### 6.5 安装模式对比

| 特性 | 复制模式（默认） | 符号链接模式（-l） |
|-----|----------------|------------------|
| **安装命令** | `npx aiforge` 或 `npx aiforge -g` | `npx aiforge -g -l` |
| **目标** | 项目 / 全局 | **仅全局** |
| **文件属性** | 独立副本，文件完整 | 符号链接指向持久仓库 |
| **更新方式** | 重新运行 aiforge | `git pull` 自动生效 |
| **使用场景** | 项目快照、隔离环境 | 长期维护、频繁更新 |
| **符号链接支持** | ✅ 有条件支持* | ✅ 完全支持 |
| **项目级限制** | ✅ 支持 | ❌ 不支持（防止团队断链接） |

*: 符号链接模式仅在全局安装 (`-g`) 时启用，项目级安装自动降级为复制模式

### 6.6 认证优先级（四层）

1. **CLI 参数** — `--token <value>` 或 `--ssh`
2. **环境变量** — `AIFORGE_TOKEN`、`GITLAB_TOKEN`、`GIT_TOKEN`
3. **配置文件** — `~/.aiforge/config.json` 中的 `auth` 字段
4. **系统凭据** — macOS Keychain 或 Windows 凭据管理器（由 git 自动调用）

---

## 附录：技术栈

| 技术 | 用途 |
|------|------|
| **Node.js (ESM)** | 运行时 |
| **commander** | CLI 参数解析 |
| **chalk** | 终端彩色输出 |
| **ora** | Spinner 动画 |
| **@inquirer/prompts** | 交互式提示 |
| **simple-git** | Git 操作封装 |
| **TypeScript** | 类型安全开发 |
| **vitest** | 单元测试 |

---

## 文档生成信息

**收集时间**: 2026-04-07  
**收集工具**: Claude Code + Manual Inspection  
**源文件**:
- `/package.json` - 元数据和依赖
- `/src/index.ts` - CLI 入口和主命令定义
- `/src/commands/init.ts` - init 子命令实现
- `/src/data/install-rules.ts` - 内置规则表（16 条）
- `/src/data/tool-registry.ts` - 工具检测注册表
- `/src/core/types.ts` - 核心数据结构定义
- `/README.md` - 用户文档（现有）
- `/_bmad-output/planning-artifacts/product-brief-ai-forge-2026-03-11.md` - 产品定位
- `/_bmad-output/planning-artifacts/prd.md` - 完整产品需求文档

