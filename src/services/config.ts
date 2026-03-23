import { readFile, writeFile, rename, chmod, mkdir, access } from 'node:fs/promises'
import { join } from 'node:path'
import type { PathResolver } from '../core/path-resolver.js'
import type { AiforgeConfig, HostAuth } from '../core/types.js'
import { AiforgeError, EXIT_ARG_ERROR } from '../core/errors.js'

/**
 * Load and parse ~/.aiforge/config.json
 *
 * @throws AiforgeError CONFIG_NOT_FOUND - file does not exist
 * @throws AiforgeError CONFIG_CORRUPT  - file is not valid JSON
 * @throws AiforgeError CONFIG_READ_FAILED - file exists but cannot be read (permissions, I/O)
 */
export async function loadConfig(pathResolver: PathResolver): Promise<AiforgeConfig> {
  const configPath = join(pathResolver.configDir(), 'config.json')

  let raw: string
  try {
    raw = await readFile(configPath, 'utf-8')
  } catch (err: unknown) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      throw new AiforgeError(
        '未找到配置文件',
        'CONFIG_NOT_FOUND',
        EXIT_ARG_ERROR,
        'fatal',
        '尚未运行初始化配置',
        ['npx aiforge init  # 首次配置'],
      )
    }
    throw new AiforgeError(
      '配置文件读取失败',
      'CONFIG_READ_FAILED',
      EXIT_ARG_ERROR,
      'fatal',
      `无法读取配置文件: ${isNodeError(err) ? err.code : String(err)}`,
      [
        'ls -la ~/.aiforge/config.json  # 检查文件权限',
        'chmod 600 ~/.aiforge/config.json  # 修复权限',
      ],
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new AiforgeError(
      '配置文件损坏',
      'CONFIG_CORRUPT',
      EXIT_ARG_ERROR,
      'fatal',
      'config.json 不是有效的 JSON 格式',
      ['npx aiforge init  # 重新配置'],
    )
  }

  if (!isValidConfigStructure(parsed)) {
    throw new AiforgeError(
      '配置文件损坏',
      'CONFIG_CORRUPT',
      EXIT_ARG_ERROR,
      'fatal',
      'config.json 缺少必要的 auth 字段或 auth 不是有效的对象',
      ['npx aiforge init  # 重新配置'],
    )
  }

  return parsed as AiforgeConfig
}

/**
 * Atomically write config to ~/.aiforge/config.json
 * Uses tmp file + rename for crash safety, then chmod 0o600.
 */
export async function saveConfig(config: AiforgeConfig, pathResolver: PathResolver): Promise<void> {
  await ensureConfigDir(pathResolver)

  const configPath = join(pathResolver.configDir(), 'config.json')
  const tmpPath = configPath + '.tmp'

  await writeFile(tmpPath, JSON.stringify(config, null, 2), 'utf-8')
  await rename(tmpPath, configPath)
  await chmod(configPath, 0o600)
}

/**
 * Look up per-host authentication configuration.
 */
export function getHostAuth(config: AiforgeConfig, hostname: string): HostAuth | undefined {
  return Object.hasOwn(config.auth, hostname) ? config.auth[hostname] : undefined
}

/**
 * Ensure ~/.aiforge/ directory exists, creating it recursively if needed.
 */
export async function ensureConfigDir(pathResolver: PathResolver): Promise<void> {
  const dir = pathResolver.configDir()
  try {
    await access(dir)
  } catch {
    await mkdir(dir, { recursive: true })
  }
}

// ── internal helpers ──────────────────────────────────────────

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err
}

/**
 * Minimal runtime validation: auth must be a non-null, non-array object.
 */
function isValidConfigStructure(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const obj = value as Record<string, unknown>
  return typeof obj.auth === 'object' && obj.auth !== null && !Array.isArray(obj.auth)
}
