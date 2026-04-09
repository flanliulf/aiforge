---
Story: 2-5
Round: 2
Date: 2026-03-24
Model Used: GPT-5.4
Type: Code Review Summary
---

# 审查结论

结论：**仍需修复后再评估**。参考 Round 1 的审查总结与评估结果后复审当前实现，未见对上轮必修项的有效修复；Round 1 的 3 个问题全部仍然存在，且本轮新增 1 个高优先级问题，直接影响 AC #2。

## 复审上下文

- 已参考：`_bmad-output/implementation-artifacts/2-5-code-review/2-5-code-review-summary-20260324-round-1.md`
- 已参考：`_bmad-output/implementation-artifacts/2-5-code-review/2-5-code-review-evaluation-20260324-round-1.md`
- 最新评估文件未包含 `## 修复执行记录`；当前 `src/commands/init.ts` 与 `tests/commands/init.test.ts` 也未体现对 Round 1 必修项的修复或对应回归测试。

## 发现列表

### 1. [上轮遗留][高] Token 验证仍未基于解析后的规范化仓库地址，SCP/SSH 输入下仍可能假成功或验证错误协议（AC #3）

- 位置：`src/commands/init.ts:94-100`、`src/commands/init.ts:110-113`、`src/commands/init.ts:165-190`
- 现状：`runInit()` 仍在 `resolver.resolve(repoUrl)` 之前执行 `verifyTokenConnection(repoUrl, token)`；`verifyTokenConnection()` 仍然只对 `new URL(repoUrl)` 成功的场景拼接 token URL，失败时回退到原始 `repoUrl`。
- 问题：
  - `git@host:org/repo.git`（SCP-style）会直接回退到原始 SSH 地址，`git ls-remote` 实际没有验证 token。
  - `ssh://git@host/org/repo.git` 会构造 `ssh://oauth2:<token>@host/...`，验证的也不是项目既定的 HTTPS token 认证路径。
- 影响：AC #3 要求“验证 Token 有效性”，但当前实现仍可能在 token 未被实际验证时输出“✅ Token 验证成功”。
- 佐证：管道中的规范 token URL 仍是 `https://oauth2:${token}@${source.hostname}/${source.repoPath}.git`（`src/stages/authenticate.ts:24-26`、`src/stages/authenticate.ts:72-77`、`src/stages/authenticate.ts:105-109`）；而当前 `init` 测试仍只覆盖 `HTTPS URL + Token`（`tests/commands/init.test.ts:259-319`），没有覆盖 `SCP/ssh:// + Token`。
- 建议：先 `resolver.resolve(repoUrl)`，再基于解析后的 `hostname/repoPath` 构造规范 token URL；禁止回退到原始 `repoUrl`。

### 2. [新增][高] SSH 验证没有真正验证 SSH 连接，`HTTPS URL + SSH` 路径会误报成功（AC #2）

- 位置：`src/commands/init.ts:101-102`、`src/commands/init.ts:140-146`
- 现状：用户只要选择 SSH，`runInit()` 就把原始 `repoUrl` 直接传给 `verifySshConnection()`；`verifySshConnection()` 再对这个原始地址执行 `git ls-remote`。
- 问题：如果用户输入 `https://gitlab.example.com/org/repo.git` 并选择 SSH，当前验证测到的是 HTTPS/公开访问能力，而不是 `git@host:path.git` 的 SSH 连接能力。
- 影响：`init` 可能输出“✅ SSH 连接成功”，但后续真实运行时，管道会按 `auth[host].method === 'ssh'` 走 SSH clone URL（`src/stages/authenticate.ts:28-30`、`src/stages/authenticate.ts:97-103`），最终在真正使用 SSH 时失败。该行为直接违反 AC #2 “尝试 SSH 连接到 Git 服务器”。
- 佐证：当前 SSH 测试只覆盖 `SSH URL + SSH`（`tests/commands/init.test.ts:181-214`），没有覆盖 `HTTPS URL + SSH` 的正反向场景。
- 建议：与 Token 路径同样，先解析 `repoUrl`，再按 `git@${hostname}:${repoPath}.git` 构造 SSH 校验地址，不要直接复用用户输入的原始 URL。

### 3. [上轮遗留][中高] “已有配置 → 修改” 仍会整对象重写，覆盖其它字段和其它 host 凭据（AC #4）

- 位置：`src/commands/init.ts:115-131`
- 现状：保存时仍直接构造新的 `AiforgeConfig`，只写入当前 `defaultRepo` 与当前 `auth[hostname]`。
- 问题：`cloneDir`、`language` 以及其它 hostname 的 `auth` 仍会被无提示丢失。
- 影响：与 AC #4“显示当前配置，允许修改或保持不变”的用户预期不符；用户只是修改当前仓库/认证方式，却会丢掉未改动的持久化配置。
- 佐证：配置契约仍明确包含 `cloneDir`、`language`、multi-host `auth`（`tests/services/config.test.ts:28-36`、`tests/services/config.test.ts:171-182`）；当前 `init` 测试仍只断言“调用了 saveConfig”，没有断言“旧字段必须保留”（`tests/commands/init.test.ts:376-403`）。
- 建议：以 `existingConfig ?? { auth: {} }` 为基础 merge，仅覆盖当前 story 需要更新的字段。

### 4. [上轮遗留][低] URL 语义校验仍在连接验证之后，错误类型继续被泛化为认证失败（AC #1）

- 位置：`src/commands/init.ts:91-113`
- 现状：当前流程仍先做连接验证，再做 `resolver.resolve(repoUrl)`。
- 问题：`INVALID_URL` / `UNSUPPORTED_PROTOCOL` 等参数错误仍会在 `init` 中被用户感知成“SSH/Token 连接失败”，错误语义不精确。
- 影响：用户难以区分是 URL 写错、协议不支持，还是认证信息无效；同时这也延续了 Round 1 评估中指出的“应随 Finding #1 一并修复”的问题。
- 佐证：`GitSourceResolver` 的负向契约测试仍然完备（`tests/services/git.test.ts:105-193`），但 `init` 测试仍未覆盖这些输入。
- 建议：将 `resolver.resolve(repoUrl)` 提前到任何网络验证之前，解析失败直接透传 `AiforgeError`。

## 测试观察

当前 `tests/commands/init.test.ts` 仍缺少以下回归场景：

- `HTTPS URL + SSH`：确保实际验证的是 SSH 连接而非 HTTPS 访问
- `SCP/ssh:// + Token`：确保实际验证的是规范 token URL，而非原始 SSH 地址或错误协议
- “已有配置 → 修改” 保留 `cloneDir` / `language` / 其它 host `auth`

## 验证记录

- `npm test -- --run tests/commands/init.test.ts` ✅
- `npm run build` ✅
- `npm run lint` ✅

## 总体判断

Round 1 的阻塞问题仍未关闭，且本轮新增 1 个直接命中 AC #2 的高优先级问题。建议先完成修复并补齐回归测试，再进入下一轮评估。
