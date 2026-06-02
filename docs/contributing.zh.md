# 贡献指南

本指南面向会修改 `aiforge` 源码、文档或发布产物的贡献者与维护者。

[English Version](contributing.md)

## 贡献类型

- 修改 `src/` 与配套 `tests/`，修复或改进 CLI 的用户可见行为
- 更新 `README*`、`docs/*.md`、`CHANGELOG.md` 等公开文档
- 通过 `src/data/tool-registry.ts`、`src/data/install-rules.ts` 及相关测试新增或调整工具支持

## 开发环境

### 前置要求

- Node.js `>=18.0.0`
- Git `>=2.20`

### 本地工作流

```bash
npm install
npm run dev -- --help
```

日常迭代建议优先使用源码运行：

```bash
npm run dev -- --dry-run
```

发布产物仍然以构建输出为准：

```bash
npm run build
node dist/index.js --help
```

如果需要在本机测试已安装的 `aiforge` 命令：

```bash
npm run build
npm link
aiforge --help
npm unlink -g aiforge
```

## 提交前验证清单

在提交评审前，先跑标准验证：

```bash
npm run lint:src
npm run build
npm test
```

如果变更会进入 npm 包，例如涉及 `README*`、`docs/*.md`、`CHANGELOG.md`、`package.json` 或 `dist/` 预期内容，再补跑更宽的发布门禁：

```bash
npm run release:check
```

## 文档维护要求

### 保持公开文档可发现

- 把 [README](../README.md)、[README.zh.md](../README.zh.md) 和 `docs/` 下页面视为公开文档面
- 用户可见行为变化时，中英文文档需要同步
- 面向发布的核心文档放在 `docs/`；草稿、调研和过程性材料放在 `docs/references/`

### 行为变化时同步正确文档

- 如果变更影响安装流程、配置、迁移或排障，检查并同步对应 `docs/` 页面
- 如果变更对用户可见，更新 [CHANGELOG.md](../CHANGELOG.md) 的发布说明
- 如果变更影响实现规则或工程约定，还要同步 `_bmad-output/project-context.md` 中 Rule Document Registry 列出的规则文档。该本地 agent 规则文件不会随 npm 包发布。

## 新增或调整工具支持

当你新增工具或调整现有工具映射时：

1. 更新 `src/data/` 中的数据源
2. 更新检测、规则匹配、安装行为相关测试
3. 一起检查公开文档：
   - [安装规则矩阵](install-rules-matrix.zh.md)
   - [快速入门](getting-started.zh.md)
   - 兼容性或命名变化时检查 [v2 迁移指南](migration-v2.zh.md)
   - 如果工具清单或产品定位变化，回看 [README](../README.md) 与 [README.zh.md](../README.zh.md)

## 发布维护

凡是会进入 npm 包的变更，按下面的顺序执行：

1. 提升到一个新的、尚未发布的版本号
2. 更新 `README*` 与发布说明中的版本引用
3. 运行 `npm run release:check`
4. 按项目既定流程执行 npm 发布
5. 发布后验证包内容与文档链接

详细发布操作手册见 [npm 发布指南](npm-publishing-guide.zh.md)。

## 提交变更时请附带

- 用户可见影响说明
- 你实际运行过的验证命令
- 行为变化对应的文档更新
- 保持变更边界清晰，不把无关清理和功能修复混在同一次提交里
