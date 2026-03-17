# Story 2.4: Git 克隆与增量更新

Status: ready-for-dev

## Story

As a 用户,
I want 快速获取知识仓库内容到本地,
So that 首次克隆高效，后续更新只拉取变更。

## Acceptance Criteria

1. **Given** 本地无该仓库的副本 **When** 执行克隆 **Then** 使用浅克隆（`--depth 1`）最小化网络传输（FR-003），克隆到 `~/.aiforge/repos/{repo-name}/`（FR-005）
2. **Given** 本地已有该仓库的副本 **When** 执行获取 **Then** 执行 `git pull` 增量更新，而非全量重新克隆（FR-004）
3. **Given** 用户通过 `--clone-dir <path>` 指定自定义路径 **When** 执行克隆 **Then** 克隆到用户指定的路径
4. **Given** 克隆过程中网络中断 **When** 克隆失败 **Then** 清理不完整的克隆目录（NFR-R1），抛出 `AiforgeError`（severity: 'fatal'）含网络错误修复建议
5. **Given** Token 被注入到克隆 URL 中 **When** 克隆完成 **Then** Token 从内存中立即清除（NFR-S2），`.git/config` 中不包含 Token
6. **Given** 首次克隆 aicoding-base 规模仓库 **When** 测量总耗时 **Then** < 30 秒（NFR-P1）
7. **Given** 已有本地仓库执行增量更新 **When** 测量总耗时 **Then** < 15 秒（NFR-P2）

## Tasks / Subtasks

- [ ] Task 1: 创建 `src/stages/clone.ts` — Clone 管道阶段 (AC: #1-5)
  - [ ] 1.1 实现 `cloneRepo(source: AuthenticatedSource, args: ParsedArgs, reporter: Reporter): Promise<LocalRepo>`
  - [ ] 1.2 计算克隆目标路径：`args.cloneDir` || `pathResolver.reposDir()` + repo-name
  - [ ] 1.3 repo-name 提取：从 `source.repoPath` 取最后一段（如 `org/aicoding-base` → `aicoding-base`）
  - [ ] 1.4 判断本地是否已有仓库：检查目标路径是否存在且包含 `.git` 目录
  - [ ] 1.5 首次克隆：`git.clone(source.cloneUrl, targetDir, ['--depth', '1'])`
  - [ ] 1.6 增量更新：`git.cwd(targetDir).pull()`
  - [ ] 1.7 克隆完成后清理 Token：重写 remote URL 为不含 Token 的版本
  - [ ] 1.8 失败清理：克隆失败时删除不完整的目标目录
  - [ ] 1.9 返回 `LocalRepo` 对象：`{ repoDir, isNew, sourceFiles }`
  - [ ] 1.10 调用 `reporter.startPhase('克隆仓库...')` 输出进度
- [ ] Task 2: 实现 Token 清理逻辑 (AC: #5)
  - [ ] 2.1 克隆完成后：`git.remote(['set-url', 'origin', sanitizedUrl])`
  - [ ] 2.2 验证 `.git/config` 不含 Token
  - [ ] 2.3 将 `source.cloneUrl` 中的 Token 引用置空（内存清除）
- [ ] Task 3: 实现源文件扫描 (AC: #1)
  - [ ] 3.1 克隆/更新后扫描仓库根目录，列出顶层目录和文件
  - [ ] 3.2 排除 `.git`、`DEFAULT_EXCLUDES` 中的文件
  - [ ] 3.3 返回 `sourceFiles: string[]`（相对路径列表）
- [ ] Task 4: 编写单元测试 (AC: #1-5)
  - [ ] 4.1 `tests/stages/clone.test.ts`
  - [ ] 4.2 测试用例：首次浅克隆、增量 pull、自定义路径、失败清理、Token 清理、源文件扫描
  - [ ] 4.3 Mock simple-git（`clone`、`pull`、`remote`、`cwd`）、mock fs 操作

## Dev Notes

### LocalRepo 类型 [Source: core/types.ts, Story 1.2]

```typescript
interface LocalRepo {
  repoDir: string;        // 本地仓库绝对路径
  isNew: boolean;         // true=首次克隆, false=增量更新
  sourceFiles: string[];  // 仓库中的顶层文件/目录列表（排除 .git 和 excludes）
}
```

### 克隆路径计算

```typescript
function getCloneDir(source: AuthenticatedSource, args: ParsedArgs, pathResolver: PathResolver): string {
  if (args.cloneDir) return args.cloneDir;
  const repoName = source.repoPath.split('/').pop()!;
  return join(pathResolver.reposDir(), repoName);
}
```

`pathResolver.reposDir()` 返回 `~/.aiforge/repos/`，不硬编码。

### Token 清理流程 [Source: project-context.md#Security-Rules]

```
克隆完成 → git remote set-url origin <clean-url> → 验证 .git/config → 清空内存引用
```

clean-url 为不含 Token 的 HTTPS URL 或 SSH URL。这确保：
- `.git/config` 中不泄露 Token
- 后续 `git pull` 使用系统凭据或 SSH（不依赖嵌入的 Token）

### 失败清理 [Source: NFR-R1]

```typescript
try {
  await git.clone(source.cloneUrl, targetDir, ['--depth', '1']);
} catch (error) {
  // 清理不完整的克隆目录
  if (await exists(targetDir)) {
    await rm(targetDir, { recursive: true, force: true });
  }
  throw new AiforgeError(
    '克隆仓库失败',
    'CLONE_FAILED',
    1,
    'fatal',
    error instanceof Error ? error.message : '未知网络错误',
    [
      'npx aiforge --ssh  # 尝试 SSH 认证',
      'git clone <url>  # 手动测试 Git 连接',
      '检查网络连接和防火墙设置'
    ]
  );
}
```

注意：只清理首次克隆失败的目录。增量更新失败不删除已有仓库。

### simple-git 使用 [Source: services/git.ts, Story 2.2]

使用 Story 2.2 创建的 `createGit()` 工厂函数：
```typescript
import { createGit } from '../services/git.js';

const git = createGit();
await git.clone(url, dir, ['--depth', '1']);

// 增量更新
const repoGit = createGit(targetDir);
await repoGit.pull();
```

### 性能要求

- 首次克隆 < 30 秒（NFR-P1）：浅克隆 `--depth 1` 保证
- 增量更新 < 15 秒（NFR-P2）：`git pull` 只拉取差异

### 模块边界

- `stages/clone.ts` 依赖 `core/`（types、errors、sanitize）、`services/git.ts`、`data/excludes.ts`
- 使用 `PathResolver` 获取 repos 目录路径

### 依赖关系

- 依赖 Story 1.2（`LocalRepo`、`AuthenticatedSource` 类型、`AiforgeError`）
- 依赖 Story 1.3（`Reporter`、`PathResolver`）
- 依赖 Story 1.4（`DEFAULT_EXCLUDES`）
- 依赖 Story 2.2（`createGit` 工厂函数）
- 依赖 Story 2.3（`AuthenticatedSource` 作为输入）
- 被 Epic 3（检测阶段）依赖（输出 LocalRepo）

### 本 Story 不做的事

- 不实现分支切换或 tag 检出（MVP 只用默认分支）
- 不实现并行克隆多个仓库
- 不实现克隆进度条（simple-git 的 progress 事件复杂，MVP 用 spinner 即可）

### References

- [Source: architecture/03-core-decisions.md#D6] — 管道阶段类型签名
- [Source: architecture/05-project-structure.md] — 数据流 AuthenticatedSource → LocalRepo
- [Source: project-context.md#Security-Rules] — Token 内存清除、.git/config 安全
- [Source: project-context.md#Error-Handling-Rules] — 三段式错误信息

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
