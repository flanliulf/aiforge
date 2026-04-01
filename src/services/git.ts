/**
 * Git 服务封装 — SourceResolver 接口 + simple-git 薄封装
 *
 * 来源: Story 2.2 Task 2
 * 架构: architecture/03-core-decisions.md#D1
 *
 * MVP 只实现 GitSourceResolver，未来可扩展 LocalSourceResolver
 */

import simpleGit, { type SimpleGit } from 'simple-git'
import type { ResolvedSource } from '../core/types.js'
import { AiforgeError, EXIT_ARG_ERROR } from '../core/errors.js'
import { sanitizeUrl } from '../core/sanitize.js'
import { msg } from '../core/messages.js'

// ── SourceResolver 接口 ──────────────────────────────────────

/**
 * 知识源解析器接口
 *
 * MVP 只实现 GitSourceResolver，管道只依赖此接口。
 * 来源: architecture/03-core-decisions.md#D1
 */
export interface SourceResolver {
  canHandle(source: string): boolean
  resolve(source: string): Promise<ResolvedSource>
}

// ── GitSourceResolver ──────────────────────────────────────

// SCP-style SSH: git@host:org/repo.git
const SCP_SSH_RE = /^[^@]+@[^:]+:.+$/

/**
 * Git 仓库源解析器
 *
 * 支持 HTTPS、SSH (ssh://)、SCP-style (git@host:path) URL
 */
export class GitSourceResolver implements SourceResolver {
  /**
   * 判断给定的 source 字符串是否为 Git URL
   */
  canHandle(source: string): boolean {
    if (!source) return false

    // HTTPS
    if (source.startsWith('https://')) return true

    // ssh:// protocol
    if (source.startsWith('ssh://')) return true

    // SCP-style: git@host:path
    if (SCP_SSH_RE.test(source)) return true

    return false
  }

  /**
   * 解析 Git URL 为 ResolvedSource
   */
  async resolve(source: string): Promise<ResolvedSource> {
    return parseGitUrl(source)
  }
}

// ── simple-git 薄封装 ──────────────────────────────────────

/**
 * 创建 SimpleGit 实例
 *
 * 薄封装原则：不过度封装，只暴露项目需要的操作。
 * 来源: project-context.md — simple-git 封装
 */
export function createGit(baseDir?: string): SimpleGit {
  return simpleGit(baseDir ? { baseDir } : undefined)
}

// ── internal helpers ──────────────────────────────────────────

// SCP-style SSH: user@host:path (captures host and path)
const SCP_SSH_CAPTURE_RE = /^[^@]+@([^:]+):(.+)$/

function parseGitUrl(url: string): ResolvedSource {
  // ssh:// protocol
  if (url.startsWith('ssh://')) {
    const parsed = safeParseUrl(url)
    const repoPath = stripGitSuffix(parsed.pathname.replace(/^\//, ''))
    assertRepoPath(repoPath, url)
    return {
      hostname: parsed.hostname,
      repoPath,
      protocol: 'ssh',
    }
  }

  // SCP-style: git@host:path
  const scpMatch = SCP_SSH_CAPTURE_RE.exec(url)
  if (scpMatch) {
    const repoPath = stripGitSuffix(scpMatch[2]!)
    assertRepoPath(repoPath, url)
    return {
      hostname: scpMatch[1]!,
      repoPath,
      protocol: 'ssh',
    }
  }

  // HTTPS — 校验 scheme 白名单，拒绝 http:// / ftp:// / file:// 等不支持的协议
  const parsed = safeParseUrl(url)
  if (parsed.protocol !== 'https:') {
    const protocol = parsed.protocol.replace(/:$/, '')
    throw new AiforgeError(
      msg('git.unsupportedProtocol'),
      'UNSUPPORTED_PROTOCOL',
      EXIT_ARG_ERROR,
      'fatal',
      msg('git.unsupportedProtocolWhy').replace('{protocol}', protocol),
      ['npx aiforge https://gitlab.com/org/repo.git', 'npx aiforge git@gitlab.com:org/repo.git'],
    )
  }
  const repoPath = stripGitSuffix(parsed.pathname.replace(/^\//, ''))
  assertRepoPath(repoPath, url)
  return {
    hostname: parsed.hostname,
    repoPath,
    protocol: 'https',
  }
}

/**
 * 校验 repoPath 非空 — 拒绝 host-only URL（如 https://gitlab.com）
 */
function assertRepoPath(repoPath: string, url: string): void {
  if (!repoPath) {
    throw new AiforgeError(
      msg('git.missingRepoPath'),
      'INVALID_URL',
      EXIT_ARG_ERROR,
      'fatal',
      msg('git.missingRepoPathWhy').replace('{url}', sanitizeUrl(url)),
      ['npx aiforge https://gitlab.com/org/repo.git', 'npx aiforge git@gitlab.com:org/repo.git'],
    )
  }
}

/**
 * 安全解析 URL，将原生 TypeError 包装为 AiforgeError(INVALID_URL)
 *
 * 遵循 project-context.md 规则：
 * - 所有错误必须使用 AiforgeError
 * - 所有 logs/errors 使用 sanitizeUrl() 脱敏 token-bearing URL
 */
function safeParseUrl(url: string): URL {
  try {
    return new URL(url)
  } catch {
    throw new AiforgeError(
      msg('git.invalidUrl'),
      'INVALID_URL',
      EXIT_ARG_ERROR,
      'fatal',
      msg('git.invalidUrlWhy').replace('{url}', sanitizeUrl(url)),
      ['npx aiforge https://gitlab.com/org/repo.git', 'npx aiforge git@gitlab.com:org/repo.git'],
    )
  }
}

function stripGitSuffix(path: string): string {
  return path.replace(/\.git$/, '')
}
