/**
 * 用户可见输出字符串 — 中文（MVP），对象结构预留多语言扩展
 *
 * 来源: architecture/04-implementation-patterns.md — CLI 输出规范
 * 后续 Story 5.5a 加英文时只需扩展此结构
 */

/** 管道进度阶段名 */
export const MESSAGES = {
  phases: {
    resolve: '解析仓库地址...',
    auth: '验证认证信息...',
    clone: '克隆仓库...',
    detect: '检测 AI 工具...',
    match: '匹配安装规则...',
    install: '执行安装...',
  },
} as const

/** 结果状态图标 */
export const ICONS = {
  new: '✅',
  updated: '🔄',
  skipped: '⏭️',
  failed: '❌',
} as const

/**
 * 统计行格式模板
 * 格式: 安装: N 项  更新: N 项  跳过: N 项  失败: N 项
 */
export function STATS_FORMAT(
  installed: number,
  updated: number,
  skipped: number,
  failed: number,
): string {
  return `安装: ${installed} 项  更新: ${updated} 项  跳过: ${skipped} 项  失败: ${failed} 项`
}
