/**
 * tests/stages/execute-install.test.ts
 *
 * Story 4.2 + 4.3 + 4.5 — 安装执行测试
 * 测试用例：files/directories 复制、symlink 模式、flatten 模式、
 *           new/updated/skipped 状态判定、断链检测、fail-fast 行为、
 *           冲突处理集成、备份后覆盖、--force 跳过交互、非 TTY 失败、
 *           零结果诊断、临时文件清理
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  mkdtemp,
  writeFile,
  mkdir,
  rm,
  readFile,
  symlink,
  readlink,
  access,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, basename } from 'node:path'

// ── Hoisted mock for conflict-resolver ───────────────────────────────────
const conflictMocks = vi.hoisted(() => ({
  handleConflict: vi.fn(),
}))

vi.mock('../../src/stages/conflict-resolver.js', () => ({
  handleConflict: conflictMocks.handleConflict,
}))

import { executeInstall } from '../../src/stages/execute-install.js'
import type { ManifestContext } from '../../src/stages/execute-install.js'
import { AiforgeError } from '../../src/core/errors.js'
import { InstallType } from '../../src/core/types.js'
import type { MatchedPlan, ParsedArgs } from '../../src/core/types.js'
import { createReporter } from '../../src/core/reporter.js'
import type { Reporter } from '../../src/core/reporter.js'
import { setLanguage } from '../../src/core/messages.js'
import type { PathResolver } from '../../src/core/path-resolver.js'
import chalk from 'chalk'

// ── helpers ─────────────────────────────────────────────────────────────────

async function makeTmpDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'aiforge-exec-install-test-'))
}

function makeReporter(): Reporter {
  return {
    startPhase: vi.fn(),
    updatePhase: vi.fn(),
    completePhase: vi.fn(),
    reportResult: vi.fn(),
    reportPlan: vi.fn(),
    reportError: vi.fn(),
    warn: vi.fn(),
  }
}

function makeArgs(overrides: Partial<ParsedArgs> = {}): ParsedArgs {
  return {
    source: 'test-repo',
    global: false,
    link: false,
    tools: [],
    dirs: [],
    dryRun: false,
    quiet: false,
    force: false,
    ssh: false,
    symlink: false,
    flatten: false,
    noUniversal: false,
    ...overrides,
  }
}

function makePathResolver(homeDir: string): PathResolver {
  return {
    home: () => homeDir,
    configDir: () => join(homeDir, '.aiforge'),
    reposDir: () => join(homeDir, '.aiforge', 'repos'),
    toolGlobalDir: (id: string) => join(homeDir, '.aiforge', 'tools', id),
    toolProjectDir: (id: string) => join('.aiforge', 'tools', id),
  }
}

function makeFilePlan(
  sourceFiles: string[],
  targetPath: string,
  scope: 'global' | 'project' = 'global',
): MatchedPlan {
  return {
    items: [
      {
        rule: {
          tool: 'claude',
          scope,
          sourceDir: 'agents',
          type: InstallType.Files,
          targetDir: targetPath,
        },
        sourceFiles,
        targetPath,
        mode: 'copy',
      },
    ],
  }
}

function makeDirPlan(sourceDirs: string[], targetPath: string): MatchedPlan {
  return {
    items: [
      {
        rule: {
          tool: 'cursor',
          scope: 'global',
          sourceDir: 'skills',
          type: InstallType.Directories,
          targetDir: targetPath,
        },
        sourceFiles: sourceDirs,
        targetPath,
        mode: 'copy',
      },
    ],
  }
}

// ── describe: stages/execute-install ─────────────────────────────────────────

describe('stages/execute-install', () => {
  let tmpDir: string
  let reporter: Reporter
  let pathResolver: PathResolver

  beforeEach(async () => {
    tmpDir = await makeTmpDir()
    reporter = makeReporter()
    pathResolver = makePathResolver(tmpDir)
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  // ── Task 3.2: files 类型复制 ───────────────────────────────────────────────

  describe('files 类型复制', () => {
    it('复制单个文件到目标目录，返回 status: new', async () => {
      const srcFile = join(tmpDir, 'source.md')
      const targetDir = join(tmpDir, 'target')
      await writeFile(srcFile, '# hello')

      const plan = makeFilePlan([srcFile], targetDir)
      const result = await executeInstall(plan, makeArgs(), reporter, pathResolver)

      expect(result.items).toHaveLength(1)
      expect(result.items[0]!.status).toBe('new')
      expect(result.items[0]!.sourcePath).toBe(srcFile)
      expect(result.items[0]!.targetPath).toBe(join(targetDir, basename(srcFile)))

      // 文件实际已被复制
      const content = await readFile(join(targetDir, basename(srcFile)), 'utf8')
      expect(content).toBe('# hello')
    })

    it('复制多个文件，每个文件有独立 InstallResult 条目', async () => {
      const srcA = join(tmpDir, 'a.md')
      const srcB = join(tmpDir, 'b.md')
      const targetDir = join(tmpDir, 'multi-target')
      await writeFile(srcA, 'file-a')
      await writeFile(srcB, 'file-b')

      const plan = makeFilePlan([srcA, srcB], targetDir)
      const result = await executeInstall(plan, makeArgs(), reporter, pathResolver)

      expect(result.items).toHaveLength(2)
      expect(result.items.map((i) => i.status)).toEqual(['new', 'new'])
    })
  })

  // ── Task 3.2: directories 类型复制 ─────────────────────────────────────────

  describe('directories 类型复制', () => {
    it('复制整个目录到目标位置，保持目录结构', async () => {
      const srcDir = join(tmpDir, 'my-skill')
      await mkdir(srcDir)
      await writeFile(join(srcDir, 'README.md'), '# skill')
      const targetDir = join(tmpDir, 'skills-target')

      const plan = makeDirPlan([srcDir], targetDir)
      const result = await executeInstall(plan, makeArgs(), reporter, pathResolver)

      expect(result.items).toHaveLength(1)
      expect(result.items[0]!.status).toBe('new')

      // 目录实际被复制
      const content = await readFile(join(targetDir, basename(srcDir), 'README.md'), 'utf8')
      expect(content).toBe('# skill')
    })

    // ── Story 6-3: 文件级 hash 增量同步测试（AC #3）───────────────────────

    it('AC #3 源目录含 2 个文件时返回 2 个 result items，均为 new', async () => {
      const srcDir = join(tmpDir, 'code-review')
      await mkdir(srcDir)
      await writeFile(join(srcDir, 'index.md'), '# code review')
      await writeFile(join(srcDir, 'examples.md'), '## examples')
      const targetDir = join(tmpDir, 'skills-multi')

      const plan = makeDirPlan([srcDir], targetDir)
      const result = await executeInstall(plan, makeArgs(), reporter, pathResolver)

      expect(result.items).toHaveLength(2)
      expect(result.items.every((i) => i.status === 'new')).toBe(true)
    })

    it('AC #3 二次安装无文件变更时所有文件 status 为 skipped', async () => {
      const srcDir = join(tmpDir, 'git-commit')
      await mkdir(srcDir)
      await writeFile(join(srcDir, 'guide.md'), '# guide')
      const targetDir = join(tmpDir, 'skills-incremental')

      const plan = makeDirPlan([srcDir], targetDir)

      // 第一次安装
      await executeInstall(plan, makeArgs(), reporter, pathResolver)

      // 第二次安装：内容未变
      const result2 = await executeInstall(plan, makeArgs(), reporter, pathResolver)
      expect(result2.items.every((i) => i.status === 'skipped')).toBe(true)
    })

    it('AC #3 二次安装部分文件变更时只有变更文件为 updated，其余为 skipped', async () => {
      const srcDir = join(tmpDir, 'mixed-skill')
      await mkdir(srcDir)
      const unchanged = join(srcDir, 'unchanged.md')
      const changed = join(srcDir, 'changed.md')
      await writeFile(unchanged, '# unchanged')
      await writeFile(changed, '# v1')
      const targetDir = join(tmpDir, 'skills-partial')

      const plan = makeDirPlan([srcDir], targetDir)

      // 第一次安装
      await executeInstall(plan, makeArgs(), reporter, pathResolver)

      // 修改一个源文件
      await writeFile(changed, '# v2 updated content')

      // 第二次安装
      const result2 = await executeInstall(plan, makeArgs(), reporter, pathResolver)
      expect(result2.items).toHaveLength(2)

      const changedItem = result2.items.find((i) => i.targetPath.endsWith('changed.md'))
      const unchangedItem = result2.items.find((i) => i.targetPath.endsWith('unchanged.md'))
      expect(changedItem?.status).toBe('updated')
      expect(unchangedItem?.status).toBe('skipped')
    })

    it('AC #1 universal 工具 → toolDisplayName 为 通用目录', async () => {
      const srcDir = join(tmpDir, 'universal-skill')
      await mkdir(srcDir)
      await writeFile(join(srcDir, 'README.md'), '# universal')
      const targetDir = join(tmpDir, 'universal-target')

      const plan: MatchedPlan = {
        items: [
          {
            rule: {
              tool: 'universal',
              scope: 'global', // global scope 让 preflight 以 home() 为边界，避免 PATH_TRAVERSAL
              sourceDir: 'skills',
              type: InstallType.Directories,
              targetDir,
            },
            sourceFiles: [srcDir],
            targetPath: targetDir,
            mode: 'copy',
          },
        ],
      }

      const result = await executeInstall(plan, makeArgs({ global: true }), reporter, pathResolver)
      expect(result.items).toHaveLength(1)
      expect(result.items[0]!.toolDisplayName).toBe('通用目录')
    })
  })

  // ── Task 3.2: 目录自动创建 ────────────────────────────────────────────────

  describe('目录自动创建', () => {
    it('目标目录不存在时自动创建', async () => {
      const srcFile = join(tmpDir, 'test.md')
      const targetDir = join(tmpDir, 'deep', 'nested', 'dir')
      await writeFile(srcFile, 'content')

      const plan = makeFilePlan([srcFile], targetDir)
      const result = await executeInstall(plan, makeArgs(), reporter, pathResolver)

      expect(result.items[0]!.status).toBe('new')
      // 目录被自动创建
      const content = await readFile(join(targetDir, basename(srcFile)), 'utf8')
      expect(content).toBe('content')
    })
  })

  // ── Task 2: new/updated/skipped 状态判定 ──────────────────────────────────

  describe('安装状态判定', () => {
    it('目标文件不存在 → status: new', async () => {
      const srcFile = join(tmpDir, 'new-file.md')
      const targetDir = join(tmpDir, 'status-target')
      await writeFile(srcFile, 'new content')

      const plan = makeFilePlan([srcFile], targetDir)
      const result = await executeInstall(plan, makeArgs(), reporter, pathResolver)

      expect(result.items[0]!.status).toBe('new')
    })

    it('目标文件存在且 hash 不同 → status: updated', async () => {
      const srcFile = join(tmpDir, 'update-file.md')
      const targetDir = join(tmpDir, 'update-target')
      await mkdir(targetDir)
      await writeFile(srcFile, 'new version content')
      // 预先创建内容不同的目标文件
      await writeFile(join(targetDir, basename(srcFile)), 'old version content')

      const plan = makeFilePlan([srcFile], targetDir)
      const result = await executeInstall(plan, makeArgs(), reporter, pathResolver)

      expect(result.items[0]!.status).toBe('updated')
    })

    it('目标文件存在且 hash 相同 → status: skipped', async () => {
      const srcFile = join(tmpDir, 'skip-file.md')
      const targetDir = join(tmpDir, 'skip-target')
      await mkdir(targetDir)
      const sameContent = 'identical content'
      await writeFile(srcFile, sameContent)
      // 目标文件与源文件内容相同
      await writeFile(join(targetDir, basename(srcFile)), sameContent)

      const plan = makeFilePlan([srcFile], targetDir)
      const result = await executeInstall(plan, makeArgs(), reporter, pathResolver)

      expect(result.items[0]!.status).toBe('skipped')
    })

    it('skipped 是正常结果，不抛出错误', async () => {
      const srcFile = join(tmpDir, 'identical.md')
      const targetDir = join(tmpDir, 'identical-target')
      await mkdir(targetDir)
      const content = 'same same same'
      await writeFile(srcFile, content)
      await writeFile(join(targetDir, basename(srcFile)), content)

      const plan = makeFilePlan([srcFile], targetDir)
      await expect(executeInstall(plan, makeArgs(), reporter, pathResolver)).resolves.not.toThrow()
    })
  })

  // ── 安全校验：symlink 逃逸防护（CR Round-1 发现 #1 修复验证） ────────────────

  describe('symlink 逃逸安全校验', () => {
    it('files 分支：destPath 是指向 allowedRoot 外的 symlink 时，抛出 AiforgeError(PATH_TRAVERSAL)', async () => {
      // allowedRoot = tmpDir（pathResolver.home() 返回 tmpDir）
      // 攻击场景：targetDir 合法（在 allowedRoot 内），但目录中预置了
      //           同名 symlink 文件指向 tmpDir 外部（/tmp）
      const targetDir = join(tmpDir, 'safe-target')
      await mkdir(targetDir)

      const srcFile = join(tmpDir, 'payload.md')
      await writeFile(srcFile, 'malicious content')

      // 在目标目录中预置同名 symlink，指向 allowedRoot（tmpDir）之外
      const symlinkName = basename(srcFile)
      const outsideTarget = join(tmpdir(), 'outside-file.md')
      await symlink(outsideTarget, join(targetDir, symlinkName))

      const plan = makeFilePlan([srcFile], targetDir)

      let caught: unknown
      try {
        await executeInstall(plan, makeArgs(), reporter, pathResolver)
      } catch (e) {
        caught = e
      }

      expect(caught).toBeInstanceOf(AiforgeError)
      const ae = caught as AiforgeError
      expect(ae.severity).toBe('fatal')
      expect(ae.code).toBe('PATH_TRAVERSAL')
    })

    it('directories 分支：destPath 是指向 allowedRoot 外的 symlink 时，抛出 AiforgeError(PATH_TRAVERSAL)', async () => {
      const targetDir = join(tmpDir, 'dir-safe-target')
      await mkdir(targetDir)

      const srcDir = join(tmpDir, 'my-skill')
      await mkdir(srcDir)
      await writeFile(join(srcDir, 'README.md'), '# skill')

      // 预置同名 symlink 目录指向 allowedRoot 之外
      const symlinkName = basename(srcDir)
      const outsideDir = join(tmpdir(), 'outside-dir')
      await symlink(outsideDir, join(targetDir, symlinkName))

      const plan = makeDirPlan([srcDir], targetDir)

      let caught: unknown
      try {
        await executeInstall(plan, makeArgs(), reporter, pathResolver)
      } catch (e) {
        caught = e
      }

      expect(caught).toBeInstanceOf(AiforgeError)
      const ae = caught as AiforgeError
      expect(ae.severity).toBe('fatal')
      expect(ae.code).toBe('PATH_TRAVERSAL')
    })
  })

  // ── Task 3.2: fail-fast 行为 ──────────────────────────────────────────────

  describe('fail-fast 行为', () => {
    it('文件不存在时抛出 AiforgeError(fatal)，错误码为 FILE_COPY_FAILED', async () => {
      const nonExistentSrc = join(tmpDir, 'does-not-exist.md')
      const targetDir = join(tmpDir, 'fail-target')

      const plan = makeFilePlan([nonExistentSrc], targetDir)

      await expect(executeInstall(plan, makeArgs(), reporter, pathResolver)).rejects.toThrow(
        AiforgeError,
      )

      try {
        await executeInstall(plan, makeArgs(), reporter, pathResolver)
      } catch (error) {
        expect(error).toBeInstanceOf(AiforgeError)
        const ae = error as AiforgeError
        expect(ae.severity).toBe('fatal')
        expect(ae.code).toBe('FILE_COPY_FAILED')
      }
    })

    it('第一个文件失败后，后续文件不继续安装', async () => {
      const failSrc = join(tmpDir, 'fail.md')
      const successSrc = join(tmpDir, 'success.md')
      const targetDir = join(tmpDir, 'failfast-target')
      // 只创建第二个文件
      await writeFile(successSrc, 'success')

      const plan: MatchedPlan = {
        items: [
          {
            rule: {
              tool: 'claude',
              scope: 'global',
              sourceDir: 'agents',
              type: InstallType.Files,
              targetDir,
            },
            sourceFiles: [failSrc, successSrc],
            targetPath: targetDir,
            mode: 'copy',
          },
        ],
      }

      await expect(executeInstall(plan, makeArgs(), reporter, pathResolver)).rejects.toThrow(
        AiforgeError,
      )
    })
  })

  // ── reporter 调用 ────────────────────────────────────────────────────────

  describe('reporter 调用', () => {
    it('调用 reporter.startPhase 输出进度', async () => {
      const srcFile = join(tmpDir, 'reporter-test.md')
      const targetDir = join(tmpDir, 'reporter-target')
      await writeFile(srcFile, 'test')

      const plan = makeFilePlan([srcFile], targetDir)
      await executeInstall(plan, makeArgs(), reporter, pathResolver)

      expect(reporter.startPhase).toHaveBeenCalledOnce()
      expect(reporter.startPhase).toHaveBeenCalledWith(expect.stringContaining('安装'))
    })

    it('每个处理的文件调用 reporter.updatePhase', async () => {
      const srcA = join(tmpDir, 'reporter-a.md')
      const srcB = join(tmpDir, 'reporter-b.md')
      const targetDir = join(tmpDir, 'reporter-multi-target')
      await writeFile(srcA, 'a')
      await writeFile(srcB, 'b')

      const plan = makeFilePlan([srcA, srcB], targetDir)
      await executeInstall(plan, makeArgs(), reporter, pathResolver)

      // updatePhase 被调用了 2 次（每个非 skipped 文件一次）
      expect(reporter.updatePhase).toHaveBeenCalledTimes(2)
    })

    it('大批量安装时压缩 reporter.updatePhase 调用频率', async () => {
      const sourceFiles = await Promise.all(
        Array.from({ length: 25 }, async (_, idx) => {
          const srcFile = join(tmpDir, `bulk-${idx + 1}.md`)
          await writeFile(srcFile, `content-${idx + 1}`)
          return srcFile
        }),
      )
      const targetDir = join(tmpDir, 'reporter-bulk-target')

      const plan = makeFilePlan(sourceFiles, targetDir)
      await executeInstall(plan, makeArgs(), reporter, pathResolver)

      const calls = (reporter.updatePhase as ReturnType<typeof vi.fn>).mock.calls
      expect(calls.length).toBeLessThan(sourceFiles.length)
      expect(calls.length).toBeLessThanOrEqual(10)
      expect(calls[0]?.[0]).toBe('执行安装... (1/25)')
      expect(calls.at(-1)?.[0]).toBe('执行安装... (25/25)')
    })

    it('结果项携带本地安装主目录分组信息', async () => {
      const srcFile = join(tmpDir, 'grouped.md')
      const targetDir = join(tmpDir, 'grouped-target')
      await writeFile(srcFile, 'grouped')

      const plan: MatchedPlan = {
        items: [
          {
            rule: {
              tool: 'claude',
              scope: 'global',
              sourceDir: 'agents',
              type: InstallType.Files,
              targetDir: '~/.claude/agents/',
            },
            sourceFiles: [srcFile],
            targetPath: targetDir,
            mode: 'copy',
          },
        ],
      }
      const result = await executeInstall(plan, makeArgs(), reporter, pathResolver)

      expect(result.items[0]?.targetGroupPath).toBe(targetDir)
      expect(result.items[0]?.targetGroupLabel).toBe('~/.claude/agents/')
    })

    it('skipped 文件仍调用 reporter.updatePhase 推进进度计数', async () => {
      const srcFile = join(tmpDir, 'no-update.md')
      const targetDir = join(tmpDir, 'no-update-target')
      await mkdir(targetDir)
      const content = 'same'
      await writeFile(srcFile, content)
      await writeFile(join(targetDir, basename(srcFile)), content)

      const plan = makeFilePlan([srcFile], targetDir)
      await executeInstall(plan, makeArgs(), reporter, pathResolver)

      // skipped 仍是已处理的终态，应推进进度计数
      expect(reporter.updatePhase).toHaveBeenCalledWith('执行安装... (1/1)')
    })

    // CR R4-#2 回归：成功路径调用 completePhase
    it('成功路径调用 reporter.completePhase 恰好 1 次', async () => {
      const srcFile = join(tmpDir, 'complete-phase.md')
      const targetDir = join(tmpDir, 'complete-phase-target')
      await writeFile(srcFile, 'test')

      const plan = makeFilePlan([srcFile], targetDir)
      await executeInstall(plan, makeArgs(), reporter, pathResolver)

      expect(reporter.completePhase).toHaveBeenCalledOnce()
    })
  })

  // ── 空计划 ────────────────────────────────────────────────────────────────

  describe('空计划', () => {
    it('空 plan.items 返回空 InstallResult', async () => {
      const emptyPlan: MatchedPlan = { items: [] }
      const result = await executeInstall(emptyPlan, makeArgs(), reporter, pathResolver)

      expect(result.items).toHaveLength(0)
    })

    it('sourceFiles 为空的 item 不产生任何结果', async () => {
      const targetDir = join(tmpDir, 'empty-src-target')
      const plan: MatchedPlan = {
        items: [
          {
            rule: {
              tool: 'claude',
              scope: 'global',
              sourceDir: 'agents',
              type: InstallType.Files,
              targetDir,
            },
            sourceFiles: [],
            targetPath: targetDir,
            mode: 'copy',
          },
        ],
      }
      const result = await executeInstall(plan, makeArgs(), reporter, pathResolver)
      expect(result.items).toHaveLength(0)
    })

    // CR R4-#1 回归：空 sourceFiles 不创建目标目录
    it('sourceFiles 为空的 item 不创建目标目录（无副作用）', async () => {
      const targetDir = join(tmpDir, 'should-not-exist')
      const plan: MatchedPlan = {
        items: [
          {
            rule: {
              tool: 'claude',
              scope: 'global',
              sourceDir: 'agents',
              type: InstallType.Files,
              targetDir,
            },
            sourceFiles: [],
            targetPath: targetDir,
            mode: 'copy',
          },
        ],
      }
      await executeInstall(plan, makeArgs(), reporter, pathResolver)

      // 目标目录不应被创建
      const { access: fsAccess } = await import('node:fs/promises')
      await expect(fsAccess(targetDir)).rejects.toThrow()
    })

    // CR R4-#1 回归：空 sourceFiles 且 targetPath 是已存在文件时不抛错
    it('sourceFiles 为空且 targetPath 是已存在文件时，静默跳过不抛错', async () => {
      const targetAsFile = join(tmpDir, 'existing-file.txt')
      await writeFile(targetAsFile, 'I am a file, not a directory')

      const plan: MatchedPlan = {
        items: [
          {
            rule: {
              tool: 'claude',
              scope: 'global',
              sourceDir: 'agents',
              type: InstallType.Files,
              targetDir: targetAsFile,
            },
            sourceFiles: [],
            targetPath: targetAsFile,
            mode: 'copy',
          },
        ],
      }

      // 不应抛错（之前会因 ensureDir 对文件路径抛 ENOTDIR）
      await expect(executeInstall(plan, makeArgs(), reporter, pathResolver)).resolves.not.toThrow()
    })
  })

  // ══════════════════════════════════════════════════════════════════════════════
  // Story 4.3 — symlink 模式测试
  // ══════════════════════════════════════════════════════════════════════════════

  describe('symlink 模式 — files 类型 (AC: #1)', () => {
    it('创建指向源文件的符号链接，返回 status: new', async () => {
      const srcFile = join(tmpDir, 'agent.md')
      const targetDir = join(tmpDir, 'sym-target')
      await writeFile(srcFile, '# agent config')

      const plan = makeFilePlan([srcFile], targetDir)
      plan.items[0]!.mode = 'symlink'

      const result = await executeInstall(plan, makeArgs({ link: true }), reporter, pathResolver)

      expect(result.items).toHaveLength(1)
      expect(result.items[0]!.status).toBe('new')

      // 验证实际创建了符号链接
      const linkTarget = await readlink(join(targetDir, basename(srcFile)))
      expect(linkTarget).toBe(srcFile)

      // 通过链接可以读取到源文件内容
      const content = await readFile(join(targetDir, basename(srcFile)), 'utf8')
      expect(content).toBe('# agent config')
    })

    it('已存在相同目标的符号链接 → status: skipped', async () => {
      const srcFile = join(tmpDir, 'same-link.md')
      const targetDir = join(tmpDir, 'same-link-target')
      await writeFile(srcFile, 'content')
      await mkdir(targetDir)

      // 预先创建指向相同源的符号链接
      await symlink(srcFile, join(targetDir, basename(srcFile)))

      const plan = makeFilePlan([srcFile], targetDir)
      plan.items[0]!.mode = 'symlink'

      const result = await executeInstall(plan, makeArgs({ link: true }), reporter, pathResolver)

      expect(result.items[0]!.status).toBe('skipped')
    })

    it('已存在指向不同源的符号链接 → status: updated，链接被更新', async () => {
      const oldSrc = join(tmpDir, 'old-source.md')
      const newSrc = join(tmpDir, 'updated-link.md')
      const targetDir = join(tmpDir, 'update-link-target')
      await writeFile(oldSrc, 'old')
      await writeFile(newSrc, 'new')
      await mkdir(targetDir)

      // 预先创建指向旧源的符号链接
      await symlink(oldSrc, join(targetDir, basename(newSrc)))

      const plan = makeFilePlan([newSrc], targetDir)
      plan.items[0]!.mode = 'symlink'

      const result = await executeInstall(plan, makeArgs({ link: true }), reporter, pathResolver)

      expect(result.items[0]!.status).toBe('updated')

      // 链接已更新为指向新源
      const linkTarget = await readlink(join(targetDir, basename(newSrc)))
      expect(linkTarget).toBe(newSrc)
    })
  })

  describe('symlink 模式 — directories 类型 (AC: #1)', () => {
    it('创建指向源目录的符号链接', async () => {
      const srcDir = join(tmpDir, 'my-skill-sym')
      await mkdir(srcDir)
      await writeFile(join(srcDir, 'README.md'), '# skill')
      const targetDir = join(tmpDir, 'dir-sym-target')

      const plan = makeDirPlan([srcDir], targetDir)
      plan.items[0]!.mode = 'symlink'

      const result = await executeInstall(plan, makeArgs({ link: true }), reporter, pathResolver)

      expect(result.items).toHaveLength(1)
      expect(result.items[0]!.status).toBe('new')

      // 验证符号链接
      const linkTarget = await readlink(join(targetDir, basename(srcDir)))
      expect(linkTarget).toBe(srcDir)

      // 通过链接可读取目录内容
      const content = await readFile(join(targetDir, basename(srcDir), 'README.md'), 'utf8')
      expect(content).toBe('# skill')
    })
  })

  // ══════════════════════════════════════════════════════════════════════════════
  // Story 4.3 — flatten 模式测试
  // ══════════════════════════════════════════════════════════════════════════════

  describe('flatten 模式 — copy (AC: #3, #4)', () => {
    it('从子目录提取 index.md 并重命名为 dirname.md', async () => {
      // 源结构: skills/code-review/index.md
      const skillsDir = join(tmpDir, 'skills')
      const codeReviewDir = join(skillsDir, 'code-review')
      await mkdir(codeReviewDir, { recursive: true })
      await writeFile(join(codeReviewDir, 'index.md'), '# Code Review Skill')
      await writeFile(join(codeReviewDir, 'examples.md'), '# Examples (should be ignored)')

      const targetDir = join(tmpDir, 'cursor-rules')

      const plan: MatchedPlan = {
        items: [
          {
            rule: {
              tool: 'cursor',
              scope: 'global',
              sourceDir: 'skills',
              type: InstallType.Flatten,
              targetDir: targetDir,
            },
            sourceFiles: [codeReviewDir],
            targetPath: targetDir,
            mode: 'copy',
          },
        ],
      }

      const result = await executeInstall(plan, makeArgs(), reporter, pathResolver)

      expect(result.items).toHaveLength(1)
      expect(result.items[0]!.status).toBe('new')
      expect(result.items[0]!.targetPath).toBe(join(targetDir, 'code-review.md'))

      // 验证文件内容
      const content = await readFile(join(targetDir, 'code-review.md'), 'utf8')
      expect(content).toBe('# Code Review Skill')
    })

    it('多个子目录都被扁平化处理', async () => {
      const skillsDir = join(tmpDir, 'multi-skills')
      const dirs = ['code-review', 'refactor', 'testing']
      for (const d of dirs) {
        await mkdir(join(skillsDir, d), { recursive: true })
        await writeFile(join(skillsDir, d, 'index.md'), `# ${d}`)
      }

      const targetDir = join(tmpDir, 'multi-flatten-target')

      const plan: MatchedPlan = {
        items: [
          {
            rule: {
              tool: 'cursor',
              scope: 'global',
              sourceDir: 'skills',
              type: InstallType.Flatten,
              targetDir: targetDir,
            },
            sourceFiles: dirs.map((d) => join(skillsDir, d)),
            targetPath: targetDir,
            mode: 'copy',
          },
        ],
      }

      const result = await executeInstall(plan, makeArgs(), reporter, pathResolver)

      expect(result.items).toHaveLength(3)
      expect(result.items.map((i) => basename(i.targetPath))).toEqual([
        'code-review.md',
        'refactor.md',
        'testing.md',
      ])
    })

    it('mainFile 不存在时跳过该子目录，reporter.warn 输出警告 (AC: #4)', async () => {
      const skillsDir = join(tmpDir, 'missing-main')
      const emptySkill = join(skillsDir, 'empty-skill')
      await mkdir(emptySkill, { recursive: true })
      // 不创建 index.md

      const targetDir = join(tmpDir, 'missing-main-target')

      const plan: MatchedPlan = {
        items: [
          {
            rule: {
              tool: 'cursor',
              scope: 'global',
              sourceDir: 'skills',
              type: InstallType.Flatten,
              targetDir: targetDir,
            },
            sourceFiles: [emptySkill],
            targetPath: targetDir,
            mode: 'copy',
          },
        ],
      }

      const result = await executeInstall(plan, makeArgs(), reporter, pathResolver)

      expect(result.items).toHaveLength(1)
      expect(result.items[0]!.status).toBe('skipped')

      // 验证 reporter.warn 被调用
      expect(reporter.warn).toHaveBeenCalledWith(expect.stringContaining('empty-skill'))
      expect(reporter.warn).toHaveBeenCalledWith(expect.stringContaining('index.md'))
    })

    it('自定义 mainFile 时使用指定文件名', async () => {
      const skillsDir = join(tmpDir, 'custom-main')
      const skillDir = join(skillsDir, 'my-skill')
      await mkdir(skillDir, { recursive: true })
      await writeFile(join(skillDir, 'README.md'), '# Custom Main')

      const targetDir = join(tmpDir, 'custom-main-target')

      const plan: MatchedPlan = {
        items: [
          {
            rule: {
              tool: 'cursor',
              scope: 'global',
              sourceDir: 'skills',
              type: InstallType.Flatten,
              targetDir: targetDir,
              mainFile: 'README.md',
            },
            sourceFiles: [skillDir],
            targetPath: targetDir,
            mode: 'copy',
          },
        ],
      }

      const result = await executeInstall(plan, makeArgs(), reporter, pathResolver)

      expect(result.items[0]!.status).toBe('new')
      const content = await readFile(join(targetDir, 'my-skill.md'), 'utf8')
      expect(content).toBe('# Custom Main')
    })

    it('flatten + skipped: 已存在且内容相同时不重复复制', async () => {
      const skillsDir = join(tmpDir, 'flat-skip')
      const skillDir = join(skillsDir, 'review')
      await mkdir(skillDir, { recursive: true })
      const sameContent = '# Same Content'
      await writeFile(join(skillDir, 'index.md'), sameContent)

      const targetDir = join(tmpDir, 'flat-skip-target')
      await mkdir(targetDir)
      // 预先放置相同内容的目标文件
      await writeFile(join(targetDir, 'review.md'), sameContent)

      const plan: MatchedPlan = {
        items: [
          {
            rule: {
              tool: 'cursor',
              scope: 'global',
              sourceDir: 'skills',
              type: InstallType.Flatten,
              targetDir: targetDir,
            },
            sourceFiles: [skillDir],
            targetPath: targetDir,
            mode: 'copy',
          },
        ],
      }

      const result = await executeInstall(plan, makeArgs(), reporter, pathResolver)

      expect(result.items[0]!.status).toBe('skipped')
      // skipped 仍是已处理的终态，应推进进度计数
      expect(reporter.updatePhase).toHaveBeenCalledWith('执行安装... (1/1)')
    })
  })

  describe('flatten 模式 — symlink (AC: #1 + #3 combined)', () => {
    it('flatten + symlink: 创建指向 mainFile 的符号链接', async () => {
      const skillsDir = join(tmpDir, 'flat-sym')
      const skillDir = join(skillsDir, 'code-review')
      await mkdir(skillDir, { recursive: true })
      await writeFile(join(skillDir, 'index.md'), '# Flatten Symlink')

      const targetDir = join(tmpDir, 'flat-sym-target')

      const plan: MatchedPlan = {
        items: [
          {
            rule: {
              tool: 'cursor',
              scope: 'global',
              sourceDir: 'skills',
              type: InstallType.Flatten,
              targetDir: targetDir,
            },
            sourceFiles: [skillDir],
            targetPath: targetDir,
            mode: 'symlink',
          },
        ],
      }

      const result = await executeInstall(plan, makeArgs({ link: true }), reporter, pathResolver)

      expect(result.items).toHaveLength(1)
      expect(result.items[0]!.status).toBe('new')

      // 验证符号链接指向 mainFile
      const linkTarget = await readlink(join(targetDir, 'code-review.md'))
      expect(linkTarget).toBe(join(skillDir, 'index.md'))

      // 通过链接读取内容
      const content = await readFile(join(targetDir, 'code-review.md'), 'utf8')
      expect(content).toBe('# Flatten Symlink')
    })
  })

  // ══════════════════════════════════════════════════════════════════════════════
  // 断链检测 — 全流程测试
  // ══════════════════════════════════════════════════════════════════════════════

  describe('断链检测 — 全流程 (AC: #5 / NFR-R6)', () => {
    it('symlink 安装完成后，有效链接不触发 warn', async () => {
      const srcFile = join(tmpDir, 'valid-link.md')
      const targetDir = join(tmpDir, 'valid-link-target')
      await writeFile(srcFile, 'valid')

      const plan = makeFilePlan([srcFile], targetDir)
      plan.items[0]!.mode = 'symlink'

      await executeInstall(plan, makeArgs({ link: true }), reporter, pathResolver)

      // warn 不应被调用（链接有效）
      expect(reporter.warn).not.toHaveBeenCalled()
    })

    it('symlink 指向不存在的源文件时，断链检测输出 warn', async () => {
      // 创建源文件 → 安装 → 删除源文件 → 再次安装（指向被删除文件的新链接）
      // 利用 files 类型 symlink 模式不检查 srcPath 存在性的特点：
      // 先正常安装一次，然后删除源文件，再用不同的路径安装使 status='updated'
      const srcFile = join(tmpDir, 'will-delete.md')
      const targetDir = join(tmpDir, 'broken-check-target')
      await writeFile(srcFile, 'temp')

      // 第一次安装：正常 symlink
      const plan1 = makeFilePlan([srcFile], targetDir)
      plan1.items[0]!.mode = 'symlink'
      await executeInstall(plan1, makeArgs({ link: true }), reporter, pathResolver)

      // 删除源文件
      await rm(srcFile)

      // 重置 reporter mock
      ;(reporter.warn as ReturnType<typeof vi.fn>).mockClear()

      // 第二次安装：用一个不存在的新源文件路径，先创建临时文件使 determineSymlinkStatus
      // 返回 'updated'（旧链接指向 srcFile，新链接指向 newNonexistent）
      const newNonexistentSrc = join(tmpDir, 'nonexistent-src.md')
      // 不创建 newNonexistentSrc 文件——createSymlink 不检查 target 存在性
      // 但需要确保旧 symlink 存在，readlink 返回旧的 srcFile → srcPath != srcFile → 'updated'
      // 且 createSymlink 创建新链接指向不存在的 newNonexistentSrc → broken link

      const destPath = join(targetDir, basename(newNonexistentSrc))
      // 手动创建旧 symlink（指向 tmpDir 内某个路径以通过安全校验）
      const oldSrcForLink = join(tmpDir, 'old-for-broken.md')
      await writeFile(oldSrcForLink, 'old')
      await symlink(oldSrcForLink, destPath)

      const plan2 = makeFilePlan([newNonexistentSrc], targetDir)
      plan2.items[0]!.mode = 'symlink'

      // createSymlink 会成功（不检查 target 存在性），断链检测应触发 warn
      await executeInstall(plan2, makeArgs({ link: true }), reporter, pathResolver)

      expect(reporter.warn).toHaveBeenCalledWith(expect.stringContaining('断链'))
    })

    it('既有 symlink 断链后重装：应输出断链 warn 而非 fatal（AC #5 复检场景）', async () => {
      // 场景：symlink 安装成功 → 删除源文件 → 再次执行相同 plan 安装
      // 预期：不抛 PATH_TRAVERSAL fatal，且断链检测输出 warn
      const srcFile = join(tmpDir, 'will-break.md')
      const targetDir = join(tmpDir, 'break-reinstall-target')
      await writeFile(srcFile, 'original')

      const plan = makeFilePlan([srcFile], targetDir)
      plan.items[0]!.mode = 'symlink'

      // 第一次安装：正常 symlink
      await executeInstall(plan, makeArgs({ link: true }), reporter, pathResolver)
      expect(reporter.warn).not.toHaveBeenCalled()

      // 删除源文件，使 symlink 变成 broken
      await rm(srcFile)

      // 重置 reporter mock
      ;(reporter.warn as ReturnType<typeof vi.fn>).mockClear()

      // 第二次安装：相同 plan，destPath 已有 broken symlink 指向已删除的 srcFile
      // validateDestPathSecurity 应允许通过（目标路径在 allowedRoot 内）
      // determineSymlinkStatus 返回 'skipped'（readlink 目标路径字符串未变）
      // checkBrokenLinks 应检测到断链并输出 warn
      await executeInstall(plan, makeArgs({ link: true }), reporter, pathResolver)

      expect(reporter.warn).toHaveBeenCalledWith(expect.stringContaining('断链'))
    })

    it('skipped 状态的 symlink 断链告警：同路径同目标但目标不存在时应 warn', async () => {
      // 场景：构造一个 skipped 状态（同路径同目标）但目标文件不存在的 symlink
      const srcFile = join(tmpDir, 'skipped-broken-src.md')
      const targetDir = join(tmpDir, 'skipped-broken-target')
      await writeFile(srcFile, 'content')

      const plan = makeFilePlan([srcFile], targetDir)
      plan.items[0]!.mode = 'symlink'

      // 第一次安装：创建有效 symlink
      await executeInstall(plan, makeArgs({ link: true }), reporter, pathResolver)
      expect(reporter.warn).not.toHaveBeenCalled()

      // 删除源文件使链接断裂
      await rm(srcFile)
      ;(reporter.warn as ReturnType<typeof vi.fn>).mockClear()

      // 第二次安装：readlink 返回的目标 === srcPath → status='skipped'
      // 但源文件已不存在 → 断链检测应输出 warn
      await executeInstall(plan, makeArgs({ link: true }), reporter, pathResolver)

      // 验证：skipped 状态也应参与断链检测
      // 注意：零结果诊断（Story 4.5）也会输出 warn，所以不精确检查调用次数
      expect(reporter.warn).toHaveBeenCalledWith(expect.stringContaining('断链'))
    })

    it('copy 模式不触发断链检测', async () => {
      const srcFile = join(tmpDir, 'copy-no-check.md')
      const targetDir = join(tmpDir, 'copy-no-check-target')
      await writeFile(srcFile, 'copy')

      const plan = makeFilePlan([srcFile], targetDir)
      // mode 默认 'copy'

      await executeInstall(plan, makeArgs(), reporter, pathResolver)

      expect(reporter.warn).not.toHaveBeenCalled()
    })
  })

  // ══════════════════════════════════════════════════════════════════════════════
  // Story 4.5 — 冲突处理集成测试
  // ══════════════════════════════════════════════════════════════════════════════

  describe('冲突处理集成 — user-file 冲突 (AC: #1, #2)', () => {
    /**
     * 构建 manifestContext：目标文件不在 manifest（user-file 冲突）
     */
    function makeUserFileConflictContext(): ManifestContext {
      return { entries: [], degraded: false }
    }

    beforeEach(() => {
      conflictMocks.handleConflict.mockReset()
    })

    it('user-file 冲突 + 用户选择 "备份后覆盖" → 备份文件存在 + 新文件被安装', async () => {
      const srcFile = join(tmpDir, 'conflict-src.md')
      const targetDir = join(tmpDir, 'conflict-target')
      await mkdir(targetDir)
      await writeFile(srcFile, 'new content from repo')
      // 预先放置用户手写文件
      const destFile = join(targetDir, basename(srcFile))
      await writeFile(destFile, 'user custom content')

      // handleConflict 返回 'backup'
      conflictMocks.handleConflict.mockResolvedValueOnce('backup')

      const plan = makeFilePlan([srcFile], targetDir)
      const ctx = makeUserFileConflictContext()

      const result = await executeInstall(plan, makeArgs(), reporter, pathResolver, ctx)

      // handleConflict 被调用
      expect(conflictMocks.handleConflict).toHaveBeenCalledOnce()
      // 文件被安装（覆盖）
      expect(result.items).toHaveLength(1)
      expect(result.items[0]!.status).toBe('updated')
      const installed = await readFile(destFile, 'utf8')
      expect(installed).toBe('new content from repo')
      // 备份文件存在（backupFile 由 processConflict 调用）
      // 备份文件命名: {file}.aiforge-backup-YYYYMMDD
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const backupPath = `${destFile}.aiforge-backup-${today}`
      const backupContent = await readFile(backupPath, 'utf8')
      expect(backupContent).toBe('user custom content')
    })

    it('user-file 冲突 + 用户选择 "跳过" → 文件不被覆盖，status: skipped', async () => {
      const srcFile = join(tmpDir, 'skip-conflict-src.md')
      const targetDir = join(tmpDir, 'skip-conflict-target')
      await mkdir(targetDir)
      await writeFile(srcFile, 'new content')
      const destFile = join(targetDir, basename(srcFile))
      await writeFile(destFile, 'user content preserved')

      conflictMocks.handleConflict.mockResolvedValueOnce('skip')

      const plan = makeFilePlan([srcFile], targetDir)
      const ctx = makeUserFileConflictContext()

      const result = await executeInstall(plan, makeArgs(), reporter, pathResolver, ctx)

      expect(result.items).toHaveLength(1)
      expect(result.items[0]!.status).toBe('skipped')
      // 用户文件未被覆盖
      const content = await readFile(destFile, 'utf8')
      expect(content).toBe('user content preserved')
    })

    it('user-file 冲突 + 用户选择 "直接覆盖" → 文件被覆盖，无备份', async () => {
      const srcFile = join(tmpDir, 'overwrite-src.md')
      const targetDir = join(tmpDir, 'overwrite-target')
      await mkdir(targetDir)
      await writeFile(srcFile, 'overwrite content')
      const destFile = join(targetDir, basename(srcFile))
      await writeFile(destFile, 'original user content')

      conflictMocks.handleConflict.mockResolvedValueOnce('overwrite')

      const plan = makeFilePlan([srcFile], targetDir)
      const ctx = makeUserFileConflictContext()

      const result = await executeInstall(plan, makeArgs(), reporter, pathResolver, ctx)

      expect(result.items).toHaveLength(1)
      expect(result.items[0]!.status).toBe('updated')
      const installed = await readFile(destFile, 'utf8')
      expect(installed).toBe('overwrite content')
    })
  })

  describe('冲突处理 — --force 模式 (AC: #3)', () => {
    beforeEach(() => {
      conflictMocks.handleConflict.mockReset()
    })

    it('--force + user-file 冲突 → 跳过交互，直接覆盖', async () => {
      const srcFile = join(tmpDir, 'force-src.md')
      const targetDir = join(tmpDir, 'force-target')
      await mkdir(targetDir)
      await writeFile(srcFile, 'force install content')
      const destFile = join(targetDir, basename(srcFile))
      await writeFile(destFile, 'user file')

      // handleConflict 在 force=true 时应返回 'overwrite'
      conflictMocks.handleConflict.mockResolvedValueOnce('overwrite')

      const plan = makeFilePlan([srcFile], targetDir)
      const ctx: ManifestContext = { entries: [], degraded: false }

      const result = await executeInstall(
        plan,
        makeArgs({ force: true }),
        reporter,
        pathResolver,
        ctx,
      )

      // handleConflict 被调用（force 参数由 processConflict 传递）
      expect(conflictMocks.handleConflict).toHaveBeenCalledWith(
        destFile,
        srcFile,
        true, // force = true
        reporter,
      )
      expect(result.items[0]!.status).toBe('updated')
    })
  })

  describe('冲突处理 — aiforge-current 自动跳过 (AC: #1)', () => {
    it('aiforge-current 冲突类型 → 自动 skipped，不调用 handleConflict', async () => {
      const srcFile = join(tmpDir, 'current-src.md')
      const targetDir = join(tmpDir, 'current-target')
      await mkdir(targetDir)
      const sameContent = 'identical managed content'
      await writeFile(srcFile, sameContent)
      const destFile = join(targetDir, basename(srcFile))
      await writeFile(destFile, sameContent)

      conflictMocks.handleConflict.mockReset()

      // manifest 包含该文件且 hash 匹配（aiforge-current）
      const { fileHash } = await import('../../src/services/fs-utils.js')
      const hash = await fileHash(srcFile)
      const ctx: ManifestContext = {
        entries: [
          {
            source: 'agents/current-src.md',
            target: destFile,
            tool: 'claude',
            scope: 'global',
            mode: 'copy',
            hash,
            installedAt: new Date().toISOString(),
          },
        ],
        degraded: false,
      }

      const plan = makeFilePlan([srcFile], targetDir)
      const result = await executeInstall(plan, makeArgs(), reporter, pathResolver, ctx)

      expect(result.items).toHaveLength(1)
      expect(result.items[0]!.status).toBe('skipped')
      // handleConflict 不应被调用（aiforge-current 自动跳过）
      expect(conflictMocks.handleConflict).not.toHaveBeenCalled()
    })
  })

  describe('冲突处理 — aiforge-outdated 直接更新 (AC: #1)', () => {
    it('aiforge-outdated 冲突类型 → 直接更新，不调用 handleConflict', async () => {
      const srcFile = join(tmpDir, 'outdated-src.md')
      const targetDir = join(tmpDir, 'outdated-target')
      await mkdir(targetDir)
      await writeFile(srcFile, 'updated content from repo')
      const destFile = join(targetDir, basename(srcFile))
      await writeFile(destFile, 'old managed content')

      conflictMocks.handleConflict.mockReset()

      // manifest 包含该文件，目标 hash 匹配 manifest（用户没改），源 hash 不匹配（源有更新）
      const { fileHash } = await import('../../src/services/fs-utils.js')
      const destHash = await fileHash(destFile)
      const ctx: ManifestContext = {
        entries: [
          {
            source: 'agents/outdated-src.md',
            target: destFile,
            tool: 'claude',
            scope: 'global',
            mode: 'copy',
            hash: destHash, // manifest hash 匹配目标当前 hash
            installedAt: new Date().toISOString(),
          },
        ],
        degraded: false,
      }

      const plan = makeFilePlan([srcFile], targetDir)
      const result = await executeInstall(plan, makeArgs(), reporter, pathResolver, ctx)

      expect(result.items).toHaveLength(1)
      expect(result.items[0]!.status).toBe('updated')
      // handleConflict 不应被调用（aiforge-outdated 直接更新）
      expect(conflictMocks.handleConflict).not.toHaveBeenCalled()
      // 文件实际被更新
      const content = await readFile(destFile, 'utf8')
      expect(content).toBe('updated content from repo')
    })
  })

  // ══════════════════════════════════════════════════════════════════════════════
  // Story 4.5 — 零结果诊断 (AC: #5)
  // ══════════════════════════════════════════════════════════════════════════════

  describe('零结果诊断 (AC: #5 / FR-032)', () => {
    it('全部文件 skipped → 输出成功态摘要，不触发零结果诊断 warn', async () => {
      const srcFile = join(tmpDir, 'zero-diag-src.md')
      const targetDir = join(tmpDir, 'zero-diag-target')
      await mkdir(targetDir)
      const sameContent = 'identical'
      await writeFile(srcFile, sameContent)
      await writeFile(join(targetDir, basename(srcFile)), sameContent)

      const plan = makeFilePlan([srcFile], targetDir)
      await executeInstall(plan, makeArgs(), reporter, pathResolver)

      expect(reporter.completePhase).toHaveBeenCalledWith(
        '执行安装... 没有新增/更新文件，全部已是最新或被跳过',
      )
      expect(reporter.warn).not.toHaveBeenCalledWith(expect.stringContaining('未安装任何文件'))
      expect(reporter.warn).not.toHaveBeenCalledWith(expect.stringContaining('--force'))
    })

    it('有文件被安装（new/updated）→ 不触发零结果诊断', async () => {
      const srcFile = join(tmpDir, 'has-install-src.md')
      const targetDir = join(tmpDir, 'has-install-target')
      await writeFile(srcFile, 'new content')

      const plan = makeFilePlan([srcFile], targetDir)
      await executeInstall(plan, makeArgs(), reporter, pathResolver)

      // warn 不应包含零结果诊断
      const warnCalls = (reporter.warn as ReturnType<typeof vi.fn>).mock.calls.map(
        (c: unknown[]) => c[0],
      )
      const hasZeroDiag = warnCalls.some(
        (msg: string) => typeof msg === 'string' && msg.includes('未安装任何文件'),
      )
      expect(hasZeroDiag).toBe(false)
    })

    it('空计划 → 触发零结果诊断', async () => {
      const emptyPlan: MatchedPlan = {
        items: [
          {
            rule: {
              tool: 'claude',
              scope: 'global',
              sourceDir: 'agents',
              type: InstallType.Files,
              targetDir: join(tmpDir, 'empty-plan-target'),
            },
            sourceFiles: [],
            targetPath: join(tmpDir, 'empty-plan-target'),
            mode: 'copy',
          },
        ],
      }

      await executeInstall(emptyPlan, makeArgs(), reporter, pathResolver)

      // 零结果诊断应触发（空 sourceFiles 静默跳过 → 无任何结果）
      expect(reporter.warn).toHaveBeenCalledWith(expect.stringContaining('未安装任何文件'))
      expect(reporter.warn).toHaveBeenCalledWith(
        expect.stringContaining('未发现匹配当前条件的可安装文件'),
      )
      expect(reporter.warn).toHaveBeenCalledWith(
        expect.stringContaining('如果你预期本次应有更新，可尝试：'),
      )
      expect(reporter.warn).toHaveBeenCalledWith(
        expect.stringContaining('--dirs / --filter / --tools 条件是否过窄'),
      )
      expect(reporter.warn).not.toHaveBeenCalledWith(expect.stringContaining('--force'))
    })

    it('长列表 true-zero 诊断会摘要化扫描目录和匹配规则，避免刷屏', async () => {
      const longPlan: MatchedPlan = {
        items: Array.from({ length: 7 }, (_, index) => ({
          rule: {
            tool: `tool-${index + 1}`,
            scope: 'global' as const,
            sourceDir: `dir-${index + 1}`,
            type: InstallType.Files,
            targetDir: join(tmpDir, `long-zero-target-${index + 1}`),
          },
          sourceFiles: [],
          targetPath: join(tmpDir, `long-zero-target-${index + 1}`),
          mode: 'copy' as const,
        })),
      }

      await executeInstall(longPlan, makeArgs(), reporter, pathResolver)

      const warnCalls = (reporter.warn as ReturnType<typeof vi.fn>).mock.calls.map(
        (c: unknown[]) => c[0] as string,
      )
      const scannedDirsLine = warnCalls.find((line) => line.includes('扫描目录:')) ?? ''
      const matchedRulesLine = warnCalls.find((line) => line.includes('匹配规则:')) ?? ''

      expect(scannedDirsLine).toContain('dir-1, dir-2, dir-3, dir-4, dir-5')
      expect(scannedDirsLine).toContain('其余 2 项已折叠')
      expect(scannedDirsLine).not.toContain('dir-6')

      expect(matchedRulesLine).toContain('tool-1:global, tool-2:global, tool-3:global')
      expect(matchedRulesLine).toContain('其余 2 项已折叠')
      expect(matchedRulesLine).not.toContain('tool-6:global')
    })

    it('true-zero TTY 输出快照保持长列表摘要和 warning 间距', async () => {
      const ttyReporter = createReporter({ quiet: false, isTty: true })
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
      const origLevel = chalk.level
      const longPlan: MatchedPlan = {
        items: Array.from({ length: 7 }, (_, index) => ({
          rule: {
            tool: `tool-${index + 1}`,
            scope: 'global' as const,
            sourceDir: `dir-${index + 1}`,
            type: InstallType.Files,
            targetDir: join(tmpDir, `tty-zero-target-${index + 1}`),
          },
          sourceFiles: [],
          targetPath: join(tmpDir, `tty-zero-target-${index + 1}`),
          mode: 'copy' as const,
        })),
      }

      chalk.level = 0
      try {
        await executeInstall(longPlan, makeArgs(), ttyReporter, pathResolver)
        const fullOutput = stderrSpy.mock.calls
          .map((c) => c[0] as string)
          .join('')
          .replace(/\r/g, '')
        const diagnosticOutput = fullOutput.slice(fullOutput.indexOf('⚠️ 未安装任何文件'))

        expect(diagnosticOutput).toMatchInlineSnapshot(`
"⚠️ 未安装任何文件

⚠ 诊断信息：
⚠   扫描目录: dir-1, dir-2, dir-3, dir-4, dir-5, ... 其余 2 项已折叠
⚠   匹配规则: tool-1:global, tool-2:global, tool-3:global, tool-4:global, tool-5:global, ... 其余 2 项已折叠 (7 条)
⚠   未发现匹配当前条件的可安装文件

⚠ 如果你预期本次应有更新，可尝试：
⚠   1. 检查 --dirs / --filter / --tools 条件是否过窄
⚠   2. 检查知识仓库中所选目录是否包含可安装文件
✔ 执行安装...
"
`)
      } finally {
        chalk.level = origLevel
        stderrSpy.mockRestore()
      }
    })

    it('匹配到空目录 → 输出空目录诊断，不建议使用 --force', async () => {
      const sourceDir = join(tmpDir, 'zero-diag-empty-dir')
      const targetDir = join(tmpDir, 'zero-diag-empty-dir-target')
      await mkdir(sourceDir)

      const plan: MatchedPlan = {
        items: [
          {
            rule: {
              tool: 'claude',
              scope: 'global',
              sourceDir: 'skills',
              type: InstallType.Directories,
              targetDir: targetDir,
            },
            sourceFiles: [sourceDir],
            targetPath: targetDir,
            mode: 'copy',
          },
        ],
      }

      await executeInstall(plan, makeArgs(), reporter, pathResolver)

      expect(reporter.warn).toHaveBeenCalledWith(expect.stringContaining('未安装任何文件'))
      expect(reporter.warn).toHaveBeenCalledWith(
        expect.stringContaining('匹配到的目录中未发现实际文件'),
      )
      expect(reporter.warn).toHaveBeenCalledWith(
        expect.stringContaining('检查知识仓库中的目标目录是否为空'),
      )
      expect(reporter.warn).not.toHaveBeenCalledWith(expect.stringContaining('--force'))
    })
  })

  // ══════════════════════════════════════════════════════════════════════════════
  // CR Round-1 修复 — Directories 冲突检测集成测试
  // ══════════════════════════════════════════════════════════════════════════════

  describe('Directories 冲突检测集成 (CR Round-1 修复)', () => {
    beforeEach(() => {
      conflictMocks.handleConflict.mockReset()
    })

    it('Directories copy + 目标目录有用户文件 → 安装新文件，用户文件保留', async () => {
      const srcDir = join(tmpDir, 'dir-conflict-src')
      await mkdir(srcDir)
      await writeFile(join(srcDir, 'README.md'), '# from repo')
      const targetDir = join(tmpDir, 'dir-conflict-target')
      // 预先放置用户手写目录
      const destDir = join(targetDir, basename(srcDir))
      await mkdir(destDir, { recursive: true })
      await writeFile(join(destDir, 'custom.md'), 'user custom content')

      const plan = makeDirPlan([srcDir], targetDir)
      const ctx: ManifestContext = { entries: [], degraded: false }

      const result = await executeInstall(plan, makeArgs(), reporter, pathResolver, ctx)

      // copy 模式不做目录级冲突检测：文件级 hash 比对，README.md 是 'new'，用户文件保留
      expect(conflictMocks.handleConflict).not.toHaveBeenCalled()
      expect(result.items).toHaveLength(1)
      expect(result.items[0]!.status).toBe('new')
      // 用户文件未被删除
      const content = await readFile(join(destDir, 'custom.md'), 'utf8')
      expect(content).toBe('user custom content')
    })

    it('Directories copy + 目标目录有旧文件 → 只复制 src 中的文件', async () => {
      const srcDir = join(tmpDir, 'dir-overwrite-src')
      await mkdir(srcDir)
      await writeFile(join(srcDir, 'README.md'), '# from repo')
      const targetDir = join(tmpDir, 'dir-overwrite-target')
      const destDir = join(targetDir, basename(srcDir))
      await mkdir(destDir, { recursive: true })
      await writeFile(join(destDir, 'old.md'), 'old content')

      const plan = makeDirPlan([srcDir], targetDir)
      const ctx: ManifestContext = { entries: [], degraded: false }

      const result = await executeInstall(plan, makeArgs(), reporter, pathResolver, ctx)

      // copy 模式不做目录级冲突检测，直接按文件级 hash 安装
      expect(conflictMocks.handleConflict).not.toHaveBeenCalled()
      expect(result.items).toHaveLength(1)
      // destDir 中无 README.md，所以为 'new'
      expect(result.items[0]!.status).toBe('new')
      const content = await readFile(join(destDir, 'README.md'), 'utf8')
      expect(content).toBe('# from repo')
    })

    it('Directories copy + 目标目录有用户文件 + ctx → 文件级安装，无目录备份', async () => {
      const srcDir = join(tmpDir, 'dir-backup-src')
      await mkdir(srcDir)
      await writeFile(join(srcDir, 'README.md'), '# from repo')
      const targetDir = join(tmpDir, 'dir-backup-target')
      const destDir = join(targetDir, basename(srcDir))
      await mkdir(destDir, { recursive: true })
      await writeFile(join(destDir, 'custom.md'), 'user custom skill')

      const plan = makeDirPlan([srcDir], targetDir)
      const ctx: ManifestContext = { entries: [], degraded: false }

      const result = await executeInstall(plan, makeArgs(), reporter, pathResolver, ctx)

      // copy 模式不做目录级冲突检测，无备份行为
      expect(conflictMocks.handleConflict).not.toHaveBeenCalled()
      // src 中的 README.md 被安装为 'new'
      expect(result.items).toHaveLength(1)
      expect(result.items[0]!.status).toBe('new')
      const installed = await readFile(join(destDir, 'README.md'), 'utf8')
      expect(installed).toBe('# from repo')
      // 用户文件被保留（非 src 中的文件不被删除）
      const userFile = await readFile(join(destDir, 'custom.md'), 'utf8')
      expect(userFile).toBe('user custom skill')
      // 无备份目录
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const backupPath = `${destDir}.aiforge-backup-${today}`
      await expect(access(backupPath)).rejects.toThrow()
    })

    it('Directories copy + --force + 目标目录有用户文件 → 文件级安装，忽略 force 标志', async () => {
      const srcDir = join(tmpDir, 'dir-force-src')
      await mkdir(srcDir)
      await writeFile(join(srcDir, 'README.md'), '# force')
      const targetDir = join(tmpDir, 'dir-force-target')
      const destDir = join(targetDir, basename(srcDir))
      await mkdir(destDir, { recursive: true })
      await writeFile(join(destDir, 'user.md'), 'user content')

      const plan = makeDirPlan([srcDir], targetDir)
      const ctx: ManifestContext = { entries: [], degraded: false }

      const result = await executeInstall(
        plan,
        makeArgs({ force: true }),
        reporter,
        pathResolver,
        ctx,
      )

      // copy 模式不做目录级冲突检测，--force 无额外效果
      expect(conflictMocks.handleConflict).not.toHaveBeenCalled()
      // destDir 中不存在 README.md（只有 user.md），所以 README.md 是 'new'
      expect(result.items[0]!.status).toBe('new')
    })

    it('Directories copy + 目录不存在（无冲突）→ 正常安装', async () => {
      const srcDir = join(tmpDir, 'dir-no-conflict-src')
      await mkdir(srcDir)
      await writeFile(join(srcDir, 'README.md'), '# new skill')
      const targetDir = join(tmpDir, 'dir-no-conflict-target')

      const plan = makeDirPlan([srcDir], targetDir)
      const ctx: ManifestContext = { entries: [], degraded: false }

      const result = await executeInstall(plan, makeArgs(), reporter, pathResolver, ctx)

      expect(conflictMocks.handleConflict).not.toHaveBeenCalled()
      expect(result.items).toHaveLength(1)
      expect(result.items[0]!.status).toBe('new')
    })

    it('Directories copy + 无 manifestContext → 跳过冲突检测（向后兼容）', async () => {
      const srcDir = join(tmpDir, 'dir-nocontext-src')
      await mkdir(srcDir)
      await writeFile(join(srcDir, 'README.md'), '# backward compat')
      const targetDir = join(tmpDir, 'dir-nocontext-target')
      const destDir = join(targetDir, basename(srcDir))
      await mkdir(destDir, { recursive: true })

      const plan = makeDirPlan([srcDir], targetDir)
      // 不传 manifestContext
      const result = await executeInstall(plan, makeArgs(), reporter, pathResolver)

      expect(conflictMocks.handleConflict).not.toHaveBeenCalled()
      // 文件级 hash：destDir 存在但 README.md 不在其中，所以是 'new'
      expect(result.items[0]!.status).toBe('new')
    })

    it('Directories symlink + 目标目录不存在 → 无冲突，正常创建 symlink', async () => {
      const srcDir = join(tmpDir, 'dir-sym-noconflict-src')
      await mkdir(srcDir)
      await writeFile(join(srcDir, 'README.md'), '# sym')
      const targetDir = join(tmpDir, 'dir-sym-noconflict-target')

      const plan = makeDirPlan([srcDir], targetDir)
      plan.items[0]!.mode = 'symlink'
      const ctx: ManifestContext = { entries: [], degraded: false }

      const result = await executeInstall(
        plan,
        makeArgs({ link: true }),
        reporter,
        pathResolver,
        ctx,
      )

      // 目标不存在 → checkDirConflict 返回 'none' → 正常安装
      expect(conflictMocks.handleConflict).not.toHaveBeenCalled()
      expect(result.items[0]!.status).toBe('new')
    })
  })

  // ══════════════════════════════════════════════════════════════════════════════
  // Story 4.5 — 临时文件说明 (AC: #6)
  // ══════════════════════════════════════════════════════════════════════════════

  describe('临时文件自清理说明 (AC: #6 / NFR-S6)', () => {
    it('安装成功后 completePhase 正常调用', async () => {
      const srcFile = join(tmpDir, 'cleanup-src.md')
      const targetDir = join(tmpDir, 'cleanup-target')
      await writeFile(srcFile, 'cleanup test')

      const plan = makeFilePlan([srcFile], targetDir)
      await executeInstall(plan, makeArgs(), reporter, pathResolver)

      expect(reporter.completePhase).toHaveBeenCalledOnce()
    })

    it('安装异常时 completePhase 不被调用（异常向上透传）', async () => {
      const nonExistentSrc = join(tmpDir, 'cleanup-nonexist.md')
      const targetDir = join(tmpDir, 'cleanup-fail-target')

      const plan = makeFilePlan([nonExistentSrc], targetDir)

      await expect(executeInstall(plan, makeArgs(), reporter, pathResolver)).rejects.toThrow(
        AiforgeError,
      )
      expect(reporter.completePhase).not.toHaveBeenCalled()
    })
  })
})

// ── Story 5.1: 进度计数格式测试 ──────────────────────────────────────────────

describe('Story 5.1 — Phase progress count format', () => {
  let tmpDir: string
  let reporter: Reporter
  let pathResolver: PathResolver

  beforeEach(async () => {
    tmpDir = await makeTmpDir()
    reporter = makeReporter()
    pathResolver = makePathResolver(tmpDir)
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('updatePhase 调用时包含 (当前/总数) 计数格式 (AC #2)', async () => {
    // 创建 3 个源文件
    const srcFiles = await Promise.all(
      ['file1.md', 'file2.md', 'file3.md'].map(async (name) => {
        const p = join(tmpDir, name)
        await writeFile(p, `content ${name}`)
        return p
      }),
    )
    const targetDir = join(tmpDir, 'progress-count-target')
    await mkdir(targetDir, { recursive: true })

    const plan: MatchedPlan = {
      items: [
        {
          rule: {
            tool: 'claude',
            scope: 'global',
            sourceDir: 'agents',
            type: InstallType.Files,
            targetDir: targetDir,
          },
          mode: 'copy',
          sourceFiles: srcFiles,
          targetPath: targetDir,
        },
      ],
    }

    await executeInstall(plan, makeArgs(), reporter, pathResolver)

    const updateCalls = (reporter.updatePhase as ReturnType<typeof vi.fn>).mock.calls
    // 3 个文件应有 3 次 updatePhase 调用
    expect(updateCalls.length).toBe(3)
    // 每次调用的参数应包含 (n/3) 格式的计数
    expect(updateCalls[0][0]).toContain('(1/3)')
    expect(updateCalls[1][0]).toContain('(2/3)')
    expect(updateCalls[2][0]).toContain('(3/3)')
  })

  it('单文件时 updatePhase 调用包含 (1/1) 计数 (AC #2)', async () => {
    const src = join(tmpDir, 'single.md')
    await writeFile(src, 'single content')
    const targetDir = join(tmpDir, 'single-count-target')
    await mkdir(targetDir, { recursive: true })

    const plan: MatchedPlan = {
      items: [
        {
          rule: {
            tool: 'claude',
            scope: 'global',
            sourceDir: 'agents',
            type: InstallType.Files,
            targetDir: targetDir,
          },
          mode: 'copy',
          sourceFiles: [src],
          targetPath: targetDir,
        },
      ],
    }

    await executeInstall(plan, makeArgs(), reporter, pathResolver)

    const updateCalls = (reporter.updatePhase as ReturnType<typeof vi.fn>).mock.calls
    expect(updateCalls.length).toBe(1)
    expect(updateCalls[0][0]).toContain('(1/1)')
  })

  it('进度计数文本格式为 "执行安装... (n/total)" (AC #2)', async () => {
    const srcFiles = await Promise.all(
      ['a.md', 'b.md'].map(async (name) => {
        const p = join(tmpDir, name)
        await writeFile(p, `content ${name}`)
        return p
      }),
    )
    const targetDir = join(tmpDir, 'format-target')
    await mkdir(targetDir, { recursive: true })

    const plan: MatchedPlan = {
      items: [
        {
          rule: {
            tool: 'claude',
            scope: 'global',
            sourceDir: 'agents',
            type: InstallType.Files,
            targetDir: targetDir,
          },
          mode: 'copy',
          sourceFiles: srcFiles,
          targetPath: targetDir,
        },
      ],
    }

    await executeInstall(plan, makeArgs(), reporter, pathResolver)

    const updateCalls = (reporter.updatePhase as ReturnType<typeof vi.fn>).mock.calls
    // 格式验证：包含阶段名 + 计数
    expect(updateCalls[0][0]).toMatch(/执行安装.*\(1\/2\)/)
    expect(updateCalls[1][0]).toMatch(/执行安装.*\(2\/2\)/)
  })
})

// ── 英文场景测试（Story 5-5a CR Round-3 P2 补充）──────────────────────────────

describe('executeInstall — English language mode (zero results diagnostics)', () => {
  let tmpDir: string
  let reporter: Reporter

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'aiforge-en-test-'))
    reporter = {
      startPhase: vi.fn(),
      updatePhase: vi.fn(),
      completePhase: vi.fn(),
      reportResult: vi.fn(),
      reportPlan: vi.fn(),
      reportError: vi.fn(),
      warn: vi.fn(),
    }
    setLanguage('en')
  })

  afterEach(async () => {
    setLanguage('zh-CN')
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('skipped-only summary is in English when language=en', async () => {
    const srcFile = join(tmpDir, 'en-zero-src.md')
    const targetDir = join(tmpDir, 'en-zero-target')
    await mkdir(targetDir)
    const sameContent = 'identical'
    await writeFile(srcFile, sameContent)
    await writeFile(join(targetDir, basename(srcFile)), sameContent)

    const plan: MatchedPlan = {
      items: [
        {
          rule: {
            tool: 'claude',
            scope: 'global',
            sourceDir: 'agents',
            type: InstallType.Files,
            targetDir: targetDir,
          },
          mode: 'copy',
          sourceFiles: [srcFile],
          targetPath: targetDir,
        },
      ],
    }

    const pathResolver = { home: () => tmpDir, reposDir: () => join(tmpDir, 'repos') }
    await executeInstall(plan, { force: false } as ParsedArgs, reporter, pathResolver as never)

    expect(reporter.completePhase).toHaveBeenCalledWith(
      'Executing install... No new or updated files; all items are already up-to-date or skipped',
    )
    expect(reporter.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('No files were installed'),
    )
  })

  it('true zero-result diagnostics are in English when language=en', async () => {
    const targetDir = join(tmpDir, 'en-zero-empty-target')

    const plan: MatchedPlan = {
      items: [
        {
          rule: {
            tool: 'claude',
            scope: 'global',
            sourceDir: 'agents',
            type: InstallType.Files,
            targetDir: targetDir,
          },
          mode: 'copy',
          sourceFiles: [],
          targetPath: targetDir,
        },
      ],
    }

    const pathResolver = { home: () => tmpDir, reposDir: () => join(tmpDir, 'repos') }
    await executeInstall(plan, { force: false } as ParsedArgs, reporter, pathResolver as never)

    expect(reporter.warn).toHaveBeenCalledWith(expect.stringContaining('No files were installed'))
    expect(reporter.warn).toHaveBeenCalledWith(
      expect.stringContaining('No installable files matched the current selection'),
    )
    expect(reporter.warn).toHaveBeenCalledWith(
      expect.stringContaining('If you expected updates in this run, you can try:'),
    )
    expect(reporter.warn).toHaveBeenCalledWith(
      expect.stringContaining('Check whether --dirs / --filter / --tools is too restrictive'),
    )
    expect(reporter.warn).not.toHaveBeenCalledWith(expect.stringContaining('--force'))
  })

  it('broken link warn is in English when language=en', async () => {
    const srcFile = join(tmpDir, 'en-broken-src.md')
    const targetDir = join(tmpDir, 'en-broken-target')
    await writeFile(srcFile, 'link target')

    const plan: MatchedPlan = {
      items: [
        {
          rule: {
            tool: 'claude',
            scope: 'global',
            sourceDir: 'agents',
            type: InstallType.Files,
            targetDir: targetDir,
          },
          mode: 'symlink',
          sourceFiles: [srcFile],
          targetPath: targetDir,
        },
      ],
    }

    const pathResolver = { home: () => tmpDir, reposDir: () => join(tmpDir, 'repos') }
    // 安装 symlink（srcFile 存在）
    await executeInstall(
      plan,
      { force: false, link: true } as ParsedArgs,
      reporter,
      pathResolver as never,
    )
    // 删除源文件使链接断裂
    await rm(srcFile)
    ;(reporter.warn as ReturnType<typeof vi.fn>).mockClear()

    // 再次安装（此时源文件不存在，断链检测应触发 English warn）
    const nonexistent = join(tmpDir, 'nonexistent-en.md')
    const plan2: MatchedPlan = {
      items: [
        {
          rule: plan.items[0]!.rule,
          mode: 'symlink',
          sourceFiles: [nonexistent],
          targetPath: targetDir,
        },
      ],
    }
    await executeInstall(
      plan2,
      { force: false, link: true } as ParsedArgs,
      reporter,
      pathResolver as never,
    )

    expect(reporter.warn).toHaveBeenCalledWith(expect.stringContaining('Broken link'))
  })

  it('flatten missing mainFile warn is in English when language=en', async () => {
    const skillsDir = join(tmpDir, 'en-flatten-missing')
    const emptySkill = join(skillsDir, 'en-empty-skill')
    await mkdir(emptySkill, { recursive: true })
    // 不创建 index.md

    const targetDir = join(tmpDir, 'en-flatten-missing-target')
    const pathResolver = { home: () => tmpDir, reposDir: () => join(tmpDir, 'repos') }

    const plan: MatchedPlan = {
      items: [
        {
          rule: {
            tool: 'cursor',
            scope: 'global',
            sourceDir: 'skills',
            type: InstallType.Flatten,
            targetDir: targetDir,
          },
          sourceFiles: [emptySkill],
          targetPath: targetDir,
          mode: 'copy',
        },
      ],
    }

    await executeInstall(plan, { force: false } as ParsedArgs, reporter, pathResolver as never)

    // English mode: flatten missing warn should be in English
    expect(reporter.warn).toHaveBeenCalledWith(expect.stringContaining('not found'))
    expect(reporter.warn).toHaveBeenCalledWith(expect.stringContaining('index.md'))
  })
})

// ── Story 7-1 CR Fix #5: claude:*:instructions reserved name 保护 ─────────────

describe('claude:*:instructions reserved name 保护（Story 7-1 CR Fix #5）', () => {
  let tmpDir: string
  let reporter: Reporter

  beforeEach(async () => {
    tmpDir = await makeTmpDir()
    reporter = makeReporter()
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  const RESERVED_NAMES = [
    'CLAUDE.md',
    'CLAUDE.local.md',
    'AGENTS.md',
    'AGENTS.local.md',
    'settings.json',
    'settings.local.json',
    '.claudeignore',
  ]

  it.each(RESERVED_NAMES)(
    'claude:global:instructions 安装 %s 时跳过并输出 warn（即便 --force）',
    async (reservedName) => {
      const srcFile = join(tmpDir, 'src', reservedName)
      const targetDir = join(tmpDir, 'target')
      await mkdir(join(tmpDir, 'src'), { recursive: true })
      await mkdir(targetDir, { recursive: true })
      await writeFile(srcFile, 'should not be written')

      const plan: MatchedPlan = {
        items: [
          {
            rule: {
              tool: 'claude',
              scope: 'global',
              sourceDir: 'instructions',
              type: InstallType.Files,
              targetDir: '.claude/',
            },
            sourceFiles: [srcFile],
            targetPath: targetDir,
            mode: 'copy',
          },
        ],
      }

      const pathResolver = makePathResolver(tmpDir)
      await executeInstall(plan, makeArgs({ force: true }), reporter, pathResolver as never)

      // 目标文件不应被创建
      const destPath = join(targetDir, reservedName)
      await expect(access(destPath)).rejects.toThrow()
      // reporter.warn 应被调用且包含保留文件名
      expect(reporter.warn).toHaveBeenCalledWith(expect.stringContaining(reservedName))
    },
  )

  it('claude:global:instructions 非保留文件名正常安装', async () => {
    const srcFile = join(tmpDir, 'src', 'custom-instruction.md')
    const targetDir = join(tmpDir, 'target')
    await mkdir(join(tmpDir, 'src'), { recursive: true })
    await mkdir(targetDir, { recursive: true })
    await writeFile(srcFile, 'custom content')

    const plan: MatchedPlan = {
      items: [
        {
          rule: {
            tool: 'claude',
            scope: 'global',
            sourceDir: 'instructions',
            type: InstallType.Files,
            targetDir: '.claude/',
          },
          sourceFiles: [srcFile],
          targetPath: targetDir,
          mode: 'copy',
        },
      ],
    }

    const pathResolver = makePathResolver(tmpDir)
    await executeInstall(plan, makeArgs(), reporter, pathResolver as never)

    // 非保留文件应被正常安装
    const destPath = join(targetDir, 'custom-instruction.md')
    const content = await readFile(destPath, 'utf-8')
    expect(content).toBe('custom content')
  })

  it('非 claude instructions 规则不触发保护（claude:global:agents 中的 CLAUDE.md 可正常安装）', async () => {
    const srcFile = join(tmpDir, 'src', 'CLAUDE.md')
    const targetDir = join(tmpDir, 'target')
    await mkdir(join(tmpDir, 'src'), { recursive: true })
    await mkdir(targetDir, { recursive: true })
    await writeFile(srcFile, 'agent content')

    const plan: MatchedPlan = {
      items: [
        {
          rule: {
            tool: 'claude',
            scope: 'global',
            sourceDir: 'agents',
            type: InstallType.Files,
            targetDir: '.claude/agents/',
          },
          sourceFiles: [srcFile],
          targetPath: targetDir,
          mode: 'copy',
        },
      ],
    }

    const pathResolver = makePathResolver(tmpDir)
    await executeInstall(plan, makeArgs(), reporter, pathResolver as never)

    // agents 规则下的 CLAUDE.md 不受保护限制
    const destPath = join(targetDir, 'CLAUDE.md')
    const content = await readFile(destPath, 'utf-8')
    expect(content).toBe('agent content')
  })

  // ── R2 #1(b): 大小写不敏感 ─────────────────────────────────────────────────

  it.each(['claude.md', 'Claude.MD', 'CLAUDE.MD', 'Settings.JSON', '.ClaudeIgnore'])(
    'R2 #1(b): 大小写变体 %s 也被拦截（大小写不敏感比较）',
    async (mixedCaseName) => {
      const srcFile = join(tmpDir, 'src', mixedCaseName)
      const targetDir = join(tmpDir, 'target')
      await mkdir(join(tmpDir, 'src'), { recursive: true })
      await mkdir(targetDir, { recursive: true })
      await writeFile(srcFile, 'should not be written')

      const plan: MatchedPlan = {
        items: [
          {
            rule: {
              tool: 'claude',
              scope: 'global',
              sourceDir: 'instructions',
              type: InstallType.Files,
              targetDir: '.claude/',
            },
            sourceFiles: [srcFile],
            targetPath: targetDir,
            mode: 'copy',
          },
        ],
      }

      const pathResolver = makePathResolver(tmpDir)
      await executeInstall(plan, makeArgs({ force: true }), reporter, pathResolver as never)

      const destPath = join(targetDir, mixedCaseName)
      await expect(access(destPath)).rejects.toThrow()
      expect(reporter.warn).toHaveBeenCalledWith(expect.stringContaining(mixedCaseName))
    },
  )

  // ── R2 #1(a): Directories 类型也受保护 ─────────────────────────────────────

  it('R2 #1(a): claude:global:instructions Directories 类型下 CLAUDE.md 也被拦截', async () => {
    const srcFile = join(tmpDir, 'src', 'CLAUDE.md')
    const targetDir = join(tmpDir, 'target')
    await mkdir(join(tmpDir, 'src'), { recursive: true })
    await mkdir(targetDir, { recursive: true })
    await writeFile(srcFile, 'should not be written')

    const plan: MatchedPlan = {
      items: [
        {
          rule: {
            tool: 'claude',
            scope: 'global',
            sourceDir: 'instructions',
            type: InstallType.Directories,
            targetDir: '.claude/',
          },
          sourceFiles: [srcFile],
          targetPath: targetDir,
          mode: 'copy',
        },
      ],
    }

    const pathResolver = makePathResolver(tmpDir)
    await executeInstall(plan, makeArgs({ force: true }), reporter, pathResolver as never)

    const destPath = join(targetDir, 'CLAUDE.md')
    await expect(access(destPath)).rejects.toThrow()
    expect(reporter.warn).toHaveBeenCalledWith(expect.stringContaining('CLAUDE.md'))
  })

  // ── R3 #1: Flatten 分支守卫 ────────────────────────────────────────────────

  it('R3 #1: claude:global:instructions Flatten 类型下目录名为 CLAUDE 时（destName=CLAUDE.md）被拦截', async () => {
    // Flatten 类型：sourceFiles 为子目录列表，destName = basename(srcDir) + '.md'
    const srcDir = join(tmpDir, 'src', 'CLAUDE')
    const mainFile = join(srcDir, 'index.md')
    const targetDir = join(tmpDir, 'target')
    await mkdir(srcDir, { recursive: true })
    await mkdir(targetDir, { recursive: true })
    await writeFile(mainFile, 'should not be written')

    const plan: MatchedPlan = {
      items: [
        {
          rule: {
            tool: 'claude',
            scope: 'global',
            sourceDir: 'instructions',
            type: InstallType.Flatten,
            targetDir: '.claude/',
          },
          sourceFiles: [srcDir],
          targetPath: targetDir,
          mode: 'copy',
        },
      ],
    }

    const pathResolver = makePathResolver(tmpDir)
    await executeInstall(plan, makeArgs({ force: true }), reporter, pathResolver as never)

    const destPath = join(targetDir, 'CLAUDE.md')
    await expect(access(destPath)).rejects.toThrow()
    expect(reporter.warn).toHaveBeenCalledWith(expect.stringContaining('CLAUDE.md'))
  })

  // ── R3 #3: 聚合 warn ─────────────────────────────────────────────────────────

  it('R3 #3: 多个 reserved-name 文件被拦截后输出包含拦截数量的聚合 warn', async () => {
    const srcDir = join(tmpDir, 'src')
    const targetDir = join(tmpDir, 'target')
    await mkdir(srcDir, { recursive: true })
    await mkdir(targetDir, { recursive: true })
    for (const name of ['CLAUDE.md', 'AGENTS.md']) {
      await writeFile(join(srcDir, name), 'should not be written')
    }

    const plan: MatchedPlan = {
      items: [
        {
          rule: {
            tool: 'claude',
            scope: 'global',
            sourceDir: 'instructions',
            type: InstallType.Files,
            targetDir: '.claude/',
          },
          sourceFiles: [join(srcDir, 'CLAUDE.md'), join(srcDir, 'AGENTS.md')],
          targetPath: targetDir,
          mode: 'copy',
        },
      ],
    }

    const pathResolver = makePathResolver(tmpDir)
    await executeInstall(plan, makeArgs({ force: true }), reporter, pathResolver as never)

    // 聚合 warn 应包含拦截数量和 "Claude Code 保留文件" 字样
    const warnCalls = vi.mocked(reporter.warn).mock.calls.map((c) => String(c[0]))
    const summaryCall = warnCalls.find((w) => w.includes('2') && w.includes('Claude Code'))
    expect(summaryCall).toBeDefined()
  })

  // ── R4 #3: completePhase 语义修复 ─────────────────────────────────────────

  it('R4 #3a: 全部文件均为 reserved-skip 时 completePhase 输出专属黄色摘要', async () => {
    const srcDir = join(tmpDir, 'src-reserved-only')
    const targetDir = join(tmpDir, 'target-reserved-only')
    await mkdir(srcDir, { recursive: true })
    await mkdir(targetDir, { recursive: true })
    for (const name of ['CLAUDE.md', 'AGENTS.md']) {
      await writeFile(join(srcDir, name), 'reserved content')
    }

    const plan: MatchedPlan = {
      items: [
        {
          rule: {
            tool: 'claude',
            scope: 'global',
            sourceDir: 'instructions',
            type: InstallType.Files,
            targetDir: '.claude/',
          },
          sourceFiles: [join(srcDir, 'CLAUDE.md'), join(srcDir, 'AGENTS.md')],
          targetPath: targetDir,
          mode: 'copy',
        },
      ],
    }

    const pathResolver = makePathResolver(tmpDir)
    await executeInstall(plan, makeArgs({ force: true }), reporter, pathResolver as never)

    expect(reporter.completePhase).toHaveBeenCalledWith(
      '⚠️ 全部源文件均被 Claude Code reserved-name 保护拦截，未执行任何写入（--force 对此无效）',
    )
  })

  it('R4 #3b: 混合 reserved-skip + 其他 skip 时 completePhase 输出通用摘要', async () => {
    const srcDir = join(tmpDir, 'src-mixed-skip')
    const targetDir = join(tmpDir, 'target-mixed-skip')
    await mkdir(srcDir, { recursive: true })
    await mkdir(targetDir, { recursive: true })

    // CLAUDE.md 会被 reserved-name 保护拦截
    await writeFile(join(srcDir, 'CLAUDE.md'), 'reserved content')
    // normal.md 已存在于目标目录且内容相同 → up-to-date skip
    await writeFile(join(srcDir, 'normal.md'), 'same content')
    await writeFile(join(targetDir, 'normal.md'), 'same content')

    const plan: MatchedPlan = {
      items: [
        {
          rule: {
            tool: 'claude',
            scope: 'global',
            sourceDir: 'instructions',
            type: InstallType.Files,
            targetDir: '.claude/',
          },
          sourceFiles: [join(srcDir, 'CLAUDE.md'), join(srcDir, 'normal.md')],
          targetPath: targetDir,
          mode: 'copy',
        },
      ],
    }

    const pathResolver = makePathResolver(tmpDir)
    await executeInstall(plan, makeArgs({ force: false }), reporter, pathResolver as never)

    // reservedSkipCount(1) < processedCount(2) → 通用灰色摘要
    expect(reporter.completePhase).toHaveBeenCalledWith(
      '执行安装... 没有新增/更新文件，全部已是最新或被跳过',
    )
  })
})
