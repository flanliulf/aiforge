---
Epic: 6
Scope: epic
Round: 6
Date: 2026-04-15
Model Used: Claude Opus 4.6 (claude-opus-4-6)
Review Source: epic-6-story-review-summary-20260415-round-6.md
Review Model: GPT-5.4 (gpt-5.4)
Type: Story Review Evaluation
---

## 评估总结

本轮评估针对 Round 6 复审结果（2 条新发现：均为高严重性）。Round 5 的 3 条 P1 修订（AC #3 增量同步策略、filter 空 item 剔除、enableUniversal ownership 锁定）均已确认写回 Story 主干，核心策略层面已收敛。Round 6 发现的问题性质已从"核心策略缺失"下降为"修订后文档内部不自洽"——即修订已经落地到了正确的位置，但未完全传播到相邻的任务描述、Dev Notes 代码示例和 Project Structure Notes。2 条发现均确认有效，但评估后严重性均降级为 P1（非 P0）：文档内自洽性问题虽然会误导开发者，但核心策略方向已正确，修订面为文本同步而非设计返工。整体判断：**需修订后再审**，修订范围已收窄为文本对齐。

## 上轮问题回顾确认

### Round 5 / Finding #1 — Story 6-3 AC #3 增量同步策略：已确认修复

交叉验证 Story 6-3 Task 6.4 文本：已明确描述文件级 hash 比对方案，不再声称"现有目录型链路天然支持 skipped"。Dev Notes 的 NFR-C7 章节也已添加注意事项，明确 `executeInstall()` 的 `Directories` 分支"需要有限扩展"以支持文件级 hash 比对。**核心策略层面已关闭**，但传播不完整导致新问题（见 Finding #2）。

### Round 5 / Finding #2 — Story 6-2 filter 后空 item 未剔除：已确认修复

交叉验证 Story 6-2 Task 3.3 文本：已添加 `sourceFiles.length === 0 → 不执行 items.push` 的显式守卫。Task 3.6 也已更新为强调空 item 必须剔除。**核心逻辑层面已关闭**，但 Task 3.1 与 Dev Notes 代码示例未同步导致新问题（见 Finding #1）。

### Round 5 / Finding #4 — Story 6-3 enableUniversal 多方案分叉：已确认修复

交叉验证 Story 6-3 Task 5：已锁定唯一实现方案。Task 9.5 新增了真实 `executeInstall()` → `saveManifest()` 链路的集成测试。**关闭**。

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

> **[高][新] Story 6-2 的 filter 修订未完全同步，Task 与 Dev Notes 仍给出冲突实现口径**
> - 来源：structure+consistency
> - 分类：patch
> - 涉及 Story：6-2
> - 证据 - Task 3.1 仍要求"修改 `scanSourceFiles()` 函数：在返回 sourceFiles 之前应用 filter"；但 Task 3.2 / 3.3 与 Dev Notes "filter 在管道中的位置"都把 filter 放在 `scanSourceFiles` 返回后、`items.push` 之前；同时 Dev Notes 的 `match-rules.ts` 代码示例仍是无条件 `items.push({ rule, sourceFiles, targetPath, mode })`，没有把 Task 3.3 新增的 empty-item guard 写进去。
> - 影响 - Round 5 已关闭的空 item 问题被重新打开成"多种实现都能自圆其说"的文档状态。开发者既可能把 filter 塞回共享的 `scanSourceFiles()`，也可能照着示例继续 push 空 item，最终再次破坏 AC #5 的 dry-run 一致性，并让 Story 6-3 复用 filter 逻辑时继续漂移。
> - 建议 - 删除 Task 3.1 对 `scanSourceFiles()` 的改写要求，锁定唯一集成点为 `matchRules()` 主循环的 post-scan 过滤；同步更新 Dev Notes 代码示例，把 pre-push empty-item guard 写成显式步骤。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 逐字验证确认三处文本冲突均真实存在：(1) Task 3.1 仍写"修改 `scanSourceFiles()` 函数：在返回 sourceFiles 之前…应用 filter 过滤"，将 filter 定位在 `scanSourceFiles()` 内部；(2) Task 3.2 明确写"过滤逻辑位置：在 `scanSourceFiles` 返回后、`items.push` 之前"，将 filter 定位在主循环外部；(3) Dev Notes 的 `match-rules.ts` 代码示例末尾为无条件 `items.push({ rule, sourceFiles, targetPath, mode })`，完全没有体现 Task 3.3 新增的 `sourceFiles.length === 0 → 不执行 items.push` 守卫。三处文本各自能自圆其说，但组合后互相矛盾。

**严重性判断**：合理 — 这是一个真实的文档内自洽性问题。虽然 Task 3.2/3.3 作为更详细的子任务在实践中会优先于 Task 3.1 的概述，一个有经验的开发者大概率会按 3.2/3.3 执行，但 Dev Notes 代码示例是开发者最常参考的"可复制粘贴"模板——其中缺少 empty-item guard 是更危险的遗漏。双来源命中（structure+consistency）增强了可信度。P1 合理：filter 集成点的唯一性直接影响 AC #5 可测性。

**修订建议**：可行 — 审查建议（删除 Task 3.1 对 `scanSourceFiles` 的改写、锁定 post-scan 集成点、更新 Dev Notes 示例）是最小改动方案，不涉及设计变更，只是文本对齐。修订面清晰且有限。

**误报评估**：非误报 — 三处文本冲突可直接从 Story 文档中逐字验证。

## 发现 #2 评估

### 审查原文

> **[高][新] Story 6-3 的文件级 hash 方案只改了核心任务，测试任务与改动面说明仍停留在旧口径**
> - 来源：structure+consistency+contract
> - 分类：patch
> - 涉及 Story：6-3
> - 证据 - Task 6.4 与 Dev Notes 已明确：`Directories` 分支需要文件级 hash 比对，`saveManifest()` 也要从"整目录单条空 hash"改为"每个文件单独记录 entry"；但 Task 9.2 仍写"通用目录安装走现有 copy 逻辑，目录自动创建"，Task 9.3 仍把 manifest 追踪留在 mocked `pipeline.test.ts` 层，Project Structure Notes 仍把 `src/stages/execute-install.ts` 描述为"toolNameMap fallback，极小改动"，且未把 `services/fs-utils.ts` / manifest 写入面列入修改清单。
> - 影响 - Round 5 新锁定的实现模型没有真正传播到测试分工与文件清单。按当前 Story 开发，开发者仍可能只补显示层和现有 copy 路径测试，而遗漏 AC #3 真正需要的 `executeInstall()` + manifest 运行时扩展。
> - 建议 - 重写 Task 9.2 / 9.3 / 9.5 的边界，明确哪些测试验证文件级 skip 运行时、哪些只做 dry-run / 分组展示；同时把 `execute-install`、`saveManifest` 以及相关 fs/manifest 支撑面完整写入 Project Structure Notes / File List。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 逐项验证确认：

1. **Task 9.2** 确实仍写"通用目录安装走现有 copy 逻辑，目录自动创建"。这与 Task 6.4 明确声明的"此方案需要在 `executeInstall()` 的 `Directories` 分支新增文件级比对逻辑，是对现有代码路径的有限扩展（而非'零改动'）"直接矛盾。

2. **Task 9.3** 确实仍将 manifest 追踪测试放在 `tests/pipeline.test.ts`。虽然 Task 9.5 已补充了真实链路的集成测试，但 9.3 的描述未更新，两个任务之间的职责边界模糊——9.3 说"manifest 正确追踪通用目录文件"，9.5 也说"使用真实 executeInstall() → saveManifest() 链路"验证增量同步，manifest 追踪到底由哪个任务负责？

3. **Project Structure Notes** 确实将 `execute-install.ts` 描述为"toolNameMap fallback，极小改动"，与 Task 6.4 / Dev Notes 的"需要有限扩展"形成直接矛盾。修改清单中也确实缺少 `saveManifest()` 相关的改动面说明（Dev Notes 明确写到"saveManifest() 需调整：manifest 为 Directories 类型每个文件单独记录 entry"）。

**严重性判断**：合理 — 三来源命中（structure+consistency+contract）是 Round 6 中最高的交叉验证强度。核心策略（Task 6.4 + Dev Notes）已正确，但测试任务分工和改动面清单的滞后会直接导致：(a) 开发者按 Task 9.2 跳过 `Directories` 分支扩展的单元测试；(b) 开发者按 Project Structure Notes 低估 `execute-install.ts` 的改动范围。P1 合理：这影响 AC #3 的可测性和实施完整性。

不过需要公正指出：Task 9.5 的存在说明修订者已经意识到需要真实链路验证，只是没有回头清理旧任务描述。问题的本质是"传播不完整"而非"方向错误"。

**修订建议**：可行 — 修订面明确：(1) 更新 Task 9.2 描述以反映文件级 hash 扩展；(2) 明确 Task 9.3 vs 9.5 的职责边界（建议 9.3 只验证 dry-run 展示和分组，9.5 负责运行时增量同步和 manifest 正确性）；(3) 更新 Project Structure Notes 将 `execute-install.ts` 从"极小改动"改为"有限扩展"并补充 `saveManifest()` / manifest 写入面。修订量可控，不涉及设计返工。

**误报评估**：非误报 — 文档证据可直接逐字验证，四处不一致（Task 9.2 / Task 9.3 边界 / Project Structure Notes / File List）均有实锤。

## 整体评估结论

### 需要修订（阻塞进入开发）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 1 | filter 集成点 Task/Dev Notes 三处冲突 | [高] | P1 | 统一集成点、更新代码示例即可 |
| 2 | 文件级 hash 方案未传播到测试/改动面 | [高] | P1 | 对齐 Task 9.2/9.3/Structure Notes |

### 建议纳入后续改善跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| R5-#3 | reportList 共享接口 blast radius | [中] | P2 | TypeScript 编译守卫兜底 |
| R5-#5 | "可安装子目录"语义漂移 | [低] | P2 | AC 原文未使用该措辞 |

### 可忽略（误报）

| # | 发现 | 原始严重性 | 忽略理由 |
|---|------|----------|---------|
| — | 无 | — | — |

### 评估决定

**整体结论**：需修订后再审

Round 6 的 2 条阻塞项性质均为"文本同步遗漏"而非"设计方向错误"——核心策略（文件级 hash、post-scan filter、单一 ownership）已全部就位，只需把已确定的策略完整传播到 Task 描述、Dev Notes 代码示例和 Project Structure Notes 即可。修订面有限且明确，预期一轮修订可以收敛。建议依次处理：(1) Story 6-2 Task 3.1 + Dev Notes 代码示例对齐；(2) Story 6-3 Task 9.2/9.3 边界重划 + Project Structure Notes 更新。

## 修订执行记录

### 修订执行记录
- **Date**: 2026-04-15
- **Model Used**: Claude Opus 4.6 (claude-opus-4-6)
- **Fix Items**: 2

#### 修订项 #1: Story 6-2 filter 集成点 Task/Dev Notes 三处冲突
- **文件**: `_bmad-output/implementation-artifacts/stories/6-2-filter-subdirectory-install.md`
- **章节**: Task 3.1 + Dev Notes "match-rules.ts 中的 filter 集成点" 代码示例
- **修改摘要**:
  1. **Task 3.1**：从"修改 `scanSourceFiles()` 函数：在返回 sourceFiles 之前应用 filter"改为"在 `matchRules()` 主循环中集成 filter 逻辑：过滤位置统一为 `scanSourceFiles` 返回后、`items.push` 之前（**不修改 `scanSourceFiles()` 函数本身**，保持其为纯扫描职责）"。消除了 Task 3.1 与 Task 3.2/3.3 之间的集成点冲突。
  2. **Dev Notes 代码示例**：在 `items.push()` 前添加 `if (sourceFiles.length === 0) continue` 的 empty-item guard，并附注释说明其作用（防止 `reportPlan()` 输出 `emptySourceDir` 行、违反 AC #5）。与 Task 3.3 的守卫要求对齐。
- **状态**: 已完成

#### 修订项 #2: Story 6-3 文件级 hash 方案未传播到测试/改动面
- **文件**: `_bmad-output/implementation-artifacts/stories/6-3-universal-directory-install.md`
- **章节**: Task 9.2 / Task 9.3 / Project Structure Notes
- **修改摘要**:
  1. **Task 9.2**：从"通用目录安装走现有 copy 逻辑，目录自动创建"改为区分 Files 和 Directories 两种类型的测试要求——Files 类型走现有 copy 逻辑，Directories 类型验证文件级 hash 比对逻辑（hash 相同→skip，hash 不同→write）；补充 toolNameMap fallback 测试。
  2. **Task 9.3**：明确职责边界为"仅负责 dry-run 展示和分组验证"，补充 `--no-universal` 时 dry-run 不包含通用目录的用例；添加注释明确 manifest 运行时正确性验证由 Task 9.5 的集成测试负责，此处不重复覆盖。
  3. **Project Structure Notes**：`execute-install.ts` 从"toolNameMap fallback，极小改动"改为"`Directories` 分支新增文件级 hash 比对逻辑以支持 AC #3 增量同步 + toolNameMap fallback"；`pipeline.ts` 描述补充"Directories 类型 manifest 条目从整目录空 hash 改为文件级单独记录"；测试清单补充 `tests/integration/`（新增增量同步集成测试，Task 9.5）和 `execute-install.test.ts` 含 Directories 文件级 hash 验证说明。
- **状态**: 已完成
