import { describe, it, expect, vi, beforeEach } from 'vitest'
import { join } from 'path'
import type { PathResolver } from '../../src/core/path-resolver.js'
import type { ManifestEntry } from '../../src/core/types.js'

// Mock fs/promises at module level
vi.mock('node:fs/promises')

import { readFile, writeFile, rename, mkdir, access } from 'node:fs/promises'

// Import module under test
import {
  loadManifest,
  saveManifest,
  checkConflict,
  checkDirConflict,
  buildManifestEntries,
  mergeManifest,
} from '../../src/services/manifest.js'

// Mock fs-utils for fileHash
vi.mock('../../src/services/fs-utils.js', () => ({
  fileHash: vi.fn(),
}))

import { fileHash } from '../../src/services/fs-utils.js'

// Helper: create a mock PathResolver
function mockPathResolver(configDir = '/mock/home/.aiforge'): PathResolver {
  return {
    home: () => '/mock/home',
    configDir: () => configDir,
    reposDir: () => join(configDir, 'repos'),
    toolGlobalDir: (toolId: string) => join(configDir, 'tools', toolId),
    toolProjectDir: (toolId: string) => join('.aiforge', 'tools', toolId),
  }
}

// Fixtures
const SAMPLE_ENTRIES: ManifestEntry[] = [
  {
    source: 'agents/claude/CLAUDE.md',
    target: '/mock/home/.claude/CLAUDE.md',
    tool: 'claude',
    scope: 'global',
    mode: 'copy',
    hash: 'abc123def456',
    installedAt: '2026-03-29T10:00:00Z',
  },
  {
    source: 'skills/git-commit/index.md',
    target: '/mock/home/.claude/skills/git-commit.md',
    tool: 'claude',
    scope: 'global',
    mode: 'flatten',
    hash: 'xyz789',
    installedAt: '2026-03-29T10:00:01Z',
  },
]

describe('services/manifest', () => {
  const resolver = mockPathResolver()
  const manifestPath = join(resolver.configDir(), 'manifest.json')

  beforeEach(() => {
    vi.resetAllMocks()
  })

  // ── loadManifest ──────────────────────────────────────────

  describe('loadManifest', () => {
    it('should parse valid manifest.json and return ManifestEntry[] (AC #1)', async () => {
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(SAMPLE_ENTRIES))

      const result = await loadManifest(resolver)

      expect(readFile).toHaveBeenCalledWith(manifestPath, 'utf-8')
      expect(result.entries).toEqual(SAMPLE_ENTRIES)
      expect(result.degraded).toBe(false)
    })

    it('should return empty array with degraded=true when file does not exist (AC #4)', async () => {
      const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      vi.mocked(readFile).mockRejectedValue(err)

      const result = await loadManifest(resolver)

      expect(result.entries).toEqual([])
      expect(result.degraded).toBe(true)
    })

    it('should return empty array with degraded=true when JSON is corrupt (AC #4)', async () => {
      vi.mocked(readFile).mockResolvedValue('{ invalid json !!!!')

      const result = await loadManifest(resolver)

      expect(result.entries).toEqual([])
      expect(result.degraded).toBe(true)
    })

    it('should return empty array with degraded=true for non-ENOENT fs errors (e.g. EACCES)', async () => {
      const err = Object.assign(new Error('EACCES'), { code: 'EACCES' })
      vi.mocked(readFile).mockRejectedValue(err)

      const result = await loadManifest(resolver)

      expect(result.entries).toEqual([])
      expect(result.degraded).toBe(true)
    })

    it('should return empty array with degraded=true when content is not an array', async () => {
      vi.mocked(readFile).mockResolvedValue(JSON.stringify({ not: 'array' }))

      const result = await loadManifest(resolver)

      expect(result.entries).toEqual([])
      expect(result.degraded).toBe(true)
    })
  })

  // ── saveManifest ──────────────────────────────────────────

  describe('saveManifest', () => {
    it('should write manifest atomically: tmp file + rename (AC #2)', async () => {
      vi.mocked(mkdir).mockResolvedValue(undefined)
      vi.mocked(writeFile).mockResolvedValue()
      vi.mocked(rename).mockResolvedValue()

      await saveManifest(SAMPLE_ENTRIES, resolver)

      const tmpPath = manifestPath + '.tmp'
      expect(mkdir).toHaveBeenCalledWith(resolver.configDir(), { recursive: true })
      expect(writeFile).toHaveBeenCalledWith(
        tmpPath,
        JSON.stringify(SAMPLE_ENTRIES, null, 2),
        'utf-8',
      )
      expect(rename).toHaveBeenCalledWith(tmpPath, manifestPath)
    })

    it('should produce JSON with 2-space indentation', async () => {
      vi.mocked(mkdir).mockResolvedValue(undefined)
      vi.mocked(writeFile).mockResolvedValue()
      vi.mocked(rename).mockResolvedValue()

      await saveManifest(SAMPLE_ENTRIES, resolver)

      const written = vi.mocked(writeFile).mock.calls[0]?.[1] as string
      expect(written).toBe(JSON.stringify(SAMPLE_ENTRIES, null, 2))
    })

    it('should ensure configDir exists before writing', async () => {
      vi.mocked(mkdir).mockResolvedValue(undefined)
      vi.mocked(writeFile).mockResolvedValue()
      vi.mocked(rename).mockResolvedValue()

      await saveManifest(SAMPLE_ENTRIES, resolver)

      expect(mkdir).toHaveBeenCalledBefore(vi.mocked(writeFile))
    })
  })

  // ── checkConflict ──────────────────────────────────────────

  describe('checkConflict', () => {
    it('should return "none" when target file does not exist', async () => {
      vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))

      const result = await checkConflict('/target/file.md', 'sourcehash', [], false)

      expect(result).toBe('none')
    })

    it('should return "user-file" when file exists but not in manifest (manifest normal) (AC #3)', async () => {
      vi.mocked(access).mockResolvedValue()
      vi.mocked(fileHash).mockResolvedValue('targethash')

      const result = await checkConflict('/target/file.md', 'sourcehash', [], false)

      expect(result).toBe('user-file')
    })

    it('should return "unknown-origin" when file exists but not in manifest (manifest degraded) (AC #4)', async () => {
      vi.mocked(access).mockResolvedValue()
      vi.mocked(fileHash).mockResolvedValue('targethash')

      const result = await checkConflict('/target/file.md', 'sourcehash', [], true)

      expect(result).toBe('unknown-origin')
    })

    it('should return "aiforge-current" when target hash = manifest hash and source hash = manifest hash (AC #3)', async () => {
      vi.mocked(access).mockResolvedValue()
      vi.mocked(fileHash).mockResolvedValue('samehash')

      const entry: ManifestEntry = {
        source: 'src/file.md',
        target: '/target/file.md',
        tool: 'claude',
        scope: 'global',
        mode: 'copy',
        hash: 'samehash',
        installedAt: '2026-03-29T10:00:00Z',
      }

      const result = await checkConflict('/target/file.md', 'samehash', [entry], false)

      expect(result).toBe('aiforge-current')
    })

    it('should return "aiforge-outdated" when target hash = manifest hash but source hash differs (AC #3)', async () => {
      vi.mocked(access).mockResolvedValue()
      vi.mocked(fileHash).mockResolvedValue('oldhash')

      const entry: ManifestEntry = {
        source: 'src/file.md',
        target: '/target/file.md',
        tool: 'claude',
        scope: 'global',
        mode: 'copy',
        hash: 'oldhash',
        installedAt: '2026-03-29T10:00:00Z',
      }

      const result = await checkConflict('/target/file.md', 'newhash', [entry], false)

      expect(result).toBe('aiforge-outdated')
    })

    it('should return "user-modified" when target hash differs from manifest hash (AC #3)', async () => {
      vi.mocked(access).mockResolvedValue()
      vi.mocked(fileHash).mockResolvedValue('userhash')

      const entry: ManifestEntry = {
        source: 'src/file.md',
        target: '/target/file.md',
        tool: 'claude',
        scope: 'global',
        mode: 'copy',
        hash: 'originalhash',
        installedAt: '2026-03-29T10:00:00Z',
      }

      const result = await checkConflict('/target/file.md', 'sourcehash', [entry], false)

      expect(result).toBe('user-modified')
    })

    it('should propagate non-ENOENT errors from access() check', async () => {
      vi.mocked(access).mockRejectedValue(Object.assign(new Error('EIO'), { code: 'EIO' }))

      await expect(checkConflict('/target/file.md', 'hash', [], false)).rejects.toThrow('EIO')
    })
  })

  // ── checkDirConflict ──────────────────────────────────────────

  describe('checkDirConflict', () => {
    it('should return "none" when target directory does not exist', async () => {
      vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))

      const result = await checkDirConflict('/target/my-skill', [], false)

      expect(result).toBe('none')
    })

    it('should return "user-file" when directory exists but not in manifest (manifest normal)', async () => {
      vi.mocked(access).mockResolvedValue()

      const result = await checkDirConflict('/target/my-skill', [], false)

      expect(result).toBe('user-file')
    })

    it('should return "unknown-origin" when directory exists but not in manifest (manifest degraded)', async () => {
      vi.mocked(access).mockResolvedValue()

      const result = await checkDirConflict('/target/my-skill', [], true)

      expect(result).toBe('unknown-origin')
    })

    it('should return "aiforge-outdated" when directory exists and is in manifest', async () => {
      vi.mocked(access).mockResolvedValue()

      const entry: ManifestEntry = {
        source: 'skills/my-skill',
        target: '/target/my-skill',
        tool: 'claude',
        scope: 'global',
        mode: 'copy',
        hash: 'dirhash',
        installedAt: '2026-03-30T10:00:00Z',
      }

      const result = await checkDirConflict('/target/my-skill', [entry], false)

      expect(result).toBe('aiforge-outdated')
    })

    it('should propagate non-ENOENT errors from access() check', async () => {
      vi.mocked(access).mockRejectedValue(Object.assign(new Error('EIO'), { code: 'EIO' }))

      await expect(checkDirConflict('/target/dir', [], false)).rejects.toThrow('EIO')
    })

    it('should return "none" for ENOTDIR error (path component is not a directory)', async () => {
      vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOTDIR'), { code: 'ENOTDIR' }))

      const result = await checkDirConflict('/target/dir', [], false)

      expect(result).toBe('none')
    })
  })

  // ── buildManifestEntries ──────────────────────────────────

  describe('buildManifestEntries', () => {
    it('should build ManifestEntry[] from InstallResult items with repo-relative source path (AC #1)', () => {
      const results = [
        {
          sourcePath: '/repo/agents/claude/CLAUDE.md',
          targetPath: '/mock/home/.claude/CLAUDE.md',
          status: 'new' as const,
        },
      ]
      const tool = 'claude'
      const scope = 'global' as const
      const mode = 'copy' as const
      const hashes = new Map<string, string>([['/mock/home/.claude/CLAUDE.md', 'abc123']])
      const repoDir = '/repo'

      const entries = buildManifestEntries(results, tool, scope, mode, hashes, repoDir)

      expect(entries).toHaveLength(1)
      expect(entries[0]).toMatchObject({
        source: 'agents/claude/CLAUDE.md',
        target: '/mock/home/.claude/CLAUDE.md',
        tool: 'claude',
        scope: 'global',
        mode: 'copy',
        hash: 'abc123',
      })
      expect(entries[0]?.installedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('should produce relative source path, never absolute', () => {
      const results = [
        {
          sourcePath: '/data/repos/my-knowledge/skills/git-commit/index.md',
          targetPath: '/mock/home/.claude/skills/git-commit.md',
          status: 'updated' as const,
        },
      ]
      const hashes = new Map<string, string>([
        ['/mock/home/.claude/skills/git-commit.md', 'def456'],
      ])
      const repoDir = '/data/repos/my-knowledge'

      const entries = buildManifestEntries(results, 'claude', 'global', 'flatten', hashes, repoDir)

      expect(entries[0]?.source).toBe('skills/git-commit/index.md')
      // Ensure source is a relative path (does not start with /)
      expect(entries[0]?.source).not.toMatch(/^\//)
    })

    it('should skip items with "skipped" status', () => {
      const results = [
        {
          sourcePath: '/repo/file.md',
          targetPath: '/target/file.md',
          status: 'skipped' as const,
        },
      ]
      const hashes = new Map<string, string>()

      const entries = buildManifestEntries(results, 'claude', 'global', 'copy', hashes, '/repo')

      expect(entries).toHaveLength(0)
    })

    it('should throw when hash is missing for a target path', () => {
      const results = [
        {
          sourcePath: '/repo/agents/claude/CLAUDE.md',
          targetPath: '/mock/home/.claude/CLAUDE.md',
          status: 'new' as const,
        },
      ]
      // Empty hashes map — no hash for the target
      const hashes = new Map<string, string>()

      expect(() =>
        buildManifestEntries(results, 'claude', 'global', 'copy', hashes, '/repo'),
      ).toThrow('manifest hash missing for target: /mock/home/.claude/CLAUDE.md')
    })
  })

  // ── mergeManifest ──────────────────────────────────────────

  describe('mergeManifest', () => {
    it('should merge new entries into existing manifest, overriding by target path', () => {
      const existing: ManifestEntry[] = [
        {
          source: 'old/file.md',
          target: '/target/file.md',
          tool: 'claude',
          scope: 'global',
          mode: 'copy',
          hash: 'oldhash',
          installedAt: '2026-03-28T10:00:00Z',
        },
        {
          source: 'other/file.md',
          target: '/target/other.md',
          tool: 'cursor',
          scope: 'global',
          mode: 'copy',
          hash: 'otherhash',
          installedAt: '2026-03-28T10:00:00Z',
        },
      ]

      const newEntries: ManifestEntry[] = [
        {
          source: 'new/file.md',
          target: '/target/file.md',
          tool: 'claude',
          scope: 'global',
          mode: 'copy',
          hash: 'newhash',
          installedAt: '2026-03-29T10:00:00Z',
        },
      ]

      const merged = mergeManifest(existing, newEntries)

      expect(merged).toHaveLength(2)
      const updated = merged.find((e) => e.target === '/target/file.md')
      expect(updated?.hash).toBe('newhash')
      expect(updated?.source).toBe('new/file.md')
      const kept = merged.find((e) => e.target === '/target/other.md')
      expect(kept?.hash).toBe('otherhash')
    })

    it('should add new entries that do not exist in existing manifest', () => {
      const existing: ManifestEntry[] = []
      const newEntries: ManifestEntry[] = [
        {
          source: 'file.md',
          target: '/target/file.md',
          tool: 'claude',
          scope: 'global',
          mode: 'copy',
          hash: 'hash1',
          installedAt: '2026-03-29T10:00:00Z',
        },
      ]

      const merged = mergeManifest(existing, newEntries)

      expect(merged).toHaveLength(1)
      expect(merged[0]?.target).toBe('/target/file.md')
    })
  })
})
