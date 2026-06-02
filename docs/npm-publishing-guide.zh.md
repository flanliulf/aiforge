# npm 构建与发布操作指南

本文记录 ai-forge 发布到 npm 的标准流程、验证命令和本项目已遇到的常见问题。适用于维护者从本地仓库发布 `@fancyliu/aiforge` 新版本。

## 当前发布形态

- npm 包名：`@fancyliu/aiforge`
- CLI 命令名：`aiforge`
- npm registry：`https://registry.npmjs.org/`
- Node.js 要求：`>=18.0.0`
- 构建产物目录：`dist/`
- CLI bin 入口：`dist/index.js`
- 发布访问级别：public

`package.json` 中的关键字段应保持如下形态：

```json
{
  "name": "@fancyliu/aiforge",
  "bin": {
    "aiforge": "dist/index.js"
  },
  "publishConfig": {
    "registry": "https://registry.npmjs.org/",
    "access": "public"
  }
}
```

## 发布前检查

### 1. 确认 npm 登录态

```bash
npm whoami --registry https://registry.npmjs.org/
```

期望输出当前 npm 用户名，例如：

```text
fancyliu
```

如果返回 `E401 Unauthorized`，说明本机 npm 登录态失效，需要重新登录：

```bash
npm login --registry https://registry.npmjs.org/ --auth-type=legacy
```

登录过程中如出现密码或 OTP/2FA 提示，必须直接在终端输入，不要通过聊天、文档或日志传递。

### 2. 确认当前本地版本

```bash
node -p "require('./package.json').name + '@' + require('./package.json').version"
```

示例输出：

```text
@fancyliu/aiforge@2.0.1
```

### 3. 确认远端版本是否已存在

```bash
npm view @fancyliu/aiforge@2.0.1 version --registry https://registry.npmjs.org/
```

如果目标版本不存在，npm 会返回 404，这是可以继续发布的信号。

如果目标版本已存在，不要重复发布同一版本；npm 不允许覆盖已发布版本，应先升级补丁版本。

### 4. 运行发布门禁

```bash
npm run release:check
```

该命令会依次执行：

```bash
npm run lint
npm test
npm run build
npm pack --dry-run
```

重点检查：

- ESLint 和 Prettier 通过
- Vitest 测试全部通过
- `tsup` 构建成功
- `npm pack --dry-run` 的 tarball 内容只包含可公开发布的文件
- `README.md`、`README.zh.md`、`docs/*.md`、`CHANGELOG.md` 被正确包含
- 不包含内部仓库地址、token、缓存目录、测试源码或本地 AI 工具目录

## 修改版本号

补丁版本发布使用：

```bash
npm version patch --no-git-tag-version
```

该命令会同时更新 `package.json` 和 `package-lock.json`。

强制规则：凡是会随 npm 包发布的变更，都必须先提升到一个新的、尚未发布过的版本号。适用范围包括源码、README、`docs/*.md`、`CHANGELOG.md`、`package.json` 元数据以及任何会进入 npm tarball 的文件。

不要在已经发布到 npm 的版本号上继续修改并尝试重新发布。npm 不允许覆盖同一版本；如果本地文件相对 npm latest 有任何新变更，必须先执行 `npm version patch|minor|major --no-git-tag-version`，再运行发布检查和正式发布。

README 中标注的“当前 npm 发布版本”应使用本次待发布版本号。发布完成后，该版本号必须与 npm registry 上的 `latest` dist-tag 保持一致。

注意事项：

- 运行前确认当前目录是仓库根目录。
- 不要在临时安装目录中执行版本升级。
- 升级版本前先确认当前变更确实需要进入 npm 包；升级后不要再回退到已发布版本号。
- 版本升级后应更新 `CHANGELOG.md`。
- 不要自动创建 git tag，除非发布流程明确要求。

## 后续版本更新发布命令

后续每次完成需要进入 npm 包的代码或文档变更后，第一步必须按版本类型选择一个版本升级命令，然后执行发布检查和正式发布。

补丁版本，例如修复文档、修复 bug、兼容性小改动：

```bash
npm version patch --no-git-tag-version
npm run release:check
npm publish --access public --registry https://registry.npmjs.org/ --auth-type=legacy
```

次版本，例如新增向后兼容的功能：

```bash
npm version minor --no-git-tag-version
npm run release:check
npm publish --access public --registry https://registry.npmjs.org/ --auth-type=legacy
```

主版本，例如包含破坏性变更：

```bash
npm version major --no-git-tag-version
npm run release:check
npm publish --access public --registry https://registry.npmjs.org/ --auth-type=legacy
```

发布后统一验证：

```bash
version=$(node -p "require('./package.json').version")
tmpdir=$(mktemp -d /tmp/aiforge-npx-check.XXXXXX)
npm view @fancyliu/aiforge version dist-tags --registry https://registry.npmjs.org/
(cd "$tmpdir" && npx --yes "@fancyliu/aiforge@$version" --version)
curl -L -I https://cdn.jsdelivr.net/npm/@fancyliu/aiforge@latest/README.zh.md
```

如果发布过程中提示 `Enter OTP:`，在终端输入 npm 认证器当前的 6 位一次性验证码。不要把 OTP 写入文档、脚本、聊天记录或 shell 历史。

## 正式发布

在仓库根目录执行：

```bash
npm publish --access public --registry https://registry.npmjs.org/ --auth-type=legacy
```

发布过程中会自动执行 `prepublishOnly`：

```bash
npm run lint && npm test && npm run build
```

如果 npm 提示：

```text
This operation requires a one-time password.
Enter OTP:
```

请输入 npm 认证器当前显示的 6 位一次性验证码。建议等待验证码刚刷新后立即输入，避免过期。

发布成功时会看到类似输出：

```text
+ @fancyliu/aiforge@<version>
```

## 发布后验证

### 1. 验证 npm 远端版本和 latest 标签

```bash
npm view @fancyliu/aiforge version dist-tags --registry https://registry.npmjs.org/
```

期望输出：

```text
version = '<version>'
dist-tags = { latest: '<version>' }
```

### 2. 验证 CLI 可执行

不要在本仓库根目录直接运行 `npx @fancyliu/aiforge@<version>` 验证本包。当前目录本身就是同名 npm package，npm/npx 可能优先使用本地项目上下文，导致 `sh: aiforge: command not found`，即使远端包和 `bin` 元数据都是正确的。

推荐切到干净临时目录验证指定版本：

```bash
version=$(node -p "require('./package.json').version")
tmpdir=$(mktemp -d /tmp/aiforge-npx-check.XXXXXX)
(cd "$tmpdir" && npx --yes "@fancyliu/aiforge@$version" --version)
```

期望输出：

```text
<version>
```

也可以使用临时目录做干净安装验证：

```bash
tmpdir=$(mktemp -d /tmp/aiforge-install-check.XXXXXX)
cd "$tmpdir"
npm init -y >/dev/null
npm install @fancyliu/aiforge@2.0.1 --registry https://registry.npmjs.org/
./node_modules/.bin/aiforge --version
```

### 3. 验证 README 中的中文链接

仓库源文件必须保留 GitHub 友好的相对链接：

```markdown
[中文](README.zh.md)
```

npm 包页面不会可靠地服务 tarball 内的相对 README 文件；同时，部分外部 Markdown 链接如果响应头没有显式 UTF-8 charset，可能在 npm 的预览弹窗中显示乱码。因此 `prepack` 会在打包前临时把 `README.md` 中的中文 README 链接改写为带显式 UTF-8 charset 的 jsDelivr 地址：

```markdown
[中文](https://cdn.jsdelivr.net/npm/@fancyliu/aiforge@latest/README.zh.md)
```

`postpack` 会在打包后恢复仓库源文件。不要把 jsDelivr 链接直接提交到源 `README.md`。

验证命令：

```bash
grep -n "\\[中文\\](README.zh.md)" README.md
npm pack --dry-run --json
grep -n "\\[中文\\](README.zh.md)" README.md
curl -L -I https://cdn.jsdelivr.net/npm/@fancyliu/aiforge@latest/README.zh.md
```

期望状态包含：

```text
HTTP/2 200
content-type: text/markdown; charset=utf-8
```

## 常见问题

### 包名 `aiforge` 已被占用

现象：无法发布裸包名 `aiforge`。

处理：使用 scoped package：

```json
{
  "name": "@fancyliu/aiforge"
}
```

CLI 命令名仍可保持为 `aiforge`：

```json
{
  "bin": {
    "aiforge": "dist/index.js"
  }
}
```

用户运行方式为：

```bash
npx @fancyliu/aiforge --version
```

### scope 或组织没有发布权限

现象：发布到某个组织 scope 时出现 403 或 404 权限错误。

排查：

```bash
npm whoami --registry https://registry.npmjs.org/
npm org ls <org-name> --registry https://registry.npmjs.org/
npm team ls <org-name> --registry https://registry.npmjs.org/
```

处理：

- 确认当前 npm 账号属于目标组织。
- 确认账号有 package publish 权限。
- 如果组织权限暂不可用，可改用个人 scope，例如 `@fancyliu/aiforge`。

### 使用了错误 registry

现象：登录或发布走到了镜像源，例如 npmmirror/cnpm，导致认证或发布失败。

处理：所有发布相关命令显式指定官方 registry：

```bash
--registry https://registry.npmjs.org/
```

可检查当前配置：

```bash
npm config get registry
```

如需切回官方 registry：

```bash
npm config set registry https://registry.npmjs.org/
```

### `E401 Unauthorized`

现象：

```text
npm error code E401
npm error 401 Unauthorized
```

原因：本机 npm 登录态失效或凭据错误。

处理：

```bash
npm login --registry https://registry.npmjs.org/ --auth-type=legacy
npm whoami --registry https://registry.npmjs.org/
```

如果登录时提示密码错误，重新确认 npm 密码；如果启用了 2FA，按终端提示输入 OTP。

### `EOTP`

现象：

```text
npm error code EOTP
npm error This operation requires a one-time password from your authenticator.
```

原因：OTP 未输入、输入错误、使用了恢复码，或验证码已经过期。

处理：重新执行发布命令，等认证器验证码刷新后输入当前 6 位 OTP：

```bash
npm publish --access public --registry https://registry.npmjs.org/ --auth-type=legacy
```

也可以在命令行中附带 OTP，但不推荐写入 shell 历史：

```bash
npm publish --access public --registry https://registry.npmjs.org/ --otp=<current-otp>
```

### web auth `/v1/done` 返回 404

现象：使用 web auth 发布时，浏览器认证后 npm CLI 返回：

```text
npm error 404 Not Found - GET https://registry.npmjs.org/-/v1/done?authId=***
```

处理：改用 legacy auth：

```bash
npm publish --access public --registry https://registry.npmjs.org/ --auth-type=legacy
```

如果仍失败，先确认登录态：

```bash
npm whoami --registry https://registry.npmjs.org/
```

### `npm publish` 返回 `404 Not found or no permission`

现象：

```text
npm error 404 Not Found - PUT https://registry.npmjs.org/@fancyliu%2faiforge
npm error 404 The requested resource '@fancyliu/aiforge@x.y.z' could not be found or you do not have permission to access it.
```

常见原因：

- 当前 npm 会话未登录或已过期。
- 当前账号不是该包 owner。
- scope 权限不足。
- registry 配置错误。

排查：

```bash
npm whoami --registry https://registry.npmjs.org/
npm owner ls @fancyliu/aiforge --registry https://registry.npmjs.org/
npm view @fancyliu/aiforge version dist-tags --registry https://registry.npmjs.org/
```

### `npx` 或 `npm exec --package ... -- aiforge` 找不到命令

在本项目发布验证中，在仓库根目录执行以下形式曾出现 `aiforge: command not found`：

```bash
npx --yes @fancyliu/aiforge@<version> --version
npm exec --yes --package @fancyliu/aiforge -- aiforge --version
```

这通常不是 npm 包损坏，而是因为当前目录本身就是 `@fancyliu/aiforge` package，npm/npx 的本地解析干扰了远端包执行。

推荐改用：

```bash
version=$(node -p "require('./package.json').version")
tmpdir=$(mktemp -d /tmp/aiforge-npx-check.XXXXXX)
(cd "$tmpdir" && npx --yes "@fancyliu/aiforge@$version" --version)
```

如果要确认 bin 元数据和安装产物，可用：

```bash
npm view @fancyliu/aiforge@<version> name version bin --registry https://registry.npmjs.org/
```

期望：

```text
bin = { aiforge: 'dist/index.js' }
```

### npm 包页 README 的中文链接失效或显示乱码

现象：npm 包页面中的 `[中文](README.zh.md)` 打开为 Not Found，或外链可以打开但弹窗中的中文内容显示乱码。

原因：npm 包页面渲染 README 时，不会按普通仓库页面方式解析 tarball 内的相对文件链接；部分 CDN 或重定向后的 Markdown 响应头也可能缺少显式 UTF-8 charset。

处理：仓库源 `README.md` 保持 GitHub 相对链接，npm 打包时由 `prepack/postpack` 生命周期临时改写并恢复。打包产物中的链接应为 jsDelivr `@latest` 绝对链接，该地址返回 `text/markdown; charset=utf-8`：

```markdown
[中文](https://cdn.jsdelivr.net/npm/@fancyliu/aiforge@latest/README.zh.md)
```

`README.md` 和 `README.zh.md` 必须包含在 `package.json` 的 `files` 中：

```json
{
  "files": [
    "dist",
    "README.md",
    "README.zh.md",
    "docs/*.md",
    "CHANGELOG.md"
  ]
}
```

### 避免发布内部信息

发布到 npm 前，确认公开包内容不包含内部仓库地址、内部主机名、访问 token、测试缓存和本地 AI 工具目录。

建议保留以下约束：

- 不在 `package.json` 中写入内部 `repository`、`homepage`、`bugs` URL。
- `.npmignore` 排除 `_bmad-output/`、`_bmad/`、`tests/`、`src/`、本地配置和 AI 工具缓存目录。
- `npm pack --dry-run` 是每次发布前的必跑检查。

## 推荐发布清单

发布前：

```bash
npm whoami --registry https://registry.npmjs.org/
node -p "require('./package.json').name + '@' + require('./package.json').version"
npm view @fancyliu/aiforge@<version> version --registry https://registry.npmjs.org/
npm run release:check
```

其中 `<version>` 必须是 `package.json` 中的当前版本，并且 `npm view @fancyliu/aiforge@<version>` 应返回 404，表示该版本尚未发布。若该命令能查到版本，必须先升级到新的补丁、次版本或主版本后再发布。

发布：

```bash
npm publish --access public --registry https://registry.npmjs.org/ --auth-type=legacy
```

发布后：

```bash
version=$(node -p "require('./package.json').version")
tmpdir=$(mktemp -d /tmp/aiforge-npx-check.XXXXXX)
npm view @fancyliu/aiforge version dist-tags --registry https://registry.npmjs.org/
(cd "$tmpdir" && npx --yes "@fancyliu/aiforge@$version" --version)
curl -L -I https://cdn.jsdelivr.net/npm/@fancyliu/aiforge@latest/README.zh.md
```

## 2.0.1 发布记录摘要

`2.0.1` 是一次补丁发布，目标是修复 npm 包页面 README 中中文链接失效的问题。

变更内容：

- 将 README 语言切换链接改为 unpkg 绝对链接。
- 更新 `CHANGELOG.md`。
- 从 `2.0.0` 升级到 `2.0.1`。

发布验证结果：

```text
npm view: version = 2.0.1, latest = 2.0.1
npx --yes @fancyliu/aiforge@2.0.1 --version: 2.0.1
https://cdn.jsdelivr.net/npm/@fancyliu/aiforge@latest/README.zh.md: HTTP 200, charset=utf-8
```
