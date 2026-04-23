# Story 7.7: Kiro (AWS) 接入

Status: ready-for-dev

## Story

As a 使用 AWS Kiro 的开发者,
I want 通过 `aiforge install` 安装 skills/instructions/steering 配置到 Kiro 标准路径,
So that 我的 AI 编码辅助配置保持最新同步。

## Acceptance Criteria

1. **Given** 用户环境存在 `~/.kiro/` 目录（全局）或 `.kiro/` 目录（项目）  
   **When** 执行 `aiforge install`（自动检测）或 `aiforge install --tools kiro`  
   **Then** `kiro` 出现在检测到的工具列表中  
   **And** `TOOL_DEFINITIONS` 包含 `{ id: 'kiro', name: 'Kiro (AWS)', detect: { global: ['~/.kiro'], project: ['.kiro'] } }`

2. **Given** 知识仓库包含 `skills/` 目录  
   **When** 对 kiro 执行项目级安装  
   **Then** skills 以 Directories 类型安装到 `.kiro/skills/`

3. **Given** 知识仓库包含 `instructions/` 目录  
   **When** 对 kiro 执行全局安装（`-g`）  
   **Then** instructions（如 `AGENTS.md`）安装到 `~/.kiro/steering/`（全局 steering 目录）

4. **Given** 知识仓库包含 `instructions/` 目录  
   **When** 对 kiro 执行项目级安装  
   **Then** instructions 安装到 `.kiro/steering/`（项目 steering 目录）

5. **Given** 执行 `npm test && npm run lint:src && npm run build`  
   **When** Story 7-7 实施完成  
   **Then** 全部通过，新增规则 +4 条，`BUILTIN_RULES` 总量为 50 条，零引擎代码改动

## Tasks / Subtasks

- [ ] Task 1: 注册 kiro 工具定义 (AC: #1)
  - [ ] 1.1 在 `src/data/tool-registry.ts` 追加：`{ id: 'kiro', name: 'Kiro (AWS)', detect: { global: ['~/.kiro'], project: ['.kiro'] } }`
- [ ] Task 2: 添加 kiro 安装规则 (AC: #2, #3, #4)
  - [ ] 2.1 在 `src/data/install-rules.ts` 追加：
    - `{ tool: 'kiro', scope: 'global', sourceDir: 'skills', type: Directories, targetDir: '~/.kiro/skills/' }`
    - `{ tool: 'kiro', scope: 'global', sourceDir: 'instructions', type: Files, targetDir: '~/.kiro/steering/', fileFilter: ['AGENTS.md'] }`
    - `{ tool: 'kiro', scope: 'project', sourceDir: 'skills', type: Directories, targetDir: '.kiro/skills/' }`
    - `{ tool: 'kiro', scope: 'project', sourceDir: 'instructions', type: Files, targetDir: '.kiro/steering/', fileFilter: ['AGENTS.md'] }`
  - [ ] 2.2 共 4 条；与 epic AC #5 一致
  - [ ] 2.3 **steering 子目录说明**：Kiro 的 instructions 概念存储在 `steering/` 子目录（区别于其他工具的工具根目录），由 targetDir 显式声明，无需新增类型
- [ ] Task 3: 编写单元测试 (AC: #1-5)
  - [ ] 3.1 扩展 `tests/data/install-rules.test.ts`：`BUILTIN_RULES.length === 50`，包含 4 条 kiro 规则；instructions 规则 fileFilter 为 `['AGENTS.md']`
  - [ ] 3.2 扩展 `tests/stages/detect-tools.test.ts`：mock `~/.kiro/` → 检测命中
- [ ] Task 4: 质量门禁 (AC: #5)
  - [ ] 4.1 `npm test` — 全绿
  - [ ] 4.2 `npm run lint:src` — 退出码 0
  - [ ] 4.3 `npm run build` — 构建通过

## Dev Notes

### Kiro steering 目录说明

Kiro 的 instructions 不放在工具根目录，而是放在 `steering/` 子目录。这是 Kiro 自身的目录约定。aiforge 通过 targetDir 显式声明 `~/.kiro/steering/` 与 `.kiro/steering/`，**不需要**新增 InstallType 或新逻辑。

### 依赖与前置 Story

- 依赖 Story 7-3（fileFilter 字段已在 InstallRule 中扩展）
- 如果 7-3 评审决定不引入 fileFilter，本 Story 的 instructions 规则需移除 fileFilter 字段，配合统一方案

### 文件清单

**改动**：
- `src/data/tool-registry.ts`
- `src/data/install-rules.ts`
- `tests/data/install-rules.test.ts`
- `tests/stages/detect-tools.test.ts`

### Project Structure Notes

- 严格 NFR-I5：仅 data/ 改动，零 stages/services/core 改动（fileFilter 由 7-3 已在 stages 实现）

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-7.md#Story 7-7]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-I5]
- [Source: _bmad-output/implementation-artifacts/stories/7-3-auggie-augment-code-integration.md (fileFilter 前置依赖)]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
