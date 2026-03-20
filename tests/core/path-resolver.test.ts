import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import os from 'os'

vi.mock('os')

const mockedHomedir = vi.mocked(os.homedir)

describe('UnixPathResolver', () => {
  beforeEach(() => {
    mockedHomedir.mockReturnValue('/home/testuser')
    vi.resetModules()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('home() returns os.homedir()', async () => {
    const { UnixPathResolver } = await import('../../src/core/path-resolver.js')
    const resolver = new UnixPathResolver()
    expect(resolver.home()).toBe('/home/testuser')
  })

  it('configDir() returns ~/.aiforge', async () => {
    const { UnixPathResolver } = await import('../../src/core/path-resolver.js')
    const resolver = new UnixPathResolver()
    expect(resolver.configDir()).toBe('/home/testuser/.aiforge')
  })

  it('reposDir() returns ~/.aiforge/repos', async () => {
    const { UnixPathResolver } = await import('../../src/core/path-resolver.js')
    const resolver = new UnixPathResolver()
    expect(resolver.reposDir()).toBe('/home/testuser/.aiforge/repos')
  })

  it('toolGlobalDir(toolId) returns ~/.aiforge/tools/{toolId}', async () => {
    const { UnixPathResolver } = await import('../../src/core/path-resolver.js')
    const resolver = new UnixPathResolver()
    expect(resolver.toolGlobalDir('claude')).toBe('/home/testuser/.aiforge/tools/claude')
  })

  it('toolProjectDir(toolId) returns .aiforge/tools/{toolId}', async () => {
    const { UnixPathResolver } = await import('../../src/core/path-resolver.js')
    const resolver = new UnixPathResolver()
    expect(resolver.toolProjectDir('cursor')).toBe('.aiforge/tools/cursor')
  })

  it('uses path.join() for path construction (no double slashes)', async () => {
    const { UnixPathResolver } = await import('../../src/core/path-resolver.js')
    const resolver = new UnixPathResolver()
    expect(resolver.configDir()).not.toContain('//')
    expect(resolver.reposDir()).not.toContain('//')
  })
})

describe('UnixPathResolver - empty homedir', () => {
  beforeEach(() => {
    mockedHomedir.mockReturnValue('')
    vi.resetModules()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('throws AiforgeError when homedir() returns empty string', async () => {
    const { UnixPathResolver } = await import('../../src/core/path-resolver.js')
    const { AiforgeError } = await import('../../src/core/errors.js')
    expect(() => new UnixPathResolver()).toThrow(AiforgeError)
  })

  it('throws AiforgeError with HOME message when homedir() is empty', async () => {
    const { UnixPathResolver } = await import('../../src/core/path-resolver.js')
    expect(() => new UnixPathResolver()).toThrowError(/HOME/)
  })
})

describe('UnixPathResolver - undefined homedir', () => {
  beforeEach(() => {
    mockedHomedir.mockReturnValue(undefined as unknown as string)
    vi.resetModules()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('throws AiforgeError when homedir() returns undefined', async () => {
    const { UnixPathResolver } = await import('../../src/core/path-resolver.js')
    const { AiforgeError } = await import('../../src/core/errors.js')
    expect(() => new UnixPathResolver()).toThrow(AiforgeError)
  })

  it('throws AiforgeError with HOME message when homedir() is undefined', async () => {
    const { UnixPathResolver } = await import('../../src/core/path-resolver.js')
    expect(() => new UnixPathResolver()).toThrowError(/HOME/)
  })
})
