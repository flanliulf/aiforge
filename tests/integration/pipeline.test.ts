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
    },
    {
      status: 'updated',
      sourcePath: '/tmp/test-repo/agents/old.md',
      targetPath: '/home/user/.claude/old.md',
    },
    {
      status: 'skipped',
      sourcePath: '/tmp/test-repo/agents/same.md',
      targetPath: '/home/user/.claude/same.md',
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
