# Story 7.5: OpenCode 接入（XDG 路径规范化）

Status: ready-for-dev

## Story

As a 使用 OpenCode 的开发者,
I want 通过 `aiforge install` 安装 skills/agents/instructions/mcp-tools 四类配置到符合 XDG 标准的路径,
So that 我的配置安装位置正确（非旧式 `~/.opencode/`），MCP 配置有清晰的手动合并指引。

## Acceptance Criteria

1. **Given** 用户环境存在 `~/.config/opencode/` 目录（全局，XDG 路径）或 `.opencode/` 目录（项目）  
   **When** 执行 `aiforge install`（自动检测）或 `aiforge install --tools opencode`  
   **Then** `opencode` 出现在检测到的工具列表中  
   **And** `TOOL_DEFINITIONS` 包含 detect.global 为 `['~/.config/opencode']`（而非 `~/.opencode/`，XDG 规范）

2. **Given** 知识仓库包含 `skills/`、`agents/`、`instructions/` 目录  
   **When** 对 opencode 执行全局安装（`-g`）  
   **Then** skills 安装到 `~/.config/opencode/skills/`，agents 安装到 `~/.config/opencode/agents/`  
   **And** instructions（如 `AGENTS.md`）安装到 `~/.config/opencode/`

3. **Given** 知识仓库包含 `mcp-tools/` 目录  
   **When** 对 opencode 执行全局安装  
   **Then** 降级策略生效：模板文件复制到 `~/.config/opencode/`，不修改现有 `opencode.json`  
   **And** Reporter 输出手动合并提示，指明 `"mcp"` 块结构和 `opencode.json` 路径

4. **Given** 用户执行项目级安装（默认模式）  
   **When** `aiforge install`  
   **Then** skills 安装到 `.opencode/skills/`，agents 安装到 `.opencode/agents/`

5. **Given** 执行 `npm test && npm run lint:src && npm run build`  
   **When** Story 7-5 实施完成  
   **Then** 全部通过，新增规则 +7 条，`BUILTIN_RULES` 总量为 41 条，零引擎代码改动

## Tasks / Subtasks

- [ ] Task 1: 注册 opencode 工具定义（XDG 路径）(AC: #1)
  - [ ] 1.1 在 `src/data/tool-registry.ts` 追加：
    ```
    { id: 'opencode', name: 'OpenCode', detect: { global: ['~/.config/opencode'], project: ['.opencode'] } }
    ```
  - [ ] 1.2 **路径规范说明**：detect.global 必须是 `~/.config/opencode`（XDG Base Directory 规范），**不是** `~/.opencode/`。这是 Epic 7 技术调研的明确修正
- [ ] Task 2: 添加 opencode 安装规则 (AC: #2, #3, #4)
  - [ ] 2.1 在 `src/data/install-rules.ts` 追加：
    - `{ tool: 'opencode', scope: 'global', sourceDir: 'skills', type: Directories, targetDir: '~/.config/opencode/skills/' }`
    - `{ tool: 'opencode', scope: 'global', sourceDir: 'agents', type: Files, targetDir: '~/.config/opencode/agents/' }`
    - `{ tool: 'opencode', scope: 'global', sourceDir: 'instructions', type: Files, targetDir: '~/.config/opencode/', fileFilter: ['AGENTS.md'] }`
    - `{ tool: 'opencode', scope: 'global', sourceDir: 'mcp-tools', type: Files, targetDir: '~/.config/opencode/' }`
    - `{ tool: 'opencode', scope: 'project', sourceDir: 'skills', type: Directories, targetDir: '.opencode/skills/' }`
    - `{ tool: 'opencode', scope: 'project', sourceDir: 'agents', type: Files, targetDir: '.opencode/agents/' }`
    - `{ tool: 'opencode', scope: 'project', sourceDir: 'mcp-tools', type: Files, targetDir: '.opencode/' }`
  - [ ] 2.2 共 7 条；与 epic AC #5 一致
- [ ] Task 3: 扩展 MCP 降级提示注册表（与 7-2 联动）(AC: #3)
  - [ ] 3.1 在 `src/data/install-rules.ts` 的 `MCP_MERGE_HINTS` 追加：
    ```typescript
    opencode: { targetFile: '~/.config/opencode/opencode.json', section: '"mcp"' }
    ```
  - [ ] 3.2 在 `src/core/messages.ts` 追加 `mcp.opencodeMergeHint` 键（中英双语）：`"目标文件: {targetFile}\n  需合并的块: \"mcp\" 字段（JSON 对象）\n  操作: 将模板内容合并到上述 JSON 文件的 \"mcp\" 字段下"` / 英文对应
  - [ ] 3.3 复用 7-2 在 `execute-install.ts` 安装结果汇总阶段实现的 MCP_MERGE_HINTS 输出循环，无需新增逻辑
- [ ] Task 4: PathResolver XDG 路径解析支持（如需）
  - [ ] 4.1 检查 `src/core/path-resolver.ts` 现有实现：targetDir 中的 `~/` 前缀替换为 `pathResolver.home()`，`~/.config/opencode/` 会自然解析为 `${HOME}/.config/opencode/`，**无需扩展 PathResolver**
  - [ ] 4.2 detect-tools.ts 现有 `detectSingleTool()` 同样支持 `~/.config/opencode` 路径（已通过 `replace(/^~[/\\]?/, '')` 去掉 `~/` 前缀，剩余路径 `/.config/opencode` 经 join 还原）—— **本步无代码改动，仅核对断言**
- [ ] Task 5: 编写单元测试 (AC: #1-5)
  - [ ] 5.1 扩展 `tests/data/install-rules.test.ts`：`BUILTIN_RULES.length === 41`，包含 7 条 opencode 规则
  - [ ] 5.2 扩展 `tests/stages/detect-tools.test.ts`：mock `~/.config/opencode/` → 检测命中；mock `~/.opencode/` → **不检测**（XDG 规范）
  - [ ] 5.3 扩展 `tests/stages/execute-install.test.ts`：opencode mcp-tools 安装时 Reporter.warn 包含 `~/.config/opencode/opencode.json` 与 `"mcp"` 文本片段
  - [ ] 5.4 扩展 `tests/data/install-rules.test.ts`：MCP_MERGE_HINTS 包含 `opencode` 键
- [ ] Task 6: 质量门禁 (AC: #5)
  - [ ] 6.1 `npm test` — 全绿
  - [ ] 6.2 `npm run lint:src` — 退出码 0
  - [ ] 6.3 `npm run build` — 构建通过

## Dev Notes

### XDG Base Directory 规范关键点 [Source: 技术调研]

OpenCode 的官方推荐路径是 `~/.config/opencode/`（XDG Base Directory），**不是**早期文档常见的 `~/.opencode/`。aiforge 直接使用 XDG 路径，避免在两种路径间做兼容判断（保持简单）。

如果用户环境只有 `~/.opencode/` 而没有 `~/.config/opencode/`，aiforge 不会检测到 opencode 工具——这是预期行为，符合"严格遵守工具官方规范"的设计原则。

### MCP 降级与 7-2 复用

OpenCode 与 Codex 都需要 MCP 降级策略，复用 Story 7-2 引入的 `MCP_MERGE_HINTS` 数据结构 + `execute-install.ts` 汇总输出循环。本 Story 只需追加数据条目和 i18n 键。

**前置依赖**：Story 7-2 必须先完成（确保 MCP_MERGE_HINTS 与汇总输出代码已存在）。Story 7-2 是本 Story 的硬性 prerequisite。

### 文件清单

**改动**：
- `src/data/tool-registry.ts`（追加 opencode）
- `src/data/install-rules.ts`（追加 7 条规则 + MCP_MERGE_HINTS.opencode）
- `src/core/messages.ts`（追加 mcp.opencodeMergeHint）
- `tests/data/install-rules.test.ts`
- `tests/stages/detect-tools.test.ts`
- `tests/stages/execute-install.test.ts`

### Project Structure Notes

- 严格符合 NFR-I5：仅 data/ + core/messages.ts，无 stages/services 改动（复用 7-2 已建立的 MCP 输出循环）

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-7.md#Story 7-5]
- [Source: _bmad-output/planning-artifacts/prd.md#FR-052, NFR-I5]
- [Source: _bmad-output/implementation-artifacts/stories/7-2-codex-cli-integration.md (prerequisite)]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
