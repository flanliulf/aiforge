/**
 * tests/stages/conflict-resolver.test.ts
 *
 * Story 4.5 Task 5 — 交互式冲突解决模块单元测试
 * 测试用例：resolveConflict 交互选项、handleConflict 三分支（force/非TTY/正常TTY）
 *           查看差异后重新询问、中止抛出 USER_ABORT
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

import { AiforgeError } from '../../src/core/errors.js'
import type { Reporter } from '../../src/core/reporter.js'

// ── Hoisted mock state ────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  select: vi.fn(),
}))

vi.mock('@inquirer/prompts', () => ({
  select: mocks.select,
}))

// ── 被测模块 ─────────────────────────────────────────────────
// 必须在 vi.mock 之后导入，确保 mock 生效
import { resolveConflict, handleConflict } from '../../src/stages/conflict-resolver.js'

// ── helpers ─────────────────────────────────────────────────────

function makeReporter(): Reporter {
  return {
    startPhase: vi.fn(),
    updatePhase: vi.fn(),
    completePhase: vi.fn(),
    reportResult: vi.fn(),
    reportPlan: vi.fn(),
    reportError: vi.fn(),
    warn: vi.fn(),
  }
}

// ── describe: stages/conflict-resolver ──────────────────────────

describe('stages/conflict-resolver', () => {
  let reporter: Reporter

  beforeEach(() => {
    reporter = makeReporter()
    mocks.select.mockReset()
  })

  // ══════════════════════════════════════════════════════════════
  // resolveConflict
  // ══════════════════════════════════════════════════════════════

  describe('resolveConflict', () => {
    it('用户选择 "备份后覆盖" → 返回 backup', async () => {
      mocks.select.mockResolvedValueOnce('backup')

      const result = await resolveConflict('/target/file.md', '/source/file.md', reporter)
      expect(result).toBe('backup')
      expect(mocks.select).toHaveBeenCalledOnce()
    })

    it('用户选择 "直接覆盖" → 返回 overwrite', async () => {
      mocks.select.mockResolvedValueOnce('overwrite')

      const result = await resolveConflict('/target/file.md', '/source/file.md', reporter)
      expect(result).toBe('overwrite')
    })

    it('用户选择 "跳过此文件" → 返回 skip', async () => {
      mocks.select.mockResolvedValueOnce('skip')

      const result = await resolveConflict('/target/file.md', '/source/file.md', reporter)
      expect(result).toBe('skip')
    })

    it('用户选择 "中止安装" → 返回 abort', async () => {
      mocks.select.mockResolvedValueOnce('abort')

      const result = await resolveConflict('/target/file.md', '/source/file.md', reporter)
      expect(result).toBe('abort')
    })

    it('用户选择 "查看差异" → 显示差异后重新询问，第二次选择 backup', async () => {
      // 第一次选 diff，第二次选 backup
      mocks.select.mockResolvedValueOnce('diff').mockResolvedValueOnce('backup')

      const result = await resolveConflict('/target/file.md', '/source/file.md', reporter)
      expect(result).toBe('backup')
      // select 被调用 2 次（diff 后重新询问）
      expect(mocks.select).toHaveBeenCalledTimes(2)
      // showDiff 会调用 reporter.warn（stat 失败时输出"无法读取"）
      expect(reporter.warn).toHaveBeenCalled()
    })

    it('select 选项列表包含 5 个选项且默认推荐备份', async () => {
      mocks.select.mockResolvedValueOnce('skip')

      await resolveConflict('/target/file.md', '/source/file.md', reporter)

      const call = mocks.select.mock.calls[0]![0] as {
        choices: Array<{ value: string; name: string }>
      }
      expect(call.choices).toHaveLength(5)
      // 第一个选项是备份（推荐）
      expect(call.choices[0]!.value).toBe('backup')
      expect(call.choices[0]!.name).toContain('推荐')
    })
  })

  // ══════════════════════════════════════════════════════════════
  // handleConflict
  // ══════════════════════════════════════════════════════════════

  describe('handleConflict', () => {
    it('--force 模式：直接返回 overwrite，不调用 select', async () => {
      const result = await handleConflict('/target/file.md', '/source/file.md', true, reporter)
      expect(result).toBe('overwrite')
      expect(mocks.select).not.toHaveBeenCalled()
    })

    it('非 TTY 环境：抛出 AiforgeError(CONFLICT_NON_TTY)', async () => {
      // 保存原始值并临时修改
      const originalIsTTY = process.stdin.isTTY
      Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true })

      try {
        await expect(
          handleConflict('/target/file.md', '/source/file.md', false, reporter),
        ).rejects.toThrow(AiforgeError)

        try {
          await handleConflict('/target/file.md', '/source/file.md', false, reporter)
        } catch (error) {
          expect(error).toBeInstanceOf(AiforgeError)
          const ae = error as AiforgeError
          expect(ae.code).toBe('CONFLICT_NON_TTY')
          expect(ae.severity).toBe('fatal')
          expect(ae.exitCode).toBe(1)
        }
      } finally {
        Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true })
      }
    })

    it('用户选择中止 → 抛出 AiforgeError(USER_ABORT)', async () => {
      // 确保 isTTY 为 true
      const originalIsTTY = process.stdin.isTTY
      Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true })

      mocks.select.mockResolvedValueOnce('abort')

      try {
        await expect(
          handleConflict('/target/file.md', '/source/file.md', false, reporter),
        ).rejects.toThrow(AiforgeError)

        mocks.select.mockResolvedValueOnce('abort')
        try {
          await handleConflict('/target/file.md', '/source/file.md', false, reporter)
        } catch (error) {
          expect(error).toBeInstanceOf(AiforgeError)
          const ae = error as AiforgeError
          expect(ae.code).toBe('USER_ABORT')
          expect(ae.severity).toBe('fatal')
          expect(ae.exitCode).toBe(1)
        }
      } finally {
        Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true })
      }
    })

    it('TTY 环境 + 用户选择 backup → 返回 backup', async () => {
      const originalIsTTY = process.stdin.isTTY
      Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true })

      mocks.select.mockResolvedValueOnce('backup')

      try {
        const result = await handleConflict('/target/file.md', '/source/file.md', false, reporter)
        expect(result).toBe('backup')
        expect(mocks.select).toHaveBeenCalledOnce()
      } finally {
        Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true })
      }
    })

    it('TTY 环境 + 用户选择 skip → 返回 skip', async () => {
      const originalIsTTY = process.stdin.isTTY
      Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true })

      mocks.select.mockResolvedValueOnce('skip')

      try {
        const result = await handleConflict('/target/file.md', '/source/file.md', false, reporter)
        expect(result).toBe('skip')
      } finally {
        Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true })
      }
    })

    it('TTY 环境 + 用户选择 overwrite → 返回 overwrite', async () => {
      const originalIsTTY = process.stdin.isTTY
      Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true })

      mocks.select.mockResolvedValueOnce('overwrite')

      try {
        const result = await handleConflict('/target/file.md', '/source/file.md', false, reporter)
        expect(result).toBe('overwrite')
      } finally {
        Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true })
      }
    })
  })
})
