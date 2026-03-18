# Story 4.6a: 管道完整编排与错误流控制

Status: ready-for-dev

## Story

As a 开发者,
I want 管道编排器串联所有已实现的阶段并正确处理错误流,
So that 正常模式下完整管道可端到端运行。

## Acceptance Criteria

1. **Given** 正常模式（非 dry-run）**When** 执行管道 **Then** 完整执行 Resolve → Auth → Clone → Detect → Match → Install → Report，`ParsedArgs` 由编排器持有按需注入
2. **Given** 管道执行中某阶段抛出 `AiforgeError(severity: 'fatal')` **When** 错误发生 **Then** 管道立即停止，通过 `reporter.reportError()` 输出错误，设置 `process.exitCode`（FR-031，NFR-R4）
3. **Given** Install 阶段正常完成 **When** 管道收尾 **Then** 由 pipeline 层调用 `saveManifest()` 持久化安装记录，然后调用 `reporter.reportResult()` 输出结果

## Tasks / Subtasks

- [ ] Task 1: 完善 `src/pipeline.ts` — 替换所有占位函数 (AC: #1)
  - [ ] 1.1 替换 resolve 占位 → `import { resolveSource } from './stages/resolve-source.js'`
  - [ ] 1.2 替换 authenticate 占位 → `import { authenticate } from './stages/authenticate.js'`
  - [ ] 1.3 替换 clone 占位 → `import { cloneRepo } from './stages/clone.js'`
  - [ ] 1.4 替换 detect 占位 → `import { detectTools } from './stages/detect-tools.js'`
  - [ ] 1.5 替换 match 占位 → `import { matchRules } from './stages/match-rules.js'`
  - [ ] 1.6 替换 install 占位 → `import { executeInstall } from './stages/execute-install.js'`
  - [ ] 1.7 确保 `ParsedArgs` 由编排器持有，按需注入各阶段
- [ ] Task 2: 完善错误流控制 (AC: #2)
  - [ ] 2.1 fatal 错误：catch AiforgeError with severity 'fatal' → 立即停止，`reporter.reportError(error)`，设置 `process.exitCode`
  - [ ] 2.2 非 AiforgeError 异常：包装为 `AiforgeError(code: 'UNEXPECTED', severity: 'fatal')`
  - [ ] 2.3 Install 阶段的文件 I/O 错误统一为 fatal（fail-fast），不存在 partial 错误概念——hash 相同跳过是正常结果 `status: 'skipped'`，不是错误
- [ ] Task 3: 实现安装后 manifest 保存 (AC: #3)
  - [ ] 3.1 Install 阶段完成后，由 pipeline 层调用 `saveManifest()` 持久化安装记录（manifest 保存是 pipeline 收尾职责，不在 Install 阶段内部）
  - [ ] 3.2 只保存 `status: 'new'` 和 `status: 'updated'` 的文件记录
- [ ] Task 4: 编写集成测试 (AC: #1-3)
  - [ ] 4.1 `tests/integration/pipeline.test.ts` — 完整管道端到端测试
  - [ ] 4.2 测试用例：正常模式完整流程、fatal 错误停止、dry-run 路径
  - [ ] 4.3 使用临时目录、fixture 仓库、mock Git 服务

## Dev Notes

### 完整管道编排 [Source: architecture/03-core-decisions.md#D6]

```typescript
export async function runPipeline(args: ParsedArgs, reporter: Reporter): Promise<void> {
  try {
    const source = await resolveSource(args, reporter);
    const authed = await authenticate(source, args, reporter);
    const repo = await cloneRepo(authed, args, reporter);
    const env = await detectTools(repo, args, reporter);
    const plan = await matchRules(env, args, reporter);

    if (args.dryRun) {
      reporter.reportPlan(plan);
    } else {
      const results = await executeInstall(plan, args, reporter);
      await saveManifest(buildManifestEntries(results), pathResolver);
      reporter.reportResult(results);
    }
  } catch (error) {
    if (error instanceof AiforgeError) {
      reporter.reportError(error);
      process.exitCode = error.exitCode;
    } else {
      const wrapped = new AiforgeError(
        '发生意外错误',
        'UNEXPECTED',
        1,
        'fatal',
        error instanceof Error ? error.message : String(error),
        ['请检查网络连接和文件权限', '如问题持续，请提交 issue']
      );
      reporter.reportError(wrapped);
      process.exitCode = 1;
    }
  }
}
```

### 错误语义统一决策

**Epic 4 统一规则：Install 阶段不存在 partial 错误概念。**

- 文件 I/O 错误（权限不足、磁盘满、路径无效）→ 抛出 `AiforgeError(severity: 'fatal')`，管道立即终止
- hash 相同跳过 → 正常结果 `status: 'skipped'`，不是错误
- 冲突跳过（用户选择 skip）→ 正常结果 `status: 'skipped'`，不是错误
- Install 返回的 `InstallResult[]` 中只有 `'new'`、`'updated'`、`'skipped'` 三种状态，没有 `'failed'`

管道层只处理 fatal 错误（立即停止）。

### 退出码 [Source: architecture/03-core-decisions.md#D4]

| exitCode | 含义 |
|----------|------|
| 0 | 成功 |
| 1 | 安装失败 |
| 2 | 认证失败 |
| 3 | 参数错误 |

### 模块边界

- 修改 `src/pipeline.ts`（替换占位函数为真实 import）
- 不创建新文件

### 依赖关系

- 依赖 Epic 1 全部 Story（项目骨架、类型、Reporter、数据层、CLI）
- 依赖 Epic 2 全部 Story（配置、解析、认证、克隆、init）
- 依赖 Epic 3 全部 Story（检测、匹配、dry-run）
- 依赖 Story 4.1-4.5（安装执行、冲突处理）
- 被 Story 4.6b（结果输出）依赖

### 本 Story 不做的事

- 不实现 Reporter 的完整格式化（Story 4.6b 和 Epic 5）
- 不实现性能优化（MVP 串行执行）
- 不实现管道中间件或插件机制

### References

- [Source: architecture/03-core-decisions.md#D6] — 管道编排和 dry-run 分叉
- [Source: architecture/03-core-decisions.md#D4] — 错误处理和退出码
- [Source: architecture/05-project-structure.md] — pipeline.ts 位置和数据流

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
