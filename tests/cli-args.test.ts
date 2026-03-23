/**
 * CLI 参数解析集成测试
 *
 * 来源: Story 1.5 AC#3 — 验证 commander opts → ParsedArgs 映射正确
 *
 * 直接调用 src/pipeline.ts 导出的 mapOptsToArgs 函数，
 * 确保测试与生产代码使用同一份映射逻辑，杜绝漂移
 */

import { describe, it, expect } from 'vitest'
import { Command } from 'commander'
import { mapOptsToArgs } from '../src/pipeline.js'

/**
 * 辅助函数：通过 commander 解析 CLI 参数，
 * 然后调用真实 mapOptsToArgs 得到 ParsedArgs
 */
function parseCliArgs(argv: string[]) {
  const program = new Command()
  let repoUrl: string | undefined
  let opts: Record<string, unknown> = {}

  program
    .name('aiforge')
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
    .exitOverride()
    .action((url: string | undefined, o: Record<string, unknown>) => {
      repoUrl = url
      opts = o
    })

  program.parse(['node', 'aiforge', ...argv])
  // 调用真实的映射函数
  return mapOptsToArgs(repoUrl, opts)
}

describe('CLI 参数解析 → ParsedArgs 映射 (AC#3)', () => {
  it('AC#3 完整参数: -g -l -t copilot claude -d skills agents --dry-run --quiet --force', () => {
    const args = parseCliArgs([
      '-g',
      '-l',
      '-t',
      'copilot',
      'claude',
      '-d',
      'skills',
      'agents',
      '--dry-run',
      '--quiet',
      '--force',
    ])

    expect(args.global).toBe(true)
    expect(args.link).toBe(true)
    expect(args.symlink).toBe(true) // link 的别名
    expect(args.tools).toEqual(['copilot', 'claude'])
    expect(args.dirs).toEqual(['skills', 'agents'])
    expect(args.dryRun).toBe(true)
    expect(args.quiet).toBe(true)
    expect(args.force).toBe(true)
    expect(args.source).toBe('')
    expect(args.ssh).toBe(false)
    expect(args.token).toBeUndefined()
    expect(args.cloneDir).toBeUndefined()
    expect(args.flatten).toBe(false)
  })

  it('repo-url 位置参数解析', () => {
    const args = parseCliArgs(['https://gitlab.example.com/org/repo'])
    expect(args.source).toBe('https://gitlab.example.com/org/repo')
  })

  it('无参数时所有选项为默认值', () => {
    const args = parseCliArgs([])
    expect(args.source).toBe('')
    expect(args.global).toBe(false)
    expect(args.link).toBe(false)
    expect(args.tools).toEqual([])
    expect(args.dirs).toEqual([])
    expect(args.dryRun).toBe(false)
    expect(args.quiet).toBe(false)
    expect(args.force).toBe(false)
    expect(args.ssh).toBe(false)
    expect(args.token).toBeUndefined()
    expect(args.cloneDir).toBeUndefined()
  })

  it('--ssh 和 --token 参数', () => {
    const args = parseCliArgs(['--ssh', '--token', 'glpat-abc123'])
    expect(args.ssh).toBe(true)
    expect(args.token).toBe('glpat-abc123')
  })

  it('--clone-dir 参数', () => {
    const args = parseCliArgs(['--clone-dir', '/tmp/my-clone'])
    expect(args.cloneDir).toBe('/tmp/my-clone')
  })

  it('repo-url 与选项组合', () => {
    const args = parseCliArgs([
      'https://gitlab.example.com/org/repo',
      '-g',
      '--dry-run',
      '-t',
      'cursor',
    ])
    expect(args.source).toBe('https://gitlab.example.com/org/repo')
    expect(args.global).toBe(true)
    expect(args.dryRun).toBe(true)
    expect(args.tools).toEqual(['cursor'])
  })

  it('mapOptsToArgs 直接调用 — 验证映射逻辑不漂移', () => {
    const args = mapOptsToArgs('https://example.com/repo', {
      global: true,
      link: true,
      tools: ['cursor'],
      dirs: ['rules'],
      dryRun: true,
      quiet: false,
      force: false,
      ssh: true,
      token: 'my-token',
      cloneDir: '/tmp',
    })

    expect(args.source).toBe('https://example.com/repo')
    expect(args.global).toBe(true)
    expect(args.link).toBe(true)
    expect(args.symlink).toBe(true)
    expect(args.tools).toEqual(['cursor'])
    expect(args.dirs).toEqual(['rules'])
    expect(args.dryRun).toBe(true)
    expect(args.ssh).toBe(true)
    expect(args.token).toBe('my-token')
    expect(args.cloneDir).toBe('/tmp')
    expect(args.flatten).toBe(false)
  })
})
