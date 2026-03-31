---
Story: 4-6b
Round: 1
Date: 2026-03-31
Model Used: Claude Sonnet 4
Review Source: 4-6b-code-review-summary-20260330-round-1.md
Review Model: GPT-5.4
Type: Code Review Evaluation
---

# Code Review Evaluation — Story 4-6b（第 1 轮）

## 整体评估结论

GPT-5.4 的审查整体质量**较高**，3 条发现均有明确的代码行引用作为证据支撑，问题描述准确，严重性判断合理。经逐条交叉验证源码，**3 条发现全部成立，无误报**。

**建议状态：接受审查结论，修复后再复审。**

---

## 逐条评估

### 发现 #1：`reportResult()` 的实际输出格式仍与 Story 约定不一致

| 维度 | 评估 |
|------|------|
| 问题描述准确性 | ✅ **准确** |
| 严重性判断 | ✅ **合理（Major）** |
| 修复建议可行性 | ✅ **可行** |
| 误报 | ❌ **非误报** |

**评估详述：**

经核实源码，审查发现完全成立：

1. **`sourcePath` 未输出**：`TtyReporter.reportResult()`（reporter.ts:134-138）确实只输出 `item.tool` 和 `item.targetPath`，未使用 `item.sourcePath`；`PlainReporter.reportResult()`（reporter.ts:268-271）同样只输出 `status\ttool\ttargetPath` 三列。而 `InstallResult.items` 类型定义（types.ts:71-78）明确包含 `sourcePath: string` 字段，数据已就绪但未被消费。

2. **TTY 标题使用内部 id**：reporter.ts:134 直接输出 `chalk.yellow(\`\n🔧 ${tool}\n\`)`，此处 `tool` 是 `item.tool`（即内部 id 如 `copilot`），而 Story 文档（4-6b story:38-46）明确示例为 `🔧 GitHub Copilot` / `🔧 Claude Code`。tool-registry.ts 中已有 `id → name` 的映射（如 `copilot → GitHub Copilot`），但 `core/` 不得引用 `data/` 是架构约束。

3. **Story 输出契约**：Story Dev Notes（行 36-57）给出了明确的输出格式示例，TTY 要求 `source → target`，Plain 要求四列 `status tool source target`。当前实现均未满足。

**结论：需要修复（优先级：高）**

> ⚠️ 修复时需注意 `core/` 不得引用 `data/` 的架构约束（project-context.md & Dev Agent Record 中已记录）。tool display name 映射方案需要设计，可选方案包括：(a) 在 `InstallResult.items` 中新增 `toolDisplayName` 字段由上游填充；(b) 在 Reporter 中接收一个 `toolNameMap` 参数；(c) 在 `reportResult()` 入参中携带 display name 信息。具体方案由修复阶段决定。

---

### 发现 #2：`tests/core/reporter.test.ts` 没有锁定 Story 承诺的关键输出契约

| 维度 | 评估 |
|------|------|
| 问题描述准确性 | ✅ **准确** |
| 严重性判断 | ✅ **合理（Major）** |
| 修复建议可行性 | ✅ **可行** |
| 误报 | ❌ **非误报** |

**评估详述：**

经核实测试代码，审查发现完全成立：

1. **fixture 已提供 `sourcePath` 数据**：reporter.test.ts 的 `createSingleToolResult()`（行 9-32）和 `createMultiToolResult()`（行 35-58）均包含 `sourcePath` 字段，数据齐备。

2. **PlainReporter 断言缺失**：reporter.test.ts:175-206 的 PlainReporter 测试只验证了 `status`（'new'）、`targetPath`、`tool`（'copilot'）、统计行计数，**未验证 `sourcePath` 是否出现在输出中**，也未验证四列格式 `status\ttool\tsource\ttarget`。

3. **TtyReporter 断言缺失**：reporter.test.ts:298-328 的 TtyReporter 测试只验证了工具名包含 `copilot`/`claude`（内部 id）、状态图标 ✅🔄⏭️、统计行，**未验证 `🔧 GitHub Copilot` 显示名**，也未验证 `source → target` 行格式。

4. **因果关系清晰**：正因测试未锁定这些关键契约，发现 #1 的格式偏差才未被测试捕获。

**结论：需要修复（优先级：高），应与发现 #1 同步修复**

> 修复发现 #1 的实现后，必须同步增加对应的精确断言，确保 Story 承诺的输出格式被测试保护。

---

### 发现 #3：`tests/pipeline.test.ts` 中 `InstallResult` fixture 缺少 `tool` 字段

| 维度 | 评估 |
|------|------|
| 问题描述准确性 | ✅ **准确** |
| 严重性判断 | ✅ **合理（Medium）** |
| 修复建议可行性 | ✅ **可行** |
| 误报 | ❌ **非误报** |

**评估详述：**

经核实源码和测试代码，审查发现完全成立：

1. **类型定义**：`InstallResult.items` 中 `tool: string` 是必填字段（types.ts:74），带有 JSDoc 注释 `/** 安装该文件的 AI 工具名称，用于按工具分组输出结果 */`。

2. **pipeline.test.ts 缺失确认**：经搜索确认以下位置的 `InstallResult` fixture 均缺少 `tool` 字段：
   - 行 174：`{ status: 'new', sourcePath: '/src/a.md', targetPath: '/dst/a.md' }` — 缺 `tool`
   - 行 204：同上
   - 行 325-329：三个 item 均缺少 `tool` 字段

3. **运行时未报错原因**：审查正确指出 `tsconfig.json` 排除了 `tests/` 且 Vitest 默认 transpile-only，因此静态类型检查未覆盖测试文件。

4. **影响评估**：当前不影响测试运行结果（JavaScript 运行时不强制类型），但从类型契约完整性角度，fixture 与接口定义脱节是技术债务。

**结论：需要修复（优先级：中）**

> 修复简单直接：为每个缺失 `tool` 的 fixture item 补齐字段即可。建议值可使用 `'test-tool'` 或与具体测试场景匹配的工具名。

---

## 评估汇总

| # | 发现 | 审查判定 | 评估结论 | 修复优先级 |
|---|------|---------|---------|-----------|
| 1 | `reportResult()` 输出格式与 Story 约定不一致 | Major | ✅ 成立，需要修复 | **高** |
| 2 | 测试未锁定 Story 承诺的输出契约 | Major | ✅ 成立，需要修复 | **高**（与 #1 联动） |
| 3 | `pipeline.test.ts` fixture 缺少 `tool` 字段 | Medium | ✅ 成立，需要修复 | **中** |

**可忽略的发现：无**

**需要进一步讨论的发现：无**

## 修复建议优先级排序

1. **第一优先**（#1 + #2 联动）：修复 `reportResult()` 输出格式 + 补齐对应测试断言
   - TtyReporter：输出 `sourcePath → targetPath`，标题使用 display name
   - PlainReporter：输出四列 `status\ttool\tsourcePath\ttargetPath`
   - 测试：增加对 `sourcePath`、display name、完整行格式的精确断言
   - ⚠️ 需设计 `core/` 如何获取 tool display name 而不违反架构边界

2. **第二优先**（#3）：补齐 `pipeline.test.ts` 中 `InstallResult` fixture 的 `tool` 字段
   - 修复范围小，独立于 #1/#2

## 修复执行记录

### 修复执行记录
- **Date**: 2026-03-31
- **Model Used**: Claude Opus 4
- **Fix Items**: 3

---

#### 修复 #1：`reportResult()` 输出格式与 Story 约定对齐

**问题**：TtyReporter 标题使用内部 id（如 `copilot`）而非 display name（如 `GitHub Copilot`）；输出只有 `targetPath` 缺少 `sourcePath`。PlainReporter 输出三列 `status\ttool\ttargetPath` 缺少 `sourcePath` 列。

**修复方案**：采用方案 A — 在 `InstallResult.items` 新增 `toolDisplayName?: string` 可选字段，由上游 `stages/execute-install.ts` 从 `TOOL_DEFINITIONS` 查找填充。

**修改文件和关键变更**：

| 文件 | 变更 |
|------|------|
| `src/core/types.ts` | `InstallResult.items` 新增 `toolDisplayName?: string` 可选字段 |
| `src/stages/execute-install.ts` | 引入 `TOOL_DEFINITIONS`，构建 `toolNameMap`；所有 10 处 `resultItems.push()` 添加 `toolDisplayName: toolNameMap.get(item.rule.tool)` |
| `src/core/reporter.ts` (TtyReporter) | 标题改为 `🔧 ${displayName}`（优先 `toolDisplayName`，fallback `tool`）；每行改为 `icon sourcePath → targetPath` 格式 |
| `src/core/reporter.ts` (PlainReporter) | 每行改为四列 `status\ttool\tsourcePath\ttargetPath` |

**修复状态**：✅ 成功

---

#### 修复 #2：`reporter.test.ts` 补齐 Story 承诺的输出契约断言

**问题**：测试未验证 `sourcePath` 出现在输出中、未验证四列格式、未验证 display name。

**修改文件和关键变更**：

| 文件 | 变更 |
|------|------|
| `tests/core/reporter.test.ts` | fixture 函数 `createSingleToolResult()` 和 `createMultiToolResult()` 添加 `toolDisplayName` 字段 |
| `tests/core/reporter.test.ts` | PlainReporter 新增 2 个测试：验证 `sourcePath` 出现在输出中、验证四列 tab 分隔格式 `status\ttool\tsource\ttarget` |
| `tests/core/reporter.test.ts` | TtyReporter 新增 2 个测试：验证标题使用 display name（`🔧 GitHub Copilot` / `🔧 Claude Code`）、验证 `sourcePath → targetPath` 行格式 |

**修复状态**：✅ 成功

---

#### 修复 #3：`pipeline.test.ts` fixture 补齐 `tool` 字段

**问题**：3 处 `InstallResult` fixture 缺少必填的 `tool` 字段（类型契约不完整）。

**修改文件和关键变更**：

| 文件 | 变更 |
|------|------|
| `tests/pipeline.test.ts` 行 174 | 添加 `tool: 'test-tool'`（report 阶段 InstallResult 类型测试） |
| `tests/pipeline.test.ts` 行 204 | 添加 `tool: 'test-tool'`（mode=plan 路径测试） |
| `tests/pipeline.test.ts` 行 327-329 | 3 个 item 均添加 `tool: 'test-tool'`（saveManifest 过滤测试） |

**修复状态**：✅ 成功

---

### 修复验证

- **编译检查**：`tsc --noEmit` 无新增错误（预存的 `simple-git` 和 `clone.ts` 类型问题不受影响）
- **测试结果**：全仓 576 个测试全部通过（28 个测试文件）
- **新增测试**：4 个（PlainReporter 2 个 + TtyReporter 2 个）
