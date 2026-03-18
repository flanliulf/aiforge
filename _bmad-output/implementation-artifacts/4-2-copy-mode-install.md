# Story 4.2: 复制模式安装执行

Status: ready-for-dev

## Story

As a 用户,
I want 将知识仓库的配置文件复制到 AI 工具的目标目录,
So that 各工具能读取到正确的配置内容。

## Acceptance Criteria

1. **Given** `MatchedPlan` 中有 `type: 'files'` 的规则 **When** 执行安装 **Then** 将源文件逐个复制到目标目录（FR-019），目标目录不存在时自动创建（NFR-R2）
2. **Given** `MatchedPlan` 中有 `type: 'directories'` 的规则 **When** 执行安装 **Then** 将源目录整体复制到目标位置，保持目录结构
3. **Given** 安装范围为全局（`-g`）**When** 执行安装 **Then** 目标路径为用户 Home 目录下的工具配置目录（FR-016）
4. **Given** 安装范围为项目（默认）**When** 执行安装 **Then** 目标路径为当前项目目录下的工具配置目录（FR-017）
5. **Given** 知识仓库包含 agents、skills、instructions、mcp-tools 四类资源 **When** 执行 copy 模式安装 **Then** copy 模式适用的资源类型（`files` 和 `directories`）正确安装到对应目标路径（FR-018）。注意：`flatten` 类型（如 Cursor skills）由 Story 4.3 实现，本 Story 不覆盖。
6. **Given** 安装过程中某个文件 I/O 操作失败（权限不足、磁盘满等）**When** 错误发生 **Then** 抛出 `AiforgeError(severity: 'fatal')`，管道立即终止，返回已完成的操作清单（FR-031）。注意：hash 相同跳过（`status: 'skipped'`）是正常结果，不是错误。

## Tasks / Subtasks

- [ ] Task 1: 创建 `src/stages/execute-install.ts` — Install 管道阶段 (AC: #1-6)
  - [ ] 1.1 实现 `executeInstall(plan: MatchedPlan, args: ParsedArgs, reporter: Reporter): Promise<InstallResult[]>`
  - [ ] 1.2 Step 1: 调用 `preflight(plan)` 预检查（Story 4.1）
  - [ ] 1.3 Step 2: 遍历 `plan.items`，按规则类型分发执行
  - [ ] 1.4 `files` 类型：对每个 sourceFile 调用 `copyFile(src, join(targetDir, filename))`
  - [ ] 1.5 `directories` 类型：对每个 sourceFile（目录）调用 `copyDir(src, join(targetDir, dirname))`
  - [ ] 1.6 目标目录不存在时调用 `ensureDir(targetDir)`
  - [ ] 1.7 每个文件操作后构建 `InstallResult` 记录（status: 'new'|'updated'|'skipped'）
  - [ ] 1.8 fail-fast：文件操作异常时停止后续安装，返回已完成的结果列表
  - [ ] 1.9 调用 `reporter.startPhase('执行安装...')` 输出进度
- [ ] Task 2: 实现安装状态判定 (AC: #1)
  - [ ] 2.1 目标文件不存在 → status: 'new'
  - [ ] 2.2 目标文件存在且 hash 不同 → status: 'updated'
  - [ ] 2.3 目标文件存在且 hash 相同 → status: 'skipped'
  - [ ] 2.4 使用 `fileHash()` 对比源文件和目标文件
- [ ] Task 3: 编写单元测试 (AC: #1-6)
  - [ ] 3.1 `tests/stages/execute-install.test.ts`
  - [ ] 3.2 测试用例：files 类型复制、directories 类型复制、目录自动创建、new/updated/skipped 状态判定、fail-fast 行为
  - [ ] 3.3 使用临时目录和 fixture 文件进行真实文件操作测试

## Dev Notes

### InstallResult 类型 [Source: core/types.ts, Story 1.2]

```typescript
interface InstallResult {
  sourcePath: string;
  targetPath: string;
  tool: string;
  status: 'new' | 'updated' | 'skipped';
  mode: 'copy' | 'symlink';
}
```

### 执行流程

```
preflight(plan) → 遍历 plan.items → 按 rule.type 分发 → 构建 InstallResult[]
```

```typescript
export async function executeInstall(
  plan: MatchedPlan,
  args: ParsedArgs,
  reporter: Reporter
): Promise<InstallResult[]> {
  reporter.startPhase('执行安装...');

  // Step 1: 预检查
  await preflight(plan, pathResolver);

  const results: InstallResult[] = [];

  for (const item of plan.items) {
    await ensureDir(item.targetDir);

    for (const file of item.sourceFiles) {
      const status = await determineStatus(file.absolutePath, join(item.targetDir, file.relativePath));
      if (status === 'skipped') {
        results.push({ ..., status: 'skipped' });
        continue; // 跳过是正常结果，不是错误
      }
      // I/O 操作失败直接抛 AiforgeError(fatal)，管道终止
      await installSingleItem(file, item, args);
      results.push({ ..., status });
      reporter.updatePhase(`${file.relativePath}`);
    }
  }

  return results;
}
```

### hash 对比判定状态

```typescript
async function determineStatus(srcPath: string, destPath: string): Promise<'new' | 'updated' | 'skipped'> {
  try {
    await access(destPath);
  } catch {
    return 'new'; // 目标不存在
  }

  const srcHash = await fileHash(srcPath);
  const destHash = await fileHash(destPath);
  return srcHash === destHash ? 'skipped' : 'updated';
}
```

### 模块边界

- `stages/execute-install.ts` 依赖 `core/`（types、errors）、`services/fs-utils.ts`
- 本 Story 只实现 `files` 和 `directories` 的 copy 模式
- symlink 和 flatten 模式在 Story 4.3 中添加

### 依赖关系

- 依赖 Story 1.2（`InstallResult`、`MatchedPlan` 类型）
- 依赖 Story 1.3（`Reporter`、`PathResolver`）
- 依赖 Story 3.2（`MatchedPlan` 作为输入）
- 依赖 Story 4.1（`preflight`、`copyFile`、`copyDir`、`ensureDir`、`fileHash`）
- 被 Story 4.3（扩展 symlink/flatten）、4.4（manifest 记录）、4.5（冲突处理）依赖

### 本 Story 不做的事

- 不实现 symlink 模式（Story 4.3）
- 不实现 flatten 模式（Story 4.3）
- 不实现 manifest 记录（Story 4.4）
- 不实现冲突交互（Story 4.5）
- 不实现结果汇总输出（Story 4.6b）

### References

- [Source: architecture/03-core-decisions.md#D6] — 管道阶段和 Install 设计
- [Source: architecture/05-project-structure.md] — stages/execute-install.ts 位置
- [Source: project-context.md#Error-Handling-Rules] — fail-fast 错误处理

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
