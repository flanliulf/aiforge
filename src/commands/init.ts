/**
 * aiforge init 交互式配置命令
 *
 * 来源: Story 2.5
 * 替换 Story 1.5 的占位实现
 *
 * 模块边界: commands/ 依赖 core/、services/
 * 输出: console.log（init 是交互式命令，不走管道，不使用 Reporter）
 *
 * CR Fix (Round 2):
 * - Finding #1/#2/#4: 提前 resolver.resolve() 到连接验证前，避免 Token SCP 假成功 / SSH HTTPS 误报
 * - Finding #3: 以 existingConfig 为基础 merge，避免重写时丢失已有字段
 *
 * CR Fix (Round 3 — Story 5.5a):
 * - Finding #1: 语言选择后立即调用 setLanguage()，后续所有输出通过 msg() 获取（AC #1/#3）
 */

import { input, select, password, confirm } from '@inquirer/prompts'
import { AiforgeError, EXIT_ARG_ERROR } from '../core/errors.js'
import { UnixPathResolver } from '../core/path-resolver.js'
import type { AiforgeConfig } from '../core/types.js'
import { loadConfig, saveConfig } from '../services/config.js'
import { createGit, GitSourceResolver } from '../services/git.js'
import { msg, setLanguage } from '../core/messages.js'
import { sanitizeToken } from '../core/sanitize.js'

export function registerInitCommand(program: import('commander').Command): void {
  program
    .command('init')
    .description('Initialize aiforge configuration')
    .action(async () => {
      await runInit()
    })
}

// ── 主流程 ──────────────────────────────────────────────────────

async function runInit(): Promise<void> {
  // Task 1.2: TTY 检测
  if (!process.stdin.isTTY) {
    throw new AiforgeError(
      msg('errors.nonTty'),
      'NON_TTY',
      EXIT_ARG_ERROR,
      'fatal',
      msg('errors.nonTtyWhy'),
      [msg('errors.fixRunInTerminal'), msg('errors.fixManualConfig')],
    )
  }

  const pathResolver = new UnixPathResolver()

  // Task 1.4: 已有配置检测
  let existingConfig: AiforgeConfig | undefined
  try {
    existingConfig = await loadConfig(pathResolver)
    // Story 5.5a CR Fix Round 2 — Finding #1a:
    // 在输出配置摘要之前预加载已有配置中的语言设置，
    // 确保 init 子命令走自己的 action()（不走 index.ts 的语言预加载路径）时也能正确显示语言（AC #1/#4）
    setLanguage(existingConfig.language ?? 'zh-CN')
    // 显示当前配置摘要
    const authSummary = Object.keys(existingConfig.auth)
      .map((h) => `${h} (${existingConfig!.auth[h]!.method})`)
      .join(', ')
    console.log(msg('init.currentConfig'))
    console.log(`${msg('init.repoLabel')}${existingConfig.defaultRepo ?? msg('init.notSet')}`)
    console.log(`${msg('init.authLabel')}${authSummary || msg('init.notSet')}`)
    console.log(
      `${msg('init.universalLabel')}${existingConfig.universalDirs !== false ? msg('init.enabled') : msg('init.disabled')}`,
    )

    const modify = await confirm({ message: msg('init.modifyPrompt'), default: false })
    if (!modify) return
  } catch (error: unknown) {
    if (error instanceof AiforgeError) {
      if (error.code === 'CONFIG_CORRUPT') {
        // 配置损坏：显式提示用户，继续首次配置流程
        console.log(msg('init.corruptWarning'))
      }
      // CONFIG_NOT_FOUND：无配置，继续首次配置流程（无需额外处理）
      // CONFIG_READ_FAILED：向上抛出（权限/I/O 问题需用户干预）
      if (error.code === 'CONFIG_READ_FAILED') {
        throw error
      }
    } else {
      throw error
    }
  }

  // Task 1.3: 交互式问答
  // Step 0: 语言选择（Story 5.5a Task 2）
  const language = await select({
    message: '界面语言 / Display language:',
    choices: [
      { name: '中文', value: 'zh-CN' },
      { name: 'English', value: 'en' },
    ],
    default: existingConfig?.language ?? 'zh-CN',
  })

  // Story 5.5a CR Fix — Finding #1:
  // 语言选择完成后立即调用 setLanguage()，确保后续所有 msg() 调用返回正确语言（AC #1/#3）
  setLanguage(language)

  // Step 1: 仓库 URL
  const repoUrl = await input({
    message: msg('init.repoUrlPrompt'),
    default: existingConfig?.defaultRepo,
    validate: (val) => (val.trim() ? true : msg('init.inputValidateRepo')),
  })

  // CR Fix #1/#2/#4: 提前解析 URL，确保验证 URL 与 clone URL 一致
  // GitSourceResolver.resolve() 会处理 HTTPS / SCP-style / ssh:// 三种格式
  // 若 URL 非法或协议不支持，直接抛出 AiforgeError（用户友好提示）
  const resolver = new GitSourceResolver()
  const resolved = await resolver.resolve(repoUrl)
  const { hostname, repoPath } = resolved

  // Step 2: 认证方式
  const authMethod = await select({
    message: msg('init.authMethodPrompt'),
    choices: [
      { name: msg('init.sshChoice'), value: 'ssh' },
      { name: msg('init.tokenChoice'), value: 'token' },
    ],
  })

  // Step 3: 根据选择验证连接
  // CR Fix #2: SSH 验证使用规范的 SCP-style 地址，而非用户原始输入
  // CR Fix #1: Token 验证使用 https://oauth2:token@host/path.git，而非 new URL() 猜测
  let token: string | undefined
  let connectionOk: boolean
  if (authMethod === 'token') {
    // Task 3.4: Token 输入不回显
    token = await password({
      message: msg('init.tokenPrompt'),
      validate: (val) => (val.trim() ? true : msg('init.inputValidateToken')),
    })
    // 构造 HTTPS token URL：https://oauth2:token@hostname/repoPath.git
    const tokenUrl = `https://oauth2:${token}@${hostname}/${repoPath}.git`
    connectionOk = await verifyTokenConnection(tokenUrl, token)
  } else {
    // 构造 SCP-style SSH URL：git@hostname:repoPath.git
    const sshVerifyUrl = `git@${hostname}:${repoPath}.git`
    connectionOk = await verifySshConnection(sshVerifyUrl)
  }

  // 连接失败时不保存配置
  if (!connectionOk) {
    return
  }

  // Story 6-4: 通用目录偏好询问
  const universalDirs = await confirm({
    message: msg('init.universalDirsPrompt'),
    default: existingConfig?.universalDirs !== false,
  })

  // CR Fix #3: 以 existingConfig 为基础 merge，保留已有字段
  // 只更新本次涉及的字段（defaultRepo、language、auth[hostname]、preferSSH、universalDirs），其余字段保留
  const config: AiforgeConfig = {
    ...existingConfig,
    defaultRepo: repoUrl,
    language,
    universalDirs,
    auth: {
      ...existingConfig?.auth,
      [hostname]: {
        method: authMethod as 'ssh' | 'token',
        token: authMethod === 'token' ? token : undefined,
      },
    },
  }

  if (authMethod === 'ssh') {
    config.preferSSH = true
  } else {
    // Token 方式不设置 preferSSH（或保留已有值，此处明确不覆盖为 true）
    // 若 existingConfig 有 preferSSH=true 但用户选择了 Token，保持不变
  }

  // Task 1.5: 保存配置
  await saveConfig(config, pathResolver)
}

// ── Task 2: SSH 连接验证 ──────────────────────────────────────

/**
 * 验证 SSH 连接。
 * 接收规范化的 SCP-style URL（git@hostname:repoPath.git）
 *
 * @param sshVerifyUrl - SCP-style SSH URL，由调用方通过 resolver 解析后构造
 * @returns true 表示成功，false 表示失败（已打印错误提示）
 */
async function verifySshConnection(sshVerifyUrl: string): Promise<boolean> {
  const git = createGit()
  try {
    await git.raw(['ls-remote', '--exit-code', sshVerifyUrl])
    // Task 2.2: 成功
    console.log(msg('init.sshSuccess'))
    return true
  } catch {
    // Task 2.3: 三段式错误提示
    console.log(msg('init.sshFail'))
    console.log(msg('init.sshFailReason'))
    console.log(msg('init.fixTitle'))
    console.log(msg('init.fixSshKeygen'))
    console.log(msg('init.fixSshCopyKey'))
    console.log(msg('init.fixSshTest'))
    return false
  }
}

// ── Task 3: Token 连接验证 ────────────────────────────────────

/**
 * 验证 Token 连接。
 * 接收调用方已构造好的 token URL（https://oauth2:token@hostname/repoPath.git）
 *
 * @param tokenUrl - 已构造的 HTTPS token URL，不含原始 URL 猜测逻辑
 * @param token - 原始 token，仅用于脱敏显示
 * @returns true 表示成功，false 表示失败（已打印错误提示）
 */
async function verifyTokenConnection(tokenUrl: string, token: string): Promise<boolean> {
  const git = createGit()
  try {
    await git.raw(['ls-remote', '--exit-code', tokenUrl])
    // Task 3.2: 成功，Token 脱敏显示
    const sanitized = sanitizeToken(token)
    console.log(`${msg('init.tokenSuccessPrefix')} (${sanitized})`)
    return true
  } catch {
    // Task 3.3: 三段式错误提示
    console.log(msg('init.tokenFail'))
    console.log(msg('init.tokenFailReason'))
    console.log(msg('init.fixTitle'))
    console.log(msg('init.fixTokenGenerate'))
    console.log(msg('init.fixTokenPermission'))
    return false
  }
}

// ── 内部工具函数 ──────────────────────────────────────────────
