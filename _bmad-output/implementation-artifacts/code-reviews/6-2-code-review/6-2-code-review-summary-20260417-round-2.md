---
Story: 6-2
Round: 2
Date: 2026-04-17
Model Used: GPT-5.4 (gpt-5.4)
Type: Code Review Summary
Baseline: 6-2-code-review-evaluation-20260417-round-1.md
---

## 审查结论

第 2 轮复审。Round 1 的 3 个阻塞问题均已修复，AC #1-#5 当前已满足；`npm test`、`npm run lint:src`、`npm run build` 全部通过。当前仅发现 1 个低优先级一致性问题，不阻塞 Story 6-2 交付，建议通过并将该项并入后续 CR TODO。

## 上轮问题回顾

### 已修复

1. Round 1 / Finding #1：无前缀零匹配恢复枚举不可命中的候选，并在用户选择后静默返回空计划。
2. Round 1 / Finding #2：Files 类型的零匹配恢复只扫描目录，`agents` / `instructions` 场景拿不到可重试候选。
3. Round 1 / Finding #3：`empty-item guard` 错误扩大到非 `--filter` 路径，回归了既有 `emptySourceDir` 预览语义。

### 仍为非阻塞待办

1. Round 1 / Finding #4：不可命中的 filter 语法没有被前置拒绝，而是延后到零匹配流程中暴露。

## 新发现

### 1. [低] 零匹配恢复候选对 dot-prefixed 条目过滤过严，与主匹配空间不一致

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `src/stages/match-rules.ts` 的 `scanSourceFiles()` 在 `Files` / `Directories` / `Flatten` 路径下只排除 `DEFAULT_EXCLUDES`，不会额外排除 `.` 开头条目。
  - 同文件的 zero-match candidate 收集逻辑对 `entry.name.startsWith('.')` 直接跳过，导致 TTY 选择和非 TTY `fixAvailable` 都看不到这些条目。
  - 当前测试集中没有覆盖“dot-prefixed 但不在 `DEFAULT_EXCLUDES` 中”的 source item。

- **影响**
  - 如果仓库存在可安装但以点号开头的 skill / agent 文件或目录，主过滤路径可以匹配它们，零匹配恢复路径却不能把它们作为候选返回。
  - 恢复流枚举空间比主匹配空间更窄，行为不一致。

- **触发场景**
  - 用户使用错误或过窄的 filter 触发零匹配。
  - 相关 `sourceDir` 下存在 `.hidden-skill`、`.agent-template.md` 这类未在 `DEFAULT_EXCLUDES` 中的可安装项。

- **建议**
  - 将候选枚举的过滤条件收敛到与 `scanSourceFiles()` 一致的规则。
  - 如果产品上决定统一隐藏 dot 项，则主扫描和恢复扫描都应一致调整，并补充对应回归测试。

## 验证摘要

- `npm test` ✅ 通过（777 / 777）
- `npm run lint:src` ✅ 通过
- `npm run build` ✅ 通过
- 复审确认 ✅ Round 1 Findings #1-#3 的代码修复均已存在，且对应回归测试仍为绿色
- AC 审计 ✅ AC #1-#5 当前满足

## 通过项

- 零匹配恢复现在已按 `rule.type` 收集候选，`Files` 类型不再误用目录扫描。
- 无前缀恢复使用 `sourceDir/itemName` 形式的限定名，TTY 重试后也有二次零匹配检查。
- `empty-item guard` 已限定在 `args.filter` 路径，不再回归非 filter 的 `emptySourceDir` 语义。
- `FilterCancelledSignal` 与 pipeline 的正常退出路径保持打通。

## 结论

本轮复审确认 Story 6-2 的阻塞项已解除，当前仅余 1 个低优先级一致性问题。建议通过本轮复审，并将该问题与 Round 1 保留的 filter grammar TODO 一并纳入后续改进跟踪。