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

  reportResult(results: InstallResult): void {
    for (const item of results.items) {
      const icon = item.status === 'new' ? '✅' : item.status === 'updated' ? '🔄' : '⏭️'
      process.stdout.write(`${icon} ${item.targetPath}\n`)
    }
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
    process.stderr.write(chalk.red(`✗ ${error.message}\n`))
    process.stderr.write(chalk.yellow(`  原因: ${error.why}\n`))
    for (const fix of error.fix) {
      process.stderr.write(chalk.gray(`  修复: ${fix}\n`))
    }
  }

  warn(message: string): void {
    process.stderr.write(chalk.yellow(`⚠ ${message}\n`))
  }
}

// ── PlainReporter ─────────────────────────────────────────────────────────────

class PlainReporter implements Reporter {
  startPhase(name: string): void {
    process.stderr.write(`${name}\n`)
  }

  updatePhase(message: string): void {
    process.stderr.write(`${message}\n`)
  }

  completePhase(): void {
    process.stderr.write('✓\n')
  }

  reportResult(results: InstallResult): void {
    for (const item of results.items) {
      const icon = item.status === 'new' ? '✅' : item.status === 'updated' ? '🔄' : '⏭️'
      process.stdout.write(`${icon} ${item.targetPath}\n`)
    }
  }

  /**
   * PlainReporter.reportPlan — 纯文本输出，CI 友好，可被 grep/awk 解析（AC #2）
   *
   * 格式（每行一个文件）:
   *   <tool>  <sourceDir>/<filename>  →  <targetPath>  <type>  <mode>
   *
   * 输出到 stdout（安装计划是数据输出，支持管道消费）
   * 来源: architecture/03-core-decisions.md#D4 — stdout/stderr 分工
   */
  reportPlan(plan: MatchedPlan): void {
    for (const item of plan.items) {
      const type = typeLabel(item.rule.type)
      const mode = item.mode

      for (const srcFile of item.sourceFiles) {
        const name = basename(srcFile)
        const src = `${item.rule.sourceDir}/${name}`
        const fileTarget = resolveFileTarget(item.targetPath, srcFile)
        process.stdout.write(`${item.rule.tool}  ${src}  →  ${fileTarget}  ${type}  ${mode}\n`)
      }
    }

    // 统计行
    const { totalFiles, toolCount } = calcPlanStats(plan)
    process.stdout.write(`${planStatsLine(totalFiles, toolCount)}\n`)
  }

  reportError(error: AiforgeError): void {
    process.stderr.write(`✗ ${error.message}\n`)
    process.stderr.write(`  原因: ${error.why}\n`)
    for (const fix of error.fix) {
      process.stderr.write(`  修复: ${fix}\n`)
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
    const newCount = results.items.filter((i) => i.status === 'new').length
    const updatedCount = results.items.filter((i) => i.status === 'updated').length
    const skippedCount = results.items.filter((i) => i.status === 'skipped').length
    process.stdout.write(
      `✓ 安装: ${newCount} 项  更新: ${updatedCount} 项  跳过: ${skippedCount} 项\n`,
    )
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
    process.stderr.write(`✗ ${error.message}\n`)
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
