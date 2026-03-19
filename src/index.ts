#!/usr/bin/env node
import { Command } from 'commander'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '../package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string }

const program = new Command()

program.name('aiforge').description('AI rules installer').version(pkg.version)

program.parse()
