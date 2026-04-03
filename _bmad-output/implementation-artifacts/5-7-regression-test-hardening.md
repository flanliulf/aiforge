# Story 5.7: 回归防护测试补全与 preflight 增强

Status: ready-for-dev

## Story

As a 开发者,
I want 补全 4 个关键的回归防护测试缺口并增强 preflight 诊断精度,
So that 发布后代码变更有自动化测试守护，不会因回归而损害质量。

## Acceptance Criteria

1. **Given** `targetPath` 为普通文件（非目录）**When** preflight 阶段执行 `checkTargetWritability()` **Then** 提前抛出明确的 `PATH_NOT_DIRECTORY` 错误，而非延迟到 `ensureDir` 阶段才以 `ENSURE_DIR_FAILED` 失败（CR TODO-006）
2. **Given** `pipeline.ts` 的 `report` 闭包 **When** 执行集成测试 **Then** 有专门的测试断言传给 `reporter.reportResult()` 的 `items[].sourcePath` 为 repo-relative 路径（不以 `repoDir` 绝对路径开头）（CR TODO-010）
3. **Given** `process.stdout.isTTY = false` 且 `process.stderr.isTTY = true` **When** 入口层创建 Reporter **Then** 自动化测试断言 `createReporter` 以 `isTty: true` 被调用，使用 `TtyReporter`（CR TODO-011）
4. **Given** `BUILTIN_RULES` 共 16 条规则 **When** 执行 E2E 集成测试 **Then** 覆盖率从当前 ~31%（5/16）提升到 80%+，至少补充 copilot 和 vscode 工具的 match + install 全链路 E2E 断言（CR TODO-013）
5. **Given** 全部改动完成 **When** 执行质量门禁 **Then** `npm test` 全绿、`npm run lint:src` 退出码 0、`npm run build` 通过

## Tasks / Subtasks

- [ ] Task 1: 增强 `checkTargetWritability()` — preflight 拒绝普通文件 (AC: #1, CR TODO-006)
  - [ ] 1.1 在 `src/services/fs-utils.ts` 第 484 行 `else` 分支（普通文件）中，在可写性检查**之前**增加 `targetStat.isFile()` 判断，抛出 `PATH_NOT_DIRECTORY` 错误
  - [ ] 1.2 在 `src/data/messages.ts` 中添加 `fsUtils.pathNotDirectory` / `fsUtils.pathNotDirectoryWhy` / `fsUtils.fixRemoveFileAndRetry` i18n 消息键（中英文）
  - [ ] 1.3 在 `tests/services/fs-utils.test.ts` 中新增 preflight 测试：targetPath 为普通文件时抛出 `PATH_NOT_DIRECTORY`
- [ ] Task 2: 补 `report` 闭包 repo-relative 路径集成测试 (AC: #2, CR TODO-010)
  - [ ] 2.1 在 `tests/integration/pipeline-production-stages.test.ts`（或同目录下合适的测试文件）中新增测试
  - [ ] 2.2 测试逻辑：构造 mock reporter，执行 `createProductionStages().report`，断言 `reporter.reportResult()` 接收的 `items[].sourcePath` 不以 `repoDir` 绝对路径开头
  - [ ] 2.3 无生产代码改动
- [ ] Task 3: 补 TTY 判定入口层测试 (AC: #3, CR TODO-011)
  - [ ] 3.1 在 `tests/` 下的入口层测试文件中新增测试
  - [ ] 3.2 Mock `process.stdout.isTTY = false` + `process.stderr.isTTY = true`
  - [ ] 3.3 断言 `createReporter` 被以 `isTty: true` 调用（应选择 TtyReporter）
  - [ ] 3.4 反向测试：`process.stderr.isTTY = false` 时应选择 PlainReporter
- [ ] Task 4: 补 copilot/vscode/cursor:project E2E 覆盖 (AC: #4, CR TODO-013)
  - [ ] 4.1 在 `tests/fixtures/sample-repo/` 下确认已有 fixture 数据支持所有工具类型的 E2E 测试（agents/、skills/、instructions/、mcp-tools/ 各类资源）
  - [ ] 4.2 在 `tests/integration/pipeline.test.ts` 中扩展 Story 5.5b describe 块，新增：
    - copilot:global 全链路测试（agents/Files + skills/Directories + instructions/Files）
    - copilot:project 全链路测试
    - vscode:global 全链路测试（settings/Files）
    - cursor:project 全链路测试（rules/Flatten）
  - [ ] 4.3 每个测试断言：match 结果的 toolId/scope/installType 正确，install 结果的 targetPath/status 正确
  - [ ] 4.4 补充 fixture 文件（如 `tests/fixtures/sample-repo/settings/` 等）如果现有 fixture 不足
- [ ] Task 5: 质量门禁验证 (AC: #5)
  - [ ] 5.1 `npm test` — 全绿，记录新增测试数
  - [ ] 5.2 `npm run lint:src` — 退出码 0（依赖 Story 5-6 创建此脚本）
  - [ ] 5.3 `npm run build` — 构建通过

## Dev Notes

### TODO-006 代码位置 [Source: fs-utils.ts:484-510]

`checkTargetWritability()` 函数第 484 行的 `else` 分支处理 `targetPath` 为普通文件的情况。当前只检查 `W_OK` 可写性，不会拒绝"不是目录"这个更根本的问题。改进方案：

```typescript
} else {
  // 普通文件 → targetPath 应该是目录，文件不应该存在于此
  if (targetStat.isFile()) {
    throw new AiforgeError(
      msg('fsUtils.pathNotDirectory').replace('{path}', targetPath),
      'PATH_NOT_DIRECTORY',
      EXIT_INSTALL_FAILURE,
      'fatal',
      msg('fsUtils.pathNotDirectoryWhy').replace('{path}', targetPath),
      [msg('fsUtils.fixRemoveFileAndRetry').replace('{path}', targetPath)],
    )
  }
  // ... 其他非目录/非文件类型的处理 ...
}
```

### TODO-010 代码位置 [Source: pipeline.ts:348-360]

`createProductionStages().report` 闭包中，`sourcePath` 从绝对 clone 路径裁剪为 repo-relative 路径：

```typescript
// pipeline.ts 约第 351-353 行
const sourcePath = item.sourcePath.startsWith(repoDir)
  ? item.sourcePath.slice(repoDir.length + 1)
  : item.sourcePath
```

现有测试覆盖 Reporter 组件层（输入已是 relative path），但未覆盖 `report` 闭包的裁剪逻辑。

### TODO-011 代码位置 [Source: index.ts:78]

```typescript
// index.ts
const reporter = createReporter({
  quiet: args.quiet,
  isTty: process.stderr.isTTY === true,  // 注意：绑定到 stderr，不是 stdout
})
```

如果有人改回 `process.stdout.isTTY`，当前测试不会报红。

### TODO-013 当前覆盖状态 [Source: Story 5-5b CR]

`BUILTIN_RULES` 16 条规则中，E2E 仅覆盖：
- claude:global (Files + Directories) ✅
- claude:project (Files) ✅
- cursor:global (Files + Directories) ✅

未覆盖：
- copilot:global (agents/Files, skills/Directories, instructions/Files, mcp-tools/Files) ❌
- copilot:project (agents/Files, skills/Directories, instructions/Files, mcp-tools/Files) ❌
- vscode:global (settings/Files) ❌
- cursor:project (rules/Flatten, prompts/Flatten) ❌

### 模块边界

- 修改 `src/services/fs-utils.ts`（Task 1：增加 isFile 分支）
- 修改 `src/data/messages.ts`（Task 1：新增 i18n 消息键）
- 新增/扩展 `tests/services/fs-utils.test.ts`（Task 1）
- 新增/扩展 `tests/integration/pipeline-production-stages.test.ts`（Task 2）
- 新增/扩展入口层测试文件（Task 3）
- 扩展 `tests/integration/pipeline.test.ts`（Task 4）
- 可能新增 `tests/fixtures/sample-repo/` 下的 fixture 文件（Task 4）

### 依赖关系

- 弱依赖 Story 5-6（`lint:src` 脚本，用于 Task 5 验证）
- 不阻塞任何其他 Story

### 本 Story 不做的事

- 不修改 `checkTargetWritability()` 的其他分支（仅增强普通文件分支）
- 不补充 Windows 平台的 E2E 测试（延迟决策 M2）
- 不实现 100% 规则覆盖（目标 80%+，极端罕见的规则组合可延后）
- 不修改 `pipeline.ts` 的 report 闭包逻辑（仅补测试）
- 不修改 `index.ts` 的 TTY 判定逻辑（仅补测试）

### References

- [Source: cr-todo-backlog.md] — TODO-006、TODO-010、TODO-011、TODO-013
- [Source: project-context.md#Testing-Rules] — 测试分层和 fixture 规则
- [Source: architecture/04-implementation-patterns.md] — 测试命名和 Mock 策略
- [Source: Story 5-5b CR] — E2E 覆盖率分析

## Dev Agent Record

### Agent Model Used

（待填写）

### Debug Log References

（待填写）

### Completion Notes List

（待填写）

### File List

（待填写）
