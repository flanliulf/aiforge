#!/usr/bin/env node
/* global process */

import { readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const relativeChineseLink = '[中文](README.zh.md)'
const cdnChineseLink = '[中文](https://cdn.jsdelivr.net/npm/@fancyliu/aiforge@latest/README.zh.md)'
const backupFilename = '.README.md.prepack-backup'

function parseArgs(argv) {
  let root = process.cwd()
  let mode = 'apply'

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--root') {
      const value = argv[index + 1]
      if (!value) {
        throw new Error('--root requires a directory path')
      }
      root = value
      index += 1
      continue
    }

    if (arg === '--apply') {
      mode = 'apply'
      continue
    }

    if (arg === '--restore') {
      mode = 'restore'
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return { mode, root: resolve(root) }
}

async function applyNpmReadme(root) {
  const readmePath = join(root, 'README.md')
  const backupPath = join(root, backupFilename)
  const readme = await readFile(readmePath, 'utf8')

  if (readme.includes(cdnChineseLink)) {
    return
  }

  if (!readme.includes(relativeChineseLink)) {
    throw new Error(`README.md must contain ${relativeChineseLink} before npm packaging`)
  }

  if (!existsSync(backupPath)) {
    await writeFile(backupPath, readme)
  }

  await writeFile(readmePath, readme.replace(relativeChineseLink, cdnChineseLink))
}

async function restoreSourceReadme(root) {
  const readmePath = join(root, 'README.md')
  const backupPath = join(root, backupFilename)

  if (!existsSync(backupPath)) {
    return
  }

  const originalReadme = await readFile(backupPath, 'utf8')
  await writeFile(readmePath, originalReadme)
  await rm(backupPath, { force: true })
}

const { mode, root } = parseArgs(process.argv.slice(2))

if (mode === 'restore') {
  await restoreSourceReadme(root)
} else {
  await applyNpmReadme(root)
}
