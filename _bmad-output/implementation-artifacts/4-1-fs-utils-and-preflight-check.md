# Story 4.1: 文件操作工具与预检查

Status: ready-for-dev

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

- [ ] Task 1: 创建 `src/services/fs-utils.ts` — 文件操作工具集 (AC: #1)
  - [ ] 1.1 实现 `copyFile(src: string, dest: string): Promise<void>` — 单文件复制
  - [ ] 1.2 实现 `copyDir(src: string, dest: string): Promise<void>` — 递归目录复制
  - [ ] 1.3 实现 `createSymlink(target: string, linkPath: string): Promise<void>` — 符号链接创建
  - [ ] 1.4 实现 `backupFile(filePath: string): Promise<string>` — 备份文件，返回备份路径
  - [ ] 1.5 实现 `ensureDir(dirPath: string): Promise<void>` — 确保目录存在（递归创建）
  - [ ] 1.6 实现 `isWritable(dirPath: string): Promise<boolean>` — 检查目录可写性
  - [ ] 1.7 实现 `fileHash(filePath: string): Promise<string>` — 计算文件 SHA256 hash
  - [ ] 1.8 所有路径操作使用 `path.join()`，不拼接字符串
- [ ] Task 2: 实现预检查逻辑 (AC: #2-5)
  - [ ] 2.1 实现 `preflight(plan: MatchedPlan, pathResolver: PathResolver): Promise<PreflightResult>`
  - [ ] 2.2 路径遍历检测：目标路径 `resolve()` 后必须在预期根目录下
  - [ ] 2.3 可写性检查：对每个目标路径的父目录执行 `fs.access(dir, fs.constants.W_OK)`
  - [ ] 2.4 不存在目录标记：记录需要创建的目录列表
  - [ ] 2.5 fail-fast：首个不可写路径即抛出 `AiforgeError(code: 'PERMISSION_DENIED', severity: 'fatal')`
- [ ] Task 3: 编写单元测试 (AC: #1-5)
  - [ ] 3.1 `tests/services/fs-utils.test.ts` — 各工具函数的正常和异常路径
  - [ ] 3.2 预检查测试：可写路径通过、不可写路径 fail-fast、路径遍历拒绝、不存在目录标记
  - [ ] 3.3 使用临时目录（`os.tmpdir()`）进行真实文件操作测试

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

### Debug Log References

### Completion Notes List

### File List
