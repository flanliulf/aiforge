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
import { createReporter, mapOptsToArgs, runPipeline, createProductionStages } from './pipeline.js'
import { registerInitCommand } from './commands/init.js'
import { UnixPathResolver } from './core/path-resolver.js'
import { loadConfig } from './services/config.js'
import { setLanguage, msg } from './core/messages.js'
import { AiforgeError } from './core/errors.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8')) as {
  version: string
}

const program = new Command()

program
  .name('aiforge')
  .description('AI rules installer - sync AI tool configurations from a knowledge repository')
  .version(pkg.version)
  .argument('[repo-url]', 'knowledge repository URL')
  .option('-g, --global', 'install globally', false)
  .option('-l, --link', 'symlink mode', false)
  .option('-t, --tools <tools...>', 'specify tools manually')
  .option('-d, --dirs <dirs...>', 'filter resource types')
  .option('--dry-run', 'preview mode', false)
  .option('--quiet', 'minimal output', false)
  .option('--force', 'skip conflict confirmation', false)
  .option('--ssh', 'force SSH authentication', false)
  .option('--token <token>', 'provide token')
  .option('--clone-dir <path>', 'custom clone directory')
  .option('--list <dir>', 'list installable subdirectories under a top-level dir')
  .action(async (repoUrl: string | undefined, opts: Record<string, unknown>) => {
    const args = mapOptsToArgs(repoUrl, opts)
    const pathResolver = new UnixPathResolver()

    // Story 5.5a Task 3.1: 管道启动前从 config 读取 language，调用 setLanguage() 设置模块级全局状态
    // 语言加载发生在 Reporter 创建之前，非法值回退通过 process.stderr.write 输出（AC #5, Task 3.2）
    try {
      const config = await loadConfig(pathResolver)
      if (config.language) {
        const SUPPORTED = ['zh-CN', 'en']
        if (!SUPPORTED.includes(config.language)) {
          // Task 3.2: 非法语言值 → 回退到 zh-CN，通过 stderr 直接输出提示
          // 这是唯一允许不经过 Reporter 的输出场景（Reporter 尚未创建）
          process.stderr.write(
            msg('index.unsupportedLanguage').replace('{lang}', config.language) + '\n',
          )
        }
        setLanguage(config.language)
      }
    } catch (error) {
      // 语言加载失败不阻塞主流程：CONFIG_NOT_FOUND 静默降级，其他错误也只 warn 不中断
      // pipeline 会在后续阶段重新加载 config 并处理真实的配置错误
      if (!(error instanceof AiforgeError && error.code === 'CONFIG_NOT_FOUND')) {
        // 非"配置不存在"的错误，写入 stderr 但不中断（语言默认已为 zh-CN）
        process.stderr.write(
          msg('index.languageLoadFailed').replace(
            '{err}',
            error instanceof Error ? error.message : String(error),
          ) + '\n',
        )
      }
    }

    const reporter = createReporter({
      quiet: args.quiet,
      isTty: process.stderr.isTTY === true,
    })

    const stages = createProductionStages(pathResolver)
    await runPipeline(args, reporter, stages)
  })

// 注册子命令
registerInitCommand(program)

program.parseAsync().catch((err: unknown) => {
  console.error(err)
  process.exitCode = 1
})
