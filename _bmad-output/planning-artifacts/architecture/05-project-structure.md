## Project Structure & Boundaries

### Complete Project Directory Structure

```
aiforge/
├── package.json                    # npm 包配置 + bin 入口
├── tsconfig.json                   # TypeScript 配置
├── tsup.config.ts                  # 构建配置（ESM 输出）
├── vitest.config.ts                # 测试配置
├── .eslintrc.cjs                   # ESLint 配置
├── .prettierrc                     # Prettier 配置
├── .gitignore
├── .npmignore                      # npm 发布排除（tests/、src/、.eslintrc 等）
├── README.md
├── LICENSE
│
├── src/
│   ├── index.ts                    # CLI 入口：commander 定义、参数解析、管道启动
│   ├── pipeline.ts                 # 管道编排器：阶段串联、dry-run 分叉、错误收集
│   │
│   ├── stages/                     # 管道阶段（按执行顺序）
│   │   ├── resolve-source.ts       # 阶段 1：知识源解析（SourceResolver 调度）
│   │   ├── authenticate.ts         # 阶段 2：四层认证解析链
│   │   ├── clone.ts                # 阶段 3：Git 克隆/更新
│   │   ├── detect-tools.ts         # 阶段 4：AI 工具自动检测
│   │   ├── match-rules.ts          # 阶段 5：规则匹配（Map 索引查找）
│   │   ├── execute-install.ts      # 阶段 6：执行安装（复制/符号链接/flatten）
│   │   └── report.ts              # 阶段 7：结果汇总（委托 Reporter）
│   │
│   ├── core/                       # 核心抽象（被所有模块依赖）
│   │   ├── types.ts                # 管道数据契约：所有阶段的输入/输出接口
│   │   ├── errors.ts               # AiforgeError 类（code + severity + 三段式）
│   │   ├── sanitize.ts             # Token 脱敏工具函数（sanitizeToken 等）
│   │   ├── reporter.ts             # Reporter 接口 + TtyReporter/PlainReporter/QuietReporter
│   │   └── path-resolver.ts        # PathResolver 接口 + UnixPathResolver（MVP）
│   │
│   ├── data/                       # 数据化配置（纯数据，无逻辑）
│   │   ├── install-rules.ts        # BUILTIN_RULES 常量 + RuleLoader 函数
│   │   ├── tool-registry.ts        # TOOL_DEFINITIONS 常量（检测注册表）
│   │   ├── excludes.ts             # DEFAULT_EXCLUDES 常量
│   │   └── messages.ts             # 输出字符串集中管理（MVP 中文，M2 扩展多语言）
│   │
│   ├── services/                   # 外部服务封装（有副作用的 I/O 操作）
│   │   ├── git.ts                  # GitSourceResolver（simple-git 薄封装）
│   │   ├── config.ts               # config.json 读写（~/.aiforge/config.json）
│   │   ├── manifest.ts             # manifest.json 状态管理（原子写入）
│   │   └── fs-utils.ts             # 文件操作工具（复制、符号链接、备份、权限）
│   │
│   └── commands/                   # 子命令（非管道流程）
│       └── init.ts                 # aiforge init 交互式配置
│
├── tests/
│   ├── stages/                     # 管道阶段单元测试
│   │   ├── resolve-source.test.ts
│   │   ├── authenticate.test.ts
│   │   ├── clone.test.ts
│   │   ├── detect-tools.test.ts
│   │   ├── match-rules.test.ts
│   │   ├── execute-install.test.ts
│   │   └── report.test.ts
│   ├── core/                       # 核心模块单元测试
│   │   ├── errors.test.ts
│   │   ├── reporter.test.ts
│   │   └── path-resolver.test.ts
│   ├── services/                   # 服务层单元测试
│   │   ├── git.test.ts
│   │   ├── config.test.ts
│   │   ├── manifest.test.ts
│   │   └── fs-utils.test.ts
│   ├── integration/                # 集成测试
│   │   └── pipeline.test.ts        # 管道端到端测试
│   └── fixtures/                   # 测试 fixtures
│       ├── sample-repo/            # 模拟知识仓库结构
│       ├── config-samples/         # 各种 config.json 样本
│       └── manifest-samples/       # 各种 manifest.json 样本
│
└── dist/                           # 构建输出（tsup 生成，git 忽略）
    └── index.js                    # 编译后的 ESM 入口
```

<!-- STRUCTURE_APPEND_1 -->

### Requirements to Structure Mapping

| FR 领域 | 主要文件 | 辅助文件 |
|---------|---------|---------|
| 仓库获取 FR-001~005 | `stages/resolve-source.ts`, `stages/clone.ts` | `services/git.ts` |
| 认证 FR-006~012 | `stages/authenticate.ts` | `services/config.ts`, `core/errors.ts` |
| 工具检测 FR-013~015 | `stages/detect-tools.ts` | `data/tool-registry.ts`, `core/path-resolver.ts` |
| 安装引擎 FR-016~024 | `stages/match-rules.ts`, `stages/execute-install.ts` | `data/install-rules.ts`, `services/fs-utils.ts` |
| 冲突处理 FR-025~032 | `stages/execute-install.ts` | `services/manifest.ts`, `services/fs-utils.ts` |
| 用户交互 FR-033~039 | `commands/init.ts`, `stages/report.ts` | `core/reporter.ts`, `core/errors.ts` |
| 配置管理 FR-040~042 | `services/config.ts` | `commands/init.ts` |
| 可扩展性 FR-043~046 | `data/install-rules.ts`, `data/tool-registry.ts` | `data/excludes.ts` |

### Architectural Boundaries

**模块依赖规则：**

```
index.ts ──→ pipeline.ts ──→ stages/* ──→ services/*
                                │              │
                                └──→ core/*  ←─┘
                                       │
                                  data/* (纯数据)
```

- `core/` 不依赖任何其他 src 目录（零依赖，被所有模块引用）
- `data/` 不依赖任何其他 src 目录（纯数据常量）
- `stages/` 可依赖 `core/`、`data/`、`services/`
- `services/` 只依赖 `core/`（不依赖 stages 或 data）
- `commands/` 可依赖 `core/`、`services/`
- `pipeline.ts` 编排 `stages/`，依赖 `core/`
- `index.ts` 只依赖 `pipeline.ts` 和 `commands/`

### Data Flow

```
CLI args (index.ts)
  → ParsedArgs
    → ResolvedSource (resolve-source)
      → AuthenticatedSource (authenticate)
        → LocalRepo (clone)
          → DetectedEnv (detect-tools)
            → MatchedPlan (match-rules)
              ├─ [dry-run] → Reporter.reportPlan()
              └─ [normal] → InstallResult[] (execute-install)
                           → Reporter.reportResult()
```

### External Integration Points

| 集成 | 模块 | 协议 |
|------|------|------|
| Git 服务器 | `services/git.ts` | HTTPS / SSH（simple-git） |
| 文件系统 | `services/fs-utils.ts`, `services/manifest.ts` | Node.js fs API |
| 用户配置 | `services/config.ts` | JSON 文件读写（~/.aiforge/） |
| 终端 | `core/reporter.ts` | stdout/stderr（ora + chalk） |

