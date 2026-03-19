#!/usr/bin/env node
import { Command } from 'commander'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const pkg = require('../package.json') as { version: string }

const program = new Command()

program.name('aiforge').description('AI rules installer').version(pkg.version)

program.parse()
