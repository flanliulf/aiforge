---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture/index.md
date: 2026-04-13
---

## Epic 6: 精细化安装控制与通用目录适配

用户可以通过 `--list` 探索仓库结构、通过 `--filter` 精准安装指定子目录；aiforge 同时默认将配置写入行业新兴通用目标目录（`.agents/`、`.agent/`），确保跨工具兼容性。

**FRs 覆盖：** FR-047, FR-048, FR-049, FR-050, FR-051, FR-052, FR-053（共 7 条）
**关键交付：** `--list` 子命令逻辑 + `--filter` 参数解析与 Match 阶段过滤 + `BUILTIN_RULES` 通用目录规则 + `config.json universalDirs` 字段 + `aiforge init` 新增偏好步骤
**NFRs：** NFR-P6, NFR-U6, NFR-C7

---

### Story 6-1: `--list` 子目录内容列举

作为一名开发者，
我想在执行安装之前，通过 `aiforge install --list <dir>` 列出仓库指定顶层目录下所有可安装的子目录，
以便我清楚地知道可以选择安装哪些内容，再决定是否使用 `--filter`。

**Acceptance Criteria:**

**Given** 用户已配置仓库（本地或远端），仓库中存在 `skills/` 目录，其下有 `git-commit/`、`code-review/`、`deploy/` 三个子目录
**When** 用户执行 `aiforge install --list skills`
**Then** 终端输出 `skills/` 下的所有子目录名称列表（如 `git-commit`、`code-review`、`deploy`）
**And** 输出格式清晰（每行一个条目，带序号或图标），不执行任何安装操作，命令在输出后正常退出（exit code 0）

**Given** 用户执行 `aiforge install --list nonexistent-dir`（指定目录在仓库中不存在）
**When** 命令执行
**Then** 输出三段式错误提示：目录不存在 → 仓库中没有该顶层目录 → 建议用 `--list` 搭配其他可用顶层目录名重试

**Given** 用户执行 `aiforge install --list skills`，`skills/` 目录存在但为空（无子目录）
**When** 命令执行
**Then** 输出提示"该目录下暂无可安装的子目录"，正常退出（exit code 0），不报错

**Given** 仓库为远端仓库（需 Clone，但持久化缓存已存在）
**When** 用户执行 `--list` 命令
**Then** 总耗时不超过 2 秒（缓存命中场景），满足 NFR-P6

---

### Story 6-2: `--filter` 精准子目录安装

作为一名开发者，
我想通过 `--filter <dir>/<glob>` 只安装仓库某顶层目录下名称匹配的子目录，
以便我不必安装整个仓库内容，只取我需要的几个 skill 或 agent。

**Acceptance Criteria:**

**Given** 仓库 `skills/` 下有 `git-commit/`、`git-push/`、`code-review/`、`deploy/` 四个子目录
**When** 用户执行 `aiforge install --filter skills/git*`
**Then** 只安装 `git-commit/` 和 `git-push/`，其余两个子目录不被安装
**And** 安装结果汇总中只展示匹配到的两个条目

**Given** 用户同时指定 `--dirs skills --filter skills/git*`
**When** 命令执行
**Then** `--dirs skills` 限定顶层目录为 `skills/`，`--filter skills/git*` 在此范围内筛选，结果与单独使用 `--filter skills/git*` 一致

**Given** 用户只指定 `--filter git*`（不带顶层目录前缀）
**When** 命令执行
**Then** 对所有顶层目录（`skills/`、`agents/` 等）下名称匹配 `git*` 的子目录均执行安装，不限定顶层目录范围

**Given** 用户执行 `--filter skills/xyz*`，但 `skills/` 下没有任何以 `xyz` 开头的子目录
**When** 命令执行
**Then** 触发交互式询问，展示 `skills/` 下所有可用子目录名称列表，满足 NFR-U6
**And** 提示用户修正 pattern 或选择取消，不直接以错误码退出

**Given** 用户在 `--dry-run` 模式下同时使用 `--filter`
**When** 命令执行
**Then** 预览计划中只展示匹配子目录的安装条目，与实际安装结果一致，满足 NFR-U5

---

### Story 6-3: 通用目标目录默认安装

作为一名开发者，
我想 aiforge 在安装时默认同时将配置写入通用目标目录（`.agents/skills/`、`.agents/agents/`、`.agent/skills/`、`.agent/agents/`），
以便我的项目能兼容多种 AI 工具的新兴目录约定，无需额外操作。

**Acceptance Criteria:**

**Given** 用户执行 `aiforge install`（不带任何额外参数），且 `config.json` 中 `universalDirs` 未设为 false
**When** 安装完成
**Then** 除写入 IDE 特定目录外，同时将对应资源完整复制到 `.agents/skills/`、`.agents/agents/`、`.agent/skills/`、`.agent/agents/`
**And** 目录结构与 IDE 特定目录一致（完整复制，不扁平化），满足 NFR-C7（复用现有安装引擎，不引入新代码路径）

**Given** 用户执行 `aiforge install --no-universal`
**When** 安装完成
**Then** 仅写入 IDE 特定目录，不写入任何通用目标目录

**Given** 已执行过一次安装（通用目录已有文件），仓库有更新后再次执行 `aiforge install`
**When** 安装执行
**Then** 系统检查通用目录中的已安装文件与仓库最新版本的哈希差异，有变更的文件重新写入，无变更的文件跳过
**And** `manifest.json` 中通用目录文件与 IDE 特定目录文件分开追踪（通过目标路径前缀区分，无需新增字段）

**Given** 用户执行 `--dry-run`
**When** 预览输出
**Then** 预览结果中包含通用目录的安装条目（与 IDE 目录并列展示），除非使用了 `--no-universal`

**Given** 目标项目目录中通用目录（如 `.agents/`）尚不存在
**When** 安装执行
**Then** 自动创建所需目录，安装正常完成，满足 NFR-R2

---

### Story 6-4: `aiforge init` 通用目录偏好配置

作为一名首次使用 aiforge 的开发者，
我想在 `aiforge init` 交互流程中设置是否默认安装通用目标目录，
以便我的偏好被持久化到 `config.json`，后续安装无需每次手动加 `--no-universal`。

**Acceptance Criteria:**

**Given** 用户首次运行 `aiforge init`
**When** 执行到通用目录配置步骤
**Then** 终端展示询问"是否默认安装通用目标目录（.agents/、.agent/）？[Y/n]"，默认值为 Y（直接回车即为启用）

**Given** 用户在 `aiforge init` 中选择"否"（输入 n）
**When** 初始化完成
**Then** `~/.aiforge/config.json` 中写入 `"universalDirs": false`

**Given** `config.json` 中 `universalDirs: false`，用户执行 `aiforge install`（不带 `--no-universal`）
**When** 安装执行
**Then** 不写入通用目录，行为等同于 `--no-universal`，CLI 参数 `--no-universal` 仍可显式触发（幂等）

**Given** `config.json` 中 `universalDirs: true`，用户执行 `aiforge install --no-universal`
**When** 安装执行
**Then** CLI 参数优先级高于配置文件，不写入通用目录（遵循三层优先级链：CLI > config > 默认值）

**Given** 已有 `config.json` 但缺少 `universalDirs` 字段（升级兼容场景）
**When** 执行 `aiforge install`
**Then** 系统将缺省值视为 `true`，默认安装通用目录，向下兼容，不报错
