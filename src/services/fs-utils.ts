/**
 * services/fs-utils.ts
 *
 * 文件操作工具集与预检查逻辑
 * - 依赖 core/（AiforgeError、MatchedPlan、PathResolver、messages）和 Node.js 内置模块
 * - 不依赖 stages/、data/、commands/
 */

import {
  copyFile as fsCopyFile,
  mkdir,
  cp,
  symlink,
  unlink,
  lstat,
  stat,
  access,
  constants,
  realpath,
  readlink,
} from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, resolve, dirname } from 'node:path'

import { AiforgeError, EXIT_INSTALL_FAILURE } from '../core/errors.js'
import type { MatchedPlan } from '../core/types.js'
import type { PathResolver } from '../core/path-resolver.js'
import { msg } from '../core/messages.js'

// ── PreflightResult ──────────────────────────────────────────────────────────

export interface PreflightResult {
  ok: true
  dirsToCreate: string[]
}

// ── copyFile ─────────────────────────────────────────────────────────────────

/**
 * 复制单个文件到目标路径。
 * 自动创建目标父目录（如不存在）。
 */
export async function copyFile(src: string, dest: string): Promise<void> {
  try {
    await mkdir(dirname(dest), { recursive: true })
    await fsCopyFile(src, dest)
  } catch (error) {
    throw new AiforgeError(
      msg('fsUtils.copyFileFailed').replace('{src}', src).replace('{dest}', dest),
      'FILE_COPY_FAILED',
      EXIT_INSTALL_FAILURE,
      'fatal',
      msg('fsUtils.copyFileWhy').replace('{err}', errorMessage(error)),
      [
        msg('fsUtils.fixCheckSourceFile').replace('{path}', src),
        msg('fsUtils.fixCheckTargetDirWritable').replace('{dir}', dirname(dest)),
      ],
    )
  }
}

// ── copyDir ──────────────────────────────────────────────────────────────────

/**
 * 递归复制整个目录到目标路径。
 */
export async function copyDir(src: string, dest: string): Promise<void> {
  try {
    await cp(src, dest, { recursive: true })
  } catch (error) {
    throw new AiforgeError(
      msg('fsUtils.copyDirFailed').replace('{src}', src).replace('{dest}', dest),
      'DIR_COPY_FAILED',
      EXIT_INSTALL_FAILURE,
      'fatal',
      msg('fsUtils.copyDirWhy').replace('{err}', errorMessage(error)),
      [
        msg('fsUtils.fixCheckSourceDir').replace('{path}', src),
        msg('fsUtils.fixCheckTargetDirWritable').replace('{dir}', dirname(dest)),
      ],
    )
  }
}

// ── createSymlink ────────────────────────────────────────────────────────────

/**
 * 创建符号链接。如果 linkPath 已存在（文件或链接），先删除再创建。
 * 自动创建父目录（如不存在）。
 */
export async function createSymlink(target: string, linkPath: string): Promise<void> {
  try {
    await mkdir(dirname(linkPath), { recursive: true })
    // 如果已存在旧链接/文件，先删除
    try {
      await lstat(linkPath)
      await unlink(linkPath)
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw e
      }
    }
    await symlink(target, linkPath)
  } catch (error) {
    if (error instanceof AiforgeError) throw error
    throw new AiforgeError(
      msg('fsUtils.symlinkFailed').replace('{target}', target).replace('{linkPath}', linkPath),
      'SYMLINK_CREATE_FAILED',
      EXIT_INSTALL_FAILURE,
      'fatal',
      msg('fsUtils.symlinkWhy').replace('{err}', errorMessage(error)),
      [
        msg('fsUtils.fixCheckLinkParentWritable'),
        msg('fsUtils.fixCheckTargetValid').replace('{path}', target),
      ],
    )
  }
}

// ── backupFile ───────────────────────────────────────────────────────────────

/**
 * 备份文件，返回备份路径。
 * 备份文件命名规则: `<原路径>.aiforge-backup-YYYYMMDD`
 */
export async function backupFile(filePath: string): Promise<string> {
  try {
    const backupPath = getBackupPath(filePath)
    await fsCopyFile(filePath, backupPath)
    return backupPath
  } catch (error) {
    throw new AiforgeError(
      msg('fsUtils.backupFileFailed').replace('{filePath}', filePath),
      'BACKUP_FAILED',
      EXIT_INSTALL_FAILURE,
      'fatal',
      msg('fsUtils.backupFileWhy').replace('{err}', errorMessage(error)),
      [
        msg('fsUtils.fixCheckSourceFile').replace('{path}', filePath),
        msg('fsUtils.fixCheckDirWritable').replace('{dir}', dirname(filePath)),
      ],
    )
  }
}

// ── backupDir ────────────────────────────────────────────────────────────────

/**
 * 备份目录（递归复制），返回备份路径。
 * 备份目录命名规则: `<原路径>.aiforge-backup-YYYYMMDD`
 */
export async function backupDir(dirPath: string): Promise<string> {
  try {
    const backupPath = getBackupPath(dirPath)
    await cp(dirPath, backupPath, { recursive: true })
    return backupPath
  } catch (error) {
    throw new AiforgeError(
      msg('fsUtils.backupDirFailed').replace('{dirPath}', dirPath),
      'BACKUP_FAILED',
      EXIT_INSTALL_FAILURE,
      'fatal',
      msg('fsUtils.backupDirWhy').replace('{err}', errorMessage(error)),
      [
        msg('fsUtils.fixCheckSourceDir').replace('{path}', dirPath),
        msg('fsUtils.fixCheckDirWritable').replace('{dir}', dirname(dirPath)),
      ],
    )
  }
}

function getBackupPath(filePath: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `${filePath}.aiforge-backup-${date}`
}

// ── ensureDir ────────────────────────────────────────────────────────────────

/**
 * 确保目录存在（递归创建）。幂等操作，目录已存在不报错。
 */
export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await mkdir(dirPath, { recursive: true })
  } catch (error) {
    throw new AiforgeError(
      msg('fsUtils.ensureDirFailed').replace('{dirPath}', dirPath),
      'ENSURE_DIR_FAILED',
      EXIT_INSTALL_FAILURE,
      'fatal',
      msg('fsUtils.ensureDirWhy').replace('{err}', errorMessage(error)),
      [
        msg('fsUtils.fixCheckDirWritable').replace('{dir}', dirname(dirPath)),
        msg('fsUtils.fixCheckPathConflict'),
      ],
    )
  }
}

// ── isWritable ───────────────────────────────────────────────────────────────

/**
 * 检查目录是否可写且可遍历（W_OK | X_OK）。
 * 目录不存在返回 false；其他 I/O 错误向上抛出。
 * 使用 W_OK | X_OK 而非仅 W_OK，以正确处理 `0o222`（有写权限但无执行/遍历权限）
 * 等边界情况，确保实际文件写入不会在 preflight 之后意外失败（POSIX 精确性）。
 */
export async function isWritable(dirPath: string): Promise<boolean> {
  try {
    await access(dirPath, constants.W_OK | constants.X_OK)
    return true
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return false
    }
    if (code === 'EACCES') {
      return false
    }
    throw error
  }
}

// ── fileHash ─────────────────────────────────────────────────────────────────

/**
 * 计算文件的 SHA256 hash，返回十六进制字符串（64 chars）。
 */
export async function fileHash(filePath: string): Promise<string> {
  try {
    return await new Promise<string>((resolveP, rejectP) => {
      const hash = createHash('sha256')
      const stream = createReadStream(filePath)
      stream.on('data', (data) => hash.update(data))
      stream.on('end', () => resolveP(hash.digest('hex')))
      stream.on('error', rejectP)
    })
  } catch (error) {
    throw new AiforgeError(
      msg('fsUtils.fileHashFailed').replace('{filePath}', filePath),
      'FILE_HASH_FAILED',
      EXIT_INSTALL_FAILURE,
      'fatal',
      msg('fsUtils.fileHashWhy').replace('{err}', errorMessage(error)),
      [
        msg('fsUtils.fixCheckFileExists').replace('{path}', filePath),
        msg('fsUtils.fixCheckFileReadable'),
      ],
    )
  }
}

// ── preflight ────────────────────────────────────────────────────────────────

/**
 * 安装预检查：验证所有目标路径的父目录可写性和路径安全性。
 *
 * - 路径遍历检测：目标路径 resolve() 后必须在 allowedRoot 下
 * - 可写性检查：对每个目标路径的父目录执行 W_OK 检查
 * - 不存在目录标记：记录需要创建的目录列表
 * - fail-fast：首个不可写路径即抛出 PERMISSION_DENIED
 *
 * allowedRoot 由 pathResolver + plan item scope 自动推导：
 *   - scope='global' → pathResolver.home()
 *   - scope='project' → process.cwd()
 *
 * @param plan         匹配的安装计划
 * @param pathResolver PathResolver 实例，用于推导 allowedRoot
 */
export async function preflight(
  plan: MatchedPlan,
  pathResolver: PathResolver,
): Promise<PreflightResult> {
  const dirsToCreate: string[] = []

  for (const item of plan.items) {
    const targetPath = item.targetPath
    // 根据 scope 推导 allowedRoot（全局 → home，项目 → cwd）
    const allowedRoot = item.rule.scope === 'global' ? pathResolver.home() : process.cwd()

    // 1. 路径遍历检测（NFR-S5）
    validatePathSecurity(targetPath, allowedRoot)

    // 2. 判断目标路径的状态并检查可写性
    await checkTargetWritability(targetPath, dirsToCreate, allowedRoot)
  }

  return { ok: true, dirsToCreate }
}

/**
 * 验证 targetPath 在 allowedRoot 范围内（防路径遍历）。
 * 使用 resolve() 做字符串层面的基础检查（排除 `..` 等路径穿越）。
 * 注意：此函数不跟随 symlink，symlink 逃逸由 validateAncestorRealpath() 处理。
 */
function validatePathSecurity(targetPath: string, allowedRoot: string): void {
  const resolved = resolve(targetPath)
  const root = resolve(allowedRoot)
  if (!resolved.startsWith(join(root, '/')) && resolved !== root) {
    throw new AiforgeError(
      msg('fsUtils.pathTraversal'),
      'PATH_TRAVERSAL',
      EXIT_INSTALL_FAILURE,
      'fatal',
      msg('fsUtils.pathTraversalWhy')
        .replace('{target}', targetPath)
        .replace('{root}', allowedRoot),
      [msg('fsUtils.fixCheckTargetDir')],
    )
  }
}

/**
 * 对已存在的祖先目录进行 realpath 验证，防止 symlink 逃逸绕过 allowedRoot。
 *
 * resolve() 不跟随 symlink，仅做纯字符串规范化。若路径链中存在指向 allowedRoot
 * 之外的 symlink，validatePathSecurity() 无法发现。此函数通过 realpath() 获取
 * 祖先目录和 allowedRoot 的真实物理路径，然后重新做 startsWith 检查。
 *
 * @param ancestorDir  findExistingAncestor() 返回的已存在祖先目录（用于 realpath）
 * @param allowedRoot  preflight 推导的安全根目录
 * @throws AiforgeError(PATH_TRAVERSAL) 当真实路径逃逸 allowedRoot 时
 */
async function validateAncestorRealpath(ancestorDir: string, allowedRoot: string): Promise<void> {
  const realAncestor = await realpath(ancestorDir)
  const realRoot = await realpath(allowedRoot)
  if (!realAncestor.startsWith(join(realRoot, '/')) && realAncestor !== realRoot) {
    throw new AiforgeError(
      msg('fsUtils.symlinkEscape'),
      'PATH_TRAVERSAL',
      EXIT_INSTALL_FAILURE,
      'fatal',
      msg('fsUtils.symlinkEscapeWhy')
        .replace('{ancestor}', ancestorDir)
        .replace('{real}', realAncestor)
        .replace('{root}', allowedRoot)
        .replace('{realRoot}', realRoot),
      [msg('fsUtils.fixCheckSymlink'), msg('fsUtils.fixCheckTargetDir')],
    )
  }
}

/**
 * 向上遍历路径，找到第一个实际存在的祖先目录。
 * 用于处理嵌套不存在目录（如 /tmp/a/b/c，a/b/c 都不存在时，返回 /tmp）。
 *
 * @throws AiforgeError(PATH_NOT_DIRECTORY) 当路径链中某段存在但不是目录时
 */
async function findExistingAncestor(targetPath: string): Promise<string> {
  let current = dirname(resolve(targetPath))
  while (true) {
    try {
      const entryStat = await lstat(current)
      if (entryStat.isSymbolicLink()) {
        // symlink：跟随链接确认目标类型
        let linkTargetStat
        try {
          linkTargetStat = await stat(current)
        } catch {
          // broken symlink（目标不存在）：无法在其下创建子路径
          throw new AiforgeError(
            msg('fsUtils.brokenSymlink').replace('{path}', current),
            'PATH_NOT_DIRECTORY',
            EXIT_INSTALL_FAILURE,
            'fatal',
            msg('fsUtils.brokenSymlinkWhy').replace('{path}', current),
            [msg('fsUtils.fixCheckPathConfig')],
          )
        }
        if (!linkTargetStat.isDirectory()) {
          // symlink 指向非目录（如文件），无法在其下创建子路径
          throw new AiforgeError(
            msg('fsUtils.symlinkToNonDir').replace('{path}', current),
            'PATH_NOT_DIRECTORY',
            EXIT_INSTALL_FAILURE,
            'fatal',
            msg('fsUtils.symlinkToNonDirWhy').replace('{path}', current),
            [msg('fsUtils.fixCheckPathConfig')],
          )
        }
      } else if (!entryStat.isDirectory()) {
        // 路径链中存在一个非目录条目（如文件），无法在其下创建子路径
        throw new AiforgeError(
          msg('fsUtils.nonDirInPath').replace('{path}', current),
          'PATH_NOT_DIRECTORY',
          EXIT_INSTALL_FAILURE,
          'fatal',
          msg('fsUtils.nonDirInPathWhy').replace('{path}', current),
          [msg('fsUtils.fixCheckPathConfig')],
        )
      }
      return current
    } catch (e) {
      if (e instanceof AiforgeError) throw e
      const code = (e as NodeJS.ErrnoException).code
      if (code === 'ENOENT' || code === 'ENOTDIR') {
        const parent = dirname(current)
        if (parent === current) {
          // 已到根目录仍不存在（不应发生）
          return current
        }
        current = parent
      } else {
        throw e
      }
    }
  }
}

/**
 * 检查目标路径的可写性：
 * - 目标不存在 → 找到已存在祖先目录，做 realpath 安全校验 + 可写性检查，标记需创建
 * - 目标为目录 → 做 realpath 安全校验（防路径链祖先 symlink 逃逸），通过后交 4.4/4.5
 * - 目标为 symlink → 做 realpath 安全校验（防 symlink 本身指向外部），通过后允许覆盖
 * - 目标为文件 → 检查目标本身可写性
 *
 * fail-fast：不可写或 realpath 逃逸时立即抛出对应错误
 */
async function checkTargetWritability(
  targetPath: string,
  dirsToCreate: string[],
  allowedRoot: string,
): Promise<void> {
  // lstat the target to determine its existence and type
  type TargetStat = Awaited<ReturnType<typeof lstat>>
  let targetStat: TargetStat | null

  try {
    targetStat = await lstat(targetPath)
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      targetStat = null
    } else if (code === 'EACCES') {
      // 父目录不可读时 lstat 报 EACCES，当作目标不存在处理
      // (可写性检查会在 findExistingAncestor + isWritable 流程中发现权限问题)
      targetStat = null
    } else {
      throw e
    }
  }

  if (targetStat === null) {
    // 目标不存在 → 向上遍历找到第一个存在的祖先目录，检查其可写性
    const ancestorDir = await findExistingAncestor(targetPath)
    // symlink 逃逸校验：对已存在的祖先目录做 realpath 验证（NFR-S5 深度防护）
    await validateAncestorRealpath(ancestorDir, allowedRoot)
    const parentWritable = await isWritable(ancestorDir)
    if (!parentWritable) {
      throw new AiforgeError(
        msg('fsUtils.permissionDenied').replace('{dir}', ancestorDir),
        'PERMISSION_DENIED',
        EXIT_INSTALL_FAILURE,
        'fatal',
        msg('fsUtils.permissionDeniedWhy').replace('{dir}', ancestorDir),
        [msg('fsUtils.fixChmod').replace('{dir}', ancestorDir), msg('fsUtils.fixSudo')],
      )
    }
    // 标记需要创建
    dirsToCreate.push(targetPath)
  } else if (targetStat.isDirectory()) {
    // 目录类型 → 做 realpath 安全校验防止路径链中祖先 symlink 逃逸（NFR-S5）
    await validateAncestorRealpath(targetPath, allowedRoot)
    // 通过后交 4.4/4.5 处理冲突检测
  } else if (targetStat.isSymbolicLink()) {
    // 符号链接 → 需区分 broken symlink 和有效 symlink：
    // - broken symlink（目标不存在）：无法 realpath，但 symlink 模式会先删除再创建，直接通过
    // - 有效 symlink（目标存在）：做 realpath 安全校验，防止 symlink 本身指向 allowedRoot 外部（NFR-S5）
    let symlinkTargetExists = true
    try {
      await stat(targetPath) // 跟随 symlink 检查目标是否存在
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
        symlinkTargetExists = false
      } else {
        throw e
      }
    }
    if (symlinkTargetExists) {
      await validateAncestorRealpath(targetPath, allowedRoot)
    }
    // broken symlink 直接通过（symlink 模式会先 unlink 再创建）
  } else {
    // 普通文件 → 检查目标本身可写
    let writable: boolean
    try {
      await access(targetPath, constants.W_OK)
      writable = true
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code
      if (code === 'EACCES') {
        writable = false
      } else if (code === 'ENOENT' || code === 'ENOTDIR') {
        writable = false
      } else {
        throw e
      }
    }
    if (!writable) {
      throw new AiforgeError(
        msg('fsUtils.fileNotWritable').replace('{filePath}', targetPath),
        'PERMISSION_DENIED',
        EXIT_INSTALL_FAILURE,
        'fatal',
        msg('fsUtils.fileNotWritableWhy').replace('{filePath}', targetPath),
        [msg('fsUtils.fixChmodFile').replace('{filePath}', targetPath), msg('fsUtils.fixSudo')],
      )
    }
  }
}

// ── validateDestPathSecurity ──────────────────────────────────────────────────

/**
 * 校验文件级目标路径（destPath）在 allowedRoot 范围内，防止 symlink 逃逸。
 *
 * preflight() 仅校验 item.targetPath（目录级）。execute-install 在循环中计算
 * destPath = join(targetPath, basename(src))，若 targetPath 下已预置同名 symlink
 * 指向 allowedRoot 外，copyFile/copyDir 会跟随 symlink 写到外部，绕过安全边界。
 *
 * 策略：
 * - destPath 已存在（普通文件/目录/symlink）→ 对 destPath 本身执行 realpath，校验在 allowedRoot 内
 * - destPath 不存在 → 找到最深已存在祖先目录，对祖先执行 validateAncestorRealpath
 *
 * @param destPath    最终文件写入路径（join(targetDir, basename(src)) 的结果）
 * @param allowedRoot 安全根目录（scope=global → home()，scope=project → cwd()）
 * @throws AiforgeError(PATH_TRAVERSAL) 当真实路径逃逸 allowedRoot 时
 */
export async function validateDestPathSecurity(
  destPath: string,
  allowedRoot: string,
): Promise<void> {
  // 先用 resolve() 做字符串层面基础检查（排除 `..` 等路径穿越）
  validatePathSecurity(destPath, allowedRoot)

  // 再做 realpath 级 symlink 逃逸校验：先用 lstat 获取条目类型
  let entryStat: Awaited<ReturnType<typeof lstat>>
  try {
    entryStat = await lstat(destPath)
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    if (code !== 'ENOENT' && code !== 'ENOTDIR') {
      throw e
    }
    // destPath 不存在，校验其最深已存在祖先
    const ancestorDir = await findExistingAncestor(destPath)
    await validateAncestorRealpath(ancestorDir, allowedRoot)
    return
  }

  if (entryStat.isSymbolicLink()) {
    // destPath 是 symlink（无论是否 broken）：
    // 对 broken symlink，realpath 会 ENOENT；对有效 symlink，realpath 返回真实路径。
    // 两种情况都需要拒绝指向 allowedRoot 外的 symlink：
    // - 有效 symlink：使用 realpath 校验真实目标路径
    // - broken symlink：无法跟随，但 symlink 目标路径本身超出 allowedRoot 也应拒绝
    let realDest: string
    try {
      realDest = await realpath(destPath)
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code
      if (code === 'ENOENT' || code === 'ENOTDIR') {
        // broken symlink：读取 symlink 目标路径，做字符串层面校验
        // readlink 返回 symlink 存储的目标路径（可能是绝对路径或相对路径）
        const linkTarget = await readlink(destPath)
        // 将 symlink 目标路径规范化为绝对路径
        const resolvedTarget = resolve(dirname(destPath), linkTarget)
        validatePathSecurity(resolvedTarget, allowedRoot)
        // 字符串层面通过安全校验：broken symlink 目标在 allowedRoot 内
        // 这是合法的业务场景（如：先安装成功的 symlink 后来因源文件删除变成 broken）
        // 允许继续安装流程（后续会删除旧 broken link 并创建新链接）
        return
      }
      throw e
    }
    const realRoot = await realpath(allowedRoot)
    if (!realDest.startsWith(join(realRoot, '/')) && realDest !== realRoot) {
      throw new AiforgeError(
        msg('fsUtils.symlinkEscape'),
        'PATH_TRAVERSAL',
        EXIT_INSTALL_FAILURE,
        'fatal',
        msg('fsUtils.symlinkEscapeWhy')
          .replace('{ancestor}', destPath)
          .replace('{real}', realDest)
          .replace('{root}', allowedRoot)
          .replace('{realRoot}', realRoot),
        [msg('fsUtils.fixCheckSymlink'), msg('fsUtils.fixCheckTargetDir')],
      )
    }
  } else {
    // 普通文件或目录：做 realpath 安全校验（防止路径链中祖先存在 symlink 逃逸）
    let realDest: string
    try {
      realDest = await realpath(destPath)
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code
      if (code === 'ENOENT' || code === 'ENOTDIR') {
        // destPath 存在（lstat 成功）但 realpath 失败，退化为祖先校验
        const ancestorDir = await findExistingAncestor(destPath)
        await validateAncestorRealpath(ancestorDir, allowedRoot)
        return
      }
      throw e
    }
    const realRoot = await realpath(allowedRoot)
    if (!realDest.startsWith(join(realRoot, '/')) && realDest !== realRoot) {
      throw new AiforgeError(
        msg('fsUtils.symlinkEscape'),
        'PATH_TRAVERSAL',
        EXIT_INSTALL_FAILURE,
        'fatal',
        msg('fsUtils.symlinkEscapeWhy')
          .replace('{ancestor}', destPath)
          .replace('{real}', realDest)
          .replace('{root}', allowedRoot)
          .replace('{realRoot}', realRoot),
        [msg('fsUtils.fixCheckSymlink'), msg('fsUtils.fixCheckTargetDir')],
      )
    }
  }
}

// ── internal helpers ─────────────────────────────────────────────────────────

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}
