/**
 * Clone 管道阶段 — Git 克隆与增量更新
 *
 * 来源: Story 2.4
 * 架构: architecture/03-core-decisions.md#D6
 *
 * 职责:
 *   - 首次克隆: 使用浅克隆（--depth 1）最小化网络传输（FR-003）
 *   - 增量更新: git pull 拉取变更（FR-004）
 *   - 克隆到 ~/.aiforge/repos/{repo-name}/（FR-005）
 *   - Token 清理: 克隆后重写 remote URL 为不含 Token 的版本，并清除内存引用（NFR-S2）
 *   - 失败清理: 首次克隆失败时只删除本次创建的目录（NFR-R1）
 */

import { join } from 'node:path'
import { access, rm, readdir } from 'node:fs/promises'
import type { AuthenticatedSource, ParsedArgs, LocalRepo } from '../core/types.js'
import type { Reporter } from '../core/reporter.js'
import type { PathResolver } from '../core/path-resolver.js'
import { AiforgeError, EXIT_INSTALL_FAILURE } from '../core/errors.js'
import { createGit } from '../services/git.js'
import { DEFAULT_EXCLUDES } from '../data/excludes.js'
import { UnixPathResolver } from '../core/path-resolver.js'

// ── 路径计算 ────────────────────────────────────────────────────

/**
 * 计算克隆目标路径
 *
 * 优先级: --clone-dir 参数 > pathResolver.reposDir() + repo-name
 * repo-name = repoPath 最后一段（如 org/aicoding-base → aicoding-base）
 */
function getTargetDir(
  source: AuthenticatedSource,
  args: ParsedArgs,
  pathResolver: PathResolver,
): string {
  if (args.cloneDir) return args.cloneDir
  const repoName = source.repoPath.split('/').pop()!
  return join(pathResolver.reposDir(), repoName)
}

// ── Token 清理 ──────────────────────────────────────────────────

/**
 * 构建不含 Token 的 clean URL
 *
 * Token URL 格式: https://oauth2:token@host/path.git
 * Clean URL 格式: https://host/path.git
 */
function buildCleanUrl(source: AuthenticatedSource): string {
  // SSH / credential-manager 无 Token，直接返回 cloneUrl
  if (source.authMethod !== 'token') return source.cloneUrl
  return `https://${source.hostname}/${source.repoPath}.git`
}

/**
 * 克隆完成后清理 remote URL 中的 Token，并清除内存引用
 *
 * 仅 token 认证方式需要清理：
 * - ssh: URL 本身不含 Token，无需处理
 * - credential-manager: URL 本身不含 Token，无需处理
 * - token: cloneUrl 含 oauth2:token@host，需重写为 clean URL 并清除内存引用
 *
 * 修复 #2（CR Round-1）: 在 git remote set-url 完成后，同步清除 source.cloneUrl 内存引用
 * 修复 #3b（CR Round-1）: 包装底层错误为 AiforgeError(SANITIZE_REMOTE_FAILED)
 */
async function sanitizeRemoteUrl(source: AuthenticatedSource, targetDir: string): Promise<void> {
  if (source.authMethod !== 'token') return

  const cleanUrl = buildCleanUrl(source)
  const repoGit = createGit(targetDir)
  try {
    await repoGit.remote(['set-url', 'origin', cleanUrl])
  } catch (error) {
    throw new AiforgeError(
      'Token 清理失败：remote URL 重写出错',
      'SANITIZE_REMOTE_FAILED',
      EXIT_INSTALL_FAILURE,
      'fatal',
      error instanceof Error ? error.message : '未知错误',
      [
        'git remote set-url origin <clean-url>  # 手动重写 remote URL',
        '检查 .git/config 中的 remote origin 配置',
      ],
    )
  }

  // 清除内存中的 token-bearing URL 引用（Story Task 2.3 / AC #5）
  // source 是引用对象，直接赋值清除内存中可访问的含 Token URL
  source.cloneUrl = cleanUrl
}

// ── 源文件扫描 ──────────────────────────────────────────────────

/**
 * 扫描仓库根目录，返回顶层文件和目录列表
 *
 * 排除:
 *   - .git 目录
 *   - DEFAULT_EXCLUDES 中的文件名
 *
 * 修复 #3c（CR Round-1）: 包装底层错误为 AiforgeError(SCAN_FAILED)
 */
async function scanSourceFiles(repoDir: string): Promise<string[]> {
  const EXCLUDED_SET = new Set(['.git', ...DEFAULT_EXCLUDES])

  let entries: Awaited<ReturnType<typeof readdir>>
  try {
    entries = await readdir(repoDir, { withFileTypes: true })
  } catch (error) {
    throw new AiforgeError(
      '扫描仓库文件失败',
      'SCAN_FAILED',
      EXIT_INSTALL_FAILURE,
      'fatal',
      error instanceof Error ? error.message : '未知错误',
      ['检查仓库目录权限', `ls -la ${repoDir}  # 查看目录内容`],
    )
  }

  return entries.map((e) => e.name).filter((name) => !EXCLUDED_SET.has(name))
}

// ── 存在性检查 ──────────────────────────────────────────────────

/**
 * 检查本地是否已有仓库（目录存在且含 .git）
 *
 * 修复 #3a（CR Round-1）: 区分错误类型，仅对 ENOENT/ENOTDIR 降级为 false
 * 其他错误（如 EACCES 权限拒绝、EIO I/O 错误）向上抛出，避免误入 freshClone 路径
 */
async function hasLocalRepo(targetDir: string): Promise<boolean> {
  try {
    await access(join(targetDir, '.git'))
    return true
  } catch (error) {
    // ENOENT: .git 目录不存在（正常：首次克隆场景）
    // ENOTDIR: 路径组件不是目录（正常：targetDir 是文件而非目录）
    // → 以上两种情况降级为 false，走 freshClone 路径
    if (
      error instanceof Error &&
      'code' in error &&
      (error.code === 'ENOENT' || error.code === 'ENOTDIR')
    ) {
      return false
    }
    // 其他错误（EACCES 权限拒绝、EIO I/O 错误等）向上抛出
    // 避免误判为"本地无仓库"后错误进入 freshClone 路径
    throw error
  }
}

/**
 * 检查目标目录是否已存在（用于 freshClone 失败清理边界判断）
 *
 * 修复 #1（CR Round-2）: 与 hasLocalRepo() 保持一致的白名单降级逻辑
 * 仅对 ENOENT/ENOTDIR 降级为 false，其他错误（如 EACCES）向上抛出
 * 避免因权限拒绝等异常被误判为"目录不存在"，导致错误删除原本存在的用户目录
 */
async function dirExists(targetDir: string): Promise<boolean> {
  try {
    await access(targetDir)
    return true
  } catch (error) {
    // ENOENT: 目录不存在（正常）
    // ENOTDIR: 路径组件不是目录（正常）
    if (
      error instanceof Error &&
      'code' in error &&
      (error.code === 'ENOENT' || error.code === 'ENOTDIR')
    ) {
      return false
    }
    // 其他错误（EACCES 权限拒绝等）向上抛出，防止误判导致意外删除
    throw error
  }
}

// ── 主阶段函数 ──────────────────────────────────────────────────

/**
 * Clone 阶段主函数
 *
 * @param source - 已认证的源信息（含 cloneUrl、authMethod）
 * @param args   - 解析后的 CLI 参数
 * @param reporter - 输出报告器
 * @param pathResolver - 路径解析器（默认 UnixPathResolver）
 * @returns LocalRepo: { repoDir, isNew, sourceFiles }
 */
export async function cloneRepo(
  source: AuthenticatedSource,
  args: ParsedArgs,
  reporter: Reporter,
  pathResolver: PathResolver = new UnixPathResolver(),
): Promise<LocalRepo> {
  reporter.startPhase('克隆仓库...')

  const targetDir = getTargetDir(source, args, pathResolver)
  const isExisting = await hasLocalRepo(targetDir)

  if (isExisting) {
    // 增量更新
    await incrementalUpdate(source, targetDir)
    const sourceFiles = await scanSourceFiles(targetDir)
    return { repoDir: targetDir, isNew: false, sourceFiles }
  } else {
    // 首次克隆
    await freshClone(source, targetDir)
    await sanitizeRemoteUrl(source, targetDir)
    const sourceFiles = await scanSourceFiles(targetDir)
    return { repoDir: targetDir, isNew: true, sourceFiles }
  }
}

// ── 内部实现 ────────────────────────────────────────────────────

/**
 * 首次浅克隆
 *
 * 失败时只清理本次克隆创建的目录（NFR-R1）
 * 修复 #1（CR Round-1）: 记录目录原始存在性，只删除本次克隆创建的目录
 * 修复 #1（CR Round-3）: cleanup 失败信息追加到 CLONE_FAILED.fix 中，不再裸 catch {}
 * 抛出 AiforgeError(CLONE_FAILED, fatal)
 */
async function freshClone(source: AuthenticatedSource, targetDir: string): Promise<void> {
  // 记录目标目录在克隆前是否已存在（修复 #1）
  const targetExistedBefore = await dirExists(targetDir)

  const git = createGit()
  try {
    await git.clone(source.cloneUrl, targetDir, ['--depth', '1'])
  } catch (error) {
    // 只清理本次克隆创建的目录：若目录在克隆前已存在，不删除（可能是用户数据）
    // best-effort cleanup: 失败信息记录到 cleanupWarning，追加到 CLONE_FAILED.fix 中
    let cleanupWarning: string | undefined
    if (!targetExistedBefore) {
      try {
        await rm(targetDir, { recursive: true, force: true })
      } catch (rmError) {
        // cleanup 失败：不遮盖 clone 主错误，但将信息暴露给用户（CR Round-3 合规修复）
        cleanupWarning = rmError instanceof Error ? rmError.message : '未知错误'
      }
    }
    throw new AiforgeError(
      '克隆仓库失败',
      'CLONE_FAILED',
      EXIT_INSTALL_FAILURE,
      'fatal',
      error instanceof Error ? error.message : '未知网络错误',
      [
        ...(cleanupWarning
          ? [`⚠️ 清理未完成目录也失败: ${cleanupWarning}，请手动删除: rm -rf ${targetDir}`]
          : []),
        'npx aiforge --ssh  # 尝试 SSH 认证',
        'git clone <url>   # 手动测试 Git 连接',
        '检查网络连接和防火墙设置',
      ],
    )
  }
}

/**
 * 增量更新（git pull）
 *
 * 失败时不删除已有仓库，直接抛出 AiforgeError
 */
async function incrementalUpdate(source: AuthenticatedSource, targetDir: string): Promise<void> {
  const repoGit = createGit(targetDir)
  try {
    await repoGit.pull()
  } catch (error) {
    throw new AiforgeError(
      '增量更新失败',
      'PULL_FAILED',
      EXIT_INSTALL_FAILURE,
      'fatal',
      error instanceof Error ? error.message : '未知错误',
      ['git pull  # 手动测试 Git 更新', 'npx aiforge --ssh  # 尝试 SSH 认证', '检查网络连接'],
    )
  }
}
