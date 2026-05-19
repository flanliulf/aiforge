import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { InstallType } from '../../src/core/types.js'
import {
  BUILTIN_RULES,
  MCP_MERGE_HINTS,
  RULE_INDEX,
  TOOL_PRECONDITIONS,
  UNIVERSAL_RULES,
  loadRules,
} from '../../src/data/install-rules.js'

describe('data/install-rules — BUILTIN_RULES (AC: #1, Story 7-6)', () => {
  it('contains exactly 50 rules (Epic 7 cumulative matrix + kiro 4 rules)', () => {
    expect(BUILTIN_RULES).toHaveLength(50)
  })

  it('every rule has required fields: tool, scope, sourceDir, type, targetDir', () => {
    for (const rule of BUILTIN_RULES) {
      expect(rule).toHaveProperty('tool')
      expect(rule).toHaveProperty('scope')
      expect(rule).toHaveProperty('sourceDir')
      expect(rule).toHaveProperty('type')
      expect(rule).toHaveProperty('targetDir')
    }
  })

  it('Story 7-7: covers 9 tools (kiro added on top of windsurf baseline)', () => {
    const tools = new Set(BUILTIN_RULES.map((r) => r.tool))
    expect(tools).toEqual(
      new Set([
        'copilot',
        'claude',
        'cursor',
        'codex',
        'opencode',
        'windsurf',
        'auggie',
        'gemini',
        'kiro',
      ]),
    )
  })

  it('v2.0: no vscode rules exist in BUILTIN_RULES', () => {
    const vscodeRules = BUILTIN_RULES.filter((r) => r.tool === 'vscode')
    expect(vscodeRules).toHaveLength(0)
  })

  it('covers both global and project scopes', () => {
    const scopes = new Set(BUILTIN_RULES.map((r) => r.scope))
    expect(scopes).toEqual(new Set(['global', 'project']))
  })

  it('v2.0: copilot has 9 rules (4 global + 5 project, including new .vscode/ mcp rule)', () => {
    const copilotRules = BUILTIN_RULES.filter((r) => r.tool === 'copilot')
    expect(copilotRules).toHaveLength(9)
    expect(copilotRules.filter((r) => r.scope === 'global')).toHaveLength(4)
    expect(copilotRules.filter((r) => r.scope === 'project')).toHaveLength(5)
  })

  it('v2.0: copilot project has mcp-tools rule targeting .vscode/', () => {
    const rule = BUILTIN_RULES.find(
      (r) => r.tool === 'copilot' && r.scope === 'project' && r.targetDir === '.vscode/',
    )
    expect(rule).toBeDefined()
    expect(rule!.sourceDir).toBe('mcp-tools')
    expect(rule!.type).toBe(InstallType.Files)
  })

  it('v2.0: claude has 7 rules (3 global + 4 project, including project root CLAUDE.md)', () => {
    const claudeRules = BUILTIN_RULES.filter((r) => r.tool === 'claude')
    expect(claudeRules).toHaveLength(7)
    expect(claudeRules.filter((r) => r.scope === 'global')).toHaveLength(3)
    expect(claudeRules.filter((r) => r.scope === 'project')).toHaveLength(4)
  })

  it('v2.0: claude has global instructions rule targeting ~/.claude/', () => {
    const rule = BUILTIN_RULES.find(
      (r) => r.tool === 'claude' && r.scope === 'global' && r.sourceDir === 'instructions',
    )
    expect(rule).toBeDefined()
    expect(rule!.targetDir).toBe('~/.claude/')
    expect(rule!.type).toBe(InstallType.Files)
    expect(rule!.fileFilter).toEqual(['CLAUDE.md'])
  })

  it('v2.0: claude has project instructions rule targeting .claude/', () => {
    const rule = BUILTIN_RULES.find(
      (r) => r.tool === 'claude' && r.scope === 'project' && r.sourceDir === 'instructions',
    )
    expect(rule).toBeDefined()
    expect(rule!.targetDir).toBe('.claude/')
    expect(rule!.type).toBe(InstallType.Files)
    expect(rule!.fileFilter).toEqual(['CLAUDE.md'])
  })

  it('Epic 7 matrix: claude has project root instructions rule targeting ./', () => {
    const rule = BUILTIN_RULES.find(
      (r) => r.tool === 'claude' && r.scope === 'project' && r.targetDir === './',
    )
    expect(rule).toBeDefined()
    expect(rule!.sourceDir).toBe('instructions')
    expect(rule!.type).toBe(InstallType.Files)
    expect(rule!.fileFilter).toEqual(['CLAUDE.md'])
  })

  it('Story 7-3: copilot instructions rules filter AGENTS.md only', () => {
    const rules = BUILTIN_RULES.filter(
      (r) => r.tool === 'copilot' && r.sourceDir === 'instructions',
    )
    expect(rules).toHaveLength(2)
    for (const rule of rules) {
      expect(rule.fileFilter).toEqual(['AGENTS.md'])
    }
  })

  it('v2.0: cursor has 4 rules (2 global + 2 project, including new global agents rule)', () => {
    const cursorRules = BUILTIN_RULES.filter((r) => r.tool === 'cursor')
    expect(cursorRules).toHaveLength(4)
    expect(cursorRules.filter((r) => r.scope === 'global')).toHaveLength(2)
    expect(cursorRules.filter((r) => r.scope === 'project')).toHaveLength(2)
  })

  it('v2.0: cursor has global agents rule targeting ~/.cursor/rules/', () => {
    const rule = BUILTIN_RULES.find(
      (r) => r.tool === 'cursor' && r.scope === 'global' && r.sourceDir === 'agents',
    )
    expect(rule).toBeDefined()
    expect(rule!.targetDir).toBe('~/.cursor/rules/')
    expect(rule!.type).toBe(InstallType.Files)
  })

  it('uses valid InstallType values only', () => {
    const validTypes = new Set([InstallType.Files, InstallType.Directories, InstallType.Flatten])
    for (const rule of BUILTIN_RULES) {
      expect(validTypes.has(rule.type)).toBe(true)
    }
  })

  it('cursor skills use Flatten type', () => {
    const cursorSkills = BUILTIN_RULES.filter(
      (r) => r.tool === 'cursor' && r.sourceDir === 'skills',
    )
    expect(cursorSkills.length).toBeGreaterThan(0)
    for (const rule of cursorSkills) {
      expect(rule.type).toBe(InstallType.Flatten)
    }
  })

  it('Story 7-2: codex has 5 rules (skills global/project, agents global/project, mcp-tools global)', () => {
    const codexRules = BUILTIN_RULES.filter((r) => r.tool === 'codex')
    expect(codexRules).toHaveLength(5)
    expect(codexRules.filter((r) => r.sourceDir === 'skills')).toHaveLength(2)
    expect(codexRules.filter((r) => r.sourceDir === 'agents')).toHaveLength(2)
    expect(codexRules.filter((r) => r.sourceDir === 'mcp-tools')).toHaveLength(1)
  })

  it('Story 7-2: codex rule matrix uses expected install types and targets', () => {
    expect(BUILTIN_RULES).toContainEqual({
      tool: 'codex',
      scope: 'global',
      sourceDir: 'skills',
      type: InstallType.Directories,
      targetDir: '~/.codex/skills/',
    })
    expect(BUILTIN_RULES).toContainEqual({
      tool: 'codex',
      scope: 'project',
      sourceDir: 'skills',
      type: InstallType.Directories,
      targetDir: '.codex/skills/',
    })
    expect(BUILTIN_RULES).toContainEqual({
      tool: 'codex',
      scope: 'global',
      sourceDir: 'agents',
      type: InstallType.Files,
      targetDir: '~/.codex/agents/',
    })
    expect(BUILTIN_RULES).toContainEqual({
      tool: 'codex',
      scope: 'project',
      sourceDir: 'agents',
      type: InstallType.Files,
      targetDir: '.codex/agents/',
    })
  })

  it('Story 7-2: codex mcp-tools downgrade rule targets tool root, not a subdirectory', () => {
    const rule = BUILTIN_RULES.find(
      (r) => r.tool === 'codex' && r.scope === 'global' && r.sourceDir === 'mcp-tools',
    )
    expect(rule).toBeDefined()
    expect(rule!.type).toBe(InstallType.Files)
    expect(rule!.targetDir).toBe('~/.codex/')
  })

  it('Story 7-2: codex MCP merge hint points to config.toml [mcp]', () => {
    expect(MCP_MERGE_HINTS.codex).toEqual({
      targetFile: '~/.codex/config.toml',
      section: '[mcp]',
    })
  })

  it('Story 7-5: opencode has 7 rules (4 global + 3 project)', () => {
    const opencodeRules = BUILTIN_RULES.filter((r) => r.tool === 'opencode')
    expect(opencodeRules).toHaveLength(7)
    expect(opencodeRules.filter((r) => r.scope === 'global')).toHaveLength(4)
    expect(opencodeRules.filter((r) => r.scope === 'project')).toHaveLength(3)
  })

  it('Story 7-5: opencode rule matrix uses expected install types, targets, and AGENTS filter', () => {
    expect(BUILTIN_RULES).toContainEqual({
      tool: 'opencode',
      scope: 'global',
      sourceDir: 'skills',
      type: InstallType.Directories,
      targetDir: '~/.config/opencode/skills/',
    })
    expect(BUILTIN_RULES).toContainEqual({
      tool: 'opencode',
      scope: 'global',
      sourceDir: 'agents',
      type: InstallType.Files,
      targetDir: '~/.config/opencode/agents/',
    })
    expect(BUILTIN_RULES).toContainEqual({
      tool: 'opencode',
      scope: 'global',
      sourceDir: 'instructions',
      type: InstallType.Files,
      targetDir: '~/.config/opencode/',
      fileFilter: ['AGENTS.md'],
    })
    expect(BUILTIN_RULES).toContainEqual({
      tool: 'opencode',
      scope: 'global',
      sourceDir: 'mcp-tools',
      type: InstallType.Files,
      targetDir: '~/.config/opencode/',
    })
    expect(BUILTIN_RULES).toContainEqual({
      tool: 'opencode',
      scope: 'project',
      sourceDir: 'skills',
      type: InstallType.Directories,
      targetDir: '.opencode/skills/',
    })
    expect(BUILTIN_RULES).toContainEqual({
      tool: 'opencode',
      scope: 'project',
      sourceDir: 'agents',
      type: InstallType.Files,
      targetDir: '.opencode/agents/',
    })
    expect(BUILTIN_RULES).toContainEqual({
      tool: 'opencode',
      scope: 'project',
      sourceDir: 'mcp-tools',
      type: InstallType.Files,
      targetDir: '.opencode/',
    })
  })

  it('Story 7-5: opencode MCP merge hint points to opencode.json "mcp" field', () => {
    expect(MCP_MERGE_HINTS.opencode).toEqual({
      targetFile: '~/.config/opencode/opencode.json',
      section: '"mcp"',
    })
  })

  it('Story 7-3: auggie has 5 rules (skills global/project, agents global/project, instructions project)', () => {
    const auggieRules = BUILTIN_RULES.filter((r) => r.tool === 'auggie')
    expect(auggieRules).toHaveLength(5)
    expect(auggieRules.filter((r) => r.sourceDir === 'skills')).toHaveLength(2)
    expect(auggieRules.filter((r) => r.sourceDir === 'agents')).toHaveLength(2)
    expect(auggieRules.filter((r) => r.sourceDir === 'instructions')).toHaveLength(1)
  })

  it('Story 7-3: auggie rule matrix uses expected install types, targets, and instructions filter', () => {
    expect(BUILTIN_RULES).toContainEqual({
      tool: 'auggie',
      scope: 'global',
      sourceDir: 'skills',
      type: InstallType.Directories,
      targetDir: '~/.augment/skills/',
    })
    expect(BUILTIN_RULES).toContainEqual({
      tool: 'auggie',
      scope: 'global',
      sourceDir: 'agents',
      type: InstallType.Files,
      targetDir: '~/.augment/agents/',
    })
    expect(BUILTIN_RULES).toContainEqual({
      tool: 'auggie',
      scope: 'project',
      sourceDir: 'skills',
      type: InstallType.Directories,
      targetDir: '.augment/skills/',
    })
    expect(BUILTIN_RULES).toContainEqual({
      tool: 'auggie',
      scope: 'project',
      sourceDir: 'agents',
      type: InstallType.Files,
      targetDir: '.augment/agents/',
    })
    expect(BUILTIN_RULES).toContainEqual({
      tool: 'auggie',
      scope: 'project',
      sourceDir: 'instructions',
      type: InstallType.Files,
      targetDir: './',
      fileFilter: ['AGENTS.md'],
    })
  })

  it('Story 7-4: gemini has 4 rules (skills global/project, instructions global/project)', () => {
    const geminiRules = BUILTIN_RULES.filter((r) => r.tool === 'gemini')
    expect(geminiRules).toHaveLength(4)
    expect(geminiRules.filter((r) => r.sourceDir === 'skills')).toHaveLength(2)
    expect(geminiRules.filter((r) => r.sourceDir === 'instructions')).toHaveLength(2)
  })

  it('Story 7-4: gemini rule matrix uses expected install types, targets, and instructions filter', () => {
    expect(BUILTIN_RULES).toContainEqual({
      tool: 'gemini',
      scope: 'global',
      sourceDir: 'skills',
      type: InstallType.Directories,
      targetDir: '~/.gemini/skills/',
    })
    expect(BUILTIN_RULES).toContainEqual({
      tool: 'gemini',
      scope: 'global',
      sourceDir: 'instructions',
      type: InstallType.Files,
      targetDir: '~/.gemini/',
      fileFilter: ['AGENTS.md', 'GEMINI.md'],
    })
    expect(BUILTIN_RULES).toContainEqual({
      tool: 'gemini',
      scope: 'project',
      sourceDir: 'skills',
      type: InstallType.Directories,
      targetDir: '.gemini/skills/',
    })
    expect(BUILTIN_RULES).toContainEqual({
      tool: 'gemini',
      scope: 'project',
      sourceDir: 'instructions',
      type: InstallType.Files,
      targetDir: './',
      fileFilter: ['AGENTS.md', 'GEMINI.md'],
    })
  })

  it('Story 7-6: windsurf has 5 rules (skills/rules global+project, agents→workflows project)', () => {
    const windsurfRules = BUILTIN_RULES.filter((r) => r.tool === 'windsurf')
    expect(windsurfRules).toHaveLength(5)
    expect(windsurfRules.filter((r) => r.scope === 'global')).toHaveLength(2)
    expect(windsurfRules.filter((r) => r.scope === 'project')).toHaveLength(3)
  })

  it('Story 7-6: windsurf rule matrix uses expected targets and semantic warning', () => {
    expect(BUILTIN_RULES).toContainEqual({
      tool: 'windsurf',
      scope: 'global',
      sourceDir: 'skills',
      type: InstallType.Directories,
      targetDir: '~/.codeium/windsurf/skills/',
    })
    expect(BUILTIN_RULES).toContainEqual({
      tool: 'windsurf',
      scope: 'global',
      sourceDir: 'rules',
      type: InstallType.Files,
      targetDir: '~/.codeium/windsurf/rules/',
    })
    expect(BUILTIN_RULES).toContainEqual({
      tool: 'windsurf',
      scope: 'project',
      sourceDir: 'skills',
      type: InstallType.Directories,
      targetDir: '.windsurf/skills/',
    })
    expect(BUILTIN_RULES).toContainEqual({
      tool: 'windsurf',
      scope: 'project',
      sourceDir: 'rules',
      type: InstallType.Files,
      targetDir: '.windsurf/rules/',
    })
    expect(BUILTIN_RULES).toContainEqual({
      tool: 'windsurf',
      scope: 'project',
      sourceDir: 'agents',
      type: InstallType.Files,
      targetDir: '.windsurf/workflows/',
      semanticWarning: 'windsurfAgentsToWorkflows',
    })
  })

  it('Story 7-7: kiro has 4 rules (skills/instructions global+project)', () => {
    const kiroRules = BUILTIN_RULES.filter((r) => r.tool === 'kiro')
    expect(kiroRules).toHaveLength(4)
    expect(kiroRules.filter((r) => r.scope === 'global')).toHaveLength(2)
    expect(kiroRules.filter((r) => r.scope === 'project')).toHaveLength(2)
  })

  it('Story 7-7: kiro rule matrix uses expected targets and AGENTS filter', () => {
    expect(BUILTIN_RULES).toContainEqual({
      tool: 'kiro',
      scope: 'global',
      sourceDir: 'skills',
      type: InstallType.Directories,
      targetDir: '~/.kiro/skills/',
    })
    expect(BUILTIN_RULES).toContainEqual({
      tool: 'kiro',
      scope: 'global',
      sourceDir: 'instructions',
      type: InstallType.Files,
      targetDir: '~/.kiro/steering/',
      fileFilter: ['AGENTS.md'],
    })
    expect(BUILTIN_RULES).toContainEqual({
      tool: 'kiro',
      scope: 'project',
      sourceDir: 'skills',
      type: InstallType.Directories,
      targetDir: '.kiro/skills/',
    })
    expect(BUILTIN_RULES).toContainEqual({
      tool: 'kiro',
      scope: 'project',
      sourceDir: 'instructions',
      type: InstallType.Files,
      targetDir: '.kiro/steering/',
      fileFilter: ['AGENTS.md'],
    })
  })
})

describe('data/install-rules — RULE_INDEX (AC: #1)', () => {
  it('is a Map keyed by tool:scope', () => {
    expect(RULE_INDEX).toBeInstanceOf(Map)
  })

  it('has entries for all tool:scope combos present in BUILTIN_RULES', () => {
    const expectedKeys = new Set(BUILTIN_RULES.map((r) => `${r.tool}:${r.scope}`))
    for (const key of expectedKeys) {
      expect(RULE_INDEX.has(key)).toBe(true)
    }
  })

  it('lookup copilot:global returns 4 rules', () => {
    const rules = RULE_INDEX.get('copilot:global')
    expect(rules).toBeDefined()
    expect(rules).toHaveLength(4)
  })

  it('v2.0: lookup copilot:project returns 5 rules (including new .vscode/ mcp rule)', () => {
    const rules = RULE_INDEX.get('copilot:project')
    expect(rules).toBeDefined()
    expect(rules).toHaveLength(5)
  })

  it('v2.0: lookup claude:global returns 3 rules (agents + skills + instructions)', () => {
    const rules = RULE_INDEX.get('claude:global')
    expect(rules).toBeDefined()
    expect(rules).toHaveLength(3)
  })

  it('Epic 7 matrix: lookup claude:project returns 4 rules', () => {
    const rules = RULE_INDEX.get('claude:project')
    expect(rules).toBeDefined()
    expect(rules).toHaveLength(4)
  })

  it('Story 7-2: lookup codex:global returns 3 rules', () => {
    const rules = RULE_INDEX.get('codex:global')
    expect(rules).toBeDefined()
    expect(rules).toHaveLength(3)
  })

  it('Story 7-2: lookup codex:project returns 2 rules', () => {
    const rules = RULE_INDEX.get('codex:project')
    expect(rules).toBeDefined()
    expect(rules).toHaveLength(2)
  })

  it('Story 7-5: lookup opencode:global returns 4 rules', () => {
    const rules = RULE_INDEX.get('opencode:global')
    expect(rules).toBeDefined()
    expect(rules).toHaveLength(4)
  })

  it('Story 7-5: lookup opencode:project returns 3 rules', () => {
    const rules = RULE_INDEX.get('opencode:project')
    expect(rules).toBeDefined()
    expect(rules).toHaveLength(3)
  })

  it('Story 7-3: lookup auggie:global returns 2 rules', () => {
    const rules = RULE_INDEX.get('auggie:global')
    expect(rules).toBeDefined()
    expect(rules).toHaveLength(2)
  })

  it('Story 7-3: lookup auggie:project returns 3 rules', () => {
    const rules = RULE_INDEX.get('auggie:project')
    expect(rules).toBeDefined()
    expect(rules).toHaveLength(3)
  })

  it('Story 7-4: lookup gemini:global returns 2 rules', () => {
    const rules = RULE_INDEX.get('gemini:global')
    expect(rules).toBeDefined()
    expect(rules).toHaveLength(2)
  })

  it('Story 7-4: lookup gemini:project returns 2 rules', () => {
    const rules = RULE_INDEX.get('gemini:project')
    expect(rules).toBeDefined()
    expect(rules).toHaveLength(2)
  })

  it('Story 7-6: lookup windsurf:global returns 2 rules', () => {
    const rules = RULE_INDEX.get('windsurf:global')
    expect(rules).toBeDefined()
    expect(rules).toHaveLength(2)
  })

  it('Story 7-6: lookup windsurf:project returns 3 rules', () => {
    const rules = RULE_INDEX.get('windsurf:project')
    expect(rules).toBeDefined()
    expect(rules).toHaveLength(3)
  })

  it('Story 7-7: lookup kiro:global returns 2 rules', () => {
    const rules = RULE_INDEX.get('kiro:global')
    expect(rules).toBeDefined()
    expect(rules).toHaveLength(2)
  })

  it('Story 7-7: lookup kiro:project returns 2 rules', () => {
    const rules = RULE_INDEX.get('kiro:project')
    expect(rules).toBeDefined()
    expect(rules).toHaveLength(2)
  })

  it('lookup for non-existent key returns undefined', () => {
    expect(RULE_INDEX.get('nonexistent:global')).toBeUndefined()
  })

  it('total rules in RULE_INDEX equals BUILTIN_RULES length', () => {
    let total = 0
    for (const rules of RULE_INDEX.values()) {
      total += rules.length
    }
    expect(total).toBe(BUILTIN_RULES.length)
  })
})

describe('data/install-rules — loadRules() (AC: #1)', () => {
  it('returns BUILTIN_RULES in MVP', () => {
    const rules = loadRules()
    expect(rules).toEqual(BUILTIN_RULES)
  })

  it('returns a new reference each call (defensive copy or same ref is acceptable for MVP)', () => {
    const rules = loadRules()
    expect(rules).toBeDefined()
    expect(Array.isArray(rules)).toBe(true)
  })
})

describe('data/install-rules — TOOL_PRECONDITIONS (Story 7-4)', () => {
  it('registers gemini version precondition for skills only', () => {
    expect(TOOL_PRECONDITIONS.gemini).toBeDefined()
    expect(TOOL_PRECONDITIONS.gemini.affectedSourceDirs).toEqual(['skills'])
    expect(typeof TOOL_PRECONDITIONS.gemini.check).toBe('function')
  })
})

describe('data/install-rules — module boundary (AC: #5)', () => {
  it('has no runtime imports from other src directories', () => {
    const filePath = resolve(process.cwd(), 'src/data/install-rules.ts')
    const content = readFileSync(filePath, 'utf-8')
    const importLines = content
      .split('\n')
      .filter((l) => l.match(/^\s*import\s/) && !l.match(/^\s*import\s+type\s/))
    for (const line of importLines) {
      expect(line).not.toMatch(/from\s+['"]\.\.\/(?:core|stages|services|commands)/)
    }
  })
})
describe('data/install-rules — UNIVERSAL_RULES (Story 6-3)', () => {
  it('UNIVERSAL_RULES 包含 4 条规则', () => {
    expect(UNIVERSAL_RULES).toHaveLength(4)
  })

  it('所有规则的 tool 均为 universal', () => {
    for (const rule of UNIVERSAL_RULES) {
      expect(rule.tool).toBe('universal')
    }
  })

  it('所有规则的 scope 均为 project', () => {
    for (const rule of UNIVERSAL_RULES) {
      expect(rule.scope).toBe('project')
    }
  })

  it('覆盖 .agents/skills/ .agents/agents/ .agent/skills/ .agent/agents/ 四条路径', () => {
    const targets = UNIVERSAL_RULES.map((r) => r.targetDir)
    expect(targets).toContain('.agents/skills/')
    expect(targets).toContain('.agents/agents/')
    expect(targets).toContain('.agent/skills/')
    expect(targets).toContain('.agent/agents/')
  })

  it('UNIVERSAL_RULES 不存在于 RULE_INDEX', () => {
    const allIndexed = Array.from(RULE_INDEX.values()).flat()
    for (const rule of UNIVERSAL_RULES) {
      expect(allIndexed).not.toContainEqual(rule)
    }
  })
})
