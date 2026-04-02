---
Story: 5-5a
Round: 1
Date: 2026-04-01
Model Used: Claude Sonnet 4 (claude-sonnet-4-20250514)
Review Source: 5-5a-code-review-summary-20260401-round-1.md
Review Model: GPT-5.4 (model ID: gpt-5.4)
Type: Code Review Evaluation
---

## 评估总结

本轮评估针对 GPT-5.4 的第 1 轮代码审查结果，逐条核实其发现的准确性和合理性。

**整体评估结论：审查结果基本准确，所有发现均需修复。架构讨论事项已全部确认：messages.ts 移入 core/、CLI help 仅英文、遗漏文件纳入本 Story。**

---

## 逐条评估

### Finding #1: [高] `aiforge init` 选择英文后，本次 init 运行内的提示与结果仍然是中文

**评估结论：✅ 确认——问题真实存在，需要修复**

**问题描述准确性：准确**

经代码验证：

- `init.ts` 未引入 `msg()` / `setLanguage()`，全部用户可见字符串均为内联中文硬编码（第 56-58 行的"当前配置"摘要、第 60 行"是否修改当前配置？"、第 66 行"⚠️ 配置文件损坏"、第 80-86 行的语言选择标签、第 91-93 行"默认知识仓库 URL"及验证提示、第 104-110 行"认证方式"及选项、第 119-121 行"Personal Access Token"、第 177-186 行 SSH 错误提示、第 207-215 行 Token 错误提示等）。
- 语言选择结果仅在第 142 行保存到 `config.language`，选择后未调用 `setLanguage(language)`，因此后续 prompt/console 输出不会切换语言。
- `messages.ts` 已定义了完整的 `init.*` 英文文案（第 157-176 行），但 `init.ts` 完全没有使用。

**严重性判断：合理**

Story AC #1 明确要求"选择英文后后续所有用户可见输出使用英文"，AC #3 要求"所有用户可见字符串通过 messages 模块的 `msg()` 函数获取"。`init.ts` 作为用户接触的第一个入口，不使用 `msg()` 直接违反这两个 AC。

**修复建议可行性：可行**

审查建议的两步方案（先用 `existingConfig?.language` 预加载，再在 Step 0 后 `setLanguage()`；将所有内联中文改为 `msg('init.*')`）完全可行，且 `messages.ts` 已预备好所有 init 消息键。

**优先级：P0 — 必须修复**

---

### Finding #2: [高] "跨 Epic 字符串抽取"没有真正收口，`language = en` 时后续命令仍会输出大量中文

**评估结论：✅ 确认——核心问题真实存在，需要修复（架构决策已确认：messages.ts 移入 core/）**

**问题描述准确性：大部分准确，存在细微过度解读**

经代码验证确认的事实：

1. **Reporter 层（`core/reporter.ts`）**：统计行（第 60-71 行 `planStatsLine`、`resultStatsLine`）、计划标题"📋 安装计划预览 (dry-run)"（第 184 行）、scope 标签"全局/项目"（第 199 行）、"(源目录为空: ...)"（第 217 行）、错误格式"修复方法："（第 238 行）等均为内联中文。QuietReporter 的统计行同样是中文（第 375 行）。这是**真实问题**。

2. **错误链路（`services/config.ts`、`services/git.ts`）**：所有 `AiforgeError` 构造均使用硬编码中文（config.ts 第 23-66 行、git.ts 第 110-172 行）。这是**真实问题**。

3. **`stages/detect-tools.ts`**：诊断输出 `emitDiagnostics`（第 95-112 行）仍为硬编码中文（"未检测到任何 AI 编码工具"、"扫描路径"、"建议"等），错误构造同样中文（第 142-153 行、第 173-183 行）。这是**真实问题**。

4. **`index.ts` CLI 参数**：第 34-44 行 Commander 选项描述均为中文（"知识仓库 URL"、"全局安装"等）。这是**真实问题**。

5. **`index.ts` 入口描述**：第 32 行 `.description('AI rules installer...')` 实际上已经是英文，审查将其列为问题不完全准确。

**严重性判断：合理（架构阻碍已解除）**

审查将此标为 [高] 并关联 AC #1、#3、#4。经讨论确认 `messages.ts` 移入 `core/` 后，Reporter 可直接引用 `msg()`，不再有模块边界阻碍。严重性 [高] 判定合理。

**修复建议可行性：全部可行**

- `messages.ts` 移入 `core/` 后，`reporter.ts` 可直接引用 `msg()`：**可行**。
- `services/` 和 `stages/` 中的 `AiforgeError` 替换为 `msg()` 调用：**可行**，这些模块可以依赖 `core/messages.ts`。
- CLI help 文案：**统一改为英文，不做国际化**。

**优先级：P0 — 需要修复（架构阻碍已解除，全部纳入本 Story 范围）**

**补充：审查遗漏了 `services/fs-utils.ts` 中的大量硬编码中文 AiforgeError（至少 17 处），实际问题比审查描述的更广泛。**

---

### Finding #3: [中] 测试覆盖主要验证"language 被保存"，没有守住"英文真的被输出"

**评估结论：✅ 确认——问题真实存在，需要修复**

**问题描述准确性：准确**

经代码验证：

1. **init 测试**（`init.test.ts` 第 581-655 行）：3 个新增测试仅验证 `select` 调用次数和 `saveConfig` 保存的 `language` 值，未断言英文模式下 prompt / console 输出内容。这是**事实**。

2. **Reporter 测试**（`reporter.test.ts` 第 503-508 行、第 867-931 行）：明确断言中文统计行"安装:"、"更新:"、"跳过:"、"计划安装:"等。TtyReporter 和 QuietReporter 的测试都在验证中文输出，没有英文场景的测试。这是**事实**。但这也是合理的——因为 Reporter 目前确实只输出中文（Finding #2 的直接后果），在 Reporter 本身未改造前测试英文输出没有意义。

3. **入口层测试缺失**：`index.ts` 的语言加载逻辑（第 51-71 行）没有直接的单元测试覆盖。这是**事实**。

**严重性判断：合理**

测试应该编码验收契约。AC #1 的核心验收点是"英文真的被输出"，但现有测试只验证了"language 值被保存"这一中间状态，未触及最终输出。

**修复建议可行性：部分可行**

- 补充 `messages.test.ts` 中 `setLanguage('en')` 后 `msg()` 返回英文的端到端测试：**已存在**（`messages.test.ts` 已有 23 个双语测试覆盖此场景）。
- 补充 `index.ts` 语言加载的集成测试：**可行**。
- 补充 Reporter 英文输出断言：**依赖 Finding #2 的修复**——Reporter 本身未改造前，英文测试无意义。

**优先级：P1 — 与 Finding #2 的修复同步进行**

---

## AC 复核评估

| AC | 审查结论 | 评估判定 | 评估说明 |
|----|----------|----------|----------|
| #1 | ❌ 未满足 | ✅ 同意 | `language` 能保存，但 init 运行内和后续命令的 Reporter/Error 输出仍为中文 |
| #2 | ✅ 满足 | ✅ 同意 | 默认中文路径确实成立 |
| #3 | ❌ 未满足 | ✅ 同意 | 阶段名已完成 `msg()` 替换；Reporter/Error/其他层的内联中文确认需要修复（messages.ts 移入 core/ 后无阻碍） |
| #4 | ⚠️ 部分满足 | ✅ 同意 | `setLanguage()` 机制正确，但输出端未全面接入 |
| #5 | ✅ 基本满足 | ✅ 同意 | 回退逻辑正确，入口层测试可补充 |

---

## 补充观察评估

审查提到的 Rule Document Registry 三文档同步分歧（`project-context.md` vs `04-implementation-patterns.md` 关于 `console.log` 例外的表述不一致），这是**真实问题**但不影响本 Story 的通过判定。建议作为技术债务单独跟踪。

---

## 审查遗漏项

1. **`services/fs-utils.ts`**：至少 17 处 `AiforgeError` 构造使用硬编码中文，审查完全遗漏。这些错误在文件操作失败时对用户可见，属于 AC #3 的覆盖范围。
2. **`stages/conflict-resolver.ts`**：至少 2 处 `AiforgeError` 硬编码中文（第 123 行、第 136 行），审查未提及。
3. **`pipeline.ts`**：第 117 行和第 405 行 `AiforgeError` 硬编码中文，审查未提及。
4. **`core/path-resolver.ts`**：第 20 行 `AiforgeError` 硬编码中文，审查未提及。
5. **`stages/resolve-source.ts`**：第 79 行 `AiforgeError` 硬编码中文，审查未提及（该文件的 `startPhase` 已替换，但 Error 未替换）。
6. **`stages/authenticate.ts`**：第 54 行 `AiforgeError` 硬编码中文及第 85 行 `updatePhase` 中仍拼接中文括号"(环境变量 Token: ...)"，审查未提及。
7. **向后兼容导出**：`messages.ts` 第 223-261 行保留了 `MESSAGES`（旧常量）、`STATS_FORMAT`、`PLAN_STATS_FORMAT` 三个硬编码中文的向后兼容导出，这些不受 `setLanguage()` 控制，如果被引用会始终输出中文。审查未提及。

---

## 最终评估结论

### 需要修复的发现（按优先级排序）

| 优先级 | Finding | 说明 |
|--------|---------|------|
| **P0** | #1 — init.ts 未使用 msg() 且未调用 setLanguage() | 直接违反 AC #1/#3，修复路径清晰 |
| **P0** | #2 — Reporter/Error/CLI 硬编码中文（含审查遗漏项） | 架构决策已确认（messages.ts → core/），全部纳入本 Story |
| **P1** | #3 — 测试未编码英文输出契约 | 与 #2 修复同步进行 |

### 可以忽略的发现

无。所有发现均真实存在。

### 讨论结论（已确认）

以下三项讨论事项已与 chunxiao 确认，结论如下：

#### 1. ✅ `messages.ts` 移入 `core/` — 已批准

**决策：将 `src/data/messages.ts` 移至 `src/core/messages.ts`。**

理由：
- `messages.ts` 拥有可变全局状态（`currentLanguage`）和运行时行为（`setLanguage()`、`msg()`），已不符合 `data/` 层 "pure constants" 的定义。
- 其本质是**基础设施级 i18n provider**，与 `errors.ts`（错误基础设施）、`types.ts`（类型基础设施）、`reporter.ts`（输出基础设施）同级。
- 移入 `core/` 后，`reporter.ts` 可直接引用 `msg()`，消除所有内联中文重复，不产生新的跨目录依赖。
- `core/` 内部模块互引是已有模式（`path-resolver.ts → errors.ts`、`reporter.ts → types.js`），不违反 "core/ ZERO dependencies on other src dirs" 规则。

**影响**：需同步更新 Rule Document Registry 中模块边界的描述，并更新所有 `import ... from '../data/messages.js'` 路径。

#### 2. ✅ CLI help 文案 — 仅英文，不国际化

**决策：CLI help 文案（`index.ts` 中 Commander 的 `.description()` / `.option()` 描述）统一使用英文，不做国际化。**

当前中文描述（如 `'知识仓库 URL'`、`'全局安装'` 等）在 CR Fix 中统一改为英文即可。

#### 3. ✅ 审查遗漏文件 — 全部纳入本 Story 修复

**决策：所有遗漏的硬编码中文 AiforgeError 均在 Story 5.5a CR Fix 中一并修复。**

涉及文件：
- `services/fs-utils.ts`（~17 处）
- `stages/conflict-resolver.ts`（2 处）
- `pipeline.ts`（2 处）
- `core/path-resolver.ts`（1 处）
- `stages/resolve-source.ts`（1 处 Error）
- `stages/authenticate.ts`（1 处 Error + 1 处中文拼接）
- `stages/detect-tools.ts`（诊断输出 + 2 处 Error）
- `messages.ts` 向后兼容导出清理

---

## 修复执行记录

### 修复执行记录
- **Date**: 2026-04-01
- **Model Used**: Claude Opus 4.5
- **Fix Items**: 6

---

### Finding #1 — `init.ts` 缺少 `setLanguage()` 调用

**修复状态**: ✅ 完成

**涉及文件**: `src/commands/init.ts`

**修改内容**:
- 新增 `import { msg, setLanguage } from '../core/messages.js'`
- 在语言选择 `select()` 返回后立即调用 `setLanguage(language)`
- 将所有内联中文字符串替换为 `msg('init.*')` 调用（prompts、错误信息、输出标签、验证提示等）

---

### Finding #2 — `reporter.ts` / `errors.ts` / `index.ts` 硬编码中文

**修复状态**: ✅ 完成

**涉及文件**:
- `src/core/reporter.ts`
- `src/index.ts`
- `src/services/config.ts`
- `src/services/git.ts`

**修改内容**:
- `reporter.ts`: 所有统计标签（安装/更新/跳过）、planTitle、scopeGlobal/scopeProject、emptySourceDir、fixMethod 均通过 `msg('reporter.*')` 输出
- `index.ts`: CLI option 描述统一改为英文；import 路径从 `./data/messages.js` → `./core/messages.js`
- `config.ts`: 所有 AiforgeError 消息通过 `msg('config.*')` 输出
- `git.ts`: 所有 AiforgeError 消息通过 `msg('git.*')` 输出

---

### Finding #3 (P1) — 审查遗漏文件 + 补充测试

**修复状态**: ✅ 完成

**涉及文件（全部国际化）**:
- `src/core/messages.ts`（新建 — 从 `src/data/messages.ts` 迁移并扩展）
- `src/data/messages.ts`（改为向后兼容 re-export 垫片）
- `src/services/fs-utils.ts`（~17 处 AiforgeError 消息）
- `src/stages/conflict-resolver.ts`（choice 标签 + 2 处 AiforgeError）
- `src/pipeline.ts`（2 处 AiforgeError）
- `src/core/path-resolver.ts`（1 处 AiforgeError）
- `src/stages/resolve-source.ts`（1 处 AiforgeError + import 路径更新）
- `src/stages/authenticate.ts`（1 处 AiforgeError + 移除中文环境变量拼接）
- `src/stages/detect-tools.ts`（诊断输出 + 2 处 AiforgeError）
- `src/stages/clone.ts`、`src/stages/execute-install.ts`、`src/stages/match-rules.ts`（仅 import 路径更新）

**补充测试**:
- `tests/data/messages.test.ts`: 模块边界测试从 `src/data/messages.ts` 更新为 `src/core/messages.ts`
- `tests/commands/init.test.ts`: 新增 setLanguage spy 测试（选英文→`setLanguage("en")`，选中文→`setLanguage("zh-CN")`）
- `tests/core/reporter.test.ts`: 新增英文模式输出断言（QuietReporter/TtyReporter/PlainReporter 统计行英文化 + Fix 标签英文化）

---

### 架构决策落地

| 决策 | 执行结果 |
|------|---------|
| `messages.ts` 移入 `core/` | ✅ 新建 `src/core/messages.ts`，原 `src/data/messages.ts` 改为 re-export 垫片 |
| CLI help 仅英文 | ✅ `src/index.ts` 所有 Commander option 描述改为英文 |
| 全部国际化（含 AiforgeError） | ✅ 全部 i18n 覆盖，审查遗漏文件一并修复 |

---

### 测试验证

```
Test Files: 28 passed (28)
Tests:      649 passed (649)
Duration:   ~967ms
```

全部 649 个测试通过，无失败。
