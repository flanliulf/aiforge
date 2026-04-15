---
Epic: 6
Scope: epic
Round: 4
Date: 2026-04-14
Model Used: Codex (GPT-5-based) (codex)
Type: Story Review Summary
Stories Reviewed: 4
---

## 审查结论

第 4 轮复审。共复审 Epic 6 下 4 个 Story。审查层状态：3/3 层完成（`structure` / `consistency` / `contract`）。

- 通过：2 个
- 有条件通过：1 个
- 硬阻塞：1 个

总体判断：Round 3 的大部分修订已经真正落地，Epic 6 现在只剩 1 个阻塞 Story。Story 6-1 的 stdout 成功态、Story 6-3 的 `instanceof AiforgeError` 白名单降级、以及 Story 6-4 的跨 Story 依赖声明都已基本收口；但 Story 6-2 仍有 2 个必须一起关闭的问题：prefixed 零匹配候选列表仍可能扫错目录，且 TTY 选择/取消路径依然没有测试闭环。

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
  - `src/pipeline.ts`
  - `tests/pipeline.test.ts`
  - `tests/integration/pipeline.test.ts`
  - `epic-6-story-review-summary-20260414-round-3.md`
  - `epic-6-story-review-evaluation-20260414-round-3.md`
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

1. Round 3 / Finding #1 — Story 6-2 直接 `process.exit(0)` 改写编排器契约
   - Dev Notes 已改为“捕获 `FilterCancelledSignal` 后直接 `return`”，不再要求直接终止进程。
   - 复核结论：契约层面的直接退出问题已关闭。

2. Round 3 / Finding #4 — Story 6-1 空目录成功态走 `warn()/stderr`
   - `6-1` 已明确改为 `reporter.reportList(args.list!, [])`，并在 Task 3.6 / 4.5 / Dev Notes 中显式禁止 `reporter.warn()`。
   - 复核结论：此项关闭。

3. Round 3 / Finding #5 — Story 6-3 的 `CONFIG_NOT_FOUND` 降级缺少 `instanceof AiforgeError`
   - `6-3` Task 5.4 与 Dev Notes 已统一为 `error instanceof AiforgeError && error.code === 'CONFIG_NOT_FOUND'`。
   - 复核结论：此项关闭。

4. Round 3 / Finding #2 — Story 6-4 的 AC #3-#5 边界未收口
   - `6-4` 已新增跨 Story 依赖声明，并补 Task 7 显式要求由 Story 6-3 的测试覆盖 AC #3-#5。
   - 复核结论：上一轮的“边界硬阻塞”已基本关闭；当前仅剩收尾表述上的一致性观察，不再构成阻塞。

5. Round 3 / Finding #3 — Story 6-2 的 helper 名称分叉
   - Task / Dev Notes / 依赖说明现在都回到了 `scanAvailableTopDirs()` 这条共享 helper 链路。
   - 复核结论：旧的“helper 名称不一致”问题已关闭；但扫描作用域仍有新的语义问题，见本轮 Finding #1。

### 仍为非阻塞待办

1. Round 1 / Finding #4 — `tool: 'universal'` 仍作为共享 `tool` 字段的例外语义
   - 维持既有评估结论，继续列为已知 defer 项。

2. Round 1 / Finding #5 — `--filter` 的“子目录”与“全部 sourceFiles”术语仍未统一
   - 维持既有评估结论，继续列为已知 defer 项。

## 新发现

### 1. [高][新] Story 6-2 的 prefixed 零匹配候选列表仍会扫描错目录
- **来源**：structure+consistency+contract
- **分类**：patch
- **涉及 Story**：6-2
- **证据** - Epic 6 AC #4 要求 `--filter skills/xyz*` 零匹配时展示 `skills/` 下可用子目录；`6-2` Task 4.2 也写明共享 helper 应指向 `filter.dirPrefix` 对应目录或仓库根目录。但当前 Dev Notes 仍固定调用 `scanAvailableTopDirs(repo.repoDir)`，然后将结果拼成 `${dirPrefix}/${d}`。在 `dirPrefix = skills` 时，这会把仓库顶层目录名错误变成 `skills/skills`、`skills/agents` 等候选值，TTY 选择列表和非 TTY `fix[]` 都会偏离 AC #4。
- **影响** - Story 6-2 的核心恢复链路仍会把用户引向错误目录，导致零匹配交互和错误提示同时失真；开发者若按当前示例实现，会直接回归到错误建议路径。
- **建议** - 明确 prefixed case 必须扫描 `join(repo.repoDir, dirPrefix)`，并让 Task、Dev Notes、依赖说明统一表达同一个作用域契约；必要时把共享 helper 的语义描述从“顶层目录”改成“当前作用域目录下的候选名”。

### 2. [中][新] Story 6-2 的 TTY 选择/取消路径仍缺少测试闭环
- **来源**：structure+contract
- **分类**：patch
- **涉及 Story**：6-2
- **证据** - Round 3 已把 `FilterCancelledSignal` 的编排器示例从 `process.exit(0)` 改为 `return`，但当前 Task 6 仍只覆盖非 TTY `FILTER_NO_MATCH` 和 dry-run 预览，没有覆盖“TTY 选择后重试匹配”或“TTY 取消后 pipeline 正常返回、不触发 `reportError()`、不设置 `process.exitCode`、不继续 install/saveManifest/report`”这两条交互主路径。
- **影响** - 即使本轮修正了文档示例，后续实现仍可能把取消流重新做回错误通道，或把重试路径做成无效短路，而现有测试计划无法发现回归。
- **建议** - 在 `tests/stages/match-rules.test.ts` 和 `tests/pipeline.test.ts` / `tests/integration/pipeline.test.ts` 中补显式用例，锁定“TTY 选择重试成功”和“TTY 取消正常返回 0”两条路径。

## 逐篇审查结论

### Story 6.1: `--list` 子目录内容列举

**结论：通过**

**优点**
- 空目录成功态已完整切回 `reportList(..., [])` 的 stdout 路径。
- Task、Reporter 契约和 Dev Notes 示例已经对齐，不再残留 `warn()/stderr` 漏口。

**关注点**
- 无新的阻塞项。

### Story 6.2: `--filter` 精准子目录安装

**结论：硬阻塞**

**优点**
- `FilterCancelledSignal -> return` 已按 Round 3 要求收口，不再直接 `process.exit(0)`。
- 旧的 helper 名称分叉已被消除，Task / Dev Notes / 依赖说明都回到了同一条共享 helper 线索。

**关键问题**
1. **prefixed 零匹配仍会扫错目录** — 当前示例在 `skills/xyz*` 场景下仍可能生成错误候选值。
2. **TTY 交互路径没有测试闭环** — 选择重试和取消正常返回的两条主路径尚未被任务/测试锁定。

**建议动作**
- 先修正 prefixed 零匹配的扫描作用域。
- 再补齐 TTY 选择/取消的任务与测试闭环。

### Story 6.3: 通用目标目录默认安装

**结论：通过**

**优点**
- `CONFIG_NOT_FOUND` 的白名单降级已经完全按 `AiforgeError` 契约收口。
- 三层优先级链继续与 Epic 6 / Story 6-4 保持一致。

**关注点**
- `tool: 'universal'` 仍是既有 defer 项，但本轮没有新的阻塞性回退。

### Story 6.4: `aiforge init` 通用目录偏好配置

**结论：有条件通过**

**优点**
- AC 头部依赖声明 + Task 7 已把 AC #3-#5 的运行时责任明确交给 Story 6-3。
- init 侧的询问、持久化和测试边界已清晰。

**关注点**
- 关闭 Story 时仍应以 Story 6-3 对 AC #3-#5 的测试通过为前提，避免把“可并行实现”误读成“可独立验收关闭”。

## 通过项

- Epic 6 仍保持三层优先级链：`CLI > config > 默认值`。
- Story 6-2 已不再要求 `runPipeline()` 直接 `process.exit(0)`。
- Story 6-1 的空目录成功态已完整回到 stdout 成功通道。
- Story 6-3 的 `CONFIG_NOT_FOUND` 白名单降级已按全局规则收口。
- 已知 defer 项保持不变：
  - `tool: 'universal'` 仍是共享 `tool` 字段的例外语义。
  - `--filter` 的“子目录”与“全部 sourceFiles”术语仍未统一。

## 结论

- **结论**：不通过
- **阻塞项**：
  - Story 6-2 的 prefixed 零匹配候选列表仍会扫描错目录
  - Story 6-2 的 TTY 选择/取消路径仍缺少测试闭环
- **建议**：
  - 先修正 Story 6-2 在 `dirPrefix` 场景下的候选扫描作用域
  - 再补齐 TTY 选择重试与取消正常返回的测试闭环
  - 其余 Story 当前可以视为进入实现准备完成
