import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, writeFile, mkdir, rm, chmod, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { existsSync } from 'node:fs'

import {
  copyFile,
  copyDir,
  createSymlink,
  backupFile,
  ensureDir,
  isWritable,
  fileHash,
  preflight,
} from '../../src/services/fs-utils.js'

import type { MatchedPlan } from '../../src/core/types.js'
import type { PathResolver } from '../../src/core/path-resolver.js'
import { InstallType } from '../../src/core/types.js'

// ── helpers ─────────────────────────────────────────────────────────────────

async function makeTmpDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'aiforge-test-'))
}

/**
 * 构造 MatchedPlan，scope 默认 'global'。
 * pathResolver.home() 在测试中指向 tmpDir，因此目标路径也需在 tmpDir 下。
 */
function makeMatchedPlan(targetPaths: string[]): MatchedPlan {
  return {
    items: targetPaths.map((targetPath) => ({
      rule: {
        tool: 'claude',
        scope: 'global' as const,
        sourceDir: 'agents',
        type: InstallType.Files,
        targetDir: targetPath,
      },
      sourceFiles: ['foo.md'],
      targetPath,
      mode: 'copy' as const,
    })),
  }
}

/**
 * 创建一个 stub PathResolver，使 home() 返回指定的 homeDir（用于测试隔离）。
 */
function makeStubPathResolver(homeDir: string): PathResolver {
  return {
    home: () => homeDir,
    configDir: () => join(homeDir, '.aiforge'),
    reposDir: () => join(homeDir, '.aiforge', 'repos'),
    toolGlobalDir: (id: string) => join(homeDir, '.aiforge', 'tools', id),
    toolProjectDir: (id: string) => join('.aiforge', 'tools', id),
  }
}

// ── describe: services/fs-utils ──────────────────────────────────────────────

describe('services/fs-utils', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await makeTmpDir()
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  // ── copyFile ───────────────────────────────────────────────────────────────

  describe('copyFile', () => {
    it('copies a file to a new path', async () => {
      const src = join(tmpDir, 'src.txt')
      const dest = join(tmpDir, 'dest.txt')
      await writeFile(src, 'hello')
      await copyFile(src, dest)
      const { readFile } = await import('node:fs/promises')
      expect(await readFile(dest, 'utf8')).toBe('hello')
    })

    it('overwrites existing destination file', async () => {
      const src = join(tmpDir, 'src.txt')
      const dest = join(tmpDir, 'dest.txt')
      await writeFile(src, 'new')
      await writeFile(dest, 'old')
      await copyFile(src, dest)
      const { readFile } = await import('node:fs/promises')
      expect(await readFile(dest, 'utf8')).toBe('new')
    })

    it('creates destination parent directory if missing', async () => {
      const src = join(tmpDir, 'src.txt')
      const dest = join(tmpDir, 'subdir', 'dest.txt')
      await writeFile(src, 'hello')
      await copyFile(src, dest)
      expect(existsSync(dest)).toBe(true)
    })

    it('throws AiforgeError when source does not exist', async () => {
      const src = join(tmpDir, 'nonexistent.txt')
      const dest = join(tmpDir, 'dest.txt')
      await expect(copyFile(src, dest)).rejects.toMatchObject({
        code: 'FILE_COPY_FAILED',
        severity: 'fatal',
      })
    })
  })

  // ── copyDir ────────────────────────────────────────────────────────────────

  describe('copyDir', () => {
    it('recursively copies a directory', async () => {
      const src = join(tmpDir, 'srcdir')
      const dest = join(tmpDir, 'destdir')
      await mkdir(src)
      await writeFile(join(src, 'a.txt'), 'aaa')
      await mkdir(join(src, 'sub'))
      await writeFile(join(src, 'sub', 'b.txt'), 'bbb')
      await copyDir(src, dest)
      expect(existsSync(join(dest, 'a.txt'))).toBe(true)
      expect(existsSync(join(dest, 'sub', 'b.txt'))).toBe(true)
    })

    it('throws AiforgeError when source directory does not exist', async () => {
      const src = join(tmpDir, 'nosuchdir')
      const dest = join(tmpDir, 'destdir')
      await expect(copyDir(src, dest)).rejects.toMatchObject({
        code: 'DIR_COPY_FAILED',
        severity: 'fatal',
      })
    })
  })

  // ── createSymlink ──────────────────────────────────────────────────────────

  describe('createSymlink', () => {
    it('creates a symbolic link pointing to target', async () => {
      const target = join(tmpDir, 'target.txt')
      const linkPath = join(tmpDir, 'link.txt')
      await writeFile(target, 'content')
      await createSymlink(target, linkPath)
      const { readlink } = await import('node:fs/promises')
      expect(await readlink(linkPath)).toBe(target)
    })

    it('replaces existing symlink at linkPath', async () => {
      const target1 = join(tmpDir, 'target1.txt')
      const target2 = join(tmpDir, 'target2.txt')
      const linkPath = join(tmpDir, 'link.txt')
      await writeFile(target1, 'v1')
      await writeFile(target2, 'v2')
      await createSymlink(target1, linkPath)
      await createSymlink(target2, linkPath)
      const { readlink } = await import('node:fs/promises')
      expect(await readlink(linkPath)).toBe(target2)
    })

    it('creates parent directory if missing', async () => {
      const target = join(tmpDir, 'target.txt')
      const linkPath = join(tmpDir, 'newsubdir', 'link.txt')
      await writeFile(target, 'content')
      await createSymlink(target, linkPath)
      expect(existsSync(linkPath)).toBe(true)
    })

    it('throws AiforgeError when creation fails', async () => {
      // 指向不存在 target 的 symlink 本身是可以创建的，
      // 但如果父目录是只读的，则会失败
      // 用无效的 linkPath（空字符串）触发底层错误
      await expect(createSymlink('/some/target', '')).rejects.toMatchObject({
        code: 'SYMLINK_CREATE_FAILED',
        severity: 'fatal',
      })
    })
  })

  // ── backupFile ─────────────────────────────────────────────────────────────

  describe('backupFile', () => {
    it('creates a backup file and returns backup path', async () => {
      const original = join(tmpDir, 'original.txt')
      await writeFile(original, 'data')
      const backupPath = await backupFile(original)
      expect(existsSync(backupPath)).toBe(true)
      expect(backupPath).toMatch(/\.aiforge-backup-\d{8}$/)
      const { readFile } = await import('node:fs/promises')
      expect(await readFile(backupPath, 'utf8')).toBe('data')
    })

    it('original file remains after backup', async () => {
      const original = join(tmpDir, 'original.txt')
      await writeFile(original, 'data')
      await backupFile(original)
      expect(existsSync(original)).toBe(true)
    })

    it('throws AiforgeError when file does not exist', async () => {
      const original = join(tmpDir, 'nonexistent.txt')
      await expect(backupFile(original)).rejects.toMatchObject({
        code: 'BACKUP_FAILED',
        severity: 'fatal',
      })
    })
  })

  // ── ensureDir ──────────────────────────────────────────────────────────────

  describe('ensureDir', () => {
    it('creates a directory that does not exist', async () => {
      const dir = join(tmpDir, 'newdir')
      await ensureDir(dir)
      expect(existsSync(dir)).toBe(true)
    })

    it('creates nested directories recursively', async () => {
      const dir = join(tmpDir, 'a', 'b', 'c')
      await ensureDir(dir)
      expect(existsSync(dir)).toBe(true)
    })

    it('does not throw if directory already exists', async () => {
      const dir = join(tmpDir, 'existing')
      await mkdir(dir)
      await expect(ensureDir(dir)).resolves.toBeUndefined()
    })

    it('throws AiforgeError(ENSURE_DIR_FAILED) when path is an existing file', async () => {
      // mkdir({ recursive: true }) 对已存在的文件路径会抛出 ENOTDIR
      const existingFile = join(tmpDir, 'iam-a-file.txt')
      await writeFile(existingFile, 'content')
      const conflictPath = join(existingFile, 'subdir') // 在文件路径下创建子目录
      await expect(ensureDir(conflictPath)).rejects.toMatchObject({
        code: 'ENSURE_DIR_FAILED',
        severity: 'fatal',
      })
    })
  })

  // ── isWritable ─────────────────────────────────────────────────────────────

  describe('isWritable', () => {
    it('returns true for a writable directory', async () => {
      expect(await isWritable(tmpDir)).toBe(true)
    })

    it('returns false for a non-existent directory', async () => {
      const nonexistent = join(tmpDir, 'nosuchdir')
      expect(await isWritable(nonexistent)).toBe(false)
    })

    it('returns false for a directory with W_OK but no X_OK (0o222) (P1 fix)', async () => {
      // 0o222: 可写无遍历权限 — isWritable 应返回 false（POSIX: 写文件需要 X_OK 才能进入目录）
      // root 用户绕过权限检查，此测试在 root 环境下跳过
      if (process.getuid && process.getuid() === 0) {
        return
      }
      const writeOnlyDir = join(tmpDir, 'write-only-dir')
      await mkdir(writeOnlyDir)
      await chmod(writeOnlyDir, 0o222) // -w--w--w-
      try {
        expect(await isWritable(writeOnlyDir)).toBe(false)
      } finally {
        await chmod(writeOnlyDir, 0o755)
      }
    })
  })

  // ── fileHash ───────────────────────────────────────────────────────────────

  describe('fileHash', () => {
    it('returns a 64-char hex SHA256 hash', async () => {
      const file = join(tmpDir, 'hash.txt')
      await writeFile(file, 'hello world')
      const hash = await fileHash(file)
      expect(hash).toHaveLength(64)
      expect(hash).toMatch(/^[0-9a-f]{64}$/)
    })

    it('returns same hash for same content', async () => {
      const f1 = join(tmpDir, 'f1.txt')
      const f2 = join(tmpDir, 'f2.txt')
      await writeFile(f1, 'same content')
      await writeFile(f2, 'same content')
      expect(await fileHash(f1)).toBe(await fileHash(f2))
    })

    it('returns different hashes for different content', async () => {
      const f1 = join(tmpDir, 'f1.txt')
      const f2 = join(tmpDir, 'f2.txt')
      await writeFile(f1, 'content A')
      await writeFile(f2, 'content B')
      expect(await fileHash(f1)).not.toBe(await fileHash(f2))
    })

    it('throws AiforgeError when file does not exist', async () => {
      const file = join(tmpDir, 'nonexistent.txt')
      await expect(fileHash(file)).rejects.toMatchObject({
        code: 'FILE_HASH_FAILED',
        severity: 'fatal',
      })
    })
  })

  // ── path.join usage (AC #1 — no string concatenation) ─────────────────────
  // This is validated at code level; verified by code review.

  // ── preflight ─────────────────────────────────────────────────────────────

  describe('preflight', () => {
    let pathResolver: PathResolver

    beforeEach(() => {
      // stub：将 home() 指向 tmpDir，使 global scope 的目标路径校验基于 tmpDir
      pathResolver = makeStubPathResolver(tmpDir)
    })

    it('passes when all target parent dirs are writable', async () => {
      const target = join(tmpDir, 'tools', 'claude')
      const plan = makeMatchedPlan([target])
      const result = await preflight(plan, pathResolver)
      expect(result.ok).toBe(true)
      expect(result.dirsToCreate).toContain(target)
    })

    it('marks non-existent target dirs as needing creation (AC #3)', async () => {
      const target = join(tmpDir, 'brand', 'new', 'dir')
      const plan = makeMatchedPlan([target])
      const result = await preflight(plan, pathResolver)
      expect(result.dirsToCreate).toContain(target)
    })

    it('passes for existing writable target file (AC #2)', async () => {
      const target = join(tmpDir, 'existing.txt')
      await writeFile(target, 'content')
      const plan = makeMatchedPlan([target])
      const result = await preflight(plan, pathResolver)
      expect(result.ok).toBe(true)
    })

    it('throws PERMISSION_DENIED when parent dir is not writable (AC #4)', async () => {
      // 创建一个只读父目录
      const readonlyParent = join(tmpDir, 'readonly-parent')
      await mkdir(readonlyParent)
      await chmod(readonlyParent, 0o444) // r--r--r--
      const target = join(readonlyParent, 'newfile.txt')
      const plan = makeMatchedPlan([target])
      try {
        await expect(preflight(plan, pathResolver)).rejects.toMatchObject({
          code: 'PERMISSION_DENIED',
          severity: 'fatal',
        })
      } finally {
        // 恢复权限以便清理
        await chmod(readonlyParent, 0o755)
      }
    })

    it('throws PATH_TRAVERSAL when target path escapes allowedRoot (AC #5)', async () => {
      const escapePath = join(tmpDir, '..', 'outside')
      const plan = makeMatchedPlan([escapePath])
      await expect(preflight(plan, pathResolver)).rejects.toMatchObject({
        code: 'PATH_TRAVERSAL',
        severity: 'fatal',
      })
    })

    it('throws PATH_TRAVERSAL for explicit ../ in target path (AC #5)', async () => {
      const escapePath = join(tmpDir, 'subdir', '..', '..', 'escape')
      const plan = makeMatchedPlan([escapePath])
      await expect(preflight(plan, pathResolver)).rejects.toMatchObject({
        code: 'PATH_TRAVERSAL',
        severity: 'fatal',
      })
    })

    it('fail-fast on first unwritable path — does not check remaining items (AC #4)', async () => {
      const readonlyParent = join(tmpDir, 'readonly-parent2')
      await mkdir(readonlyParent)
      await chmod(readonlyParent, 0o444)
      const target1 = join(readonlyParent, 'file1.txt') // 不可写
      const target2 = join(tmpDir, 'file2.txt') // 可写
      const plan = makeMatchedPlan([target1, target2])
      try {
        await expect(preflight(plan, pathResolver)).rejects.toMatchObject({
          code: 'PERMISSION_DENIED',
          severity: 'fatal',
        })
      } finally {
        await chmod(readonlyParent, 0o755)
      }
    })

    it('returns empty dirsToCreate when all dirs already exist', async () => {
      const existingDir = join(tmpDir, 'existing-dir')
      await mkdir(existingDir)
      const target = join(existingDir, 'file.txt')
      await writeFile(target, 'content')
      const plan = makeMatchedPlan([target])
      const result = await preflight(plan, pathResolver)
      expect(result.dirsToCreate).not.toContain(existingDir)
    })

    it('throws PATH_NOT_DIRECTORY when an ancestor in path chain is a file (Finding #1)', async () => {
      // 路径链中 "blocker.txt" 是文件，无法在其下创建子目录
      const fileBlocker = join(tmpDir, 'blocker.txt')
      await writeFile(fileBlocker, 'i am a file, not a dir')
      const target = join(fileBlocker, 'subdir', 'output.md') // 父路径链中有文件
      const plan = makeMatchedPlan([target])
      await expect(preflight(plan, pathResolver)).rejects.toMatchObject({
        code: 'PATH_NOT_DIRECTORY',
        severity: 'fatal',
      })
    })

    it('passes when an ancestor in path chain is a symlink pointing to a directory (P0 regression fix)', async () => {
      // symlink → directory 作为祖先，preflight 应通过（lstat 不跟随 symlink，需用 stat 确认）
      const realDir = join(tmpDir, 'real-dir')
      await mkdir(realDir)
      const symlinkDir = join(tmpDir, 'symlink-dir')
      await symlink(realDir, symlinkDir)
      const target = join(symlinkDir, 'subdir', 'output.md')
      const plan = makeMatchedPlan([target])
      const result = await preflight(plan, pathResolver)
      expect(result.ok).toBe(true)
      expect(result.dirsToCreate).toContain(target)
    })

    it('passes when target is a broken symlink (P1 regression fix)', async () => {
      // broken symlink（目标不存在）作为安装目标，preflight 应通过（symlink 模式会先删除再创建）
      const brokenSymlink = join(tmpDir, 'broken-link')
      await symlink(join(tmpDir, 'nonexistent-target'), brokenSymlink)
      const plan = makeMatchedPlan([brokenSymlink])
      const result = await preflight(plan, pathResolver)
      expect(result.ok).toBe(true)
    })

    it('passes when target is a valid symlink pointing to a file (P1 regression fix)', async () => {
      // 有效 symlink → file 作为安装目标，preflight 应通过（symlink 模式会先删除再创建）
      const realFile = join(tmpDir, 'real-file.txt')
      await writeFile(realFile, 'content')
      const symlinkFile = join(tmpDir, 'symlink-file')
      await symlink(realFile, symlinkFile)
      const plan = makeMatchedPlan([symlinkFile])
      const result = await preflight(plan, pathResolver)
      expect(result.ok).toBe(true)
    })

    it('throws PATH_TRAVERSAL when target is a symlink pointing outside allowedRoot (P0 symlink escape fix)', async () => {
      // targetPath 本身是目录类型的 symlink，指向 allowedRoot 之外
      // preflight: lstat(target).isDirectory() → 通过（目录类型不检查可写性）
      // 但 validateAncestorRealpath 应在 target 不存在分支发现逃逸
      // 构造：target = tmpDir/escape-link/output.md，escape-link → outsideDir
      const outsideDir = await mkdtemp(join(tmpdir(), 'aiforge-outside-'))
      const escapeLink = join(tmpDir, 'escape-link')
      await symlink(outsideDir, escapeLink)
      const target = join(escapeLink, 'output.md')
      const plan = makeMatchedPlan([target])
      try {
        await expect(preflight(plan, pathResolver)).rejects.toMatchObject({
          code: 'PATH_TRAVERSAL',
          severity: 'fatal',
        })
      } finally {
        await rm(outsideDir, { recursive: true, force: true })
      }
    })

    it('throws PATH_TRAVERSAL when an ancestor in path chain is a symlink pointing outside allowedRoot (P0 symlink escape fix)', async () => {
      // 路径链祖先是 symlink 指向外部目录 — escape-link/subdir/output.md
      const outsideDir = await mkdtemp(join(tmpdir(), 'aiforge-outside-'))
      const escapeLink = join(tmpDir, 'escape-ancestor')
      await symlink(outsideDir, escapeLink)
      // target 的祖先 escapeLink 指向外部，路径链：tmpDir/escape-ancestor/subdir/output.md
      const target = join(escapeLink, 'subdir', 'output.md')
      const plan = makeMatchedPlan([target])
      try {
        await expect(preflight(plan, pathResolver)).rejects.toMatchObject({
          code: 'PATH_TRAVERSAL',
          severity: 'fatal',
        })
      } finally {
        await rm(outsideDir, { recursive: true, force: true })
      }
    })

    it('throws PATH_TRAVERSAL when targetPath itself is an existing symlink pointing outside allowedRoot (P0 Round4 fix)', async () => {
      // targetPath = escapeLink（现存 symlink → 外部目录）— isSymbolicLink() 分支逃逸场景
      // lstat(escapeLink) 返回 symlink 类型 → 走 isSymbolicLink() 分支
      // 修复前：直接放行；修复后：realpath 校验发现逃逸，抛 PATH_TRAVERSAL
      const outsideDir = await mkdtemp(join(tmpdir(), 'aiforge-outside-'))
      const escapeLink = join(tmpDir, 'escape-target-dir')
      await symlink(outsideDir, escapeLink)
      // targetPath 直接是现存 symlink，不是 symlink/subpath
      const plan = makeMatchedPlan([escapeLink])
      try {
        await expect(preflight(plan, pathResolver)).rejects.toMatchObject({
          code: 'PATH_TRAVERSAL',
          severity: 'fatal',
        })
      } finally {
        await rm(outsideDir, { recursive: true, force: true })
      }
    })
  })
})
