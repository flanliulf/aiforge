---
Epic: 6
Scope: epic
Round: 5
Date: 2026-04-14
Model Used: GPT-5.4 (gpt-5.4)
Type: Story Review Summary
Stories Reviewed: 4
---

## 审查结论

第 5 轮复审。共复审 Epic 6 下 4 个 Story。审查层状态：3/3 层完成（`structure` / `consistency` / `contract`）。

- 通过：0 个
- 有条件通过：2 个
- 硬阻塞：2 个

总体判断：Round 4 针对 Story 6-2 的 prefixed 扫描作用域和 TTY 测试闭环修订已经真正关闭，但 Epic 6 仍不能整体进入开发。新的阻塞重心已经转移到两处：Story 6-2 的 filter 结果仍会把未匹配规则带进 dry-run 计划；Story 6-3 的通用目录增量同步与 `enableUniversal` 归属边界仍建立在当前实现链路无法证明的假设上。

## 审查范围

- Story 文件：
  - `6-1-list-subdirectory-contents.md`
  - `6-2-filter-subdirectory-install.md`
  - `6-3-universal-directory-install.md`
  - `6-4-init-universal-directory-preference.md`
- 对照基准：
  - `project-context.md`
  - `planning-artifacts/epics/epic-6.md`
  - `planning-artifacts/architecture/03-core-decisions.md`
  - `planning-artifacts/architecture/04-implementation-patterns.md`
  - `src/core/types.ts`
  - `src/core/reporter.ts`
  - `src/index.ts`
  - `src/pipeline.ts`
  - `src/stages/match-rules.ts`
  - `src/stages/execute-install.ts`
  - `src/commands/init.ts`
  - `src/services/config.ts`
  - `tests/cli-args.test.ts`
  - `tests/core/types.test.ts`
  - `tests/pipeline.test.ts`
  - `tests/commands/init.test.ts`
  - `tests/services/config.test.ts`
  - `epic-6-story-review-summary-20260414-round-4.md`
  - `epic-6-story-review-evaluation-20260414-round-4.md`
- 审查维度：
  - 结构完整性
  - AC 可测性
  - 与 Epic 一致性
  - 与架构文档一致性
  - Story 间冲突与依赖
  - 任务拆分合理性
  - 交互/认证/安全/性能口径
  - 跨 Epic 共享契约

## 上轮问题回顾

### 已修复

1. Round 4 / Finding #1 — Story 6-2 的 prefixed 零匹配候选目录扫描作用域错误
   - `6-2` 已明确改为 `const scanDir = dirPrefix ? join(repo.repoDir, dirPrefix) : repo.repoDir`。
   - 本轮复核结论：该问题已关闭，不再构成阻塞。

2. Round 4 / Finding #2 — Story 6-2 的 TTY 选择/取消路径缺少测试闭环
   - `6-2` 已补 `tests/stages/match-rules.test.ts` 的 TTY 选择/取消用例，以及 `tests/pipeline.test.ts` 的取消正常返回用例。
   - 本轮复核结论：Round 4 指出的测试闭环缺口已关闭。

3. Round 4 前已关闭的非当前轮回退项仍保持关闭
   - Story 6-1 的空目录成功态仍保持 stdout/`reportList` 路径。
   - Story 6-3 的 `CONFIG_NOT_FOUND` 降级仍保持 `instanceof AiforgeError` 白名单守卫。
   - Story 6-4 对 AC #3-#5 的跨 Story 责任声明仍清晰，没有回退到“本 Story 自己承担 install 运行时行为”。

### 仍为非阻塞待办

1. Round 1 defer — `tool: 'universal'` 仍是共享 `tool` 字段的例外语义，继续维持 defer。
2. Round 1 defer — `--filter` 的“子目录”术语与“所有 sourceFiles”语义仍未完全统一，继续维持 defer。

## 新发现

### 1. [高][新] Story 6-3 依赖现有目录型安装链路实现 AC #3 的增量跳过，但当前链路并不支持
- **来源**：structure
- **分类**：patch
- **涉及 Story**：6-3
- **证据** - `6-3` 将 skills 的通用目录规则定义为 `Directories`，并在 Task 6.4 / Dev Notes 中声明现有 `checkConflict()`、manifest 和 hash 逻辑足以完成“未变更则 skipped”的增量同步；但当前 `executeInstall()` 的目录分支只做 `new` / `updated` 判定，`pipeline.ts` 对 `Directories` 还会写入空 hash，现有链路并不存在“目录未变更直接 skipped”的可执行路径。
- **影响** - Story 6-3 的 AC #3 现在不是“实现细节待补”，而是被当前设计自身阻断；如果按文档直接开发，skills 通用目录的二次安装行为会与 AC 断裂。
- **建议** - 先重写 AC #3 的实现策略：要么把通用 skills 改成文件级可比对方案，要么显式新增目录级变更检测契约；在方案锁定前，不要继续沿用“复用现有目录型链路即可”的表述。

### 2. [中][新] Story 6-2 没有在 filter 后剔除空 plan item，dry-run 仍会暴露未匹配规则
- **来源**：consistency
- **分类**：patch
- **涉及 Story**：6-2
- **证据** - Task 3 只要求把不匹配规则的 `sourceFiles` 过滤为空后继续 `items.push()`；当前 `matchRules()` 会保留空 item，`reportPlan()` 又会为这些 item 输出 `emptySourceDir` 行。这样在“部分规则命中、部分规则未命中”的场景下，`--dry-run` 仍会显示未匹配规则。
- **影响** - AC #5 要求 dry-run 只展示匹配条目；现文档若按字面实现，会把“未命中但仍被列出”的错误行为固化到设计里。
- **建议** - 在 Story 中显式要求 filter 后剔除空 item，或在进入 `reportPlan()` / `executeInstall()` 前新增只保留匹配项的规范化步骤，并补一条覆盖“部分命中”场景的预览测试。

### 3. [中][新] Story 6-1 为 Reporter 新增必填 reportList，但没有把共享接口迁移面写入任务
- **来源**：consistency+contract
- **分类**：patch
- **涉及 Story**：6-1
- **证据** - Task 4 要在 `Reporter` 接口上新增必填 `reportList()`；但 Task 6 只覆盖 `tests/core/reporter.test.ts`、`tests/stages/list-contents.test.ts` 和少量 `tests/pipeline.test.ts` 场景。当前仓库里大量 stage、integration 和 pipeline 测试都用 `Reporter` typed mock，现文档没有把这些 mock / fixture 的迁移列为显式任务。
- **影响** - 开发者如果只按 Story 列出的改动面执行，会在大量既有测试夹具上触发编译失败；这属于共享契约迁移遗漏，不是实现阶段可以自然“顺手补掉”的小问题。
- **建议** - 将 `reportList()` 视为共享接口变更，补一条横切关注点任务：扫描所有 `Reporter` mock / fixture，逐一标注“需改动 / 可保持不变”，并把对应测试文件纳入 File List 或测试任务清单。

### 4. [中][新] Story 6-3 的 universalDirs 派生状态归属与验证路径仍然分叉
- **来源**：structure+consistency+contract
- **分类**：patch
- **涉及 Story**：6-3
- **证据** - Task 5 与 Dev Notes 同时给出了三套方案：`createProductionStages()` 的 match 闭包读取 config、`runPipeline()` 先派生 `enableUniversal` 再塞回 `ParsedArgs`、以及扩展 `matchRules()` 签名；但文档没有锁定唯一实现口径。与此同时，Task 9.3 还把 manifest 与“第二次安装 skipped”验证放到当前以 mocked `saveManifest()` 为主的 `tests/pipeline.test.ts`，无法证明真实 install + manifest 链路。
- **影响** - 这会把 CLI 原始输入、配置派生状态和验证责任混在一起，导致实现人员可以走出多条不兼容路径；即使测试全绿，也可能没有任何一条测试真正证明通用目录的运行时行为。
- **建议** - 在 Story 中选定唯一的 ownership：要么编排器派生并显式传参，要么扩展 `matchRules()` 输入，但不要两套方案并存；同时把 manifest / skipped 验证迁移到真实阶段闭包或集成链路中。

### 5. [低][新] Story 6-1 对“可安装子目录”的定义仍与真实 rule-based 安装集合不一致
- **来源**：structure+consistency
- **分类**：patch
- **涉及 Story**：6-1
- **证据** - `6-1` 的 `listContents()` 与 `scanAvailableTopDirs()` 都以目录存在性为准，分别使用 `DEFAULT_EXCLUDES` 或 `!name.startsWith('.')` 过滤，但 AC / `list.title` 文案写的是“可安装子目录”。当前真正的 installable 集合由 `InstallRule` / `RULE_INDEX` 决定，而不是“目录存在即可”；同时 `scanAvailableTopDirs()` 还被 `6-2` 复用，进一步放大了该语义漂移。
- **影响** - list 输出、零匹配候选列表和真实匹配规则之间仍可能出现口径不一致，后续用户会把“看得见”误判成“肯定可装”。
- **建议** - 二选一：要么把 Story 6-1 的文案从“可安装子目录”收窄为“现有子目录”；要么补充 rule-based 过滤契约，并同步统一 `scanAvailableTopDirs()` 的过滤口径。

## 逐篇审查结论

### Story 6.1: `--list` 子目录内容列举

**结论：有条件通过**

**优点**
- `--list` 的管道分叉位置、stdout 成功态与 Reporter 生命周期约束仍然清晰。
- Round 4 之前的空目录 stderr/warn 问题保持关闭。

**关键问题**
1. **`reportList()` 共享接口迁移面未入任务** — 当前任务清单低估了 `Reporter` 变更对既有 mock / fixture 的影响。
2. **“可安装子目录”语义仍漂移** — 文案与实现契约还没有对齐到同一个 installable 定义上。

**建议动作**
- 补横切关注点任务，覆盖所有 `Reporter` typed mock / fixture。
- 明确 `--list` 输出到底是“现有子目录”还是“经规则判定后的可安装子目录”。

### Story 6.2: `--filter` 精准子目录安装

**结论：硬阻塞**

**优点**
- Round 4 的 `scanDir` 作用域修订和 TTY 测试闭环已经真正落地。
- `FilterCancelledSignal -> return` 的编排器契约没有回退。

**关键问题**
1. **filter 后的空 item 仍会进入 dry-run 计划** — 这会让未匹配规则继续出现在预览输出中，直接违背 AC #5。

**建议动作**
- 在 Story 中显式要求裁掉空 item，并补“部分命中时 dry-run 只显示匹配项”的测试。

### Story 6.3: 通用目标目录默认安装

**结论：硬阻塞**

**优点**
- `CLI > config > 默认值` 的优先级方向仍然正确。
- `UNIVERSAL_RULES` 的目标目录集合与 Epic 6 范围保持一致。

**关键问题**
1. **AC #3 的增量同步建立在当前不存在的目录级 skip 链路上** — 这不是实现细节，而是设计本身无法闭环。
2. **`enableUniversal` 的 ownership 与验证路径仍然分叉** — 当前 Story 没有锁定唯一实现口径，也没有把真实 manifest 链路放进正确的测试层。

**建议动作**
- 先重写 AC #3 的实现模型，再安排开发。
- 锁定 `enableUniversal` 的归属边界，并把二次安装 skipped 验证迁移到真实集成链路。

### Story 6.4: `aiforge init` 通用目录偏好配置

**结论：有条件通过**

**优点**
- init 侧的询问、默认值继承、配置持久化边界保持清晰。
- AC #3-#5 已明确声明为依赖 Story 6-3 的运行时行为，不再越界承担 install 逻辑。

**关注点**
- 只要 Story 6-3 仍是阻塞状态，Story 6-4 也不能独立视为 Epic 级“可开发完成”。

**建议动作**
- 保持当前边界不动，等待 Story 6-3 收敛后再合并验收。

## 通过项

- Story 6-2 的 prefixed `scanDir` 修订和 TTY 选择/取消测试闭环已稳定收敛。
- Story 6-1 的空目录成功态仍保持 stdout/`reportList()` 路径，没有回退到 stderr/warn。
- Story 6-3 的 `CONFIG_NOT_FOUND` 白名单降级仍保持 `instanceof AiforgeError` 守卫。
- Story 6-4 对 AC #3-#5 的跨 Story 依赖边界仍然明确。
- 已知 defer 项继续保留：
  - `tool: 'universal'` 仍是共享 `tool` 字段的例外语义。
  - `--filter` 的“子目录”术语与 `sourceFiles` 泛化语义仍未完全统一。

## 结论

- **结论**：不通过
- **阻塞项**：
  - Story 6-2 的 filter 结果仍会把未匹配规则带进 dry-run 计划
  - Story 6-3 的通用 skills 增量同步仍建立在当前目录型安装链路不支持的假设上
  - Story 6-3 的 `enableUniversal` ownership 与验证路径仍未锁定
- **建议**：
  - 先修正 Story 6-2 的空 item 裁剪契约
  - 再重写 Story 6-3 的 AC #3 实现模型与测试层选择
  - 最后补齐 Story 6-1 的共享接口 blast radius 与“可安装”语义定义