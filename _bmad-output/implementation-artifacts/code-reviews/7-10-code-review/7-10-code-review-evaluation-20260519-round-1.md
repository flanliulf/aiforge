---
Story: 7-10
Round: 1
Date: 2026-05-19
Model Used: GPT-5.5
Review Source: 7-10-code-review-summary-20260519-round-1.md
Review Model: GPT-5.5
Type: Code Review Evaluation
---

## 评估总结

对 Story 7-10 的第 1 轮 CR 代码审查结果（首轮）进行逐条评估。审查共提出 2 个新发现，均与 AC #6 / Task 5 的 `.iflow/` stale-tool 信息提示有关：一个是手动指定工具模式下不会输出提示，另一个是信息性检查可能因非 ENOENT/ENOTDIR 的 I/O 错误阻断安装。经独立代码核对，两项发现均成立，且都应作为阻塞交付的 P1 修复项处理。

---

## 发现 #1 评估

### 审查原文

> **[中] 手动指定工具模式会绕过 `.iflow/` stale-tool 提示**
> - 来源：auditor+edge
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

Story AC #6 要求在“检测到残留 `.iflow/` 目录的用户环境”执行 `aiforge install` 时输出无操作提示，并且不安装任何 `.iflow/` 相关路径；Task 5.1 进一步明确需要检查 `~/.iflow/` 或项目 `.iflow/`，Task 5.3 明确该提示“不阻断安装流程，仅信息性提示”。对应要求见 `_bmad-output/implementation-artifacts/stories/7-10-epic-7-finalization-docs-and-tests.md:36` 与 `_bmad-output/implementation-artifacts/stories/7-10-epic-7-finalization-docs-and-tests.md:84-89`。

实现中，`detectTools()` 在 `args.tools` 非空时进入手动指定工具分支，并在完成工具 ID 校验后直接 `reporter.completePhase()` 和 `return { tools, scope }`，位置为 `src/stages/detect-tools.ts:172-194`。`.iflow/` 检查只在自动检测分支后执行，位置为 `src/stages/detect-tools.ts:213-214`。因此 `aiforge install --tools copilot` 或其他手动工具模式确实不会经过 `detectIflowResidue()`，也不会输出 `detectTools.iflowStale`。

测试也印证当前覆盖缺口：已有手动模式测试在 `tests/stages/detect-tools.test.ts:478-488` 断言手动指定工具时 `access` 不应被调用；已有 `.iflow/` stale-tool 测试仅覆盖自动检测路径，位于 `tests/stages/detect-tools.test.ts:832-858`，没有覆盖 `args.tools` 手动模式。

**严重性判断：合理**

原始严重性为“中”合理。该问题不是数据破坏或安全漏洞，但它直接导致 AC #6 在一种真实 CLI 使用路径下未满足，属于验收覆盖缺口。评估后建议作为 P1 阻塞项，因为 Story 当前处于 review，AC 未完整达成不应进入 Done。

**修复建议：可行**

建议可行，但实现时需要注意不要把“手动指定模式跳过自动工具检测”改成完整自动扫描。推荐做法是抽出一个独立、非阻断的 `emitIflowStaleNoticeIfNeeded()`，在手动分支返回前和自动分支中共同调用；同时更新旧测试语义，从“手动模式完全不访问 fs”调整为“不执行工具标志扫描，但允许执行独立 stale notice 检查”，并新增手动模式 `.iflow/` 提示测试。

**误报评估：非误报**

该发现由 AC 审计与边界路径分析共同命中，且代码路径存在明确提前返回，属于真实缺口。

---

## 发现 #2 评估

### 审查原文

> **[中] `.iflow/` 信息性检查可能因权限/I/O 错误阻断安装流程**
> - 来源：edge+auditor
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

`pathExists()` 的通用语义是仅将 `ENOENT` / `ENOTDIR` 降级为 `false`，其他错误继续抛出，位置为 `src/stages/detect-tools.ts:33-44`。`detectIflowResidue()` 直接复用该函数检查 home 与 project 两处 `.iflow`，位置为 `src/stages/detect-tools.ts:104-112`。自动检测流程随后直接 `await detectIflowResidue(pathResolver)`，没有 try/catch 或降级保护，位置为 `src/stages/detect-tools.ts:213-214`。

因此，当 `~/.iflow` 或项目 `.iflow` 的存在性检查遇到 `EACCES`、`EIO`、损坏挂载等非 ENOENT/ENOTDIR 错误时，`.iflow/` stale-tool 提示会把错误向上抛出并中断 `detectTools()`。这与 Task 5.3 “不阻断安装流程，仅信息性提示”的要求不一致，见 `_bmad-output/implementation-artifacts/stories/7-10-epic-7-finalization-docs-and-tests.md:89`。

测试覆盖也不足：当前只存在通用 `fs.access` 非白名单错误应向上抛出的测试，位置为 `tests/stages/detect-tools.test.ts:607-617`，以及 `.iflow/` 正常存在时输出提示的测试，位置为 `tests/stages/detect-tools.test.ts:832-858`；没有覆盖 stale-tool 检查自身遇到 `EACCES` 时不得阻断安装的场景。

**严重性判断：合理**

原始严重性为“中”合理。该问题由信息性提示引入安装阻断风险，虽然触发条件不是常规路径，但一旦触发会违背 Story 明确约束并影响正常安装流程。评估后建议作为 P1 阻塞项，因为它直接违反 Task 5.3 的非阻断语义。

**修复建议：可行**

建议可行。推荐保持通用 `pathExists()` 的严格错误策略不变，避免破坏既有文件系统错误白名单规则；仅为 `.iflow/` stale-tool 提示引入专用的非阻断存在性检查或在 `detectIflowResidue()` 内捕获非 ENOENT/ENOTDIR 异常并降级为“不输出提示”。同时补充测试：当 `.iflow` 检查抛出 `EACCES` 且存在其他有效工具时，`detectTools()` 应继续返回检测结果，不应因为 stale-tool 提示失败而抛错。

**误报评估：非误报**

该发现有明确代码路径和 Story 约束支撑，不属于误报。

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | 手动指定工具模式会绕过 `.iflow/` stale-tool 提示 | [中] | **P1** | 手动 `--tools` 路径提前返回，未覆盖 AC #6 的 stale notice 触发语义。 |
| 2 | `.iflow/` 信息性检查可能因权限/I/O 错误阻断安装流程 | [中] | **P1** | 信息提示复用严格 `pathExists()`，非白名单 I/O 错误会违反 Task 5.3 的非阻断要求。 |

### 建议纳入 CR TODO 跟踪（非阻塞）

无。

### 可忽略（误报）

无。

### 评估决定

- **发现 #1（手动指定工具模式会绕过 `.iflow/` stale-tool 提示）**：确认有效，需要进入 fixer 修复；建议新增手动 `args.tools` + home/project `.iflow` 的单元测试，并同步调整“手动模式不访问 fs”的旧测试口径，限定为不执行工具自动检测扫描。
- **发现 #2（`.iflow/` 信息性检查可能因权限/I/O 错误阻断安装流程）**：确认有效，需要进入 fixer 修复；建议对 `.iflow/` stale-tool 检查做专用非阻断降级，不改变通用 `pathExists()` 的严格错误传播规则。

### 最终决定

- **整体评估决定：不通过**
- **是否需要进入 fixer：是**
- **进入 fixer 范围建议**：仅修复上述两个 `.iflow/` stale-tool 提示问题，并补充对应单元测试；不得扩大到文档重写、Story 状态流转或无关重构。

## 修复执行记录

### 修复执行记录
- **Date**: 2026-05-19
- **Model Used**: GPT-5.4
- **Fix Items**: 2

1. 已在 [src/stages/detect-tools.ts](src/stages/detect-tools.ts) 将 `.iflow/` 提示抽成独立的非阻断 helper，并在手动 `--tools` 分支与自动检测分支共用，修复“手动指定工具模式绕过 stale notice”的问题。
2. 保持通用 `pathExists()` 的严格错误传播语义不变，仅对 `.iflow/` 提示路径引入专用降级逻辑；当 `.iflow/` 存在性检查遇到 `EACCES`/I/O 异常时，默认静默跳过提示而不阻断安装流程。这是本轮采用的保守默认决策，原因是 evaluator 已明确要求提示必须是信息性、非阻断，同时不应放宽其他工具检测路径的错误边界。
3. 已补充 [tests/stages/detect-tools.test.ts](tests/stages/detect-tools.test.ts) 的定向单测：覆盖手动 `--tools` 模式下仍输出 `.iflow/` 提示，以及 `.iflow/` 检查抛出 `EACCES` 时 `detectTools()` 继续返回检测结果。
4. 验证结果见本轮 fixer 执行日志；未修改 Story 文档、状态流转文件或其他无关实现。