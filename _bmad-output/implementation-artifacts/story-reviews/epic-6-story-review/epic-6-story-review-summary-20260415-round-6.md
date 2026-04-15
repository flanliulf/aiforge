---
Epic: 6
Scope: epic
Round: 6
Date: 2026-04-15
Model Used: GPT-5.4 (gpt-5.4)
Type: Story Review Summary
Stories Reviewed: 4
---

## 审查结论

第 6 轮复审。共复审 Epic 6 下 4 个 Story。审查层状态：3/3 层完成（`structure` / `consistency` / `contract`）。

- 通过：0 个
- 有条件通过：2 个
- 硬阻塞：2 个

总体判断：Round 5 的 3 个 P1 修订都已经写回 Story 文档主干，但修订没有完全同步到相邻任务、Dev Notes 和 Project Structure Notes。Epic 6 的阻塞形态已经从“核心策略缺失”转成“修订后文本仍不自洽”：Story 6-2 仍存在 filter 集成点冲突，Story 6-3 仍低估文件级 hash 方案的实际改动面与测试层。

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
  - `src/core/reporter.ts`
  - `src/index.ts`
  - `src/pipeline.ts`
  - `src/stages/match-rules.ts`
  - `src/stages/execute-install.ts`
  - `tests/cli-args.test.ts`
  - `tests/pipeline.test.ts`
  - `epic-6-story-review-summary-20260414-round-5.md`
  - `epic-6-story-review-evaluation-20260415-round-5.md`
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

1. Round 5 / Finding #1 — Story 6-3 的 AC #3 不再依赖不存在的目录级 skipped 链路
   - `6-3` 的 Task 6.4 与 Dev Notes 已改为文件级 hash 比对方案，不再声称现有目录型链路天然支持 skipped。
   - 本轮复核结论：Round 5 的原始阻塞已关闭。

2. Round 5 / Finding #2 — Story 6-2 filter 后空 item 未剔除
   - `6-2` 已在 Task 3.3 / 3.6 中加入 push 前 guard，并在 Task 6.2 增补“部分命中 + dry-run”回归测试。
   - 本轮复核结论：Round 5 的原始遗漏已关闭，但本轮发现这些修订尚未同步到所有相邻说明，见“新发现 #1”。

3. Round 5 / Finding #4 — Story 6-3 的 `enableUniversal` ownership 与验证路径分叉
   - `6-3` 的 Task 5 已锁定唯一实现方案，Task 9.5 也已把运行时 skipped 验证迁移到真实 `executeInstall()` → `saveManifest()` 链路。
   - 本轮复核结论：Round 5 的多方案阻塞已关闭，但相关任务分工和改动面说明仍未完全同步，见“新发现 #2”。

### 仍为非阻塞待办

1. Round 5 / Finding #3 — Story 6-1 的 `reportList()` 共享接口 blast radius 仍未显式写入任务
   - 维持 P2，尚不构成 Round 6 阻塞。

2. Round 5 / Finding #5 — Story 6-1 的“可安装子目录”语义与真实 rule-based 集合仍有漂移
   - 维持 P2，尚不构成 Round 6 阻塞。

3. Round 1 defer — `tool: 'universal'` 仍是共享 `tool` 字段的例外语义
   - 维持 defer。

4. Round 1 defer — `--filter` 的“子目录”术语与 `sourceFiles` 泛化语义仍未完全统一
   - 维持 defer。

## 新发现

### 1. [高][新] Story 6-2 的 filter 修订未完全同步，Task 与 Dev Notes 仍给出冲突实现口径
- **来源**：structure+consistency
- **分类**：patch
- **涉及 Story**：6-2
- **证据** - Task 3.1 仍要求“修改 `scanSourceFiles()` 函数：在返回 sourceFiles 之前应用 filter”；但 Task 3.2 / 3.3 与 Dev Notes “filter 在管道中的位置”都把 filter 放在 `scanSourceFiles` 返回后、`items.push` 之前；同时 Dev Notes 的 `match-rules.ts` 代码示例仍是无条件 `items.push({ rule, sourceFiles, targetPath, mode })`，没有把 Task 3.3 新增的 empty-item guard 写进去。
- **影响** - Round 5 已关闭的空 item 问题被重新打开成“多种实现都能自圆其说”的文档状态。开发者既可能把 filter 塞回共享的 `scanSourceFiles()`，也可能照着示例继续 push 空 item，最终再次破坏 AC #5 的 dry-run 一致性，并让 Story 6-3 复用 filter 逻辑时继续漂移。
- **建议** - 删除 Task 3.1 对 `scanSourceFiles()` 的改写要求，锁定唯一集成点为 `matchRules()` 主循环的 post-scan 过滤；同步更新 Dev Notes 代码示例，把 pre-push empty-item guard 写成显式步骤。

### 2. [高][新] Story 6-3 的文件级 hash 方案只改了核心任务，测试任务与改动面说明仍停留在旧口径
- **来源**：structure+consistency+contract
- **分类**：patch
- **涉及 Story**：6-3
- **证据** - Task 6.4 与 Dev Notes 已明确：`Directories` 分支需要文件级 hash 比对，`saveManifest()` 也要从“整目录单条空 hash”改为“每个文件单独记录 entry”；但 Task 9.2 仍写“通用目录安装走现有 copy 逻辑，目录自动创建”，Task 9.3 仍把 manifest 追踪留在 mocked `pipeline.test.ts` 层，Project Structure Notes 仍把 `src/stages/execute-install.ts` 描述为“toolNameMap fallback，极小改动”，且未把 `services/fs-utils.ts` / manifest 写入面列入修改清单。
- **影响** - Round 5 新锁定的实现模型没有真正传播到测试分工与文件清单。按当前 Story 开发，开发者仍可能只补显示层和现有 copy 路径测试，而遗漏 AC #3 真正需要的 `executeInstall()` + manifest 运行时扩展。
- **建议** - 重写 Task 9.2 / 9.3 / 9.5 的边界，明确哪些测试验证文件级 skip 运行时、哪些只做 dry-run / 分组展示；同时把 `execute-install`、`saveManifest` 以及相关 fs/manifest 支撑面完整写入 Project Structure Notes / File List。

## 逐篇审查结论

### Story 6.1: `--list` 子目录内容列举

**结论：有条件通过**

**优点**
- `clone` 后分叉到 list 流程、空目录成功态走 stdout/`reportList()` 的主设计保持稳定。
- 本轮未发现新的结构性回退，Round 5 之前已确认的主路径仍然清晰。

**关注点**
- `reportList()` 的共享接口 blast radius 仍未显式写入任务。
- “可安装子目录”与真实 rule-based 集合的语义漂移仍未处理。

**建议动作**
- 维持当前结论，待 Story 6-2 / 6-3 收敛后再统一处理两条 P2 文案与横切关注点。

### Story 6.2: `--filter` 精准子目录安装

**结论：硬阻塞**

**优点**
- Round 5 要求的空 item guard、dry-run 回归测试已经被写回 Task 3.3 / 3.6 / 6.2。
- 零匹配的 prefixed `scanDir` 作用域和 TTY 取消闭环没有回退。

**关键问题**
1. **filter 集成点仍然互相冲突** — Task 3.1、Task 3.2 / 3.3 与 Dev Notes 现在给出了三套不同口径，足以把刚修好的 AC #5 再次写回错误实现。

**建议动作**
- 统一 Task 3 与 Dev Notes：只保留 `matchRules()` 主循环 post-scan 过滤这一条路径，并把 empty-item guard 写成不可省略的步骤。

### Story 6.3: 通用目标目录默认安装

**结论：硬阻塞**

**优点**
- `enableUniversal` 的 ownership 已经锁定为唯一方案，不再保留多条实现路线。
- AC #3 的核心策略已经从“目录级天然 skipped”修正为文件级 hash 比对方案。

**关键问题**
1. **新实现模型没有同步到测试任务与改动面说明** — 任务拆分、Project Structure Notes 和文件清单仍部分停留在旧的“现有 copy 逻辑 / 极小改动”口径，足以继续低估 AC #3 的真实工作量。

**建议动作**
- 先把 Task 9.2 / 9.3 / 9.5 与 Project Structure Notes / File List 全量对齐到文件级 hash 模型，再进入开发。

### Story 6.4: `aiforge init` 通用目录偏好配置

**结论：有条件通过**

**优点**
- `init` 侧的偏好收集与 `install` 运行时行为边界仍然清晰。
- 本轮没有发现新的跨 Story 责任回退。

**关注点**
- 只要 Story 6-3 仍未收敛，Story 6-4 也不能独立视为 Epic 级可开发完成。

**建议动作**
- 维持当前边界不动，等待 Story 6-3 收敛后再合并验收。

## 通过项

- Round 5 的 3 个 P1 修订都已经真实写回各自 Story 的主任务章节，没有出现“完全未修”的回退。
- Story 6-1 与 Story 6-4 本轮均未出现新的阻塞级问题。
- Story 6-4 对 AC #3-#5 的跨 Story 依赖声明仍然清晰。
- 历史 defer 项继续维持 defer，没有被本轮修订放大成新的阻塞。

## 结论

- **结论**：不通过
- **阻塞项**：
  - Story 6-2 的 filter 集成点与 empty-item guard 仍存在文本冲突
  - Story 6-3 的文件级 hash 方案尚未同步到测试任务与改动面说明
- **建议**：
  - 先统一 Story 6-2 的 Task 3 与 Dev Notes 口径
  - 再统一 Story 6-3 的 Task 9、Project Structure Notes 与 File List
  - 完成后再执行 Round 7 复审