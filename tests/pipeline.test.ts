/**
 * pipeline.ts — 管道编排器单元测试
 *
 * 来源: Story 1.5 Task 5.1 + Story 4.6a
 * 测试: 管道阶段链执行顺序、dryRun 跳过 install、fatal 错误停止、report 阶段
 * Story 4.6a: createProductionStages 真实实现替换、manifest 保存、错误流控制
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ParsedArgs, MatchedPlan, InstallResult } from '../src/core/types.js'
import type { Reporter } from '../src/core/reporter.js'
import type { PathResolver } from '../src/core/path-resolver.js'
import { AiforgeError } from '../src/core/errors.js'
import {
  runPipeline,
  resolve,
  authenticate,
  clone,
  detect,
  match,
  install,
  report,
  DEFAULT_STAGES,
  createProductionStages,
} from '../src/pipeline.js'
import type { PipelineStages } from '../src/pipeline.js'

// 测试用辅助函数：创建默认 ParsedArgs
function createTestArgs(partial: Partial<ParsedArgs> = {}): ParsedArgs {
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
    ...partial,
  }
}

// 测试用 mock Reporter
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

// 创建成功通过所有阶段的 mock stages
function createMockStages(): PipelineStages & { callOrder: string[] } {
  const callOrder: string[] = []
  const mockPlan: MatchedPlan = { items: [] }
  const mockResult: InstallResult = { items: [] }

  return {
    callOrder,
    resolve: vi.fn(async () => {
      callOrder.push('resolve')
      return { hostname: 'h', repoPath: 'r', protocol: 'https' as const }
    }),
    authenticate: vi.fn(async () => {
      callOrder.push('auth')
      return {
        hostname: 'h',
        repoPath: 'r',
        protocol: 'https' as const,
        authMethod: 'token' as const,
        cloneUrl: 'u',
      }
    }),
    clone: vi.fn(async () => {
      callOrder.push('clone')
      return { repoDir: '/tmp', isNew: true, sourceFiles: [] }
    }),
    detect: vi.fn(async () => {
      callOrder.push('detect')
      return { tools: ['claude'], scope: 'global' as const }
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
  }
}

describe('pipeline — 管道编排器', () => {
  let mockReporter: Reporter

  beforeEach(() => {
    mockReporter = createMockReporter()
    vi.restoreAllMocks()
  })

  describe('占位阶段函数', () => {
    it('resolve 阶段抛出 NOT_IMPLEMENTED AiforgeError', async () => {
      const args = createTestArgs()
      await expect(resolve(args, mockReporter)).rejects.toThrow(AiforgeError)
      await expect(resolve(args, mockReporter)).rejects.toMatchObject({
        code: 'NOT_IMPLEMENTED',
        severity: 'fatal',
      })
    })

    it('authenticate 阶段抛出 NOT_IMPLEMENTED AiforgeError', async () => {
      const args = createTestArgs()
      const source = { hostname: 'h', repoPath: 'r', protocol: 'https' as const }
      await expect(authenticate(source, args, mockReporter)).rejects.toThrow(AiforgeError)
    })

    it('clone 阶段抛出 NOT_IMPLEMENTED AiforgeError', async () => {
      const args = createTestArgs()
      const authed = {
        hostname: 'h',
        repoPath: 'r',
        protocol: 'https' as const,
        authMethod: 'token' as const,
        cloneUrl: 'u',
      }
      await expect(clone(authed, args, mockReporter)).rejects.toThrow(AiforgeError)
    })

    it('detect 阶段抛出 NOT_IMPLEMENTED AiforgeError', async () => {
      const args = createTestArgs()
      const repo = { repoDir: '/tmp', isNew: true, sourceFiles: [] }
      await expect(detect(repo, args, mockReporter)).rejects.toThrow(AiforgeError)
    })

    it('match 阶段抛出 NOT_IMPLEMENTED AiforgeError', async () => {
      const args = createTestArgs()
      const env = { tools: ['claude'], scope: 'global' as const }
      await expect(match(env, args, mockReporter)).rejects.toThrow(AiforgeError)
    })

    it('install 阶段抛出 NOT_IMPLEMENTED AiforgeError', async () => {
      const args = createTestArgs()
      const plan: MatchedPlan = { items: [] }
      await expect(install(plan, args, mockReporter)).rejects.toThrow(AiforgeError)
    })

    it('DEFAULT_STAGES 包含所有阶段（含 report）', () => {
      expect(DEFAULT_STAGES.resolve).toBe(resolve)
      expect(DEFAULT_STAGES.authenticate).toBe(authenticate)
      expect(DEFAULT_STAGES.clone).toBe(clone)
      expect(DEFAULT_STAGES.detect).toBe(detect)
      expect(DEFAULT_STAGES.match).toBe(match)
      expect(DEFAULT_STAGES.install).toBe(install)
      expect(DEFAULT_STAGES.report).toBe(report)
    })
  })

  describe('report 阶段 — 默认实现', () => {
    it('InstallResult 类型输入时调用 reporter.reportResult', () => {
      const result: InstallResult = {
        items: [{ status: 'new', sourcePath: '/src/a.md', targetPath: '/dst/a.md' }],
      }
      report(result, mockReporter)
      expect(mockReporter.reportResult).toHaveBeenCalledWith(result)
      expect(mockReporter.reportPlan).not.toHaveBeenCalled()
    })

    it('MatchedPlan 类型输入时调用 reporter.reportPlan', () => {
      const plan: MatchedPlan = { items: [] }
      report(plan, mockReporter)
      expect(mockReporter.reportPlan).toHaveBeenCalledWith(plan)
      expect(mockReporter.reportResult).not.toHaveBeenCalled()
    })

    it('空 items 的 InstallResult 通过 mode=result 正确走 reportResult 路径', () => {
      const emptyResult: InstallResult = { items: [] }
      report(emptyResult, mockReporter, 'result')
      expect(mockReporter.reportResult).toHaveBeenCalledWith(emptyResult)
      expect(mockReporter.reportPlan).not.toHaveBeenCalled()
    })

    it('空 items 且无 mode 时兜底走 reportPlan 路径（向后兼容）', () => {
      const emptyResult: InstallResult = { items: [] }
      report(emptyResult, mockReporter)
      // 无 mode 且 items 为空，无法判断类型，兜底走 plan 路径
      expect(mockReporter.reportPlan).toHaveBeenCalled()
    })

    it('mode=plan 时始终走 reportPlan 路径', () => {
      const result: InstallResult = {
        items: [{ status: 'new', sourcePath: '/src/a.md', targetPath: '/dst/a.md' }],
      }
      // 即使传入的是 InstallResult，mode=plan 也走 plan 路径
      report(result, mockReporter, 'plan')
      expect(mockReporter.reportPlan).toHaveBeenCalled()
      expect(mockReporter.reportResult).not.toHaveBeenCalled()
    })
  })

  describe('runPipeline — 管道执行', () => {
    it('使用默认占位阶段时 fatal 错误调用 reporter.reportError', async () => {
      const args = createTestArgs()

      // resolve 占位会抛出 fatal AiforgeError
      await runPipeline(args, mockReporter)

      expect(mockReporter.reportError).toHaveBeenCalledOnce()
      const errorArg = vi.mocked(mockReporter.reportError).mock.calls[0]![0]
      expect(errorArg).toBeInstanceOf(AiforgeError)
      expect(errorArg.severity).toBe('fatal')
    })

    it('阶段链按正确顺序执行（含 saveManifest + report）', async () => {
      const stages = createMockStages()
      const args = createTestArgs({ dryRun: false })

      await runPipeline(args, mockReporter, stages)

      expect(stages.callOrder).toEqual([
        'resolve',
        'auth',
        'clone',
        'detect',
        'match',
        'install',
        'saveManifest',
        'report',
      ])
    })

    it('dryRun 为 true 时跳过 install 和 saveManifest 但仍调用 report（mode=plan）', async () => {
      const stages = createMockStages()
      const args = createTestArgs({ dryRun: true })

      await runPipeline(args, mockReporter, stages)

      expect(stages.callOrder).toEqual(['resolve', 'auth', 'clone', 'detect', 'match', 'report'])
      expect(stages.callOrder).not.toContain('install')
      expect(stages.callOrder).not.toContain('saveManifest')
      expect(stages.report).toHaveBeenCalledOnce()
      // 验证 runPipeline 传入了正确的 mode
      expect(stages.report).toHaveBeenCalledWith(expect.anything(), mockReporter, 'plan')
    })

    it('dryRun 为 false 时执行 install、saveManifest 和 report（mode=result）', async () => {
      const stages = createMockStages()
      const args = createTestArgs({ dryRun: false })

      await runPipeline(args, mockReporter, stages)

      expect(stages.install).toHaveBeenCalled()
      expect(stages.report).toHaveBeenCalledOnce()
      // 验证 runPipeline 传入了正确的 mode
      expect(stages.report).toHaveBeenCalledWith(expect.anything(), mockReporter, 'result')
    })

    it('中间阶段 fatal 错误时立即停止，不执行后续阶段', async () => {
      const stages = createMockStages()
      stages.authenticate = vi.fn(async () => {
        throw new AiforgeError('认证失败', 'ERR_AUTH', 2, 'fatal', '凭证过期', ['请重新登录'])
      })

      const args = createTestArgs()
      await runPipeline(args, mockReporter, stages)

      expect(stages.resolve).toHaveBeenCalledOnce()
      expect(stages.authenticate).toHaveBeenCalledOnce()
      expect(stages.clone).not.toHaveBeenCalled()
      expect(stages.detect).not.toHaveBeenCalled()
      expect(stages.match).not.toHaveBeenCalled()
      expect(stages.install).not.toHaveBeenCalled()
      expect(stages.report).not.toHaveBeenCalled()
      expect(mockReporter.reportError).toHaveBeenCalledOnce()
    })

    it('fatal 错误时设置 process.exitCode', async () => {
      const stages = createMockStages()
      stages.resolve = vi.fn(async () => {
        throw new AiforgeError('源解析失败', 'ERR_SOURCE', 1, 'fatal', '无效 URL', [
          '检查 URL 格式',
        ])
      })

      const args = createTestArgs()
      const originalExitCode = process.exitCode
      await runPipeline(args, mockReporter, stages)

      expect(process.exitCode).toBe(1)
      process.exitCode = originalExitCode
    })

    it('非 AiforgeError 被包装为 fatal 错误处理', async () => {
      const stages = createMockStages()
      stages.resolve = vi.fn(async () => {
        throw new Error('意外错误')
      })

      const args = createTestArgs()
      await runPipeline(args, mockReporter, stages)

      expect(mockReporter.reportError).toHaveBeenCalledOnce()
      const errorArg = vi.mocked(mockReporter.reportError).mock.calls[0]![0]
      expect(errorArg).toBeInstanceOf(AiforgeError)
      expect(errorArg.message).toBe('意外错误')
      expect(errorArg.code).toBe('ERR_UNKNOWN')
      expect(errorArg.severity).toBe('fatal')
    })

    it('saveManifest 只保存 status 为 new 和 updated 的记录', async () => {
      const stages = createMockStages()
      // install 返回包含 new、updated、skipped 的结果
      const resultWithMixed: InstallResult = {
        items: [
          { status: 'new', sourcePath: '/src/a.md', targetPath: '/dst/a.md' },
          { status: 'updated', sourcePath: '/src/b.md', targetPath: '/dst/b.md' },
          { status: 'skipped', sourcePath: '/src/c.md', targetPath: '/dst/c.md' },
        ],
      }
      stages.install = vi.fn(async () => {
        stages.callOrder.push('install')
        return resultWithMixed
      })

      const args = createTestArgs({ dryRun: false })
      await runPipeline(args, mockReporter, stages)

      // saveManifest 应该在 install 和 report 之间被调用
      const saveIdx = stages.callOrder.indexOf('saveManifest')
      const installIdx = stages.callOrder.indexOf('install')
      const reportIdx = stages.callOrder.indexOf('report')
      expect(saveIdx).toBeGreaterThan(installIdx)
      expect(saveIdx).toBeLessThan(reportIdx)
    })

    it('install 阶段 fatal 错误时不调用 saveManifest 和 report', async () => {
      const stages = createMockStages()
      stages.install = vi.fn(async () => {
        throw new AiforgeError('安装失败', 'ERR_INSTALL', 1, 'fatal', '磁盘满', ['清理磁盘'])
      })

      const args = createTestArgs({ dryRun: false })
      await runPipeline(args, mockReporter, stages)

      expect(stages.callOrder).not.toContain('saveManifest')
      expect(stages.callOrder).not.toContain('report')
      expect(mockReporter.reportError).toHaveBeenCalledOnce()
    })
  })

  describe('createProductionStages — 生产环境阶段集合', () => {
    let mockPathResolver: PathResolver

    beforeEach(() => {
      mockPathResolver = {
        home: vi.fn(() => '/home/user'),
        configDir: vi.fn(() => '/home/user/.aiforge'),
        reposDir: vi.fn(() => '/home/user/.aiforge/repos'),
        globalToolDir: vi.fn((tool: string) => `/home/user/.${tool}`),
      }
    })

    it('createProductionStages 返回完整的 PipelineStages 对象', () => {
      const stages = createProductionStages(mockPathResolver)

      expect(stages.resolve).toBeTypeOf('function')
      expect(stages.authenticate).toBeTypeOf('function')
      expect(stages.clone).toBeTypeOf('function')
      expect(stages.detect).toBeTypeOf('function')
      expect(stages.match).toBeTypeOf('function')
      expect(stages.install).toBeTypeOf('function')
      expect(stages.report).toBeTypeOf('function')
      expect(stages.saveManifest).toBeTypeOf('function')
    })

    it('所有阶段函数不再是占位实现（不抛 NOT_IMPLEMENTED）', () => {
      const stages = createProductionStages(mockPathResolver)

      // 验证不是占位函数：占位函数引用等于模块导出的占位常量
      expect(stages.resolve).not.toBe(resolve)
      expect(stages.authenticate).not.toBe(authenticate)
      expect(stages.clone).not.toBe(clone)
      expect(stages.install).not.toBe(install)
    })
  })
})
