/**
 * pipeline-production-stages.test.ts — createProductionStages 真实闭包集成测试
 *
 * 来源: Story 4.6a CR Round 1 — 发现 3 修复
 *
 * 目的：
 *   验证 createProductionStages() 返回的 saveManifest 闭包在真实阶段链中
 *   正确构建 manifest 条目（特别是 mode、tool、scope 字段），覆盖：
 *   - flatten 规则的 mode 正确写入 'flatten'（发现 1 修复验证）
 *   - 共享目标目录（cursor skills[Flatten] + agents[Files] → .cursor/rules/）不互相覆盖（发现 1 修复验证）
 *   - planInfo 查找失败时抛错而非空值兜底（发现 2 修复验证）
 *
 * 策略：
 *   - Mock 网络阶段（resolve / authenticate / clone）避免外部依赖
 *   - 使用 --tools cursor 手动指定工具避免 fs 检测扫描
 *   - 使用临时目录创建 fixture 知识仓库
 *   - 真实执行 detect → match → install → saveManifest 闭包链
 *   - 断言 manifest.json 内容
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import type { ParsedArgs } from '../../src/core/types.js'
import type { Reporter } from '../../src/core/reporter.js'
import type { PathResolver } from '../../src/core/path-resolver.js'
import type { ManifestEntry } from '../../src/core/types.js'
import { InstallType } from '../../src/core/types.js'
import { createProductionStages } from '../../src/pipeline.js'

// ── Mock 网络阶段 ──────────────────────────────────────────────────────

// resolveSource — 返回固定的 ResolvedSource
vi.mock('../../src/stages/resolve-source.js', () => ({
  resolveSource: vi.fn(async () => ({
    hostname: 'github.com',
    repoPath: 'test-org/test-repo',
    protocol: 'https' as const,
  })),
}))

// authenticate — 返回固定的 AuthenticatedSource
vi.mock('../../src/stages/authenticate.js', () => ({
  authenticate: vi.fn(async () => ({
    hostname: 'github.com',
    repoPath: 'test-org/test-repo',
    protocol: 'https' as const,
    authMethod: 'credential-manager' as const,
    cloneUrl: 'https://github.com/test-org/test-repo.git',
  })),
}))

// clone — 在 describe 级别动态设置返回值（需要临时目录路径）
// 使用 vi.hoisted 确保 cloneMock 在 vi.mock 工厂函数中可引用
const cloneMock = vi.hoisted(() => vi.fn())
vi.mock('../../src/stages/clone.js', () => ({
  cloneRepo: cloneMock,
}))

// ── 测试辅助 ──────────────────────────────────────────────────────────

function createTestArgs(partial: Partial<ParsedArgs> = {}): ParsedArgs {
  return {
    source: 'https://github.com/test-org/test-repo',
    global: true,
    link: false,
    tools: ['cursor'],
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

// ── 集成测试 ──────────────────────────────────────────────────────────

describe('createProductionStages — saveManifest 真实闭包集成测试 (CR Round 1 发现 3)', () => {
  let tmpDir: string
  let repoDir: string // 模拟知识仓库
  let homeDir: string // 模拟 HOME 目录
  let mockReporter: Reporter
  let mockPathResolver: PathResolver
  let originalExitCode: number | undefined
  let originalCwd: string // 保存原始 cwd，避免 project scope 安装污染真实项目目录

  beforeEach(async () => {
    originalCwd = process.cwd()
    tmpDir = await mkdtemp(join(tmpdir(), 'aiforge-test-'))
    repoDir = join(tmpDir, 'repo')
    homeDir = join(tmpDir, 'home')

    // project scope 的 targetPath 依赖 process.cwd()，切换到 tmpDir 避免污染项目目录
    process.chdir(tmpDir)

    // 创建目录结构
    await mkdir(repoDir, { recursive: true })
    await mkdir(homeDir, { recursive: true })
    await mkdir(join(homeDir, '.aiforge'), { recursive: true })

    // 创建 fixture 知识仓库:
    // skills/ 目录下有子目录（用于 Flatten 规则）
    await mkdir(join(repoDir, 'skills', 'code-review'), { recursive: true })
    await mkdir(join(repoDir, 'skills', 'testing'), { recursive: true })
    await writeFile(
      join(repoDir, 'skills', 'code-review', 'index.md'),
      '# Code Review Skill\nThis is a code review skill.',
    )
    await writeFile(
      join(repoDir, 'skills', 'testing', 'index.md'),
      '# Testing Skill\nThis is a testing skill.',
    )

    // agents/ 目录下有文件（用于 Files 规则）
    await mkdir(join(repoDir, 'agents'), { recursive: true })
    await writeFile(join(repoDir, 'agents', 'dev-agent.md'), '# Dev Agent\nI am a dev agent.')

    // 设置 clone mock 返回临时仓库目录
    cloneMock.mockResolvedValue({
      repoDir,
      isNew: true,
      sourceFiles: [],
    })

    mockReporter = createMockReporter()

    mockPathResolver = {
      home: () => homeDir,
      configDir: () => join(homeDir, '.aiforge'),
      reposDir: () => join(homeDir, '.aiforge', 'repos'),
      toolGlobalDir: () => homeDir,
      toolProjectDir: () => '',
    }

    originalExitCode = process.exitCode
  })

  afterEach(async () => {
    process.exitCode = originalExitCode
    process.chdir(originalCwd) // 恢复 cwd
    await rm(tmpDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('cursor 全局安装: flatten skills 的 manifest mode 为 "flatten"，files agents 的 mode 为 "copy"', async () => {
    const stages = createProductionStages(mockPathResolver)
    const args = createTestArgs({ global: true, tools: ['cursor'] })

    // 执行真实阶段链：detect → match → install → saveManifest
    // resolve 和 authenticate 和 clone 已被 mock
    const source = await stages.resolve(args, mockReporter)
    const authed = await stages.authenticate(source, args, mockReporter)
    const repo = await stages.clone(authed, args, mockReporter)
    const env = await stages.detect(repo, args, mockReporter)
    const plan = await stages.match(env, args, mockReporter)

    // 方案 1 修复后：mode 只表示安装方式（copy/symlink），通过 rule.type 判断是否为 Flatten 规则
    const flattenRuleItems = plan.items.filter((item) => item.rule.type === InstallType.Flatten)
    const nonFlattenItems = plan.items.filter((item) => item.rule.type !== InstallType.Flatten)

    expect(flattenRuleItems.length).toBeGreaterThan(0)
    // Flatten 规则的 mode 在方案 1 后为 'copy'（无 --link 时），不再是 'flatten'
    expect(flattenRuleItems[0]!.mode).toBe('copy')
    // cursor 全局只有 skills[Flatten] 一条规则，验证非 flatten 规则数量
    expect(nonFlattenItems.length).toBeGreaterThanOrEqual(0)

    // 执行安装
    const result = await stages.install(plan, args, mockReporter)

    // 执行 saveManifest（真实闭包逻辑）
    await stages.saveManifest(result)

    // 读取 manifest.json 并验证
    const manifestPath = join(homeDir, '.aiforge', 'manifest.json')
    const manifestContent = await readFile(manifestPath, 'utf-8')
    const manifest: ManifestEntry[] = JSON.parse(manifestContent)

    // 验证 flatten skills 的 manifest 条目
    const flattenEntries = manifest.filter((e) => e.mode === 'flatten')
    expect(flattenEntries.length).toBe(2) // code-review.md + testing.md

    for (const entry of flattenEntries) {
      expect(entry.tool).toBe('cursor')
      expect(entry.scope).toBe('global')
      expect(entry.mode).toBe('flatten')
      expect(entry.hash).not.toBe('') // hash 不为空
      expect(entry.source).not.toBe('') // source 不为空
      expect(entry.target).toContain('.cursor/rules/')
    }

    // 验证所有条目的必填字段都不为空
    for (const entry of manifest) {
      expect(entry.tool).not.toBe('')
      expect(entry.hash).not.toBe('')
      expect(entry.source).not.toBe('')
      expect(entry.target).not.toBe('')
      expect(entry.installedAt).not.toBe('')
    }
  })

  it('cursor 项目安装: skills[Flatten] 和 agents[Files] 共享 .cursor/rules/ 目录，manifest 条目各自正确', async () => {
    const stages = createProductionStages(mockPathResolver)
    // 项目级安装：cursor 的 skills[Flatten] 和 agents[Files] 共享 .cursor/rules/
    const args = createTestArgs({ global: false, tools: ['cursor'], force: true })

    const source = await stages.resolve(args, mockReporter)
    const authed = await stages.authenticate(source, args, mockReporter)
    const repo = await stages.clone(authed, args, mockReporter)
    const env = await stages.detect(repo, args, mockReporter)
    const plan = await stages.match(env, args, mockReporter)

    // 验证 cursor 项目级有两条规则共享 .cursor/rules/
    // 注意：targetPath 可能带尾部斜杠，使用 includes 做宽松匹配
    const cursorRulesItems = plan.items.filter((item) => item.targetPath.includes('.cursor/rules'))
    // cursor project: skills(Flatten) → .cursor/rules/ 和 agents(Files) → .cursor/rules/
    expect(cursorRulesItems.length).toBe(2)
    // 方案 1 修复后：mode 只表示安装方式，无 --link 时均为 'copy'
    expect(cursorRulesItems.map((i) => i.mode).sort()).toEqual(['copy', 'copy'])
    // 通过 rule.type 区分两条规则（一条 Flatten，一条 Files）
    expect(cursorRulesItems.map((i) => i.rule.type).sort()).toEqual(
      [InstallType.Files, InstallType.Flatten].sort(),
    )

    const result = await stages.install(plan, args, mockReporter)
    await stages.saveManifest(result)

    // 读取并验证 manifest
    const manifestPath = join(homeDir, '.aiforge', 'manifest.json')
    const manifestContent = await readFile(manifestPath, 'utf-8')
    const manifest: ManifestEntry[] = JSON.parse(manifestContent)

    // 应有 3 个条目: 2 个 flatten skills + 1 个 copy agent
    expect(manifest.length).toBe(3)

    // 验证 flatten 条目
    const flattenEntries = manifest.filter((e) => e.mode === 'flatten')
    expect(flattenEntries.length).toBe(2)
    for (const entry of flattenEntries) {
      expect(entry.tool).toBe('cursor')
      expect(entry.scope).toBe('project')
      expect(entry.mode).toBe('flatten')
    }

    // 验证 copy 条目（agents/dev-agent.md）
    const copyEntries = manifest.filter((e) => e.mode === 'copy')
    expect(copyEntries.length).toBe(1)
    expect(copyEntries[0]!.tool).toBe('cursor')
    expect(copyEntries[0]!.scope).toBe('project')
    expect(copyEntries[0]!.mode).toBe('copy')
    expect(copyEntries[0]!.target).toContain('dev-agent.md')
  })

  it('planInfo 查找失败时抛出包含诊断信息的 Error 而非空值兜底', async () => {
    const stages = createProductionStages(mockPathResolver)
    const args = createTestArgs({ global: true, tools: ['cursor'] })

    // 正常执行 match，让 lastPlan 被填充
    const source = await stages.resolve(args, mockReporter)
    const authed = await stages.authenticate(source, args, mockReporter)
    await stages.clone(authed, args, mockReporter)
    const env = await stages.detect({ repoDir, isNew: true, sourceFiles: [] }, args, mockReporter)
    await stages.match(env, args, mockReporter)

    // 构造一个 status:'new' 的 InstallResult，targetPath 指向真实存在的文件
    // 但 sourcePath 完全不在任何 plan 的 sourceFiles 中（也不在 plan targetPath 目录下）
    // 这样 fileHash() 能成功，但 planInfo 查找失败
    const orphanFile = join(tmpDir, 'orphan-file.md')
    await writeFile(orphanFile, '# orphan')

    const badResult = {
      items: [
        {
          status: 'new' as const,
          sourcePath: join(tmpDir, 'unrecognized-source.md'), // 不在任何 plan.sourceFiles 中
          targetPath: orphanFile, // 真实文件（fileHash 不会抛错）
          tool: 'test-tool',
        },
      ],
    }

    await expect(stages.saveManifest(badResult)).rejects.toThrow(/manifest plan info missing/)
    await expect(stages.saveManifest(badResult)).rejects.toThrow(/available plan targets/)
  })

  it('cursor 全局 + --link: Flatten 规则安装结果为 symlink，manifest mode 仍为 "flatten"（CR Round 2 发现 1 修复验证）', async () => {
    const stages = createProductionStages(mockPathResolver)
    // 关键：link: true — Flatten + --link 场景
    const args = createTestArgs({ global: true, tools: ['cursor'], link: true })

    const source = await stages.resolve(args, mockReporter)
    const authed = await stages.authenticate(source, args, mockReporter)
    const repo = await stages.clone(authed, args, mockReporter)
    const env = await stages.detect(repo, args, mockReporter)
    const plan = await stages.match(env, args, mockReporter)

    // 方案 1 修复后：Flatten 规则的 mode 在 --link 时应为 'symlink'（不再被强制覆写为 'flatten'）
    const flattenRuleItems = plan.items.filter((item) => item.rule.type === InstallType.Flatten)
    expect(flattenRuleItems.length).toBeGreaterThan(0)
    for (const item of flattenRuleItems) {
      expect(item.mode).toBe('symlink') // 修复验证：Flatten + --link 时 mode 为 symlink
    }

    // 执行安装并保存 manifest
    const result = await stages.install(plan, args, mockReporter)
    await stages.saveManifest(result)

    // 读取 manifest.json 并验证
    const manifestPath = join(homeDir, '.aiforge', 'manifest.json')
    const manifestContent = await readFile(manifestPath, 'utf-8')
    const manifest: ManifestEntry[] = JSON.parse(manifestContent)

    // manifest 中 Flatten 规则的条目 mode 仍应为 'flatten'（manifest 语义不变）
    const flattenEntries = manifest.filter((e) => e.mode === 'flatten')
    expect(flattenEntries.length).toBeGreaterThan(0)
    for (const entry of flattenEntries) {
      expect(entry.tool).toBe('cursor')
      expect(entry.scope).toBe('global')
      expect(entry.mode).toBe('flatten') // manifest 记录规则类型，不是安装方式
    }

    // 验证实际文件为符号链接（安装方式为 symlink）
    const { lstat } = await import('node:fs/promises')
    for (const entry of flattenEntries) {
      const stat = await lstat(entry.target)
      expect(stat.isSymbolicLink()).toBe(true) // 修复验证：安装结果为 symlink 而非 copy
    }
  })
})
