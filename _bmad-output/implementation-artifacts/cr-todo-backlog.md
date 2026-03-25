# CR TODO Backlog — 跨 Story 延迟事项追踪

> 本文档由 `bmad-enhance-05-cr-todo-tracker` 技能维护。
> 记录 Code Review 中发现的非阻塞改进项，跨 Story 追踪直到解决。

## 统计摘要

| 状态 | 数量 |
|------|------|
| 🔴 open | 2 |
| 🟡 in-progress | 0 |
| ✅ resolved | 0 |

---

## Open Items

<!-- 按优先级排序：P1 > P2 > P3 -->

### TODO-001: 合并 `sanitizeTokenDisplay()` 与 `sanitizeToken()` 重复实现

- **来源**: Story 2-5 CR round 1-4 (2026-03-24)
- **优先级**: P2
- **类别**: duplication
- **描述**: `src/commands/init.ts` 中的 `sanitizeTokenDisplay()` 与 `src/core/sanitize.ts` 中的 `sanitizeToken()` 逻辑完全一致（前 8 + \*\*\*\* + 后 4 / 短 token 前 4 + \*\*\*\*），仅判断条件写法不同。应删除 `sanitizeTokenDisplay()` 并改为 `import { sanitizeToken } from '../core/sanitize.js'`，避免后续安全脱敏规则调整时出现实现漂移。
- **涉及文件**: `src/commands/init.ts`, `src/core/sanitize.ts`
- **建议时机**: 下次触及 `src/commands/init.ts` 时
- **状态**: open
- **解决记录**:

### TODO-002: `detectTools` 函数签名与 `DetectFn` 类型不匹配，pipeline 集成需适配

- **来源**: Story 3-1 CR round 1-2 (2026-03-25)
- **优先级**: P2
- **类别**: tech-debt
- **描述**: `detectTools(repo, args, reporter, pathResolver)` 有 4 个参数，而 `pipeline.ts` 中 `DetectFn = (repo, args, reporter) => Promise<DetectedEnv>` 只有 3 个参数（缺少 `pathResolver`）。将 detect 阶段接入 pipeline 时需决定：修改 `DetectFn` 类型签名加入 `pathResolver`，或通过闭包/偏函数在接入层适配。此问题在 Round 1 评估中首次发现，Round 2 CR 和评估中均确认保留为观察项。
- **涉及文件**: `src/stages/detect-tools.ts`, `src/pipeline.ts`
- **建议时机**: Epic 3/4 中负责 pipeline 阶段接入的 Story
- **状态**: open
- **解决记录**:

---

## Resolved Items

<!-- 已解决事项归档于此，保留用于回顾 -->

_当前无已解决事项。_

---

## 条目模板（不要删除）

<!--
### TODO-{NNN}: {简短标题}

- **来源**: {story-id} CR round {N} ({YYYY-MM-DD})
- **优先级**: P1 / P2 / P3
- **类别**: refactor / duplication / tech-debt / naming / test-gap / other
- **描述**: {具体问题描述}
- **涉及文件**: `{file-path}` (可多个)
- **建议时机**: {例如 "下次触及 init.ts 时" / "epic-3 开始前" / "专项重构"}
- **状态**: open / in-progress / resolved
- **解决记录**: {解决时填写：在哪个 story 中解决，PR/commit 引用}
-->
