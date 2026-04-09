# Story 4.1: 文件操作工具与预检查

Status: done

## Story

As a 用户,
I want 系统在安装前验证目标路径的可写性和权限,
So that 不会在安装过程中因权限问题半途失败。

## Acceptance Criteria

1. **Given** `services/fs-utils.ts` 已创建 **When** 检查提供的工具函数 **Then** 包含：文件复制、目录复制、符号链接创建、文件备份、权限检查等操作，所有路径操作使用 `path.join()`（NFR-C5）
2. **Given** `MatchedPlan` 中包含多个目标路径 **When** 执行预检查（preflight）**Then** 验证所有目标路径的父目录可写，验证当前用户有足够权限创建/覆盖文件（FR-030）
3. **Given** 目标目录不存在 **When** 执行预检查 **Then** 标记该目录需要创建（NFR-R2）
4. **Given** 某个目标路径无写入权限 **When** 预检查失败 **Then** 立即 fail-fast，抛出 `AiforgeError`（severity: 'fatal'），不执行任何文件操作
5. **Given** 目标路径包含 `../` 路径遍历 **When** 执行预检查 **Then** 检测到路径遍历并拒绝，抛出安全错误（NFR-S5）

## Tasks / Subtasks

- [x] Task 1: 创建 `src/services/fs-utils.ts` — 文件操作工具集 (AC: #1)
  - [x] 1.1 实现 `copyFile(src: string, dest: string): Promise<void>` — 单文件复制
  - [x] 1.2 实现 `copyDir(src: string, dest: string): Promise<void>` — 递归目录复制
  - [x] 1.3 实现 `createSymlink(target: string, linkPath: string): Promise<void>` — 符号链接创建
  - [x] 1.4 实现 `backupFile(filePath: string): Promise<string>` — 备份文件，返回备份路径
  - [x] 1.5 实现 `ensureDir(dirPath: string): Promise<void>` — 确保目录存在（递归创建）
  - [x] 1.6 实现 `isWritable(dirPath: string): Promise<boolean>` — 检查目录可写性
  - [x] 1.7 实现 `fileHash(filePath: string): Promise<string>` — 计算文件 SHA256 hash
  - [x] 1.8 所有路径操作使用 `path.join()`，不拼接字符串
- [x] Task 2: 实现预检查逻辑 (AC: #2-5)
  - [x] 2.1 实现 `preflight(plan: MatchedPlan, pathResolver: PathResolver): Promise<PreflightResult>`
  - [x] 2.2 路径遍历检测：目标路径 `resolve()` 后必须在预期根目录下
  - [x] 2.3 可写性检查：对每个目标路径的父目录执行 `fs.access(dir, fs.constants.W_OK)`
  - [x] 2.4 不存在目录标记：记录需要创建的目录列表
  - [x] 2.5 fail-fast：首个不可写路径即抛出 `AiforgeError(code: 'PERMISSION_DENIED', severity: 'fatal')`
- [x] Task 3: 编写单元测试 (AC: #1-5)
  - [x] 3.1 `tests/services/fs-utils.test.ts` — 各工具函数的正常和异常路径
  - [x] 3.2 预检查测试：可写路径通过、不可写路径 fail-fast、路径遍历拒绝、不存在目录标记
  - [x] 3.3 使用临时目录（`os.tmpdir()`）进行真实文件操作测试

## Dev Notes

### 权限判定矩阵

preflight 对每个目标路径的判定规则：

| 目标状态 | 判定方式 | 结果 |
|---------|---------|------|
| 目标不存在，父目录可写 | `fs.access(parentDir, W_OK)` | 通过，标记需创建 |
| 目标不存在，父目录不可写 | `fs.access(parentDir, W_OK)` 失败 | fail-fast |
| 目标为文件，可写 | `fs.access(targetPath, W_OK)` | 通过（覆盖由冲突检测 Story 4.4/4.5 决定） |
| 目标为文件，不可写 | `fs.access(targetPath, W_OK)` 失败 | fail-fast |
| 目标为目录 | `fs.stat` 检测 | 通过（directories 类型正常，files 类型由冲突检测处理） |
| 目标为符号链接 | `fs.lstat` 检测 | 通过（symlink 模式会先删除再创建） |

注意：preflight 只做权限和路径安全校验，不做冲突判定——冲突判定是 Story 4.4/4.5 的职责。

### 预检查是 Install 阶段的第一步 [Source: architecture/03-core-decisions.md#D6]

预检查不是独立管道阶段，而是 `execute-install.ts` 的第一步。但工具函数和预检查逻辑放在 `services/fs-utils.ts` 中，供 Install 阶段调用。

```typescript
// execute-install.ts 中的调用顺序
export async function executeInstall(plan: MatchedPlan, ...): Promise<InstallResult[]> {
  // Step 1: 预检查（本 Story）
  await preflight(plan, pathResolver);

  // Step 2: 执行安装（Story 4.2/4.3）
  // ...
}
```

### 路径遍历检测 [Source: NFR-S5]

`allowedRoot` 来源于 PathResolver 和安装 scope，与目标路径解析使用同一套来源：
- 全局安装：`allowedRoot = pathResolver.home()`
- 项目安装：`allowedRoot = process.cwd()`

```typescript
import { resolve, join } from 'node:path';

function validatePath(targetPath: string, allowedRoot: string): void {
  const resolved = resolve(targetPath);
  const root = resolve(allowedRoot);
  if (!resolved.startsWith(root + '/') && resolved !== root) {
    throw new AiforgeError(
      '检测到路径遍历攻击',
      'PATH_TRAVERSAL',
      3,
      'fatal',
      `目标路径 ${targetPath} 超出允许范围 ${allowedRoot}`,
      ['检查安装规则中的 targetDir 配置']
    );
  }
}
```

### 备份文件命名 [Source: FR-028]

```typescript
function getBackupPath(filePath: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${filePath}.aiforge-backup-${date}`;
}
```

### 文件 hash 计算

```typescript
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

async function fileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}
```

### 模块边界

- `services/fs-utils.ts` 只依赖 `core/`（errors、types）和 Node.js 内置模块
- 不依赖 `stages/`、`data/`、`commands/`
- 被 `stages/execute-install.ts`（Story 4.2/4.3）和 `services/manifest.ts`（Story 4.4）调用

### 依赖关系

- 依赖 Story 1.2（`AiforgeError`、`MatchedPlan` 类型）
- 依赖 Story 1.3（`PathResolver`）
- 被 Story 4.2（复制模式）、4.3（符号链接/flatten）、4.4（manifest hash）、4.5（备份）依赖

### 本 Story 不做的事

- 不实现安装执行逻辑（Story 4.2/4.3）
- 不实现 manifest 管理（Story 4.4）
- 不实现冲突交互（Story 4.5）

### References

- [Source: architecture/03-core-decisions.md#D6] — 预检查作为 Install 第一步
- [Source: architecture/05-project-structure.md] — services/fs-utils.ts 位置
- [Source: project-context.md#Security-Rules] — 路径遍历防护
- [Source: project-context.md#Error-Handling-Rules] — fail-fast 和三段式错误

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (2026-03-25)

### Debug Log References

- `fileHash` 使用 `node:fs` 的 `createReadStream`（同步模块），不用 `node:fs/promises` — ESM 中流式读取需要同步 API
- `checkTargetWritability` 对 EACCES 降级为 null（而非抛出）：macOS 上对只读目录下的子路径调用 `lstat` 也会报 EACCES，按 ENOENT 处理更符合"目标不存在"语义，可写性问题会在后续 `isWritable` 检查中被发现
- `findExistingAncestor` 向上遍历找到第一个存在的祖先目录，解决嵌套不存在目录（如 `/a/b/c` 全不存在）时无法直接对父目录调 `isWritable` 的问题

### Completion Notes List

- 实现 `src/services/fs-utils.ts`，包含：`copyFile`、`copyDir`、`createSymlink`、`backupFile`、`ensureDir`、`isWritable`、`fileHash`、`preflight` 及 `PreflightResult` 接口
- 所有路径操作使用 `path.join()`/`path.dirname()`/`path.resolve()`，无字符串拼接（AC #1）
- `preflight` 实现路径遍历检测（NFR-S5）、父目录可写性检查（FR-030）、不存在目录标记（NFR-R2）、fail-fast PERMISSION_DENIED（AC #4）
- 测试文件 `tests/services/fs-utils.test.ts`：30 个测试用例，覆盖所有 AC（正常路径 + 负向路径）
- 全仓测试：431 passed（原 401 + 新增 30）
- Lint：0 errors，0 warnings
- **CR Round-1 修复（2026-03-25）**：
  - `findExistingAncestor` 增加 `isDirectory()` 检查，非目录条目抛 `PATH_NOT_DIRECTORY`
  - `ensureDir` 包裹 `AiforgeError(ENSURE_DIR_FAILED)`
  - `preflight` 恢复双参签名，内部由 `pathResolver.home()` / `process.cwd()` 推导 `allowedRoot`
  - 测试文件清理 5 个 lint 未使用符号；新增 2 个负向测试（`ENSURE_DIR_FAILED`、`PATH_NOT_DIRECTORY`）；`pathResolver` 改为 stub 注入
  - 全仓测试：433 passed（原 431 + 新增 2）；Lint：0 errors
- **CR Round-2/3 修复（2026-03-26）**：
  - **P0 symlink 逃逸修复**：新增 `validateAncestorRealpath()` 函数，对 `findExistingAncestor()` 返回的已存在祖先目录和 `allowedRoot` 分别做 `realpath()`，然后做双边 `startsWith` 比较，防止路径链中的 symlink 将实际落点引到 `allowedRoot` 之外（NFR-S5 深度防护）
  - **P1 POSIX 精确性修复**：`isWritable()` 由 `W_OK` 改为 `W_OK | X_OK`，正确检测"有写权限但无遍历权限（如 `0o222`）"的目录，避免 preflight 误报
  - `checkTargetWritability()` 函数签名增加 `allowedRoot` 参数，以便传递给 `validateAncestorRealpath()`
  - 从 `node:fs/promises` 新增 import `realpath`
  - 新增 3 条测试：`isWritable` P1 (`0o222` 目录返回 false)、`preflight` P0-A（targetPath 是指向外部的 symlink 抛 PATH_TRAVERSAL）、`preflight` P0-B（路径链祖先是指向外部的 symlink 抛 PATH_TRAVERSAL）
  - 全仓测试：**439 passed**（原 436 + 新增 3）；Lint：0 errors；Build：success
- **CR Round-4 修复（2026-03-26）**：
  - **P0 完整性补丁**：`checkTargetWritability()` 的 `isSymbolicLink()` 分支和 `isDirectory()` 分支均增加 `validateAncestorRealpath(targetPath, allowedRoot)` 调用，修复"目标已存在"路径无 realpath 校验的逃逸漏洞
  - `isSymbolicLink()` 分支特殊处理 broken symlink（先 `stat()` 检查目标存在性，broken symlink 跳过 realpath 直接通过）
  - 更新 `checkTargetWritability()` JSDoc，精确描述各分支处理逻辑
  - 新增 1 条回归测试：`targetPath` 本身是现存 symlink 指向外部 → 抛 `PATH_TRAVERSAL`（覆盖 `isSymbolicLink()` 分支逃逸场景）
  - 全仓测试：**440 passed**（原 439 + 新增 1）；Lint：0 errors；Build：success

### File List

- `src/services/fs-utils.ts` — 新增
- `tests/services/fs-utils.test.ts` — 新增

## Change Log

- 2026-03-25: Story 4-1 实现完成。新增 `src/services/fs-utils.ts`（文件操作工具集 + preflight 预检查逻辑），新增 `tests/services/fs-utils.test.ts`（30 个测试用例）。全仓 431 个测试全部通过，Lint 无报错。
- 2026-03-25: CR Round-1 修复。`findExistingAncestor` 增加 isDirectory 检查，`ensureDir` 包裹 AiforgeError，`preflight` 恢复双参签名，清理测试 lint。全仓 433 个测试全部通过，Lint 0 error。
- 2026-03-26: CR Round-2/3 修复（P0+P1+P2）。新增 `validateAncestorRealpath()` 修复 symlink 逃逸安全漏洞；`isWritable()` 改为 `W_OK | X_OK` 提升 POSIX 精确性；新增 3 条测试覆盖新修复点。全仓 439 个测试全部通过，Lint 0 error，Build success。
- 2026-03-26: CR Round-4 修复（P0 完整性补丁）。扩展 `checkTargetWritability()` 的 `isSymbolicLink()` 和 `isDirectory()` 分支，对现存目标路径调用 `validateAncestorRealpath()` 做 realpath 安全校验，修复 Round 3 P0 修复遗漏的"目标已存在"逃逸路径；`isSymbolicLink()` 分支特殊处理 broken symlink（跳过 realpath，直接通过）；新增 1 条回归测试（targetPath 本身是现存 symlink 指向外部 → 抛 PATH_TRAVERSAL）。全仓 **440 passed**，Lint 0 error，Build success。