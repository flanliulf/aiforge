import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, mkdir, rm, writeFile, access as fsAccess } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import type { LocalRepo, ParsedArgs } from '../../src/core/types.js'
import type { Reporter } from '../../src/core/reporter.js'
import type { PathResolver } from '../../src/core/path-resolver.js'
import { detectTools } from '../../src/stages/detect-tools.js'
import { matchRules } from '../../src/stages/match-rules.js'
import { executeInstall } from '../../src/stages/execute-install.js'

type Scope = 'global' | 'project'

interface ToolScenario {
  tool: string
  scope: Scope
  markerRelativePath: string
  expectedRelativePath?: string
  expectMatches: boolean
}

const GLOBAL_SCENARIOS: ToolScenario[] = [
  {
    tool: 'copilot',
    scope: 'global',
    markerRelativePath: '.copilot',
    expectedRelativePath: '.copilot/agents/alpha-agent.md',
    expectMatches: true,
  },
  {
    tool: 'claude',
    scope: 'global',
    markerRelativePath: '.claude',
    expectedRelativePath: '.claude/agents/alpha-agent.md',
    expectMatches: true,
  },
  {
    tool: 'cursor',
    scope: 'global',
    markerRelativePath: '.cursor',
    expectedRelativePath: '.cursor/rules/sample-skill.md',
    expectMatches: true,
  },
  {
    tool: 'codex',
    scope: 'global',
    markerRelativePath: '.codex',
    expectedRelativePath: '.codex/agents/alpha-agent.md',
    expectMatches: true,
  },
  {
    tool: 'opencode',
    scope: 'global',
    markerRelativePath: '.config/opencode',
    expectedRelativePath: '.config/opencode/agents/alpha-agent.md',
    expectMatches: true,
  },
  {
    tool: 'auggie',
    scope: 'global',
    markerRelativePath: '.augment',
    expectedRelativePath: '.augment/agents/alpha-agent.md',
    expectMatches: true,
  },
  {
    tool: 'gemini',
    scope: 'global',
    markerRelativePath: '.gemini',
    expectedRelativePath: '.gemini/AGENTS.md',
    expectMatches: true,
  },
  {
    tool: 'windsurf',
    scope: 'global',
    markerRelativePath: '.codeium/windsurf',
    expectedRelativePath: '.codeium/windsurf/rules/windsurf-rule.md',
    expectMatches: true,
  },
  {
    tool: 'kiro',
    scope: 'global',
    markerRelativePath: '.kiro',
    expectedRelativePath: '.kiro/steering/AGENTS.md',
    expectMatches: true,
  },
  {
    tool: 'antigravity',
    scope: 'global',
    markerRelativePath: '.gemini/antigravity',
    expectedRelativePath: '.gemini/antigravity/agents/alpha-agent.md',
    expectMatches: true,
  },
  {
    tool: 'trae',
    scope: 'global',
    markerRelativePath: '.trae',
    expectMatches: false,
  },
]

const PROJECT_SCENARIOS: ToolScenario[] = [
  {
    tool: 'copilot',
    scope: 'project',
    markerRelativePath: '.github',
    expectedRelativePath: '.github/agents/alpha-agent.md',
    expectMatches: true,
  },
  {
    tool: 'claude',
    scope: 'project',
    markerRelativePath: '.claude',
    expectedRelativePath: '.claude/agents/alpha-agent.md',
    expectMatches: true,
  },
  {
    tool: 'cursor',
    scope: 'project',
    markerRelativePath: '.cursor',
    expectedRelativePath: '.cursor/rules/alpha-agent.md',
    expectMatches: true,
  },
  {
    tool: 'codex',
    scope: 'project',
    markerRelativePath: '.codex',
    expectedRelativePath: '.codex/agents/alpha-agent.md',
    expectMatches: true,
  },
  {
    tool: 'opencode',
    scope: 'project',
    markerRelativePath: '.opencode',
    expectedRelativePath: '.opencode/agents/alpha-agent.md',
    expectMatches: true,
  },
  {
    tool: 'auggie',
    scope: 'project',
    markerRelativePath: '.augment',
    expectedRelativePath: '.augment/agents/alpha-agent.md',
    expectMatches: true,
  },
  {
    tool: 'gemini',
    scope: 'project',
    markerRelativePath: '.gemini',
    expectedRelativePath: 'AGENTS.md',
    expectMatches: true,
  },
  {
    tool: 'windsurf',
    scope: 'project',
    markerRelativePath: '.windsurf',
    expectedRelativePath: '.windsurf/rules/windsurf-rule.md',
    expectMatches: true,
  },
  {
    tool: 'kiro',
    scope: 'project',
    markerRelativePath: '.kiro',
    expectedRelativePath: '.kiro/steering/AGENTS.md',
    expectMatches: true,
  },
  {
    tool: 'antigravity',
    scope: 'project',
    markerRelativePath: '.agents',
    expectedRelativePath: '.agents/skills/sample-skill/index.md',
    expectMatches: true,
  },
  {
    tool: 'trae',
    scope: 'project',
    markerRelativePath: '.trae',
    expectedRelativePath: '.trae/rules/trae-rule.md',
    expectMatches: true,
  },
]

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

function createPathResolver(homeDir: string): PathResolver {
  return {
    home: () => homeDir,
    configDir: () => join(homeDir, '.aiforge'),
    reposDir: () => join(homeDir, '.aiforge', 'repos'),
    toolGlobalDir: (toolId: string) => join(homeDir, `.${toolId}`),
    toolProjectDir: (toolId: string) => `.${toolId}`,
  }
}

function createArgs(overrides: Partial<ParsedArgs> = {}): ParsedArgs {
  return {
    source: 'https://gitlab.example.com/org/repo',
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

async function createKnowledgeRepo(repoDir: string): Promise<void> {
  await mkdir(join(repoDir, 'agents'), { recursive: true })
  await mkdir(join(repoDir, 'skills', 'sample-skill'), { recursive: true })
  await mkdir(join(repoDir, 'instructions'), { recursive: true })
  await mkdir(join(repoDir, 'mcp-tools'), { recursive: true })
  await mkdir(join(repoDir, 'rules'), { recursive: true })

  await writeFile(join(repoDir, 'agents', 'alpha-agent.md'), '# alpha agent\n')
  await writeFile(join(repoDir, 'skills', 'sample-skill', 'index.md'), '# sample skill\n')
  await writeFile(join(repoDir, 'skills', 'sample-skill', 'README.md'), 'sample\n')
  await writeFile(join(repoDir, 'instructions', 'AGENTS.md'), '# agents instruction\n')
  await writeFile(join(repoDir, 'instructions', 'CLAUDE.md'), '# claude instruction\n')
  await writeFile(join(repoDir, 'instructions', 'GEMINI.md'), '# gemini instruction\n')
  await writeFile(join(repoDir, 'mcp-tools', 'mcp.json'), '{"mcp": true}\n')
  await writeFile(join(repoDir, 'rules', 'windsurf-rule.md'), '# windsurf rule\n')
  await writeFile(join(repoDir, 'rules', 'trae-rule.md'), '# trae rule\n')
}

async function ensureMarker(baseDir: string, relativePath: string): Promise<void> {
  await mkdir(join(baseDir, relativePath), { recursive: true })
}

async function runScenario(
  scenario: ToolScenario,
  repo: LocalRepo,
  pathResolver: PathResolver,
  reporter: Reporter,
  homeDir: string,
  projectDir: string,
): Promise<void> {
  const baseDir = scenario.scope === 'global' ? homeDir : projectDir
  await ensureMarker(baseDir, scenario.markerRelativePath)

  const autoArgs = createArgs({ global: scenario.scope === 'global' })
  const autoEnv = await detectTools(repo, autoArgs, reporter, pathResolver)
  expect(autoEnv.tools).toContain(scenario.tool)

  const manualArgs = createArgs({
    global: scenario.scope === 'global',
    tools: [scenario.tool],
  })
  const manualEnv = await detectTools(repo, manualArgs, reporter, pathResolver)
  expect(manualEnv.tools).toEqual([scenario.tool])

  const plan = await matchRules(repo, manualEnv, manualArgs, reporter, pathResolver, false)
  const toolItems = plan.items.filter((item) => item.rule.tool === scenario.tool)

  if (!scenario.expectMatches) {
    expect(toolItems).toHaveLength(0)
    return
  }

  expect(toolItems.length).toBeGreaterThan(0)
  const result = await executeInstall(plan, manualArgs, reporter, pathResolver, {
    entries: [],
    degraded: false,
  })

  const toolResults = result.items.filter(
    (item) => item.tool === scenario.tool && item.manualAction == null,
  )
  expect(toolResults.length).toBeGreaterThan(0)

  const expectedMatch = toolResults.find((item) =>
    item.targetPath.endsWith(scenario.expectedRelativePath!),
  )
  expect(expectedMatch).toBeDefined()
  await expect(fsAccess(expectedMatch!.targetPath)).resolves.toBeUndefined()
}

describe('Story 7-10: eleven tools integration', () => {
  let tempRoot: string
  let homeDir: string
  let projectDir: string
  let repoDir: string
  let originalCwd: string
  let repo: LocalRepo
  let pathResolver: PathResolver
  let reporter: Reporter

  beforeEach(async () => {
    originalCwd = process.cwd()
    tempRoot = await mkdtemp(join(tmpdir(), 'aiforge-epic7-'))
    homeDir = join(tempRoot, 'home')
    projectDir = join(tempRoot, 'workspace')
    repoDir = join(tempRoot, 'knowledge-repo')

    await mkdir(homeDir, { recursive: true })
    await mkdir(projectDir, { recursive: true })
    await createKnowledgeRepo(repoDir)
    process.chdir(projectDir)

    repo = {
      repoDir,
      isNew: true,
      sourceFiles: [],
    }
    pathResolver = createPathResolver(homeDir)
    reporter = createMockReporter()
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    await rm(tempRoot, { recursive: true, force: true })
    vi.clearAllMocks()
  })

  describe.each(GLOBAL_SCENARIOS)('global scenario: $tool', (scenario) => {
    it('auto-detects, supports manual selection, and validates the global install outcome', async () => {
      await runScenario(scenario, repo, pathResolver, reporter, homeDir, projectDir)
    })
  })

  describe.each(PROJECT_SCENARIOS)('project scenario: $tool', (scenario) => {
    it('auto-detects, supports manual selection, and validates the project install outcome', async () => {
      await runScenario(scenario, repo, pathResolver, reporter, homeDir, projectDir)
    })
  })

  it('11 tools detection completes < 1000ms', async () => {
    for (const scenario of GLOBAL_SCENARIOS) {
      await ensureMarker(homeDir, scenario.markerRelativePath)
    }

    const start = performance.now()
    const env = await detectTools(repo, createArgs({ global: true }), reporter, pathResolver)
    const elapsed = performance.now() - start

    expect(new Set(env.tools)).toEqual(
      new Set([
        'copilot',
        'claude',
        'cursor',
        'codex',
        'opencode',
        'auggie',
        'gemini',
        'windsurf',
        'kiro',
        'antigravity',
        'trae',
      ]),
    )
    expect(elapsed).toBeLessThan(1000)
  })
})
