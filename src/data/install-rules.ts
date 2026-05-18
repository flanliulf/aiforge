import type { InstallRule, InstallType } from '../core/types.js'

// 本地常量避免运行时依赖 core/ — 值与 InstallType enum 保持一致
const Files: InstallType = 'Files' as InstallType
const Directories: InstallType = 'Directories' as InstallType
const Flatten: InstallType = 'Flatten' as InstallType

/**
 * v2.0 内置安装规则表 — 24 条规则覆盖 4 工具 × 全局/项目
 *
 * v2.0 变更（Breaking Change）:
 *   - 删除: vscode:global:mcp-tools（VS Code 归并到 Copilot 语境）
 *   - 新增: copilot:project:mcp-tools → .vscode/（承接原 vscode 项目级 MCP 语义）
 *   - 新增: claude:global:instructions + claude:project:instructions（双路径）
 *   - 新增: cursor:global:agents（补齐全局 agents 规则）
 *
 * 规则来源: PRD 安装规则映射表 + architecture/03-core-decisions.md#D2
 */
export const BUILTIN_RULES: InstallRule[] = [
  // ── Copilot: 全局 (4 条) ──
  {
    tool: 'copilot',
    scope: 'global',
    sourceDir: 'agents',
    type: Files,
    targetDir: '~/.copilot/agents/',
  },
  {
    tool: 'copilot',
    scope: 'global',
    sourceDir: 'skills',
    type: Directories,
    targetDir: '~/.copilot/skills/',
  },
  {
    tool: 'copilot',
    scope: 'global',
    sourceDir: 'instructions',
    type: Files,
    targetDir: '~/.copilot/',
  },
  // mcp-tools 目标为工具根目录：MCP 配置文件需放在工具能识别的固定位置（如 mcp.json），不是子目录
  {
    tool: 'copilot',
    scope: 'global',
    sourceDir: 'mcp-tools',
    type: Files,
    targetDir: '~/.copilot/',
  },

  // ── Copilot: 项目 (5 条) ──
  {
    tool: 'copilot',
    scope: 'project',
    sourceDir: 'agents',
    type: Files,
    targetDir: '.github/agents/',
  },
  {
    tool: 'copilot',
    scope: 'project',
    sourceDir: 'skills',
    type: Directories,
    targetDir: '.github/skills/',
  },
  {
    tool: 'copilot',
    scope: 'project',
    sourceDir: 'instructions',
    type: Files,
    targetDir: '.github/',
  },
  // mcp-tools 同上，目标为工具项目根目录（.github/）
  { tool: 'copilot', scope: 'project', sourceDir: 'mcp-tools', type: Files, targetDir: '.github/' },
  // v2.0: 承接原 vscode 项目级 MCP 配置语义（.vscode/mcp.json）
  { tool: 'copilot', scope: 'project', sourceDir: 'mcp-tools', type: Files, targetDir: '.vscode/' },

  // ── Claude: 全局 + 项目 (6 条) ──
  // Claude Code 的 sub-agents 概念对应 agents/ 源目录
  {
    tool: 'claude',
    scope: 'global',
    sourceDir: 'agents',
    type: Files,
    targetDir: '~/.claude/agents/',
  },
  {
    tool: 'claude',
    scope: 'global',
    sourceDir: 'skills',
    type: Directories,
    targetDir: '~/.claude/skills/',
  },
  // v2.0: claude 全局 instructions → ~/.claude/（补齐）
  {
    tool: 'claude',
    scope: 'global',
    sourceDir: 'instructions',
    type: Files,
    targetDir: '~/.claude/',
  },
  {
    tool: 'claude',
    scope: 'project',
    sourceDir: 'agents',
    type: Files,
    targetDir: '.claude/agents/',
  },
  {
    tool: 'claude',
    scope: 'project',
    sourceDir: 'skills',
    type: Directories,
    targetDir: '.claude/skills/',
  },
  // v2.0: claude 项目级 instructions → .claude/（补齐）
  {
    tool: 'claude',
    scope: 'project',
    sourceDir: 'instructions',
    type: Files,
    targetDir: '.claude/',
  },

  // ── Cursor: 全局 + 项目 (4 条) ──
  // v2.0: 新增全局 agents 规则，与项目级保持对称
  {
    tool: 'cursor',
    scope: 'global',
    sourceDir: 'agents',
    type: Files,
    targetDir: '~/.cursor/rules/',
  },
  {
    tool: 'cursor',
    scope: 'global',
    sourceDir: 'skills',
    type: Flatten,
    targetDir: '~/.cursor/rules/',
  },
  {
    tool: 'cursor',
    scope: 'project',
    sourceDir: 'skills',
    type: Flatten,
    targetDir: '.cursor/rules/',
  },
  {
    tool: 'cursor',
    scope: 'project',
    sourceDir: 'agents',
    type: Files,
    targetDir: '.cursor/rules/',
  },

  // ── Codex CLI: 全局 + 项目 (5 条，含 MCP 降级) ──
  // Story 7-2: Codex CLI 接入（含 MCP 降级策略）
  {
    tool: 'codex',
    scope: 'global',
    sourceDir: 'skills',
    type: Directories,
    targetDir: '~/.codex/skills/',
  },
  {
    tool: 'codex',
    scope: 'global',
    sourceDir: 'agents',
    type: Files,
    targetDir: '~/.codex/agents/',
  },
  {
    tool: 'codex',
    scope: 'project',
    sourceDir: 'skills',
    type: Directories,
    targetDir: '.codex/skills/',
  },
  {
    tool: 'codex',
    scope: 'project',
    sourceDir: 'agents',
    type: Files,
    targetDir: '.codex/agents/',
  },
  // mcp-tools 降级策略：模板文件复制到 ~/.codex/，不直接修改 config.toml
  // Reporter 在安装汇总阶段输出手动合并提示（见 MCP_MERGE_HINTS + execute-install.ts）
  {
    tool: 'codex',
    scope: 'global',
    sourceDir: 'mcp-tools',
    type: Files,
    targetDir: '~/.codex/',
  },
]

export const MCP_MERGE_HINTS: Record<string, { targetFile: string; section: string }> = {
  codex: { targetFile: '~/.codex/config.toml', section: '[mcp]' },
}

/**
 * 通用目录安装规则 — Story 6-3
 *
 * 安装到 .agents/ 和 .agent/ 目录，与具体 AI 工具无关。
 * 规则来源: FR-050 — 通用目录默认并行安装
 *
 * 注意：UNIVERSAL_RULES 不加入 RULE_INDEX（不参与工具检测匹配），
 * 由 Match 阶段在常规规则匹配完成后单独追加。
 * tool: 'universal' 是虚拟工具 ID，不在 TOOL_DEFINITIONS 注册表中。
 */
export const UNIVERSAL_RULES: InstallRule[] = [
  // .agents/ 目录
  {
    tool: 'universal',
    scope: 'project',
    sourceDir: 'skills',
    type: Directories,
    targetDir: '.agents/skills/',
  },
  {
    tool: 'universal',
    scope: 'project',
    sourceDir: 'agents',
    type: Files,
    targetDir: '.agents/agents/',
  },
  // .agent/ 目录
  {
    tool: 'universal',
    scope: 'project',
    sourceDir: 'skills',
    type: Directories,
    targetDir: '.agent/skills/',
  },
  {
    tool: 'universal',
    scope: 'project',
    sourceDir: 'agents',
    type: Files,
    targetDir: '.agent/agents/',
  },
]

/**
 * 规则索引 — key 为 `${tool}:${scope}`，O(1) 查找
 */
export const RULE_INDEX: Map<string, InstallRule[]> = (() => {
  const index = new Map<string, InstallRule[]>()
  for (const rule of BUILTIN_RULES) {
    const key = `${rule.tool}:${rule.scope}`
    const list = index.get(key)
    if (list) {
      list.push(rule)
    } else {
      index.set(key, [rule])
    }
  }
  return index
})()

/**
 * 加载安装规则 — MVP 直接返回内置规则，未来 M3 阶段合并 aiforge.json 外部规则
 */
export function loadRules(): InstallRule[] {
  return BUILTIN_RULES
}
