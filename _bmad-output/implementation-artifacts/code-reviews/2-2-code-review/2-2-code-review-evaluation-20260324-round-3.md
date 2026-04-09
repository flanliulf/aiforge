---
Story: 2-2
Round: 3
Date: 2026-03-24
Model Used: Claude Sonnet 4 (via Claude Code)
Review Source: 2-2-code-review-summary-20260324-round-3.md
Review Model: GPT-5.4 (model ID: gpt-5.4)
Type: Code Review Evaluation
---

# Story 2.2 代码审查结果评估 — 第 3 轮

## 评估概要

本轮评估针对 GPT-5.4 对 Story 2-2 的第 3 轮复审结果。Round 2 评估确认的 2 个问题已修复（scheme 白名单 + safeParseUrl 脱敏），本轮复审发现 `sanitizeUrl()` 的正则边界漏洞导致 hostless token-bearing URL 仍可泄露原始 token。通过源码逐行验证和正则分析，对本轮发现进行独立评估。

**评估总体结论：1 条主要发现经代码验证确认为真实问题，非误报。建议采纳修复。1 条低优先级遗留项继续推迟。**

---

## 上轮问题复核评估

CR 对 Round 2 两个 Finding 的复核结论准确，与源码一致：

| Finding | CR 复核结论 | 评估确认 |
|---------|------------|---------|
| #1 不支持协议被误解析为 HTTPS | ✅ 已修复 | ✅ 确认。`git.ts:103-117` scheme 白名单已到位，`ftp://`/`file://`/`custom://` 测试覆盖 (`git.test.ts:130-156`) |
| #2 INVALID_URL 错误回显未脱敏 URL | ⚠️ 部分修复 | ✅ 确认"部分修复"判断准确。`git.ts:141` 已接入 `sanitizeUrl(url)`，但 `sanitizeUrl` 自身存在正则边界问题 |

---

## 逐条评估

### Finding #1（中优先级）：`sanitizeUrl()` 无法处理以裸 `@` 结尾的 token-bearing 非法 URL

| 维度 | 评估 |
|------|------|
| 问题描述准确性 | ✅ **准确** |
| 严重性判断 | ⚠️ **偏高，建议降为低优先级** |
| 修复建议可行性 | ✅ **可行** |
| 是否误报 | ❌ **非误报** |

**评估详情：**

**1. 正则分析确认问题存在**

`sanitize.ts:17` 的正则：

```
/^(https?:\/\/)([^@]+)(@.+)$/
```

分解分析：
- 第 1 组 `(https?:\/\/)` — 匹配 `https://` 或 `http://`
- 第 2 组 `([^@]+)` — 匹配 userinfo（token 部分），要求至少 1 个非 `@` 字符
- 第 3 组 `(@.+)` — 匹配 `@` 加**至少 1 个字符**

关键：第 3 组 `@.+` 要求 `@` 后面必须还有内容（`.+` = 1 或多个任意字符）。因此：

- `https://oauth2:token@gitlab.com/repo` → ✅ 匹配（`@` 后有 `gitlab.com/repo`）
- `https://oauth2:token@:bad/repo` → ✅ 匹配（`@` 后有 `:bad/repo`）
- `https://oauth2:token@` → ❌ 不匹配（`@` 后无字符，`.+` 失败）

当正则不匹配时，`String.replace()` 返回原字符串不变，即 raw token 原样输出。

**2. 调用链确认泄露路径**

```
resolve('https://oauth2:token@')
  → parseGitUrl(url)
    → safeParseUrl(url)               // git.ts:104
      → new URL(url)                   // 抛 TypeError（无效 URL）
      → catch: sanitizeUrl(url)        // git.ts:141
        → 正则不匹配 → 返回原始 URL
      → AiforgeError.why = '无法解析仓库地址: https://oauth2:token@'
```

泄露路径代码证据完整。

**3. 严重性评估 — 建议降为低优先级**

CR 将此定为"中优先级"，评估认为应降级，理由如下：

- **触发条件极其刻意**：用户必须传入 `https://oauth2:token@`（无 host、无 path、以裸 `@` 结尾）这种完全无意义的 URL。正常使用中不会出现此形态。
- **攻击面仅限本地 CLI**：错误消息通过 `Reporter` 输出到用户自己的终端，不会远程传输。泄露风险仅在终端历史/截图/CI 日志等间接场景。
- **不是功能性 bug**：这是一个防御性脱敏的边界遗漏，不影响核心功能的正确性。
- **但 project-context.md 规则是硬性约束**：`project-context.md:128` 明确要求"All logs/errors use `sanitizeToken()`"，即使边界极端也应遵守。

综合考虑：确认需要修复，但严重性为**低优先级**而非中优先级。修复成本极低（扩展正则即可），建议本轮一并处理。

**4. 修复建议可行性评估**

CR 提供了两种方案：

*方案 A：扩展 `sanitizeUrl()` 正则*
- 将 `(@.+)$` 改为 `(@.*)$` 或 `(@.*)?$`，允许 `@` 后无字符的情况
- ✅ 最小变更，保持现有逻辑结构
- ⚠️ 需注意：改为 `(@.*)$` 后，`https://no-at-sign` 这类无 `@` 的 URL 行为不变（第 2 组 `[^@]+` 消耗全部字符，没有 `@` 可供第 3 组匹配）

*方案 B：在 `safeParseUrl()` 增加兜底脱敏*
- 在调用 `sanitizeUrl()` 后，额外检查返回值是否仍包含疑似 token 的内容
- ❌ 过度工程，难以定义"疑似 token"的通用规则

**评估建议：采用方案 A（扩展正则）。** 将 `(@.+)$` 改为 `(@.*)$` 是最精准的修复。

**5. 现有测试缺口确认**

CR 指出的测试缺口准确：
- `sanitize.test.ts:59-72` — 仅覆盖 `oauth2:token@host` 标准形式
- `git.test.ts:162-175` — 仅覆盖 `oauth2:token@:bad/repo`（`@` 后有内容）
- 未覆盖 `https://oauth2:token@` 这一 hostless 变体

需补充的回归测试：
1. `sanitize.test.ts`：`sanitizeUrl('https://oauth2:token@')` 应返回脱敏结果
2. `git.test.ts`：`resolve('https://oauth2:token@')` 的 `why` 不得包含原始 token

**评估结论：✅ 需要修复（低优先级）。确认非误报。**

---

### 低优先级遗留项：Resolve 阶段 / SourceResolver / pipeline 的公开契约未完全统一

| 维度 | 评估 |
|------|------|
| 问题描述准确性 | ✅ **准确** |
| 严重性判断 | ✅ **合理（低优先级/推迟）** |
| 是否误报 | ❌ **非误报** |

**评估详情：**

代码验证确认签名差异确实存在：

- `resolve-source.ts:39-43` — `resolveSource(args, reporter, pathResolver)` 三参
- `pipeline.ts:57` — `ResolveFn = (args, reporter) => Promise<ResolvedSource>` 二参
- `pipeline.ts:162` — `stages.resolve(args, reporter)` 二参调用

当前 `resolve` 占位函数和 `runPipeline()` 都使用二参签名，而实际 `resolveSource()` 需要三参。Story 4.6a 管道接线时必须处理这个差异。

**但本轮无运行时影响**：因为 `runPipeline()` 中的 `stages.resolve` 仍然是占位函数（`notImplemented('resolve')`），尚未接入 `resolveSource()`。

**评估结论：⏳ 继续推迟到 Story 4.6a，与历史轮次结论一致。**

---

## 质量门禁评估

| 检查项 | CR 结论 | 评估确认 |
|--------|---------|---------|
| `npm run lint` ✅ | 通过 | ✅ 不存疑 |
| `npm test` ✅ 260/260 | 全量通过 | ✅ 不存疑 |
| `npm run build` ✅ | 构建成功 | ✅ 不存疑 |

---

## 整体评估结论

### 需要修复

| 优先级 | Finding | 修复动作 |
|--------|---------|---------|
| **P1（低）** | `sanitizeUrl()` 正则无法匹配 `https://oauth2:token@`（hostless） | 将 `sanitize.ts:17` 正则的 `(@.+)$` 改为 `(@.*)$`；补 sanitize.test.ts + git.test.ts 回归测试 |

### 可忽略项

无。本轮唯一主要发现经正则分析和调用链追踪确认非误报。

### 推迟项（继承自 Round 1/2）

- **`ResolveFn` 签名契约统一**：继续推迟到 Story 4.6a。本轮 CR 再次确认未造成运行时失败。

---

## 评估与 CR 结论的差异

| 项目 | CR 判断 | 评估判断 | 差异原因 |
|------|---------|---------|---------|
| Finding #1 严重性 | 中优先级 | **低优先级** | 触发条件极其刻意（需构造 hostless token URL），攻击面仅限本地终端，无功能性影响。虽违反硬性脱敏规则需修复，但不构成中优先级。 |
| CR 总体结论 | Changes Requested | **同意 Changes Requested** | 虽然降级为低优先级，但 project-context.md 脱敏规则是硬性约束，且修复成本极低（正则一处改动 + 2 个测试），仍建议在下一轮修复后再通过 |

---

## 建议修复顺序

1. 修改 `sanitize.ts:17` 正则：`(@.+)$` → `(@.*)$`
2. 补 `sanitize.test.ts`：`sanitizeUrl('https://oauth2:token@')` 脱敏测试
3. 补 `git.test.ts`：`resolve('https://oauth2:token@')` 的 `why` 不含原始 token 测试
4. 运行 `npm run lint && npm run test && npm run build` 全量验证

---

## 修复执行记录

- **Date**: 2026-03-24
- **Model Used**: Claude Sonnet 4 (via Claude Code)
- **Fix Items**: 1

### Fix 1 (P1): 扩展 `sanitizeUrl()` 正则以覆盖 hostless token-bearing URL

**文件**: `src/core/sanitize.ts`

**修改前**:
```typescript
// Match userinfo in https://[user:]token@host/... pattern
// Handles both https://token@host and https://oauth2:token@host (GitLab standard)
return url.replace(/^(https?:\/\/)([^@]+)(@.+)$/, (_match, scheme, userinfo, rest) => {
```

**修改后**:
```typescript
// Match userinfo in https://[user:]token@host/... pattern
// Handles both https://token@host and https://oauth2:token@host (GitLab standard)
// Also handles hostless URLs like https://oauth2:token@ (bare @ with no host/path)
return url.replace(/^(https?:\/\/)([^@]+)(@.*)$/, (_match, scheme, userinfo, rest) => {
```

**关键变更**：正则第 3 组从 `(@.+)$` 改为 `(@.*)$`，允许 `@` 后无任何字符的情况。这确保 `https://oauth2:token@` 这类 hostless 非法 URL 也能被正则匹配，从而触发脱敏逻辑。

**正则行为验证**：
- `https://oauth2:token@gitlab.com/repo` → ✅ 匹配（行为不变）
- `https://oauth2:token@:bad/repo` → ✅ 匹配（行为不变）
- `https://oauth2:token@` → ✅ **现在也匹配**（`rest` = `@`，之前不匹配）
- `https://gitlab.com/repo` → ✅ 不匹配（行为不变，无 `@` 时 `[^@]+` 消耗全部字符）

**结果**: ✅ 成功。hostless token-bearing URL 现在被正确脱敏。

### 回归测试补充

**文件 1**: `tests/core/sanitize.test.ts` — 新增 2 个测试

- `masks token in hostless oauth2:token@ URL (bare @ ending)`
  - 输入: `https://oauth2:glpat-abcdefghijklmno@`
  - 验证: 不含原始 token，包含脱敏版本 `glpat-ab****lmno`，保留 `oauth2:` 前缀
- `masks token in hostless token@ URL without oauth2 prefix`
  - 输入: `https://glpat-abcdefghijklmno@`
  - 验证: 不含原始 token，包含脱敏版本

**文件 2**: `tests/services/git.test.ts` — 新增 1 个测试

- `should sanitize hostless token-bearing URL in INVALID_URL error why field`
  - 输入: `https://oauth2:glpat-abcdefghijklmno@`
  - 验证: `AiforgeError.why` 不含原始 token，包含脱敏版本（端到端泄露路径验证）

**结果**: ✅ 全部通过。

### 质量门禁验证

| 检查项 | 修复前 | 修复后 |
|--------|--------|--------|
| `npm run lint` | ✅ | ✅ |
| `npm test` | ✅ 260/260 | ✅ **263/263**（+3 回归测试） |
| `npm run build` | ✅ | ✅ |

### 修改文件清单

| 文件 | 变更类型 |
|------|---------|
| `src/core/sanitize.ts` | 修改：正则 `(@.+)$` → `(@.*)$` + 注释更新 |
| `tests/core/sanitize.test.ts` | 修改：新增 2 个 hostless token URL 脱敏测试 |
| `tests/services/git.test.ts` | 修改：新增 1 个 hostless token URL 端到端泄露路径测试 |

### 推迟项说明

- **`ResolveFn` 签名契约统一**：继续推迟到 Story 4.6a（管道接线）时统一处理（继承自 Round 1/2 评估结论）。
