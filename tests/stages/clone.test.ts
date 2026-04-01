import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AuthenticatedSource, ParsedArgs } from '../../src/core/types.js'
import type { Reporter } from '../../src/core/reporter.js'
import { AiforgeError } from '../../src/core/errors.js'

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../src/services/git.js', () => ({
  createGit: vi.fn(),
}))

vi.mock('node:fs/promises', () => ({
  access: vi.fn(),
  rm: vi.fn(),
  readdir: vi.fn(),
}))

import { cloneRepo } from '../../src/stages/clone.js'
import { createGit } from '../../src/services/git.js'
import { access, rm, readdir } from 'node:fs/promises'

// ── Fixtures ───────────────────────────────────────────────────

const mockGit = {
  clone: vi.fn(),
  pull: vi.fn(),
  remote: vi.fn(),
  cwd: vi.fn(),
}

// 原始含 Token 的 cloneUrl，用于每次测试前重置
const ORIGINAL_CLONE_URL = 'https://oauth2:glpat-token1234@gitlab.example.com/org/aicoding-base.git'

const mockSource: AuthenticatedSource = {
  hostname: 'gitlab.example.com',
  repoPath: 'org/aicoding-base',
  protocol: 'https',
  authMethod: 'token',
  cloneUrl: ORIGINAL_CLONE_URL,
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
  home: () => '/home/user',
  configDir: () => '/home/user/.aiforge',
  reposDir: () => '/home/user/.aiforge/repos',
  toolGlobalDir: (id: string) => `/home/user/.aiforge/tools/${id}`,
  toolProjectDir: (id: string) => `.aiforge/tools/${id}`,
}

function makeArgs(overrides: Partial<ParsedArgs> = {}): ParsedArgs {
  return {
    source: 'gitlab.example.com/org/aicoding-base',
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

// ── Tests ───────────────────────────────────────────────────────

describe('cloneRepo', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // 重置 mockSource.cloneUrl：sanitizeRemoteUrl 修复 #2 会修改 source.cloneUrl，
    // 必须在每次测试前恢复，防止跨测试 fixture 污染
    mockSource.cloneUrl = ORIGINAL_CLONE_URL
    // createGit 默认返回 mockGit（无 baseDir）
    vi.mocked(createGit).mockReturnValue(mockGit as never)
    // cwd 返回自身（链式调用）
    mockGit.cwd.mockReturnValue(mockGit)
    mockGit.clone.mockResolvedValue(undefined)
    mockGit.pull.mockResolvedValue(undefined)
    mockGit.remote.mockResolvedValue(undefined)
  })

  // AC #1: 首次浅克隆到默认路径
  describe('AC #1 — 首次浅克隆', () => {
    it('本地无仓库时使用 --depth 1 进行浅克隆', async () => {
      // 模拟目标路径不存在
      vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
      vi.mocked(readdir).mockResolvedValue([] as never)

      const args = makeArgs()
      await cloneRepo(mockSource, args, mockReporter, mockPathResolver)

      expect(mockGit.clone).toHaveBeenCalledWith(
        ORIGINAL_CLONE_URL,
        '/home/user/.aiforge/repos/aicoding-base',
        ['--depth', '1'],
      )
    })

    it('克隆到默认路径：reposDir() + repo-name（取 repoPath 最后一段）', async () => {
      vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
      vi.mocked(readdir).mockResolvedValue([] as never)

      const args = makeArgs()
      const result = await cloneRepo(mockSource, args, mockReporter, mockPathResolver)

      expect(result.repoDir).toBe('/home/user/.aiforge/repos/aicoding-base')
      expect(result.isNew).toBe(true)
    })

    it('返回的 isNew=true 表示首次克隆', async () => {
      vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
      vi.mocked(readdir).mockResolvedValue([] as never)

      const args = makeArgs()
      const result = await cloneRepo(mockSource, args, mockReporter, mockPathResolver)

      expect(result.isNew).toBe(true)
    })

    it('调用 reporter.startPhase 输出克隆进度', async () => {
      vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
      vi.mocked(readdir).mockResolvedValue([] as never)

      const args = makeArgs()
      await cloneRepo(mockSource, args, mockReporter, mockPathResolver)

      expect(mockReporter.startPhase).toHaveBeenCalledWith('克隆仓库...')
    })
  })

  // AC #2: 增量更新
  describe('AC #2 — 增量更新', () => {
    it('本地已有仓库（含 .git）时执行 git pull 而非重新克隆', async () => {
      // 模拟目标路径存在（access 成功）
      vi.mocked(access).mockResolvedValue(undefined)
      vi.mocked(readdir).mockResolvedValue([] as never)

      const args = makeArgs()
      await cloneRepo(mockSource, args, mockReporter, mockPathResolver)

      expect(mockGit.clone).not.toHaveBeenCalled()
      expect(mockGit.pull).toHaveBeenCalled()
    })

    it('增量更新时返回 isNew=false', async () => {
      vi.mocked(access).mockResolvedValue(undefined)
      vi.mocked(readdir).mockResolvedValue([] as never)

      const args = makeArgs()
      const result = await cloneRepo(mockSource, args, mockReporter, mockPathResolver)

      expect(result.isNew).toBe(false)
    })

    it('增量更新使用 cwd 切换到目标目录后执行 pull', async () => {
      vi.mocked(access).mockResolvedValue(undefined)
      vi.mocked(readdir).mockResolvedValue([] as never)

      const args = makeArgs()
      await cloneRepo(mockSource, args, mockReporter, mockPathResolver)

      // createGit 应以 targetDir 为参数调用，或 cwd 切换到 targetDir
      const targetDir = '/home/user/.aiforge/repos/aicoding-base'
      // 检查 createGit 以 targetDir 为参数调用（用于 pull）
      const calls = vi.mocked(createGit).mock.calls
      const pullCall = calls.find((c) => c[0] === targetDir)
      expect(pullCall).toBeDefined()
    })
  })

  // AC #3: 自定义路径
  describe('AC #3 — 自定义克隆路径', () => {
    it('--clone-dir 指定自定义路径时使用该路径克隆', async () => {
      vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
      vi.mocked(readdir).mockResolvedValue([] as never)

      const args = makeArgs({ cloneDir: '/custom/path/repo' })
      const result = await cloneRepo(mockSource, args, mockReporter, mockPathResolver)

      expect(mockGit.clone).toHaveBeenCalledWith(ORIGINAL_CLONE_URL, '/custom/path/repo', [
        '--depth',
        '1',
      ])
      expect(result.repoDir).toBe('/custom/path/repo')
    })
  })

  // AC #4: 失败清理
  describe('AC #4 — 克隆失败清理', () => {
    it('首次克隆失败后清理本次创建的目录', async () => {
      // hasLocalRepo: .git 不存在 → ENOENT
      // dirExists: targetDir 不存在 → ENOENT（目录不存在，本次克隆创建）
      vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
      mockGit.clone.mockRejectedValue(new Error('网络超时'))
      vi.mocked(rm).mockResolvedValue(undefined)

      const args = makeArgs()

      await expect(cloneRepo(mockSource, args, mockReporter, mockPathResolver)).rejects.toThrow(
        AiforgeError,
      )
      expect(vi.mocked(rm)).toHaveBeenCalledWith(
        '/home/user/.aiforge/repos/aicoding-base',
        expect.objectContaining({ recursive: true, force: true }),
      )
    })

    it('克隆失败时若目标目录原本存在则不删除（修复 #1）', async () => {
      // hasLocalRepo: .git 不存在（access 对 .git 失败）
      // dirExists: targetDir 存在（access 对 targetDir 成功）
      // 注意：access 被调用两次：第一次检查 .git（失败），第二次检查 targetDir（成功）
      vi.mocked(access)
        .mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })) // hasLocalRepo: .git 不存在
        .mockResolvedValueOnce(undefined) // dirExists: targetDir 存在
      mockGit.clone.mockRejectedValue(new Error('网络超时'))
      vi.mocked(rm).mockResolvedValue(undefined)

      const args = makeArgs()

      await expect(
        cloneRepo(mockSource, args, mockReporter, mockPathResolver),
      ).rejects.toMatchObject({ code: 'CLONE_FAILED' })
      // 目录原本存在，不应删除
      expect(vi.mocked(rm)).not.toHaveBeenCalled()
    })

    it('克隆失败时抛出 AiforgeError，severity=fatal，code=CLONE_FAILED', async () => {
      vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
      mockGit.clone.mockRejectedValue(new Error('connect ETIMEDOUT'))

      const args = makeArgs()

      await expect(
        cloneRepo(mockSource, args, mockReporter, mockPathResolver),
      ).rejects.toMatchObject({
        code: 'CLONE_FAILED',
        severity: 'fatal',
      })
    })

    it('克隆失败时 AiforgeError 含修复建议', async () => {
      vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
      mockGit.clone.mockRejectedValue(new Error('connect failed'))

      const args = makeArgs()

      try {
        await cloneRepo(mockSource, args, mockReporter, mockPathResolver)
      } catch (err) {
        const e = err as AiforgeError
        expect(e.fix.length).toBeGreaterThan(0)
      }
    })

    it('增量更新失败时不删除已有仓库', async () => {
      vi.mocked(access).mockResolvedValue(undefined)
      mockGit.pull.mockRejectedValue(new Error('pull failed'))

      const args = makeArgs()

      await expect(cloneRepo(mockSource, args, mockReporter, mockPathResolver)).rejects.toThrow(
        AiforgeError,
      )
      // rm 不应被调用
      expect(vi.mocked(rm)).not.toHaveBeenCalled()
    })
  })

  // AC #5: Token 清理
  describe('AC #5 — Token 清理', () => {
    it('首次克隆完成后通过 git remote set-url 清理 Token', async () => {
      vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
      vi.mocked(readdir).mockResolvedValue([] as never)

      const args = makeArgs()
      await cloneRepo(mockSource, args, mockReporter, mockPathResolver)

      expect(mockGit.remote).toHaveBeenCalledWith(expect.arrayContaining(['set-url', 'origin']))
    })

    it('清理后的 remote URL 不含 Token', async () => {
      vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
      vi.mocked(readdir).mockResolvedValue([] as never)

      const args = makeArgs()
      await cloneRepo(mockSource, args, mockReporter, mockPathResolver)

      const remoteCall = mockGit.remote.mock.calls[0] as string[][]
      const cleanUrl = remoteCall[0]?.[2]
      expect(cleanUrl).toBeDefined()
      expect(cleanUrl).not.toContain('glpat-token1234')
      expect(cleanUrl).not.toContain('oauth2:')
    })

    it('克隆完成后 source.cloneUrl 内存引用被清除（不含 Token）（修复 #2）', async () => {
      vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
      vi.mocked(readdir).mockResolvedValue([] as never)

      const source: AuthenticatedSource = { ...mockSource }
      const originalCloneUrl = source.cloneUrl
      expect(originalCloneUrl).toContain('glpat-token1234') // 确认初始含 token

      const args = makeArgs()
      await cloneRepo(source, args, mockReporter, mockPathResolver)

      // cloneRepo 调用 sanitizeRemoteUrl，后者修改 source.cloneUrl 为 clean URL
      expect(source.cloneUrl).not.toContain('glpat-token1234')
      expect(source.cloneUrl).not.toContain('oauth2:')
      expect(source.cloneUrl).toBe('https://gitlab.example.com/org/aicoding-base.git')
    })

    it('SSH 认证克隆后不需要 Token 清理（无 Token 注入）', async () => {
      vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
      vi.mocked(readdir).mockResolvedValue([] as never)

      const sshSource: AuthenticatedSource = {
        ...mockSource,
        authMethod: 'ssh',
        cloneUrl: 'git@gitlab.example.com:org/aicoding-base.git',
      }
      const args = makeArgs()
      await cloneRepo(sshSource, args, mockReporter, mockPathResolver)

      // SSH 无 Token，remote set-url 不应被调用
      expect(mockGit.remote).not.toHaveBeenCalled()
    })

    it('credential-manager 认证克隆后不需要 Token 清理', async () => {
      vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
      vi.mocked(readdir).mockResolvedValue([] as never)

      const plainSource: AuthenticatedSource = {
        ...mockSource,
        authMethod: 'credential-manager',
        cloneUrl: 'https://gitlab.example.com/org/aicoding-base.git',
      }
      const args = makeArgs()
      await cloneRepo(plainSource, args, mockReporter, mockPathResolver)

      // 无 Token 注入，不应调用 remote set-url
      expect(mockGit.remote).not.toHaveBeenCalled()
    })
  })

  // #3a: hasLocalRepo 错误类型区分（修复 #3a）
  describe('hasLocalRepo — 错误类型区分（修复 #3a）', () => {
    it('access 返回 ENOENT 时视为本地无仓库（走 freshClone 路径）', async () => {
      vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
      vi.mocked(readdir).mockResolvedValue([] as never)

      const args = makeArgs()
      const result = await cloneRepo(mockSource, args, mockReporter, mockPathResolver)

      // ENOENT → freshClone → isNew=true
      expect(result.isNew).toBe(true)
      expect(mockGit.clone).toHaveBeenCalled()
    })

    it('access 返回 ENOTDIR 时视为本地无仓库（走 freshClone 路径）', async () => {
      vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOTDIR'), { code: 'ENOTDIR' }))
      vi.mocked(readdir).mockResolvedValue([] as never)

      const args = makeArgs()
      const result = await cloneRepo(mockSource, args, mockReporter, mockPathResolver)

      expect(result.isNew).toBe(true)
      expect(mockGit.clone).toHaveBeenCalled()
    })

    it('access 返回 EACCES（权限拒绝）时向上抛出，而非误走 freshClone 路径', async () => {
      vi.mocked(access).mockRejectedValue(Object.assign(new Error('EACCES'), { code: 'EACCES' }))

      const args = makeArgs()

      // 应抛出原始错误（非 CLONE_FAILED），不进入 freshClone
      await expect(cloneRepo(mockSource, args, mockReporter, mockPathResolver)).rejects.toThrow(
        'EACCES',
      )
      expect(mockGit.clone).not.toHaveBeenCalled()
    })
  })

  // AC #1 & #2: 源文件扫描
  describe('Task 3 — 源文件扫描', () => {
    it('克隆后返回 sourceFiles 排除 .git 目录', async () => {
      vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
      // readdir 返回包含 .git 的文件列表
      vi.mocked(readdir).mockResolvedValue([
        { name: '.git', isDirectory: () => true },
        { name: 'agents', isDirectory: () => true },
        { name: 'README.md', isDirectory: () => false },
        { name: 'scripts', isDirectory: () => true },
      ] as never)

      const args = makeArgs()
      const result = await cloneRepo(mockSource, args, mockReporter, mockPathResolver)

      expect(result.sourceFiles).not.toContain('.git')
      expect(result.sourceFiles).toContain('agents')
      expect(result.sourceFiles).toContain('scripts')
    })

    it('源文件列表排除 DEFAULT_EXCLUDES 中的文件', async () => {
      vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
      vi.mocked(readdir).mockResolvedValue([
        { name: 'agents', isDirectory: () => true },
        { name: 'README.md', isDirectory: () => false },
        { name: '.DS_Store', isDirectory: () => false },
        { name: 'skills', isDirectory: () => true },
      ] as never)

      const args = makeArgs()
      const result = await cloneRepo(mockSource, args, mockReporter, mockPathResolver)

      expect(result.sourceFiles).not.toContain('README.md')
      expect(result.sourceFiles).not.toContain('.DS_Store')
      expect(result.sourceFiles).toContain('agents')
      expect(result.sourceFiles).toContain('skills')
    })

    it('sourceFiles 为相对路径（文件名，非绝对路径）', async () => {
      vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
      vi.mocked(readdir).mockResolvedValue([
        { name: 'agents', isDirectory: () => true },
        { name: 'skills', isDirectory: () => true },
      ] as never)

      const args = makeArgs()
      const result = await cloneRepo(mockSource, args, mockReporter, mockPathResolver)

      for (const f of result.sourceFiles) {
        expect(f).not.toContain('/')
        expect(f).not.toContain('\\')
      }
    })
  })

  // repo-name 提取
  describe('repo-name 提取', () => {
    it('从 repoPath org/repo 中正确提取 repo 名称', async () => {
      vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
      vi.mocked(readdir).mockResolvedValue([] as never)

      const args = makeArgs()
      const result = await cloneRepo(mockSource, args, mockReporter, mockPathResolver)

      expect(result.repoDir).toContain('aicoding-base')
      expect(result.repoDir).not.toContain('org/')
    })

    it('深层路径 group/subgroup/repo 取最后一段作为 repo 名', async () => {
      vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
      vi.mocked(readdir).mockResolvedValue([] as never)

      const deepSource: AuthenticatedSource = {
        ...mockSource,
        repoPath: 'group/subgroup/my-repo',
      }
      const args = makeArgs()
      const result = await cloneRepo(deepSource, args, mockReporter, mockPathResolver)

      expect(result.repoDir).toContain('my-repo')
      expect(result.repoDir).not.toContain('group')
    })
  })

  // cleanup 失败信息暴露（修复 #1 CR Round-3）
  describe('AC #4 — cleanup 失败信息暴露（修复 #1 CR Round-3）', () => {
    it('克隆失败且清理也失败时，CLONE_FAILED.fix 包含 cleanup 警告信息', async () => {
      // hasLocalRepo: .git 不存在 → ENOENT
      // dirExists: targetDir 不存在 → ENOENT（本次克隆创建，需要清理）
      vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
      mockGit.clone.mockRejectedValue(new Error('网络超时'))
      // rm 也失败
      vi.mocked(rm).mockRejectedValue(new Error('EPERM: operation not permitted'))

      const args = makeArgs()

      try {
        await cloneRepo(mockSource, args, mockReporter, mockPathResolver)
        expect.unreachable('应抛出 CLONE_FAILED')
      } catch (err) {
        const e = err as AiforgeError
        expect(e.code).toBe('CLONE_FAILED')
        // fix 数组应包含 cleanup 警告
        const cleanupFix = e.fix.find((f: string) => f.includes('清理未完成目录也失败'))
        expect(cleanupFix).toBeDefined()
        expect(cleanupFix).toContain('EPERM')
        expect(cleanupFix).toContain('rm -rf')
      }
    })

    it('克隆失败但清理成功时，CLONE_FAILED.fix 不包含 cleanup 警告', async () => {
      vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
      mockGit.clone.mockRejectedValue(new Error('网络超时'))
      vi.mocked(rm).mockResolvedValue(undefined)

      const args = makeArgs()

      try {
        await cloneRepo(mockSource, args, mockReporter, mockPathResolver)
        expect.unreachable('应抛出 CLONE_FAILED')
      } catch (err) {
        const e = err as AiforgeError
        expect(e.code).toBe('CLONE_FAILED')
        // fix 数组不应包含 cleanup 警告
        const cleanupFix = e.fix.find((f: string) => f.includes('清理未完成目录也失败'))
        expect(cleanupFix).toBeUndefined()
      }
    })
  })

  // dirExists 错误区分（修复 #1 CR Round-2）
  describe('dirExists — 错误类型区分（修复 #1 CR Round-2）', () => {
    it('dirExists 遇到 EACCES 时向上抛出，不误判为目录不存在导致错误清理', async () => {
      // hasLocalRepo: .git 不存在 → ENOENT（走 freshClone）
      // dirExists: targetDir → EACCES（权限拒绝）→ 应向上抛出，而非 return false
      vi.mocked(access)
        .mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })) // hasLocalRepo: .git
        .mockRejectedValueOnce(Object.assign(new Error('EACCES'), { code: 'EACCES' })) // dirExists: targetDir
      mockGit.clone.mockRejectedValue(new Error('网络超时'))

      const args = makeArgs()

      // 应抛出 EACCES 错误，而非进入 rm() 删除目录
      await expect(cloneRepo(mockSource, args, mockReporter, mockPathResolver)).rejects.toThrow(
        'EACCES',
      )
      // rm 不应被调用（因为 dirExists 抛出，不进入清理判断）
      expect(vi.mocked(rm)).not.toHaveBeenCalled()
    })
  })

  // 新增错误分支回归测试（修复 #3 CR Round-2）
  describe('错误分支回归测试 — SANITIZE_REMOTE_FAILED / SCAN_FAILED（修复 #3 CR Round-2）', () => {
    it('git remote set-url 失败时抛出 SANITIZE_REMOTE_FAILED', async () => {
      vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
      vi.mocked(readdir).mockResolvedValue([] as never)
      mockGit.remote.mockRejectedValue(new Error('git error: remote set-url failed'))

      const args = makeArgs()

      await expect(
        cloneRepo(mockSource, args, mockReporter, mockPathResolver),
      ).rejects.toMatchObject({
        code: 'SANITIZE_REMOTE_FAILED',
        severity: 'fatal',
      })
    })

    it('readdir 失败时抛出 SCAN_FAILED', async () => {
      vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
      vi.mocked(readdir).mockRejectedValue(Object.assign(new Error('EACCES'), { code: 'EACCES' }))

      const args = makeArgs()

      await expect(
        cloneRepo(mockSource, args, mockReporter, mockPathResolver),
      ).rejects.toMatchObject({
        code: 'SCAN_FAILED',
        severity: 'fatal',
      })
    })
  })
})

describe('Story 5-4: clone 错误文案审计', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createGit).mockReturnValue(mockGit as never)
  })

  // Story 5-4 Task 2.2: CLONE_FAILED fix 包含认证修复命令
  it('CLONE_FAILED fix 包含 --token 和 init 认证修复命令 (Story 5-4 Task 2.2)', async () => {
    vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
    vi.mocked(rm).mockResolvedValue(undefined)
    vi.mocked(mockGit.clone).mockRejectedValue(new Error('fatal: Authentication failed'))

    // readdir 不会到达，但需要 mock 防止 hang
    vi.mocked(readdir).mockResolvedValue([])

    const args: ParsedArgs = { global: true }
    const source: AuthenticatedSource = {
      hostname: 'gitlab.example.com',
      repoPath: 'org/repo',
      protocol: 'https',
      authMethod: 'token',
      cloneUrl: 'https://oauth2:token@gitlab.example.com/org/repo.git',
    }
    const reporter: Reporter = {
      startPhase: vi.fn(),
      updatePhase: vi.fn(),
      completePhase: vi.fn(),
      reportResult: vi.fn(),
      reportPlan: vi.fn(),
      reportError: vi.fn(),
      warn: vi.fn(),
    }
    const { UnixPathResolver } = await import('../../src/core/path-resolver.js')
    const pathResolver = new UnixPathResolver()

    let caughtError: AiforgeError | null = null
    try {
      await (
        await import('../../src/stages/clone.js')
      ).cloneRepo(source, args, reporter, pathResolver)
    } catch (err) {
      caughtError = err as AiforgeError
    }

    expect(caughtError).not.toBeNull()
    expect(caughtError!.code).toBe('AUTH_FAILED')
    expect(caughtError!.message).toBe('无法访问仓库')
    // Task 2.2: fix 应包含 --ssh、--token 和 init
    expect(caughtError!.fix.some((f) => f.includes('--ssh'))).toBe(true)
    expect(caughtError!.fix.some((f) => f.includes('--token'))).toBe(true)
    expect(caughtError!.fix.some((f) => f.includes('init'))).toBe(true)
  })

  // Story 5-4 Finding #1 修复：AUTH_FAILED 真实链路测试
  it('clone 认证失败（401）时抛出 AUTH_FAILED，message=无法访问仓库，why 含 401', async () => {
    vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
    vi.mocked(rm).mockResolvedValue(undefined)
    vi.mocked(mockGit.clone).mockRejectedValue(
      new Error(
        'remote: HTTP Basic: Access denied\nfatal: Authentication failed for https://gitlab.example.com/org/repo.git',
      ),
    )
    vi.mocked(readdir).mockResolvedValue([])

    try {
      await cloneRepo(mockSource, makeArgs(), mockReporter, mockPathResolver)
      expect.unreachable('应抛出 AUTH_FAILED')
    } catch (err) {
      const e = err as AiforgeError
      expect(e.code).toBe('AUTH_FAILED')
      expect(e.message).toBe('无法访问仓库')
      expect(e.why).toContain('401')
      expect(e.fix.some((f) => f.includes('--ssh'))).toBe(true)
      expect(e.fix.some((f) => f.includes('--token'))).toBe(true)
      expect(e.fix.some((f) => f.includes('init'))).toBe(true)
    }
  })

  // Story 5-4 Finding #2 修复：CLONE_FAILED why 脱敏测试（含 token 的 URL 不应出现在 why 中）
  it('clone 失败（非认证）时 CLONE_FAILED.why 不包含原始 token', async () => {
    vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
    vi.mocked(rm).mockResolvedValue(undefined)
    const tokenUrl = 'https://oauth2:glpat-supersecret1234@gitlab.example.com/org/repo.git'
    vi.mocked(mockGit.clone).mockRejectedValue(new Error(`Could not resolve host: ${tokenUrl}`))
    vi.mocked(readdir).mockResolvedValue([])

    try {
      await cloneRepo(mockSource, makeArgs(), mockReporter, mockPathResolver)
      expect.unreachable('应抛出 CLONE_FAILED')
    } catch (err) {
      const e = err as AiforgeError
      expect(e.code).toBe('CLONE_FAILED')
      expect(e.why).not.toContain('glpat-supersecret1234')
    }
  })

  // Story 5-4 Finding #1 修复：PULL 认证失败路径
  it('pull 认证失败（401）时抛出 AUTH_FAILED', async () => {
    // hasLocalRepo: .git 存在（走 pull 路径）
    vi.mocked(access).mockResolvedValue(undefined)
    vi.mocked(readdir).mockResolvedValue([])
    vi.mocked(mockGit.pull).mockRejectedValue(
      new Error('fatal: Authentication failed for https://gitlab.example.com/'),
    )

    try {
      await cloneRepo(mockSource, makeArgs(), mockReporter, mockPathResolver)
      expect.unreachable('应抛出 AUTH_FAILED')
    } catch (err) {
      const e = err as AiforgeError
      expect(e.code).toBe('AUTH_FAILED')
      expect(e.message).toBe('无法访问仓库')
    }
  })

  // Story 5-4 Finding #2 修复：PULL_FAILED why 脱敏
  it('pull 失败（非认证）时 PULL_FAILED.why 不包含原始 token', async () => {
    vi.mocked(access).mockResolvedValue(undefined)
    vi.mocked(readdir).mockResolvedValue([])
    const tokenUrl = 'https://oauth2:glpat-supersecret1234@gitlab.example.com/org/repo.git'
    vi.mocked(mockGit.pull).mockRejectedValue(new Error(`network error: ${tokenUrl}`))

    try {
      await cloneRepo(mockSource, makeArgs(), mockReporter, mockPathResolver)
      expect.unreachable('应抛出 PULL_FAILED')
    } catch (err) {
      const e = err as AiforgeError
      expect(e.code).toBe('PULL_FAILED')
      expect(e.why).not.toContain('glpat-supersecret1234')
    }
  })
})
