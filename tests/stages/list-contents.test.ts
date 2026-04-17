import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { LocalRepo, ParsedArgs } from '../../src/core/types.js'
import type { Reporter } from '../../src/core/reporter.js'
import { setLanguage } from '../../src/core/messages.js'

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(),
}))

import { readdir } from 'node:fs/promises'
import { listContents, scanAvailableTopDirs } from '../../src/stages/list-contents.js'

// ── Fixtures ───────────────────────────────────────────────────

function makeRepo(repoDir = '/tmp/repo'): LocalRepo {
  return { repoDir, isNew: false, sourceFiles: [] }
}

function makeArgs(listDir: string): ParsedArgs {
  return {
    source: 'https://example.com/repo',
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
    list: listDir,
  }
}

function makeMockReporter(): Reporter {
  return {
    startPhase: vi.fn(),
    updatePhase: vi.fn(),
    completePhase: vi.fn(),
    reportResult: vi.fn(),
    reportPlan: vi.fn(),
    reportList: vi.fn(),
    reportError: vi.fn(),
    warn: vi.fn(),
  }
}

/** 构造 Dirent-like 对象 */
function makeDirent(name: string, isDirectory: boolean) {
  return {
    name,
    isDirectory: () => isDirectory,
    isFile: () => !isDirectory,
    isSymbolicLink: () => false,
  }
}

// ── 测试套件 ───────────────────────────────────────────────────

describe('listContents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setLanguage('zh-CN')
  })

  it('AC#1: 正常列举子目录 — reporter.reportList 被正确调用', async () => {
    const reporter = makeMockReporter()
    vi.mocked(readdir).mockResolvedValueOnce([
      makeDirent('code-review', true),
      makeDirent('deploy', true),
      makeDirent('git-commit', true),
    ] as never)

    await listContents(makeRepo(), makeArgs('skills'), reporter)

    expect(reporter.startPhase).toHaveBeenCalledWith(expect.stringContaining('列出'))
    expect(reporter.completePhase).toHaveBeenCalledTimes(1)
    expect(reporter.reportList).toHaveBeenCalledWith('skills', [
      'code-review',
      'deploy',
      'git-commit',
    ])
  })

  it('AC#1: 输出结果按字母排序', async () => {
    const reporter = makeMockReporter()
    vi.mocked(readdir).mockResolvedValueOnce([
      makeDirent('zebra', true),
      makeDirent('alpha', true),
      makeDirent('middle', true),
    ] as never)

    await listContents(makeRepo(), makeArgs('skills'), reporter)

    expect(reporter.reportList).toHaveBeenCalledWith('skills', ['alpha', 'middle', 'zebra'])
  })

  it('AC#1: 文件（非目录）被过滤掉', async () => {
    const reporter = makeMockReporter()
    vi.mocked(readdir).mockResolvedValueOnce([
      makeDirent('skill-dir', true),
      makeDirent('README.md', false),
      makeDirent('index.ts', false),
    ] as never)

    await listContents(makeRepo(), makeArgs('skills'), reporter)

    expect(reporter.reportList).toHaveBeenCalledWith('skills', ['skill-dir'])
  })

  it('AC#1: DEFAULT_EXCLUDES 中的条目被正确过滤', async () => {
    const reporter = makeMockReporter()
    // DEFAULT_EXCLUDES 只包含文件名，不包含目录名，但测试过滤逻辑
    // 实际上 DEFAULT_EXCLUDES 是 ['README.md', 'README', '.gitkeep', '.DS_Store', 'mcp.json.example']
    // 这里验证这些名字的目录（即使不太可能）也会被过滤
    vi.mocked(readdir).mockResolvedValueOnce([
      makeDirent('valid-skill', true),
      makeDirent('README.md', true), // 名字在 DEFAULT_EXCLUDES 中的目录也过滤
      makeDirent('.DS_Store', true),
    ] as never)

    await listContents(makeRepo(), makeArgs('skills'), reporter)

    expect(reporter.reportList).toHaveBeenCalledWith('skills', ['valid-skill'])
  })

  it('AC#3: 目录存在但为空 — reportList 传入空数组', async () => {
    const reporter = makeMockReporter()
    vi.mocked(readdir).mockResolvedValueOnce([] as never)

    await listContents(makeRepo(), makeArgs('skills'), reporter)

    expect(reporter.completePhase).toHaveBeenCalledTimes(1)
    expect(reporter.reportList).toHaveBeenCalledWith('skills', [])
    expect(reporter.warn).not.toHaveBeenCalled()
  })

  it('AC#2: 目录不存在(ENOENT)时抛出 LIST_DIR_NOT_FOUND', async () => {
    const reporter = makeMockReporter()
    // 第一次 readdir（目标目录）→ ENOENT
    const notFoundError = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    vi.mocked(readdir).mockRejectedValueOnce(notFoundError)
    // 第二次 readdir（仓库根目录，获取可用目录）
    vi.mocked(readdir).mockResolvedValueOnce([
      makeDirent('agents', true),
      makeDirent('prompts', true),
    ] as never)

    await expect(listContents(makeRepo(), makeArgs('nonexistent'), reporter)).rejects.toMatchObject(
      {
        code: 'LIST_DIR_NOT_FOUND',
        message: expect.stringContaining('nonexistent'),
        why: expect.stringContaining('nonexistent'),
        fix: expect.arrayContaining([expect.stringContaining('agents')]),
      },
    )
  })

  it('AC#2: 目录不存在(ENOTDIR)时同样抛出 LIST_DIR_NOT_FOUND', async () => {
    const reporter = makeMockReporter()
    const notDirError = Object.assign(new Error('ENOTDIR'), { code: 'ENOTDIR' })
    vi.mocked(readdir).mockRejectedValueOnce(notDirError)
    vi.mocked(readdir).mockResolvedValueOnce([makeDirent('skills', true)] as never)

    await expect(listContents(makeRepo(), makeArgs('file.txt'), reporter)).rejects.toMatchObject({
      code: 'LIST_DIR_NOT_FOUND',
    })
  })

  it('AC#2: fix[] 中包含可用顶层目录建议', async () => {
    const reporter = makeMockReporter()
    const notFoundError = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    vi.mocked(readdir).mockRejectedValueOnce(notFoundError)
    vi.mocked(readdir).mockResolvedValueOnce([
      makeDirent('agents', true),
      makeDirent('prompts', true),
      makeDirent('skills', true),
    ] as never)

    const call = listContents(makeRepo(), makeArgs('bad-dir'), reporter)
    const error = await call.catch((e) => e)

    expect(error.fix[0]).toContain('agents')
    expect(error.fix[0]).toContain('prompts')
    expect(error.fix[0]).toContain('skills')
  })

  it('EACCES 等其他 fs 错误向上透传（不降级为 LIST_DIR_NOT_FOUND）', async () => {
    const reporter = makeMockReporter()
    const accessError = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' })
    vi.mocked(readdir).mockRejectedValueOnce(accessError)

    await expect(listContents(makeRepo(), makeArgs('skills'), reporter)).rejects.toMatchObject({
      code: 'EACCES',
    })
  })

  describe('路径穿越防护（LIST_INVALID_INPUT）', () => {
    it('拒绝包含 / 的路径 — ../..', async () => {
      const reporter = makeMockReporter()
      await expect(listContents(makeRepo(), makeArgs('../..'), reporter)).rejects.toMatchObject({
        code: 'LIST_INVALID_INPUT',
        message: expect.stringContaining('../..'),
      })
      expect(readdir).not.toHaveBeenCalled()
    })

    it('拒绝包含 / 的路径 — skills/nested', async () => {
      const reporter = makeMockReporter()
      await expect(
        listContents(makeRepo(), makeArgs('skills/nested'), reporter),
      ).rejects.toMatchObject({
        code: 'LIST_INVALID_INPUT',
        message: expect.stringContaining('skills/nested'),
      })
      expect(readdir).not.toHaveBeenCalled()
    })

    it('拒绝以 . 开头的路径 — .', async () => {
      const reporter = makeMockReporter()
      await expect(listContents(makeRepo(), makeArgs('.'), reporter)).rejects.toMatchObject({
        code: 'LIST_INVALID_INPUT',
        message: expect.stringContaining('.'),
      })
      expect(readdir).not.toHaveBeenCalled()
    })

    it('拒绝以 .. 开头的路径 — ..', async () => {
      const reporter = makeMockReporter()
      await expect(listContents(makeRepo(), makeArgs('..'), reporter)).rejects.toMatchObject({
        code: 'LIST_INVALID_INPUT',
      })
      expect(readdir).not.toHaveBeenCalled()
    })

    it('路径穿越错误包含有效的修复建议', async () => {
      const reporter = makeMockReporter()
      const error = await listContents(makeRepo(), makeArgs('../..'), reporter).catch((e) => e)
      expect(error.code).toBe('LIST_INVALID_INPUT')
      expect(error.why).toBeTruthy()
      expect(error.fix).toHaveLength(1)
      expect(error.fix[0]).toContain('skills')
    })

    it('拒绝空字符串 — ""', async () => {
      const reporter = makeMockReporter()
      await expect(listContents(makeRepo(), makeArgs(''), reporter)).rejects.toMatchObject({
        code: 'LIST_INVALID_INPUT',
      })
      expect(readdir).not.toHaveBeenCalled()
    })

    it('拒绝纯空白字符串 — "   "', async () => {
      const reporter = makeMockReporter()
      await expect(listContents(makeRepo(), makeArgs('   '), reporter)).rejects.toMatchObject({
        code: 'LIST_INVALID_INPUT',
      })
      expect(readdir).not.toHaveBeenCalled()
    })
  })
})

describe('scanAvailableTopDirs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('返回所有非 . 开头的子目录，按字母排序', async () => {
    vi.mocked(readdir).mockResolvedValueOnce([
      makeDirent('skills', true),
      makeDirent('agents', true),
      makeDirent('.git', true),
      makeDirent('README.md', false),
    ] as never)

    const result = await scanAvailableTopDirs('/tmp/repo')
    expect(result).toEqual(['agents', 'skills'])
  })

  it('ENOENT 时降级为空数组', async () => {
    const notFoundError = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    vi.mocked(readdir).mockRejectedValueOnce(notFoundError)

    const result = await scanAvailableTopDirs('/tmp/nonexistent')
    expect(result).toEqual([])
  })

  it('EACCES 时透传错误', async () => {
    const accessError = Object.assign(new Error('EACCES'), { code: 'EACCES' })
    vi.mocked(readdir).mockRejectedValueOnce(accessError)

    await expect(scanAvailableTopDirs('/tmp/noperm')).rejects.toMatchObject({ code: 'EACCES' })
  })
})
