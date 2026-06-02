/**
 * Epic 3 detection + planning E2E / flow-level coverage.
 *
 * Scope: Story 3.1 -> 3.3 only. The tests use real detect, match, and
 * reportPlan behavior with temporary HOME/cwd/repo fixtures. No production
 * install stage is invoked.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import type { ParsedArgs, DetectedEnv, MatchedPlan } from '../../src/core/types.js'
import { InstallType } from '../../src/core/types.js'
import type { Reporter } from '../../src/core/reporter.js'
import { createReporter } from '../../src/core/reporter.js'
import type { PathResolver } from '../../src/core/path-resolver.js'
import { detectTools } from '../../src/stages/detect-tools.js'
import { matchRules } from '../../src/stages/match-rules.js'

function createArgs(partial: Partial<ParsedArgs> = {}): ParsedArgs {
  return {
    source: 'https://gitlab.example.com/org/knowledge-base',
    global: true,
    link: false,
    tools: [],
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

function createSpyReporter(): Reporter & {
  phases: string[]
  warnings: string[]
  infos: string[]
} {
  const phases: string[] = []
  const warnings: string[] = []
  const infos: string[] = []

  return {
    phases,
    warnings,
    infos,
    startPhase: vi.fn((name: string) => {
      phases.push(name)
    }),
    updatePhase: vi.fn(),
    completePhase: vi.fn(),
    reportResult: vi.fn(),
    reportPlan: vi.fn(),
    reportList: vi.fn(),
    reportError: vi.fn(),
    info: vi.fn((message: string) => {
      infos.push(message)
    }),
    warn: vi.fn((message: string) => {
      warnings.push(message)
    }),
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

async function createKnowledgeRepo(repoDir: string): Promise<void> {
  await mkdir(join(repoDir, 'agents'), { recursive: true })
  await mkdir(join(repoDir, 'skills', 'testing-skill'), { recursive: true })
  await mkdir(join(repoDir, 'instructions'), { recursive: true })
  await mkdir(join(repoDir, 'mcp-tools'), { recursive: true })

  await writeFile(join(repoDir, 'agents', 'epic3-agent.md'), '# Epic 3 Agent\n')
  await writeFile(join(repoDir, 'agents', 'README.md'), '# Excluded agent readme\n')
  await writeFile(join(repoDir, 'agents', '.gitkeep'), '')
  await writeFile(join(repoDir, 'agents', '.DS_Store'), '')
  await writeFile(join(repoDir, 'skills', 'testing-skill', 'index.md'), '# Testing Skill\n')
  await writeFile(join(repoDir, 'instructions', 'AGENTS.md'), '# Copilot Instructions\n')
  await writeFile(join(repoDir, 'instructions', 'CLAUDE.md'), '# Claude Instructions\n')
  await writeFile(join(repoDir, 'mcp-tools', 'server.json'), '{"mcpServers":{}}\n')
}

describe('Epic 3: 智能检测与安装规划 E2E', () => {
  let tmpDir: string
  let homeDir: string
  let projectDir: string
  let repoDir: string
  let originalCwd: string
  let pathResolver: PathResolver
  let reporter: ReturnType<typeof createSpyReporter>

  beforeEach(async () => {
    originalCwd = process.cwd()
    tmpDir = await mkdtemp(join(tmpdir(), 'aiforge-epic3-'))
    homeDir = join(tmpDir, 'home')
    projectDir = join(tmpDir, 'project')
    repoDir = join(tmpDir, 'repo')

    await mkdir(homeDir, { recursive: true })
    await mkdir(projectDir, { recursive: true })
    await mkdir(join(projectDir, '.github'), { recursive: true })
    await mkdir(join(projectDir, '.claude'), { recursive: true })
    await mkdir(join(projectDir, '.cursor'), { recursive: true })
    await createKnowledgeRepo(repoDir)

    process.chdir(projectDir)
    pathResolver = createPathResolver(homeDir)
    reporter = createSpyReporter()
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    await rm(tmpDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('Story 3.1: 自动检测从项目侧标志识别多个 AI 工具，并设置全局安装 scope', async () => {
    const env = await detectTools(
      { repoDir, isNew: true, sourceFiles: [] },
      createArgs({ global: true }),
      reporter,
      pathResolver,
    )

    expect(env.scope).toBe('global')
    expect(env.tools).toEqual(expect.arrayContaining(['copilot', 'claude', 'cursor']))
    expect(env.tools).not.toContain('codex')
    expect(reporter.startPhase).toHaveBeenCalledWith(expect.stringContaining('检测'))
    expect(reporter.warn).not.toHaveBeenCalled()
  })

  it('Story 3.2: 真实 detect→match 根据工具与 --dirs 生成规则计划并过滤仓库辅助文件', async () => {
    const env = await detectTools(
      { repoDir, isNew: true, sourceFiles: [] },
      createArgs({ global: true }),
      reporter,
      pathResolver,
    )
    const args = createArgs({ global: true, dirs: ['agents', 'skills'] })

    const plan = await matchRules(
      { repoDir, isNew: true, sourceFiles: [] },
      env,
      args,
      reporter,
      pathResolver,
    )

    expect(plan.items.length).toBeGreaterThanOrEqual(3)
    expect(new Set(plan.items.map((item) => item.rule.sourceDir))).toEqual(
      new Set(['agents', 'skills']),
    )
    expect(plan.items.every((item) => item.mode === 'copy')).toBe(true)

    const copilotItems = plan.items.filter((item) => item.rule.tool === 'copilot')
    expect(copilotItems.map((item) => item.rule.type).sort()).toEqual(
      [InstallType.Directories, InstallType.Files].sort(),
    )
    expect(copilotItems.map((item) => item.targetPath).sort()).toEqual([
      join(homeDir, '.copilot', 'agents/'),
      join(homeDir, '.copilot', 'skills/'),
    ])

    const plannedNames = plan.items.flatMap((item) => item.sourceFiles.map((file) => basename(file)))
    expect(plannedNames).toEqual(expect.arrayContaining(['epic3-agent.md', 'testing-skill']))
    expect(plannedNames).not.toEqual(expect.arrayContaining(['README.md', '.gitkeep', '.DS_Store']))
  })

  it('Story 3.3: 真实 MatchedPlan 经 PlainReporter 输出 dry-run 计划，且不创建目标安装目录', async () => {
    const env: DetectedEnv = await detectTools(
      { repoDir, isNew: true, sourceFiles: [] },
      createArgs({ global: true }),
      reporter,
      pathResolver,
    )
    const args = createArgs({ global: true, tools: [], dirs: ['agents', 'skills'] })
    const plan: MatchedPlan = await matchRules(
      { repoDir, isNew: true, sourceFiles: [] },
      env,
      args,
      reporter,
      pathResolver,
    )

    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const plainReporter = createReporter({ quiet: false, isTty: false })

    plainReporter.reportPlan(plan)

    const stdout = stdoutSpy.mock.calls.map((call) => String(call[0])).join('')
    const stderr = stderrSpy.mock.calls.map((call) => String(call[0])).join('')

    expect(stdout).toContain('copilot\tagents/epic3-agent.md')
    expect(stdout).toContain('copilot\tskills/testing-skill')
    expect(stdout).toContain('\tfiles\tcopy')
    expect(stdout).toContain('\tdirectories\tcopy')
    expect(stdout).toContain('计划安装:')
    expect(stderr).toBe('')

    await expect(access(join(homeDir, '.copilot'))).rejects.toMatchObject({ code: 'ENOENT' })
    expect(reporter.reportResult).not.toHaveBeenCalled()

    stdoutSpy.mockRestore()
    stderrSpy.mockRestore()
  })
})
