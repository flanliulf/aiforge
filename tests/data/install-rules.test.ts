import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { InstallType } from '../../src/core/types.js'
import {
  BUILTIN_RULES,
  RULE_INDEX,
  UNIVERSAL_RULES,
  loadRules,
} from '../../src/data/install-rules.js'

describe('data/install-rules — BUILTIN_RULES (AC: #1, v2.0)', () => {
  it('contains exactly 19 rules (v2.0: +4 new rules -1 vscode = 16+3)', () => {
    expect(BUILTIN_RULES).toHaveLength(19)
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

  it('v2.0: covers 3 tools (vscode removed): copilot, claude, cursor', () => {
    const tools = new Set(BUILTIN_RULES.map((r) => r.tool))
    expect(tools).toEqual(new Set(['copilot', 'claude', 'cursor']))
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

  it('v2.0: claude has 6 rules (3 global + 3 project, including new instructions rules)', () => {
    const claudeRules = BUILTIN_RULES.filter((r) => r.tool === 'claude')
    expect(claudeRules).toHaveLength(6)
    expect(claudeRules.filter((r) => r.scope === 'global')).toHaveLength(3)
    expect(claudeRules.filter((r) => r.scope === 'project')).toHaveLength(3)
  })

  it('v2.0: claude has global instructions rule targeting ~/.claude/', () => {
    const rule = BUILTIN_RULES.find(
      (r) => r.tool === 'claude' && r.scope === 'global' && r.sourceDir === 'instructions',
    )
    expect(rule).toBeDefined()
    expect(rule!.targetDir).toBe('~/.claude/')
    expect(rule!.type).toBe(InstallType.Files)
  })

  it('v2.0: claude has project instructions rule targeting .claude/', () => {
    const rule = BUILTIN_RULES.find(
      (r) => r.tool === 'claude' && r.scope === 'project' && r.sourceDir === 'instructions',
    )
    expect(rule).toBeDefined()
    expect(rule!.targetDir).toBe('.claude/')
    expect(rule!.type).toBe(InstallType.Files)
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
