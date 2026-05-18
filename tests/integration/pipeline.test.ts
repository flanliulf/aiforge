/**
 * pipeline.test.ts — 管道端到端集成测试
 *
 * 来源: Story 4.6a Task 4
 * 测试:
 *   AC #1: 正常模式完整管道端到端流程
 *   AC #2: fatal 错误停止、reporter.reportError、process.exitCode
 *   AC #3: Install 后由 pipeline 层调用 saveManifest
 *   干-run 路径跳过 install 和 saveManifest
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type {
  ParsedArgs,
  MatchedPlan,
  InstallResult,
  ResolvedSource,
  AuthenticatedSource,
  LocalRepo,
  DetectedEnv,
} from '../../src/core/types.js'
import type { Reporter } from '../../src/core/reporter.js'
import { AiforgeError, EXIT_INSTALL_FAILURE, EXIT_AUTH_FAILURE } from '../../src/core/errors.js'
import { runPipeline } from '../../src/pipeline.js'
import type { PipelineStages } from '../../src/pipeline.js'

// ── 测试辅助 ───────────────────────────────────────────────────────────────

function createTestArgs(partial: Partial<ParsedArgs> = {}): ParsedArgs {
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

// 标准 mock 数据
const mockSource: ResolvedSource = {
  hostname: 'gitlab.example.com',
  repoPath: 'org/repo',
  protocol: 'https',
}
const mockAuthed: AuthenticatedSource = {
  hostname: 'gitlab.example.com',
  repoPath: 'org/repo',
  protocol: 'https',
  authMethod: 'token',
  cloneUrl: 'https://gitlab.example.com/org/repo.git',
}
const mockRepo: LocalRepo = {
  repoDir: '/tmp/test-repo',
  isNew: true,
  sourceFiles: ['/tmp/test-repo/agents/test.md'],
}
const mockEnv: DetectedEnv = {
  tools: ['claude'],
  scope: 'global',
}
const mockPlan: MatchedPlan = {
  items: [
    {
      rule: {
        tool: 'claude',
        scope: 'global',
        sourceDir: 'agents',
        type: 'Files' as never,
        targetDir: '/home/user/.claude',
      },
      sourceFiles: ['/tmp/test-repo/agents/test.md'],
      targetPath: '/home/user/.claude',
      mode: 'copy',
    },
  ],
}
const mockResult: InstallResult = {
  items: [
    {
      status: 'new',
      sourcePath: '/tmp/test-repo/agents/test.md',
      targetPath: '/home/user/.claude/test.md',
      tool: 'claude',
    },
    {
      status: 'updated',
      sourcePath: '/tmp/test-repo/agents/old.md',
      targetPath: '/home/user/.claude/old.md',
      tool: 'claude',
    },
    {
      status: 'skipped',
      sourcePath: '/tmp/test-repo/agents/same.md',
      targetPath: '/home/user/.claude/same.md',
      tool: 'claude',
    },
  ],
}

/**
 * 创建可追踪调用顺序的 mock stages
 */
function createTrackedStages(overrides: Partial<PipelineStages> = {}): PipelineStages & {
  callOrder: string[]
} {
  const callOrder: string[] = []
  return {
    callOrder,
    resolve: vi.fn(async () => {
      callOrder.push('resolve')
      return mockSource
    }),
    authenticate: vi.fn(async () => {
      callOrder.push('authenticate')
      return mockAuthed
    }),
    clone: vi.fn(async () => {
      callOrder.push('clone')
      return mockRepo
    }),
    detect: vi.fn(async () => {
      callOrder.push('detect')
      return mockEnv
    }),
    match: vi.fn(async () => {
      callOrder.push('match')
      return mockPlan
    }),
    install: vi.fn(async () => {
      callOrder.push('install')
      return mockResult
    }),
    saveManifest: vi.fn(async () => {
      callOrder.push('saveManifest')
    }),
    report: vi.fn(() => {
      callOrder.push('report')
    }),
    ...overrides,
  }
}

// ── 集成测试 ───────────────────────────────────────────────────────────────

describe('pipeline 端到端集成测试 (Story 4.6a)', () => {
  let mockReporter: Reporter
  let originalExitCode: number | undefined

  beforeEach(() => {
    mockReporter = createMockReporter()
    originalExitCode = process.exitCode
    vi.restoreAllMocks()
  })

  afterEach(() => {
    process.exitCode = originalExitCode
  })

  // ── AC #1: 正常模式完整流程 ────────────────────────────────────────────

  describe('AC #1: 正常模式完整管道端到端', () => {
    it('完整阶段链按顺序执行：Resolve → Auth → Clone → Detect → Match → Install → SaveManifest → Report', async () => {
      const stages = createTrackedStages()
      const args = createTestArgs({ dryRun: false })

      await runPipeline(args, mockReporter, stages)

      expect(stages.callOrder).toEqual([
        'resolve',
        'authenticate',
        'clone',
        'detect',
        'match',
        'install',
        'saveManifest',
        'report',
      ])
    })

    it('ParsedArgs 由编排器持有并传入各阶段', async () => {
      const stages = createTrackedStages()
      const args = createTestArgs({ global: true, tools: ['claude'] })

      await runPipeline(args, mockReporter, stages)

      // 验证 args 被传入各阶段
      expect(stages.resolve).toHaveBeenCalledWith(args, mockReporter)
      expect(stages.authenticate).toHaveBeenCalledWith(mockSource, args, mockReporter)
      expect(stages.clone).toHaveBeenCalledWith(mockAuthed, args, mockReporter)
      expect(stages.detect).toHaveBeenCalledWith(mockRepo, args, mockReporter)
      expect(stages.match).toHaveBeenCalledWith(mockEnv, args, mockReporter)
      expect(stages.install).toHaveBeenCalledWith(mockPlan, args, mockReporter)
    })

    it('正常模式执行完成后 reportResult 被调用', async () => {
      const stages = createTrackedStages()
      const args = createTestArgs({ dryRun: false })

      await runPipeline(args, mockReporter, stages)

      expect(stages.report).toHaveBeenCalledWith(mockResult, mockReporter, 'result')
    })

    it('不产生 reportError 调用', async () => {
      const stages = createTrackedStages()
      const args = createTestArgs({ dryRun: false })

      await runPipeline(args, mockReporter, stages)

      expect(mockReporter.reportError).not.toHaveBeenCalled()
    })
  })

  // ── AC #2: fatal 错误停止 ─────────────────────────────────────────────

  describe('AC #2: fatal 错误立即停止管道', () => {
    it('阶段抛出 AiforgeError(severity: fatal) 时管道立即停止', async () => {
      const stages = createTrackedStages({
        clone: vi.fn(async () => {
          throw new AiforgeError(
            '克隆失败',
            'ERR_CLONE',
            EXIT_INSTALL_FAILURE,
            'fatal',
            '网络超时',
            ['检查网络连接'],
          )
        }),
      })

      const args = createTestArgs()
      await runPipeline(args, mockReporter, stages)

      // 只执行了 resolve 和 authenticate，clone 后停止
      expect(stages.resolve).toHaveBeenCalled()
      expect(stages.authenticate).toHaveBeenCalled()
      expect(stages.clone).toHaveBeenCalled()
      // 后续阶段未执行
      expect(stages.detect).not.toHaveBeenCalled()
      expect(stages.match).not.toHaveBeenCalled()
      expect(stages.install).not.toHaveBeenCalled()
      expect(stages.report).not.toHaveBeenCalled()
    })

    it('fatal 错误通过 reporter.reportError() 输出', async () => {
      const fatalError = new AiforgeError(
        '认证失败',
        'ERR_AUTH',
        EXIT_AUTH_FAILURE,
        'fatal',
        '令牌过期',
        ['重新生成令牌'],
      )
      const stages = createTrackedStages({
        authenticate: vi.fn(async () => {
          throw fatalError
        }),
      })

      const args = createTestArgs()
      await runPipeline(args, mockReporter, stages)

      expect(mockReporter.reportError).toHaveBeenCalledOnce()
      expect(mockReporter.reportError).toHaveBeenCalledWith(fatalError)
    })

    it('fatal 错误设置 process.exitCode 为 AiforgeError.exitCode', async () => {
      const stages = createTrackedStages({
        authenticate: vi.fn(async () => {
          throw new AiforgeError('认证失败', 'ERR_AUTH', EXIT_AUTH_FAILURE, 'fatal', '令牌过期', [
            '重新生成',
          ])
        }),
      })

      const args = createTestArgs()
      await runPipeline(args, mockReporter, stages)

      expect(process.exitCode).toBe(2)
    })

    it('非 AiforgeError 异常被包装为 AiforgeError(code: ERR_UNKNOWN, severity: fatal)', async () => {
      const stages = createTrackedStages({
        detect: vi.fn(async () => {
          throw new TypeError('意外的类型错误')
        }),
      })

      const args = createTestArgs()
      await runPipeline(args, mockReporter, stages)

      expect(mockReporter.reportError).toHaveBeenCalledOnce()
      const errorArg = vi.mocked(mockReporter.reportError).mock.calls[0]![0]
      expect(errorArg).toBeInstanceOf(AiforgeError)
      expect(errorArg.code).toBe('ERR_UNKNOWN')
      expect(errorArg.severity).toBe('fatal')
      expect(errorArg.message).toBe('意外的类型错误')
    })

    it('非 Error 异常（字符串/数值）也被正确包装', async () => {
      const stages = createTrackedStages({
        resolve: vi.fn(async () => {
          throw '字符串错误'
        }),
      })

      const args = createTestArgs()
      await runPipeline(args, mockReporter, stages)

      const errorArg = vi.mocked(mockReporter.reportError).mock.calls[0]![0]
      expect(errorArg).toBeInstanceOf(AiforgeError)
      expect(errorArg.message).toBe('字符串错误')
      expect(errorArg.code).toBe('ERR_UNKNOWN')
      expect(process.exitCode).toBe(1)
    })

    it('Install 阶段 fatal 错误时不调用 saveManifest 和 report', async () => {
      const callOrder: string[] = []
      const stages = createTrackedStages({
        install: vi.fn(async () => {
          callOrder.push('install')
          throw new AiforgeError(
            '安装失败',
            'ERR_INSTALL',
            EXIT_INSTALL_FAILURE,
            'fatal',
            '磁盘已满',
            ['清理磁盘空间'],
          )
        }),
      })

      const args = createTestArgs({ dryRun: false })
      await runPipeline(args, mockReporter, stages)

      expect(stages.saveManifest).not.toHaveBeenCalled()
      expect(stages.report).not.toHaveBeenCalled()
      expect(mockReporter.reportError).toHaveBeenCalledOnce()
    })
  })

  // ── AC #3: Install 后 saveManifest 持久化 ──────────────────────────────

  describe('AC #3: pipeline 层调用 saveManifest 持久化安装记录', () => {
    it('saveManifest 在 install 之后、report 之前被调用', async () => {
      const stages = createTrackedStages()
      const args = createTestArgs({ dryRun: false })

      await runPipeline(args, mockReporter, stages)

      const installIdx = stages.callOrder.indexOf('install')
      const saveIdx = stages.callOrder.indexOf('saveManifest')
      const reportIdx = stages.callOrder.indexOf('report')

      expect(saveIdx).toBeGreaterThan(installIdx)
      expect(saveIdx).toBeLessThan(reportIdx)
    })

    it('saveManifest 接收 install 的返回结果', async () => {
      const stages = createTrackedStages()
      const args = createTestArgs({ dryRun: false })

      await runPipeline(args, mockReporter, stages)

      expect(stages.saveManifest).toHaveBeenCalledWith(mockResult)
    })

    it('report 使用 install 的返回结果（不受 saveManifest 影响）', async () => {
      const stages = createTrackedStages()
      const args = createTestArgs({ dryRun: false })

      await runPipeline(args, mockReporter, stages)

      expect(stages.report).toHaveBeenCalledWith(mockResult, mockReporter, 'result')
    })
  })

  // ── dry-run 路径 ──────────────────────────────────────────────────────

  describe('dry-run 路径', () => {
    it('dryRun 模式跳过 install、saveManifest，执行 report(plan)', async () => {
      const stages = createTrackedStages()
      const args = createTestArgs({ dryRun: true })

      await runPipeline(args, mockReporter, stages)

      expect(stages.callOrder).toEqual([
        'resolve',
        'authenticate',
        'clone',
        'detect',
        'match',
        'report',
      ])
      expect(stages.callOrder).not.toContain('install')
      expect(stages.callOrder).not.toContain('saveManifest')
      expect(stages.report).toHaveBeenCalledWith(mockPlan, mockReporter, 'plan')
    })
  })
})

// ── Story 5.5b: 真实安装流程 E2E 测试 ───────────────────────────────────────
// 使用 createProductionStages 真实闭包链，Mock Git 克隆，使用 fixture 仓库
// 覆盖 AC #1: 按 BUILTIN_RULES 真实规则矩阵验证安装结果
// 覆盖 AC #6: macOS 环境通过
// (orchestration-only 描述块已在上面。此块使用真实闭包路径)

import { mkdtemp, mkdir, readFile, rm, access as fsAccess } from 'node:fs/promises'
import { join as pathJoin } from 'node:path'
import { tmpdir as osTmpdir } from 'node:os'
import type { PathResolver } from '../../src/core/path-resolver.js'
import { createProductionStages } from '../../src/pipeline.js'
import { BUILTIN_RULES, UNIVERSAL_RULES } from '../../src/data/install-rules.js'

// Mock 网络层阶段，避免真实 Git 操作
vi.mock('../../src/stages/resolve-source.js', () => ({
  resolveSource: vi.fn(async () => ({
    hostname: 'gitlab.example.com',
    repoPath: 'org/knowledge-repo',
    protocol: 'https' as const,
  })),
}))

vi.mock('../../src/stages/authenticate.js', () => ({
  authenticate: vi.fn(async () => ({
    hostname: 'gitlab.example.com',
    repoPath: 'org/knowledge-repo',
    protocol: 'https' as const,
    authMethod: 'token' as const,
    cloneUrl: 'https://gitlab.example.com/org/knowledge-repo.git',
  })),
}))

// vi.hoisted 确保在 vi.mock 工厂中可引用
const e2eCloneMock = vi.hoisted(() => vi.fn())
vi.mock('../../src/stages/clone.js', () => ({
  cloneRepo: e2eCloneMock,
}))

// ── fixture 仓库路径 ────────────────────────────────────────────────────────
// 使用 tests/fixtures/sample-repo/ 静态 fixture（Task 1 创建）
import { fileURLToPath } from 'node:url'
import { dirname as pathDirname } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = pathDirname(__filename)
const FIXTURE_REPO = pathJoin(__dirname, '..', 'fixtures', 'sample-repo')

// ── 测试辅助：创建 mock PathResolver ───────────────────────────────────────

function createMockPathResolver(homeDir: string): PathResolver {
  return {
    home: () => homeDir,
    configDir: () => pathJoin(homeDir, '.aiforge'),
    reposDir: () => pathJoin(homeDir, '.aiforge', 'repos'),
    toolGlobalDir: (id: string) => pathJoin(homeDir, `.${id}`),
    toolProjectDir: (id: string) => `.${id}`,
  }
}

function createE2ETestArgs(partial: Partial<ParsedArgs> = {}): ParsedArgs {
  return {
    source: 'https://gitlab.example.com/org/knowledge-repo',
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

function createE2EMockReporter() {
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

// ── E2E 集成测试：全局安装（AC #1, #6）──────────────────────────────────────

describe('Story 5.5b AC #1: 全局安装 — 按真实 BUILTIN_RULES 验证安装结果', () => {
  let tmpDir: string
  let homeDir: string
  let mockReporter: ReturnType<typeof createE2EMockReporter>
  let mockPathResolver: PathResolver
  let originalCwd: string

  beforeEach(async () => {
    originalCwd = process.cwd()
    tmpDir = await mkdtemp(pathJoin(osTmpdir(), 'aiforge-e2e-'))
    homeDir = pathJoin(tmpDir, 'home')
    await mkdir(homeDir, { recursive: true })
    await mkdir(pathJoin(homeDir, '.aiforge'), { recursive: true })

    // 切换 cwd 到临时目录（避免项目目录检测影响）
    process.chdir(tmpDir)

    mockPathResolver = createMockPathResolver(homeDir)
    mockReporter = createE2EMockReporter()

    // Mock clone 返回 fixture 仓库
    e2eCloneMock.mockResolvedValue({
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

  it('claude 全局安装：agents(Files) 和 skills(Directories) 按规则安装到正确目标目录', async () => {
    // 使用 createProductionStages 真实闭包链（非全 mock）
    const stages = createProductionStages(mockPathResolver)

    // 手动指定 claude 工具，全局安装
    const args = createE2ETestArgs({ tools: ['claude'], global: true })

    // 执行真实阶段链
    const source = await stages.resolve(args, mockReporter)
    const authed = await stages.authenticate(source, args, mockReporter)
    const repo = await stages.clone(authed, args, mockReporter)
    const env = await stages.detect(repo, args, mockReporter)
    const plan = await stages.match(env, args, mockReporter)

    // 验证匹配到的规则与 BUILTIN_RULES 一致
    // claude:global 有 2 条规则: agents(Files) + skills(Directories)
    const claudeGlobalRules = BUILTIN_RULES.filter(
      (r) => r.tool === 'claude' && r.scope === 'global',
    )
    expect(plan.items.length).toBe(claudeGlobalRules.length)

    // 验证规则覆盖 agents 和 skills
    const sourceDirs = plan.items.map((i) => i.rule.sourceDir).sort()
    expect(sourceDirs).toContain('agents')
    expect(sourceDirs).toContain('skills')

    // 执行安装
    const result = await stages.install(plan, args, mockReporter)

    // 验证安装结果：agents 文件应被安装
    expect(result.items.some((i) => i.targetPath.includes('agents'))).toBe(true)

    // 验证实际文件存在于目标目录
    const agentTargetDir = pathJoin(homeDir, '.claude', 'agents')
    const codingAgentTarget = pathJoin(agentTargetDir, 'coding-agent.md')
    const reviewAgentTarget = pathJoin(agentTargetDir, 'review-agent.md')

    await expect(fsAccess(codingAgentTarget)).resolves.toBeUndefined()
    await expect(fsAccess(reviewAgentTarget)).resolves.toBeUndefined()

    // 验证安装状态
    const agentResults = result.items.filter((i) => i.targetPath.includes('coding-agent.md'))
    expect(agentResults[0]?.status).toBe('new')
  })

  it('claude 全局安装：skills(Directories) 安装子目录到目标目录', async () => {
    const stages = createProductionStages(mockPathResolver)
    const args = createE2ETestArgs({ tools: ['claude'], global: true })

    const source = await stages.resolve(args, mockReporter)
    const authed = await stages.authenticate(source, args, mockReporter)
    const repo = await stages.clone(authed, args, mockReporter)
    const env = await stages.detect(repo, args, mockReporter)
    const plan = await stages.match(env, args, mockReporter)
    const result = await stages.install(plan, args, mockReporter)

    // skills 目录下有 code-review/ 和 refactor/ 子目录，应被安装
    const skillTargetDir = pathJoin(homeDir, '.claude', 'skills')
    const codeReviewTarget = pathJoin(skillTargetDir, 'code-review')
    const refactorTarget = pathJoin(skillTargetDir, 'refactor')

    await expect(fsAccess(codeReviewTarget)).resolves.toBeUndefined()
    await expect(fsAccess(refactorTarget)).resolves.toBeUndefined()

    // 验证 skills 安装结果
    const skillResults = result.items.filter((i) => i.targetPath.includes('skills'))
    expect(skillResults.length).toBeGreaterThan(0)
    expect(skillResults.every((i) => i.status === 'new' || i.status === 'updated')).toBe(true)
  })

  it('项目级安装：claude agents(Files) 安装到 .claude/agents/', async () => {
    const stages = createProductionStages(mockPathResolver)
    const args = createE2ETestArgs({ tools: ['claude'], global: false })

    const source = await stages.resolve(args, mockReporter)
    const authed = await stages.authenticate(source, args, mockReporter)
    const repo = await stages.clone(authed, args, mockReporter)
    const env = await stages.detect(repo, args, mockReporter)
    const plan = await stages.match(env, args, mockReporter)
    const result = await stages.install(plan, args, mockReporter)

    // 项目级安装：目标为 process.cwd()/.claude/agents/
    const projectAgentTarget = pathJoin(tmpDir, '.claude', 'agents', 'coding-agent.md')
    await expect(fsAccess(projectAgentTarget)).resolves.toBeUndefined()

    // 全部安装结果为 new（首次安装）
    expect(result.items.filter((i) => i.status === 'new').length).toBeGreaterThan(0)
  })

  it('排除列表：README.md 和 .gitkeep 不被安装', async () => {
    const stages = createProductionStages(mockPathResolver)
    const args = createE2ETestArgs({ tools: ['claude'], global: true })

    const source = await stages.resolve(args, mockReporter)
    const authed = await stages.authenticate(source, args, mockReporter)
    const repo = await stages.clone(authed, args, mockReporter)
    const env = await stages.detect(repo, args, mockReporter)
    const plan = await stages.match(env, args, mockReporter)
    await stages.install(plan, args, mockReporter)

    // README.md 和 .gitkeep 不应出现在安装结果路径中
    const agentTargetDir = pathJoin(homeDir, '.claude', 'agents')
    const readmeTarget = pathJoin(agentTargetDir, 'README.md')
    const gitkeepTarget = pathJoin(agentTargetDir, '.gitkeep')

    await expect(fsAccess(readmeTarget)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(fsAccess(gitkeepTarget)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('saveManifest：安装后 manifest.json 包含正确的 tool/scope/mode 字段', async () => {
    // 使用 cursor 工具（skills=Flatten, agents=Files），避免 Directories 类型目录 hash 问题
    // cursor:global 规则: skills[Flatten] → ~/.cursor/rules/ (无 Directories 类型)
    const stages = createProductionStages(mockPathResolver)
    const args = createE2ETestArgs({ tools: ['cursor'], global: true })

    const source = await stages.resolve(args, mockReporter)
    const authed = await stages.authenticate(source, args, mockReporter)
    const repo = await stages.clone(authed, args, mockReporter)
    const env = await stages.detect(repo, args, mockReporter)
    const plan = await stages.match(env, args, mockReporter)
    const result = await stages.install(plan, args, mockReporter)
    await stages.saveManifest(result)

    const manifestPath = pathJoin(homeDir, '.aiforge', 'manifest.json')
    const content = await readFile(manifestPath, 'utf-8')
    const entries = JSON.parse(content) as Array<{
      tool: string
      scope: string
      mode: string
      hash: string
      source: string
      target: string
    }>

    expect(entries.length).toBeGreaterThan(0)
    for (const entry of entries) {
      expect(entry.tool).toBe('cursor')
      expect(entry.scope).toBe('global')
      expect(['copy', 'symlink', 'flatten']).toContain(entry.mode)
      expect(entry.hash).not.toBe('')
      expect(entry.source).not.toBe('')
      expect(entry.target).not.toBe('')
    }
  })

  it('saveManifest：claude:global（含 Directories 类型 skills）全链路不抛 FILE_HASH_FAILED', async () => {
    // 修复验证：Directories 类型目录路径不再调用 fileHash()，manifest 正常持久化
    const stages = createProductionStages(mockPathResolver)
    const args = createE2ETestArgs({ tools: ['claude'], global: true })

    const source = await stages.resolve(args, mockReporter)
    const authed = await stages.authenticate(source, args, mockReporter)
    const repo = await stages.clone(authed, args, mockReporter)
    const env = await stages.detect(repo, args, mockReporter)
    const plan = await stages.match(env, args, mockReporter)
    const result = await stages.install(plan, args, mockReporter)

    // 修复前此处会抛出 FILE_HASH_FAILED（对 ~/.claude/skills/code-review 目录调用 fileHash）
    await expect(stages.saveManifest(result)).resolves.not.toThrow()

    const manifestPath = pathJoin(homeDir, '.aiforge', 'manifest.json')
    const content = await readFile(manifestPath, 'utf-8')
    const entries = JSON.parse(content) as Array<{
      tool: string
      scope: string
      mode: string
      hash: string
      source: string
      target: string
    }>

    expect(entries.length).toBeGreaterThan(0)

    // Files 类型（agents）：hash 非空
    const fileEntries = entries.filter((e) => e.target.includes('/agents/'))
    expect(fileEntries.length).toBeGreaterThan(0)
    for (const entry of fileEntries) {
      expect(entry.hash).not.toBe('')
    }

    // Directories 类型（skills）：Story 6-3 后改为文件级条目，hash 为真实文件 hash（非空）
    const dirEntries = entries.filter((e) => e.target.includes('/skills/'))
    expect(dirEntries.length).toBeGreaterThan(0)
    for (const entry of dirEntries) {
      expect(entry.tool).toBe('claude')
      expect(entry.scope).toBe('global')
      expect(entry.hash).not.toBe('')
      expect(entry.source).not.toBe('')
      expect(entry.target).not.toBe('')
    }
  })
})

/**
 * Story 5.7 Task 4 — 补全 BUILTIN_RULES E2E 覆盖 (CR TODO-013)
 *
 * 目标：将 E2E 覆盖率从 ~31%（5/16）提升到 80%+
 * 新增覆盖：copilot:global, copilot:project, vscode:global, cursor:project
 *
 * 每个测试验证：
 * - match 结果中规则 toolId/scope/installType 正确
 * - install 结果中 targetPath/status 正确
 * - 实际文件被安装到正确位置
 *
 * Fixture 仓库目录：agents/, skills/, instructions/, mcp-tools/
 * PathResolver: toolGlobalDir(id) → homeDir/.{id}
 */
describe('Story 5.7 Task 4: BUILTIN_RULES E2E 覆盖扩展 (CR TODO-013)', () => {
  let tmpDir: string
  let homeDir: string
  let mockReporter: ReturnType<typeof createE2EMockReporter>
  let mockPathResolver: PathResolver
  let originalCwd: string

  beforeEach(async () => {
    originalCwd = process.cwd()
    tmpDir = await mkdtemp(pathJoin(osTmpdir(), 'aiforge-e2e-todo013-'))
    homeDir = pathJoin(tmpDir, 'home')
    await mkdir(homeDir, { recursive: true })
    await mkdir(pathJoin(homeDir, '.aiforge'), { recursive: true })

    process.chdir(tmpDir)

    mockPathResolver = createMockPathResolver(homeDir)
    mockReporter = createE2EMockReporter()

    e2eCloneMock.mockResolvedValue({
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

  // ── copilot:global ─────────────────────────────────────────────────────────

  it('copilot:global — agents(Files) 安装到 ~/.copilot/agents/', async () => {
    const stages = createProductionStages(mockPathResolver)
    const args = createE2ETestArgs({ tools: ['copilot'], global: true })

    const source = await stages.resolve(args, mockReporter)
    const authed = await stages.authenticate(source, args, mockReporter)
    const repo = await stages.clone(authed, args, mockReporter)
    const env = await stages.detect(repo, args, mockReporter)
    const plan = await stages.match(env, args, mockReporter)

    // 验证 match 结果：copilot:global 有 4 条规则
    const copilotGlobalRules = BUILTIN_RULES.filter(
      (r) => r.tool === 'copilot' && r.scope === 'global',
    )
    expect(plan.items.length).toBe(copilotGlobalRules.length)

    // 断言 agents 规则：toolId=copilot, scope=global, installType=Files
    const agentsItem = plan.items.find((i) => i.rule.sourceDir === 'agents')
    expect(agentsItem).toBeDefined()
    expect(agentsItem!.rule.tool).toBe('copilot')
    expect(agentsItem!.rule.scope).toBe('global')
    expect(agentsItem!.rule.type).toBe('Files')

    const result = await stages.install(plan, args, mockReporter)

    // 实际文件应被安装到 ~/.copilot/agents/
    const agentTargetDir = pathJoin(homeDir, '.copilot', 'agents')
    await expect(fsAccess(pathJoin(agentTargetDir, 'coding-agent.md'))).resolves.toBeUndefined()
    await expect(fsAccess(pathJoin(agentTargetDir, 'review-agent.md'))).resolves.toBeUndefined()

    const agentResults = result.items.filter((i) => i.targetPath.includes('coding-agent'))
    expect(agentResults[0]?.status).toBe('new')
  })

  it('copilot:global — skills(Directories) 安装到 ~/.copilot/skills/', async () => {
    const stages = createProductionStages(mockPathResolver)
    const args = createE2ETestArgs({ tools: ['copilot'], global: true })

    const source = await stages.resolve(args, mockReporter)
    const authed = await stages.authenticate(source, args, mockReporter)
    const repo = await stages.clone(authed, args, mockReporter)
    const env = await stages.detect(repo, args, mockReporter)
    const plan = await stages.match(env, args, mockReporter)
    const result = await stages.install(plan, args, mockReporter)

    // skills(Directories) 安装：子目录 code-review/ 和 refactor/ 应存在
    const skillsTargetDir = pathJoin(homeDir, '.copilot', 'skills')
    await expect(fsAccess(pathJoin(skillsTargetDir, 'code-review'))).resolves.toBeUndefined()
    await expect(fsAccess(pathJoin(skillsTargetDir, 'refactor'))).resolves.toBeUndefined()

    // 断言 skills 规则类型
    const skillsItem = plan.items.find((i) => i.rule.sourceDir === 'skills')
    expect(skillsItem!.rule.type).toBe('Directories')
    expect(skillsItem!.rule.scope).toBe('global')

    const skillResults = result.items.filter((i) => i.targetPath.includes('skills'))
    expect(skillResults.length).toBeGreaterThan(0)
    expect(skillResults.every((i) => i.status === 'new' || i.status === 'updated')).toBe(true)
  })

  it('copilot:global — instructions(Files) 安装到 ~/.copilot/', async () => {
    const stages = createProductionStages(mockPathResolver)
    const args = createE2ETestArgs({ tools: ['copilot'], global: true })

    const source = await stages.resolve(args, mockReporter)
    const authed = await stages.authenticate(source, args, mockReporter)
    const repo = await stages.clone(authed, args, mockReporter)
    const env = await stages.detect(repo, args, mockReporter)
    const plan = await stages.match(env, args, mockReporter)
    const result = await stages.install(plan, args, mockReporter)

    // instructions(Files) 安装：AGENTS.md 应被安装到 ~/.copilot/
    const instructionsTarget = pathJoin(homeDir, '.copilot', 'AGENTS.md')
    await expect(fsAccess(instructionsTarget)).resolves.toBeUndefined()

    const instrItem = plan.items.find((i) => i.rule.sourceDir === 'instructions')
    expect(instrItem!.rule.tool).toBe('copilot')
    expect(instrItem!.rule.type).toBe('Files')

    const instrResults = result.items.filter((i) => i.sourcePath.includes('instructions'))
    expect(instrResults.length).toBeGreaterThan(0)
    expect(instrResults[0]?.status).toBe('new')
  })

  it('copilot:global — mcp-tools(Files) 安装到 ~/.copilot/', async () => {
    const stages = createProductionStages(mockPathResolver)
    const args = createE2ETestArgs({ tools: ['copilot'], global: true })

    const source = await stages.resolve(args, mockReporter)
    const authed = await stages.authenticate(source, args, mockReporter)
    const repo = await stages.clone(authed, args, mockReporter)
    const env = await stages.detect(repo, args, mockReporter)
    const plan = await stages.match(env, args, mockReporter)
    const result = await stages.install(plan, args, mockReporter)

    // mcp-tools(Files) 安装：server.json 应被安装到 ~/.copilot/
    const mcpTarget = pathJoin(homeDir, '.copilot', 'server.json')
    await expect(fsAccess(mcpTarget)).resolves.toBeUndefined()

    const mcpItem = plan.items.find((i) => i.rule.sourceDir === 'mcp-tools')
    expect(mcpItem!.rule.tool).toBe('copilot')
    expect(mcpItem!.rule.type).toBe('Files')

    const mcpResults = result.items.filter((i) => i.sourcePath.includes('mcp-tools'))
    expect(mcpResults.length).toBeGreaterThan(0)
    expect(mcpResults[0]?.status).toBe('new')
  })

  // ── copilot:project ────────────────────────────────────────────────────────

  it('copilot:project — agents(Files) 安装到 .github/agents/', async () => {
    const stages = createProductionStages(mockPathResolver)
    const args = createE2ETestArgs({ tools: ['copilot'], global: false })

    const source = await stages.resolve(args, mockReporter)
    const authed = await stages.authenticate(source, args, mockReporter)
    const repo = await stages.clone(authed, args, mockReporter)
    const env = await stages.detect(repo, args, mockReporter)
    const plan = await stages.match(env, args, mockReporter)

    // 断言规则：copilot:project agents 规则类型
    const agentsItem = plan.items.find(
      (i) => i.rule.sourceDir === 'agents' && i.rule.scope === 'project',
    )
    expect(agentsItem!.rule.tool).toBe('copilot')
    expect(agentsItem!.rule.scope).toBe('project')
    expect(agentsItem!.rule.type).toBe('Files')

    const result = await stages.install(plan, args, mockReporter)

    // 项目级安装：目标为 process.cwd()/.github/agents/
    const agentTarget = pathJoin(tmpDir, '.github', 'agents', 'coding-agent.md')
    await expect(fsAccess(agentTarget)).resolves.toBeUndefined()

    const agentResults = result.items.filter((i) => i.targetPath.includes('coding-agent'))
    expect(agentResults[0]?.status).toBe('new')
  })

  it('copilot:project — skills(Directories) + instructions(Files) + mcp-tools(Files) 全链路安装', async () => {
    const stages = createProductionStages(mockPathResolver)
    const args = createE2ETestArgs({ tools: ['copilot'], global: false })

    const source = await stages.resolve(args, mockReporter)
    const authed = await stages.authenticate(source, args, mockReporter)
    const repo = await stages.clone(authed, args, mockReporter)
    const env = await stages.detect(repo, args, mockReporter)
    const plan = await stages.match(env, args, mockReporter)

    // copilot:project 全部规则均应匹配
    const copilotProjectRules = BUILTIN_RULES.filter(
      (r) => r.tool === 'copilot' && r.scope === 'project',
    )
    expect(plan.items.length).toBe(copilotProjectRules.length + UNIVERSAL_RULES.length)

    const result = await stages.install(plan, args, mockReporter)

    // skills(Directories) → .github/skills/code-review
    const skillsTarget = pathJoin(tmpDir, '.github', 'skills', 'code-review')
    await expect(fsAccess(skillsTarget)).resolves.toBeUndefined()

    // instructions(Files) → .github/AGENTS.md
    const instrTarget = pathJoin(tmpDir, '.github', 'AGENTS.md')
    await expect(fsAccess(instrTarget)).resolves.toBeUndefined()

    // mcp-tools(Files) → .github/server.json
    const mcpTarget = pathJoin(tmpDir, '.github', 'server.json')
    await expect(fsAccess(mcpTarget)).resolves.toBeUndefined()

    // v2.0 AC #2: mcp-tools 同时写入 .vscode/（copilot project 规则双目标路径）
    const vscodeMcpTarget = pathJoin(tmpDir, '.vscode', 'server.json')
    await expect(fsAccess(vscodeMcpTarget)).resolves.toBeUndefined()

    expect(result.items.filter((i) => i.status === 'new').length).toBeGreaterThan(0)
  })

  // ── auggie:project (Story 7-3) ────────────────────────────────────────────

  it('auggie:project — skills(Directories) + agents(Files) + instructions(Files) 全链路安装', async () => {
    const stages = createProductionStages(mockPathResolver)
    const args = createE2ETestArgs({ tools: ['auggie'], global: false })

    const source = await stages.resolve(args, mockReporter)
    const authed = await stages.authenticate(source, args, mockReporter)
    const repo = await stages.clone(authed, args, mockReporter)
    const env = await stages.detect(repo, args, mockReporter)
    const plan = await stages.match(env, args, mockReporter)

    const auggieProjectRules = BUILTIN_RULES.filter(
      (r) => r.tool === 'auggie' && r.scope === 'project',
    )
    expect(plan.items.length).toBe(auggieProjectRules.length + UNIVERSAL_RULES.length)

    const instructionsItem = plan.items.find((i) => i.rule.sourceDir === 'instructions')
    expect(instructionsItem!.rule.tool).toBe('auggie')
    expect(instructionsItem!.rule.type).toBe('Files')
    expect(instructionsItem!.rule.targetDir).toBe('./')
    expect(instructionsItem!.sourceFiles).toHaveLength(1)
    expect(instructionsItem!.sourceFiles[0]).toContain('AGENTS.md')
    expect(instructionsItem!.sourceFiles.some((f) => f.includes('CLAUDE.md'))).toBe(false)

    const result = await stages.install(plan, args, mockReporter)

    const skillsTarget = pathJoin(tmpDir, '.augment', 'skills', 'code-review')
    await expect(fsAccess(skillsTarget)).resolves.toBeUndefined()

    const agentTarget = pathJoin(tmpDir, '.augment', 'agents', 'coding-agent.md')
    await expect(fsAccess(agentTarget)).resolves.toBeUndefined()

    const instructionsTarget = pathJoin(tmpDir, 'AGENTS.md')
    await expect(fsAccess(instructionsTarget)).resolves.toBeUndefined()

    const claudeInstructionsTarget = pathJoin(tmpDir, 'CLAUDE.md')
    await expect(fsAccess(claudeInstructionsTarget)).rejects.toThrow()

    const auggieResults = result.items.filter((i) => i.tool === 'auggie')
    expect(auggieResults.length).toBeGreaterThan(0)
    expect(auggieResults.every((i) => i.status === 'new' || i.status === 'updated')).toBe(true)
  })

  // ── vscode:global (v2.0: removed, VS Code merged into Copilot context) ───────
  // 原 vscode:global mcp-tools 测试已在 v2.0 移除；
  // copilot:project mcp-tools → .vscode/ 端到端集成测试已在本 it block 上方验证（AC #2 闭合）
  // Story 7-10 将补充更完整的多工具矩阵集成测试（cr-todo-backlog: AC#2-.vscode/-e2e-story-7-10）

  // ── cursor:project ─────────────────────────────────────────────────────────

  it('cursor:project — skills(Flatten) 安装到 .cursor/rules/', async () => {
    const stages = createProductionStages(mockPathResolver)
    const args = createE2ETestArgs({ tools: ['cursor'], global: false })

    const source = await stages.resolve(args, mockReporter)
    const authed = await stages.authenticate(source, args, mockReporter)
    const repo = await stages.clone(authed, args, mockReporter)
    const env = await stages.detect(repo, args, mockReporter)
    const plan = await stages.match(env, args, mockReporter)

    // cursor:project 有 2 条规则: skills(Flatten), agents(Files)
    const cursorProjectRules = BUILTIN_RULES.filter(
      (r) => r.tool === 'cursor' && r.scope === 'project',
    )
    expect(plan.items.length).toBe(cursorProjectRules.length + UNIVERSAL_RULES.length)

    // Flatten 规则
    const flattenItem = plan.items.find((i) => i.rule.type === 'Flatten')
    expect(flattenItem!.rule.tool).toBe('cursor')
    expect(flattenItem!.rule.scope).toBe('project')
    expect(flattenItem!.rule.sourceDir).toBe('skills')

    const result = await stages.install(plan, args, mockReporter)

    // skills/Flatten：子目录内文件展开安装到 .cursor/rules/（Flatten 展开语义）
    // code-review/index.md, code-review/examples.md, refactor/index.md → .cursor/rules/
    const rulesDir = pathJoin(tmpDir, '.cursor', 'rules')
    await expect(fsAccess(rulesDir)).resolves.toBeUndefined()

    const flattenResults = result.items.filter((i) => i.targetPath.includes('.cursor/rules'))
    expect(flattenResults.length).toBeGreaterThan(0)
    expect(flattenResults.every((i) => i.status === 'new' || i.status === 'updated')).toBe(true)
  })

  it('cursor:project — agents(Files) 安装到 .cursor/rules/', async () => {
    const stages = createProductionStages(mockPathResolver)
    const args = createE2ETestArgs({ tools: ['cursor'], global: false })

    const source = await stages.resolve(args, mockReporter)
    const authed = await stages.authenticate(source, args, mockReporter)
    const repo = await stages.clone(authed, args, mockReporter)
    const env = await stages.detect(repo, args, mockReporter)
    const plan = await stages.match(env, args, mockReporter)
    const result = await stages.install(plan, args, mockReporter)

    // agents(Files) → .cursor/rules/
    const agentsItem = plan.items.find(
      (i) => i.rule.sourceDir === 'agents' && i.rule.scope === 'project',
    )
    expect(agentsItem!.rule.tool).toBe('cursor')
    expect(agentsItem!.rule.type).toBe('Files')

    const agentTarget = pathJoin(tmpDir, '.cursor', 'rules', 'coding-agent.md')
    await expect(fsAccess(agentTarget)).resolves.toBeUndefined()

    const agentResults = result.items.filter((i) => i.targetPath.includes('coding-agent'))
    expect(agentResults[0]?.status).toBe('new')
  })
})
