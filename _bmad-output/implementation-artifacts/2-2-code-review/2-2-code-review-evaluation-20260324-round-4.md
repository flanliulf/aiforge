---
Story: 2-2
Round: 4
Date: 2026-03-24
Model Used: Claude Sonnet 4 (via Claude Code)
Review Source: 2-2-code-review-summary-20260324-round-4.md
Review Model: GPT-5.4 (model ID: gpt-5.4)
Type: Code Review Evaluation
---

# Story 2.2 代码审查结果评估 — 第 4 轮

## 评估概要

本轮评估针对 GPT-5.4 对 Story 2-2 的第 4 轮复审结果。Round 3 的 bare-`@` token 脱敏边界问题已确认关闭。本轮复审发现 1 个此前漏检的协议契约问题：`http://` URL 被接受并被错误映射为 `protocol: 'https'`。通过源码、类型定义、Story 文档和 PRD 交叉验证，对本轮发现进行独立评估。

**评估总体结论：1 条主要发现经多维度证据验证确认为真实问题，非误报。建议采纳修复，且修复路径应为"拒绝 HTTP"（符合现有文档约束）。1 条低优先级遗留项继续推迟。**

---

## 上轮问题复核评估

CR 对 Round 3 Finding 的复核结论准确，与源码一致：

| Finding | CR 复核结论 | 评估确认 |
|---------|------------|---------|
| `sanitizeUrl()` 无法处理 hostless token-bearing URL | ✅ 已修复 | ✅ 确认。`sanitize.ts:17` 正则已改为 `(@.*)$`，测试覆盖到位 (`sanitize.test.ts:74-88`, `git.test.ts:178-192`) |

---

## 逐条评估

### Finding #1（中优先级）：`http://` URL 仍被接受，并被错误归一化为 `protocol: 'https'`

| 维度 | 评估 |
|------|------|
| 问题描述准确性 | ✅ **准确** |
| 严重性判断 | ⚠️ **偏高，建议降为低优先级** |
| 修复建议可行性 | ✅ **可行** |
| 是否误报 | ❌ **非误报** |

**评估详情：**

**1. 代码证据确认问题存在**

三处代码共同构成了 HTTP 的"静默接受+伪装"路径：

- `git.ts:46` — `canHandle()` 显式接受 `http://`：
  ```typescript
  if (source.startsWith('https://') || source.startsWith('http://')) return true
  ```

- `git.ts:105` — scheme 白名单在 Round 2 修复 `UNSUPPORTED_PROTOCOL` 时，将 `http:` 纳入了白名单：
  ```typescript
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new AiforgeError(...)
  }
  ```

- `git.ts:121` — 返回值硬编码 `protocol: 'https'`，无论实际输入是 `http:` 还是 `https:`：
  ```typescript
  return { hostname: ..., repoPath: ..., protocol: 'https' }
  ```

实测路径：
```
resolve('http://gitlab.com/org/repo.git')
  → canHandle() = true
  → parseGitUrl()
    → safeParseUrl() 成功 (new URL('http://gitlab.com/org/repo.git'))
    → parsed.protocol = 'http:'
    → 白名单通过 (http: 不等于 https: 但也不等于 http:... 不对，is 'http:')
    → 返回 { hostname: 'gitlab.com', repoPath: 'org/repo', protocol: 'https' }
```

`http://` 输入被返回为 `protocol: 'https'`，输出不再忠实反映输入。

**2. 文档证据确认"仅 HTTPS + SSH"约束**

| 来源 | 内容 | 是否提及 HTTP |
|------|------|-------------|
| `types.ts:36` | `protocol: 'https' \| 'ssh'` | ❌ 无 `'http'` 选项 |
| Story 2.2 AC #1 | "protocol（HTTPS/SSH）" | ❌ 仅 HTTPS/SSH |
| Story 2.2 URL 解析表格 | 仅列 `https://` 和 SSH 变体 | ❌ 无 `http://` 行 |
| PRD NFR-I1 | "支持 HTTPS 和 SSH 两种 Git 协议" | ❌ 仅两种 |
| Story 2.3 clone URL 构建 | `buildTokenUrl` / `buildPlainUrl` 均使用 `https://` | ❌ 无 `http://` 变体 |

所有文档一致表明：HTTP 不在 MVP 支持范围内。

**3. 严重性评估 — 建议降为低优先级**

CR 将此定为"中优先级"，评估认为应降级，理由如下：

- **不会造成数据丢失或安全漏洞**：`http://` 被"升级"为 `https://` 语义后，下游 clone URL 构建会使用 `https://`，这在绝大多数场景下是**正确的**（因为主流 Git 服务器的 HTTP URL 实际也响应 HTTPS）。
- **实际用户使用 `http://` 的概率极低**：绝大多数 Git 仓库服务已全面切换到 HTTPS，真正只支持纯 HTTP 的仓库在现代环境中极为罕见。
- **不影响核心业务流程**：即使 `http://` 被误标为 `https`，在 99% 的实际场景中 clone 仍然能成功（HTTPS 是 HTTP 的超集）。
- **问题本质是契约一致性**：这是一个"实现与文档不一致"的问题，而非"功能破坏"的问题。

但 CR 指出的以下观点有价值：
- `protocol` 字段不忠实反映用户输入，会让 debug 变困难
- `tests/git.test.ts:32-33` 将这种偏离编码为预期行为，增加了后续纠偏成本
- 错误提示写"仅支持 HTTPS 和 SSH"，但 `http://` 不触发该错误，形成自相矛盾

**综合结论：确认需要修复，但降级为低优先级。修复成本极低且能收紧契约一致性。**

**4. 修复路径评估**

CR 提供了两个方向：

*方向 A：拒绝 HTTP（推荐）*
- `canHandle()` 移除 `http://` 分支
- `parseGitUrl()` 白名单仅保留 `https:`
- 删除/更新 `git.test.ts:32-33` 的 HTTP 正向断言
- 补 `http://` → `UNSUPPORTED_PROTOCOL` 负向测试
- ✅ **评估推荐此方向**：变更最小，完全符合现有文档约束，无需修改 Story/PRD/类型定义

*方向 B：正式支持 HTTP*
- 需要扩展 `ResolvedSource.protocol` 类型
- 需要更新 Story、PRD、架构文档
- 需要在 Story 2.3 认证阶段增加 HTTP clone URL 构建
- 需要更新 Rule Document Registry 中列出的所有文档
- ❌ **评估不推荐**：变更面大，MVP 无此需求

**5. 问题根因分析**

此问题的根因在于 Round 2 修复 `UNSUPPORTED_PROTOCOL` 时，白名单条件写为 `parsed.protocol !== 'https:' && parsed.protocol !== 'http:'`，将 `http:` 也纳入了"支持的协议"。这是一个**修复引入的新问题**（regression by fix），但因 `canHandle()` 从一开始就接受 `http://`，所以严格说问题的种子在初始实现中就已埋下。

**评估结论：✅ 需要修复（低优先级）。确认非误报。推荐方向 A（拒绝 HTTP）。**

---

### 低优先级遗留项：Resolve 阶段 / SourceResolver / pipeline 的公开契约未完全统一

| 维度 | 评估 |
|------|------|
| 问题描述准确性 | ✅ **准确** |
| 严重性判断 | ✅ **合理（低优先级/推迟）** |
| 是否误报 | ❌ **非误报** |

**评估详情：**

与 Round 1/2/3 评估结论一致。签名差异确实存在，但当前无运行时影响。

**评估结论：⏳ 继续推迟到 Story 4.6a，与历史轮次结论一致。**

---

## 质量门禁评估

| 检查项 | CR 结论 | 评估确认 |
|--------|---------|---------|
| `npm run lint` ✅ | 通过 | ✅ 不存疑 |
| `npm test` ✅ 263/263 | 全量通过 | ✅ 不存疑 |
| `npm run build` ✅ | 构建成功 | ✅ 不存疑 |

---

## 整体评估结论

### 需要修复

| 优先级 | Finding | 修复动作 |
|--------|---------|---------|
| **P1（低）** | `http://` URL 被接受且映射为 `protocol: 'https'` | 拒绝 HTTP：`canHandle()` 移除 `http://` 分支；`parseGitUrl()` 白名单仅保留 `https:`；删 HTTP 正向测试，补 `http://` → `UNSUPPORTED_PROTOCOL` 负向测试 |

### 可忽略项

无。本轮唯一主要发现经代码+文档多维度验证确认非误报。

### 推迟项（继承自 Round 1/2/3）

- **`ResolveFn` 签名契约统一**：继续推迟到 Story 4.6a。本轮 CR 再次确认未造成运行时失败。

---

## 评估与 CR 结论的差异

| 项目 | CR 判断 | 评估判断 | 差异原因 |
|------|---------|---------|---------|
| Finding #1 严重性 | 中优先级 | **低优先级** | `http://` 被映射为 `https` 在绝大多数场景下不影响功能（HTTPS 是 HTTP 超集），问题本质是契约一致性而非功能破坏。攻击面极低，用户主动输入 `http://` 概率极小。 |
| CR 总体结论 | Changes Requested | **同意 Changes Requested** | 虽降级为低优先级，但修复成本极低（3 处代码变更 + 测试调整），且能消除实现与文档的自相矛盾。建议修复后进入下一轮快速复审。 |

---

## 建议修复顺序

1. `git.ts:46` — `canHandle()` 移除 `source.startsWith('http://')` 分支
2. `git.ts:105` — `parseGitUrl()` 白名单仅保留 `parsed.protocol !== 'https:'`
3. `git.test.ts:32-33` — 删除 HTTP 正向断言，改为 `http://` → `UNSUPPORTED_PROTOCOL` 负向测试
4. 运行 `npm run lint && npm run test && npm run build` 全量验证

---

## 修复执行记录

- **Date**: 2026-03-24
- **Model Used**: Claude Sonnet 4 (via Claude Code)
- **Fix Items**: 1

### Fix 1 (P1): 拒绝 `http://` URL，收紧为仅支持 HTTPS

**文件 1**: `src/services/git.ts`

**修改 1a — `canHandle()` 移除 HTTP 分支**:

修改前:
```typescript
// HTTPS / HTTP
if (source.startsWith('https://') || source.startsWith('http://')) return true
```

修改后:
```typescript
// HTTPS
if (source.startsWith('https://')) return true
```

**修改 1b — `parseGitUrl()` 白名单收紧**:

修改前:
```typescript
// HTTPS / HTTP — 校验 scheme 白名单，拒绝 ftp:// / file:// 等不支持的协议
const parsed = safeParseUrl(url)
if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
```

修改后:
```typescript
// HTTPS — 校验 scheme 白名单，拒绝 http:// / ftp:// / file:// 等不支持的协议
const parsed = safeParseUrl(url)
if (parsed.protocol !== 'https:') {
```

**修改 1c — JSDoc 注释更新**:

修改前: `支持 HTTPS、HTTP、SSH (ssh://)、SCP-style (git@host:path) URL`
修改后: `支持 HTTPS、SSH (ssh://)、SCP-style (git@host:path) URL`

**关键决策**：
- 采用评估推荐的"方向 A（拒绝 HTTP）"，与 Story/PRD/NFR-I1/`ResolvedSource.protocol` 类型契约保持一致
- `http://` 现在会被 `parseGitUrl()` 抛出 `UNSUPPORTED_PROTOCOL`（因为 `http:` 不等于 `https:`）
- `canHandle('http://...')` 现在返回 `false`，与 `resolve()` 行为语义一致

**文件 2**: `tests/services/git.test.ts`

**修改 2a — HTTP 正向断言改为负向**:

修改前:
```typescript
it('should return true for HTTP URL', () => {
  expect(resolver.canHandle('http://gitlab.com/org/repo.git')).toBe(true)
})
```

修改后:
```typescript
it('should return false for HTTP URL (only HTTPS supported, not plain HTTP)', () => {
  expect(resolver.canHandle('http://gitlab.com/org/repo.git')).toBe(false)
})
```

**修改 2b — 新增 HTTP → UNSUPPORTED_PROTOCOL 负向测试**:

新增测试在 `unsupported protocol handling` 组中：
```typescript
it('should throw UNSUPPORTED_PROTOCOL for http:// URL', async () => {
  await expect(resolver.resolve('http://gitlab.com/org/repo.git')).rejects.toThrow(AiforgeError)
  await expect(resolver.resolve('http://gitlab.com/org/repo.git')).rejects.toMatchObject({
    code: 'UNSUPPORTED_PROTOCOL',
    severity: 'fatal',
  })
})
```

**结果**: ✅ 全部通过。

### 质量门禁验证

| 检查项 | 修复前 | 修复后 |
|--------|--------|--------|
| `npm run lint` | ✅ | ✅ |
| `npm test` | ✅ 263/263 | ✅ **264/264**（+1 HTTP 负向测试） |
| `npm run build` | ✅ | ✅ |

### 修改文件清单

| 文件 | 变更类型 |
|------|---------|
| `src/services/git.ts` | 修改：`canHandle()` 移除 HTTP 分支 + 白名单收紧为仅 HTTPS + JSDoc 更新 |
| `tests/services/git.test.ts` | 修改：HTTP 正向断言改为负向 + 新增 HTTP → UNSUPPORTED_PROTOCOL 测试 |

### 推迟项说明

- **`ResolveFn` 签名契约统一**：继续推迟到 Story 4.6a（管道接线）时统一处理（继承自 Round 1/2/3 评估结论）。
