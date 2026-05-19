// Pipeline data contracts — all stage input/output interfaces

export type Severity = 'fatal' | 'partial'

export type AuthMethod = 'ssh' | 'token' | 'credential-manager'

export enum InstallType {
  Files = 'Files',
  Directories = 'Directories',
  Flatten = 'Flatten',
}

// Stage 1 output: parsed CLI arguments
export interface ParsedArgs {
  source: string
  global: boolean
  link: boolean
  tools: string[]
  dirs: string[]
  dryRun: boolean
  quiet: boolean
  force: boolean
  ssh: boolean
  token?: string
  cloneDir?: string
  list?: string
  filter?: string
  noUniversal: boolean
  // legacy aliases kept for internal use
  symlink: boolean
  flatten: boolean
  language?: string
}

// Stage 2 output: resolved knowledge source
export interface ResolvedSource {
  hostname: string
  repoPath: string
  protocol: 'https' | 'ssh'
}

// Stage 3 output: authenticated source with clone URL
export interface AuthenticatedSource extends ResolvedSource {
  authMethod: AuthMethod
  cloneUrl: string
}

// Stage 4 output: local repository on disk
export interface LocalRepo {
  repoDir: string
  isNew: boolean
  sourceFiles: string[]
}

// Stage 5 output: detected AI tool environment
export interface DetectedEnv {
  tools: string[]
  scope: 'global' | 'project'
}

// Stage 6 output: matched install plan
export interface MatchedPlan {
  items: Array<{
    rule: InstallRule
    sourceFiles: string[]
    targetPath: string
    /** 安装方式：copy 或 symlink（不表示规则类型；manifest 中 Flatten 规则写入 'flatten' 由 pipeline 层负责） */
    mode: 'copy' | 'symlink'
  }>
}

// Stage 7 output: install result
export interface InstallResult {
  items: Array<{
    status: 'new' | 'updated' | 'skipped'
    /** 安装该文件的 AI 工具内部 id，用于按工具分组输出结果 */
    tool: string
    /** 工具显示名称（如 'GitHub Copilot'），由上游从 tool-registry 查找填充；TTY 输出标题使用 */
    toolDisplayName?: string
    /** 安装主目录的用户可读简写（如 '~/.claude/skills/'、'.agents/skills/'），供 TTY 分组显示 */
    targetGroupLabel?: string
    /** 安装主目录的本地解析路径，用于在缺少 label 时兜底分组 */
    targetGroupPath?: string
    /** 结果项需要用户后续手动处理的动作，不改变 status 三态统计 */
    manualAction?: 'mcp-merge-required'
    sourcePath: string
    targetPath: string
  }>
}

// Data structure: install rule definition
export interface InstallRule {
  tool: string
  scope: 'global' | 'project'
  sourceDir: string
  type: InstallType
  targetDir: string
  /** 可选白名单；仅分发列出的 basename（如 AGENTS.md / CLAUDE.md） */
  fileFilter?: string[]
  /** flatten 模式下的主文件名（默认 'index.md'），仅 type=Flatten 时有效 */
  mainFile?: string
  /** 语义差异提示键；存在时需在安装前提示用户确认 */
  semanticWarning?: string
}

// Data structure: AI tool definition for detection
export interface ToolDefinition {
  id: string
  name: string
  detect: {
    global: string[]
    project: string[]
  }
}

// Data structure: manifest entry for tracking installed files
export interface ManifestEntry {
  source: string
  target: string
  tool: string
  scope: 'global' | 'project'
  mode: 'copy' | 'symlink' | 'flatten'
  hash: string
  installedAt: string
}

// Data structure: per-host authentication config
export interface HostAuth {
  method: 'ssh' | 'token'
  token?: string
}

// Data structure: aiforge configuration file
export interface AiforgeConfig {
  defaultRepo?: string
  cloneDir?: string
  language?: string
  preferSSH?: boolean
  universalDirs?: boolean
  auth: Record<string, HostAuth>
}
