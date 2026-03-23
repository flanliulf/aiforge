/**
 * 全局排除文件列表 — 安装时自动跳过这些文件
 *
 * 知识仓库中的辅助文件不应被安装到目标工具目录
 */
export const DEFAULT_EXCLUDES: string[] = [
  'README.md',
  'README',
  '.gitkeep',
  '.DS_Store',
  'mcp.json.example',
]
