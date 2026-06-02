import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { access as fsAccess, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import type { LocalRepo, ParsedArgs } from '../../src/core/types.js'
import type { PathResolver } from '../../src/core/path-resolver.js'
import type { Reporter } from '../../src/core/reporter.js'
import { AiforgeError } from '../../src/core/errors.js'
import { detectTools } from '../../src/stages/detect-tools.js'
import { matchRules } from '../../src/stages/match-rules.js'
import { executeInstall } from '../../src/stages/execute-install.js'

const { mockCheckGeminiVersion } = vi.hoisted(() => ({
  mockCheckGeminiVersion: vi.fn(),
}))

vi.mock('../../src/services/version-check.js', () => ({
  checkGeminiVersion: mockCheckGeminiVersion,
}))

function createArgs(overrides: Partial<ParsedArgs> = {}): ParsedArgs {
  return {
    source: 'https://gitlab.example.com/org/knowledge-repo',
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
    noUniversal: false,
    ...overrides,
  }
}

function createReporter(): Reporter {
  return {
    startPhase: vi.fn(),
    updatePhase: vi.fn(),
    completePhase: vi.fn(),
    reportResult: vi.fn(),
    reportPlan: vi.fn(),
    reportError: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }
}

function createPathResolver(homeDir: string): PathResolver {
  return {
    home: () => homeDir,
    configDir: () => join(homeDir, '.aiforge'),
    reposDir: () => join(homeDir, '.aiforge', 'repos'),
    toolGlobalDir: (toolId: string) => join(homeDir, `.${toolId}`),
    toolProjectDir: (toolId: string) => `.${toolId}`,
  }
}

async function createKnowledgeRepo(repoDir: string): Promise<void> {
  await mkdir(join(repoDir, 'agents'), { recursive: true })
  await mkdir(join(repoDir, 'skills', 'sample-skill'), { recursive: true })
  await mkdir(join(repoDir, 'instructions'), { recursive: true })
  await mkdir(join(repoDir, 'mcp-tools'), { recursive: true })
  await mkdir(join(repoDir, 'rules'), { recursive: true })

  await writeFile(join(repoDir, 'agents', 'alpha-agent.md'), '# alpha agent\n')
  await writeFile(join(repoDir, 'skills', 'sample-skill', 'index.md'), '# sample skill\n')
  await writeFile(join(repoDir, 'instructions', 'AGENTS.md'), '# agents instruction\n')
  await writeFile(join(repoDir, 'instructions', 'CLAUDE.md'), '# claude instruction\n')
  await writeFile(join(repoDir, 'instructions', 'GEMINI.md'), '# gemini instruction\n')
  await writeFile(join(repoDir, 'mcp-tools', 'mcp.json'), '{"mcp": true}\n')
  await writeFile(join(repoDir, 'rules', 'tool-rule.md'), '# tool rule\n')
}

async function installTool(
  repo: LocalRepo,
  args: ParsedArgs,
  reporter: Reporter,
  pathResolver: PathResolver,
): Promise<Awaited<ReturnType<typeof executeInstall>>> {
  const env = await detectTools(repo, args, reporter, pathResolver)
  const plan = await matchRules(repo, env, args, reporter, pathResolver, false)
  return executeInstall(plan, args, reporter, pathResolver, {
    entries: [],
    degraded: false,
  })
}

async function expectAccessible(path: string): Promise<void> {
  await expect(fsAccess(path)).resolves.toBeUndefined()
}

describe('Epic 7 AI IDE expansion E2E', () => {
  let tempRoot: string
  let homeDir: string
  let projectDir: string
  let repoDir: string
  let originalCwd: string
  let repo: LocalRepo
  let pathResolver: PathResolver
  let reporter: Reporter

  beforeEach(async () => {
    originalCwd = process.cwd()
    tempRoot = await mkdtemp(join(tmpdir(), 'aiforge-epic7-ai-ide-'))
    homeDir = join(tempRoot, 'home')
    projectDir = join(tempRoot, 'workspace')
    repoDir = join(tempRoot, 'knowledge-repo')

    await mkdir(homeDir, { recursive: true })
    await mkdir(projectDir, { recursive: true })
    await createKnowledgeRepo(repoDir)
    process.chdir(projectDir)

    repo = { repoDir, isNew: true, sourceFiles: [] }
    pathResolver = createPathResolver(homeDir)
    reporter = createReporter()
    mockCheckGeminiVersion.mockResolvedValue({ version: '0.30.0', meetsRequirement: true })
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    await rm(tempRoot, { recursive: true, force: true })
    vi.clearAllMocks()
  })

  it('7-1: 将 VS Code 归并提示与 Copilot 项目级 MCP 写入串成同一迁移流程', async () => {
    await mkdir(join(projectDir, '.github'), { recursive: true })
    await mkdir(join(homeDir, '.vscode'), { recursive: true })
    await writeFile(join(homeDir, '.vscode', 'existing.json'), '{"keep": true}\n')

    const result = await installTool(
      repo,
      createArgs({ tools: ['copilot'], global: false }),
      reporter,
      pathResolver,
    )
    expect(result.items.some((item) => item.targetPath.endsWith('.vscode/mcp.json'))).toBe(true)
    await expectAccessible(join(projectDir, '.vscode', 'mcp.json'))
    await expect(readFile(join(homeDir, '.vscode', 'existing.json'), 'utf8')).resolves.toBe(
      '{"keep": true}\n',
    )

    const warningOnlyProject = join(tempRoot, 'vscode-only-project')
    await mkdir(warningOnlyProject, { recursive: true })
    process.chdir(warningOnlyProject)
    const autoReporter = createReporter()
    await expect(
      detectTools(repo, createArgs({ global: false }), autoReporter, pathResolver),
    ).rejects.toMatchObject<AiforgeError>({ code: 'NO_TOOLS' })
    process.chdir(projectDir)
    expect(vi.mocked(autoReporter.warn).mock.calls.flat().join('\n')).toContain('GitHub Copilot')

    await expect(
      detectTools(repo, createArgs({ tools: ['vscode'] }), createReporter(), pathResolver),
    ).rejects.toMatchObject<AiforgeError>({ code: 'UNKNOWN_TOOL' })
  })

  it('7-2: Codex 全局 MCP 采用模板复制和手动合并语义，不改写 config.toml', async () => {
    await mkdir(join(homeDir, '.codex'), { recursive: true })
    await writeFile(join(homeDir, '.codex', 'config.toml'), '[existing]\nvalue = true\n')

    const result = await installTool(
      repo,
      createArgs({ tools: ['codex'], global: true }),
      reporter,
      pathResolver,
    )

    const mcpItem = result.items.find((item) => item.targetPath.endsWith('.codex/mcp.json'))
    expect(mcpItem?.manualAction).toBe('mcp-merge-required')
    await expectAccessible(join(homeDir, '.codex', 'mcp.json'))
    await expect(readFile(join(homeDir, '.codex', 'config.toml'), 'utf8')).resolves.toBe(
      '[existing]\nvalue = true\n',
    )
    const warnings = vi.mocked(reporter.warn).mock.calls.flat().join('\n')
    expect(warnings).toContain('~/.codex/config.toml')
    expect(warnings).toContain('[mcp]')
  })

  it('7-3: Auggie 项目安装只把 AGENTS.md 分发到项目根，CLAUDE.md 不泄漏', async () => {
    await mkdir(join(projectDir, '.augment'), { recursive: true })

    await installTool(repo, createArgs({ tools: ['auggie'] }), reporter, pathResolver)

    await expectAccessible(join(projectDir, '.augment', 'skills', 'sample-skill', 'index.md'))
    await expectAccessible(join(projectDir, '.augment', 'agents', 'alpha-agent.md'))
    await expectAccessible(join(projectDir, 'AGENTS.md'))
    expect(existsSync(join(projectDir, 'CLAUDE.md'))).toBe(false)
  })

  it('7-4: Gemini 版本不足时跳过 skills，但保留 instructions 安装', async () => {
    await mkdir(join(homeDir, '.gemini'), { recursive: true })
    mockCheckGeminiVersion.mockResolvedValue({ version: '0.20.0', meetsRequirement: false })

    const result = await installTool(
      repo,
      createArgs({ tools: ['gemini'], global: true }),
      reporter,
      pathResolver,
    )

    expect(result.items.some((item) => item.targetPath.includes('.gemini/skills'))).toBe(false)
    await expectAccessible(join(homeDir, '.gemini', 'AGENTS.md'))
    await expectAccessible(join(homeDir, '.gemini', 'GEMINI.md'))
    expect(vi.mocked(reporter.warn).mock.calls.flat().join('\n')).toContain('v0.26.0')
  })

  it('7-5: OpenCode 使用 XDG 全局目录，并对 opencode.json 输出 MCP 手动合并提示', async () => {
    await mkdir(join(homeDir, '.config', 'opencode'), { recursive: true })
    await writeFile(join(homeDir, '.config', 'opencode', 'opencode.json'), '{"mcp":{}}\n')

    const result = await installTool(
      repo,
      createArgs({ tools: ['opencode'], global: true }),
      reporter,
      pathResolver,
    )

    expect(
      result.items.some((item) => item.targetPath.endsWith('.config/opencode/AGENTS.md')),
    ).toBe(true)
    expect(result.items.some((item) => item.targetPath.includes('.opencode'))).toBe(false)
    await expectAccessible(join(homeDir, '.config', 'opencode', 'mcp.json'))
    await expect(
      readFile(join(homeDir, '.config', 'opencode', 'opencode.json'), 'utf8'),
    ).resolves.toBe('{"mcp":{}}\n')
    const warnings = vi.mocked(reporter.warn).mock.calls.flat().join('\n')
    expect(warnings).toContain('~/.config/opencode/opencode.json')
    expect(warnings).toContain('"mcp"')
  })

  it('7-6: Windsurf 在非 TTY 下保守跳过 agents→workflows，仍安装 skills 和 rules', async () => {
    await mkdir(join(projectDir, '.windsurf'), { recursive: true })
    Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true })

    const result = await installTool(
      repo,
      createArgs({ tools: ['windsurf'] }),
      reporter,
      pathResolver,
    )

    await expectAccessible(join(projectDir, '.windsurf', 'skills', 'sample-skill', 'index.md'))
    await expectAccessible(join(projectDir, '.windsurf', 'rules', 'tool-rule.md'))
    expect(result.items.some((item) => item.targetPath.includes('.windsurf/workflows'))).toBe(false)
    expect(existsSync(join(projectDir, '.windsurf', 'workflows', 'alpha-agent.md'))).toBe(false)
    expect(vi.mocked(reporter.warn).mock.calls.flat().join('\n')).toContain('workflows')
  })

  it('7-7: Kiro 将 AGENTS.md 安装到 steering 目录，并过滤其他 instructions 文件', async () => {
    await mkdir(join(projectDir, '.kiro'), { recursive: true })

    await installTool(repo, createArgs({ tools: ['kiro'] }), reporter, pathResolver)

    await expectAccessible(join(projectDir, '.kiro', 'skills', 'sample-skill', 'index.md'))
    await expectAccessible(join(projectDir, '.kiro', 'steering', 'AGENTS.md'))
    expect(existsSync(join(projectDir, '.kiro', 'steering', 'CLAUDE.md'))).toBe(false)
    expect(existsSync(join(projectDir, '.kiro', 'steering', 'GEMINI.md'))).toBe(false)
  })

  it('7-8: Antigravity 只由专属子目录触发，并与 Gemini 全局 skills 路径隔离', async () => {
    await mkdir(join(homeDir, '.gemini'), { recursive: true })

    const geminiOnlyEnv = await detectTools(
      repo,
      createArgs({ global: true }),
      reporter,
      pathResolver,
    )
    expect(geminiOnlyEnv.tools).toContain('gemini')
    expect(geminiOnlyEnv.tools).not.toContain('antigravity')

    await mkdir(join(homeDir, '.gemini', 'antigravity'), { recursive: true })
    const bothResult = await installTool(
      repo,
      createArgs({ tools: ['gemini', 'antigravity'], global: true }),
      reporter,
      pathResolver,
    )

    await expectAccessible(join(homeDir, '.gemini', 'skills', 'sample-skill', 'index.md'))
    await expectAccessible(
      join(homeDir, '.gemini', 'antigravity', 'skills', 'sample-skill', 'index.md'),
    )
    expect(
      bothResult.items.some(
        (item) =>
          item.tool === 'antigravity' && item.targetPath.includes('.gemini/antigravity/skills'),
      ),
    ).toBe(true)
  })

  it('7-9: Trae 部分接入只安装 rules 和 AGENTS.md，并输出 skills 不支持说明', async () => {
    await mkdir(join(projectDir, '.trae'), { recursive: true })

    const result = await installTool(repo, createArgs({ tools: ['trae'] }), reporter, pathResolver)

    await expectAccessible(join(projectDir, '.trae', 'rules', 'tool-rule.md'))
    await expectAccessible(join(projectDir, 'AGENTS.md'))
    expect(result.items.some((item) => item.targetPath.includes('skills'))).toBe(false)
    expect(existsSync(join(projectDir, '.trae', 'skills'))).toBe(false)
    expect(vi.mocked(reporter.info).mock.calls.flat().join('\n')).toContain('Trae Skills')
  })

  it('7-10: 最终文档收口与 11 工具检测性能保持在 Epic 7 门禁内', async () => {
    const globalMarkers = [
      '.copilot',
      '.claude',
      '.cursor',
      '.codex',
      '.config/opencode',
      '.codeium/windsurf',
      '.augment',
      '.gemini',
      '.gemini/antigravity',
      '.kiro',
      '.trae',
    ]
    for (const marker of globalMarkers) {
      await mkdir(join(homeDir, marker), { recursive: true })
    }
    await mkdir(join(homeDir, '.iflow'), { recursive: true })

    const start = performance.now()
    const env = await detectTools(repo, createArgs({ global: true }), reporter, pathResolver)
    const elapsed = performance.now() - start

    expect(new Set(env.tools)).toEqual(
      new Set([
        'copilot',
        'claude',
        'cursor',
        'codex',
        'opencode',
        'windsurf',
        'auggie',
        'gemini',
        'antigravity',
        'kiro',
        'trae',
      ]),
    )
    expect(elapsed).toBeLessThan(1000)
    expect(vi.mocked(reporter.info).mock.calls.flat().join('\n')).toContain('iFlow CLI')

    const [matrix, migration, changelog] = await Promise.all([
      readFile(join(originalCwd, 'docs', 'install-rules-matrix.md'), 'utf8'),
      readFile(join(originalCwd, 'docs', 'migration-v2.md'), 'utf8'),
      readFile(join(originalCwd, 'CHANGELOG.md'), 'utf8'),
    ])
    expect(matrix).toContain('Trae')
    expect(matrix).toContain('Antigravity')
    expect(migration).toContain('vscode')
    expect(migration).toContain('copilot')
    expect(changelog).toContain('BREAKING CHANGES')
  })
})
