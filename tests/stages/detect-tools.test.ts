import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { LocalRepo, ParsedArgs } from '../../src/core/types.js'
import type { Reporter } from '../../src/core/reporter.js'
import { AiforgeError } from '../../src/core/errors.js'

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('node:fs/promises', () => ({
  access: vi.fn(),
}))

vi.mock('../../src/data/tool-registry.js', () => ({
  TOOL_DEFINITIONS: [
    {
      id: 'copilot',
      name: 'GitHub Copilot',
      detect: {
        global: ['~/.copilot'],
        project: ['.github'],
      },
    },
    {
      id: 'claude',
      name: 'Claude Code',
      detect: {
        global: ['~/.claude'],
        project: ['.claude'],
      },
    },
    {
      id: 'cursor',
      name: 'Cursor',
      detect: {
        global: ['~/.cursor'],
        project: ['.cursor'],
      },
    },
    {
      id: 'vscode',
      name: 'VS Code',
      detect: {
        global: ['~/.vscode'],
        project: ['.vscode'],
      },
    },
  ],
}))

import { detectTools } from '../../src/stages/detect-tools.js'
import { access } from 'node:fs/promises'

// ── Fixtures ───────────────────────────────────────────────────

const mockRepo: LocalRepo = {
  repoDir: '/tmp/repo',
  isNew: true,
  sourceFiles: [],
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

describe('detectTools', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockPathResolver.home.mockReturnValue('/home/user')
  })

  // ──────────────────────────────────────────────────────────────
  // Reporter 进度输出
  // ──────────────────────────────────────────────────────────────

  it('调用 reporter.startPhase 报告检测进度', async () => {
    // 模拟至少一个工具存在（copilot 全局路径命中）
    vi.mocked(access).mockImplementation(async (p) => {
      if (String(p).includes('.copilot')) return
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    })

    await detectTools(mockRepo, makeArgs(), mockReporter, mockPathResolver)

    expect(mockReporter.startPhase).toHaveBeenCalledWith('检测 AI 工具...')
  })

  // ──────────────────────────────────────────────────────────────
  // AC #1 — 单工具检测（全局侧命中）
  // ──────────────────────────────────────────────────────────────

  it('AC #1 全局侧命中 copilot 时返回包含 copilot 的工具列表', async () => {
    vi.mocked(access).mockImplementation(async (p) => {
      if (String(p) === '/home/user/.copilot') return
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    })

    const env = await detectTools(mockRepo, makeArgs(), mockReporter, mockPathResolver)

    expect(env.tools).toContain('copilot')
    expect(env.scope).toBe('project')
  })

  // ──────────────────────────────────────────────────────────────
  // AC #1 — 项目侧命中
  // ──────────────────────────────────────────────────────────────

  it('AC #1 项目侧命中 .github 时返回包含 copilot 的工具列表', async () => {
    const cwd = process.cwd()
    vi.mocked(access).mockImplementation(async (p) => {
      if (String(p) === `${cwd}/.github`) return
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    })

    const env = await detectTools(mockRepo, makeArgs(), mockReporter, mockPathResolver)

    expect(env.tools).toContain('copilot')
  })

  // ──────────────────────────────────────────────────────────────
  // AC #2 — 多工具检测
  // ──────────────────────────────────────────────────────────────

  it('AC #2 多工具同时存在时全部返回', async () => {
    const hitPaths = new Set(['/home/user/.copilot', '/home/user/.claude', '/home/user/.cursor'])
    vi.mocked(access).mockImplementation(async (p) => {
      if (hitPaths.has(String(p))) return
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    })

    const env = await detectTools(mockRepo, makeArgs(), mockReporter, mockPathResolver)

    expect(env.tools).toContain('copilot')
    expect(env.tools).toContain('claude')
    expect(env.tools).toContain('cursor')
    expect(env.tools).not.toContain('vscode')
  })

  // ──────────────────────────────────────────────────────────────
  // AC #3 — 手动指定模式：跳过自动检测
  // ──────────────────────────────────────────────────────────────

  it('AC #3 手动指定工具时跳过自动检测，直接返回指定工具', async () => {
    // access 不应被调用
    const env = await detectTools(
      mockRepo,
      makeArgs({ tools: ['copilot', 'claude'] }),
      mockReporter,
      mockPathResolver,
    )

    expect(env.tools).toEqual(['copilot', 'claude'])
    expect(access).not.toHaveBeenCalled()
  })

  // ──────────────────────────────────────────────────────────────
  // AC #3 — 无效 ID 报错
  // ──────────────────────────────────────────────────────────────

  it('AC #3 手动指定无效工具 ID 时抛出 AiforgeError(UNKNOWN_TOOL)', async () => {
    await expect(
      detectTools(mockRepo, makeArgs({ tools: ['invalidtool'] }), mockReporter, mockPathResolver),
    ).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof AiforgeError && e.code === 'UNKNOWN_TOOL' && e.severity === 'fatal',
    )
  })

  // ──────────────────────────────────────────────────────────────
  // AC #4 — 无工具时诊断并抛出 NO_TOOLS 错误
  // ──────────────────────────────────────────────────────────────

  it('AC #4 自动检测未发现任何工具时抛出 AiforgeError(NO_TOOLS)', async () => {
    vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))

    await expect(
      detectTools(mockRepo, makeArgs(), mockReporter, mockPathResolver),
    ).rejects.toSatisfy(
      (e: unknown) => e instanceof AiforgeError && e.code === 'NO_TOOLS' && e.severity === 'fatal',
    )
  })

  // ──────────────────────────────────────────────────────────────
  // AC #4 — 诊断输出通过 reporter.warn 输出
  // ──────────────────────────────────────────────────────────────

  it('AC #4 无工具时通过 reporter.warn 输出包含扫描路径和建议的诊断信息', async () => {
    vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))

    await expect(
      detectTools(mockRepo, makeArgs(), mockReporter, mockPathResolver),
    ).rejects.toBeInstanceOf(AiforgeError)

    // 断言 warn 被调用且调用参数包含诊断关键信息（AC #4：列出扫描路径、标志文件、建议）
    expect(mockReporter.warn).toHaveBeenCalledWith(expect.stringContaining('扫描路径'))
    expect(mockReporter.warn).toHaveBeenCalledWith(expect.stringContaining('全局:'))
    expect(mockReporter.warn).toHaveBeenCalledWith(expect.stringContaining('/home/user/'))
    expect(mockReporter.warn).toHaveBeenCalledWith(expect.stringContaining('--tools'))
    expect(mockReporter.warn).toHaveBeenCalledWith(expect.stringContaining('建议'))
  })

  // ──────────────────────────────────────────────────────────────
  // AC #5 — 性能：4 工具全扫描 < 500ms
  // ──────────────────────────────────────────────────────────────

  it('AC #5 4 工具全扫描耗时 < 500ms', async () => {
    // 所有路径均不存在（模拟最坏情况 - 全部扫描完毕）
    vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))

    const start = Date.now()
    await expect(
      detectTools(mockRepo, makeArgs(), mockReporter, mockPathResolver),
    ).rejects.toBeInstanceOf(AiforgeError)
    const elapsed = Date.now() - start

    expect(elapsed).toBeLessThan(500)
  })

  // ──────────────────────────────────────────────────────────────
  // AC #6 — 基于注册表检测，不依赖工具进程
  // ──────────────────────────────────────────────────────────────

  it('AC #6 仅使用 fs.access 检查文件存在性，不调用任何外部进程', async () => {
    vi.mocked(access).mockImplementation(async (p) => {
      if (String(p).includes('.copilot')) return
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    })

    const env = await detectTools(mockRepo, makeArgs(), mockReporter, mockPathResolver)

    expect(env.tools).toContain('copilot')
    // access 被调用，说明是基于文件系统检测
    expect(access).toHaveBeenCalled()
  })

  // ──────────────────────────────────────────────────────────────
  // scope 控制
  // ──────────────────────────────────────────────────────────────

  it('args.global=true 时 scope 为 global', async () => {
    vi.mocked(access).mockImplementation(async (p) => {
      if (String(p).includes('.copilot')) return
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    })

    const env = await detectTools(
      mockRepo,
      makeArgs({ global: true }),
      mockReporter,
      mockPathResolver,
    )

    expect(env.scope).toBe('global')
  })

  it('args.global=false 时 scope 为 project', async () => {
    vi.mocked(access).mockImplementation(async (p) => {
      if (String(p).includes('.copilot')) return
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    })

    const env = await detectTools(
      mockRepo,
      makeArgs({ global: false }),
      mockReporter,
      mockPathResolver,
    )

    expect(env.scope).toBe('project')
  })

  // ──────────────────────────────────────────────────────────────
  // fs.access 错误白名单降级规则
  // ──────────────────────────────────────────────────────────────

  it('fs.access 返回非 ENOENT/ENOTDIR 错误时向上抛出（不降级为不存在）', async () => {
    vi.mocked(access).mockRejectedValue(
      Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' }),
    )

    await expect(
      detectTools(mockRepo, makeArgs(), mockReporter, mockPathResolver),
    ).rejects.toSatisfy((e: unknown) => !(e instanceof AiforgeError) || e.code !== 'NO_TOOLS')
  })

  // ──────────────────────────────────────────────────────────────
  // 手动指定模式 scope
  // ──────────────────────────────────────────────────────────────

  it('手动指定模式下 scope 也受 args.global 控制', async () => {
    const env = await detectTools(
      mockRepo,
      makeArgs({ tools: ['copilot'], global: true }),
      mockReporter,
      mockPathResolver,
    )

    expect(env.scope).toBe('global')
  })

  // ──────────────────────────────────────────────────────────────
  // global 路径拼接（去掉 ~ 前缀）
  // ──────────────────────────────────────────────────────────────

  it('全局路径正确拼接：pathResolver.home() + 去掉 ~ 的相对路径', async () => {
    const calledPaths: string[] = []
    vi.mocked(access).mockImplementation(async (p) => {
      calledPaths.push(String(p))
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    })

    await expect(
      detectTools(mockRepo, makeArgs(), mockReporter, mockPathResolver),
    ).rejects.toBeInstanceOf(AiforgeError)

    // 全局路径应使用 home() 拼接，不应包含 ~
    const globalPaths = calledPaths.filter((p) => p.startsWith('/home/user'))
    expect(globalPaths.length).toBeGreaterThan(0)
    expect(calledPaths.some((p) => p.includes('~'))).toBe(false)
  })

  // ──────────────────────────────────────────────────────────────
  // ENOTDIR 也降级为不存在
  // ──────────────────────────────────────────────────────────────

  it('fs.access 返回 ENOTDIR 时视为不存在（降级为 false）', async () => {
    vi.mocked(access).mockImplementation(async (p) => {
      if (String(p).includes('.copilot')) {
        throw Object.assign(new Error('ENOTDIR'), { code: 'ENOTDIR' })
      }
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    })

    // copilot 路径返回 ENOTDIR，视为不存在，最终没有工具被检测到
    await expect(
      detectTools(mockRepo, makeArgs(), mockReporter, mockPathResolver),
    ).rejects.toSatisfy((e: unknown) => e instanceof AiforgeError && e.code === 'NO_TOOLS')
  })

  // Story 5-4 Task 2.7: NO_TOOLS fix 包含 --tools 具体命令
  it('NO_TOOLS fix 包含 npx aiforge --tools 具体命令 (Story 5-4 Task 2.7)', async () => {
    vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))

    let caughtError: AiforgeError | null = null
    try {
      await detectTools(mockRepo, makeArgs(), mockReporter, mockPathResolver)
    } catch (err) {
      caughtError = err as AiforgeError
    }

    expect(caughtError).not.toBeNull()
    expect(caughtError!.code).toBe('NO_TOOLS')
    // Task 2.7: fix 应包含 npx aiforge --tools copilot claude
    expect(caughtError!.fix.some((f) => f.includes('--tools') && f.includes('copilot'))).toBe(true)
  })
})
