import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { TOOL_DEFINITIONS } from '../../src/data/tool-registry.js'

describe('data/tool-registry — TOOL_DEFINITIONS (AC: #2, v2.0)', () => {
  it('v2.0: contains exactly 3 tool definitions (vscode removed)', () => {
    expect(TOOL_DEFINITIONS).toHaveLength(3)
  })

  it('v2.0: covers copilot, claude, cursor (no vscode)', () => {
    const ids = TOOL_DEFINITIONS.map((t) => t.id)
    expect(ids).toContain('copilot')
    expect(ids).toContain('claude')
    expect(ids).toContain('cursor')
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
