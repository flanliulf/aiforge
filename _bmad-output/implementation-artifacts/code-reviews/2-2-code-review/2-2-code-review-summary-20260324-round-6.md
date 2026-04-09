---
Story: 2-2
Round: 6
Date: 2026-03-24
Model Used: GPT-5.4 (model ID: gpt-5.4)
Type: Code Review Summary
---

# Story 2.2 代码审查总结 — 第 6 轮

## 基本信息

- Story ID: `2-2`
- Story 文件: `_bmad-output/implementation-artifacts/2-2-source-resolver-and-git-service.md`
- 审查类型: 复审
- 审查结论: **Changes Requested**

## 总体结论

Round 5 的 host-only URL 校验问题已关闭：

- HTTPS / `ssh://` 分支现在都会对标准化后的 `repoPath` 做非空校验：`src/services/git.ts:82-93,105-126,132-146`
- `resolveSource()` 对 `https://gitlab.com` / `ssh://git@gitlab.com` 已不再透传成功结果，而是抛出 `INVALID_URL`
- 本轮质量门禁通过：`npm run lint` ✅ / `npm run test` ✅（`266/266`）/ `npm run build` ✅

但复审发现 1 个新的、与上轮同类的分支遗漏：**SCP-style SSH 分支仍未复用同样的 `repoPath` 归一化/校验逻辑**。结果是某些归一化后无效的输入（如 `git@gitlab.com:.git`）仍会被接受为合法 `ResolvedSource`，并把空/异常 `repoPath` 传给下游。因此本轮仍建议 **Changes Requested**。

## 上轮问题复核结果

### 1. Finding：host-only URL 被错误接受，返回空 `repoPath`

**已修复。**

- `src/services/git.ts:86-87,120-121` 现已对 HTTPS / `ssh://` 分支调用 `assertRepoPath()`
- 实测：
  - `https://gitlab.com` → `INVALID_URL | 仓库地址缺少仓库路径`
  - `ssh://git@gitlab.com` → `INVALID_URL | 仓库地址缺少仓库路径`
- 服务层负向测试已补：`tests/services/git.test.ts:129-144`

## 本轮问题

### 1. 低优先级【新发现】：SCP-style SSH 分支仍会接受归一化后无效的 `repoPath`

- 位置：
  - `src/services/git.ts:95-102`
  - `src/services/git.ts:132-146`
  - `src/stages/resolve-source.ts:46-48`
  - `_bmad-output/implementation-artifacts/2-2-source-resolver-and-git-service.md:13,24,54-57,64-72`
- 现状：
  - HTTPS / `ssh://` 分支现在都有：
    - 标准化 `repoPath`
    - `assertRepoPath(repoPath, url)`
  - 但 SCP-style 分支仍直接返回：
    - `repoPath: stripGitSuffix(scpMatch[2]!)`
    - **没有任何后置校验**
- 实测：
  - `git@gitlab.com:.git`
    - service 层返回：`{"hostname":"gitlab.com","repoPath":"","protocol":"ssh"}`
    - stage 层返回：`{"hostname":"gitlab.com","repoPath":"","protocol":"ssh"}`
  - `git@gitlab.com:/.git`
    - service 层返回：`{"hostname":"gitlab.com","repoPath":"/","protocol":"ssh"}`
    - stage 层返回：`{"hostname":"gitlab.com","repoPath":"/","protocol":"ssh"}`
- 为什么这是问题：
  - Story 2.2 对 SSH 输入的示例和目标语义始终是 `git@host:org/repo.git` → `repoPath = 'org/repo'`：`_bmad-output/implementation-artifacts/2-2-source-resolver-and-git-service.md:24,54-57,64-72`
  - 当前 SCP-style 分支却允许：
    - 归一化后空字符串 `''`
    - 明显不符合示例语义的 `'/'`
  - 这意味着**同类的“无效 repoPath”问题只在两个分支被修了，第三个支持分支仍然漏着**
- 下游风险：
  - Story 2.3 认证阶段会继续基于 `hostname + repoPath` 构建 clone URL
  - 对 `repoPath = ''` / `'/'` 的情况，下游仍会得到无意义的 clone URL，并把根因延后到后续阶段
  - 错误定位会变成“认证/克隆失败”，而不是在 Resolve 阶段直接指出“仓库地址本身不完整/不合法”
- 为什么现有测试没拦住：
  - 新增的负向测试只覆盖了 HTTPS / `ssh://` host-only URL：`tests/services/git.test.ts:129-144`
  - 当前没有覆盖任何 malformed SCP-style 输入的负向测试
- 建议：
  - 让 SCP-style 分支与 HTTPS / `ssh://` 分支共享同一套 `repoPath` 归一化和校验逻辑
  - 至少应保证：
    - 归一化后不能为空
    - 不接受显然无效的路径形态（如 `''`，必要时也包括单独 `'/'`）
  - 补服务层负向测试：
    - `git@gitlab.com:.git`
    - `git@gitlab.com:/.git`
  - 若实现上要保持最小改动，可先复用现有 helper；若希望彻底收口，建议抽取统一的 `normalizeRepoPath()` 而不是让三条分支各自处理

## 低优先级遗留项（继续推迟）

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

- `http://` 已被收口为不支持协议：`src/services/git.ts:45-46,105-117`、`tests/services/git.test.ts:158-167`
- hostless token-bearing URL 的脱敏仍然稳定：`src/core/sanitize.ts:14-28`、`tests/core/sanitize.test.ts:74-88`
- HTTPS / `ssh://` host-only URL 现在都能在 Resolve 阶段及时失败：`src/services/git.ts:82-93,120-126`
- 门禁全绿，说明当前剩余问题集中在**SCP-style 分支的校验一致性缺口**，不是回归性质量问题

## 建议修复顺序

1. 先让 SCP-style 分支复用与 HTTPS / `ssh://` 一致的 `repoPath` 归一化/校验逻辑
2. 为 malformed SCP-style 输入补服务层负向测试
3. 重新执行 `npm run lint && npm run test && npm run build`
4. 后续在 Story 4.6a 统一 `resolveSource` / `ResolveFn` / `SourceResolver` 的公开契约

## 最终建议

**本轮结论：Changes Requested。**

Round 5 的 host-only URL 问题已关闭，但同类校验在 SCP-style SSH 分支仍未闭环。当前唯一阻塞项是：`git@gitlab.com:.git` / `git@gitlab.com:/.git` 这类归一化后无效的输入仍会被接受，并把异常 `repoPath` 传给下游。建议补齐该分支的一致性校验后，再进入下一轮快速复审。
