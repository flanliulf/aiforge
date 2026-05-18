import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { TOOL_DEFINITIONS } from '../../src/data/tool-registry.js'

describe('data/tool-registry — TOOL_DEFINITIONS (AC: #1, Story 7-5)', () => {
  it('Story 7-5: contains exactly 7 tool definitions (opencode added on top of v2.0 set)', () => {
    expect(TOOL_DEFINITIONS).toHaveLength(7)
  })

  it('Story 7-5: covers copilot, claude, cursor, codex, opencode, auggie, gemini (no vscode)', () => {
    const ids = TOOL_DEFINITIONS.map((t) => t.id)
    expect(ids).toContain('copilot')
    expect(ids).toContain('claude')
    expect(ids).toContain('cursor')
    expect(ids).toContain('codex')
    expect(ids).toContain('opencode')
    expect(ids).toContain('auggie')
    expect(ids).toContain('gemini')
    expect(ids).not.toContain('vscode')
  })

  it('each tool has id, name, detect.global, detect.project', () => {
    for (const tool of TOOL_DEFINITIONS) {
      expect(typeof tool.id).toBe('string')
      expect(tool.id.length).toBeGreaterThan(0)
      expect(typeof tool.name).toBe('string')
      expect(tool.name.length).toBeGreaterThan(0)
      expect(Array.isArray(tool.detect.global)).toBe(true)
      expect(Array.isArray(tool.detect.project)).toBe(true)
    }
  })

  it('each tool has non-empty detect.global paths', () => {
    for (const tool of TOOL_DEFINITIONS) {
      expect(tool.detect.global.length).toBeGreaterThan(0)
    }
  })

  it('each tool has non-empty detect.project paths', () => {
    for (const tool of TOOL_DEFINITIONS) {
      expect(tool.detect.project.length).toBeGreaterThan(0)
    }
  })

  it('copilot detects via .copilot (global) and .github (project)', () => {
    const copilot = TOOL_DEFINITIONS.find((t) => t.id === 'copilot')!
    expect(copilot.detect.global.some((p) => p.includes('.copilot'))).toBe(true)
    expect(copilot.detect.project.some((p) => p.includes('.github'))).toBe(true)
  })

  it('claude detects via .claude (global and project)', () => {
    const claude = TOOL_DEFINITIONS.find((t) => t.id === 'claude')!
    expect(claude.detect.global.some((p) => p.includes('.claude'))).toBe(true)
    expect(claude.detect.project.some((p) => p.includes('.claude'))).toBe(true)
  })

  it('cursor detects via .cursor (global and project)', () => {
    const cursor = TOOL_DEFINITIONS.find((t) => t.id === 'cursor')!
    expect(cursor.detect.global.some((p) => p.includes('.cursor'))).toBe(true)
    expect(cursor.detect.project.some((p) => p.includes('.cursor'))).toBe(true)
  })

  it('Story 7-2: codex detects via .codex (global and project)', () => {
    const codex = TOOL_DEFINITIONS.find((t) => t.id === 'codex')!
    expect(codex.name).toBe('Codex CLI')
    expect(codex.detect.global).toEqual(['~/.codex'])
    expect(codex.detect.project).toEqual(['.codex'])
  })

  it('Story 7-5: opencode detects via XDG global path and .opencode project path', () => {
    const opencode = TOOL_DEFINITIONS.find((t) => t.id === 'opencode')!
    expect(opencode.name).toBe('OpenCode')
    expect(opencode.detect.global).toEqual(['~/.config/opencode'])
    expect(opencode.detect.project).toEqual(['.opencode'])
  })

  it('Story 7-3: auggie detects via .augment (global and project)', () => {
    const auggie = TOOL_DEFINITIONS.find((t) => t.id === 'auggie')!
    expect(auggie.name).toBe('Auggie (Augment Code)')
    expect(auggie.detect.global).toEqual(['~/.augment'])
    expect(auggie.detect.project).toEqual(['.augment'])
  })

  it('Story 7-4: gemini detects via .gemini (global and project)', () => {
    const gemini = TOOL_DEFINITIONS.find((t) => t.id === 'gemini')!
    expect(gemini.name).toBe('Gemini CLI')
    expect(gemini.detect.global).toEqual(['~/.gemini'])
    expect(gemini.detect.project).toEqual(['.gemini'])
  })

  it('all tool ids are unique', () => {
    const ids = TOOL_DEFINITIONS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('data/tool-registry — module boundary (AC: #5)', () => {
  it('has no runtime imports from other src directories', () => {
    const filePath = resolve(process.cwd(), 'src/data/tool-registry.ts')
    const content = readFileSync(filePath, 'utf-8')
    const importLines = content
      .split('\n')
      .filter((l) => l.match(/^\s*import\s/) && !l.match(/^\s*import\s+type\s/))
    for (const line of importLines) {
      expect(line).not.toMatch(/from\s+['"]\.\.\/(?:core|stages|services|commands)/)
    }
  })
})
