# CR TODO Backlog — 跨 Story 延迟事项追踪

> 本文档由 `bmad-enhance-05-cr-todo-tracker` 技能维护。
> 记录 Code Review 中发现的非阻塞改进项，跨 Story 追踪直到解决。

## 统计摘要

| 状态 | 数量 |
|------|------|
| 🔴 open | 4 |
| 🟡 in-progress | 0 |
| ✅ resolved | 1 |

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

### TODO-003: CLI 入口接线 `createProductionStages()` 工厂函数

- **来源**: Story 3-3 CR evaluation round 1-2 (2026-03-25)
- **优先级**: P2
- **类别**: tech-debt
- **描述**: `src/index.ts:49` 调用 `runPipeline(args, reporter)` 未传入第三参数 `stages`，因此使用 `DEFAULT_STAGES`（全占位）。`createProductionStages(pathResolver)` 工厂函数已就绪（`pipeline.ts:166-184`），但 resolve/auth/clone 阶段仍为占位，接线需等 Epic 2 实现前序阶段后一并完成。届时改为 `runPipeline(args, reporter, createProductionStages(new UnixPathResolver()))`。
- **涉及文件**: `src/index.ts`, `src/pipeline.ts`
- **建议时机**: Epic 2 中实现 resolve/auth/clone 真实阶段的 Story
- **状态**: open
- **解决记录**:

### TODO-004: flatten 目标路径精度回补（dry-run 预览需体现重命名语义）

- **来源**: Story 3-3 CR evaluation round 2 (2026-03-25)
- **优先级**: P2
- **类别**: tech-debt
- **描述**: 当前 `reporter.ts` 的 `resolveFileTarget()` 对 flatten 类型使用 `join(targetPath, basename(srcFile))`，输出为 `~/.cursor/rules/code-review`（目录名），但 PRD 定义 flatten 应提取主文件并重命名为 `code-review.md`。精确输出需要 `InstallRule` 类型引入 `mainFile` 字段并实现主文件提取逻辑——这属于 Epic 4 Story 4.3 的核心能力。待 4.3 实现后，reporter 层需同步更新 flatten 的目标路径计算，并补充对应测试断言。
- **涉及文件**: `src/core/reporter.ts`, `src/core/types.ts`, `tests/stages/report.test.ts`
- **建议时机**: Epic 4 Story 4.3（符号链接与 flatten 模式）完成后
- **状态**: open
- **解决记录**:

### TODO-005: 质量门禁验证的完整执行流程规则增强

- **来源**: Story 4-1 CR round 1-5 (2026-03-25 ~ 2026-03-26)
- **优先级**: P2
- **类别**: other
- **描述**: 现有 "CR 修复后必须同步更新 Story Dev Agent Record" 规则已覆盖意图，但执行不到位，需增强为具体操作流程。CR 修复完成后，必须按以下顺序执行完整验证并将每项结果逐行更新到 Story Dev Agent Record：(1) `npm test` — 记录通过数（含新增测试的增量说明）；(2) `npm run lint` — 记录 error/warning 数（含 Prettier 格式检查）；(3) `npm run build` — 记录构建状态。禁止：只执行部分验证（如只跑 test 不跑 lint）；复用上轮的验证结果（每次修复后必须重新执行）；在验证未全部通过时更新 Story 记录为"通过"。Story 4-1 CR 中该问题出现 3 次：Round 1 lint error 漏报、Round 2 Prettier 问题漏报、Round 3 测试计数过期。
- **涉及文件**: `_bmad-output/project-context.md`, `_bmad-output/planning-artifacts/architecture/04-implementation-patterns.md`
- **建议时机**: 下一次 Sprint 规划或规则文档专项维护时
- **状态**: open
- **解决记录**:

---

<!-- 已解决事项归档于此，保留用于回顾 -->

### TODO-002: `detectTools` 函数签名与 `DetectFn` 类型不匹配，pipeline 集成需适配

- **来源**: Story 3-1 CR round 1-2 (2026-03-25)
- **优先级**: P2
- **类别**: tech-debt
- **描述**: `detectTools(repo, args, reporter, pathResolver)` 有 4 个参数，而 `pipeline.ts` 中 `DetectFn = (repo, args, reporter) => Promise<DetectedEnv>` 只有 3 个参数（缺少 `pathResolver`）。将 detect 阶段接入 pipeline 时需决定：修改 `DetectFn` 类型签名加入 `pathResolver`，或通过闭包/偏函数在接入层适配。
- **涉及文件**: `src/stages/detect-tools.ts`, `src/pipeline.ts`
- **建议时机**: Epic 3/4 中负责 pipeline 阶段接入的 Story
- **状态**: resolved
- **解决记录**: Story 3-3 中通过 `createProductionStages(pathResolver)` 工厂函数解决，使用闭包适配 3 参数 `DetectFn` → 4 参数 `detectTools` 调用（`pipeline.ts:179`）。

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
