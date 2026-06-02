/**
 * Epic 4 E2E: 安装执行与冲突保护
 *
 * 只 mock Git 网络边界与交互式冲突决策；安装、manifest、pipeline、reporter 使用真实实现。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  access as fsAccess,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  rm,
  writeFile,
} from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import type { ParsedArgs } from '../../src/core/types.js'
import type { PathResolver } from '../../src/core/path-resolver.js'
import type { Reporter } from '../../src/core/reporter.js'
import { createReporter } from '../../src/core/reporter.js'
import { createProductionStages, runPipeline } from '../../src/pipeline.js'

vi.mock('../../src/stages/resolve-source.js', () => ({
  resolveSource: vi.fn(async () => ({
    hostname: 'gitlab.example.com',
    repoPath: 'org/knowledge-repo',
    protocol: 'https' as const,
  })),
}))

vi.mock('../../src/stages/authenticate.js', () => ({
  authenticate: vi.fn(async () => ({
    hostname: 'gitlab.example.com',
    repoPath: 'org/knowledge-repo',
    protocol: 'https' as const,
    authMethod: 'credential-manager' as const,
    cloneUrl: 'https://gitlab.example.com/org/knowledge-repo.git',
  })),
}))

const cloneMock = vi.hoisted(() => vi.fn())
vi.mock('../../src/stages/clone.js', () => ({
  cloneRepo: cloneMock,
}))

const conflictDecisionMock = vi.hoisted(() => vi.fn())
const handleConflictMock = vi.hoisted(() => vi.fn())
vi.mock('../../src/stages/conflict-resolver.js', () => ({
  handleConflict: handleConflictMock,
}))

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const FIXTURE_REPO = join(__dirname, '..', 'fixtures', 'sample-repo')

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
    source: 'https://gitlab.example.com/org/knowledge-repo',
    global: true,
    link: false,
    tools: ['claude'],
    dirs: ['agents'],
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

function createMockReporter(): Reporter {
  return {
    startPhase: vi.fn(),
    updatePhase: vi.fn(),
    completePhase: vi.fn(),
    reportResult: vi.fn(),
    reportPlan: vi.fn(),
    reportList: vi.fn(),
    reportError: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }
}

function captureProcessOutput() {
  const stdout: string[] = []
  const stderr: string[] = []
  const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    stdout.push(String(chunk))
    return true
  })
  const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    stderr.push(String(chunk))
    return true
  })

  return {
    stdout,
    stderr,
    restore: () => {
      stdoutSpy.mockRestore()
      stderrSpy.mockRestore()
    },
  }
}

async function runStages(pathResolver: PathResolver, args: ParsedArgs, reporter: Reporter) {
  const stages = createProductionStages(pathResolver)
  const source = await stages.resolve(args, reporter)
  const authed = await stages.authenticate(source, args, reporter)
  const repo = await stages.clone(authed, args, reporter)
  const env = await stages.detect(repo, args, reporter)
  const plan = await stages.match(env, args, reporter)
  const result = await stages.install(plan, args, reporter)
  return { stages, plan, result }
}

describe('Epic 4: 安装执行与冲突保护 E2E', () => {
  let tmpDir: string
  let homeDir: string
  let pathResolver: PathResolver
  let originalCwd: string

  beforeEach(async () => {
    originalCwd = process.cwd()
    tmpDir = await mkdtemp(join(tmpdir(), 'aiforge-epic4-e2e-'))
    homeDir = join(tmpDir, 'home')
    await mkdir(join(homeDir, '.aiforge'), { recursive: true })
    process.chdir(tmpDir)

    pathResolver = createPathResolver(homeDir)
    cloneMock.mockResolvedValue({
      repoDir: FIXTURE_REPO,
      isNew: true,
      sourceFiles: [],
    })
    conflictDecisionMock.mockResolvedValue('backup')
    handleConflictMock.mockImplementation(async () => conflictDecisionMock())
  })

  afterEach(async () => {
    process.exitCode = undefined
    process.chdir(originalCwd)
    await rm(tmpDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('4-1/4-2/4-4/4-6a/4-6b: runPipeline 执行 copy 安装、保存 manifest，并将结果输出到 stdout', async () => {
    const targetFile = join(homeDir, '.claude', 'agents', 'coding-agent.md')
    await expect(fsAccess(targetFile)).rejects.toMatchObject({ code: 'ENOENT' })

    const output = captureProcessOutput()
    try {
      const stages = createProductionStages(pathResolver)
      const reporter = createReporter({ quiet: false, isTty: false })
      await runPipeline(createArgs(), reporter, stages)
    } finally {
      output.restore()
    }

    const sourceContent = await readFile(join(FIXTURE_REPO, 'agents', 'coding-agent.md'), 'utf-8')
    const targetContent = await readFile(targetFile, 'utf-8')
    expect(targetContent).toBe(sourceContent)

    const manifest = JSON.parse(
      await readFile(join(homeDir, '.aiforge', 'manifest.json'), 'utf-8'),
    ) as Array<{ source: string; target: string; tool: string; scope: string; mode: string; hash: string }>
    const codingAgentEntry = manifest.find((entry) => entry.target === targetFile)
    expect(codingAgentEntry).toMatchObject({
      source: 'agents/coding-agent.md',
      target: targetFile,
      tool: 'claude',
      scope: 'global',
      mode: 'copy',
    })
    expect(codingAgentEntry?.hash).toMatch(/^[a-f0-9]{64}$/)

    expect(output.stdout.join('')).toContain(`new\tclaude\tagents/coding-agent.md\t${targetFile}`)
    expect(output.stdout.join('')).toContain('installed: 2\tupdated: 0\tskipped: 0')
    expect(output.stderr.join('')).toContain('[PHASE]')
    expect(output.stderr.join('')).not.toContain('ERROR:')
  })

  it('4-3: cursor global --link 对 skills 执行 flatten，并将扁平化结果创建为 symlink', async () => {
    const reporter = createMockReporter()
    const args = createArgs({
      tools: ['cursor'],
      dirs: ['skills'],
      global: true,
      link: true,
      symlink: true,
    })

    const { plan, result } = await runStages(pathResolver, args, reporter)

    const flattenPlan = plan.items.find((item) => item.rule.sourceDir === 'skills')
    expect(flattenPlan?.rule.type).toBe('Flatten')
    expect(flattenPlan?.mode).toBe('symlink')

    const flattenedTarget = join(homeDir, '.cursor', 'rules', 'code-review.md')
    const linkTarget = await readlink(flattenedTarget)
    expect(linkTarget).toBe(join(FIXTURE_REPO, 'skills', 'code-review', 'index.md'))
    expect(result.items).toContainEqual(
      expect.objectContaining({
        status: 'new',
        tool: 'cursor',
        sourcePath: join(FIXTURE_REPO, 'skills', 'code-review', 'index.md'),
        targetPath: flattenedTarget,
      }),
    )
  })

  it('4-4: 已由 manifest 记录且 hash 未变化的文件二次安装时跳过，并且不触发冲突交互', async () => {
    const reporter = createMockReporter()
    const stages = createProductionStages(pathResolver)
    const args = createArgs()

    const source = await stages.resolve(args, reporter)
    const authed = await stages.authenticate(source, args, reporter)
    const repo = await stages.clone(authed, args, reporter)
    const env = await stages.detect(repo, args, reporter)
    const firstPlan = await stages.match(env, args, reporter)
    const firstResult = await stages.install(firstPlan, args, reporter)
    await stages.saveManifest(firstResult)

    handleConflictMock.mockClear()

    const secondPlan = await stages.match(env, args, reporter)
    const secondResult = await stages.install(secondPlan, args, reporter)

    expect(secondResult.items).toHaveLength(firstResult.items.length)
    expect(secondResult.items.every((item) => item.status === 'skipped')).toBe(true)
    expect(handleConflictMock).not.toHaveBeenCalled()
  })

  it('4-5: 用户手写文件冲突选择 backup 后保留备份，并用仓库内容覆盖目标文件', async () => {
    const reporter = createMockReporter()
    const agentTargetDir = join(homeDir, '.claude', 'agents')
    await mkdir(agentTargetDir, { recursive: true })
    const targetFile = join(agentTargetDir, 'coding-agent.md')
    const originalContent = '# hand-written config'
    await writeFile(targetFile, originalContent)
    conflictDecisionMock.mockResolvedValue('backup')

    const { result } = await runStages(pathResolver, createArgs(), reporter)

    expect(handleConflictMock).toHaveBeenCalledWith(
      targetFile,
      join(FIXTURE_REPO, 'agents', 'coding-agent.md'),
      false,
      reporter,
    )
    expect(await readFile(targetFile, 'utf-8')).toBe(
      await readFile(join(FIXTURE_REPO, 'agents', 'coding-agent.md'), 'utf-8'),
    )

    const backupFiles = (await readdir(agentTargetDir)).filter((name) =>
      name.startsWith('coding-agent.md.aiforge-backup-'),
    )
    expect(backupFiles).toHaveLength(1)
    expect(await readFile(join(agentTargetDir, backupFiles[0]!), 'utf-8')).toBe(originalContent)
    expect(result.items).toContainEqual(
      expect.objectContaining({ targetPath: targetFile, status: 'updated' }),
    )
  })

  it('4-6a: install fatal 错误由 pipeline 捕获，停止 saveManifest/reportResult 并设置 exitCode', async () => {
    const reporter = createMockReporter()
    const stages = createProductionStages(pathResolver)
    const saveManifestSpy = vi.spyOn(stages, 'saveManifest')
    const reportSpy = vi.spyOn(stages, 'report')

    const args = createArgs({ global: false, link: true, symlink: true })
    await runPipeline(args, reporter, stages)

    expect(reporter.reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'LINK_PROJECT_REJECTED',
        severity: 'fatal',
      }),
    )
    expect(process.exitCode).toBe(3)
    expect(saveManifestSpy).not.toHaveBeenCalled()
    expect(reportSpy).not.toHaveBeenCalled()
  })
})
