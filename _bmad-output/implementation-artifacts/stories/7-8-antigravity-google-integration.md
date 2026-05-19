# Story 7.8: Antigravity (Google) 接入（子目录隔离策略）

Status: done

## Story

As a 使用 Google Antigravity 的开发者,
I want 通过 `aiforge install` 安装 skills 配置，且配置路径与 Gemini CLI 相互隔离,
So that 同时使用两个工具时，配置文件不会相互干扰或触发错误的工具识别。

## Acceptance Criteria

1. **Given** 用户环境存在 `~/.gemini/antigravity/` 目录（全局专属子目录）或 `.agents/` 目录（项目）  
   **When** 执行 `aiforge install`（自动检测）或 `aiforge install --tools antigravity`  
   **Then** `antigravity` 出现在检测到的工具列表中，与 `gemini` 独立检测  
   **And** `TOOL_DEFINITIONS` 包含 `{ id: 'antigravity', name: 'Antigravity', detect: { global: ['~/.gemini/antigravity'], project: ['.agents'] } }`

2. **Given** 用户同时安装了 `gemini` 和 `antigravity` 工具  
   **When** 执行 `aiforge install`  
   **Then** gemini skills 安装到 `~/.gemini/skills/`，antigravity skills 安装到 `~/.gemini/antigravity/skills/`  
   **And** 两者路径无重叠，manifest.json 中各自的 tool 字段正确区分

3. **Given** 知识仓库包含 `skills/` 目录，用户执行项目级安装  
   **When** `aiforge install --tools antigravity`  
   **Then** skills 安装到 `.agents/skills/`（与通用目录 Story 6-3 协同）

4. **Given** 环境只有 `~/.gemini/` 目录但无 `~/.gemini/antigravity/` 子目录  
   **When** 执行 `aiforge install`（自动检测）  
   **Then** `antigravity` 不出现在检测到的工具列表（`~/.gemini/` 存在不触发 antigravity，仅触发 gemini）

5. **Given** 执行 `npm test && npm run lint:src && npm run build`  
   **When** Story 7-8 实施完成  
   **Then** 全部通过，新增规则 +3 条，`BUILTIN_RULES` 总量为 53 条，零引擎代码改动

## Tasks / Subtasks

- [x] Task 1: 注册 antigravity 工具定义（子目录隔离策略）(AC: #1, #4)
  - [x] 1.1 在 `src/data/tool-registry.ts` 追加：
    ```
    { id: 'antigravity', name: 'Antigravity', detect: { global: ['~/.gemini/antigravity'], project: ['.agents'] } }
    ```
  - [x] 1.2 **关键设计**：detect.global 为 `~/.gemini/antigravity`（更深层路径），与 gemini 的 `~/.gemini` 形成"父-子"关系。`detectSingleTool()` 现有逻辑会按字符串路径检查存在性——只要 antigravity 子目录不存在，就不会误检测，AC #4 满足
  - [x] 1.3 detect.project 为 `.agents`（与 Story 6-3 通用目录约定保持一致；antigravity 项目级配置走通用 `.agents/` 路径）
- [x] Task 2: 添加 antigravity 安装规则 (AC: #1, #2, #3)
  - [x] 2.1 在 `src/data/install-rules.ts` 追加：
    - `{ tool: 'antigravity', scope: 'global', sourceDir: 'skills', type: Directories, targetDir: '~/.gemini/antigravity/skills/' }`
    - `{ tool: 'antigravity', scope: 'global', sourceDir: 'agents', type: Files, targetDir: '~/.gemini/antigravity/agents/' }`
    - `{ tool: 'antigravity', scope: 'project', sourceDir: 'skills', type: Directories, targetDir: '.agents/skills/' }`
  - [x] 2.2 共 3 条；与 epic AC #5 一致
  - [x] 2.3 **与 Story 6-3 通用目录的协同**：antigravity 项目级 skills 规则的 targetDir 与 UNIVERSAL_RULES 中 `.agents/skills/` 的 targetDir **完全相同**。需确认 manifest 不会因 tool 不同（`'antigravity'` vs `'universal'`）造成重复条目或互相覆盖
  - [x] 2.4 **重复条目处置策略**（Dev 阶段评审）：
    - 方案 A：保留两条规则，manifest 按 `tool + target` 双键去重；安装时检测到完全相同的 sourceFile→targetPath 时仅写一次，但 manifest 记录两个 tool 引用
    - 方案 B：在 antigravity 项目规则上加 `dedupWithUniversal: true` 标记，匹配阶段检测到重复时跳过 antigravity 规则（universal 优先）
    - 方案 C（推荐 - 最简单）：删除 antigravity 项目级 skills 规则；项目级 antigravity 完全依赖通用 `.agents/` 目录（universal 已覆盖），只保留 antigravity 全局 2 条规则。规则总量改为 +2 → BUILTIN_RULES 共 52 条。**Dev 阶段开工前评审拍板**
- [x] Task 3: 编写单元测试 (AC: #1-5)
  - [x] 3.1 扩展 `tests/data/install-rules.test.ts`：`BUILTIN_RULES.length === 53`（按方案 A/B）或 52（按方案 C）；包含 antigravity 规则
  - [x] 3.2 扩展 `tests/stages/detect-tools.test.ts`：
    - mock `~/.gemini/antigravity/` 存在 → `detectedTools` 包含 `'antigravity'`
    - mock 仅 `~/.gemini/` 存在但 `~/.gemini/antigravity/` 不存在 → `detectedTools` 不含 `'antigravity'`（仅含 `'gemini'`）
    - mock 同时存在 `~/.gemini/` 和 `~/.gemini/antigravity/` → `detectedTools` 同时包含两者
  - [x] 3.3 扩展 `tests/stages/match-rules.test.ts`（如方案 A/B 采纳）：测试 antigravity vs universal 重复 target 的处置
- [x] Task 4: 质量门禁 (AC: #5)
  - [x] 4.1 `npm test` — 全绿
  - [x] 4.2 `npm run lint:src` — 退出码 0
  - [x] 4.3 `npm run build` — 构建通过

## Dev Notes

### 子目录隔离策略详解

Antigravity 与 Gemini CLI 共享 `~/.gemini/` 父目录，但 Antigravity 的所有配置都在更深的 `~/.gemini/antigravity/` 子目录下。aiforge 通过：
1. **检测路径**：用更深层的 `~/.gemini/antigravity/` 作为 antigravity 的检测标志（仅父目录存在不触发）
2. **安装路径**：所有写入路径都包含 `antigravity/` 子目录前缀

实现路径隔离，确保两个工具配置文件互不干扰。

### 与 Story 6-3 通用目录的潜在冲突

antigravity 项目级使用 `.agents/` 作为检测路径，与 Story 6-3 引入的 `.agents/` 通用目录概念**重合**。这意味着：
- 任何使用通用目录的项目都会"看似有 antigravity"
- antigravity 项目级 skills 规则的 targetDir 与 UNIVERSAL_RULES 完全相同

**建议方案 C**：项目级 antigravity 不单独定义规则，由通用 `.agents/` 自然承载。这避免了 manifest 双重写入与冲突检测复杂度。

### 文件清单

**改动**：
- `src/data/tool-registry.ts`
- `src/data/install-rules.ts`
- `tests/data/install-rules.test.ts`
- `tests/stages/detect-tools.test.ts`

### Project Structure Notes

- 严格 NFR-I5：仅 data/ 改动；隔离策略通过路径设计而非代码逻辑实现

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-7.md#Story 7-8]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-I5]
- [Source: _bmad-output/implementation-artifacts/stories/6-3-universal-directory-install.md (.agents/ 协同)]
- [Source: _bmad-output/implementation-artifacts/stories/7-4-gemini-cli-integration.md (gemini 隔离)]

## Dev Agent Record

### Agent Model Used

GPT-5.4

### Debug Log References

- 2026-05-19：先扩展 `tests/data/install-rules.test.ts`、`tests/stages/detect-tools.test.ts`、`tests/stages/match-rules.test.ts` 建立红灯，再在 `src/data/tool-registry.ts` 与 `src/data/install-rules.ts` 落地最小数据层改动。
- Task 2.4 决策：按 AC #5 采用 `+3 / 53` 口径，保留 antigravity 项目级 `.agents/skills/` 规则，不采纳 Dev Notes 中推荐的方案 C。理由：Epic 7 当前代码基线为 50 条规则，本 Story AC 明确要求新增 3 条且零引擎代码改动；现有 `match-rules` 会并存 antigravity 与 universal 的 `.agents/skills/` 计划项，`execute-install` / `mergeManifest` 也没有 `tool + target` 级新契约，因此本 Story 仅在 data 层补齐规则并用测试锁定当前共存行为。
- 质量门禁执行顺序：先跑窄测试验证失败点，再修复生产数据；全量 `npm test` 首轮发现 `tests/data/tool-registry.test.ts` 仍停留在 9 工具旧基线，补齐后复跑通过；随后修复 `tests/stages/match-rules.test.ts` 的 Prettier 格式问题并通过 `npm run lint:src`；最后 `npm run build` 通过。

### Completion Notes List

- 完成 antigravity 工具注册：`TOOL_DEFINITIONS` 新增 `{ id: 'antigravity', name: 'Antigravity', detect: { global: ['~/.gemini/antigravity'], project: ['.agents'] } }`，满足全局子目录隔离与项目 `.agents` 检测。
- 完成 antigravity 规则接入：`BUILTIN_RULES` 新增 3 条规则，规则总数从 50 增至 53；全局 skills/agents 均写入 `~/.gemini/antigravity/` 子目录，项目级 skills 写入 `.agents/skills/`。
- 补充与更新测试：扩展 install-rules / tool-registry / detect-tools / match-rules 测试，覆盖 10 工具基线、antigravity 检测隔离、以及 antigravity 与 universal `.agents/skills/` 共存场景。
- 质量门禁结果：`npm test` 935/935 通过；`npm run lint:src` 通过；`npm run build` 通过。
- 实现保持零引擎代码改动：生产代码仅修改 `src/data/tool-registry.ts` 与 `src/data/install-rules.ts`。

### File List

- _bmad-output/implementation-artifacts/stories/7-8-antigravity-google-integration.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- src/data/install-rules.ts
- src/data/tool-registry.ts
- tests/data/install-rules.test.ts
- tests/data/tool-registry.test.ts
- tests/stages/detect-tools.test.ts
- tests/stages/match-rules.test.ts

## Change Log

- 2026-05-19 | GPT-5.4 | 实现 Story 7-8：新增 antigravity 工具注册与 3 条安装规则，补齐相关测试，完成 `npm test`、`npm run lint:src`、`npm run build`，状态更新为 review。
