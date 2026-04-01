import { describe, it, expect } from 'vitest'
import { sanitizeToken, sanitizeUrl, sanitizeMessage } from '../../src/core/sanitize.js'

describe('sanitizeToken (AC: #3)', () => {
  it('masks token >= 12 chars: first 8 + **** + last 4', () => {
    expect(sanitizeToken('glpat-abcdefghijklmnop')).toBe('glpat-ab****mnop')
  })

  it('masks exactly 12 chars: first 4 + **** (no tail, boundary case)', () => {
    expect(sanitizeToken('abcdefghijkl')).toBe('abcd****')
  })

  it('masks token < 12 chars: first 4 + **** (no tail)', () => {
    expect(sanitizeToken('short_tok')).toBe('shor****')
  })

  it('masks token of exactly 13 chars: first 8 + **** + last 4', () => {
    expect(sanitizeToken('abcdefghijklm')).toBe('abcdefgh****jklm')
  })

  it('masks very short token (< 4 chars): first 4 + **** (uses available chars)', () => {
    const result = sanitizeToken('abc')
    expect(result).toContain('****')
  })

  it('masks a typical GitLab personal access token', () => {
    const token = 'glpat-xxxxxxxxxxxxxxxxxxxx'
    const result = sanitizeToken(token)
    expect(result).toMatch(/^glpat-xx\*{4}xxxx$/)
  })
})

describe('sanitizeUrl (AC: #4)', () => {
  it('masks token embedded in HTTPS URL', () => {
    const url = 'https://glpat-abcdefghijklmnop@gitlab.example.com/org/repo.git'
    const result = sanitizeUrl(url)
    expect(result).toContain('glpat-ab****mnop')
    expect(result).not.toContain('glpat-abcdefghijklmnop')
    expect(result).toContain('gitlab.example.com')
  })

  it('returns URL unchanged when no token present', () => {
    const url = 'https://gitlab.example.com/org/repo.git'
    expect(sanitizeUrl(url)).toBe(url)
  })

  it('masks short token in URL', () => {
    const url = 'https://shortok@gitlab.example.com/repo.git'
    const result = sanitizeUrl(url)
    expect(result).toContain('****')
    expect(result).not.toContain('shortok')
  })

  it('handles SSH URL without token (no change)', () => {
    const url = 'git@gitlab.example.com:org/repo.git'
    expect(sanitizeUrl(url)).toBe(url)
  })

  it('masks token in GitLab standard oauth2:token@host URL', () => {
    const url = 'https://oauth2:glpat-abcdefghijklmnop@gitlab.example.com/org/repo.git'
    const result = sanitizeUrl(url)
    expect(result).toBe('https://oauth2:glpat-ab****mnop@gitlab.example.com/org/repo.git')
    expect(result).not.toContain('glpat-abcdefghijklmnop')
  })

  it('masks short token in oauth2:token@host URL', () => {
    const url = 'https://oauth2:shortok@gitlab.example.com/repo.git'
    const result = sanitizeUrl(url)
    expect(result).toContain('oauth2:')
    expect(result).toContain('****')
    expect(result).not.toContain('shortok')
  })

  // CR Round 3 Fix: hostless token-bearing URL (bare @ with no host/path)
  it('masks token in hostless oauth2:token@ URL (bare @ ending)', () => {
    const url = 'https://oauth2:glpat-abcdefghijklmno@'
    const result = sanitizeUrl(url)
    expect(result).not.toContain('glpat-abcdefghijklmno')
    expect(result).toContain('glpat-ab****lmno')
    expect(result).toContain('oauth2:')
  })

  it('masks token in hostless token@ URL without oauth2 prefix', () => {
    const url = 'https://glpat-abcdefghijklmno@'
    const result = sanitizeUrl(url)
    expect(result).not.toContain('glpat-abcdefghijklmno')
    expect(result).toContain('glpat-ab****lmno')
  })
})

describe('sanitizeMessage (Story 5-4 Finding #2)', () => {
  it('masks token-bearing URL embedded in git error message', () => {
    const msg =
      'Could not resolve host: https://oauth2:glpat-supersecret1234@gitlab.example.com/org/repo.git'
    const result = sanitizeMessage(msg)
    expect(result).not.toContain('glpat-supersecret1234')
    expect(result).toContain('glpat-su****1234')
    expect(result).toContain('gitlab.example.com')
  })

  it('masks multiple token URLs in one message', () => {
    const msg =
      'clone from https://oauth2:token12345678@host1.com/repo1 and https://oauth2:secret9876@host2.com/repo2'
    const result = sanitizeMessage(msg)
    expect(result).not.toContain('token12345678')
    expect(result).not.toContain('secret9876')
  })

  it('leaves plain message without tokens unchanged', () => {
    const msg = '网络连接超时，请检查防火墙配置'
    expect(sanitizeMessage(msg)).toBe(msg)
  })

  it('masks token in fatal: repository not found style message', () => {
    const msg =
      "fatal: Authentication failed for 'https://oauth2:glpat-abcdefghijklmnop@gitlab.com/org/repo.git'"
    const result = sanitizeMessage(msg)
    expect(result).not.toContain('glpat-abcdefghijklmnop')
  })
})
