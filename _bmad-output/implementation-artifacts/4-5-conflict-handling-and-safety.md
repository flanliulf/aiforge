# Story 4.5: 冲突处理与安全保护

Status: ready-for-dev

## Story

As a 用户,
I want 系统在检测到文件冲突时保护我的手写文件,
So that 不会丢失花时间调试的自定义配置。

## Acceptance Criteria

1. **Given** 目标路径存在用户手写文件（不在 manifest 中）**When** 安装需要写入该路径 **Then** 提供交互式选项：覆盖 / 跳过 / 备份后覆盖（推荐）/ 查看差异 / 中止（FR-027）
2. **Given** 用户选择"备份后覆盖" **When** 执行安装 **Then** 将用户文件备份为 `{filename}.aiforge-backup-{YYYYMMDD}`（FR-028），然后执行正常安装
3. **Given** 用户指定 `--force` **When** 检测到冲突 **Then** 跳过交互式确认，直接覆盖（FR-029）
4. **Given** 非 TTY 环境下检测到冲突 **When** 需要用户决策 **Then** 直接失败（不进入交互式选择），exit code = 1
5. **Given** 安装结果为零项（无文件被安装）**When** 安装完成 **Then** 触发零结果诊断（FR-032）
6. **Given** 临时文件在安装过程中创建 **When** 安装完成（无论成功或失败）**Then** 所有临时文件被清理删除（NFR-S6）

## Tasks / Subtasks

- [ ] Task 1: 扩展 `src/stages/execute-install.ts` — 集成冲突处理 (AC: #1-4)
  - [ ] 1.1 在每个文件安装前调用 `checkConflict()`（Story 4.4）
  - [ ] 1.2 `ConflictType === 'user-file'` 时触发冲突处理流程
  - [ ] 1.3 `ConflictType === 'aiforge-current'` → 自动跳过（hash 相同）
  - [ ] 1.4 `ConflictType === 'aiforge-outdated'` → 直接更新（aiforge 自己安装的文件）
  - [ ] 1.5 `--force` 模式：跳过所有交互，直接覆盖
  - [ ] 1.6 非 TTY 检测：`!process.stdin.isTTY && conflict` → `AiforgeError(code: 'CONFLICT_NON_TTY')`
- [ ] Task 2: 实现交互式冲突解决 (AC: #1, #2)
  - [ ] 2.1 使用 `@inquirer/prompts` 的 `select` 提供选项
  - [ ] 2.2 选项：覆盖 / 跳过 / 备份后覆盖（默认推荐）/ 查看差异 / 中止全部安装
  - [ ] 2.3 "备份后覆盖"：调用 `backupFile()` → 正常安装
  - [ ] 2.4 "查看差异"：显示源文件和目标文件的简要对比，然后重新询问
  - [ ] 2.5 "中止"：停止整个安装流程
- [ ] Task 3: 实现零结果诊断 (AC: #5)
  - [ ] 3.1 安装完成后检查 results 是否全部为 skipped 或空
  - [ ] 3.2 输出诊断：扫描了哪些目录、匹配了哪些模式、建议修复方式
- [ ] Task 4: 实现临时文件清理 (AC: #6)
  - [ ] 4.1 使用 try/finally 确保清理逻辑执行
  - [ ] 4.2 清理 manifest.json.tmp 等临时文件
- [ ] Task 5: 编写单元测试 (AC: #1-6)
  - [ ] 5.1 扩展 `tests/stages/execute-install.test.ts`
  - [ ] 5.2 测试用例：用户文件冲突交互、备份后覆盖、--force 跳过交互、非 TTY 失败、零结果诊断、临时文件清理
  - [ ] 5.3 Mock `@inquirer/prompts`

## Dev Notes

### 交互式冲突解决 [Source: FR-027]

```typescript
import { select } from '@inquirer/prompts';

async function resolveConflict(
  targetPath: string,
  sourcePath: string,
  reporter: Reporter
): Promise<'overwrite' | 'skip' | 'backup' | 'abort'> {
  const choice = await select({
    message: `⚠️ 文件冲突: ${targetPath} 已存在（用户手写文件）`,
    choices: [
      { name: '备份后覆盖（推荐）', value: 'backup' },
      { name: '直接覆盖', value: 'overwrite' },
      { name: '跳过此文件', value: 'skip' },
      { name: '查看差异', value: 'diff' },
      { name: '中止安装', value: 'abort' },
    ],
  });

  if (choice === 'diff') {
    // 显示简要差异后重新询问
    await showDiff(sourcePath, targetPath, reporter);
    return resolveConflict(targetPath, sourcePath, reporter);
  }

  return choice as 'overwrite' | 'skip' | 'backup' | 'abort';
}
```

### 冲突处理集成到安装流程

```typescript
// 在 installSingleItem 中
const conflict = await checkConflict(targetPath, sourceHash, manifest);

if (conflict === 'user-file') {
  if (args.force) {
    // --force: 直接覆盖
  } else if (!process.stdin.isTTY) {
    throw new AiforgeError('文件冲突需要交互式终端', 'CONFLICT_NON_TTY', 1, 'fatal', ...);
  } else {
    const decision = await resolveConflict(targetPath, sourcePath, reporter);
    switch (decision) {
      case 'backup': await backupFile(targetPath); break;
      case 'skip': return { ...result, status: 'skipped' };
      case 'abort': throw new AiforgeError('用户中止安装', 'USER_ABORT', 1, 'fatal', ...);
      case 'overwrite': break; // 继续安装
    }
  }
} else if (conflict === 'aiforge-current') {
  return { ...result, status: 'skipped' }; // 已是最新
}
```

### 零结果诊断 [Source: FR-032]

```
⚠️ 未安装任何文件

诊断信息：
  扫描目录: agents/, skills/, instructions/, mcp-tools/
  匹配规则: copilot:global (3 条)
  所有文件已是最新或被跳过

建议：
  1. 使用 --force 强制重新安装
  2. 检查知识仓库是否有新内容
```

### 临时文件清理

```typescript
const tmpFiles: string[] = [];

try {
  // ... 安装逻辑，记录创建的临时文件到 tmpFiles
} finally {
  for (const tmp of tmpFiles) {
    try { await unlink(tmp); } catch { /* 忽略清理失败 */ }
  }
}
```

### 模块边界

- 扩展 `stages/execute-install.ts`
- 依赖 `@inquirer/prompts`（交互式选择）
- 依赖 `services/fs-utils.ts`（backupFile）
- 依赖 `services/manifest.ts`（checkConflict）

### 依赖关系

- 依赖 Story 4.1（`backupFile` 工具函数）
- 依赖 Story 4.2/4.3（execute-install 基础框架）
- 依赖 Story 4.4（`checkConflict`、`loadManifest`）
- 被 Story 4.6a（管道编排集成）依赖

### 本 Story 不做的事

- 不实现文件差异的详细 diff 视图（MVP 只显示文件大小和修改时间对比）
- 不实现"记住选择"功能（每次冲突都询问）
- 不实现批量冲突解决（逐个处理）

### References

- [Source: architecture/03-core-decisions.md#D4] — 错误处理和 severity
- [Source: architecture/04-implementation-patterns.md] — 错误创建模式
- [Source: project-context.md#Critical-Dont-Miss-Rules] — 非 TTY 环境处理

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
