# aiforge - 源码树分析

**日期：** 2026-05-25 14:48:20 +0800

## 概览

`aiforge` 是一个单体 CLI 仓库，但内容明显分成三层：

- **运行时实现层：** `src/` + `tests/`
- **公开文档层：** `README*` + `docs/`
- **自举知识/项目治理层：** `.github/`、`.claude/`、`.cursor/`、`.codex/`、`_bmad-output/`

这意味着它既是一个要发布到 npm 的 CLI，又是一个真实的“知识仓库样本”和 brownfield 规划工作区。

## 完整目录结构

```text
ai-forge/
├── src/                         # CLI 主实现
│   ├── commands/                # 子命令（当前主要是 init）
│   ├── core/                    # 错误、消息、契约、Reporter、路径解析
│   ├── data/                    # 工具注册表、安装规则、排除列表
│   ├── services/                # Git、配置、文件系统、manifest、安全校验
│   ├── stages/                  # 管道阶段实现
│   ├── index.ts                 # CLI 入口
│   └── pipeline.ts              # 编排器与阶段闭包工厂
├── tests/                       # 单元/集成/E2E 测试
│   ├── commands/
│   ├── core/
│   ├── data/
│   ├── services/
│   ├── stages/
│   ├── integration/             # 按 Epic 组织的端到端用例
│   └── fixtures/                # 样例知识仓库
├── docs/                        # 对外文档
│   ├── getting-started*.md
│   ├── configuration*.md
│   ├── troubleshooting*.md
│   ├── install-rules-matrix*.md
│   ├── migration-v2*.md
│   ├── extending*.md
│   ├── contributing*.md
│   └── references/              # 草稿、调研、审查记录
├── .github/                     # 项目级知识内容与技能样本
│   ├── agents/
│   └── skills/                  # 53 个 skill 目录
├── _bmad/                       # BMM/工作流配置
├── _bmad-output/                # 规划、Story、CR、回顾等产物
├── dist/                        # 构建输出
├── package.json                 # npm 元数据与脚本
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── eslint.config.js
├── .gitlab-ci.yml               # CI 与发布
├── README.md
└── README.zh.md
```

## 关键目录

### `src/`

**用途：** 所有生产运行时代码  
**包含：** 33 个 TypeScript 文件  
**入口点：** `src/index.ts`、`src/pipeline.ts`

`src/` 按职责拆为命令层、核心基础层、纯数据层、服务层和阶段层，边界相对清晰，适合继续沿着“编排器 + 阶段”的方式演进。

### `src/commands/`

**用途：** 顶层 CLI 子命令  
**包含：** `init` 子命令注册与交互流程  
**入口点：** `src/commands/init.ts`

当前只有 `init`，它与主安装流水线分离，不经过 Reporter，而是直接使用 `@inquirer/prompts` 和 `console.log` 交互。

### `src/core/`

**用途：** 不依赖业务安装规则的基础设施层  
**包含：** 类型契约、错误类型、消息国际化、Reporter、路径解析、脱敏工具  
**入口点：** `src/core/types.ts`、`src/core/reporter.ts`

这是系统的“稳定内核”，大部分阶段和服务都依赖这里。

### `src/data/`

**用途：** 纯数据注册表与常量  
**包含：** 工具检测表、安装规则表、排除列表、向后兼容消息导出  
**入口点：** `src/data/install-rules.ts`、`src/data/tool-registry.ts`

新增工具支持时，最常动的通常就是这层。

### `src/services/`

**用途：** 可复用的系统能力  
**包含：** 配置读写、Git URL 解析、clone、文件系统安全校验、manifest 状态管理、版本检查  
**入口点：** `src/services/config.ts`、`src/services/fs-utils.ts`、`src/services/manifest.ts`

这一层负责真正接触文件系统、Git 与本地环境。

### `src/stages/`

**用途：** 流水线阶段实现  
**包含：** `resolve-source`、`authenticate`、`clone`、`detect-tools`、`match-rules`、`list-contents`、`execute-install` 等  
**入口点：** `src/stages/execute-install.ts`

这层是业务主流程的核心，尤其 `execute-install.ts` 与 `fs-utils.ts` 共同定义了安装行为和安全边界。

### `tests/`

**用途：** 回归与验收保障  
**包含：** 57 个测试文件，其中 42 个会被当前测试命令执行  
**关键内容：**

- 单元测试覆盖 `core/`、`data/`、`services/`、`stages/`
- `tests/integration/` 按 Epic 组织 E2E
- `tests/fixtures/sample-repo/` 提供可安装的样例知识仓库

### `docs/`

**用途：** 面向用户和维护者的公开文档  
**包含：** 双语 README 补充页、配置、迁移、矩阵、排障、扩展、发布指南

对外文档和内部 brownfield 文档是分开的：`docs/` 面向包使用者，`knowledge-base/` 面向 AI/开发理解仓库。

### `.github/`

**用途：** 项目级安装目标样本与知识内容  
**包含：** 10 个 agent 文件、53 个 skill 目录  
**集成说明：** 这些目录一方面是项目自身 dogfooding 资产，另一方面也是检测/安装/规则匹配测试的重要现实样本。

### `_bmad-output/`

**用途：** 规划与执行证据仓  
**包含：** 架构文档、Story、CR、retro、测试总结、project-context

这里不是运行时依赖，但对理解为什么代码会这么写很有价值。

### `dist/`

**用途：** 构建产物  
**包含：** `dist/index.js`、chunks、`.d.ts`

npm 包的 CLI 入口最终指向这里，而不是直接执行 `src/`。

## 入口点

- **主入口：** `src/index.ts`
- **编排入口：** `src/pipeline.ts`
- **交互子命令：** `src/commands/init.ts`
- **构建后 CLI 入口：** `dist/index.js`
- **包命令名：** `aiforge`

## 文件组织模式

- **薄入口 + 厚编排器：** CLI 参数解析和主流程执行分离。
- **阶段职责明确：** 每个阶段只负责一个可命名的工作单元。
- **纯数据驱动：** 工具与规则知识主要存在 `src/data/` 而不是散落在控制流里。
- **安全逻辑集中：** 路径安全、目录类型检查、symlink 逃逸检测集中在 `fs-utils.ts`。
- **双语文案集中：** 用户可见消息统一收口到 `src/core/messages.ts`。
- **公开文档与过程文档分层：** `docs/` 是发布面，`_bmad-output/` 是治理与规划面。

## 关键文件类型

### TypeScript 源码

- **模式：** `src/**/*.ts`、`tests/**/*.ts`
- **用途：** 运行时实现与自动化测试
- **示例：** `src/pipeline.ts`、`src/stages/execute-install.ts`

### Markdown 文档

- **模式：** `README*.md`、`docs/**/*.md`、`_bmad-output/**/*.md`
- **用途：** 用户文档、规划、审查、发布说明
- **示例：** `docs/getting-started.zh.md`、`_bmad-output/project-context.md`

### 配置与流水线文件

- **模式：** `package.json`、`*.config.ts`、`*.yml`
- **用途：** 构建、测试、CI/CD、Lint
- **示例：** `tsup.config.ts`、`vitest.config.ts`、`.gitlab-ci.yml`

## 资产位置

无图片、音频或大型二进制资产目录。仓库的“资产”主要是：

- 文档资产：`docs/`、`README*`
- 知识仓库样本：`.github/agents`、`.github/skills`
- 规划资产：`_bmad-output/`

## 配置文件

- `package.json`：版本、脚本、依赖、打包范围、bin
- `tsconfig.json`：TypeScript 编译选项
- `tsup.config.ts`：CLI 打包配置
- `vitest.config.ts`：测试配置
- `eslint.config.js`：Lint 规则
- `.gitlab-ci.yml`：质量门禁与 npm 发布
- `AGENTS.md`：本地代理规则与协作约束

## 开发备注

- `src/` 与 `tests/` 的边界清晰，适合先改实现、再补对应测试。
- `.github/skills` 目录规模较大，做仓库扫描时要明确它属于“样本/知识内容”，不是 CLI 运行时代码。
- `_bmad-output/` 体量明显大于 `src/`，但它提供了大量架构、规则和审查上下文，适合在 brownfield 规划时优先检索。

---

_Generated using BMAD Method `document-project` workflow_
