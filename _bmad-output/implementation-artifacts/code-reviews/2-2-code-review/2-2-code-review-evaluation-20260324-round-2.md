---
Story: 2-2
Round: 2
Date: 2026-03-24
Model Used: Claude Sonnet 4 (via Claude Code)
Review Source: 2-2-code-review-summary-20260324-round-2.md
Review Model: GPT-5.4 (model ID: gpt-5.4)
Type: Code Review Evaluation
---

# Story 2.2 代码审查结果评估 — 第 2 轮

## 评估概要

本轮评估针对 GPT-5.4 对 Story 2-2 的第 2 轮复审结果。第 1 轮的 3 个主要问题均已确认修复/部分修复。本轮复审发现 2 个新问题。通过对照源码、项目规则和 Story 文件，逐条验证。

**评估总体结论：2 条新发现均有代码证据支撑，无误报。建议全部采纳修复。**

---

## 上轮问题复核评估

CR 对 Round 1 三个 Finding 的复核结论准确，无异议：

| Finding | CR 复核结论 | 评估确认 |
|---------|------------|---------|
| #1 配置错误被吞掉 | ✅ 已修复 | ✅ 确认。`resolve-source.ts:64-74` 仅对 CONFIG_NOT_FOUND 降级，测试已覆盖 |
| #2 非法 URL 漏出 TypeError | ✅ 已修复 | ✅ 确认。`git.ts:116-130` `safeParseUrl()` 包装为 INVALID_URL |
| #3 架构收口 | ⚠️ 部分修复 | ✅ 确认。URL 解析已收口到 GitSourceResolver，签名契约遗留合理 |

---

## 逐条评估

### Finding #1（新）：`GitSourceResolver.resolve()` 会接受不支持的协议，并错误标记为 `protocol: 'https'`

| 维度 | 评估 |
|------|------|
| 问题描述准确性 | ✅ **准确** |
| 严重性判断 | ✅ **合理（中优先级）** |
| 修复建议可行性 | ✅ **可行** |
| 是否误报 | ❌ **非误报** |

**评估详情：**

代码证据确凿。`git.ts:81-108` 中 `parseGitUrl()` 的逻辑链为：

1. `ssh://` 前缀 → `protocol: 'ssh'` ✅
2. SCP-style 匹配 → `protocol: 'ssh'` ✅
3. **其余所有** → `safeParseUrl(url)` + 硬编码 `protocol: 'https'` ❌

这意味着任何可被 `new URL()` 解析的非 SSH URL 都会落入第 3 分支，包括：
- `ftp://example.com/org/repo.git` → 被标记为 `protocol: 'https'`
- `file:///tmp/repo.git` → 被标记为 `protocol: 'https'`，且 `hostname` 为空字符串

验证 `canHandle()` 与 `resolve()` 的自相矛盾：
- `canHandle('ftp://example.com/repo')` → `false`（因为不以 `https://`、`http://`、`ssh://` 开头，也不匹配 SCP-style）
- `resolve('ftp://example.com/repo')` → 成功返回 `{ hostname: 'example.com', repoPath: 'repo', protocol: 'https' }`

这违反了：
1. **Story 2.2 AC #1/#5**：仅定义了 HTTPS 和 SSH 两种协议
2. **`ResolvedSource.protocol` 类型契约**：`types.ts:36` 明确为 `'https' | 'ssh'`，不应把 `ftp://` 伪装为 `https`
3. **`canHandle()`/`resolve()` 语义一致性**：一个方法说不支持，另一个却接受并返回成功结果

`file://` 场景尤其危险：`hostname` 为空字符串，后续 Story 2.3 的 host 级认证查找 `getHostAuth(config, hostname)` 会用空字符串查找，行为不可预测。

当前测试仅覆盖完全非法字符串（`not-a-url`、空字符串），未覆盖"可解析但不支持的 scheme"边界。

**评估结论：✅ 需要修复（中优先级）**

修复方案同意 CR 建议：在 `parseGitUrl()` 的 HTTPS/HTTP 分支增加 scheme 白名单校验（`http:` / `https:`），对其他 scheme 抛出 `AiforgeError`。建议使用语义更清晰的错误码 `UNSUPPORTED_PROTOCOL`（优于复用 `INVALID_URL`），因为 URL 本身是合法的，只是协议不受支持。补 `ftp://` / `file://` 负向测试。

---

### Finding #2（新）：`INVALID_URL` 的错误详情直接回显原始 URL，违反脱敏规则

| 维度 | 评估 |
|------|------|
| 问题描述准确性 | ✅ **准确** |
| 严重性判断 | ⚠️ **偏高，建议降为低优先级** |
| 修复建议可行性 | ✅ **可行** |
| 是否误报 | ❌ **非误报** |

**评估详情：**

代码证据确认。`git.ts:125` 的 `why` 字段直接拼接原始 URL：

```typescript
`无法解析仓库地址: ${url}`
```

`project-context.md:128` 明确要求：
> All logs/errors use `sanitizeToken()` from `core/sanitize.ts`

`core/sanitize.ts:14-27` 已有现成的 `sanitizeUrl()` 函数可用，且明确设计为处理 `oauth2:token@host` 格式。

**但严重性需要上下文化：**

CR 将此判定为"中优先级"值得商榷，理由如下：

1. **`safeParseUrl()` 是 `new URL()` 的 catch 分支**：当 URL 非法（无法被 `new URL()` 解析）时才进入此路径。对于 `https://oauth2:glpat-xxx@` 这类不完整 URL，`new URL()` 确实会失败进入 catch 分支，此时 `why` 会包含 token。
2. **但实际攻击面较窄**：此错误信息的消费者是本地 CLI 用户（通过 Reporter 输出到终端），不会远程发送。token 泄露风险主要在于终端日志被截图/分享的间接场景。
3. **修复成本极低**：仅需将 `${url}` 替换为 `${sanitizeUrl(url)}`，一行变更。

**评估结论：⚠️ 建议降为低优先级，但仍应修复**

虽然实际攻击面有限，但 `project-context.md` 的脱敏规则是硬性约束（"所有 logs/errors 使用 `sanitizeToken()`"），应当遵守。修复成本极低，建议本轮一并处理。

---

## 质量门禁评估

| 检查项 | CR 结论 | 评估确认 |
|--------|---------|---------|
| `npm run lint` ✅ | 通过 | ✅ 不存疑 |
| `npm test` ✅ 256/256 | 全量通过 | ✅ 不存疑 |
| `npm run build` ✅ | 构建成功 | ✅ 不存疑 |

---

## 整体评估结论

### 需要修复（按优先级排序）

| 优先级 | Finding | 修复动作 |
|--------|---------|---------|
| **P1（中）** | #1 不支持协议被误解析为 HTTPS | `parseGitUrl()` 增加 scheme 白名单校验，对 `ftp://`/`file://` 等抛 `AiforgeError(UNSUPPORTED_PROTOCOL)`；补负向测试 |
| **P2（低）** | #2 INVALID_URL 错误回显未脱敏 URL | `safeParseUrl()` 中 `${url}` 替换为 `${sanitizeUrl(url)}`；补 token-bearing URL 回归测试 |

### 可忽略项

无。2 条发现均有代码证据，不存在误报。

### 推迟项（继承自 Round 1）

- **`ResolveFn` 签名契约统一**：继续推迟到 Story 4.6a。本轮 CR 也确认了该遗留项未造成运行时失败。

---

## 建议修复顺序

1. 在 `parseGitUrl()` HTTPS/HTTP 分支前增加 scheme 白名单校验（P1）
2. 在 `safeParseUrl()` 中接入 `sanitizeUrl()`（P2）
3. 补负向测试（`ftp://`、`file://`、token-bearing 非法 URL）
4. 运行 `npm run lint && npm test && npm run build` 全量验证

---

## 修复执行记录

- **Date**: 2026-03-24
- **Model Used**: Claude Sonnet 4 (via Claude Code)
- **Fix Items**: 2

### Fix 1 (P1): 在 `parseGitUrl()` 增加 scheme 白名单校验

**文件**: `src/services/git.ts`

**修改前**:
```typescript
// HTTPS / HTTP
const parsed = safeParseUrl(url)
return {
  hostname: parsed.hostname,
  repoPath: stripGitSuffix(parsed.pathname.replace(/^\//, '')),
  protocol: 'https',
}
```

**修改后**:
```typescript
// HTTPS / HTTP — 校验 scheme 白名单，拒绝 ftp:// / file:// 等不支持的协议
const parsed = safeParseUrl(url)
if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
  throw new AiforgeError(
    '不支持的仓库协议',
    'UNSUPPORTED_PROTOCOL',
    EXIT_ARG_ERROR,
    'fatal',
    `不支持的协议: ${parsed.protocol.replace(/:$/, '')}，仅支持 HTTPS 和 SSH`,
    [
      'npx aiforge https://gitlab.com/org/repo.git  # HTTPS 格式',
      'npx aiforge git@gitlab.com:org/repo.git      # SSH 格式',
    ],
  )
}
return {
  hostname: parsed.hostname,
  repoPath: stripGitSuffix(parsed.pathname.replace(/^\//, '')),
  protocol: 'https',
}
```

**关键决策**：
- 使用 `parsed.protocol`（`new URL()` 解析后的 protocol 属性）进行白名单校验，而非字符串前缀匹配，更健壮
- 错误码使用语义化的 `UNSUPPORTED_PROTOCOL`（而非复用 `INVALID_URL`），因为 URL 本身格式合法，只是协议不受支持
- `why` 中展示用户传入的协议名，帮助诊断

**结果**: ✅ 成功。`ftp://`、`file://`、`custom://` 等不支持协议现在统一抛 `AiforgeError(UNSUPPORTED_PROTOCOL)`。

### Fix 2 (P2): `safeParseUrl()` 接入 `sanitizeUrl()` 脱敏

**文件**: `src/services/git.ts`

**修改前**:
```typescript
`无法解析仓库地址: ${url}`
```

**修改后**:
```typescript
`无法解析仓库地址: ${sanitizeUrl(url)}`
```

**额外修改**：
- 新增 `import { sanitizeUrl } from '../core/sanitize.js'`

**结果**: ✅ 成功。token-bearing URL 在错误信息中被脱敏（如 `glpat-abcdefghijklmno` → `glpat-ab****lmno`）。

### 负向测试补充

**文件**: `tests/services/git.test.ts` — 新增 4 个测试

- `unsupported protocol handling` 组（3 个测试）：
  - `should throw UNSUPPORTED_PROTOCOL for ftp:// URL`
  - `should throw UNSUPPORTED_PROTOCOL for file:// URL`
  - `should throw UNSUPPORTED_PROTOCOL for custom scheme`
- `error message sanitization` 组（1 个测试）：
  - `should sanitize token-bearing URL in INVALID_URL error why field`
    - 使用 `https://oauth2:glpat-abcdefghijklmno@:bad/repo` 作为测试 URL（同时满足 `new URL()` 抛错和 `sanitizeUrl()` 可匹配的条件）
    - 验证 `why` 中不含原始 token，包含脱敏版本

**结果**: ✅ 全部通过。

### 质量门禁验证

| 检查项 | 修复前 | 修复后 |
|--------|--------|--------|
| `npm run lint` | ✅ | ✅ |
| `npm test` | ✅ 256/256 | ✅ **260/260**（+4 负向测试） |
| `npm run build` | ✅ | ✅ |

### 修改文件清单

| 文件 | 变更类型 |
|------|---------|
| `src/services/git.ts` | 修改：scheme 白名单校验 + sanitizeUrl 脱敏 + 新增 import |
| `tests/services/git.test.ts` | 修改：新增 4 个负向测试 |

### 推迟项说明

- **`ResolveFn` 签名契约统一**：继续推迟到 Story 4.6a（管道接线）时统一处理（继承自 Round 1 评估结论）。
