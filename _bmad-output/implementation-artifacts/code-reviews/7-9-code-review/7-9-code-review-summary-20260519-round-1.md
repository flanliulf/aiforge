---
Story: 7-9
Round: 1
Date: 2026-05-19
Model Used: GPT-5.5
Type: Code Review Summary
---

## 审查结论

首轮审查。按 `bmenhance-cr-01-reviewer` 执行，当前环境不可直接调度独立 Agent 工具，已按 skill 降级规则在当前上下文中串行完成 Blind Hunter、Edge Case Hunter、Acceptance Auditor 三层审查；审查输入采用 `git diff HEAD`，范围限定为 Story 7-9 File List 中的源码与测试文件。

Dev Agent Record 记录 `npm test`、`npm run lint:src`、`npm run build` 均已通过；本轮 reviewer 为遵守“只读审查源码和 Story，仅写 CR 目录”的限制，未重新执行会产生构建输出的门禁命令。审查发现 2 个需修复项，其中 1 个影响 AC #3 的边界合规，结论：需修复。

## 新发现

### 1. [中] `skills/` 目录存在但没有可扫描子目录时不会输出 Trae Skills 不支持提示

- **来源**：edge+auditor
- **分类**：patch

- **证据**
  - `src/stages/match-rules.ts:291-306` 中 `TOOL_UNSUPPORTED_NOTICES` 使用 `scanSourceFiles(... type: InstallType.Directories ...)` 判断是否通知，只有 `sourceFiles.length > 0` 才调用 `reporter.info(...)`。
  - `scanSourceFiles()` 对 `Directories` 类型只返回子目录，忽略文件；因此当知识仓库存在 `skills/` 目录但为空，或仅含占位文件（如 `.gitkeep`）时，`shouldNotify` 保持 `false`。
  - Story AC #3 的 Given 是“知识仓库包含 `skills/` 目录”，Dev Notes 也写明“当用户的知识仓库恰好有 `skills/` 目录时，主动告知为什么没安装 Trae Skills”。当前实现实际要求 `skills/` 下存在至少一个非排除子目录。

- **影响**
  - 对存在 `skills/` 目录但未形成可扫描 skill 子目录的仓库，用户执行 `aiforge install --tools trae` 时不会看到 Trae Skills 通过 UI 管理、无法通过 aiforge 安装的说明。
  - 这会造成 AC #3 的边界场景不满足，也让提示行为依赖目录内容形态而不是 AC 指定的目录存在性。

- **建议**
  - 将 unsupported notice 的触发条件改为“sourceDir 存在且为目录”，不要复用安装项扫描结果判断。
  - 补充测试：mock `skills/` 目录存在但返回空数组，仍断言 `reporter.info()` 被调用；另可覆盖 `skills/.gitkeep` 不作为安装项但仍触发说明。

### 2. [低] 新增 `Reporter.info()` 后未补齐所有既有 `Reporter` 类型 mock

- **来源**：blind
- **分类**：patch

- **证据**
  - `src/core/reporter.ts:8-18` 将 `info(message: string): void` 加入必需接口。
  - 以下既有测试中的 `Reporter` mock 仍只实现 `warn()`，未实现 `info()`：`tests/stages/authenticate.test.ts:30-38`、`tests/stages/clone.test.ts:43-51`、`tests/stages/clone.test.ts:623-631`、`tests/stages/execute-install.test.ts:1922-1930`、`tests/stages/resolve-source.test.ts:329-337`。
  - VS Code diagnostics 对这些测试文件会报结构类型不完整；虽然当前 `npm test`/`lint:src`/`build` 门禁可能不执行测试类型检查，这仍会让编辑器与未来类型检查门禁出现噪音。

- **影响**
  - 测试代码与 `Reporter` 接口契约不同步，后续若增加 `tsc --noEmit` 覆盖 tests，或在 IDE 中维护这些测试，会出现非业务性类型错误。
  - 该问题不影响 Trae 安装运行时行为，但会降低测试维护质量。

- **建议**
  - 为所有 `Reporter` mock 补 `info: vi.fn()`。
  - 或者引入统一 `makeMockReporter()` 测试 helper，减少后续 Reporter 接口扩展时的漏改面。

## 验证摘要

- `npm test` ✅ Dev Agent Record 记录通过（947 / 947）；本轮 reviewer 未重跑。
- `npm run lint:src` ✅ Dev Agent Record 记录通过；本轮 reviewer 未重跑。
- `npm run build` ✅ Dev Agent Record 记录通过；本轮 reviewer 未重跑，避免在只读审查阶段写入构建产物。
- 定向复核 ✅
  - AC #1：`TOOL_DEFINITIONS` 已包含 `trae`，检测路径为 `~/.trae` 和 `.trae`。
  - AC #2：`BUILTIN_RULES` 已新增 2 条 trae project 规则：`rules -> .trae/rules/` 与 `instructions/AGENTS.md -> ./`。
  - AC #3：不存在 `trae:skills` 安装规则，且非空 `skills/` 子目录场景有 info 级提示测试；但空目录/占位文件场景存在上述边界缺口。
  - AC #4：规则数更新为 55，代码改动范围包含 `match-rules` 与 `reporter` 的轻量扩展，未发现引擎主体重构。

## 通过项

- Trae 工具注册与全局/项目检测路径符合 AC #1。
- Trae 项目级 `rules` 与 `AGENTS.md` 安装规则符合 AC #2。
- 未添加 `trae` 的 `skills` 安装规则，安装结果计划不会包含 skills 类别。
- `reporter.info()` 被用于 Trae Skills 能力边界说明，未复用 `warn()`，符合“非 warn”要求。
- 新增测试覆盖了工具注册、规则矩阵、消息键、Trae 检测以及非空 skills 目录下的 notice 行为。

## 结论

- **结论：需修复**
- **阻塞项**：无高危阻塞；存在 1 个 AC #3 边界合规 patch 项。
- **建议**：进入 evaluator 阶段，由 evaluator 判定 Finding #1 是否必须本轮修复；Finding #2 可作为低优先级 patch 或 CR TODO。