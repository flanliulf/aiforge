import type { ToolDefinition } from '../core/types.js'

/**
 * AI 工具检测注册表 — 基于标志性文件/目录存在性检测，不依赖工具进程（NFR-I3）
 *
 * 来源: architecture/03-core-decisions.md#D5
 * v2.0 变更: VS Code 归并到 GitHub Copilot 语境（Breaking Change）
 */
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    id: 'copilot',
    name: 'GitHub Copilot',
    detect: {
      global: ['~/.copilot'],
      project: ['.github'],
    },
  },
  {
    id: 'claude',
    name: 'Claude Code',
    detect: {
      global: ['~/.claude'],
      project: ['.claude'],
    },
  },
  {
    id: 'cursor',
    name: 'Cursor',
    detect: {
      global: ['~/.cursor'],
      project: ['.cursor'],
    },
  },
  {
    id: 'codex',
    name: 'Codex CLI',
    detect: {
      global: ['~/.codex'],
      project: ['.codex'],
    },
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    detect: {
      global: ['~/.config/opencode'],
      project: ['.opencode'],
    },
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    detect: {
      global: ['~/.codeium/windsurf'],
      project: ['.windsurf'],
    },
  },
  {
    id: 'auggie',
    name: 'Auggie (Augment Code)',
    detect: {
      global: ['~/.augment'],
      project: ['.augment'],
    },
  },
  {
    id: 'gemini',
    name: 'Gemini CLI',
    detect: {
      global: ['~/.gemini'],
      project: ['.gemini'],
    },
  },
  {
    id: 'kiro',
    name: 'Kiro (AWS)',
    detect: {
      global: ['~/.kiro'],
      project: ['.kiro'],
    },
  },
]
