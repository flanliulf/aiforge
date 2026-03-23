import { describe, it, expect, vi, beforeEach } from 'vitest'
import { join } from 'path'
import type { PathResolver } from '../../src/core/path-resolver.js'
import type { AiforgeConfig } from '../../src/core/types.js'
import { AiforgeError } from '../../src/core/errors.js'

// Mock fs/promises at module level
vi.mock('node:fs/promises')

// Import after mock setup
import { readFile, writeFile, rename, chmod, mkdir, access } from 'node:fs/promises'

// Import the module under test
import { loadConfig, saveConfig, getHostAuth, ensureConfigDir } from '../../src/services/config.js'

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
const VALID_CONFIG: AiforgeConfig = {
  defaultRepo: 'https://gitlab.com/org/aicoding-base.git',
  cloneDir: '~/.aiforge/repos/',
  language: 'zh-CN',
  preferSSH: false,
  auth: {
    'gitlab.com': { method: 'token', token: 'glpat-xxxxxxxxxxxx' },
    'github.com': { method: 'ssh' },
  },
}

describe('services/config', () => {
  const resolver = mockPathResolver()
  const configPath = join(resolver.configDir(), 'config.json')

  beforeEach(() => {
    vi.resetAllMocks()
  })

  // ── loadConfig ──────────────────────────────────────────────

  describe('loadConfig', () => {
    it('should parse valid config.json and return AiforgeConfig (AC #2)', async () => {
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(VALID_CONFIG))

      const config = await loadConfig(resolver)

      expect(readFile).toHaveBeenCalledWith(configPath, 'utf-8')
      expect(config).toEqual(VALID_CONFIG)
    })

    it('should throw CONFIG_NOT_FOUND when file does not exist (AC #5)', async () => {
      const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      vi.mocked(readFile).mockRejectedValue(err)

      await expect(loadConfig(resolver)).rejects.toThrow(AiforgeError)
      await expect(loadConfig(resolver)).rejects.toMatchObject({
        code: 'CONFIG_NOT_FOUND',
        severity: 'fatal',
      })
    })

    it('should throw CONFIG_CORRUPT when JSON is invalid (AC #4)', async () => {
      vi.mocked(readFile).mockResolvedValue('{ invalid json !!!!')

      await expect(loadConfig(resolver)).rejects.toThrow(AiforgeError)
      await expect(loadConfig(resolver)).rejects.toMatchObject({
        code: 'CONFIG_CORRUPT',
        severity: 'fatal',
      })
    })

    it('should throw CONFIG_READ_FAILED for non-ENOENT fs errors (e.g. EACCES)', async () => {
      const err = Object.assign(new Error('EACCES'), { code: 'EACCES' })
      vi.mocked(readFile).mockRejectedValue(err)

      await expect(loadConfig(resolver)).rejects.toThrow(AiforgeError)
      await expect(loadConfig(resolver)).rejects.toMatchObject({
        code: 'CONFIG_READ_FAILED',
        severity: 'fatal',
      })
    })

    it('should throw CONFIG_CORRUPT when auth field is missing (empty object)', async () => {
      vi.mocked(readFile).mockResolvedValue(JSON.stringify({}))

      await expect(loadConfig(resolver)).rejects.toThrow(AiforgeError)
      await expect(loadConfig(resolver)).rejects.toMatchObject({
        code: 'CONFIG_CORRUPT',
        severity: 'fatal',
      })
    })

    it('should throw CONFIG_CORRUPT when auth is null', async () => {
      vi.mocked(readFile).mockResolvedValue(JSON.stringify({ auth: null }))

      await expect(loadConfig(resolver)).rejects.toThrow(AiforgeError)
      await expect(loadConfig(resolver)).rejects.toMatchObject({
        code: 'CONFIG_CORRUPT',
        severity: 'fatal',
      })
    })

    it('should throw CONFIG_CORRUPT when auth is an array', async () => {
      vi.mocked(readFile).mockResolvedValue(JSON.stringify({ auth: [] }))

      await expect(loadConfig(resolver)).rejects.toThrow(AiforgeError)
      await expect(loadConfig(resolver)).rejects.toMatchObject({
        code: 'CONFIG_CORRUPT',
        severity: 'fatal',
      })
    })
  })

  // ── saveConfig ──────────────────────────────────────────────

  describe('saveConfig', () => {
    it('should write config atomically: tmp + rename + chmod 0o600 (AC #1)', async () => {
      vi.mocked(writeFile).mockResolvedValue()
      vi.mocked(rename).mockResolvedValue()
      vi.mocked(chmod).mockResolvedValue()
      vi.mocked(access).mockResolvedValue()

      await saveConfig(VALID_CONFIG, resolver)

      const tmpPath = configPath + '.tmp'
      expect(writeFile).toHaveBeenCalledWith(
        tmpPath,
        JSON.stringify(VALID_CONFIG, null, 2),
        'utf-8',
      )
      expect(rename).toHaveBeenCalledWith(tmpPath, configPath)
      expect(chmod).toHaveBeenCalledWith(configPath, 0o600)
    })

    it('should call ensureConfigDir before writing', async () => {
      // access throws → mkdir is called
      vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
      vi.mocked(mkdir).mockResolvedValue(undefined)
      vi.mocked(writeFile).mockResolvedValue()
      vi.mocked(rename).mockResolvedValue()
      vi.mocked(chmod).mockResolvedValue()

      await saveConfig(VALID_CONFIG, resolver)

      expect(mkdir).toHaveBeenCalledWith(resolver.configDir(), { recursive: true })
    })

    it('should produce JSON with 2-space indentation', async () => {
      vi.mocked(writeFile).mockResolvedValue()
      vi.mocked(rename).mockResolvedValue()
      vi.mocked(chmod).mockResolvedValue()
      vi.mocked(access).mockResolvedValue()

      await saveConfig(VALID_CONFIG, resolver)

      const written = vi.mocked(writeFile).mock.calls[0]?.[1] as string
      expect(written).toBe(JSON.stringify(VALID_CONFIG, null, 2))
    })
  })

  // ── getHostAuth ──────────────────────────────────────────────

  describe('getHostAuth', () => {
    it('should return HostAuth for a known host (AC #3)', () => {
      const auth = getHostAuth(VALID_CONFIG, 'gitlab.com')

      expect(auth).toEqual({ method: 'token', token: 'glpat-xxxxxxxxxxxx' })
    })

    it('should return HostAuth for a different host (AC #3 multi-host)', () => {
      const auth = getHostAuth(VALID_CONFIG, 'github.com')

      expect(auth).toEqual({ method: 'ssh' })
    })

    it('should return undefined for an unknown host', () => {
      const auth = getHostAuth(VALID_CONFIG, 'bitbucket.org')

      expect(auth).toBeUndefined()
    })

    it('should return undefined for prototype property names (e.g. constructor)', () => {
      const auth = getHostAuth(VALID_CONFIG, 'constructor')

      expect(auth).toBeUndefined()
    })
  })

  // ── ensureConfigDir ──────────────────────────────────────────

  describe('ensureConfigDir', () => {
    it('should not create directory if it already exists', async () => {
      vi.mocked(access).mockResolvedValue()

      await ensureConfigDir(resolver)

      expect(mkdir).not.toHaveBeenCalled()
    })

    it('should create directory with recursive:true if it does not exist (AC #1)', async () => {
      vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
      vi.mocked(mkdir).mockResolvedValue(undefined)

      await ensureConfigDir(resolver)

      expect(mkdir).toHaveBeenCalledWith(resolver.configDir(), { recursive: true })
    })
  })
})
