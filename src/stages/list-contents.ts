/**
 * list-contents 阶段 — `--list` 命令专用
 *
 * 来源: Story 6.1 Task 3
 * 架构: 管道分叉阶段（Clone 之后，Detect 之前）
 *
 * 功能:
 * - 读取仓库指定顶层目录下的所有可安装子目录
 * - 通过 Reporter 输出（不直接 process.stdout.write）
 * - 目录不存在时抛出三段式 AiforgeError(LIST_DIR_NOT_FOUND)
 * - 空目录时输出提示（成功路径，不报错）
 *
 * 模块边界:
 * - 依赖 core/types.ts、core/errors.ts、core/reporter.ts、core/messages.ts、data/excludes.ts
 * - 不依赖 services/（只需 readdir，无需安全校验）
 */

import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { LocalRepo, ParsedArgs } from '../core/types.js'
import type { Reporter } from '../core/reporter.js'
import { AiforgeError, EXIT_ARG_ERROR } from '../core/errors.js'
import { msg } from '../core/messages.js'
import { DEFAULT_EXCLUDES } from '../data/excludes.js'

/**
 * 扫描仓库根目录下的所有可用顶层目录
 *
 * 导出供 Story 6-2 复用（零匹配处理），避免两处独立实现过滤规则不一致。
 *
 * 降级策略：ENOENT/ENOTDIR → 空数组；EACCES 等透传（禁止静默吞掉权限错误）
 */
export async function scanAvailableTopDirs(repoDir: string): Promise<string[]> {
  try {
    const entries = await readdir(repoDir, { withFileTypes: true })
    return entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name)
      .sort()
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR') return []
    throw error
  }
}

/**
 * listContents — `--list` 命令主逻辑
 *
 * Reporter 生命周期契约：
 *   reporter.startPhase() → 读取目录 → reporter.completePhase() → reporter.reportList()
 *
 * AC 对应：
 * - AC #1: 正常输出带序号子目录列表
 * - AC #2: 目录不存在时输出三段式错误（LIST_DIR_NOT_FOUND）
 * - AC #3: 目录存在但为空时输出提示，正常退出
 */
export async function listContents(
  repo: LocalRepo,
  args: ParsedArgs,
  reporter: Reporter,
): Promise<void> {
  // 输入校验：空字符串/空白字符串、含路径分隔符（/、\）或以点号（.）开头均视为非法输入
  const listVal = args.list!
  if (!listVal.trim() || /[/\\]/.test(listVal) || listVal.startsWith('.')) {
    throw new AiforgeError(
      msg('list.invalidInput').replace('{dir}', args.list!),
      'LIST_INVALID_INPUT',
      EXIT_ARG_ERROR,
      'fatal',
      msg('list.invalidInputWhy'),
      [msg('list.fixUseSimpleName')],
    )
  }

  reporter.startPhase(msg('phases.list'))

  const targetDir = join(repo.repoDir, args.list!)
  let subdirs: string[]

  try {
    const entries = await readdir(targetDir, { withFileTypes: true })
    subdirs = entries
      .filter((e) => e.isDirectory() && !DEFAULT_EXCLUDES.includes(e.name))
      .map((e) => e.name)
      .sort()
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      // 扫描仓库根目录获取可用顶层目录，填入三段式错误的 fix[] 建议
      const available = await scanAvailableTopDirs(repo.repoDir)
      throw new AiforgeError(
        msg('list.dirNotFound').replace('{dir}', args.list!),
        'LIST_DIR_NOT_FOUND',
        EXIT_ARG_ERROR,
        'fatal',
        msg('list.dirNotFoundWhy').replace('{dir}', args.list!),
        [msg('list.fixTryOther').replace('{dirs}', available.join(', '))],
      )
    }
    // EACCES 等其他 fs 错误向上透传（不降级为"目录不存在"）
    throw error
  }

  // 空目录是成功态（不是警告/错误），走 stdout 通道，避免 CI 误判 stderr
  reporter.completePhase()
  reporter.reportList(args.list!, subdirs)
}
