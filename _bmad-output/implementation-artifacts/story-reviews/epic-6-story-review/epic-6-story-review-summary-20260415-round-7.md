---
Epic: 6
Scope: epic
Round: 7
Date: 2026-04-15
Model Used: GPT-5.4 (gpt-5.4)
Type: Story Review Summary
Stories Reviewed: 4
---

## 审查结论

第 7 轮复审。共复审 Epic 6 下 4 个 Story。审查层状态：3/3 层完成（`structure` / `consistency` / `contract`）。

- 通过：0 个
- 有条件通过：3 个
- 硬阻塞：1 个

总体判断：Round 6 的两条阻塞都已真正关闭，Epic 6 已从“核心设计未收敛”进入“少量文本与交付说明残留”的尾声阶段。本轮唯一仍需修订的阻塞是 Story 6-4 对 Story 6-3 测试归属的旧引用尚未同步；此外，Story 6-2 还剩一处 Dev Notes 代码示例未补齐，但已不再影响核心方案的唯一性。

## 审查范围

- Story 文件：
  - `6-1-list-subdirectory-contents.md`
  - `6-2-filter-subdirectory-install.md`
  - `6-3-universal-directory-install.md`
  - `6-4-init-universal-directory-preference.md`
- 对照基准：
  - `project-context.md`
  - `planning-artifacts/epics/epic-6.md`
  - `planning-artifacts/architecture/03-core-decisions.md`
  - `planning-artifacts/architecture/04-implementation-patterns.md`
  - `src/core/types.ts`
  - `src/index.ts`
  - `src/pipeline.ts`
  - `src/stages/match-rules.ts`
  - `src/stages/execute-install.ts`
  - `tests/cli-args.test.ts`
  - `tests/pipeline.test.ts`
  - `epic-6-story-review-summary-20260415-round-6.md`
  - `epic-6-story-review-evaluation-20260415-round-6.md`
- 审查维度：
  - 结构完整性
  - AC 可测性
  - 与 Epic 一致性
  - 与架构文档一致性
  - Story 间冲突与依赖
  - 任务拆分合理性
  - 交互/认证/安全/性能口径
  - 跨 Epic 共享契约

## 上轮问题回顾

### 已修复

1. Round 6 / Finding #1 — Story 6-2 的 filter 集成点与 empty-item guard 文本冲突
   - `6-2` 的 Task 3.1 已改为在 `matchRules()` 主循环中做 post-scan 过滤，不再要求改写 `scanSourceFiles()`；Dev Notes 的 `match-rules.ts` 示例也已补上 empty-item guard。
   - 本轮复核结论：Round 6 的核心阻塞已关闭。

2. Round 6 / Finding #2 — Story 6-3 的文件级 hash 方案未同步到测试任务与改动面说明
   - `6-3` 的 Task 9.2 / 9.3 已重新划分测试职责，Project Structure Notes 也已同步到 `execute-install.ts` 的有限扩展与 `tests/integration/` 的新增集成测试。
   - 本轮复核结论：Round 6 的核心阻塞已关闭。

### 仍为非阻塞待办

1. Round 5 / Finding #3 — Story 6-1 的 `reportList()` 共享接口 blast radius 仍未显式写入任务
   - 维持 P2，尚不构成 Round 7 阻塞。

2. Round 5 / Finding #5 — Story 6-1 的“可安装子目录”语义与真实 rule-based 集合仍有漂移
   - 维持 P2，尚不构成 Round 7 阻塞。

3. Round 1 defer — `tool: 'universal'` 仍是共享 `tool` 字段的例外语义
   - 维持 defer。

4. Round 1 defer — `--filter` 的“子目录”术语与 `sourceFiles` 泛化语义仍未完全统一
   - 维持 defer。

## 新发现

### 1. [高][新] Story 6-4 仍把 AC #3-#5 的运行时测试归属绑定到旧的 `tests/pipeline.test.ts` 口径
- **来源**：structure+consistency
- **分类**：patch
- **涉及 Story**：6-4
- **证据** - `6-4` 的“跨 Story 依赖声明”仍写“AC #3-#5 的运行时测试由 Story 6-3 的 `tests/pipeline.test.ts` 覆盖”；Task 7.1 与 Dev Notes “AC #3 和 #4 的运行时行为”两处也仍重复这一表述。但 `6-3` 经过 Round 6 修订后，已经明确把职责拆分为：`tests/pipeline.test.ts` 只负责 dry-run 展示与分组验证，真实 install / manifest / incremental-sync 行为由 Task 9.5 的集成测试覆盖。
- **影响** - 6-4 的跨 Story 责任说明仍停留在旧测试归属模型，会误导后续实现者和评审者把 AC #3-#5 的验证继续理解为单一 `pipeline.test.ts` 责任，削弱 Task 9.5 集成测试的必要性，也让 6-4 与 6-3 当前文本重新产生不一致。
- **建议** - 同步更新 6-4 的跨 Story 依赖声明、Task 7.1 和相关 Dev Notes，改为区分：dry-run 行为由 `tests/pipeline.test.ts` 覆盖，真实 install / manifest / incremental-sync 行为由 6-3 的 Task 9.5 集成测试覆盖。

### 2. [低][新] Story 6-2 的零匹配重试代码示例仍停在省略号，未把 `resolvedFilter` 的重试闭环写完整
- **来源**：structure
- **分类**：patch
- **涉及 Story**：6-2
- **证据** - `6-2` 的 Dev Notes “零匹配交互式询问”章节在 `const resolvedFilter = choice` 之后仍写“重新扫描：直接过滤 items，用 resolvedFilter 替代 args.filter // ...（保持 dirPrefix 作用域的精确匹配）”；而 Task 4.3 已明确要求使用局部变量 `resolvedFilter` 重新执行 `scanSourceFiles + filter` 逻辑。
- **影响** - 主任务与边界要求已经清晰，不再构成核心设计阻塞；但 Dev Notes 的关键代码片段仍未补齐，容易让开发者在实际实现时自行脑补重试闭环，增加作用域细节再次走偏的风险。
- **建议** - 补一段最小可执行代码示例，明确 `resolvedFilter` 如何重新参与 `parseFilterPattern`、`scanSourceFiles` 和 `items` 重建流程。

## 逐篇审查结论

### Story 6.1: `--list` 子目录内容列举

**结论：有条件通过**

**优点**
- `--list` 的管道分叉、空目录成功态与 Reporter 生命周期契约保持稳定。
- 本轮未发现新的结构性回退。

**关注点**
- `reportList()` 的共享接口 blast radius 仍未显式写入任务。
- “可安装子目录”与真实 rule-based 集合的语义漂移仍未处理。

**建议动作**
- 维持当前结论，待 Epic 6 阻塞完全关闭后统一处理两条 P2 遗留项。

### Story 6.2: `--filter` 精准子目录安装

**结论：有条件通过**

**优点**
- filter 的唯一集成点已经锁定为 `matchRules()` 主循环的 post-scan 过滤。
- empty-item guard、dry-run 一致性和 prefixed `scanDir` 作用域都已收敛。

**关注点**
- 零匹配重试的 Dev Notes 代码示例仍未补齐 `resolvedFilter` 的完整闭环。

**建议动作**
- 补齐用户选择后的最小可执行示例，避免实现阶段在细节上再次漂移。

### Story 6.3: 通用目标目录默认安装

**结论：有条件通过**

**优点**
- `enableUniversal` 的 ownership 已稳定锁定。
- 文件级 hash 方案、Task 9 分工和 Project Structure Notes 已完成同步。

**关注点**
- 无新的阻塞级问题；仅保留既有 defer 项和与 6-4 的同步提醒。

**建议动作**
- 保持当前状态，等待 6-4 同步测试归属说明后再合并验收。

### Story 6.4: `aiforge init` 通用目录偏好配置

**结论：硬阻塞**

**优点**
- `init` 侧的偏好收集、配置持久化和默认值逻辑仍然清晰。
- 与 6-3 的“配置收集 vs 运行时行为”边界没有回退。

**关键问题**
1. **跨 Story 测试归属仍引用旧模型** — 6-4 仍把 AC #3-#5 的运行时测试绑定到单一 `tests/pipeline.test.ts`，没有同步 6-3 已经拆分出的 Task 9.5 集成测试责任。

**建议动作**
- 先同步 6-4 中关于 6-3 测试归属的所有引用，再进入开发。

## 通过项

- Round 6 的两条阻塞都已真实关闭，没有出现策略级回退。
- Story 6-2 与 Story 6-3 已从“硬阻塞”收敛到“有条件通过”。
- Story 6-1 本轮未出现新的阻塞级问题。
- 历史 defer 项继续维持 defer，没有被本轮修订放大。

## 结论

- **结论**：不通过
- **阻塞项**：
  - Story 6-4 仍引用过时的 AC #3-#5 运行时测试归属说明
- **建议**：
  - 先同步 Story 6-4 对 Story 6-3 测试归属的所有引用
  - 视情况补齐 Story 6-2 的 `resolvedFilter` 重试示例
  - 完成后执行 Round 8 复审