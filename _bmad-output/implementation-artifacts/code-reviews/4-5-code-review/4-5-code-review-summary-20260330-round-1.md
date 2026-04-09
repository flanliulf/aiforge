---
Story: 4-5
Round: 1
Date: 2026-03-30
Model Used: GPT-5.4
Type: Code Review Summary
---

## 审查结论

本轮为 **第 1 轮代码审查**。

结论：**不通过**。本次实现已覆盖文件级冲突交互、备份覆盖、零结果诊断及基础测试，但仍存在 1 个高优先级缺陷和 1 个中优先级实现缺口，尚不建议结束 Story 4.5。

## 审查范围

- Story 文档：`_bmad-output/implementation-artifacts/4-5-conflict-handling-and-safety.md`
- 代码实现：
  - `src/stages/conflict-resolver.ts`
  - `src/stages/execute-install.ts`
  - `src/data/install-rules.ts`
  - `src/services/manifest.ts`
- 测试：
  - `tests/stages/conflict-resolver.test.ts`
  - `tests/stages/execute-install.test.ts`

## 审查发现

### 1. [高] `Directories` 安装路径完全绕过冲突处理，用户目录可被静默覆盖

- **位置**：
  - `src/stages/execute-install.ts:420-443`
  - `src/data/install-rules.ts:23-29, 53-58, 80-98`
- **问题**：
  - `files` 与 `flatten` 分支都在安装前执行 `detectConflict()` + `processConflict()`。
  - 但 `Directories` 分支只做 `determineDirStatus()` 后直接 `copyDir()`，没有任何 conflict 检测、交互确认、备份或 `--force` 分支控制。
  - 同时 `Directories` 不是边角路径，而是当前内置规则真实使用的主路径：`copilot/skills`、`claude/skills` 的全局/项目安装都走该分支。
- **影响**：
  - 当用户本地已存在 `.copilot/skills/<name>/` 或 `.claude/skills/<name>/` 的手写目录时，本 Story 宣称的“冲突保护”不会生效，目录内容会被递归复制直接覆盖/合并。
  - 这与 Story 目标“保护用户手写文件”和 Task 1“集成冲突处理（AC #1-4）”不一致。
- **建议**：
  - 为 `Directories` 分支补齐冲突语义：至少在目标目录已存在时进入冲突判定，并对 `user-file` / `unknown-origin` / `user-modified` 套用与文件一致的决策流。
  - 同步补充目录冲突的集成测试，覆盖 `backup/skip/overwrite/force/non-TTY`。

### 2. [中] 临时文件清理实现目前是空壳，无法兑现 AC #6 的“创建即清理”

- **位置**：
  - `src/stages/execute-install.ts:305-306`
  - `src/stages/execute-install.ts:460-468`
  - Story 声明：`_bmad-output/implementation-artifacts/4-5-conflict-handling-and-safety.md:38-40, 179-180`
- **问题**：
  - `executeInstall()` 虽然声明了 `tmpFiles: string[]` 并在 `finally` 中循环 `unlink()`，但本轮代码里没有任何地方向 `tmpFiles` 注册路径。
  - 也没有与 `manifest.json.tmp` 这类真实临时文件创建逻辑建立连接。
  - 现有测试仅验证 `finally` 结构存在，没有验证“发生临时文件创建后会被真正删除”。
- **影响**：
  - 当前实现不能证明 AC #6 已满足；一旦安装流程后续引入或接入 `.tmp` 文件，清理逻辑会静默失效。
  - Story/Completion Notes 已将其表述为“已跟踪和清理临时文件”，与实际代码能力不符。
- **建议**：
  - 明确临时文件的产生者，并在创建时统一注册到 cleanup list；
  - 或者将清理责任下沉到具体写入服务（例如原子写入函数内部自清理），避免 stage 层持有一个永远为空的列表；
  - 增加真实临时文件创建 + 异常/成功两条回归测试。

## 测试与验证记录

本轮已独立执行：

- `npx vitest run tests/stages/conflict-resolver.test.ts tests/stages/execute-install.test.ts`
- `npm run build`
- `npm test`
- `npm run lint`

结果：

- 定向测试通过：`58 passed`
- 全量测试通过：`519 passed`
- Build 通过
- Lint 通过

## 最终建议

建议先修复以上 2 项问题后，再进入 `CR evaluate`。其中第 1 项属于真实功能缺口，优先级最高；第 2 项属于 AC 落地不完整，建议一并补齐，避免 Story 状态与实际能力不一致。
