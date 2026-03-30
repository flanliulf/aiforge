# Story 4.6a: 管道完整编排与错误流控制

Status: done

## Story

As a 开发者,
I want 管道编排器串联所有已实现的阶段并正确处理错误流,
So that 正常模式下完整管道可端到端运行。

## Acceptance Criteria

1. **Given** 正常模式（非 dry-run）**When** 执行管道 **Then** 完整执行 Resolve → Auth → Clone → Detect → Match → Install → Report，`ParsedArgs` 由编排器持有按需注入
2. **Given** 管道执行中某阶段抛出 `AiforgeError(severity: 'fatal')` **When** 错误发生 **Then** 管道立即停止，通过 `reporter.reportError()` 输出错误，设置 `process.exitCode`（FR-031，NFR-R4）
3. **Given** Install 阶段正常完成 **When** 管道收尾 **Then** 由 pipeline 层调用 `saveManifest()` 持久化安装记录，然后调用 `reporter.reportResult()` 输出结果

## Tasks / Subtasks

- [x] Task 1: 完善 `src/pipeline.ts` — 替换所有占位函数 (AC: #1)
  - [x] 1.1 替换 resolve 占位 → `import { resolveSource } from './stages/resolve-source.js'`
  - [x] 1.2 替换 authenticate 占位 → `import { authenticate } from './stages/authenticate.js'`
  - [x] 1.3 替换 clone 占位 → `import { cloneRepo } from './stages/clone.js'`
  - [x] 1.4 替换 detect 占位 → `import { detectTools } from './stages/detect-tools.js'`
  - [x] 1.5 替换 match 占位 → `import { matchRules } from './stages/match-rules.js'`
  - [x] 1.6 替换 install 占位 → `import { executeInstall } from './stages/execute-install.js'`
  - [x] 1.7 确保 `ParsedArgs` 由编排器持有，按需注入各阶段
- [x] Task 2: 完善错误流控制 (AC: #2)
  - [x] 2.1 fatal 错误：catch AiforgeError with severity 'fatal' → 立即停止，`reporter.reportError(error)`，设置 `process.exitCode`
  - [x] 2.2 非 AiforgeError 异常：包装为 `AiforgeError(code: 'UNEXPECTED', severity: 'fatal')`
  - [x] 2.3 Install 阶段的文件 I/O 错误统一为 fatal（fail-fast），不存在 partial 错误概念——hash 相同跳过是正常结果 `status: 'skipped'`，不是错误
- [x] Task 3: 实现安装后 manifest 保存 (AC: #3)
  - [x] 3.1 Install 阶段完成后，由 pipeline 层调用 `saveManifest()` 持久化安装记录（manifest 保存是 pipeline 收尾职责，不在 Install 阶段内部）
  - [x] 3.2 只保存 `status: 'new'` 和 `status: 'updated'` 的文件记录
- [x] Task 4: 编写集成测试 (AC: #1-3)
  - [x] 4.1 `tests/integration/pipeline.test.ts` — 完整管道端到端测试
  - [x] 4.2 测试用例：正常模式完整流程、fatal 错误停止、dry-run 路径
  - [x] 4.3 使用临时目录、fixture 仓库、mock Git 服务

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

Claude Sonnet 4 via Claude Code

### Debug Log References

无异常。所有测试一次通过。

### Completion Notes List

**实现摘要：**

1. **Task 1 — 替换占位函数：** `createProductionStages(pathResolver)` 工厂函数中所有 6 个占位阶段已替换为真实实现，通过闭包注入 `pathResolver`。`index.ts` 已更新为使用 `createProductionStages(new UnixPathResolver())` 代替 `DEFAULT_STAGES`。

2. **Task 2 — 错误流控制：** `runPipeline` 中的 catch 块区分 `AiforgeError(severity: 'fatal')` 和非 AiforgeError 异常。Fatal 错误直接传递 `reporter.reportError()` + 设置 `process.exitCode`；非 AiforgeError 包装为 `AiforgeError(code: 'ERR_UNKNOWN', severity: 'fatal')`。Install 阶段 I/O 错误由 `executeInstall` 内部抛出 fatal（fail-fast），管道层统一捕获。

3. **Task 3 — manifest 保存：** 新增 `SaveManifestFn` 类型和 `PipelineStages.saveManifest` 字段。`createProductionStages` 中的 `saveManifest` 闭包：过滤 `status: 'new'|'updated'` 的记录 → 计算目标文件 hash → 关联 plan 获取 tool/scope/mode 信息 → 构建 ManifestEntry → 合并已有 manifest → 原子写入。调用位置在 `runPipeline` 中 `install` 之后、`report` 之前。

4. **Task 4 — 集成测试：** 新增 `tests/integration/pipeline.test.ts`，包含 14 个测试用例覆盖 AC #1-3 + dry-run 路径。同时更新了 `tests/integration/dry-run.test.ts` 以适配新的 `PipelineStages` 接口。

**测试统计：**
- Story 新增测试：14 个集成测试 + 4 个单元测试 = 18 个测试
- 全仓测试：27 个测试文件，553 个测试全部通过
- Lint: ESLint + Prettier 全通过
- Build: tsup 构建成功

**设计决策：**
- `saveManifest` 作为 `PipelineStages` 接口成员（而非 `runPipeline` 内硬编码），保持依赖注入一致性，便于测试
- `DEFAULT_STAGES.saveManifest` 使用 `notImplemented` 占位（与其他阶段一致）
- `createProductionStages` 内使用共享变量 `lastRepo` 和 `lastPlan` 在闭包间传递数据，避免修改 `InstallResult` 类型

### File List

- `src/pipeline.ts` — 主要修改：替换占位函数、新增 SaveManifestFn 和 PipelineStages.saveManifest、完善 createProductionStages
- `src/index.ts` — 更新：使用 createProductionStages(new UnixPathResolver()) 代替 DEFAULT_STAGES
- `tests/pipeline.test.ts` — 更新：新增 saveManifest 相关测试、createProductionStages 测试
- `tests/integration/pipeline.test.ts` — 新增：14 个端到端集成测试
- `tests/integration/dry-run.test.ts` — 更新：mock stages 添加 saveManifest 字段

## Change Log

- 2026-03-30: Story 4.6a 实现完成 — 管道编排替换占位为真实实现，完善错误流控制，新增 pipeline 层 saveManifest 收尾逻辑，14 个集成测试
