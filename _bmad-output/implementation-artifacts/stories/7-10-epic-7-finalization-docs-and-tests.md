# Story 7.10: Epic 7 收尾（文档 + 规则矩阵 + 集成测试）

Status: done

## Story

As a 平台维护者（chunxiao）,
I want 完整的 v2.0.0 文档体系（migration guide、规则矩阵、CHANGELOG）和覆盖全部 11 工具的集成测试,
So that v2.0.0 正式发布具有充分的文档支撑和测试信心，用户可以从 v1.0 平滑迁移。

## Acceptance Criteria

1. **Given** Epic 7（Story 7-1~7-9）全部 Done  
   **When** Story 7-10 完成  
   **Then** `docs/install-rules-matrix.md` 更新为约 54 条规则，涵盖全部 11 工具  
   **And** 对应中文版 `docs/install-rules-matrix.zh.md` 同步更新  
   **And** 每工具至少包含：detect 路径、支持资源类型、安装路径、特殊约束说明

2. **Given** v2.0.0 是 Breaking Change 版本  
   **When** 查看 `CHANGELOG.md`  
   **Then** v2.0.0 条目存在且包含：Breaking Changes 段落（vscode 工具删除、归并说明）、新增工具列表（8 个）、migration 文档链接

3. **Given** 开发者从 v1.x 升级到 v2.0.0  
   **When** 查看 migration guide（`docs/migration-v2.md` + `.zh.md`）  
   **Then** 文档包含：版本差异对照表、`vscode` → `copilot` 归并操作步骤、升级命令、常见问题

4. **Given** 测试套件  
   **When** 执行 `npm test`  
   **Then** 存在覆盖全部 11 工具的集成测试（全局 + 项目级各至少 1 个场景）  
   **And** 11 工具检测阶段总耗时 < 1000ms（NFR-P6 性能测试通过）

5. **Given** 执行最终质量门禁  
   **When** `npm test && npm run lint:src && npm run build`  
   **Then** 全部通过，Epic 7 零引擎代码改动验证（代码审查确认 `src/stages/` 和 `src/commands/` 仅有 7-1/7-3/7-4/7-6 评审通过的有限扩展，其余仅 `src/data/` + `src/core/messages.ts` 有变更，NFR-I5）

6. **Given** 检测到残留 `.iflow/` 目录的用户环境  
   **When** 执行 `aiforge install`  
   **Then** 系统输出无操作提示：iFlow CLI 已停服（2026-04-17），aiforge 不支持该工具  
   **And** 不安装任何文件到 `.iflow/` 相关路径

## Tasks / Subtasks

- [x] Task 1: 完整规则矩阵文档更新 (AC: #1)
  - [x] 1.1 更新 `docs/install-rules-matrix.md`：覆盖全部 11 工具（copilot · claude · cursor · codex · auggie · gemini · opencode · windsurf · kiro · antigravity · trae）
  - [x] 1.2 每工具一节，结构：
    - 标题（工具名）
    - Detect 路径（global + project）
    - 安装规则表（Scope / Source Dir / Install Type / Target Dir / Description）
    - 特殊约束（如 Gemini 版本要求、Windsurf 语义差异、Trae UI 限制、Antigravity 子目录隔离）
  - [x] 1.3 同步更新 `docs/install-rules-matrix.zh.md`（中英对照保持结构一致）
  - [x] 1.4 顶部 Overview 章节更新统计：约 54 条规则、11 工具、4 资源类型 / 3 安装类型 / 2 scope
  - [x] 1.5 校对 `BUILTIN_RULES` 实际总数与文档断言一致（运行 `npm test` 后取断言值）
- [x] Task 2: CHANGELOG v2.0.0 完整化 (AC: #2)
  - [x] 2.1 整合 7-1 创建的 v2.0.0 章节，补充：
    - **Breaking Changes**：vscode 工具 ID 删除（已含）、tools 列表变更（4 → 11）
    - **Added**：8 个新工具（codex / auggie / gemini / opencode / windsurf / kiro / antigravity / trae）的接入说明
    - **Added**：MCP 降级策略（codex / opencode）、fileFilter 字段（如采纳）、TOOL_PRECONDITIONS（如采纳）、semanticWarning（如采纳）
    - **Added**：iFlow stale-tool 提示
    - **Added**：CLAUDE.md + AGENTS.md 共存分发（FR-058）
    - **Migration**：链接到 `docs/migration-v2.md`
- [x] Task 3: Migration Guide 完整化 (AC: #3)
  - [x] 3.1 在 7-1 创建的 `docs/migration-v2.md` + `.zh.md` 基础上扩充：
    - 版本差异对照表（v1.x vs v2.0：工具数 / 规则数 / 新增能力）
    - 完整新工具清单 + 简要使用指引
    - vscode → copilot 归并步骤
    - Gemini CLI 版本要求说明（v0.26.0+）
    - Windsurf agents→workflows 语义说明
    - Trae Skills 不支持说明
    - iFlow 已停服说明
    - 升级命令、回滚命令、FAQ（≥5 条）
- [x] Task 4: 11 工具集成测试 (AC: #4)
  - [x] 4.1 在 `tests/integration/` 新建 `epic-7-eleven-tools.test.ts`：
    - 为每个工具创建 mock 知识仓库 + mock 检测路径，验证：
      - 自动检测命中
      - `--tools <id>` 手动指定命中
      - 全局安装路径正确
      - 项目级安装路径正确
    - 至少 11 × 2 = 22 个场景
  - [x] 4.2 NFR-P6 性能测试：
    - 在同一测试文件新增 `it('11 tools detection completes < 1000ms')`：
      - 创建 11 工具的 mock 路径全部存在
      - 调用 `detectTools()`，使用 `performance.now()` 测量耗时
      - 断言 `elapsed < 1000`
- [x] Task 5: iFlow stale-tool 提示 (AC: #6)
  - [x] 5.1 在 `src/stages/detect-tools.ts` 中追加（或在 `src/data/install-rules.ts` 中数据化后由 detect-tools 读取）：
    - 检查 `~/.iflow/` 或 `.iflow/` 是否存在
    - 若存在，调用 `reporter.info(msg('detectTools.iflowStale'))` 输出："ℹ️  检测到 .iflow/ 残留目录。iFlow CLI 已于 2026-04-17 停服，aiforge 不再支持。可安全删除该目录"
  - [x] 5.2 i18n 键新增：`detectTools.iflowStale`（双语）
  - [x] 5.3 不阻断安装流程，仅信息性提示
  - [x] 5.4 测试：mock `~/.iflow/` 存在 → reporter.info 被调用且消息含 `iflowStale` 翻译
- [x] Task 6: Epic 7 NFR-I5 零改动验证 (AC: #5)
  - [x] 6.1 执行 `git log --since="<Epic 7 起始日期>" --name-only -- src/stages/ src/commands/ src/services/ src/core/` 收集全部改动文件
  - [x] 6.2 编写 `_bmad-output/implementation-artifacts/retrospectives/epic-7-nfr-i5-audit.md`：
    - 列出所有非 data/ 改动
    - 对每条改动注明 Story 编号 + 评审通过的边界扩展类型（fileFilter / TOOL_PRECONDITIONS / semanticWarning / vscodeMergedNote / mcp merge hint output）
    - 确认无未授权的引擎核心逻辑改动（preflight / fs-utils / pipeline 编排 / conflict-resolver）
- [x] Task 7: README 与项目主文档同步 (AC: #1, #2, #3)
  - [x] 7.1 `README.md` + `README.zh.md` 工具支持章节列出 11 工具 + 简要表格
  - [x] 7.2 链接到新的 install-rules-matrix.md 与 migration-v2.md
  - [x] 7.3 顶部添加 v2.0 标识与 migration 链接
- [x] Task 8: 质量门禁 (AC: #5)
  - [x] 8.1 `npm test` — 全绿（含新增 11 工具集成测试 + NFR-P6 性能测试）
  - [x] 8.2 `npm run lint:src` — 退出码 0
  - [x] 8.3 `npm run build` — 构建通过
  - [x] 8.4 包大小回归检查：`du -sh dist/`（当前 `dist/` = 172K）

## Dev Notes

### Epic 7 收尾的核心目标

本 Story 不引入新工具或新功能，专注于：

1. **文档完整性**：让用户和开发者能找到所有信息
2. **测试覆盖**：用集成测试为 11 工具建立回归保护网
3. **NFR 验证**：用审计文档证明 NFR-I5（零引擎改动）与 NFR-P6（< 1000ms 检测）达标
4. **Migration 体验**：让 v1.x 用户平滑升级

### 11 工具集成测试设计要点

集成测试**必须使用真实 stages**（避免过度 mock）：

- mock 文件系统层（fs/promises）—— 控制 detect 路径与知识仓库结构
- 真实 `detectTools()` + `matchRules()` + `executeInstall()`（dry-run 模式）
- 验证 MatchedPlan 与 InstallResult 的结构正确性

参考 `tests/integration/` 现有 e2e 测试模式（Story 5-5b 引入）。

### NFR-P6 性能测试实现

```typescript
it('11 tools detection completes < 1000ms', async () => {
  // setup: mock 11 检测路径全部存在
  const start = performance.now()
  const env = await detectTools(/* ... */)
  const elapsed = performance.now() - start
  expect(env.tools).toHaveLength(11)
  expect(elapsed).toBeLessThan(1000)
})
```

### Epic 7 数据驱动扩展审计清单

Story 7-1 ~ 7-9 在 NFR-I5 边界外引入的合理扩展：

- 7-1：`vscodeMergedNote` 检测 + warn，文件 `detect-tools.ts`，评审状态见 7-1。
- 7-2 / 7-5：MCP merge hint 汇总输出，文件 `execute-install.ts`，评审状态见 7-2。
- 7-3 / 7-5 / 7-7 / 7-9：`fileFilter` 字段 + 过滤逻辑，文件 `match-rules.ts`，评审状态见 7-3。
- 7-4：`TOOL_PRECONDITIONS` + `version-check.ts`，文件 `match-rules.ts`、`services/version-check.ts`，评审状态见 7-4。
- 7-6：`semanticWarning` 字段 + 交互处理，文件 `match-rules.ts` 或 `semantic-warnings.ts`，评审状态见 7-6。
- 7-9：`TOOL_UNSUPPORTED_NOTICES`（如 7-4 未实现 PRECONDITIONS），文件 `match-rules.ts`，评审状态见 7-9。

每项扩展均要求**数据驱动**：新工具的引入只增数据条目，不改业务逻辑。

### 文件清单

**新建**：

- `tests/integration/epic-7-eleven-tools.test.ts`
- `_bmad-output/implementation-artifacts/retrospectives/epic-7-nfr-i5-audit.md`

**改动**：

- `docs/install-rules-matrix.md` + `.zh.md`（完整重写 11 工具）
- `docs/migration-v2.md` + `.zh.md`（在 7-1 基础上扩充）
- `CHANGELOG.md`（在 7-1 v2.0.0 章节扩充完整变更）
- `README.md` + `README.zh.md`（工具列表更新）
- `src/stages/detect-tools.ts`（iFlow stale-tool 提示）
- `src/core/messages.ts`（iflowStale 键）
- `tests/stages/detect-tools.test.ts`（iFlow 用例）

### Project Structure Notes

- 文档与测试为主，Epic 7 收尾应承担质量门禁的最后一公里
- iFlow stale-tool 提示是 detect-tools.ts 的最后一项扩展（与 7-1 vscodeMergedNote 同性质：信息性提示，不阻断流程）

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-7.md#Story 7-10]
- [Source: _bmad-output/planning-artifacts/prd.md#FR-051, FR-058, NFR-P6, NFR-I5, NFR-C7]
- [Source: docs/install-rules-matrix.md (基线)]
- [Source: tests/integration/ (Story 5-5b 集成测试模式)]
- [Source: _bmad-output/implementation-artifacts/stories/7-1-vscode-merge-and-mvp-rules-completion.md (CHANGELOG/migration 起点)]

## Dev Agent Record

### Agent Model Used

GPT-5.4

### Debug Log References

- /Users/fancyliu/Library/Application Support/Code/User/workspaceStorage/134639880f9d38d29ef1a173da6afa87/GitHub.copilot-chat/debug-logs/abd8f1c4-c657-40bf-b553-8be2c0bf549d

### Completion Notes List

- 完成 v2.0 文档收尾：`install-rules-matrix`、`migration-v2`、`README`、`README.zh`、`CHANGELOG` 已同步到 11 工具 / 55 条内置工具规则 + 4 条通用规则的实际基线。
- 为 `detectTools()` 新增 `.iflow/` 残留目录信息提示，保持非阻断语义，并补齐中英文消息键与单元测试。
- 新增 `tests/integration/epic-7-eleven-tools.test.ts`，覆盖 11 工具全局 + 项目级 22 个场景，以及 `detectTools()` 性能断言 `< 1000ms`。
- 新增 Epic 7 NFR-I5 审计文档，确认 `src/commands/` 未改动，核心引擎面未出现未授权扩张；当前 Story 7-10 的核心代码变更仅为 `detect-tools.ts` + `messages.ts`。
- 完整质量门禁通过：`npm test`（974 tests passed）、`npm run lint:src`、`npm run build`、`du -sh dist/`（172K）。

### File List

- docs/install-rules-matrix.md
- docs/install-rules-matrix.zh.md
- docs/migration-v2.md
- docs/migration-v2.zh.md
- CHANGELOG.md
- README.md
- README.zh.md
- src/stages/detect-tools.ts
- src/core/messages.ts
- tests/stages/detect-tools.test.ts
- tests/integration/epic-7-eleven-tools.test.ts
- _bmad-output/implementation-artifacts/retrospectives/epic-7-nfr-i5-audit.md

## Change Log

- 2026-05-19: 将 Story 状态切换到 in-progress，并同步 sprint-status。
- 2026-05-19: 重写 11 工具规则矩阵、迁移指南、README/CHANGELOG 文档集合，完成 v2.0 文档收尾。
- 2026-05-19: 新增 iFlow stale-tool 提示、11 工具集成测试、Epic 7 NFR-I5 审计，并通过最终质量门禁后将 Story 状态更新为 review。
