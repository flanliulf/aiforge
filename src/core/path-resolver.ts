import os from 'os'
import path from 'path'
import { AiforgeError } from './errors.js'
import { EXIT_ARG_ERROR } from './errors.js'

export interface PathResolver {
  home(): string
  configDir(): string
  reposDir(): string
  toolGlobalDir(toolId: string): string
  toolProjectDir(toolId: string): string
}

export class UnixPathResolver implements PathResolver {
  private readonly homeDir: string

  constructor() {
    const homeDir = os.homedir()
    if (!homeDir) {
      throw new AiforgeError(
        'HOME 环境变量未设置',
        'ERR_NO_HOME',
        EXIT_ARG_ERROR,
        'fatal',
        'os.homedir() 返回空值，HOME 环境变量可能未设置',
        ['请确保 HOME 环境变量已正确设置', '例如: export HOME=/home/youruser']
      )
    }
    this.homeDir = homeDir
  }

  home(): string {
    return this.homeDir
  }

  configDir(): string {
    return path.join(this.homeDir, '.aiforge')
  }

  reposDir(): string {
    return path.join(this.homeDir, '.aiforge', 'repos')
  }

  toolGlobalDir(toolId: string): string {
    return path.join(this.homeDir, '.aiforge', 'tools', toolId)
  }

  toolProjectDir(toolId: string): string {
    return path.join('.aiforge', 'tools', toolId)
  }
}
