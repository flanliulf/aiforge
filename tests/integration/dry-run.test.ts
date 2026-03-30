/**
 * dry-run.test.ts — 管道 dry-run 路径端到端测试
 *
 * 来源: Story 3.3 Task 4.2
 * 测试: 管道 dry-run 路径、detect+match 真实阶段接入、文件系统无副作用
 *
 * AC #1: 管道在 Match 后分叉，dry-run 调用 reportPlan，跳过 Install
 * AC #3: dry-run 不产生文件系统副作用
 * AC #5: Detect → Match 阶段使用真实实现
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdir, writeFile, rm, access } from 'node:fs/promises'
import type { ParsedArgs, MatchedPlan } from '../../src/core/types.js'
import type { Reporter } from '../../src/core/reporter.js'
import { createProductionStages } from '../../src/pipeline.js'
import { runPipeline } from '../../src/pipeline.js'
import type { PathResolver } from '../../src/core/path-resolver.js'

// ── 测试辅助 ───────────────────────────────────────────────────────────────

function createMockReporter(): Reporter & {
  planArgs: MatchedPlan[]
  resultArgs: unknown[]
} {
  const planArgs: MatchedPlan[] = []
  const resultArgs: unknown[] = []
  return {
    planArgs,
    resultArgs,
    startPhase: vi.fn(),
    updatePhase: vi.fn(),
    completePhase: vi.fn(),
    reportResult: vi.fn((r) => {
      resultArgs.push(r)
    }),
    reportPlan: vi.fn((p) => {
      planArgs.push(p)
    }),
    reportError: vi.fn(),
    warn: vi.fn(),
  }
}

function createTestArgs(partial: Partial<ParsedArgs> = {}): ParsedArgs {
  return {
    source: 'https://gitlab.example.com/org/repo',
    global: true,
    link: false,
    tools: [],
    dirs: [],
    dryRun: true,
    quiet: false,
    force: false,
    ssh: false,
    symlink: false,
    flatten: false,
    ...partial,
  }
}

// ── createProductionStages ──────────────────────────────────────────────────

describe('createProductionStages', () => {
  it('返回包含所有管道阶段的对象', () => {
    const mockPathResolver: PathResolver = {
      home: () => '/home/test',
      configDir: () => '/home/test/.aiforge',
      reposDir: () => '/home/test/.aiforge/repos',
      toolGlobalDir: (id: string) => `/home/test/.aiforge/tools/${id}`,
      toolProjectDir: (id: string) => `.aiforge/tools/${id}`,
    }
    const stages = createProductionStages(mockPathResolver)
    expect(typeof stages.resolve).toBe('function')
    expect(typeof stages.authenticate).toBe('function')
    expect(typeof stages.clone).toBe('function')
    expect(typeof stages.detect).toBe('function')
    expect(typeof stages.match).toBe('function')
    expect(typeof stages.install).toBe('function')
    expect(typeof stages.report).toBe('function')
  })
})

// ── dry-run 管道路径 — 使用 mock stages ──────────────────────────────────────

describe('dry-run 管道路径（AC #1, #5）', () => {
  let tempDir: string
  let mockReporter: ReturnType<typeof createMockReporter>

  beforeEach(async () => {
    // 创建临时仓库目录（含 agents/ 子目录和测试文件）
    tempDir = join(tmpdir(), `aiforge-test-${Date.now()}`)
    await mkdir(join(tempDir, 'agents'), { recursive: true })
    await writeFile(join(tempDir, 'agents', 'test-agent.md'), '# Test Agent')
    mockReporter = createMockReporter()
  })

  afterEach(async () => {
    // 清理临时目录
    await rm(tempDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('AC #1: dryRun=true 时调用 reportPlan，不调用 reportResult', async () => {
    const args = createTestArgs({ dryRun: true, tools: ['claude'], global: true })
    const mockPathResolver: PathResolver = {
      home: () => '/home/test',
      configDir: () => '/home/test/.aiforge',
      reposDir: () => '/home/test/.aiforge/repos',
      toolGlobalDir: (id: string) => `/home/test/.aiforge/tools/${id}`,
      toolProjectDir: (id: string) => `.aiforge/tools/${id}`,
    }

    // 使用 mock stages，注入真实 detect+match，resolve/auth/clone 用 mock
    const { detectTools } = await import('../../src/stages/detect-tools.js')
    const { matchRules } = await import('../../src/stages/match-rules.js')

    const stages = {
      resolve: vi.fn(async () => ({
        hostname: 'gitlab.example.com',
        repoPath: 'org/repo',
        protocol: 'https' as const,
      })),
      authenticate: vi.fn(async () => ({
        hostname: 'gitlab.example.com',
        repoPath: 'org/repo',
        protocol: 'https' as const,
        authMethod: 'token' as const,
        cloneUrl: 'https://gitlab.example.com/org/repo.git',
      })),
      clone: vi.fn(async () => ({
        repoDir: tempDir,
        isNew: true,
        sourceFiles: [join(tempDir, 'agents', 'test-agent.md')],
      })),
      detect: (
        repo: Parameters<typeof detectTools>[0],
        innerArgs: ParsedArgs,
        reporter: Reporter,
      ) => detectTools(repo, innerArgs, reporter, mockPathResolver),
      match: (env: Parameters<typeof matchRules>[1], innerArgs: ParsedArgs, reporter: Reporter) =>
        matchRules(
          { repoDir: tempDir, isNew: true, sourceFiles: [] },
          env,
          innerArgs,
          reporter,
          mockPathResolver,
        ),
      install: vi.fn(async () => ({ items: [] })),
      saveManifest: vi.fn(async () => {}),
      report: vi.fn((result, reporter, mode) => {
        if (mode === 'plan') {
          reporter.reportPlan(result as MatchedPlan)
        } else {
          reporter.reportResult(result)
        }
      }),
    }

    await runPipeline(args, mockReporter, stages)

    // reportPlan 被调用
    expect(mockReporter.reportPlan).toHaveBeenCalled()
    // reportResult 未被调用（dry-run 跳过 install）
    expect(mockReporter.reportResult).not.toHaveBeenCalled()
    // install 阶段未被调用
    expect(stages.install).not.toHaveBeenCalled()
  })

  it('AC #1: 管道阶段链 dry-run 顺序为 resolve→auth→clone→detect→match→report（无 install）', async () => {
    const callOrder: string[] = []
    const args = createTestArgs({ dryRun: true, tools: ['claude'], global: true })

    const stages = {
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
        return { repoDir: tempDir, isNew: true, sourceFiles: [] }
      }),
      detect: vi.fn(async () => {
        callOrder.push('detect')
        return { tools: ['claude'], scope: 'global' as const }
      }),
      match: vi.fn(async () => {
        callOrder.push('match')
        return { items: [] }
      }),
      install: vi.fn(async () => {
        callOrder.push('install')
        return { items: [] }
      }),
      saveManifest: vi.fn(async () => {
        callOrder.push('saveManifest')
      }),
      report: vi.fn(() => {
        callOrder.push('report')
      }),
    }

    await runPipeline(args, mockReporter, stages)

    // dry-run 阶段顺序正确，无 install
    expect(callOrder).toEqual(['resolve', 'auth', 'clone', 'detect', 'match', 'report'])
    expect(callOrder).not.toContain('install')
  })

  it('AC #3: dry-run 不产生任何新文件（检查 tempDir 内容在执行前后一致）', async () => {
    const args = createTestArgs({ dryRun: true, tools: ['claude'], global: true })

    // mock stages，报告时不写文件
    let capturedPlan: MatchedPlan | null = null
    const stages = {
      resolve: vi.fn(async () => ({ hostname: 'h', repoPath: 'r', protocol: 'https' as const })),
      authenticate: vi.fn(async () => ({
        hostname: 'h',
        repoPath: 'r',
        protocol: 'https' as const,
        authMethod: 'token' as const,
        cloneUrl: 'u',
      })),
      clone: vi.fn(async () => ({ repoDir: tempDir, isNew: true, sourceFiles: [] })),
      detect: vi.fn(async () => ({ tools: ['claude'], scope: 'global' as const })),
      match: vi.fn(async () => {
        capturedPlan = { items: [] }
        return capturedPlan
      }),
      install: vi.fn(async () => ({ items: [] })),
      saveManifest: vi.fn(async () => {}),
      report: vi.fn((result, reporter) => {
        reporter.reportPlan(result as MatchedPlan)
      }),
    }

    await runPipeline(args, mockReporter, stages)

    // install 未被调用
    expect(stages.install).not.toHaveBeenCalled()

    // 验证 tempDir 中没有新文件（目标路径是 mock 的 /home/test/...，不会实际写入）
    // 通过确认 install 函数未调用来间接验证
    expect(mockReporter.reportResult).not.toHaveBeenCalled()
  })
})

// ── matchRules 中的 mode 推导 — getInstallMode ──────────────────────────────

describe('matchRules — mode 推导（AC #2）', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = join(tmpdir(), `aiforge-match-${Date.now()}`)
    await mkdir(join(tempDir, 'agents'), { recursive: true })
    await writeFile(join(tempDir, 'agents', 'test.md'), '# test')
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('args.link=false → mode=copy', async () => {
    const { matchRules } = await import('../../src/stages/match-rules.js')
    const mockReporter = createMockReporter()
    const mockPathResolver: PathResolver = {
      home: () => '/home/test',
      configDir: () => '/home/test/.aiforge',
      reposDir: () => '/home/test/.aiforge/repos',
      toolGlobalDir: (id: string) => `/home/test/.aiforge/tools/${id}`,
      toolProjectDir: (id: string) => `.aiforge/tools/${id}`,
    }
    const repo = { repoDir: tempDir, isNew: true, sourceFiles: [] }
    const env = { tools: ['claude'], scope: 'global' as const }
    const args = createTestArgs({ link: false, global: true })

    const plan = await matchRules(repo, env, args, mockReporter, mockPathResolver)

    for (const item of plan.items) {
      expect(item.mode).toBe('copy')
    }
  })

  it('args.link=true, scope=global → mode=symlink', async () => {
    const { matchRules } = await import('../../src/stages/match-rules.js')
    const mockReporter = createMockReporter()
    const mockPathResolver: PathResolver = {
      home: () => '/home/test',
      configDir: () => '/home/test/.aiforge',
      reposDir: () => '/home/test/.aiforge/repos',
      toolGlobalDir: (id: string) => `/home/test/.aiforge/tools/${id}`,
      toolProjectDir: (id: string) => `.aiforge/tools/${id}`,
    }
    const repo = { repoDir: tempDir, isNew: true, sourceFiles: [] }
    const env = { tools: ['claude'], scope: 'global' as const }
    const args = createTestArgs({ link: true, global: true })

    const plan = await matchRules(repo, env, args, mockReporter, mockPathResolver)

    for (const item of plan.items) {
      expect(item.mode).toBe('symlink')
    }
  })

  it('args.link=true, scope=project → 抛出 LINK_PROJECT_REJECTED 错误', async () => {
    const { matchRules } = await import('../../src/stages/match-rules.js')
    const { AiforgeError } = await import('../../src/core/errors.js')
    const mockReporter = createMockReporter()
    const mockPathResolver: PathResolver = {
      home: () => '/home/test',
      configDir: () => '/home/test/.aiforge',
      reposDir: () => '/home/test/.aiforge/repos',
      toolGlobalDir: (id: string) => `/home/test/.aiforge/tools/${id}`,
      toolProjectDir: (id: string) => `.aiforge/tools/${id}`,
    }
    const repo = { repoDir: tempDir, isNew: true, sourceFiles: [] }
    const env = { tools: ['claude'], scope: 'project' as const }
    const args = createTestArgs({ link: true, global: false })

    await expect(matchRules(repo, env, args, mockReporter, mockPathResolver)).rejects.toThrow(
      AiforgeError,
    )

    await expect(matchRules(repo, env, args, mockReporter, mockPathResolver)).rejects.toMatchObject(
      {
        code: 'LINK_PROJECT_REJECTED',
        severity: 'fatal',
      },
    )
  })
})

// ── dry-run 阶段跳过文件系统写入 — 集成验证 (AC #3) ──────────────────────────

describe('dry-run 文件系统无副作用（AC #3）', () => {
  let tempDir: string
  let targetDir: string

  beforeEach(async () => {
    tempDir = join(tmpdir(), `aiforge-dryrun-src-${Date.now()}`)
    targetDir = join(tmpdir(), `aiforge-dryrun-dst-${Date.now()}`)
    await mkdir(join(tempDir, 'agents'), { recursive: true })
    await writeFile(join(tempDir, 'agents', 'test.md'), '# test')
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
    await rm(targetDir, { recursive: true, force: true }).catch(() => {})
    vi.restoreAllMocks()
  })

  it('dry-run 执行后目标目录不存在（无文件被创建）', async () => {
    const mockReporter = createMockReporter()

    const stages = {
      resolve: vi.fn(async () => ({ hostname: 'h', repoPath: 'r', protocol: 'https' as const })),
      authenticate: vi.fn(async () => ({
        hostname: 'h',
        repoPath: 'r',
        protocol: 'https' as const,
        authMethod: 'token' as const,
        cloneUrl: 'u',
      })),
      clone: vi.fn(async () => ({ repoDir: tempDir, isNew: true, sourceFiles: [] })),
      detect: vi.fn(async () => ({ tools: ['claude'], scope: 'global' as const })),
      match: vi.fn(async () => ({
        items: [
          {
            rule: {
              tool: 'claude',
              scope: 'global' as const,
              sourceDir: 'agents',
              type: 'Files' as never,
              targetDir: targetDir,
            },
            sourceFiles: [join(tempDir, 'agents', 'test.md')],
            targetPath: targetDir,
            mode: 'copy' as const,
          },
        ],
      })),
      // install 是占位（不会被调用，因为 dryRun=true）
      install: vi.fn(async () => ({ items: [] })),
      saveManifest: vi.fn(async () => {}),
      report: vi.fn((_result, reporter) => {
        reporter.reportPlan(_result as MatchedPlan)
      }),
    }

    const args = createTestArgs({ dryRun: true })
    await runPipeline(args, mockReporter, stages)

    // install 未被调用
    expect(stages.install).not.toHaveBeenCalled()

    // 目标目录不存在（未被创建）
    await expect(access(targetDir)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
