# Story 7.1: VS Code 归并 + MVP 三工具规则补齐（Breaking Change）

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 平台维护者（chunxiao），
I want 将 VS Code 从独立 AI 工具注册表中归并、补齐 copilot/claude/cursor 的缺失规则、并输出清晰的 migration 指引,
So that v2.0.0 版本无破坏性地覆盖 MVP 已安装配置，已有用户收到明确提示，Breaking Change 有完整文档依据。

## Acceptance Criteria

1. **Given** `src/data/tool-registry.ts` 当前包含 `vscode` ToolDefinition  
   **When** Story 7-1 实施完成  
   **Then** `TOOL_DEFINITIONS` 中不再包含 `id: 'vscode'` 的条目  
   **And** `BUILTIN_RULES` 中原 vscode 规则（`.vscode/mcp.json` 项目级 MCP）被迁移并绑定到 `copilot` 工具

2. **Given** MVP 阶段 copilot/claude/cursor 的规则存在缺失（claude 缺 instructions 双路径、cursor 缺全局 agents 路径、copilot 缺 `.vscode/mcp.json` 项目级 MCP）  
   **When** 用户执行 `aiforge install`  
   **Then** 新增规则生效：claude instructions 支持全局 `~/.claude/` 和项目根双路径；cursor agents 支持 `~/.cursor/rules/` 全局；copilot 新增 `.vscode/mcp.json` 项目级 MCP 规则  
   **And** `BUILTIN_RULES` 总量从 16 条变为 20 条（+5/-1）

3. **Given** 已安装 MVP v1.x 的用户，其环境存在 `~/.vscode/` 目录但无 `~/.copilot/` 目录  
   **When** 用户执行 `aiforge install`（工具检测阶段）  
   **Then** Reporter 输出 ⚠️ 级别提示，说明 VS Code 已归并到 Copilot 语境  
   **And** 不执行任何对 `~/.vscode/` 现有文件的覆盖或删除操作（NFR-C7）  
   **And** 提示内容包含：如何安装 GitHub Copilot 扩展以继续使用 aiforge MCP 管理

4. **Given** 开发者查看 `CHANGELOG.md`  
   **When** 参考 v2.0.0 变更记录  
   **Then** Breaking Change 条目明确记录：`vscode` 工具 ID 删除、归并路径、migration 步骤索引  
   **And** `docs/migration-v2.md` 存在且包含：旧 `vscode` 规则清单、新 Copilot 承接说明、用户操作步骤（中英双语 `.md` + `.zh.md`）

5. **Given** `package.json` 当前 version 为 `1.x.x`  
   **When** Story 7-1 实施完成  
   **Then** `package.json` version 字段更新为 `2.0.0`

6. **Given** 执行 `npm test && npm run lint:src && npm run build`  
   **When** Story 7-1 实施完成  
   **Then** 全部通过，无回归

## Tasks / Subtasks

- [ ] Task 1: 删除 vscode 工具定义并补齐 copilot 规则 (AC: #1, #2)
  - [ ] 1.1 在 `src/data/tool-registry.ts` 中删除 `id: 'vscode'` 的 ToolDefinition 条目
  - [ ] 1.2 在 `src/data/install-rules.ts` 中删除 `tool: 'vscode'` 的全局 mcp-tools 规则
  - [ ] 1.3 新增 `copilot` 项目级规则：`{ tool: 'copilot', scope: 'project', sourceDir: 'mcp-tools', type: Files, targetDir: '.vscode/' }` —— 承接原 vscode 项目级 MCP 配置语义
  - [ ] 1.4 验证 `RULE_INDEX` 自动重建（IIFE 自执行），无需手动改动
- [ ] Task 2: 补齐 claude instructions 双路径规则 (AC: #2)
  - [ ] 2.1 新增 claude 全局 instructions 规则：`{ tool: 'claude', scope: 'global', sourceDir: 'instructions', type: Files, targetDir: '~/.claude/' }`
  - [ ] 2.2 新增 claude 项目级 instructions 规则：`{ tool: 'claude', scope: 'project', sourceDir: 'instructions', type: Files, targetDir: '.claude/' }`
  - [ ] 2.3 注意 Claude Code 坚持 `CLAUDE.md`（FR-058 规则），instructions 源目录中的 `CLAUDE.md` 与 `AGENTS.md` 共存场景在 Story 7-3/7-9 进一步处理，此处仅按 Files 类型分发即可
- [ ] Task 3: 补齐 cursor 全局 agents 规则 (AC: #2)
  - [ ] 3.1 新增 cursor 全局 agents 规则：`{ tool: 'cursor', scope: 'global', sourceDir: 'agents', type: Files, targetDir: '~/.cursor/rules/' }`
  - [ ] 3.2 与现有 `cursor:project agents → .cursor/rules/` 规则保持对称
- [ ] Task 4: 实现 vscode-only 用户的 migration 兼容提示 (AC: #3)
  - [ ] 4.1 在 `src/stages/detect-tools.ts` 中新增辅助函数 `detectLegacyVscodeOnly(pathResolver)`：当 `~/.vscode/` 存在但 `~/.copilot/` 不存在时返回 true
  - [ ] 4.2 在 `detectTools()` 自动检测分支，若 `detectedTools` 不含 `copilot` 且 `detectLegacyVscodeOnly()` 为 true，调用 `reporter.warn(msg('detectTools.vscodeMergedNote'))` 输出 migration 提示（仅一次）
  - [ ] 4.3 该提示**不阻断**安装流程；仅做语义化告知。绝不读写 `~/.vscode/` 目录任何文件（NFR-C7）
  - [ ] 4.4 在 `src/core/messages.ts` 新增 i18n 键：
    - `detectTools.vscodeMergedNote`（中：⚠️ 检测到 ~/.vscode/ 但未检测到 ~/.copilot/。从 v2.0 起 VS Code 已归并到 GitHub Copilot 语境...；英：⚠️ Detected ~/.vscode/ without ~/.copilot/. Since v2.0, VS Code has been merged into the GitHub Copilot context...）
    - 提示中包含：① VS Code MCP 现由 Copilot 项目级规则承接；② 安装 GitHub Copilot 扩展后重新执行 `aiforge install`；③ 现有 `~/.vscode/` 文件不会被覆盖
- [ ] Task 5: 编写 / 修订单元测试 (AC: #1, #2, #3)
  - [ ] 5.1 修改 `tests/data/install-rules.test.ts`：
    - 总数断言：`BUILTIN_RULES.length === 20`（原为 16）
    - 不存在 `tool === 'vscode'` 的规则
    - 存在 `tool === 'copilot' && scope === 'project' && targetDir === '.vscode/'` 规则
    - 存在 claude 全局 + 项目 instructions 规则各 1 条
    - 存在 cursor 全局 agents 规则 1 条
  - [ ] 5.2 修改 `tests/data/tool-registry.test.ts`（若存在；否则在 `install-rules.test.ts` 同测试文件中追加 describe 块）：
    - `TOOL_DEFINITIONS` 中无 `id === 'vscode'`
    - 工具数量为 4（copilot/claude/cursor + 后续 epic-7 工具会扩展，本 story 完成后仍为 4）
  - [ ] 5.3 修改 `tests/stages/detect-tools.test.ts`：
    - 新增用例：mock `~/.vscode/` 存在 + `~/.copilot/` 不存在 → reporter.warn 被调用且包含 `vscodeMergedNote` 文本片段
    - 新增用例：`~/.copilot/` 存在 → 不输出 vscodeMergedNote 提示
    - 验证 mock 调用次数：vscodeMergedNote 提示在单次 detectTools 调用内最多输出 1 次
- [ ] Task 6: 文档与版本更新 (AC: #4, #5)
  - [ ] 6.1 在 `package.json` 将 version 从 `1.x.x` 升级到 `2.0.0`
  - [ ] 6.2 创建/更新 `CHANGELOG.md`：v2.0.0 章节包含 Breaking Changes（`vscode` 工具 ID 删除、归并到 copilot）+ Added（claude instructions 双路径、cursor 全局 agents、copilot 项目级 mcp `.vscode/`）
  - [ ] 6.3 创建 `docs/migration-v2.md` + `docs/migration-v2.zh.md`：
    - 版本差异对照表
    - 旧 vscode 规则 → 新 copilot 规则映射表
    - 升级命令（`npm install -g aiforge@2.0.0`）
    - 用户操作步骤：① 升级；② 安装 Copilot 扩展（如未安装）；③ 重新执行 `aiforge install`；④ `~/.vscode/` 现有文件保留
    - 常见问题（FAQ）至少 3 条
  - [ ] 6.4 更新 `README.md` + `README.zh.md` 的工具支持章节，标注 v2.0 变更
- [ ] Task 7: 质量门禁验证 (AC: #6)
  - [ ] 7.1 `npm test` — 全绿
  - [ ] 7.2 `npm run lint:src` — 退出码 0
  - [ ] 7.3 `npm run build` — 构建通过

## Dev Notes

### 架构核心约束：NFR-I5 — 零引擎改动 [Source: epics/epic-7.md, prd.md FR/NFR]

Epic 7 的核心架构约束是**所有新工具仅修改 `src/data/tool-registry.ts` + `src/data/install-rules.ts`**，不触及引擎实现层（`src/stages/`、`src/services/`、`src/commands/`）。Story 7-1 是 Epic 7 唯一允许"有限扩展引擎层"的 story，因为：
- AC #3 的 vscode-only migration 提示需要在 `detect-tools.ts` 中加 detect 辅助函数（一次性、向后兼容、无破坏）
- 所有其他 9 个 story 必须严格保持 `stages/` 与 `services/` 零改动

### Breaking Change 风险与 NFR-C7 兼容性约束 [Source: prd.md NFR-C7, epic-7-progress.md]

这是 ai-forge v1.x → v2.0 的唯一 Breaking Change：

**绝对禁止行为：**
- 不得对 `~/.vscode/` 中已存在的文件执行任何写操作（覆盖、删除、备份移走）
- 不得在 manifest 中标记 `~/.vscode/` 既有文件为 "owned by aiforge"
- 不得阻断（throw error）vscode-only 用户的安装流程

**正确行为：**
- vscode 从工具注册表删除后，原 `~/.vscode/mcp.json` 写入路径由 `copilot:project + mcp-tools` 规则承接（目标路径 `.vscode/`）。这意味着 v2.0 用户**只有同时安装 Copilot 扩展**才会触发 `.vscode/` 写入；否则该规则因 copilot 未检测到而不会激活
- vscode-only 用户在工具检测阶段会触发"无工具检测到 → NO_TOOLS fatal"既有逻辑——这是预期行为，但应在该 fatal 之前先输出 vscodeMergedNote 提示，让用户知道为什么 vscode 不再被检测

### MVP 三工具规则缺失补齐说明 [Source: 技术调研 §6.2 / docs/install-rules-matrix.md]

| 工具 | 缺失规则 | 补齐目标路径 |
|------|----------|-------------|
| claude | global + project instructions（双路径） | `~/.claude/` + `.claude/` |
| cursor | global agents | `~/.cursor/rules/` |
| copilot | project mcp-tools → `.vscode/`（承接原 vscode 项目级 MCP） | `.vscode/` |

加上删除原 vscode 全局 mcp 1 条 → 净变化 +5/-1 = +4 → 16 → 20。

### 文件清单（精确锁定改动文件）[Source: 项目结构]

**改动**：
- `src/data/tool-registry.ts`（删除 vscode 条目）
- `src/data/install-rules.ts`（删除 vscode 规则、新增 copilot 项目 mcp、新增 claude 全局/项目 instructions、新增 cursor 全局 agents）
- `src/stages/detect-tools.ts`（新增 detectLegacyVscodeOnly + warn 提示，**仅本 Story 允许**）
- `src/core/messages.ts`（新增 `detectTools.vscodeMergedNote` 中英双语键）
- `package.json`（version → 2.0.0）
- `CHANGELOG.md`（新建或追加 v2.0.0 章节）
- `docs/migration-v2.md` + `docs/migration-v2.zh.md`（新建）
- `docs/install-rules-matrix.md` + `.zh.md`（同步更新规则总数 16 → 20，删除 vscode 区块、新增对应规则行）—— **本 Story 仅做基线增量；完整 11 工具矩阵由 Story 7-10 收尾**
- `README.md` + `README.zh.md`（工具支持章节小调整）

**测试改动**：
- `tests/data/install-rules.test.ts`（断言更新）
- `tests/stages/detect-tools.test.ts`（新增 vscode-only 用例）

### 已有模式参考（必读）

- ✅ Reporter 调用模式参考 `src/stages/detect-tools.ts` 现有 `emitDiagnostics()`（warn 级别输出多行）
- ✅ i18n 消息模式参考 `src/core/messages.ts` 中 `detectTools.*` 现有键值对（zh-CN / en 双语 + 占位符 `{path}` 替换）
- ✅ 测试 mock 模式参考 `tests/stages/detect-tools.test.ts` 现有 `pathExists` mock 用例

### Project Structure Notes

- 改动目录：`src/data/`、`src/stages/`（仅本 Story 允许）、`src/core/`（仅 messages.ts）、`docs/`、根目录元文件
- 与统一项目结构一致：data/ 零运行时依赖、stages/ Reporter 生命周期契约
- **本 Story 是 Epic 7 唯一允许动 stages/ 的 story**，后续 7-2~7-10 严格不允许

### 横切关注点检查清单（cross-cutting）

本 story 修改 `src/core/messages.ts` 共享资源 + 新增 stages/ 函数 + 删除 data/ 注册表条目，触发横切关注点纪律：

1. **影响面 grep 扫描**：
   - `grep -rn "'vscode'" src/ tests/ --include="*.ts"` — 确认所有 vscode 引用点
   - `grep -rn "TOOL_DEFINITIONS" src/ tests/ --include="*.ts"` — 工具数量断言点
   - `grep -rn "BUILTIN_RULES" src/ tests/ --include="*.ts"` — 规则数量断言点
2. **逐文件标注处置**：列出 grep 命中文件 → 标记 `改动 / 审查无需改 / 不涉及`
3. **模块分组检查**：按 `core/ → data/ → stages/ → tests/ → docs/` 顺序分组打勾

### 测试要求

- 单元测试覆盖率：data/install-rules 100% 行覆盖（已有基线，新规则按既有断言模式扩展）
- 集成测试不变（Story 7-10 收尾时统一新增 11 工具集成测试）
- migration 提示路径必须有专项测试（防止后续重构误删）

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-7.md#Story 7-1]
- [Source: _bmad-output/planning-artifacts/prd.md#FR-050, NFR-C7]
- [Source: _bmad-output/planning-artifacts/epic-7-progress.md#John 给出的告诫]
- [Source: _bmad-output/project-context.md#Architecture Rules — Module Boundaries]
- [Source: docs/install-rules-matrix.md]
- [Source: src/data/tool-registry.ts, src/data/install-rules.ts, src/stages/detect-tools.ts]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
