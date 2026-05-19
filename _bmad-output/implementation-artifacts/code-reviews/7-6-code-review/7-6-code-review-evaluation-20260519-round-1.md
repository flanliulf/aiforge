---
Story: 7-6
Round: 1
Date: 2026-05-19
Model Used: Claude Sonnet 4.6 (claude-sonnet-4-6)
Review Source: 7-6-code-review-summary-20260519-round-1.md
Review Model: Claude Sonnet 4.6 (claude-sonnet-4-5)
Type: Code Review Evaluation
---

## 评估总结

对 Story 7-6 的第 1 轮 CR 代码审查结果（首轮）进行逐条评估。共 4 条发现：1 条 `decision_needed`（AC#5 规则数量矛盾）、2 条 `patch`（confirm() 中断未捕获、msg() 动态键无防护）、1 条 `defer`（stdout/stdin TTY 历史约定）。评估结论如下：

- 发现 #1（AC#5 矛盾）：**决策已做出** — 接受现有实现，保留额外 Claude 项目根规则，Story AC 修正为文档变更建议（P2，非阻塞）
- 发现 #2（confirm() 中断）：**确认有效，需要修复** — P2，确认缺少 try/catch，Ctrl+C 将导致进程崩溃而非干净退出
- 发现 #3（msg() 动态键）：**有效但降级** — 当前无触发路径，纳入 CR TODO 跟踪（P3）
- 发现 #4（TTY 历史约定）：**确认 defer** — 历史既有问题，非本 Story 引入，纳入 CR TODO 跟踪（P3）

---

## 发现 #1 评估

### 审查原文

> **[高] AC#5 内部不一致 + 超范围 Claude 项目根 CLAUDE.md 规则**
> - 来源：blind + auditor
> - 分类：decision_needed

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P2 优先级）

**决策已做出（接受现有实现）**：保留额外的 Claude 项目根 `./CLAUDE.md` 规则，Story AC#5 文字应由"新增规则 +5 条"修正为"新增规则 +6 条"。该变更属于 Story 文档修正，不阻塞代码交付。

### 评估分析

**问题描述准确性：准确**

代码证据确认：

1. `tests/data/install-rules.test.ts:16`：
   ```typescript
   expect(BUILTIN_RULES).toHaveLength(46)
   ```
   测试断言 46 条且已通过，说明实际 BUILTIN_RULES = 46 条。

2. `src/data/install-rules.ts:128-136`（Claude 项目根规则）：
   ```typescript
   // Epic 7 规则矩阵补齐：Claude 项目级还需支持仓库根 CLAUDE.md
   {
     tool: 'claude',
     scope: 'project',
     sourceDir: 'instructions',
     type: Files,
     targetDir: './',
     fileFilter: ['CLAUDE.md'],
   },
   ```
   该条规则确实存在于 BUILTIN_RULES 且 Tasks 中未声明。

3. Story 7-5 基线为 40 条，40 + 5（Windsurf）= 45 ≠ 46；40 + 6（Windsurf + Claude 根规则）= 46 ✅。

   数学矛盾属实：AC#5 文字中的"+5条"与"总量 46 条"不一致。

**严重性判断：偏高（调整为 P2）**

原始标记为 `decision_needed`（高）是合理的，因为涉及人工裁决。**评估后决策**：接受现有实现，理由如下：
- 46 条总量已通过质量门禁，测试断言明确
- 额外 Claude 项目根规则在 Epic 7 规则矩阵中有实际意义（支持用户将 CLAUDE.md 放在仓库根目录）
- `Completion Notes` 中有解释，符合 Epic 7 累计目标
- 不存在显著的意外副作用风险（`.claude/CLAUDE.md` 与 `./CLAUDE.md` 目标路径不同，不会互相覆盖）

决策后剩余工作为文档修正，降级为 P2 非阻塞。

**修复建议：可行但非必要（代码不需修复）**

代码侧无需改动。建议修正 Story 7-6 的 AC#5 文字，将"新增规则 +5 条，`BUILTIN_RULES` 总量为 46 条"改为"新增规则 +6 条（5 条 Windsurf + 1 条 Claude 项目根 CLAUDE.md），`BUILTIN_RULES` 总量为 46 条"。此外，建议补充一个集成测试验证 `claude:project` 两条规则（`.claude/CLAUDE.md` 与 `./CLAUDE.md`）并存时的安装行为差异，纳入 CR TODO P2 跟踪。

**误报评估：非误报**

数学矛盾属实，但决策方向为接受实现并修正文档，而非撤回代码。

---

## 发现 #2 评估

### 审查原文

> **[低] `applySemanticWarnings` 未捕获 `confirm()` 中断异常**
> - 来源：blind + edge
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P2 优先级）

### 评估分析

**问题描述准确性：准确**

代码证据（`src/stages/semantic-warnings.ts:32-37`）：
```typescript
const shouldContinue = await confirm({
  message: msg(`semanticWarning.${warningKey}.prompt`),
  default: false,
})

if (shouldContinue) {
  filteredItems.push(item)
}
```

整个 `applySemanticWarnings` 函数（共 44 行）中无任何 try/catch 块。`confirm()` 调用完全暴露在中断风险中。

调用链确认（`src/stages/match-rules.ts:403-406`）：
```typescript
const filteredItems = await applySemanticWarnings(items, reporter)

reporter.completePhase()
return { items: filteredItems }
```

若 `applySemanticWarnings` 抛出 `ExitPromptError`（即 Ctrl+C），`reporter.completePhase()` 将不会被调用，异常将向上传播到 pipeline。

管道层（`src/pipeline.ts:450-451`）只识别 `FilterCancelledSignal`：
```typescript
if (error instanceof FilterCancelledSignal) {
```
`ExitPromptError` 不属于 `FilterCancelledSignal`，因此会以非零退出码崩溃，用户看到 stack trace 而非干净退出。

相比对照组 `filter-utils.ts` 中的 confirm 调用已通过 `FilterCancelledSignal` 机制处理，此处缺乏对等实现。

**严重性判断：合理（P2）**

原始标记 `[低]` 是相对保守的，但 P2 是合适优先级：
- 主功能路径（TTY 确认 yes/no）正常工作
- 仅在用户主动 Ctrl+C 中断 TTY 提示时触发
- 触发后表现为进程崩溃 + stack trace，UX 体验差
- 不影响非 TTY 场景（会走自动跳过分支，不进入 confirm()）

**修复建议：可行**

审查建议两种方案均可行：
- 方案 A（推荐）：在 `applySemanticWarnings` 内部捕获 `ExitPromptError` 并重新抛出为 `FilterCancelledSignal`，与现有取消机制统一
- 方案 B：在 `match-rules.ts` 调用侧添加 try/catch，确保 `completePhase()` 被调用后再传播异常

方案 A 更符合"取消行为统一由 FilterCancelledSignal 表达"的现有约定，推荐优先。

**误报评估：非误报**

确认为真实缺陷，用户交互路径存在不可忽略的崩溃风险。

---

## 发现 #3 评估

### 审查原文

> **[低] `msg()` 动态键路径无防护，新 i18n 键缺失时静默返回空字符串**
> - 来源：blind
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P3 优先级）

### 评估分析

**问题描述准确性：准确**

代码确认（`src/stages/semantic-warnings.ts:29,34`）：
```typescript
reporter.warn(msg(`semanticWarning.${warningKey}.skipped`))
// ...
message: msg(`semanticWarning.${warningKey}.prompt`),
```

`warningKey` 来自运行时 `item.rule.semanticWarning`（`string` 类型），无编译时约束。若键不存在，`msg()` 返回 `''`，`confirm()` 将显示空白 `message`。

**然而**，当前实现中 `semanticWarning` 字段只有一个已知值 `'windsurfAgentsToWorkflows'`（`src/data/install-rules.ts` 中唯一一处赋值），对应的 i18n 键已完整存在并有单元测试覆盖。**当前不存在触发路径**，属于面向未来的防御性建议。

**严重性判断：偏高（降级为 P3）**

原始标记 `[低]` 已较合理，评估后进一步降级为 P3：
- 当前不会触发（仅有一个 warningKey 且 i18n 键完整）
- 仅在未来新增 `semanticWarning` 值时才存在风险
- 属于代码防御性改进而非当前 Bug

**修复建议：可行但非必要（当前周期）**

方案二（收窄类型为字面量联合类型）编译时最安全，但需要在每次新增 warningKey 时同步更新类型定义，有一定维护成本。

方案一（运行时空字符串断言 + fallback 行为）实现简单，适合 CR TODO P3 阶段处理。

**误报评估：非误报（但属潜在风险而非当前缺陷）**

---

## 发现 #4 评估

### 审查原文

> **[defer] `process.stdout.isTTY` 与 `process.stdin.isTTY` 可能在特定场景下状态不一致**
> - 来源：（未标记，来自"已知既有问题"章节）
> - 分类：defer

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P3 优先级）

### 评估分析

**问题描述准确性：准确**

`src/stages/semantic-warnings.ts:28` 使用 `process.stdout.isTTY` 判断是否进入交互模式，而 `@inquirer/prompts` 实际读取 stdin。在特定边缘场景（如 `stdout` piped 但 `stdin` 仍是 TTY）可能产生不一致判断。

**严重性判断：合理（P3）**

- 该约定与 Reporter 共享，是项目级历史实现决策
- 非本 Story 引入
- 主路径测试覆盖充分
- 实际触发场景（stdout pipe + stdin TTY）属于非常规用法

**修复建议：合理但超出本 Story 范围**

需要项目级统一治理（统一 TTY 判断函数），适合在独立 Story 或 Epic 8 中处理。

**误报评估：非误报（历史既有问题，defer 分类正确）**

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 2 | confirm() 中断 ExitPromptError 未捕获 | [低] | **P2** | TTY 下 Ctrl+C 导致进程崩溃而非干净退出，需在 semantic-warnings.ts 内部捕获中断并重新抛出为 FilterCancelledSignal |

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 1 | AC#5 文字修正：+5条→+6条（文档修正） | [高/decision_needed] | **P2** | Story AC#5 文字需由"+5条"改为"+6条"；建议补充 claude:project 两条规则并存集成测试 |
| 3 | msg() 动态键无防护（潜在风险） | [低] | **P3** | 当前无触发路径，面向未来防御性改进，建议运行时空字符串断言 |
| 4 | stdout/stdin TTY 状态不一致（历史约定） | [defer] | **P3** | 项目级历史问题，需统一治理，超出本 Story 范围 |

### 可忽略（误报）

无。所有发现均为有效问题，无误报。

---

### 评估决定

- **发现 #1（AC#5 规则数量矛盾）**：决策已做出 — 接受现有实现，保留 Claude 项目根 `./CLAUDE.md` 规则。Story 7-6 的 AC#5 文字建议由"新增规则 +5 条，总量 46 条"修正为"新增规则 +6 条，总量 46 条"，此为文档修正，不阻塞交付。额外补充集成测试建议纳入 CR TODO P2。

- **发现 #2（confirm() 中断未捕获）**：确认为 P2 缺陷，阻塞交付，需修复。推荐方案：在 `src/stages/semantic-warnings.ts` 的 `applySemanticWarnings` 函数中捕获 `ExitPromptError` 并重新抛出为 `FilterCancelledSignal`，与现有取消机制保持一致。

- **发现 #3（msg() 动态键无防护）**：降级为 P3 CR TODO，当前无触发路径，面向未来防御性改进。在独立 PR 或下次功能迭代时处理。

- **发现 #4（TTY 历史约定）**：确认 defer，P3 CR TODO，需项目级统一治理，在后续 Epic 或独立 Story 中处理。

---

## 修复执行记录

### 修复执行记录
- **Date**: 2026-05-19
- **Model Used**: Claude Sonnet 4.6
- **Fix Items**: 1

### 修复项 #1：捕获 `confirm()` 中断异常（发现 #2）

**修复文件**：`src/stages/semantic-warnings.ts`

**修复位置**：`applySemanticWarnings` 函数内 `confirm()` 调用处（原第 32-37 行）

**修复内容**：

新增两处 import：
```typescript
import { ExitPromptError } from '@inquirer/core'
import { FilterCancelledSignal } from './filter-utils.js'
```

将裸露的 `confirm()` 调用包裹在 try/catch 中：
```typescript
// 修复前
const shouldContinue = await confirm({
  message: msg(`semanticWarning.${warningKey}.prompt`),
  default: false,
})
if (shouldContinue) {
  filteredItems.push(item)
}

// 修复后
try {
  const shouldContinue = await confirm({
    message: msg(`semanticWarning.${warningKey}.prompt`),
    default: false,
  })
  if (shouldContinue) {
    filteredItems.push(item)
  }
} catch (err) {
  if (err instanceof ExitPromptError) {
    throw new FilterCancelledSignal()
  }
  throw err
}
```

**修复效果**：TTY 环境下用户按 Ctrl+C 中断 `confirm()` 时，`ExitPromptError` 被捕获并转换为 `FilterCancelledSignal`，与 `filter-utils.ts` 中的现有取消机制保持一致，pipeline 层可正确识别并以 exit code 0 干净退出，不再崩溃输出 stack trace。

**质量门禁结果**：
- `npm test`：34 个测试文件，918 个测试用例，全部通过 ✅
- `npm run lint:src`：ESLint + Prettier 检查全部通过 ✅

**修复状态**：✅ 成功
