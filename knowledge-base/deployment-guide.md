# aiforge - 交付与发布指南

**日期：** 2026-05-25 14:48:20 +0800

## 交付模型

`aiforge` 没有服务器部署拓扑，也没有长期运行的后端服务。它的“部署”本质上是：

1. 通过 CI 执行质量门禁
2. 构建 `dist/` 产物
3. 以 npm 包形式发布
4. 让用户通过 `npx @fancyliu/aiforge` 或安装后的 `aiforge` 命令使用

因此，这里的重点不是容器、Kubernetes 或环境编排，而是 **npm 包交付链**。

## 构建产物

根据 `package.json`，发布包的关键内容包括：

- `dist/`
- `README.zh.md`
- `docs/*.md`
- `CHANGELOG.md`

CLI 入口通过 `bin` 字段映射为：

```json
{
  "bin": {
    "aiforge": "dist/index.js"
  }
}
```

## CI 流水线

仓库当前使用 GitLab CI，定义在 `.gitlab-ci.yml`。

### 阶段

- `test`
- `publish`

### quality 作业

在 `test` 阶段执行：

```bash
npm run lint
npm test
npm run build
npm pack --dry-run
```

这意味着 CI 已把“代码风格、测试、构建、最终打包面”全部纳入基础质量门禁。

### publish:npm 作业

发布作业满足以下特点：

- 仅在 `CI_COMMIT_TAG` 条件下出现
- 发布行为是 `manual`
- 使用 `NPM_TOKEN` 对 npm registry 认证

脚本：

```bash
npm config set //registry.npmjs.org/:_authToken "$NPM_TOKEN"
npm publish --access public
```

## 本地发布前步骤

面向维护者的本地门禁应至少覆盖：

```bash
npm run release:check
```

该命令串联：

```bash
npm run lint
npm test
npm run build
npm pack --dry-run
```

如果要正式发布，还应检查：

- 当前版本号是否为一个未发布的新版本
- `README*`、`CHANGELOG.md` 与文档中的版本引用是否已同步
- 包内容是否没有误带内部地址、敏感 token 或本地缓存

## 推荐发布顺序

### 1. 升级版本

```bash
npm version patch --no-git-tag-version
```

或按需要使用 `minor` / `major`。

### 2. 运行发布门禁

```bash
npm run release:check
```

### 3. 发布

```bash
npm publish --access public --registry https://registry.npmjs.org/ --auth-type=legacy
```

## 发布后验证

建议至少执行以下检查：

```bash
version=$(node -p "require('./package.json').version")
tmpdir=$(mktemp -d /tmp/aiforge-npx-check.XXXXXX)
npm view @fancyliu/aiforge version dist-tags --registry https://registry.npmjs.org/
(cd "$tmpdir" && npx --yes "@fancyliu/aiforge@$version" --version)
```

验证目标：

- npm registry 上的版本与 `latest` 标签一致
- 远端包的 CLI 命令可执行
- 不是误用了当前仓库本地上下文

## 风险控制

### 凭据安全

- Token 不应写入仓库、文档、脚本历史或日志
- `clone.ts` 会在 token clone 后清理 remote URL
- 发布依赖 `NPM_TOKEN` 环境变量，而不是把凭据提交进仓库

### 包内容安全

`npm pack --dry-run` 是很重要的一道门，它能提前暴露：

- 意外带入的私有文档
- 不该公开的测试或本地目录
- README/docs 引用不一致

### 文档一致性

这是一个对文档质量敏感的项目。只要行为会进入 npm 包，就不应只改代码不改文档。

## 与运行时交付相关的关键文件

- `package.json`
- `tsup.config.ts`
- `.gitlab-ci.yml`
- `README.md`
- `README.zh.md`
- `docs/*.md`
- `CHANGELOG.md`
- `docs/npm-publishing-guide.zh.md`

## 当前已验证状态

在本次扫描中已确认：

- `npm run build` 成功
- `npm test` 成功
- `.gitlab-ci.yml` 中存在完整的 `quality` 和 `publish:npm` 流程定义

## 建议的下一层自动化

如果后续还要继续提升交付确定性，优先级建议如下：

1. 增加对最终 tarball 内容的更细粒度断言
2. 在 CI 中增加 README/docs 关键链接校验
3. 把“文档与实现一致性”做成自动检查，而不是只靠人工 review

---

_Generated using BMAD Method `document-project` workflow_
