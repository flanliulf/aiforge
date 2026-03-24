---
Story: 2-2
Round: 4
Date: 2026-03-24
Model Used: GPT-5.4 (model ID: gpt-5.4)
Type: Code Review Summary
---

# Story 2.2 代码审查总结 — 第 4 轮

## 基本信息

- Story ID: `2-2`
- Story 文件: `_bmad-output/implementation-artifacts/2-2-source-resolver-and-git-service.md`
- 审查类型: 复审
- 审查结论: **Changes Requested**

## 总体结论

Round 3 指出的 bare-`@` token 脱敏边界问题已关闭：

- `sanitizeUrl()` 已从 `(@.+)` 扩展为 `(@.*)`，可覆盖 `https://oauth2:token@`：`src/core/sanitize.ts:14-28`
- `safeParseUrl()` 的 `INVALID_URL` 错误输出已验证不会再泄露 hostless token-bearing URL：`src/services/git.ts:132-147`
- 回归测试已补齐：`tests/core/sanitize.test.ts:74-88`、`tests/services/git.test.ts:178-192`

同时本轮质量门禁全部通过：

- `npm run lint` ✅
- `npm run test` ✅（`263/263`）
- `npm run build` ✅

但复审中发现 1 个此前漏检的协议契约问题：当前实现仍会接受 `http://` URL，并把它归一化为 `protocol: 'https'`。这与 Story / NFR 中“仅支持 HTTPS 和 SSH”不一致，也会让后续认证/克隆阶段在错误的协议假设上继续运行。因此本轮结论仍为 **Changes Requested**。

## 上轮问题复核结果

### 1. Finding：`sanitizeUrl()` 无法处理 hostless token-bearing URL

**已修复。**

- `src/core/sanitize.ts:17-27` 已支持 `https://oauth2:token@` / `https://token@`
- 实测：
  - `sanitizeUrl('https://oauth2:glpat-abcdefghijklmno@')`
    - 返回：`https://oauth2:glpat-ab****lmno@`
  - `new GitSourceResolver().resolve('https://oauth2:glpat-abcdefghijklmno@')`
    - 抛出 `INVALID_URL`
    - `why = '无法解析仓库地址: https://oauth2:glpat-ab****lmno@'`
- 测试已覆盖：
  - `tests/core/sanitize.test.ts:74-88`
  - `tests/services/git.test.ts:178-192`

## 本轮问题

### 1. 中优先级【新发现】：`http://` URL 仍被接受，并被错误归一化为 `protocol: 'https'`

- 位置：
  - `src/services/git.ts:45-46`
  - `src/services/git.ts:103-121`
  - `tests/services/git.test.ts:32-33`
  - `src/core/types.ts:33-36`
  - `_bmad-output/implementation-artifacts/2-2-source-resolver-and-git-service.md:13,23,30,64-72`
  - `_bmad-output/planning-artifacts/prd.md:487`
  - `_bmad-output/implementation-artifacts/2-3-four-layer-auth-chain.md:103-115`
- 现状：
  - `GitSourceResolver.canHandle()` 仍将 `http://...` 视为合法输入：`src/services/git.ts:45-46`
  - `parseGitUrl()` 在 `http://...` 场景下会直接返回：
    - `hostname = ...`
    - `repoPath = ...`
    - `protocol = 'https'`
  - 实测：
    - `canHandle('http://gitlab.com/org/repo.git')` → `true`
    - `resolve('http://gitlab.com/org/repo.git')` → `{"hostname":"gitlab.com","repoPath":"org/repo","protocol":"https"}`
- 为什么这是问题：
  - Story 2.2 AC / Task / URL 表格只定义了 **HTTPS / SSH**：`_bmad-output/implementation-artifacts/2-2-source-resolver-and-git-service.md:13,23-24,30,64-72`
  - 类型契约 `ResolvedSource.protocol` 也只允许 `'https' | 'ssh'`：`src/core/types.ts:33-36`
  - Epic / PRD / readiness 文档均写的是“支持 HTTPS 和 SSH 两种 Git 协议”：`_bmad-output/planning-artifacts/prd.md:487`
  - 但当前实现既没有拒绝 HTTP，也没有显式表达 `http`，而是把它伪装成 `https`
- 风险：
  - `protocol` 字段不再真实反映用户输入协议
  - Story 2.3 的认证阶段当前只构造 `https://...` 或 `git@...` clone URL：`_bmad-output/implementation-artifacts/2-3-four-layer-auth-chain.md:103-115`
  - 因此 `http://` 输入会被静默“升级”为 `https://` 语义；如果目标仓库只提供 HTTP，该问题会延后到认证/克隆阶段才暴露，且诊断会偏离根因
  - 当前错误提示又写着“仅支持 HTTPS 和 SSH”，但 `http://` 实际不会触发该错误，形成实现/提示自相矛盾
  - `tests/services/git.test.ts:32-33` 还把这种偏离编码成了预期行为，后续更难自然纠偏
- 建议：
  - **首选**：严格按 Story / NFR 收口，只接受 `https://`、`ssh://`、SCP-style SSH；将 `http://` 视为 `UNSUPPORTED_PROTOCOL`
  - 同步删除/更新 `tests/services/git.test.ts:32-33` 的 HTTP 正向断言，并补 `http://` 负向测试
  - 如果团队确实要支持 HTTP，则这已不是“修 bug”，而是**规则/契约变更**：
    - 需要扩展 `ResolvedSource.protocol`
    - 需要同步更新 Story、Epic/PRD、以及 Rule Document Registry 中列出的架构文档
  - 就当前项目文档与下游设计来看，**拒绝 HTTP** 是更小、更一致的修复路径

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
  - 本轮未观察到运行时失败
  - 继续建议在 Story 4.6a 管道正式接线时统一处理

## 已确认通过项

- `CONFIG_NOT_FOUND` 降级 / `CONFIG_CORRUPT` 与 `CONFIG_READ_FAILED` 透传修复仍稳定：`src/stages/resolve-source.ts:61-88`
- URL 解析继续收口在 `GitSourceResolver`，未见回归：`src/stages/resolve-source.ts:46-48`
- `ftp://` / `file://` / `custom://` 现在都能正确抛 `UNSUPPORTED_PROTOCOL`：`src/services/git.ts:103-117`、`tests/services/git.test.ts:132-156`
- bare-`@` token 脱敏边界与端到端错误输出均已补回归测试：`tests/core/sanitize.test.ts:74-88`、`tests/services/git.test.ts:178-192`
- 门禁全绿，说明当前剩余问题集中在**HTTP 语义漂移**，不是大面积回归

## 建议修复顺序

1. 先决定 `http://` 的产品/契约语义：
   - 若按现有 Story/NFR 执行 → 直接拒绝 HTTP
   - 若要支持 HTTP → 走文档与类型契约同步变更流程
2. 更新 `GitSourceResolver.canHandle()` / `parseGitUrl()` 与对应测试
3. 重新执行 `npm run lint && npm run test && npm run build`
4. 后续在 Story 4.6a 统一 `resolveSource` / `ResolveFn` / `SourceResolver` 的公开契约

## 最终建议

**本轮结论：Changes Requested。**

Round 3 的安全边界问题已关闭，当前唯一阻塞项是一个此前漏检的协议契约问题：`http://` 仍被接受并被错误映射为 `https`。该问题会让 Resolve 输出与 Story / NFR / 下游认证设计产生语义漂移。建议先收口 HTTP 行为，再进入下一轮快速复审。
