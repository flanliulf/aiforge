/**
 * Epic 6: 精细化安装控制与通用目录适配流程级测试
 *
 * 网络边界使用 mock；list/match/install/config 读取等核心流程走真实实现。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { ParsedArgs } from '../../src/core/types.js'
import type { Reporter } from '../../src/core/reporter.js'
import type { PathResolver } from '../../src/core/path-resolver.js'
import { createProductionStages, runPipeline } from '../../src/pipeline.js'

vi.mock('../../src/stages/resolve-source.js', () => ({
  resolveSource: vi.fn(async () => ({
    hostname: 'gitlab.example.com',
    repoPath: 'org/epic-6-repo',
    protocol: 'https' as const,
  })),
}))

vi.mock('../../src/stages/authenticate.js', () => ({
  authenticate: vi.fn(async () => ({
    hostname: 'gitlab.example.com',
    repoPath: 'org/epic-6-repo',
    protocol: 'https' as const,
    authMethod: 'token' as const,
    cloneUrl: 'https://gitlab.example.com/org/epic-6-repo.git',
  })),
}))

const cloneMock = vi.hoisted(() => vi.fn())
vi.mock('../../src/stages/clone.js', () => ({
  cloneRepo: cloneMock,
}))

function createPathResolver(homeDir: string): PathResolver {
  return {
    home: () => homeDir,
    configDir: () => join(homeDir, '.aiforge'),
    reposDir: () => join(homeDir, '.aiforge', 'repos'),
    toolGlobalDir: (id: string) => join(homeDir, `.${id}`),
    toolProjectDir: (id: string) => `.${id}`,
  }
}

function createArgs(partial: Partial<ParsedArgs> = {}): ParsedArgs {
  return {
    source: 'https://gitlab.example.com/org/epic-6-repo',
    global: false,
    link: false,
    tools: ['claude'],
    dirs: [],
    dryRun: false,
    quiet: false,
    force: false,
    ssh: false,
    symlink: false,
    flatten: false,
    noUniversal: false,
    ...partial,
  }
}

function createRecordingReporter(): Reporter & {
  lists: Array<{ dirName: string; entries: string[] }>
} {
  const lists: Array<{ dirName: string; entries: string[] }> = []
  return {
    lists,
    startPhase: vi.fn(),
    updatePhase: vi.fn(),
    completePhase: vi.fn(),
    reportResult: vi.fn(),
    reportPlan: vi.fn(),
    reportList: vi.fn((dirName: string, entries: string[]) => {
      lists.push({ dirName, entries })
    }),
    reportError: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function createEpic6Repo(repoDir: string): Promise<void> {
  const skillNames = ['git-commit', 'git-push', 'code-review', 'deploy']
  for (const skillName of skillNames) {
    await mkdir(join(repoDir, 'skills', skillName), { recursive: true })
    await writeFile(join(repoDir, 'skills', skillName, 'index.md'), `# ${skillName}\n`, 'utf-8')
  }

  await mkdir(join(repoDir, 'agents'), { recursive: true })
  await writeFile(join(repoDir, 'agents', 'release-agent.md'), '# Release Agent\n', 'utf-8')
}

describe('Epic 6 精细化安装控制与通用目录适配 E2E', () => {
  let tmpDir: string
  let homeDir: string
  let repoDir: string
  let pathResolver: PathResolver
  let originalCwd: string

  beforeEach(async () => {
    originalCwd = process.cwd()
    tmpDir = await mkdtemp(join(tmpdir(), 'aiforge-epic6-e2e-'))
    homeDir = join(tmpDir, 'home')
    repoDir = join(tmpDir, 'knowledge-repo')
    await mkdir(join(homeDir, '.aiforge'), { recursive: true })
    await createEpic6Repo(repoDir)
    process.chdir(tmpDir)

    pathResolver = createPathResolver(homeDir)
    cloneMock.mockResolvedValue({
      repoDir,
      isNew: true,
      sourceFiles: [],
    })
  })

  afterEach(async () => {
    process.exitCode = undefined
    process.chdir(originalCwd)
    await rm(tmpDir, { recursive: true, force: true })
    vi.clearAllMocks()
  })

  it('6-1: --list skills 在 clone 后列出可安装子目录，并跳过安装阶段', async () => {
    const reporter = createRecordingReporter()
    const stages = createProductionStages(pathResolver)

    await runPipeline(createArgs({ list: 'skills' }), reporter, stages)

    expect(reporter.reportList).toHaveBeenCalledWith('skills', [
      'code-review',
      'deploy',
      'git-commit',
      'git-push',
    ])
    expect(reporter.reportResult).not.toHaveBeenCalled()
    expect(reporter.reportPlan).not.toHaveBeenCalled()
    expect(await pathExists(join(tmpDir, '.claude'))).toBe(false)
    expect(await pathExists(join(tmpDir, '.agents'))).toBe(false)
  })

  it('6-2/6-3: --dirs skills --filter skills/git* 只安装匹配 skill，并同步写入通用目录', async () => {
    const reporter = createRecordingReporter()
    const stages = createProductionStages(pathResolver)

    await runPipeline(
      createArgs({
        dirs: ['skills'],
        filter: 'skills/git*',
      }),
      reporter,
      stages,
    )

    await expect(
      readFile(join(tmpDir, '.claude', 'skills', 'git-commit', 'index.md'), 'utf-8'),
    ).resolves.toContain('# git-commit')
    await expect(
      readFile(join(tmpDir, '.claude', 'skills', 'git-push', 'index.md'), 'utf-8'),
    ).resolves.toContain('# git-push')
    expect(await pathExists(join(tmpDir, '.claude', 'skills', 'code-review'))).toBe(false)
    expect(await pathExists(join(tmpDir, '.claude', 'skills', 'deploy'))).toBe(false)

    await expect(
      readFile(join(tmpDir, '.agents', 'skills', 'git-commit', 'index.md'), 'utf-8'),
    ).resolves.toContain('# git-commit')
    await expect(
      readFile(join(tmpDir, '.agent', 'skills', 'git-push', 'index.md'), 'utf-8'),
    ).resolves.toContain('# git-push')
    expect(await pathExists(join(tmpDir, '.agents', 'skills', 'code-review'))).toBe(false)
    expect(await pathExists(join(tmpDir, '.agent', 'skills', 'deploy'))).toBe(false)
  })

  it('6-4: config.json 中 universalDirs=false 时 install 不写入通用目录', async () => {
    await writeFile(
      join(homeDir, '.aiforge', 'config.json'),
      JSON.stringify(
        {
          auth: {},
          universalDirs: false,
        },
        null,
        2,
      ),
      'utf-8',
    )

    const reporter = createRecordingReporter()
    const stages = createProductionStages(pathResolver)

    await runPipeline(createArgs({ dirs: ['skills'], filter: 'skills/git-commit' }), reporter, stages)

    await expect(
      readFile(join(tmpDir, '.claude', 'skills', 'git-commit', 'index.md'), 'utf-8'),
    ).resolves.toContain('# git-commit')
    expect(await pathExists(join(tmpDir, '.agents'))).toBe(false)
    expect(await pathExists(join(tmpDir, '.agent'))).toBe(false)
  })
})
