---
Epic: 6
Scope: epic
Round: 4
Date: 2026-04-14
Model Used: Claude Opus 4.6 (claude-opus-4-6)
Review Source: epic-6-story-review-summary-20260414-round-4.md
Review Model: Codex (GPT-5-based) (codex)
Type: Story Review Evaluation
---

## 评估总结

本轮评估针对 Round 4 复审结果（2 条新发现：1 高 1 中）。Round 3 的 5 条阻塞项全部确认收敛。Epic 6 的 4 个 Story 中，Story 6-1 和 6-3 已通过、Story 6-4 有条件通过，**只剩 Story 6-2 仍有阻塞**。2 条新发现全部确认有效：1 条 P0（prefixed 零匹配扫错目录——功能性 bug）、1 条 P1（TTY 交互路径缺测试闭环）。整体判断：**需修订后再审**，阻塞范围已收窄至 Story 6-2 一个文件。

## 上轮问题回顾确认

| R3 编号 | 问题 | 修订状态 | 验证结论 |
|---------|------|---------|---------|
| R3-#1 | Story 6-2 `process.exit(0)` 改写编排器契约 | ✅ 已修订 | Dev Notes 已改为 `FilterCancelledSignal` 捕获后 `return`。**确认收敛** |
| R3-#2 | Story 6-4 AC #3-#5 超出自身交付边界 | ✅ 已修订 | AC 头部补依赖声明 + Task 7 跨 Story 验证。**确认收敛** |
| R3-#3 | Story 6-2 helper 名称/签名分叉 | ✅ 已修订 | Task / Dev Notes / 依赖说明统一回到 `scanAvailableTopDirs()`。**确认收敛**（但扫描作用域有新问题，见 Finding #1） |
| R3-#4 | Story 6-1 空目录走 warn()/stderr | ✅ 已修订 | 改为 `reportList(dir, [])`，禁止 `warn()`。**确认收敛** |
| R3-#5 | Story 6-3 catch 降级缺 instanceof AiforgeError 守卫 | ✅ 已修订 | Task 5.4 和 Dev Notes 统一为 `instanceof AiforgeError && error.code === 'CONFIG_NOT_FOUND'`。**确认收敛** |

### 历史 defer 项状态

| 来源 | 问题 | 状态 |
|------|------|------|
| R1-#4 | `tool: 'universal'` 扩展共享字段语义 | 维持 defer |
| R1-#5 | `--filter` "子目录"与"全部 sourceFiles"术语不一致 | 维持 defer |
| R2-#5 | AiforgeConfig 类型竞争风险 | 维持 defer（P3） |

## 发现 #1 评估

### 审查原文

> **[高][新] Story 6-2 的 prefixed 零匹配候选列表仍会扫描错目录**
> - 来源：structure+consistency+contract
> - 分类：patch
> - 涉及 Story：6-2
> - 证据 - Dev Notes 固定调用 `scanAvailableTopDirs(repo.repoDir)`，在 `dirPrefix = skills` 时生成 `skills/skills`、`skills/agents` 等错误候选值
> - 影响 - 核心恢复链路引导用户到错误目录
> - 建议 - prefixed case 必须扫描 `join(repo.repoDir, dirPrefix)`

### 评估结论：✅ 确认有效 — 需要修订（P0 优先级）

### 评估分析

**问题描述准确性**：准确且关键 — 交叉验证确认：Dev Notes 第 215 行 `scanAvailableTopDirs(repo.repoDir)` 扫描的是**仓库根目录**的顶层子目录（如 `['agents', 'instructions', 'mcp-tools', 'skills']`）。第 224 行的 map 将这些顶层名称拼接 `dirPrefix` 前缀，在 `dirPrefix = 'skills'` 时生成 `skills/agents`、`skills/skills` 等**完全错误**的候选值。用户输入 `--filter skills/xyz*` 时期望看到的是 `skills/` 下的子目录列表（如 `skills/git-commit`、`skills/code-review`），而非仓库顶层目录加了 `skills/` 前缀。

矛盾的是，Task 4.2 的描述其实是正确的——"传入 `filter.dirPrefix` 对应目录或仓库根目录"——暗示 prefixed case 应传入 `join(repo.repoDir, dirPrefix)`。但 Dev Notes 代码示例没有遵循 Task 描述，固定传了 `repo.repoDir`。

**严重性判断**：合理 — 这是零匹配恢复链路的功能性 bug。TTY 候选列表全部指向错误目录，用户选择任何一个都会导致重新匹配再次失败（因为 `skills/agents` 并非 `skills/` 下的实际子目录名）。非 TTY 的 `fix[]` 同样失真。多来源命中（structure+consistency+contract）进一步佐证。

**修订建议**：可行 — Dev Notes 第 215 行改为：
```
const scanDir = dirPrefix ? join(repo.repoDir, dirPrefix) : repo.repoDir
const availableDirs = await scanAvailableTopDirs(scanDir)
```
第 224 行的 `value` 构建逻辑可保持不变（`dirPrefix ? \`${dirPrefix}/${d}\` : d`），因为 `scanAvailableTopDirs` 返回的已经是目标目录下的子目录名。同时需同步修正非 TTY 分支的 `fix[]` 构建。

注意：这意味着 `scanAvailableTopDirs` 的语义从"扫描仓库顶层目录"泛化为"扫描指定目录下的子目录"，Story 6-1 导出该函数时的 JSDoc 和参数命名可能需要微调（如参数名从 `repoDir` 改为 `baseDir`），但不影响 Story 6-1 自身的 `--list` 使用场景。

**误报评估**：非误报 — Task vs Dev Notes 的不一致可直接验证，扫描结果推理可确认。

## 发现 #2 评估

### 审查原文

> **[中][新] Story 6-2 的 TTY 选择/取消路径仍缺少测试闭环**
> - 来源：structure+contract
> - 分类：patch
> - 涉及 Story：6-2
> - 证据 - Task 6 只覆盖非 TTY FILTER_NO_MATCH 和 dry-run 预览，无 TTY 选择重试和取消正常返回的测试
> - 影响 - 取消流可能被重做回错误通道，重试路径可能无效短路
> - 建议 - 补 TTY 选择重试和取消正常返回的显式测试用例

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — Task 6 当前测试覆盖清单：
  - 6.1: `parseFilterPattern` 和 `matchesGlob` 单元测试 ✅
  - 6.2: match-rules 集成测试（filter 匹配/跨目录/联合语义/非 TTY `FILTER_NO_MATCH`）✅
  - 6.3: pipeline `--filter` + `--dry-run` ✅
  - 6.4: `FILTER_NO_MATCH` 错误码负向测试 ✅

缺失的两条关键路径：
  - **TTY 选择重试成功**：用户从 `select()` 候选列表中选择一个子目录 → `resolvedFilter` 被设置 → 重新执行匹配 → 预期返回非空结果。此路径涉及 `@inquirer/prompts` mock 和重试循环，不测则无法验证重试逻辑是否真正生效。
  - **TTY 取消正常返回**：用户在 `select()` 中选择取消 → 抛出 `FilterCancelledSignal` → `runPipeline()` 捕获并 `return` → 预期 `process.exitCode` 为 0（或 undefined）、不调用 `reportError()`、不执行 install/report。此路径涉及编排器的 catch 行为，是 Round 3 P0 修订的回归保护。

**严重性判断**：合理 — 中等严重性恰当。这是测试覆盖缺口而非功能设计错误。但考虑到 TTY 取消路径经历了 3 轮设计迭代（`AiforgeError('info')` → `FilterCancelledSignal + process.exit(0)` → `FilterCancelledSignal + return`），缺少回归测试意味着后续任何 pipeline 重构都可能无感知地打破取消语义。

**修订建议**：可行 — 在 Task 6.2 中补充：
  - "TTY 选择重试：mock `process.stdin.isTTY = true` + mock `select()` 返回限定名 → 验证 `matchRules()` 返回非空 items"
  - "TTY 取消正常返回：mock `select()` 返回 `'__cancel__'` → 验证抛出 `FilterCancelledSignal`"

在 Task 6.3 或新增 pipeline 集成测试中补充：
  - "FilterCancelledSignal 被 runPipeline 捕获后正常返回：验证 `process.exitCode` 为 0/undefined、`reporter.reportError` 未被调用"

**误报评估**：非误报 — 测试清单可直接对比确认缺失。

## 整体评估结论

### 需要修订（阻塞进入开发）

| # | 发现 | 原始严重性 | 评估后优先级 | 涉及 Story | 说明 |
|---|------|----------|------------|-----------|------|
| 1 | prefixed 零匹配扫错目录 | [高] | P0 | 6-2 | Dev Notes 改为 `scanAvailableTopDirs(join(repo.repoDir, dirPrefix))` |
| 2 | TTY 选择/取消路径缺测试闭环 | [中] | P1 | 6-2 | Task 6 补 TTY 重试和取消的显式测试 |

### Story 状态总览

| Story | 状态 | 说明 |
|-------|------|------|
| 6-1 | ✅ 通过 | 无阻塞项 |
| 6-2 | ❌ 硬阻塞 | P0×1 + P1×1 待修订 |
| 6-3 | ✅ 通过 | 无阻塞项 |
| 6-4 | ✅ 有条件通过 | 需 Story 6-3 的 AC #3-#5 测试先通过 |

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

**整体结论**：需修订后再审（范围收窄至 Story 6-2）

阻塞范围已从 Round 1 的全 Epic 4 Story 收窄至**仅 Story 6-2 的 1 个功能 bug + 1 个测试缺口**。Story 6-1、6-3 已通过审查，Story 6-4 有条件通过。建议修订顺序：(1) P0 — 修正 prefixed 零匹配的扫描目录（Dev Notes 第 215 行传入 `join(repo.repoDir, dirPrefix)`）；(2) P1 — Task 6 补 TTY 选择重试和取消正常返回的测试用例。修订完成后提交 Round 5 审查，预期可关闭 Epic 6 全部 Story。

---

## 修订执行记录

### 修订执行记录
- **Date**: 2026-04-14
- **Model Used**: Claude Sonnet 4 (claude-sonnet-4)
- **Fix Items**: 2

#### 修订项 #1: prefixed 零匹配候选列表扫错目录（P0）
- **文件**: `_bmad-output/implementation-artifacts/stories/6-2-filter-subdirectory-install.md`
- **章节**: Tasks / Subtasks — Task 4.2；Dev Notes — 零匹配交互式询问代码示例
- **修改摘要**:
  - Task 4.2：扫描逻辑明确拆分 prefixed / unprefixed 两种 case——prefixed 传入 `join(repo.repoDir, dirPrefix)` 扫描指定子目录（如 `skills/`），unprefixed 传入 `repo.repoDir` 扫描仓库顶层；统一使用 `const scanDir = dirPrefix ? join(repo.repoDir, dirPrefix) : repo.repoDir`
  - Dev Notes 代码示例：`scanAvailableTopDirs(repo.repoDir)` → `scanAvailableTopDirs(scanDir)`，补充 `scanDir` 计算逻辑及注释（说明为何不能固定传 `repo.repoDir`——否则 prefixed case 生成 `skills/agents`、`skills/skills` 等错误候选值）
- **状态**: 已完成

#### 修订项 #2: TTY 选择/取消路径缺测试闭环（P1）
- **文件**: `_bmad-output/implementation-artifacts/stories/6-2-filter-subdirectory-install.md`
- **章节**: Tasks / Subtasks — Task 6.2、Task 6.5（新增）
- **修改摘要**:
  - Task 6.2 补充两条 TTY 测试用例：
    - "TTY 选择重试成功"：mock `isTTY = true` + `select()` 返回限定名 → 验证 `matchRules()` 返回非空 items
    - "TTY 取消抛出 FilterCancelledSignal"：mock `select()` 返回 `'__cancel__'` → 验证抛出 `FilterCancelledSignal`（而非 `AiforgeError`，不返回空计划）
  - 新增 Task 6.5：扩展 `tests/pipeline.test.ts`，验证 `FilterCancelledSignal` 被 `runPipeline()` 捕获后正常返回（`process.exitCode` 为 0/undefined、`reporter.reportError` 未调用、Install/Report 未执行）——Round 3 P0 修订的回归保护
- **状态**: 已完成
