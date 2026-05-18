import { describe, it, expect, vi, beforeEach } from 'vitest'
import { execFile } from 'node:child_process'
import { checkGeminiVersion } from '../../src/services/version-check.js'

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}))

describe('services/version-check — checkGeminiVersion (Story 7-4)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns meetsRequirement=true for gemini version 0.30.0', async () => {
    vi.mocked(execFile).mockImplementation((_file, _args, _options, callback) => {
      callback?.(null, 'gemini version 0.30.0', '')
      return {} as ReturnType<typeof execFile>
    })

    await expect(checkGeminiVersion()).resolves.toEqual({
      version: '0.30.0',
      meetsRequirement: true,
    })
  })

  it('returns meetsRequirement=false for gemini version 0.20.0', async () => {
    vi.mocked(execFile).mockImplementation((_file, _args, _options, callback) => {
      callback?.(null, 'gemini version 0.20.0', '')
      return {} as ReturnType<typeof execFile>
    })

    await expect(checkGeminiVersion()).resolves.toEqual({
      version: '0.20.0',
      meetsRequirement: false,
    })
  })

  it('returns null version when gemini command is missing', async () => {
    vi.mocked(execFile).mockImplementation((_file, _args, _options, callback) => {
      callback?.(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }), '', '')
      return {} as ReturnType<typeof execFile>
    })

    await expect(checkGeminiVersion()).resolves.toEqual({
      version: null,
      meetsRequirement: false,
    })
  })

  it('returns null version when version command times out', async () => {
    vi.mocked(execFile).mockImplementation((_file, _args, _options, callback) => {
      callback?.(
        Object.assign(new Error('timeout'), { code: 'ETIMEDOUT', signal: 'SIGTERM' }),
        '',
        '',
      )
      return {} as ReturnType<typeof execFile>
    })

    await expect(checkGeminiVersion()).resolves.toEqual({
      version: null,
      meetsRequirement: false,
    })
  })
})
