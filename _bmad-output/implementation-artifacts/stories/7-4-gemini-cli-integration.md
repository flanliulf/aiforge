# Story 7.4: Gemini CLI 接入（含版本前置校验）

Status: ready-for-dev

## Story

As a 使用 Google Gemini CLI 的开发者,
I want 通过 `aiforge install` 安装 skills/instructions 配置，并在版本不足时收到明确提示,
So that 我不会因工具版本问题而安装出现不可用的 Skills 配置。

## Acceptance Criteria

1. **Given** 用户环境存在 `~/.gemini/` 目录（全局）或 `.gemini/` 目录（项目）  
   **When** 执行 `aiforge install`（自动检测）或 `aiforge install --tools gemini`  
   **Then** `gemini` 出现在检测到的工具列表中  
   **And** `TOOL_DEFINITIONS` 包含 `{ id: 'gemini', name: 'Gemini CLI', detect: { global: ['~/.gemini'], project: ['.gemini'] } }`

2. **Given** 已安装 Gemini CLI 版本 >= v0.26.0  
   **When** 对 gemini 工具执行全局安装  
   **Then** skills 以 Directories 类型安装到 `~/.gemini/skills/`  
   **And** instructions（如 `GEMINI.md` 或 `AGENTS.md`）以 Files 类型安装到 `~/.gemini/`（全局）和项目根（项目级）

3. **Given** Gemini CLI 版本 < v0.26.0（通过 `gemini --version` 检测，或该命令不存在）  
   **When** 对 gemini 工具执行安装  
   **Then** 系统跳过 skills 类别的安装  
   **And** Reporter 输出明确版本提示：当前版本、要求版本（v0.26.0+）、升级命令  
   **And** 其他类别（如 instructions）不受影响，正常安装

4. **Given** 用户同时使用 gemini 和 antigravity 工具（均依赖 `~/.gemini/` 路径）  
   **When** 对两个工具执行安装  
   **Then** gemini skills 安装到 `~/.gemini/skills/`，antigravity skills 安装到 `~/.gemini/antigravity/skills/`，两者路径无冲突（与 Story 7-8 协同）

5. **Given** 执行 `npm test && npm run lint:src && npm run build`  
   **When** Story 7-4 实施完成  
   **Then** 全部通过，新增规则 +4 条，`BUILTIN_RULES` 总量为 34 条，零引擎代码改动

## Tasks / Subtasks

- [ ] Task 1: 注册 gemini 工具定义 (AC: #1)
  - [ ] 1.1 在 `src/data/tool-registry.ts` 追加：`{ id: 'gemini', name: 'Gemini CLI', detect: { global: ['~/.gemini'], project: ['.gemini'] } }`
  - [ ] 1.2 注意：检测路径 `~/.gemini/` 与 antigravity 共享，但 antigravity 使用更深的 `~/.gemini/antigravity/` 子目录（Story 7-8）实现隔离
- [ ] Task 2: 添加 gemini 安装规则 (AC: #2)
  - [ ] 2.1 在 `src/data/install-rules.ts` 追加：
    - `{ tool: 'gemini', scope: 'global', sourceDir: 'skills', type: Directories, targetDir: '~/.gemini/skills/' }`
    - `{ tool: 'gemini', scope: 'global', sourceDir: 'instructions', type: Files, targetDir: '~/.gemini/', fileFilter: ['AGENTS.md', 'GEMINI.md'] }`
    - `{ tool: 'gemini', scope: 'project', sourceDir: 'skills', type: Directories, targetDir: '.gemini/skills/' }`
    - `{ tool: 'gemini', scope: 'project', sourceDir: 'instructions', type: Files, targetDir: './', fileFilter: ['AGENTS.md', 'GEMINI.md'] }`
  - [ ] 2.2 共 4 条；与 epic AC #5 一致
- [ ] Task 3: 实现 Gemini 版本校验（NFR-I5 约束下的方案选型）(AC: #3)
  - [ ] 3.1 **设计决策**：版本校验需调用外部进程 `gemini --version`，这是 NFR-I5 之外的"运行时探测"逻辑
  - [ ] 3.2 优先方案：在 `src/data/install-rules.ts` 同文件追加 `TOOL_PRECONDITIONS: Record<string, { check: () => Promise<{ ok: boolean; reason?: string }>; affectedSourceDirs: string[] }>` 数据驱动结构（数据 + 闭包，仍属 data/ 范畴）
  - [ ] 3.3 在 `src/services/` 新增 `version-check.ts`：导出 `checkGeminiVersion(): Promise<{ version: string | null; meetsRequirement: boolean }>`，使用 `child_process.execFile('gemini', ['--version'], { timeout: 2000 })`，捕获 ENOENT/超时/非零退出码，全部降级返回 `{ version: null, meetsRequirement: false }`
  - [ ] 3.4 在 `src/stages/match-rules.ts` 末尾追加 precondition 检查（**Dev 评审**：此处属 Epic 7 例外允许的"数据驱动 + 工具特异性"扩展，需 PM 确认）：遍历 `TOOL_PRECONDITIONS`，若工具命中且 check 失败，从 items 中剔除 affectedSourceDirs 匹配的规则，并通过 reporter.warn 输出 `msg('precondition.geminiVersion')`
  - [ ] 3.5 i18n 键新增：
    - `precondition.geminiVersion`：`"⚠️  Gemini CLI 版本 {current} < v0.26.0 (要求最低)；跳过 skills 安装。请升级：npm install -g @google/gemini-cli@latest"` / 英文对应
    - `precondition.geminiNotFound`：`"⚠️  未检测到 gemini 命令；跳过 skills 安装。请确认 Gemini CLI 已安装且在 PATH 中"` / 英文对应
  - [ ] 3.6 **替代保守方案**：若 PM 否决 Task 3.3-3.4，则版本校验完全不实现，仅在 README/migration doc 中文档化"Gemini Skills 需要 v0.26.0+"，AC #3 降级为文档要求；规则数 +4 不变
- [ ] Task 4: 编写单元测试 (AC: #1-5)
  - [ ] 4.1 扩展 `tests/data/install-rules.test.ts`：`BUILTIN_RULES.length === 34`，包含 4 条 gemini 规则
  - [ ] 4.2 扩展 `tests/stages/detect-tools.test.ts`：gemini 检测用例
  - [ ] 4.3 若采纳 Task 3 方案：新增 `tests/services/version-check.test.ts`：
    - mock execFile 返回 `gemini version 0.30.0` → meetsRequirement === true
    - mock execFile 返回 `gemini version 0.20.0` → meetsRequirement === false
    - mock execFile 抛 ENOENT → version === null, meetsRequirement === false
    - mock execFile 超时 → version === null, meetsRequirement === false
  - [ ] 4.4 若采纳 Task 3 方案：扩展 `tests/stages/match-rules.test.ts`：
    - mock checkGeminiVersion 返回 false → MatchedPlan 不含 gemini skills 规则、含 instructions 规则、reporter.warn 被调用
    - mock checkGeminiVersion 返回 true → MatchedPlan 含完整 4 条 gemini 规则
- [ ] Task 5: 质量门禁 (AC: #5)
  - [ ] 5.1 `npm test` — 全绿
  - [ ] 5.2 `npm run lint:src` — 退出码 0
  - [ ] 5.3 `npm run build` — 构建通过

## Dev Notes

### NFR-I5 边界讨论：版本校验的特殊性

Gemini CLI 是 Epic 7 中第一个需要"运行时工具状态探测"的场景。NFR-I5 的精神是"新增工具不需改引擎实现层"，但版本校验本质上是**工具特异性的前置条件**——它属于"数据 + 数据驱动的检查闭包"，建议视为 NFR-I5 的合理延伸。

**关键约束**：版本校验**绝对不得**作为通用机制硬编码到 stages/match-rules.ts 中。它必须通过 `TOOL_PRECONDITIONS` 数据结构注入，新增工具时只增数据不改逻辑。

### 已有模式参考

- ✅ child_process 用法参考 `src/services/git-service.ts` 现有 simple-git 调用模式
- ✅ Reporter.warn 用法参考 `src/stages/detect-tools.ts` `emitDiagnostics()`
- ✅ ENOENT 降级模式参考 `pathExists()` 实现

### 文件清单

**改动**：
- `src/data/tool-registry.ts`（追加 gemini）
- `src/data/install-rules.ts`（追加 4 条规则 + TOOL_PRECONDITIONS）
- `src/services/version-check.ts`（新建，如方案采纳）
- `src/core/messages.ts`（追加 precondition.* 键）
- `src/stages/match-rules.ts`（如方案采纳：末尾追加 precondition 应用循环）
- `tests/data/install-rules.test.ts`
- `tests/stages/detect-tools.test.ts`
- `tests/services/version-check.test.ts`（新建）
- `tests/stages/match-rules.test.ts`

### Project Structure Notes

- services/ 新增 version-check.ts 符合现有 services/ 命名与导出规范
- TOOL_PRECONDITIONS 注册表是 NFR-I5 数据驱动模式的延伸

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-7.md#Story 7-4]
- [Source: _bmad-output/planning-artifacts/prd.md#FR-055, NFR-I5]
- [Source: src/data/install-rules.ts, src/stages/match-rules.ts]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
