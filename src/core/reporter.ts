import ora, { type Ora } from 'ora'
import chalk from 'chalk'
import type { InstallResult, MatchedPlan } from './types.js'
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

  reportPlan(plan: MatchedPlan): void {
    for (const item of plan.items) {
      process.stdout.write(
        chalk.cyan(`[${item.rule.tool}] ${item.rule.sourceDir} → ${item.targetPath}\n`)
      )
    }
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

  reportPlan(plan: MatchedPlan): void {
    for (const item of plan.items) {
      process.stdout.write(`[${item.rule.tool}] ${item.rule.sourceDir} → ${item.targetPath}\n`)
    }
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
      `✓ 安装: ${newCount} 项  更新: ${updatedCount} 项  跳过: ${skippedCount} 项\n`
    )
  }

  reportPlan(plan: MatchedPlan): void {
    process.stdout.write(`计划安装: ${plan.items.length} 项\n`)
  }

  reportError(error: AiforgeError): void {
    process.stderr.write(`✗ ${error.message}\n`)
  }
}

export function createReporter(options: { quiet: boolean; isTty: boolean }): Reporter {
  if (options.quiet) {
    return new QuietReporter()
  }
  if (options.isTty) {
    return new TtyReporter()
  }
  return new PlainReporter()
}
