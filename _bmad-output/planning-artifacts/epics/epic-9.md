---
stepsCompleted: ['universal-directory-research', 'epic-design', 'story-breakdown']
inputDocuments:
  - _bmad-output/planning-artifacts/epics/index.md
  - _bmad-output/planning-artifacts/epics/epic-6.md
  - _bmad-output/planning-artifacts/epics/epic-8.md
  - src/data/install-rules.ts
  - src/data/tool-registry.ts
project_name: 'ai-forge'
scope: 'Epic 9 candidate — Universal-first 安装策略与重复触发治理'
created: '2026-05-21'
status: 'draft'
---

# ai-forge — Epic 9 Universal-first 安装策略与重复触发治理

## 背景

Epic 6 引入了通用目录适配：项目级安装时，aiforge 默认在 IDE 专属目录之外，并行写入 `.agents/skills/`、`.agents/agents/`、`.agent/skills/`、`.agent/agents/`。这个设计在当时的目标是提升跨工具兼容性，让新兴 AI IDE 可以通过统一目录读取 agents 和 skills。

随着 Codex、OpenCode、Cursor、Windsurf、Gemini CLI、Antigravity 等工具的规则和技能体系快速演进，通用能力出现了分层：

- `AGENTS.md` 正在成为跨工具项目指令文件标准。
- `.agents/skills/` 已被部分工具明确作为 skill 发现目录。
- `.agent/skills/` 和 `.agents/agents/` 等目录并未被所有工具明确支持。
- 一些工具仍然主要依赖自己的专属目录，例如 `.cursor/rules/`、`.windsurf/rules/`、`.gemini/commands/`、`.codex/agents/`。

因此，当前“工具专属目录 + 通用目录”默认并行安装会带来两个相反风险：

1. 对已经读取 `.agents/skills/` 的工具，同一 skill 可能从工具专属目录和通用目录重复出现，造成重复触发、重复列表项或用户困惑。
2. 对尚未明确读取 `.agents/skills/` 的工具，如果直接改为只安装通用目录，可能出现“aiforge 显示安装成功，但目标 IDE 实际不读取”的假成功。

本 Epic 解决的不是“是否继续支持通用目录”，而是把通用目录从“默认并行追加”升级为“能力矩阵驱动的安装目标策略”。

## 产品边界

### 本 Epic 要解决的问题

让 aiforge 在项目级安装时根据目标工具能力选择合适的安装目标，默认优先使用已被目标工具明确支持的通用目录，同时避免同一内容被安装到多个会被同一 IDE 同时读取的位置。用户可以通过配置或 CLI 显式选择 universal-only、tool-specific-only 或 both 模式，以兼顾新标准、兼容性和排障需求。

### 本 Epic 不解决的问题

- 不定义行业通用目录标准，只消费各工具已公开或项目已验证的能力。
- 不把 `AGENTS.md` 支持等同于 `.agents/skills/` 支持。
- 不移除 IDE 专属安装规则；专属规则仍是未确认 universal 支持工具的安全默认路径。
- 不在本 Epic 中重新设计多仓库来源编排；多仓来源属于 Epic 8，Epic 9 只处理最终 install target selection。
- 不以 Claude Code 作为本轮 universal 目录能力判断的主要研究对象。本 Epic 重点覆盖除 Claude Code 外的 IDE / agent 工具生态。
- 不默认迁移或删除用户已有的专属目录文件；迁移清理需要显式操作或后续 Story。

## 当前状态证据

- `UNIVERSAL_RULES` 目前无条件追加 `.agents/skills/`、`.agents/agents/`、`.agent/skills/`、`.agent/agents/` 的项目级安装规则。
- `config.universalDirs` 和 `--no-universal` 只控制是否额外写入通用目录，不表达安装目标策略。
- Match 阶段当前是“工具规则 + universal 规则并列生成 plan”，没有能力矩阵、去重策略或“主目标目录”概念。
- Antigravity 的项目级 skills 规则目标是 `.agents/skills/`，这与 universal `.agents/skills/` 路径重合，已经存在同目标重复计划风险。
- 外部文档初步确认：Codex 和 OpenCode 明确支持 `.agents/skills/`；Cursor 和 Windsurf 明确支持 `AGENTS.md` 与自身 rules 目录，但未确认 `.agents/skills/`；Gemini CLI 支持 `GEMINI.md`、可配置 `AGENTS.md`、`.gemini/commands/` 和 extension skills，但未确认项目级 `.agents/skills/`；Antigravity 需进一步以官方技术文档确认具体目录。

## 用户与 Job-to-be-Done

### 普通开发者

当我在一个项目中同时使用多个 AI IDE 时，我想 aiforge 安装一次后每个工具只看到一份有效 skill 或 rule，这样我不会在 IDE 中看到重复条目，也不会误触发同一工作流两次。

### 平台维护者

当公司想统一推广通用目录时，我想只对已经验证支持该目录的工具启用 universal-first，而不是让所有工具都冒兼容性风险，这样我能稳妥迁移并保留回退路径。

### 工具规则维护者

当某个 IDE 新增或变更对 `.agents/skills/`、`AGENTS.md`、专属 rules 目录的支持时，我想通过更新数据矩阵完成适配，而不是修改安装引擎逻辑。

### CI / 项目模板维护者

当模板项目需要确定的安装结果时，我想通过 CLI 或配置锁定安装目标策略，这样 CI dry-run 和实际安装不会因为本地工具检测差异而产生不可预测结果。

## 需求清单

> 为避免现有 FR 编号冲突，本 Epic 暂用 `E9-FR-*` 编号。正式合并 PRD 时再统一 renumber。

### Functional Requirements

- E9-FR-001: 系统维护工具能力矩阵，至少表达每个工具是否支持 `AGENTS.md`、`.agents/skills/`、`.agents/agents/`、`.agent/skills/`、`.agent/agents/`、工具专属规则目录。
- E9-FR-002: 能力矩阵中的每项能力必须区分 `confirmed`、`experimental`、`unknown`、`unsupported`，不能把未验证能力当作默认安装依据。
- E9-FR-003: 系统新增安装目标策略，支持 `auto`、`universal-only`、`tool-specific-only`、`both` 四种模式。
- E9-FR-004: 默认策略为 `auto`。在 `auto` 下，已确认支持 `.agents/skills/` 的工具优先使用 universal skills 目录；未确认支持的工具继续使用工具专属目录。
- E9-FR-005: 在 `auto` 下，同一工具同一资源类型最多选择一个主安装目标，避免同一 IDE 同时从两个目标读取同一 skill / agent。
- E9-FR-006: `both` 策略保留 Epic 6 的并行安装语义，用于兼容旧版本、迁移过渡和手动排障。
- E9-FR-007: `universal-only` 策略只写入通用目录；如果目标工具没有已确认或实验性 universal 能力，dry-run 和安装输出必须给出兼容性警告。
- E9-FR-008: `tool-specific-only` 策略只写入工具专属目录，不写入 `.agents/` 或 `.agent/`。
- E9-FR-009: `--no-universal` 保持兼容，语义等价于一次运行选择 `tool-specific-only`；如果同时指定新的策略参数，系统必须拒绝冲突参数组合。
- E9-FR-010: 配置文件支持持久化默认安装目标策略，例如 `installTargetStrategy: "auto"`，CLI 参数优先于配置。
- E9-FR-011: dry-run 必须展示每个计划项的 target strategy、能力判断来源、最终选择目标，以及被跳过的重复候选目标。
- E9-FR-012: Report 必须在安装汇总中显示 strategy summary，包括 universal-first 数量、tool-specific fallback 数量、both 模式重复写入数量、兼容性警告数量。
- E9-FR-013: 当多个规则产生完全相同的 target path、source path、mode 和 hash 时，系统必须合并为一个安装项，避免重复执行。
- E9-FR-014: 当多个规则产生相同 target path 但来自不同策略分支时，系统必须明确归因：是 identical duplicate、strategy skipped，还是真实冲突。
- E9-FR-015: 文档必须明确 `AGENTS.md` 与 `.agents/skills/` 是不同层级能力，不能用 `AGENTS.md` 支持推导 skills 目录支持。
- E9-FR-016: 工具矩阵更新应是数据驱动的；新增工具或更新能力状态不应要求修改 Match / Install 引擎核心逻辑。
- E9-FR-017: 项目级安装默认应用本 Epic 策略；全局安装若无明确 universal 全局目录证据，应保持现有工具专属路径，除非用户显式选择 universal-only 或 both。
- E9-FR-018: 对 `.agent/` 单数目录的默认使用必须受能力矩阵约束；没有已确认支持时不得在 `auto` 中默认写入。

### Non-Functional Requirements

- E9-NFR-001: 默认 `auto` 策略不能降低已支持工具的实际可用性；未确认 universal 支持的工具不得被切到假成功路径。
- E9-NFR-002: 旧用户可以通过 `both` 恢复 Epic 6 并行安装行为，迁移期不强制改变所有用户安装习惯。
- E9-NFR-003: dry-run 输出必须足够可审查，用户能看出为什么某个目标被选择或跳过。
- E9-NFR-004: 能力矩阵必须保持在 `data/` 纯数据边界内，不引入网络请求、运行时探测或工具进程依赖。
- E9-NFR-005: Match 阶段新增策略选择后，本地 plan 生成额外耗时应低于 100ms。
- E9-NFR-006: 新策略不得绕过现有 manifest、preflight、冲突保护、path boundary validation 和 token sanitize 机制。
- E9-NFR-007: 报告和文档用词必须避免承诺未验证工具能力，所有 unknown/experimental 都要清晰标注。

## 推荐产品设计

### 能力矩阵模型

建议在现有 tool registry 或相邻数据文件中增加能力矩阵，不把能力写死在 match 逻辑里：

```typescript
type CapabilityStatus = 'confirmed' | 'experimental' | 'unknown' | 'unsupported'

interface ToolCapabilityProfile {
  tool: ToolId
  projectInstructions: {
    agentsMd: CapabilityStatus
    toolSpecificRules: CapabilityStatus
  }
  projectSkills: {
    universalAgentsSkills: CapabilityStatus
    universalAgentSkills: CapabilityStatus
    toolSpecificSkills: CapabilityStatus
  }
  projectAgents: {
    universalAgentsAgents: CapabilityStatus
    universalAgentAgents: CapabilityStatus
    toolSpecificAgents: CapabilityStatus
  }
  evidence?: Array<{
    capability: string
    source: 'official-docs' | 'project-verified' | 'inferred'
    note: string
    verifiedAt: string
  }>
}
```

初始矩阵建议：

| 工具 | `AGENTS.md` | `.agents/skills` | `.agent/skills` | 专属目录 | 默认策略倾向 |
| ------ | ------------- | ------------------ | ----------------- | ---------- | -------------- |
| codex | confirmed | confirmed | unknown | confirmed | universal-first for skills |
| opencode | confirmed | confirmed | unknown | confirmed | universal-first for skills |
| cursor | confirmed | unknown | unknown | confirmed `.cursor/rules` | tool-specific fallback |
| windsurf | confirmed | unknown | unknown | confirmed `.windsurf/rules` | tool-specific fallback |
| gemini | configurable / confirmed for context file name | unknown | unknown | confirmed `.gemini/*` | tool-specific fallback |
| antigravity | unknown pending docs | unknown / project-verified only if tested | unknown | project `.agents` currently detected | hold until verified |

说明：

- `confirmed` 只能来自官方文档或项目内已记录的验证结论。
- `project-verified` 可以作为 `experimental` 的证据，但不能在默认策略中等同 official confirmed，除非项目决定接受该风险。
- `AGENTS.md` 是 instructions/context 能力，不代表 skills/agents 目录能力。

### 安装目标策略

新增策略枚举：

```typescript
type InstallTargetStrategy = 'auto' | 'universal-only' | 'tool-specific-only' | 'both'
```

推荐语义：

- `auto`: 默认。按工具能力选择单一主目标。已确认 universal skills 的工具用 `.agents/skills/`；未确认的工具用专属目录。
- `universal-only`: 只写通用目录，适合明确只使用 Codex/OpenCode 或组织已统一 universal 的项目。
- `tool-specific-only`: 只写专属目录，等价于当前 `--no-universal` 的用户意图。
- `both`: 写专属目录和通用目录，保留 Epic 6 并行行为，但输出重复读取风险提示。

### CLI 与配置

建议 CLI 新增：

```bash
# 默认 auto
npx @fancyliu/aiforge

# 显式使用 universal-first/only 策略
npx @fancyliu/aiforge --target-strategy universal-only

# 保持旧版专属目录行为
npx @fancyliu/aiforge --target-strategy tool-specific-only

# 保持 Epic 6 并行写入行为
npx @fancyliu/aiforge --target-strategy both

# 兼容旧参数，等价于 tool-specific-only
npx @fancyliu/aiforge --no-universal
```

配置建议：

```jsonc
{
  "universalDirs": true,
  "installTargetStrategy": "auto"
}
```

兼容原则：

- 新配置优先使用 `installTargetStrategy`。
- 旧配置只有 `universalDirs: false` 时，等价为 `tool-specific-only`。
- 旧配置没有 `installTargetStrategy` 且 `universalDirs` 未设时，默认 `auto`，但发布说明必须明确这是对 Epic 6 默认并行行为的产品演进。
- 如果团队需要完全保留旧行为，可设置 `installTargetStrategy: "both"`。

### Match / Merge 设计

当前 Match 阶段可以继续基于规则生成候选计划，但需要新增 target selection 层：

```text
Detect Tools → Build Candidate Plans → Select Targets By Strategy → Deduplicate Plans → Install / Dry-run / Report
```

关键点：

- `Build Candidate Plans` 可以保留工具专属规则和 universal rules 的候选项。
- `Select Targets By Strategy` 根据工具能力矩阵和用户策略选择主目标。
- `Deduplicate Plans` 合并相同 target、source、mode、hash 的候选项。
- 被跳过的候选项不要丢失，应进入 dry-run explanation，用于解释“为什么没有写这个目录”。
- 安装阶段只消费最终 plan，不需要理解策略细节。

### 报告设计

Dry-run 输出需要从“会写哪些文件”升级为“为什么写这些文件”：

```text
Target strategy: auto

codex project skills
  selected: .agents/skills/          reason: confirmed universal skills support
  skipped:  .codex/skills/           reason: avoid duplicate skill discovery

cursor project rules
  selected: .cursor/rules/           reason: universal skills support unknown
  skipped:  .agents/skills/          reason: not applicable for cursor rules

warnings
  - .agent/skills is not selected by auto because no confirmed support is recorded.
```

安装完成汇总建议增加：

- selected universal targets
- selected tool-specific targets
- skipped duplicate candidates
- compatibility warnings
- strategy used from CLI / config / default

## Story 拆分

### Story 9-1: 工具能力矩阵与证据分级

As a 工具规则维护者，
I want 用数据结构记录每个 IDE 对 `AGENTS.md`、通用 skills 目录和专属目录的支持状态，
So that 默认安装策略可以基于已确认能力，而不是基于猜测。

Acceptance Criteria:

- 新增工具能力矩阵数据结构，覆盖当前 tool registry 中所有支持工具。
- 每项能力支持 `confirmed`、`experimental`、`unknown`、`unsupported` 状态。
- 初始矩阵至少区分 Codex、OpenCode、Cursor、Windsurf、Gemini、Antigravity 的通用目录能力。
- `AGENTS.md` 支持与 `.agents/skills/` 支持分开建模。
- 矩阵位于 `data/` 或等价纯数据边界，不引入运行时网络请求。
- 新增单元测试校验所有已注册工具都有能力 profile，避免新增工具时漏配。

### Story 9-2: 安装目标策略配置与 CLI 契约

As a 开发者，
I want 通过配置或 CLI 选择 auto、universal-only、tool-specific-only 或 both，
So that 我可以在默认智能选择、严格通用目录、严格专属目录和旧版并行模式之间切换。

Acceptance Criteria:

- `AiforgeConfig` 新增可选 `installTargetStrategy` 字段。
- CLI 新增策略参数，建议命名为 `--target-strategy <strategy>`。
- `--no-universal` 保持可用，等价于本次运行 `tool-specific-only`。
- 同时传入 `--no-universal` 与非 `tool-specific-only` 策略时，系统输出参数冲突错误。
- 优先级为 CLI > config > backward compatibility mapping > default auto。
- CLI help、configuration 文档和 README 更新策略说明。

### Story 9-3: Target Selection 与去重计划生成

As a 普通开发者，
I want aiforge 自动选择每个工具应该写入的唯一主目标目录，
So that 同一 IDE 不会因为同时读取专属目录和通用目录而看到重复 skills。

Acceptance Criteria:

- Match 阶段先生成候选计划，再通过 target selection 输出最终计划。
- `auto` 下已确认支持 `.agents/skills/` 的工具选择 universal skills 主目标。
- `auto` 下未确认 universal skills 的工具选择工具专属目标。
- `.agent/skills` 不在 `auto` 中默认选择，除非能力矩阵标记为 confirmed。
- 同 target/source/mode/hash 的重复候选项合并为一个安装项。
- 被策略跳过的候选项进入 dry-run explanation，不进入实际安装。
- 现有 manifest、preflight 和冲突保护逻辑继续复用最终计划。

### Story 9-4: Dry-run 与 Report 策略可解释性

As a 审查安装计划的用户，
I want 在 dry-run 和安装报告中看到策略、选择原因和跳过原因，
So that 我能判断结果是否符合当前 IDE 组合。

Acceptance Criteria:

- dry-run 输出显示当前 target strategy 以及来源：CLI、config 或 default。
- 每个工具分组显示 selected target 与 skipped candidate target。
- skipped candidate 必须包含原因，例如 duplicate risk、unsupported、unknown capability、strategy override。
- `universal-only` 遇到 unknown / unsupported capability 时显示兼容性警告。
- `both` 显示重复读取风险提示。
- 非 TTY 输出保持可解析，不依赖颜色表达关键状态。

### Story 9-5: 迁移兼容与旧行为回退

As a 平台维护者，
I want 从 Epic 6 的默认并行安装平滑迁移到策略驱动安装，
So that 已有用户不会在升级后失去可理解的回退方式。

Acceptance Criteria:

- 旧配置 `universalDirs: false` 行为保持为不写通用目录。
- 旧用户如需恢复 Epic 6 并行安装，可设置 `installTargetStrategy: "both"`。
- 迁移指南解释 `universalDirs` 与 `installTargetStrategy` 的关系。
- 发布说明明确默认行为从“并行追加 universal”演进为“auto 策略选择”。
- 不自动删除历史已安装的通用目录或专属目录文件。
- 如果历史 manifest 中同时存在专属和 universal 文件，下一次安装报告应能说明当前策略下哪些会继续维护，哪些只是历史遗留。

### Story 9-6: 文档、测试与发布验收

As a 新用户，
I want 通过文档理解不同 IDE 对通用目录的支持差异，
So that 我不会误以为所有工具都能读取 `.agents/skills/`。

Acceptance Criteria:

- README / README.zh 增加安装目标策略章节。
- install rules matrix 文档增加能力矩阵和策略说明。
- troubleshooting 增加“安装后 IDE 没有看到 skill”和“IDE 中出现重复 skill”的排查路径。
- 测试覆盖 Codex/OpenCode universal-first、Cursor/Windsurf fallback、Gemini fallback、unknown capability warning。
- 测试覆盖 `auto`、`universal-only`、`tool-specific-only`、`both` 四种策略。
- 发布验收包含 dry-run 样例输出和升级兼容检查。

## 开放问题

1. CLI 参数命名使用 `--target-strategy`、`--install-target` 还是 `--universal-mode`？推荐 `--target-strategy`，因为它表达的是目标选择策略，不只是 universal 开关。
2. `auto` 默认是否应视为 breaking change？从行为上看会减少默认写入目标，建议在 release notes 中作为显著行为变更处理，并提供 `both` 回退。
3. Codex 和 OpenCode 已确认 `.agents/skills/`，是否也应默认写 `.agents/agents/`？需要分别确认 agents 目录支持，不能从 skills 推导 agents。
4. Antigravity 是否正式支持 `.agents/skills/`？需要以官方技术文档或项目验证记录补充能力矩阵证据。
5. `.agent/` 单数目录是否继续作为默认 universal 候选？推荐第一版降为 explicit / experimental，避免无证据默认写入。
6. 全局安装是否纳入 universal-first？推荐第一版只治理项目级安装，全局安装需另行验证各工具全局目录契约。

## MVP 切片建议

第一版不要一次性完成所有工具目录标准化。最小有价值切片是：

1. 增加能力矩阵并标注 confirmed / unknown。
2. 增加 `installTargetStrategy` 与 CLI 参数。
3. 在 `auto` 下让 Codex / OpenCode skills 走 `.agents/skills/`，Cursor / Windsurf / Gemini 保持专属目录。
4. 将 `.agent/skills` 从默认 auto 中移除，除非后续补齐 confirmed 证据。
5. dry-run 显示 selected / skipped target explanation。
6. 提供 `both` 回退 Epic 6 并行行为。

这个切片验证的核心假设是：用户真正需要的不是“所有目录都写一遍”，而是“每个工具看到一份正确、可解释、可回退的配置”。
