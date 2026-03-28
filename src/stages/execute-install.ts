/**
 * stages/execute-install.ts
 *
 * Install 管道阶段 — 复制模式安装执行（Story 4.2）
 *
 * 功能：
 * - 执行安装预检查（preflight）
 * - 遍历 MatchedPlan.items，按规则类型分发执行
 * - files 类型：copyFile(src, targetDir/basename)
 * - directories 类型：copyDir(src, targetDir/basename)
 * - 目标目录不存在时自动调用 ensureDir
 * - 通过 fileHash 判断安装状态：new / updated / skipped
 * - fail-fast：文件操作异常时立即抛出 AiforgeError(fatal)，返回已完成结果
 *
 * 依赖：
 * - core/types.ts (MatchedPlan, ParsedArgs, InstallResult, InstallType)
 * - core/reporter.ts (Reporter)
 * - core/path-resolver.ts (PathResolver)
 * - services/fs-utils.ts (preflight, copyFile, copyDir, ensureDir, fileHash)
 *
 * 架构: architecture/03-core-decisions.md#D6
 * 模块边界: stages/ → services/, core/
 */

import { join, basename } from 'node:path'
import { access } from 'node:fs/promises'

import type { MatchedPlan, ParsedArgs, InstallResult } from '../core/types.js'
import { InstallType } from '../core/types.js'
import type { Reporter } from '../core/reporter.js'
import type { PathResolver } from '../core/path-resolver.js'
import {
  preflight,
  copyFile,
  copyDir,
  ensureDir,
  fileHash,
  validateDestPathSecurity,
} from '../services/fs-utils.js'

// ── 状态判定 ──────────────────────────────────────────────────────────────────

/**
 * 判断文件安装状态：
 * - 目标文件不存在 → 'new'
 * - 目标文件存在且 hash 不同 → 'updated'
 * - 目标文件存在且 hash 相同 → 'skipped'
 *
 * 注意：此函数只用于 files 类型（单文件对比）。
 * directories 类型整体复制，对源目录作为整体判断是否存在。
 */
async function determineStatus(
  srcPath: string,
  destPath: string,
): Promise<'new' | 'updated' | 'skipped'> {
  try {
    await access(destPath)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return 'new'
    }
    // EACCES 或其他 I/O 错误：无法读取目标状态，视为 new（后续 copyFile 会抛 fatal）
    return 'new'
  }

  const srcHash = await fileHash(srcPath)
  const destHash = await fileHash(destPath)
  return srcHash === destHash ? 'skipped' : 'updated'
}

/**
 * 判断目录安装状态：
 * - 目标目录不存在 → 'new'
 * - 目标目录已存在 → 'updated'（目录整体覆盖，无 hash 对比）
 */
async function determineDirStatus(destPath: string): Promise<'new' | 'updated'> {
  try {
    await access(destPath)
    return 'updated'
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return 'new'
    }
    return 'new'
  }
}

// ── 主入口 ────────────────────────────────────────────────────────────────────

/**
 * executeInstall — Install 管道阶段主函数
 *
 * @param plan         匹配的安装计划
 * @param args         解析后的 CLI 参数
 * @param reporter     输出报告器
 * @param pathResolver 路径解析器（用于 preflight 的 allowedRoot 推导）
 * @returns            安装结果列表
 *
 * fail-fast 策略：
 * - 文件/目录 I/O 操作失败时，copyFile/copyDir 内部抛出 AiforgeError(fatal)
 * - 异常向上透传，管道立即终止
 * - 已完成的操作包含在 results 中（但因异常未返回，由调用方决定是否使用）
 */
export async function executeInstall(
  plan: MatchedPlan,
  _args: ParsedArgs,
  reporter: Reporter,
  pathResolver: PathResolver,
): Promise<InstallResult> {
  reporter.startPhase('执行安装...')

  // Step 1: 预检查（路径安全性 + 可写性）
  await preflight(plan, pathResolver)

  const resultItems: InstallResult['items'] = []

  for (const item of plan.items) {
    // 空 sourceFiles 静默跳过：不创建目录、不产生副作用（CR R4-#1）
    if (item.sourceFiles.length === 0) continue

    // 根据 scope 推导 allowedRoot（与 preflight 保持一致）
    const allowedRoot = item.rule.scope === 'global' ? pathResolver.home() : process.cwd()

    // 确保目标目录存在（幂等）
    await ensureDir(item.targetPath)

    for (const srcPath of item.sourceFiles) {
      if (item.rule.type === InstallType.Files) {
        // files 类型：单文件复制，目标路径为 targetDir/basename(srcFile)
        const destPath = join(item.targetPath, basename(srcPath))

        // 文件级 symlink 逃逸校验（NFR-S5）：
        // preflight 仅校验 targetPath（目录级），若目录中有同名 symlink 指向外部，
        // copyFile 会跟随 symlink 写出 allowedRoot，此处对 destPath 做额外校验
        await validateDestPathSecurity(destPath, allowedRoot)

        const status = await determineStatus(srcPath, destPath)

        if (status !== 'skipped') {
          // copyFile 失败时抛出 AiforgeError(fatal)，管道立即终止
          await copyFile(srcPath, destPath)
          reporter.updatePhase(basename(srcPath))
        }

        resultItems.push({ status, sourcePath: srcPath, targetPath: destPath })
      } else if (item.rule.type === InstallType.Directories) {
        // directories 类型：整体目录复制，目标路径为 targetDir/basename(srcDir)
        const destPath = join(item.targetPath, basename(srcPath))

        // 目录级 symlink 逃逸校验（NFR-S5）：
        // 与 files 分支同等安全标准，防止 destPath 是指向 allowedRoot 外的 symlink
        await validateDestPathSecurity(destPath, allowedRoot)

        const status = await determineDirStatus(destPath)

        // copyDir 失败时抛出 AiforgeError(fatal)，管道立即终止
        await copyDir(srcPath, destPath)
        reporter.updatePhase(basename(srcPath))

        resultItems.push({ status, sourcePath: srcPath, targetPath: destPath })
      }
      // flatten 类型由 Story 4.3 实现，此处不处理
    }
  }

  reporter.completePhase()
  return { items: resultItems }
}
