import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// 动态 import 确保每个测试组获取最新的模块状态
// messages.ts 维护模块级全局 language 状态，需在各测试组中 reset

describe('data/messages — MESSAGES phases (AC: #4 — 向后兼容)', () => {
  it('MESSAGES 对象仍然存在', async () => {
    const m = await import('../../src/data/messages.js')
    expect(m.MESSAGES).toBeDefined()
  })
})

describe('data/messages — setLanguage / msg (AC: #3)', () => {
  beforeEach(async () => {
    // 每个测试前重置为默认中文
    const m = await import('../../src/data/messages.js')
    m.setLanguage('zh-CN')
  })

  it('exports setLanguage function', async () => {
    const m = await import('../../src/data/messages.js')
    expect(typeof m.setLanguage).toBe('function')
  })

  it('exports msg function', async () => {
    const m = await import('../../src/data/messages.js')
    expect(typeof m.msg).toBe('function')
  })

  it('msg("phases.resolve") returns Chinese by default', async () => {
    const m = await import('../../src/data/messages.js')
    m.setLanguage('zh-CN')
    const result = m.msg('phases.resolve')
    expect(result).toMatch(/[\u4e00-\u9fff]/) // 含中文
    expect(result).toMatch(/\.\.\.$/) // 以 ... 结尾
  })

  it('msg("phases.auth") returns Chinese by default', async () => {
    const m = await import('../../src/data/messages.js')
    m.setLanguage('zh-CN')
    expect(m.msg('phases.auth')).toMatch(/[\u4e00-\u9fff]/)
  })

  it('msg("phases.clone") returns Chinese by default', async () => {
    const m = await import('../../src/data/messages.js')
    m.setLanguage('zh-CN')
    expect(m.msg('phases.clone')).toMatch(/[\u4e00-\u9fff]/)
  })

  it('msg("phases.detect") returns Chinese by default', async () => {
    const m = await import('../../src/data/messages.js')
    m.setLanguage('zh-CN')
    expect(m.msg('phases.detect')).toMatch(/[\u4e00-\u9fff]/)
  })

  it('msg("phases.match") returns Chinese by default', async () => {
    const m = await import('../../src/data/messages.js')
    m.setLanguage('zh-CN')
    expect(m.msg('phases.match')).toMatch(/[\u4e00-\u9fff]/)
  })

  it('msg("phases.install") returns Chinese by default', async () => {
    const m = await import('../../src/data/messages.js')
    m.setLanguage('zh-CN')
    expect(m.msg('phases.install')).toMatch(/[\u4e00-\u9fff]/)
  })

  it('setLanguage("en") switches to English phases', async () => {
    const m = await import('../../src/data/messages.js')
    m.setLanguage('en')
    expect(m.msg('phases.resolve')).toBe('Resolving repository...')
    expect(m.msg('phases.auth')).toBe('Authenticating...')
    expect(m.msg('phases.clone')).toBe('Cloning repository...')
    expect(m.msg('phases.detect')).toBe('Detecting AI tools...')
    expect(m.msg('phases.match')).toBe('Matching install rules...')
    expect(m.msg('phases.install')).toBe('Installing...')
  })

  it('setLanguage("zh-CN") returns Chinese phases', async () => {
    const m = await import('../../src/data/messages.js')
    m.setLanguage('zh-CN')
    expect(m.msg('phases.resolve')).toBe('解析仓库地址...')
    expect(m.msg('phases.auth')).toBe('验证认证信息...')
    expect(m.msg('phases.clone')).toBe('克隆仓库...')
    expect(m.msg('phases.detect')).toBe('检测 AI 工具...')
    expect(m.msg('phases.match')).toBe('匹配安装规则...')
    expect(m.msg('phases.install')).toBe('执行安装...')
  })

  it('invalid language falls back to zh-CN (AC: #5)', async () => {
    const m = await import('../../src/data/messages.js')
    m.setLanguage('fr') // 不支持的语言
    // 应回退到中文
    expect(m.msg('phases.resolve')).toMatch(/[\u4e00-\u9fff]/)
  })

  it('empty string falls back to zh-CN (AC: #5)', async () => {
    const m = await import('../../src/data/messages.js')
    m.setLanguage('')
    expect(m.msg('phases.resolve')).toMatch(/[\u4e00-\u9fff]/)
  })

  it('msg with dot notation traverses nested keys', async () => {
    const m = await import('../../src/data/messages.js')
    m.setLanguage('zh-CN')
    const result = m.msg('phases.resolve')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('msg with unknown key returns empty string', async () => {
    const m = await import('../../src/data/messages.js')
    m.setLanguage('zh-CN')
    const result = m.msg('nonexistent.key.deep')
    expect(result).toBe('')
  })
})

describe('data/messages — English message content (AC: #3, Task 1.3-1.5)', () => {
  it('English status icons labels are present', async () => {
    const m = await import('../../src/data/messages.js')
    m.setLanguage('en')
    // 测试 icons 标签（通过 msg 获取）
    expect(m.msg('icons.new')).toBe('✅')
    expect(m.msg('icons.updated')).toBe('🔄')
    expect(m.msg('icons.skipped')).toBe('⏭️')
  })
})

describe('data/messages — ICONS (向后兼容)', () => {
  it('has new icon ✅', async () => {
    const m = await import('../../src/data/messages.js')
    expect(m.ICONS.new).toBe('✅')
  })

  it('has updated icon 🔄', async () => {
    const m = await import('../../src/data/messages.js')
    expect(m.ICONS.updated).toBe('🔄')
  })

  it('has skipped icon ⏭️', async () => {
    const m = await import('../../src/data/messages.js')
    expect(m.ICONS.skipped).toBe('⏭️')
  })

  it('has failed icon ❌', async () => {
    const m = await import('../../src/data/messages.js')
    expect(m.ICONS.failed).toBe('❌')
  })
})

describe('data/messages — STATS_FORMAT (向后兼容)', () => {
  it('formats stats with Chinese labels', async () => {
    const m = await import('../../src/data/messages.js')
    const result = m.STATS_FORMAT(3, 2, 1, 0)
    expect(result).toContain('3')
    expect(result).toContain('2')
    expect(result).toContain('1')
    expect(result).toMatch(/[\u4e00-\u9fff]/)
  })

  it('matches architecture-defined format pattern', async () => {
    const m = await import('../../src/data/messages.js')
    const result = m.STATS_FORMAT(7, 1, 1, 0)
    expect(result).toBe('安装: 7 项  更新: 1 项  跳过: 1 项  失败: 0 项')
  })
})

describe('core/messages — module boundary (AC: #5)', () => {
  it('core/messages.ts has no runtime imports from other src directories', () => {
    const filePath = resolve(process.cwd(), 'src/core/messages.ts')
    const content = readFileSync(filePath, 'utf-8')
    const importLines = content
      .split('\n')
      .filter((l) => l.match(/^\s*import\s/) && !l.match(/^\s*import\s+type\s/))
    for (const line of importLines) {
      expect(line).not.toMatch(/from\s+['"]\.\.\/(?:data|stages|services|commands)/)
    }
  })
})
