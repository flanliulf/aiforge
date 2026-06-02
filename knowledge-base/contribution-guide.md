# aiforge - 贡献与协作指南

**日期：** 2026-05-25 14:48:20 +0800

## 适用范围

本指南面向会在本仓库中修改以下内容的贡献者：

- `src/` 与 `tests/`
- `README*`、`docs/*.md`、`CHANGELOG.md`
- `src/data/tool-registry.ts`、`src/data/install-rules.ts`
- `_bmad-output/` 中与规则和架构同步相关的文档

## 主要贡献路径

### 运行时代码变更

典型位置：

- `src/index.ts`
- `src/pipeline.ts`
- `src/stages/`
- `src/services/`

这类变更通常需要同步测试，并检查是否影响公开文档。

### 文档变更

典型位置：

- `README.md`
- `README.zh.md`
- `docs/*.md`
- `CHANGELOG.md`

这类变更如果只是措辞修正，可以只改文档；如果是行为口径变化，需要回头核对实现和测试。

### 工具支持变更

典型位置：

- `src/data/tool-registry.ts`
- `src/data/install-rules.ts`
- 对应 tests
- `docs/install-rules-matrix*.md`
- `docs/extending*.md`
- `README*`

## 基本工作流

### 1. 安装依赖

```bash
npm install
```

### 2. 先在源码模式验证

```bash
npm run dev -- --help
```

### 3. 改代码或文档

推荐保持单一主题边界，不把无关清理和功能修复混在一起。

### 4. 运行验证

最小验证集：

```bash
npm run lint:src
npm test
npm run build
```

若变更会进入 npm 包，再运行：

```bash
npm run release:check
```

## 文档同步规则

### 公开文档面

以下内容属于用户可见的公开文档面：

- `README.md`
- `README.zh.md`
- `docs/` 下的核心页面

用户可见行为变更时，应同步检查这些文件是否需要更新。

### Rule Document Registry

如果变更影响实现规则、工程约定、豁免边界或架构决策，需要同步 Rule Document Registry 指向的文档。当前项目至少应核对：

- `_bmad-output/project-context.md`
- `_bmad-output/planning-artifacts/architecture/03-core-decisions.md`
- `_bmad-output/planning-artifacts/architecture/04-implementation-patterns.md`

不要只改其中一份。

### 文档归属

- 面向发布的核心用户文档放 `docs/`
- 草稿、调研、过程性材料放 `docs/references/`
- 规划/Story/CR/retro 等实施产物放 `_bmad-output/`

## 提交前检查单

- 变更边界是否清晰
- 对应测试是否更新
- 公开文档是否需要同步
- 若涉及规则边界，Rule Document Registry 三文档是否同步
- 若会进入 npm 包，是否运行 `npm run release:check`

## 提交说明建议

提交或评审说明里至少给出：

- 用户可见影响
- 实际运行的验证命令
- 是否同步更新文档
- 若有已知残留风险，明确写出

## 新增或调整工具支持时的额外要求

建议按下面顺序做：

1. 更新 `src/data/tool-registry.ts`
2. 更新 `src/data/install-rules.ts`
3. 更新对应 unit/integration tests
4. 更新 `docs/install-rules-matrix*.md`
5. 视影响更新 `docs/getting-started*.md`、`docs/migration-v2*.md`、`README*`

## 发布维护者额外责任

凡是会进入 npm 包的改动，维护者还需要：

1. 升级版本号
2. 更新版本引用
3. 运行 `npm run release:check`
4. 发布前确认 tarball 内容正确
5. 发布后验证远端包可执行

## 当前仓库的协作现实

这个仓库不是“只有源码”的仓库。它同时包含：

- 大量知识仓库样本（`.github/skills` 等）
- 大量 brownfield 规划与审查文档（`_bmad-output/`）

因此在做搜索、批量改名或全局替换时，要先明确你的作用域。很多文件是证据或样本，不应该被当成运行时代码一并清理。

---

_Generated using BMAD Method `document-project` workflow_
