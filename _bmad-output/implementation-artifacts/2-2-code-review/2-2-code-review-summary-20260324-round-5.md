---
Story: 2-2
Round: 5
Date: 2026-03-24
Model Used: GPT-5.4 (model ID: gpt-5.4)
Type: Code Review Summary
---

# Story 2.2 代码审查总结 — 第 5 轮

## 基本信息

- Story ID: `2-2`
- Story 文件: `_bmad-output/implementation-artifacts/2-2-source-resolver-and-git-service.md`
- 审查类型: 复审
- 审查结论: **Changes Requested**

## 总体结论

Round 4 指出的 `http://` 协议漂移问题已关闭：

- `GitSourceResolver.canHandle()` 已不再接受 `http://`：`src/services/git.ts:42-55`
- `parseGitUrl()` 的 scheme 白名单已收紧为仅 `https:`：`src/services/git.ts:103-117`
- `http://` 负向测试已补齐：`tests/services/git.test.ts:158-167`

同时本轮质量门禁全部通过：

- `npm run lint` ✅
- `npm run test` ✅（`263/263`）
- `npm run build` ✅

但复审发现 1 个新的结构性校验缺口：当前实现会把**没有仓库路径的 host-only URL** 当成合法 `ResolvedSource` 返回，例如 `https://gitlab.com` 和 `ssh://git@gitlab.com`。这直接违背 Story 2.2 对 `repoPath` 的语义约束，也会把无效输入带入后续认证/克隆阶段。因此本轮仍建议 **Changes Requested**。

## 上轮问题复核结果

### 1. Finding：`http://` URL 被接受并被错误归一化为 `protocol: 'https'`

**已修复。**

- `src/services/git.ts:45-46` 已删除 `http://` 正向识别
- `src/services/git.ts:105` 已仅保留 `parsed.protocol === 'https:'`
- 实测：
  - `resolveSource('http://gitlab.com/org/repo.git', ...)`
    - 抛出 `UNSUPPORTED_PROTOCOL`
    - `why = '不支持的协议: http，仅支持 HTTPS 和 SSH'`
- 测试已覆盖：`tests/services/git.test.ts:32-33,158-167`

## 本轮问题

### 1. 中优先级【新发现】：缺少 `repoPath` 非空校验，host-only URL 会被错误接受为合法仓库地址

- 位置：
  - `src/services/git.ts:82-123`
  - `src/stages/resolve-source.ts:46-48`
  - `src/core/types.ts:33-36`
  - `_bmad-output/implementation-artifacts/2-2-source-resolver-and-git-service.md:13,23-24,54-57,64-72`
  - `_bmad-output/implementation-artifacts/2-3-four-layer-auth-chain.md:103-115`
- 现状：
  - HTTPS / `ssh://` 分支在解析后只做了 `pathname.replace(/^\//, '')` 和 `stripGitSuffix()`
  - 之后**没有检查 `repoPath` 是否为空**
  - 因而以下“结构上像 URL，但不是仓库地址”的输入会被直接接受：
    - `https://gitlab.com` → `{"hostname":"gitlab.com","repoPath":"","protocol":"https"}`
    - `https://gitlab.com/` → `{"hostname":"gitlab.com","repoPath":"","protocol":"https"}`
    - `ssh://git@gitlab.com` → `{"hostname":"gitlab.com","repoPath":"","protocol":"ssh"}`
    - `ssh://git@gitlab.com/` → `{"hostname":"gitlab.com","repoPath":"","protocol":"ssh"}`
  - `resolveSource()` 当前直接透传这一结果：`src/stages/resolve-source.ts:46-48`
- 为什么这是问题：
  - Story 2.2 AC / Task 明确要求解析出 `hostname`、`repoPath`、`protocol`，且示例中的 `repoPath` 语义始终是 `org/repo`：`_bmad-output/implementation-artifacts/2-2-source-resolver-and-git-service.md:13,23-24,54-57,64-72`
  - `ResolvedSource.repoPath` 不是 optional，也没有“允许空字符串”的文档约定：`src/core/types.ts:33-36`
  - 这类输入不是“仓库 URL 解析结果”，而是“缺少仓库路径的主机地址”，应被视为非法输入
- 下游风险：
  - Story 2.3 的认证阶段会基于 `hostname + repoPath` 生成 clone URL：`_bmad-output/implementation-artifacts/2-3-four-layer-auth-chain.md:103-115`
  - 若 `repoPath === ''`，下游很可能构造出：
    - `https://gitlab.com/.git`
    - `git@gitlab.com:.git`
  - 这样错误会被延后到认证/克隆阶段才暴露，用户拿到的报错将偏离根因（实际上是“输入根本不是仓库地址”）
- 为什么现有测试没拦住：
  - 阶段层负向测试只覆盖了“完全不是 URL”的字符串：`tests/stages/resolve-source.test.ts:292-316`
  - 服务层负向测试只覆盖了不支持协议与 token 脱敏：`tests/services/git.test.ts:105-204`
  - 没有覆盖“可被 `URL` 解析，但缺少 repoPath”的结构性无效输入
- 建议：
  - 在 `parseGitUrl()` 的 HTTPS / `ssh://` 分支中，对标准化后的 `repoPath` 增加**非空校验**
  - 对这类 host-only URL 统一抛 `AiforgeError(code: 'INVALID_URL')` 或更明确的 `INVALID_REPO_URL`
  - 补以下回归测试：
    - `tests/services/git.test.ts`
      - `https://gitlab.com`
      - `https://gitlab.com/`
      - `ssh://git@gitlab.com`
      - `ssh://git@gitlab.com/`
    - `tests/stages/resolve-source.test.ts`
      - CLI `source` 为 host-only URL 时应报错
      - `defaultRepo` 为 host-only URL 时应报错

## 低优先级遗留项（本轮不作为主要阻塞理由）

### 1. Resolve 阶段 / `SourceResolver` / `pipeline` 的公开契约仍未完全统一

- 位置：
  - `src/stages/resolve-source.ts:39-43`
  - `src/pipeline.ts:57`
  - `_bmad-output/implementation-artifacts/2-2-source-resolver-and-git-service.md:22,31,43-45`
  - `_bmad-output/planning-artifacts/architecture/03-core-decisions.md:28-30`
- 现状：
  - `resolveSource` 仍为三参签名
  - `pipeline.ResolveFn` 仍为两参签名
  - Story / D1 文本仍写 `resolve(source, options)`
- 评估：
  - 本轮仍未观察到运行时失败
  - 继续建议在 Story 4.6a 管道正式接线时统一处理

## 已确认通过项

- `CONFIG_NOT_FOUND` 降级、`CONFIG_CORRUPT` / `CONFIG_READ_FAILED` 透传修复保持稳定：`src/stages/resolve-source.ts:61-88`
- `ftp://` / `file://` / `custom://` / `http://` 现在都能正确进入拒绝路径：`src/services/git.ts:103-117`、`tests/services/git.test.ts:132-167`
- hostless token-bearing URL 的脱敏与错误输出边界已修复：`src/core/sanitize.ts:14-28`、`tests/core/sanitize.test.ts:74-88`、`tests/services/git.test.ts:178-192`
- 门禁全绿，说明当前剩余问题聚焦在**repoPath 结构校验缺失**，不是回归性质量问题

## 建议修复顺序

1. 先在 `GitSourceResolver` 中补 `repoPath` 非空校验
2. 为 service 层与 stage 层补 host-only URL 负向测试
3. 重新执行 `npm run lint && npm run test && npm run build`
4. 后续在 Story 4.6a 统一 `resolveSource` / `ResolveFn` / `SourceResolver` 的公开契约

## 最终建议

**本轮结论：Changes Requested。**

Round 4 的 HTTP 协议问题已关闭，当前唯一新的阻塞项是：实现会把没有仓库路径的 host-only URL 误判为合法仓库地址，并把空 `repoPath` 传给下游阶段。建议先补结构性校验，再进入第 6 轮快速复审。
