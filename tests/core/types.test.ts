import { describe, it, expect, expectTypeOf } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'
import type {
  ParsedArgs,
  ResolvedSource,
  AuthenticatedSource,
  LocalRepo,
  DetectedEnv,
  MatchedPlan,
  InstallResult,
  InstallRule,
  ToolDefinition,
  ManifestEntry,
  AiforgeConfig,
  Severity,
  AuthMethod,
} from '../../src/core/types.js'
import { InstallType } from '../../src/core/types.js'

describe('core/types — pipeline data contracts (AC: #1)', () => {
  it('ParsedArgs has required fields', () => {
    const v: ParsedArgs = {
      source: 'gitlab.example.com/org/repo',
      dryRun: false,
      quiet: false,
      symlink: false,
      flatten: false,
      language: 'zh',
    }
    expectTypeOf(v).toMatchTypeOf<ParsedArgs>()
  })

  it('ResolvedSource has hostname, repoPath, protocol', () => {
    const v: ResolvedSource = {
      hostname: 'gitlab.example.com',
      repoPath: 'org/repo',
      protocol: 'https',
    }
    expectTypeOf(v).toMatchTypeOf<ResolvedSource>()
  })

  it('AuthenticatedSource extends ResolvedSource with authMethod and cloneUrl', () => {
    const v: AuthenticatedSource = {
      hostname: 'gitlab.example.com',
      repoPath: 'org/repo',
      protocol: 'https',
      authMethod: 'token',
      cloneUrl: 'https://glpat-ab****mnop@gitlab.example.com/org/repo.git',
    }
    expectTypeOf(v).toMatchTypeOf<AuthenticatedSource>()
  })

  it('LocalRepo has repoDir, isNew, sourceFiles', () => {
    const v: LocalRepo = {
      repoDir: '/tmp/repo',
      isNew: true,
      sourceFiles: ['agents/dev.md'],
    }
    expectTypeOf(v).toMatchTypeOf<LocalRepo>()
  })

  it('DetectedEnv has tools and scope', () => {
    const v: DetectedEnv = {
      tools: ['claude', 'cursor'],
      scope: 'global',
    }
    expectTypeOf(v).toMatchTypeOf<DetectedEnv>()
  })

  it('MatchedPlan has items with rule, sourceFiles, targetPath', () => {
    const rule: InstallRule = {
      tool: 'claude',
      scope: 'global',
      sourceDir: 'agents',
      type: InstallType.Files,
      targetDir: '~/.claude/agents',
    }
    const v: MatchedPlan = {
      items: [{ rule, sourceFiles: ['dev.md'], targetPath: '~/.claude/agents/dev.md' }],
    }
    expectTypeOf(v).toMatchTypeOf<MatchedPlan>()
  })

  it('InstallResult has items with status, sourcePath, targetPath', () => {
    const v: InstallResult = {
      items: [{ status: 'new', sourcePath: '/tmp/repo/agents/dev.md', targetPath: '~/.claude/agents/dev.md' }],
    }
    expectTypeOf(v).toMatchTypeOf<InstallResult>()
  })

  it('InstallRule has tool, scope, sourceDir, type, targetDir', () => {
    const v: InstallRule = {
      tool: 'claude',
      scope: 'global',
      sourceDir: 'agents',
      type: InstallType.Directories,
      targetDir: '~/.claude',
    }
    expectTypeOf(v).toMatchTypeOf<InstallRule>()
  })

  it('ToolDefinition has id, name, detect.global, detect.project', () => {
    const v: ToolDefinition = {
      id: 'claude',
      name: 'Claude Code',
      detect: { global: ['~/.claude'], project: ['.claude'] },
    }
    expectTypeOf(v).toMatchTypeOf<ToolDefinition>()
  })

  it('ManifestEntry has all required fields', () => {
    const v: ManifestEntry = {
      source: 'agents/dev.md',
      target: '~/.claude/agents/dev.md',
      tool: 'claude',
      scope: 'global',
      mode: 'copy',
      hash: 'abc123',
      installedAt: '2026-03-19T00:00:00Z',
    }
    expectTypeOf(v).toMatchTypeOf<ManifestEntry>()
  })

  it('AiforgeConfig has defaultRepo, cloneDir, language, preferSSH, auth', () => {
    const v: AiforgeConfig = {
      defaultRepo: 'gitlab.example.com/org/repo',
      cloneDir: '~/.aiforge/repos',
      language: 'zh',
      preferSSH: false,
      auth: { 'gitlab.example.com': { method: 'token' } },
    }
    expectTypeOf(v).toMatchTypeOf<AiforgeConfig>()
  })

  it('AiforgeConfig allows cloneDir and preferSSH to be omitted', () => {
    const v: AiforgeConfig = {
      auth: { 'gitlab.example.com': { method: 'ssh' } },
    }
    expectTypeOf(v).toMatchTypeOf<AiforgeConfig>()
  })

  it('Severity type accepts fatal and partial', () => {
    const a: Severity = 'fatal'
    const b: Severity = 'partial'
    expectTypeOf(a).toMatchTypeOf<Severity>()
    expectTypeOf(b).toMatchTypeOf<Severity>()
  })

  it('AuthMethod type accepts ssh, token, credential-manager', () => {
    const a: AuthMethod = 'ssh'
    const b: AuthMethod = 'token'
    const c: AuthMethod = 'credential-manager'
    expectTypeOf(a).toMatchTypeOf<AuthMethod>()
    expectTypeOf(b).toMatchTypeOf<AuthMethod>()
    expectTypeOf(c).toMatchTypeOf<AuthMethod>()
  })

  it('InstallType enum has Files, Directories, Flatten', () => {
    expect(InstallType.Files).toBe('Files')
    expect(InstallType.Directories).toBe('Directories')
    expect(InstallType.Flatten).toBe('Flatten')
  })
})

describe('core/ module boundary (AC: #5)', () => {
  const coreDir = resolve(process.cwd(), 'src/core')
  const coreFiles = readdirSync(coreDir).filter((f) => f.endsWith('.ts'))

  for (const file of coreFiles) {
    const filePath = resolve(coreDir, file)
    const content = readFileSync(filePath, 'utf-8')

    it(`${file} has no imports from stages/, services/, data/, commands/`, () => {
      const importLines = content.split('\n').filter((l) => l.match(/^\s*import\s/))
      for (const line of importLines) {
        expect(line).not.toMatch(/from\s+['"]\.\.\/(?:stages|services|data|commands)/)
      }
    })

    it(`${file} uses .js extension on all relative imports`, () => {
      const relativeImports = content.match(/from\s+['"]\.\/.+?['"]/g) ?? []
      for (const imp of relativeImports) {
        expect(imp).toMatch(/\.js['"]$/)
      }
    })

    if (file !== 'index.ts') {
      it(`${file} uses only named exports (no default export)`, () => {
        expect(content).not.toMatch(/export\s+default\s/)
      })
    }
  }
})
