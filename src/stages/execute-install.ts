/**
 * stages/execute-install.ts
 *
 * Install 管道阶段 — 安装执行（Story 4.2 + Story 4.3 + Story 4.4 + Story 4.5）
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
 * - 每个文件安装前调用冲突检测（Story 4.4）
 * - 冲突处理：交互式选项 / --force 覆盖 / 非 TTY 失败（Story 4.5）
 * - symlink 模式安装完成后执行断链检测（NFR-R6）
 * - 零结果诊断：安装结果为零项时输出诊断信息（FR-032）
 * - 临时文件说明：当前由 saveManifest 原子写入自清理（NFR-S6）
 * - fail-fast：文件操作异常时立即抛出 AiforgeError(fatal)
 *
 * 依赖：
 * - core/types.ts (MatchedPlan, ParsedArgs, InstallResult, InstallType, ManifestEntry)
 * - core/reporter.ts (Reporter)
 * - core/path-resolver.ts (PathResolver)
 * - services/fs-utils.ts (preflight, copyFile, copyDir, createSymlink, ensureDir, fileHash, backupFile)
 * - services/manifest.ts (checkConflict, ConflictType)
 * - stages/conflict-resolver.ts (handleConflict)
 *
 * 架构: architecture/03-core-decisions.md#D6
 * 模块边界: stages/ → services/, core/
 */

import { join, basename } from 'node:path'
import { access, readlink, stat } from 'node:fs/promises'

import type { MatchedPlan, ParsedArgs, InstallResult, ManifestEntry } from '../core/types.js'
import { InstallType } from '../core/types.js'
import type { Reporter } from '../core/reporter.js'
import type { PathResolver } from '../core/path-resolver.js'
import { TOOL_DEFINITIONS } from '../data/tool-registry.js'
import {
  preflight,
  copyFile,
  copyDir,
  createSymlink,
  ensureDir,
  fileHash,
  backupFile,
  backupDir,
  validateDestPathSecurity,
} from '../services/fs-utils.js'
import { checkConflict, checkDirConflict } from '../services/manifest.js'
import type { ConflictType } from '../services/manifest.js'
import { handleConflict } from './conflict-resolver.js'
import { msg } from '../core/messages.js'

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
      reporter.warn(msg('executeInstall.brokenLink').replace('{targetPath}', item.targetPath))
    }
  }
}

// ── flatten 主文件查找 ────────────────────────────────────────────────────────

/** flatten 模式默认主文件名 */
const DEFAULT_MAIN_FILE = 'index.md'

// ── 冲突检测辅助 ────────────────────────────────────────────────────────────

/**
 * 需要用户决策的冲突类型（Story 4.5）。
 * 包括：用户手写文件、未知来源文件、用户修改过的 aiforge 安装文件。
 */
const NEEDS_USER_DECISION: ConflictType[] = ['user-file', 'unknown-origin', 'user-modified']

/**
 * 在文件安装前执行冲突检测（Story 4.4 Task 2.3 + Story 4.5）。
 *
 * 当 manifestContext 未提供时跳过检测（向后兼容）。
 * 返回冲突类型。
 *
 * 冲突处理策略（Story 4.5）：
 * - 'none'：无冲突，正常安装
 * - 'aiforge-current'：已是最新，跳过安装
 * - 'aiforge-outdated'：源有更新，直接安装（aiforge 自己安装的文件）
 * - 'user-file' / 'unknown-origin' / 'user-modified'：需要用户决策
 */
async function detectConflict(
  srcPath: string,
  destPath: string,
  manifestContext: ManifestContext | undefined,
): Promise<ConflictType | undefined> {
  if (!manifestContext) return undefined

  const srcHash = await fileHash(srcPath)
  return checkConflict(destPath, srcHash, manifestContext.entries, manifestContext.degraded)
}

/**
 * 在目录安装前执行冲突检测（CR Round-1 修复）。
 *
 * 目录级冲突检测不做文件级 hash 对比，仅基于目标目录是否存在和 manifest 记录。
 * 当 manifestContext 未提供时跳过检测（向后兼容）。
 */
async function detectDirConflict(
  destPath: string,
  manifestContext: ManifestContext | undefined,
): Promise<ConflictType | undefined> {
  if (!manifestContext) return undefined

  return checkDirConflict(destPath, manifestContext.entries, manifestContext.degraded)
}

/**
 * 处理冲突检测结果。
 *
 * @returns 'skip' 表示跳过此文件，'proceed' 表示继续安装
 * @throws AiforgeError(CONFLICT_NON_TTY) 非 TTY 下需要用户决策时
 * @throws AiforgeError(USER_ABORT) 用户选择中止安装时
 */
async function processConflict(
  conflict: ConflictType | undefined,
  srcPath: string,
  destPath: string,
  force: boolean,
  reporter: Reporter,
): Promise<'skip' | 'proceed'> {
  if (!conflict || conflict === 'none') return 'proceed'
  if (conflict === 'aiforge-current') return 'skip'
  // aiforge-outdated: 源有更新，目标未被用户修改 → 直接安装
  if (conflict === 'aiforge-outdated') return 'proceed'

  // 需要用户决策的冲突类型
  if (NEEDS_USER_DECISION.includes(conflict)) {
    const decision = await handleConflict(destPath, srcPath, force, reporter)
    switch (decision) {
      case 'backup': {
        // 根据目标类型选择文件级或目录级备份（CR Round-2 修复）
        const destStat = await stat(destPath)
        if (destStat.isDirectory()) {
          await backupDir(destPath)
        } else {
          await backupFile(destPath)
        }
        return 'proceed'
      }
      case 'skip':
        return 'skip'
      case 'overwrite':
        return 'proceed'
      // 'abort' case is handled inside handleConflict (throws USER_ABORT)
    }
  }

  return 'proceed'
}

// ── 零结果诊断 ──────────────────────────────────────────────────────────────

/**
 * 零结果诊断（FR-032）。
 * 当安装结果为空或全部为 skipped 时，输出诊断信息。
 */
function diagnoseZeroResults(
  plan: MatchedPlan,
  resultItems: InstallResult['items'],
  reporter: Reporter,
): void {
  const hasActualInstall = resultItems.some(
    (item) => item.status === 'new' || item.status === 'updated',
  )
  if (hasActualInstall) return

  const scannedDirs = [...new Set(plan.items.map((item) => item.rule.sourceDir))]
  const matchedRules = plan.items.map((item) => `${item.rule.tool}:${item.rule.scope}`)

  reporter.warn(msg('executeInstall.zeroResultsWarning'))
  reporter.warn('')
  reporter.warn(msg('executeInstall.diagHeader'))
  reporter.warn(msg('executeInstall.diagScannedDirs').replace('{dirs}', scannedDirs.join(', ')))
  reporter.warn(
    msg('executeInstall.diagMatchedRules')
      .replace('{rules}', matchedRules.join(', '))
      .replace('{count}', String(matchedRules.length)),
  )
  reporter.warn(msg('executeInstall.diagAllSkipped'))
  reporter.warn('')
  reporter.warn(msg('executeInstall.suggestHeader'))
  reporter.warn(msg('executeInstall.suggestForce'))
  reporter.warn(msg('executeInstall.suggestCheckRepo'))
}

// ── manifest 冲突上下文 ─────────────────────────────────────────────────────

/**
 * 可选的 manifest 上下文，用于冲突检测（Story 4.4）。
 * 不提供时跳过冲突检测，保持向后兼容。
 */
export interface ManifestContext {
  entries: ManifestEntry[]
  degraded: boolean
}

// ── 主入口 ────────────────────────────────────────────────────────────────────

/**
 * executeInstall — Install 管道阶段主函数
 *
 * @param plan            匹配的安装计划
 * @param args            解析后的 CLI 参数（使用 args.force 判断 --force 模式）
 * @param reporter        输出报告器
 * @param pathResolver    路径解析器（用于 preflight 的 allowedRoot 推导）
 * @param manifestContext 可选 manifest 上下文，用于冲突检测（Story 4.4）
 * @returns               安装结果列表
 *
 * fail-fast 策略：
 * - 文件/目录 I/O 操作失败时，copyFile/copyDir/createSymlink 内部抛出 AiforgeError(fatal)
 * - 异常向上透传，管道立即终止
 * - 已完成的操作包含在 results 中（但因异常未返回，由调用方决定是否使用）
 *
 * 临时文件说明（NFR-S6）：
 * - 当前唯一临时文件场景（manifest.json.tmp）由 saveManifest() 内部原子 rename 自清理
 * - executeInstall 无需额外清理逻辑
 */
export async function executeInstall(
  plan: MatchedPlan,
  args: ParsedArgs,
  reporter: Reporter,
  pathResolver: PathResolver,
  manifestContext?: ManifestContext,
): Promise<InstallResult> {
  reporter.startPhase(msg('phases.install'))

  // Step 1: 预检查（路径安全性 + 可写性）
  await preflight(plan, pathResolver)

  // 构建 tool id → display name 映射（CR Round-1 修复：supply toolDisplayName to InstallResult）
  const toolNameMap = new Map(TOOL_DEFINITIONS.map((t) => [t.id, t.name]))

  const resultItems: InstallResult['items'] = []
  // 记录每个 targetPath 的安装模式，用于断链检测
  const itemModes = new Map<string, 'copy' | 'symlink'>()

  // 计算总安装项数（AC #2: 进度计数）
  // 排除空 sourceFiles 的 item（与循环内 continue 逻辑一致）
  const totalFiles = plan.items.reduce((sum, item) => {
    if (item.sourceFiles.length === 0) return sum
    return sum + item.sourceFiles.length
  }, 0)
  let processedCount = 0

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
            reporter.warn(
              msg('executeInstall.flattenMissingMainFile')
                .replace('{srcDir}', basename(srcDir))
                .replace('{mainFile}', mainFile),
            )
            resultItems.push({
              status: 'skipped',
              tool: item.rule.tool,
              toolDisplayName: toolNameMap.get(item.rule.tool),
              sourcePath: srcDir,
              targetPath: destPath,
            })
            processedCount++
            reporter.updatePhase(
              `${msg('phases.install').replace('...', '')}... (${processedCount}/${totalFiles})`,
            )
            continue
          }
          // 其他 I/O 错误向上抛出
          throw error
        }

        // 安全校验
        await validateDestPathSecurity(destPath, allowedRoot)

        // 冲突检测与处理（Story 4.4 + 4.5）
        const conflict = await detectConflict(mainPath, destPath, manifestContext)
        const conflictAction = await processConflict(
          conflict,
          mainPath,
          destPath,
          args.force,
          reporter,
        )
        if (conflictAction === 'skip') {
          resultItems.push({
            status: 'skipped',
            tool: item.rule.tool,
            toolDisplayName: toolNameMap.get(item.rule.tool),
            sourcePath: mainPath,
            targetPath: destPath,
          })
          processedCount++
          reporter.updatePhase(
            `${msg('phases.install').replace('...', '')}... (${processedCount}/${totalFiles})`,
          )
          continue
        }

        if (item.mode === 'symlink') {
          const status = await determineSymlinkStatus(mainPath, destPath)
          if (status !== 'skipped') {
            await createSymlink(mainPath, destPath)
          }
          processedCount++
          reporter.updatePhase(
            `${msg('phases.install').replace('...', '')}... (${processedCount}/${totalFiles})`,
          )
          itemModes.set(destPath, 'symlink')
          resultItems.push({
            status,
            tool: item.rule.tool,
            toolDisplayName: toolNameMap.get(item.rule.tool),
            sourcePath: mainPath,
            targetPath: destPath,
          })
        } else {
          const status = await determineStatus(mainPath, destPath)
          if (status !== 'skipped') {
            await copyFile(mainPath, destPath)
          }
          processedCount++
          reporter.updatePhase(
            `${msg('phases.install').replace('...', '')}... (${processedCount}/${totalFiles})`,
          )
          resultItems.push({
            status,
            tool: item.rule.tool,
            toolDisplayName: toolNameMap.get(item.rule.tool),
            sourcePath: mainPath,
            targetPath: destPath,
          })
        }
      }
    } else {
      // ── files / directories 类型 ──────────────────────────────────
      for (const srcPath of item.sourceFiles) {
        if (item.rule.type === InstallType.Files) {
          const destPath = join(item.targetPath, basename(srcPath))

          // 文件级 symlink 逃逸校验（NFR-S5）
          await validateDestPathSecurity(destPath, allowedRoot)

          // 冲突检测与处理（Story 4.4 + 4.5）
          const conflict = await detectConflict(srcPath, destPath, manifestContext)
          const conflictAction = await processConflict(
            conflict,
            srcPath,
            destPath,
            args.force,
            reporter,
          )
          if (conflictAction === 'skip') {
            resultItems.push({
              status: 'skipped',
              tool: item.rule.tool,
              toolDisplayName: toolNameMap.get(item.rule.tool),
              sourcePath: srcPath,
              targetPath: destPath,
            })
            processedCount++
            reporter.updatePhase(
              `${msg('phases.install').replace('...', '')}... (${processedCount}/${totalFiles})`,
            )
            continue
          }

          if (item.mode === 'symlink') {
            // symlink 模式（Task 1.3）：创建指向源文件绝对路径的符号链接
            const status = await determineSymlinkStatus(srcPath, destPath)
            if (status !== 'skipped') {
              await createSymlink(srcPath, destPath)
            }
            processedCount++
            reporter.updatePhase(
              `${msg('phases.install').replace('...', '')}... (${processedCount}/${totalFiles})`,
            )
            itemModes.set(destPath, 'symlink')
            resultItems.push({
              status,
              tool: item.rule.tool,
              toolDisplayName: toolNameMap.get(item.rule.tool),
              sourcePath: srcPath,
              targetPath: destPath,
            })
          } else {
            // copy 模式（Story 4.2 原逻辑）
            const status = await determineStatus(srcPath, destPath)
            if (status !== 'skipped') {
              await copyFile(srcPath, destPath)
            }
            processedCount++
            reporter.updatePhase(
              `${msg('phases.install').replace('...', '')}... (${processedCount}/${totalFiles})`,
            )
            resultItems.push({
              status,
              tool: item.rule.tool,
              toolDisplayName: toolNameMap.get(item.rule.tool),
              sourcePath: srcPath,
              targetPath: destPath,
            })
          }
        } else if (item.rule.type === InstallType.Directories) {
          const destPath = join(item.targetPath, basename(srcPath))

          // 目录级 symlink 逃逸校验（NFR-S5）
          await validateDestPathSecurity(destPath, allowedRoot)

          // 冲突检测与处理（CR Round-1 修复）：目录级冲突不做文件级 hash 对比
          const conflict = await detectDirConflict(destPath, manifestContext)
          const conflictAction = await processConflict(
            conflict,
            srcPath,
            destPath,
            args.force,
            reporter,
          )
          if (conflictAction === 'skip') {
            resultItems.push({
              status: 'skipped',
              tool: item.rule.tool,
              toolDisplayName: toolNameMap.get(item.rule.tool),
              sourcePath: srcPath,
              targetPath: destPath,
            })
            processedCount++
            reporter.updatePhase(
              `${msg('phases.install').replace('...', '')}... (${processedCount}/${totalFiles})`,
            )
            continue
          }

          if (item.mode === 'symlink') {
            // symlink 模式（Task 1.4）：创建指向源目录绝对路径的符号链接
            const status = await determineSymlinkStatus(srcPath, destPath)
            if (status !== 'skipped') {
              await createSymlink(srcPath, destPath)
            }
            processedCount++
            reporter.updatePhase(
              `${msg('phases.install').replace('...', '')}... (${processedCount}/${totalFiles})`,
            )
            itemModes.set(destPath, 'symlink')
            resultItems.push({
              status,
              tool: item.rule.tool,
              toolDisplayName: toolNameMap.get(item.rule.tool),
              sourcePath: srcPath,
              targetPath: destPath,
            })
          } else {
            // copy 模式（Story 4.2 原逻辑）
            const status = await determineDirStatus(destPath)
            await copyDir(srcPath, destPath)
            processedCount++
            reporter.updatePhase(
              `${msg('phases.install').replace('...', '')}... (${processedCount}/${totalFiles})`,
            )
            resultItems.push({
              status,
              tool: item.rule.tool,
              toolDisplayName: toolNameMap.get(item.rule.tool),
              sourcePath: srcPath,
              targetPath: destPath,
            })
          }
        }
      }
    }
  }

  // 断链检测（Task 1.6 / AC #5 / NFR-R6）
  if (itemModes.size > 0) {
    await checkBrokenLinks(resultItems, itemModes, reporter)
  }

  // 零结果诊断（FR-032 / AC #5）
  diagnoseZeroResults(plan, resultItems, reporter)

  reporter.completePhase()
  return { items: resultItems }
}
