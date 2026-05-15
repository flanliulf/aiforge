## Epic 4: 安装执行与冲突保护

用户可以安全地将配置安装到所有检测到的工具中。支持复制/符号链接/flatten 三种模式，冲突时有备份保护，安装结果按工具分组展示。

### Story 4.1: 文件操作工具与预检查

As a 用户,
I want 系统在安装前验证目标路径的可写性和权限,
So that 不会在安装过程中因权限问题半途失败。

**Acceptance Criteria:**

**Given** `services/fs-utils.ts` 已创建
**When** 检查提供的工具函数
**Then** 包含：文件复制、目录复制、符号链接创建、文件备份、权限检查等操作
**And** 所有路径操作使用 `path.join()`（NFR-C5）

**Given** `MatchedPlan` 中包含多个目标路径
**When** 执行预检查（preflight）
**Then** 验证所有目标路径的父目录可写
**And** 验证当前用户有足够权限创建/覆盖文件（FR-030）

**Given** 目标目录不存在
**When** 执行预检查
**Then** 标记该目录需要创建（NFR-R2）

**Given** 某个目标路径无写入权限
**When** 预检查失败
**Then** 立即 fail-fast，抛出 `AiforgeError`（severity: 'fatal'）
**And** 不执行任何文件操作

**Given** 目标路径包含 `../` 路径遍历
**When** 执行预检查
**Then** 检测到路径遍历并拒绝，抛出安全错误（NFR-S5）

### Story 4.2: 复制模式安装执行

As a 用户,
I want 将知识仓库的配置文件复制到 AI 工具的目标目录,
So that 各工具能读取到正确的配置内容。

**Acceptance Criteria:**

**Given** `MatchedPlan` 中有 `type: 'files'` 的规则（如 agents → `~/.copilot/agents/`）
**When** 执行安装
**Then** 将源文件逐个复制到目标目录（FR-019）
**And** 目标目录不存在时自动创建（NFR-R2）

**Given** `MatchedPlan` 中有 `type: 'directories'` 的规则（如 skills → `~/.copilot/skills/`）
**When** 执行安装
**Then** 将源目录整体复制到目标位置，保持目录结构

**Given** 安装范围为全局（`-g`）
**When** 执行安装
**Then** 目标路径为用户 Home 目录下的工具配置目录（FR-016）

**Given** 安装范围为项目（默认）
**When** 执行安装
**Then** 目标路径为当前项目目录下的工具配置目录（FR-017）

**Given** 知识仓库包含 agents、skills、instructions、mcp-tools 四类资源
**When** 执行安装
**Then** 四类资源全部正确安装到对应目标路径（FR-018）

**Given** 安装过程中某个文件操作失败
**When** 错误发生
**Then** 立即停止后续安装（fail-fast），输出已完成的操作清单（FR-031）

### Story 4.3: 符号链接与 flatten 模式

As a 用户,
I want 使用符号链接模式实现 git pull 即更新，使用 flatten 模式适配 Cursor 的目录约定,
So that 日常更新零额外操作，且每个工具都能正确读取配置。

**Acceptance Criteria:**

**Given** 用户指定 `-g -l`（全局 + 符号链接）
**When** 执行安装
**Then** 在目标位置创建指向持久化仓库文件的符号链接（FR-020）
**And** 后续 `git pull` 更新仓库后，符号链接自动指向新内容

**Given** 用户指定 `-l` 但未指定 `-g`（项目级 + 符号链接）
**When** 解析参数
**Then** 拒绝执行，抛出 `AiforgeError`（severity: 'fatal'），提示符号链接仅支持全局安装（FR-021）

**Given** Cursor 工具的 skills 规则（`type: 'flatten'`）
**When** 执行安装
**Then** 将 `skills/code-review/` 目录扁平化：提取主文件（如 `index.md`），重命名为 `code-review.md`，复制到 `.cursor/rules/`（FR-022）

**Given** flatten 模式下源目录包含多个文件
**When** 执行安装
**Then** 按 `mainFile` 规则选择主文件（默认 `index.md`），其他文件忽略

**Given** 符号链接目标文件被删除（源仓库被移动）
**When** 检查链接状态
**Then** 检测到断链并输出明确警告（NFR-R6）

### Story 4.4: manifest 状态管理与冲突检测

As a 用户,
I want 系统追踪所有已安装文件的状态,
So that 能区分"aiforge 安装的"和"我手写的"文件，避免意外覆盖。

**Acceptance Criteria:**

**Given** `services/manifest.ts` 已创建
**When** 安装完成后
**Then** 将所有已安装文件记录到 `~/.aiforge/manifest.json`（FR-025）
**And** 每条记录包含：`source`、`target`、`tool`、`scope`、`mode`、`hash`（SHA256）、`installedAt`

**Given** manifest.json 写入
**When** 执行写入操作
**Then** 使用原子写入：先写临时文件，再 `fs.rename()` 替换（防止写入中断导致损坏）

**Given** 目标路径已存在文件
**When** 检查 manifest.json
**Then** 如果文件在 manifest 中且 hash 匹配 → 标记为"aiforge 安装，已是最新"
**And** 如果文件在 manifest 中但 hash 不匹配 → 标记为"aiforge 安装，有更新"
**And** 如果文件不在 manifest 中 → 标记为"用户手写文件"（FR-026）

**Given** manifest.json 损坏或丢失
**When** 读取 manifest
**Then** 降级为空 manifest，所有已存在文件视为"未知来源"（NFR-R5）

### Story 4.5: 冲突处理与安全保护

As a 用户,
I want 系统在检测到文件冲突时保护我的手写文件,
So that 不会丢失花时间调试的自定义配置。

**Acceptance Criteria:**

**Given** 目标路径存在用户手写文件（不在 manifest 中）
**When** 安装需要写入该路径
**Then** 提供交互式选项：覆盖 / 跳过 / 备份后覆盖（推荐）/ 查看差异 / 中止（FR-027）

**Given** 用户选择"备份后覆盖"
**When** 执行安装
**Then** 将用户文件备份为 `{filename}.aiforge-backup-{YYYYMMDD}`（FR-028）
**And** 然后执行正常安装

**Given** 用户指定 `--force`
**When** 检测到冲突
**Then** 跳过交互式确认，直接覆盖（FR-029）

**Given** 非 TTY 环境下检测到冲突
**When** 需要用户决策
**Then** 直接失败（不进入交互式选择），exit code = 1

**Given** 安装结果中未产生任何可处理项（`resultItems.length === 0`，如未匹配到任何文件或目标目录为空）
**When** 安装完成
**Then** 触发零结果诊断：输出扫描了哪些目录、匹配了哪些规则、建议如何修复（FR-032）；扫描目录与匹配规则超 5 条时折叠为「… 其余 N 项已折叠」；修复建议不含 `--force`

**Given** 安装结果中所有项均为 `skipped`（`resultItems.length > 0` 但无 `new` / `updated`）
**When** 安装完成
**Then** 视为成功路径，输出「没有新增/更新文件，全部已是最新或被跳过」成功摘要（灰色），**不**触发诊断警告

**Given** 临时文件在安装过程中创建
**When** 安装完成（无论成功或失败）
**Then** 所有临时文件被清理删除（NFR-S6）

### Story 4.6a: 管道完整编排与错误流控制

As a 开发者,
I want 管道编排器串联所有已实现的阶段并正确处理错误流,
So that 正常模式下完整管道可端到端运行。

**Acceptance Criteria:**

**Given** 正常模式（非 dry-run）
**When** 执行管道
**Then** 完整执行 Resolve → Auth → Clone → Detect → Match → Install → Report
**And** `ParsedArgs` 由编排器持有，按需注入各阶段

**Given** 管道执行中某阶段抛出 `severity: 'fatal'` 错误
**When** 错误发生
**Then** 管道立即停止，输出已完成的操作清单（FR-031，NFR-R4）

**Given** 管道执行中某阶段抛出 `severity: 'partial'` 错误
**When** 错误被收集
**Then** 管道继续执行后续文件，最终汇总所有 partial 错误

### Story 4.6b: 安装结果汇总与输出流分工

As a 用户,
I want 看到清晰的安装结果汇总,
So that 知道哪些文件安装成功、更新、跳过或失败。

**Acceptance Criteria:**

**Given** 安装执行完成
**When** Reporter 输出结果
**Then** 按工具分组展示每个文件的状态：✅ 新建、🔄 更新、⏭️ 跳过、❌ 失败
**And** 显示统计行：`安装: N 项  更新: N 项  跳过: N 项  失败: N 项`

**Given** 安装结果
**When** 检查输出流
**Then** 结果输出到 stdout（可被 `grep`/`awk` 解析），错误输出到 stderr

---

## 后续修订（2026-04-24 UX 收敛）

> 本次修订源于安装阶段 UX 收敛（零结果诊断分支拆分 + 明细折叠阈值）。已原地更新上文 AC，本块保留变更对照供审计追溯。

| 章节 / 行 | 变更前 | 变更后 | 依据 |
|----------|--------|--------|------|
| AC·零结果诊断（L152 附近） | 单一 G/W/T：安装结果为零项走诊断 | 拆分为两个 G/W/T：`length===0` 走诊断 / 全部 skipped 走成功摘要 | 代码：src/stages/execute-install.ts / 测试：tests/integration/edge-cases.test.ts |
| AC·明细输出 | 未明确折叠阈值 | 扫描目录与匹配规则超 5 条折叠；修复建议不含 `--force` | 代码：src/core/reporter.ts `MAX_TTY_RESULT_DETAILS_PER_TOOL=5` |
