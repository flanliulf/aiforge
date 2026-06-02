import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { afterEach, describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const scriptPath = join(repoRoot, 'scripts', 'prepare-npm-readme.mjs')
const relativeChineseLink = '[中文](README.zh.md)'
const cdnChineseLink = '[中文](https://cdn.jsdelivr.net/npm/@fancyliu/aiforge@latest/README.zh.md)'

describe('prepare npm README publishing links', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })))
    tempDirs.length = 0
  })

  it('keeps the source README language switch compatible with GitHub', async () => {
    const readme = await readFile(join(repoRoot, 'README.md'), 'utf8')

    expect(readme).toContain(relativeChineseLink)
    expect(readme).not.toContain(cdnChineseLink)
  })

  it('rewrites the README Chinese link for npm pack and restores the source content', async () => {
    const packageRoot = await mkdtemp(join(tmpdir(), 'aiforge-readme-pack-'))
    tempDirs.push(packageRoot)
    const readmePath = join(packageRoot, 'README.md')
    const originalReadme = `# aiforge\n\n**English** | ${relativeChineseLink}\n`
    await writeFile(readmePath, originalReadme)

    await execFileAsync('node', [scriptPath, '--root', packageRoot, '--apply'])
    const packedReadme = await readFile(readmePath, 'utf8')
    expect(packedReadme).toContain(cdnChineseLink)
    expect(packedReadme).not.toContain(relativeChineseLink)

    await execFileAsync('node', [scriptPath, '--root', packageRoot, '--restore'])
    await expect(readFile(readmePath, 'utf8')).resolves.toBe(originalReadme)
  })
})
