# Story 5.6: 技术债快速清理与 lint 门禁修正

Status: done

## Story

As a 开发者,
I want 清理跨 Epic 积累的 4 个极小技术债项并修正 lint 门禁作用域,
So that 发布前代码库干净、lint 全仓绿、门禁文档无自相矛盾。

## Acceptance Criteria

1. **Given** `src/commands/init.ts` 中存在 `sanitizeTokenDisplay()` 函数 **When** 审查代码 **Then** 该函数已被删除，调用处改为 `import { sanitizeToken } from '../core/sanitize.js'`，现有测试零回归（CR TODO-001）
2. **Given** `.prettierignore` **When** 执行 `npm run lint` **Then** `.agent`、`.agents`、`.gemini` 目录被正确忽略，`prettier --check .` 退出码为 0（CR TODO-012）
3. **Given** `package.json` **When** 查看 scripts **Then** 存在 `lint:src` 脚本，作用域仅为 `src/` 和 `tests/`，执行退出码为 0（CR TODO-016）
4. **Given** `mvp-go-nogo-checklist.md` Warning 汇总行 **When** 审查内容 **Then** 措辞为 "2/4 通过，2/4 未验证（已知限制：W1/W2 依赖真实网络环境）"，与各行状态一致（CR TODO-015）
5. **Given** 全部改动完成 **When** 执行质量门禁 **Then** `npm test` 全绿、`npm run lint` 全仓零错误、`npm run build` 通过

## Tasks / Subtasks

- [x] Task 1: 消除 `sanitizeTokenDisplay` 重复实现 (AC: #1, CR TODO-001)
  - [x] 1.1 在 `src/commands/init.ts` 顶部添加 `import { sanitizeToken } from '../core/sanitize.js'`
  - [x] 1.2 将 `verifyTokenConnection()` 中第 218 行 `sanitizeTokenDisplay(token)` 改为 `sanitizeToken(token)`
  - [x] 1.3 删除第 238-244 行的 `sanitizeTokenDisplay()` 函数定义
  - [x] 1.4 运行 `npm test` 确认 init.test.ts 全绿（现有测试已覆盖 sanitize 逻辑）
- [x] Task 2: 修正 `.prettierignore` (AC: #2, CR TODO-012)
  - [x] 2.1 在 `.prettierignore` 末尾追加 `.agent`、`.agents`、`.gemini` 三行
  - [x] 2.2 运行 `npm run lint` 确认 `prettier --check .` 退出码为 0
- [x] Task 3: 新增 `lint:src` 脚本 (AC: #3, CR TODO-016)
  - [x] 3.1 在 `package.json` 的 scripts 中新增 `"lint:src": "eslint src/ tests/ && prettier --check \"src/**/*.ts\" \"tests/**/*.ts\""`
  - [x] 3.2 运行 `npm run lint:src` 确认退出码为 0
- [x] Task 4: 修正门禁清单措辞 (AC: #4, CR TODO-015)
  - [x] 4.1 修改 `mvp-go-nogo-checklist.md` 第 35 行 Warning 汇总，从 "4/4 已验证（W1/W2 依赖真实网络环境，本次为已知限制）" 改为 "2/4 通过，2/4 未验证（已知限制：W1/W2 依赖真实网络环境，无法在 E2E 中自动化验证）"
- [x] Task 5: 质量门禁验证 (AC: #5)
  - [x] 5.1 `npm test` — 全绿，零回归
  - [x] 5.2 `npm run lint` — 全仓零错误
  - [x] 5.3 `npm run lint:src` — 退出码 0
  - [x] 5.4 `npm run build` — 构建通过

## Dev Notes

### TODO-001 代码证据 [Source: CR TODO Backlog]

`src/commands/init.ts:239-244` 的 `sanitizeTokenDisplay()` 与 `src/core/sanitize.ts:7-12` 的 `sanitizeToken()` 逻辑**完全等价**：

```typescript
// init.ts — sanitizeTokenDisplay (待删除)
function sanitizeTokenDisplay(token: string): string {
  if (token.length <= 12) { return token.slice(0, 4) + '****' }
  return token.slice(0, 8) + '****' + token.slice(-4)
}

// sanitize.ts — sanitizeToken (保留，已有 import 路径)
export function sanitizeToken(token: string): string {
  if (token.length > 12) { return token.slice(0, 8) + '****' + token.slice(-4) }
  return token.slice(0, 4) + '****'
}
```

仅判断条件写法不同（`<= 12` vs `> 12`），结果完全一致。

### TODO-012 当前 .prettierignore 状态

已有 20 行忽略规则，缺少 `.agent`、`.agents`、`.gemini` 三个 AI 工具自动生成的目录。

### TODO-016 lint 脚本设计

当前 `npm run lint` 作用域为 `.`（全仓），包含 `.gemini/` 等 339 个非发布文件。新增 `lint:src` 仅检查 `src/` 和 `tests/`，用于发布门禁和 Story 开发的精确 lint 验证。

### 模块边界

- 修改 `src/commands/init.ts`（删除重复函数，添加 import）
- 修改 `.prettierignore`（追加 3 行）
- 修改 `package.json`（新增 1 行 script）
- 修改 `_bmad-output/implementation-artifacts/mvp-go-nogo-checklist.md`（措辞修正）
- **不修改** `src/core/sanitize.ts`（保持不变）

### 依赖关系

- 无前置依赖（可立即开始）
- Story 5-7 弱依赖本 Story（lint 环境清理后测试验证更干净）

### 本 Story 不做的事

- 不重构 `sanitizeToken` 的逻辑（保持现有行为不变）
- 不修改 ESLint 配置（仅通过 `.prettierignore` 解决 Prettier 噪音）
- 不修改 `npm run lint` 的现有行为（保留全仓检查，新增 `lint:src` 为补充）

### References

- [Source: cr-todo-backlog.md] — TODO-001、TODO-012、TODO-015、TODO-016
- [Source: project-context.md#Security-Rules] — Token 脱敏规则
- [Source: epic-4-retrospective] — TODO-001 的跨 Epic 遗留历史

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

无阻塞项，所有任务一次通过。

### Completion Notes List

- **Task 1（AC #1 / CR TODO-001）：** 删除 `src/commands/init.ts` 中的 `sanitizeTokenDisplay()` 本地重复实现（第 239-244 行），改为 import `sanitizeToken` from `'../core/sanitize.js'`，调用处从 `sanitizeTokenDisplay(token)` 改为 `sanitizeToken(token)`。现有 692 条测试零回归。
- **Task 2（AC #2 / CR TODO-012）：** 在 `.prettierignore` 末尾追加 `.agent`、`.agents`、`.gemini` 三行，`npm run lint`（含 `prettier --check .`）退出码 0。
- **Task 3（AC #3 / CR TODO-016）：** 在 `package.json` 新增 `lint:src` 脚本，作用域为 `src/` 和 `tests/`，`npm run lint:src` 退出码 0。
- **Task 4（AC #4 / CR TODO-015）：** 修正 `mvp-go-nogo-checklist.md` Warning 汇总行措辞，由 "4/4 已验证" 改为 "2/4 通过，2/4 未验证（W1/W2 依赖真实网络环境）"，与表格中 W1/W2 的 ⚠️ 状态保持一致。
- **Task 5（AC #5）：** `npm test` 692/692 全绿、`npm run lint` 零错误、`npm run lint:src` 退出码 0、`npm run build` 通过。

### File List

- `src/commands/init.ts`（删除 `sanitizeTokenDisplay()`，添加 `sanitizeToken` import，更新调用处）
- `.prettierignore`（追加 `.agent`、`.agents`、`.gemini`）
- `package.json`（新增 `lint:src` 脚本）
- `_bmad-output/implementation-artifacts/mvp-go-nogo-checklist.md`（修正 Warning 汇总措辞）
