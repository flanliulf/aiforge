import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { MESSAGES, ICONS, STATS_FORMAT } from '../../src/data/messages.js'

describe('data/messages — MESSAGES phases (AC: #4)', () => {
  it('contains Chinese progress phase names', () => {
    expect(MESSAGES.phases).toBeDefined()
    expect(typeof MESSAGES.phases.resolve).toBe('string')
    expect(typeof MESSAGES.phases.auth).toBe('string')
    expect(typeof MESSAGES.phases.clone).toBe('string')
    expect(typeof MESSAGES.phases.detect).toBe('string')
    expect(typeof MESSAGES.phases.match).toBe('string')
    expect(typeof MESSAGES.phases.install).toBe('string')
  })

  it('phase names are in Chinese', () => {
    // 验证包含中文字符
    const chineseRegex = /[\u4e00-\u9fff]/
    expect(MESSAGES.phases.resolve).toMatch(chineseRegex)
    expect(MESSAGES.phases.auth).toMatch(chineseRegex)
    expect(MESSAGES.phases.clone).toMatch(chineseRegex)
    expect(MESSAGES.phases.detect).toMatch(chineseRegex)
    expect(MESSAGES.phases.match).toMatch(chineseRegex)
    expect(MESSAGES.phases.install).toMatch(chineseRegex)
  })

  it('phase names end with "..."', () => {
    expect(MESSAGES.phases.resolve).toMatch(/\.\.\.$/)
    expect(MESSAGES.phases.auth).toMatch(/\.\.\.$/)
    expect(MESSAGES.phases.clone).toMatch(/\.\.\.$/)
    expect(MESSAGES.phases.detect).toMatch(/\.\.\.$/)
    expect(MESSAGES.phases.match).toMatch(/\.\.\.$/)
    expect(MESSAGES.phases.install).toMatch(/\.\.\.$/)
  })
})

describe('data/messages — ICONS (AC: #4)', () => {
  it('has new icon ✅', () => {
    expect(ICONS.new).toBe('✅')
  })

  it('has updated icon 🔄', () => {
    expect(ICONS.updated).toBe('🔄')
  })

  it('has skipped icon ⏭️', () => {
    expect(ICONS.skipped).toBe('⏭️')
  })

  it('has failed icon ❌', () => {
    expect(ICONS.failed).toBe('❌')
  })

  it('contains all four AC#4 required icons', () => {
    // AC#4 要求: ✅🔄⏭️❌
    expect(Object.keys(ICONS)).toHaveLength(4)
    expect(ICONS).toHaveProperty('new')
    expect(ICONS).toHaveProperty('updated')
    expect(ICONS).toHaveProperty('skipped')
    expect(ICONS).toHaveProperty('failed')
  })
})

describe('data/messages — STATS_FORMAT (AC: #4)', () => {
  it('is a function that produces stats line', () => {
    expect(typeof STATS_FORMAT).toBe('function')
  })

  it('formats stats with Chinese labels', () => {
    const result = STATS_FORMAT(3, 2, 1, 0)
    expect(result).toContain('3')
    expect(result).toContain('2')
    expect(result).toContain('1')
    // 验证包含中文
    expect(result).toMatch(/[\u4e00-\u9fff]/)
  })

  it('includes failed count in stats line', () => {
    const result = STATS_FORMAT(5, 2, 1, 3)
    expect(result).toContain('失败')
    expect(result).toContain('3')
  })

  it('matches architecture-defined format pattern', () => {
    // 04-implementation-patterns.md: 安装: 7 项  更新: 1 项  跳过: 1 项  失败: 0 项
    const result = STATS_FORMAT(7, 1, 1, 0)
    expect(result).toBe('安装: 7 项  更新: 1 项  跳过: 1 项  失败: 0 项')
  })
})

describe('data/messages — multi-language structure (AC: #4)', () => {
  it('MESSAGES object structure supports future language extensions', () => {
    // 验证使用对象结构组织（可扩展），而非散列字符串
    expect(typeof MESSAGES).toBe('object')
    expect(typeof MESSAGES.phases).toBe('object')
  })
})

describe('data/messages — module boundary (AC: #5)', () => {
  it('has no runtime imports from other src directories', () => {
    const filePath = resolve(process.cwd(), 'src/data/messages.ts')
    const content = readFileSync(filePath, 'utf-8')
    const importLines = content
      .split('\n')
      .filter((l) => l.match(/^\s*import\s/) && !l.match(/^\s*import\s+type\s/))
    for (const line of importLines) {
      expect(line).not.toMatch(/from\s+['"]\.\.\/(?:core|stages|services|commands)/)
    }
  })
})
