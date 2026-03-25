/**
 * commands/init.ts — init 交互式配置测试
 *
 * 来源: Story 2.5 Task 4
 * 覆盖 AC: #1-5
 *
 * CR Fix (Round 2):
 * - 新增：HTTPS URL + SSH 认证场景（Finding #2 缺失覆盖）
 * - 新增：SCP-style URL + Token 认证场景（Finding #1 缺失覆盖）
 * - 新增：已有配置修改保留旧字段断言（Finding #3 缺失覆盖）
 * - 更新：SSH 验证断言使用规范 SCP URL 而非用户原始输入
 * - 更新：Token 验证断言使用 oauth2 格式 URL
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Command } from 'commander'

// ── Hoisted mock state ────────────────────────────────────────
// vi.hoisted 确保在 vi.mock 执行之前变量已经初始化
const mocks = vi.hoisted(() => ({
  // inquirer prompts
  input: vi.fn(),
  select: vi.fn(),
  password: vi.fn(),
  confirm: vi.fn(),

  // config service
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),

  // git service
  createGit: vi.fn(),
  gitResolve: vi.fn(),

  // path resolver
  configDir: vi.fn().mockReturnValue('/mock/home/.aiforge'),
}))

// ── vi.mock 调用 ──────────────────────────────────────────────
vi.mock('@inquirer/prompts', () => ({
  input: mocks.input,
  select: mocks.select,
  password: mocks.password,
  confirm: mocks.confirm,
}))

vi.mock('../../src/services/config.js', () => ({
  loadConfig: mocks.loadConfig,
  saveConfig: mocks.saveConfig,
}))

vi.mock('../../src/services/git.js', () => ({
  createGit: mocks.createGit,
  GitSourceResolver: class MockGitSourceResolver {
    canHandle() {
      return true
    }
    resolve(url: string) {
      return mocks.gitResolve(url)
    }
  },
}))

vi.mock('../../src/core/path-resolver.js', () => ({
  UnixPathResolver: class MockPathResolver {
    home() {
      return '/mock/home'
    }
    configDir() {
      return mocks.configDir()
    }
    reposDir() {
      return '/mock/home/.aiforge/repos'
    }
    toolGlobalDir(id: string) {
      return `/mock/home/.aiforge/tools/${id}`
    }
    toolProjectDir(id: string) {
      return `.aiforge/tools/${id}`
    }
  },
}))

// ── Import 被测模块（在 vi.mock 之后）───────────────────────────
import { AiforgeError } from '../../src/core/errors.js'
import { registerInitCommand } from '../../src/commands/init.js'

// ── Fixtures ──────────────────────────────────────────────────

const EXISTING_CONFIG = {
  defaultRepo: 'git@gitlab.example.com:org/repo.git',
  auth: {
    'gitlab.example.com': { method: 'ssh' as const },
  },
  // 额外字段，用于验证 CR Fix #3（merge 保留已有字段）
  cloneDir: '~/.aiforge/repos',
  language: 'zh-CN',
}

function makeGitRaw(shouldFail = false) {
  return shouldFail
    ? vi.fn().mockRejectedValue(new Error('fatal: Could not read from remote repository'))
    : vi.fn().mockResolvedValue('')
}

// ── Test Suite ────────────────────────────────────────────────

describe('commands/init — 交互式配置', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  let originalIsTTY: boolean | undefined

  beforeEach(() => {
    // 重置所有 mock（不影响 class mock，因为 class 定义在 vi.mock 工厂中）
    vi.clearAllMocks()
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    originalIsTTY = process.stdin.isTTY

    // 默认 configDir
    mocks.configDir.mockReturnValue('/mock/home/.aiforge')

    // 默认 GitSourceResolver.resolve 返回 SSH 结果
    mocks.gitResolve.mockResolvedValue({
      hostname: 'gitlab.example.com',
      repoPath: 'org/repo',
      protocol: 'ssh',
    })
  })

  afterEach(() => {
    logSpy.mockRestore()
    Object.defineProperty(process.stdin, 'isTTY', {
      value: originalIsTTY,
      writable: true,
      configurable: true,
    })
  })

  // ── AC #5: 非 TTY 环境 ────────────────────────────────────────

  describe('非 TTY 检测 (AC #5)', () => {
    it('非 TTY 环境抛出 NON_TTY 错误（exitCode=3, severity=fatal）', async () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: false,
        writable: true,
        configurable: true,
      })

      const program = new Command()
      program.exitOverride()
      registerInitCommand(program)

      await expect(program.parseAsync(['node', 'aiforge', 'init'])).rejects.toMatchObject({
        code: 'NON_TTY',
        severity: 'fatal',
        exitCode: 3,
      })
    })

    it('非 TTY 时不调用任何 inquirer prompts', async () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: false,
        writable: true,
        configurable: true,
      })

      const program = new Command()
      program.exitOverride()
      registerInitCommand(program)

      await expect(program.parseAsync(['node', 'aiforge', 'init'])).rejects.toThrow()
      expect(mocks.input).not.toHaveBeenCalled()
      expect(mocks.select).not.toHaveBeenCalled()
    })
  })

  // ── AC #1, #2: 完整流程（SSH）────────────────────────────────

  describe('完整流程 — SSH 认证 (AC #1, #2)', () => {
    beforeEach(() => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: true,
        writable: true,
        configurable: true,
      })
      // 无已有配置
      mocks.loadConfig.mockRejectedValue(
        new AiforgeError('未找到配置文件', 'CONFIG_NOT_FOUND', 3, 'fatal', '尚未初始化', []),
      )
    })

    it('SCP URL + SSH：连接成功时使用规范 SCP 地址验证并保存配置', async () => {
      // 用户输入 SCP-style URL
      const sshUrl = 'git@gitlab.example.com:org/repo.git'
      mocks.input.mockResolvedValue(sshUrl)
      mocks.select.mockResolvedValue('ssh')
      mocks.saveConfig.mockResolvedValue(undefined)
      // resolver 解析 SCP URL
      mocks.gitResolve.mockResolvedValue({
        hostname: 'gitlab.example.com',
        repoPath: 'org/repo',
        protocol: 'ssh',
      })

      const rawMock = makeGitRaw(false)
      mocks.createGit.mockReturnValue({ raw: rawMock })

      const program = new Command()
      program.exitOverride()
      registerInitCommand(program)

      await program.parseAsync(['node', 'aiforge', 'init'])

      // CR Fix #2: 验证使用规范 SCP URL（git@hostname:repoPath.git）
      expect(rawMock).toHaveBeenCalledWith(
        expect.arrayContaining(['ls-remote', '--exit-code', 'git@gitlab.example.com:org/repo.git']),
      )

      // 验证显示了成功信息
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✅'))

      // 验证配置保存（auth 按 host 分层）
      expect(mocks.saveConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultRepo: sshUrl,
          auth: expect.objectContaining({
            'gitlab.example.com': expect.objectContaining({ method: 'ssh' }),
          }),
        }),
        expect.anything(),
      )
    })

    it('HTTPS URL + SSH：验证使用规范 SCP 地址而非 HTTPS URL（CR Fix #2）', async () => {
      // CR Fix #2 新增：HTTPS URL + SSH 认证，验证地址必须是 SCP 格式，不能是原始 HTTPS
      const httpsUrl = 'https://gitlab.example.com/org/repo.git'
      mocks.input.mockResolvedValue(httpsUrl)
      mocks.select.mockResolvedValue('ssh')
      mocks.saveConfig.mockResolvedValue(undefined)
      // resolver 解析 HTTPS URL
      mocks.gitResolve.mockResolvedValue({
        hostname: 'gitlab.example.com',
        repoPath: 'org/repo',
        protocol: 'https',
      })

      const rawMock = makeGitRaw(false)
      mocks.createGit.mockReturnValue({ raw: rawMock })

      const program = new Command()
      program.exitOverride()
      registerInitCommand(program)

      await program.parseAsync(['node', 'aiforge', 'init'])

      // 关键断言：验证 URL 必须是 SCP-style，不能是原始 HTTPS URL
      expect(rawMock).toHaveBeenCalledWith(
        expect.arrayContaining(['ls-remote', '--exit-code', 'git@gitlab.example.com:org/repo.git']),
      )
      // 确保没有用 HTTPS URL 验证 SSH
      const callArgs = rawMock.mock.calls[0]?.[0] as string[]
      expect(callArgs).not.toContain(httpsUrl)
    })

    it('SSH 连接失败时显示三段式错误提示（含 ssh-keygen 命令）', async () => {
      const sshUrl = 'git@gitlab.example.com:org/repo.git'
      mocks.input.mockResolvedValue(sshUrl)
      mocks.select.mockResolvedValue('ssh')

      const rawMock = makeGitRaw(true)
      mocks.createGit.mockReturnValue({ raw: rawMock })

      const program = new Command()
      program.exitOverride()
      registerInitCommand(program)

      await program.parseAsync(['node', 'aiforge', 'init'])

      // 验证三段式错误输出
      const allLogs = logSpy.mock.calls.map((c) => c[0]).join('\n')
      expect(allLogs).toContain('❌')
      expect(allLogs).toContain('ssh-keygen')
      // 连接失败时不保存配置
      expect(mocks.saveConfig).not.toHaveBeenCalled()
    })
  })

  // ── AC #1, #3: 完整流程（Token）──────────────────────────────

  describe('完整流程 — Token 认证 (AC #1, #3)', () => {
    beforeEach(() => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: true,
        writable: true,
        configurable: true,
      })
      mocks.loadConfig.mockRejectedValue(
        new AiforgeError('未找到配置文件', 'CONFIG_NOT_FOUND', 3, 'fatal', '尚未初始化', []),
      )
    })

    it('HTTPS URL + Token：连接成功时使用 oauth2 格式 URL 验证并脱敏显示', async () => {
      const httpsUrl = 'https://gitlab.example.com/org/repo.git'
      const token = 'glpat-abcdefgh12345678'
      mocks.input.mockResolvedValue(httpsUrl)
      mocks.select.mockResolvedValue('token')
      mocks.password.mockResolvedValue(token)
      mocks.saveConfig.mockResolvedValue(undefined)
      mocks.gitResolve.mockResolvedValue({
        hostname: 'gitlab.example.com',
        repoPath: 'org/repo',
        protocol: 'https',
      })

      const rawMock = makeGitRaw(false)
      mocks.createGit.mockReturnValue({ raw: rawMock })

      const program = new Command()
      program.exitOverride()
      registerInitCommand(program)

      await program.parseAsync(['node', 'aiforge', 'init'])

      // CR Fix #1: 验证使用 oauth2 格式 URL
      expect(rawMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          'ls-remote',
          '--exit-code',
          `https://oauth2:${token}@gitlab.example.com/org/repo.git`,
        ]),
      )

      // 验证 password prompt 被调用（不回显 token）
      expect(mocks.password).toHaveBeenCalled()

      // 验证成功提示
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✅'))

      // 验证 token 保存到 auth[host]（按 host 分层）
      expect(mocks.saveConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultRepo: httpsUrl,
          auth: expect.objectContaining({
            'gitlab.example.com': expect.objectContaining({
              method: 'token',
              token,
            }),
          }),
        }),
        expect.anything(),
      )

      // 验证日志中 token 未明文出现（脱敏）
      const allLogs = logSpy.mock.calls.map((c) => c[0]).join('\n')
      expect(allLogs).not.toContain(token)
    })

    it('SCP URL + Token：使用 oauth2 格式 HTTPS URL 验证（不用原始 SCP）（CR Fix #1）', async () => {
      // CR Fix #1 新增：SCP-style URL + Token，验证 URL 必须是 HTTPS oauth2 格式
      const scpUrl = 'git@gitlab.example.com:org/repo.git'
      const token = 'glpat-test12345678'
      mocks.input.mockResolvedValue(scpUrl)
      mocks.select.mockResolvedValue('token')
      mocks.password.mockResolvedValue(token)
      mocks.saveConfig.mockResolvedValue(undefined)
      // resolver 解析 SCP URL
      mocks.gitResolve.mockResolvedValue({
        hostname: 'gitlab.example.com',
        repoPath: 'org/repo',
        protocol: 'ssh',
      })

      const rawMock = makeGitRaw(false)
      mocks.createGit.mockReturnValue({ raw: rawMock })

      const program = new Command()
      program.exitOverride()
      registerInitCommand(program)

      await program.parseAsync(['node', 'aiforge', 'init'])

      // 关键断言：SCP URL + Token，验证必须使用 HTTPS oauth2 格式，不能使用原始 SCP URL
      expect(rawMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          'ls-remote',
          '--exit-code',
          `https://oauth2:${token}@gitlab.example.com/org/repo.git`,
        ]),
      )
      // 确保没有用 SCP URL 做 token 验证
      const callArgs = rawMock.mock.calls[0]?.[0] as string[]
      expect(callArgs).not.toContain(scpUrl)
    })

    it('Token 连接失败时显示三段式错误提示（含 Token 生成提示）', async () => {
      const httpsUrl = 'https://gitlab.example.com/org/repo.git'
      mocks.input.mockResolvedValue(httpsUrl)
      mocks.select.mockResolvedValue('token')
      mocks.password.mockResolvedValue('invalid-token')
      mocks.gitResolve.mockResolvedValue({
        hostname: 'gitlab.example.com',
        repoPath: 'org/repo',
        protocol: 'https',
      })

      const rawMock = makeGitRaw(true)
      mocks.createGit.mockReturnValue({ raw: rawMock })

      const program = new Command()
      program.exitOverride()
      registerInitCommand(program)

      await program.parseAsync(['node', 'aiforge', 'init'])

      const allLogs = logSpy.mock.calls.map((c) => c[0]).join('\n')
      expect(allLogs).toContain('❌')
      expect(mocks.saveConfig).not.toHaveBeenCalled()
    })

    it('Token 输入使用 password 类型（不回显）', async () => {
      const httpsUrl = 'https://gitlab.example.com/org/repo.git'
      mocks.input.mockResolvedValue(httpsUrl)
      mocks.select.mockResolvedValue('token')
      mocks.password.mockResolvedValue('some-token')
      mocks.saveConfig.mockResolvedValue(undefined)
      mocks.gitResolve.mockResolvedValue({
        hostname: 'gitlab.example.com',
        repoPath: 'org/repo',
        protocol: 'https',
      })

      const rawMock = makeGitRaw(false)
      mocks.createGit.mockReturnValue({ raw: rawMock })

      const program = new Command()
      program.exitOverride()
      registerInitCommand(program)

      await program.parseAsync(['node', 'aiforge', 'init'])

      // 验证使用了 password prompt 而非 input（不回显）
      expect(mocks.password).toHaveBeenCalledTimes(1)
      expect(mocks.input).toHaveBeenCalledTimes(1) // 只有 URL 用 input
    })
  })

  // ── AC #4: 已有配置修改 ───────────────────────────────────────

  describe('已有配置处理 (AC #4)', () => {
    beforeEach(() => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: true,
        writable: true,
        configurable: true,
      })
    })

    it('已有配置时显示当前配置摘要并询问是否修改', async () => {
      mocks.loadConfig.mockResolvedValue(EXISTING_CONFIG)
      mocks.confirm.mockResolvedValue(false) // 用户选择不修改

      const program = new Command()
      program.exitOverride()
      registerInitCommand(program)

      await program.parseAsync(['node', 'aiforge', 'init'])

      // 验证显示了当前配置摘要（包含仓库 URL）
      const allLogs = logSpy.mock.calls.map((c) => c[0]).join('\n')
      expect(allLogs).toContain(EXISTING_CONFIG.defaultRepo)

      // 验证询问了是否修改
      expect(mocks.confirm).toHaveBeenCalled()

      // 用户选择不修改 → 不调用 input/select
      expect(mocks.input).not.toHaveBeenCalled()
      expect(mocks.select).not.toHaveBeenCalled()
    })

    it('用户选择修改时，保留已有配置字段（CR Fix #3）', async () => {
      // CR Fix #3 新增断言：修改配置后旧字段（cloneDir、language）必须保留
      mocks.loadConfig.mockResolvedValue(EXISTING_CONFIG)
      mocks.confirm.mockResolvedValue(true) // 用户选择修改

      const newUrl = 'git@github.com:org/new-repo.git'
      mocks.input.mockResolvedValue(newUrl)
      mocks.select.mockResolvedValue('ssh')
      mocks.saveConfig.mockResolvedValue(undefined)
      mocks.gitResolve.mockResolvedValue({
        hostname: 'github.com',
        repoPath: 'org/new-repo',
        protocol: 'ssh',
      })

      const rawMock = makeGitRaw(false)
      mocks.createGit.mockReturnValue({ raw: rawMock })

      const program = new Command()
      program.exitOverride()
      registerInitCommand(program)

      await program.parseAsync(['node', 'aiforge', 'init'])

      // 验证继续了交互流程
      expect(mocks.input).toHaveBeenCalled()
      expect(mocks.select).toHaveBeenCalled()
      expect(mocks.saveConfig).toHaveBeenCalled()

      // CR Fix #3 关键断言：旧字段 cloneDir、language 必须保留在保存的配置中
      const savedConfig = mocks.saveConfig.mock.calls[0]?.[0]
      expect(savedConfig).toMatchObject({
        defaultRepo: newUrl,
        cloneDir: EXISTING_CONFIG.cloneDir, // 保留旧字段
        language: EXISTING_CONFIG.language, // 保留旧字段
        auth: expect.objectContaining({
          'github.com': expect.objectContaining({ method: 'ssh' }),
          // 旧的 auth 条目（gitlab.example.com）也应保留
          'gitlab.example.com': expect.objectContaining({ method: 'ssh' }),
        }),
      })
    })

    it('配置损坏时提示用户并继续首次配置流程', async () => {
      mocks.loadConfig.mockRejectedValue(
        new AiforgeError('配置文件损坏', 'CONFIG_CORRUPT', 3, 'fatal', '格式错误', []),
      )

      const sshUrl = 'git@gitlab.example.com:org/repo.git'
      mocks.input.mockResolvedValue(sshUrl)
      mocks.select.mockResolvedValue('ssh')
      mocks.saveConfig.mockResolvedValue(undefined)

      const rawMock = makeGitRaw(false)
      mocks.createGit.mockReturnValue({ raw: rawMock })

      const program = new Command()
      program.exitOverride()
      registerInitCommand(program)

      await program.parseAsync(['node', 'aiforge', 'init'])

      // 验证提示了配置损坏
      const allLogs = logSpy.mock.calls.map((c) => c[0]).join('\n')
      expect(allLogs).toContain('⚠️')

      // 验证继续了配置流程
      expect(mocks.input).toHaveBeenCalled()
    })
  })

  // ── 注册验证 ──────────────────────────────────────────────────

  describe('子命令注册', () => {
    it('注册 init 子命令到 program', () => {
      const program = new Command()
      registerInitCommand(program)

      const initCmd = program.commands.find((cmd) => cmd.name() === 'init')
      expect(initCmd).toBeDefined()
      expect(initCmd!.description()).toBe('初始化 aiforge 配置')
    })
  })
})
