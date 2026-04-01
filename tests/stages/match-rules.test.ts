import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { DetectedEnv, ParsedArgs } from '../../src/core/types.js'
import type { Reporter } from '../../src/core/reporter.js'
import { InstallType } from '../../src/core/types.js'
import { setLanguage } from '../../src/core/messages.js'

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(),
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
  ]),
}))

import { matchRules } from '../../src/stages/match-rules.js'
import { readdir } from 'node:fs/promises'

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
})
