/**
 * install-modes.test.ts — 安装模式 E2E 测试
 *
 * 来源: Story 5.5b Task 3
 * 测试:
 *   AC #2: 三种安装模式（复制、符号链接、flatten）均通过验证，输出符合预期
 *   AC #6: macOS 环境通过
 *
 * 策略:
 *   - Mock Git 克隆，使用本地 fixture 仓库
 *   - 使用临时目录隔离测试环境
 *   - 真实执行 detect → match → install 阶段
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, readFile, rm, lstat, readlink, access as fsAccess } from 'node:fs/promises'
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

// ── Mock 网络层阶段（避免真实 Git 操作）────────────────────────────────────

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

// ── 共享 beforeEach/afterEach ─────────────────────────────────────────────────

describe('Story 5.5b AC #2: 安装模式 E2E 测试', () => {
  let tmpDir: string
  let homeDir: string
  let mockReporter: Reporter
  let mockPathResolver: PathResolver
  let originalCwd: string

  beforeEach(async () => {
    originalCwd = process.cwd()
    tmpDir = await mkdtemp(join(tmpdir(), 'aiforge-modes-'))
    homeDir = join(tmpDir, 'home')
    await mkdir(homeDir, { recursive: true })
    await mkdir(join(homeDir, '.aiforge'), { recursive: true })

    // 切换 cwd 到临时目录，避免影响项目目录
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

  // ── Task 3.1: 复制模式 ─────────────────────────────────────────────────

  describe('Task 3.1: 复制模式（copy）— 验证文件内容一致', () => {
    it('copy 模式：安装的文件内容与源文件一致', async () => {
      const stages = createProductionStages(mockPathResolver)
      // claude:global agents[Files] → copy 模式
      const args = createTestArgs({ tools: ['claude'], global: true, link: false })

      const source = await stages.resolve(args, mockReporter)
      const authed = await stages.authenticate(source, args, mockReporter)
      const repo = await stages.clone(authed, args, mockReporter)
      const env = await stages.detect(repo, args, mockReporter)
      const plan = await stages.match(env, args, mockReporter)

      // 确认是 copy 模式
      expect(plan.items.every((i) => i.mode === 'copy')).toBe(true)

      const result = await stages.install(plan, args, mockReporter)

      // 验证 coding-agent.md 内容与源文件一致
      const srcPath = join(FIXTURE_REPO, 'agents', 'coding-agent.md')
      const destPath = join(homeDir, '.claude', 'agents', 'coding-agent.md')

      const srcContent = await readFile(srcPath, 'utf-8')
      const destContent = await readFile(destPath, 'utf-8')

      expect(destContent).toBe(srcContent)
      expect(result.items.some((i) => i.status === 'new')).toBe(true)
    })

    it('copy 模式：目标文件是普通文件（非符号链接）', async () => {
      const stages = createProductionStages(mockPathResolver)
      const args = createTestArgs({ tools: ['claude'], global: true, link: false })

      const source = await stages.resolve(args, mockReporter)
      const authed = await stages.authenticate(source, args, mockReporter)
      const repo = await stages.clone(authed, args, mockReporter)
      const env = await stages.detect(repo, args, mockReporter)
      const plan = await stages.match(env, args, mockReporter)
      await stages.install(plan, args, mockReporter)

      const destPath = join(homeDir, '.claude', 'agents', 'coding-agent.md')
      const stat = await lstat(destPath)

      // 复制模式：目标应是普通文件，而非符号链接
      expect(stat.isSymbolicLink()).toBe(false)
      expect(stat.isFile()).toBe(true)
    })

    it('copy 模式：多个文件均被正确复制（review-agent.md 也存在）', async () => {
      const stages = createProductionStages(mockPathResolver)
      const args = createTestArgs({ tools: ['claude'], global: true, link: false })

      const source = await stages.resolve(args, mockReporter)
      const authed = await stages.authenticate(source, args, mockReporter)
      const repo = await stages.clone(authed, args, mockReporter)
      const env = await stages.detect(repo, args, mockReporter)
      const plan = await stages.match(env, args, mockReporter)
      await stages.install(plan, args, mockReporter)

      // 验证两个 agent 文件都被复制
      const agentDir = join(homeDir, '.claude', 'agents')
      await expect(fsAccess(join(agentDir, 'coding-agent.md'))).resolves.toBeUndefined()
      await expect(fsAccess(join(agentDir, 'review-agent.md'))).resolves.toBeUndefined()
    })
  })

  // ── Task 3.2: 符号链接模式 ────────────────────────────────────────────

  describe('Task 3.2: 符号链接模式（symlink）— 验证链接指向正确', () => {
    it('symlink 模式（--link）：安装的文件是符号链接', async () => {
      const stages = createProductionStages(mockPathResolver)
      // --link 且 global=true → symlink 模式
      const args = createTestArgs({ tools: ['claude'], global: true, link: true })

      const source = await stages.resolve(args, mockReporter)
      const authed = await stages.authenticate(source, args, mockReporter)
      const repo = await stages.clone(authed, args, mockReporter)
      const env = await stages.detect(repo, args, mockReporter)
      const plan = await stages.match(env, args, mockReporter)

      // 确认推导为 symlink 模式
      expect(plan.items.every((i) => i.mode === 'symlink')).toBe(true)

      await stages.install(plan, args, mockReporter)

      // 验证目标文件是符号链接
      const destPath = join(homeDir, '.claude', 'agents', 'coding-agent.md')
      const stat = await lstat(destPath)
      expect(stat.isSymbolicLink()).toBe(true)
    })

    it('symlink 模式：链接指向 fixture 仓库中的原始文件（绝对路径）', async () => {
      const stages = createProductionStages(mockPathResolver)
      const args = createTestArgs({ tools: ['claude'], global: true, link: true })

      const source = await stages.resolve(args, mockReporter)
      const authed = await stages.authenticate(source, args, mockReporter)
      const repo = await stages.clone(authed, args, mockReporter)
      const env = await stages.detect(repo, args, mockReporter)
      const plan = await stages.match(env, args, mockReporter)
      await stages.install(plan, args, mockReporter)

      // 验证链接目标路径指向 fixture 仓库
      const destPath = join(homeDir, '.claude', 'agents', 'coding-agent.md')
      const linkTarget = await readlink(destPath)
      const expectedTarget = join(FIXTURE_REPO, 'agents', 'coding-agent.md')

      expect(linkTarget).toBe(expectedTarget)
    })

    it('symlink 模式：link=true + scope=project → 抛出 LINK_PROJECT_REJECTED 错误', async () => {
      const stages = createProductionStages(mockPathResolver)
      // link=true + global=false → 项目级符号链接被拒绝（FR-021）
      const args = createTestArgs({ tools: ['claude'], global: false, link: true })

      const source = await stages.resolve(args, mockReporter)
      const authed = await stages.authenticate(source, args, mockReporter)
      const repo = await stages.clone(authed, args, mockReporter)
      const env = await stages.detect(repo, args, mockReporter)

      // match 阶段应抛出 LINK_PROJECT_REJECTED 错误
      await expect(stages.match(env, args, mockReporter)).rejects.toMatchObject({
        code: 'LINK_PROJECT_REJECTED',
        severity: 'fatal',
      })
    })
  })

  // ── Task 3.3: flatten 模式 ────────────────────────────────────────────

  describe('Task 3.3: flatten 模式 — 验证目录扁平化和重命名', () => {
    it('flatten 模式：skills 子目录被扁平化，重命名为 <dirname>.md 安装到目标目录', async () => {
      const stages = createProductionStages(mockPathResolver)
      // cursor:global skills[Flatten] → ~/.cursor/rules/
      const args = createTestArgs({ tools: ['cursor'], global: true, link: false })

      const source = await stages.resolve(args, mockReporter)
      const authed = await stages.authenticate(source, args, mockReporter)
      const repo = await stages.clone(authed, args, mockReporter)
      const env = await stages.detect(repo, args, mockReporter)
      const plan = await stages.match(env, args, mockReporter)
      const result = await stages.install(plan, args, mockReporter)

      // flatten：skills/code-review/index.md → .cursor/rules/code-review.md
      //         skills/refactor/index.md → .cursor/rules/refactor.md
      const cursorRulesDir = join(homeDir, '.cursor', 'rules')
      await expect(fsAccess(join(cursorRulesDir, 'code-review.md'))).resolves.toBeUndefined()
      await expect(fsAccess(join(cursorRulesDir, 'refactor.md'))).resolves.toBeUndefined()

      // 结果状态为 new
      const flattenResults = result.items.filter((i) => i.targetPath.endsWith('.md'))
      expect(flattenResults.length).toBeGreaterThan(0)
      expect(flattenResults.every((i) => i.status === 'new')).toBe(true)
    })

    it('flatten 模式：安装的文件内容为 index.md 的内容', async () => {
      const stages = createProductionStages(mockPathResolver)
      const args = createTestArgs({ tools: ['cursor'], global: true, link: false })

      const source = await stages.resolve(args, mockReporter)
      const authed = await stages.authenticate(source, args, mockReporter)
      const repo = await stages.clone(authed, args, mockReporter)
      const env = await stages.detect(repo, args, mockReporter)
      const plan = await stages.match(env, args, mockReporter)
      await stages.install(plan, args, mockReporter)

      // 验证 code-review.md 内容来自 skills/code-review/index.md
      const srcIndex = join(FIXTURE_REPO, 'skills', 'code-review', 'index.md')
      const destFlattened = join(homeDir, '.cursor', 'rules', 'code-review.md')

      const srcContent = await readFile(srcIndex, 'utf-8')
      const destContent = await readFile(destFlattened, 'utf-8')

      expect(destContent).toBe(srcContent)
    })

    it('flatten + --link：skills 子目录主文件被 symlink 到目标（重命名规则保持）', async () => {
      const stages = createProductionStages(mockPathResolver)
      // cursor:global skills[Flatten] + --link → symlink 模式
      const args = createTestArgs({ tools: ['cursor'], global: true, link: true })

      const source = await stages.resolve(args, mockReporter)
      const authed = await stages.authenticate(source, args, mockReporter)
      const repo = await stages.clone(authed, args, mockReporter)
      const env = await stages.detect(repo, args, mockReporter)
      const plan = await stages.match(env, args, mockReporter)

      // Flatten + --link 推导为 symlink 模式（方案 1 修复验证）
      const flattenItems = plan.items.filter((i) => i.rule.sourceDir === 'skills')
      expect(flattenItems.every((i) => i.mode === 'symlink')).toBe(true)

      await stages.install(plan, args, mockReporter)

      // code-review.md 是符号链接
      const destFlattened = join(homeDir, '.cursor', 'rules', 'code-review.md')
      const stat = await lstat(destFlattened)
      expect(stat.isSymbolicLink()).toBe(true)

      // 链接指向 index.md
      const linkTarget = await readlink(destFlattened)
      const expectedTarget = join(FIXTURE_REPO, 'skills', 'code-review', 'index.md')
      expect(linkTarget).toBe(expectedTarget)
    })
  })
})
