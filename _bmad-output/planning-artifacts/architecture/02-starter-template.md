## Starter Template Evaluation

### Primary Technology Domain

CLI 工具（Node.js ESM）— aiforge 不适用 Web 框架脚手架，需要手动搭建 CLI 项目结构。

### Starter Options Considered

**方案 A：社区 CLI TypeScript Starter 模板**

如 cli-typescript-starter 等社区模板，提供 TypeScript + commander + 基础项目结构。
- 优点：快速起步
- 缺点：模板可能包含不需要的依赖、结构不匹配 aiforge 的管道架构、后续需要大量裁剪

**方案 B：手动搭建（选定）**

基于 PRD 已确定的技术栈，手动初始化项目。aiforge 的架构（管道式 + 语义适配层）足够独特，社区模板反而会引入不必要的约束。

### Selected Starter: 手动搭建

**Rationale:**
1. PRD 已明确核心依赖（commander + simple-git + ora + chalk），不需要模板帮选
2. 管道式架构的项目结构需要定制，通用模板无法提供
3. 单人开发，搭建成本低，但裁剪模板的成本可能更高
4. 遵循 Node.js CLI Apps Best Practices

<!-- STARTER_APPEND_1 -->

### Architectural Decisions Provided by Starter

**Language & Runtime: TypeScript (ESM)**

- TypeScript 提供管道阶段间数据契约的类型安全（PRD 已定义 `InstallRule` 等接口）
- 纯 ESM 模块（`"type": "module"`），不支持 CommonJS
- 构建工具：tsup（基于 esbuild，零配置打包 TS → ESM）
- 开发运行：tsx（直接运行 TypeScript，无需编译步骤）

**Linting / Formatting: ESLint + Prettier**

- ESLint：代码质量检查，配合 typescript-eslint 插件
- Prettier：代码格式化，统一风格
- 行业标准组合，生态成熟，插件丰富

**Testing Framework: Vitest**

- 2026 年 ESM 项目的标准测试框架
- 原生 ESM 支持，无需额外配置
- Jest 兼容 API，学习成本低
- 原生 TypeScript 集成

**Build Tooling: tsup**

- 基于 esbuild，零配置打包 TypeScript
- 输出纯 ESM（aiforge 不需要 CJS 兼容）
- 生成 `dist/` 目录，`package.json` 的 `bin` 指向编译产物

**Core Dependencies (Current Stable):**

| 依赖 | 版本 | 用途 |
|------|------|------|
| commander | latest stable | CLI 参数解析 |
| simple-git | ~3.32.x | Git 操作 |
| ora | v8+ (ESM) | spinner 动画 |
| chalk | v5+ (ESM) | 彩色输出 |
| tsup | latest | TypeScript 构建 |
| tsx | latest | 开发时 TS 直接运行 |
| vitest | latest | 测试框架 |
| eslint | latest | 代码检查 |
| prettier | latest | 代码格式化 |
| typescript-eslint | latest | TS ESLint 插件 |
| @inquirer/prompts | latest | 交互式 CLI 引导（aiforge init） |

<!-- STARTER_APPEND_2 -->

**Code Organization:**

```
aiforge/
├── src/
│   ├── index.ts              # CLI 入口（commander 定义）
│   ├── pipeline.ts           # 管道编排器
│   ├── stages/               # 管道阶段（按执行顺序）
│   │   ├── resolve-source.ts # 知识源解析（Git/本地）
│   │   ├── authenticate.ts   # 四层认证解析
│   │   ├── clone.ts          # 克隆/更新
│   │   ├── detect-tools.ts   # AI 工具检测
│   │   ├── match-rules.ts    # 规则匹配引擎
│   │   ├── execute-install.ts# 执行安装（复制/符号链接/flatten）
│   │   └── report.ts         # 结果汇总
│   ├── core/                 # 核心抽象
│   │   ├── types.ts          # 管道数据契约（TypeScript 接口）
│   │   ├── errors.ts         # 统一错误类型体系
│   │   ├── reporter.ts       # 输出抽象（TTY/非TTY/quiet）
│   │   └── path-resolver.ts  # 跨平台路径解析
│   ├── data/                 # 数据化配置
│   │   ├── install-rules.ts  # 安装规则映射表
│   │   ├── tool-registry.ts  # 工具检测规则
│   │   └── excludes.ts       # 全局排除列表
│   └── services/             # 外部服务封装
│       ├── git.ts            # simple-git 薄封装
│       ├── config.ts         # config.json 读写
│       └── manifest.ts       # manifest.json 状态管理
├── tests/                    # 测试
├── .eslintrc.cjs             # ESLint 配置
├── .prettierrc               # Prettier 配置
├── tsconfig.json             # TypeScript 配置
├── tsup.config.ts            # 构建配置
├── vitest.config.ts          # 测试配置
├── package.json
└── README.md
```

**Initialization Command:**

```bash
mkdir aiforge && cd aiforge
npm init -y
npm install commander simple-git ora chalk @inquirer/prompts
npm install -D typescript tsup tsx vitest eslint prettier typescript-eslint @types/node
npx tsc --init
```

**Note:** 项目初始化应作为第一个实施 Story。

