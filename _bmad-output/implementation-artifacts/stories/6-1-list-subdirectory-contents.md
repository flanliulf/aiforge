# Story 6.1: `--list` 子目录内容列举

Status: ready-for-dev

## Story

As a 开发者,
I want 在执行安装之前，通过 `aiforge install --list <dir>` 列出仓库指定顶层目录下所有可安装的子目录,
So that 我清楚地知道可以选择安装哪些内容，再决定是否使用 `--filter`。

## Acceptance Criteria

1. **Given** 用户已配置仓库（本地或远端），仓库中存在 `skills/` 目录，其下有 `git-commit/`、`code-review/`、`deploy/` 三个子目录 **When** 用户执行 `aiforge install --list skills` **Then** 终端输出 `skills/` 下的所有子目录名称列表（如 `git-commit`、`code-review`、`deploy`），输出格式清晰（每行一个条目，带序号），不执行任何安装操作，命令在输出后正常退出（exit code 0）
2. **Given** 用户执行 `aiforge install --list nonexistent-dir`（指定目录在仓库中不存在）**When** 命令执行 **Then** 输出三段式错误提示：目录不存在 → 仓库中没有该顶层目录 → 建议用 `--list` 搭配其他可用顶层目录名重试
3. **Given** 用户执行 `aiforge install --list skills`，`skills/` 目录存在但为空（无子目录）**When** 命令执行 **Then** 输出提示"该目录下暂无可安装的子目录"，正常退出（exit code 0），不报错
4. **Given** 仓库为远端仓库（需 Clone，但持久化缓存已存在）**When** 用户执行 `--list` 命令 **Then** 总耗时不超过 2 秒（缓存命中场景），满足 NFR-P6

## Tasks / Subtasks

- [ ] Task 1: 扩展 `ParsedArgs` 和 CLI 参数解析 (AC: #1)
  - [ ] 1.1 在 `src/core/types.ts` 的 `ParsedArgs` 接口中添加 `list?: string` 字段（可选，值为用户指定的顶层目录名）
  - [ ] 1.2 在 `src/index.ts` 的 commander 定义中添加 `--list <dir>` 选项：`.option('--list <dir>', 'list installable subdirectories under a top-level dir')`
  - [ ] 1.3 在 `src/pipeline.ts` 的 `mapOptsToArgs()` 中映射 `list` 字段：`list: opts['list'] as string | undefined`
  - [ ] 1.4 注意：CLI help 文案使用英文硬编码（不通过 `msg()` 获取，遵循项目规则 — Commander 在模块加载时求值 description）

- [ ] Task 2: 实现 `--list` 命令的管道分叉逻辑 (AC: #1, #4)
  - [ ] 2.1 在 `src/pipeline.ts` 的 `runPipeline()` 中，在 `clone` 阶段完成后检查 `args.list`：若非空，跳过 Detect/Match/Install/Report 阶段，转入 list 专用流程
  - [ ] 2.2 list 流程：读取 `repo.repoDir` 下指定目录的子目录列表 → 通过 Reporter 输出 → 退出
  - [ ] 2.3 管道分叉点在 `clone` 之后、`detect` 之前（`--list` 需要仓库内容但不需要工具检测）
  - [ ] 2.4 分叉逻辑抽取为独立函数 `handleListCommand(repo, args, reporter)` 放在 `src/stages/list-contents.ts` 中，保持 pipeline.ts 的编排职责清晰

- [ ] Task 3: 实现 `list-contents.ts` 阶段模块 (AC: #1, #2, #3)
  - [ ] 3.1 创建 `src/stages/list-contents.ts`，导出 `listContents(repo: LocalRepo, args: ParsedArgs, reporter: Reporter): Promise<void>`
  - [ ] 3.2 遵循 Reporter 生命周期契约：`reporter.startPhase(msg('phases.list'))` → 逻辑 → `reporter.completePhase()`
  - [ ] 3.3 读取 `join(repo.repoDir, args.list!)` 目录，使用 `readdir({ withFileTypes: true })` 获取子目录列表
  - [ ] 3.4 过滤：只保留 `isDirectory()` 且不在 `DEFAULT_EXCLUDES` 中的条目
  - [ ] 3.5 目录不存在（ENOENT/ENOTDIR）处理：扫描 `repo.repoDir` 获取所有可用顶层目录列表，抛出 `AiforgeError`，错误码 `LIST_DIR_NOT_FOUND`，`fix[]` 中列出可用的顶层目录名建议用户用 `--list` 重试（AC #2）
  - [ ] 3.6 目录存在但无子目录：调用 `reporter.completePhase()` 后调用 `reporter.reportList(args.list!, [])`，由 Reporter 以 stdout 输出"空目录"提示（成功态），正常退出（AC #3）——**禁止调用 `reporter.warn()`**（warn 走 stderr 通道，空目录是成功结果而非警告，CI 消费者会误判为错误）
  - [ ] 3.7 正常输出：**只通过 `reporter.reportList(args.list!, subdirs)` 输出**带序号的子目录列表（AC #1）——禁止直接 `process.stdout.write()`，所有用户可见输出必须经过 Reporter 接口（Task 4 已设计完整的三种 Reporter 实现，正确路径已存在）
  - [ ] 3.8 fs 错误处理遵循项目规则：ENOENT/ENOTDIR 降级，EACCES 等向上抛出

- [ ] Task 4: 扩展 Reporter 接口以支持 list 输出 (AC: #1)
  - [ ] 4.1 在 `src/core/reporter.ts` 的 `Reporter` 接口中添加 `reportList(dirName: string, entries: string[]): void` 方法
  - [ ] 4.2 `TtyReporter.reportList()`：输出标题行（带 chalk 着色）+ 带序号和图标的子目录列表
  - [ ] 4.3 `PlainReporter.reportList()`：每行一个条目（制表符分隔 `<index>\t<name>`），CI 友好
  - [ ] 4.4 `QuietReporter.reportList()`：仅输出目录名列表（无序号、无标题），极简模式
  - [ ] 4.5 空列表场景（AC #3）：**`reportList` 需处理 `entries.length === 0` 的情况**，输出 `msg('list.empty')` 到 stdout（而非 stderr/warn 通道），各 Reporter 实现均需支持空列表态

- [ ] Task 5: 添加 i18n 消息键 (AC: #1, #2, #3)
  - [ ] 5.1 在 `src/core/messages.ts` 的 `MessageSet` 接口中添加 `list` 分组
  - [ ] 5.2 添加中英文消息键：
    - `phases.list`：`"列出子目录..."` / `"Listing subdirectories..."`
    - `list.title`：`"📂 {dir}/ 下的可安装子目录："` / `"📂 Installable subdirectories under {dir}/:"` 
    - `list.empty`：`"该目录下暂无可安装的子目录"` / `"No installable subdirectories found"`
    - `list.dirNotFound`：`"目录 {dir} 在仓库中不存在"` / `"Directory {dir} does not exist in the repository"`
    - `list.dirNotFoundWhy`：`"仓库中没有名为 {dir} 的顶层目录"` / `"The repository has no top-level directory named {dir}"`
    - `list.fixTryOther`：`"尝试 --list 搭配以下可用目录: {dirs}"` / `"Try --list with one of these available directories: {dirs}"`

- [ ] Task 6: 编写单元测试 (AC: #1, #2, #3)
  - [ ] 6.1 创建 `tests/stages/list-contents.test.ts`
  - [ ] 6.2 测试用例：
    - 正常列举子目录（多个子目录），验证 `reporter.reportList()` 被正确调用
    - 目录不存在时抛出 `LIST_DIR_NOT_FOUND`，`fix[]` 中包含可用顶层目录
    - 目录存在但为空，验证输出提示信息
    - DEFAULT_EXCLUDES 中的条目被正确过滤
    - 文件（非目录）被过滤掉
    - EACCES 错误向上透传（不被降级为"目录不存在"）
  - [ ] 6.3 创建 `tests/core/reporter.test.ts` 扩展：测试 `reportList()` 在三种 Reporter 实现中的输出
  - [ ] 6.4 扩展 `tests/pipeline.test.ts`：`--list` 参数导致管道在 clone 后分叉，不执行 detect/match/install
  - [ ] 6.5 新增错误码 `LIST_DIR_NOT_FOUND` 必须有从真实创建模块入口触发的负向测试（禁止在 Reporter 层手工构造）

- [ ] Task 7: 质量门禁验证 (AC: #1-4)
  - [ ] 7.1 `npm test` — 全绿
  - [ ] 7.2 `npm run lint:src` — 退出码 0
  - [ ] 7.3 `npm run build` — 构建通过

## Dev Notes

### 管道分叉设计 [Source: architecture/03-core-decisions.md#D6]

`--list` 命令复用现有 Resolve → Auth → Clone 三个阶段获取仓库内容，然后在 Clone 之后分叉：

```
Resolve → Auth → Clone → [--list] → ListContents → Exit(0)
                      └→ [normal] → Detect → Match → [Install] → Report
```

这遵循了现有的 `dryRun` 分叉模式（在特定阶段后根据参数选择不同路径）。`runPipeline()` 中在 `const repo = await stages.clone(...)` 之后添加分叉：

```typescript
const repo = await stages.clone(authed, args, reporter)

// --list 分叉：列举子目录后退出，不进入 detect/match/install
if (args.list) {
  await listContents(repo, args, reporter)
  return
}

const env = await stages.detect(repo, args, reporter)
// ... 后续正常流程
```

### list-contents.ts 实现要点 [Source: match-rules.ts scanSourceFiles 模式]

复用 `match-rules.ts` 中 `scanSourceFiles()` 的目录读取模式（`readdir({ withFileTypes: true })`），但目的不同：

- `scanSourceFiles` 是为规则匹配服务，按 `InstallType` 区分文件/目录
- `listContents` 只需要列出子目录名称，逻辑更简单

```typescript
export async function listContents(
  repo: LocalRepo,
  args: ParsedArgs,
  reporter: Reporter,
): Promise<void> {
  reporter.startPhase(msg('phases.list'))

  const targetDir = join(repo.repoDir, args.list!)
  let entries: Dirent[]
  try {
    entries = await readdir(targetDir, { withFileTypes: true })
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      // 扫描仓库根目录获取可用顶层目录列表
      const available = await scanAvailableTopDirs(repo.repoDir)
      throw new AiforgeError(
        msg('list.dirNotFound').replace('{dir}', args.list!),
        'LIST_DIR_NOT_FOUND',
        EXIT_ARG_ERROR,
        'fatal',
        msg('list.dirNotFoundWhy').replace('{dir}', args.list!),
        [msg('list.fixTryOther').replace('{dirs}', available.join(', '))],
      )
    }
    throw error  // EACCES 等向上透传
  }

  const subdirs = entries
    .filter((e) => e.isDirectory() && !DEFAULT_EXCLUDES.includes(e.name))
    .map((e) => e.name)
    .sort()

  if (subdirs.length === 0) {
    // 空目录是成功态（不是警告/错误），走 stdout 通道，避免 CI 误判 stderr 输出
    reporter.completePhase()
    reporter.reportList(args.list!, [])  // Reporter 内部处理空列表时输出 msg('list.empty')（成功路径）
    return
  }

  reporter.completePhase()
  reporter.reportList(args.list!, subdirs)
}
```

### 可用顶层目录扫描辅助函数

```typescript
// 导出供 Story 6-2 零匹配处理复用，避免两处独立实现行为不一致
export async function scanAvailableTopDirs(repoDir: string): Promise<string[]> {
  try {
    const entries = await readdir(repoDir, { withFileTypes: true })
    return entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name)
      .sort()
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    // 仅对 ENOENT/ENOTDIR 降级为空数组（仓库根目录不存在/不可读），错误信息已由上层 AiforgeError 提供
    // EACCES 等其他错误透传（禁止裸 catch {} 静默吞掉权限错误）
    if (code === 'ENOENT' || code === 'ENOTDIR') return []
    throw error
  }
}
```

### Reporter.reportList() 输出格式

**TtyReporter：**
```
📂 skills/ 下的可安装子目录：

  1. 📁 code-review
  2. 📁 deploy
  3. 📁 git-commit
```

**PlainReporter（CI 友好）：**
```
1	code-review
2	deploy
3	git-commit
```

**QuietReporter：**
```
code-review
deploy
git-commit
```

### 模块边界 [Source: architecture/05-project-structure.md]

- `list-contents.ts` 放在 `src/stages/` 目录（属于管道阶段的变体）
- 依赖：`core/types.ts`、`core/errors.ts`、`core/reporter.ts`、`core/messages.ts`、`data/excludes.ts`
- 不依赖 `services/`（不需要 fs-utils 的安全校验功能，只是读取目录列表）
- 不依赖 `data/install-rules.ts`（不需要规则匹配）

### 错误处理要点 [Source: project-context.md — Error Handling Rules]

- 所有错误必须使用 `AiforgeError`，禁止 raw `Error`
- `LIST_DIR_NOT_FOUND` 使用 `EXIT_ARG_ERROR`（exit code 3）—— 这是参数错误（用户指定了不存在的目录）
- fs 读取使用 ENOENT/ENOTDIR 白名单降级，其他错误透传
- 三段式错误：目录不存在 → 仓库中没有该目录 → 建议可用目录名

### `--list` 与其他参数的互斥关系

`--list` 是只读探索命令，与安装相关参数互斥。在 `runPipeline()` 分叉点之后即返回，自然不会进入安装路径。但需要注意：
- `--list` + `--dry-run`：`--list` 本身不执行安装，`--dry-run` 无意义但不报错（静默忽略）
- `--list` + `--tools`/`--dirs`/`--filter`：同理，静默忽略
- `--list` + `--force`/`--link`：同理，静默忽略

不需要显式校验互斥——分叉后直接返回已天然隔离。

### 性能要求 [Source: NFR-P6]

`--list` 在持久化缓存命中场景下耗时 < 2 秒。由于复用 Resolve → Auth → Clone 管道，缓存命中时 Clone 阶段执行 `git pull`（增量更新），`listContents` 只做一次 `readdir`，整体耗时远低于 2 秒。无需额外优化。

### Project Structure Notes

- 新增文件：`src/stages/list-contents.ts`、`tests/stages/list-contents.test.ts`
- 修改文件：`src/core/types.ts`（ParsedArgs 扩展）、`src/index.ts`（CLI 选项）、`src/pipeline.ts`（分叉逻辑 + mapOptsToArgs）、`src/core/reporter.ts`（reportList 方法）、`src/core/messages.ts`（i18n 键）
- 测试文件镜像 src 结构：`tests/stages/list-contents.test.ts`
- **注意**：`scanAvailableTopDirs` 在 `list-contents.ts` 中以 `export` 导出，供 Story 6-2 的 `match-rules.ts` 零匹配处理引用（DRY 原则，避免两处独立实现过滤规则不一致）

### References

- [Source: epic-6.md — Story 6-1 Acceptance Criteria]
- [Source: architecture/03-core-decisions.md#D6 — 管道数据流与分叉设计]
- [Source: architecture/04-implementation-patterns.md — Pipeline Stage Patterns（Reporter 生命周期）]
- [Source: architecture/04-implementation-patterns.md — Error Handling Patterns]
- [Source: architecture/04-implementation-patterns.md — CLI Output Patterns（i18n 规则）]
- [Source: architecture/05-project-structure.md — 模块边界]
- [Source: project-context.md — Error Handling Rules、Output Rules]
- [Source: src/stages/match-rules.ts — scanSourceFiles() 目录读取模式]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
