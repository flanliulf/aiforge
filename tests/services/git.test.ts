import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ResolvedSource } from '../../src/core/types.js'
import { AiforgeError } from '../../src/core/errors.js'

// Mock simple-git at module level
vi.mock('simple-git')

import simpleGit from 'simple-git'
import { GitSourceResolver, createGit } from '../../src/services/git.js'

describe('services/git', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  // ── GitSourceResolver ──────────────────────────────────────

  describe('GitSourceResolver', () => {
    const resolver = new GitSourceResolver()

    // ── canHandle (Task 2.2) ──

    describe('canHandle', () => {
      it('should return true for HTTPS URL with .git suffix', () => {
        expect(resolver.canHandle('https://gitlab.com/org/repo.git')).toBe(true)
      })

      it('should return true for HTTPS URL without .git suffix', () => {
        expect(resolver.canHandle('https://gitlab.com/org/repo')).toBe(true)
      })

      it('should return false for HTTP URL (only HTTPS supported, not plain HTTP)', () => {
        expect(resolver.canHandle('http://gitlab.com/org/repo.git')).toBe(false)
      })

      it('should return true for SCP-style SSH URL: git@host:org/repo.git', () => {
        expect(resolver.canHandle('git@gitlab.com:org/repo.git')).toBe(true)
      })

      it('should return true for ssh:// protocol URL', () => {
        expect(resolver.canHandle('ssh://git@gitlab.com/org/repo.git')).toBe(true)
      })

      it('should return false for local path', () => {
        expect(resolver.canHandle('/home/user/repos/my-repo')).toBe(false)
      })

      it('should return false for empty string', () => {
        expect(resolver.canHandle('')).toBe(false)
      })

      it('should return false for relative path', () => {
        expect(resolver.canHandle('./my-repo')).toBe(false)
      })
    })

    // ── resolve (Task 2.3) ──

    describe('resolve', () => {
      it('should resolve HTTPS URL to ResolvedSource', async () => {
        const result = await resolver.resolve('https://gitlab.com/org/repo.git')

        expect(result).toEqual<ResolvedSource>({
          hostname: 'gitlab.com',
          repoPath: 'org/repo',
          protocol: 'https',
        })
      })

      it('should resolve SCP-style SSH URL to ResolvedSource', async () => {
        const result = await resolver.resolve('git@gitlab.com:org/repo.git')

        expect(result).toEqual<ResolvedSource>({
          hostname: 'gitlab.com',
          repoPath: 'org/repo',
          protocol: 'ssh',
        })
      })

      it('should resolve ssh:// URL to ResolvedSource', async () => {
        const result = await resolver.resolve('ssh://git@gitlab.com/org/repo.git')

        expect(result).toEqual<ResolvedSource>({
          hostname: 'gitlab.com',
          repoPath: 'org/repo',
          protocol: 'ssh',
        })
      })

      it('should strip .git suffix from repoPath', async () => {
        const result = await resolver.resolve('https://gitlab.com/org/repo.git')

        expect(result.repoPath).toBe('org/repo')
      })

      it('should handle URL without .git suffix', async () => {
        const result = await resolver.resolve('https://gitlab.com/org/repo')

        expect(result.repoPath).toBe('org/repo')
      })
    })

    // ── resolve negative cases (CR Fix: Finding #2) ──

    describe('resolve error handling', () => {
      it('should throw INVALID_URL for non-URL string', async () => {
        await expect(resolver.resolve('not-a-url')).rejects.toThrow(AiforgeError)
        await expect(resolver.resolve('not-a-url')).rejects.toMatchObject({
          code: 'INVALID_URL',
          severity: 'fatal',
        })
      })

      it('should throw INVALID_URL for empty string', async () => {
        await expect(resolver.resolve('')).rejects.toThrow(AiforgeError)
        await expect(resolver.resolve('')).rejects.toMatchObject({
          code: 'INVALID_URL',
          severity: 'fatal',
        })
      })

      it('should throw INVALID_URL for random text', async () => {
        await expect(resolver.resolve('hello world')).rejects.toThrow(AiforgeError)
        await expect(resolver.resolve('hello world')).rejects.toMatchObject({
          code: 'INVALID_URL',
        })
      })

      // CR Round 5 Fix: host-only URLs without repo path
      it('should throw INVALID_URL for HTTPS host-only URL (no repo path)', async () => {
        await expect(resolver.resolve('https://gitlab.com')).rejects.toThrow(AiforgeError)
        await expect(resolver.resolve('https://gitlab.com')).rejects.toMatchObject({
          code: 'INVALID_URL',
          severity: 'fatal',
        })
      })

      it('should throw INVALID_URL for ssh:// host-only URL (no repo path)', async () => {
        await expect(resolver.resolve('ssh://git@gitlab.com')).rejects.toThrow(AiforgeError)
        await expect(resolver.resolve('ssh://git@gitlab.com')).rejects.toMatchObject({
          code: 'INVALID_URL',
          severity: 'fatal',
        })
      })

      // CR Round 6 Fix: SCP-style SSH with path that normalizes to empty repoPath
      it('should throw INVALID_URL for SCP-style SSH URL whose path normalizes to empty (git@host:.git)', async () => {
        await expect(resolver.resolve('git@gitlab.com:.git')).rejects.toThrow(AiforgeError)
        await expect(resolver.resolve('git@gitlab.com:.git')).rejects.toMatchObject({
          code: 'INVALID_URL',
          severity: 'fatal',
        })
      })
    })

    // ── unsupported protocol (CR Fix Round 2: Finding #1) ──

    describe('unsupported protocol handling', () => {
      it('should throw UNSUPPORTED_PROTOCOL for ftp:// URL', async () => {
        await expect(resolver.resolve('ftp://example.com/org/repo.git')).rejects.toThrow(
          AiforgeError,
        )
        await expect(resolver.resolve('ftp://example.com/org/repo.git')).rejects.toMatchObject({
          code: 'UNSUPPORTED_PROTOCOL',
          severity: 'fatal',
        })
      })

      it('should throw UNSUPPORTED_PROTOCOL for file:// URL', async () => {
        await expect(resolver.resolve('file:///tmp/repo.git')).rejects.toThrow(AiforgeError)
        await expect(resolver.resolve('file:///tmp/repo.git')).rejects.toMatchObject({
          code: 'UNSUPPORTED_PROTOCOL',
          severity: 'fatal',
        })
      })

      it('should throw UNSUPPORTED_PROTOCOL for custom scheme', async () => {
        await expect(resolver.resolve('custom://host/path')).rejects.toThrow(AiforgeError)
        await expect(resolver.resolve('custom://host/path')).rejects.toMatchObject({
          code: 'UNSUPPORTED_PROTOCOL',
        })
      })

      // CR Round 4 Fix: http:// is not supported, only https://
      it('should throw UNSUPPORTED_PROTOCOL for http:// URL', async () => {
        await expect(resolver.resolve('http://gitlab.com/org/repo.git')).rejects.toThrow(
          AiforgeError,
        )
        await expect(resolver.resolve('http://gitlab.com/org/repo.git')).rejects.toMatchObject({
          code: 'UNSUPPORTED_PROTOCOL',
          severity: 'fatal',
        })
      })
    })

    // ── token sanitization in error messages (CR Fix Round 2: Finding #2) ──

    describe('error message sanitization', () => {
      it('should sanitize token-bearing URL in INVALID_URL error why field', async () => {
        // URL with token that is invalid (new URL throws) but sanitizeUrl can match
        const tokenUrl = 'https://oauth2:glpat-abcdefghijklmno@:bad/repo'
        try {
          await resolver.resolve(tokenUrl)
          expect.fail('should have thrown')
        } catch (err) {
          expect(err).toBeInstanceOf(AiforgeError)
          const aiErr = err as AiforgeError
          // why field must NOT contain the raw token
          expect(aiErr.why).not.toContain('glpat-abcdefghijklmno')
          // why field should contain sanitized version
          expect(aiErr.why).toContain('glpat-ab****lmno')
        }
      })

      // CR Round 3 Fix: hostless token-bearing URL (bare @ with no host/path)
      it('should sanitize hostless token-bearing URL in INVALID_URL error why field', async () => {
        const tokenUrl = 'https://oauth2:glpat-abcdefghijklmno@'
        try {
          await resolver.resolve(tokenUrl)
          expect.fail('should have thrown')
        } catch (err) {
          expect(err).toBeInstanceOf(AiforgeError)
          const aiErr = err as AiforgeError
          // why field must NOT contain the raw token
          expect(aiErr.why).not.toContain('glpat-abcdefghijklmno')
          // why field should contain sanitized version
          expect(aiErr.why).toContain('glpat-ab****lmno')
        }
      })
    })
  })

  // ── createGit (Task 2.4) ──

  describe('createGit', () => {
    it('should call simpleGit without options when no baseDir', () => {
      createGit()

      expect(simpleGit).toHaveBeenCalledWith(undefined)
    })

    it('should call simpleGit with baseDir option when provided', () => {
      createGit('/tmp/repo')

      expect(simpleGit).toHaveBeenCalledWith({ baseDir: '/tmp/repo' })
    })
  })
})
