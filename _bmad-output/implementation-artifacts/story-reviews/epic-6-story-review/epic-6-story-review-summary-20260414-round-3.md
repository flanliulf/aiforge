---
Epic: 6
Scope: epic
Round: 3
Date: 2026-04-14
Model Used: Codex (GPT-5-based) (codex)
Type: Story Review Summary
Stories Reviewed: 4
---

## 审查结论

第 3 轮复审。共复审 Epic 6 下 4 个 Story。审查层状态：3/3 层完成（`structure` / `consistency` / `contract`）。

- 通过：0 个
- 有条件通过：2 个
- 硬阻塞：2 个

总体判断：Round 2 的关键修订确实关闭了 3 个问题：Epic 级三层优先级链、`FILTER_CANCELLED` 误用 `AiforgeError('info')`、以及 `scanAvailableTopDirs()` 的裸 `catch {}`。但 Epic 6 仍未达到可开发状态：Story 6-2 在修订后又引入了新的编排契约漂移（直接 `process.exit(0)`）和 helper 契约分叉，Story 6-4 的边界问题仍是硬阻塞；同时 Story 6-1 / 6-3 还各保留 1 个中优先级文档缺口。

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
  - `epic-6-story-review-summary-20260414-round-2.md`
  - `epic-6-story-review-evaluation-20260414-round-2.md`
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

1. Round 2 / Finding #1 — Epic 6 四层优先级链与 Story 三层口径不一致
   - `epic-6.md` AC #4 已改为 `CLI > config > 默认值`。
   - 复核结论：此项关闭。

2. Round 2 / Finding #2 — `FILTER_CANCELLED` 使用 `AiforgeError(..., 'info')`
   - `6-2` 已改为独立 `FilterCancelledSignal`，不再把“用户取消”建模为 `AiforgeError`。
   - 复核结论：TypeScript 编译级阻塞点关闭；但编排器处理方式仍有新问题，见本轮 Finding #1。

3. Round 2 / Finding #5 — `scanAvailableTopDirs()` 裸 `catch {}` 吞错
   - `6-1` 已改为显式 `catch (error)`，仅对白名单 `ENOENT` / `ENOTDIR` 降级，其余错误继续透传。
   - 复核结论：此项关闭。

### 仍为非阻塞待办

1. Round 1 / Finding #4 — `tool: 'universal'` 仍作为共享 `tool` 字段的例外语义
   - 维持既有评估结论，继续列为已知 defer 项。

2. Round 1 / Finding #5 — `--filter` 的“子目录”与“全部 sourceFiles”术语仍未统一
   - 维持既有评估结论，继续列为已知 defer 项。

## 新发现

### 1. [高][新] Story 6-2 的取消短路示例仍把 `runPipeline()` 改写为直接 `process.exit(0)`
- **来源**：contract
- **分类**：patch
- **状态**：本轮新发现
- **涉及 Story**：6-2
- **证据** - `6-2` 在 `FilterCancelledSignal` 设计示例中仍要求 orchestrator 在 `catch` 内直接执行 `process.exit(0)`；但 `src/pipeline.ts` 当前契约明确是“fatal → `reportError()` + `process.exitCode` + `return`，非 fatal/非 AiforgeError → 包装后同样返回”，`tests/pipeline.test.ts` 与 `tests/integration/pipeline.test.ts` 也只覆盖 `process.exitCode` 路径，没有直接终止进程的约定。
- **影响** - 这会把可测试的管道编排器隐式改成“主动终止进程的命令处理器”，既偏离现有公共契约，也会让后续测试和调用方语义发生漂移。
- **建议** - 将取消流设计为“`runPipeline()` 正常返回并结束后续阶段”，不要在 Story 中要求直接 `process.exit(0)`；如需特殊短路语义，应先显式修订 orchestrator 契约及其测试。

### 2. [高] Story 6-4 的 AC #3-#5 仍超出 Story 自身边界
- **来源**：structure+consistency+contract
- **分类**：decision_needed
- **状态**：上轮遗留
- **涉及 Story**：6-4
- **证据** - `6-4` 的 AC #3-#5 仍在验收 `aiforge install` 的运行时行为；但 Tasks 1-6 只覆盖 `init.ts` 询问、`config.json` 持久化、摘要展示与 `init.test.ts`，同一文档 Dev Notes 还明确写明 AC #3-#5 的运行时行为由 Story 6-3 实现和测试。
- **影响** - 当前 Story 无法独立 ready-for-dev，也无法独立验收；责任边界和完成定义都不闭合。
- **建议** - 二选一：1) 收窄 Story 6-4 的 AC，只保留 init / persistence；2) 保留现有 AC，但显式声明对 Story 6-3 的依赖，并补跨 Story 的任务、测试和验收说明。

### 3. [中][新] Story 6-2 的零匹配 helper 契约仍未与 Story 6-1 收口
- **来源**：structure+consistency+contract
- **分类**：patch
- **状态**：本轮新发现
- **涉及 Story**：6-2
- **证据** - `6-2` Task 4.2 已明确要求复用 Story 6-1 导出的 `scanAvailableTopDirs(repoDir)`；但零匹配交互示例仍调用 `scanAvailableSubs(repo.repoDir, dirPrefix)`，与 `6-1` 当前对外导出的 helper 名称和签名均不一致。
- **影响** - 同一条恢复链路出现两个互斥 helper 契约，Round 2 的 DRY 修订没有真正闭环，开发者可能重新复制目录扫描逻辑，或照着示例实现一个文档中并不存在的 helper。
- **建议** - 统一 helper API，并同步更新 Task、Dev Notes、依赖说明与测试口径；若需要支持 `dirPrefix` 子目录扫描，应先显式修订 Story 6-1 的导出契约。

### 4. [中] Story 6-1 的空目录成功态仍经由 `warn()` 写入 stderr
- **来源**：structure+contract
- **分类**：patch
- **状态**：上轮遗留
- **涉及 Story**：6-1
- **证据** - `6-1` 把“目录为空”定义为“正常退出、不报错”，但示例实现仍在空列表时调用 `reporter.warn(msg('list.empty'))` 后返回。
- **影响** - `warn()` 属于 stderr 诊断流，成功结果却走警告通道，会破坏 stdout/stderr 分工，也使 AC #3 的成功语义难以通过测试锁定。
- **建议** - 为“空目录但成功”定义 stdout 输出通道，例如让 `reportList(dir, [])` 处理空态，或新增 `reportListEmpty()`，并在测试中显式断言不走 `warn()`。

### 5. [中] Story 6-3 的 `CONFIG_NOT_FOUND` 白名单降级示例仍缺少 `instanceof AiforgeError` 守卫
- **来源**：consistency+contract
- **分类**：patch
- **状态**：上轮遗留
- **涉及 Story**：6-3
- **证据** - `6-3` 当前示例仍通过类型断言后的 `error.code !== 'CONFIG_NOT_FOUND'` 进行降级判断，没有先确认 `error instanceof AiforgeError`；而 `project-context.md` 与 `04-implementation-patterns.md` 已明确要求 catch 降级必须使用 `error instanceof AiforgeError && error.code === 'SPECIFIC_CODE'` 的逐码白名单模式。
- **影响** - 文档继续示范了非合规的降级写法，开发时容易把任意带 `code` 属性的异常误判为可降级场景。
- **建议** - 将任务描述和示例统一改成 `if (error instanceof AiforgeError && error.code === 'CONFIG_NOT_FOUND') { ... } else { throw error }`。

## 逐篇审查结论

### Story 6.1: `--list` 子目录内容列举

**结论：有条件通过**

**优点**
- `scanAvailableTopDirs()` 的裸 `catch {}` 已收敛为白名单降级，Round 2 对错误处理规则的修订已落地。
- `--list` 的主输出路径仍保持 Reporter-only，没有回退到 direct stdout 写法。

**关键问题**
1. **空目录成功态仍走 stderr** — 当前空列表分支仍调用 `warn()`，与成功输出通道契约冲突。

**建议动作**
- 为“空目录但成功”定义 stdout 成功输出 API，并补对应测试断言。

### Story 6.2: `--filter` 精准子目录安装

**结论：硬阻塞**

**优点**
- `FilterCancelledSignal` 已替代 `AiforgeError('info')`，Round 2 的编译级阻塞点已关闭。
- `resolvedFilter` 方案仍保持“不改写 `args.filter`”的作用域保护方向。

**关键问题**
1. **取消流仍突破 orchestrator 既有契约** — Story 仍要求 `runPipeline()` 直接 `process.exit(0)`。
2. **零匹配 helper 契约再次分叉** — Task 与 Dev Notes 指向了两个不同 helper 方案。

**建议动作**
- 先把取消流改成“正常返回而非直接退出进程”。
- 再统一零匹配 helper 的名称、签名和复用边界。

### Story 6.3: 通用目标目录默认安装

**结论：有条件通过**

**优点**
- 三层优先级链已与 Epic 6 / Story 6-4 对齐，不再保留 environment variable 层。
- `CONFIG_NOT_FOUND` 白名单降级方向正确，缺口已收敛到示例写法层面。

**关键问题**
1. **白名单降级示例仍不够严格** — 仍未按 `instanceof AiforgeError` 模式书写。

**关注点**
- `tool: 'universal'` 继续作为共享 `tool` 字段的例外语义存在，当前仍列为 defer 项。

**建议动作**
- 先修正 catch 示例与 Task 描述，再维持既有 defer 记录，避免后续审查误判为已收口。

### Story 6.4: `aiforge init` 通用目录偏好配置

**结论：硬阻塞**

**优点**
- `confirm()` 询问插入点、默认值和持久化方向都清晰。
- `universalDirs` 的升级兼容思路保持一致。

**关键问题**
1. **AC #3-#5 仍不属于本 Story 自身交付边界** — 运行时行为已经在文档内部指向 Story 6-3。

**建议动作**
- 收窄 6-4 的 AC，或把跨 Story 依赖和验收方式写完整，再决定是否维持 `ready-for-dev`。

## 通过项

- Epic 6 AC #4 已与 Story 6-3 / 6-4 同步为三层优先级链：`CLI > config > 默认值`。
- Story 6-2 已不再使用 `AiforgeError(..., 'info')` 表达“用户取消”。
- Story 6-1 的 `scanAvailableTopDirs()` 已不再使用裸 `catch {}`，错误白名单降级方向正确。
- 已知 defer 项：
  - `tool: 'universal'` 仍是共享 `tool` 字段的例外语义。
  - `--filter` 的“子目录”与“全部 sourceFiles”术语仍未统一。

## 结论

- **结论**：不通过
- **阻塞项**：
  - Story 6-2 仍要求 `runPipeline()` 直接 `process.exit(0)`，并保留未收口的 helper 契约分叉
  - Story 6-4 的 AC #3-#5 仍超出本 Story 自身边界
- **建议**：
  - 先收敛 Story 6-2 的取消流与零匹配 helper 契约
  - 再重划 Story 6-4 的验收边界
  - 最后顺手关闭 Story 6-1 / 6-3 的两个中优先级文档缺口后再提交下一轮 SR
