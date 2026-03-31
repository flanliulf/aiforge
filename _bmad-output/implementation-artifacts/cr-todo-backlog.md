# CR TODO Backlog — 跨 Story 延迟事项追踪

> 本文档由 `bmad-enhance-05-cr-todo-tracker` 技能维护。
> 记录 Code Review 中发现的非阻塞改进项，跨 Story 追踪直到解决。

## 统计摘要

| 状态 | 数量 |
|------|------|
| 🔴 open | 8 |
| 🟡 in-progress | 0 |
| ✅ resolved | 2 |

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

### TODO-006: `targetPath` 为普通文件时 preflight 未提前拒绝

- **来源**: Story 4-2 CR round 1 (2026-03-26)
- **优先级**: P2
- **类别**: tech-debt
- **描述**: `checkTargetWritability()` (fs-utils.ts) 对 `targetPath` 是普通文件的情况只检查 `W_OK` 可写性，不会抛出"不是目录"的错误。随后 `executeInstall()` 调用 `ensureDir(item.targetPath)` 时才因 `ENOTDIR` 失败，被包装为 `ENSURE_DIR_FAILED`。虽然安装最终仍会失败（非安全问题），但错误时机延迟且报错信息不够精确。改进方案：在 `checkTargetWritability()` 中增加 `targetStat.isFile()` 分支，提前抛出更精确的 `PATH_NOT_DIRECTORY` 错误，提升 fail-fast 诊断体验。
- **涉及文件**: `src/services/fs-utils.ts`
- **建议时机**: 下次触及 `checkTargetWritability` 时
- **状态**: open
- **解决记录**:

### TODO-007: `allowedRoot` 内部 broken symlink 被保守拒绝

- **来源**: Story 4-2 CR round 2 (2026-03-26)
- **优先级**: P2
- **类别**: tech-debt
- **描述**: `validateDestPathSecurity()` (fs-utils.ts) 对 broken symlink 采用"一律拒绝"的保守策略——即使 symlink 的目标路径完全在 `allowedRoot` 内部（只是目标文件尚未创建），也会被误判为 `PATH_TRAVERSAL`。当前设计基于安全优先原则：broken symlink 目标不存在意味着后续可能被外部操作创建为指向不安全位置的文件。错误信息已提示"删除该 symlink 后重试"，有清晰的 recovery 路径。场景罕见且不影响正常安装流程。如后续有真实用户反馈，可在安全增强 Story 中细化对 broken symlink 的边界校验后选择性放行。
- **涉及文件**: `src/services/fs-utils.ts`
- **建议时机**: 安全策略专项优化时
- **状态**: open
- **解决记录**:

### TODO-008: fail-fast 后无法返回已完成操作清单

- **来源**: Story 4-2 CR round 3 (2026-03-27)
- **优先级**: P2
- **类别**: tech-debt
- **描述**: `executeInstall()` 将结果累积在本地变量 `resultItems` 中，异常抛出时该变量不会返回给调用方。`AiforgeError` 也不包含 `completedItems` 等附加 payload 字段。AC #6 要求"返回已完成的操作清单（FR-031）"，但当前 throw 模式下无法通过函数返回值传递 partial results。这是跨模块架构变更（影响 `core/errors.ts`、`stages/execute-install.ts`、`pipeline.ts`、`core/reporter.ts`），Story 4-6a（管道编排与错误流控制）Task 2.3 明确排除了该需求，定性为"fail-fast 模式，hash 相同跳过是正常结果"。待后续专项优化 Story 中评估是否需要改变错误语义以支持 partial results 传递。
- **涉及文件**: `src/stages/execute-install.ts`, `src/core/errors.ts`, `src/pipeline.ts`
- **建议时机**: 错误流专项优化 Story（原 Story 4-6a 已决策采用 fail-fast 模式，不实现 partial results）
- **状态**: open
- **解决记录**:

### TODO-010: `createProductionStages().report` 闭包的 repo-relative 路径转换缺少直接集成测试覆盖

- **来源**: Story 4-6b CR round 3 evaluation (2026-03-31)
- **优先级**: P2
- **类别**: test-gap
- **描述**: `pipeline.ts:348-360` 中的 `sourcePath` repo-relative 转换逻辑（`report` 闭包内，将绝对 clone 路径裁剪为 repo-relative 路径后再传给 Reporter）没有直接命中它的自动化测试。现有测试覆盖的是 Reporter 组件层（输入已经是 relative path 时的格式化）和 saveManifest（不涉及 report 闭包）。如果该段逻辑被删除或改坏，现有测试仍有较大概率全绿。建议补一条针对 `createProductionStages().report` 的集成测试，断言传给 `reporter.reportResult()` 的 `items[].sourcePath` 已是 repo-relative 路径（不以 `repoDir` 开头）。代码本身仅 12 行、结构简单，当前风险可控。
- **涉及文件**: `src/pipeline.ts`, `tests/integration/pipeline-production-stages.test.ts`
- **建议时机**: Epic 5（输出体验优化）或下次触及 `pipeline.ts` report 闭包时
- **状态**: open
- **解决记录**:

### TODO-009: `pipeline.ts` manifest mode 类型断言用函数封装替代

- **来源**: Story 4-6a CR round 3 evaluation (2026-03-30)
- **优先级**: P3
- **类别**: refactor
- **描述**: `pipeline.ts:330` 处通过 `as 'copy' | 'symlink' | 'flatten'` 类型断言确保 manifest mode 类型正确。虽然三元表达式逻辑保证了值域正确（Flatten 规则写 `'flatten'`，其余写 `planInfo.mode`），但 `as` 断言绕过了类型系统的静态验证。可考虑将该映射提取为一个辅助函数（如 `resolveManifestMode(ruleType, installMode): ManifestEntry['mode']`），明确输入输出类型，让 TypeScript 通过类型推断而非断言来保证正确性。CR 评估方明确标注为"代码风格偏好，不构成审查发现"，无功能风险。
- **涉及文件**: `src/pipeline.ts`
- **建议时机**: 下次触及 `pipeline.ts` saveManifest 逻辑时，或代码质量专项优化时
- **状态**: open
- **解决记录**:

---

<!-- 已解决事项归档于此，保留用于回顾 -->

### TODO-005: 质量门禁验证的完整执行流程规则增强

- **来源**: Story 4-1 CR round 1-5 (2026-03-25 ~ 2026-03-26)
- **优先级**: P2
- **类别**: other
- **描述**: 现有 "CR 修复后必须同步更新 Story Dev Agent Record" 规则已覆盖意图，但执行不到位，需增强为具体操作流程。CR 修复完成后，必须按以下顺序执行完整验证并将每项结果逐行更新到 Story Dev Agent Record：(1) `npm test` — 记录通过数（含新增测试的增量说明）；(2) `npm run lint` — 记录 error/warning 数（含 Prettier 格式检查）；(3) `npm run build` — 记录构建状态。禁止：只执行部分验证（如只跑 test 不跑 lint）；复用上轮的验证结果（每次修复后必须重新执行）；在验证未全部通过时更新 Story 记录为"通过"。Story 4-1 CR 中该问题出现 3 次：Round 1 lint error 漏报、Round 2 Prettier 问题漏报、Round 3 测试计数过期。
- **涉及文件**: `_bmad-output/project-context.md`, `_bmad-output/planning-artifacts/architecture/04-implementation-patterns.md`
- **建议时机**: 下一次 Sprint 规划或规则文档专项维护时
- **状态**: resolved
- **解决记录**: Story 4-2 CR 规则提炼中正式化为全局规则"CR 修复后必须执行完整质量门禁三件套"，已同步写入 `project-context.md` (CR Workflow Rules) 和 `04-implementation-patterns.md` (CR Workflow Patterns)。

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
