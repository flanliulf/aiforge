import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { DetectedEnv, ParsedArgs } from '../../src/core/types.js'
import type { Reporter } from '../../src/core/reporter.js'
import { InstallType } from '../../src/core/types.js'
import { setLanguage } from '../../src/core/messages.js'

const { mockGeminiPreconditionCheck } = vi.hoisted(() => ({
  mockGeminiPreconditionCheck: vi.fn(),
}))

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(),
}))
// Story 6-2: mock @inquirer/prompts 中的 select 函数（用于 TTY 零匹配交互测试）
vi.mock('@inquirer/prompts', () => ({
  select: vi.fn(),
}))
vi.mock('../../src/data/install-rules.js', () => ({
  RULE_INDEX: new Map([
    [
      'copilot:global',
      [
        {
          tool: 'copilot',
          scope: 'global',
          sourceDir: 'agents',
          type: InstallType.Files,
          targetDir: '~/.copilot/agents/',
        },
        {
          tool: 'copilot',
          scope: 'global',
          sourceDir: 'skills',
          type: InstallType.Directories,
          targetDir: '~/.copilot/skills/',
        },
        {
          tool: 'copilot',
          scope: 'global',
          sourceDir: 'instructions',
          type: InstallType.Files,
          targetDir: '~/.copilot/',
          fileFilter: ['AGENTS.md'],
        },
      ],
    ],
    [
      'claude:project',
      [
        {
          tool: 'claude',
          scope: 'project',
          sourceDir: 'agents',
          type: InstallType.Files,
          targetDir: '.claude/agents/',
        },
        {
          tool: 'claude',
          scope: 'project',
          sourceDir: 'skills',
          type: InstallType.Directories,
          targetDir: '.claude/skills/',
        },
        {
          tool: 'claude',
          scope: 'project',
          sourceDir: 'instructions',
          type: InstallType.Files,
          targetDir: '.claude/',
          fileFilter: ['CLAUDE.md'],
        },
      ],
    ],
    [
      'auggie:project',
      [
        {
          tool: 'auggie',
          scope: 'project',
          sourceDir: 'skills',
          type: InstallType.Directories,
          targetDir: '.augment/skills/',
        },
        {
          tool: 'auggie',
          scope: 'project',
          sourceDir: 'agents',
          type: InstallType.Files,
          targetDir: '.augment/agents/',
        },
        {
          tool: 'auggie',
          scope: 'project',
          sourceDir: 'instructions',
          type: InstallType.Files,
          targetDir: './',
          fileFilter: ['AGENTS.md'],
        },
      ],
    ],
    [
      'cursor:global',
      [
        {
          tool: 'cursor',
          scope: 'global',
          sourceDir: 'skills',
          type: InstallType.Flatten,
          targetDir: '~/.cursor/rules/',
        },
      ],
    ],
    [
      'gemini:global',
      [
        {
          tool: 'gemini',
          scope: 'global',
          sourceDir: 'skills',
          type: InstallType.Directories,
          targetDir: '~/.gemini/skills/',
        },
        {
          tool: 'gemini',
          scope: 'global',
          sourceDir: 'instructions',
          type: InstallType.Files,
          targetDir: '~/.gemini/',
          fileFilter: ['AGENTS.md', 'GEMINI.md'],
        },
      ],
    ],
  ]),
  TOOL_PRECONDITIONS: {
    gemini: {
      check: mockGeminiPreconditionCheck,
      affectedSourceDirs: ['skills'],
    },
  },
  UNIVERSAL_RULES: [
    {
      tool: 'universal',
      scope: 'project',
      sourceDir: 'skills',
      type: InstallType.Directories,
      targetDir: '.agents/skills/',
    },
    {
      tool: 'universal',
      scope: 'project',
      sourceDir: 'agents',
      type: InstallType.Files,
      targetDir: '.agents/agents/',
    },
    {
      tool: 'universal',
      scope: 'project',
      sourceDir: 'skills',
      type: InstallType.Directories,
      targetDir: '.agent/skills/',
    },
    {
      tool: 'universal',
      scope: 'project',
      sourceDir: 'agents',
      type: InstallType.Files,
      targetDir: '.agent/agents/',
    },
  ],
}))

import { matchRules } from '../../src/stages/match-rules.js'
import { readdir } from 'node:fs/promises'
import { AiforgeError } from '../../src/core/errors.js'
import { FilterCancelledSignal } from '../../src/stages/filter-utils.js'
import { select } from '@inquirer/prompts'

// ── Fixtures ───────────────────────────────────────────────────

const mockReporter: Reporter = {
  startPhase: vi.fn(),
  updatePhase: vi.fn(),
  completePhase: vi.fn(),
  reportResult: vi.fn(),
  reportPlan: vi.fn(),
  reportError: vi.fn(),
  warn: vi.fn(),
}

const mockPathResolver = {
  home: vi.fn().mockReturnValue('/home/user'),
  configDir: vi.fn(),
  reposDir: vi.fn(),
  toolGlobalDir: vi.fn(),
  toolProjectDir: vi.fn(),
}

/** 构建基础 ParsedArgs，按需覆盖字段 */
function makeArgs(overrides: Partial<ParsedArgs> = {}): ParsedArgs {
  return {
    source: 'https://github.com/org/repo',
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
    ...overrides,
  }
}

/** 构建 DetectedEnv */
function makeEnv(tools: string[], scope: 'global' | 'project' = 'global'): DetectedEnv {
  return { tools, scope }
}

const mockRepo = {
  repoDir: '/tmp/repo',
  isNew: true,
  sourceFiles: [],
}

// ── Tests ──────────────────────────────────────────────────────

describe('matchRules', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockPathResolver.home.mockReturnValue('/home/user')
    mockGeminiPreconditionCheck.mockResolvedValue({ ok: true })
  })

  // ──────────────────────────────────────────────────────────────
  // Reporter 进度输出
  // ──────────────────────────────────────────────────────────────

  it('调用 reporter.startPhase 报告匹配进度', async () => {
    vi.mocked(readdir).mockResolvedValue([])

    await matchRules(mockRepo, makeEnv(['copilot']), makeArgs(), mockReporter, mockPathResolver)

    expect(mockReporter.startPhase).toHaveBeenCalledWith('匹配安装规则...')
  })

  it('完成后调用 reporter.completePhase', async () => {
    vi.mocked(readdir).mockResolvedValue([])

    await matchRules(mockRepo, makeEnv(['copilot']), makeArgs(), mockReporter, mockPathResolver)

    expect(mockReporter.completePhase).toHaveBeenCalled()
  })

  // ──────────────────────────────────────────────────────────────
  // AC #1 — 单工具全局匹配，返回 MatchedPlan
  // ──────────────────────────────────────────────────────────────

  it('AC #1 copilot:global 规则匹配，返回包含 agents 的 MatchedPlan', async () => {
    // agents 目录有两个文件
    vi.mocked(readdir).mockImplementation(async (dirPath) => {
      const p = String(dirPath)
      if (p.endsWith('/agents')) {
        return [
          { name: 'agent1.md', isFile: () => true, isDirectory: () => false },
          { name: 'agent2.md', isFile: () => true, isDirectory: () => false },
        ] as unknown as Awaited<ReturnType<typeof readdir>>
      }
      // skills, instructions 目录为空
      return []
    })

    const plan = await matchRules(
      mockRepo,
      makeEnv(['copilot'], 'global'),
      makeArgs({ global: true }),
      mockReporter,
      mockPathResolver,
    )

    // 应有 3 条规则（agents/skills/instructions），agents 下找到 2 文件
    const agentsItem = plan.items.find((i) => i.rule.sourceDir === 'agents')
    expect(agentsItem).toBeDefined()
    expect(agentsItem!.sourceFiles).toHaveLength(2)
    expect(agentsItem!.sourceFiles[0]).toContain('/agents/agent1.md')
  })

  it('AC #1 MatchedPlan 中 targetPath 通过 PathResolver 解析（~/ 前缀去掉用 home()）', async () => {
    vi.mocked(readdir).mockResolvedValue([])

    const plan = await matchRules(
      mockRepo,
      makeEnv(['copilot'], 'global'),
      makeArgs({ global: true }),
      mockReporter,
      mockPathResolver,
    )

    // copilot:global agents 目标为 ~/.copilot/agents/ → /home/user/.copilot/agents
    const agentsItem = plan.items.find((i) => i.rule.sourceDir === 'agents')
    expect(agentsItem).toBeDefined()
    expect(agentsItem!.targetPath).toBe('/home/user/.copilot/agents/')
  })

  // ──────────────────────────────────────────────────────────────
  // AC #2 — 多工具匹配（copilot + claude）
  // ──────────────────────────────────────────────────────────────

  it('AC #2 多工具时分别按 tool:scope 查找，各自规则都出现在结果中', async () => {
    vi.mocked(readdir).mockResolvedValue([])

    // claude:project 规则匹配
    const plan = await matchRules(
      mockRepo,
      makeEnv(['claude'], 'project'),
      makeArgs({ global: false }),
      mockReporter,
      mockPathResolver,
    )

    const toolIds = plan.items.map((i) => i.rule.tool)
    expect(toolIds).toContain('claude')
    expect(toolIds).not.toContain('copilot')
  })

  it('AC #2 两个工具同时存在时各自的规则都出现', async () => {
    // 需要两个工具都在同一 scope，这里 copilot:global + cursor:global
    vi.mocked(readdir).mockResolvedValue([])

    const plan = await matchRules(
      mockRepo,
      makeEnv(['copilot', 'cursor'], 'global'),
      makeArgs({ global: true }),
      mockReporter,
      mockPathResolver,
    )

    const toolIds = [...new Set(plan.items.map((i) => i.rule.tool))]
    expect(toolIds).toContain('copilot')
    expect(toolIds).toContain('cursor')
  })

  // ──────────────────────────────────────────────────────────────
  // AC #2 — --dirs 过滤
  // ──────────────────────────────────────────────────────────────

  it('AC #2 --dirs skills 只保留 sourceDir=skills 的规则', async () => {
    vi.mocked(readdir).mockResolvedValue([])

    const plan = await matchRules(
      mockRepo,
      makeEnv(['copilot'], 'global'),
      makeArgs({ global: true, dirs: ['skills'] }),
      mockReporter,
      mockPathResolver,
    )

    const sourceDirs = plan.items.map((i) => i.rule.sourceDir)
    expect(sourceDirs).not.toContain('agents')
    expect(sourceDirs).not.toContain('instructions')
    expect(sourceDirs.every((d) => d === 'skills')).toBe(true)
  })

  it('AC #2 --dirs agents skills 过滤掉 instructions', async () => {
    vi.mocked(readdir).mockResolvedValue([])

    const plan = await matchRules(
      mockRepo,
      makeEnv(['copilot'], 'global'),
      makeArgs({ global: true, dirs: ['agents', 'skills'] }),
      mockReporter,
      mockPathResolver,
    )

    const sourceDirs = plan.items.map((i) => i.rule.sourceDir)
    expect(sourceDirs).not.toContain('instructions')
    expect(sourceDirs).toContain('agents')
    expect(sourceDirs).toContain('skills')
  })

  it('AC #2 --dirs 为空时不过滤（保留所有规则）', async () => {
    vi.mocked(readdir).mockResolvedValue([])

    const plan = await matchRules(
      mockRepo,
      makeEnv(['copilot'], 'global'),
      makeArgs({ global: true, dirs: [] }),
      mockReporter,
      mockPathResolver,
    )

    // copilot:global 有 3 条规则
    expect(plan.items).toHaveLength(3)
  })

  // ──────────────────────────────────────────────────────────────
  // AC #3 — 排除列表过滤
  // ──────────────────────────────────────────────────────────────

  it('AC #3 README.md 被 DEFAULT_EXCLUDES 过滤掉', async () => {
    vi.mocked(readdir).mockImplementation(async (dirPath) => {
      const p = String(dirPath)
      if (p.endsWith('/agents')) {
        return [
          { name: 'README.md', isFile: () => true, isDirectory: () => false },
          { name: 'agent1.md', isFile: () => true, isDirectory: () => false },
        ] as unknown as Awaited<ReturnType<typeof readdir>>
      }
      return []
    })

    const plan = await matchRules(
      mockRepo,
      makeEnv(['copilot'], 'global'),
      makeArgs({ global: true }),
      mockReporter,
      mockPathResolver,
    )

    const agentsItem = plan.items.find((i) => i.rule.sourceDir === 'agents')
    expect(agentsItem!.sourceFiles).toHaveLength(1)
    expect(agentsItem!.sourceFiles[0]).not.toContain('README.md')
    expect(agentsItem!.sourceFiles[0]).toContain('agent1.md')
  })

  it('AC #3 .gitkeep 被 DEFAULT_EXCLUDES 过滤掉', async () => {
    vi.mocked(readdir).mockImplementation(async (dirPath) => {
      const p = String(dirPath)
      if (p.endsWith('/agents')) {
        return [
          { name: '.gitkeep', isFile: () => true, isDirectory: () => false },
          { name: 'agent1.md', isFile: () => true, isDirectory: () => false },
        ] as unknown as Awaited<ReturnType<typeof readdir>>
      }
      return []
    })

    const plan = await matchRules(
      mockRepo,
      makeEnv(['copilot'], 'global'),
      makeArgs({ global: true }),
      mockReporter,
      mockPathResolver,
    )

    const agentsItem = plan.items.find((i) => i.rule.sourceDir === 'agents')
    expect(agentsItem!.sourceFiles).toHaveLength(1)
    expect(agentsItem!.sourceFiles.some((f) => f.includes('.gitkeep'))).toBe(false)
  })

  it('AC #3 .DS_Store 被 DEFAULT_EXCLUDES 过滤掉', async () => {
    vi.mocked(readdir).mockImplementation(async (dirPath) => {
      const p = String(dirPath)
      if (p.endsWith('/agents')) {
        return [
          { name: '.DS_Store', isFile: () => true, isDirectory: () => false },
          { name: 'agent1.md', isFile: () => true, isDirectory: () => false },
        ] as unknown as Awaited<ReturnType<typeof readdir>>
      }
      return []
    })

    const plan = await matchRules(
      mockRepo,
      makeEnv(['copilot'], 'global'),
      makeArgs({ global: true }),
      mockReporter,
      mockPathResolver,
    )

    const agentsItem = plan.items.find((i) => i.rule.sourceDir === 'agents')
    expect(agentsItem!.sourceFiles.some((f) => f.includes('.DS_Store'))).toBe(false)
  })

  // ──────────────────────────────────────────────────────────────
  // AC #4 — O(1) 查找（使用 RULE_INDEX Map）
  // ──────────────────────────────────────────────────────────────

  it('AC #4 使用 RULE_INDEX Map 查找规则，无已知工具时返回空 items', async () => {
    vi.mocked(readdir).mockResolvedValue([])

    // 工具 ID 不在 RULE_INDEX 中
    const plan = await matchRules(
      mockRepo,
      makeEnv(['unknown-tool'], 'global'),
      makeArgs({ global: true }),
      mockReporter,
      mockPathResolver,
    )

    expect(plan.items).toHaveLength(0)
  })

  // ──────────────────────────────────────────────────────────────
  // AC #5 — 三种安装类型扫描
  // ──────────────────────────────────────────────────────────────

  it('AC #5 Files 类型：只扫描文件，不包含目录', async () => {
    vi.mocked(readdir).mockImplementation(async (dirPath) => {
      const p = String(dirPath)
      if (p.endsWith('/agents')) {
        return [
          { name: 'agent1.md', isFile: () => true, isDirectory: () => false },
          { name: 'sub-dir', isFile: () => false, isDirectory: () => true },
        ] as unknown as Awaited<ReturnType<typeof readdir>>
      }
      return []
    })

    const plan = await matchRules(
      mockRepo,
      makeEnv(['copilot'], 'global'),
      makeArgs({ global: true, dirs: ['agents'] }),
      mockReporter,
      mockPathResolver,
    )

    const agentsItem = plan.items.find((i) => i.rule.sourceDir === 'agents')
    expect(agentsItem!.sourceFiles).toHaveLength(1)
    expect(agentsItem!.sourceFiles[0]).toContain('agent1.md')
  })

  it('AC #5 Directories 类型：只扫描子目录，不包含文件', async () => {
    vi.mocked(readdir).mockImplementation(async (dirPath) => {
      const p = String(dirPath)
      if (p.endsWith('/skills')) {
        return [
          { name: 'skill1', isFile: () => false, isDirectory: () => true },
          { name: 'skill2', isFile: () => false, isDirectory: () => true },
          { name: 'README.txt', isFile: () => true, isDirectory: () => false },
        ] as unknown as Awaited<ReturnType<typeof readdir>>
      }
      return []
    })

    const plan = await matchRules(
      mockRepo,
      makeEnv(['copilot'], 'global'),
      makeArgs({ global: true, dirs: ['skills'] }),
      mockReporter,
      mockPathResolver,
    )

    const skillsItem = plan.items.find((i) => i.rule.sourceDir === 'skills')
    expect(skillsItem!.sourceFiles).toHaveLength(2)
    expect(skillsItem!.sourceFiles[0]).toContain('skill1')
    expect(skillsItem!.sourceFiles[1]).toContain('skill2')
  })

  it('AC #5 Flatten 类型：扫描子目录（类似 Directories）', async () => {
    vi.mocked(readdir).mockImplementation(async (dirPath) => {
      const p = String(dirPath)
      if (p.endsWith('/skills')) {
        return [
          { name: 'skill-a', isFile: () => false, isDirectory: () => true },
          { name: 'skill-b', isFile: () => false, isDirectory: () => true },
        ] as unknown as Awaited<ReturnType<typeof readdir>>
      }
      return []
    })

    const plan = await matchRules(
      mockRepo,
      makeEnv(['cursor'], 'global'),
      makeArgs({ global: true }),
      mockReporter,
      mockPathResolver,
    )

    // cursor:global skills 类型为 Flatten
    const skillsItem = plan.items.find(
      (i) => i.rule.sourceDir === 'skills' && i.rule.tool === 'cursor',
    )
    expect(skillsItem).toBeDefined()
    expect(skillsItem!.sourceFiles).toHaveLength(2)
  })

  // ──────────────────────────────────────────────────────────────
  // 空目录处理
  // ──────────────────────────────────────────────────────────────

  it('空目录：sourceFiles 为空数组，不报错', async () => {
    vi.mocked(readdir).mockResolvedValue([])

    const plan = await matchRules(
      mockRepo,
      makeEnv(['copilot'], 'global'),
      makeArgs({ global: true, dirs: ['agents'] }),
      mockReporter,
      mockPathResolver,
    )

    const agentsItem = plan.items.find((i) => i.rule.sourceDir === 'agents')
    expect(agentsItem).toBeDefined()
    expect(agentsItem!.sourceFiles).toHaveLength(0)
  })

  it('sourceDir 在仓库中不存在时（readdir 抛 ENOENT）源文件为空，静默跳过', async () => {
    vi.mocked(readdir).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))

    const plan = await matchRules(
      mockRepo,
      makeEnv(['copilot'], 'global'),
      makeArgs({ global: true, dirs: ['agents'] }),
      mockReporter,
      mockPathResolver,
    )

    const agentsItem = plan.items.find((i) => i.rule.sourceDir === 'agents')
    expect(agentsItem!.sourceFiles).toHaveLength(0)
  })

  // ──────────────────────────────────────────────────────────────
  // 项目级路径解析
  // ──────────────────────────────────────────────────────────────

  it('scope=project 时 targetPath 使用 cwd() 拼接（不含 ~/）', async () => {
    vi.mocked(readdir).mockResolvedValue([])

    const plan = await matchRules(
      mockRepo,
      makeEnv(['claude'], 'project'),
      makeArgs({ global: false }),
      mockReporter,
      mockPathResolver,
    )

    // claude:project agents → .claude/agents/
    const agentsItem = plan.items.find(
      (i) => i.rule.sourceDir === 'agents' && i.rule.tool === 'claude',
    )
    expect(agentsItem).toBeDefined()
    // project 路径不应包含 ~/
    expect(agentsItem!.targetPath).not.toContain('~')
    // 应以 cwd 开头
    expect(agentsItem!.targetPath).toContain(process.cwd())
  })

  it('Story 7-3 fileFilter: auggie 项目级 instructions 只匹配 AGENTS.md', async () => {
    vi.mocked(readdir).mockImplementation(async (dirPath) => {
      const p = String(dirPath)
      if (p.endsWith('/instructions')) {
        return [
          { name: 'AGENTS.md', isFile: () => true, isDirectory: () => false },
          { name: 'CLAUDE.md', isFile: () => true, isDirectory: () => false },
        ] as unknown as Awaited<ReturnType<typeof readdir>>
      }
      return []
    })

    const plan = await matchRules(
      mockRepo,
      makeEnv(['auggie'], 'project'),
      makeArgs({ global: false, dirs: ['instructions'] }),
      mockReporter,
      mockPathResolver,
    )

    const instructionsItem = plan.items.find((i) => i.rule.sourceDir === 'instructions')
    expect(instructionsItem).toBeDefined()
    expect(instructionsItem!.sourceFiles).toHaveLength(1)
    expect(instructionsItem!.sourceFiles[0]).toContain('AGENTS.md')
    expect(instructionsItem!.sourceFiles.some((f) => f.includes('CLAUDE.md'))).toBe(false)
  })

  it('Story 7-3 fileFilter: claude 项目级 instructions 只匹配 CLAUDE.md', async () => {
    vi.mocked(readdir).mockImplementation(async (dirPath) => {
      const p = String(dirPath)
      if (p.endsWith('/instructions')) {
        return [
          { name: 'AGENTS.md', isFile: () => true, isDirectory: () => false },
          { name: 'CLAUDE.md', isFile: () => true, isDirectory: () => false },
        ] as unknown as Awaited<ReturnType<typeof readdir>>
      }
      return []
    })

    const plan = await matchRules(
      mockRepo,
      makeEnv(['claude'], 'project'),
      makeArgs({ global: false, dirs: ['instructions'] }),
      mockReporter,
      mockPathResolver,
    )

    const instructionsItem = plan.items.find((i) => i.rule.sourceDir === 'instructions')
    expect(instructionsItem).toBeDefined()
    expect(instructionsItem!.sourceFiles).toHaveLength(1)
    expect(instructionsItem!.sourceFiles[0]).toContain('CLAUDE.md')
    expect(instructionsItem!.sourceFiles.some((f) => f.includes('AGENTS.md'))).toBe(false)
  })

  it('Story 7-4 precondition: gemini version too low skips skills but keeps instructions and warns', async () => {
    mockGeminiPreconditionCheck.mockResolvedValue({
      ok: false,
      reason: 'Gemini version too low',
    })

    vi.mocked(readdir).mockImplementation(async (dirPath) => {
      const p = String(dirPath)
      if (p.endsWith('/skills')) {
        return [
          { name: 'skill-a', isFile: () => false, isDirectory: () => true },
        ] as unknown as Awaited<ReturnType<typeof readdir>>
      }
      if (p.endsWith('/instructions')) {
        return [
          { name: 'AGENTS.md', isFile: () => true, isDirectory: () => false },
          { name: 'GEMINI.md', isFile: () => true, isDirectory: () => false },
        ] as unknown as Awaited<ReturnType<typeof readdir>>
      }
      return []
    })

    const plan = await matchRules(
      mockRepo,
      makeEnv(['gemini'], 'global'),
      makeArgs({ global: true }),
      mockReporter,
      mockPathResolver,
    )

    expect(mockGeminiPreconditionCheck).toHaveBeenCalledTimes(1)
    expect(plan.items).toHaveLength(1)
    expect(plan.items[0]!.rule.tool).toBe('gemini')
    expect(plan.items[0]!.rule.sourceDir).toBe('instructions')
    expect(mockReporter.warn).toHaveBeenCalledWith('Gemini version too low')
  })

  it('Story 7-4 precondition: gemini version ok keeps full 2-rule plan', async () => {
    mockGeminiPreconditionCheck.mockResolvedValue({ ok: true })

    vi.mocked(readdir).mockImplementation(async (dirPath) => {
      const p = String(dirPath)
      if (p.endsWith('/skills')) {
        return [
          { name: 'skill-a', isFile: () => false, isDirectory: () => true },
        ] as unknown as Awaited<ReturnType<typeof readdir>>
      }
      if (p.endsWith('/instructions')) {
        return [
          { name: 'AGENTS.md', isFile: () => true, isDirectory: () => false },
        ] as unknown as Awaited<ReturnType<typeof readdir>>
      }
      return []
    })

    const plan = await matchRules(
      mockRepo,
      makeEnv(['gemini'], 'global'),
      makeArgs({ global: true }),
      mockReporter,
      mockPathResolver,
    )

    expect(mockGeminiPreconditionCheck).toHaveBeenCalledTimes(1)
    expect(plan.items).toHaveLength(2)
    expect(plan.items.map((item) => item.rule.sourceDir)).toEqual(['skills', 'instructions'])
    expect(mockReporter.warn).not.toHaveBeenCalled()
  })

  // ──────────────────────────────────────────────────────────────
  // sourceFiles 绝对路径包含 repoDir
  // ──────────────────────────────────────────────────────────────

  it('sourceFiles 返回绝对路径，包含 repoDir 前缀', async () => {
    vi.mocked(readdir).mockImplementation(async (dirPath) => {
      const p = String(dirPath)
      if (p.endsWith('/agents')) {
        return [
          { name: 'my-agent.md', isFile: () => true, isDirectory: () => false },
        ] as unknown as Awaited<ReturnType<typeof readdir>>
      }
      return []
    })

    const plan = await matchRules(
      mockRepo,
      makeEnv(['copilot'], 'global'),
      makeArgs({ global: true, dirs: ['agents'] }),
      mockReporter,
      mockPathResolver,
    )

    const agentsItem = plan.items.find((i) => i.rule.sourceDir === 'agents')
    expect(agentsItem!.sourceFiles[0]).toContain('/tmp/repo')
    expect(agentsItem!.sourceFiles[0]).toContain('my-agent.md')
  })

  // ──────────────────────────────────────────────────────────────
  // Story 6-2 — --filter 过滤测试
  // ──────────────────────────────────────────────────────────────

  it('AC #1 --filter skills/git* 只返回匹配的子目录（git-commit/git-push）', async () => {
    vi.mocked(readdir).mockImplementation(async (dirPath) => {
      const p = String(dirPath)
      if (p.endsWith('/skills')) {
        return [
          { name: 'git-commit', isFile: () => false, isDirectory: () => true },
          { name: 'git-push', isFile: () => false, isDirectory: () => true },
          { name: 'code-review', isFile: () => false, isDirectory: () => true },
          { name: 'deploy', isFile: () => false, isDirectory: () => true },
        ] as unknown as Awaited<ReturnType<typeof readdir>>
      }
      return []
    })

    const plan = await matchRules(
      mockRepo,
      makeEnv(['copilot'], 'global'),
      makeArgs({ global: true, filter: 'skills/git*' }),
      mockReporter,
      mockPathResolver,
    )

    expect(plan.items).toHaveLength(1)
    const skillsItem = plan.items[0]!
    expect(skillsItem.rule.sourceDir).toBe('skills')
    expect(skillsItem.sourceFiles).toHaveLength(2)
    expect(skillsItem.sourceFiles.some((f) => f.endsWith('git-commit'))).toBe(true)
    expect(skillsItem.sourceFiles.some((f) => f.endsWith('git-push'))).toBe(true)
    expect(skillsItem.sourceFiles.some((f) => f.endsWith('code-review'))).toBe(false)
    expect(skillsItem.sourceFiles.some((f) => f.endsWith('deploy'))).toBe(false)
  })

  it('AC #3 --filter git*（无前缀）跨所有顶层目录匹配 git* 子目录', async () => {
    vi.mocked(readdir).mockImplementation(async (dirPath) => {
      const p = String(dirPath)
      if (p.endsWith('/agents')) {
        return [
          { name: 'git-agent.md', isFile: () => true, isDirectory: () => false },
          { name: 'other.md', isFile: () => true, isDirectory: () => false },
        ] as unknown as Awaited<ReturnType<typeof readdir>>
      }
      if (p.endsWith('/skills')) {
        return [
          { name: 'git-skill', isFile: () => false, isDirectory: () => true },
          { name: 'other-skill', isFile: () => false, isDirectory: () => true },
        ] as unknown as Awaited<ReturnType<typeof readdir>>
      }
      return []
    })

    const plan = await matchRules(
      mockRepo,
      makeEnv(['copilot'], 'global'),
      makeArgs({ global: true, filter: 'git*' }),
      mockReporter,
      mockPathResolver,
    )

    // agents 有 git-agent.md，skills 有 git-skill
    const agentsItem = plan.items.find((i) => i.rule.sourceDir === 'agents')
    const skillsItem = plan.items.find((i) => i.rule.sourceDir === 'skills')
    expect(agentsItem).toBeDefined()
    expect(skillsItem).toBeDefined()
    expect(agentsItem!.sourceFiles).toHaveLength(1)
    expect(agentsItem!.sourceFiles[0]).toContain('git-agent.md')
    expect(skillsItem!.sourceFiles).toHaveLength(1)
    expect(skillsItem!.sourceFiles[0]).toContain('git-skill')
    // instructions 没有匹配的 -> 不在 items
    expect(plan.items.find((i) => i.rule.sourceDir === 'instructions')).toBeUndefined()
  })

  it('AC #2 --dirs skills --filter skills/git* 联合语义与单独用 --filter 一致', async () => {
    vi.mocked(readdir).mockImplementation(async (dirPath) => {
      const p = String(dirPath)
      if (p.endsWith('/skills')) {
        return [
          { name: 'git-commit', isFile: () => false, isDirectory: () => true },
          { name: 'code-review', isFile: () => false, isDirectory: () => true },
        ] as unknown as Awaited<ReturnType<typeof readdir>>
      }
      return []
    })

    const plan = await matchRules(
      mockRepo,
      makeEnv(['copilot'], 'global'),
      makeArgs({ global: true, dirs: ['skills'], filter: 'skills/git*' }),
      mockReporter,
      mockPathResolver,
    )

    expect(plan.items).toHaveLength(1)
    expect(plan.items[0]!.rule.sourceDir).toBe('skills')
    expect(plan.items[0]!.sourceFiles).toHaveLength(1)
    expect(plan.items[0]!.sourceFiles[0]).toContain('git-commit')
  })

  it('AC #1 --filter 对 Files 类型有效（按文件 basename 匹配 glob）', async () => {
    vi.mocked(readdir).mockImplementation(async (dirPath) => {
      const p = String(dirPath)
      if (p.endsWith('/agents')) {
        return [
          { name: 'git-agent.md', isFile: () => true, isDirectory: () => false },
          { name: 'other-agent.md', isFile: () => true, isDirectory: () => false },
        ] as unknown as Awaited<ReturnType<typeof readdir>>
      }
      return []
    })

    const plan = await matchRules(
      mockRepo,
      makeEnv(['copilot'], 'global'),
      makeArgs({ global: true, dirs: ['agents'], filter: 'agents/git*' }),
      mockReporter,
      mockPathResolver,
    )

    expect(plan.items).toHaveLength(1)
    expect(plan.items[0]!.rule.type).toBe(InstallType.Files)
    expect(plan.items[0]!.sourceFiles).toHaveLength(1)
    expect(plan.items[0]!.sourceFiles[0]).toContain('git-agent.md')
  })

  it('AC #1 --filter 对 Flatten 类型有效（cursor:global skills）', async () => {
    vi.mocked(readdir).mockImplementation(async (dirPath) => {
      const p = String(dirPath)
      if (p.endsWith('/skills')) {
        return [
          { name: 'git-skill', isFile: () => false, isDirectory: () => true },
          { name: 'other-skill', isFile: () => false, isDirectory: () => true },
        ] as unknown as Awaited<ReturnType<typeof readdir>>
      }
      return []
    })

    const plan = await matchRules(
      mockRepo,
      makeEnv(['cursor'], 'global'),
      makeArgs({ global: true, filter: 'git*' }),
      mockReporter,
      mockPathResolver,
    )

    expect(plan.items).toHaveLength(1)
    expect(plan.items[0]!.rule.type).toBe(InstallType.Flatten)
    expect(plan.items[0]!.sourceFiles).toHaveLength(1)
    expect(plan.items[0]!.sourceFiles[0]).toContain('git-skill')
  })

  it('AC #5 dry-run: --filter skills/git* 只展示匹配条目，不含空 item', async () => {
    vi.mocked(readdir).mockImplementation(async (dirPath) => {
      const p = String(dirPath)
      if (p.endsWith('/skills')) {
        return [
          { name: 'git-commit', isFile: () => false, isDirectory: () => true },
          { name: 'code-review', isFile: () => false, isDirectory: () => true },
        ] as unknown as Awaited<ReturnType<typeof readdir>>
      }
      return []
    })

    const plan = await matchRules(
      mockRepo,
      makeEnv(['copilot'], 'global'),
      makeArgs({ global: true, filter: 'skills/git*' }),
      mockReporter,
      mockPathResolver,
    )

    // agents/instructions 规则被 dirPrefix 过滤 → 空 item → 不在 plan
    // skills 只有 git-commit 匹配
    expect(plan.items).toHaveLength(1)
    expect(plan.items[0]!.rule.sourceDir).toBe('skills')
    expect(plan.items[0]!.sourceFiles).toHaveLength(1)
    expect(plan.items[0]!.sourceFiles[0]).toContain('git-commit')
    // 所有 items 都有非空 sourceFiles（保证 dry-run 不输出 emptySourceDir）
    expect(plan.items.every((item) => item.sourceFiles.length > 0)).toBe(true)
  })

  it('AC #4 filter 零匹配时非 TTY 抛出 FILTER_NO_MATCH', async () => {
    const origTTY = process.stdin.isTTY
    Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true })

    vi.mocked(readdir).mockImplementation(async (dirPath) => {
      const p = String(dirPath)
      if (p.endsWith('/skills')) {
        return [
          // scanSourceFiles 和 scanAvailableTopDirs 共用同一 mock
          // scanSourceFiles 用 isDirectory()，scanAvailableTopDirs 也用 isDirectory()
          { name: 'git-commit', isFile: () => false, isDirectory: () => true },
          { name: 'git-push', isFile: () => false, isDirectory: () => true },
        ] as unknown as Awaited<ReturnType<typeof readdir>>
      }
      return []
    })

    try {
      await matchRules(
        mockRepo,
        makeEnv(['copilot'], 'global'),
        makeArgs({ global: true, filter: 'skills/xyz*' }), // xyz* 不匹配任何目录
        mockReporter,
        mockPathResolver,
      )
      expect.unreachable('应抛出 FILTER_NO_MATCH')
    } catch (err) {
      expect(err).toBeInstanceOf(AiforgeError)
      const e = err as AiforgeError
      expect(e.code).toBe('FILTER_NO_MATCH')
      expect(e.exitCode).toBe(3) // EXIT_ARG_ERROR
      // fix[] 应列出可用子目录
      expect(e.fix.some((f) => f.includes('git-commit'))).toBe(true)
    } finally {
      Object.defineProperty(process.stdin, 'isTTY', { value: origTTY, configurable: true })
    }
  })

  it('AC #4 TTY 选择重试成功: select() 返回限定名 → items 包含 git-commit', async () => {
    const origTTY = process.stdin.isTTY
    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true })

    vi.mocked(readdir).mockImplementation(async (dirPath) => {
      const p = String(dirPath)
      if (p.endsWith('/skills')) {
        return [
          { name: 'git-commit', isFile: () => false, isDirectory: () => true },
          { name: 'git-push', isFile: () => false, isDirectory: () => true },
        ] as unknown as Awaited<ReturnType<typeof readdir>>
      }
      return []
    })
    // select() 返回限定名（带 dirPrefix）
    vi.mocked(select).mockResolvedValue('skills/git-commit')

    try {
      const plan = await matchRules(
        mockRepo,
        makeEnv(['copilot'], 'global'),
        makeArgs({ global: true, filter: 'skills/xyz*' }),
        mockReporter,
        mockPathResolver,
      )
      // 重试逻辑生效：items 包含 git-commit
      expect(plan.items).toHaveLength(1)
      expect(plan.items[0]!.rule.sourceDir).toBe('skills')
      expect(plan.items[0]!.sourceFiles.some((f) => f.endsWith('git-commit'))).toBe(true)
    } finally {
      Object.defineProperty(process.stdin, 'isTTY', { value: origTTY, configurable: true })
    }
  })

  it('AC #4 TTY 取消抛出 FilterCancelledSignal（而非 AiforgeError，不返回空计划）', async () => {
    const origTTY = process.stdin.isTTY
    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true })

    vi.mocked(readdir).mockImplementation(async (dirPath) => {
      const p = String(dirPath)
      if (p.endsWith('/skills')) {
        return [
          { name: 'git-commit', isFile: () => false, isDirectory: () => true },
        ] as unknown as Awaited<ReturnType<typeof readdir>>
      }
      return []
    })
    vi.mocked(select).mockResolvedValue('__cancel__')

    try {
      await matchRules(
        mockRepo,
        makeEnv(['copilot'], 'global'),
        makeArgs({ global: true, filter: 'skills/xyz*' }),
        mockReporter,
        mockPathResolver,
      )
      expect.unreachable('应抛出 FilterCancelledSignal')
    } catch (err) {
      expect(err).not.toBeInstanceOf(AiforgeError)
      expect(err).toBeInstanceOf(FilterCancelledSignal)
    } finally {
      Object.defineProperty(process.stdin, 'isTTY', { value: origTTY, configurable: true })
    }
  })

  it('AC #4 无前缀零匹配 TTY: 候选使用 sourceDir/itemName 格式，选择后重试成功（fix CR#1）', async () => {
    const origTTY = process.stdin.isTTY
    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true })

    // --filter git* (无前缀) — agents: Files, git-agent.md 不匹配 git* 初扫失败
    vi.mocked(readdir).mockImplementation(async (dirPath) => {
      const p = String(dirPath)
      if (p.endsWith('/agents')) {
        return [
          { name: 'git-agent.md', isFile: () => true, isDirectory: () => false },
          { name: 'other.md', isFile: () => true, isDirectory: () => false },
        ] as unknown as Awaited<ReturnType<typeof readdir>>
      }
      return []
    })
    // select() 返回限定名（带 sourceDir 前缀）
    vi.mocked(select).mockResolvedValue('agents/git-agent.md')

    try {
      const plan = await matchRules(
        mockRepo,
        makeEnv(['copilot'], 'global'),
        makeArgs({ global: true, filter: 'xyz*' }), // xyz* 不匹配任何条目
        mockReporter,
        mockPathResolver,
      )
      // 重试后 items 包含 git-agent.md
      expect(plan.items).toHaveLength(1)
      expect(plan.items[0]!.rule.sourceDir).toBe('agents')
      expect(plan.items[0]!.sourceFiles.some((f) => f.endsWith('git-agent.md'))).toBe(true)
    } finally {
      Object.defineProperty(process.stdin, 'isTTY', { value: origTTY, configurable: true })
    }
  })

  it('AC #4 Files 类型零匹配非 TTY: fixAvailable 包含文件候选（qualified name 格式）（fix CR#2）', async () => {
    const origTTY = process.stdin.isTTY
    Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true })

    vi.mocked(readdir).mockImplementation(async (dirPath) => {
      const p = String(dirPath)
      if (p.endsWith('/agents')) {
        return [
          { name: 'coding-agent.md', isFile: () => true, isDirectory: () => false },
        ] as unknown as Awaited<ReturnType<typeof readdir>>
      }
      return []
    })

    try {
      await matchRules(
        mockRepo,
        makeEnv(['copilot'], 'global'),
        makeArgs({ global: true, filter: 'agents/xyz*' }), // agents 是 Files 类型
        mockReporter,
        mockPathResolver,
      )
      expect.unreachable('应抛出 FILTER_NO_MATCH')
    } catch (err) {
      expect(err).toBeInstanceOf(AiforgeError)
      const e = err as AiforgeError
      expect(e.code).toBe('FILTER_NO_MATCH')
      // fix[] 应包含文件候选，格式为 agents/xxx.md（而非纯目录名）
      expect(e.fix.some((f) => f.includes('agents/coding-agent.md'))).toBe(true)
    } finally {
      Object.defineProperty(process.stdin, 'isTTY', { value: origTTY, configurable: true })
    }
  })
})

// ── LINK_PROJECT_REJECTED 双语测试（Story 5-5a CR Round-4 P2 补充）────────────

describe('matchRules — LINK_PROJECT_REJECTED i18n', () => {
  beforeEach(() => {
    vi.mocked(readdir).mockResolvedValue([])
  })

  it('LINK_PROJECT_REJECTED message is in Chinese when language=zh-CN (default)', async () => {
    try {
      await matchRules(
        mockRepo,
        makeEnv(['copilot'], 'project'),
        makeArgs({ link: true, global: false }),
        mockReporter,
        mockPathResolver as never,
      )
      expect.unreachable('应抛出 LINK_PROJECT_REJECTED')
    } catch (err) {
      const e = err as import('../../src/core/errors.js').AiforgeError
      expect(e.code).toBe('LINK_PROJECT_REJECTED')
      expect(e.message).toBe('符号链接模式不支持项目级安装')
    }
  })

  it('LINK_PROJECT_REJECTED message is in English when language=en', async () => {
    setLanguage('en')
    try {
      await matchRules(
        mockRepo,
        makeEnv(['copilot'], 'project'),
        makeArgs({ link: true, global: false }),
        mockReporter,
        mockPathResolver as never,
      )
      expect.unreachable('should throw LINK_PROJECT_REJECTED')
    } catch (err) {
      const e = err as import('../../src/core/errors.js').AiforgeError
      expect(e.code).toBe('LINK_PROJECT_REJECTED')
      expect(e.message).toBe('Symlink mode does not support project-scope installation')
    } finally {
      setLanguage('zh-CN')
    }
  })

  // ────────────────────────────────────────────────────────────
  // Story 6-3 — 通用目录默认安装测试
  // ────────────────────────────────────────────────────────────

  it('AC #1 enableUniversal=true + scope=project 时返回 4 条通用目录计划', async () => {
    vi.mocked(readdir).mockResolvedValue([])

    const plan = await matchRules(
      mockRepo,
      makeEnv(['claude'], 'project'),
      makeArgs({ global: false }),
      mockReporter,
      mockPathResolver,
      true, // enableUniversal
    )

    const universalItems = plan.items.filter((i) => i.rule.tool === 'universal')
    expect(universalItems).toHaveLength(4)

    // 验证目标路径包含 .agents/ 和 .agent/
    const targets = universalItems.map((i) => i.targetPath)
    expect(targets.some((t) => t.includes('.agents/skills'))).toBe(true)
    expect(targets.some((t) => t.includes('.agents/agents'))).toBe(true)
    expect(targets.some((t) => t.includes('.agent/skills'))).toBe(true)
    expect(targets.some((t) => t.includes('.agent/agents'))).toBe(true)
  })

  it('AC #2 enableUniversal=false 时不返回通用目录计划', async () => {
    vi.mocked(readdir).mockResolvedValue([])

    const plan = await matchRules(
      mockRepo,
      makeEnv(['claude'], 'project'),
      makeArgs({ global: false }),
      mockReporter,
      mockPathResolver,
      false, // enableUniversal
    )

    const universalItems = plan.items.filter((i) => i.rule.tool === 'universal')
    expect(universalItems).toHaveLength(0)
  })

  it('global scope 下即使 enableUniversal=true 也不返回通用目录计划', async () => {
    vi.mocked(readdir).mockResolvedValue([])

    const plan = await matchRules(
      mockRepo,
      makeEnv(['copilot'], 'global'),
      makeArgs({ global: true }),
      mockReporter,
      mockPathResolver,
      true, // enableUniversal
    )

    const universalItems = plan.items.filter((i) => i.rule.tool === 'universal')
    expect(universalItems).toHaveLength(0)
  })

  it('AC #3 默认 enableUniversal 参数缺省时不返回通用目录计划', async () => {
    vi.mocked(readdir).mockResolvedValue([])

    // 不传第6个参数，默认为 false
    const plan = await matchRules(
      mockRepo,
      makeEnv(['claude'], 'project'),
      makeArgs({ global: false }),
      mockReporter,
      mockPathResolver,
    )

    const universalItems = plan.items.filter((i) => i.rule.tool === 'universal')
    expect(universalItems).toHaveLength(0)
  })

  it('AC #1 通用目录计划的 mode 始终为 copy', async () => {
    vi.mocked(readdir).mockResolvedValue([])

    const plan = await matchRules(
      mockRepo,
      makeEnv(['claude'], 'project'),
      makeArgs({ global: false }),
      mockReporter,
      mockPathResolver,
      true,
    )

    const universalItems = plan.items.filter((i) => i.rule.tool === 'universal')
    for (const item of universalItems) {
      expect(item.mode).toBe('copy')
    }
  })

  it('AC #4 --dirs 过滤同样应用于通用目录：skills 过滤时 agents 容类将被排除', async () => {
    vi.mocked(readdir).mockResolvedValue([])

    const plan = await matchRules(
      mockRepo,
      makeEnv(['claude'], 'project'),
      makeArgs({ global: false, dirs: ['skills'] }), // 只安装 skills
      mockReporter,
      mockPathResolver,
      true,
    )

    const universalItems = plan.items.filter((i) => i.rule.tool === 'universal')
    // 只有 sourceDir=skills 的两条规则（.agents/skills/ + .agent/skills/）
    expect(universalItems).toHaveLength(2)
    for (const item of universalItems) {
      expect(item.rule.sourceDir).toBe('skills')
    }
  })
})
