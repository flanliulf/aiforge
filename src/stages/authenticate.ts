/**
 * Auth 管道阶段 — 四层认证解析链
 *
 * 来源: Story 2.3 Task 1
 * 架构: architecture/03-core-decisions.md#D3
 *
 * 优先级链（高 → 低）:
 *   Layer 1: CLI 参数（--ssh / --token）
 *   Layer 2: 环境变量（AIFORGE_TOKEN > GITLAB_TOKEN）
 *   Layer 3: 配置文件 per-host（config.json auth[hostname]）
 *   Layer 4: 系统 Git 凭据管理器（不注入认证）
 */

import type { ResolvedSource, AuthenticatedSource, ParsedArgs } from '../core/types.js'
import type { Reporter } from '../core/reporter.js'
import type { PathResolver } from '../core/path-resolver.js'
import { AiforgeError, EXIT_ARG_ERROR } from '../core/errors.js'
import { sanitizeToken } from '../core/sanitize.js'
import { loadConfig, getHostAuth } from '../services/config.js'
import { UnixPathResolver } from '../core/path-resolver.js'
import { msg } from '../core/messages.js'

// ── URL 构建辅助 ───────────────────────────────────────────────

function buildTokenUrl(source: ResolvedSource, token: string): string {
  return `https://oauth2:${token}@${source.hostname}/${source.repoPath}.git`
}

function buildSshUrl(source: ResolvedSource): string {
  return `git@${source.hostname}:${source.repoPath}.git`
}

function buildPlainUrl(source: ResolvedSource): string {
  return `https://${source.hostname}/${source.repoPath}.git`
}

// ── 主阶段函数 ─────────────────────────────────────────────────

/**
 * 解析认证方式，返回含 cloneUrl 和 authMethod 的 AuthenticatedSource
 *
 * @throws AiforgeError(code: 'ARG_CONFLICT') — --ssh 与 --token 同时传入
 */
export async function authenticate(
  source: ResolvedSource,
  args: ParsedArgs,
  reporter: Reporter,
  pathResolver?: PathResolver,
): Promise<AuthenticatedSource> {
  reporter.startPhase(msg('phases.auth'))
  const finish = (result: AuthenticatedSource): AuthenticatedSource => {
    reporter.completePhase()
    return result
  }

  // Layer 0: 互斥校验（--ssh 与 --token 不能同时使用）
  if (args.ssh && args.token) {
    throw new AiforgeError(
      msg('authenticate.argConflict'),
      'ARG_CONFLICT',
      EXIT_ARG_ERROR,
      'fatal',
      msg('authenticate.argConflictWhy'),
      ['npx aiforge --ssh <repo>', 'npx aiforge --token <token> <repo>'],
    )
  }

  // Layer 1: CLI 参数（最高优先级）
  if (args.ssh) {
    return finish({
      ...source,
      cloneUrl: buildSshUrl(source),
      authMethod: 'ssh',
    })
  }

  if (args.token) {
    return finish({
      ...source,
      cloneUrl: buildTokenUrl(source, args.token),
      authMethod: 'token',
    })
  }

  // Layer 2: 环境变量（AIFORGE_TOKEN 优先于 GITLAB_TOKEN）
  const envToken = process.env['AIFORGE_TOKEN'] || process.env['GITLAB_TOKEN']
  if (envToken) {
    reporter.updatePhase(
      `${msg('phases.auth').replace('...', '')}... (Token: ${sanitizeToken(envToken)})`,
    )
    return finish({
      ...source,
      cloneUrl: buildTokenUrl(source, envToken),
      authMethod: 'token',
    })
  }

  // Layer 3: 配置文件 per-host
  try {
    const resolver = pathResolver ?? new UnixPathResolver()
    const config = await loadConfig(resolver)
    const hostAuth = getHostAuth(config, source.hostname)

    if (hostAuth) {
      if (hostAuth.method === 'ssh') {
        return finish({
          ...source,
          cloneUrl: buildSshUrl(source),
          authMethod: 'ssh',
        })
      }
      if (hostAuth.method === 'token' && hostAuth.token) {
        return finish({
          ...source,
          cloneUrl: buildTokenUrl(source, hostAuth.token),
          authMethod: 'token',
        })
      }
    }
  } catch (error) {
    // 仅 CONFIG_NOT_FOUND → 降级到 Layer 4（首次使用，尚未初始化配置，降级合理）
    // CONFIG_CORRUPT / CONFIG_READ_FAILED 等其他错误透传，让 pipeline 统一处理给出明确提示
    if (error instanceof AiforgeError && error.code === 'CONFIG_NOT_FOUND') {
      // 配置文件不存在，静默降级到系统凭据
    } else {
      throw error
    }
  }

  // Layer 4: 系统 Git 凭据管理器（不注入认证信息，依赖 git credential manager）
  return finish({
    ...source,
    cloneUrl: buildPlainUrl(source),
    authMethod: 'credential-manager',
  })
}

// ── 内部辅助 ──────────────────────────────────────────────────
