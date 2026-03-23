import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { InstallType } from '../../src/core/types.js'
import { BUILTIN_RULES, RULE_INDEX, loadRules } from '../../src/data/install-rules.js'

describe('data/install-rules — BUILTIN_RULES (AC: #1)', () => {
  it('contains exactly 16 MVP rules', () => {
    expect(BUILTIN_RULES).toHaveLength(16)
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

  it('covers all 4 tools: copilot, claude, cursor, vscode', () => {
    const tools = new Set(BUILTIN_RULES.map((r) => r.tool))
    expect(tools).toEqual(new Set(['copilot', 'claude', 'cursor', 'vscode']))
  })

  it('covers both global and project scopes', () => {
    const scopes = new Set(BUILTIN_RULES.map((r) => r.scope))
    expect(scopes).toEqual(new Set(['global', 'project']))
  })

  it('copilot has 8 rules (4 global + 4 project)', () => {
    const copilotRules = BUILTIN_RULES.filter((r) => r.tool === 'copilot')
    expect(copilotRules).toHaveLength(8)
    expect(copilotRules.filter((r) => r.scope === 'global')).toHaveLength(4)
    expect(copilotRules.filter((r) => r.scope === 'project')).toHaveLength(4)
  })

  it('claude has 4 rules (2 global + 2 project)', () => {
    const claudeRules = BUILTIN_RULES.filter((r) => r.tool === 'claude')
    expect(claudeRules).toHaveLength(4)
    expect(claudeRules.filter((r) => r.scope === 'global')).toHaveLength(2)
    expect(claudeRules.filter((r) => r.scope === 'project')).toHaveLength(2)
  })

  it('cursor has 3 rules', () => {
    const cursorRules = BUILTIN_RULES.filter((r) => r.tool === 'cursor')
    expect(cursorRules).toHaveLength(3)
  })

  it('vscode has 1 rule (global mcp-tools)', () => {
    const vscodeRules = BUILTIN_RULES.filter((r) => r.tool === 'vscode')
    expect(vscodeRules).toHaveLength(1)
    expect(vscodeRules[0].scope).toBe('global')
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

  it('lookup copilot:project returns 4 rules', () => {
    const rules = RULE_INDEX.get('copilot:project')
    expect(rules).toBeDefined()
    expect(rules).toHaveLength(4)
  })

  it('lookup claude:global returns 2 rules', () => {
    const rules = RULE_INDEX.get('claude:global')
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
