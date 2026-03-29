/**
 * services/manifest.ts
 *
 * manifest 状态管理与冲突检测服务
 * - 读写 manifest.json（原子写入、损坏降级）
 * - 冲突类型检测（4 种冲突 + none + unknown-origin）
 * - manifest 条目构建与合并
 *
 * 依赖：core/（types、errors）、services/fs-utils（fileHash）
 * 不依赖：stages/、data/、commands/
 */

import { readFile, writeFile, rename, mkdir, access } from 'node:fs/promises'
import { join, relative } from 'node:path'

import type { ManifestEntry } from '../core/types.js'
import type { PathResolver } from '../core/path-resolver.js'
import { fileHash } from './fs-utils.js'

// ── ConflictType ────────────────────────────────────────────────────────────

export type ConflictType =
  | 'none' // 目标文件不存在
  | 'aiforge-current' // 目标hash=manifest hash 且 源hash=manifest hash（已是最新）
  | 'aiforge-outdated' // 目标hash=manifest hash 且 源hash≠manifest hash（源有更新）
  | 'user-modified' // 在 manifest 但目标hash≠manifest hash（用户修改了 aiforge 安装的文件）
  | 'user-file' // 不在 manifest，manifest 正常（用户手写文件）
  | 'unknown-origin' // 不在 manifest，manifest 降级（系统无法判断来源）

// ── LoadManifestResult ──────────────────────────────────────────────────────

export interface LoadManifestResult {
  entries: ManifestEntry[]
  /** manifest 是否处于降级状态（损坏或丢失） */
  degraded: boolean
}

// ── loadManifest ────────────────────────────────────────────────────────────

/**
 * 读取并解析 manifest.json。
 *
 * 损坏降级策略（NFR-R5）：
 * - 文件不存在（ENOENT）→ 返回空数组 + degraded=true
 * - JSON 解析失败 → 返回空数组 + degraded=true
 * - 内容非数组 → 返回空数组 + degraded=true
 * - 其他 I/O 错误 → 返回空数组 + degraded=true（不抛错，保持降级语义）
 *
 * @param pathResolver PathResolver 实例，用于获取 configDir
 * @returns ManifestEntry[] 和 degraded 标志
 */
export async function loadManifest(pathResolver: PathResolver): Promise<LoadManifestResult> {
  const manifestPath = join(pathResolver.configDir(), 'manifest.json')
  try {
    const content = await readFile(manifestPath, 'utf-8')
    const parsed: unknown = JSON.parse(content)
    if (!Array.isArray(parsed)) {
      // 内容格式不合法，降级为空 manifest
      return { entries: [], degraded: true }
    }
    return { entries: parsed as ManifestEntry[], degraded: false }
  } catch {
    // 文件不存在、JSON 损坏、或其他 I/O 错误 → 降级为空 manifest（NFR-R5）
    return { entries: [], degraded: true }
  }
}

// ── saveManifest ────────────────────────────────────────────────────────────

/**
 * 原子写入 manifest.json。
 *
 * 策略：先写临时文件 (.tmp)，再 fs.rename() 替换（AC #2 / D3b）。
 * 确保 configDir 存在后再写入。
 *
 * @param entries      要持久化的 manifest 条目
 * @param pathResolver PathResolver 实例
 */
export async function saveManifest(
  entries: ManifestEntry[],
  pathResolver: PathResolver,
): Promise<void> {
  const configDir = pathResolver.configDir()
  const manifestPath = join(configDir, 'manifest.json')
  const tmpPath = manifestPath + '.tmp'

  // 确保 configDir 存在
  await mkdir(configDir, { recursive: true })

  // 原子写入：tmp → rename
  await writeFile(tmpPath, JSON.stringify(entries, null, 2), 'utf-8')
  await rename(tmpPath, manifestPath)
}

// ── checkConflict ───────────────────────────────────────────────────────────

/**
 * 检测目标文件的冲突类型。
 *
 * 冲突矩阵（AC #3）：
 * - 目标不存在 → 'none'
 * - 不在 manifest + manifest 正常 → 'user-file'
 * - 不在 manifest + manifest 降级 → 'unknown-origin'
 * - 在 manifest + 目标hash≠manifest hash → 'user-modified'
 * - 在 manifest + 目标hash=manifest hash + 源hash=manifest hash → 'aiforge-current'
 * - 在 manifest + 目标hash=manifest hash + 源hash≠manifest hash → 'aiforge-outdated'
 *
 * @param targetPath       目标文件绝对路径
 * @param sourceHash       源文件 SHA256 hash
 * @param manifest         当前 manifest 条目列表
 * @param manifestDegraded manifest 是否处于降级状态
 */
export async function checkConflict(
  targetPath: string,
  sourceHash: string,
  manifest: ManifestEntry[],
  manifestDegraded: boolean,
): Promise<ConflictType> {
  // 检查目标文件是否存在
  try {
    await access(targetPath)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return 'none'
    }
    // 其他 I/O 错误（EACCES、EIO 等）向上抛出
    throw error
  }

  // 目标文件存在，查找 manifest 条目
  const entry = manifest.find((e) => e.target === targetPath)
  if (!entry) {
    return manifestDegraded ? 'unknown-origin' : 'user-file'
  }

  // 计算目标文件当前 hash
  const currentHash = await fileHash(targetPath)
  if (currentHash !== entry.hash) {
    // 用户修改了 aiforge 安装的文件
    return 'user-modified'
  }
  if (sourceHash === entry.hash) {
    // 源和目标都没变
    return 'aiforge-current'
  }
  // 源有更新，目标未被用户修改
  return 'aiforge-outdated'
}

// ── buildManifestEntries ────────────────────────────────────────────────────

/**
 * 从安装结果构建 manifest 条目。
 *
 * 跳过 status='skipped' 的项（未实际安装，不更新 manifest 记录）。
 *
 * @param results    安装结果中的单个 item 数组
 * @param tool       工具 ID
 * @param scope      安装范围
 * @param mode       安装模式
 * @param hashes     目标路径 → SHA256 hash 的映射（安装后计算）
 * @param repoDir    知识仓库根目录绝对路径，用于将 sourcePath 转换为相对路径
 */
export function buildManifestEntries(
  results: Array<{ sourcePath: string; targetPath: string; status: 'new' | 'updated' | 'skipped' }>,
  tool: string,
  scope: 'global' | 'project',
  mode: 'copy' | 'symlink' | 'flatten',
  hashes: Map<string, string>,
  repoDir: string,
): ManifestEntry[] {
  const now = new Date().toISOString()

  return results
    .filter((item) => item.status !== 'skipped')
    .map((item) => {
      const hash = hashes.get(item.targetPath)
      if (hash === undefined) {
        throw new Error(`manifest hash missing for target: ${item.targetPath}`)
      }
      return {
        source: relative(repoDir, item.sourcePath),
        target: item.targetPath,
        tool,
        scope,
        mode,
        hash,
        installedAt: now,
      }
    })
}

// ── mergeManifest ───────────────────────────────────────────────────────────

/**
 * 合并已有 manifest 条目和新安装的条目。
 * 新条目按 target 路径覆盖旧条目。
 *
 * @param existing   已有 manifest 条目
 * @param newEntries 本次安装新增的条目
 */
export function mergeManifest(
  existing: ManifestEntry[],
  newEntries: ManifestEntry[],
): ManifestEntry[] {
  const merged = new Map(existing.map((e) => [e.target, e]))
  for (const entry of newEntries) {
    merged.set(entry.target, entry)
  }
  return Array.from(merged.values())
}
