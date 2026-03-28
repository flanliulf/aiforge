/**
 * tests/stages/execute-install.test.ts
 *
 * Story 4.2 — 复制模式安装执行
 * 测试用例：files 类型复制、directories 类型复制、目录自动创建、
 *           new/updated/skipped 状态判定、fail-fast 行为
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtemp, writeFile, mkdir, rm, readFile, symlink } from 'node:fs/promises'
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
})
