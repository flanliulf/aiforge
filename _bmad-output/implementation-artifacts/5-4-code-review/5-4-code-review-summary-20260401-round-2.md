---
Story: 5-4
Round: 2
Date: 2026-04-01
Model Used: GPT-5.4 (model ID: gpt-5.4)
Type: Code Review Summary
---

## 审查结论

本轮为 **第 2 轮复审**。

结论：**不建议通过（Changes Requested）**。上轮 3 条问题中，`AUTH_FAILED` 真实链路与 clone/pull 脱敏已修复，`NO_TOOLS` 文案也已对齐；但 `PERMISSION_DENIED` 仍有一条生产分支未完成收口，且本轮修复又引入了一个新的错误透明度回退：认证失败分支会吞掉 clone 清理失败提示。另外，当前改动尚未通过仓库 `lint` 校验，Story 还不适合收口。

## 上轮问题复核

### 1. 上轮问题 #1 已修复：认证失败真实链路已映射为 `AUTH_FAILED`

- **上轮结论**：有效，需修复
- **本轮复核结果**：✅ 已修复
- **验证位置**：
  - `src/stages/clone.ts:246-267`
  - `src/stages/clone.ts:300-321`
  - `tests/stages/clone.test.ts:633-685`
- **说明**：
  - `freshClone()` 与 `incrementalUpdate()` 现在都会识别 `Authentication failed` / `401` / `could not read Username` 等认证失败信号，并抛出 `AiforgeError('无法访问仓库', 'AUTH_FAILED', EXIT_AUTH_FAILURE, ...)`。
  - 已补真实链路测试，直接从 clone/pull 失败路径断言 `code === 'AUTH_FAILED'`、`message === '无法访问仓库'`，不再只依赖 reporter 层手工构造错误对象。

### 2. 上轮问题 #2 已修复：`CLONE_FAILED` / `PULL_FAILED` 的 `why` 已做 token 脱敏

- **上轮结论**：有效，需修复
- **本轮复核结果**：✅ 已修复
- **验证位置**：
  - `src/core/sanitize.ts:38-48`
  - `src/stages/clone.ts:246-247`
  - `src/stages/clone.ts:300-301`
  - `tests/stages/clone.test.ts:653-702`
- **说明**：
  - 新增 `sanitizeMessage()`，用于处理嵌入在任意错误消息中的 token-bearing URL。
  - `freshClone()` / `incrementalUpdate()` 在写入 `CLONE_FAILED` / `PULL_FAILED` 的 `why` 前，已通过 `sanitizeMessage(rawMessage)` 处理。
  - 新增负向测试确认 `why` 中不再暴露原始 token。

### 3. 上轮问题 #3 部分修复：`NO_TOOLS` 已对齐，但 `PERMISSION_DENIED` 仍有残留分支未收口

- **上轮结论**：有效，需修复
- **本轮复核结果**：⚠️ 部分修复
- **已修复部分**：
  - `src/stages/detect-tools.ts:173-182` 现已返回可复制命令：`npx aiforge --tools ...`
  - `tests/stages/detect-tools.test.ts:372-386` 已补真实链路断言
  - `src/services/fs-utils.ts:423-432` 的“父目录不可写”分支已改为 `chmod 755 ...` / `sudo npx aiforge -g`
  - `tests/services/fs-utils.test.ts:434-450` 已补对应真实链路断言
- **残留问题**：
  - `src/services/fs-utils.ts:475-482` 的“目标文件已存在但不可写”分支仍输出旧 fix：`ls -la ...` / `尝试以 sudo 运行...`，没有对齐 Story 5.4 Task 2.4 约定的 `chmod 755 <target-dir>` / `sudo npx aiforge -g`。
  - 当前测试只覆盖了“父目录不可写”分支，未覆盖“目标文件不可写”这条生产分支，因此这处残留没有被本轮新增测试捕获。
- **结论**：
  - 上轮问题 #3 不能视为已完全修复，仍需继续收口后才能关闭。

## 本轮新增问题

### 1. [中] `freshClone()` 认证失败路径会吞掉 cleanupWarning，回退为静默丢失清理失败提示

- **影响**：错误透明度 / 失败可恢复性
- **位置**：
  - `src/stages/clone.ts:237-267`
  - `tests/stages/clone.test.ts:486-520`
- **说明**：
  - `freshClone()` 仍会先尝试删除半成品目录，并把 `rm()` 失败信息记录到 `cleanupWarning`。
  - 但当前新增的 `AUTH_FAILED` 早退分支没有把 `cleanupWarning` 追加进 `fix`；因此若“认证失败 + 清理也失败”同时发生，用户将看不到“请手动删除残留目录”的提示。
  - 这会回退此前 CR Round-3 专门补上的“cleanup 失败必须显式暴露给用户”的保证。
  - 现有 cleanupWarning 测试只覆盖 `CLONE_FAILED` 分支，未覆盖 `AUTH_FAILED` 分支。
- **建议**：
  - 在 `AUTH_FAILED.fix` 中同样透传 cleanupWarning，或在 auth 判断前统一构造 fix 列表，避免再次出现分支间行为不一致。
  - 新增“认证失败 + rm 失败”负向测试。

### 2. [低] 当前改动仍未通过仓库 `lint`，Story 尚非 CI-clean 状态

- **影响**：交付质量 / CI 门禁
- **位置**：
  - `src/services/fs-utils.ts`
  - `src/stages/clone.ts`
  - `tests/core/sanitize.test.ts`
  - `tests/stages/clone.test.ts`
- **说明**：
  - 本轮执行 `npm run lint` 仍失败，`prettier --check` 报告以上 4 个文件存在格式问题。
  - 即使逻辑修复方向基本正确，当前 patch set 仍不满足仓库的 lint 门禁要求。
- **建议**：
  - 先修正上述文件格式并重新执行 `npm run lint`，再进入下一轮 CR。

## AC 复核结论

- **AC #1**：✅ 满足。认证失败真实链路已能产出 `无法访问仓库` / `Git 服务器返回 401（认证失败）` / 三条修复命令。
- **AC #2**：✅ 满足。三类 Reporter 的三段式渲染与视觉分工未回归。
- **AC #3**：✅ 满足。错误输出仍位于 `stderr`。
- **AC #4**：⚠️ 部分满足。`NO_TOOLS` 已收口，但 `PERMISSION_DENIED` 仍有残留分支未对齐 Story 文案，且认证失败路径丢失 cleanupWarning 也削弱了错误自助修复体验。

## 验证记录

本轮已执行并确认：

- `npm test` ✅ `629/629`
- `npm run build` ✅
- `npm run lint` ❌ `prettier --check` 报告 4 个文件格式问题

## 最终建议

建议继续修复后进入 **第 3 轮复审**：先收口 `PERMISSION_DENIED` 的剩余分支，再补 `AUTH_FAILED + cleanupWarning` 场景，最后清理格式问题并重新跑 `lint`。
