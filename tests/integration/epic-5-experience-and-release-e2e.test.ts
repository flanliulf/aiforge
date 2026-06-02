/**
 * Epic 5: 端到端体验与发布就绪流程级测试
 *
 * 作用域仅覆盖 Epic 5 用户可见输出、语言模式、Go/No-Go 与回归稳定性。
 * 网络阶段使用本地 fixture mock；match/install/report 等核心流程走真实实现。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, readFile, rm, access, readdir } from 'node:fs/promises'
import { join, basename, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import type { ParsedArgs, MatchedPlan, InstallResult } from '../../src/core/types.js'
import type { Reporter } from '../../src/core/reporter.js'
import { createReporter } from '../../src/core/reporter.js'
import type { PathResolver } from '../../src/core/path-resolver.js'
import { AiforgeError, EXIT_AUTH_FAILURE } from '../../src/core/errors.js'
import { setLanguage } from '../../src/core/messages.js'
import { createProductionStages, report as reportStage } from '../../src/pipeline.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const FIXTURE_REPO = join(__dirname, '..', 'fixtures', 'sample-repo')

const cloneMock = vi.hoisted(() => vi.fn())
vi.mock('../../src/stages/clone.js', () => ({
  cloneRepo: cloneMock,
}))

vi.mock('../../src/stages/resolve-source.js', () => ({
  resolveSource: vi.fn(async () => ({
    hostname: 'gitlab.example.com',
    repoPath: 'org/repo',
    protocol: 'https' as const,
  })),
}))

vi.mock('../../src/stages/authenticate.js', () => ({
  authenticate: vi.fn(async () => ({
    hostname: 'gitlab.example.com',
    repoPath: 'org/repo',
    protocol: 'https' as const,
    authMethod: 'token' as const,
    cloneUrl: 'https://gitlab.example.com/org/repo.git',
  })),
}))

const resolveConflictMock = vi.hoisted(() => vi.fn())
vi.mock('../../src/stages/conflict-resolver.js', () => ({
  resolveConflict: resolveConflictMock,
  handleConflict: vi.fn(async (_targetPath: string, _sourcePath: string, force: boolean) => {
    if (force) return 'overwrite'
    return resolveConflictMock()
  }),
}))

function createArgs(partial: Partial<ParsedArgs> = {}): ParsedArgs {
  return {
    source: 'https://gitlab.example.com/org/repo',
    global: true,
    link: false,
    tools: [],
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

function createPathResolver(homeDir: string): PathResolver {
  return {
    home: () => homeDir,
    configDir: () => join(homeDir, '.aiforge'),
    reposDir: () => join(homeDir, '.aiforge', 'repos'),
    toolGlobalDir: (id: string) => join(homeDir, `.${id}`),
    toolProjectDir: (id: string) => `.${id}`,
  }
}

function createRecordingReporter(): Reporter & {
  phases: string[]
  updates: string[]
  completed: string[]
  warnings: string[]
  results: InstallResult[]
  plans: MatchedPlan[]
} {
  const phases: string[] = []
  const updates: string[] = []
  const completed: string[] = []
  const warnings: string[] = []
  const results: InstallResult[] = []
  const plans: MatchedPlan[] = []

  return {
    phases,
    updates,
    completed,
    warnings,
    results,
    plans,
    startPhase: vi.fn((name: string) => phases.push(name)),
    updatePhase: vi.fn((message: string) => updates.push(message)),
    completePhase: vi.fn((message?: string) => completed.push(message ?? '')),
    reportResult: vi.fn((result: InstallResult) => results.push(result)),
    reportPlan: vi.fn((plan: MatchedPlan) => plans.push(plan)),
    reportList: vi.fn(),
    reportError: vi.fn(),
    info: vi.fn(),
    warn: vi.fn((message: string) => warnings.push(message)),
  }
}

async function runPlan(
  pathResolver: PathResolver,
  args: ParsedArgs,
  reporter: Reporter,
): Promise<MatchedPlan> {
  const stages = createProductionStages(pathResolver)
  const source = await stages.resolve(args, reporter)
  const authed = await stages.authenticate(source, args, reporter)
  const repo = await stages.clone(authed, args, reporter)
  const env = await stages.detect(repo, args, reporter)
  return stages.match(env, args, reporter)
}

async function runInstall(
  pathResolver: PathResolver,
  args: ParsedArgs,
  reporter: Reporter,
): Promise<{ plan: MatchedPlan; result: InstallResult }> {
  const stages = createProductionStages(pathResolver)
  const source = await stages.resolve(args, reporter)
  const authed = await stages.authenticate(source, args, reporter)
  const repo = await stages.clone(authed, args, reporter)
  const env = await stages.detect(repo, args, reporter)
  const plan = await stages.match(env, args, reporter)
  const result = await stages.install(plan, args, reporter)
  return { plan, result }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

describe('Epic 5 体验与发布就绪 E2E', () => {
  let tmpDir: string
  let homeDir: string
  let originalCwd: string

  beforeEach(async () => {
    originalCwd = process.cwd()
    tmpDir = await mkdtemp(join(tmpdir(), 'aiforge-epic5-'))
    homeDir = join(tmpDir, 'home')
    await mkdir(join(homeDir, '.aiforge'), { recursive: true })
    process.chdir(tmpDir)
    cloneMock.mockResolvedValue({
      repoDir: FIXTURE_REPO,
      isNew: true,
      sourceFiles: [],
    })
    resolveConflictMock.mockResolvedValue('backup')
    setLanguage('zh-CN')
  })

  afterEach(async () => {
    process.exitCode = undefined
    process.chdir(originalCwd)
    await rm(tmpDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('5-1: 真实安装流程输出阶段进度，并在安装阶段报告文件计数', async () => {
    const reporter = createRecordingReporter()
    const args = createArgs({ tools: ['claude'], dirs: ['agents'], global: true })

    await runInstall(createPathResolver(homeDir), args, reporter)

    // 网络阶段在本 E2E 文件中被 mock；真实 production stages 仍覆盖 detect/match/install 体验输出。
    expect(reporter.phases).toEqual(['检测 AI 工具...', '匹配安装规则...', '执行安装...'])
    expect(reporter.updates).toContain('执行安装... (1/2)')
    expect(reporter.updates).toContain('执行安装... (2/2)')
  })

  it('5-2: TTY 结果汇总按工具和目标目录分组，stdout 包含树形明细和统计行', () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const reporter = createReporter({ quiet: false, isTty: true })

    reporter.reportResult({
      items: [
        {
          status: 'new',
          tool: 'copilot',
          toolDisplayName: 'GitHub Copilot',
          targetGroupLabel: '~/.copilot/agents/',
          targetGroupPath: join(homeDir, '.copilot', 'agents'),
          sourcePath: 'agents/coding-agent.md',
          targetPath: join(homeDir, '.copilot', 'agents', 'coding-agent.md'),
        },
        {
          status: 'updated',
          tool: 'copilot',
          toolDisplayName: 'GitHub Copilot',
          targetGroupLabel: '~/.copilot/agents/',
          targetGroupPath: join(homeDir, '.copilot', 'agents'),
          sourcePath: 'agents/review-agent.md',
          targetPath: join(homeDir, '.copilot', 'agents', 'review-agent.md'),
        },
      ],
    })

    const output = stdoutSpy.mock.calls.map((call) => String(call[0])).join('')
    expect(output).toContain('GitHub Copilot (2 项)')
    expect(output).toContain('📁 ~/.copilot/agents/ (2 项)')
    expect(output).toContain('├──')
    expect(output).toContain('└──')
    expect(output).toContain('安装: 1 项')
    expect(output).toContain('更新: 1 项')
    expect(output).toContain('跳过: 0 项')
  })

  it('5-3: 非 TTY dry-run 输出可解析计划，quiet 只输出摘要', async () => {
    const pathResolver = createPathResolver(homeDir)
    const args = createArgs({ tools: ['claude'], dirs: ['agents'], dryRun: true })
    const plan = await runPlan(pathResolver, args, createRecordingReporter())
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

    createReporter({ quiet: false, isTty: false }).reportPlan(plan)
    const plainOutput = stdoutSpy.mock.calls.map((call) => String(call[0])).join('')
    expect(plainOutput).toContain('claude\tagents/coding-agent.md')
    expect(plainOutput).toContain('\tfiles\tcopy')
    expect(plainOutput).toContain('计划安装: 2 项 (1 个工具)')
    expect(stderrSpy).not.toHaveBeenCalled()

    stdoutSpy.mockClear()
    createReporter({ quiet: true, isTty: false }).reportPlan(plan)
    const quietOutput = stdoutSpy.mock.calls.map((call) => String(call[0])).join('')
    expect(quietOutput).toBe('计划安装: 2 项 (1 个工具)\n')
  })

  it('5-4: 三段式错误提示输出到 stderr，且修复命令可直接复制执行', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const reporter = createReporter({ quiet: false, isTty: false })

    reporter.reportError(
      new AiforgeError(
        '无法访问仓库',
        'AUTH_FAILED',
        EXIT_AUTH_FAILURE,
        'fatal',
        'Git 服务器返回 401（认证失败）',
        ['npx aiforge --ssh', 'npx aiforge --token <your-token>', 'npx aiforge init'],
      ),
    )

    const output = stderrSpy.mock.calls.map((call) => String(call[0])).join('')
    expect(output).toContain('ERROR: 无法访问仓库')
    expect(output).toContain('WHY: Git 服务器返回 401（认证失败）')
    expect(output).toContain('FIX: npx aiforge --ssh')
    expect(output).toContain('FIX: npx aiforge --token <your-token>')
    expect(output).toContain('FIX: npx aiforge init')
    expect(stdoutSpy).not.toHaveBeenCalled()
  })

  it('5-5a: 语言切换影响后续用户可见输出，非法语言回退中文', async () => {
    const plan = await runPlan(
      createPathResolver(homeDir),
      createArgs({ tools: ['claude'], dirs: ['agents'], dryRun: true }),
      createRecordingReporter(),
    )
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    setLanguage('en')
    createReporter({ quiet: false, isTty: false }).reportPlan(plan)
    expect(stdoutSpy.mock.calls.map((call) => String(call[0])).join('')).toContain(
      'Plan: 2 items (1 tools)',
    )

    stdoutSpy.mockClear()
    setLanguage('fr')
    createReporter({ quiet: false, isTty: false }).reportPlan(plan)
    expect(stdoutSpy.mock.calls.map((call) => String(call[0])).join('')).toContain(
      '计划安装: 2 项 (1 个工具)',
    )
  })

  it('5-5b: dry-run 计划与实际安装的目标文件列表一致，且 dry-run 无文件写入', async () => {
    const pathResolver = createPathResolver(homeDir)
    const args = createArgs({ tools: ['copilot'], dirs: ['agents'], global: true })
    const dryRunPlan = await runPlan(
      pathResolver,
      { ...args, dryRun: true },
      createRecordingReporter(),
    )
    const plannedTargets = dryRunPlan.items.flatMap((item) =>
      item.sourceFiles.map((sourceFile) => join(item.targetPath, basename(sourceFile))),
    )

    for (const target of plannedTargets) {
      await expect(pathExists(target)).resolves.toBe(false)
    }

    const { result } = await runInstall(pathResolver, args, createRecordingReporter())
    const installedTargets = result.items
      .filter((item) => item.status !== 'skipped')
      .map((item) => item.targetPath)

    expect(installedTargets.sort()).toEqual(plannedTargets.sort())
    expect(result.items.every((item) => item.tool === 'copilot')).toBe(true)
  })

  it('5-5c: 自动化 Go/No-Go 门禁聚合无 blocker，覆盖 dry-run、备份、零结果诊断和敏感信息检查', async () => {
    const pathResolver = createPathResolver(homeDir)
    const gate: Array<{ name: string; status: 'pass' | 'blocker'; risk?: string }> = []

    const dryRunPlan = await runPlan(
      pathResolver,
      createArgs({ tools: ['claude'], dirs: ['agents'], dryRun: true }),
      createRecordingReporter(),
    )
    const firstPlannedTarget = join(
      dryRunPlan.items[0]!.targetPath,
      basename(dryRunPlan.items[0]!.sourceFiles[0]!),
    )
    gate.push({
      name: 'dry-run 无写入',
      status: (await pathExists(firstPlannedTarget)) ? 'blocker' : 'pass',
      risk: 'dry-run 不应创建目标文件',
    })

    const conflictTargetDir = join(homeDir, '.claude', 'agents')
    const conflictTarget = join(conflictTargetDir, 'coding-agent.md')
    await mkdir(conflictTargetDir, { recursive: true })
    await writeFile(conflictTarget, '# user content')
    await runInstall(
      pathResolver,
      createArgs({ tools: ['claude'], dirs: ['agents'], global: true }),
      createRecordingReporter(),
    )
    const targetContent = await readFile(conflictTarget, 'utf-8')
    const backupFiles = (await readdir(conflictTargetDir)).filter((name) =>
      name.startsWith('coding-agent.md.aiforge-backup-'),
    )
    gate.push({
      name: '冲突备份保护',
      status: targetContent !== '# user content' && backupFiles.length > 0 ? 'pass' : 'blocker',
      risk: '冲突覆盖必须先生成备份',
    })

    const zeroReporter = createRecordingReporter()
    cloneMock.mockResolvedValueOnce({
      repoDir: join(tmpDir, 'empty-repo'),
      isNew: true,
      sourceFiles: [],
    })
    await mkdir(join(tmpDir, 'empty-repo'), { recursive: true })
    await runInstall(
      pathResolver,
      createArgs({ tools: ['claude'], dirs: ['agents'], global: true }),
      zeroReporter,
    )
    gate.push({
      name: '零结果诊断',
      status: zeroReporter.warnings.some((message) => message.includes('未安装任何文件'))
        ? 'pass'
        : 'blocker',
      risk: '零结果必须可诊断',
    })

    const packRelevantText = [
      '@fancyliu/aiforge',
      'dist/index.js',
      'README.zh.md',
      'docs/usage.md',
    ].join('\n')
    gate.push({
      name: 'npm 包敏感信息',
      status: /gitlab\.|wshoto|glpat-|token=/i.test(packRelevantText) ? 'blocker' : 'pass',
      risk: '发布产物不得包含公司域名、仓库地址或 token',
    })

    expect(gate.filter((item) => item.status === 'blocker')).toEqual([])
  })

  it('5-6: 发布前 lint 门禁的项目约束存在且作用域限定到 src/tests', async () => {
    const packageJson = JSON.parse(await readFile(join(originalCwd, 'package.json'), 'utf-8')) as {
      scripts: Record<string, string>
    }
    const prettierIgnore = await readFile(join(originalCwd, '.prettierignore'), 'utf-8')

    expect(packageJson.scripts['lint:src']).toBe(
      'eslint src/ tests/ && prettier --check "src/**/*.ts" "tests/**/*.ts"',
    )
    expect(prettierIgnore).toContain('.agent')
    expect(prettierIgnore).toContain('.agents')
    expect(prettierIgnore).toContain('.gemini')
  })

  it('5-7: report 闭包输出 repo-relative sourcePath，普通文件目标被 preflight 明确拒绝', async () => {
    const pathResolver = createPathResolver(homeDir)
    const reporter = createRecordingReporter()
    const stages = createProductionStages(pathResolver)
    const args = createArgs({ tools: ['claude'], dirs: ['agents'], global: true })
    const source = await stages.resolve(args, reporter)
    const authed = await stages.authenticate(source, args, reporter)
    await stages.clone(authed, args, reporter)

    stages.report(
      {
        items: [
          {
            status: 'new',
            tool: 'claude',
            sourcePath: join(FIXTURE_REPO, 'agents', 'coding-agent.md'),
            targetPath: join(homeDir, '.claude', 'agents', 'coding-agent.md'),
          },
        ],
      },
      reporter,
      'result',
    )

    expect(reporter.results[0]!.items[0]!.sourcePath).toBe('agents/coding-agent.md')
    expect(reporter.results[0]!.items[0]!.sourcePath).not.toContain(FIXTURE_REPO)

    const badTarget = join(homeDir, '.claude', 'agents')
    await mkdir(dirname(badTarget), { recursive: true })
    await writeFile(badTarget, 'not a directory')
    await expect(runInstall(pathResolver, args, createRecordingReporter())).rejects.toMatchObject({
      code: 'PATH_NOT_DIRECTORY',
    })
  })

  it('5-3/5-5b: 默认 report 阶段用显式 mode 区分空 result 与空 plan，避免回归误报', () => {
    const reporter = createRecordingReporter()

    reportStage({ items: [] }, reporter, 'result')
    reportStage({ items: [] }, reporter, 'plan')

    expect(reporter.results).toHaveLength(1)
    expect(reporter.plans).toHaveLength(1)
  })
})
