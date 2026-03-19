import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { spawnSync } from 'child_process'

const pkgPath = resolve(process.cwd(), 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))

describe('project toolchain configuration', () => {
  it('package.json has type=module', () => {
    expect(pkg.type).toBe('module')
  })

  it('package.json has node engine >= 18', () => {
    expect(pkg.engines?.node).toBe('>=18.0.0')
  })

  it('package.json has bin entry for aiforge', () => {
    expect(pkg.bin?.aiforge).toBe('./dist/index.js')
  })

  it('package.json has required scripts', () => {
    expect(pkg.scripts?.build).toBeDefined()
    expect(pkg.scripts?.test).toBeDefined()
    expect(pkg.scripts?.lint).toBeDefined()
  })

  it('package.json has core dependencies', () => {
    const deps = pkg.dependencies ?? {}
    expect(deps['commander']).toBeDefined()
    expect(deps['simple-git']).toBeDefined()
    expect(deps['ora']).toBeDefined()
    expect(deps['chalk']).toBeDefined()
    expect(deps['@inquirer/prompts']).toBeDefined()
  })

  it('package.json has required dev dependencies', () => {
    const devDeps = pkg.devDependencies ?? {}
    expect(devDeps['typescript']).toBeDefined()
    expect(devDeps['tsup']).toBeDefined()
    expect(devDeps['tsx']).toBeDefined()
    expect(devDeps['vitest']).toBeDefined()
    expect(devDeps['eslint']).toBeDefined()
    expect(devDeps['prettier']).toBeDefined()
    expect(devDeps['@types/node']).toBeDefined()
  })

  it('package.json contains no company domain or repository URL field', () => {
    // NFR-S1: no repository/homepage/bugs fields (as JSON keys), no internal hostnames
    const parsed = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    expect(parsed).not.toHaveProperty('repository')
    expect(parsed).not.toHaveProperty('homepage')
    expect(parsed).not.toHaveProperty('bugs')
    // No internal hostnames or tokens in the raw string
    const pkgStr = readFileSync(pkgPath, 'utf-8')
    expect(pkgStr).not.toMatch(/gitlab\.[a-z]+\.[a-z]+/)
  })

  it('simple-git version is pinned to ~3.32', () => {
    const deps = pkg.dependencies ?? {}
    expect(deps['simple-git']).toMatch(/~3\.32/)
  })

  it('ora version is ^8', () => {
    const deps = pkg.dependencies ?? {}
    expect(deps['ora']).toMatch(/\^8/)
  })

  it('chalk version is ^5', () => {
    const deps = pkg.dependencies ?? {}
    expect(deps['chalk']).toMatch(/\^5/)
  })
})

describe('project directory structure (AC: #1)', () => {
  const dirs = [
    'src/core',
    'src/data',
    'src/stages',
    'src/services',
    'src/commands',
    'tests/core',
    'tests/data',
    'tests/stages',
    'tests/services',
    'tests/commands',
  ]

  for (const dir of dirs) {
    it(`directory ${dir} exists`, () => {
      expect(existsSync(resolve(process.cwd(), dir))).toBe(true)
    })
  }
})

describe('tsconfig.json configuration (AC: #1)', () => {
  const tsconfig = JSON.parse(readFileSync(resolve(process.cwd(), 'tsconfig.json'), 'utf-8'))

  it('strict mode is enabled', () => {
    expect(tsconfig.compilerOptions?.strict).toBe(true)
  })

  it('module is NodeNext', () => {
    expect(tsconfig.compilerOptions?.module).toBe('NodeNext')
  })

  it('moduleResolution is NodeNext', () => {
    expect(tsconfig.compilerOptions?.moduleResolution).toBe('NodeNext')
  })
})

describe('vitest configuration (AC: #3)', () => {
  it('passWithNoTests is configured', () => {
    const vitestConfig = readFileSync(resolve(process.cwd(), 'vitest.config.ts'), 'utf-8')
    expect(vitestConfig).toContain('passWithNoTests: true')
  })
})

const distPath = resolve(process.cwd(), 'dist/index.js')

describe('CLI --version behavior (AC: #1)', () => {
  it.skipIf(!existsSync(distPath))('--version outputs version matching package.json', () => {
    const result = spawnSync('node', [distPath, '--version'], { encoding: 'utf-8' })
    expect(result.stdout.trim()).toBe(pkg.version)
  })
})
