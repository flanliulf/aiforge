# Story 4.3: 符号链接与 flatten 模式

Status: done

## Story

As a 用户,
I want 使用符号链接模式实现 git pull 即更新，使用 flatten 模式适配 Cursor 的目录约定,
So that 日常更新零额外操作，且每个工具都能正确读取配置。

## Acceptance Criteria

1. **Given** 用户指定 `-g -l`（全局 + 符号链接）**When** 执行安装 **Then** 在目标位置创建指向持久化仓库文件的符号链接（FR-020），后续 `git pull` 自动更新
2. **Given** 用户指定 `-l` 但未指定 `-g`（项目级 + 符号链接）**When** 解析参数 **Then** 拒绝执行，抛出 `AiforgeError`（severity: 'fatal'），提示符号链接仅支持全局安装（FR-021）
3. **Given** Cursor 工具的 skills 规则（`type: 'flatten'`）**When** 执行安装 **Then** 将 `skills/code-review/` 目录扁平化：提取主文件（如 `index.md`），重命名为 `code-review.md`，复制到 `.cursor/rules/`（FR-022）
4. **Given** flatten 模式下源目录包含多个文件 **When** 执行安装 **Then** 按 `mainFile` 规则选择主文件（默认 `index.md`），其他文件忽略
5. **Given** 符号链接目标文件被删除（源仓库被移动）**When** 检查链接状态 **Then** 检测到断链并输出明确警告（NFR-R6）

## Tasks / Subtasks

- [x] Task 1: 扩展 `src/stages/execute-install.ts` — 添加 symlink 模式 (AC: #1, #2, #5)
  - [x] 1.1 在 `executeInstall` 中添加模式判定：`args.link && scope === 'global'` → symlink
  - [x] 1.2 `-l` 无 `-g` 校验：在管道早期（CLI 解析后或 Install 入口）拒绝
  - [x] 1.3 symlink 的 `files` 类型：`createSymlink(sourceAbsPath, join(targetDir, filename))`
  - [x] 1.4 symlink 的 `directories` 类型：`createSymlink(sourceAbsPath, join(targetDir, dirname))`
  - [x] 1.5 已存在的符号链接：先删除旧链接再创建新链接
  - [x] 1.6 断链检测：安装完成后检查所有新建链接的有效性
- [x] Task 2: 扩展 `src/stages/execute-install.ts` — 添加 flatten 模式 (AC: #3, #4)
  - [x] 2.1 `flatten` 类型处理：遍历 sourceFiles（子目录），在每个子目录中查找 `rule.mainFile`（默认 `index.md`）
  - [x] 2.2 重命名逻辑：`skills/code-review/index.md` → `code-review.md`
  - [x] 2.3 复制到目标目录：`copyFile(mainFilePath, join(targetDir, dirName + '.md'))`
  - [x] 2.4 主文件不存在时：跳过该子目录，通过 `reporter.warn()` 记录警告，生成 `status: 'skipped'` 结果项，不写入 manifest
- [x] Task 3: 编写单元测试 (AC: #1-5)
  - [x] 3.1 扩展 `tests/stages/execute-install.test.ts`
  - [x] 3.2 测试用例：symlink files、symlink directories、-l 无 -g 拒绝、flatten 重命名、mainFile 缺失跳过、断链检测
  - [x] 3.3 使用临时目录进行真实 symlink 和文件操作测试

## Dev Notes

### symlink 模式 [Source: FR-020, FR-021]

```typescript
function getInstallMode(args: ParsedArgs, scope: 'global' | 'project'): 'copy' | 'symlink' {
  if (args.link) {
    if (scope !== 'global') {
      throw new AiforgeError(
        '符号链接模式仅支持全局安装',
        'LINK_PROJECT_DENIED',
        3,
        'fatal',
        '符号链接 (-l) 必须与全局安装 (-g) 一起使用',
        ['npx aiforge -g -l  # 全局 + 符号链接']
      );
    }
    return 'symlink';
  }
  return 'copy';
}
```

symlink 指向仓库中的源文件绝对路径，`git pull` 更新仓库后链接自动指向新内容。

### flatten 模式 [Source: FR-022]

```
源结构:                          目标结构:
skills/                          .cursor/rules/
├── code-review/                 ├── code-review.md    (← index.md)
│   ├── index.md                 ├── refactor.md       (← index.md)
│   └── examples.md              └── testing.md        (← index.md)
├── refactor/
│   └── index.md
└── testing/
    └── index.md
```

```typescript
async function installFlatten(
  item: MatchedItem,
  mode: 'copy' | 'symlink'
): Promise<InstallResult[]> {
  const results: InstallResult[] = [];
  const mainFile = item.rule.mainFile || 'index.md';

  for (const dir of item.sourceFiles) {
    const mainPath = join(dir.absolutePath, mainFile);
    const targetName = dir.relativePath + '.md';
    const targetPath = join(item.targetDir, targetName);

    try {
      await access(mainPath);
    } catch {
      // 主文件不存在，跳过
      continue;
    }

    if (mode === 'symlink') {
      await createSymlink(mainPath, targetPath);
    } else {
      await copyFile(mainPath, targetPath);
    }

    results.push({
      sourcePath: mainPath,
      targetPath,
      tool: item.rule.tool,
      status: await determineStatus(mainPath, targetPath),
      mode,
    });
  }
  return results;
}
```

### 断链检测 [Source: NFR-R6]

```typescript
import { lstat, readlink } from 'node:fs/promises';

async function checkBrokenLinks(results: InstallResult[]): Promise<void> {
  for (const r of results.filter(r => r.mode === 'symlink')) {
    try {
      const target = await readlink(r.targetPath);
      await access(target);
    } catch {
      reporter.warn(`⚠️ 断链: ${r.targetPath} → 目标文件不存在`);
    }
  }
}
```

### 模块边界

- 扩展 `stages/execute-install.ts`（Story 4.2 创建的文件）
- 使用 `services/fs-utils.ts` 的 `createSymlink`、`copyFile`

### 依赖关系

- 依赖 Story 4.1（`createSymlink`、`copyFile` 工具函数）
- 依赖 Story 4.2（`execute-install.ts` 基础框架）
- 被 Story 4.4（manifest 需要记录 mode: symlink）依赖

### 本 Story 不做的事

- 不实现 symlink 的跨文件系统检测（MVP 假设同一文件系统）
- 不实现 flatten 的多文件合并（只取 mainFile）
- 不实现 Windows 符号链接权限处理（延迟决策，M2）

### References

- [Source: architecture/03-core-decisions.md#D6] — 管道阶段设计
- [Source: architecture/04-implementation-patterns.md] — 错误创建模式
- [Source: project-context.md#Critical-Dont-Miss-Rules] — symlink 仅全局（FR-021）

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4 (via Claude Code)

### Debug Log References

无异常。全部测试一次通过，无 regression。

### Completion Notes List

**Task 1 — symlink 模式 (AC #1, #2, #5):**
- 在 `executeInstall` 中通过 `item.mode === 'symlink'` 分发到 symlink 路径
- Files 类型 symlink：`createSymlink(srcPath, join(targetPath, basename(srcPath)))`
- Directories 类型 symlink：`createSymlink(srcPath, join(targetPath, basename(srcPath)))`
- 新增 `determineSymlinkStatus()` 函数：通过 `readlink()` 对比链接目标路径判断 new/updated/skipped
- 新增 `checkBrokenLinks()` 函数：安装完成后检测所有 symlink 的链接有效性
- AC #2 `-l` 无 `-g` 拒绝已由 Story 3.2 在 `match-rules.ts` 的 `getInstallMode()` 中实现

**Task 2 — flatten 模式 (AC #3, #4):**
- 在 `executeInstall` 中新增 `InstallType.Flatten` 分支
- 从每个子目录提取 `mainFile`（默认 `index.md`），扁平化重命名为 `dirname.md`
- 支持 `rule.mainFile` 自定义主文件名
- 主文件不存在时：通过 `reporter.warn()` 记录警告，`status: 'skipped'`，不执行安装
- flatten + symlink 组合模式正确支持
- `InstallRule` 接口新增 `mainFile?: string` 可选字段

**测试覆盖:**
- Story 4.3 新增 13 个测试用例（20 → 33），全仓 473 个测试通过
- 测试覆盖：symlink files (new/skipped/updated)、symlink directories、flatten copy (new/skipped/多子目录)、flatten mainFile 缺失跳过、自定义 mainFile、flatten + symlink、断链检测（有效/无效/copy 不触发）
- 使用临时目录进行真实文件系统操作

### File List

- `src/stages/execute-install.ts` — 扩展支持 symlink 和 flatten 模式
- `src/core/types.ts` — `InstallRule` 新增 `mainFile?: string` 字段
- `tests/stages/execute-install.test.ts` — 新增 13 个测试用例
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — 状态更新

### Change Log

- 2026-03-28: Story 4.3 实现完成 — symlink 模式（files/directories/断链检测）+ flatten 模式（扁平化重命名 + mainFile 自定义 + 缺失跳过）+ 13 个新测试
