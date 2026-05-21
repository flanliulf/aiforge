# bmad-create-story Skill 增强方案

> 基于 Story 4.5 真实生命周期 + 4.1 / 4.3 / 4.6a 横向抽样总结的 skill 改造草案。
> 本文档仅记录分析与方案，不修改任何源文件；落地前需确认实施范围。

---

## 1. 问题陈述

`.github/skills/bmad-create-story/` 目前生成的 Story 初稿，能覆盖 AC、Tasks、Dev Notes、References、Dev Agent Record 等基础骨架；但 Story 进入“开发 → 测试 → CR → CR Eval → Fix → Epic 影响更新”全生命周期后，最终版会沉淀大量初版没有的高价值内容（规则同步、前序教训、AC↔测试映射、分支覆盖、后续修订、回填记录）。

**核心问题**：bmad-create-story 当前定位偏向“可开发初稿生成器”，尚未做到“贴近最终研发目标状态的 Story 起点文档生成器”。这导致：

- 同类缺口在多 Story 中重复出现，CR 反复发现；
- 规则与教训散落在 retrospective / cr-rules / project-context 等多处，没有被强制带入 Story 初稿；
- 实现期需要补结构而非填内容，回填体验差。

需要识别 **哪些是模板缺口、哪些是工作流缺口、哪些是校验缺口、哪些是输入发现缺口**，并给出可执行的改造方案。

---

## 2. 背景与上下文

### 2.1 案例 Story

- 主案例：[_bmad-output/implementation-artifacts/stories/4-5-conflict-handling-and-safety.md](_bmad-output/implementation-artifacts/stories/4-5-conflict-handling-and-safety.md)
  - 经历：初版（2026-03-25）→ CR R1/R2/R3（2026-03-30，3 轮）→ UX 收敛后续修订（2026-04-24）。
  - 最终版包含：交互式冲突解决、目录冲突分支、零结果诊断双分支（true-zero vs skipped-only）、临时文件清理、后续修订对照表、Dev Agent Record 完整回填、质量门禁记录。

### 2.2 横向抽样 Story

为验证“是 4.5 特例还是 skill 通用问题”，对同 Epic 的另外 3 个 Story 做了 medium 级别生命周期对照：

- [_bmad-output/implementation-artifacts/stories/4-1-fs-utils-and-preflight-check.md](_bmad-output/implementation-artifacts/stories/4-1-fs-utils-and-preflight-check.md)
- [_bmad-output/implementation-artifacts/stories/4-3-symlink-and-flatten-mode.md](_bmad-output/implementation-artifacts/stories/4-3-symlink-and-flatten-mode.md)
- [_bmad-output/implementation-artifacts/stories/4-6a-pipeline-orchestration-and-error-flow.md](_bmad-output/implementation-artifacts/stories/4-6a-pipeline-orchestration-and-error-flow.md)

### 2.3 Skill 现状关键文件

- [.github/skills/bmad-create-story/SKILL.md](.github/skills/bmad-create-story/SKILL.md) — 入口与触发描述。
- [.github/skills/bmad-create-story/workflow.md](.github/skills/bmad-create-story/workflow.md) — 工作流，定义读取 PRD / architecture / 前序 Story / git / web research、调用 template、最终落 ready-for-dev。
- [.github/skills/bmad-create-story/template.md](.github/skills/bmad-create-story/template.md) — 输出骨架。
- [.github/skills/bmad-create-story/checklist.md](.github/skills/bmad-create-story/checklist.md) — 质量校验（含独立 fresh-context reviewer 模式）。
- [.github/skills/bmad-create-story/discover-inputs.md](.github/skills/bmad-create-story/discover-inputs.md) — 输入发现协议（FULL_LOAD / SELECTIVE_LOAD / INDEX_GUIDED）。

### 2.4 项目级既有规则资产

- [_bmad-output/project-context.md](_bmad-output/project-context.md) — Rule Document Registry、Cross-Cutting Concern Checklist、Recovery/Fallback Path Rules、Story Scope Discipline 等已有规则。
- [_bmad-output/planning-artifacts/architecture/03-core-decisions.md](_bmad-output/planning-artifacts/architecture/03-core-decisions.md)
- [_bmad-output/planning-artifacts/architecture/04-implementation-patterns.md](_bmad-output/planning-artifacts/architecture/04-implementation-patterns.md)

---

## 3. 证据

### 3.1 Story 4.5 演化时间线（主证据）

| 时间点 | 阶段 | 关键变更 |
|--------|------|---------|
| 2026-03-25 | 初版 | 基础 AC #1-6、Task 1-5、Dev Notes 代码示例、依赖关系 |
| 2026-03-30 | CR R1（不通过）| 发现 Directories 分支未接入冲突检测、tmpFiles 清理为空壳 |
| 2026-03-30 | CR R2（不通过）| 修复 R1 缺陷；新发现目录“备份后覆盖”走文件级 API 崩溃、Prettier 失败 |
| 2026-03-30 | CR R3（通过）| 新增 backupDir()、processConflict() 智能分发、格式恢复 |
| 2026-04-24 | UX 收敛 | 拆分零结果诊断为 true-zero（诊断）/ skipped-only（成功摘要）双分支 |

文档层面初版相对最终版补足的高价值块约 8 个：Directories 分支处理、backupDir() 说明、tmpFiles 清理职责澄清、零结果诊断双分支、目录冲突菜单、补充测试用例、规则提炼到 project-context、后续修订对照表。

### 3.2 横向抽样矩阵（4.1 / 4.3 / 4.6a）

| 缺口类型 | 4.1 | 4.3 | 4.6a | 4.5 | 命中 | 性质 |
|---------|-----|-----|------|-----|------|------|
| A 规则同步 | 是 | 部分 | 是 | 是 | 4/4 | 通用 |
| B 前序教训复用 | 否（首 Story 无前序） | 是 | 是 | 是 | 3/4 | 通用（需补首 Story 回退） |
| C AC↔测试映射 | 是 | 是 | 是 | 是 | 4/4 | 通用 |
| D 分支/类型覆盖 | 是 | 是 | 是 | 是 | 4/4 | 通用 |
| E 后续修订占位 | 否 | 否 | 否 | 是 | 1/4 | 4.5 特例 |
| F Dev Record 回填 | 部分 | 部分 | 部分 | 部分 | 4/4 | 通用但轻 |

### 3.3 抽样发现的两类新模式

- **模式 G — 跨模块规则映射漂移**：同一规则（如“必填字段禁止空值兜底”）在某些模块写对、其他模块漂移；典型见 4.4 与 4.6a 中 saveManifest 的重复违规。
- **模式 H — AC 负向场景遗漏**：AC 由需求侧编写，天然偏 happy path，初版很少补“空值/已存在/多分支/非 TTY/权限”等候选；3/3 抽样 Story 均出现。

### 3.4 Skill 现状代码证据

- 工作流已要求读取上下文，但只在 workflow 注释里说明，没有强制落到 template 输出位：
  - [workflow.md L36](.github/skills/bmad-create-story/workflow.md#L36) — `project_context = **/project-context.md`
  - [workflow.md L229](.github/skills/bmad-create-story/workflow.md#L229) — 加载前序 Story 文件
  - [workflow.md L341](.github/skills/bmad-create-story/workflow.md#L341) — 设置 `Status: ready-for-dev`
  - [workflow.md L347](.github/skills/bmad-create-story/workflow.md#L347) — 调用 checklist 校验
- 模板未承载 AC↔测试映射、分支覆盖表、规则基线、前序教训、占位符化的 Dev Agent Record：
  - [template.md L11 / L17 / L24 / L35 / L39](.github/skills/bmad-create-story/template.md)
- 校验已知“不能忽略 past work”，但缺规则同步、AC 测试映射、分支覆盖等专门校验：
  - [checklist.md L18 / L101 / L112](.github/skills/bmad-create-story/checklist.md)
- 输入发现协议是通用 load 策略，不主动覆盖 code reviews / story reviews / retrospectives / cr-rules：
  - [discover-inputs.md L31 / L77](.github/skills/bmad-create-story/discover-inputs.md)
- 项目级规则与 Rule Document Registry 已存在但未被 skill 引用为基线：
  - [project-context.md L17 / L93 / L110 / L115](_bmad-output/project-context.md)

### 3.5 项目内已有相关教训沉淀

- 仓库记忆 `/memories/repo/install-zero-result-output.md`：明确 true-zero vs skipped-only 双分支语义，是 4.5 UX 收敛后通用化结果。
- 仓库记忆 `/memories/repo/path-boundary-validation.md`、`/memories/repo/filter-recovery-consistency.md`：已存在的横切规则提炼。

---

## 4. 引用

- 主案例：[_bmad-output/implementation-artifacts/stories/4-5-conflict-handling-and-safety.md](_bmad-output/implementation-artifacts/stories/4-5-conflict-handling-and-safety.md)
- 抽样 Story：
  - [_bmad-output/implementation-artifacts/stories/4-1-fs-utils-and-preflight-check.md](_bmad-output/implementation-artifacts/stories/4-1-fs-utils-and-preflight-check.md)
  - [_bmad-output/implementation-artifacts/stories/4-3-symlink-and-flatten-mode.md](_bmad-output/implementation-artifacts/stories/4-3-symlink-and-flatten-mode.md)
  - [_bmad-output/implementation-artifacts/stories/4-6a-pipeline-orchestration-and-error-flow.md](_bmad-output/implementation-artifacts/stories/4-6a-pipeline-orchestration-and-error-flow.md)
- Skill 文件：
  - [.github/skills/bmad-create-story/SKILL.md](.github/skills/bmad-create-story/SKILL.md)
  - [.github/skills/bmad-create-story/workflow.md](.github/skills/bmad-create-story/workflow.md)
  - [.github/skills/bmad-create-story/template.md](.github/skills/bmad-create-story/template.md)
  - [.github/skills/bmad-create-story/checklist.md](.github/skills/bmad-create-story/checklist.md)
  - [.github/skills/bmad-create-story/discover-inputs.md](.github/skills/bmad-create-story/discover-inputs.md)
- 规则资产：
  - [_bmad-output/project-context.md](_bmad-output/project-context.md)
  - [_bmad-output/planning-artifacts/architecture/03-core-decisions.md](_bmad-output/planning-artifacts/architecture/03-core-decisions.md)
  - [_bmad-output/planning-artifacts/architecture/04-implementation-patterns.md](_bmad-output/planning-artifacts/architecture/04-implementation-patterns.md)
- 相关历史文档：
  - [_bmad-output/analysis/cr-todo-check-hook-analysis.md](_bmad-output/analysis/cr-todo-check-hook-analysis.md)
  - [_bmad-output/analysis/rule-sync-check-hook-analysis.md](_bmad-output/analysis/rule-sync-check-hook-analysis.md)

---

## 5. 结论

1. bmad-create-story 已具备“收集上下文”的机制（PRD / architecture / 前序 Story / git / web research），但缺“强制将上下文沉淀到 Story 初稿固定结构”的能力——读取与落盘之间存在断点。
2. Story 4.5 中后期补足的内容里，至少有 **70%** 属于“结构与约束”类，可由 skill 在初稿阶段前置；剩下 ~30% 属于真实实现/CR 结论，**不应**由 create-story 伪造。
3. 横向抽样确认 A / B / C / D / F 五类缺口在 3-4 个 Story 中重复出现，是 skill 级通用问题；E（后续修订）仅 4.5 命中，应作为可选区块而非强制章节。
4. 抽样还暴露 G（跨模块规则漂移）、H（AC 负向场景遗漏）两类反复模式，应作为新增加强项，不在 4.5 单点能看出。
5. 改造的 ROI 顺序应为 **C+H → D → A+G → B → F → E（可选）**，并以 **template.md → workflow.md → checklist.md → discover-inputs.md → SKILL.md** 的顺序落地，确保“先有承载位，再强制落盘，再校验，再补输入源，最后收口入口描述”。
6. 关键边界：create-story 不应预知最终代码细节、真实测试数量、CR 结论；必须保留占位符并区分 “初稿（结构与约束）” 与 “实现期回填” 两阶段。

---

## 6. 实施计划方案

### 6.1 总览

| 顺位 | 主题 | 主要文件 | 次要文件 |
|------|------|---------|---------|
| P0 | 收口入口描述 | SKILL.md | — |
| P1 | AC↔测试映射 + 负向场景候选 | template.md、checklist.md | workflow.md |
| P2 | 分支/类型覆盖自检表 | template.md、checklist.md | — |
| P3 | 规则同步基线 + 跨模块规则网格 | template.md、workflow.md、discover-inputs.md | checklist.md |
| P4 | 前序 CR 教训扫描（含 Epic 首 Story 回退） | workflow.md、discover-inputs.md、template.md | checklist.md |
| P5 | Dev Agent Record 占位符化 | template.md | — |
| P6 | 后续修订作为可选区块 | template.md | checklist.md |

### 6.2 P0：收口入口描述（SKILL.md）

- 锚点：`.github/skills/bmad-create-story/SKILL.md` frontmatter `description`。
- 改造为：

  ```yaml
  description: 'Creates a comprehensive story file with implementation context, AC test coverage matrix, branch/type coverage audit, project rule baseline, prior CR learnings, and dev-agent fill-in placeholders. Use when the user says "create the next story" or "create story [story identifier]".'
  ```

- body 部分保留 `Follow the instructions in ./workflow.md.`，可在其下追加同伴文件索引行。

### 6.3 P1：AC↔测试映射 + 负向场景候选

- **template.md**
  - 在 `## Acceptance Criteria` 下，每条 AC 紧跟两个子结构：`Negative & boundary candidates`、`Test plan` 表（允许 TBD，但行数=AC 数）。
  - 在 AC 区块之后新增独立章节 `## Test Coverage Matrix`。
- **workflow.md**
  - Step 5 中 `technical_requirements` 之前新增动作：枚举每条 AC 的负向/边界候选（empty / already-exists / multi-branch / non-TTY / permission-denied / symlink / broken-symlink / concurrent / cross-module shared key），并 `<template-output>test_coverage_matrix</template-output>`。
- **checklist.md**
  - 新增 `Step 2.6: AC Testability Verification`：行数校验、负向候选必填校验，失败列入 Critical Issues。

### 6.4 P2：分支/类型覆盖自检表

- **template.md**
  - 在 `## Tasks / Subtasks` 之后、`## Dev Notes` 之前新增 `## Branch & Type Coverage`，列出输入维度 / 取值 / 处理分支 / 已列入 Task / 已列入 Test。
  - 单一分支场景允许显式标 `N/A`。
- **checklist.md**
  - 新增 `Step 2.7: Branch Coverage Audit`：处理分支与 Test 列一致性、被复用核心函数（如 backupFile/handleConflict）必须列出复用的所有类型分支。

### 6.5 P3：规则同步基线 + 跨模块规则网格

- **template.md**
  - 文件顶部追加 frontmatter，记录 `story_key / created_date / rules_baseline.{project_context_file,project_context_date,registry_files}`。
  - `## Dev Notes` 内 `### Project Structure Notes` 之前新增 `### Rules × Modules Grid`，列出本 Story 实际触达的“规则 × src 子目录”交叉点。
- **workflow.md**
  - Step 2 之前新增 Step 1.5：加载 project-context.md 的 frontmatter（date / rule_count / sections_completed），与上次 Story 的 rules_baseline 比对漂移，并将 `project_context_date` 持久化进 story frontmatter。
  - Step 5 新增 `<template-output>rules_modules_grid</template-output>`。
- **discover-inputs.md**
  - 在 Input Files 表新增三项：`project_rules`（FULL_LOAD `_bmad-output/project-context.md`）、`rule_registry_decisions`（INDEX_GUIDED `architecture/03-core-decisions.md`）、`rule_registry_patterns`（INDEX_GUIDED `architecture/04-implementation-patterns.md`）。
  - Step 3 报告中要求输出 `project_rules_date` 作为校验基准。
- **checklist.md**
  - 新增校验：`Rule baseline drift`（frontmatter 缺/不一致）、`Rules × Modules grid missing`（触达 ≥2 个 src 子目录但缺该网格）。

### 6.6 P4：前序 CR 教训扫描（含 Epic 首 Story 回退）

- **workflow.md**
  - Step 2 中将 `<check if="story_num > 1">` 改造为双分支：
    - `story_num > 1`：在加载前序 Story 之外，扫描 `code-reviews/{epic}-*.md`、`story-reviews/{epic}-*.md`，提取 P0/P1 反复发现 → `Pitfalls to Avoid`。
    - `story_num == 1 AND epic_num > 1`：回退加载 `retrospectives/epic-{epic-1}*.md` 与 `cr-rules/*.md`，提取尚未完成的 action items 与已晋升的规则。
  - Step 5 新增 `<template-output>prior_learnings</template-output>`。
- **discover-inputs.md**
  - 新增四类输入：`prior_code_reviews`、`prior_story_reviews`、`prior_retrospectives`、`cr_rules`。
  - 全部缺失时在 Step 2c 输出 `prior_learnings = NONE_AVAILABLE`，禁止留白。
- **template.md**
  - `## Dev Notes` 内、`### Rules × Modules Grid` 之后新增 `### Prior Learnings`，列出来源 + 教训摘要；无则显式标注 `NONE_AVAILABLE — first story in project / epic`。
- **checklist.md**
  - 在 `2.3 Previous Story Intelligence` 之后追加要求：必须输出 `Prior Learnings` 章节，否则视为 Critical。

### 6.7 P5：Dev Agent Record 占位符化

- **template.md**
  - 将 `## Dev Agent Record` 整体改为占位符版本：
    - `### Agent Model Used` 用 `<!-- TODO[dev]: model name + version -->` 占位。
    - 新增 `### Completion Checklist`，固定打勾项包含：AC ↔ Test Coverage Matrix 全验证、Branch & Type Coverage 全覆盖、Rules × Modules 重新核对、Prior Learnings 复核、Lint/Build/Test 通过、File List 已更新。
    - `### Debug Log References` / `### Completion Notes` / `### File List` 皆标 `<!-- TODO[dev]: ... -->`。
    - `### Change Log` 默认仅一行 `{{date}}: Story drafted (status: ready-for-dev)`，后续追加交给 dev/CR。
- 不增加额外 workflow / checklist 校验，依赖 TODO 标签引导。

### 6.8 P6：后续修订作为可选区块

- **template.md**
  - 文件末尾追加 HTML 注释包裹的可选块：

    ```markdown
    <!--
    ## 后续修订（{{date}} {{trigger}}）

    > 触发：UX 收敛 / Epic 影响更新 / 规则变更 / 紧急修订。已原地更新对应 AC/Tasks/Dev Notes，本块保留变更对照供审计追溯。

    | 章节 / 行 | 变更前 | 变更后 | 依据 |
    |----------|--------|--------|------|
    |          |        |        |      |
    -->
    ```

  - 注释行注明：仅在“原地修改 + 需要审计追溯”时启用。
- **checklist.md**
  - 不强制启用；仅当 Status=done 但 AC 又有显著调整时建议启用。

### 6.9 回归验收

1. 用 4.5 初版重新跑一次 create-story，对照最终版后补章节是否前置；目标命中率 ≥70%。
2. 用 4.1 跑一次（Epic 首 Story），验证 P4 回退分支生效，Prior Learnings 不留白。
3. 用 4.6a 跑一次，验证 Rules × Modules Grid 能截获“必填字段空值兜底”规则在 pipeline.ts 的应用。
4. 跑 checklist：刻意制造缺失 Test Coverage Matrix / Branch Coverage / Rules Baseline，确认 3 项均被标 Critical。

### 6.10 不做的事

- 不让 create-story 编造未实现的代码细节、测试数量、CR 结论。
- 不在初稿强制写多行 Change Log（保留 “Story drafted” 一行）。
- 不把 P6 升级为强制章节，避免常规迭代产生文档噪声。
- 不修改 SKILL.md 之外的触发语义（`user-invocable`、slash-command 行为保持不变）。

### 6.11 决策门

- 完成 P0–P5 落地并通过 6.9 回归后，再决策是否将“规则基线网格 / AC 负向场景候选 / Branch Coverage 自检”三项上升为项目级规则，并按 [project-context.md](_bmad-output/project-context.md) 的 Rule Document Registry 同步到 03-core-decisions、04-implementation-patterns、project-context 三处。

---

## 7. 附录：抽样过程要点

- 抽样方法：medium 级 only-read 探索代理对 4.1 / 4.3 / 4.6a 当前文件 + git 历史 + 关联 CR/retrospective 做对照，矩阵字段 = 6 类候选缺口。
- 关键修正：原本将 “后续修订占位” 设为通用增强；横向抽样后降级为 4.5 特例，改为可选区块。
- 关键发现：B 缺口在 4.1 不命中是因为它是 Epic 首 Story，没有前序；规则需要补回退路径而非简单跳过。
- 新增模式 G/H 是抽样产物，不是 4.5 单点能识别，纳入 P3 / P1。
