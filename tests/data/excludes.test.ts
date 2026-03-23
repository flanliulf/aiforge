import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { DEFAULT_EXCLUDES } from '../../src/data/excludes.js'

describe('data/excludes — DEFAULT_EXCLUDES (AC: #3)', () => {
  it('is an array of strings', () => {
    expect(Array.isArray(DEFAULT_EXCLUDES)).toBe(true)
    for (const item of DEFAULT_EXCLUDES) {
      expect(typeof item).toBe('string')
    }
  })

  it('contains README.md', () => {
    expect(DEFAULT_EXCLUDES).toContain('README.md')
  })

  it('contains README', () => {
    expect(DEFAULT_EXCLUDES).toContain('README')
  })

  it('contains .gitkeep', () => {
    expect(DEFAULT_EXCLUDES).toContain('.gitkeep')
  })

  it('contains .DS_Store', () => {
    expect(DEFAULT_EXCLUDES).toContain('.DS_Store')
  })

  it('contains mcp.json.example', () => {
    expect(DEFAULT_EXCLUDES).toContain('mcp.json.example')
  })

  it('contains at least 5 entries', () => {
    expect(DEFAULT_EXCLUDES.length).toBeGreaterThanOrEqual(5)
  })

  it('has no duplicate entries', () => {
    expect(new Set(DEFAULT_EXCLUDES).size).toBe(DEFAULT_EXCLUDES.length)
  })
})

describe('data/excludes — module boundary (AC: #5)', () => {
  it('has no runtime imports from other src directories', () => {
    const filePath = resolve(process.cwd(), 'src/data/excludes.ts')
    const content = readFileSync(filePath, 'utf-8')
    const importLines = content
      .split('\n')
      .filter((l) => l.match(/^\s*import\s/) && !l.match(/^\s*import\s+type\s/))
    for (const line of importLines) {
      expect(line).not.toMatch(/from\s+['"]\.\.\/(?:core|stages|services|commands)/)
    }
  })
})
