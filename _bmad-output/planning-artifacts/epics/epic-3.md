## Epic 3: 智能检测与安装规划

系统自动检测已安装的 AI 工具，生成安装计划。用户可以通过 `--dry-run` 预览"哪些文件会安装到哪里"，建立信任。

### Story 3.1: AI 工具自动检测

As a 用户,
I want 系统自动识别我安装了哪些 AI 编码工具,
So that 不需要手动指定就能为所有工具安装配置。

**Acceptance Criteria:**

**Given** 用户环境中安装了 Copilot（存在 `~/.copilot/` 或 `.github/`）
**When** 执行工具检测
**Then** 检测到 copilot 工具，返回 `DetectedEnv` 包含该工具（FR-013）

**Given** 用户环境中安装了多个工具（Copilot + Claude + Cursor）
**When** 执行工具检测
**Then** 返回所有检测到的工具列表

**Given** 用户通过 `--tools copilot claude` 手动指定
**When** 执行工具检测
**Then** 跳过自动扫描，直接使用用户指定的工具列表（FR-014）
**And** 指定的工具 ID 在 `TOOL_DEFINITIONS` 中查找，无效 ID 报错

**Given** 自动检测未发现任何工具
**When** 检测完成
**Then** 触发诊断输出：列出扫描了哪些路径、检测了哪些标志文件、建议安装哪些工具（FR-015）
**And** 抛出 `AiforgeError`（severity: 'fatal'）

**Given** 工具检测过程
**When** 测量扫描耗时
**Then** 4 工具全扫描 < 500 毫秒（NFR-P5）

**Given** 工具检测逻辑
**When** 检查实现方式
**Then** 基于 `TOOL_DEFINITIONS` 注册表的标志路径检测，不依赖工具进程是否运行（NFR-I3）

### Story 3.2: 规则匹配引擎

As a 用户,
I want 系统根据检测到的工具和安装范围自动匹配安装规则,
So that 知道哪些文件需要安装到哪里。

**Acceptance Criteria:**

**Given** 检测到 copilot 工具，安装范围为全局（`-g`）
**When** 执行规则匹配
**Then** 从 `BUILTIN_RULES` 中匹配出 copilot:global 的所有规则（agents→files、skills→directories、instructions→files、mcp-tools→files）
**And** 返回 `MatchedPlan` 包含每条规则对应的源文件和目标路径（FR-023）

**Given** 用户指定 `--dirs skills agents`
**When** 执行规则匹配
**Then** 只匹配 `sourceDir` 为 skills 或 agents 的规则，过滤掉其他资源类型（FR-024）

**Given** 知识仓库中存在 `README.md`、`.gitkeep`、`.DS_Store`
**When** 执行规则匹配
**Then** 这些文件被全局排除列表过滤，不出现在 `MatchedPlan` 中（FR-045）

**Given** 规则匹配引擎
**When** 检查实现方式
**Then** 使用 `Map<string, InstallRule[]>` 索引，key 为 `${tool}:${scope}`，O(1) 查找
**And** 新增工具只需在 `BUILTIN_RULES` 添加数据，不改引擎代码（FR-043）

**Given** 规则映射表
**When** 检查支持的安装类型
**Then** 支持 `files`、`directories`、`flatten` 三种类型（FR-044）

### Story 3.3: dry-run 预览与安装计划输出

As a 用户,
I want 在实际安装前预览完整的安装计划,
So that 知道会发生什么，建立对工具的信任。

**Acceptance Criteria:**

**Given** 用户运行 `npx aiforge --dry-run`
**When** 管道执行到 Match 阶段完成
**Then** 跳过 Install 阶段，直接将 `MatchedPlan` 传给 Reporter（FR-034）
**And** 管道在 Match 后分叉，架构保证 dry-run 与实际安装使用相同的匹配结果

**Given** dry-run 模式
**When** Reporter 输出安装计划
**Then** 按工具分组展示每个文件的源路径和目标路径
**And** 标注安装类型（files/directories/flatten）和模式（copy/symlink）
**And** 输出到 stdout（可被管道消费）

**Given** dry-run 模式
**When** 检查文件系统
**Then** 没有任何文件被写入、复制或创建

**Given** dry-run 输出的安装计划
**When** 与实际安装结果对比
**Then** 两者一致（NFR-U5）——相同的文件列表、相同的目标路径

**Given** dry-run 模式下管道执行
**When** 检查管道编排器
**Then** Resolve → Auth → Clone → Detect → Match 全部正常执行
**And** 只有 Install 阶段被跳过

---
