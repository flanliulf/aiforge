/**
 * 管道编排器 — 阶段链骨架
 *
 * 来源: Story 1.5 Task 2 — 管道编排器
 * 架构: architecture/03-core-decisions.md#D6
 *
 * 阶段链: Resolve → Auth → Clone → Detect → Match → [Install] → Report
 * 每个阶段为占位函数，抛出"未实现"错误
 * dryRun 为 true 时跳过 Install 阶段
 */

import type {
  ParsedArgs,
  ResolvedSource,
  AuthenticatedSource,
  LocalRepo,
  DetectedEnv,
  MatchedPlan,
  InstallResult,
} from './core/types.js'
import type { Reporter } from './core/reporter.js'
import { AiforgeError, EXIT_INSTALL_FAILURE } from './core/errors.js'

// 重导出供 index.ts 使用，维持模块边界: index.ts → pipeline.ts + commands/
export type { ParsedArgs } from './core/types.js'
export type { Reporter } from './core/reporter.js'
export { createReporter } from './core/reporter.js'

/**
 * 将 commander opts 映射为 ParsedArgs
 *
 * 提取为独立函数以便测试直接验证，避免测试中复制映射逻辑
 */
export function mapOptsToArgs(
  repoUrl: string | undefined,
  opts: Record<string, unknown>,
): ParsedArgs {
  return {
    source: repoUrl ?? '',
    global: Boolean(opts['global']),
    link: Boolean(opts['link']),
    tools: (opts['tools'] as string[] | undefined) ?? [],
    dirs: (opts['dirs'] as string[] | undefined) ?? [],
    dryRun: Boolean(opts['dryRun']),
    quiet: Boolean(opts['quiet']),
    force: Boolean(opts['force']),
    ssh: Boolean(opts['ssh']),
    token: opts['token'] as string | undefined,
    cloneDir: opts['cloneDir'] as string | undefined,
    symlink: Boolean(opts['link']),
    flatten: false,
  }
}

// --- 阶段函数类型签名 ---

export type ResolveFn = (args: ParsedArgs, reporter: Reporter) => Promise<ResolvedSource>
export type AuthenticateFn = (
  source: ResolvedSource,
  args: ParsedArgs,
  reporter: Reporter,
) => Promise<AuthenticatedSource>
export type CloneFn = (
  authed: AuthenticatedSource,
  args: ParsedArgs,
  reporter: Reporter,
) => Promise<LocalRepo>
export type DetectFn = (
  repo: LocalRepo,
  args: ParsedArgs,
  reporter: Reporter,
) => Promise<DetectedEnv>
export type MatchFn = (
  env: DetectedEnv,
  args: ParsedArgs,
  reporter: Reporter,
) => Promise<MatchedPlan>
export type InstallFn = (
  plan: MatchedPlan,
  args: ParsedArgs,
  reporter: Reporter,
) => Promise<InstallResult>
export type ReportFn = (
  result: InstallResult | MatchedPlan,
  reporter: Reporter,
  mode?: 'result' | 'plan',
) => void

/** 管道阶段集合，用于依赖注入 */
export interface PipelineStages {
  resolve: ResolveFn
  authenticate: AuthenticateFn
  clone: CloneFn
  detect: DetectFn
  match: MatchFn
  install: InstallFn
  report: ReportFn
}

// --- 占位阶段函数 ---

function notImplemented(stage: string): never {
  throw new AiforgeError(
    `阶段 "${stage}" 未实现`,
    'NOT_IMPLEMENTED',
    EXIT_INSTALL_FAILURE,
    'fatal',
    '该阶段尚未实现',
    [],
  )
}

export const resolve: ResolveFn = async () => notImplemented('resolve')
export const authenticate: AuthenticateFn = async () => notImplemented('auth')
export const clone: CloneFn = async () => notImplemented('clone')
export const detect: DetectFn = async () => notImplemented('detect')
export const match: MatchFn = async () => notImplemented('match')
export const install: InstallFn = async () => notImplemented('install')

/**
 * Report 阶段默认实现 — 委托给 Reporter
 *
 * 类型判定优先级：
 * 1. 显式 mode 参数（由 runPipeline 在已知路径时传入）
 * 2. items 非空时通过 items[0] 的属性判断
 * 3. 兜底：items 为空且无 mode 时视为 plan（向后兼容）
 */
export const report: ReportFn = (result, reporter, mode) => {
  const isResult =
    mode === 'result' || (!mode && result.items.length > 0 && 'status' in result.items[0]!)
  if (isResult) {
    reporter.reportResult(result as InstallResult)
  } else {
    reporter.reportPlan(result as MatchedPlan)
  }
}

/** 默认阶段集合（全部为占位实现，report 委托 Reporter） */
export const DEFAULT_STAGES: PipelineStages = {
  resolve,
  authenticate,
  clone,
  detect,
  match,
  install,
  report,
}

/**
 * 管道编排器 — 按顺序执行所有阶段
 *
 * @param args - 解析后的 CLI 参数
 * @param reporter - 输出报告器
 * @param stages - 阶段函数集合，默认使用占位实现
 */
export async function runPipeline(
  args: ParsedArgs,
  reporter: Reporter,
  stages: PipelineStages = DEFAULT_STAGES,
): Promise<void> {
  try {
    const source = await stages.resolve(args, reporter)
    const authed = await stages.authenticate(source, args, reporter)
    const repo = await stages.clone(authed, args, reporter)
    const env = await stages.detect(repo, args, reporter)
    const plan = await stages.match(env, args, reporter)

    if (!args.dryRun) {
      const result = await stages.install(plan, args, reporter)
      stages.report(result, reporter, 'result')
    } else {
      stages.report(plan, reporter, 'plan')
    }
  } catch (error) {
    if (error instanceof AiforgeError && error.severity === 'fatal') {
      reporter.reportError(error)
      process.exitCode = error.exitCode
      return
    }
    // 非 AiforgeError 包装为 fatal
    const wrapped = new AiforgeError(
      error instanceof Error ? error.message : String(error),
      'ERR_UNKNOWN',
      EXIT_INSTALL_FAILURE,
      'fatal',
      '发生未预期的错误',
      [],
    )
    reporter.reportError(wrapped)
    process.exitCode = wrapped.exitCode
  }
}
