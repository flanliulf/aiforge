import { confirm } from '@inquirer/prompts'
import { ExitPromptError } from '@inquirer/core'
import type { MatchedPlan } from '../core/types.js'
import type { Reporter } from '../core/reporter.js'
import { msg } from '../core/messages.js'
import { FilterCancelledSignal } from './filter-utils.js'

type PlanItem = MatchedPlan['items'][number]

/**
 * 处理带语义差异提示的安装项。
 *
 * - 仅对存在实际 sourceFiles 的 item 生效，避免空源目录产生无意义提示
 * - TTY 环境：交互确认，拒绝则跳过该 item
 * - 非 TTY 环境：保守跳过，并输出原因
 */
export async function applySemanticWarnings(
  items: MatchedPlan['items'],
  reporter: Reporter,
): Promise<MatchedPlan['items']> {
  const filteredItems: PlanItem[] = []

  for (const item of items) {
    const warningKey = item.rule.semanticWarning
    if (!warningKey || item.sourceFiles.length === 0) {
      filteredItems.push(item)
      continue
    }

    if (!process.stdout.isTTY) {
      reporter.warn(msg(`semanticWarning.${warningKey}.skipped`))
      continue
    }

    try {
      const shouldContinue = await confirm({
        message: msg(`semanticWarning.${warningKey}.prompt`),
        default: false,
      })

      if (shouldContinue) {
        filteredItems.push(item)
      }
    } catch (err) {
      if (err instanceof ExitPromptError) {
        throw new FilterCancelledSignal()
      }
      throw err
    }
  }

  return filteredItems
}
