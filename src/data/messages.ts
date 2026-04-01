/**
 * data/messages.ts — 向后兼容重导出
 *
 * 主逻辑已迁移至 src/core/messages.ts（Story 5.5a CR Fix）
 * 此文件仅保留供历史测试路径兼容。
 *
 * @deprecated 新代码请直接从 '../core/messages.js' 导入
 */

export { setLanguage, msg } from '../core/messages.js'

// ── 向后兼容导出（供 data/messages 旧引用路径使用）────────────────────────────

/**
 * 管道进度阶段名（中文，向后兼容）
 *
 * @deprecated 新代码请使用 msg('phases.*') 代替
 */
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

/** 结果状态图标（向后兼容） */
export const ICONS = {
  new: '✅',
  updated: '🔄',
  skipped: '⏭️',
  failed: '❌',
} as const

/**
 * 统计行格式（向后兼容）
 * @deprecated 新代码请使用 msg('reporter.resultStats') 或 msg('stats.template') 代替
 */
export function STATS_FORMAT(
  installed: number,
  updated: number,
  skipped: number,
  failed: number,
): string {
  return `安装: ${installed} 项  更新: ${updated} 项  跳过: ${skipped} 项  失败: ${failed} 项`
}

/**
 * dry-run 计划统计行（向后兼容）
 * @deprecated 新代码请使用 msg('reporter.planStats') 代替
 */
export function PLAN_STATS_FORMAT(totalFiles: number, toolCount: number): string {
  return `计划安装: ${totalFiles} 项 (${toolCount} 个工具)`
}
