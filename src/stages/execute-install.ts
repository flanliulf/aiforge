/**
 * stages/execute-install.ts
 *
 * Install 管道阶段 — 安装执行（Story 4.2 + Story 4.3）
 *
 * 功能：
 * - 执行安装预检查（preflight）
 * - 遍历 MatchedPlan.items，按规则类型和安装模式分发执行
 * - files 类型 + copy：copyFile(src, targetDir/basename)
 * - files 类型 + symlink：createSymlink(srcAbsPath, targetDir/basename)
 * - directories 类型 + copy：copyDir(src, targetDir/basename)
 * - directories 类型 + symlink：createSymlink(srcAbsPath, targetDir/basename)
 * - flatten 类型：从子目录中提取 mainFile，扁平化重命名后 copy/symlink 到目标
 * - 目标目录不存在时自动调用 ensureDir
 * - 通过 fileHash 判断安装状态：new / updated / skipped
 * - symlink 模式安装完成后执行断链检测（NFR-R6）
 * - fail-fast：文件操作异常时立即抛出 AiforgeError(fatal)
 *
 * 依赖：
 * - core/types.ts (MatchedPlan, ParsedArgs, InstallResult, InstallType)
 * - core/reporter.ts (Reporter)
 * - core/path-resolver.ts (PathResolver)
 * - services/fs-utils.ts (preflight, copyFile, copyDir, createSymlink, ensureDir, fileHash)
 *
 * 架构: architecture/03-core-decisions.md#D6
 * 模块边界: stages/ → services/, core/
 */

import { join, basename } from 'node:path'
import { access, readlink } from 'node:fs/promises'

import type { MatchedPlan, ParsedArgs, InstallResult } from '../core/types.js'
import { InstallType } from '../core/types.js'
import type { Reporter } from '../core/reporter.js'
import type { PathResolver } from '../core/path-resolver.js'
import {
  preflight,
  copyFile,
  copyDir,
  createSymlink,
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
 * 注意：此函数只用于 files 类型 copy 模式（单文件对比）。
 * symlink 模式和 directories 类型有各自的状态判定逻辑。
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

/**
 * 判断 symlink 安装状态：
 * - 目标链接不存在 → 'new'
 * - 目标链接存在但指向不同源 → 'updated'（先删再建）
 * - 目标链接存在且指向相同源 → 'skipped'
 *
 * 使用 readlink 对比链接目标路径（字符串比较），无需 hash。
 */
async function determineSymlinkStatus(
  srcPath: string,
  destPath: string,
): Promise<'new' | 'updated' | 'skipped'> {
  try {
    const existingTarget = await readlink(destPath)
    return existingTarget === srcPath ? 'skipped' : 'updated'
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR' || code === 'EINVAL') {
      // EINVAL: destPath 存在但不是 symlink（普通文件/目录）→ 视为 'updated'（createSymlink 会先 unlink）
      return code === 'EINVAL' ? 'updated' : 'new'
    }
    return 'new'
  }
}

// ── 断链检测 ──────────────────────────────────────────────────────────────────

/**
 * 安装完成后检查所有 symlink 结果的链接有效性（NFR-R6）。
 * 对 mode='symlink' 的结果项检测源文件是否可访问，断链时通过 reporter.warn 输出警告。
 */
async function checkBrokenLinks(
  resultItems: InstallResult['items'],
  modes: Map<string, 'copy' | 'symlink'>,
  reporter: Reporter,
): Promise<void> {
  for (const item of resultItems) {
    if (modes.get(item.targetPath) !== 'symlink') continue
    // 不跳过 skipped 状态：即使 symlink 未被重建（同路径同目标），
    // 仍应检测链接有效性，确保 AC #5 既有断链场景能输出警告
    try {
      const target = await readlink(item.targetPath)
      await access(target)
    } catch {
      reporter.warn(`⚠️ 断链: ${item.targetPath} → 目标文件不存在`)
    }
  }
}

// ── flatten 主文件查找 ────────────────────────────────────────────────────────

/** flatten 模式默认主文件名 */
const DEFAULT_MAIN_FILE = 'index.md'

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
 * - 文件/目录 I/O 操作失败时，copyFile/copyDir/createSymlink 内部抛出 AiforgeError(fatal)
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
  // 记录每个 targetPath 的安装模式，用于断链检测
  const itemModes = new Map<string, 'copy' | 'symlink'>()

  for (const item of plan.items) {
    // 空 sourceFiles 静默跳过：不创建目录、不产生副作用（CR R4-#1）
    if (item.sourceFiles.length === 0) continue

    // 根据 scope 推导 allowedRoot（与 preflight 保持一致）
    const allowedRoot = item.rule.scope === 'global' ? pathResolver.home() : process.cwd()

    // 确保目标目录存在（幂等）
    await ensureDir(item.targetPath)

    if (item.rule.type === InstallType.Flatten) {
      // ── flatten 类型 ──────────────────────────────────────────────
      // sourceFiles 是子目录列表（由 match-rules scanSourceFiles 扫描得到）
      // 从每个子目录中提取 mainFile（默认 index.md），扁平化重命名后安装到目标
      const mainFile = item.rule.mainFile || DEFAULT_MAIN_FILE

      for (const srcDir of item.sourceFiles) {
        const mainPath = join(srcDir, mainFile)
        const targetName = basename(srcDir) + '.md'
        const destPath = join(item.targetPath, targetName)

        // 检查主文件是否存在
        try {
          await access(mainPath)
        } catch (error) {
          const code = (error as NodeJS.ErrnoException).code
          if (code === 'ENOENT' || code === 'ENOTDIR') {
            // 主文件不存在，跳过该子目录，记录警告（AC #4）
            reporter.warn(`⚠️ flatten: ${basename(srcDir)}/ 中未找到 ${mainFile}，跳过`)
            resultItems.push({ status: 'skipped', sourcePath: srcDir, targetPath: destPath })
            continue
          }
          // 其他 I/O 错误向上抛出
          throw error
        }

        // 安全校验
        await validateDestPathSecurity(destPath, allowedRoot)

        if (item.mode === 'symlink') {
          const status = await determineSymlinkStatus(mainPath, destPath)
          if (status !== 'skipped') {
            await createSymlink(mainPath, destPath)
            reporter.updatePhase(targetName)
          }
          itemModes.set(destPath, 'symlink')
          resultItems.push({ status, sourcePath: mainPath, targetPath: destPath })
        } else {
          const status = await determineStatus(mainPath, destPath)
          if (status !== 'skipped') {
            await copyFile(mainPath, destPath)
            reporter.updatePhase(targetName)
          }
          resultItems.push({ status, sourcePath: mainPath, targetPath: destPath })
        }
      }
    } else {
      // ── files / directories 类型 ──────────────────────────────────
      for (const srcPath of item.sourceFiles) {
        if (item.rule.type === InstallType.Files) {
          const destPath = join(item.targetPath, basename(srcPath))

          // 文件级 symlink 逃逸校验（NFR-S5）
          await validateDestPathSecurity(destPath, allowedRoot)

          if (item.mode === 'symlink') {
            // symlink 模式（Task 1.3）：创建指向源文件绝对路径的符号链接
            const status = await determineSymlinkStatus(srcPath, destPath)
            if (status !== 'skipped') {
              await createSymlink(srcPath, destPath)
              reporter.updatePhase(basename(srcPath))
            }
            itemModes.set(destPath, 'symlink')
            resultItems.push({ status, sourcePath: srcPath, targetPath: destPath })
          } else {
            // copy 模式（Story 4.2 原逻辑）
            const status = await determineStatus(srcPath, destPath)
            if (status !== 'skipped') {
              await copyFile(srcPath, destPath)
              reporter.updatePhase(basename(srcPath))
            }
            resultItems.push({ status, sourcePath: srcPath, targetPath: destPath })
          }
        } else if (item.rule.type === InstallType.Directories) {
          const destPath = join(item.targetPath, basename(srcPath))

          // 目录级 symlink 逃逸校验（NFR-S5）
          await validateDestPathSecurity(destPath, allowedRoot)

          if (item.mode === 'symlink') {
            // symlink 模式（Task 1.4）：创建指向源目录绝对路径的符号链接
            const status = await determineSymlinkStatus(srcPath, destPath)
            if (status !== 'skipped') {
              await createSymlink(srcPath, destPath)
              reporter.updatePhase(basename(srcPath))
            }
            itemModes.set(destPath, 'symlink')
            resultItems.push({ status, sourcePath: srcPath, targetPath: destPath })
          } else {
            // copy 模式（Story 4.2 原逻辑）
            const status = await determineDirStatus(destPath)
            await copyDir(srcPath, destPath)
            reporter.updatePhase(basename(srcPath))
            resultItems.push({ status, sourcePath: srcPath, targetPath: destPath })
          }
        }
      }
    }
  }

  // 断链检测（Task 1.6 / AC #5 / NFR-R6）
  if (itemModes.size > 0) {
    await checkBrokenLinks(resultItems, itemModes, reporter)
  }

  reporter.completePhase()
  return { items: resultItems }
}
