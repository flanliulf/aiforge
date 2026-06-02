# aiforge - 开发指南

**日期：** 2026-05-25 14:48:20 +0800

## 目标读者

本指南面向会在本仓库里修改源码、测试、公开文档或发布配置的开发者。重点不是介绍“如何使用 aiforge”，而是介绍“如何在本仓库里安全地做变更并验证它”。

## 前置要求

- Node.js `>=18.0.0`
- Git `>=2.20`
- 本地已安装 npm（随 Node.js 提供）

## 安装与启动

```bash
npm install
npm run dev -- --help
```

日常调试建议优先使用源码运行：

```bash
npm run dev -- --dry-run
npm run dev -- init
npm run dev -- --list skills
```

如果要验证发布产物，再使用构建后的入口：

```bash
npm run build
node dist/index.js --help
```

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev -- --help` | 通过 `tsx` 直接运行源码 |
| `npm test` | 运行完整 Vitest 测试套件 |
| `npm run build` | 生成 `dist/` 构建产物 |
| `npm run lint:src` | 只检查 `src/` 和 `tests/` |
| `npm run lint` | 检查整个仓库 |
| `npm run release:check` | lint + test + build + `npm pack --dry-run` |

## 当前已验证基线

本次文档扫描期间已实际验证：

- `npm test` 通过：42 个测试文件、1020 个测试用例全部通过
- `npm run build` 通过：ESM 与 DTS 构建成功

如果你在本地改动了运行时行为，至少应重新执行 `npm test` 和 `npm run build`。

## 开发工作流建议

### 改 CLI 参数或入口行为

优先关注：

- `src/index.ts`
- `src/pipeline.ts`
- `tests/cli-args.test.ts`
- `tests/pipeline.test.ts`

### 改认证、clone 或配置行为

优先关注：

- `src/stages/authenticate.ts`
- `src/stages/clone.ts`
- `src/services/config.ts`
- `src/services/git.ts`
- `tests/stages/authenticate.test.ts`
- `tests/stages/clone.test.ts`
- `tests/services/config.test.ts`
- `tests/services/git.test.ts`

### 改工具支持或安装规则

优先关注：

- `src/data/tool-registry.ts`
- `src/data/install-rules.ts`
- `src/stages/match-rules.ts`
- `tests/data/install-rules.test.ts`
- `tests/data/tool-registry.test.ts`
- `tests/stages/match-rules.test.ts`
- `tests/integration/epic-7-eleven-tools.test.ts`

### 改安装器/冲突/安全边界

优先关注：

- `src/stages/execute-install.ts`
- `src/stages/conflict-resolver.ts`
- `src/services/fs-utils.ts`
- `src/services/manifest.ts`
- `tests/stages/execute-install.test.ts`
- `tests/stages/conflict-resolver.test.ts`
- `tests/services/fs-utils.test.ts`
- `tests/services/manifest.test.ts`

### 改文案或双语输出

优先关注：

- `src/core/messages.ts`
- `src/core/reporter.ts`
- `tests/data/messages.test.ts`
- `tests/core/reporter.test.ts`

## 测试结构

### 单元测试

- `tests/core/`
- `tests/data/`
- `tests/services/`
- `tests/stages/`

适合覆盖纯函数、阶段边界、错误码、输出文案和安全条件。

### 集成与 E2E

- `tests/integration/pipeline*.test.ts`
- `tests/integration/dry-run.test.ts`
- `tests/integration/install-modes.test.ts`
- `tests/integration/universal-dirs-sync.test.ts`
- `tests/integration/epic-1-*.test.ts` 到 `epic-7-*.test.ts`

适合验证真实规则集、真实安装计划、跨阶段行为和历史 Story 的回归。

### Fixtures

- `tests/fixtures/sample-repo/`

用于模拟被安装的知识仓库结构。

## 文档与发布联动

这个仓库的“代码变更”和“文档变更”经常是同一件事。常见联动关系：

- 改用户可见行为：同步 `README*`、`docs/`、`CHANGELOG.md`
- 改工具支持：同步 `docs/install-rules-matrix*.md`、`docs/extending*.md`、`README*`
- 改工程规则：同步 `_bmad-output/project-context.md` 和 Rule Document Registry 指向的架构文档

不要把 `docs/` 当成“最后再补”的善后工作；这个项目本身高度依赖文档一致性。

## 本地调试技巧

### 1. 优先使用 dry-run

```bash
npm run dev -- --dry-run
```

这能先验证检测、规则匹配和输出，不会真的写盘。

### 2. 精确观察特定目录

```bash
npm run dev -- --list skills
npm run dev -- --filter "skills/git*"
```

适合调试 `match-rules` 与 filter 逻辑。

### 3. 用构建后的 CLI 做发包前校验

```bash
npm run build
node dist/index.js --version
```

这能避免只在 `tsx` 环境里可运行、打包后却出问题。

### 4. 本地注册全局命令

```bash
npm run build
npm link
aiforge --help
npm unlink -g aiforge
```

适合验证最终用户视角的调用体验。

## 常见注意事项

- `aiforge` 的 npm 包名是 `@fancyliu/aiforge`，但 CLI 命令名始终是 `aiforge`。
- 仓库里有大量 `.github/skills` 与 `_bmad-output/` 文档，做搜索或批量替换时要清楚自己是在改运行时代码还是样本/历史资产。
- `docs/configuration*.md` 目前提到了 `aiforge update`，但源码中未见对应命令实现；涉及命令面改动时要先核对文档与实现。
- Codex/OpenCode 的 MCP 支持是“模板复制 + 手工合并提示”，不是直接改工具自有配置文件。

## 推荐最小验证集

### 改源码

```bash
npm run lint:src
npm test
npm run build
```

### 改会进入 npm 包的内容

```bash
npm run release:check
```

这包括：

- `src/`
- `README*`
- `docs/*.md`
- `CHANGELOG.md`
- `package.json`
- `dist/` 预期内容

---

_Generated using BMAD Method `document-project` workflow_
