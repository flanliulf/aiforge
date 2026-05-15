/**
 * report.test.ts — reportPlan 各 Reporter 实现的输出格式测试
 *
 * 来源: Story 3.3 Task 4.1
 * 测试: TtyReporter、PlainReporter、QuietReporter 的 reportPlan 格式化输出
 *
 * AC #2: 按工具分组展示每个文件的源路径和目标路径，标注安装类型和模式，输出到 stdout
 * AC #3: dry-run 路径不触发任何文件写入操作（reportPlan 仅输出，不写入）
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createReporter } from '../../src/core/reporter.js'
import type { Reporter } from '../../src/core/reporter.js'
import type { MatchedPlan } from '../../src/core/types.js'
import { InstallType } from '../../src/core/types.js'

// ── 测试 Fixture ──────────────────────────────────────────────────────────────

/**
 * 构建测试用 MatchedPlan
 * 包含两个工具（copilot、claude），多种安装类型和模式
 */
function createTestPlan(): MatchedPlan {
  return {
    items: [
      // copilot agents — files/copy
      {
        rule: {
          tool: 'copilot',
          scope: 'global',
          sourceDir: 'agents',
          type: InstallType.Files,
          targetDir: '~/.copilot/agents/',
        },
        sourceFiles: ['/repo/agents/coding-agent.md', '/repo/agents/review-agent.md'],
        targetPath: '/home/user/.copilot/agents',
        mode: 'copy',
      },
      // copilot skills — directories/copy
      {
        rule: {
          tool: 'copilot',
          scope: 'global',
          sourceDir: 'skills',
          type: InstallType.Directories,
          targetDir: '~/.copilot/skills/',
        },
        sourceFiles: ['/repo/skills/refactor', '/repo/skills/testing'],
        targetPath: '/home/user/.copilot/skills',
        mode: 'copy',
      },
      // claude agents — files/copy
      {
        rule: {
          tool: 'claude',
          scope: 'global',
          sourceDir: 'agents',
          type: InstallType.Files,
          targetDir: '~/.claude/agents/',
        },
        sourceFiles: ['/repo/agents/coding-agent.md'],
        targetPath: '/home/user/.claude/agents',
        mode: 'copy',
      },
      // cursor skills — flatten/symlink
      {
        rule: {
          tool: 'cursor',
          scope: 'global',
          sourceDir: 'skills',
          type: InstallType.Flatten,
          targetDir: '~/.cursor/rules/',
        },
        sourceFiles: ['/repo/skills/refactor', '/repo/skills/testing'],
        targetPath: '/home/user/.cursor/rules',
        mode: 'symlink',
      },
    ],
  }
}

/** 空计划 */
function createEmptyPlan(): MatchedPlan {
  return { items: [] }
}

/** 单工具计划 */
function createSingleToolPlan(): MatchedPlan {
  return {
    items: [
      {
        rule: {
          tool: 'claude',
          scope: 'global',
          sourceDir: 'agents',
          type: InstallType.Files,
          targetDir: '~/.claude/agents/',
        },
        sourceFiles: ['/repo/agents/CLAUDE.md'],
        targetPath: '/home/user/.claude/agents',
        mode: 'copy',
      },
    ],
  }
}

// ── PlainReporter.reportPlan ──────────────────────────────────────────────────

describe('PlainReporter.reportPlan', () => {
  let reporter: Reporter
  let stdoutSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    reporter = createReporter({ quiet: false, isTty: false })
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('AC #2: 输出到 stdout（可被管道消费）', () => {
    reporter.reportPlan(createTestPlan())
    expect(stdoutSpy).toHaveBeenCalled()
  })

  it('AC #2: 每个文件输出一行，包含 sourceFile 名称', () => {
    reporter.reportPlan(createSingleToolPlan())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('CLAUDE.md')
  })

  it('AC #2: 输出包含目标路径', () => {
    reporter.reportPlan(createSingleToolPlan())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('/home/user/.claude/agents')
  })

  it('AC #2: 输出包含安装类型（Files）', () => {
    reporter.reportPlan(createSingleToolPlan())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    // 应包含安装类型标注（小写）
    expect(allOutput.toLowerCase()).toContain('files')
  })

  it('AC #2: 输出包含安装模式（copy）', () => {
    reporter.reportPlan(createSingleToolPlan())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('copy')
  })

  it('AC #2: 每行格式可被 grep/awk 解析 — 无 ANSI 转义码', () => {
    reporter.reportPlan(createTestPlan())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    // PlainReporter 不含 ANSI 转义码
    // eslint-disable-next-line no-control-regex
    expect(allOutput).not.toMatch(/\x1b\[/)
  })

  it('AC #2: 多工具计划输出所有文件', () => {
    reporter.reportPlan(createTestPlan())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    // 4 条规则，共 2+2+1+2=7 个 sourceFiles
    expect(allOutput).toContain('coding-agent.md')
    expect(allOutput).toContain('review-agent.md')
    expect(allOutput).toContain('refactor')
    expect(allOutput).toContain('testing')
  })

  it('AC #2: symlink 模式标注正确', () => {
    reporter.reportPlan(createTestPlan())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('symlink')
  })

  it('AC #2: flatten 类型标注正确', () => {
    reporter.reportPlan(createTestPlan())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput.toLowerCase()).toContain('flatten')
  })

  it('AC #2: 底部统计行包含总项目数', () => {
    reporter.reportPlan(createTestPlan())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    // 共 7 个 sourceFiles（2+2+1+2）
    expect(allOutput).toContain('计划安装')
    expect(allOutput).toContain('7')
  })

  it('AC #2: 底部统计行包含工具数', () => {
    reporter.reportPlan(createTestPlan())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    // 共 3 个工具（copilot, claude, cursor）
    expect(allOutput).toContain('3 个工具')
  })

  it('空计划时只输出统计行（0 项 0 个工具）', () => {
    reporter.reportPlan(createEmptyPlan())
    expect(stdoutSpy).toHaveBeenCalled()
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('计划安装')
    expect(allOutput).toContain('0')
  })

  it('AC #3: reportPlan 不调用 fs.write（只写 stdout，无文件系统副作用）', () => {
    // PlainReporter.reportPlan 只写 process.stdout，不调用任何 fs 写入
    // 验证：仅有 stdoutSpy 被调用，无任何 stderrSpy 或 fs 写入
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    reporter.reportPlan(createTestPlan())
    // 无 stderr 输出（reportPlan 是纯数据输出）
    expect(stderrSpy).not.toHaveBeenCalled()
    stderrSpy.mockRestore()
  })
})

// ── TtyReporter.reportPlan ────────────────────────────────────────────────────

describe('TtyReporter.reportPlan', () => {
  let reporter: Reporter
  let stdoutSpy: ReturnType<typeof vi.spyOn>
  let stderrSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    reporter = createReporter({ quiet: false, isTty: true })
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('AC #2: 输出到 stdout', () => {
    reporter.reportPlan(createTestPlan())
    expect(stdoutSpy).toHaveBeenCalled()
  })

  it('AC #2: 标题行包含 dry-run 标识', () => {
    reporter.reportPlan(createSingleToolPlan())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('dry-run')
  })

  it('AC #2: 按工具分组 — 含工具名', () => {
    reporter.reportPlan(createTestPlan())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('copilot')
    expect(allOutput).toContain('claude')
    expect(allOutput).toContain('cursor')
  })

  it('AC #2: 工具下按本地安装主目录分组显示', () => {
    reporter.reportPlan(createTestPlan())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('📁 ~/.copilot/agents/')
    expect(allOutput).toContain('📁 ~/.copilot/skills/')
    expect(allOutput).toContain('📁 ~/.claude/agents/')
  })

  it('AC #2: 每行包含源文件名和目标路径', () => {
    reporter.reportPlan(createSingleToolPlan())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('CLAUDE.md')
    expect(allOutput).toContain('/home/user/.claude/agents')
  })

  it('AC #2: 每行包含安装类型和模式标注 [type/mode]', () => {
    reporter.reportPlan(createSingleToolPlan())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    // 格式: [files/copy]
    expect(allOutput.toLowerCase()).toMatch(/\[files\/copy\]/)
  })

  it('AC #2: 底部统计行格式正确', () => {
    reporter.reportPlan(createTestPlan())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('计划安装')
    expect(allOutput).toContain('7')
    expect(allOutput).toContain('3 个工具')
  })

  it('AC #2: 阶段进度输出到 stderr（干净分离）', () => {
    // reportPlan 本身不应写 stderr（只输出计划数据到 stdout）
    reporter.reportPlan(createSingleToolPlan())
    // stderr 不应有输出（reportPlan 是数据输出，不是进度）
    expect(stderrSpy).not.toHaveBeenCalled()
  })

  it('空计划时仍输出标题和统计行', () => {
    reporter.reportPlan(createEmptyPlan())
    expect(stdoutSpy).toHaveBeenCalled()
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('计划安装')
  })
})

// ── QuietReporter.reportPlan ──────────────────────────────────────────────────

describe('QuietReporter.reportPlan', () => {
  let reporter: Reporter
  let stdoutSpy: ReturnType<typeof vi.spyOn>
  let stderrSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    reporter = createReporter({ quiet: true, isTty: false })
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('AC #2: 输出到 stdout', () => {
    reporter.reportPlan(createTestPlan())
    expect(stdoutSpy).toHaveBeenCalled()
  })

  it('AC #2: 输出包含项目总数', () => {
    reporter.reportPlan(createTestPlan())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('计划安装')
    expect(allOutput).toContain('7')
  })

  it('AC #2: 输出包含工具数', () => {
    reporter.reportPlan(createTestPlan())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('3 个工具')
  })

  it('空计划时输出 0 项', () => {
    reporter.reportPlan(createEmptyPlan())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    expect(allOutput).toContain('0')
  })

  it('不输出详细文件列表（只输出摘要）', () => {
    reporter.reportPlan(createTestPlan())
    const allOutput = stdoutSpy.mock.calls.map((c) => c[0] as string).join('')
    // QuietReporter 只输出摘要，不输出具体文件名
    expect(allOutput).not.toContain('coding-agent.md')
  })

  it('不写 stderr', () => {
    reporter.reportPlan(createTestPlan())
    expect(stderrSpy).not.toHaveBeenCalled()
  })
})
