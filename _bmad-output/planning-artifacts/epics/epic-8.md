---
stepsCompleted: ['multi-repo-product-analysis', 'epic-design', 'story-breakdown']
inputDocuments:
  - _bmad-output/planning-artifacts/epics/index.md
  - _bmad-output/planning-artifacts/architecture/03-core-decisions.md
  - _bmad-output/implementation-artifacts/stories/2-5-aiforge-init-interactive-setup.md
  - _bmad-output/implementation-artifacts/retrospectives/epic-7-retro-2026-05-20.md
project_name: 'ai-forge'
scope: 'Epic 8 candidate — 多 Git 仓库知识源编排'
created: '2026-05-21'
status: 'draft'
---

# ai-forge — Epic 8 多 Git 仓库知识源编排

## 背景

当前 ai-forge 的产品假设是：一次运行从一个知识仓库读取 `agents/`、`skills/`、`instructions/`、`mcp-tools/`，再按工具规则安装到本地。这个假设支撑了 MVP 和 v2.0 工具矩阵扩展，但在真实组织使用中会遇到多来源知识资产：平台团队维护基础 skills，业务团队维护领域 skills，安全团队维护 instructions，个人或项目还可能叠加专用配置。

早期 Story 2-5 明确排除了“多仓库配置”：MVP 只支持一个默认仓库。架构 D3a 已经把认证设计成按 host 分层，具备多仓库就绪基础，但仓库选择、克隆、安装计划合并、冲突处理和 manifest 追踪仍然是单仓语义。

## 产品边界

### 本 Epic 要解决的问题

让 aiforge 原生支持“多个知识仓库作为安装来源”，用户可以在一次 dry-run 或安装中显式选择多个仓库，并得到确定、可解释、可回滚的安装计划。同时，本地配置文件可以保存多个已知知识仓库来源，供用户反复选择；但默认知识仓库仍然只有一个，避免无参数安装从单仓语义悄悄变成多仓语义。

### 本 Epic 不解决的问题

**聚合知识仓库建设不属于本 Epic。** 如果团队希望通过 Git submodule、同步脚本、CI 或发布流程把多个来源聚合成一个标准 `skills/` 目录，那是另一个产品或平台治理问题。aiforge 可以消费最终聚合仓库，但不负责构建、调度或审计这个聚合系统。

本 Epic 也不实现远程仓库发现服务、权限申请工作流、组织级仓库目录市场、Web UI 管理后台。

## 当前状态证据

- 配置结构只有 `defaultRepo?: string`，没有仓库列表字段；`auth` 已按 hostname 存储，具备跨 host 认证基础。
- CLI 主命令只有一个可选 `[repo-url]` 参数。
- `resolve-source` 阶段只在 `args.source` 和 `config.defaultRepo` 之间选择一个 URL。
- Pipeline 当前是单链路：`Resolve → Auth → Clone → Detect → Match → Install → Report`，没有多仓循环和计划合并层。
- Manifest 当前记录 source 相对路径、target、tool、scope、mode、hash，但不记录来源仓库身份。

## 用户与 Job-to-be-Done

### 平台维护者

当公司有平台级 AI 配置和多个团队级扩展时，我想让用户一次安装所有被批准的来源，而不用记住多条命令，这样我能保证基础规则被安装，同时允许团队自治。

### 业务团队负责人

当我的团队维护自己的领域 skills 时，我想让它们与公司基础仓库一起分发，但不能静默覆盖平台仓库的同名文件，这样我能扩展能力而不制造不可解释的冲突。

### 普通开发者

当我加入不同项目时，我想选择“公司基础 + 当前项目推荐仓库”，并在 dry-run 中看清每个文件来自哪里，这样我能放心执行安装。

### CI / 项目模板维护者

当项目模板需要固定安装多个仓库中的规则时，我想在脚本中声明仓库列表和冲突策略，这样 onboarding 可以自动化且结果稳定。

## 需求清单

> 为避免现有 FR 编号冲突，本 Epic 暂用 `E8-FR-*` 编号。正式合并 PRD 时再统一 renumber。

### Functional Requirements

- E8-FR-001: 系统支持在配置文件中保存多个命名知识仓库来源，每个来源至少包含 `id`、`url`、`enabled`、`priority`。
- E8-FR-002: 系统保持向后兼容：没有多仓配置时，`defaultRepo` 和单个 `[repo-url]` 的行为与当前版本完全一致。
- E8-FR-003: 用户可以通过 CLI 显式选择一个或多个仓库来源，例如通过仓库 id 或 URL；CLI 选择优先于默认仓库。
- E8-FR-004: 系统只允许配置一个默认知识仓库；无参数安装时只使用该默认仓库，不自动安装所有已保存来源。
- E8-FR-004a: 用户可以在本地配置中保留多个非默认知识仓库来源，并通过 CLI 或交互入口选择它们参与本次 dry-run / 安装。
- E8-FR-005: 系统对每个仓库独立执行 resolve/auth/clone/update，并在输出中标明当前处理的仓库 id。
- E8-FR-006: 系统将多个仓库产出的安装计划合并为一个 source-aware plan，dry-run 必须显示每个计划项的来源仓库。
- E8-FR-007: 当多个仓库写入同一目标路径且内容不同，系统默认 fail-fast，报告跨源冲突，不静默按顺序覆盖。
- E8-FR-008: 当多个仓库写入同一目标路径且内容相同，系统可合并为一个安装项，并在 dry-run 中标记重复来源。
- E8-FR-009: Manifest 必须记录来源仓库身份，支持区分同一路径来自哪个 repository id，避免后续更新时来源混淆。
- E8-FR-010: 用户可以通过过滤参数限制安装范围；过滤结果必须按来源仓库分组展示零匹配和可安装项。
- E8-FR-011: `--list` 在多仓场景下必须显示仓库标签，并允许用户只列举特定仓库或全部选中仓库。
- E8-FR-012: 认证仍按 host 复用现有链路；多 host 场景下每个 host 的失败必须明确归因到对应仓库。
- E8-FR-013: 多仓模式下全局安装、项目安装、复制模式、符号链接模式和通用目录安装的语义必须与单仓模式一致。
- E8-FR-014: 多仓模式下输出汇总必须按“工具 → 目标目录 → 来源仓库”提供足够可追溯信息。
- E8-FR-015: 系统提供配置迁移路径，允许用户继续只使用 `defaultRepo`，也允许逐步迁移到多仓配置。

### Non-Functional Requirements

- E8-NFR-001: 单仓行为零回归；现有 CLI、配置文件、manifest 和测试必须继续通过。
- E8-NFR-002: 多仓 dry-run 输出必须足够确定，可被用户用于审查跨源冲突和覆盖风险。
- E8-NFR-003: 默认安全策略是不覆盖跨源冲突；任何优先级覆盖能力都必须显式配置或显式 CLI 开启。
- E8-NFR-004: Token 不进入日志、manifest、错误输出；仓库 URL 输出使用已有 sanitize 规则。
- E8-NFR-005: 多仓安装失败时保留 fail-fast 语义，并报告已完成仓库、当前失败仓库和未执行仓库。
- E8-NFR-006: 多仓配置读取和计划合并不能引入循环依赖，继续遵守现有模块边界。
- E8-NFR-007: 三仓以内常见安装场景的额外耗时主要来自 Git 网络操作；本地 plan merge 开销应低于 500ms。

## 推荐产品设计

### 配置模型

保留现有字段，新增可选多仓字段：

```jsonc
{
  "defaultRepo": "https://your-git-host.com/platform/base-ai-configs.git",
  "defaultRepository": "platform",
  "repositories": [
    {
      "id": "platform",
      "url": "https://your-git-host.com/platform/base-ai-configs.git",
      "enabled": true,
      "priority": 10,
      "description": "Company baseline AI rules"
    },
    {
      "id": "team-java",
      "url": "https://your-git-host.com/team/java-ai-configs.git",
      "enabled": true,
      "priority": 20,
      "description": "Java team domain skills"
    }
  ],
  "auth": {
    "your-git-host.com": { "method": "ssh" }
  }
}
```

设计原则：

- `defaultRepo` 继续服务单仓兼容路径，不要求用户迁移。
- `defaultRepository` 是默认来源的稳定 id；它必须指向 `repositories[]` 中的一个条目。新配置优先使用 `defaultRepository`，旧配置继续使用 `defaultRepo`。
- `repositories[]` 是“已知来源目录”，可以保存多个仓库，供 CLI 或 init 选择；它不是默认安装集合。
- `repositories[].id` 是本地稳定身份，出现在 dry-run、manifest、冲突提示和报告里。
- `priority` 只用于排序和未来显式 overlay 策略；MVP 多仓不应依赖优先级静默覆盖冲突。
- `auth` 继续按 hostname 复用，不在 repository 对象里重复保存 token。
- 不建议安装命令在用户仅传入临时 URL 时自动写入 `repositories[]`。如需保存为已知来源，应通过 `aiforge init` / source 管理入口确认，或显式使用未来的 `--save-source` 类参数。

### CLI 选择语义

保持当前命令不变：

```bash
npx @fancyliu/aiforge
npx @fancyliu/aiforge https://your-git-host.com/team/ai-configs.git
```

新增多仓选择建议：

```bash
# 无参数：只使用单一默认知识仓库
npx @fancyliu/aiforge

# 通过 id 选择多个已配置仓库
npx @fancyliu/aiforge --repo platform --repo team-java

# 临时使用多个 URL，不写入配置
npx @fancyliu/aiforge --repo https://your-git-host.com/platform/base.git --repo https://your-git-host.com/team/java.git

# 预览全部已保存且启用的仓库（显式多仓模式）
npx @fancyliu/aiforge --all-repos --dry-run
```

默认行为原则：

- `npx @fancyliu/aiforge` 始终只使用一个默认知识仓库。
- `repositories[]` 只是本地保存的来源目录，不等于默认安装集合。
- 多仓安装必须通过 `--repo ... --repo ...`、`--all-repos` 或后续交互选择显式触发。
- 这样做的原因是减少意外安装面：用户无参数运行时，期望仍是“安装默认知识仓库”，而不是“安装所有曾经保存过的来源”。

需要在设计阶段进一步确认的命名：`--repo` 是否与现有 positional `repo-url` 混淆。如果实现成本或用户理解成本过高，可改为 `--source` / `--sources`。

### Pipeline 设计

推荐引入一个多仓编排层，而不是把多仓逻辑塞进现有每个 stage：

```text
ResolveSources → AuthSources → CloneSources → Detect → MatchPerSource → MergePlans → [Install] → Report
```

关键点：

- `Detect` 仍然只检测本地 AI 工具环境，不应按仓库重复执行。
- `MatchPerSource` 对每个 `LocalRepo` 使用同一套规则，产出带 `repositoryId` 的 plan item。
- `MergePlans` 是新增边界，负责跨源重复项、冲突、排序和 dry-run 可解释性。
- Install 阶段尽量复用现有执行逻辑，但输入 item 必须携带来源仓库信息。
- SaveManifest 必须保存来源仓库字段，避免后续更新不知道文件来自哪个源。

### 冲突策略

第一版必须保守：

1. 同一目标路径 + 同一内容 hash：合并为重复来源，不重复写入。
2. 同一目标路径 + 不同内容 hash：默认 `CROSS_SOURCE_CONFLICT` fatal。
3. 用户手写文件冲突：继续走现有交互式冲突处理。
4. 未来 overlay 模式：只有当配置显式声明某仓库可覆盖另一仓库时，才允许按 priority 处理。

为什么要这样做：多仓最危险的不是“装不上”，而是用户以为装的是公司基线，实际被团队仓库同名文件悄悄覆盖。默认阻断比默认覆盖更符合信任建设。

### Manifest 设计

建议新增可选字段，保持旧 manifest 可读：

```typescript
interface ManifestEntry {
  source: string
  target: string
  tool: string
  scope: 'global' | 'project'
  mode: 'copy' | 'symlink' | 'flatten'
  hash: string
  installedAt: string
  repositoryId?: string
  repositoryUrlHash?: string
}
```

- `repositoryId` 用于用户可理解的来源标识。
- `repositoryUrlHash` 用于区分临时 URL 或 id 重命名后的来源，不直接暴露内部 URL。
- 旧条目没有 repository 字段时视为 legacy single-source，下一次更新可在报告中提示用户迁移。

## Story 拆分

### Story 8-1: 多仓产品契约与配置模型

As a 平台维护者，
I want 在配置中声明多个命名知识仓库并保持旧配置继续可用，
So that 团队可以保留多个可选来源，同时无参数安装仍保持单一默认仓库的可预测行为。

Acceptance Criteria:

- `AiforgeConfig` 新增可选 `repositories` 和 `defaultRepository` 字段，旧 `defaultRepo` 保持可用。
- 配置校验拒绝重复 repository id、空 id、空 URL、非法 priority。
- `loadConfig()` 能读取旧配置，不要求迁移。
- 配置校验要求 `defaultRepository` 指向已存在且 enabled 的 repository id；旧 `defaultRepo` 无需该约束。
- 新增测试覆盖旧配置、新配置、重复 id、未知默认 id、disabled 默认 id。
- 文档说明 `defaultRepo`、`defaultRepository` 与 `repositories` 的兼容关系，并明确 `repositories[]` 不代表默认安装集合。

### Story 8-2: 多仓 CLI 选择与 init 管理入口

As a 开发者，
I want 通过 CLI 选择多个仓库，或通过 init 管理已保存来源和唯一默认仓库，
So that 我不需要手写 JSON 才能使用多仓安装。

Acceptance Criteria:

- CLI 支持显式选择多个仓库 id 或 URL，且不破坏现有 `[repo-url]`。
- 无参数时只使用一个默认仓库：优先 `defaultRepository` 指向的 repository；不存在时回退 `defaultRepo`。
- `aiforge init` 支持查看、添加、禁用或删除 repository 条目，并支持设置唯一默认 repository，保留现有单仓初始化路径。
- 临时 URL 不应默认写入配置；若需要保存为已知来源，必须有显式确认步骤。
- 非 TTY 场景下不进入交互式仓库管理，输出可操作错误。
- CLI help 和配置文档更新。

### Story 8-3: 多仓 Resolve/Auth/Clone 编排

As a 使用多个私有知识仓库的用户，
I want 每个仓库都能独立解析、认证、克隆和更新，
So that 多 host、多认证方式的安装过程可诊断且不会互相污染。

Acceptance Criteria:

- 引入 source collection 数据结构，包含 repository id、url、resolved source、authenticated source、local repo。
- 每个仓库独立执行认证链，失败信息包含 repository id。
- 本地克隆目录按 repository id 或 URL hash 隔离，避免同名 repo path 互相覆盖。
- Token 清理、sanitize、clone 失败清理沿用现有规则。
- 多仓模式下 `--clone-dir` 语义明确：要么拒绝歧义，要么作为 clone root 并为每个仓库创建子目录。

### Story 8-4: 多仓计划合并、dry-run 与 manifest 来源追踪

As a 审查安装计划的用户，
I want dry-run 显示每个文件来自哪个仓库，并在安装后 manifest 记录来源，
So that 我能追踪后续更新和冲突来源。

Acceptance Criteria:

- Match 阶段对每个仓库产出 source-aware plan item。
- 新增 MergePlans 步骤处理重复项、排序和跨源冲突。
- dry-run 输出包含 repository id，并按工具和来源分组。
- Manifest 新增可选 repository 字段，旧 manifest 正常读取。
- 保存 manifest 时不写入 token-bearing URL。

### Story 8-5: 跨源冲突处理与用户指导

As a 平台维护者，
I want 多仓冲突默认阻断并给出明确修复建议，
So that 用户不会在不知情的情况下安装被覆盖的配置。

Acceptance Criteria:

- 同一目标路径不同内容触发 `CROSS_SOURCE_CONFLICT`。
- 错误输出包含冲突目标、来源仓库 id、源路径和建议操作。
- 建议操作至少包含：使用 `--filter` 缩小范围、调整仓库集合、重命名源文件、改用聚合知识仓库。
- 同一目标路径相同内容不会重复写入，并在 dry-run 中标记为 duplicate identical。
- 新增集成测试覆盖两个仓库写入同一路径的相同内容与不同内容。

### Story 8-6: 多仓文档、迁移与发布验收

As a 新老用户，
I want 清楚知道当前单仓配置、临时多仓命令和新多仓配置的差别，
So that 我能选择合适的迁移路径。

Acceptance Criteria:

- README、configuration 文档和 troubleshooting 增加多仓章节。
- 文档明确“聚合知识仓库”是可选组织治理方案，不是 aiforge 内置聚合能力。
- migration guide 说明从 `defaultRepo` 迁移到 `repositories` 的步骤。
- 发布验收包含单仓回归、多仓 dry-run、多仓冲突、多 host 认证测试。

## 开放问题

1. 多仓 CLI 命名应使用 `--repo` 还是 `--source`？`--repo` 贴近现有术语，但可能和 positional `[repo-url]` 混淆。
2. `--clone-dir` 在多仓模式下应拒绝还是作为 root？为了兼容性，推荐第一版拒绝歧义，并新增 `cloneRoot`。
3. 是否要在第一版支持 overlay 覆盖？推荐不支持，只保留 priority 字段作为未来扩展。
4. 临时 URL 多仓运行是否需要稳定 id？推荐自动生成短 id 并在输出中展示 URL 的脱敏短标识。
5. 多仓 `--list` 是否默认列出所有仓库，还是要求指定仓库？推荐默认列出选中仓库，并按来源分组。

## MVP 切片建议

第一版不要做完整 overlay、仓库市场或聚合平台。最小有价值切片是：

1. 配置里能声明多个仓库。
2. CLI 能选择多个仓库。
3. 一次 dry-run 能看到跨仓计划。
4. 同目标不同内容默认阻断。
5. Manifest 能记录来源仓库。

这个切片验证的核心假设是：用户真正需要的是“一次运行多来源且结果可信”，不是“aiforge 帮组织治理所有知识来源”。
