# Story 4.4: manifest 状态管理与冲突检测

Status: ready-for-dev

## Story

As a 用户,
I want 系统追踪所有已安装文件的状态,
So that 能区分"aiforge 安装的"和"我手写的"文件，避免意外覆盖。

## Acceptance Criteria

1. **Given** `services/manifest.ts` 已创建 **When** 安装完成后 **Then** 将所有已安装文件记录到 `~/.aiforge/manifest.json`（FR-025），每条记录包含 `source`、`target`、`tool`、`scope`、`mode`、`hash`（SHA256）、`installedAt`
2. **Given** manifest.json 写入 **When** 执行写入操作 **Then** 使用原子写入：先写临时文件，再 `fs.rename()` 替换
3. **Given** 目标路径已存在文件 **When** 检查 manifest **Then** 按以下矩阵判定冲突类型：不在 manifest → `'user-file'`（用户手写）；在 manifest 且目标hash=manifest hash 且源hash=manifest hash → `'aiforge-current'`（已是最新）；在 manifest 且目标hash=manifest hash 且源hash≠manifest hash → `'aiforge-outdated'`（源有更新）；在 manifest 且目标hash≠manifest hash → `'user-modified'`（用户修改了 aiforge 安装的文件）（FR-026）
4. **Given** manifest.json 损坏或丢失 **When** 读取 manifest **Then** 降级为空 manifest（NFR-R5），此时所有已存在文件视为 `'unknown-origin'`（系统无法判断来源），与 `'user-file'`（确定不是 aiforge 安装）语义不同

## Tasks / Subtasks

- [ ] Task 1: 创建 `src/services/manifest.ts` — manifest 读写服务 (AC: #1, #2, #4)
  - [ ] 1.1 实现 `loadManifest(pathResolver: PathResolver): Promise<ManifestEntry[]>` — 读取并解析 manifest.json
  - [ ] 1.2 实现 `saveManifest(entries: ManifestEntry[], pathResolver: PathResolver): Promise<void>` — 原子写入
  - [ ] 1.3 损坏降级：JSON 解析失败或文件不存在 → 返回空数组（不抛错）
  - [ ] 1.4 原子写入：`writeFile(tmpPath)` → `rename(tmpPath, manifestPath)`
- [ ] Task 2: 实现冲突检测逻辑 (AC: #3, #4)
  - [ ] 2.1 实现 `checkConflict(targetPath: string, sourceHash: string, manifest: ManifestEntry[], manifestDegraded: boolean): Promise<ConflictType>`
  - [ ] 2.2 `ConflictType`: `'none'`（目标不存在）| `'aiforge-current'`（目标hash=manifest hash 且 源hash=manifest hash）| `'aiforge-outdated'`（目标hash=manifest hash 且 源hash≠manifest hash）| `'user-modified'`（在 manifest 但目标hash≠manifest hash）| `'user-file'`（不在 manifest，manifest 正常）| `'unknown-origin'`（不在 manifest，manifest 降级）
  - [ ] 2.3 在 `executeInstall` 中每个文件安装前调用冲突检测
- [ ] Task 3: 提供 manifest 服务供 pipeline 层调用 (AC: #1)
  - [ ] 3.1 导出 `buildManifestEntries(results: InstallResult[]): ManifestEntry[]`，从安装结果构建 manifest 条目
  - [ ] 3.2 导出 `mergeManifest(existing, newEntries): ManifestEntry[]`，合并已有条目
  - [ ] 3.3 manifest 持久化由 pipeline 层（Story 4.6a）调用 `saveManifest()`，本 Story 只提供服务函数
- [ ] Task 4: 编写单元测试 (AC: #1-4)
  - [ ] 4.1 `tests/services/manifest.test.ts`
  - [ ] 4.2 测试用例：正常读写、原子写入验证、损坏降级、冲突检测四种类型、manifest 合并逻辑
  - [ ] 4.3 Mock fs 操作，注入 mock PathResolver

## Dev Notes

### ManifestEntry 类型 [Source: core/types.ts, Story 1.2]

```typescript
interface ManifestEntry {
  source: string;              // 源文件相对路径
  target: string;              // 目标绝对路径
  tool: string;                // 工具 ID
  scope: 'global' | 'project';
  mode: 'copy' | 'symlink';
  hash: string;                // 文件内容 SHA256
  installedAt: string;         // ISO 时间戳
}
```

### 原子写入 [Source: architecture/03-core-decisions.md#D3b]

```typescript
async function saveManifest(entries: ManifestEntry[], pathResolver: PathResolver): Promise<void> {
  const manifestPath = join(pathResolver.configDir(), 'manifest.json');
  const tmpPath = manifestPath + '.tmp';
  await writeFile(tmpPath, JSON.stringify(entries, null, 2), 'utf-8');
  await rename(tmpPath, manifestPath);
}
```

### 损坏降级 [Source: NFR-R5]

```typescript
async function loadManifest(pathResolver: PathResolver): Promise<ManifestEntry[]> {
  const manifestPath = join(pathResolver.configDir(), 'manifest.json');
  try {
    const content = await readFile(manifestPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return []; // 损坏或不存在 → 空 manifest
  }
}
```

不抛错，静默降级。但需设置 `manifestDegraded = true` 标志，使冲突检测对已存在文件返回 `'unknown-origin'` 而非 `'user-file'`——两者语义不同：`'unknown-origin'` 是"系统无法判断"，`'user-file'` 是"确定不是 aiforge 安装"。

### 冲突检测流程

```typescript
type ConflictType = 'none' | 'aiforge-current' | 'aiforge-outdated' | 'user-modified' | 'user-file' | 'unknown-origin';

async function checkConflict(
  targetPath: string,
  sourceHash: string,
  manifest: ManifestEntry[],
  manifestDegraded: boolean
): Promise<ConflictType> {
  try { await access(targetPath); } catch { return 'none'; }

  const entry = manifest.find(e => e.target === targetPath);
  if (!entry) return manifestDegraded ? 'unknown-origin' : 'user-file';

  const currentHash = await fileHash(targetPath);
  if (currentHash !== entry.hash) return 'user-modified'; // 用户修改了 aiforge 安装的文件
  if (sourceHash === entry.hash) return 'aiforge-current'; // 源和目标都没变
  return 'aiforge-outdated'; // 源有更新，目标未被用户修改
}
```

### manifest 合并策略

```typescript
function mergeManifest(existing: ManifestEntry[], newEntries: ManifestEntry[]): ManifestEntry[] {
  const merged = new Map(existing.map(e => [e.target, e]));
  for (const entry of newEntries) {
    merged.set(entry.target, entry); // 新条目覆盖旧条目（按 target 路径）
  }
  return Array.from(merged.values());
}
```

### 模块边界

- `services/manifest.ts` 只依赖 `core/`（types）和 Node.js 内置模块
- 使用 `services/fs-utils.ts` 的 `fileHash()`
- 被 `stages/execute-install.ts` 调用

### 依赖关系

- 依赖 Story 1.2（`ManifestEntry` 类型）
- 依赖 Story 1.3（`PathResolver`）
- 依赖 Story 4.1（`fileHash` 工具函数）
- 被 Story 4.2/4.3（安装后记录 manifest）和 Story 4.5（冲突处理决策）依赖

### 本 Story 不做的事

- 不实现冲突交互式处理（Story 4.5）
- 不实现 manifest 文件锁（延迟决策，M2）
- 不实现 manifest 迁移（版本升级）

### References

- [Source: architecture/03-core-decisions.md#D3b] — manifest.json 原子写入和崩溃降级
- [Source: architecture/05-project-structure.md] — services/manifest.ts 位置
- [Source: project-context.md#Data-Format-Rules] — JSON camelCase、原子写入

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
