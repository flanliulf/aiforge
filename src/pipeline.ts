/**
 * 管道编排器 — 完整阶段链
 *
 * 来源: Story 1.5 Task 2 / Story 3.3 / Story 4.6a
 * 架构: architecture/03-core-decisions.md#D6
 *
 * 阶段链: Resolve → Auth → Clone → Detect → Match → [Install → SaveManifest] → Report
 * dryRun 为 true 时跳过 Install 和 SaveManifest 阶段
 *
 * Story 4.6a: 替换所有占位函数为真实实现，完善错误流控制，
 * 管道层负责 saveManifest 持久化安装记录
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
import { InstallType } from './core/types.js'
import type { Reporter } from './core/reporter.js'
import type { PathResolver } from './core/path-resolver.js'
import { AiforgeError, EXIT_INSTALL_FAILURE } from './core/errors.js'
import { resolveSource } from './stages/resolve-source.js'
import { authenticate as authenticateStage } from './stages/authenticate.js'
import { cloneRepo } from './stages/clone.js'
import { detectTools } from './stages/detect-tools.js'
import { matchRules } from './stages/match-rules.js'
import { executeInstall } from './stages/execute-install.js'
import { loadManifest, saveManifest, mergeManifest } from './services/manifest.js'
import { fileHash } from './services/fs-utils.js'

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
export type SaveManifestFn = (result: InstallResult) => Promise<void>
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
  saveManifest: SaveManifestFn
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
  saveManifest: async () => notImplemented('saveManifest'),
  report,
}

/**
 * createProductionStages — 生产环境阶段集合工厂
 *
 * 来源: Story 3.3 Task 2 + Story 4.6a
 *
 * 将所有阶段替换为真实实现，通过闭包注入 pathResolver。
 * ParsedArgs 由编排器持有，按需注入各阶段。
 *
 * saveManifest 是 pipeline 层收尾职责（AC #3）：
 * - 加载已有 manifest
 * - 从 InstallResult 构建新条目（只保存 status: 'new' 和 'updated'）
 * - 合并后持久化
 *
 * @param pathResolver - 路径解析器（生产环境用 UnixPathResolver）
 */
export function createProductionStages(pathResolver: PathResolver): PipelineStages {
  // 用于在 match 阶段闭包中保存 clone 阶段输出的 repo 信息
  // 注意：repo 由 clone 阶段填充，match/saveManifest 阶段读取（通过共享变量传递）
  let lastRepo: LocalRepo = { repoDir: '', isNew: false, sourceFiles: [] }
  // plan 由 match 阶段填充，saveManifest 阶段读取（获取 tool/scope/mode 信息）
  let lastPlan: MatchedPlan = { items: [] }

  return {
    resolve: (args, reporter) => resolveSource(args, reporter, pathResolver),

    authenticate: (source, args, reporter) =>
      authenticateStage(source, args, reporter, pathResolver),

    clone: async (authed, args, reporter) => {
      const repo = await cloneRepo(authed, args, reporter, pathResolver)
      lastRepo = repo
      return repo
    },

    detect: (repo, args, reporter) => detectTools(repo, args, reporter, pathResolver),

    match: async (env, args, reporter) => {
      const plan = await matchRules(lastRepo, env, args, reporter, pathResolver)
      lastPlan = plan
      return plan
    },

    install: async (plan, args, reporter) => {
      // 加载 manifest 上下文供冲突检测使用
      const { entries, degraded } = await loadManifest(pathResolver)
      return executeInstall(plan, args, reporter, pathResolver, { entries, degraded })
    },

    saveManifest: async (result) => {
      // AC #3: 只保存 status: 'new' 和 'updated' 的文件记录
      const installableItems = result.items.filter(
        (item) => item.status === 'new' || item.status === 'updated',
      )

      if (installableItems.length === 0) return

      // 构建 targetPath → plan item 的映射，用于获取 tool/scope/mode 信息
      // 注意：同一个 targetPath（目录）可能对应多条规则（如 cursor 的 skills[Flatten] 和 agents[Files]
      // 共享 .cursor/rules/），因此使用数组存储
      const planItemsByTarget = new Map<
        string,
        Array<{
          tool: string
          scope: 'global' | 'project'
          mode: 'copy' | 'symlink'
          ruleType: InstallType
          sourceFiles: string[]
        }>
      >()
      for (const planItem of lastPlan.items) {
        const info = {
          tool: planItem.rule.tool,
          scope: planItem.rule.scope,
          mode: planItem.mode,
          ruleType: planItem.rule.type,
          sourceFiles: planItem.sourceFiles,
        }
        const existing = planItemsByTarget.get(planItem.targetPath)
        if (existing) {
          existing.push(info)
        } else {
          planItemsByTarget.set(planItem.targetPath, [info])
        }
      }

      // 计算每个目标文件的 hash（安装后的最终状态）
      const hashes = new Map<string, string>()
      for (const item of installableItems) {
        const hash = await fileHash(item.targetPath)
        hashes.set(item.targetPath, hash)
      }

      // 构建新 manifest 条目
      const now = new Date().toISOString()
      const newEntries = installableItems.map((item) => {
        const hash = hashes.get(item.targetPath)
        if (hash === undefined) {
          throw new Error(`manifest hash missing for target: ${item.targetPath}`)
        }

        // 从 plan 中查找对应 item 的 tool/scope/mode 信息
        // targetPath 在 InstallResult 中是文件级路径（可能在 plan item 的 targetPath 目录下）
        // 通过源文件路径精确匹配找到所属的 plan item，避免同目录规则误匹配
        type PlanInfo = {
          tool: string
          scope: 'global' | 'project'
          mode: 'copy' | 'symlink'
          ruleType: InstallType
        }
        let planInfo: PlanInfo | undefined

        // 尝试直接匹配（InstallResult.targetPath === plan.targetPath 的情况，如目录级安装）
        const directMatch = planItemsByTarget.get(item.targetPath)
        if (directMatch && directMatch.length === 1) {
          planInfo = directMatch[0]
        } else if (directMatch && directMatch.length > 1) {
          // 同目录多规则：通过源文件路径判断 item 属于哪条规则
          planInfo = directMatch.find((info) =>
            info.sourceFiles.some(
              (sf) => item.sourcePath === sf || item.sourcePath.startsWith(sf + '/'),
            ),
          )
        }

        if (!planInfo) {
          // 文件级路径：检查是否在某个 plan item 的 targetPath 目录下
          // 规范化 planTarget：strip trailing slash（path.join 在某些环境可能保留尾部斜杠）
          for (const [planTarget, infos] of planItemsByTarget) {
            const normalizedPlanTarget = planTarget.replace(/\/$/, '')
            if (item.targetPath.startsWith(normalizedPlanTarget + '/')) {
              if (infos.length === 1) {
                planInfo = infos[0]
                break
              }
              // 同目录多规则：通过源文件路径判断
              const matched = infos.find((info) =>
                info.sourceFiles.some(
                  (sf) => item.sourcePath === sf || item.sourcePath.startsWith(sf + '/'),
                ),
              )
              if (matched) {
                planInfo = matched
                break
              }
            }
          }
        }

        // 发现 2 修复：禁止空值兜底，显式校验 + 抛错（project-context.md:118）
        if (!planInfo) {
          const availableTargets = [...planItemsByTarget.keys()].join(', ')
          throw new Error(
            `manifest plan info missing for target: ${item.targetPath} ` +
              `(sourcePath: ${item.sourcePath}, available plan targets: [${availableTargets}])`,
          )
        }

        return {
          source: item.sourcePath.startsWith(lastRepo.repoDir)
            ? item.sourcePath.slice(lastRepo.repoDir.length + 1)
            : item.sourcePath,
          target: item.targetPath,
          tool: planInfo.tool,
          scope: planInfo.scope,
          // Flatten 规则在 manifest 中记录为 'flatten'，无论实际安装方式（copy/symlink）
          // 这样 manifest 语义不变，同时修复了 Flatten + --link 时 mode 被错误覆写为 'flatten' 的问题
          mode: (planInfo.ruleType === InstallType.Flatten ? 'flatten' : planInfo.mode) as
            | 'copy'
            | 'symlink'
            | 'flatten',
          hash,
          installedAt: now,
        }
      })

      // 加载已有 manifest，合并后保存
      const { entries: existing } = await loadManifest(pathResolver)
      const merged = mergeManifest(existing, newEntries)
      await saveManifest(merged, pathResolver)
    },

    report,
  }
}

/**
 * 管道编排器 — 按顺序执行所有阶段
 *
 * 阶段链: Resolve → Auth → Clone → Detect → Match → [Install → SaveManifest] → Report
 *
 * 错误流控制（AC #2）：
 * - AiforgeError(severity: 'fatal') → 立即停止，reporter.reportError()，设置 process.exitCode
 * - 非 AiforgeError → 包装为 AiforgeError(code: 'ERR_UNKNOWN', severity: 'fatal')
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
      // AC #3: pipeline 层负责 manifest 持久化（不在 Install 阶段内部）
      await stages.saveManifest(result)
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
    // 非 AiforgeError 包装为 fatal（AC #2.2）
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
