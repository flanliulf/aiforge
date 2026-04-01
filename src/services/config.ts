import { readFile, writeFile, rename, chmod, mkdir, access } from 'node:fs/promises'
import { join } from 'node:path'
import type { PathResolver } from '../core/path-resolver.js'
import type { AiforgeConfig, HostAuth } from '../core/types.js'
import { AiforgeError, EXIT_ARG_ERROR } from '../core/errors.js'
import { msg } from '../core/messages.js'

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
        msg('config.notFound'),
        'CONFIG_NOT_FOUND',
        EXIT_ARG_ERROR,
        'fatal',
        msg('config.notFoundWhy'),
        [msg('config.fixInit')],
      )
    }
    throw new AiforgeError(
      msg('config.readFailed'),
      'CONFIG_READ_FAILED',
      EXIT_ARG_ERROR,
      'fatal',
      `${msg('config.readFailed')}: ${isNodeError(err) ? err.code : String(err)}`,
      [msg('config.fixCheckPerms'), msg('config.fixPermsCmd')],
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new AiforgeError(
      msg('config.corrupt'),
      'CONFIG_CORRUPT',
      EXIT_ARG_ERROR,
      'fatal',
      msg('config.corruptWhy'),
      [msg('config.fixReinit')],
    )
  }

  if (!isValidConfigStructure(parsed)) {
    throw new AiforgeError(
      msg('config.corrupt'),
      'CONFIG_CORRUPT',
      EXIT_ARG_ERROR,
      'fatal',
      msg('config.corruptWhyBadAuth'),
      [msg('config.fixReinit')],
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
