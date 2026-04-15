---
Epic: 6
Scope: epic
Round: 3
Date: 2026-04-14
Model Used: Claude Opus 4.6 (claude-opus-4-6)
Review Source: epic-6-story-review-summary-20260414-round-3.md
Review Model: Codex (GPT-5-based) (codex)
Type: Story Review Evaluation
---

## 评估总结

本轮评估针对 Round 3 复审结果（5 条新发现：2 高 3 中）。Round 2 的 4 条阻塞项中 3 条已确认收敛（Epic 三层优先级链对齐、`FilterCancelledSignal` 替代 `AiforgeError('info')`、`scanAvailableTopDirs` 裸 catch 修复）。R2 遗留的 1 条上轮遗留项（Story 6-4 AC 边界）在本轮被审查模型再次标记为硬阻塞。5 条新发现中：2 条确认有效需修订（P0 — `process.exit(0)` 突破编排器契约、P1 — helper 契约分叉），2 条有效需修订但严重性降级（P1 — warn/stderr 通道和 instanceof 守卫），1 条确认有效需修订（P1 — Story 6-4 AC 边界）。整体判断：**需修订后再审**，核心阻塞项 2 条。

## 上轮问题回顾确认

| R2 编号 | 问题 | 修订状态 | 验证结论 |
|---------|------|---------|---------|
| R2-#2 | FILTER_CANCELLED 使用 AiforgeError + severity 'info' | ✅ 已修订 | Task 4.4 改为独立 `FilterCancelledSignal`（不继承 AiforgeError），Dev Notes 同步更新。**确认收敛**（但编排器处理方式引入新问题，见 Finding #1） |
| R2-#1 | scanAvailableTopDirs 裸 catch {} 降级 | ✅ 已修订 | 已改为显式 `catch (error)` + ENOENT/ENOTDIR 白名单。**确认收敛** |
| R2-#3 | 两个 Story 独立实现目录扫描逻辑 | ⚠️ 部分修订 | Task 4.2 已声明复用 `scanAvailableTopDirs`，但 Dev Notes 示例仍调用不同名称函数。见 Finding #3 |
| R2-#6 | Epic-6 AC#4 仍写"四层"优先级链 | ✅ 已修订 | Epic-6.md AC#4 已改为"CLI > config > 默认值"。**确认收敛** |

### 历史 defer 项状态

| 来源 | 问题 | 状态 |
|------|------|------|
| R1-#4 | `tool: 'universal'` 扩展共享字段语义 | 维持 defer — Story 已做消费方分析 |
| R1-#5 | `--filter` "子目录"与"全部 sourceFiles"术语不一致 | 维持 defer — 刻意设计决策 |

## 发现 #1 评估

### 审查原文

> **[高][新] Story 6-2 的取消短路示例仍把 `runPipeline()` 改写为直接 `process.exit(0)`**
> - 来源：contract
> - 分类：patch
> - 涉及 Story：6-2
> - 证据 - Dev Notes 示例 `if (err instanceof FilterCancelledSignal) { process.exit(0) }`
> - 影响 - 偏离 `runPipeline()` 现有"设 exitCode + return"契约
> - 建议 - 改为正常返回而非直接退出进程

### 评估结论：✅ 确认有效 — 需要修订（P0 优先级）

### 评估分析

**问题描述准确性**：准确且关键 — 交叉验证确认：`src/pipeline.ts` 第 397-441 行的 `runPipeline()` 现有契约是"AiforgeError(fatal) → `reporter.reportError()` + `process.exitCode = error.exitCode` + `return`"，**从未使用 `process.exit()`**。所有现有测试（`tests/pipeline.test.ts`、`tests/integration/pipeline.test.ts`）也只断言 `process.exitCode`，不断言进程终止。Story 6-2 Dev Notes 第 196-198 行的示例直接写 `process.exit(0)` 是对编排器公共契约的单方面改写。
**严重性判断**：合理 — `process.exit()` 会立即终止 Node.js 进程，绕过：(1) 现有 catch 块中的错误包装和报告逻辑；(2) 测试框架（vitest）的进程生命周期管理；(3) 任何 `finally` 清理逻辑。在测试中使用 `process.exit(0)` 会导致测试进程被直接杀死。这是一个**功能阻塞**级问题。
**修订建议**：可行 — `FilterCancelledSignal` 被捕获后应 `process.exitCode = 0; return`（与现有契约一致），或更好的方案：不设 exitCode（默认就是 0），直接 `return`。取消是正常流，不需要任何错误报告。
**误报评估**：非误报 — 源码级证据充分。

## 发现 #2 评估

### 审查原文

> **[高] Story 6-4 的 AC #3-#5 仍超出 Story 自身边界**
> - 来源：structure+consistency+contract
> - 分类：decision_needed
> - 涉及 Story：6-4
> - 证据 - AC #3-#5 验收 `aiforge install` 运行时行为，但 Tasks 只覆盖 init/persistence
> - 影响 - Story 无法独立 ready-for-dev 和验收
> - 建议 - 收窄 AC 或显式声明跨 Story 依赖

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — AC #3（"config.universalDirs: false 时不写入通用目录"）、AC #4（"CLI 参数优先级高于 config"）和 AC #5（"缺少字段时默认 true"）均描述的是 `aiforge install` 的运行时行为。Story 6-4 的 Tasks 1-6 只实现 `init.ts` 的询问和 `config.json` 持久化。Dev Notes 第 163-169 行已明确写 "AC #3 和 #4 的运行时行为由 Story 6-3 实现"、"本 Story 的测试只验证 config.json 正确保存了 universalDirs 字段值"。
**严重性判断**：偏高但基本合理 — 审查连续两轮标记为硬阻塞有一定道理：AC 与 Tasks 的脱节确实让开发者无法判断"做完这些 Tasks 后 Story 算不算 Done"。但现实是 Story 6-4 和 6-3 本来就是一个功能的两半（persistence + runtime），Dev Notes 已经给出了明确的责任划分说明。**建议降级为 P1**——不需要大幅重构，只需在 AC 中补充依赖声明即可。
**修订建议**：可行 — 推荐方案：(1) AC #3-#5 保留（它们描述了用户可感知的端到端行为，删除会丢失验收完整性），但在 AC 章节头部补一行依赖声明："AC #3-#5 的运行时验证依赖 Story 6-3 已实现，本 Story 只负责 persistence，运行时行为由 Story 6-3 的测试覆盖"；(2) 在 Task 列表末尾补 Task："验证 AC #3-#5 — 确认 Story 6-3 对应测试已覆盖"。这样既保留了完整的 AC 链路又明确了责任边界。
**误报评估**：非误报 — 但解决方案不需要审查建议的二选一那么重。

## 发现 #3 评估

### 审查原文

> **[中][新] Story 6-2 的零匹配 helper 契约仍未与 Story 6-1 收口**
> - 来源：structure+consistency+contract
> - 分类：patch
> - 涉及 Story：6-2
> - 证据 - Task 4.2 要求复用 `scanAvailableTopDirs(repoDir)`，但 Dev Notes 示例调用 `scanAvailableSubs(repo.repoDir, dirPrefix)`
> - 影响 - 同一恢复链路两个互斥 helper 契约
> - 建议 - 统一 helper API

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — Task 4.2 第 55 行写"复用 Story 6-1 `list-contents.ts` 导出的 `scanAvailableTopDirs(repoDir)`"，但 Dev Notes 第 213 行的代码示例调用 `scanAvailableSubs(repo.repoDir, dirPrefix)`——函数名不同、参数签名不同。这是 R2 修订 DRY 时只更新了 Task 描述但忘记同步 Dev Notes 示例。
**严重性判断**：合理 — Task 和 Dev Notes 给出了互相矛盾的指引，开发者无论照哪个写都会出问题。
**修订建议**：可行 — 确定是否需要 `dirPrefix` 参数（零匹配交互需扫描子目录时需要），统一 Task 和 Dev Notes 中的函数名及签名。
**误报评估**：非误报。

## 发现 #4 评估

### 审查原文

> **[中] Story 6-1 的空目录成功态仍经由 `warn()` 写入 stderr**
> - 来源：structure+contract
> - 分类：patch
> - 涉及 Story：6-1
> - 证据 - 空列表时调用 `reporter.warn(msg('list.empty'))` 后返回
> - 影响 - 成功结果走 stderr 警告通道
> - 建议 - 定义 stdout 成功输出 API

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — Dev Notes 第 144-147 行在 `subdirs.length === 0` 时调用 `reporter.warn()`。TtyReporter 的 warn 通过 ora spinner 输出到 stderr，PlainReporter 的 warn 用 `console.error()` 也是 stderr。
**严重性判断**：基本合理 — "空目录但查询成功"不是警告场景。对 CI 消费者来说 stderr 输出可能被误判为错误信号。
**修订建议**：可行 — 让 `reportList(dir, [])` 处理空态输出到 stdout，删除 warn 分支。
**误报评估**：非误报。

## 发现 #5 评估

### 审查原文

> **[中] Story 6-3 的 `CONFIG_NOT_FOUND` 白名单降级示例仍缺少 `instanceof AiforgeError` 守卫**
> - 来源：consistency+contract
> - 分类：patch
> - 涉及 Story：6-3
> - 证据 - 示例用类型断言 `(error as ...).code` 而非 `instanceof AiforgeError`
> - 影响 - 可能误判带 code 属性的非 AiforgeError 异常
> - 建议 - 统一为 `error instanceof AiforgeError && error.code === 'CONFIG_NOT_FOUND'`

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — Dev Notes 第 175-179 行使用 `(error as NodeJS.ErrnoException & { code?: string }).code !== 'CONFIG_NOT_FOUND'`，而 project-context.md 第 129 行要求 `error instanceof AiforgeError && error.code === 'SPECIFIC_CODE'` 模式。类型断言无法区分 AiforgeError 和 Node.js 原生 SystemError。
**严重性判断**：合理 — 这是从 Story 2-3 CR 提炼的硬规则。`loadConfig()` 如果 fs 错误未被内部捕获，类型断言会执行错误的比较逻辑。
**修订建议**：可行 — Task 5.4 和 Dev Notes 改为 `if (error instanceof AiforgeError && error.code === 'CONFIG_NOT_FOUND') { ... } else { throw error }`。
**误报评估**：非误报。

## 整体评估结论

### 需要修订（阻塞进入开发）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 1 | 取消流 `process.exit(0)` 突破 runPipeline 编排器契约 | [高] | P0 | 改为 `return`（默认 exitCode 0），不调用 process.exit() |
| 2 | Story 6-4 AC #3-#5 超出自身交付边界 | [高] | P1 | 保留 AC 但补依赖声明和跨 Story 验证 Task |
| 3 | 零匹配 helper Task vs Dev Notes 名称/签名互斥 | [中] | P1 | 统一函数名和签名 |
| 4 | 空目录成功态走 warn()/stderr 通道 | [中] | P1 | 改为 stdout 输出（通过 reportList 处理空态） |
| 5 | CONFIG_NOT_FOUND 降级缺少 instanceof AiforgeError 守卫 | [中] | P1 | 改为规范 instanceof 模式 |

### 历史 defer 项

| 来源 | 问题 | 状态 |
|------|------|------|
| R1-#4 | `tool: 'universal'` 扩展共享字段语义 | 维持 defer |
| R1-#5 | `--filter` 术语"子目录"与实现不一致 | 维持 defer |
| R2-#5 | AiforgeConfig 类型竞争风险 | 维持 defer（P3） |

### 可忽略（误报）

| # | 发现 | 原始严重性 | 忽略理由 |
|---|------|----------|---------|
| — | （无误报） | — | — |

### 评估决定

**整体结论**：需修订后再审

5 条发现全部确认有效需修订（1 条 P0 + 4 条 P1）。核心阻塞项是 Story 6-2 的 `process.exit(0)`——直接改写了 `runPipeline()` 编排契约且会导致测试进程被杀。建议修订顺序：(1) P0 — FilterCancelledSignal 捕获后改为 `return`；(2) P1 — 统一零匹配 helper 契约；(3) P1 — Story 6-4 补 AC 依赖声明；(4) P1 — Story 6-1 空目录走 stdout；(5) P1 — Story 6-3 catch 加 instanceof 守卫。修订完成后提交 Round 4 审查。

---

## 修订执行记录

### 修订执行记录
- **Date**: 2026-04-14
- **Model Used**: Claude Sonnet 4 (claude-sonnet-4)
- **Fix Items**: 5

#### 修订项 #1: 取消流 `process.exit(0)` 突破 runPipeline 编排器契约（P0）
- **文件**: `_bmad-output/implementation-artifacts/stories/6-2-filter-subdirectory-install.md`
- **章节**: Dev Notes — FilterCancelledSignal 设计 — 管道编排器代码示例
- **修改摘要**:
  - `process.exit(0)  // 正常退出，exit code 0` → `return`（不调用 `process.exit()`）
  - 补充注释说明：`process.exitCode` 默认为 0，与现有编排契约一致（AiforgeError 路径用 `process.exitCode = error.exitCode + return`，从不使用 `process.exit()`）
- **状态**: 已完成

#### 修订项 #2: 零匹配 helper Task vs Dev Notes 名称/签名互斥（P1）
- **文件**: `_bmad-output/implementation-artifacts/stories/6-2-filter-subdirectory-install.md`
- **章节**: Dev Notes — 零匹配交互式询问代码示例
- **修改摘要**:
  - `await scanAvailableSubs(repo.repoDir, dirPrefix)` → `await scanAvailableTopDirs(repo.repoDir)` + 注释"复用 list-contents.ts 导出的共享函数（Story 6-1）"
  - 与 Task 4.2 声明的"复用 `scanAvailableTopDirs(repoDir)`"保持一致，消除 Task / Dev Notes 互斥指引
- **状态**: 已完成

#### 修订项 #3: Story 6-4 AC #3-#5 超出自身交付边界（P1）
- **文件**: `_bmad-output/implementation-artifacts/stories/6-4-init-universal-directory-preference.md`
- **章节**: Acceptance Criteria（头部补依赖声明）；Tasks / Subtasks（新增 Task 7 跨 Story 验证，原 Task 7 质量门禁重编为 Task 8）
- **修改摘要**:
  - AC 章节头部新增跨 Story 依赖声明块：明确"本 Story 只负责 persistence，AC #3-#5 运行时行为由 Story 6-3 实现，由 Story 6-3 的 tests/pipeline.test.ts 覆盖"
  - 新增 Task 7：跨 Story 验证 AC #3-#5，要求确认 Story 6-3 测试已覆盖三个场景（universalDirs:false / CLI 覆盖 / 缺字段默认 true）
  - 原 Task 7 质量门禁重编为 Task 8
- **状态**: 已完成

#### 修订项 #4: 空目录成功态走 `warn()/stderr` 通道（P1）
- **文件**: `_bmad-output/implementation-artifacts/stories/6-1-list-subdirectory-contents.md`
- **章节**: Tasks / Subtasks — Task 3.6、Task 4.5；Dev Notes — listContents 代码示例
- **修改摘要**:
  - Task 3.6：`通过 Reporter 输出提示信息（非错误），正常退出` → 明确"调用 `reporter.completePhase()` 后调用 `reporter.reportList(args.list!, [])`；禁止调用 `reporter.warn()`（warn 走 stderr，空目录是成功结果）"
  - Task 4.5：`空列表场景由 list-contents.ts 处理，Reporter 不需处理空列表` → `reportList 需处理 entries.length === 0，输出 msg('list.empty') 到 stdout`
  - Dev Notes 代码示例：`reporter.warn(msg('list.empty')); reporter.completePhase(); return` → `reporter.completePhase(); reporter.reportList(args.list!, [])  // Reporter 内部处理空列表`
- **状态**: 已完成

#### 修订项 #5: `CONFIG_NOT_FOUND` 降级缺少 `instanceof AiforgeError` 守卫（P1）
- **文件**: `_bmad-output/implementation-artifacts/stories/6-3-universal-directory-install.md`
- **章节**: Tasks / Subtasks — Task 5.4；Dev Notes — universalDirs 偏好传递代码示例
- **修改摘要**:
  - Task 5.4：`仅对 error.code === 'CONFIG_NOT_FOUND' 降级` → `仅对 error instanceof AiforgeError && error.code === 'CONFIG_NOT_FOUND' 降级`；补充说明"禁止类型断言绕过 instanceof 守卫，防止误判带 code 属性的非 AiforgeError 异常"
  - Dev Notes 代码示例：`(error as NodeJS.ErrnoException & { code?: string }).code !== 'CONFIG_NOT_FOUND'` → `error instanceof AiforgeError && error.code === 'CONFIG_NOT_FOUND'`，改写为正向白名单匹配（`if instanceof + code then 降级, else throw`），消除类型断言
- **状态**: 已完成