#!/usr/bin/env node
/**
 * aiforge CLI 入口
 *
 * 来源: Story 1.5 Task 1 + Task 4
 * 主命令: aiforge [repo-url]
 * 子命令: aiforge init
 *
 * 模块边界: index.ts 只依赖 pipeline.ts 和 commands/
 */

import { Command } from 'commander'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createReporter, mapOptsToArgs, runPipeline } from './pipeline.js'
import { registerInitCommand } from './commands/init.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8')) as {
  version: string
}

const program = new Command()

program
  .name('aiforge')
  .description('AI rules installer - sync AI tool configurations from a knowledge repository')
  .version(pkg.version)
  .argument('[repo-url]', '知识仓库 URL')
  .option('-g, --global', '全局安装', false)
  .option('-l, --link', '符号链接模式', false)
  .option('-t, --tools <tools...>', '手动指定工具')
  .option('-d, --dirs <dirs...>', '过滤资源类型')
  .option('--dry-run', '预览模式', false)
  .option('--quiet', '精简输出', false)
  .option('--force', '跳过冲突确认', false)
  .option('--ssh', '强制 SSH 认证', false)
  .option('--token <token>', '提供 Token')
  .option('--clone-dir <path>', '自定义克隆路径')
  .action(async (repoUrl: string | undefined, opts: Record<string, unknown>) => {
    const args = mapOptsToArgs(repoUrl, opts)

    const reporter = createReporter({
      quiet: args.quiet,
      isTty: process.stdout.isTTY === true,
    })

    await runPipeline(args, reporter)
  })

// 注册子命令
registerInitCommand(program)

program.parseAsync().catch((err: unknown) => {
  console.error(err)
  process.exitCode = 1
})
