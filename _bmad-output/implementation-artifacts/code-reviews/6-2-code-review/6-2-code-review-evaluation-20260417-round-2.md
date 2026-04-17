---
Story: 6-2
Round: 2
Date: 2026-04-17
Model Used: Claude Opus 4.6 (claude-opus-4-dot-6)
Review Source: 6-2-code-review-summary-20260417-round-2.md
Review Model: GPT-5.4 (gpt-5.4)
Type: Code Review Evaluation
---

## 评估总结

对 Story 6-2 的第 2 轮 CR 代码审查结果（复审）进行逐条评估。复审确认 Round 1 的 3 个阻塞问题均已修复，新增 1 条低优先级一致性发现。经独立代码验证，该发现有效但不阻塞交付，建议纳入 CR TODO 跟踪。评估结论如下。

---

## 上轮问题回顾确认

### Round 1 / Finding #1（无前缀零匹配恢复不可命中）：✅ 已修复

经代码验证，[match-rules.ts](src/stages/match-rules.ts#L210-L244) 零匹配恢复已重构为按 `rule.type` 收集候选，候选值使用 `sourceDir/itemName` 限定名格式。无前缀场景下遍历所有相关规则，候选来自真实可命中的安装项（而非仓库顶层目录名）。重试后在 [match-rules.ts](src/stages/match-rules.ts#L283-L293) 增加了二次零匹配检查，不再静默返回空计划。

### Round 1 / Finding #2（Files 类型零匹配恢复缺失文件候选）：✅ 已修复

经代码验证，[match-rules.ts](src/stages/match-rules.ts#L229-L230) 候选收集逻辑按 `rule.type === InstallType.Files ? entry.isFile() : entry.isDirectory()` 分支，Files 类型规则（含 `agents`、`instructions`、`mcp-tools`）现在正确枚举文件 basename 而非子目录名。

### Round 1 / Finding #3（空 item 守卫作用域过宽）：✅ 已修复

经代码验证，[match-rules.ts](src/stages/match-rules.ts#L190) 空 item 守卫已限定为 `if (args.filter && sourceFiles.length === 0) continue`，非 `--filter` 场景下空 item 照常进入 plan，`reportPlan()` 的 `emptySourceDir` 输出语义已恢复。

### 历史 CR TODO（非阻塞）

| # | 发现 | 状态 | 评估意见 |
|---|------|------|---------|
| R1-#4 | 不可命中的 filter 语法（空 glob、多斜杠）未被前置拒绝 | CR TODO / 非阻塞 | 同意维持，后续迭代增强 |

---

## 发现 #1 评估

### 审查原文

> **[低] 零匹配恢复候选对 dot-prefixed 条目过滤过严，与主匹配空间不一致**
> - 来源：blind+edge
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P3 优先级）

### 评估分析

**问题描述准确性：准确**

经独立代码验证，不一致确实存在：

1. **主匹配路径** [match-rules.ts](src/stages/match-rules.ts#L113-L131)：`scanSourceFiles()` 的 Files / Directories / Flatten 分支仅排除 `DEFAULT_EXCLUDES`（定义于 [excludes.ts](src/data/excludes.ts#L7-L12)，含 `README.md`、`.gitkeep`、`.DS_Store` 等 6 项），**不**额外排除 `.` 开头条目。因此如 `.hidden-skill/` 这样的 dot-prefixed 但不在 `DEFAULT_EXCLUDES` 中的条目，主路径可以匹配并安装。

2. **零匹配恢复路径** [match-rules.ts](src/stages/match-rules.ts#L228)：候选收集循环中 `if (DEFAULT_EXCLUDES.includes(entry.name) || entry.name.startsWith('.')) continue` 额外排除了所有 `.` 开头条目，范围比 `DEFAULT_EXCLUDES` 更宽。

两者过滤条件不一致：主路径接受 `.hidden-skill`，恢复路径排除它。

**严重性判断：合理，但实际影响极低**

低严重性合理。进一步降级至 P3 的理由：
- 知识仓库中以 `.` 开头的可安装 skill / agent / instruction 在实际项目中极罕见——常见约定是 dot files 为隐藏/配置文件，不作为可安装项。
- 该不一致仅在**零匹配恢复**路径触发（用户已使用了错误的 filter pattern），影响的是 TTY 菜单和非 TTY `fixAvailable` 的候选列表完整性，不影响正常安装流程。
- `DEFAULT_EXCLUDES` 已覆盖最常见的 dot files（`.gitkeep`、`.DS_Store`），残余未覆盖的 dot-prefixed 安装项概率很低。

**修复建议：可行但非必要**

审查建议的两个方向均可行：(1) 恢复路径去掉 `startsWith('.')` 检查、与 `scanSourceFiles` 对齐；(2) 反过来让 `scanSourceFiles` 也统一排除 dot items。选择哪个方向需要产品决策，当前 MVP 阶段不紧迫。

**误报评估：非误报**

不一致客观存在，但触发条件极端（需同时满足：dot-prefixed 可安装项 + 零匹配 + 该项恰好是用户想要的候选），实际风险极低。

---

## 整体评估结论

### 需要修复（阻塞交付）

无阻塞项。Round 1 的 3 个 P1 修复均已确认完成。

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| R2-1 | 零匹配恢复候选对 dot-prefixed 条目过滤与主匹配不一致 | [低] | **P3** | 实际触发概率极低，后续统一 dot-item 策略时一并处理 |

### 历史 CR TODO 汇总

| # | 发现 | 来源轮次 | 优先级 | 说明 |
|---|------|---------|--------|------|
| R1-#4 | 不可命中的 filter 语法未前置拒绝 | Round 1 | **P2** | 后续迭代增加 grammar 校验 |
| R2-#1 | dot-prefixed 候选过滤与主匹配不一致 | Round 2 | **P3** | 后续统一 dot-item 策略 |

### 评估决定

- **发现 #1（dot-prefixed 候选过滤不一致）**：P3 纳入 CR TODO。不一致客观存在但触发条件极端，不阻塞 Story 6-2 交付。建议在后续统一 dot-item 处理策略时一并修复，补充对应回归测试。
- **整体结论**：同意复审的通过建议。Story 6-2 的所有阻塞项已解除，AC #1-#5 满足，质量门禁（test/lint/build）全部通过，可以交付。

---

## 修复执行记录

### 修复执行记录
- **Date**: 2026-04-17
- **Model Used**: Claude Sonnet 4.6 (GitHub Copilot)
- **Fix Items**: 0

### 执行说明

本轮（Round 2）评估结论中**无阻塞修复项**。整体结论如下：

- Round 1 的全部 3 个 P1 修复（#1 无前缀零匹配候选、#2 Files 类型候选、#3 空 item 守卫作用域）均已由上一轮修复确认收敛，无需重新处理。
- 唯一新发现（R2-#1，dot-prefixed 候选过滤与主匹配不一致）评估为 P3，结论为"纳入 CR TODO 跟踪，后续统一 dot-item 策略时处理"，不阻塞本次交付。

按照 CR 修复工作流规则，本次无可执行的代码修复。Story 6-2 可进入交付流程。
