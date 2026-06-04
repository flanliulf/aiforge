# aiforge - 项目概览

**日期：** 2026-05-25 14:48:20 +0800  
**类型：** 单体单仓库 CLI 工具  
**架构：** 数据驱动的分层管道式安装器

## 执行摘要

`aiforge` 是一个发布到 npm 的 TypeScript CLI，用来把统一知识仓库中的 `agents/`、`skills/`、`instructions/`、`mcp-tools/` 自动同步到不同 AI 编码工具的目标目录。它的核心价值不是“管理单一工具配置”，而是充当一个跨工具的适配层：上游团队只维护一套知识仓库，下游由 `aiforge` 负责规则匹配、目录映射、安装方式选择、冲突保护和结果汇总。

当前仓库同时承担三类角色：

- 产品源码仓库：`src/` 中实现 CLI、安装流水线、规则匹配、安全校验与发布逻辑。
- 对外文档仓库：`README*` 与 `docs/` 组成公开文档面，覆盖入门、配置、迁移、排障、扩展和发布。
- 自举/样例仓库：根目录下的 `.github/`、`.claude/`、`.cursor/`、`.codex/` 等目录，以及 `_bmad-output/` 里的计划与审查产物，为项目提供真实的 dogfooding、测试样本和架构证据。

## 项目归类

- **仓库类型：** monolith
- **项目类型：** cli
- **主要语言：** TypeScript、Markdown
- **运行时：** Node.js `>=18.0.0`
- **主要架构模式：** `index.ts -> pipeline.ts -> stages/services/core/data` 的分层编排
- **非目标能力：** 无常驻服务、无数据库、无 Web UI、无外部 API 服务器

## 技术栈摘要

| 类别     | 技术                                      | 版本/约束                 | 用途                    |
| -------- | ----------------------------------------- | ------------------------- | ----------------------- |
| 运行时   | Node.js                                   | `>=18.0.0`                | CLI 执行环境            |
| 语言     | TypeScript                                | `^5.9.3`                  | 主实现语言              |
| CLI 解析 | `commander`                               | `^14.0.3`                 | 主命令与参数解析        |
| 交互输入 | `@inquirer/prompts`                       | `^8.3.2`                  | `init` 子命令与冲突处理 |
| Git 访问 | `simple-git`                              | `~3.32`                   | clone/pull/ls-remote    |
| 终端体验 | `ora`、`chalk`                            | `^8.2.0`、`^5.6.2`        | 进度与彩色输出          |
| 构建     | `tsup`                                    | `^8.5.1`                  | ESM CLI 打包            |
| 源码运行 | `tsx`                                     | `^4.21.0`                 | 本地开发调试            |
| 测试     | `vitest`                                  | `^4.1.0`                  | 单元/集成/E2E 测试      |
| 质量     | `eslint`、`prettier`、`typescript-eslint` | 当前 package.json         | 规范与格式校验          |
| CI/CD    | GitLab CI                                 | `.gitlab-ci.yml`          | 质量门禁与 npm 发布     |
| 分发     | npm                                       | `@fancyliu/aiforge@2.0.4` | 对外发布                |

## 关键能力

- 支持 11 个 AI 工具的检测与安装规则匹配。
- 内置 55 条工具规则和 4 条通用目录规则。
- 支持 `Files`、`Directories`、`Flatten` 三种安装语义。
- 支持项目级复制安装和全局符号链接安装。
- 提供 `--dry-run`、`--list`、`--filter`、`--no-universal` 等精细化控制。
- 使用四层认证链解析 Git 仓库访问方式。
- 对路径遍历、symlink 逃逸、权限不足、冲突覆盖和 Token 泄漏做了显式防护。
- 支持中英文双语输出与错误三段式提示。

## 架构亮点

- **入口薄，编排集中：** `src/index.ts` 只负责参数解析、语言预加载、Reporter 创建和 `runPipeline()` 调用。
- **流水线清晰：** 解析源、认证、克隆、工具检测、规则匹配、安装执行、manifest 持久化、结果汇报分层明确。
- **规则数据化：** 工具检测注册表和安装规则表都放在 `src/data/`，新增工具通常不需要改动安装器骨架。
- **安全边界前置：** `src/services/fs-utils.ts` 在真正写盘前执行 preflight、安全根校验、目录类型校验与 symlink 逃逸校验。
- **安装状态可追踪：** `src/services/manifest.ts` 维护 `~/.aiforge/manifest.json`，支持冲突类型识别与增量更新。
- **文档与实现联动：** 公共文档位于 `docs/`，工程规则与规划证据位于 `_bmad-output/`，项目本身长期以文档驱动方式演进。

## 开发概览

### 前置要求

- Node.js `>=18.0.0`
- Git `>=2.20`

### 快速开始

```bash
npm install
npm run dev -- --help
```

### 关键命令

- **安装依赖：** `npm install`
- **源码运行：** `npm run dev -- --help`
- **测试：** `npm test`
- **构建：** `npm run build`
- **源码 lint：** `npm run lint:src`
- **发布门禁：** `npm run release:check`

## 仓库结构摘要

- `src/`：主实现，按命令、核心契约、数据注册表、服务、阶段拆分。
- `tests/`：单元测试、集成测试、按 Epic 组织的 E2E。
- `docs/`：对外用户/维护者文档与历史参考资料。
- `.github/`：项目级知识内容与大量 skill/agent 样本，既是 dogfooding 资产，也是安装目标样本。
- `_bmad-output/`：架构、story、code review、retrospective 等规划和实施证据。
- `dist/`：构建输出，npm 包 CLI 入口指向 `dist/index.js`。

## 当前验证基线

本次扫描期间已实际执行并通过：

- `npm test`：42 个测试文件、1020 个测试用例全部通过。
- `npm run build`：ESM 构建和 DTS 构建全部成功。

## 文档地图

- [index.md](./index.md) - 本知识库入口
- [architecture.md](./architecture.md) - 运行时架构与模块职责
- [source-tree-analysis.md](./source-tree-analysis.md) - 仓库结构与关键目录
- [component-inventory.md](./component-inventory.md) - 主要功能组件清单
- [development-guide.md](./development-guide.md) - 开发与验证工作流
- [deployment-guide.md](./deployment-guide.md) - CI 与发布流程
- [contribution-guide.md](./contribution-guide.md) - 贡献路径与同步规则

---

_Generated using BMAD Method `document-project` workflow_
