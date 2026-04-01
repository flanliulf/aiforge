import ora, { type Ora } from 'ora'
import chalk from 'chalk'
import { basename, join } from 'node:path'
import type { InstallResult, MatchedPlan } from './types.js'
import { InstallType } from './types.js'
import type { AiforgeError } from './errors.js'

export interface Reporter {
  startPhase(name: string): void
  updatePhase(message: string): void
  completePhase(): void
  reportResult(results: InstallResult): void
  reportPlan(plan: MatchedPlan): void
  reportError(error: AiforgeError): void
  warn(message: string): void
}

// ── 格式化辅助函数（共用）────────────────────────────────────────────────────

/**
 * 计算每个 sourceFile 对应的精确目标路径（文件级）
 * - Files：targetDir/basename(srcFile)
 * - Directories：targetDir/basename(srcDir)
 * - Flatten：targetDir/basename(srcDir)
 */
function resolveFileTarget(targetPath: string, srcFile: string): string {
  return join(targetPath, basename(srcFile))
}

/**
 * 计算 MatchedPlan 的统计数据
 * - totalFiles: 所有 sourceFiles 的总数（注意：空 sourceFiles 的 item 计为 0）
 * - toolCount: 不重复工具数
 */
function calcPlanStats(plan: MatchedPlan): { totalFiles: number; toolCount: number } {
  const totalFiles = plan.items.reduce((sum, item) => sum + item.sourceFiles.length, 0)
  const tools = new Set(plan.items.map((item) => item.rule.tool))
  return { totalFiles, toolCount: tools.size }
}

/**
 * 获取安装类型标签（小写）
 */
function typeLabel(type: InstallType): string {
  switch (type) {
    case InstallType.Files:
      return 'files'
    case InstallType.Directories:
      return 'directories'
    case InstallType.Flatten:
      return 'flatten'
  }
}

/**
 * dry-run 计划统计行
 * 格式: 计划安装: N 项 (M 个工具)
 * 内联于 core/ 以维持零外部依赖（core/ 不得引用 data/）
 */
function planStatsLine(totalFiles: number, toolCount: number): string {
  return `计划安装: ${totalFiles} 项 (${toolCount} 个工具)`
}

/**
 * 安装结果统计行
 * 格式: 安装: N 项  更新: N 项  跳过: N 项
 * 内联于 core/ 以维持零外部依赖（core/ 不得引用 data/）
 */
function resultStatsLine(installed: number, updated: number, skipped: number): string {
  return `安装: ${installed} 项  更新: ${updated} 项  跳过: ${skipped} 项`
}

/** 安装结果状态图标映射（内联常量，与 data/messages.ts ICONS 保持一致） */
const STATUS_ICONS: Record<string, string> = {
  new: '✅',
  updated: '🔄',
  skipped: '⏭️',
}

// ── TtyReporter ───────────────────────────────────────────────────────────────

class TtyReporter implements Reporter {
  private spinner: Ora | null = null

  startPhase(name: string): void {
    this.spinner = ora({ text: name, stream: process.stderr }).start()
  }

  updatePhase(message: string): void {
    if (this.spinner) {
      this.spinner.text = message
    } else {
      process.stderr.write(message + '\n')
    }
  }

  completePhase(): void {
    if (this.spinner) {
      this.spinner.succeed()
      this.spinner = null
    }
  }

  /**
   * TtyReporter.reportResult — 按工具分组输出安装结果（AC #1, #2）
   *
   * 格式:
   *   🔧 GitHub Copilot
   *     ✅ agents/coding-agent.md     → ~/.copilot/agents/coding-agent.md
   *     🔄 agents/review-agent.md     → ~/.copilot/agents/review-agent.md
   *     ⏭️ skills/refactor/           → ~/.copilot/skills/refactor/
   *
   *   🔧 Claude Code
   *     ✅ instructions/CLAUDE.md     → ~/.claude/instructions/CLAUDE.md
   *
   *   安装: 2 项  更新: 1 项  跳过: 1 项
   *
   * 输出到 stdout（安装结果是数据输出，支持管道消费）
   * 来源: architecture/03-core-decisions.md#D4 — stdout/stderr 分工
   */
  reportResult(results: InstallResult): void {
    // 按工具分组
    const byTool = new Map<string, typeof results.items>()
    for (const item of results.items) {
      const list = byTool.get(item.tool)
      if (list) {
        list.push(item)
      } else {
        byTool.set(item.tool, [item])
      }
    }

    for (const [tool, items] of byTool) {
      // 优先使用 toolDisplayName（如 'GitHub Copilot'），fallback 到内部 id
      const displayName = items[0]?.toolDisplayName ?? tool
      // 工具标题：bold 显示名 + 项数（FR-036，Story 5-2 Dev Notes chalk 示例）
      process.stdout.write(chalk.bold(`\n🔧 ${displayName} (${items.length} 项)\n`))

      const lastIdx = items.length - 1
      items.forEach((item, idx) => {
        const icon = STATUS_ICONS[item.status] ?? '❓'
        // 树形连接符：最后一项用 └──，其他用 ├──
        const connector = idx === lastIdx ? '  └──' : '  ├──'
        // 按状态着色：new=green, updated=blue, skipped=gray（Story 5-2 Dev Notes chalk 示例）
        const line = `${connector} ${icon} ${item.sourcePath}     → ${item.targetPath}`
        let coloredLine: string
        if (item.status === 'new') {
          coloredLine = chalk.green(line)
        } else if (item.status === 'updated') {
          coloredLine = chalk.blue(line)
        } else {
          coloredLine = chalk.gray(line)
        }
        process.stdout.write(`${coloredLine}\n`)
      })
    }

    // 统计行：按段分段着色（Story 5-2 Dev Notes chalk 示例）
    const installed = results.items.filter((i) => i.status === 'new').length
    const updated = results.items.filter((i) => i.status === 'updated').length
    const skipped = results.items.filter((i) => i.status === 'skipped').length
    const statsLine = `${chalk.green(`安装: ${installed} 项`)}  ${chalk.blue(`更新: ${updated} 项`)}  ${chalk.gray(`跳过: ${skipped} 项`)}`
    process.stdout.write(`\n${statsLine}\n`)
  }

  /**
   * TtyReporter.reportPlan — 彩色分组输出（AC #2）
   *
   * 格式:
   *   📋 安装计划预览 (dry-run)
   *
   *   🔧 copilot (全局)
   *     agents/
   *       ├── coding-agent.md  → /home/user/.copilot/agents  [files/copy]
   *       └── review-agent.md  → /home/user/.copilot/agents  [files/copy]
   *
   *   计划安装: N 项 (M 个工具)
   *
   * 输出到 stdout（安装计划是数据输出，支持管道消费）
   * 来源: architecture/03-core-decisions.md#D4 — stdout/stderr 分工
   */
  reportPlan(plan: MatchedPlan): void {
    // 标题行
    process.stdout.write(chalk.bold('\n📋 安装计划预览 (dry-run)\n'))

    // 按工具分组
    const byTool = new Map<string, typeof plan.items>()
    for (const item of plan.items) {
      const key = item.rule.tool
      const list = byTool.get(key)
      if (list) {
        list.push(item)
      } else {
        byTool.set(key, [item])
      }
    }

    for (const [tool, items] of byTool) {
      const scope = items[0]!.rule.scope === 'global' ? '全局' : '项目'
      process.stdout.write(chalk.yellow(`\n🔧 ${tool} (${scope})\n`))

      for (const item of items) {
        const label = `[${typeLabel(item.rule.type)}/${item.mode}]`
        process.stdout.write(chalk.dim(`  ${item.rule.sourceDir}/\n`))

        const lastIdx = item.sourceFiles.length - 1
        item.sourceFiles.forEach((srcFile, idx) => {
          const name = basename(srcFile)
          const prefix = idx === lastIdx ? '    └── ' : '    ├── '
          const annotation = chalk.gray(label)
          const fileTarget = resolveFileTarget(item.targetPath, srcFile)
          process.stdout.write(`${prefix}${name}  → ${fileTarget}  ${annotation}\n`)
        })

        // 空 sourceFiles 时仍输出规则行（说明源目录为空）
        if (item.sourceFiles.length === 0) {
          process.stdout.write(chalk.dim(`    (源目录为空: ${item.rule.sourceDir})\n`))
        }
      }
    }

    // 统计行
    const { totalFiles, toolCount } = calcPlanStats(plan)
    process.stdout.write(chalk.bold(`\n${planStatsLine(totalFiles, toolCount)}\n`))
  }

  reportError(error: AiforgeError): void {
    if (this.spinner) {
      this.spinner.fail()
      this.spinner = null
    }
    // Story 5-4 AC #2: 三段式彩色格式
    // ❌ ${message} → chalk.gray(${why}) → chalk.yellow('修复方法：') → chalk.cyan(   ${cmd})
    const lines = [
      chalk.red(`❌ ${error.message}`),
      chalk.gray(`   ${error.why}`),
      chalk.yellow('   修复方法：'),
      ...error.fix.map((cmd) => chalk.cyan(`   ${cmd}`)),
    ].join('\n')
    process.stderr.write(lines + '\n')
  }

  warn(message: string): void {
    process.stderr.write(chalk.yellow(`⚠ ${message}\n`))
  }
}

// ── PlainReporter ─────────────────────────────────────────────────────────────

class PlainReporter implements Reporter {
  /** 记录当前阶段名，用于 completePhase 输出 [DONE] 阶段名 */
  private currentPhase = ''

  /**
   * startPhase — 输出 [PHASE] 阶段名 到 stderr（Story 5-3 Task 2.1, AC #1）
   * 格式: [PHASE] 解析仓库地址...
   */
  startPhase(name: string): void {
    this.currentPhase = name
    process.stderr.write(`[PHASE] ${name}\n`)
  }

  /**
   * updatePhase — 不输出（避免刷屏，Story 5-3 Task 2.2, AC #1）
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  updatePhase(_message: string): void {
    // CI 非 TTY 环境下不输出进度更新，避免刷屏
  }

  /**
   * completePhase — 输出 [DONE] 阶段名 到 stderr（Story 5-3 Task 2.3, AC #1）
   * 格式: [DONE] 解析仓库地址...
   */
  completePhase(): void {
    process.stderr.write(`[DONE] ${this.currentPhase}\n`)
    this.currentPhase = ''
  }

  /**
   * PlainReporter.reportResult — 纯文本行输出，CI 友好，可被 grep/awk 解析（AC #1, #2）
   *
   * 格式（每行一个文件）:
   *   new     copilot  ~/.copilot/agents/coding-agent.md
   *   updated copilot  ~/.copilot/agents/review-agent.md
   *   skipped copilot  ~/.copilot/skills/refactor/
   *   new     claude   ~/.claude/agents/CLAUDE.md
   *   ---
   *   installed: 2  updated: 1  skipped: 1
   *
   * 输出到 stdout（安装结果是数据输出，支持管道消费）
   * 来源: architecture/03-core-decisions.md#D4 — stdout/stderr 分工
   */
  reportResult(results: InstallResult): void {
    // 按工具分组逐行输出
    const byTool = new Map<string, typeof results.items>()
    for (const item of results.items) {
      const list = byTool.get(item.tool)
      if (list) {
        list.push(item)
      } else {
        byTool.set(item.tool, [item])
      }
    }

    for (const [tool, items] of byTool) {
      for (const item of items) {
        process.stdout.write(`${item.status}\t${tool}\t${item.sourcePath}\t${item.targetPath}\n`)
      }
    }

    // 统计行（---分隔符 + 英文键名，CI 管道友好）
    // CR Round-2 修复：改为 \t 分隔，与明细行和 Story Task 2.4 契约对齐
    const installed = results.items.filter((i) => i.status === 'new').length
    const updated = results.items.filter((i) => i.status === 'updated').length
    const skipped = results.items.filter((i) => i.status === 'skipped').length
    process.stdout.write(`---\ninstalled: ${installed}\tupdated: ${updated}\tskipped: ${skipped}\n`)
  }

  /**
   * PlainReporter.reportPlan — 纯文本输出，CI 友好，可被 grep/awk 解析（AC #2）
   *
   * 格式（每行一个文件，制表符分隔）:
   *   <tool>\t<sourceDir>/<filename>\t<targetPath>\t<type>\t<mode>
   *
   * 输出到 stdout（安装计划是数据输出，支持管道消费）
   * 来源: architecture/03-core-decisions.md#D4 — stdout/stderr 分工
   * CR Round-1 修复：改为 \t 分隔，与 reportResult 对齐（Story Task 2.5）
   */
  reportPlan(plan: MatchedPlan): void {
    for (const item of plan.items) {
      const type = typeLabel(item.rule.type)
      const mode = item.mode

      for (const srcFile of item.sourceFiles) {
        const name = basename(srcFile)
        const src = `${item.rule.sourceDir}/${name}`
        const fileTarget = resolveFileTarget(item.targetPath, srcFile)
        process.stdout.write(`${item.rule.tool}\t${src}\t${fileTarget}\t${type}\t${mode}\n`)
      }
    }

    // 统计行
    const { totalFiles, toolCount } = calcPlanStats(plan)
    process.stdout.write(`${planStatsLine(totalFiles, toolCount)}\n`)
  }

  reportError(error: AiforgeError): void {
    // Story 5-4 AC #2: PlainReporter 三段式纯文本格式（CI 兼容，无 emoji，无颜色）
    // ERROR: ${message} → WHY: ${why} → FIX: ${fix} per line
    process.stderr.write(`ERROR: ${error.message}\n`)
    process.stderr.write(`  WHY: ${error.why}\n`)
    for (const fix of error.fix) {
      process.stderr.write(`  FIX: ${fix}\n`)
    }
  }

  warn(message: string): void {
    process.stderr.write(`⚠ ${message}\n`)
  }
}

// ── QuietReporter ─────────────────────────────────────────────────────────────

class QuietReporter implements Reporter {
  startPhase(): void {}
  updatePhase(): void {}
  completePhase(): void {}
  warn(): void {}

  reportResult(results: InstallResult): void {
    const installed = results.items.filter((i) => i.status === 'new').length
    const updated = results.items.filter((i) => i.status === 'updated').length
    const skipped = results.items.filter((i) => i.status === 'skipped').length
    process.stdout.write(`✓ ${resultStatsLine(installed, updated, skipped)}\n`)
  }

  /**
   * QuietReporter.reportPlan — 只输出统计摘要（AC #2）
   *
   * 格式: 计划安装: N 项 (M 个工具)
   *
   * 输出到 stdout
   */
  reportPlan(plan: MatchedPlan): void {
    const { totalFiles, toolCount } = calcPlanStats(plan)
    process.stdout.write(`${planStatsLine(totalFiles, toolCount)}\n`)
  }

  reportError(error: AiforgeError): void {
    // Story 5-4 AC #2: QuietReporter 三段式格式同 PlainReporter（错误不能被静默）
    // ERROR: ${message} → WHY: ${why} → FIX: ${fix} per line
    process.stderr.write(`ERROR: ${error.message}\n`)
    process.stderr.write(`  WHY: ${error.why}\n`)
    for (const fix of error.fix) {
      process.stderr.write(`  FIX: ${fix}\n`)
    }
  }
}

// ── 工厂函数 ──────────────────────────────────────────────────────────────────

export function createReporter(options: { quiet: boolean; isTty: boolean }): Reporter {
  if (options.quiet) {
    return new QuietReporter()
  }
  if (options.isTty) {
    return new TtyReporter()
  }
  return new PlainReporter()
}
