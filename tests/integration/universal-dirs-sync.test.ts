/**
 * universal-dirs-sync.test.ts — 通用目录增量同步集成测试
 *
 * 来源: Story 6-3 AC #1 #3
 * 测试:
 *   AC #1: 默认安装时在 .agents/ 和 .agent/ 写入 skills/agents 内容
 *   AC #3: 二次安装无变更时文件 status 全为 skipped（增量同步）
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, access as fsAccess } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import type { ParsedArgs } from '../../src/core/types.js'
import type { Reporter } from '../../src/core/reporter.js'
import type { PathResolver } from '../../src/core/path-resolver.js'
import { createProductionStages } from '../../src/pipeline.js'

// ── Fixture 仓库路径 ─────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const FIXTURE_REPO = join(__dirname, '..', 'fixtures', 'sample-repo')

// ── Mock 网络层阶段，避免真实 Git 操作 ──────────────────────────────────────

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

const cloneMock = vi.hoisted(() => vi.fn())
vi.mock('../../src/stages/clone.js', () => ({
  cloneRepo: cloneMock,
}))

// ── 辅助函数 ─────────────────────────────────────────────────────────────────

function createMockPathResolver(homeDir: string): PathResolver {
  return {
    home: () => homeDir,
    configDir: () => join(homeDir, '.aiforge'),
    reposDir: () => join(homeDir, '.aiforge', 'repos'),
    toolGlobalDir: (id: string) => join(homeDir, `.${id}`),
    toolProjectDir: () => '.',
  }
}

function createTestArgs(partial: Partial<ParsedArgs>): ParsedArgs {
  return {
    source: 'https://gitlab.example.com/org/repo',
    global: false,
    link: false,
    tools: ['claude'],
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

// ── 测试 ──────────────────────────────────────────────────────────────────────

describe('Story 6-3: 通用目录默认安装 E2E 集成测试', () => {
  let tmpDir: string
  let reporter: Reporter
  let pathResolver: PathResolver
  let originalCwd: string

  beforeEach(async () => {
    originalCwd = process.cwd()
    tmpDir = await mkdtemp(join(tmpdir(), 'aiforge-universal-dirs-'))
    reporter = createMockReporter()
    pathResolver = createMockPathResolver(tmpDir)

    // 切换 cwd 到临时目录，避免 project scope 路径写入真实项目目录
    process.chdir(tmpDir)

    cloneMock.mockImplementation(async () => ({
      repoDir: FIXTURE_REPO,
      isNew: true,
      sourceFiles: [],
    }))
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('AC #1 project scope 默认安装时在 .agents/ 和 .agent/ 写入 skills/agents 内容', async () => {
    const stages = createProductionStages(pathResolver)
    const args = createTestArgs({ tools: ['claude'], global: false, noUniversal: false })

    const source = await stages.resolve(args, reporter)
    const authed = await stages.authenticate(source, args, reporter)
    const repo = await stages.clone(authed, args, reporter)
    const env = await stages.detect(repo, args, reporter)
    const plan = await stages.match(env, args, reporter)

    // 确认 universal items 在 plan 中
    const universalItems = plan.items.filter((i) => i.rule.tool === 'universal')
    expect(universalItems.length).toBeGreaterThan(0)

    const result = await stages.install(plan, args, reporter)

    // .agents/agents/ 应有来自 agents/ 的文件（cwd 已切换到 tmpDir）
    const agentsTarget = join(process.cwd(), '.agents', 'agents')
    await expect(fsAccess(agentsTarget)).resolves.toBeUndefined()

    // .agent/agents/ 应有来自 agents/ 的文件
    const agentTarget = join(process.cwd(), '.agent', 'agents')
    await expect(fsAccess(agentTarget)).resolves.toBeUndefined()

    // 所有 universal result items 应有 status
    const universalResults = result.items.filter((i) => i.tool === 'universal')
    expect(universalResults.length).toBeGreaterThan(0)
    for (const item of universalResults) {
      expect(['new', 'updated', 'skipped']).toContain(item.status)
    }
  })

  it('AC #2 --no-universal 时 plan 中不包含通用目录条目', async () => {
    const stages = createProductionStages(pathResolver)
    const args = createTestArgs({ tools: ['claude'], global: false, noUniversal: true })

    const source = await stages.resolve(args, reporter)
    const authed = await stages.authenticate(source, args, reporter)
    const repo = await stages.clone(authed, args, reporter)
    const env = await stages.detect(repo, args, reporter)
    const plan = await stages.match(env, args, reporter)

    const universalItems = plan.items.filter((i) => i.rule.tool === 'universal')
    expect(universalItems).toHaveLength(0)
  })

  it('AC #3 二次安装无变更时通用目录文件均为 skipped（增量同步）', async () => {
    const stages = createProductionStages(pathResolver)
    const args = createTestArgs({ tools: ['claude'], global: false, noUniversal: false })

    // ── 第一次安装（全量写入）─────────────────────────────────────────────
    const source1 = await stages.resolve(args, reporter)
    const authed1 = await stages.authenticate(source1, args, reporter)
    const repo1 = await stages.clone(authed1, args, reporter)
    const env1 = await stages.detect(repo1, args, reporter)
    const plan1 = await stages.match(env1, args, reporter)
    const result1 = await stages.install(plan1, args, reporter)

    const universal1 = result1.items.filter((i) => i.tool === 'universal')
    expect(universal1.length).toBeGreaterThan(0)
    // 首次安装：全部 new（不存在）
    for (const item of universal1) {
      expect(['new', 'updated']).toContain(item.status)
    }

    // 保存 manifest，供下次安装做冲突检测
    await stages.saveManifest(result1)

    // ── 第二次安装（无变更）────────────────────────────────────────────────
    const reporter2 = createMockReporter()
    const source2 = await stages.resolve(args, reporter2)
    const authed2 = await stages.authenticate(source2, args, reporter2)
    const repo2 = await stages.clone(authed2, args, reporter2)
    const env2 = await stages.detect(repo2, args, reporter2)
    const plan2 = await stages.match(env2, args, reporter2)
    const result2 = await stages.install(plan2, args, reporter2)

    const universal2 = result2.items.filter((i) => i.tool === 'universal')
    expect(universal2.length).toBeGreaterThan(0)
    // 增量同步：相同内容全部 skipped
    for (const item of universal2) {
      expect(item.status).toBe('skipped')
    }
  })
})
