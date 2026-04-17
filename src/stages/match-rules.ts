/**
 * match-rules — Match 管道阶段
 *
 * 来源: Story 3.2 — 规则匹配引擎 / Story 3.3 — dry-run 预览与安装计划
 * 架构: architecture/03-core-decisions.md#D2, D6
 *
 * 逻辑：
 *   1. 对每个检测到的工具，通过 RULE_INDEX O(1) 查找对应 scope 的规则
 *   2. 若 --dirs 非空，过滤 rule.sourceDir 不在 dirs 中的规则
 *   3. 对每条规则扫描 repoDir 下的源文件（files/directories/flatten 三种类型）
 *   4. 应用 DEFAULT_EXCLUDES 过滤
 *   5. 使用 PathResolver 解析目标路径
 *   6. 推导安装模式（copy/symlink）— Story 3.3 新增
 *   7. 构建 MatchedPlan 返回
 */

import { basename, join } from 'node:path'
import { readdir } from 'node:fs/promises'
import type { LocalRepo, ParsedArgs, DetectedEnv, MatchedPlan, InstallRule } from '../core/types.js'
import { InstallType } from '../core/types.js'
import type { Reporter } from '../core/reporter.js'
import type { PathResolver } from '../core/path-resolver.js'
import { AiforgeError } from '../core/errors.js'
import { EXIT_ARG_ERROR } from '../core/errors.js'
import { RULE_INDEX } from '../data/install-rules.js'
import { DEFAULT_EXCLUDES } from '../data/excludes.js'
import { msg } from '../core/messages.js'
import { parseFilterPattern, matchesGlob, FilterCancelledSignal } from './filter-utils.js'

// ── 安装模式推导 ─────────────────────────────────────────────────────────────

/**
 * 推导安装模式（copy 或 symlink）
 *
 * 规则（来源: Story 3.3 Dev Notes + FR-021 + project-context.md + Story 4.6a CR Round 2 修复）：
 * - scope === 'project' && args.link → 抛出 LINK_PROJECT_REJECTED（fatal）
 * - scope === 'global' && args.link → symlink（Flatten + --link 也返回 symlink）
 * - 否则 → copy
 *
 * 注意：mode 只表示安装方式（copy/symlink），不表示规则类型。
 * manifest 写入时由 pipeline.ts 通过 rule.type 判断是否输出 'flatten'。
 */
function getInstallMode(args: ParsedArgs, scope: 'global' | 'project'): 'copy' | 'symlink' {
  if (args.link && scope === 'project') {
    throw new AiforgeError(
      msg('matchRules.linkProjectRejected'),
      'LINK_PROJECT_REJECTED',
      EXIT_ARG_ERROR,
      'fatal',
      msg('matchRules.linkProjectRejectedWhy'),
      ['npx aiforge -g -l <repo>'],
    )
  }
  if (args.link && scope === 'global') return 'symlink'
  return 'copy'
}

// ── 目标路径解析 ─────────────────────────────────────────────────────────────

/**
 * 解析 rule.targetDir 中的路径模板
 *
 * - scope=global：rule.targetDir 格式如 '~/.copilot/agents/'，去掉 '~/' 前缀，拼接 pathResolver.home()
 * - scope=project：直接拼接 process.cwd()
 *
 * 注意：project 级路径使用 process.cwd() 是 MVP 简化处理。
 * 若 PathResolver 后续扩展 projectRoot() 方法，应替换为 pathResolver.projectRoot()。
 */
function resolveTargetDir(
  rule: InstallRule,
  scope: 'global' | 'project',
  pathResolver: PathResolver,
): string {
  if (scope === 'global') {
    // 去掉 '~/' 前缀，拼接 home 目录
    const relativePart = rule.targetDir.replace(/^~\//, '')
    return join(pathResolver.home(), relativePart)
  }
  // 项目级路径：相对于当前工作目录
  return join(process.cwd(), rule.targetDir)
}

// ── 源文件扫描 ───────────────────────────────────────────────────────────────

/**
 * 扫描规则对应的源文件列表
 *
 * - Files 类型：列出 sourceDir 下所有文件（不递归子目录）
 * - Directories/Flatten 类型：列出 sourceDir 下所有子目录
 * - 所有类型都应用 DEFAULT_EXCLUDES 过滤
 * - sourceDir 不存在（ENOENT）时静默返回空数组
 *
 * 返回绝对路径字符串（repoDir/sourceDir/name）
 */
async function scanSourceFiles(repoDir: string, rule: InstallRule): Promise<string[]> {
  const sourceDir = join(repoDir, rule.sourceDir)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let entries: any[]
  try {
    entries = await readdir(sourceDir, { withFileTypes: true })
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    // sourceDir 不存在或不是目录时静默跳过（允许知识仓库只包含部分资源类型）
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return []
    }
    // 权限错误、I/O 错误等向上抛出
    throw error
  }

  switch (rule.type) {
    case InstallType.Files:
      // 只扫描文件，过滤排除列表
      return entries
        .filter(
          (e: { isFile(): boolean; name: string }) =>
            e.isFile() && !DEFAULT_EXCLUDES.includes(e.name),
        )
        .map((e: { name: string }) => join(sourceDir, e.name))

    case InstallType.Directories:
    case InstallType.Flatten:
      // 扫描子目录，过滤排除列表
      return entries
        .filter(
          (e: { isDirectory(): boolean; name: string }) =>
            e.isDirectory() && !DEFAULT_EXCLUDES.includes(e.name),
        )
        .map((e: { name: string }) => join(sourceDir, e.name))
  }
}

// ── 主入口 ───────────────────────────────────────────────────────────────────

/**
 * matchRules — Match 管道阶段主函数
 *
 * @param repo - 上一阶段传入的本地仓库信息（含 repoDir）
 * @param env - 检测到的工具和安装 scope
 * @param args - 解析后的 CLI 参数（读取 dirs、link）
 * @param reporter - 输出报告器
 * @param pathResolver - 路径解析器（可注入 mock，便于测试）
 */
export async function matchRules(
  repo: LocalRepo,
  env: DetectedEnv,
  args: ParsedArgs,
  reporter: Reporter,
  pathResolver: PathResolver,
): Promise<MatchedPlan> {
  reporter.startPhase(msg('phases.match'))

  // LINK_PROJECT_REJECTED 校验提前执行（尽早发现参数错误）
  // 仅在 args.link 为 true 时才需要校验，getInstallMode 内部会抛出
  if (args.link && env.scope === 'project') {
    getInstallMode(args, env.scope) // 触发校验
  }

  const items: MatchedPlan['items'] = []

  for (const toolId of env.tools) {
    // O(1) 查找：key 为 `${tool}:${scope}`
    const rules = RULE_INDEX.get(`${toolId}:${env.scope}`) ?? []

    // --dirs 过滤：若 args.dirs 非空，只保留 sourceDir 在 dirs 中的规则
    const filteredRules =
      args.dirs && args.dirs.length > 0
        ? rules.filter((r) => args.dirs!.includes(r.sourceDir))
        : rules

    for (const rule of filteredRules) {
      // 扫描源文件（含排除过滤）
      let sourceFiles = await scanSourceFiles(repo.repoDir, rule)

      // --filter 文件级过滤（Story 6-2）
      // 过滤位置：scanSourceFiles 返回后、items.push 之前
      if (args.filter) {
        const { dirPrefix, glob } = parseFilterPattern(args.filter)
        // 如果 filter 指定了顶层目录前缀，且当前规则的 sourceDir 不匹配，跳过全部 sourceFiles
        if (dirPrefix && dirPrefix !== rule.sourceDir) {
          sourceFiles = []
        } else {
          sourceFiles = sourceFiles.filter((sf) => matchesGlob(basename(sf), glob))
        }
      }

      // empty-item guard：仅 --filter 路径下，sourceFiles 为空则跳过，不 push 空 item
      // 非 --filter 场景：空 item 照常 push，保留 reportPlan() 的 emptySourceDir 输出语义（fix CR#3）
      if (args.filter && sourceFiles.length === 0) continue

      // 解析目标路径
      const targetPath = resolveTargetDir(rule, env.scope, pathResolver)

      // 按 scope+link 推导安装模式（mode 只表示安装方式：copy/symlink）
      // Flatten 规则的 mode 在 manifest 写入时由 pipeline.ts 通过 rule.type 判断输出 'flatten'
      const mode = getInstallMode(args, env.scope)

      items.push({ rule, sourceFiles, targetPath, mode })
    }
  }

  // 零匹配检测（Task 4）：全部 items 处理完毕后，若 args.filter 非空且 items 为空，触发交互式询问
  if (args.filter && items.length === 0) {
    const { dirPrefix } = parseFilterPattern(args.filter)

    // 按 rule.type 收集真实可命中的候选安装项（fix CR#1 + CR#2）：
    //   - Directories/Flatten 类型：枚举目录名
    //   - Files 类型：枚举文件 basename
    // prefixed case：只收集 rule.sourceDir === dirPrefix 的规则
    // unprefixed case：收集所有相关规则（尊重 --dirs）
    const candidateChoices: Array<{ name: string; value: string }> = []
    const seen = new Set<string>()
    for (const toolId of env.tools) {
      const rules = RULE_INDEX.get(`${toolId}:${env.scope}`) ?? []
      const relevantRules =
        args.dirs && args.dirs.length > 0
          ? rules.filter((r) => args.dirs!.includes(r.sourceDir))
          : rules
      for (const rule of relevantRules) {
        if (dirPrefix && dirPrefix !== rule.sourceDir) continue
        const ruleDir = join(repo.repoDir, rule.sourceDir)
        try {
          const entries = await readdir(ruleDir, { withFileTypes: true })
          for (const entry of entries) {
            if (DEFAULT_EXCLUDES.includes(entry.name) || entry.name.startsWith('.')) continue
            const relevant = rule.type === InstallType.Files ? entry.isFile() : entry.isDirectory()
            if (!relevant) continue
            const value = dirPrefix
              ? `${dirPrefix}/${entry.name}`
              : `${rule.sourceDir}/${entry.name}`
            if (!seen.has(value)) {
              seen.add(value)
              candidateChoices.push({ name: entry.name, value })
            }
          }
        } catch {
          // ENOENT/ENOTDIR: skip this sourceDir
        }
      }
    }
    candidateChoices.sort((a, b) => a.name.localeCompare(b.name))

    if (process.stdin.isTTY) {
      // 交互式选择
      const { select } = await import('@inquirer/prompts')
      const choices = [...candidateChoices, { name: msg('filter.cancelled'), value: '__cancel__' }]
      const choice = await select({
        message: msg('filter.selectPrompt'),
        choices,
      })
      if (choice === '__cancel__') {
        reporter.completePhase()
        throw new FilterCancelledSignal()
      }
      // 使用局部变量 resolvedFilter（限定名），不改写 args.filter（ParsedArgs 只读原则）
      const resolvedFilter = choice
      const { dirPrefix: rPrefix, glob: rGlob } = parseFilterPattern(resolvedFilter)
      // 重新扫描：基于 resolvedFilter 重新执行过滤，填充 items
      for (const toolId of env.tools) {
        const rules = RULE_INDEX.get(`${toolId}:${env.scope}`) ?? []
        const filteredRules =
          args.dirs && args.dirs.length > 0
            ? rules.filter((r) => args.dirs!.includes(r.sourceDir))
            : rules
        for (const rule of filteredRules) {
          let sourceFiles = await scanSourceFiles(repo.repoDir, rule)
          if (rPrefix && rPrefix !== rule.sourceDir) {
            sourceFiles = []
          } else {
            sourceFiles = sourceFiles.filter((sf) => matchesGlob(basename(sf), rGlob))
          }
          if (sourceFiles.length === 0) continue
          const targetPath = resolveTargetDir(rule, env.scope, pathResolver)
          const mode = getInstallMode(args, env.scope)
          items.push({ rule, sourceFiles, targetPath, mode })
        }
      }
      // 二次零匹配检查（fix CR#1）：重试后若 items 仍为空，抛出 FILTER_NO_MATCH
      if (items.length === 0) {
        throw new AiforgeError(
          msg('filter.noMatch').replace('{pattern}', resolvedFilter),
          'FILTER_NO_MATCH',
          EXIT_ARG_ERROR,
          'fatal',
          msg('filter.noMatchWhy'),
          [
            msg('filter.fixAvailable').replace(
              '{dirs}',
              candidateChoices.map((c) => c.value).join(', '),
            ),
          ],
        )
      }
    } else {
      // 非 TTY：抛出三段式错误（fix CR#2：使用 candidateChoices 提供真实候选名）
      throw new AiforgeError(
        msg('filter.noMatch').replace('{pattern}', args.filter),
        'FILTER_NO_MATCH',
        EXIT_ARG_ERROR,
        'fatal',
        msg('filter.noMatchWhy'),
        [
          msg('filter.fixAvailable').replace(
            '{dirs}',
            candidateChoices.map((c) => c.value).join(', '),
          ),
        ],
      )
    }
  }

  reporter.completePhase()
  return { items }
}
