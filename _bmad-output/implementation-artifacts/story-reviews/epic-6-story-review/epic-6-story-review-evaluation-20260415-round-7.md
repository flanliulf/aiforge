---
Epic: 6
Scope: epic
Round: 7
Date: 2026-04-15
Model Used: Claude Opus 4.6 (claude-opus-4-6)
Review Source: epic-6-story-review-summary-20260415-round-7.md
Review Model: GPT-5.4 (gpt-5.4)
Type: Story Review Evaluation
---

## 评估总结

本轮评估针对 Round 7 复审结果（2 条新发现：1 条高严重性、1 条低严重性）。Round 6 的 2 条 P1 阻塞（filter 集成点三处冲突、文件级 hash 方案未传播到测试/改动面）均已确认关闭，Epic 6 已进入尾声收敛阶段。本轮唯一新发现的阻塞是 Story 6-4 的跨 Story 测试归属声明仍引用旧的 `tests/pipeline.test.ts` 单一模型，未同步 Story 6-3 Round 6 修订后的 Task 9.3/9.5 职责拆分；另有 Story 6-2 Dev Notes 中 `resolvedFilter` 重试代码仍以省略号占位的低优先级问题。2 条发现均确认有效：Finding #1 维持 P1（跨 Story 契约不一致直接影响测试实施完整性），Finding #2 降级为 P2（主任务规范已清晰，Dev Notes 代码示例补全属于锦上添花）。整体判断：**需修订后再审**，修订范围已缩窄到 Story 6-4 的三处文本引用对齐。

## 上轮问题回顾确认

### Round 6 / Finding #1 — Story 6-2 filter 集成点与 empty-item guard 文本冲突：已确认修复

交叉验证 Story 6-2 文本：Task 3.1 已改为"在 `matchRules()` 主循环中集成 filter 逻辑"，不再要求改写 `scanSourceFiles()`；Dev Notes 的 `match-rules.ts` 代码示例已补上 `if (sourceFiles.length === 0) continue` 的 empty-item guard。集成点唯一性与代码示例一致性均已收敛。**关闭**。

### Round 6 / Finding #2 — Story 6-3 文件级 hash 方案未传播到测试任务与改动面说明：已确认修复

交叉验证 Story 6-3 文本：Task 9.2 已更新为区分 Files 与 Directories 两种安装行为的测试要求；Task 9.3 已明确"仅负责 dry-run 展示和分组验证"，manifest 运行时正确性由 Task 9.5 负责；Project Structure Notes 已将 `execute-install.ts` 描述更新为"有限扩展"并补充了 `tests/integration/` 条目。**关闭**。

### 历史非阻塞待办

| 来源 | 问题 | 状态 |
|------|------|------|
| R5-#3 | Story 6-1 `reportList()` 共享接口 blast radius 未入任务 | 维持 P2 |
| R5-#5 | Story 6-1 "可安装子目录"语义漂移 | 维持 P2 |
| R1-#4 | `tool: 'universal'` 扩展共享字段语义 | 维持 defer |
| R1-#5 | `--filter` "子目录"与 `sourceFiles` 术语不一致 | 维持 defer |

确认均仍为非阻塞，无需升级。

## 发现 #1 评估

### 审查原文

> **[高][新] Story 6-4 仍把 AC #3-#5 的运行时测试归属绑定到旧的 `tests/pipeline.test.ts` 口径**
> - 来源：structure+consistency
> - 分类：patch
> - 涉及 Story：6-4
> - 证据 - `6-4` 的"跨 Story 依赖声明"仍写"AC #3-#5 的运行时测试由 Story 6-3 的 `tests/pipeline.test.ts` 覆盖"；Task 7.1 与 Dev Notes "AC #3 和 #4 的运行时行为"两处也仍重复这一表述。但 `6-3` 经过 Round 6 修订后，已经明确把职责拆分为：`tests/pipeline.test.ts` 只负责 dry-run 展示与分组验证，真实 install / manifest / incremental-sync 行为由 Task 9.5 的集成测试覆盖。
> - 影响 - 6-4 的跨 Story 责任说明仍停留在旧测试归属模型，会误导后续实现者和评审者把 AC #3-#5 的验证继续理解为单一 `pipeline.test.ts` 责任，削弱 Task 9.5 集成测试的必要性，也让 6-4 与 6-3 当前文本重新产生不一致。
> - 建议 - 同步更新 6-4 的跨 Story 依赖声明、Task 7.1 和相关 Dev Notes，改为区分：dry-run 行为由 `tests/pipeline.test.ts` 覆盖，真实 install / manifest / incremental-sync 行为由 6-3 的 Task 9.5 集成测试覆盖。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 逐字验证确认 Story 6-4 中三处引用均仍停留在旧模型：

1. **跨 Story 依赖声明**（第 28-30 行）：明确写"AC #3-#5 的运行时测试由 Story 6-3 的 `tests/pipeline.test.ts` 覆盖"，将所有运行时验证责任归属到单一文件。
2. **Task 7.1**（第 72-75 行）：写"确认 Story 6-3 已实现并通过测试（`tests/pipeline.test.ts` 中包含以下场景）"，并列举了 AC #3/#4/#5 三个场景全部归属 `tests/pipeline.test.ts`。
3. **Dev Notes "AC #3 和 #4 的运行时行为"**（第 138-148 行）：写"AC #3 和 #4 的行为测试在 Story 6-3 的测试中覆盖（`tests/pipeline.test.ts`）"。

与此同时，Story 6-3 经过 Round 6 修订后，Task 9.3 已明确"仅负责 dry-run 展示和分组验证"，Task 9.5 负责"真实 `executeInstall()` → `saveManifest()` 链路"的集成测试。6-4 的三处引用与 6-3 当前文本形成直接矛盾。

**严重性判断**：合理 — 跨 Story 依赖声明是后续开发者和评审者理解测试职责划分的关键参考。如果 6-4 继续声称"AC #3-#5 运行时测试全部由 `tests/pipeline.test.ts` 覆盖"，开发者在实现 Story 6-4 的 Task 7（跨 Story 验证）时会仅检查 `pipeline.test.ts` 而忽略 Task 9.5 的集成测试——这会直接导致增量同步（AC #3 的核心运行时行为）的验证遗漏。审查判定为硬阻塞 Story 6-4，P1 合理。

**修订建议**：可行 — 修订范围精确且有限：三处文本引用改为区分"dry-run 行为 → `tests/pipeline.test.ts`"与"运行时 install/manifest/incremental-sync → Task 9.5 集成测试"。不涉及任何设计变更，纯文本对齐。

**误报评估**：非误报 — 三处旧引用可从 Story 6-4 文档逐字验证，且与 Story 6-3 当前文本的矛盾有明确的文本证据支撑。

## 发现 #2 评估

### 审查原文

> **[低][新] Story 6-2 的零匹配重试代码示例仍停在省略号，未把 `resolvedFilter` 的重试闭环写完整**
> - 来源：structure
> - 分类：patch
> - 涉及 Story：6-2
> - 证据 - `6-2` 的 Dev Notes "零匹配交互式询问"章节在 `const resolvedFilter = choice` 之后仍写"重新扫描：直接过滤 items，用 resolvedFilter 替代 args.filter // ...（保持 dirPrefix 作用域的精确匹配）"；而 Task 4.3 已明确要求使用局部变量 `resolvedFilter` 重新执行 `scanSourceFiles + filter` 逻辑。
> - 影响 - 主任务与边界要求已经清晰，不再构成核心设计阻塞；但 Dev Notes 的关键代码片段仍未补齐，容易让开发者在实际实现时自行脑补重试闭环，增加作用域细节再次走偏的风险。
> - 建议 - 补一段最小可执行代码示例，明确 `resolvedFilter` 如何重新参与 `parseFilterPattern`、`scanSourceFiles` 和 `items` 重建流程。

### 评估结论：⚠️ 有效但降级 — 建议纳入后续改善跟踪（P2）

### 评估分析

**问题描述准确性**：准确 — 逐字验证确认 Story 6-2 Dev Notes "零匹配交互式询问"章节第 264-267 行：`const resolvedFilter = choice` 之后确实只有 `// ...（保持 dirPrefix 作用域的精确匹配）` 的注释占位符，没有实际的重试逻辑代码。同时 Task 4.3 已明确规范"用局部变量 `resolvedFilter` 保存用户选择的限定名称…重新执行 `scanSourceFiles` + filter 逻辑；禁止改写 `args.filter`"。Dev Notes 示例与 Task 规范之间确实存在完整性差距。

**严重性判断**：偏高 — 审查原文已正确标注为 [低]，但考虑以下因素应进一步降级为 P2：(1) Task 4.3 作为正式任务规范已经完整且不含歧义，`resolvedFilter` 的语义、作用域和禁止改写 `args.filter` 的约束均已明确；(2) Dev Notes 的代码示例是辅助参考而非规范来源，开发者实现时应以 Task 为准；(3) 此处省略号是**有意的简化**（注释写明"保持 dirPrefix 作用域的精确匹配"，表明方向已给出），而非遗漏。补齐代码示例是改善性优化，不构成开发阻塞。

**修订建议**：可行但非必要 — 补齐最小可执行示例是好的改善，但不是进入开发的前置条件。Task 4.3 的规范已足以指导正确实现。建议纳入后续改善跟踪，可在 Story 实现阶段视具体需要再补充。

**误报评估**：非误报 — Dev Notes 省略号确实存在，与 Task 4.3 的完整规范之间存在信息密度差距。但严重性需调低。

## 整体评估结论

### 需要修订（阻塞进入开发）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 1 | Story 6-4 AC #3-#5 测试归属仍引用旧模型 | [高] | P1 | 同步 6-4 三处引用到 6-3 的 Task 9.3/9.5 拆分 |

### 建议纳入后续改善跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 2 | Story 6-2 resolvedFilter 重试代码示例省略号 | [低] | P2 | Task 4.3 规范已完整，Dev Notes 示例属辅助改善 |
| R5-#3 | Story 6-1 reportList 共享接口 blast radius | [中] | P2 | TypeScript 编译守卫兜底 |
| R5-#5 | Story 6-1 "可安装子目录"语义漂移 | [低] | P2 | AC 原文未使用该措辞 |

### 可忽略（误报）

| # | 发现 | 原始严重性 | 忽略理由 |
|---|------|----------|---------|
| — | 无 | — | — |

### 评估决定

**整体结论**：需修订后再审

Story 6-4 的跨 Story 测试归属声明是本轮唯一阻塞项，修订范围仅限三处文本引用的对齐（跨 Story 依赖声明、Task 7.1、Dev Notes "AC #3 和 #4" 章节）。建议执行 SR-03 修订后提交 Round 8 复审。Finding #2 的 Dev Notes 代码示例补全为可选改善，可一并处理或推迟到实现阶段。

## 修订执行记录

### 修订执行记录
- **Date**: 2026-04-15
- **Model Used**: Claude Opus 4.6 (claude-opus-4-6)
- **Fix Items**: 1（含 3 处文本修订点）

#### 修订项 #1: Story 6-4 AC #3-#5 测试归属仍引用旧模型
- **文件**: `_bmad-output/implementation-artifacts/stories/6-4-init-universal-directory-preference.md`
- **章节**: 跨 Story 依赖声明、Task 7.1、Dev Notes "AC #3 和 #4 的运行时行为"
- **修改摘要**:
  - **跨 Story 依赖声明**：原文"AC #3-#5 的运行时测试由 Story 6-3 的 `tests/pipeline.test.ts` 覆盖"→ 修订为区分职责：dry-run 展示与分组验证由 `tests/pipeline.test.ts`（Task 9.3）覆盖；真实 install / manifest / incremental-sync 行为由 Task 9.5 集成测试覆盖
  - **Task 7.1**：原文将 AC #3/#4/#5 三个场景全部归属 `tests/pipeline.test.ts`→ 修订为拆分两层验证：`tests/pipeline.test.ts`（Task 9.3）负责 dry-run 展示，Task 9.5 集成测试负责运行时行为（config 覆盖、CLI 覆盖、缺省默认、真实 install→manifest→incremental-sync 链路）
  - **Dev Notes "AC #3 和 #4 的运行时行为"**：原文"AC #3 和 #4 的行为测试在 Story 6-3 的测试中覆盖（`tests/pipeline.test.ts`）"→ 修订为：运行时行为由 Task 9.5 集成测试覆盖，dry-run 展示由 `tests/pipeline.test.ts`（Task 9.3）覆盖
- **状态**: 已完成
