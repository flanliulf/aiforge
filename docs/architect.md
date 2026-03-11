# aiforge 架构设计文档（ADD）

---

## 文档信息

| 字段 | 值 |
|------|-----|
| 产品名称 | aiforge |
| 文档类型 | Architecture Design Document (ADD) |
| 版本 | v0.1.0 |
| 作者 | chunxiao |
| 状态 | 草稿 |

---

## 目录

1. [架构概览](#1-架构概览)
2. [设计约束](#2-设计约束)
3. [系统上下文](#3-系统上下文)
4. [模块分解](#4-模块分解)
5. [核心数据模型](#5-核心数据模型)
6. [执行流程](#6-执行流程)
7. [模块详细设计](#7-模块详细设计)
8. [错误处理策略](#8-错误处理策略)
9. [跨平台适配](#9-跨平台适配)
10. [依赖管理](#10-依赖管理)
11. [目录结构](#11-目录结构)
12. [可扩展性机制](#12-可扩展性机制)
13. [测试策略](#13-测试策略)

---

## 1. 架构概览

### 1.1 架构风格

aiforge 采用 **管道—过滤器（Pipeline）架构**，将整个安装过程分解为有序的阶段，每个阶段由一个独立模块负责，数据沿管道从上游流向下游：

```
输入               管道阶段                                     输出
─────   ─────────────────────────────────────────────────   ─────
CLI     → 参数解析 → 仓库解析 → 认证解析 → 克隆/更新            磁盘
args       │          │          │         │                  文件
           ▼          ▼          ▼         ▼                  变更
        → 工具检测 → 规则匹配 → 执行安装 → 结果汇总
           │          │          │         │
           ▼          ▼          ▼         ▼
```

### 1.2 架构决策摘要

| 决策 | 选择 | 理由 |
|------|------|------|
| 运行形态 | CLI 工具（npx） | 零安装门槛，跨团队共享 |
| 语言 | Node.js (ESM) | npm 生态天然支持 npx，跨平台 |
| 工具与知识解耦 | 两个独立仓库 | 工具（公网 npm）与知识（私有 Git）各自迭代 |
| 配置驱动安装 | 内置静态规则映射表 | 新增工具只改配置，不改引擎 |
| 认证方式 | 多源分层解析 | 兼顾安全性与易用性 |

### 1.3 质量属性优先级

```
可维护性 > 易用性 > 可扩展性 > 性能 > 安全性
    │         │         │         │       │
    │         │         │         │       └─ Token 不落盘到仓库
    │         │         │         └─ 浅克隆 + 并行无必要（IO 绑定）
    │         │         └─ 新增工具只改 config.js
    │         └─ 零配置首次可用、友好错误提示
    └─ 模块单一职责、显式数据流
```

---

## 2. 设计约束

### 2.1 硬约束

| 约束 | 来源 | 影响 |
|------|------|------|
| npm 包不含公司信息 | 安全策略 | 仓库 URL、Token、域名不能出现在源码中 |
| 私有仓库需认证 | 公司 GitLab | 必须支持多种认证方式 |
| Node.js >= 18 | npx 和 ESM 要求 | 不考虑 CJS fallback |
| Git >= 2.20 | shallow clone 依赖 | 不考虑极老版本 Git |

### 2.2 软约束

| 约束 | 说明 |
|------|------|
| macOS 优先 | 公司主力开发平台，Linux 次之，Windows 为 P2 |
| 中文 CLI 输出 | 匹配目标用户群体 |
| 零全局安装 | 通过 `npx` 运行，不要求用户 `npm install -g` |

---

## 3. 系统上下文

### 3.1 上下文图（C4 Level 1）

```
┌─────────────────────────────────────────────────────────────────────┐
│                          外部环境                                    │
│                                                                     │
│  ┌──────────┐                                     ┌──────────────┐  │
│  │ 开发者    │──── npx aiforge [args] ───────────→│   aiforge    │  │
│  │ (人)      │                                    │   (CLI)      │  │
│  │          │←── 安装结果汇总 ──────────────────── │              │  │
│  └──────────┘                                     └──────┬───────┘  │
│                                                          │          │
│                    ┌─────────────────────────────────────┐│          │
│                    │                                     ││          │
│              ┌─────▼──────┐   ┌──────────────┐   ┌──────▼───────┐  │
│              │ 知识仓库     │   │ 本地文件系统  │   │ AI 工具      │  │
│              │ (Git 远程)  │   │              │   │ (Copilot等)  │  │
│              │             │   │ ~/.aiforge/  │   │              │  │
│              │ aicoding-   │   │ ~/.copilot/  │   │ 读取安装后   │  │
│              │ base        │   │ ~/.claude/   │   │ 的配置文件   │  │
│              │             │   │ ~/.cursor/   │   │              │  │
│              └─────────────┘   └──────────────┘   └──────────────┘  │
│                                                                     │
│              ┌──────────────┐   ┌──────────────┐                    │
│              │ Git CLI      │   │ npm registry │                    │
│              │ (系统依赖)    │   │ (分发渠道)    │                    │
│              └──────────────┘   └──────────────┘                    │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 交互关系

| 外部实体 | 交互方式 | 方向 | 数据 |
|---------|---------|------|------|
| 开发者 | CLI 命令 | → aiforge | 参数、选项 |
| 开发者 | 终端输出 | ← aiforge | 进度、结果、错误 |
| 开发者 | 交互式提示 | ↔ aiforge | init 配置问答 |
| 知识仓库 | Git 协议 (SSH/HTTPS) | → aiforge | 仓库文件内容 |
| 本地文件系统 | fs 读写 | ↔ aiforge | 配置文件、安装目标 |
| Git CLI | 子进程调用 | → Git | clone/pull 命令 |
| AI 工具 | 无直接交互 | — | AI 工具独立读取安装后的文件 |

---

## 4. 模块分解

### 4.1 模块架构图（C4 Level 2）

```
┌─────────────────────────────────────────────────────────────────┐
│                         aiforge                                  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                    bin/aiforge.js                         │    │
│  │                    (CLI 入口层)                            │    │
│  │                                                          │    │
│  │  ● 定义命令和选项                                          │    │
│  │  ● 解析 CLI 参数                                          │    │
│  │  ● 分发到对应处理函数                                      │    │
│  │  ● 顶层错误捕获和退出码                                    │    │
│  └─────────────────────────┬────────────────────────────────┘    │
│                            │ 调用                                │
│  ┌─────────────────────────▼────────────────────────────────┐    │
│  │                  src/installer.js                         │    │
│  │                  (安装引擎 — 核心协调器)                     │    │
│  │                                                          │    │
│  │  ● 协调整个安装流程                                        │    │
│  │  ● 调用其他模块完成各阶段任务                                │    │
│  │  ● 汇总安装结果                                            │    │
│  └────┬──────────┬──────────┬──────────┬──────────┬─────────┘    │
│       │          │          │          │          │               │
│  ┌────▼───┐ ┌────▼───┐ ┌───▼────┐ ┌───▼────┐ ┌──▼───────┐      │
│  │auth.js │ │clone.js│ │detect  │ │config  │ │utils.js  │      │
│  │        │ │        │ │.js     │ │.js     │ │          │      │
│  │认证管理 │ │仓库克隆 │ │工具检测│ │规则映射 │ │文件操作  │      │
│  └────────┘ └────────┘ └────────┘ └────────┘ └──────────┘      │
│                                                                  │
│  模块间依赖方向: installer → [auth, clone, detect, config, utils] │
│                  clone → auth                                    │
│                  其他模块之间无依赖                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 模块职责矩阵

| 模块 | 职责 | 输入 | 输出 | 依赖 | 被依赖 |
|------|------|------|------|------|--------|
| `bin/aiforge.js` | CLI 入口，命令定义与参数解析 | `process.argv` | 调用处理函数 | installer, auth | — |
| `src/installer.js` | 安装流程协调 | 解析后的参数对象 | 安装结果列表 | auth, clone, detect, config, utils | aiforge.js |
| `src/auth.js` | 认证信息解析、配置文件读写、交互式初始化 | CLI 参数、环境变量、配置文件 | 认证信息对象 | — | installer, clone, aiforge.js |
| `src/clone.js` | Git 仓库克隆、更新、URL 变换 | 仓库 URL、认证信息 | 本地仓库目录路径 | auth | installer |
| `src/detect.js` | AI 工具自动检测、交互式选择 | 项目根目录、安装范围 | 工具 ID 列表 | config | installer |
| `src/config.js` | 工具定义、安装规则映射表、常量 | 无（纯静态数据） | 工具配置、规则列表 | — | installer, detect |
| `src/utils.js` | 文件扫描、复制、符号链接、备份、路径处理 | 源路径、目标路径、安装规则 | 操作结果 | — | installer |

### 4.3 模块依赖图

```
bin/aiforge.js
  │
  ├──→ src/installer.js  (主命令)
  │      ├──→ src/auth.js
  │      ├──→ src/clone.js
  │      │      └──→ src/auth.js
  │      ├──→ src/detect.js
  │      │      └──→ src/config.js
  │      ├──→ src/config.js
  │      └──→ src/utils.js
  │
  └──→ src/auth.js       (init 子命令)

依赖规则:
  ● 依赖方向单向：上层 → 下层，不允许循环
  ● config.js 为纯数据层，不依赖任何模块
  ● utils.js 为纯工具层，不依赖业务模块
  ● auth.js 独立于业务逻辑，可被多处引用
```

---

## 5. 核心数据模型

### 5.1 类型定义

```typescript
// ═══ 认证 ═══

interface AuthInfo {
  method: 'ssh' | 'token' | 'credential-manager';
  token?: string;         // method=token 时存在
  source?: 'cli' | 'env' | 'config';  // 信息来源（用于日志）
}

// ═══ 用户配置 ═══

interface UserConfig {
  defaultRepo?: string;   // 默认仓库 URL
  preferSSH?: boolean;    // 全局 SSH 偏好
  cloneDir?: string;      // 持久化克隆路径，支持 ~ 展开
  auth?: {                // 按 host 存储
    [host: string]: {
      method: 'token' | 'ssh';
      token?: string;
    };
  };
}

// ═══ 工具定义 ═══

interface ToolDefinition {
  name: string;           // 人类可读名称
  detect: {
    global: string[];     // 全局级别的探测路径列表
    project: string[];    // 项目级别的探测路径列表
  };
}

// ═══ 安装规则 ═══

interface InstallRule {
  tool: string;           // 目标工具 ID（TOOLS 的 key）
  scope: 'global' | 'project';
  sourceDir: string;      // 源仓库中的顶层目录
  type: 'files' | 'directories' | 'flatten';

  // 文件过滤（三者互斥，按优先级: include > match > exclude）
  include?: string[];     // 白名单文件名
  match?: RegExp;         // 正则匹配文件名
  exclude?: string[];     // 黑名单文件名

  mainFile?: string;      // type=flatten 时，子目录中的主文件名

  targetDir: string;      // 目标目录
                          //   以 ~ 开头：全局绝对路径
                          //   否则：相对于项目根目录

  desc: string;           // 人类可读描述（用于日志输出）
}

// ═══ 安装结果 ═══

interface InstallResult {
  rule: InstallRule;        // 触发此操作的规则
  sourcePath: string;       // 源文件/目录的完整路径
  targetPath: string;       // 目标文件/目录的完整路径
  action: 'copy' | 'symlink';
  status: 'created' | 'updated' | 'skipped' | 'failed';
  backupPath?: string;      // 若备份了旧文件
  error?: string;           // 若失败
}

// ═══ 克隆结果 ═══

interface CloneResult {
  repoDir: string;          // 本地仓库目录完整路径
  persistent: boolean;      // 是否持久化（true: 符号链接模式）
}

// ═══ 安装汇总 ═══

interface InstallSummary {
  repoUrl: string;
  repoDir: string;
  persistent: boolean;
  scope: 'global' | 'project';
  mode: 'copy' | 'symlink';
  tools: string[];          // 安装涉及的工具 ID 列表
  results: InstallResult[];
  counts: {
    created: number;
    updated: number;
    skipped: number;
    failed: number;
  };
}
```

### 5.2 数据流图

```
                     CLI args
                        │
                        ▼
              ┌─────────────────┐
              │  ParsedOptions  │
              │  {              │
              │    repo?,       │
              │    global,      │
              │    tools?,      │
              │    dirs?,       │
              │    link,        │
              │    ssh,         │
              │    token?,      │
              │    force,       │
              │    dryRun       │
              │  }              │
              └────────┬────────┘
                       │
          ┌────────────┼─────────────┐
          ▼            ▼             ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │ repoUrl  │ │ AuthInfo │ │UserConfig│
    │ (string) │ │          │ │          │
    └─────┬────┘ └─────┬────┘ └──────────┘
          │            │
          └─────┬──────┘
                ▼
         ┌─────────────┐
         │ CloneResult  │
         │ { repoDir,   │
         │   persistent }│
         └──────┬───────┘
                │
       ┌────────┼────────┐
       ▼        ▼        ▼
  ┌────────┐ ┌───────┐ ┌──────────────┐
  │ToolID[]│ │Rules[]│ │SourceFiles[] │
  └───┬────┘ └───┬───┘ └──────┬───────┘
      │          │             │
      └────┬─────┘             │
           ▼                   │
    ┌──────────────┐           │
    │ FilteredRules │───────────┘
    │ (matched)    │
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │InstallResult[]│
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │InstallSummary │  →  终端输出
    └──────────────┘
```

---

## 6. 执行流程

### 6.1 主命令流程（`npx aiforge [repo] [options]`）

```
START
  │
  ▼
┌──────────────────────────────────────────────────┐
│ Phase 1: 参数解析                                  │
│                                                   │
│ 输入: process.argv                                │
│ 输出: ParsedOptions                               │
│ 模块: bin/aiforge.js                              │
│                                                   │
│ 逻辑:                                             │
│   ● 解析命令名、arguments、options                  │
│   ● 无效参数 → 打印 help → exit(1)                 │
└───────────────────────┬──────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ Phase 2: 仓库 URL 解析                             │
│                                                   │
│ 输入: repo argument (可能为空)                     │
│ 输出: repoUrl (string)                            │
│ 模块: clone.js → resolveRepoUrl()                 │
│                                                   │
│ 逻辑:                                             │
│   ● 有参数 → 标准化（GitHub 简写展开等）             │
│   ● 无参数 → 读 config.json → defaultRepo          │
│   ● 都没有 → 抛错并提示执行 aiforge init            │
└───────────────────────┬──────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ Phase 3: 认证解析                                  │
│                                                   │
│ 输入: repoUrl, ParsedOptions, 环境变量, config     │
│ 输出: AuthInfo                                    │
│ 模块: auth.js → resolveAuth()                     │
│                                                   │
│ 优先级链:                                          │
│   CLI --token/--ssh                               │
│     → ENV: AIFORGE_TOKEN / GITLAB_TOKEN            │
│       → config.json auth.<host>                   │
│         → config.json preferSSH                   │
│           → credential-manager (fallback)          │
└───────────────────────┬──────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ Phase 4: 仓库克隆/更新                             │
│                                                   │
│ 输入: repoUrl, AuthInfo, persistDir               │
│ 输出: CloneResult { repoDir, persistent }         │
│ 模块: clone.js → cloneRepo()                      │
│                                                   │
│ 分支:                                             │
│   useSymlink=true?                                │
│     ├─ YES → persistDir 存在?                     │
│     │         ├─ .git 存在 → git pull              │
│     │         └─ 不存在    → git clone 到 persist   │
│     └─ NO  → git clone 到 /tmp/aiforge-xxx        │
│                                                   │
│ 安全处理:                                          │
│   ● Token 注入 URL 仅传给 git clone                │
│   ● 克隆后 remote URL 恢复为无 Token 版本            │
└───────────────────────┬──────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ Phase 5: 项目根目录定位                             │
│                                                   │
│ 输入: 当前工作目录                                  │
│ 输出: projectRoot (string)                        │
│ 模块: installer.js → findProjectRoot()            │
│                                                   │
│ 逻辑:                                             │
│   ● 向上查找 .git / package.json / pom.xml 等      │
│   ● 找不到 → 使用 cwd                              │
│   ● isGlobal=true 时此步骤可跳过                     │
└───────────────────────┬──────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ Phase 6: AI 工具检测                               │
│                                                   │
│ 输入: projectRoot, scope, userTools(可选)          │
│ 输出: ToolID[] (如 ['copilot', 'claude'])          │
│ 模块: detect.js → detectTools()                   │
│                                                   │
│ 分支:                                             │
│   --tools 参数存在?                                │
│     ├─ YES → 校验工具 ID 合法性 → 直接返回           │
│     └─ NO  → 扫描各工具的探测路径                    │
│               → 至少检测到一个 → 返回列表             │
│               → 一个没检测到 → 交互式让用户勾选        │
└───────────────────────┬──────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ Phase 7: 规则匹配与过滤                             │
│                                                   │
│ 输入: ToolID[], scope, userDirs(可选), repoDir     │
│ 输出: FilteredRule[] (InstallRule 子集)             │
│ 模块: installer.js → filterRules()                │
│                                                   │
│ 过滤条件:                                          │
│   rule.scope === scope                            │
│   AND rule.tool IN detectedTools                  │
│   AND (userDirs 为空 OR rule.sourceDir IN userDirs) │
│   AND repoDir/rule.sourceDir 目录存在               │
└───────────────────────┬──────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ Phase 8: 规则执行                                  │
│                                                   │
│ 输入: FilteredRule[], repoDir, projectRoot, opts  │
│ 输出: InstallResult[]                             │
│ 模块: installer.js → executeRule()                │
│       utils.js → scanFiles/copyFile/symlinkFile   │
│                                                   │
│ 对每条规则:                                        │
│   1. 解析 targetDir（展开 ~ / 拼接 projectRoot）    │
│   2. 确保 targetDir 存在                           │
│   3. 扫描源文件/目录（按 type、include/match/exclude）│
│   4. 对每个源文件:                                  │
│      ├─ dryRun  → 记录但不写入                      │
│      ├─ 目标存在 → 备份（除非 --force）              │
│      ├─ link模式 → 创建符号链接                      │
│      └─ copy模式 → 复制文件/目录                     │
│   5. 收集 InstallResult                           │
└───────────────────────┬──────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ Phase 9: 结果汇总与输出                             │
│                                                   │
│ 输入: InstallResult[]                             │
│ 输出: 终端格式化输出                                │
│ 模块: installer.js → printSummary()               │
│                                                   │
│ 输出内容:                                          │
│   ● 按工具分组的操作列表                             │
│   ● 统计数字（created/updated/skipped/failed）      │
│   ● .gitignore 建议（项目级安装时）                   │
│   ● 后续操作提示                                    │
└───────────────────────┬──────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ Phase 10: 清理                                    │
│                                                   │
│ 输入: CloneResult.persistent                      │
│ 模块: clone.js → cleanupTemp()                    │
│                                                   │
│ 逻辑:                                             │
│   persistent=false → 删除临时克隆目录                │
│   persistent=true  → 保留持久化目录                  │
└──────────────────────────────────────────────────┘
  │
  ▼
 END
```

### 6.2 Init 命令流程

```
npx aiforge init
       │
       ▼
  加载现有 config.json（如有）
       │
       ▼
  交互式问答:
    Q1: 默认仓库 URL
    Q2: 认证方式（SSH / Token / 凭据管理器）
    Q3: Token 值（Q2=Token 时）
    Q4: 持久化克隆路径
       │
       ▼
  组装 UserConfig 对象
       │
       ▼
  保存到 ~/.aiforge/config.json
       │
       ▼
  验证 Git 连接（git ls-remote）
       │
       ├─ 成功 → 打印 ✅
       └─ 失败 → 打印 ⚠️ 提示重试
```

### 6.3 Update 命令流程

```
npx aiforge update
       │
       ▼
  读取 config.json → cloneDir
  或 --clone-dir 参数
       │
       ├─ 无目录 → 报错
       │
       ▼
  更新前安全检查（preflight）:
    ● 验证本地仓库完整性（.git 目录存在且有效）
    ● 检查是否有未提交的本地修改（防止冲突）
    ● 验证 remote URL 未被篡改
       │
       ▼
  cd <cloneDir> && git pull
       │
       ├─ 成功 → 更新后验证:
       │         ● 检查是否存在降级（新版本号 < 旧版本号）
       │         ● 验证关键文件完整性
       │         ● 输出变更摘要
       │         → ✅ 更新完成
       └─ 失败 → 打印错误 + 修复建议
```

> 更新 preflight 来源于混沌工程攻击向量 #6 的安全评估。当前 MVP 阶段实现基础检查（.git 有效性 + 本地修改检测），降级检测和完整性验证作为 P2 增强。

---

## 7. 模块详细设计

### 7.1 `src/config.js` — 工具定义与规则映射

**设计原则：纯数据模块，零副作用，零外部依赖。**

```
导出内容:
  ● TOOLS: Record<string, ToolDefinition>        工具注册表
  ● INSTALL_RULES: InstallRule[]                 安装规则列表
  ● ALL_SOURCE_DIRS: string[]                    知识仓库约定的源目录名
  ● GLOBAL_EXCLUDES: string[]                    全局排除文件列表
  ● getToolById(id): ToolDefinition | undefined
  ● getRulesForTool(toolId, scope): InstallRule[]
  ● printToolOverview(): void                    list 命令使用
```

**工具注册表结构：**

```javascript
const TOOLS = {
  copilot: {
    name: 'GitHub Copilot',
    detect: {
      global: ['~/.copilot'],
      project: ['.github'],
    },
  },
  claude: {
    name: 'Claude Code',
    detect: {
      global: ['~/.claude'],
      project: ['.claude'],
    },
  },
  cursor: {
    name: 'Cursor',
    detect: {
      global: ['~/.cursor'],
      project: ['.cursor', '.cursorrules'],
    },
  },
  vscode: {
    name: 'VS Code',
    detect: {
      global: [/* 跨平台路径 */],
      project: ['.vscode'],
    },
  },
  windsurf: {
    name: 'Windsurf',
    detect: {
      global: [],
      project: ['.windsurf', '.windsurfrules'],
    },
  },
};
```

**规则定义的 type 语义：**

```
type: 'files'
  扫描 sourceDir/ 下的直接子文件
  按 include/match/exclude 过滤
  逐文件复制/链接到 targetDir/

type: 'directories'
  扫描 sourceDir/ 下的直接子目录
  排除 GLOBAL_EXCLUDES 中的项
  整目录复制/链接到 targetDir/

type: 'flatten'
  扫描 sourceDir/ 下的直接子目录
  从每个子目录中提取 mainFile
  以子目录名重命名后复制/链接到 targetDir/
  例: skills/tapd/skill.md → targetDir/tapd.md
```

### 7.2 `src/auth.js` — 认证与配置管理

**职责边界：**

```
┌─────────────────────────────────────────────────────────────┐
│  auth.js 的职责                                              │
│                                                             │
│  ✅ 读写 ~/.aiforge/config.json                              │
│  ✅ 多源认证解析（CLI > env > config > fallback）             │
│  ✅ URL 变换（注入 Token / 转换 SSH）                         │
│  ✅ 交互式初始化引导（init 命令实现）                          │
│  ✅ Token 脱敏显示                                           │
│  ✅ 连接验证（git ls-remote）                                │
│                                                             │
│  ❌ 不负责 git clone/pull（由 clone.js 负责）                 │
│  ❌ 不负责安装逻辑                                            │
└─────────────────────────────────────────────────────────────┘
```

**关键函数签名：**

```
loadConfig(): Promise<UserConfig>
saveConfig(config: UserConfig): Promise<void>
resolveAuth(repoUrl: string, cliOptions: object): Promise<AuthInfo>
applyAuth(repoUrl: string, auth: AuthInfo): string
runInit(): Promise<void>
```

**认证解析算法：**

```
resolveAuth(repoUrl, cliOptions):

  1. IF cliOptions.ssh     → return { method: 'ssh' }
  2. IF cliOptions.token   → return { method: 'token', token: ... }
  3. IF ENV.AIFORGE_TOKEN or ENV.GITLAB_TOKEN or ENV.GIT_TOKEN
       → return { method: 'token', token: envValue }
  4. host = extractHost(repoUrl)
     IF config.auth[host]  → return config.auth[host]
  5. IF config.preferSSH   → return { method: 'ssh' }
  6. ELSE                  → return { method: 'credential-manager' }
```

**URL 变换算法：**

```
applyAuth(repoUrl, auth):

  CASE auth.method:

    'ssh':
      https://gitlab.example.com/group/repo.git
      → git@gitlab.example.com:group/repo.git

    'token':
      https://gitlab.example.com/group/repo.git
      → https://oauth2:TOKEN@gitlab.example.com/group/repo.git

    'credential-manager':
      → 不变换，交给系统 git
```

### 7.3 `src/clone.js` — 仓库克隆与更新

**职责边界：**

```
┌─────────────────────────────────────────────────────────────┐
│  clone.js 的职责                                             │
│                                                             │
│  ✅ 解析仓库 URL（参数 > config > 报错）                      │
│  ✅ GitHub 简写标准化                                        │
│  ✅ 浅克隆仓库到指定目录                                      │
│  ✅ 持久化目录已存在时执行 git pull                            │
│  ✅ 克隆后清除 remote URL 中的 Token                          │
│  ✅ 临时目录清理                                              │
│  ✅ 友好的克隆错误提示                                        │
│                                                             │
│  ❌ 不负责认证解析（由 auth.js 提供，clone.js 只消费）          │
│  ❌ 不负责文件安装                                            │
└─────────────────────────────────────────────────────────────┘
```

**关键函数签名：**

```
resolveRepoUrl(repoInput?: string): Promise<string>
cloneRepo(repoUrl: string, persistDir?: string, cliOptions?: object): Promise<CloneResult>
cleanupTemp(dir: string): Promise<void>
inferRepoName(repoUrl: string): string
```

**克隆决策树：**

```
cloneRepo(repoUrl, persistDir, cliOptions):

  auth = resolveAuth(repoUrl, cliOptions)
  authenticatedUrl = applyAuth(repoUrl, auth)

  IF persistDir != null:                         // 符号链接模式
    targetDir = expandHome(persistDir)
    IF targetDir/.git EXISTS:                    // 已克隆过
      git pull (用 authenticatedUrl)
      恢复 remote URL 为 repoUrl（安全）
      return { repoDir: targetDir, persistent: true }
    ELSE:
      git clone authenticatedUrl → targetDir
      恢复 remote URL
      return { repoDir: targetDir, persistent: true }

  ELSE:                                          // 复制模式
    tmpDir = /tmp/aiforge-<timestamp>
    git clone authenticatedUrl → tmpDir
    return { repoDir: tmpDir, persistent: false }
```

### 7.4 `src/detect.js` — AI 工具检测

**职责边界：**

```
┌─────────────────────────────────────────────────────────────┐
│  detect.js 的职责                                            │
│                                                             │
│  ✅ 扫描文件系统探测 AI 工具是否存在                           │
│  ✅ 区分全局探测和项目探测                                    │
│  ✅ 未检测到任何工具时交互式让用户选择                          │
│  ✅ 校验用户指定的 --tools 参数合法性                          │
│                                                             │
│  ❌ 不知道安装规则的细节（只返回工具 ID 列表）                  │
│  ❌ 不负责安装                                               │
└─────────────────────────────────────────────────────────────┘
```

**关键函数签名：**

```
detectTools(projectRoot: string, scope: 'global'|'project'): Promise<string[]>
validateToolIds(ids: string[]): void   // 不合法则抛错
```

**检测算法：**

```
detectTools(projectRoot, scope):

  detected = []

  FOR each (toolId, toolDef) IN TOOLS:
    paths = scope === 'global' ? toolDef.detect.global
                               : toolDef.detect.project

    FOR each p IN paths:
      resolvedPath = (是绝对路径) ? expandHome(p)
                                 : path.join(projectRoot, p)
      IF fs.exists(resolvedPath):
        detected.push(toolId)
        BREAK  // 同一工具只要找到一个标志就够了

  IF detected.length === 0:
    // 交互式让用户从所有工具中勾选
    detected = await interactiveSelect(TOOLS)

  return detected
```

### 7.5 `src/installer.js` — 安装引擎

**核心协调器，编排整个安装流程。**

**关键函数签名：**

```
runInstall(repoInput?: string, options: ParsedOptions): Promise<void>
```

**内部函数分解：**

```
runInstall(repoInput, options)
  │
  ├── resolveRepoUrl(repoInput)           // clone.js
  ├── cloneRepo(repoUrl, persistDir, opts) // clone.js
  ├── findProjectRoot()                    // 本模块内部
  ├── detectTools(root, scope)             // detect.js
  ├── filterRules(tools, scope, dirs, repoDir) // 本模块内部
  ├── executeRules(rules, repoDir, root, opts) // 本模块内部
  │     └── executeRule(rule, ...)          // 本模块内部
  │           ├── scanSource(rule, repoDir) // utils.js
  │           └── installFile/Dir(...)       // utils.js
  ├── printSummary(results)                // 本模块内部
  └── cleanupTemp(repoDir)                // clone.js
```

**规则过滤算法：**

```
filterRules(detectedTools, scope, userDirs, repoDir):

  return INSTALL_RULES.filter(rule =>
    rule.scope === scope
    AND rule.tool IN detectedTools
    AND (userDirs is empty  OR  rule.sourceDir IN userDirs)
    AND fs.existsSync(path.join(repoDir, rule.sourceDir))
  )
```

**规则执行调度：**

```
executeRule(rule, repoDir, projectRoot, options):

  sourceBase = path.join(repoDir, rule.sourceDir)
  targetBase = resolveTargetDir(rule.targetDir, projectRoot)
  ensureDir(targetBase)

  results = []

  SWITCH rule.type:

    CASE 'files':
      files = listFiles(sourceBase)
      files = applyFilter(files, rule.include, rule.match, rule.exclude)
      files = removeGlobalExcludes(files)
      FOR each file IN files:
        result = installSingleFile(
          path.join(sourceBase, file),
          path.join(targetBase, file),
          options
        )
        results.push(result)

    CASE 'directories':
      dirs = listDirectories(sourceBase)
      FOR each dir IN dirs:
        result = installDirectory(
          path.join(sourceBase, dir),
          path.join(targetBase, dir),
          options
        )
        results.push(result)

    CASE 'flatten':
      dirs = listDirectories(sourceBase)
      FOR each dir IN dirs:
        mainFilePath = path.join(sourceBase, dir, rule.mainFile)
        IF NOT exists(mainFilePath): SKIP
        flatName = dir + path.extname(rule.mainFile)
        result = installSingleFile(
          mainFilePath,
          path.join(targetBase, flatName),
          options
        )
        results.push(result)

  return results
```

### 7.6 `src/utils.js` — 文件操作工具

**设计原则：无业务逻辑，纯文件系统操作封装。**

**关键函数签名：**

```
// 扫描
listFiles(dir: string): string[]
listDirectories(dir: string): string[]

// 过滤
applyFilter(
  files: string[],
  include?: string[],
  match?: RegExp,
  exclude?: string[]
): string[]

// 安装操作
copyFile(src: string, dest: string): Promise<void>
copyDirectory(src: string, dest: string): Promise<void>
createSymlink(src: string, dest: string): Promise<void>

// 冲突处理
backupIfExists(targetPath: string): Promise<string | null>  // 返回备份路径
removeExisting(targetPath: string): Promise<void>

// 路径工具
expandHome(p: string): string        // ~/xxx → /Users/xxx/xxx
findProjectRoot(cwd?: string): string
```

**符号链接创建逻辑：**

```
createSymlink(src, dest):

  IF dest already exists:
    IF dest is symlink AND readlink(dest) === src:
      return 'skipped'    // 已是正确的链接，无需操作
    ELSE:
      backup or remove dest

  ensureDir(dirname(dest))
  fs.symlink(src, dest)    // 使用相对路径还是绝对路径？见 ADR-006
```

---

## 8. 错误处理策略

### 8.1 错误分类

```
┌─────────────────────────────────────────────────────────────┐
│                       错误类型层次                            │
│                                                             │
│  ┌─────────────────────────────────────────────┐            │
│  │ 用户错误（可修复，给出操作建议）                 │            │
│  │                                             │            │
│  │  ● 未指定仓库且未配置 defaultRepo             │            │
│  │  ● 无效的工具 ID（--tools xxx）               │            │
│  │  ● 仓库 URL 格式错误                         │            │
│  │  ● 认证失败（Token 错误/过期/SSH Key 未配置） │            │
│  └─────────────────────────────────────────────┘            │
│                                                             │
│  ┌─────────────────────────────────────────────┐            │
│  │ 环境错误（用户需修复环境）                      │            │
│  │                                             │            │
│  │  ● Git 未安装                                │            │
│  │  ● Node.js 版本过低                          │            │
│  │  ● 网络不可达（Host 解析失败、VPN 未连接）     │            │
│  │  ● 目标目录无写入权限                         │            │
│  │  ● Windows 符号链接权限不足                   │            │
│  └─────────────────────────────────────────────┘            │
│                                                             │
│  ┌─────────────────────────────────────────────┐            │
│  │ 程序错误（Bug，需开发者修复）                   │            │
│  │                                             │            │
│  │  ● 未预期的异常                               │            │
│  │  ● 规则配置错误                               │            │
│  └─────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 错误处理原则

| 原则 | 说明 |
|------|------|
| **早失败** | 参数校验在流程最前端完成 |
| **不留残余** | 安装中途失败时清理已创建的临时文件 |
| **友好提示** | 每个错误附带「如何修复」的建议 |
| **不吞异常** | 所有 catch 块都有处理逻辑，不空 catch |
| **调试模式** | `DEBUG=1` 时打印完整 stack trace |
| **fail-fast 策略** | 某个文件安装失败时立即终止后续安装（大部分失败原因如磁盘满、权限不足不是偶发的，继续尝试大概率也会失败）。输出已完成的安装清单和失败原因，建议用户修复后重新运行 |

### 8.3 关键错误场景与处理

```
场景: 认证失败 (401/403)
处理:
  ● 捕获 git clone 错误
  ● 判断错误信息是否含 Authentication/401/403
  ● 输出:
    "认证失败，无法访问 <url>
     请尝试以下方法：
       1. 使用 SSH：npx aiforge <url> --ssh
       2. 使用 Token：npx aiforge <url> --token <your-token>
       3. 设置环境变量：export GITLAB_TOKEN=<your-token>
       4. 运行 npx aiforge init 配置认证"

场景: Host 不可达
处理:
  ● 判断错误信息是否含 Could not resolve host
  ● 输出:
    "无法解析主机名（可能不在公司内网）: <url>
     请检查网络连接或 VPN 状态。"

场景: 仓库不存在
处理:
  ● 判断错误信息是否含 not found / 404
  ● 输出:
    "仓库不存在或无权访问: <url>
     请检查 URL 是否正确，以及是否有仓库读取权限。"

场景: 某文件安装失败
处理:
  ● 记录该 InstallResult.status = 'failed'
  ● 记录 error message
  ● 立即终止后续文件安装（fail-fast）
  ● 输出已完成的安装清单和失败原因
  ● 建议用户修复后重新运行

场景: 零结果（检测到 0 个匹配目录）
处理:
  ● 检测到 DETECTION_PATTERNS 匹配结果为空
  ● 输出诊断信息:
    "未检测到任何可安装的资源目录。
     诊断信息：
       扫描路径: <cloneDir>
       扫描到的目录: docs/, src/, tests/, ...
       匹配模式: agents?$, skills?$, instructions?$, mcp[-_]?tools?$
       匹配结果: 无
     可能原因：
       1. 仓库不是 aiforge 知识仓库（缺少 agents/skills 等目录）
       2. 目录命名不符合约定（请参考文档）
       3. 需要在仓库中添加 aiforge.json 显式声明目录映射
     建议：
       ● 运行 npx aiforge --dry-run 查看详细检测过程
       ● 检查仓库目录结构是否符合 aiforge 约定"
  ● 退出码: 1（非零，表示未完成安装）
```

> 零结果诊断机制来源于混沌工程攻击向量 #1 的核心洞察：静默失败是最危险的失败模式，用户误以为安装成功但实际上什么都没发生。

---

## 9. 跨平台适配

### 9.1 路径差异处理

```javascript
// config.js 中的跨平台路径解析

import os from 'os';
import path from 'path';

const HOME = os.homedir();
const PLATFORM = process.platform;

// VS Code 用户目录
function getVSCodeUserDir() {
  switch (PLATFORM) {
    case 'darwin':
      return path.join(HOME, 'Library', 'Application Support', 'Code', 'User');
    case 'linux':
      return path.join(HOME, '.config', 'Code', 'User');
    case 'win32':
      return path.join(process.env.APPDATA || '', 'Code', 'User');
    default:
      return null;
  }
}
```

### 9.2 符号链接平台差异

```
┌──────────────┬──────────────────────────────────────────┐
│ 平台         │ 符号链接行为                               │
├──────────────┼──────────────────────────────────────────┤
│ macOS        │ 无需特殊权限，fs.symlink 直接可用          │
│ Linux        │ 无需特殊权限，fs.symlink 直接可用          │
│ Windows      │ 需要管理员权限或开启「开发者模式」           │
│              │ 检测失败时 fallback 到 junction（目录）     │
│              │ 或 复制模式（文件）                        │
└──────────────┴──────────────────────────────────────────┘
```

### 9.3 换行符处理

不做换行符转换。知识仓库的 `.gitattributes` 应负责统一换行符。aiforge 按原样复制。

---

## 10. 依赖管理

### 10.1 运行时依赖

| 包 | 用途 | 替代方案 | 选择理由 |
|----|------|---------|---------|
| `commander` | CLI 参数解析 | yargs, meow, arg | 社区最广泛、API 简洁 |
| `chalk` | 终端彩色输出 | kleur, picocolors | 功能完整、普及度高 |
| `ora` | Spinner 动画 | nanospinner, cli-spinners | API 简洁、视觉效果好 |
| `inquirer` | 交互式提示 | prompts, enquirer | 功能最完整、问题类型丰富 |
| `simple-git` | Git 操作封装 | isomorphic-git, 直接 exec | 轻量 wrapper，不需要完整 git 实现 |
| `fs-extra` | 增强文件操作 | 原生 fs/promises | ensureDir、copy 等高频操作更简洁 |
| `keytar` | 系统密钥链存储（可选依赖） | 文件存储 fallback | Token 安全存储，系统密钥链不可用时自动降级到文件存储 |

> `keytar` 作为可选依赖（optionalDependencies），是依赖最小化原则的特例。理由：Token 安全存储是认证系统的核心需求（参见混沌工程攻击向量 #3），系统密钥链是唯一能防止 Token 明文落盘的方案。当 keytar 原生编译失败时（如缺少编译工具链），自动 fallback 到 `~/.aiforge/config.json` 文件存储 + `chmod 600` 权限保护。

### 10.2 依赖最小化原则

```
原则:
  ● 优先使用 Node.js 内置模块（fs, path, os, url, child_process）
  ● 第三方依赖只用于「自行实现成本远高于引入成本」的功能
  ● 不引入大型框架（如 oclif、ink）
  ● 所有依赖的总安装大小控制在 10MB 以内

当前依赖树大小估算:
  commander    ~100KB
  chalk        ~40KB
  ora          ~50KB
  inquirer     ~1MB
  simple-git   ~200KB
  fs-extra     ~60KB
  ──────────────────
  合计         ~1.5MB (不含 node_modules 子依赖)
```

### 10.3 开发依赖

| 包 | 用途 |
|----|------|
| `vitest` | 单元测试框架 |
| `memfs` | 内存文件系统 mock（测试用） |
| `eslint` | 代码规范检查 |
| `prettier` | 代码格式化 |

---

## 11. 目录结构

```
aiforge/
├── package.json               # 项目配置
├── README.md                  # 用户文档（npm 首页展示）
├── LICENSE                    # MIT License
├── .gitignore
├── .eslintrc.json
├── .prettierrc
│
├── bin/
│   └── aiforge.js             # CLI 入口（#!/usr/bin/env node）
│
├── src/
│   ├── auth.js                # 认证与配置管理
│   ├── clone.js               # Git 仓库克隆/更新
│   ├── config.js              # 工具定义 + 安装规则映射表
│   ├── detect.js              # AI 工具检测
│   ├── installer.js           # 安装引擎（核心协调器）
│   └── utils.js               # 文件操作工具
│
├── test/
│   ├── auth.test.js
│   ├── clone.test.js
│   ├── config.test.js
│   ├── detect.test.js
│   ├── installer.test.js
│   ├── utils.test.js
│   └── fixtures/              # 测试用模拟仓库目录
│       └── mock-repo/
│           ├── agents/
│           │   └── test.agent.md
│           ├── skills/
│           │   └── test-skill/
│           │       └── skill.md
│           ├── instructions/
│           │   └── copilot-instructions.md
│           └── mcp-tools/
│               └── mcp.json
│
└── docs/
    ├── PRD.md                 # 产品需求文档
    ├── ADD.md                 # 架构设计文档（本文档）
    └── ADR/                   # 架构决策记录
        ├── ADR-001-tool-knowledge-separation.md
        ├── ADR-002-esm-module-system.md
        └── ...
```

**`package.json` 关键字段：**

```jsonc
{
  "name": "aiforge",
  "version": "0.1.0",
  "description": "Install AI coding configurations from any Git repo to Copilot / Claude / Cursor and more",
  "type": "module",            // ESM
  "bin": {
    "aiforge": "./bin/aiforge.js"
  },
  "files": [                   // 发布到 npm 的白名单
    "bin/",
    "src/",
    "README.md",
    "LICENSE"
  ],
  "engines": {
    "node": ">=18.0.0"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src/ bin/",
    "format": "prettier --write src/ bin/"
  },
  "keywords": ["ai", "copilot", "claude", "cursor", "coding", "cli"],
  "license": "MIT"
}
```

---

## 12. 可扩展性机制

### 12.1 新增 AI 工具的扩展点

```
所需改动范围: 仅 src/config.js

步骤:
  1. 在 TOOLS 对象中注册新工具
  2. 在 INSTALL_RULES 数组中添加对应规则

不需要改动: installer.js, detect.js, utils.js, clone.js, auth.js
```

**示例：新增 Zed 编辑器支持**

```javascript
// config.js 中添加

// 1. 注册工具
TOOLS.zed = {
  name: 'Zed',
  detect: {
    global: [path.join(HOME, '.config', 'zed')],
    project: ['.zed'],
  },
};

// 2. 添加规则
INSTALL_RULES.push(
  {
    tool: 'zed',
    scope: 'project',
    sourceDir: 'skills',
    type: 'flatten',
    mainFile: 'skill.md',
    targetDir: '.zed/rules',
    desc: 'Zed 规则',
  },
);
```

### 12.2 新增安装类型的扩展点

```
所需改动: src/installer.js → executeRule() 函数的 switch 块

步骤:
  1. 定义新的 type 语义
  2. 在 switch 中添加新 case
  3. 在 utils.js 中添加所需的文件操作函数（如有）
```

### 12.3 aiforge.json 覆盖机制（P2）

```
设计思路:
  ● 知识仓库根目录的 aiforge.json 可定义「自定义规则」
  ● 自定义规则的优先级高于默认的 INSTALL_RULES
  ● 安装引擎在 Phase 7 合并两组规则

合并策略:
  ● aiforge.json 中的规则 key = tool + scope + sourceDir
  ● 若 key 已存在于 INSTALL_RULES → 用 aiforge.json 的覆盖
  ● 若 key 不存在 → 追加
```

---

## 13. 测试策略

### 13.1 测试金字塔

```
              ┌──────────┐
              │  E2E     │  1-2 个核心路径
              │  测试     │  真实 git clone + 写文件
              ├──────────┤
              │ 集成测试   │  模块间协作
              │           │  mock git，真实文件系统
              ├──────────┤
              │ 单元测试   │  每个模块独立测试
              │           │  mock 文件系统 + mock git
              └──────────┘
                 重点层
```

### 13.2 各模块测试重点

| 模块 | 测试重点 | Mock 策略 |
|------|---------|-----------|
| `config.js` | 规则数据完整性、路径正确性、工具注册 | 无需 mock（纯数据） |
| `auth.js` | 优先级链、URL 变换、Token 脱敏 | mock fs（config.json 读写） |
| `clone.js` | URL 标准化、持久化目录判断、Token 清除 | mock simple-git |
| `detect.js` | 探测逻辑、交互式 fallback | mock fs.exists |
| `installer.js` | 规则过滤、执行调度、结果汇总 | mock clone, detect, utils |
| `utils.js` | 文件扫描、复制、符号链接、备份、过滤 | mock fs 或 memfs |

### 13.3 关键测试用例

```
config.js:
  ✓ 每个 TOOLS 条目有 name 和 detect
  ✓ 每条 INSTALL_RULES 的 tool 在 TOOLS 中存在
  ✓ 每条 INSTALL_RULES 的 sourceDir 在 ALL_SOURCE_DIRS 中存在
  ✓ type=flatten 的规则必须有 mainFile
  ✓ scope=global 的规则 targetDir 以 ~ 开头

auth.js:
  ✓ CLI --token 优先于环境变量
  ✓ 环境变量优先于配置文件
  ✓ SSH 模式正确转换 URL 格式
  ✓ Token 注入 URL 后格式正确
  ✓ git@ 开头的 URL 不再做 SSH 转换
  ✓ Token 脱敏只显示前8后4位

clone.js:
  ✓ GitHub 简写 user/repo 展开为 HTTPS URL
  ✓ 持久目录已存在 .git 时执行 pull 而非 clone
  ✓ 克隆后 remote URL 不含 Token
  ✓ 临时目录在 cleanupTemp 后不存在

detect.js:
  ✓ .github 存在时检测到 copilot
  ✓ .claude 存在时检测到 claude
  ✓ 全局模式检测 ~/.copilot
  ✓ 无工具检测到时返回空数组（触发交互式 fallback）

installer.js:
  ✓ scope=global 时只匹配 global 规则
  ✓ --tools copilot 时只匹配 copilot 规则
  ✓ --dirs skills 时只匹配 sourceDir=skills 的规则
  ✓ 源目录不存在时该规则被跳过
  ✓ dryRun 模式不写入任何文件

utils.js:
  ✓ listFiles 只返回文件不返回目录
  ✓ listDirectories 只返回目录不返回文件
  ✓ include 白名单过滤正确
  ✓ exclude 黑名单过滤正确
  ✓ match 正则过滤正确
  ✓ GLOBAL_EXCLUDES 中的文件被跳过
  ✓ backupIfExists 创建 .bak 后缀的备份
  ✓ createSymlink 创建正确指向的链接
  ✓ 目标已是正确符号链接时跳过
```

---

---

# aiforge 架构决策记录（ADR）

---

## ADR-001: 工具与知识仓库分离

| 字段 | 值 |
|------|-----|
| 状态 | 已采纳 |
| 决策日期 | 2025-07 |
| 决策者 | chunxiao |

### 背景

aiforge 需要读取 AI 编码规范和配置（agents、skills、instructions 等），这些内容存储在公司内网的 `aicoding-base` Git 仓库中。需要决定这些知识内容与 aiforge CLI 工具之间的工程关系。

### 备选方案

| 方案 | 描述 |
|------|------|
| **A. 内嵌** | 将知识内容直接打包到 aiforge npm 包中 |
| **B. Git Submodule** | 在 aiforge 仓库中通过 submodule 引用知识仓库 |
| **C. npm 私有包** | 将知识内容发布为私有 npm 包，aiforge 作为依赖引入 |
| **D. 运行时克隆（选定）** | aiforge 在运行时通过 git clone 动态获取知识仓库内容 |

### 决策

**选择方案 D：运行时克隆。**

aiforge（CLI 工具）发布到公网 npm，不含任何知识内容。`aicoding-base`（知识文档）保留在公司内网 GitLab。aiforge 在执行时通过 Git 协议动态获取知识仓库内容。

### 理由

| 维度 | 方案 A (内嵌) | 方案 D (运行时克隆) |
|------|--------------|-------------------|
| 安全性 | ❌ 公司知识泄露到公网 npm | ✅ 知识仓库保持私有 |
| 迭代独立性 | ❌ 知识更新需重新发版 npm | ✅ 知识仓库独立 git push 即可 |
| 通用性 | ❌ 绑定特定公司内容 | ✅ 任何仓库都可以作为知识源 |
| 首次使用 | ✅ 离线可用 | ❌ 需要网络 + 认证 |

方案 B (Submodule) 的问题：aiforge 仓库的 `.gitmodules` 会包含内网 GitLab URL，泄露公司基础设施信息。

方案 C (npm 私有包) 的问题：需要搭建私有 npm registry 或使用 npm org，增加基础设施成本。

### 影响

- 必须实现多种私有仓库认证方案（SSH、Token、凭据管理器）
- 必须实现配置文件 (`~/.aiforge/config.json`) 来保存默认仓库和认证信息
- 首次使用需要网络连接和认证配置
- aiforge 的 npm 包内不能出现任何公司仓库 URL

### 风险

| 风险 | 缓解措施 |
|------|---------|
| 内网不可达时无法安装 | 符号链接模式下本地有持久化副本 |
| Git 认证复杂度 | 提供 4 种认证方式 + 交互式引导 |
| 首次使用门槛 | `aiforge init` 一次性配置 |

---

## ADR-002: ESM 模块系统

| 字段 | 值 |
|------|-----|
| 状态 | 已采纳 |
| 决策日期 | 2025-07 |

### 背景

Node.js 支持两种模块系统：CommonJS (CJS) 和 ECMAScript Modules (ESM)。需要为 aiforge 选择模块系统。

### 决策

**选择 ESM。** `package.json` 中设置 `"type": "module"`，所有源文件使用 `import/export` 语法。

### 理由

1. **依赖要求：** chalk v5、ora v7 等依赖已声明为 ESM-only，无法在 CJS 中 require
2. **语言方向：** ESM 是 JavaScript 的标准模块系统，CJS 是 Node.js 历史遗留
3. **Node 18+ 已足够成熟：** Top-level await、import.meta 等 ESM 特性已稳定
4. **不需要兼容旧环境：** aiforge 不作为库被其他包引用，只是 CLI 工具

### 影响

- `engines` 限制 Node.js >= 18.0.0
- 所有 `require()` 替换为 `import`
- `__dirname` 替换为 `import.meta.url` + `fileURLToPath`
- JSON 导入需使用 `fs.readJson()` 或 `import assert { type: 'json' }`

---

## ADR-003: 配置驱动的安装规则

| 字段 | 值 |
|------|-----|
| 状态 | 已采纳 |
| 决策日期 | 2025-07 |

### 背景

aiforge 需要将源仓库中的文件安装到不同 AI 工具的不同目录。需要决定这种「源 → 目标」映射关系的表达方式。

### 备选方案

| 方案 | 描述 |
|------|------|
| **A. 硬编码** | 每个工具写一个专门的安装函数，内部硬编码路径和匹配规则 |
| **B. 声明式规则表（选定）** | 定义一个静态的规则数组，安装引擎按规则通用执行 |
| **C. 外部配置文件** | 将规则定义在 YAML/JSON 外部文件中 |

### 决策

**选择方案 B：声明式规则表。**

在 `src/config.js` 中维护一个 `INSTALL_RULES` 数组，每个元素是一条安装规则对象。安装引擎 (`installer.js`) 遍历规则数组，按 `type` 字段分派执行逻辑。

### 理由

| 维度 | 方案 A (硬编码) | 方案 B (规则表) |
|------|---------------|---------------|
| 新增工具 | 写新函数 + 测试 | 添加几行规则定义 |
| 理解成本 | 需读懂每个函数 | 看规则表一目了然 |
| 一致性 | 各函数风格可能不一致 | 统一的执行引擎保证一致 |
| 可测试性 | 需要为每个函数写测试 | 规则数据可做静态校验 |

方案 C (外部配置) 的问题：增加了文件加载逻辑和版本管理复杂度，对于固定的规则集没有必要外部化。

### 示例

```javascript
// 一条规则就能表达：
// "将 agents/ 下所有 *.agent.md 文件安装到 Copilot 的全局 agents 目录"
{
  tool: 'copilot',
  scope: 'global',
  sourceDir: 'agents',
  type: 'files',
  match: /\.agent\.md$/,
  targetDir: path.join(HOME, '.copilot', 'agents'),
  desc: 'Copilot Agents',
}
```

### 影响

- `config.js` 成为「扩展 aiforge 的唯一入口」（对新增工具而言）
- 安装引擎必须足够通用，能处理 `files`、`directories`、`flatten` 三种类型
- 规则表可做编译时静态检查（确保 tool ID 存在、sourceDir 合法等）

---

## ADR-004: 多层认证解析链

| 字段 | 值 |
|------|-----|
| 状态 | 已采纳 |
| 决策日期 | 2025-07 |

### 背景

aiforge 需要从公司私有 GitLab 克隆知识仓库，该仓库要求认证。不同用户的开发环境差异大（有人配了 SSH Key，有人只有 HTTPS Token，有人已在 macOS Keychain 保存了密码）。需要一种灵活的认证策略。

### 决策

**采用分层认证解析链，按优先级逐层 fallback。**

```
CLI 参数 (--token / --ssh)        ← 优先级最高，显式指定
    ↓
环境变量 (AIFORGE_TOKEN 等)        ← CI/CD 友好
    ↓
配置文件 (~/.aiforge/config.json)  ← 持久化配置
    ↓
全局偏好 (config.preferSSH)        ← 简单的全局开关
    ↓
系统 Git 凭据管理器                 ← 兜底，不做任何处理
```

### 理由

1. **单一来源不可行**：不同环境（本地开发、CI、Docker 容器）适合不同的认证方式
2. **显式优先隐式**：CLI 参数最具体，应最优先
3. **环境变量是 CI/CD 标准**：GitLab CI、GitHub Actions 都通过环境变量传递 Secret
4. **兜底到系统凭据**：对已通过 Keychain 保存密码的用户，零配置即可用

### 安全考虑

- Token 通过 URL 注入传递给 `git clone`，clone 完成后立即从 remote URL 中移除
- 配置文件中的 Token 建议 `chmod 600`，日志输出中做脱敏处理
- 不在 aiforge 源代码中硬编码任何 Token 或仓库 URL

### 影响

- `auth.js` 需要实现完整的解析链和 URL 变换逻辑
- 需要支持交互式配置（`aiforge init`）来帮助用户完成首次设置
- 错误提示需要针对不同认证方式给出对应的修复建议

---

## ADR-005: 复制模式与符号链接模式并存

| 字段 | 值 |
|------|-----|
| 状态 | 已采纳 |
| 决策日期 | 2025-07 |

### 背景

安装文件到目标目录有两种基本方式：复制文件（cp）或创建符号链接（symlink）。现有 `setup.sh` 只支持符号链接。需要决定 aiforge 支持哪种方式。

### 决策

**两种模式并存。默认复制，`-l/--link` 切换到符号链接。**

### 理由

| 维度 | 复制模式 | 符号链接模式 |
|------|---------|------------|
| 独立性 | ✅ 不依赖源仓库持续存在 | ❌ 源目录删除则链接断裂 |
| 更新便利 | ❌ 需重新安装 | ✅ git pull 自动生效 |
| 磁盘占用 | 多份副本 | 一份 + 指针 |
| 跨平台 | ✅ 无限制 | ⚠️ Windows 需特殊权限 |
| Git 追踪 | ✅ 可提交到项目仓库 | ⚠️ 符号链接需配置 |
| 项目级适用性 | ✅ 文件属于项目 | ❌ 链接到外部仓库不合理 |
| 全局级适用性 | ⚠️ 需手动更新 | ✅ 全局长期使用 |

**推荐组合：**

- 项目安装（默认）→ 复制模式（文件属于项目）
- 全局安装 `-g -l` → 符号链接模式（长期使用，自动更新）

### 影响

- 符号链接模式需要将仓库持久化到本地（`--clone-dir`）
- 安装引擎 (`utils.js`) 需要同时实现 `copyFile/Dir` 和 `createSymlink`
- 需要处理「已存在的符号链接指向相同目标」的跳过逻辑

---

## ADR-006: 符号链接路径策略（全局绝对 / 项目相对）

| 字段 | 值 |
|------|-----|
| 状态 | 已采纳（修订） |
| 决策日期 | 2025-07（修订：2026-03） |

### 背景

创建符号链接时，`src`（链接目标）可以是绝对路径或相对路径。需要决定采用哪种方式。全局安装和项目级安装的场景不同，需要分别考虑。

### 决策

**全局安装使用绝对路径，项目级安装使用相对路径 + 自动 .gitignore。**

| 安装范围 | 符号链接路径 | 附加处理 |
|---------|------------|---------|
| 全局安装 (`-g`) | 绝对路径 | 无 |
| 项目级安装 | 相对路径 | 自动在 .gitignore 中添加忽略规则 |

### 理由

1. **全局安装**：`~/.copilot/agents` → `~/aicoding-base/agents`，两个路径在不同的目录层级，相对路径需要多层 `../` 回退，容易出错。绝对路径可读性好，`ls -la` 一目了然
2. **项目级安装**：项目目录可能被移动或在不同机器上 clone，相对路径保证链接在项目内部始终有效。自动添加 .gitignore 规则避免符号链接被 git 追踪导致团队成员出现断链接
3. **来源**：混沌工程攻击向量 #2 场景 2.5 识别了项目级符号链接被 git 追踪的风险

### 影响

- `createSymlink()` 根据安装范围选择路径策略：全局用 `path.resolve()`，项目级用 `path.relative()`
- 项目级安装时需要检测并更新 `.gitignore`
- 用户 Home 目录变更时全局链接可能断裂（极端场景，可通过重新安装修复）

---

## ADR-007: 单命令入口 + 子命令结构

| 字段 | 值 |
|------|-----|
| 状态 | 已采纳 |
| 决策日期 | 2025-07 |

### 背景

需要决定 CLI 的命令结构：是一个命令做所有事，还是分成多个子命令。

### 决策

**主命令（安装）+ 子命令（init、update、list）结构。**

```
aiforge [repo-url] [options]    ← 主命令，最常用路径
aiforge init                    ← 子命令：配置
aiforge update                  ← 子命令：更新
aiforge list                    ← 子命令：查看
```

### 理由

1. **80/20 原则**：最常用的操作（安装）不需要输入子命令名，直接 `npx aiforge` 即可
2. **渐进式学习**：新用户只需记住 `npx aiforge` 和 `npx aiforge init`，两个命令覆盖日常需求
3. **不过度设计**：当前只有 4 个操作，不需要复杂的子命令树

### 替代方案

```
# 被拒绝的方案：所有操作都是子命令
aiforge install [repo-url]     ← 比 aiforge [repo-url] 多打一个词
aiforge init
aiforge update
aiforge list
```

理由：`install` 作为默认行为，不应该要求用户显式输入。

---

## ADR-008: 全局排除列表而非 .aiforgnore

| 字段 | 值 |
|------|-----|
| 状态 | 已采纳 |
| 决策日期 | 2025-07 |

### 背景

知识仓库中某些文件不应被安装（如 README.md、.gitkeep、示例配置文件）。需要决定如何定义排除规则。

### 备选方案

| 方案 | 描述 |
|------|------|
| **A. 全局排除列表（选定）** | 在 `config.js` 中硬编码排除文件名 |
| **B. .aiforgeIgnore 文件** | 在知识仓库根目录放置忽略文件 |
| **C. 规则级 exclude** | 每条 InstallRule 单独指定 exclude |

### 决策

**方案 A + C 结合：全局排除列表 + 规则级可选 exclude。**

```javascript
// config.js
const GLOBAL_EXCLUDES = [
  'README.md', 'README', 'readme.md',
  '.gitkeep', '.DS_Store',
  'mcp.json.example',
];

// 特定规则可额外指定 exclude
{
  tool: 'copilot',
  scope: 'project',
  sourceDir: 'instructions',
  type: 'files',
  exclude: ['copilot-instructions.md', 'copilot-doc-instructions.md'],
  ...
}
```

### 理由

1. **简单直接**：需要排除的文件很少且明确，不需要 gitignore 风格的复杂匹配
2. **减少知识仓库的负担**：知识仓库维护者不需要额外维护一个 `.aiforgeIgnore` 文件
3. **可测试**：静态列表可在单元测试中直接断言

### 影响

- 新增需排除的文件模式时需修改 `config.js` 并发版
- P2 阶段的 `aiforge.json` 可提供仓库级自定义排除

---

## ADR-009: 中文 CLI 输出

| 字段 | 值 |
|------|-----|
| 状态 | 已采纳 |
| 决策日期 | 2025-07 |

### 背景

CLI 的提示信息、错误信息、帮助文本使用中文还是英文。

### 决策

**所有用户面向的输出使用中文。** 代码注释和变量名使用英文。

### 理由

1. **用户群体**：当前 100% 的目标用户是中文母语开发者
2. **降低认知负荷**：错误提示和操作指引用中文，用户能更快理解和修复问题
3. **aiforge 是内部工具**：虽然发布到公网 npm，但当前阶段的实际用户全在公司内部

### 影响

- 若未来面向国际社区推广，需要引入 i18n 机制
- `--help` 输出也使用中文
- 代码中保持 `// 英文注释`，字符串输出为中文

### 降级路径

如果需要国际化，可通过以下方式改造：
1. 将所有用户面向的字符串提取到 `src/messages.js`
2. 通过 `LANG` 环境变量或 `--locale` 参数切换语言
3. MVP 阶段不实施

---

## ADR-010: 浅克隆策略

| 字段 | 值 |
|------|-----|
| 状态 | 已采纳 |
| 决策日期 | 2025-07 |

### 背景

Git clone 时可以选择完整克隆或浅克隆。知识仓库的 Git 历史对安装过程没有价值。

### 决策

**默认使用 `--depth 1` 浅克隆。**

### 理由

1. **性能**：知识仓库可能有较长的提交历史和大量 diff，浅克隆只下载最新快照
2. **安全**：减少在本地留存的信息量
3. **磁盘**：临时目录的空间占用更小

### 影响

- 浅克隆的仓库无法查看 `git log`，但这不是 aiforge 的需求
- 持久化模式下后续 `git pull` 在浅克隆仓库上也能正常工作

### 例外

如果未来实现「版本锁定」功能（安装指定 tag/commit），可能需要 `--depth` 更大值或完整克隆。该需求在 P3 阶段考虑。

---

## ADR-011: 文件冲突处理策略

| 字段 | 值 |
|------|-----|
| 状态 | 已采纳（修订） |
| 决策日期 | 2025-07（修订：2026-03） |

### 背景

安装目标路径可能已存在文件（来自之前的安装或手动创建）。需要决定冲突处理策略。

### 决策

**默认交互式选择（推荐备份后覆盖），`--force` 直接覆盖不备份，`--dry-run` 仅预览。**

```
目标文件已存在:
  ├─ --force     → 直接覆盖，不备份
  ├─ --dry-run   → 仅标记 "will overwrite"，不操作
  └─ 默认（交互式） → 提示用户选择:
       [o] 覆盖全部（overwrite all）
       [s] 跳过冲突文件（skip conflicts）
       [b] 备份后覆盖（backup then overwrite）← 默认推荐
       [d] 逐个查看差异（diff each）
       [a] 中止安装（abort）
```

### 理由

| 备选策略 | 问题 |
|---------|------|
| 跳过（不覆盖） | 用户永远无法更新已安装的配置 |
| 无条件覆盖 | 丢失用户可能的本地修改 |
| 静默备份后覆盖 | 用户不知道发生了什么，可能遗漏重要的本地修改 |
| **交互式选择（默认 backup）** | ✅ 用户有控制权，默认推荐最安全的选项 |

> 来源：混沌工程攻击向量 #2 场景 2.1 识别了"覆盖用户文件"为致命风险，交互式选择让用户在数据安全和便利性之间做出明确选择。

### 影响

- `.bak` 文件会在目标目录积累，但通常被 `.gitignore` 忽略
- 符号链接模式下，若目标已是指向同一源的符号链接，跳过不重新创建（幂等性）
- CI/CD 等非交互式环境中，需要配合 `--force` 或环境变量 `AIFORGE_CONFLICT=backup` 使用

---

## ADR-012: 不依赖特定 Git 托管平台 API

| 字段 | 值 |
|------|-----|
| 状态 | 已采纳 |
| 决策日期 | 2025-07 |

### 背景

是否使用 GitLab / GitHub API 来获取仓库内容（替代 git clone）。

### 决策

**不使用任何 Git 托管平台的 REST/GraphQL API。仅使用 Git 协议（SSH/HTTPS）。**

### 理由

1. **平台无关**：aiforge 不应绑定 GitLab 或 GitHub，用户可能使用 Gitea、Bitbucket 等
2. **API 限制**：REST API 有速率限制，且下载整个仓库目录树需要多次请求
3. **认证统一**：Git 协议的认证方式（SSH Key、Token、凭据管理器）已覆盖所有场景，引入 API 会增加一套独立的认证体系
4. **离线一致性**：Git clone 得到的是完整的目录快照，与用户手动 clone 的结果一致

### 影响

- 需要用户本地安装了 Git CLI
- 无法利用 GitLab API 做细粒度操作（如只下载单个文件），但这不是当前需求
- GitHub 简写 `user/repo` 只能展开为 HTTPS URL（无法确定是否私有仓库）

---

## ADR 索引

| 编号 | 标题 | 状态 |
|------|------|------|
| ADR-001 | 工具与知识仓库分离 | 已采纳 |
| ADR-002 | ESM 模块系统 | 已采纳 |
| ADR-003 | 配置驱动的安装规则 | 已采纳 |
| ADR-004 | 多层认证解析链 | 已采纳 |
| ADR-005 | 复制模式与符号链接模式并存 | 已采纳 |
| ADR-006 | 符号链接路径策略（全局绝对 / 项目相对） | 已采纳（修订） |
| ADR-007 | 单命令入口 + 子命令结构 | 已采纳 |
| ADR-008 | 全局排除列表而非 .aiforgnore | 已采纳 |
| ADR-009 | 中文 CLI 输出 | 已采纳 |
| ADR-010 | 浅克隆策略 | 已采纳 |
| ADR-011 | 文件冲突处理策略 | 已采纳 |
| ADR-012 | 不依赖特定 Git 托管平台 API | 已采纳 |