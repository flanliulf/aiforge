---
Story: 2-2
Round: 3
Date: 2026-03-24
Model Used: GPT-5.4 (model ID: gpt-5.4)
Type: Code Review Summary
---

# Story 2.2 代码审查总结 — 第 3 轮

## 基本信息

- Story ID: `2-2`
- Story 文件: `_bmad-output/implementation-artifacts/2-2-source-resolver-and-git-service.md`
- 审查类型: 复审
- 审查结论: **Changes Requested**

## 总体结论

Round 2 的两项主要修复中：

- **不支持协议被误解析为 HTTPS** 已关闭：`src/services/git.ts:103-121`
- **`INVALID_URL` 错误详情回显原始 URL** 仅**部分关闭**

本轮质量门禁已全部通过：

- `npm run lint` ✅
- `npm run test` ✅（`260/260`）
- `npm run build` ✅

但复核确认仍有 1 个未闭环的安全问题：当 token-bearing URL 的非法形式是**以裸 `@` 结尾、没有 host/path** 时，`sanitizeUrl()` 不会脱敏，`safeParseUrl()` 仍会把原始 token 直接带入 `AiforgeError.why`。这违反了项目的统一脱敏规则，因此本轮仍建议 **Changes Requested**。

## 上轮问题复核结果

### 1. Finding #1：不支持协议被误解析为合法 HTTPS 源

**已修复。**

- `src/services/git.ts:103-117` 已增加 scheme 白名单，对 `ftp://` / `file://` / 自定义 scheme 抛出 `AiforgeError(code: 'UNSUPPORTED_PROTOCOL')`
- 实测：
  - `ftp://example.com/org/repo.git` → `UNSUPPORTED_PROTOCOL`
  - `file:///tmp/repo.git` → `UNSUPPORTED_PROTOCOL`
  - `custom://host/repo` → `UNSUPPORTED_PROTOCOL`
- 测试已覆盖：`tests/services/git.test.ts:130-156`

### 2. Finding #2：`INVALID_URL` 错误详情回显未脱敏 URL

**部分修复，未完全关闭。**

- 已修部分：
  - `src/services/git.ts:141` 已改为使用 `sanitizeUrl(url)`
  - 对 `https://oauth2:token@:bad/repo` 这类非法 URL，实测已能脱敏
  - 测试已覆盖该变体：`tests/services/git.test.ts:159-176`
- 未关闭部分：
  - 对 `https://oauth2:token@` 这类**无 host/path、以裸 `@` 结束**的非法 URL，仍会原样回显 token

## 本轮问题

### 1. 中优先级【上轮遗留未完全关闭】：`sanitizeUrl()` 无法处理以裸 `@` 结尾的 token-bearing 非法 URL，导致 `INVALID_URL` 仍会泄露原始 token

- 位置：
  - `src/core/sanitize.ts:14-26`
  - `src/services/git.ts:132-147`
  - `tests/core/sanitize.test.ts:33-73`
  - `tests/services/git.test.ts:159-176`
  - `_bmad-output/project-context.md:126-132`
- 现状：
  - `sanitizeUrl()` 当前正则为 `^(https?:\\/\\/)([^@]+)(@.+)$`：`src/core/sanitize.ts:17`
  - 该实现要求 `@` 后面至少还有 1 个字符（`@.+`）
  - 因此：
    - `https://oauth2:glpat-abcdefghijklmno@:bad/repo` → **可脱敏**
    - `https://oauth2:glpat-abcdefghijklmno@` → **不会脱敏**
  - `safeParseUrl()` 在错误路径只调用 `sanitizeUrl(url)`：`src/services/git.ts:132-147`
  - 所以第二种输入会直接把 raw token 带进 `AiforgeError.why`
- 实测：
  - `sanitizeUrl('https://oauth2:glpat-abcdefghijklmno@')`
    - 返回：`https://oauth2:glpat-abcdefghijklmno@`
  - `new GitSourceResolver().resolve('https://oauth2:glpat-abcdefghijklmno@')`
    - 抛出：`AiforgeError(code: 'INVALID_URL')`
    - `why = '无法解析仓库地址: https://oauth2:glpat-abcdefghijklmno@'`
- 风险：
  - `project-context.md:128-132` 明确要求**所有 logs/errors 使用脱敏输出**
  - 当前实现仍允许用户把 token 通过一个更坏的非法 URL 形式打到终端错误输出里
  - 虽然攻击面主要是本地 CLI，但仍会污染终端历史、截图、CI 日志等可见面
- 为什么现有测试没拦住：
  - `tests/services/git.test.ts:162-175` 只覆盖了 `https://oauth2:token@:bad/repo`
  - `tests/core/sanitize.test.ts:59-72` 只覆盖了标准 `oauth2:token@host` 形式
  - 没有覆盖 `https://oauth2:token@` 这类 hostless 非法变体
- 建议：
  - 扩展 `sanitizeUrl()`，让其在 `https?://[user:]token@` 后**即使没有 host/path**也能脱敏
  - 或者在 `safeParseUrl()` 中增加更保守的兜底脱敏逻辑，避免完全依赖当前 `sanitizeUrl()` 的匹配形态
  - 补两类回归测试：
    - `tests/core/sanitize.test.ts`：`https://oauth2:token@` 应返回脱敏结果
    - `tests/services/git.test.ts`：`resolve('https://oauth2:token@')` 的 `why` 不得包含原始 token

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
  - 本轮未观察到由此产生的运行时失败
  - 仍建议在 Story 4.6a 管道正式接线时统一处理

## 已确认通过项

- `resolveDefaultRepo()` 对 `CONFIG_NOT_FOUND` 降级、对 `CONFIG_CORRUPT` / `CONFIG_READ_FAILED` 透传的修复仍然稳定：`src/stages/resolve-source.ts:61-88`
- `resolve-source` 继续通过 `GitSourceResolver` 收口 URL 解析：`src/stages/resolve-source.ts:46-48`
- `UNSUPPORTED_PROTOCOL` 修复与负向测试均已到位：`src/services/git.ts:103-117`、`tests/services/git.test.ts:130-156`
- 门禁全绿，说明当前剩余问题聚焦在**一个脱敏边界漏洞**，不是大面积回归

## 建议修复顺序

1. 先修 `sanitizeUrl()` 对 `https://oauth2:token@` 的脱敏边界
2. 为 `sanitizeUrl()` 和 `GitSourceResolver.resolve()` 补 bare-`@` 回归测试
3. 重新执行 `npm run lint && npm run test && npm run build`
4. 之后再决定是否顺手统一 `resolveSource` / `ResolveFn` / `SourceResolver` 的契约文本与签名

## 最终建议

**本轮结论：Changes Requested。**

Round 2 的协议问题已关闭，质量门禁也保持绿色；当前仅剩 1 个安全类问题未闭环：`INVALID_URL` 在 hostless token-bearing 非法 URL 上仍可能输出 raw token。修复该边界并补回归测试后，可进入第 4 轮快速复审。
