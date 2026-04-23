# Story 7.2: Codex CLI 接入（含 MCP 降级策略）

Status: ready-for-dev

## Story

As a 使用 OpenAI Codex CLI 的开发者,
I want 通过 `aiforge install` 安装 skills/agents/instructions 配置到 Codex 的标准路径,
So that 我的 AI 配置保持最新，同时对于需要手动合并的 MCP 配置，我收到清晰的操作步骤。

## Acceptance Criteria

1. **Given** 用户环境存在 `~/.codex/` 目录（全局检测标志）或 `.codex/` 目录（项目检测标志）  
   **When** 执行 `aiforge install`（自动检测）或 `aiforge install --tools codex`  
   **Then** `codex` 出现在检测到的工具列表中  
   **And** `TOOL_DEFINITIONS` 包含 `{ id: 'codex', name: 'Codex CLI', detect: { global: ['~/.codex'], project: ['.codex'] } }`

2. **Given** 知识仓库包含 `skills/`、`agents/`、`instructions/` 目录  
   **When** 对 codex 工具执行全局安装（`-g`）  
   **Then** skills 以 Directories 类型安装到 `~/.codex/skills/`  
   **And** agents 以 Files 类型安装到 `~/.codex/agents/`  
   **And** instructions 以 Files 类型安装到 `~/.codex/`

3. **Given** 知识仓库包含 `skills/`、`agents/`、`instructions/` 目录  
   **When** 对 codex 工具执行项目级安装（默认）  
   **Then** skills 安装到 `.codex/skills/`，agents 安装到 `.codex/agents/`，instructions 安装到 `.codex/`（项目根）

4. **Given** 知识仓库包含 `mcp-tools/` 目录（含模板文件）  
   **When** 对 codex 工具执行全局安装  
   **Then** 模板文件复制到 `~/.codex/`（不修改 `config.toml` 现有内容）  
   **And** Reporter 输出手动合并提示，内容包含：目标文件路径（`~/.codex/config.toml`）、需要合并的块结构（`[mcp]` 段）  
   **And** 安装结果摘要中标注 mcp-tools 为"需手动合并"状态，而非 ✅ 直接完成

5. **Given** 执行 `npm test && npm run lint:src && npm run build`  
   **When** Story 7-2 实施完成  
   **Then** 全部通过，新增规则 +5 条（skills global/project、agents global/project、mcp-tools 降级）  
   **And** `BUILTIN_RULES` 总量为 25 条（20 + 5），零引擎代码改动（NFR-I5）

## Tasks / Subtasks

- [ ] Task 1: 注册 codex 工具定义 (AC: #1)
  - [ ] 1.1 在 `src/data/tool-registry.ts` 的 `TOOL_DEFINITIONS` 数组追加：`{ id: 'codex', name: 'Codex CLI', detect: { global: ['~/.codex'], project: ['.codex'] } }`
- [ ] Task 2: 添加 codex 安装规则 (AC: #2, #3, #4)
  - [ ] 2.1 在 `src/data/install-rules.ts` 的 `BUILTIN_RULES` 追加 5 条规则：
    - `{ tool: 'codex', scope: 'global', sourceDir: 'skills', type: Directories, targetDir: '~/.codex/skills/' }`
    - `{ tool: 'codex', scope: 'global', sourceDir: 'agents', type: Files, targetDir: '~/.codex/agents/' }`
    - `{ tool: 'codex', scope: 'global', sourceDir: 'instructions', type: Files, targetDir: '~/.codex/' }`
    - `{ tool: 'codex', scope: 'project', sourceDir: 'skills', type: Directories, targetDir: '.codex/skills/' }`
    - `{ tool: 'codex', scope: 'project', sourceDir: 'agents', type: Files, targetDir: '.codex/agents/' }`
    - `{ tool: 'codex', scope: 'project', sourceDir: 'instructions', type: Files, targetDir: '.codex/' }`
    - `{ tool: 'codex', scope: 'global', sourceDir: 'mcp-tools', type: Files, targetDir: '~/.codex/' }`（MCP 模板降级安装到工具根目录）
    - `{ tool: 'codex', scope: 'project', sourceDir: 'mcp-tools', type: Files, targetDir: '.codex/' }`
  - [ ] 2.2 校对最终新增规则数 = 8 条；若 epic AC #5 期望 +5 条与本 task 列出的 8 条不一致，**以 AC 为准**：仅保留 skills(2) + agents(2) + mcp-tools 降级(1) = 5 条，instructions 规则下放到 7-3/7-9 中按 AGENTS.md 跨工具标准重新规划。**Dev 阶段开工前需在评论中确认本条**
  - [ ] 2.3 RULE_INDEX 自动重建（IIFE）
- [ ] Task 3: 实现 MCP 降级提示（mcp-tools 安装时的 Reporter 提示）(AC: #4)
  - [ ] 3.1 在 `src/core/messages.ts` 新增 i18n 键：
    - `mcp.mergeHintTitle`：`"⚠️  以下 MCP 配置文件需手动合并到目标工具配置"` / `"⚠️  The following MCP configurations require manual merging into the target tool config"`
    - `mcp.codexMergeHint`：`"目标文件: {targetFile}\n  需合并的块: [mcp] 段\n  操作: 将模板内容追加或合并到上述文件的 [mcp] 段"` / 英文对应
  - [ ] 3.2 在 `src/data/install-rules.ts` 同文件追加导出常量 `MCP_MERGE_HINTS: Record<string, { targetFile: string; section: string }>`，键为工具 id：
    ```typescript
    export const MCP_MERGE_HINTS = {
      codex: { targetFile: '~/.codex/config.toml', section: '[mcp]' },
      // 7-5 OpenCode 在该 story 中追加 opencode 条目
    } as const
    ```
  - [ ] 3.3 在 `src/stages/execute-install.ts` 安装结果汇总阶段（**仅在所有 mcp-tools 文件均为非合并模板复制完成后**），按 `MCP_MERGE_HINTS` 输出 Reporter.warn(...) 一次性合并提示。**该改动属于 Reporter 输出层，不修改 install 管道核心逻辑**——仍属 NFR-I5 允许的"数据驱动 + 非引擎逻辑"边界
  - [ ] 3.4 InstallResult.items 中 mcp-tools 类别的 status 字段保持 `'new' | 'updated' | 'skipped'` 三态——**手动合并提示不改变文件级状态**，仅作为 Reporter 附加输出
  - [ ] 3.5 dry-run 路径同样输出该合并提示（保持 dry-run 与实际安装一致性，NFR-U5）
- [ ] Task 4: 更新工具检测耗时基线（NFR-P6 监控）
  - [ ] 4.1 检测路径数从 4 工具 × 2 路径 = 8 增至 5 工具 × 2 路径 = 10，单次检测仍远低于 NFR-P5 (500ms) 与 NFR-P6 (1000ms) 阈值，无需特殊优化
  - [ ] 4.2 不新增性能测试（统一在 7-10 收尾验证 11 工具总耗时）
- [ ] Task 5: 编写单元测试 (AC: #1-5)
  - [ ] 5.1 扩展 `tests/data/install-rules.test.ts`：
    - `BUILTIN_RULES.length === 25`（按 AC 校准；若 Task 2.2 评审采用 8 条方案，更新为 28，并由 7-10 复盘）
    - 包含 `tool: 'codex'` 的所有规则按 sourceDir + scope 双索引可查
    - mcp-tools 规则 targetDir 不含子目录（与 copilot mcp 模式一致）
  - [ ] 5.2 扩展 `tests/data/tool-registry.test.ts`（或同测试文件）：
    - `TOOL_DEFINITIONS` 包含 `id === 'codex'` 条目
    - 工具数量为 5（4 + codex）
  - [ ] 5.3 扩展 `tests/stages/detect-tools.test.ts`：
    - mock `~/.codex/` 存在 → `detectedTools` 包含 `'codex'`
    - mock `.codex/` 存在 → `detectedTools` 包含 `'codex'`
  - [ ] 5.4 扩展 `tests/stages/execute-install.test.ts`：
    - mcp-tools 安装时 Reporter.warn 被调用且消息包含 `~/.codex/config.toml` 与 `[mcp]` 文本片段
    - dry-run 时同样输出该提示
- [ ] Task 6: 质量门禁 (AC: #5)
  - [ ] 6.1 `npm test` — 全绿
  - [ ] 6.2 `npm run lint:src` — 退出码 0
  - [ ] 6.3 `npm run build` — 构建通过

## Dev Notes

### NFR-I5 零引擎改动边界 [Source: prd.md NFR-I5, epic-7.md]

本 Story 应**只改动**：
- `src/data/tool-registry.ts`（追加 ToolDefinition）
- `src/data/install-rules.ts`（追加 InstallRule + 导出 MCP_MERGE_HINTS）
- `src/core/messages.ts`（追加 i18n 键）
- `src/stages/execute-install.ts`（**仅在汇总阶段追加 MCP merge hint 输出**，不改写 install 主路径——这是 epic-7 7-2/7-5 共用的"非引擎逻辑"边界）

**严禁改动**：preflight、conflict-resolver、fs-utils、match-rules、pipeline 编排、commands。

### MCP 降级策略详细说明 [Source: prd.md FR-052]

Codex 的 MCP 配置写入 `~/.codex/config.toml` 的 `[mcp]` 块。aiforge **不引入 TOML 结构化编辑能力**，采用：
1. 将仓库 `mcp-tools/` 下的模板文件作为普通 Files 复制到 `~/.codex/`（用户可见为模板文件，不破坏既有 config.toml）
2. Reporter 在安装汇总阶段输出明确的合并指引（目标文件路径 + 块结构 + 操作步骤）
3. InstallResult 中标记为已完成的文件复制（不是 fail），但附加合并提示

**这与 copilot 的 `.github/mcp.json` 写入模式不同**：copilot 直接写入 `.github/` 是因为 `.github/mcp.json` 本身就是独立文件，不需要合并到既有结构化文件中。Codex 的 `config.toml` 是用户已存在的多块配置，不能直接覆盖。

### Reporter 集成点（execute-install.ts 内的精确插入位置）

参考 `executeInstall()` 现有结构，在 `reporter.completePhase()` **之前**、所有 plan.items 处理完毕后插入：

```typescript
// MCP 降级合并提示（Story 7-2 / 7-5）
const mcpToolsInstalled = new Set<string>(
  resultItems
    .filter(item => item.sourceDir === 'mcp-tools' && item.status !== 'failed')
    .map(item => item.tool)
)
for (const toolId of mcpToolsInstalled) {
  const hint = MCP_MERGE_HINTS[toolId]
  if (hint) {
    reporter.warn(
      msg('mcp.mergeHintTitle') + '\n' +
      msg('mcp.' + toolId + 'MergeHint')
        .replace('{targetFile}', hint.targetFile)
    )
  }
}
```

注意：`InstallResult.items[].sourceDir` 字段需确认是否已存在；若未存在，从 `item.rule.sourceDir` 推断。**Dev 阶段必须先读 `src/core/types.ts` 确认 InstallResult 结构**。

### Project Structure Notes

- 严格遵循 NFR-I5：仅 `src/data/` + `src/core/messages.ts` + `src/stages/execute-install.ts`（仅 Reporter 汇总输出）
- 测试改动镜像 src/ 结构

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-7.md#Story 7-2]
- [Source: _bmad-output/planning-artifacts/prd.md#FR-052, NFR-I5]
- [Source: src/data/install-rules.ts, src/data/tool-registry.ts]
- [Source: src/stages/execute-install.ts]
- [Source: docs/install-rules-matrix.md]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
