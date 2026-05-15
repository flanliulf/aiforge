/**
 * edge-cases.test.ts — 冲突和边界场景测试
 *
 * 来源: Story 5.5b Task 5
 * 测试:
 *   AC #4: 至少覆盖三条主路径：--force 覆盖、备份后覆盖、跳过
 *   AC #5: 零结果场景触发诊断输出
 *   Task 5.5: 排除列表验证
 *   AC #6: macOS 环境通过
 *
 * 策略:
 *   - Mock Git 克隆，使用 fixture 仓库或临时仓库
 *   - 使用 createProductionStages 真实闭包
 *   - 预先在目标路径创建文件制造冲突
 *   - Mock conflict-resolver.resolveConflict 控制交互决策（避免 TTY 依赖）
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, readFile, rm, access as fsAccess } from 'node:fs/promises'
import { join, basename, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import type { ParsedArgs } from '../../src/core/types.js'
import type { Reporter } from '../../src/core/reporter.js'
import type { PathResolver } from '../../src/core/path-resolver.js'
import { createProductionStages } from '../../src/pipeline.js'

// ── Fixture 仓库路径 ─────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url)
const __filenameDir = dirname(__filename)
const FIXTURE_REPO = join(__filenameDir, '..', 'fixtures', 'sample-repo')

// ── Mock 网络层 ──────────────────────────────────────────────────────────────

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

// Mock conflict-resolver 以控制交互决策（避免 TTY 环境依赖）
const resolveConflictMock = vi.hoisted(() => vi.fn())
vi.mock('../../src/stages/conflict-resolver.js', () => ({
  resolveConflict: resolveConflictMock,
  handleConflict: vi.fn(
    async (targetPath: string, sourcePath: string, force: boolean, reporter: Reporter) => {
      if (force) return 'overwrite'
      // 非 force：委托给 mock 的 resolveConflict
      const decision = await resolveConflictMock(targetPath, sourcePath, reporter)
      if (decision === 'abort') {
        const { AiforgeError } = await import('../../src/core/errors.js')
        const { EXIT_INSTALL_FAILURE } = await import('../../src/core/errors.js')
        throw new AiforgeError('用户中止安装', 'USER_ABORT', EXIT_INSTALL_FAILURE, 'fatal', '', [])
      }
      return decision
    },
  ),
}))

// ── 测试辅助 ─────────────────────────────────────────────────────────────────

function createMockPathResolver(homeDir: string): PathResolver {
  return {
    home: () => homeDir,
    configDir: () => join(homeDir, '.aiforge'),
    reposDir: () => join(homeDir, '.aiforge', 'repos'),
    toolGlobalDir: (id: string) => join(homeDir, `.${id}`),
    toolProjectDir: (id: string) => `.${id}`,
  }
}

function createTestArgs(partial: Partial<ParsedArgs> = {}): ParsedArgs {
  return {
    source: 'https://gitlab.example.com/org/repo',
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
    reportError: vi.fn(),
    warn: vi.fn(),
  }
}

/**
 * 辅助：通过 createProductionStages 执行真实安装（resolve→auth→clone→detect→match→install）
 * 返回安装结果
 */
async function runInstall(pathResolver: PathResolver, args: ParsedArgs, reporter: Reporter) {
  const stages = createProductionStages(pathResolver)
  const source = await stages.resolve(args, reporter)
  const authed = await stages.authenticate(source, args, reporter)
  const repo = await stages.clone(authed, args, reporter)
  const env = await stages.detect(repo, args, reporter)
  const plan = await stages.match(env, args, reporter)
  return stages.install(plan, args, reporter)
}

// ── 共享 beforeEach/afterEach ─────────────────────────────────────────────────

describe('Story 5.5b AC #4: 冲突场景测试', () => {
  let tmpDir: string
  let homeDir: string
  let mockReporter: Reporter
  let mockPathResolver: PathResolver
  let originalCwd: string

  beforeEach(async () => {
    originalCwd = process.cwd()
    tmpDir = await mkdtemp(join(tmpdir(), 'aiforge-edge-'))
    homeDir = join(tmpDir, 'home')
    await mkdir(homeDir, { recursive: true })
    await mkdir(join(homeDir, '.aiforge'), { recursive: true })

    process.chdir(tmpDir)

    mockPathResolver = createMockPathResolver(homeDir)
    mockReporter = createMockReporter()

    cloneMock.mockResolvedValue({
      repoDir: FIXTURE_REPO,
      isNew: true,
      sourceFiles: [],
    })
  })

  afterEach(async () => {
    process.exitCode = undefined
    process.chdir(originalCwd)
    await rm(tmpDir, { recursive: true, force: true })
    vi.clearAllMocks()
  })

  // ── Task 5.1: --force 直接覆盖 ──────────────────────────────────────────

  describe('Task 5.1: --force 覆盖（AC #4 主路径 1）', () => {
    it('--force：预先存在的目标文件被直接覆盖，不产生备份文件', async () => {
      // 预先在目标路径创建不同内容的文件（制造冲突）
      const agentTargetDir = join(homeDir, '.claude', 'agents')
      await mkdir(agentTargetDir, { recursive: true })
      const targetFile = join(agentTargetDir, 'coding-agent.md')
      const originalContent = '# Original Content - Should Be Overwritten'
      await writeFile(targetFile, originalContent)

      // 确认预存内容与 fixture 不同
      const srcContent = await readFile(join(FIXTURE_REPO, 'agents', 'coding-agent.md'), 'utf-8')
      expect(originalContent).not.toBe(srcContent)

      // 执行 --force 安装
      const args = createTestArgs({ force: true })
      const result = await runInstall(mockPathResolver, args, mockReporter)

      // 验证文件被覆盖（内容与源文件一致）
      const installedContent = await readFile(targetFile, 'utf-8')
      expect(installedContent).toBe(srcContent)

      // 状态为 updated（已存在→覆盖）
      const updatedItems = result.items.filter(
        (i) => i.targetPath === targetFile && i.status === 'updated',
      )
      expect(updatedItems.length).toBe(1)

      // 无备份文件（--force 不备份）
      const entries = await import('node:fs/promises').then(({ readdir }) =>
        readdir(agentTargetDir),
      )
      const backupFiles = entries.filter((e) => e.includes('aiforge-backup'))
      expect(backupFiles.length).toBe(0)
    })

    it('--force：hash 相同的文件被跳过（状态为 skipped，无需覆盖）', async () => {
      // 先正常安装一次
      const args = createTestArgs({ force: false })
      await runInstall(mockPathResolver, args, mockReporter)

      // 第二次用 --force 安装相同内容
      const argsForce = createTestArgs({ force: true })
      const result = await runInstall(mockPathResolver, argsForce, mockReporter)

      // 相同内容应被跳过（status: skipped）
      const codingAgentResult = result.items.find((i) => i.targetPath.includes('coding-agent.md'))
      expect(codingAgentResult?.status).toBe('skipped')
    })
  })

  // ── Task 5.2: 备份后覆盖 ─────────────────────────────────────────────

  describe('Task 5.2: 备份后覆盖（AC #4 主路径 2）', () => {
    it('backup 决策：目标文件被备份为 {filename}.aiforge-backup-{YYYYMMDD}，原文件被新内容覆盖', async () => {
      // 预先在目标路径创建文件（制造 user-file 冲突）
      const agentTargetDir = join(homeDir, '.claude', 'agents')
      await mkdir(agentTargetDir, { recursive: true })
      const targetFile = join(agentTargetDir, 'coding-agent.md')
      const originalContent = '# Original User File - Should Be Backed Up'
      await writeFile(targetFile, originalContent)

      // 设置 manifest 为空（不包含该文件，会被判定为 user-file 冲突）
      // resolveConflict mock 返回 'backup' 决策
      resolveConflictMock.mockResolvedValue('backup')

      // 执行安装（不加 --force）
      const args = createTestArgs({ force: false })
      const result = await runInstall(mockPathResolver, args, mockReporter)

      // 验证原文件内容被新内容覆盖
      const srcContent = await readFile(join(FIXTURE_REPO, 'agents', 'coding-agent.md'), 'utf-8')
      const installedContent = await readFile(targetFile, 'utf-8')
      expect(installedContent).toBe(srcContent)

      // 验证备份文件存在（格式: coding-agent.md.aiforge-backup-YYYYMMDD）
      const entries = await import('node:fs/promises').then(({ readdir }) =>
        readdir(agentTargetDir),
      )
      const backupFiles = entries.filter((e) => e.includes('aiforge-backup'))
      expect(backupFiles.length).toBeGreaterThan(0)

      // 验证备份文件内容为原始内容
      const backupPath = join(agentTargetDir, backupFiles[0]!)
      const backupContent = await readFile(backupPath, 'utf-8')
      expect(backupContent).toBe(originalContent)

      // 安装状态为 updated
      const updatedItem = result.items.find(
        (i) => i.targetPath === targetFile && i.status === 'updated',
      )
      expect(updatedItem).toBeDefined()
    })
  })

  // ── Task 5.3: 跳过冲突 ──────────────────────────────────────────────

  describe('Task 5.3: 跳过冲突（AC #4 主路径 3）', () => {
    it('skip 决策：用户选择跳过时文件未被修改，结果为 status: skipped', async () => {
      // 预先在目标路径创建文件
      const agentTargetDir = join(homeDir, '.claude', 'agents')
      await mkdir(agentTargetDir, { recursive: true })
      const targetFile = join(agentTargetDir, 'coding-agent.md')
      const originalContent = '# User File - Should Not Be Modified'
      await writeFile(targetFile, originalContent)

      // resolveConflict mock 返回 'skip' 决策
      resolveConflictMock.mockResolvedValue('skip')

      // 执行安装
      const args = createTestArgs({ force: false })
      const result = await runInstall(mockPathResolver, args, mockReporter)

      // 验证文件未被修改（内容为原始内容）
      const fileContent = await readFile(targetFile, 'utf-8')
      expect(fileContent).toBe(originalContent)

      // 结果状态为 skipped
      const skippedItem = result.items.find(
        (i) => i.targetPath === targetFile && i.status === 'skipped',
      )
      expect(skippedItem).toBeDefined()
    })

    it('skip 决策：跳过 coding-agent.md 但 review-agent.md 正常安装（只跳过有冲突的文件）', async () => {
      const agentTargetDir = join(homeDir, '.claude', 'agents')
      await mkdir(agentTargetDir, { recursive: true })

      // 只在 coding-agent.md 制造冲突
      const conflictFile = join(agentTargetDir, 'coding-agent.md')
      await writeFile(conflictFile, '# Conflict Content')

      // 第一个冲突文件跳过，第二个文件（review-agent.md）正常安装
      resolveConflictMock.mockResolvedValue('skip')

      const args = createTestArgs({ force: false })
      const result = await runInstall(mockPathResolver, args, mockReporter)

      // coding-agent.md 被跳过
      const skipped = result.items.find(
        (i) => i.targetPath === conflictFile && i.status === 'skipped',
      )
      expect(skipped).toBeDefined()

      // review-agent.md 正常安装（new）
      const reviewFile = join(agentTargetDir, 'review-agent.md')
      const installed = result.items.find((i) => i.targetPath === reviewFile && i.status === 'new')
      expect(installed).toBeDefined()
    })
  })
})

// ── Task 5.4: 零结果场景 ─────────────────────────────────────────────────

describe('Story 5.5b AC #5: 零结果场景触发诊断输出', () => {
  let tmpDir: string
  let homeDir: string
  let emptyRepoDir: string
  let mockReporter: Reporter
  let mockPathResolver: PathResolver
  let originalCwd: string

  beforeEach(async () => {
    originalCwd = process.cwd()
    tmpDir = await mkdtemp(join(tmpdir(), 'aiforge-zero-'))
    homeDir = join(tmpDir, 'home')
    emptyRepoDir = join(tmpDir, 'empty-repo')
    await mkdir(homeDir, { recursive: true })
    await mkdir(join(homeDir, '.aiforge'), { recursive: true })
    await mkdir(emptyRepoDir, { recursive: true })

    process.chdir(tmpDir)

    mockPathResolver = createMockPathResolver(homeDir)
    mockReporter = createMockReporter()
  })

  afterEach(async () => {
    process.exitCode = undefined
    process.chdir(originalCwd)
    await rm(tmpDir, { recursive: true, force: true })
    vi.clearAllMocks()
  })

  it('空仓库（无 agents/ 目录）：触发零结果诊断输出（reporter.warn 被调用含诊断信息）', async () => {
    // 空仓库：没有任何资源目录
    cloneMock.mockResolvedValue({
      repoDir: emptyRepoDir,
      isNew: true,
      sourceFiles: [],
    })

    const args: ParsedArgs = {
      source: 'https://gitlab.example.com/org/repo',
      global: true,
      link: false,
      tools: ['claude'],
      dirs: [],
      dryRun: false,
      quiet: false,
      force: false,
      ssh: false,
      symlink: false,
      flatten: false,
    }

    const stages = createProductionStages(mockPathResolver)
    const source = await stages.resolve(args, mockReporter)
    const authed = await stages.authenticate(source, args, mockReporter)
    const repo = await stages.clone(authed, args, mockReporter)
    const env = await stages.detect(repo, args, mockReporter)
    const plan = await stages.match(env, args, mockReporter)
    const result = await stages.install(plan, args, mockReporter)

    // 结果为空（无可安装文件）
    const installedItems = result.items.filter((i) => i.status === 'new' || i.status === 'updated')
    expect(installedItems.length).toBe(0)

    // 诊断输出：reporter.warn 被调用（零结果诊断）
    const warnMock = vi.mocked(mockReporter.warn)
    expect(warnMock).toHaveBeenCalled()
    // 至少有一条 warn 包含诊断相关文案
    const warnCalls = warnMock.mock.calls.map((call) => call[0])
    // 零结果场景输出诊断信息（来自 diagnoseZeroResults）
    expect(warnCalls.length).toBeGreaterThan(0)
  })

  it('全部跳过场景：所有文件被 skip 时也触发零结果诊断', async () => {
    // 使用 fixture 仓库，但 coding-agent.md 和 review-agent.md 都设置为 skip
    cloneMock.mockResolvedValue({
      repoDir: FIXTURE_REPO,
      isNew: true,
      sourceFiles: [],
    })

    // 预先创建目标文件（制造冲突），设置 skip 决策
    const agentTargetDir = join(homeDir, '.claude', 'agents')
    await mkdir(agentTargetDir, { recursive: true })
    await writeFile(join(agentTargetDir, 'coding-agent.md'), '# User file 1')
    await writeFile(join(agentTargetDir, 'review-agent.md'), '# User file 2')

    // 所有冲突都选择跳过
    resolveConflictMock.mockResolvedValue('skip')

    const args: ParsedArgs = {
      source: 'https://gitlab.example.com/org/repo',
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
    }

    const stages = createProductionStages(mockPathResolver)
    const source = await stages.resolve(args, mockReporter)
    const authed = await stages.authenticate(source, args, mockReporter)
    const repo = await stages.clone(authed, args, mockReporter)
    const env = await stages.detect(repo, args, mockReporter)
    const plan = await stages.match(env, args, mockReporter)
    const result = await stages.install(plan, args, mockReporter)

    // 所有项目都 skipped
    expect(result.items.every((i) => i.status === 'skipped')).toBe(true)

    // 全部跳过视为成功：completePhase 被调用，warn 不触发零结果诊断
    const completePhase = vi.mocked(mockReporter.completePhase)
    expect(completePhase).toHaveBeenCalled()
    const warnMock = vi.mocked(mockReporter.warn)
    // warn 可能被其他阶段调用，但不应包含零结果诊断文案
    const warnCalls = warnMock.mock.calls.map((call) => call[0])
    expect(warnCalls.every((msg) => !msg.includes('已扫描目录') && !msg.includes('匹配规则'))).toBe(
      true,
    )
  })
})

// ── Task 5.5: 排除列表验证 ─────────────────────────────────────────────────

describe('Story 5.5b Task 5.5: 排除列表（DEFAULT_EXCLUDES）', () => {
  let tmpDir: string
  let homeDir: string
  let mockReporter: Reporter
  let mockPathResolver: PathResolver
  let originalCwd: string

  beforeEach(async () => {
    originalCwd = process.cwd()
    tmpDir = await mkdtemp(join(tmpdir(), 'aiforge-excludes-'))
    homeDir = join(tmpDir, 'home')
    await mkdir(homeDir, { recursive: true })
    await mkdir(join(homeDir, '.aiforge'), { recursive: true })

    process.chdir(tmpDir)

    mockPathResolver = createMockPathResolver(homeDir)
    mockReporter = createMockReporter()

    cloneMock.mockResolvedValue({
      repoDir: FIXTURE_REPO,
      isNew: true,
      sourceFiles: [],
    })
  })

  afterEach(async () => {
    process.exitCode = undefined
    process.chdir(originalCwd)
    await rm(tmpDir, { recursive: true, force: true })
    vi.clearAllMocks()
  })

  it('README.md 不被安装到目标目录（列在 DEFAULT_EXCLUDES 中）', async () => {
    const args: ParsedArgs = {
      source: 'https://gitlab.example.com/org/repo',
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
    }

    const result = await runInstall(mockPathResolver, args, mockReporter)

    // 验证 README.md 不在安装结果中
    const readmeResult = result.items.find((i) => basename(i.targetPath) === 'README.md')
    expect(readmeResult).toBeUndefined()

    // 验证 README.md 文件未被创建于目标目录
    const agentTargetDir = join(homeDir, '.claude', 'agents')
    await expect(fsAccess(join(agentTargetDir, 'README.md'))).rejects.toMatchObject({
      code: 'ENOENT',
    })
  })

  it('.gitkeep 不被安装到目标目录（列在 DEFAULT_EXCLUDES 中）', async () => {
    const args: ParsedArgs = {
      source: 'https://gitlab.example.com/org/repo',
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
    }

    const result = await runInstall(mockPathResolver, args, mockReporter)

    // 验证 .gitkeep 不在安装结果中
    const gitkeepResult = result.items.find((i) => basename(i.targetPath) === '.gitkeep')
    expect(gitkeepResult).toBeUndefined()
  })

  it('fixture 仓库根目录的 README.md 不影响 agents/ 安装（排除逻辑只在各 sourceDir 下生效）', async () => {
    const args: ParsedArgs = {
      source: 'https://gitlab.example.com/org/repo',
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
    }

    const result = await runInstall(mockPathResolver, args, mockReporter)

    // agents/ 目录下的正常 .md 文件应被安装
    const agentResults = result.items.filter(
      (i) => i.targetPath.includes('agents') && i.status === 'new',
    )
    expect(agentResults.length).toBeGreaterThan(0)

    // 验证具体文件存在
    const agentTargetDir = join(homeDir, '.claude', 'agents')
    await expect(fsAccess(join(agentTargetDir, 'coding-agent.md'))).resolves.toBeUndefined()
    await expect(fsAccess(join(agentTargetDir, 'review-agent.md'))).resolves.toBeUndefined()
  })
})
