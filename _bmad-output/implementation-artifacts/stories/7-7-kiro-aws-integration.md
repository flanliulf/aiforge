# Story 7.7: Kiro (AWS) 接入

Status: done

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

- [x] Task 1: 注册 kiro 工具定义 (AC: #1)
  - [x] 1.1 在 `src/data/tool-registry.ts` 追加：`{ id: 'kiro', name: 'Kiro (AWS)', detect: { global: ['~/.kiro'], project: ['.kiro'] } }`
- [x] Task 2: 添加 kiro 安装规则 (AC: #2, #3, #4)
  - [x] 2.1 在 `src/data/install-rules.ts` 追加：
    - `{ tool: 'kiro', scope: 'global', sourceDir: 'skills', type: Directories, targetDir: '~/.kiro/skills/' }`
    - `{ tool: 'kiro', scope: 'global', sourceDir: 'instructions', type: Files, targetDir: '~/.kiro/steering/', fileFilter: ['AGENTS.md'] }`
    - `{ tool: 'kiro', scope: 'project', sourceDir: 'skills', type: Directories, targetDir: '.kiro/skills/' }`
    - `{ tool: 'kiro', scope: 'project', sourceDir: 'instructions', type: Files, targetDir: '.kiro/steering/', fileFilter: ['AGENTS.md'] }`
  - [x] 2.2 共 4 条；与 epic AC #5 一致
  - [x] 2.3 **steering 子目录说明**：Kiro 的 instructions 概念存储在 `steering/` 子目录（区别于其他工具的工具根目录），由 targetDir 显式声明，无需新增类型
- [x] Task 3: 编写单元测试 (AC: #1-5)
  - [x] 3.1 扩展 `tests/data/install-rules.test.ts`：`BUILTIN_RULES.length === 50`，包含 4 条 kiro 规则；instructions 规则 fileFilter 为 `['AGENTS.md']`
  - [x] 3.2 扩展 `tests/stages/detect-tools.test.ts`：mock `~/.kiro/` → 检测命中
- [x] Task 4: 质量门禁 (AC: #5)
  - [x] 4.1 `npm test` — 全绿
  - [x] 4.2 `npm run lint:src` — 退出码 0
  - [x] 4.3 `npm run build` — 构建通过

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

GPT-5.4

### Debug Log References

### Completion Notes List

- 已注册 `kiro` 工具定义：`detect.global = ['~/.kiro']`，`detect.project = ['.kiro']`。
- 已新增 4 条 Kiro 安装规则：skills 安装到 `.kiro/skills/` / `~/.kiro/skills/`，instructions 安装到 `.kiro/steering/` / `~/.kiro/steering/`，并对 instructions 使用 `fileFilter: ['AGENTS.md']`。
- 已扩展 `tests/data/install-rules.test.ts` 与 `tests/stages/detect-tools.test.ts`，覆盖 Kiro 规则矩阵、规则总量 50，以及 `~/.kiro` / `.kiro` 检测命中。
- 聚焦验证通过：`npm test -- tests/data/install-rules.test.ts tests/stages/detect-tools.test.ts`，共 97 个测试通过。
- 已修复既有测试 `tests/data/tool-registry.test.ts` 的旧基线断言：工具总数从 8 更新为 9，并补充 `kiro` 覆盖断言，使工具注册表测试与 Story 7-7 的注册事实一致。
- 完整质量门禁通过：`npm test` 全绿（34 个测试文件、924 个测试），`npm run lint:src` 通过，`npm run build` 通过。
- 本次实现保持零引擎代码改动，仅修改 data 层与相关测试文件；Story 7-7 已推进到 `review`。

### File List

- src/data/tool-registry.ts
- src/data/install-rules.ts
- tests/data/install-rules.test.ts
- tests/data/tool-registry.test.ts
- tests/stages/detect-tools.test.ts
- _bmad-output/implementation-artifacts/stories/7-7-kiro-aws-integration.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-05-19: 修复 `tests/data/tool-registry.test.ts` 的旧工具数量断言并补充 Kiro 覆盖；完整质量门禁通过，Story 状态更新为 review。
