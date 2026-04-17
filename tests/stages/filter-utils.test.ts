/**
 * tests/stages/filter-utils.test.ts
 *
 * 来源: Story 6.2 Task 6.1
 * 测试: parseFilterPattern() 和 matchesGlob()
 */

import { describe, it, expect } from 'vitest'
import { parseFilterPattern, matchesGlob } from '../../src/stages/filter-utils.js'

// ── parseFilterPattern ─────────────────────────────────────────

describe('parseFilterPattern', () => {
  it('带前缀: skills/git* → { dirPrefix: skills, glob: git* }', () => {
    const result = parseFilterPattern('skills/git*')
    expect(result).toEqual({ dirPrefix: 'skills', glob: 'git*' })
  })

  it('带前缀: agents/code-review → { dirPrefix: agents, glob: code-review }', () => {
    const result = parseFilterPattern('agents/code-review')
    expect(result).toEqual({ dirPrefix: 'agents', glob: 'code-review' })
  })

  it('不带前缀: git* → { dirPrefix: undefined, glob: git* }', () => {
    const result = parseFilterPattern('git*')
    expect(result).toEqual({ dirPrefix: undefined, glob: 'git*' })
  })

  it('不带前缀: ??? → { dirPrefix: undefined, glob: ??? }', () => {
    const result = parseFilterPattern('???')
    expect(result).toEqual({ dirPrefix: undefined, glob: '???' })
  })

  it('边界: 只有斜杠分割点，prefix 部分为 skills，glob 为空字符串', () => {
    const result = parseFilterPattern('skills/')
    expect(result).toEqual({ dirPrefix: 'skills', glob: '' })
  })

  it('边界: 多个斜杠时只以第一个为分割点', () => {
    const result = parseFilterPattern('skills/git/extra')
    expect(result).toEqual({ dirPrefix: 'skills', glob: 'git/extra' })
  })

  it('边界: 精确名称不含通配符', () => {
    const result = parseFilterPattern('skills/git-commit')
    expect(result).toEqual({ dirPrefix: 'skills', glob: 'git-commit' })
  })

  it('前缀包含连字符', () => {
    const result = parseFilterPattern('my-skills/foo*')
    expect(result).toEqual({ dirPrefix: 'my-skills', glob: 'foo*' })
  })
})

// ── matchesGlob ────────────────────────────────────────────────

describe('matchesGlob', () => {
  // * 通配符
  it('* 匹配任意字符串: git* 匹配 git-commit', () => {
    expect(matchesGlob('git-commit', 'git*')).toBe(true)
  })

  it('* 匹配任意字符串: git* 匹配 git-push', () => {
    expect(matchesGlob('git-push', 'git*')).toBe(true)
  })

  it('* 不匹配: git* 不匹配 code-review', () => {
    expect(matchesGlob('code-review', 'git*')).toBe(false)
  })

  it('* 匹配中间位置: *commit* 匹配 git-commit-helper', () => {
    expect(matchesGlob('git-commit-helper', '*commit*')).toBe(true)
  })

  it('纯 * 匹配任意字符串', () => {
    expect(matchesGlob('anything', '*')).toBe(true)
    expect(matchesGlob('', '*')).toBe(true)
  })

  // ? 单字符匹配
  it('? 匹配单个字符: gi? 匹配 git', () => {
    expect(matchesGlob('git', 'gi?')).toBe(true)
  })

  it('? 不匹配两个字符: gi? 不匹配 gitt', () => {
    expect(matchesGlob('gitt', 'gi?')).toBe(false)
  })

  it('? 不匹配零个字符: gi? 不匹配 gi', () => {
    expect(matchesGlob('gi', 'gi?')).toBe(false)
  })

  it('混合 * 和 ?: g?t* 匹配 git-commit', () => {
    expect(matchesGlob('git-commit', 'g?t*')).toBe(true)
  })

  // 精确匹配
  it('精确匹配: git-commit 匹配 git-commit', () => {
    expect(matchesGlob('git-commit', 'git-commit')).toBe(true)
  })

  it('精确匹配: 不一致则不匹配', () => {
    expect(matchesGlob('git-push', 'git-commit')).toBe(false)
  })

  // 正则特殊字符转义
  it('glob 中含点号时不作为正则点号: a.b 精确匹配 a.b', () => {
    expect(matchesGlob('a.b', 'a.b')).toBe(true)
  })

  it('glob 中含点号不匹配 aXb', () => {
    expect(matchesGlob('aXb', 'a.b')).toBe(false)
  })

  it('glob 含括号等正则特殊字符被转义', () => {
    expect(matchesGlob('a(b', 'a(b')).toBe(true)
    expect(matchesGlob('axb', 'a(b')).toBe(false)
  })

  // 空字符串 glob
  it('空 glob 只匹配空字符串', () => {
    expect(matchesGlob('', '')).toBe(true)
    expect(matchesGlob('a', '')).toBe(false)
  })
})
