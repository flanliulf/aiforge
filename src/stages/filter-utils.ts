/**
 * filter-utils — --filter pattern 解析与 glob 匹配工具
 *
 * 来源: Story 6.2 Task 2
 * 架构: src/stages/ 工具模块，供 match-rules.ts 引用
 *
 * 不引入外部 glob 库（如 minimatch），MVP 场景下 * 和 ? 足够覆盖用户需求。
 */

/**
 * FilterCancelledSignal — 用户取消选择的短路信号
 *
 * 取消是正常流而非错误，不继承 AiforgeError（AiforgeError.severity 类型为 'fatal'|'partial'，
 * 不含 'info'，编译直接失败）。
 * 管道编排器通过 instanceof FilterCancelledSignal 识别后以 exit code 0 正常退出。
 */
export class FilterCancelledSignal {
  readonly kind = 'filter-cancelled' as const
}

/**
 * parseFilterPattern — 解析 filter pattern 为 dirPrefix 和 glob 两部分
 *
 * 分割点为第一个 '/'：
 * - `skills/git*` → `{ dirPrefix: 'skills', glob: 'git*' }`（带顶层目录前缀）
 * - `git*`        → `{ dirPrefix: undefined, glob: 'git*' }`（无前缀，匹配所有顶层目录）
 */
export function parseFilterPattern(pattern: string): { dirPrefix?: string; glob: string } {
  const slashIndex = pattern.indexOf('/')
  if (slashIndex === -1) {
    return { glob: pattern }
  }
  return {
    dirPrefix: pattern.slice(0, slashIndex),
    glob: pattern.slice(slashIndex + 1),
  }
}

/**
 * matchesGlob — 简单 glob 匹配（支持 * 通配符和 ? 单字符匹配）
 *
 * MVP 不需要 ** 递归，正则转换覆盖常见场景：
 * - * → .* （匹配任意字符串）
 * - ? → .  （匹配单个字符）
 * - 其他正则特殊字符转义
 */
export function matchesGlob(name: string, glob: string): boolean {
  const regexStr =
    '^' +
    glob
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // 转义正则特殊字符
      .replace(/\*/g, '.*') // * → .*
      .replace(/\?/g, '.') + // ? → .
    '$'
  return new RegExp(regexStr).test(name)
}
