import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ResolvedSource, ParsedArgs } from '../../src/core/types.js'
import type { Reporter } from '../../src/core/reporter.js'
import { AiforgeError } from '../../src/core/errors.js'

// Mock services/config.ts
vi.mock('../../src/services/config.js', () => ({
  loadConfig: vi.fn(),
  getHostAuth: vi.fn(),
}))

// Mock core/sanitize.ts
vi.mock('../../src/core/sanitize.js', () => ({
  sanitizeToken: vi.fn((t: string) => `${t.slice(0, 8)}****${t.slice(-4)}`),
  sanitizeUrl: vi.fn((u: string) => u),
}))

import { authenticate } from '../../src/stages/authenticate.js'
import { loadConfig, getHostAuth } from '../../src/services/config.js'
import { sanitizeToken } from '../../src/core/sanitize.js'

// ── Fixtures ──────────────────────────────────────────────────

const mockSource: ResolvedSource = {
  hostname: 'gitlab.example.com',
  repoPath: 'group/repo',
  protocol: 'https',
}

const mockReporter: Reporter = {
  startPhase: vi.fn(),
  updatePhase: vi.fn(),
  completePhase: vi.fn(),
  reportResult: vi.fn(),
  reportPlan: vi.fn(),
  reportError: vi.fn(),
  warn: vi.fn(),
}

function makeArgs(overrides: Partial<ParsedArgs> = {}): ParsedArgs {
  return {
    source: 'gitlab.example.com/group/repo',
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

// ── Tests ──────────────────────────────────────────────────────

describe('authenticate', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // Reset reporter mocks
    ;(mockReporter.startPhase as ReturnType<typeof vi.fn>).mockReset()
    // Reset env vars
    delete process.env['AIFORGE_TOKEN']
    delete process.env['GITLAB_TOKEN']
  })

  afterEach(() => {
    delete process.env['AIFORGE_TOKEN']
    delete process.env['GITLAB_TOKEN']
  })

  // AC #1: --ssh 和 --token 互斥
  describe('AC #1 — --ssh 与 --token 互斥', () => {
    it('同时传入 --ssh 和 --token 时抛出 ARG_CONFLICT 错误', async () => {
      const args = makeArgs({ ssh: true, token: 'glpat-sometoken1234' })

      await expect(authenticate(mockSource, args, mockReporter)).rejects.toThrow(AiforgeError)

      try {
        await authenticate(mockSource, args, mockReporter)
      } catch (err) {
        expect(err).toBeInstanceOf(AiforgeError)
        const e = err as AiforgeError
        expect(e.code).toBe('ARG_CONFLICT')
        expect(e.severity).toBe('fatal')
        expect(e.exitCode).toBe(3)
      }
    })

    it('互斥错误中不包含原始 Token', async () => {
      const token = 'glpat-secrettoken1234'
      const args = makeArgs({ ssh: true, token })

      try {
        await authenticate(mockSource, args, mockReporter)
      } catch (err) {
        const e = err as AiforgeError
        expect(e.message).not.toContain(token)
        expect(e.why).not.toContain(token)
      }
    })
  })

  // AC #2: CLI --ssh 优先
  describe('AC #2 — CLI --ssh 优先级最高', () => {
    it('--ssh 时返回 SSH authMethod 和 SSH URL', async () => {
      const args = makeArgs({ ssh: true })

      const result = await authenticate(mockSource, args, mockReporter)

      expect(result.authMethod).toBe('ssh')
      expect(result.cloneUrl).toBe('git@gitlab.example.com:group/repo.git')
      expect(result.hostname).toBe(mockSource.hostname)
      expect(result.repoPath).toBe(mockSource.repoPath)
    })

    it('--ssh 时忽略环境变量 AIFORGE_TOKEN', async () => {
      process.env['AIFORGE_TOKEN'] = 'glpat-envtoken1234'
      const args = makeArgs({ ssh: true })

      const result = await authenticate(mockSource, args, mockReporter)

      expect(result.authMethod).toBe('ssh')
      expect(result.cloneUrl).not.toContain('envtoken')
    })
  })

  // AC #3: CLI --token 优先
  describe('AC #3 — CLI --token 优先级最高', () => {
    it('--token 时返回 token authMethod 和注入 Token 的 HTTPS URL', async () => {
      const token = 'glpat-mytoken1234567'
      const args = makeArgs({ token })

      const result = await authenticate(mockSource, args, mockReporter)

      expect(result.authMethod).toBe('token')
      expect(result.cloneUrl).toBe(`https://oauth2:${token}@gitlab.example.com/group/repo.git`)
    })

    it('--token 时忽略环境变量 AIFORGE_TOKEN', async () => {
      process.env['AIFORGE_TOKEN'] = 'glpat-envtoken1234'
      const cliToken = 'glpat-clitoken1234'
      const args = makeArgs({ token: cliToken })

      const result = await authenticate(mockSource, args, mockReporter)

      expect(result.cloneUrl).toContain(cliToken)
      expect(result.cloneUrl).not.toContain('envtoken')
    })
  })

  // AC #3 (env): 环境变量 AIFORGE_TOKEN 回退
  describe('AC #3 env — 环境变量 AIFORGE_TOKEN 回退', () => {
    it('AIFORGE_TOKEN 优先于 GITLAB_TOKEN', async () => {
      process.env['AIFORGE_TOKEN'] = 'glpat-aiforgetoken12'
      process.env['GITLAB_TOKEN'] = 'glpat-gitlabtoken12'
      const args = makeArgs()

      const result = await authenticate(mockSource, args, mockReporter)

      expect(result.authMethod).toBe('token')
      expect(result.cloneUrl).toContain('aiforgetoken12')
      expect(result.cloneUrl).not.toContain('gitlabtoken12')
    })

    it('只有 GITLAB_TOKEN 时使用它', async () => {
      process.env['GITLAB_TOKEN'] = 'glpat-gitlabtoken1234'
      const args = makeArgs()

      const result = await authenticate(mockSource, args, mockReporter)

      expect(result.authMethod).toBe('token')
      expect(result.cloneUrl).toContain('gitlabtoken1234')
    })

    it('环境变量 Token 注入到 HTTPS URL 中', async () => {
      const envToken = 'glpat-envtoken1234567'
      process.env['AIFORGE_TOKEN'] = envToken
      const args = makeArgs()

      const result = await authenticate(mockSource, args, mockReporter)

      expect(result.cloneUrl).toBe(`https://oauth2:${envToken}@gitlab.example.com/group/repo.git`)
    })
  })

  // AC #4: 配置文件回退
  describe('AC #4 — 配置文件 per-host 认证回退', () => {
    it('config.json 中有 hostname 的 token 认证时使用它', async () => {
      vi.mocked(loadConfig).mockResolvedValue({
        auth: { 'gitlab.example.com': { method: 'token', token: 'glpat-configtoken12' } },
      })
      vi.mocked(getHostAuth).mockReturnValue({ method: 'token', token: 'glpat-configtoken12' })
      const args = makeArgs()

      const result = await authenticate(mockSource, args, mockReporter)

      expect(result.authMethod).toBe('token')
      expect(result.cloneUrl).toContain('configtoken12')
    })

    it('config.json 中有 hostname 的 ssh 认证时使用 SSH URL', async () => {
      vi.mocked(loadConfig).mockResolvedValue({
        auth: { 'gitlab.example.com': { method: 'ssh' } },
      })
      vi.mocked(getHostAuth).mockReturnValue({ method: 'ssh' })
      const args = makeArgs()

      const result = await authenticate(mockSource, args, mockReporter)

      expect(result.authMethod).toBe('ssh')
      expect(result.cloneUrl).toBe('git@gitlab.example.com:group/repo.git')
    })

    it('config.json 不存在（CONFIG_NOT_FOUND）时降级到系统凭据', async () => {
      vi.mocked(loadConfig).mockRejectedValue(
        new AiforgeError('未找到配置文件', 'CONFIG_NOT_FOUND', 3, 'fatal', '', []),
      )
      const args = makeArgs()

      const result = await authenticate(mockSource, args, mockReporter)

      expect(result.authMethod).toBe('credential-manager')
    })

    it('config.json 中无对应 hostname 时降级到系统凭据', async () => {
      vi.mocked(loadConfig).mockResolvedValue({ auth: {} })
      vi.mocked(getHostAuth).mockReturnValue(undefined)
      const args = makeArgs()

      const result = await authenticate(mockSource, args, mockReporter)

      expect(result.authMethod).toBe('credential-manager')
    })

    it('CONFIG_CORRUPT 错误透传，不降级（保护用户感知到真实配置问题）', async () => {
      vi.mocked(loadConfig).mockRejectedValue(
        new AiforgeError('配置文件损坏', 'CONFIG_CORRUPT', 3, 'fatal', 'config.json 格式错误', []),
      )
      const args = makeArgs()

      await expect(authenticate(mockSource, args, mockReporter)).rejects.toThrow(AiforgeError)
      await expect(authenticate(mockSource, args, mockReporter)).rejects.toMatchObject({
        code: 'CONFIG_CORRUPT',
        severity: 'fatal',
      })
    })

    it('CONFIG_READ_FAILED 错误透传，不降级', async () => {
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
      const args = makeArgs()

      await expect(authenticate(mockSource, args, mockReporter)).rejects.toThrow(AiforgeError)
      await expect(authenticate(mockSource, args, mockReporter)).rejects.toMatchObject({
        code: 'CONFIG_READ_FAILED',
        severity: 'fatal',
      })
    })
  })

  // AC #5: 系统凭据降级
  describe('AC #5 — 系统 Git 凭据降级', () => {
    it('无任何认证配置时降级到 credential-manager', async () => {
      vi.mocked(loadConfig).mockResolvedValue({ auth: {} })
      vi.mocked(getHostAuth).mockReturnValue(undefined)
      const args = makeArgs()

      const result = await authenticate(mockSource, args, mockReporter)

      expect(result.authMethod).toBe('credential-manager')
      expect(result.cloneUrl).toBe('https://gitlab.example.com/group/repo.git')
    })

    it('降级时不注入任何认证信息到 URL', async () => {
      vi.mocked(loadConfig).mockResolvedValue({ auth: {} })
      vi.mocked(getHostAuth).mockReturnValue(undefined)
      const args = makeArgs()

      const result = await authenticate(mockSource, args, mockReporter)

      expect(result.cloneUrl).not.toContain('@')
      expect(result.cloneUrl).not.toContain('oauth2')
    })
  })

  // AC #7: Token 脱敏
  describe('AC #7 — Token 脱敏', () => {
    it('调用 sanitizeToken 时 Token 格式为 前8+****+后4', () => {
      const token = 'glpat-abcdefgh1234'
      // sanitizeToken 由 mock 实现，验证格式
      const result = sanitizeToken(token)
      expect(result).toMatch(/^.{8}\*{4}.{4}$/)
    })

    it('sanitizeToken mock 已注册，短 token 格式由 core/sanitize.test.ts 覆盖', () => {
      // 短 token（<=12 字符）的脱敏格式（前4+****）由 core/sanitize.test.ts 直接覆盖
      // 此处仅验证 mock 函数已正确注册
      expect(vi.mocked(sanitizeToken)).toBeDefined()
    })

    it('环境变量分支：sanitizeToken 被调用且 reporter.updatePhase 收到脱敏 token', async () => {
      const envToken = 'glpat-secrettoken9999'
      process.env['AIFORGE_TOKEN'] = envToken
      const args = makeArgs()

      await authenticate(mockSource, args, mockReporter)

      // 验证 sanitizeToken 被调用，且传入了正确的 token
      expect(vi.mocked(sanitizeToken)).toHaveBeenCalledWith(envToken)

      // 验证 reporter.updatePhase 收到的是脱敏后的 token，而非原文
      expect(mockReporter.updatePhase).toHaveBeenCalled()
      const updatePhaseArg = (mockReporter.updatePhase as ReturnType<typeof vi.fn>).mock
        .calls[0]?.[0] as string
      expect(updatePhaseArg).not.toContain(envToken)
      // mock 的 sanitizeToken 返回 前8+****+后4 格式
      expect(updatePhaseArg).toContain('****')
    })
  })

  // reporter.startPhase 调用验证
  describe('Reporter 集成', () => {
    it('每次调用 authenticate 都触发 reporter.startPhase', async () => {
      const args = makeArgs({ ssh: true })

      await authenticate(mockSource, args, mockReporter)

      expect(mockReporter.startPhase).toHaveBeenCalledOnce()
      expect(mockReporter.startPhase).toHaveBeenCalledWith('验证认证信息...')
    })
  })
})
