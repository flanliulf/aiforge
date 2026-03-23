/**
 * aiforge init 子命令占位实现
 *
 * 来源: Story 1.5 Task 3 — 占位实现，输出"aiforge init 尚未实现"
 * 真实交互式流程将在 Story 2.5 实现
 */

export function registerInitCommand(program: import('commander').Command): void {
  program
    .command('init')
    .description('初始化 aiforge 配置')
    .action(() => {
      // init 命令不走管道，使用 console.log 直接输出（见 project-context.md Output Rules）
      console.log('aiforge init 尚未实现')
      process.exitCode = 0
    })
}
