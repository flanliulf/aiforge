---
Story: 2-2
Round: 2
Date: 2026-03-24
Model Used: GPT-5.4 (model ID: gpt-5.4)
Type: Code Review Summary
---

# Story 2.2 代码审查总结 — 第 2 轮

## 基本信息

- Story ID: `2-2`
- Story 文件: `_bmad-output/implementation-artifacts/2-2-source-resolver-and-git-service.md`
- 审查类型: 复审
- 审查结论: **Changes Requested**

## 总体结论

Round 1 的主问题已基本关闭：

- `resolveDefaultRepo()` 已只对 `CONFIG_NOT_FOUND` 降级，`CONFIG_CORRUPT` / `CONFIG_READ_FAILED` 直接透传：`src/stages/resolve-source.ts:61-88`
- 非法字符串输入已不再漏出原生 `TypeError`，而是统一抛 `AiforgeError(code: 'INVALID_URL')`：`src/services/git.ts:116-130`
- Resolve 阶段已收口到 `GitSourceResolver`，重复 URL 解析逻辑已删除：`src/stages/resolve-source.ts:46-48`
- 本轮质量门禁通过：`npm run lint` ✅ / `npm run test` ✅（`256/256`）/ `npm run build` ✅

但复审发现 2 个**新问题**，其中 1 个会直接把不支持的协议误解析为合法 `ResolvedSource`，另 1 个会在错误信息中泄露未脱敏的 token-bearing URL；此外，Round 1 提到的签名契约漂移仍有低优先级遗留。

## 上轮问题复核结果

### 1. Finding #1：配置错误被吞掉并误报为 `NO_REPO`

**已修复。**

- `src/stages/resolve-source.ts:64-74` 现在仅对 `CONFIG_NOT_FOUND` 做降级，其他配置错误直接透传
- `tests/stages/resolve-source.test.ts:248-287` 已补 `CONFIG_CORRUPT` / `CONFIG_READ_FAILED` 回归测试

### 2. Finding #2：非法 URL 漏出原生 `TypeError`

**已修复。**

- `src/services/git.ts:116-130` 新增 `safeParseUrl()`，将解析失败统一包装为 `AiforgeError(code: 'INVALID_URL')`
- `tests/services/git.test.ts:105-127` 与 `tests/stages/resolve-source.test.ts:292-300` 已补负向测试

### 3. Finding #3：Resolve 阶段未通过 `SourceResolver` 收口

**部分修复。**

- URL 解析实现已收口到 `GitSourceResolver`：`src/stages/resolve-source.ts:46-48`
- 但公开契约仍未完全统一：
  - `resolveSource` 仍为三参签名：`src/stages/resolve-source.ts:39-43`
  - `pipeline.ResolveFn` 仍为两参签名：`src/pipeline.ts:57`
  - Story Task 1.1 / 2.3 与 D1 仍写的是两参 stage / 带 `options` 的 resolver：`_bmad-output/implementation-artifacts/2-2-source-resolver-and-git-service.md:22,31,43-45`、`_bmad-output/planning-artifacts/architecture/03-core-decisions.md:28-30`

该遗留项目前未造成运行时失败，且本轮存在更直接的功能/安全问题，故维持**低优先级遗留**，不作为本轮唯一阻塞理由。

## 本轮问题

### 1. 中优先级【新发现】：`GitSourceResolver.resolve()` 会接受不支持的协议，并错误标记为 `protocol: 'https'`

- 位置：
  - `src/services/git.ts:81-108`
  - `src/core/types.ts:33-36`
  - `_bmad-output/implementation-artifacts/2-2-source-resolver-and-git-service.md:23-24,64-69`
- 现状：
  - `parseGitUrl()` 只对 `ssh://` 和 SCP-style SSH 做特判
  - 其余所有可被 `new URL()` 解析的字符串都会落入 `src/services/git.ts:102-108`
  - 该分支无论真实 scheme 是什么，都会直接返回 `protocol: 'https'`
  - 同时 `canHandle()` 对这些输入返回 `false`，但 `resolve()` 却成功返回结果，出现同一 resolver 的自相矛盾：
    - `ftp://example.com/org/repo.git` → `canHandle = false`，`resolve = {"hostname":"example.com","repoPath":"org/repo","protocol":"https"}`
    - `file:///tmp/repo.git` → `canHandle = false`，`resolve = {"hostname":"","repoPath":"tmp/repo","protocol":"https"}`
- 风险：
  - Story 2.2 只定义了 HTTPS / SSH 两类知识源；当前实现却把 `ftp://`、`file://` 等不支持协议伪装成合法 `ResolvedSource`
  - `file://` 场景甚至会生成空 `hostname`，破坏 `ResolvedSource` 契约，后续 Story 2.3 的 host 级认证查找与 clone URL 构造都可能建立在错误数据上
  - 当前负向测试仅覆盖“非法字符串”，未覆盖“可解析但不支持的 scheme”：`tests/services/git.test.ts:105-127`
- 建议：
  - 在 `resolve()` 路径显式校验 scheme 白名单，只接受 Story 定义的 HTTPS / SSH（以及若项目确需保留则明确记录是否允许 `http://`）
  - 对 `ftp://`、`file://`、其他自定义 scheme 统一抛 `AiforgeError(code: 'INVALID_URL')` 或语义更清晰的 `UNSUPPORTED_PROTOCOL`
  - 补负向测试覆盖 `ftp://` / `file://`

### 2. 中优先级【新发现】：`INVALID_URL` 的错误详情直接回显原始 URL，违反脱敏规则

- 位置：
  - `src/services/git.ts:120-126`
  - `src/core/sanitize.ts:7-23`
  - `_bmad-output/project-context.md:126-132`
- 现状：
  - `safeParseUrl()` 在构造 `AiforgeError` 时，将 `why` 直接拼接为 ``无法解析仓库地址: ${url}``
  - 该路径没有使用 `sanitizeToken()` / `sanitizeUrl()`
- 实测：
  - 输入 `https://oauth2:glpat-abcdefghijklmno@`
  - 返回：
    - `code = 'INVALID_URL'`
    - `why = '无法解析仓库地址: https://oauth2:glpat-abcdefghijklmno@'`
- 风险：
  - `project-context.md:128-132` 明确要求“所有 logs/errors 使用 `sanitizeToken()`”，并要求 `sanitizeUrl()` 正确处理 `oauth2:token@host` 格式
  - 当前实现会在错误输出中直接暴露用户输入的 token-bearing URL
- 建议：
  - 在 `safeParseUrl()` 中使用 `sanitizeUrl(url)`（至少对 `https?://...@...` 形式做脱敏）
  - 为 token-bearing 非法 URL 增加回归测试，验证 `why` 中不含原始 token

## 已确认通过项

- `resolve-source` 现在已通过 `GitSourceResolver` 统一解析 URL：`src/stages/resolve-source.ts:46-48`
- `CONFIG_CORRUPT` / `CONFIG_READ_FAILED` 透传行为已由测试覆盖：`tests/stages/resolve-source.test.ts:248-287`
- `INVALID_URL` 的基础负向路径已由阶段层和服务层测试覆盖：`tests/stages/resolve-source.test.ts:292-300`、`tests/services/git.test.ts:105-127`
- 本轮 `lint / test / build` 全部通过，说明当前剩余问题集中在协议边界与错误脱敏，而非基础回归

## 建议修复顺序

1. 先限制 `GitSourceResolver.resolve()` 的协议白名单，阻断 `ftp://` / `file://` 被误识别为 HTTPS
2. 在 `INVALID_URL` 错误路径接入 `sanitizeUrl()`，补 token-bearing URL 回归测试
3. 视 Story 4.6a 接线计划，决定是否顺手统一 `resolveSource` / `ResolveFn` / `SourceResolver` 的公开契约

## 最终建议

**本轮结论：Changes Requested。**

Round 1 的主要修复已经完成，质量门禁也已恢复为绿色；但当前仍有 2 个新发现问题未闭环，其中“未支持协议被当作合法 HTTPS 源接受”和“错误详情回显未脱敏 token-bearing URL”都不建议带入下一 Story。建议修复后再做第 3 轮快速复审。
