import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createReporter } from '../../src/core/reporter.js'
import type { Reporter } from '../../src/core/reporter.js'

describe('createReporter', () => {
  it('returns TtyReporter when isTty=true and quiet=false', () => {
    const reporter = createReporter({ quiet: false, isTty: true })
    expect(reporter).toBeDefined()
    expect(typeof reporter.startPhase).toBe('function')
    expect(typeof reporter.updatePhase).toBe('function')
    expect(typeof reporter.completePhase).toBe('function')
    expect(typeof reporter.reportResult).toBe('function')
    expect(typeof reporter.reportPlan).toBe('function')
    expect(typeof reporter.reportError).toBe('function')
    expect(typeof reporter.warn).toBe('function')
  })

  it('returns PlainReporter when isTty=false and quiet=false', () => {
    const reporter = createReporter({ quiet: false, isTty: false })
    expect(reporter).toBeDefined()
    expect(typeof reporter.startPhase).toBe('function')
  })

  it('returns QuietReporter when quiet=true regardless of isTty', () => {
    const reporter1 = createReporter({ quiet: true, isTty: true })
    const reporter2 = createReporter({ quiet: true, isTty: false })
    expect(reporter1).toBeDefined()
    expect(reporter2).toBeDefined()
  })
})

describe('PlainReporter', () => {
  let reporter: Reporter
  let stderrSpy: ReturnType<typeof vi.spyOn>
  let stdoutSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    reporter = createReporter({ quiet: false, isTty: false })
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('startPhase writes to stderr', () => {
    reporter.startPhase('解析仓库地址...')
    expect(stderrSpy).toHaveBeenCalled()
    const output = stderrSpy.mock.calls[0][0] as string
    expect(output).toContain('解析仓库地址...')
  })

  it('updatePhase writes to stderr', () => {
    reporter.updatePhase('正在处理...')
    expect(stderrSpy).toHaveBeenCalled()
  })

  it('completePhase writes to stderr', () => {
    reporter.completePhase()
    expect(stderrSpy).toHaveBeenCalled()
  })

  it('warn writes to stderr', () => {
    reporter.warn('警告信息')
    expect(stderrSpy).toHaveBeenCalled()
    const output = stderrSpy.mock.calls[0][0] as string
    expect(output).toContain('警告信息')
  })

  it('reportResult writes to stdout', () => {
    reporter.reportResult({
      items: [{ status: 'new', sourcePath: 'src/foo.ts', targetPath: 'dist/foo.ts' }],
    })
    expect(stdoutSpy).toHaveBeenCalled()
  })

  it('reportPlan writes to stdout', () => {
    reporter.reportPlan({
      items: [
        {
          rule: { tool: 'claude', scope: 'global', sourceDir: 'agents', type: 0 as never, targetDir: '~/.claude' },
          sourceFiles: [],
          targetPath: '~/.claude/agents',
        },
      ],
    })
    expect(stdoutSpy).toHaveBeenCalled()
  })

  it('reportError writes to stderr', async () => {
    const { AiforgeError } = await import('../../src/core/errors.js')
    const err = new AiforgeError('test', 'ERR_TEST', 1, 'fatal', 'why', ['fix'])
    reporter.reportError(err)
    expect(stderrSpy).toHaveBeenCalled()
  })

  it('output contains no ANSI escape codes', () => {
    reporter.startPhase('测试阶段')
    const output = stderrSpy.mock.calls[0][0] as string
    // ANSI escape codes start with \x1b[
    // eslint-disable-next-line no-control-regex
    expect(output).not.toMatch(/\x1b\[/)
  })
})

describe('TtyReporter', () => {
  let reporter: Reporter
  let stderrSpy: ReturnType<typeof vi.spyOn>
  let stdoutSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    reporter = createReporter({ quiet: false, isTty: true })
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reportResult writes to stdout', () => {
    reporter.reportResult({
      items: [{ status: 'new', sourcePath: 'src/foo.ts', targetPath: 'dist/foo.ts' }],
    })
    expect(stdoutSpy).toHaveBeenCalled()
    const output = stdoutSpy.mock.calls[0][0] as string
    expect(output).toContain('dist/foo.ts')
  })

  it('reportPlan writes to stdout', () => {
    reporter.reportPlan({
      items: [
        {
          rule: { tool: 'claude', scope: 'global', sourceDir: 'agents', type: 0 as never, targetDir: '~/.claude' },
          sourceFiles: [],
          targetPath: '~/.claude/agents',
        },
      ],
    })
    expect(stdoutSpy).toHaveBeenCalled()
  })

  it('reportError writes to stderr', async () => {
    const { AiforgeError } = await import('../../src/core/errors.js')
    const err = new AiforgeError('test', 'ERR_TEST', 1, 'fatal', 'why', ['fix'])
    reporter.reportError(err)
    expect(stderrSpy).toHaveBeenCalled()
    const allOutput = stderrSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('test')
  })

  it('warn writes to stderr', () => {
    reporter.warn('TTY 警告')
    expect(stderrSpy).toHaveBeenCalled()
    const output = stderrSpy.mock.calls[0][0] as string
    expect(output).toContain('TTY 警告')
  })

  it('updatePhase writes to stderr when no spinner active', () => {
    reporter.updatePhase('fallback 消息')
    expect(stderrSpy).toHaveBeenCalled()
    const output = stderrSpy.mock.calls[0][0] as string
    expect(output).toContain('fallback 消息')
  })

  // AC #2: startPhase 启动 ora spinner
  // 技术背景: ora v8+ 纯 ESM，无法直接 mock 实例；但在非 TTY 测试环境中 ora.isEnabled=false，
  // start() 会走 "!isEnabled" 分支，输出 "- {text}\n" 到 stream — 可通过内容断言严格验证
  it('startPhase initiates ora spinner with phase name written to stderr (AC #2)', () => {
    reporter.startPhase('解析仓库地址...')
    expect(stderrSpy).toHaveBeenCalled()
    const allOutput = stderrSpy.mock.calls.map((c) => c[0] as string).join('')
    // ora 在非 TTY 环境 start() 输出 "- {text}\n"，内容包含传入的阶段名
    expect(allOutput).toContain('解析仓库地址...')
  })

  // AC #2: completePhase 调用 spinner.succeed()
  // ora.succeed() 调用 stopAndPersist()，输出 "✔ {currentText}\n" — 可通过 ✔ 符号严格验证
  it('completePhase calls spinner.succeed() writing success symbol to stderr (AC #2)', () => {
    reporter.startPhase('解析仓库地址...')
    stderrSpy.mockClear()
    reporter.completePhase()
    expect(stderrSpy).toHaveBeenCalled()
    const allOutput = stderrSpy.mock.calls.map((c) => c[0] as string).join('')
    // ora.succeed() 输出以 ✔ 开头的成功行，严格锁定 succeed() 语义
    expect(allOutput).toContain('✔')
  })

  // AC #2: updatePhase 在 spinner 激活时更新 spinner.text 而非走 fallback 路径
  // 验证策略: startPhase('A') → updatePhase('B') → completePhase() 输出包含 'B'（succeed 用最新 text）
  // 若 updatePhase 实际未更新 spinner.text，succeed 输出的仍是 'A'，断言失败
  it('updatePhase updates spinner text (verified via succeed output containing updated text) (AC #2)', () => {
    reporter.startPhase('初始阶段...')
    reporter.updatePhase('更新后的文字...')
    stderrSpy.mockClear()
    reporter.completePhase()
    const allOutput = stderrSpy.mock.calls.map((c) => c[0] as string).join('')
    // succeed() 输出使用 spinner 当前 text；若 updatePhase 成功更新了 text，输出应包含新文字
    expect(allOutput).toContain('更新后的文字...')
  })
})

describe('QuietReporter', () => {
  let reporter: Reporter
  let stderrSpy: ReturnType<typeof vi.spyOn>
  let stdoutSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    reporter = createReporter({ quiet: true, isTty: false })
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('startPhase is a no-op', () => {
    reporter.startPhase('阶段')
    expect(stderrSpy).not.toHaveBeenCalled()
  })

  it('updatePhase is a no-op', () => {
    reporter.updatePhase('更新')
    expect(stderrSpy).not.toHaveBeenCalled()
  })

  it('completePhase is a no-op', () => {
    reporter.completePhase()
    expect(stderrSpy).not.toHaveBeenCalled()
  })

  it('warn is a no-op', () => {
    reporter.warn('警告')
    expect(stderrSpy).not.toHaveBeenCalled()
  })

  it('reportResult writes to stdout', () => {
    reporter.reportResult({ items: [] })
    expect(stdoutSpy).toHaveBeenCalled()
  })

  it('reportResult includes explicit success signal', () => {
    reporter.reportResult({
      items: [{ status: 'new', sourcePath: 'src/a.ts', targetPath: 'dist/a.ts' }],
    })
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('✓')
  })

  it('reportResult includes stats line', () => {
    reporter.reportResult({
      items: [
        { status: 'new', sourcePath: 'src/a.ts', targetPath: 'dist/a.ts' },
        { status: 'updated', sourcePath: 'src/b.ts', targetPath: 'dist/b.ts' },
        { status: 'skipped', sourcePath: 'src/c.ts', targetPath: 'dist/c.ts' },
      ],
    })
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('安装: 1 项')
    expect(allOutput).toContain('更新: 1 项')
    expect(allOutput).toContain('跳过: 1 项')
  })

  it('reportError writes to stderr', async () => {
    const { AiforgeError } = await import('../../src/core/errors.js')
    const err = new AiforgeError('test', 'ERR_TEST', 1, 'fatal', 'why', ['fix'])
    reporter.reportError(err)
    expect(stderrSpy).toHaveBeenCalled()
  })
})
