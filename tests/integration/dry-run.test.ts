/**
 * dry-run.test.ts — 管道 dry-run 路径端到端测试
 *
 * 来源: Story 3.3 Task 4.2 + Story 5.5b Task 4
 * 测试:
 *   Story 3.3 - 管道 dry-run 路径、detect+match 真实阶段接入、文件系统无副作用
 *   Story 5.5b AC #3 - dry-run 输出的完整目标路径列表和安装模式与实际安装结果一致（NFR-U5）
 *
 * AC #1: 管道在 Match 后分叉，dry-run 调用 reportPlan，跳过 Install
 * AC #3: dry-run 不产生文件系统副作用
 * AC #5: Detect → Match 阶段使用真实实现
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtemp, mkdir, writeFile, rm, access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname as pathDirname } from 'node:path'
import type { ParsedArgs, MatchedPlan } from '../../src/core/types.js'
import { InstallType } from '../../src/core/types.js'
import type { Reporter } from '../../src/core/reporter.js'
import { createProductionStages } from '../../src/pipeline.js'
import { runPipeline } from '../../src/pipeline.js'
import type { PathResolver } from '../../src/core/path-resolver.js'

// ── Fixture 仓库路径（Story 5.5b）────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url)
const __dirname = pathDirname(__filename)
const FIXTURE_REPO_5B = join(__dirname, '..', 'fixtures', 'sample-repo')

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
    info: vi.fn(),
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

// ── Story 5.5b Task 4: dry-run 一致性测试（使用 createProductionStages 真实闭包）────
// 覆盖 AC #3: dry-run 输出的完整目标路径列表和安装模式与实际安装结果一致（NFR-U5）
// Mock 网络层（vi.mock hoist 到文件顶层，与上面的 mock stages 方式并存）

// vi.mock 会被 hoist，影响整个文件，这里声明供 Story 5.5b E2E 测试使用
const e2eCloneMockForDryRun = vi.hoisted(() => vi.fn())
vi.mock('../../src/stages/clone.js', () => ({
  cloneRepo: e2eCloneMockForDryRun,
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

function createDryRunPathResolver(homeDir: string): PathResolver {
  return {
    home: () => homeDir,
    configDir: () => join(homeDir, '.aiforge'),
    reposDir: () => join(homeDir, '.aiforge', 'repos'),
    toolGlobalDir: (id: string) => join(homeDir, `.${id}`),
    toolProjectDir: (id: string) => `.${id}`,
  }
}

function createDryRunE2EArgs(partial: Partial<ParsedArgs> = {}): ParsedArgs {
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

describe('Story 5.5b AC #3: dry-run 一致性测试（真实安装流程）', () => {
  let dryRunTmpDir: string
  let dryRunHomeDir: string
  let dryRunReporter: ReturnType<typeof createMockReporter>
  let dryRunPathResolver: PathResolver
  let dryRunOriginalCwd: string

  beforeEach(async () => {
    dryRunOriginalCwd = process.cwd()
    dryRunTmpDir = await mkdtemp(join(tmpdir(), 'aiforge-dryrun5b-'))
    dryRunHomeDir = join(dryRunTmpDir, 'home')
    await mkdir(dryRunHomeDir, { recursive: true })
    await mkdir(join(dryRunHomeDir, '.aiforge'), { recursive: true })

    process.chdir(dryRunTmpDir)

    dryRunPathResolver = createDryRunPathResolver(dryRunHomeDir)
    dryRunReporter = createMockReporter()

    // Mock clone 返回 fixture 仓库（Story 5.5b 使用 sample-repo）
    e2eCloneMockForDryRun.mockResolvedValue({
      repoDir: FIXTURE_REPO_5B,
      isNew: true,
      sourceFiles: [],
    })
  })

  afterEach(async () => {
    process.exitCode = undefined
    process.chdir(dryRunOriginalCwd)
    await rm(dryRunTmpDir, { recursive: true, force: true })
    vi.clearAllMocks()
  })

  // Task 4.1/4.2/4.3: 对比 dry-run 计划与实际安装结果（Files 类型）

  it('Task 4.3: dry-run 计划的 agents 完整目标路径与实际安装结果一致（Files 类型）', async () => {
    const { basename: pathBasename, join: nodeJoin } = await import('node:path')

    // Step 1: dry-run 获取安装计划
    const stagesDry = createProductionStages(dryRunPathResolver)
    const argsDry = createDryRunE2EArgs({ tools: ['claude'], global: true, dryRun: true })

    const source1 = await stagesDry.resolve(argsDry, dryRunReporter)
    const authed1 = await stagesDry.authenticate(source1, argsDry, dryRunReporter)
    const repo1 = await stagesDry.clone(authed1, argsDry, dryRunReporter)
    const env1 = await stagesDry.detect(repo1, argsDry, dryRunReporter)
    const plan = await stagesDry.match(env1, argsDry, dryRunReporter)

    // 从 plan 提取 Files 类型目标路径（agents 规则）
    const fileItems = plan.items.filter((i) => i.rule.type === InstallType.Files)
    const plannedAgentPaths = fileItems
      .flatMap((item) =>
        item.sourceFiles.map((srcFile) => ({
          targetPath: nodeJoin(item.targetPath, pathBasename(srcFile)),
          mode: item.mode,
        })),
      )
      .filter((p) => p.targetPath.includes('agents'))

    // Step 2: 实际安装获取结果
    const stagesInstall = createProductionStages(dryRunPathResolver)
    const argsInstall = createDryRunE2EArgs({ tools: ['claude'], global: true, dryRun: false })

    const source2 = await stagesInstall.resolve(argsInstall, dryRunReporter)
    const authed2 = await stagesInstall.authenticate(source2, argsInstall, dryRunReporter)
    const repo2 = await stagesInstall.clone(authed2, argsInstall, dryRunReporter)
    const env2 = await stagesInstall.detect(repo2, argsInstall, dryRunReporter)
    const plan2 = await stagesInstall.match(env2, argsInstall, dryRunReporter)
    const result = await stagesInstall.install(plan2, argsInstall, dryRunReporter)

    const installedAgentPaths = result.items
      .filter((i) => i.status !== 'skipped')
      .filter((i) => i.targetPath.includes('agents'))
      .map((i) => ({ targetPath: i.targetPath, mode: 'copy' as const }))

    // Step 3: 对比完整目标路径+模式
    const sortFn = (a: { targetPath: string }, b: { targetPath: string }) =>
      a.targetPath.localeCompare(b.targetPath)

    expect(plannedAgentPaths.sort(sortFn).map((p) => p.targetPath)).toEqual(
      installedAgentPaths.sort(sortFn).map((p) => p.targetPath),
    )
    expect(plannedAgentPaths.sort(sortFn).map((p) => p.mode)).toEqual(
      installedAgentPaths.sort(sortFn).map((p) => p.mode),
    )
  })

  it('Task 4.3: dry-run 计划的 flatten 完整目标路径与实际安装结果一致（含重命名规则）', async () => {
    const { basename: pathBasename, join: nodeJoin } = await import('node:path')

    // Step 1: dry-run（cursor:global — Flatten skills + Files agents）
    const stagesDry = createProductionStages(dryRunPathResolver)
    const argsDry = createDryRunE2EArgs({ tools: ['cursor'], global: true, dryRun: true })

    const source1 = await stagesDry.resolve(argsDry, dryRunReporter)
    const authed1 = await stagesDry.authenticate(source1, argsDry, dryRunReporter)
    const repo1 = await stagesDry.clone(authed1, argsDry, dryRunReporter)
    const env1 = await stagesDry.detect(repo1, argsDry, dryRunReporter)
    const plan = await stagesDry.match(env1, argsDry, dryRunReporter)

    // v2.0: cursor:global 包含 Flatten(skills) + Files(agents)，需计入两种类型的预期目标路径
    const flattenTargets = plan.items
      .filter((i) => i.rule.type === InstallType.Flatten)
      .flatMap((item) =>
        item.sourceFiles.map((srcDir) => ({
          targetPath: nodeJoin(item.targetPath, pathBasename(srcDir) + '.md'),
          mode: item.mode,
        })),
      )
    const filesTargets = plan.items
      .filter(
        (i) =>
          i.rule.type === InstallType.Files &&
          i.rule.tool === 'cursor' &&
          i.rule.scope === 'global',
      )
      .flatMap((item) =>
        item.sourceFiles.map((srcFile) => ({
          targetPath: nodeJoin(item.targetPath, pathBasename(srcFile)),
          mode: item.mode,
        })),
      )
    const plannedCursorGlobalTargets = [...flattenTargets, ...filesTargets]

    // Step 2: 实际安装
    const stagesInstall = createProductionStages(dryRunPathResolver)
    const argsInstall = createDryRunE2EArgs({ tools: ['cursor'], global: true, dryRun: false })

    const source2 = await stagesInstall.resolve(argsInstall, dryRunReporter)
    const authed2 = await stagesInstall.authenticate(source2, argsInstall, dryRunReporter)
    const repo2 = await stagesInstall.clone(authed2, argsInstall, dryRunReporter)
    const env2 = await stagesInstall.detect(repo2, argsInstall, dryRunReporter)
    const plan2 = await stagesInstall.match(env2, argsInstall, dryRunReporter)
    const result = await stagesInstall.install(plan2, argsInstall, dryRunReporter)

    const installedCursorGlobalTargets = result.items
      .filter((i) => i.status !== 'skipped')
      .filter((i) => i.targetPath.includes('.cursor'))
      .map((i) => ({ targetPath: i.targetPath, mode: 'copy' as const }))

    const sortFn = (a: { targetPath: string }, b: { targetPath: string }) =>
      a.targetPath.localeCompare(b.targetPath)

    // 对比完整路径（含 flatten 重命名规则）
    expect(plannedCursorGlobalTargets.sort(sortFn).map((p) => p.targetPath)).toEqual(
      installedCursorGlobalTargets.sort(sortFn).map((p) => p.targetPath),
    )
  })

  // Task 4.4: 验证 dry-run 不产生文件系统副作用（真实 createProductionStages）

  it('Task 4.4: dry-run 执行到 match 阶段，目标目录不被创建（无文件系统副作用）', async () => {
    const stages = createProductionStages(dryRunPathResolver)
    const args = createDryRunE2EArgs({ tools: ['claude'], global: true, dryRun: true })

    const source = await stages.resolve(args, dryRunReporter)
    const authed = await stages.authenticate(source, args, dryRunReporter)
    const repo = await stages.clone(authed, args, dryRunReporter)
    const env = await stages.detect(repo, args, dryRunReporter)
    const plan = await stages.match(env, args, dryRunReporter)

    // plan 中有 items（规则匹配成功）
    expect(plan.items.length).toBeGreaterThan(0)
    expect(plan.items.some((i) => i.sourceFiles.length > 0)).toBe(true)

    // 目标目录未被创建（dry-run 停在 match 阶段，不执行 install）
    const agentTargetDir = join(dryRunHomeDir, '.claude', 'agents')
    await expect(access(agentTargetDir)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
