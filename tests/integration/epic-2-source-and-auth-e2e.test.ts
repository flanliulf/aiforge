/**
 * Epic 2 source + auth E2E / flow-level coverage.
 *
 * Scope: Story 2.1 -> 2.5 only. Real modules are used for config persistence,
 * source resolution, auth selection, clone orchestration, and init flow. The
 * external Git boundary and interactive prompts are mocked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Command } from 'commander'
import { mkdtemp, mkdir, writeFile, readFile, stat, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ParsedArgs, AiforgeConfig, AuthenticatedSource } from '../../src/core/types.js'
import type { Reporter } from '../../src/core/reporter.js'
import type { PathResolver } from '../../src/core/path-resolver.js'
import { AiforgeError } from '../../src/core/errors.js'

const mocks = vi.hoisted(() => ({
  input: vi.fn(),
  select: vi.fn(),
  password: vi.fn(),
  confirm: vi.fn(),
  createGit: vi.fn(),
  pathHome: '/tmp/aiforge-epic2-home-unset',
}))

vi.mock('@inquirer/prompts', () => ({
  input: mocks.input,
  select: mocks.select,
  password: mocks.password,
  confirm: mocks.confirm,
}))

vi.mock('../../src/services/git.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/git.js')>()
  return {
    ...actual,
    createGit: mocks.createGit,
  }
})

vi.mock('../../src/core/path-resolver.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/path-resolver.js')>()
  return {
    ...actual,
    UnixPathResolver: class MockUnixPathResolver {
      home() {
        return mocks.pathHome
      }
      configDir() {
        return `${mocks.pathHome}/.aiforge`
      }
      reposDir() {
        return `${mocks.pathHome}/.aiforge/repos`
      }
      toolGlobalDir(id: string) {
        return `${mocks.pathHome}/.${id}`
      }
      toolProjectDir(id: string) {
        return `.${id}`
      }
    },
  }
})

import { loadConfig, saveConfig, getHostAuth } from '../../src/services/config.js'
import { resolveSource } from '../../src/stages/resolve-source.js'
import { authenticate } from '../../src/stages/authenticate.js'
import { cloneRepo } from '../../src/stages/clone.js'
import { registerInitCommand } from '../../src/commands/init.js'

function createArgs(partial: Partial<ParsedArgs> = {}): ParsedArgs {
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
    noUniversal: true,
    symlink: false,
    flatten: false,
    ...partial,
  }
}

function createReporter(): Reporter {
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

function createPathResolver(homeDir: string): PathResolver {
  return {
    home: () => homeDir,
    configDir: () => join(homeDir, '.aiforge'),
    reposDir: () => join(homeDir, '.aiforge', 'repos'),
    toolGlobalDir: (id: string) => join(homeDir, `.${id}`),
    toolProjectDir: (id: string) => `.${id}`,
  }
}

describe('Epic 2: 知识仓库获取与认证 E2E', () => {
  let tmpDir: string
  let homeDir: string
  let pathResolver: PathResolver
  let originalIsTTY: boolean | undefined
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'aiforge-epic2-'))
    homeDir = join(tmpDir, 'home')
    pathResolver = createPathResolver(homeDir)
    mocks.pathHome = homeDir
    originalIsTTY = process.stdin.isTTY
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    vi.clearAllMocks()
    delete process.env['AIFORGE_TOKEN']
    delete process.env['GITLAB_TOKEN']
  })

  afterEach(async () => {
    logSpy.mockRestore()
    Object.defineProperty(process.stdin, 'isTTY', {
      value: originalIsTTY,
      writable: true,
      configurable: true,
    })
    delete process.env['AIFORGE_TOKEN']
    delete process.env['GITLAB_TOKEN']
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('Story 2.1: 真实配置服务首次保存后创建 0o600 config，并可按 host 读取多认证配置', async () => {
    const config: AiforgeConfig = {
      defaultRepo: 'https://gitlab.example.com/org/aicoding-base.git',
      cloneDir: join(homeDir, 'custom-repos'),
      language: 'zh-CN',
      preferSSH: false,
      auth: {
        'gitlab.example.com': { method: 'token', token: 'glpat-config12345678' },
        'github.com': { method: 'ssh' },
      },
    }

    await saveConfig(config, pathResolver)

    const configPath = join(homeDir, '.aiforge', 'config.json')
    const mode = (await stat(configPath)).mode & 0o777
    const loaded = await loadConfig(pathResolver)

    expect(mode).toBe(0o600)
    expect(loaded).toEqual(config)
    expect(getHostAuth(loaded, 'gitlab.example.com')).toEqual({
      method: 'token',
      token: 'glpat-config12345678',
    })
    expect(getHostAuth(loaded, 'github.com')).toEqual({ method: 'ssh' })
  })

  it('Story 2.2: 无 CLI URL 时通过真实 config defaultRepo 解析 SSH 知识源', async () => {
    await saveConfig(
      {
        defaultRepo: 'git@gitlab.example.com:platform/aicoding-base.git',
        auth: {},
      },
      pathResolver,
    )

    const result = await resolveSource(createArgs({ source: '' }), createReporter(), pathResolver)

    expect(result).toEqual({
      hostname: 'gitlab.example.com',
      repoPath: 'platform/aicoding-base',
      protocol: 'ssh',
    })
  })

  it('Story 2.3: 真实 resolve → auth 链优先使用 CLI，其次环境变量，最后 per-host config', async () => {
    await saveConfig(
      {
        defaultRepo: 'https://gitlab.example.com/platform/aicoding-base.git',
        auth: {
          'gitlab.example.com': { method: 'token', token: 'glpat-config12345678' },
        },
      },
      pathResolver,
    )
    const source = await resolveSource(createArgs(), createReporter(), pathResolver)

    const cliSsh = await authenticate(source, createArgs({ ssh: true }), createReporter(), pathResolver)
    expect(cliSsh.authMethod).toBe('ssh')
    expect(cliSsh.cloneUrl).toBe('git@gitlab.example.com:platform/aicoding-base.git')

    process.env['AIFORGE_TOKEN'] = 'glpat-env1234567890'
    const envToken = await authenticate(source, createArgs(), createReporter(), pathResolver)
    expect(envToken.authMethod).toBe('token')
    expect(envToken.cloneUrl).toContain('glpat-env1234567890')

    delete process.env['AIFORGE_TOKEN']
    const configToken = await authenticate(source, createArgs(), createReporter(), pathResolver)
    expect(configToken.authMethod).toBe('token')
    expect(configToken.cloneUrl).toBe(
      'https://oauth2:glpat-config12345678@gitlab.example.com/platform/aicoding-base.git',
    )
  })

  it('Story 2.4: clone 阶段首次浅克隆后清理 token remote，已有仓库时改走 pull', async () => {
    const git = {
      clone: vi.fn(async (_url: string, targetDir: string) => {
        await mkdir(join(targetDir, '.git'), { recursive: true })
        await writeFile(join(targetDir, 'AGENTS.md'), '# Agent rules\n')
      }),
      pull: vi.fn(),
      remote: vi.fn(),
      raw: vi.fn(),
    }
    mocks.createGit.mockReturnValue(git)

    const source: AuthenticatedSource = {
      hostname: 'gitlab.example.com',
      repoPath: 'platform/aicoding-base',
      protocol: 'https',
      authMethod: 'token',
      cloneUrl:
        'https://oauth2:glpat-secret12345678@gitlab.example.com/platform/aicoding-base.git',
    }

    const first = await cloneRepo(source, createArgs(), createReporter(), pathResolver)

    expect(first).toMatchObject({
      repoDir: join(homeDir, '.aiforge', 'repos', 'aicoding-base'),
      isNew: true,
      sourceFiles: ['AGENTS.md'],
    })
    expect(git.clone).toHaveBeenCalledWith(
      'https://oauth2:glpat-secret12345678@gitlab.example.com/platform/aicoding-base.git',
      join(homeDir, '.aiforge', 'repos', 'aicoding-base'),
      ['--depth', '1'],
    )
    expect(git.remote).toHaveBeenCalledWith([
      'set-url',
      'origin',
      'https://gitlab.example.com/platform/aicoding-base.git',
    ])
    expect(source.cloneUrl).toBe('https://gitlab.example.com/platform/aicoding-base.git')

    const second = await cloneRepo(source, createArgs(), createReporter(), pathResolver)

    expect(second.isNew).toBe(false)
    expect(git.clone).toHaveBeenCalledTimes(1)
    expect(git.pull).toHaveBeenCalledTimes(1)
  })

  it('Story 2.5: aiforge init 交互流程验证 token 后按 host 保存真实 config', async () => {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: true,
      writable: true,
      configurable: true,
    })

    const repoUrl = 'https://gitlab.example.com/platform/aicoding-base.git'
    const token = 'glpat-init1234567890'
    const raw = vi.fn().mockResolvedValue('')
    mocks.createGit.mockReturnValue({ raw })
    mocks.input.mockResolvedValue(repoUrl)
    mocks.select
      .mockResolvedValueOnce('zh-CN')
      .mockResolvedValueOnce('token')
    mocks.password.mockResolvedValue(token)
    mocks.confirm.mockResolvedValue(true)

    const program = new Command()
    program.exitOverride()
    registerInitCommand(program)

    await program.parseAsync(['node', 'aiforge', 'init'])

    expect(raw).toHaveBeenCalledWith([
      'ls-remote',
      '--exit-code',
      `https://oauth2:${token}@gitlab.example.com/platform/aicoding-base.git`,
    ])

    const saved = JSON.parse(
      await readFile(join(homeDir, '.aiforge', 'config.json'), 'utf-8'),
    ) as AiforgeConfig

    expect(saved).toMatchObject({
      defaultRepo: repoUrl,
      language: 'zh-CN',
      universalDirs: true,
      auth: {
        'gitlab.example.com': {
          method: 'token',
          token,
        },
      },
    })
    expect(logSpy.mock.calls.map((call) => String(call[0])).join('\n')).not.toContain(token)
  })

  it('Story 2.5: 非 TTY init 直接失败且不会进入交互 prompt', async () => {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: false,
      writable: true,
      configurable: true,
    })

    const program = new Command()
    program.exitOverride()
    registerInitCommand(program)

    await expect(program.parseAsync(['node', 'aiforge', 'init'])).rejects.toMatchObject({
      code: 'NON_TTY',
      severity: 'fatal',
    })
    expect(mocks.input).not.toHaveBeenCalled()
    expect(mocks.select).not.toHaveBeenCalled()
  })

  it('Story 2.2: 缺少 URL 且没有默认配置时保留 NO_REPO fatal 失败语义', async () => {
    await mkdir(join(homeDir, '.aiforge'), { recursive: true })

    await expect(resolveSource(createArgs(), createReporter(), pathResolver)).rejects.toMatchObject({
      code: 'NO_REPO',
      severity: 'fatal',
    } satisfies Partial<AiforgeError>)
  })
})
