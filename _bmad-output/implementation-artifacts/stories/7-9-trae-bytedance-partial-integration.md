# Story 7.9: Trae (ByteDance) 部分接入（不含 Skills）

Status: ready-for-dev

## Story

As a 使用 Trae 的开发者,
I want 通过 `aiforge install` 安装 `.trae/rules/` 和 `AGENTS.md`，并清楚了解 Trae Skills 无法通过文件系统安装的原因,
So that 我能使用 aiforge 管理可安装的 Trae 配置，同时对能力边界有正确预期。

## Acceptance Criteria

1. **Given** 用户环境存在 `~/.trae/` 目录（全局）或 `.trae/` 目录（项目）  
   **When** 执行 `aiforge install`（自动检测）或 `aiforge install --tools trae`  
   **Then** `trae` 出现在检测到的工具列表中  
   **And** `TOOL_DEFINITIONS` 包含 `{ id: 'trae', name: 'Trae (ByteDance)', detect: { global: ['~/.trae'], project: ['.trae'] } }`

2. **Given** 知识仓库包含 `instructions/` 目录（含 `AGENTS.md`）  
   **When** 对 trae 执行项目级安装  
   **Then** `AGENTS.md` 以 Files 类型分发到项目根  
   **And** 若知识仓库有 rules 类资源，安装到 `.trae/rules/`

3. **Given** 知识仓库包含 `skills/` 目录  
   **When** 对 trae 执行安装（全局或项目级）  
   **Then** 系统跳过 trae 的 skills 安装（无对应规则）  
   **And** Reporter 输出说明：Trae Skills 通过 UI 驱动管理，无稳定文件路径，无法通过 aiforge 安装  
   **And** 安装结果摘要不包含 skills 类别（而非显示失败）

4. **Given** 执行 `npm test && npm run lint:src && npm run build`  
   **When** Story 7-9 实施完成  
   **Then** 全部通过，新增规则 +2 条（rules + AGENTS.md），`BUILTIN_RULES` 总量为约 55 条（与 7-8 方案 A/B/C 联动），零引擎代码改动

## Tasks / Subtasks

- [ ] Task 1: 注册 trae 工具定义 (AC: #1)
  - [ ] 1.1 在 `src/data/tool-registry.ts` 追加：`{ id: 'trae', name: 'Trae (ByteDance)', detect: { global: ['~/.trae'], project: ['.trae'] } }`
- [ ] Task 2: 添加 trae 安装规则（不含 skills）(AC: #2)
  - [ ] 2.1 在 `src/data/install-rules.ts` 追加：
    - `{ tool: 'trae', scope: 'project', sourceDir: 'rules', type: Files, targetDir: '.trae/rules/' }`
    - `{ tool: 'trae', scope: 'project', sourceDir: 'instructions', type: Files, targetDir: './', fileFilter: ['AGENTS.md'] }`
  - [ ] 2.2 共 2 条；与 epic AC #4 一致
  - [ ] 2.3 **明确不添加** trae:skills 规则（Trae Skills 通过 UI 管理）
- [ ] Task 3: 实现 Skills 不支持的提示 (AC: #3)
  - [ ] 3.1 **设计决策**：当用户对 trae 工具执行安装且知识仓库有 `skills/` 目录时，需要明确告知"Trae Skills 不支持文件安装"
  - [ ] 3.2 复用 Story 7-4 引入的 `TOOL_PRECONDITIONS` 数据结构（如已采纳）：
    ```typescript
    TOOL_PRECONDITIONS.trae = {
      check: async () => ({ ok: false, reason: 'traeSkillsUnsupported' }),
      affectedSourceDirs: ['skills']
    }
    ```
    Match 阶段会自动跳过 trae:skills 规则（即使有也跳过，本 Story 没添加规则因此本质是 no-op，但保留通知用户的功能）
  - [ ] 3.3 **替代实现**：如果 7-4 的 TOOL_PRECONDITIONS 方案未采纳，则使用更轻量的方式：
    - 在 `src/data/install-rules.ts` 新增 `TOOL_UNSUPPORTED_NOTICES: Record<string, { sourceDirs: string[]; messageKey: string }>` 数据
    - 在 `src/stages/match-rules.ts` 末尾或 Reporter 汇总阶段，遍历该结构：若工具被检测到 + 知识仓库存在对应 sourceDir → reporter.info（**非 warn**）输出能力边界说明
  - [ ] 3.4 i18n 键新增：
    - `unsupported.traeSkills`：`"ℹ️  Trae Skills 通过 UI 驱动管理，无稳定文件路径，aiforge 无法安装。请通过 Trae UI 配置 Skills"` / 英文对应
- [ ] Task 4: 编写单元测试 (AC: #1-4)
  - [ ] 4.1 扩展 `tests/data/install-rules.test.ts`：
    - `BUILTIN_RULES.length` 与 7-8 联动（方案 A/B：55；方案 C：54）
    - 包含 2 条 trae 规则
    - **断言不存在 `tool === 'trae' && sourceDir === 'skills'` 的规则**
  - [ ] 4.2 扩展 `tests/stages/detect-tools.test.ts`：mock `~/.trae/` → 检测命中
  - [ ] 4.3 扩展 `tests/stages/match-rules.test.ts`：
    - mock 知识仓库含 `skills/` → trae 工具的 MatchedPlan 不含 skills item，reporter.info 被调用且消息含 `traeSkillsUnsupported` 翻译
- [ ] Task 5: 质量门禁 (AC: #4)
  - [ ] 5.1 `npm test` — 全绿
  - [ ] 5.2 `npm run lint:src` — 退出码 0
  - [ ] 5.3 `npm run build` — 构建通过

## Dev Notes

### Trae Skills 不支持的原因 [Source: 技术调研, prd.md FR-054]

Trae 的 Skills 概念是通过其 IDE UI 进行管理的（类似浏览器扩展商店），没有可写的文件系统路径。aiforge 作为文件系统安装器，**无法**通过文件操作安装 Trae Skills。

正确处理：
- 不在 BUILTIN_RULES 中定义 trae:skills 规则（避免假装支持）
- 当用户的知识仓库恰好有 skills/ 目录时，主动告知"为什么没安装 Trae Skills"——避免用户困惑

### 与 Story 7-4 的协同

如果 Story 7-4 引入了 `TOOL_PRECONDITIONS`，本 Story 复用该机制以最小化新增代码。如果 7-4 未引入，本 Story 自行引入轻量级 `TOOL_UNSUPPORTED_NOTICES`。两套数据结构语义略有不同（precondition 检查后 ok=false 跳过，unsupportedNotices 总是输出提示），但实现都是数据驱动 + Reporter 输出层。

### 文件清单

**改动**：
- `src/data/tool-registry.ts`
- `src/data/install-rules.ts`
- `src/core/messages.ts`
- `src/stages/match-rules.ts`（如本 Story 自行引入 unsupportedNotices 输出循环）
- `tests/data/install-rules.test.ts`
- `tests/stages/detect-tools.test.ts`
- `tests/stages/match-rules.test.ts`

### Project Structure Notes

- 严格 NFR-I5：data/ 主体改动 + 复用或微扩展 stages/ 数据驱动逻辑

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-7.md#Story 7-9]
- [Source: _bmad-output/planning-artifacts/prd.md#FR-054, NFR-I5]
- [Source: _bmad-output/implementation-artifacts/stories/7-4-gemini-cli-integration.md (TOOL_PRECONDITIONS)]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
