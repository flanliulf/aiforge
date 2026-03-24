/**
 * Resolve 管道阶段 — 知识源 URL 解析
 *
 * 来源: Story 2.2 Task 1
 * 架构: architecture/03-core-decisions.md#D6
 *
 * 输入: ParsedArgs (CLI 参数)
 * 输出: ResolvedSource (hostname, repoPath, protocol)
 *
 * 解析优先级:
 *   1. 用户通过 CLI 提供的 source URL
 *   2. config.json 中的 defaultRepo
 *   3. 抛出 NO_REPO 错误
 *
 * URL 解析委托给 GitSourceResolver（架构 D1 收口）
 */

import type { ParsedArgs, ResolvedSource } from '../core/types.js'
import type { Reporter } from '../core/reporter.js'
import type { PathResolver } from '../core/path-resolver.js'
import { AiforgeError, EXIT_ARG_ERROR } from '../core/errors.js'
import { loadConfig } from '../services/config.js'
import { GitSourceResolver } from '../services/git.js'

const gitResolver = new GitSourceResolver()

/**
 * Resolve 管道阶段函数
 *
 * @param args - 解析后的 CLI 参数
 * @param reporter - 输出报告器
 * @param pathResolver - 路径解析器（用于 loadConfig）
 * @returns 解析后的知识源信息
 * @throws AiforgeError NO_REPO - 无法确定仓库地址
 * @throws AiforgeError INVALID_URL - 仓库地址格式非法
 * @throws AiforgeError CONFIG_CORRUPT - 配置文件损坏
 * @throws AiforgeError CONFIG_READ_FAILED - 配置文件读取失败
 */
export async function resolveSource(
  args: ParsedArgs,
  reporter: Reporter,
  pathResolver: PathResolver,
): Promise<ResolvedSource> {
  reporter.startPhase('解析仓库地址...')

  const url = args.source || (await resolveDefaultRepo(pathResolver))
  const result = await gitResolver.resolve(url)
  reporter.completePhase()
  return result
}

// ── internal helpers ──────────────────────────────────────────

/**
 * 从 config.json 读取 defaultRepo，无配置时抛出 NO_REPO
 *
 * 仅对 CONFIG_NOT_FOUND 降级为"无默认配置"。
 * CONFIG_CORRUPT / CONFIG_READ_FAILED 等错误直接透传，
 * 避免吞掉配置层的真实错误（project-context.md 规则）。
 */
async function resolveDefaultRepo(pathResolver: PathResolver): Promise<string> {
  let defaultRepo: string | undefined

  try {
    const config = await loadConfig(pathResolver)
    defaultRepo = config.defaultRepo
  } catch (error) {
    // 仅 CONFIG_NOT_FOUND → 视为无默认配置，继续走 NO_REPO 分支
    if (error instanceof AiforgeError && error.code === 'CONFIG_NOT_FOUND') {
      // 无配置文件 → defaultRepo 保持 undefined，下方统一抛 NO_REPO
    } else {
      // CONFIG_CORRUPT / CONFIG_READ_FAILED 等 → 直接透传
      throw error
    }
  }

  if (!defaultRepo) {
    throw new AiforgeError(
      '未指定知识仓库地址',
      'NO_REPO',
      EXIT_ARG_ERROR,
      'fatal',
      '未通过命令行参数提供仓库 URL，且配置文件中无 defaultRepo',
      ['npx aiforge <repo-url>  # 直接指定仓库地址', 'npx aiforge init        # 配置默认仓库'],
    )
  }

  return defaultRepo
}
