/**
 * tests/stages/execute-install.test.ts
 *
 * Story 4.2 + 4.3 — 安装执行测试
 * 测试用例：files/directories 复制、symlink 模式、flatten 模式、
 *           new/updated/skipped 状态判定、断链检测、fail-fast 行为
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtemp, writeFile, mkdir, rm, readFile, symlink, readlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, basename } from 'node:path'

import { executeInstall } from '../../src/stages/execute-install.js'
import { AiforgeError } from '../../src/core/errors.js'
import { InstallType } from '../../src/core/types.js'
import type { MatchedPlan, ParsedArgs } from '../../src/core/types.js'
import type { Reporter } from '../../src/core/reporter.js'
import type { PathResolver } from '../../src/core/path-resolver.js'

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

    it('skipped 文件不调用 reporter.updatePhase', async () => {
      const srcFile = join(tmpDir, 'no-update.md')
      const targetDir = join(tmpDir, 'no-update-target')
      await mkdir(targetDir)
      const content = 'same'
      await writeFile(srcFile, content)
      await writeFile(join(targetDir, basename(srcFile)), content)

      const plan = makeFilePlan([srcFile], targetDir)
      await executeInstall(plan, makeArgs(), reporter, pathResolver)

      // skipped 文件不调用 updatePhase
      expect(reporter.updatePhase).not.toHaveBeenCalled()
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
      expect(reporter.updatePhase).not.toHaveBeenCalled()
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
      expect(reporter.warn).toHaveBeenCalledTimes(1)
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
})
