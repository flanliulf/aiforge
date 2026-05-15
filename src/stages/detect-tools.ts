/**
 * detect-tools — Detect 管道阶段
 *
 * 来源: Story 3.1 — AI 工具自动检测
 * 架构: architecture/03-core-decisions.md#D5
 *
 * 逻辑：
 *   1. 手动指定模式（args.tools 非空）：按 ID 查注册表，无效 ID → UNKNOWN_TOOL 错误
 *   2. 自动检测模式：同时扫描全局（home()）和项目（cwd()）两侧标志路径，任一侧命中即视为已安装
 *   3. 无工具检测到 → 诊断输出 + NO_TOOLS 错误（fatal）
 *   4. scope 由 args.global 决定（不影响检测范围，只影响后续安装范围）
 */

import { join } from 'node:path'
import { access } from 'node:fs/promises'
import type { LocalRepo, ParsedArgs, DetectedEnv } from '../core/types.js'
import type { Reporter } from '../core/reporter.js'
import type { PathResolver } from '../core/path-resolver.js'
import { AiforgeError } from '../core/errors.js'
import { EXIT_ARG_ERROR, EXIT_INSTALL_FAILURE } from '../core/errors.js'
import { TOOL_DEFINITIONS } from '../data/tool-registry.js'
import { msg } from '../core/messages.js'

// ── fs 存在性检查（ENOENT/ENOTDIR 白名单降级）──────────────────

/**
 * 检查路径是否存在
 *
 * 规则：仅对 ENOENT（不存在）和 ENOTDIR（路径组件非目录）降级为 false，
 * 其他错误（EACCES 权限拒绝、EIO I/O 错误等）向上抛出。
 * 来源: project-context.md — fs 存在性检查必须使用 ENOENT/ENOTDIR 白名单降级
 */
async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return false
    }
    // 权限错误、I/O 错误等向上抛出
    throw error
  }
}

// ── 单工具检测 ──────────────────────────────────────────────────

/**
 * 检测单个工具是否存在
 * 同时扫描全局（home() 基准）和项目（cwd() 基准）两侧标志路径
 * 任一侧命中即返回 true
 *
 * 注意：TOOL_DEFINITIONS 中 global 路径带 `~` 前缀（如 `~/.copilot`），
 * 检测时去掉 `~` 使用 pathResolver.home() 拼接真实路径
 */
async function detectSingleTool(
  tool: { detect: { global: string[]; project: string[] } },
  pathResolver: PathResolver,
): Promise<boolean> {
  const globalBase = pathResolver.home()
  const projectBase = process.cwd()

  // 扫描全局侧
  for (const flagPath of tool.detect.global) {
    // 去掉 `~` 前缀（如 `~/.copilot` → `.copilot`），拼接 home 目录
    const normalizedFlag = flagPath.replace(/^~[/\\]?/, '')
    const fullPath = join(globalBase, normalizedFlag)
    if (await pathExists(fullPath)) {
      return true
    }
  }

  // 扫描项目侧
  for (const flagPath of tool.detect.project) {
    const fullPath = join(projectBase, flagPath)
    if (await pathExists(fullPath)) {
      return true
    }
  }

  return false
}

// ── vscode-only migration 检测 ──────────────────────────────────

/**
 * 检测是否为 vscode-only 用户（v1.x → v2.0 迁移场景）
 *
 * 条件：~/.vscode/（home 级）存在且 ~/.copilot/ 不存在
 * 目的：无论是否检测到其他工具，只要满足条件即输出 vscodeMergedNote 提示（AC #3），
 *       让用户知道为什么 vscode 不再被检测（NFR-C7：不读写 ~/.vscode/ 任何文件）
 * 注意：仅检测 home 级 ~/.vscode/，项目级 .vscode/ 不触发（AC #3 明文限定 home 路径）
 */
async function detectLegacyVscodeOnly(pathResolver: PathResolver): Promise<boolean> {
  const home = pathResolver.home()
  const [vscodeHomeExists, copilotExists] = await Promise.all([
    pathExists(join(home, '.vscode')),
    pathExists(join(home, '.copilot')),
  ])
  return vscodeHomeExists && !copilotExists
}

// ── 诊断输出 ────────────────────────────────────────────────────

/**
 * 输出诊断信息：扫描路径 + 每个工具检测标志 + 建议
 * 来源: Story 3.1 Task 2 — 诊断输出格式（FR-015）
 */
function emitDiagnostics(reporter: Reporter, pathResolver: PathResolver): void {
  const globalBase = pathResolver.home()
  const projectBase = process.cwd()

  const lines: string[] = [msg('detectTools.noToolsFound'), '', msg('detectTools.scanPathsHeader')]

  // 列出每个工具的全局侧标志路径
  const globalFlags = TOOL_DEFINITIONS.flatMap((t) =>
    t.detect.global.map((f) => {
      const normalized = f.replace(/^~[/\\]?/, '')
      return msg('detectTools.globalFlag').replace('{path}', join(globalBase, normalized))
    }),
  )
  // 列出每个工具的项目侧标志路径
  const projectFlags = TOOL_DEFINITIONS.flatMap((t) =>
    t.detect.project.map((f) =>
      msg('detectTools.projectFlag').replace('{path}', join(projectBase, f)),
    ),
  )

  lines.push(...globalFlags, ...projectFlags)
  lines.push('', msg('detectTools.suggestionsHeader'))
  lines.push(msg('detectTools.suggestion1'))
  lines.push(
    msg('detectTools.suggestion2').replace('{tools}', TOOL_DEFINITIONS.map((t) => t.id).join(' ')),
  )

  reporter.warn(lines.join('\n'))
}

// ── 主入口 ──────────────────────────────────────────────────────

/**
 * detectTools — Detect 管道阶段主函数
 *
 * @param repo - 上一阶段传入的本地仓库信息（透传到 DetectedEnv，供下游使用）
 * @param args - 解析后的 CLI 参数（读取 tools / global）
 * @param reporter - 输出报告器
 * @param pathResolver - 路径解析器（可注入 mock，便于测试）
 */
export async function detectTools(
  _repo: LocalRepo,
  args: ParsedArgs,
  reporter: Reporter,
  pathResolver: PathResolver,
): Promise<DetectedEnv> {
  reporter.startPhase(msg('phases.detect'))

  const scope: 'global' | 'project' = args.global ? 'global' : 'project'

  // ── 手动指定模式 ────────────────────────────────────────────
  if (args.tools && args.tools.length > 0) {
    const tools = args.tools.map((id) => {
      const def = TOOL_DEFINITIONS.find((t) => t.id === id)
      if (!def) {
        throw new AiforgeError(
          msg('detectTools.unknownTool').replace('{id}', id),
          'UNKNOWN_TOOL',
          EXIT_ARG_ERROR,
          'fatal',
          msg('detectTools.unknownToolWhy').replace('{id}', id),
          [
            msg('detectTools.fixSupportedTools').replace(
              '{tools}',
              TOOL_DEFINITIONS.map((t) => t.id).join(', '),
            ),
            `npx aiforge --tools ${TOOL_DEFINITIONS.map((t) => t.id).join(' ')}`,
          ],
        )
      }
      return def.id
    })

    reporter.completePhase()
    return { tools, scope }
  }

  // ── 自动检测模式 ────────────────────────────────────────────
  const detectedTools: string[] = []

  for (const toolDef of TOOL_DEFINITIONS) {
    if (await detectSingleTool(toolDef, pathResolver)) {
      detectedTools.push(toolDef.id)
    }
  }

  // vscode-only 用户迁移提示（AC #3）：无论是否检测到其他工具，
  // 只要 ~/.vscode/（home 级）存在且 ~/.copilot/ 不存在则输出提示
  if (!detectedTools.includes('copilot') && (await detectLegacyVscodeOnly(pathResolver))) {
    reporter.warn(msg('detectTools.vscodeMergedNote'))
  }

  // ── 无工具处理 ──────────────────────────────────────────────
  if (detectedTools.length === 0) {
    emitDiagnostics(reporter, pathResolver)
    throw new AiforgeError(
      msg('detectTools.noToolsError'),
      'NO_TOOLS',
      EXIT_INSTALL_FAILURE,
      'fatal',
      msg('detectTools.noToolsErrorWhy'),
      [
        msg('detectTools.fixInstallTools'),
        `npx aiforge --tools ${TOOL_DEFINITIONS.map((t) => t.id).join(' ')}`,
      ],
    )
  }

  reporter.completePhase()
  return { tools: detectedTools, scope }
}
