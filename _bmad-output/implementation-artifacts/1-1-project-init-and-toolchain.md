# Story 1.1: 项目初始化与工具链配置

Status: ready-for-dev

## Story

As a 开发者,
I want 一个完整配置的 TypeScript ESM 项目骨架,
so that 后续所有模块可以在统一的构建、测试、lint 环境中开发。

## Acceptance Criteria

1. **Given** 一个空目录 **When** 执行项目初始化 **Then** 生成完整的项目结构（`src/`、`tests/`、`dist/` 目录），`package.json` 配置 `"type": "module"`，`engines.node >= 18`，TypeScript 启用 strict 模式，目标 ESM 输出
2. **Given** 项目已初始化 **When** 运行 `npm run build` **Then** tsup 成功编译 TypeScript 到 `dist/` 目录（ESM 格式）
3. **Given** 项目已初始化 **When** 运行 `npm test` **Then** vitest 成功执行（即使无测试用例也不报错）
4. **Given** 项目已初始化 **When** 运行 `npm run lint` **Then** ESLint + Prettier 检查通过，无报错
5. **Given** 项目已初始化 **When** 检查依赖列表 **Then** 包含核心依赖（`commander`、`simple-git@~3.32`、`ora@^8`、`chalk@^5`、`@inquirer/prompts`）和开发依赖（`typescript`、`tsup`、`tsx`、`vitest`、`eslint`、`prettier`、`typescript-eslint`、`@types/node`），npm 包源码不含任何公司域名、仓库地址（NFR-S1）

## Tasks / Subtasks

- [ ] Task 1: 初始化 npm 项目 (AC: #1)
  - [ ] 1.1 运行 `npm init` 创建 package.json
  - [ ] 1.2 设置 `"type": "module"`, `"engines": { "node": ">=18.0.0" }`
  - [ ] 1.3 配置 `"bin": { "aiforge": "./dist/index.js" }` 支持 npx 执行
  - [ ] 1.4 配置 scripts: `build`, `dev`, `test`, `lint`, `lint:fix`
- [ ] Task 2: 安装依赖 (AC: #5)
  - [ ] 2.1 核心依赖: `commander`, `simple-git@~3.32`, `ora@^8`, `chalk@^5`, `@inquirer/prompts`
  - [ ] 2.2 开发依赖: `typescript`, `tsup`, `tsx`, `vitest`, `eslint`, `prettier`, `typescript-eslint`, `@types/node`
- [ ] Task 3: 配置 TypeScript (AC: #1)
  - [ ] 3.1 创建 `tsconfig.json`: strict 模式, `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`, `"target": "ES2022"`, `"outDir": "./dist"`
- [ ] Task 4: 配置构建工具 tsup (AC: #2)
  - [ ] 4.1 创建 `tsup.config.ts`: entry `src/index.ts`, format `esm`, dts 生成, clean
- [ ] Task 5: 配置测试框架 vitest (AC: #3)
  - [ ] 5.1 创建 `vitest.config.ts`: 测试文件匹配 `tests/**/*.test.ts`
- [ ] Task 6: 配置 ESLint + Prettier (AC: #4)
  - [ ] 6.1 创建 `eslint.config.js` (flat config): typescript-eslint 插件
  - [ ] 6.2 创建 `.prettierrc`: singleQuote, trailingComma, printWidth
- [ ] Task 7: 创建项目目录结构 (AC: #1)
  - [ ] 7.1 创建 `src/` 及子目录: `core/`, `data/`, `stages/`, `services/`, `commands/`
  - [ ] 7.2 创建 `tests/` 镜像结构: `core/`, `data/`, `stages/`, `services/`, `commands/`
  - [ ] 7.3 创建 `src/index.ts` 入口文件（最小占位）
- [ ] Task 8: 验证全链路 (AC: #1-5)
  - [ ] 8.1 `npm run build` 成功
  - [ ] 8.2 `npm test` 成功（空测试套件不报错）
  - [ ] 8.3 `npm run lint` 成功
  - [ ] 8.4 `npx aiforge --help` 可运行（占位输出即可）
  - [ ] 8.5 检查 package.json 不含公司域名/仓库地址

## Dev Notes

### 架构约束 [Source: architecture/03-core-decisions.md]

- **手动搭建**，不使用社区模板（架构决策 D0）
- 项目初始化是第一个实施 Story，为所有后续 Epic 提供基础
- `src/index.ts` 只需最小占位（空 commander 程序，不直接使用 `console.log` 输出用户可见文本），后续 Story 1.5 会完善 CLI

### 模块边界 [Source: architecture/05-project-structure.md]

```
src/
├── index.ts          # CLI 入口（本 Story 只创建占位）
├── core/             # 零依赖，被所有模块引用
├── data/             # 纯数据常量，零依赖
├── stages/           # 管道阶段，可依赖 core/data/services
├── services/         # 业务服务，只依赖 core
└── commands/         # CLI 子命令，可依赖 core/services
```

- `core/` 有 **零依赖**原则（不依赖 src 下其他目录）
- `data/` 是**纯数据**（不依赖 src 下其他目录）
- **绝不创建循环依赖**

### 命名约定 [Source: architecture/04-implementation-patterns.md]

- 文件名: **kebab-case** (`resolve-source.ts`, `detect-tools.ts`)
- 接口: **PascalCase 无 I 前缀** (`SourceResolver`, 不是 `ISourceResolver`)
- 常量: **UPPER_SNAKE_CASE** (`BUILTIN_RULES`, `DEFAULT_EXCLUDES`)
- 函数/变量: **camelCase** (`loadRules()`, `ruleIndex`)
- ESM 导入**必须带 `.js` 扩展名**: `import { foo } from './bar.js'`
- **只用命名导出**，不用默认导出

### ESM 关键注意事项 [Source: project-context.md]

- `package.json` 必须有 `"type": "module"`
- TypeScript `moduleResolution` 必须是 `NodeNext`
- 所有 `.ts` 文件的 import 路径写 `.js` 后缀（TypeScript 编译后路径）
- 不使用 `require()`，不使用 `__dirname`（用 `import.meta.url` 替代）

### 依赖版本说明

| 依赖 | 版本要求 | 说明 |
|------|---------|------|
| commander | latest | CLI 框架 |
| simple-git | ~3.32.x | Git 操作封装 |
| ora | ^8 | spinner 动画（ESM only） |
| chalk | ^5 | 终端彩色（ESM only） |
| @inquirer/prompts | latest | 交互式提示 |
| typescript | ^5 | 语言 |
| tsup | latest | esbuild 构建 |
| tsx | latest | 开发时直接运行 TS |
| vitest | latest | 测试框架（ESM native） |

> ora v8+ 和 chalk v5+ 是纯 ESM 包，不支持 CommonJS require。这是选择 ESM 的关键原因之一。

### 安全要求 [Source: architecture/03-core-decisions.md, NFR-S1]

- npm 包（package.json、README 等）**不得包含**任何公司域名、仓库 URL、Token、Host 名
- 本 Story 创建的 package.json 中 `repository`、`homepage`、`bugs` 字段留空或不设置

### NFR 覆盖

- **NFR-P4**: CLI 启动到首次输出 < 1 秒（本 Story 建立基线）
- **NFR-C3**: Node.js >= 18.0.0（engines 字段）
- **NFR-C5**: 路径处理使用 `path.join()`（目录结构创建时遵循）
- **NFR-S1**: npm 包零敏感信息

### 本 Story 不做的事

- 不实现 CLI 命令逻辑（Story 1.5）
- 不实现核心类型定义（Story 1.2）
- 不实现 Reporter/PathResolver（Story 1.3）
- 不实现数据层常量（Story 1.4）
- 只创建目录结构和占位入口文件，确保工具链可用

### Project Structure Notes

- 本 Story 创建的目录结构严格遵循 architecture/05-project-structure.md
- 每个子目录创建后可放一个空的 `.gitkeep` 或占位 `index.ts`（export 空对象）以确保 git 追踪

### References

- [Source: architecture/02-starter-template.md] — 技术栈选型和初始化命令
- [Source: architecture/03-core-decisions.md] — 手动搭建决策
- [Source: architecture/04-implementation-patterns.md] — 命名约定和强制规则
- [Source: architecture/05-project-structure.md] — 完整目录结构和模块边界
- [Source: project-context.md] — TypeScript & ESM 规则

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
