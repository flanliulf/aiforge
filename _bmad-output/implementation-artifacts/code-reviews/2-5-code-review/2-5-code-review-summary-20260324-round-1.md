---
Story: 2-5
Round: 1
Date: 2026-03-24
Model Used: GPT-5.4
Type: Code Review Summary
---

# 审查结论

结论：**需要修复后再进入下一步**。`init` 主流程、目标测试、构建与 lint 均通过，但仍存在 2 个高优先级问题和 1 个中优先级问题，分别影响 AC #3、AC #4 与 URL 输入错误语义。

## 审查范围

- Story：`_bmad-output/implementation-artifacts/2-5-aiforge-init-interactive-setup.md`
- 实现：`src/commands/init.ts`
- 测试：`tests/commands/init.test.ts`
- 关联契约：`src/services/config.ts`、`src/services/git.ts`、`_bmad-output/project-context.md`

## 发现列表

### 1. [高] Token 验证在 SCP/非 URL 输入下可能“假成功”，并未真正校验 Token（AC #3）

- 位置：`src/commands/init.ts:165-190`
- 现状：`verifyTokenConnection()` 仅在 `new URL(repoUrl)` 成功时才构造 `https://oauth2:<token>@host/...`；一旦解析失败，就直接回退到 `tokenUrl = repoUrl`（`src/commands/init.ts:171-174`）。
- 问题：如果用户输入的是 `git@host:org/repo.git` 这类 SCP-style SSH 地址并选择 Token 认证，`git ls-remote` 实际测试的是原始 SSH 地址，而不是输入的 Token。只要本机 SSH Key 可用，就会打印“✅ Token 验证成功”，并把一个**未被验证过的 token**写入配置。
- 影响：直接违反 AC #3 “验证 Token 有效性”；后续真正走 Token clone 时才会暴露问题，用户会被误导为“init 已验证通过”。
- 佐证：当前 Token 测试只覆盖 HTTPS URL（`tests/commands/init.test.ts:241-319`），没有覆盖 `SSH URL + Token` 组合。
- 建议：先用 `GitSourceResolver.resolve()` 规范化仓库地址，再基于解析结果构造 token clone URL；**不要**在 Token 路径回退到原始 `repoUrl`。同时新增 `SSH URL + Token` 的负向/正向回归测试。

### 2. [高] “已有配置 → 修改” 会整对象重写，导致已有字段和其它 host 凭据丢失（AC #4）

- 位置：`src/commands/init.ts:115-131`
- 现状：保存时直接新建
  `const config: AiforgeConfig = { defaultRepo, auth: { [hostname]: ... } }`，没有合并 `existingConfig`。
- 问题：这会无提示删除已有 `cloneDir`、`language`、以及 `auth` 中其它 hostname 的凭据。
- 影响：与 AC #4 “显示当前配置，允许修改或保持不变”的用户预期不符。用户只是修改默认仓库/认证方式，却会顺带丢失其它持久化配置。
- 佐证：配置契约明确包含 `cloneDir`、`language` 和 multi-host `auth`（`tests/services/config.test.ts:28-36`，`tests/services/config.test.ts:171-182`）；当前 init 测试仅断言“调用了 saveConfig”，没有守住“原字段必须保留”（`tests/commands/init.test.ts:376-403`）。
- 建议：以 `existingConfig ?? { auth: {} }` 为基础 merge，仅覆盖 `defaultRepo`、`preferSSH` 和当前 `auth[hostname]`；新增“保留其它字段/其它 host 凭据”的回归测试。

### 3. [中] URL 语义校验放在连接验证之后，`INVALID_URL` / `UNSUPPORTED_PROTOCOL` 被泛化成认证失败（AC #1）

- 位置：`src/commands/init.ts:91-113`、`src/commands/init.ts:140-190`
- 现状：`runInit()` 先执行 `verifySshConnection()` / `verifyTokenConnection()`，成功后才 `resolver.resolve(repoUrl)`。
- 问题：这绕过了 `GitSourceResolver` 已有的 URL 契约。对 `not-a-url`、`http://...`、`ftp://...` 等输入，用户拿到的是“SSH/Token 连接失败”，而不是 `INVALID_URL` / `UNSUPPORTED_PROTOCOL` 之类的明确参数错误。
- 影响：错误语义被误报，用户难以判断是 URL 写错、协议不支持，还是认证失败；也与 Story Dev Notes 里“先解析 URL，再做连接验证”的顺序不一致。
- 佐证：`GitSourceResolver` 已有完整负向契约测试（`tests/services/git.test.ts:105-193`），但 init 测试没有覆盖这些场景（`tests/commands/init.test.ts`）。
- 建议：把 `resolver.resolve(repoUrl)` 提前到任何网络请求之前；解析失败直接透传 `AiforgeError`，连接失败再输出 SSH/Token 三段式提示。

## 其他建议

- `src/commands/init.ts:180-205` 的 `sanitizeTokenDisplay()` 与 `src/core/sanitize.ts:7-12` 的 `sanitizeToken()` 逻辑重复，建议复用统一安全函数，避免后续规则调整时出现脱敏分叉。
- `verifySshConnection()` / `verifyTokenConnection()` 目前使用 `catch {}`，与 project-context 的“catch 必须区分错误类型”规则不完全一致；修复上面 3 个问题时建议一并收敛。

## 验证记录

- `npm test -- --run tests/commands/init.test.ts` ✅
- `npm run build` ✅
- `npm run lint` ✅

## 总体判断

当前实现主链路可运行，但 AC #3 / AC #4 仍有实质性缺口；建议先修复以上问题，再进入 CR 评估或合并阶段。
