/**
 * stages/conflict-resolver.ts
 *
 * 交互式冲突解决模块（Story 4.5 Task 2）
 *
 * 功能：
 * - 当目标路径存在用户手写文件时，提供交互式选项
 * - 选项：备份后覆盖（推荐）/ 直接覆盖 / 跳过 / 查看差异 / 中止
 * - "查看差异"显示简要对比后重新询问
 * - "中止"停止整个安装流程
 *
 * 依赖：
 * - @inquirer/prompts (select)
 * - services/fs-utils.ts (backupFile)
 * - core/reporter.ts (Reporter)
 * - core/errors.ts (AiforgeError)
 *
 * 架构: stages/ → services/, core/
 */

import { stat } from 'node:fs/promises'
import { basename } from 'node:path'

import { select } from '@inquirer/prompts'

import type { Reporter } from '../core/reporter.js'
import { AiforgeError, EXIT_INSTALL_FAILURE } from '../core/errors.js'

// ── ConflictDecision ────────────────────────────────────────────────────────

export type ConflictDecision = 'overwrite' | 'skip' | 'backup' | 'abort'

// ── showDiff ────────────────────────────────────────────────────────────────

/**
 * 显示源文件和目标文件的简要对比信息。
 * MVP 只显示文件大小和修改时间，不做详细 diff。
 */
async function showDiff(sourcePath: string, targetPath: string, reporter: Reporter): Promise<void> {
  try {
    const srcStat = await stat(sourcePath)
    const destStat = await stat(targetPath)

    reporter.warn(
      `  📄 源文件:   ${basename(sourcePath)} (${srcStat.size} 字节, 修改时间: ${srcStat.mtime.toISOString()})`,
    )
    reporter.warn(
      `  📄 目标文件: ${basename(targetPath)} (${destStat.size} 字节, 修改时间: ${destStat.mtime.toISOString()})`,
    )
  } catch {
    reporter.warn('  ⚠️ 无法读取文件信息进行对比')
  }
}

// ── resolveConflict ─────────────────────────────────────────────────────────

/**
 * 交互式冲突解决 (FR-027)。
 *
 * 向用户展示冲突选项并等待决策。
 * "查看差异"选项会显示对比后重新询问（递归调用）。
 *
 * @param targetPath  冲突的目标文件路径
 * @param sourcePath  源文件路径
 * @param reporter    输出报告器（用于 showDiff）
 * @returns           用户决策：overwrite / skip / backup / abort
 */
export async function resolveConflict(
  targetPath: string,
  sourcePath: string,
  reporter: Reporter,
): Promise<ConflictDecision> {
  const choice = await select({
    message: `⚠️ 文件冲突: ${targetPath} 已存在（用户手写文件）`,
    choices: [
      { name: '备份后覆盖（推荐）', value: 'backup' as const },
      { name: '直接覆盖', value: 'overwrite' as const },
      { name: '跳过此文件', value: 'skip' as const },
      { name: '查看差异', value: 'diff' as const },
      { name: '中止安装', value: 'abort' as const },
    ],
  })

  if (choice === 'diff') {
    await showDiff(sourcePath, targetPath, reporter)
    return resolveConflict(targetPath, sourcePath, reporter)
  }

  return choice as ConflictDecision
}

// ── handleConflict ──────────────────────────────────────────────────────────

/**
 * 根据冲突类型和运行环境处理冲突决策。
 *
 * 需要用户决策的冲突类型：'user-file' | 'unknown-origin' | 'user-modified'
 *
 * 处理逻辑：
 * - --force 模式：跳过交互，直接覆盖
 * - 非 TTY 环境：抛出 CONFLICT_NON_TTY 错误
 * - 正常 TTY：调用 resolveConflict 获取用户决策
 *
 * @param targetPath  冲突的目标文件路径
 * @param sourcePath  源文件路径
 * @param force       是否为 --force 模式
 * @param reporter    输出报告器
 * @returns           用户决策
 * @throws            AiforgeError(CONFLICT_NON_TTY) 当非 TTY 环境下检测到冲突时
 * @throws            AiforgeError(USER_ABORT) 当用户选择中止安装时
 */
export async function handleConflict(
  targetPath: string,
  sourcePath: string,
  force: boolean,
  reporter: Reporter,
): Promise<ConflictDecision> {
  if (force) {
    return 'overwrite'
  }

  if (!process.stdin.isTTY) {
    throw new AiforgeError(
      '文件冲突需要交互式终端',
      'CONFLICT_NON_TTY',
      EXIT_INSTALL_FAILURE,
      'fatal',
      `目标文件 ${targetPath} 已存在且为用户手写文件，非 TTY 环境无法交互式确认`,
      ['在终端中运行此命令', '使用 --force 跳过交互式确认'],
    )
  }

  const decision = await resolveConflict(targetPath, sourcePath, reporter)

  if (decision === 'abort') {
    throw new AiforgeError(
      '用户中止安装',
      'USER_ABORT',
      EXIT_INSTALL_FAILURE,
      'fatal',
      '用户在冲突解决中选择了中止安装',
      ['重新运行安装命令', '使用 --force 跳过冲突确认'],
    )
  }

  return decision
}
