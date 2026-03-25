/**
 * match-rules — Match 管道阶段
 *
 * 来源: Story 3.2 — 规则匹配引擎
 * 架构: architecture/03-core-decisions.md#D2, D6
 *
 * 逻辑：
 *   1. 对每个检测到的工具，通过 RULE_INDEX O(1) 查找对应 scope 的规则
 *   2. 若 --dirs 非空，过滤 rule.sourceDir 不在 dirs 中的规则
 *   3. 对每条规则扫描 repoDir 下的源文件（files/directories/flatten 三种类型）
 *   4. 应用 DEFAULT_EXCLUDES 过滤
 *   5. 使用 PathResolver 解析目标路径
 *   6. 构建 MatchedPlan 返回
 */

import { join } from 'node:path'
import { readdir } from 'node:fs/promises'
import type { LocalRepo, ParsedArgs, DetectedEnv, MatchedPlan, InstallRule } from '../core/types.js'
import { InstallType } from '../core/types.js'
import type { Reporter } from '../core/reporter.js'
import type { PathResolver } from '../core/path-resolver.js'
import { RULE_INDEX } from '../data/install-rules.js'
import { DEFAULT_EXCLUDES } from '../data/excludes.js'
import { MESSAGES } from '../data/messages.js'

// ── 目标路径解析 ─────────────────────────────────────────────────

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

// ── 源文件扫描 ───────────────────────────────────────────────────

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

// ── 主入口 ───────────────────────────────────────────────────────

/**
 * matchRules — Match 管道阶段主函数
 *
 * @param repo - 上一阶段传入的本地仓库信息（含 repoDir）
 * @param env - 检测到的工具和安装 scope
 * @param args - 解析后的 CLI 参数（读取 dirs）
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
  reporter.startPhase(MESSAGES.phases.match)

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
      const sourceFiles = await scanSourceFiles(repo.repoDir, rule)

      // 解析目标路径
      const targetPath = resolveTargetDir(rule, env.scope, pathResolver)

      items.push({ rule, sourceFiles, targetPath })
    }
  }

  reporter.completePhase()
  return { items }
}
