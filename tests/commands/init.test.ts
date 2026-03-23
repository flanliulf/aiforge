/**
 * commands/init.ts — init 子命令占位测试
 *
 * 来源: Story 1.5 Task 3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Command } from 'commander'
import { registerInitCommand } from '../../src/commands/init.js'

describe('commands/init — init 子命令占位', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  let originalExitCode: number | undefined

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    originalExitCode = process.exitCode
  })

  afterEach(() => {
    logSpy.mockRestore()
    process.exitCode = originalExitCode
  })

  it('注册 init 子命令到 program', () => {
    const program = new Command()
    registerInitCommand(program)

    const initCmd = program.commands.find((cmd) => cmd.name() === 'init')
    expect(initCmd).toBeDefined()
    expect(initCmd!.description()).toBe('初始化 aiforge 配置')
  })

  it('执行 init 命令输出"aiforge init 尚未实现"', async () => {
    const program = new Command()
    program.exitOverride()
    registerInitCommand(program)

    await program.parseAsync(['node', 'aiforge', 'init'])

    expect(logSpy).toHaveBeenCalledWith('aiforge init 尚未实现')
  })
})
