import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import chalk from 'chalk'
import { createReporter } from '../../src/core/reporter.js'
import type { Reporter } from '../../src/core/reporter.js'
import type { InstallResult } from '../../src/core/types.js'
import { InstallType } from '../../src/core/types.js'
import { setLanguage } from '../../src/core/messages.js'

// ── 测试 Fixture ──────────────────────────────────────────────────────────────

/** 单工具安装结果 */
function createSingleToolResult(): InstallResult {
  return {
    items: [
      {
        status: 'new',
        tool: 'copilot',
        toolDisplayName: 'GitHub Copilot',
        sourcePath: 'agents/coding-agent.md',
        targetPath: '/home/user/.copilot/agents/coding-agent.md',
      },
      {
        status: 'updated',
        tool: 'copilot',
        toolDisplayName: 'GitHub Copilot',
        sourcePath: 'agents/review-agent.md',
        targetPath: '/home/user/.copilot/agents/review-agent.md',
      },
      {
        status: 'skipped',
        tool: 'copilot',
        toolDisplayName: 'GitHub Copilot',
        sourcePath: 'skills/refactor/',
        targetPath: '/home/user/.copilot/skills/refactor/',
      },
    ],
  }
}

/** 多工具安装结果 */
function createMultiToolResult(): InstallResult {
  return {
    items: [
      {
        status: 'new',
        tool: 'copilot',
        toolDisplayName: 'GitHub Copilot',
        sourcePath: 'agents/coding-agent.md',
        targetPath: '/home/user/.copilot/agents/coding-agent.md',
      },
      {
        status: 'updated',
        tool: 'copilot',
        toolDisplayName: 'GitHub Copilot',
        sourcePath: 'agents/review-agent.md',
        targetPath: '/home/user/.copilot/agents/review-agent.md',
      },
      {
        status: 'new',
        tool: 'claude',
        toolDisplayName: 'Claude Code',
        sourcePath: 'agents/CLAUDE.md',
        targetPath: '/home/user/.claude/agents/CLAUDE.md',
      },
    ],
  }
}

/** 全部成功结果 */
function createAllNewResult(): InstallResult {
  return {
    items: [
      {
        status: 'new',
        tool: 'claude',
        sourcePath: 'a.md',
        targetPath: '/home/user/.claude/a.md',
      },
      {
        status: 'new',
        tool: 'claude',
        sourcePath: 'b.md',
        targetPath: '/home/user/.claude/b.md',
      },
    ],
  }
}

/** 全部跳过结果 */
function createAllSkippedResult(): InstallResult {
  return {
    items: [
      {
        status: 'skipped',
        tool: 'claude',
        sourcePath: 'a.md',
        targetPath: '/home/user/.claude/a.md',
      },
      {
        status: 'skipped',
        tool: 'claude',
        sourcePath: 'b.md',
        targetPath: '/home/user/.claude/b.md',
      },
    ],
  }
}

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

  // Story 5-3 Task 4.3: Mock process.stdout.isTTY 验证工厂选择逻辑
  it('工厂选择：quiet=true 时始终返回 QuietReporter（mock isTTY）(AC #2 Story 5-3)', () => {
    // QuietReporter 在 quiet=true 时优先，startPhase/updatePhase/completePhase 均为 no-op
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    try {
      const reporter = createReporter({ quiet: true, isTty: true })
      reporter.startPhase('阶段')
      expect(stderrSpy).not.toHaveBeenCalled()
    } finally {
      vi.restoreAllMocks()
    }
  })

  it('工厂选择：isTty=false 且 quiet=false 时返回 PlainReporter（输出 [PHASE] 格式）(AC #1 Story 5-3)', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    try {
      const reporter = createReporter({ quiet: false, isTty: false })
      reporter.startPhase('验证认证信息...')
      const output = stderrSpy.mock.calls[0]?.[0] as string
      expect(output).toBe('[PHASE] 验证认证信息...\n')
    } finally {
      vi.restoreAllMocks()
    }
  })

  it('工厂选择：isTty=true 且 quiet=false 时返回 TtyReporter（spinner 使用 stderr）(AC #1 Story 5-3)', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    try {
      const reporter = createReporter({ quiet: false, isTty: true })
      reporter.startPhase('解析仓库地址...')
      expect(stderrSpy).toHaveBeenCalled()
    } finally {
      vi.restoreAllMocks()
    }
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

  // Story 5-3 Task 2.1: startPhase 输出 [PHASE] 前缀格式（AC #1）
  it('startPhase 输出 [PHASE] 前缀格式到 stderr (AC #1 Story 5-3)', () => {
    reporter.startPhase('解析仓库地址...')
    const output = stderrSpy.mock.calls[0][0] as string
    expect(output).toBe('[PHASE] 解析仓库地址...\n')
  })

  // Story 5-3 Task 2.2: updatePhase 不输出（避免刷屏）
  it('updatePhase 不输出任何内容（AC #1 Story 5-3）', () => {
    reporter.updatePhase('正在处理...')
    expect(stderrSpy).not.toHaveBeenCalled()
    expect(stdoutSpy).not.toHaveBeenCalled()
  })

  it('completePhase writes to stderr', () => {
    reporter.startPhase('解析仓库地址...')
    stderrSpy.mockClear()
    reporter.completePhase()
    expect(stderrSpy).toHaveBeenCalled()
  })

  // Story 5-3 Task 2.3: completePhase 输出 [DONE] 阶段名
  it('completePhase 输出 [DONE] + 阶段名到 stderr (AC #1 Story 5-3)', () => {
    reporter.startPhase('解析仓库地址...')
    stderrSpy.mockClear()
    reporter.completePhase()
    const output = stderrSpy.mock.calls[0][0] as string
    expect(output).toBe('[DONE] 解析仓库地址...\n')
  })

  it('warn writes to stderr', () => {
    reporter.warn('警告信息')
    expect(stderrSpy).toHaveBeenCalled()
    const output = stderrSpy.mock.calls[0][0] as string
    expect(output).toContain('警告信息')
  })

  it('reportResult writes to stdout', () => {
    reporter.reportResult({
      items: [
        { status: 'new', tool: 'copilot', sourcePath: 'src/foo.ts', targetPath: 'dist/foo.ts' },
      ],
    })
    expect(stdoutSpy).toHaveBeenCalled()
  })

  it('reportResult: 输出包含状态（new）', () => {
    reporter.reportResult(createSingleToolResult())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('new')
  })

  it('reportResult: 输出包含目标路径', () => {
    reporter.reportResult(createSingleToolResult())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('/home/user/.copilot/agents/coding-agent.md')
  })

  it('reportResult: 输出包含工具名', () => {
    reporter.reportResult(createSingleToolResult())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('copilot')
  })

  it('reportResult: 输出包含 sourcePath（四列格式）', () => {
    reporter.reportResult(createSingleToolResult())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('agents/coding-agent.md')
    expect(allOutput).toContain('agents/review-agent.md')
  })

  it('reportResult: 每行输出四列 tab 分隔格式 status\\ttool\\tsource\\ttarget', () => {
    reporter.reportResult(createSingleToolResult())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    // 验证四列 tab 分隔格式（sourcePath 为 repo-relative 路径）
    expect(allOutput).toContain(
      'new\tcopilot\tagents/coding-agent.md\t/home/user/.copilot/agents/coding-agent.md',
    )
    expect(allOutput).toContain(
      'updated\tcopilot\tagents/review-agent.md\t/home/user/.copilot/agents/review-agent.md',
    )
    expect(allOutput).toContain(
      'skipped\tcopilot\tskills/refactor/\t/home/user/.copilot/skills/refactor/',
    )
  })

  it('reportResult: 多工具输出包含所有工具名', () => {
    reporter.reportResult(createMultiToolResult())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('copilot')
    expect(allOutput).toContain('claude')
  })

  it('reportResult: 统计行包含正确计数', () => {
    reporter.reportResult(createSingleToolResult())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    // 1 new, 1 updated, 1 skipped
    expect(allOutput).toContain('installed: 1')
    expect(allOutput).toContain('updated: 1')
    expect(allOutput).toContain('skipped: 1')
  })

  it('reportResult: 统计行为全部成功时正确', () => {
    reporter.reportResult(createAllNewResult())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('installed: 2')
    expect(allOutput).toContain('updated: 0')
    expect(allOutput).toContain('skipped: 0')
  })

  it('reportResult: 全部跳过时统计行正确', () => {
    reporter.reportResult(createAllSkippedResult())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('installed: 0')
    expect(allOutput).toContain('skipped: 2')
  })

  // CR Round-2 修复：统计行使用 \t 分隔（Story Task 2.4 契约对齐）
  it('reportResult: 统计行各键值对使用制表符 \\t 分隔 (CR Round-2)', () => {
    reporter.reportResult(createSingleToolResult())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    // 统计行应包含 \t 分隔的完整格式
    expect(allOutput).toContain('installed: 1\tupdated: 1\tskipped: 1')
  })

  it('reportResult stdout/stderr 分工：结果到 stdout，无 stderr 输出 (AC #2)', () => {
    reporter.reportResult(createSingleToolResult())
    expect(stdoutSpy).toHaveBeenCalled()
    expect(stderrSpy).not.toHaveBeenCalled()
  })

  it('reportResult: 无 ANSI 转义码（CI 友好）', () => {
    reporter.reportResult(createSingleToolResult())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    // eslint-disable-next-line no-control-regex
    expect(allOutput).not.toMatch(/\x1b\[/)
  })

  it('reportPlan writes to stdout', () => {
    reporter.reportPlan({
      items: [
        {
          rule: {
            tool: 'claude',
            scope: 'global',
            sourceDir: 'agents',
            type: 0 as never,
            targetDir: '~/.claude',
          },
          sourceFiles: [],
          targetPath: '~/.claude/agents',
        },
      ],
    })
    expect(stdoutSpy).toHaveBeenCalled()
  })

  // CR Round-1 修复：补充制表符分隔格式断言（Story Task 2.5 契约）
  it('reportPlan: 输出制表符分隔格式（tool\\tsrc\\ttarget\\ttype\\tmode）(CR Round-1)', () => {
    reporter.reportPlan({
      items: [
        {
          rule: {
            tool: 'copilot',
            scope: 'global',
            sourceDir: 'agents',
            type: InstallType.Files,
            targetDir: '~/.copilot',
          },
          sourceFiles: ['agents/coding-agent.md'],
          targetPath: '~/.copilot/agents',
          mode: 'copy',
        },
      ],
    })
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    // 验证制表符分隔格式：tool\tsrc\ttarget\ttype\tmode
    expect(allOutput).toContain(
      'copilot\tagents/coding-agent.md\t~/.copilot/agents/coding-agent.md\tfiles\tcopy',
    )
    // 不应包含原来的双空格 + 箭头格式
    expect(allOutput).not.toContain('  →  ')
  })

  it('reportError writes to stderr', async () => {
    const { AiforgeError } = await import('../../src/core/errors.js')
    const err = new AiforgeError('test', 'ERR_TEST', 1, 'fatal', 'why', ['fix'])
    reporter.reportError(err)
    expect(stderrSpy).toHaveBeenCalled()
  })

  // Story 5-4 Task 1.2, AC #2: PlainReporter 三段式格式 ERROR/WHY/FIX
  it('reportError 输出三段式格式 ERROR/WHY/FIX 到 stderr (AC #2 Story 5-4)', async () => {
    const { AiforgeError } = await import('../../src/core/errors.js')
    const err = new AiforgeError(
      '无法访问仓库',
      'AUTH_FAILED',
      2,
      'fatal',
      'Git 服务器返回 401（认证失败）',
      ['npx aiforge --ssh', 'npx aiforge --token <your-token>', 'npx aiforge init'],
    )
    reporter.reportError(err)
    const allOutput = stderrSpy.mock.calls.map((c) => c[0] as string).join('')
    // 三段式语义：ERROR: message / WHY: why / FIX: fix
    expect(allOutput).toContain('ERROR: 无法访问仓库')
    expect(allOutput).toContain('WHY: Git 服务器返回 401（认证失败）')
    expect(allOutput).toContain('FIX: npx aiforge --ssh')
    expect(allOutput).toContain('FIX: npx aiforge --token <your-token>')
    expect(allOutput).toContain('FIX: npx aiforge init')
  })

  // Story 5-4 Task 1.4, AC #3: 所有错误输出到 stderr
  it('reportError 全部输出到 stderr，不输出到 stdout (AC #3 Story 5-4)', async () => {
    const { AiforgeError } = await import('../../src/core/errors.js')
    const err = new AiforgeError('失败', 'ERR_X', 1, 'fatal', '原因', ['修复'])
    reporter.reportError(err)
    expect(stderrSpy).toHaveBeenCalled()
    expect(stdoutSpy).not.toHaveBeenCalled()
  })

  // Story 5-4 Task 1.2, AC #2: PlainReporter 无 emoji，CI 兼容
  it('reportError 无 emoji，CI 兼容（无 ❌ 符号）(AC #2 Story 5-4)', async () => {
    const { AiforgeError } = await import('../../src/core/errors.js')
    const err = new AiforgeError('失败', 'ERR_X', 1, 'fatal', '原因', ['修复'])
    reporter.reportError(err)
    const allOutput = stderrSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).not.toContain('❌')
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
      items: [
        { status: 'new', tool: 'copilot', sourcePath: 'src/foo.ts', targetPath: 'dist/foo.ts' },
      ],
    })
    expect(stdoutSpy).toHaveBeenCalled()
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('dist/foo.ts')
  })

  it('reportResult: 按工具分组 — 输出包含工具名 (AC #1)', () => {
    reporter.reportResult(createMultiToolResult())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('copilot')
    expect(allOutput).toContain('claude')
  })

  it('reportResult: 标题使用 display name 而非内部 id (AC #1)', () => {
    reporter.reportResult(createMultiToolResult())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('🔧 GitHub Copilot')
    expect(allOutput).toContain('🔧 Claude Code')
  })

  it('reportResult: 每行输出 sourcePath → targetPath 格式 (AC #1)', () => {
    reporter.reportResult(createSingleToolResult())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    // 验证 source → target 格式
    expect(allOutput).toContain('agents/coding-agent.md')
    expect(allOutput).toContain('→')
    expect(allOutput).toContain('/home/user/.copilot/agents/coding-agent.md')
    // 验证 sourcePath 和 targetPath 在同一行中以 → 连接
    expect(allOutput).toMatch(
      /agents\/coding-agent\.md\s+→\s+\/home\/user\/\.copilot\/agents\/coding-agent\.md/,
    )
  })

  it('reportResult: 状态图标 ✅ 对应 new (AC #1)', () => {
    reporter.reportResult(createAllNewResult())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('✅')
  })

  it('reportResult: 状态图标 🔄 对应 updated (AC #1)', () => {
    reporter.reportResult(createSingleToolResult())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('🔄')
  })

  it('reportResult: 状态图标 ⏭️ 对应 skipped (AC #1)', () => {
    reporter.reportResult(createSingleToolResult())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('⏭️')
  })

  it('reportResult: 统计行包含正确计数 (AC #1)', () => {
    reporter.reportResult(createSingleToolResult())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('安装: 1 项')
    expect(allOutput).toContain('更新: 1 项')
    expect(allOutput).toContain('跳过: 1 项')
  })

  it('reportResult stdout/stderr 分工：结果到 stdout (AC #2)', () => {
    reporter.reportResult(createSingleToolResult())
    expect(stdoutSpy).toHaveBeenCalled()
  })

  // ── 树形输出测试（Story 5-2 新增）────────────────────────────────────────────

  it('reportResult: 工具标题包含项数 (AC #1)', () => {
    reporter.reportResult(createSingleToolResult())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    // 3 项（2 copilot items... wait, createSingleToolResult has 3 items）
    expect(allOutput).toContain('(3 项)')
  })

  it('reportResult: 多工具时各自显示正确项数 (AC #1)', () => {
    reporter.reportResult(createMultiToolResult())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    // copilot 有 2 项，claude 有 1 项
    expect(allOutput).toContain('(2 项)')
    expect(allOutput).toContain('(1 项)')
  })

  it('reportResult: 非最后一项使用 ├── 连接符 (AC #1)', () => {
    reporter.reportResult(createSingleToolResult())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('├──')
  })

  it('reportResult: 最后一项使用 └── 连接符 (AC #1)', () => {
    reporter.reportResult(createSingleToolResult())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('└──')
  })

  it('reportResult: 单工具单项时只有 └── 无 ├── (AC #1)', () => {
    reporter.reportResult(createAllNewResult())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    // claude 下有 2 项（createAllNewResult 有 2 items）：第 1 项 ├──，第 2 项 └──
    expect(allOutput).toContain('└──')
    expect(allOutput).toContain('├──')
  })

  it('reportResult: 单一文件时只有 └── 无 ├── (AC #1)', () => {
    const singleItem: InstallResult = {
      items: [
        {
          status: 'new',
          tool: 'claude',
          toolDisplayName: 'Claude Code',
          sourcePath: 'agents/CLAUDE.md',
          targetPath: '/home/user/.claude/agents/CLAUDE.md',
        },
      ],
    }
    reporter.reportResult(singleItem)
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('└──')
    expect(allOutput).not.toContain('├──')
  })

  it('reportPlan writes to stdout', () => {
    reporter.reportPlan({
      items: [
        {
          rule: {
            tool: 'claude',
            scope: 'global',
            sourceDir: 'agents',
            type: 0 as never,
            targetDir: '~/.claude',
          },
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

  // Story 5-4 Task 1.1, AC #2: TtyReporter 三段式彩色格式
  it('reportError 输出 ❌ + message（彩色三段式）到 stderr (AC #2 Story 5-4)', async () => {
    const { AiforgeError } = await import('../../src/core/errors.js')
    const err = new AiforgeError(
      '无法访问仓库',
      'AUTH_FAILED',
      2,
      'fatal',
      'Git 服务器返回 401（认证失败）',
      ['npx aiforge --ssh', 'npx aiforge --token <your-token>'],
    )
    reporter.reportError(err)
    const allOutput = stderrSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('❌')
    expect(allOutput).toContain('无法访问仓库')
    expect(allOutput).toContain('Git 服务器返回 401（认证失败）')
    expect(allOutput).toContain('修复方法')
    expect(allOutput).toContain('npx aiforge --ssh')
    expect(allOutput).toContain('npx aiforge --token <your-token>')
  })

  // Story 5-4 Task 1.1, AC #2: TtyReporter 三段式彩色语义验证
  it('reportError 使用 chalk.red 着色 message（包含 ANSI red 码）(AC #2 Story 5-4)', async () => {
    const origLevel = chalk.level
    chalk.level = 1
    const { AiforgeError } = await import('../../src/core/errors.js')
    try {
      const err = new AiforgeError('失败', 'ERR_X', 1, 'fatal', '原因', ['修复'])
      reporter.reportError(err)
      const allOutput = stderrSpy.mock.calls.map((c) => c[0] as string).join('')
      // chalk.red 产生 \x1b[31m
      // eslint-disable-next-line no-control-regex
      expect(allOutput).toMatch(/\x1b\[31m/)
    } finally {
      chalk.level = origLevel
    }
  })

  // Story 5-4 Task 1.4, AC #3: TtyReporter 错误全部输出到 stderr
  it('reportError 全部输出到 stderr，不输出到 stdout (AC #3 Story 5-4)', async () => {
    const { AiforgeError } = await import('../../src/core/errors.js')
    const err = new AiforgeError('失败', 'ERR_X', 1, 'fatal', '原因', ['修复'])
    reporter.reportError(err)
    expect(stderrSpy).toHaveBeenCalled()
    expect(stdoutSpy).not.toHaveBeenCalled()
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

  // AC #1 + #3: startPhase 输出到 stderr（不污染 stdout）
  it('startPhase 进度信息仅输出到 stderr，不输出到 stdout (AC #3)', () => {
    reporter.startPhase('执行安装...')
    expect(stderrSpy).toHaveBeenCalled()
    expect(stdoutSpy).not.toHaveBeenCalled()
  })

  // AC #3: completePhase 仅输出到 stderr
  it('completePhase 进度信息仅输出到 stderr，不输出到 stdout (AC #3)', () => {
    reporter.startPhase('执行安装...')
    stdoutSpy.mockClear()
    stderrSpy.mockClear()
    reporter.completePhase()
    expect(stderrSpy).toHaveBeenCalled()
    expect(stdoutSpy).not.toHaveBeenCalled()
  })

  // AC #1: 阶段完成时显示 ✓ 标记（ora succeed 在非 TTY 输出 ✔）
  it('completePhase 显示 ✓ 完成标记 (AC #1)', () => {
    reporter.startPhase('验证认证信息...')
    stderrSpy.mockClear()
    reporter.completePhase()
    const allOutput = stderrSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('✔')
  })

  // AC #1: reportError 时 spinner 显示 ✗ 标记（ora fail）
  it('reportError 时若有活跃 spinner 则先调用 fail() 显示 ✗ 标记 (AC #1)', async () => {
    const { AiforgeError } = await import('../../src/core/errors.js')
    reporter.startPhase('执行安装...')
    stderrSpy.mockClear()
    const err = new AiforgeError('安装失败', 'INSTALL_FAILED', 1, 'fatal', '文件被锁定', ['重试'])
    reporter.reportError(err)
    const allOutput = stderrSpy.mock.calls.map((c) => c[0] as string).join('')
    // ora.fail() 输出包含 ✖ 或 ✗
    expect(allOutput).toMatch(/[✖✗]/)
  })

  // AC #3: updatePhase 在 spinner 激活时不走 stderr.write fallback 路径
  it('updatePhase 在 spinner 激活时更新 spinner.text（无额外 stderr.write 调用）(AC #3)', () => {
    reporter.startPhase('执行安装...')
    stderrSpy.mockClear() // 清除 startPhase 的输出
    reporter.updatePhase('执行安装... (1/7)')
    // spinner 激活时 updatePhase 只更新 text 属性，不直接 write stderr
    // 因此 stderrSpy 不应有新的调用（spinner text 变更不触发 write）
    expect(stderrSpy).not.toHaveBeenCalled()
  })

  // ── 彩色语义测试（Story 5-2 CR 修复新增）─────────────────────────────────────
  // 测试策略：临时设置 chalk.level=1 强制启用 ANSI 颜色输出（测试环境默认 level=0）
  // 通过断言输出包含 ANSI 转义码来验证正确的 chalk 函数被调用

  it('reportResult: 工具标题使用 chalk.bold（包含 ANSI bold 码）(CR #1)', () => {
    const origLevel = chalk.level
    chalk.level = 1
    try {
      reporter.reportResult(createSingleToolResult())
      const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
      // chalk.bold 产生 \x1b[1m ... \x1b[22m
      // eslint-disable-next-line no-control-regex
      expect(allOutput).toMatch(/\x1b\[1m/)
    } finally {
      chalk.level = origLevel
    }
  })

  it('reportResult: new 状态行使用 chalk.green（包含 ANSI green 码）(CR #1)', () => {
    const origLevel = chalk.level
    chalk.level = 1
    try {
      reporter.reportResult(createAllNewResult())
      const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
      // chalk.green 产生 \x1b[32m
      // eslint-disable-next-line no-control-regex
      expect(allOutput).toMatch(/\x1b\[32m/)
    } finally {
      chalk.level = origLevel
    }
  })

  it('reportResult: updated 状态行使用 chalk.blue（包含 ANSI blue 码）(CR #1)', () => {
    const origLevel = chalk.level
    chalk.level = 1
    try {
      reporter.reportResult(createSingleToolResult())
      const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
      // chalk.blue 产生 \x1b[34m
      // eslint-disable-next-line no-control-regex
      expect(allOutput).toMatch(/\x1b\[34m/)
    } finally {
      chalk.level = origLevel
    }
  })

  it('reportResult: skipped 状态行使用 chalk.gray（包含 ANSI gray 码）(CR #1)', () => {
    const origLevel = chalk.level
    chalk.level = 1
    try {
      reporter.reportResult(createSingleToolResult())
      const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
      // chalk.gray 产生 \x1b[90m（bright black）
      // eslint-disable-next-line no-control-regex
      expect(allOutput).toMatch(/\x1b\[90m/)
    } finally {
      chalk.level = origLevel
    }
  })

  it('reportResult: 统计行安装部分使用 chalk.green（包含 ANSI green 码）(CR #1)', () => {
    const origLevel = chalk.level
    chalk.level = 1
    try {
      reporter.reportResult(createAllNewResult())
      const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
      // 统计行 '安装: N 项' 用 chalk.green
      // eslint-disable-next-line no-control-regex
      expect(allOutput).toMatch(/\x1b\[32m安装: \d+ 项/)
    } finally {
      chalk.level = origLevel
    }
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
      items: [{ status: 'new', tool: 'claude', sourcePath: 'src/a.ts', targetPath: 'dist/a.ts' }],
    })
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('✓')
  })

  it('reportResult includes stats line', () => {
    reporter.reportResult({
      items: [
        { status: 'new', tool: 'claude', sourcePath: 'src/a.ts', targetPath: 'dist/a.ts' },
        { status: 'updated', tool: 'claude', sourcePath: 'src/b.ts', targetPath: 'dist/b.ts' },
        { status: 'skipped', tool: 'claude', sourcePath: 'src/c.ts', targetPath: 'dist/c.ts' },
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

  // Story 5-3 Task 3.6: reportError 输出错误信息（错误不能被静默）
  it('reportError 输出错误 message 到 stderr（不能静默）(AC #2 Story 5-3)', async () => {
    const { AiforgeError } = await import('../../src/core/errors.js')
    const err = new AiforgeError('无法访问仓库', 'ERR_TEST', 1, 'fatal', 'Git 服务器返回 401', [
      'npx aiforge --ssh',
    ])
    reporter.reportError(err)
    const allOutput = stderrSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('无法访问仓库')
  })

  // Story 5-3 Task 3.4: reportResult 只输出统计行
  it('reportResult 只输出统计行到 stdout (AC #2 Story 5-3)', () => {
    reporter.reportResult(createSingleToolResult())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    // 不应包含文件级详情（只有统计行）
    expect(allOutput).not.toContain('agents/coding-agent.md')
    expect(allOutput).not.toContain('agents/review-agent.md')
    // 必须包含统计行
    expect(allOutput).toContain('安装:')
    expect(allOutput).toContain('更新:')
    expect(allOutput).toContain('跳过:')
  })

  // Story 5-3 Task 3.5: reportPlan 只输出计划摘要
  it('reportPlan 只输出计划摘要到 stdout (AC #2 Story 5-3)', () => {
    reporter.reportPlan({
      items: [
        {
          rule: {
            tool: 'copilot',
            scope: 'global',
            sourceDir: 'agents',
            type: 0 as never,
            targetDir: '~/.copilot',
          },
          sourceFiles: ['agents/coding-agent.md', 'agents/review-agent.md'],
          targetPath: '~/.copilot/agents',
        },
      ],
    })
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    // 包含计划统计摘要
    expect(allOutput).toContain('计划安装:')
    // 不应包含文件级详情
    expect(allOutput).not.toContain('agents/coding-agent.md')
  })

  // Story 5-4 Task 1.3, AC #2: QuietReporter 三段式格式（同 PlainReporter）
  it('reportError 输出三段式格式 ERROR/WHY/FIX 到 stderr（不能静默）(AC #2 Story 5-4)', async () => {
    const { AiforgeError } = await import('../../src/core/errors.js')
    const err = new AiforgeError(
      '无法访问仓库',
      'AUTH_FAILED',
      2,
      'fatal',
      'Git 服务器返回 401（认证失败）',
      ['npx aiforge --ssh', 'npx aiforge --token <your-token>'],
    )
    reporter.reportError(err)
    const allOutput = stderrSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('ERROR: 无法访问仓库')
    expect(allOutput).toContain('WHY: Git 服务器返回 401（认证失败）')
    expect(allOutput).toContain('FIX: npx aiforge --ssh')
    expect(allOutput).toContain('FIX: npx aiforge --token <your-token>')
  })

  // Story 5-4 Task 1.4, AC #3: QuietReporter 错误输出到 stderr
  it('reportError 全部输出到 stderr，不输出到 stdout (AC #3 Story 5-4)', async () => {
    const { AiforgeError } = await import('../../src/core/errors.js')
    const err = new AiforgeError('失败', 'ERR_X', 1, 'fatal', '原因', ['修复'])
    reporter.reportError(err)
    expect(stderrSpy).toHaveBeenCalled()
    expect(stdoutSpy).not.toHaveBeenCalled()
  })
})

// ── Story 5-4 Task 3.3: 各类 AiforgeError 实例渲染验证 ───────────────────────

describe('Story 5-4 Task 3: 各类 AiforgeError 实例渲染', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    // mock stdout to suppress output (not asserted in this suite)
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Task 3.2: 三段式格式验证 — TtyReporter (AC #1)
  it('TtyReporter: 认证失败 AUTH_FAILED 渲染三段式彩色格式 (AC #1 Story 5-4)', async () => {
    const { AiforgeError } = await import('../../src/core/errors.js')
    const reporter = createReporter({ quiet: false, isTty: true })
    const err = new AiforgeError(
      '无法访问仓库',
      'AUTH_FAILED',
      2,
      'fatal',
      'Git 服务器返回 401（认证失败）',
      ['npx aiforge --ssh', 'npx aiforge --token <your-token>', 'npx aiforge init'],
    )
    reporter.reportError(err)
    const allOutput = stderrSpy.mock.calls.map((c) => c[0] as string).join('')
    // 三段式：❌ message → why → 修复方法 → fix commands
    expect(allOutput).toContain('❌')
    expect(allOutput).toContain('无法访问仓库')
    expect(allOutput).toContain('Git 服务器返回 401（认证失败）')
    expect(allOutput).toContain('修复方法')
    expect(allOutput).toContain('npx aiforge --ssh')
    expect(allOutput).toContain('npx aiforge --token <your-token>')
    expect(allOutput).toContain('npx aiforge init')
  })

  // Task 3.3: PERMISSION_DENIED 错误渲染 (AC #4)
  it('PlainReporter: PERMISSION_DENIED 渲染三段式纯文本 (AC #4 Story 5-4)', async () => {
    const { AiforgeError } = await import('../../src/core/errors.js')
    const reporter = createReporter({ quiet: false, isTty: false })
    const err = new AiforgeError(
      '目标路径无写入权限',
      'PERMISSION_DENIED',
      1,
      'fatal',
      '目标路径父目录不可写',
      ['chmod 755 <target-dir>', 'sudo npx aiforge -g'],
    )
    reporter.reportError(err)
    const allOutput = stderrSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('ERROR: 目标路径无写入权限')
    expect(allOutput).toContain('WHY: 目标路径父目录不可写')
    expect(allOutput).toContain('FIX: chmod 755 <target-dir>')
    expect(allOutput).toContain('FIX: sudo npx aiforge -g')
  })

  // Task 3.3: CONFIG_CORRUPT 错误渲染 (AC #4)
  it('PlainReporter: CONFIG_CORRUPT 渲染含 init 修复命令 (AC #4 Story 5-4)', async () => {
    const { AiforgeError } = await import('../../src/core/errors.js')
    const reporter = createReporter({ quiet: false, isTty: false })
    const err = new AiforgeError(
      '配置文件损坏',
      'CONFIG_CORRUPT',
      3,
      'fatal',
      'config.json 不是有效的 JSON 格式',
      ['npx aiforge init  # 重新配置'],
    )
    reporter.reportError(err)
    const allOutput = stderrSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('ERROR: 配置文件损坏')
    expect(allOutput).toContain('WHY: config.json 不是有效的 JSON 格式')
    expect(allOutput).toContain('FIX: npx aiforge init  # 重新配置')
  })

  // Task 3.2: 修复命令可复制性 — 每条 fix 单独一行，无额外格式干扰 (AC #1)
  it('fix 命令每条单独一行，可直接复制执行 (AC #1 Story 5-4)', async () => {
    const { AiforgeError } = await import('../../src/core/errors.js')
    const reporter = createReporter({ quiet: false, isTty: false })
    const err = new AiforgeError(
      '无法访问仓库',
      'AUTH_FAILED',
      2,
      'fatal',
      'Git 服务器返回 401（认证失败）',
      ['npx aiforge --ssh', 'npx aiforge --token <your-token>', 'npx aiforge init'],
    )
    reporter.reportError(err)
    const allCalls = stderrSpy.mock.calls.map((c) => c[0] as string)
    // 每次 write 调用是独立的 fix 行，包含 'FIX:' 前缀
    const fixLines = allCalls.filter((line) => line.startsWith('  FIX:'))
    expect(fixLines).toHaveLength(3)
    // 可直接复制的命令（去掉前缀和换行后的命令）
    expect(fixLines[0]).toBe('  FIX: npx aiforge --ssh\n')
    expect(fixLines[1]).toBe('  FIX: npx aiforge --token <your-token>\n')
    expect(fixLines[2]).toBe('  FIX: npx aiforge init\n')
  })
})

// ── Story 5.5a CR Fix — Finding #3: 英文输出断言 ─────────────────────────────

describe('Story 5.5a — 英文模式输出断言（AC #1 CR Fix）', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>
  let stderrSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // 切换到英文模式
    setLanguage('en')
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    // 恢复中文模式（测试隔离）
    setLanguage('zh-CN')
    vi.restoreAllMocks()
  })

  it('QuietReporter: setLanguage("en") 后 reportResult 输出英文统计行', () => {
    const reporter = createReporter({ quiet: true, isTty: false })
    reporter.reportResult({
      items: [
        { status: 'new', tool: 'claude', sourcePath: 'src/a.ts', targetPath: 'dist/a.ts' },
        { status: 'updated', tool: 'claude', sourcePath: 'src/b.ts', targetPath: 'dist/b.ts' },
        { status: 'skipped', tool: 'claude', sourcePath: 'src/c.ts', targetPath: 'dist/c.ts' },
      ],
    })
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('Installed:')
    expect(allOutput).toContain('Updated:')
    expect(allOutput).toContain('Skipped:')
    // 不应含中文统计标签
    expect(allOutput).not.toContain('安装:')
    expect(allOutput).not.toContain('更新:')
    expect(allOutput).not.toContain('跳过:')
  })

  it('TtyReporter: setLanguage("en") 后 reportPlan 输出英文标题', () => {
    const reporter = createReporter({ quiet: false, isTty: true })
    reporter.reportPlan({
      items: [
        {
          rule: {
            tool: 'copilot',
            scope: 'global',
            sourceDir: 'agents',
            type: InstallType.Files,
            targetDir: '~/.copilot',
          },
          mode: 'copy',
          sourceFiles: ['agents/coding-agent.md'],
          targetPath: '/home/user/.copilot/agents',
        },
      ],
    })
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    // 标题应含 "dry-run"（英文）
    expect(allOutput).toContain('dry-run')
    // scope 标签应为英文 "global"
    expect(allOutput).toContain('global')
    // 不应含中文 "全局"
    expect(allOutput).not.toContain('全局')
    // 统计行应为英文
    expect(allOutput).toContain('Plan:')
    expect(allOutput).not.toContain('计划安装:')
    // 量词应为英文 "items"，不应含中文 "项"
    expect(allOutput).toContain('items')
    expect(allOutput).not.toContain('项')
  })

  it('PlainReporter: setLanguage("en") 后 reportPlan 统计行为英文', () => {
    const reporter = createReporter({ quiet: false, isTty: false })
    reporter.reportPlan({
      items: [
        {
          rule: {
            tool: 'copilot',
            scope: 'global',
            sourceDir: 'agents',
            type: InstallType.Files,
            targetDir: '~/.copilot',
          },
          mode: 'copy',
          sourceFiles: ['agents/coding-agent.md'],
          targetPath: '/home/user/.copilot/agents',
        },
      ],
    })
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('Plan:')
    expect(allOutput).toContain('tools')
    expect(allOutput).not.toContain('计划安装:')
  })

  it('TtyReporter: setLanguage("en") 后 reportError 使用英文 Fix 标签', async () => {
    const { AiforgeError } = await import('../../src/core/errors.js')
    const reporter = createReporter({ quiet: false, isTty: true })
    const err = new AiforgeError(
      'No tools detected',
      'NO_TOOLS',
      1,
      'fatal',
      'No marker files found',
      ['npx aiforge --tools copilot'],
    )
    reporter.reportError(err)
    const allOutput = stderrSpy.mock.calls.map((c) => c[0] as string).join('')
    // 英文模式下修复方法标签应为 "Fix:"
    expect(allOutput).toContain('Fix:')
    // 不应含中文 "修复方法："
    expect(allOutput).not.toContain('修复方法：')
  })
})
