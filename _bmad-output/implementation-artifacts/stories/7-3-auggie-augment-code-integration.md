# Story 7.3: Auggie (Augment Code) 接入

Status: done

## Story

As a 使用 Augment Code 的开发者,
I want 通过 `aiforge install` 安装 skills/agents/instructions 配置到 Auggie 的标准路径,
So that 我的 AI 配置保持同步，instructions 符合 AGENTS.md 跨工具标准。

## Acceptance Criteria

1. **Given** 用户环境存在 `~/.augment/` 目录（全局）或 `.augment/` 目录（项目）  
   **When** 执行 `aiforge install`（自动检测）或 `aiforge install --tools auggie`  
   **Then** `auggie` 出现在检测到的工具列表中  
   **And** `TOOL_DEFINITIONS` 包含 `{ id: 'auggie', name: 'Auggie (Augment Code)', detect: { global: ['~/.augment'], project: ['.augment'] } }`

2. **Given** 知识仓库包含 `skills/` 目录  
   **When** 对 auggie 执行全局安装  
   **Then** skills 以 Directories 类型安装到 `~/.augment/skills/`

3. **Given** 知识仓库包含 `skills/` 和 `agents/` 目录  
   **When** 对 auggie 执行项目级安装  
   **Then** skills 安装到 `.augment/skills/`，agents 安装到 `.augment/agents/`

4. **Given** 知识仓库 `instructions/` 目录包含 `AGENTS.md`  
   **When** 对 auggie 执行项目级安装  
   **Then** `AGENTS.md` 分发到项目根目录（AGENTS.md 跨工具标准，FR-057）  
   **And** 若同目录也存在 `CLAUDE.md`，不影响 AGENTS.md 的分发（CLAUDE.md + AGENTS.md 共存，FR-058）

5. **Given** 执行 `npm test && npm run lint:src && npm run build`  
   **When** Story 7-3 实施完成  
  **Then** 全部通过，新增规则 +5 条，`BUILTIN_RULES` 总量为 29 条（24 + 5），零引擎代码改动

## Tasks / Subtasks

- [x] Task 1: 注册 auggie 工具定义 (AC: #1)
  - [x] 1.1 在 `src/data/tool-registry.ts` 追加：`{ id: 'auggie', name: 'Auggie (Augment Code)', detect: { global: ['~/.augment'], project: ['.augment'] } }`
- [x] Task 2: 添加 auggie 安装规则 (AC: #2, #3, #4)
  - [x] 2.1 在 `src/data/install-rules.ts` 追加规则：
    - `{ tool: 'auggie', scope: 'global', sourceDir: 'skills', type: Directories, targetDir: '~/.augment/skills/' }`
    - `{ tool: 'auggie', scope: 'global', sourceDir: 'agents', type: Files, targetDir: '~/.augment/agents/' }`
    - `{ tool: 'auggie', scope: 'project', sourceDir: 'skills', type: Directories, targetDir: '.augment/skills/' }`
    - `{ tool: 'auggie', scope: 'project', sourceDir: 'agents', type: Files, targetDir: '.augment/agents/' }`
    - `{ tool: 'auggie', scope: 'project', sourceDir: 'instructions', type: Files, targetDir: './' }`（项目根，AGENTS.md 跨工具标准）
  - [x] 2.2 共 5 条；与 epic AC #5 一致
- [x] Task 3: 实现 instructions 文件名过滤（AGENTS.md 跨工具标准）(AC: #4)
  - [x] 3.1 **设计决策**：FR-058 要求 instructions 目录可同时存在 `CLAUDE.md` 与 `AGENTS.md`，按目标工具的约定分发（Claude 分发 `CLAUDE.md`，其他工具分发 `AGENTS.md`）
  - [x] 3.2 现有 `Files` 类型的 `scanSourceFiles()` 会扫描 instructions 下所有文件并复制——会导致 auggie 既收到 `AGENTS.md` 又收到 `CLAUDE.md`
  - [x] 3.3 解决方案（**优先方案 A**）：扩展 `InstallRule` 类型新增可选 `fileFilter?: string[]` 字段（白名单）；在 `scanSourceFiles()` 末尾追加白名单过滤；auggie instructions 规则设置 `fileFilter: ['AGENTS.md']`，claude instructions 规则（Story 7-1 添加的）设置 `fileFilter: ['CLAUDE.md']`
  - [x] 3.4 **重要**：方案 A 涉及 `src/core/types.ts` 的 `InstallRule` 接口扩展 + `src/stages/match-rules.ts` 的 scanSourceFiles 逻辑扩展。这突破了 Epic 7 NFR-I5 "零引擎改动"边界。**Dev 阶段开工前必须发起对该方案的评审**：
    - 方案 A：扩展 InstallRule 字段（涉及 stages 改动）
    - 方案 B：在 instructions 源目录约定文件命名（如 `agents.md` vs `claude.md`），通过文件名扩展机制按工具映射——但这需要新增"模板替换"或"重命名"语义，比方案 A 更激进
    - 方案 C（最保守）：暂不实现 fileFilter，instructions 目录由用户自行管理只放一个文件（短期内 auggie 等工具收到 CLAUDE.md 并存——不违反功能但不符合 FR-058）；将 FR-058 完整实现移到 7-10 收尾或独立 follow-up
  - [x] 3.5 **当前 story 默认采用方案 A**，并将 fileFilter 字段加入 7-1 Story 7-3 7-7 7-9 的 instructions 规则。Dev 评审若决定改方案 C，则将 instructions 规则全部移除并在 7-10 重新设计
- [x] Task 4: 编写单元测试 (AC: #1-5)
  - [x] 4.1 扩展 `tests/data/install-rules.test.ts`：
    - `BUILTIN_RULES.length === 29`（当前已批准基线 24 + Auggie 5；前提：Task 3.4 选择方案 A）
    - 包含 5 条 `tool === 'auggie'` 规则
    - auggie instructions 规则的 `fileFilter` 字段为 `['AGENTS.md']`（如方案 A 采纳）
  - [x] 4.2 扩展 `tests/stages/detect-tools.test.ts`：mock `~/.augment/` → 检测命中
  - [x] 4.3 若方案 A 采纳：扩展 `tests/stages/match-rules.test.ts`：
    - mock 仓库 instructions/ 同时含 AGENTS.md + CLAUDE.md
    - auggie 项目安装计划只包含 AGENTS.md，不含 CLAUDE.md
    - claude 安装计划只包含 CLAUDE.md，不含 AGENTS.md
- [x] Task 5: 质量门禁 (AC: #5)
  - [x] 5.1 `npm test` — 全绿
  - [x] 5.2 `npm run lint:src` — 退出码 0
  - [x] 5.3 `npm run build` — 构建通过

## Dev Notes

### 关键设计决策：fileFilter 字段（FR-058 跨工具 instructions 文件名分发）

这是 Epic 7 中**最微妙**的架构问题。Auggie / Codex / OpenCode / Kiro / Trae 等多个工具都需要从同一个 `instructions/` 源目录中只取 `AGENTS.md`，而 Claude Code 只取 `CLAUDE.md`。

**Dev 阶段开工前必须在 PR 描述或 story 评论中明确选择方案 A/B/C**，并征得 PM 同意。建议优先评估方案 A，因为：
- 影响最小化：`InstallRule` 字段扩展是数据驱动的自然延伸（NFR-I5 精神是"不改 stages 业务逻辑"，而非"绝对不改 stages 一行代码"）
- 测试可控：scanSourceFiles 末尾加 4 行 filter 即可
- 后续可复用：mcp-tools 也可能需要类似按工具差异化分发

如果方案 A 被否决，则 Story 7-3 / 7-5 / 7-7 / 7-9 中所有 `instructions` 规则全部撤回，FR-058 在 Story 7-10 收尾或独立技术债 story 中重新设计。

### 已有模式参考

- ✅ `Files` 类型 sourceFiles 扫描参考 `src/stages/match-rules.ts` 的 `scanSourceFiles()`
- ✅ DEFAULT_EXCLUDES 过滤模式参考 `src/data/excludes.ts`，fileFilter 是其反向（白名单 vs 黑名单）

### 文件清单

**改动**：
- `src/data/tool-registry.ts`（追加 auggie 条目）
- `src/data/install-rules.ts`（追加 5 条 auggie 规则 + 可能给 claude 7-1 instructions 规则补 fileFilter）
- `src/core/types.ts`（如方案 A：扩展 InstallRule.fileFilter 字段）
- `src/stages/match-rules.ts`（如方案 A：scanSourceFiles 末尾加 fileFilter 过滤；约 4 行）
- `tests/data/install-rules.test.ts`（断言扩展）
- `tests/stages/detect-tools.test.ts`（auggie 检测用例）
- `tests/stages/match-rules.test.ts`（如方案 A：fileFilter 行为验证）

### Project Structure Notes

- 与统一项目结构一致：data/ 主体改动 + 一个 stages/ 微改动（受方案 A 评审约束）

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-7.md#Story 7-3]
- [Source: _bmad-output/planning-artifacts/prd.md#FR-057, FR-058, NFR-I5]
- [Source: src/data/install-rules.ts, src/stages/match-rules.ts]

## Dev Agent Record

### Agent Model Used

GPT-5.4

### Debug Log References

- 2026-05-18: `npm test -- tests/data/tool-registry.test.ts tests/data/install-rules.test.ts tests/stages/detect-tools.test.ts tests/stages/match-rules.test.ts` → 121/121 passed
- 2026-05-18: `npm test` → 877/877 passed
- 2026-05-18: `npm test && npm run lint:src && npm run build` → 877/877 tests passed; lint:src passed; build passed

### Completion Notes List

- 注册 Auggie 工具定义，检测标志为 `~/.augment` 与 `.augment`。
- 在 `src/data/install-rules.ts` 新增 5 条 auggie 规则：全局 skills/agents、项目 skills/agents/instructions。
- 采用 Story 预设方案 A：为 `InstallRule` 增加可选 `fileFilter`，并在 `scanSourceFiles()` 末尾执行白名单过滤。
- 已同步现有 instructions 规则：copilot instructions 仅分发 `AGENTS.md`，claude instructions 仅分发 `CLAUDE.md`，auggie instructions 仅分发 `AGENTS.md`。
- 零匹配恢复候选列表同步复用 `scanSourceFiles()`，避免恢复路径泄漏未被 `fileFilter` 允许的文件名。
- 为集成测试样本仓库补充 `instructions/AGENTS.md`，验证 `AGENTS.md + CLAUDE.md` 共存场景。
- 已完成用户要求的质量门禁：`npm test`、`npm run lint:src`、`npm run build` 全部通过。
- CR round 1 已裁决规则总量口径：当前仓库已批准基线来自 Story 7-2 的 +5/24 裁决；本 Story 按明确范围新增 5 条 auggie 规则，实际总量为 29，未额外添加超范围规则迎合旧数字。

### File List

- src/core/types.ts
- src/data/tool-registry.ts
- src/data/install-rules.ts
- src/stages/match-rules.ts
- tests/data/tool-registry.test.ts
- tests/data/install-rules.test.ts
- tests/stages/detect-tools.test.ts
- tests/stages/match-rules.test.ts
- tests/integration/pipeline.test.ts
- tests/fixtures/sample-repo/instructions/AGENTS.md
- _bmad-output/implementation-artifacts/stories/7-3-auggie-augment-code-integration.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-05-18: 完成 Auggie 工具检测与安装规则接入，落地 instructions `fileFilter` 白名单分发，补齐单元/集成测试并通过质量门禁；Story 状态更新为 review。
