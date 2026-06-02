/**
 * Epic 1 foundation E2E / flow-level coverage.
 *
 * Scope: Story 1.1 -> 1.5 only. Network-facing stages are mocked, while
 * CLI execution, reporter/path behavior, and production detect/match pipeline
 * paths use the real project modules.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import type { ParsedArgs, MatchedPlan } from '../../src/core/types.js'
import type { Reporter } from '../../src/core/reporter.js'
import { createReporter } from '../../src/core/reporter.js'
import type { PathResolver } from '../../src/core/path-resolver.js'
import { UnixPathResolver } from '../../src/core/path-resolver.js'
import { AiforgeError, EXIT_AUTH_FAILURE } from '../../src/core/errors.js'
import { sanitizeUrl } from '../../src/core/sanitize.js'
import { InstallType } from '../../src/core/types.js'
import { createProductionStages, runPipeline } from '../../src/pipeline.js'
import type { PipelineStages } from '../../src/pipeline.js'

const cloneMock = vi.hoisted(() => vi.fn())

vi.mock('../../src/stages/resolve-source.js', () => ({
  resolveSource: vi.fn(async () => ({
    hostname: 'gitlab.example.com',
    repoPath: 'org/foundation',
    protocol: 'https' as const,
  })),
}))

vi.mock('../../src/stages/authenticate.js', () => ({
  authenticate: vi.fn(async () => ({
    hostname: 'gitlab.example.com',
    repoPath: 'org/foundation',
    protocol: 'https' as const,
    authMethod: 'token' as const,
    cloneUrl: 'https://gitlab.example.com/org/foundation.git',
  })),
}))

vi.mock('../../src/stages/clone.js', () => ({
  cloneRepo: cloneMock,
}))

function createArgs(partial: Partial<ParsedArgs> = {}): ParsedArgs {
  return {
    source: 'https://gitlab.example.com/org/foundation',
    global: true,
    link: false,
    tools: ['claude'],
    dirs: [],
    dryRun: true,
    quiet: false,
    force: false,
    ssh: false,
    symlink: false,
    flatten: false,
    noUniversal: true,
    ...partial,
  }
}

function createMockReporter(): Reporter & {
  plans: MatchedPlan[]
  errors: AiforgeError[]
} {
  const plans: MatchedPlan[] = []
  const errors: AiforgeError[] = []

  return {
    plans,
    errors,
    startPhase: vi.fn(),
    updatePhase: vi.fn(),
    completePhase: vi.fn(),
    reportResult: vi.fn(),
    reportPlan: vi.fn((plan) => {
      plans.push(plan)
    }),
    reportList: vi.fn(),
    reportError: vi.fn((error) => {
      errors.push(error)
    }),
    info: vi.fn(),
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

describe('Epic 1 Foundation E2E', () => {
  let tmpDir: string
  let homeDir: string
  let repoDir: string
  let originalCwd: string
  let originalExitCode: number | string | undefined

  beforeEach(async () => {
    originalCwd = process.cwd()
    originalExitCode = process.exitCode
    tmpDir = await mkdtemp(join(tmpdir(), 'aiforge-epic1-'))
    homeDir = join(tmpDir, 'home')
    repoDir = join(tmpDir, 'repo')

    await mkdir(join(homeDir, '.aiforge'), { recursive: true })
    await mkdir(join(repoDir, 'agents'), { recursive: true })
    await mkdir(join(repoDir, 'skills', 'qa-skill'), { recursive: true })
    await mkdir(join(repoDir, 'instructions'), { recursive: true })
    await writeFile(join(repoDir, 'agents', 'foundation-agent.md'), '# Foundation Agent\n')
    await writeFile(join(repoDir, 'skills', 'qa-skill', 'index.md'), '# QA Skill\n')
    await writeFile(join(repoDir, 'instructions', 'CLAUDE.md'), '# Claude Instructions\n')

    process.chdir(tmpDir)
    cloneMock.mockResolvedValue({ repoDir, isNew: true, sourceFiles: [] })
  })

  afterEach(async () => {
    process.exitCode = originalExitCode
    process.chdir(originalCwd)
    await rm(tmpDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('Story 1.1: 已构建的 ESM CLI artifact 可由 Node 启动并读取 package 版本', () => {
    const distPath = resolve(originalCwd, 'dist/index.js')
    const pkgVersion = spawnSync(
      process.execPath,
      ['-e', "process.stdout.write(require('./package.json').version)"],
      {
        cwd: originalCwd,
        encoding: 'utf-8',
      },
    ).stdout

    expect(existsSync(distPath)).toBe(true)
    const startedAt = performance.now()
    const result = spawnSync(process.execPath, [distPath, '--version'], {
      cwd: originalCwd,
      encoding: 'utf-8',
    })
    const elapsedMs = performance.now() - startedAt

    expect(result.status).toBe(0)
    expect(result.stdout.trim()).toBe(pkgVersion)
    expect(elapsedMs).toBeLessThan(1000)
  })

  it('Story 1.2: fatal AiforgeError 在管道中停止后续阶段且错误信息不泄漏 token', async () => {
    const rawUrl = 'https://glpat-abcdefghijklmnop@gitlab.example.com/org/repo.git'
    const reporter = createMockReporter()
    const clone = vi.fn()
    const stages: PipelineStages = {
      resolve: vi.fn(async () => ({
        hostname: 'gitlab.example.com',
        repoPath: 'org/repo',
        protocol: 'https' as const,
      })),
      authenticate: vi.fn(async () => {
        throw new AiforgeError(
          `认证失败: ${sanitizeUrl(rawUrl)}`,
          'AUTH_TOKEN_REJECTED',
          EXIT_AUTH_FAILURE,
          'fatal',
          '远端拒绝了当前凭据',
          ['npx aiforge init'],
        )
      }),
      clone,
      detect: vi.fn(),
      match: vi.fn(),
      install: vi.fn(),
      saveManifest: vi.fn(),
      report: vi.fn(),
    }

    await runPipeline(createArgs(), reporter, stages)

    expect(clone).not.toHaveBeenCalled()
    expect(reporter.reportError).toHaveBeenCalledTimes(1)
    expect(reporter.errors[0]?.code).toBe('AUTH_TOKEN_REJECTED')
    expect(reporter.errors[0]?.message).toContain('glpat-ab****mnop')
    expect(reporter.errors[0]?.message).not.toContain('glpat-abcdefghijklmnop')
    expect(process.exitCode).toBe(EXIT_AUTH_FAILURE)
  })

  it('Story 1.3: PlainReporter 将阶段进度写入 stderr、dry-run 计划写入 stdout 且路径解析使用真实 HOME', () => {
    const pathResolver = new UnixPathResolver()
    expect(pathResolver.configDir()).toContain('.aiforge')

    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const reporter = createReporter({ quiet: false, isTty: false })

    reporter.startPhase('检测 AI 工具...')
    reporter.completePhase()
    reporter.reportPlan({
      items: [
        {
          rule: {
            tool: 'claude',
            scope: 'global',
            sourceDir: 'agents',
            type: InstallType.Files,
            targetDir: '~/.claude/agents/',
          },
          sourceFiles: [join(repoDir, 'agents', 'foundation-agent.md')],
          targetPath: join(homeDir, '.claude', 'agents'),
          mode: 'copy',
        },
      ],
    })

    const stdout = stdoutSpy.mock.calls.map((call) => String(call[0])).join('')
    const stderr = stderrSpy.mock.calls.map((call) => String(call[0])).join('')

    expect(stderr).toContain('检测 AI 工具')
    expect(stdout).toContain('foundation-agent.md')
    expect(stdout).toContain('.claude')
    expect(stdout).not.toMatch(/\u001b\[/)
    expect(stderr).not.toMatch(/\u001b\[/)
  })

  it('Story 1.4: 真实 detect→match dry-run 流程按数据规则生成 Claude 全局安装计划', async () => {
    const reporter = createMockReporter()
    const stages = createProductionStages(createPathResolver(homeDir))
    const args = createArgs({
      tools: ['claude'],
      global: true,
      dryRun: true,
      dirs: ['agents', 'skills', 'instructions'],
    })

    await runPipeline(args, reporter, stages)

    expect(reporter.reportPlan).toHaveBeenCalledTimes(1)
    const plan = reporter.plans[0]
    expect(plan).toBeDefined()
    expect(plan!.items.map((item) => item.rule.sourceDir).sort()).toEqual([
      'agents',
      'instructions',
      'skills',
    ])
    expect(plan!.items.every((item) => item.rule.tool === 'claude')).toBe(true)
    expect(plan!.items.every((item) => item.mode === 'copy')).toBe(true)
    expect(
      plan!.items.flatMap((item) => item.sourceFiles).map((file) => file.replace(repoDir, '')),
    ).toEqual(
      expect.arrayContaining([
        '/agents/foundation-agent.md',
        '/skills/qa-skill',
        '/instructions/CLAUDE.md',
      ]),
    )
  })

  it('Story 1.5: CLI help 暴露主命令参数、init 子命令和核心选项', () => {
    const distPath = resolve(originalCwd, 'dist/index.js')
    expect(existsSync(distPath)).toBe(true)

    const result = spawnSync(process.execPath, [distPath, '--help'], {
      cwd: originalCwd,
      encoding: 'utf-8',
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Usage: aiforge [options] [command] [repo-url]')
    expect(result.stdout).toContain('init')
    expect(result.stdout).toContain('--dry-run')
    expect(result.stdout).toContain('--tools <tools...>')
    expect(result.stdout).toContain('--dirs <dirs...>')
  })
})
