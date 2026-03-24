import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Reporter } from '../../src/core/reporter.js'
import type { ParsedArgs, AiforgeConfig } from '../../src/core/types.js'
import type { PathResolver } from '../../src/core/path-resolver.js'
import { AiforgeError } from '../../src/core/errors.js'

// Mock services/config module and services/git module
vi.mock('../../src/services/config.js')
vi.mock('../../src/services/git.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/git.js')>()
  return {
    ...actual,
    // Keep actual GitSourceResolver implementation for integration
  }
})

import { loadConfig } from '../../src/services/config.js'
import { resolveSource } from '../../src/stages/resolve-source.js'

// ── Helpers ──────────────────────────────────────────────────

function mockReporter(): Reporter {
  return {
    startPhase: vi.fn(),
    updatePhase: vi.fn(),
    completePhase: vi.fn(),
    reportResult: vi.fn(),
    reportPlan: vi.fn(),
    reportError: vi.fn(),
    warn: vi.fn(),
  }
}

function mockPathResolver(): PathResolver {
  return {
    home: () => '/mock/home',
    configDir: () => '/mock/home/.aiforge',
    reposDir: () => '/mock/home/.aiforge/repos',
    toolGlobalDir: (toolId: string) => `/mock/home/.aiforge/tools/${toolId}`,
    toolProjectDir: (toolId: string) => `.aiforge/tools/${toolId}`,
  }
}

function createArgs(overrides: Partial<ParsedArgs> = {}): ParsedArgs {
  return {
    source: '',
    global: false,
    link: false,
    tools: [],
    dirs: [],
    dryRun: false,
    quiet: false,
    force: false,
    ssh: false,
    symlink: false,
    flatten: false,
    ...overrides,
  }
}

// ── Tests ──────────────────────────────────────────────────

describe('stages/resolve-source', () => {
  const reporter = mockReporter()
  const pathResolver = mockPathResolver()

  beforeEach(() => {
    vi.resetAllMocks()
  })

  // ── HTTPS URL 解析 (AC #1) ──

  describe('HTTPS URL parsing', () => {
    it('should parse standard HTTPS URL with .git suffix (AC #1)', async () => {
      const args = createArgs({ source: 'https://gitlab.com/org/repo.git' })

      const result = await resolveSource(args, reporter, pathResolver)

      expect(result).toEqual({
        hostname: 'gitlab.com',
        repoPath: 'org/repo',
        protocol: 'https',
      })
    })

    it('should parse HTTPS URL without .git suffix (AC #1)', async () => {
      const args = createArgs({ source: 'https://gitlab.com/org/repo' })

      const result = await resolveSource(args, reporter, pathResolver)

      expect(result).toEqual({
        hostname: 'gitlab.com',
        repoPath: 'org/repo',
        protocol: 'https',
      })
    })

    it('should parse HTTPS URL with nested path (deep repo path)', async () => {
      const args = createArgs({ source: 'https://gitlab.com/org/group/subgroup/repo.git' })

      const result = await resolveSource(args, reporter, pathResolver)

      expect(result).toEqual({
        hostname: 'gitlab.com',
        repoPath: 'org/group/subgroup/repo',
        protocol: 'https',
      })
    })
  })

  // ── SSH URL 解析 (AC #5) ──

  describe('SSH URL parsing', () => {
    it('should parse SCP-style SSH URL: git@host:org/repo.git (AC #5)', async () => {
      const args = createArgs({ source: 'git@gitlab.com:org/repo.git' })

      const result = await resolveSource(args, reporter, pathResolver)

      expect(result).toEqual({
        hostname: 'gitlab.com',
        repoPath: 'org/repo',
        protocol: 'ssh',
      })
    })

    it('should parse ssh:// protocol URL (AC #5)', async () => {
      const args = createArgs({ source: 'ssh://git@gitlab.com/org/repo.git' })

      const result = await resolveSource(args, reporter, pathResolver)

      expect(result).toEqual({
        hostname: 'gitlab.com',
        repoPath: 'org/repo',
        protocol: 'ssh',
      })
    })

    it('should parse SCP-style SSH URL without .git suffix', async () => {
      const args = createArgs({ source: 'git@github.com:user/project' })

      const result = await resolveSource(args, reporter, pathResolver)

      expect(result).toEqual({
        hostname: 'github.com',
        repoPath: 'user/project',
        protocol: 'ssh',
      })
    })
  })

  // ── 默认配置回退 (AC #2) ──

  describe('default config fallback', () => {
    it('should use defaultRepo from config when source is empty (AC #2)', async () => {
      const args = createArgs({ source: '' })
      const config: AiforgeConfig = {
        defaultRepo: 'https://gitlab.com/org/aicoding-base.git',
        auth: {},
      }
      vi.mocked(loadConfig).mockResolvedValue(config)

      const result = await resolveSource(args, reporter, pathResolver)

      expect(loadConfig).toHaveBeenCalledWith(pathResolver)
      expect(result).toEqual({
        hostname: 'gitlab.com',
        repoPath: 'org/aicoding-base',
        protocol: 'https',
      })
    })

    it('should use defaultRepo SSH from config when source is empty', async () => {
      const args = createArgs({ source: '' })
      const config: AiforgeConfig = {
        defaultRepo: 'git@gitlab.com:org/repo.git',
        auth: {},
      }
      vi.mocked(loadConfig).mockResolvedValue(config)

      const result = await resolveSource(args, reporter, pathResolver)

      expect(result).toEqual({
        hostname: 'gitlab.com',
        repoPath: 'org/repo',
        protocol: 'ssh',
      })
    })
  })

  // ── 无配置抛错 (AC #3) ──

  describe('no source and no default config', () => {
    it('should throw NO_REPO when source is empty and config has no defaultRepo (AC #3)', async () => {
      const args = createArgs({ source: '' })
      const config: AiforgeConfig = { auth: {} }
      vi.mocked(loadConfig).mockResolvedValue(config)

      await expect(resolveSource(args, reporter, pathResolver)).rejects.toThrow(AiforgeError)
      await expect(resolveSource(args, reporter, pathResolver)).rejects.toMatchObject({
        code: 'NO_REPO',
        severity: 'fatal',
      })
    })

    it('should throw NO_REPO when source is empty and loadConfig throws CONFIG_NOT_FOUND (AC #3)', async () => {
      const args = createArgs({ source: '' })
      vi.mocked(loadConfig).mockRejectedValue(
        new AiforgeError(
          '未找到配置文件',
          'CONFIG_NOT_FOUND',
          3,
          'fatal',
          '尚未运行初始化配置',
          [],
        ),
      )

      await expect(resolveSource(args, reporter, pathResolver)).rejects.toThrow(AiforgeError)
      await expect(resolveSource(args, reporter, pathResolver)).rejects.toMatchObject({
        code: 'NO_REPO',
        severity: 'fatal',
      })
    })
  })

  // ── Reporter 调用 (Task 1.6) ──

  describe('reporter integration', () => {
    it('should call reporter.startPhase with resolve message (Task 1.6)', async () => {
      const args = createArgs({ source: 'https://gitlab.com/org/repo.git' })

      await resolveSource(args, reporter, pathResolver)

      expect(reporter.startPhase).toHaveBeenCalledWith('解析仓库地址...')
    })

    it('should call reporter.completePhase after successful resolve', async () => {
      const args = createArgs({ source: 'https://gitlab.com/org/repo.git' })

      await resolveSource(args, reporter, pathResolver)

      expect(reporter.completePhase).toHaveBeenCalled()
    })
  })

  // ── 配置错误透传 (CR Fix: Finding #1) ──

  describe('config error propagation', () => {
    it('should propagate CONFIG_CORRUPT when config JSON is corrupted', async () => {
      const args = createArgs({ source: '' })
      vi.mocked(loadConfig).mockRejectedValue(
        new AiforgeError(
          '配置文件损坏',
          'CONFIG_CORRUPT',
          3,
          'fatal',
          'config.json 不是有效的 JSON 格式',
          [],
        ),
      )

      await expect(resolveSource(args, reporter, pathResolver)).rejects.toThrow(AiforgeError)
      await expect(resolveSource(args, reporter, pathResolver)).rejects.toMatchObject({
        code: 'CONFIG_CORRUPT',
        severity: 'fatal',
      })
    })

    it('should propagate CONFIG_READ_FAILED when config file cannot be read', async () => {
      const args = createArgs({ source: '' })
      vi.mocked(loadConfig).mockRejectedValue(
        new AiforgeError(
          '配置文件读取失败',
          'CONFIG_READ_FAILED',
          3,
          'fatal',
          '无法读取配置文件: EACCES',
          [],
        ),
      )

      await expect(resolveSource(args, reporter, pathResolver)).rejects.toThrow(AiforgeError)
      await expect(resolveSource(args, reporter, pathResolver)).rejects.toMatchObject({
        code: 'CONFIG_READ_FAILED',
        severity: 'fatal',
      })
    })
  })

  // ── 非法 URL 错误 (CR Fix: Finding #2) ──

  describe('invalid URL error handling', () => {
    it('should throw INVALID_URL for non-URL string via CLI source', async () => {
      const args = createArgs({ source: 'not-a-url' })

      await expect(resolveSource(args, reporter, pathResolver)).rejects.toThrow(AiforgeError)
      await expect(resolveSource(args, reporter, pathResolver)).rejects.toMatchObject({
        code: 'INVALID_URL',
        severity: 'fatal',
      })
    })

    it('should throw INVALID_URL for non-URL defaultRepo from config', async () => {
      const args = createArgs({ source: '' })
      const config: AiforgeConfig = {
        defaultRepo: 'not-a-valid-url',
        auth: {},
      }
      vi.mocked(loadConfig).mockResolvedValue(config)

      await expect(resolveSource(args, reporter, pathResolver)).rejects.toThrow(AiforgeError)
      await expect(resolveSource(args, reporter, pathResolver)).rejects.toMatchObject({
        code: 'INVALID_URL',
        severity: 'fatal',
      })
    })
  })
})
