---
Epic: 6
Scope: epic
Round: 5
Date: 2026-04-15
Model Used: Claude Opus 4.6 (claude-opus-4-6)
Review Source: epic-6-story-review-summary-20260414-round-5.md
Review Model: GPT-5.4 (gpt-5.4)
Type: Story Review Evaluation
---

## 评估总结

本轮评估针对 Round 5 复审结果（5 条新发现：1 高 3 中 1 低）。Round 4 的 2 条阻塞项（prefixed scanDir 修订 + TTY 测试闭环）已确认关闭。审查整体质量较高，5 条发现中 3 条确认有效需修订（#1、#2、#4），2 条有效但建议降级为后续改善跟踪（#3、#5）。核心阻塞重心已从 Story 6-2 转移到 Story 6-3：AC #3 的增量同步机制确实建立在当前不存在的目录级 skip 链路上，且 `enableUniversal` 的实现路径尚未锁定。Story 6-2 的 filter 空 item 问题同样需修订。整体判断：**需修订后再审**。

## 上轮问题回顾确认

### Round 4 / Finding #1 — Story 6-2 prefixed scanDir 作用域：已确认修复

交叉验证 Story 6-2 Task 4.2 文本：已改为 `const scanDir = dirPrefix ? join(repo.repoDir, dirPrefix) : repo.repoDir`，与 Round 4 评估建议完全一致。Round 5 审查层确认该问题不再构成阻塞。**关闭**。

### Round 4 / Finding #2 — Story 6-2 TTY 选择/取消测试闭环：已确认修复

Round 5 审查确认已补 `tests/stages/match-rules.test.ts` 的 TTY 选择/取消用例及 `tests/pipeline.test.ts` 的取消正常返回用例。**关闭**。

### 历史非阻塞待办

| 来源 | 问题 | 状态 |
|------|------|------|
| R1-#4 | `tool: 'universal'` 扩展共享字段语义 | 维持 defer |
| R1-#5 | `--filter` "子目录"与"全部 sourceFiles"术语不一致 | 维持 defer |

确认仍为非阻塞，无需升级。

## 发现 #1 评估

### 审查原文

> **[高][新] Story 6-3 依赖现有目录型安装链路实现 AC #3 的增量跳过，但当前链路并不支持**
> - 来源：structure
> - 分类：patch
> - 涉及 Story：6-3
> - 证据 - `6-3` 将 skills 的通用目录规则定义为 `Directories`，并在 Task 6.4 / Dev Notes 中声明现有 `checkConflict()`、manifest 和 hash 逻辑足以完成"未变更则 skipped"的增量同步；但当前 `executeInstall()` 的目录分支只做 `new` / `updated` 判定，`pipeline.ts` 对 `Directories` 还会写入空 hash，现有链路并不存在"目录未变更直接 skipped"的可执行路径。
> - 影响 - Story 6-3 的 AC #3 现在不是"实现细节待补"，而是被当前设计自身阻断；如果按文档直接开发，skills 通用目录的二次安装行为会与 AC 断裂。
> - 建议 - 先重写 AC #3 的实现策略：要么把通用 skills 改成文件级可比对方案，要么显式新增目录级变更检测契约；在方案锁定前，不要继续沿用"复用现有目录型链路即可"的表述。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 交叉验证源码确认：`execute-install.ts` 的 `determineDirStatus()` 函数仅返回 `'new'` 或 `'updated'`，不存在 `'skipped'` 返回路径。目录 copy 模式下 `copyDir()` 对两种状态均无条件执行，没有 `if (status !== 'skipped')` 守卫（与文件类型分支行为形成鲜明对比）。`pipeline.ts` 为 `Directories` 类型明确写入空字符串 `''` 作为 hash 占位值，无法作为变更比对基础。

AC #3 原文明确要求"系统检查通用目录中已安装文件与仓库最新版本的哈希差异，有变更的文件重新写入，无变更的文件跳过"，但 Dev Notes 的"NFR-C7 — 不引入新代码路径"声明直接与此矛盾：现有 `Directories` 链路不做文件级 hash 比对，第二次安装必然全量覆盖。

**严重性判断**：合理 — 这是设计层面的闭环缺失，不是实现细节遗漏。AC 规定的行为在当前架构中根本无法达成。单来源（structure）但证据链完整且可直接复现。考虑到 AC #3 是增量同步的核心验收标准，P1 合理；不升至 P0 是因为这不涉及安全或数据完整性风险，而是功能设计与实现能力的断裂。

**修订建议**：可行 — 审查给出的两条路径（文件级可比对方案 / 目录级变更检测契约）均可行。推荐优先考虑文件级方案，因为 AC #3 原文已经是按文件粒度描述的（"有变更的文件重新写入"），且文件级 hash 机制在现有 `Files` 类型中已验证可用。

**误报评估**：非误报 — 源码证据链完整，从 `determineDirStatus()` → `copyDir()` → manifest hash 三个层面均可确认。

## 发现 #2 评估

### 审查原文

> **[中][新] Story 6-2 没有在 filter 后剔除空 plan item，dry-run 仍会暴露未匹配规则**
> - 来源：consistency
> - 分类：patch
> - 涉及 Story：6-2
> - 证据 - Task 3 只要求把不匹配规则的 `sourceFiles` 过滤为空后继续 `items.push()`；当前 `matchRules()` 会保留空 item，`reportPlan()` 又会为这些 item 输出 `emptySourceDir` 行。这样在"部分规则命中、部分规则未命中"的场景下，`--dry-run` 仍会显示未匹配规则。
> - 影响 - AC #5 要求 dry-run 只展示匹配条目；现文档若按字面实现，会把"未命中但仍被列出"的错误行为固化到设计里。
> - 建议 - 在 Story 中显式要求 filter 后剔除空 item，或在进入 `reportPlan()` / `executeInstall()` 前新增只保留匹配项的规范化步骤，并补一条覆盖"部分命中"场景的预览测试。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 代码验证确认：`match-rules.ts` 的 `matchRules()` 主循环中 `items.push({ rule, sourceFiles, targetPath, mode })` 为无条件执行，filter 后 `sourceFiles` 为空的 item 不会被剔除。`reporter.ts` 的 `reportPlan()` 方法显式检查 `item.sourceFiles.length === 0` 并输出 `emptySourceDir` 消息行。

Story 6-2 Task 3.6 声称"filter 在 Match 阶段执行，Match 输出同时供 Install 和 Report 消费，架构保证 dry-run 一致性（无需额外处理）"——这一论断建立在 filter 会完全移除非匹配 item 的假设上，但实际实现只过滤了 `sourceFiles` 内容而未剔除空 item 本身。

**严重性判断**：合理，升至 P1 — AC #5 明确要求"预览计划中只展示匹配子目录的安装条目"。空 item 仍出现在 dry-run 输出中违反了 AC 的字面语义。这不仅是 UX 问题，也会导致 AC #5 的自动化测试无法以当前设计通过。

**修订建议**：可行 — 在 `matchRules()` 主循环中 filter 后增加 `if (sourceFiles.length > 0)` 守卫是最小改动方案。审查建议（在 push 前剔除或归一化步骤）均可行。应同时补充"部分命中 + dry-run"测试场景。

**误报评估**：非误报 — 代码路径推理可直接从源码复现。

## 发现 #3 评估

### 审查原文

> **[中][新] Story 6-1 为 Reporter 新增必填 reportList，但没有把共享接口迁移面写入任务**
> - 来源：consistency+contract
> - 分类：patch
> - 涉及 Story：6-1
> - 证据 - Task 4 要在 `Reporter` 接口上新增必填 `reportList()`；但 Task 6 只覆盖 `tests/core/reporter.test.ts`、`tests/stages/list-contents.test.ts` 和少量 `tests/pipeline.test.ts` 场景。当前仓库里大量 stage、integration 和 pipeline 测试都用 `Reporter` typed mock，现文档没有把这些 mock / fixture 的迁移列为显式任务。
> - 影响 - 开发者如果只按 Story 列出的改动面执行，会在大量既有测试夹具上触发编译失败；这属于共享契约迁移遗漏，不是实现阶段可以自然"顺手补掉"的小问题。
> - 建议 - 将 `reportList()` 视为共享接口变更，补一条横切关注点任务：扫描所有 `Reporter` mock / fixture，逐一标注"需改动 / 可保持不变"，并把对应测试文件纳入 File List 或测试任务清单。

### 评估结论：⚠️ 有效但降级 — 建议纳入后续改善跟踪（P2）

### 评估分析

**问题描述准确性**：基本准确 — 当前 `Reporter` 接口确实不包含 `reportList()` 方法，Task 4 要求新增该必填方法。全仓库搜索确认 `authenticate.test.ts` 等多个测试文件存在 `mockReporter` 定义，添加必填方法后这些 mock 确实需要更新。

**严重性判断**：偏高 — 该问题的"影响"描述有夸大成分。TypeScript 编译器会**立即**在所有未实现新方法的 mock 处报错，开发者不可能遗漏——这正是强类型系统的价值。mock 更新是纯机械操作（添加一个 `reportList: vi.fn()` 行），任何合格的 dev agent 或开发者在编译失败时都会自然处理。将其定性为"不是实现阶段可以自然顺手补掉的小问题"过重。

但 Story 从文档完整性角度确实可以做得更好：一条横切关注点注释（"注意：此接口变更影响所有 Reporter mock"）即可消除歧义。

**修订建议**：可行但非必要 — 添加完整的 mock 清单任务是过度文档化。建议在 Task 4 或 Dev Notes 中补一句"注意影响面：所有 `Reporter` typed mock 需同步添加 `reportList` 实现"即可，无需逐文件枚举。

**误报评估**：非误报（问题存在），但严重性和影响判断需降级。TypeScript 编译守卫使该问题不构成开发阻塞。

## 发现 #4 评估

### 审查原文

> **[中][新] Story 6-3 的 universalDirs 派生状态归属与验证路径仍然分叉**
> - 来源：structure+consistency+contract
> - 分类：patch
> - 涉及 Story：6-3
> - 证据 - Task 5 与 Dev Notes 同时给出了三套方案：`createProductionStages()` 的 match 闭包读取 config、`runPipeline()` 先派生 `enableUniversal` 再塞回 `ParsedArgs`、以及扩展 `matchRules()` 签名；但文档没有锁定唯一实现口径。与此同时，Task 9.3 还把 manifest 与"第二次安装 skipped"验证放到当前以 mocked `saveManifest()` 为主的 `tests/pipeline.test.ts`，无法证明真实 install + manifest 链路。
> - 影响 - 这会把 CLI 原始输入、配置派生状态和验证责任混在一起，导致实现人员可以走出多条不兼容路径；即使测试全绿，也可能没有任何一条测试真正证明通用目录的运行时行为。
> - 建议 - 在 Story 中选定唯一的 ownership：要么编排器派生并显式传参，要么扩展 `matchRules()` 输入，但不要两套方案并存；同时把 manifest / skipped 验证迁移到真实阶段闭包或集成链路中。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 交叉验证 Story 6-3 文档确认：Task 5.1 标记为"方案 A（推荐）"但 5.2 提供替代实现路径；Dev Notes 的"universalDirs 偏好传递"章节同样列举"推荐方案"和"替代方案"而未做最终裁决。虽然"推荐"标记提供了方向性指引，但 Story 作为 dev agent 的执行规格，包含多个可选路径会导致实现分歧——特别是当 dev agent 在不同会话中可能选择不同方案时。

多来源命中（structure+consistency+contract）增强了该发现的可信度：结构上存在多路径、一致性上不同章节指向不同方案、契约上测试层无法验证运行时真实行为。

**严重性判断**：合理 — Story spec 应当是明确的实施契约。有"推荐"标记但同时保留替代路径，在实践中仍会产生歧义。结合 Finding #1（AC #3 增量同步不可达），此问题与 #1 形成联合阻塞：即使锁定了 ownership，如果 AC #3 的实现策略不先重写，选择哪条路径都无法达成目标。

Task 9.3 的 mocked 测试限制也被确认：`tests/pipeline.test.ts` 使用 mock stages，无法执行真实的 `executeInstall()` → `saveManifest()` 链路，"第二次安装 skipped"断言在 mock 环境下无法证明实际行为。

**修订建议**：可行 — 删除替代方案、锁定唯一路径是直接的文档修订。建议锁定"方案 A + createProductionStages 闭包内 config 读取"（与项目现有的阶段工厂模式一致），并把 manifest/skipped 验证迁移到集成测试层。

**误报评估**：非误报 — 文档证据可直接验证。

## 发现 #5 评估

### 审查原文

> **[低][新] Story 6-1 对"可安装子目录"的定义仍与真实 rule-based 安装集合不一致**
> - 来源：structure+consistency
> - 分类：patch
> - 涉及 Story：6-1
> - 证据 - `6-1` 的 `listContents()` 与 `scanAvailableTopDirs()` 都以目录存在性为准，分别使用 `DEFAULT_EXCLUDES` 或 `!name.startsWith('.')` 过滤，但 AC / `list.title` 文案写的是"可安装子目录"。当前真正的 installable 集合由 `InstallRule` / `RULE_INDEX` 决定，而不是"目录存在即可"；同时 `scanAvailableTopDirs()` 还被 `6-2` 复用，进一步放大了该语义漂移。
> - 影响 - list 输出、零匹配候选列表和真实匹配规则之间仍可能出现口径不一致，后续用户会把"看得见"误判成"肯定可装"。
> - 建议 - 二选一：要么把 Story 6-1 的文案从"可安装子目录"收窄为"现有子目录"；要么补充 rule-based 过滤契约，并同步统一 `scanAvailableTopDirs()` 的过滤口径。

### 评估结论：⚠️ 有效但降级 — 建议纳入后续改善跟踪（P2）

### 评估分析

**问题描述准确性**：基本准确但有细微偏差 — 代码确认 `scanAvailableTopDirs()` 按目录存在性（排除 `.` 开头）过滤，`RULE_INDEX` 硬编码仅允许 `agents`、`skills`、`instructions`、`mcp-tools` 四个源目录。语义差距确实存在。

但需注意 AC #1 原文实际写的是"终端输出 `skills/` 下的所有子目录名称列表"，**不是**"可安装子目录"。AC 的意图是列出指定目录下的内容帮助用户发现，而不是过滤出 rule-matched 项。审查引用的"可安装子目录"措辞可能来自 list.title 的 UI 文案或其他位置，并非 AC 本身的要求。

`scanAvailableTopDirs()` 被 Story 6-2 复用的场景（零匹配候选列表）确实需要更精确的语义，但该复用场景在 Story 6-2 的 Task 4.2 中已有独立上下文——用户输入的 `dirPrefix` 本身就限定了扫描范围到正确的源目录下。

**严重性判断**：偏高 — 原始 [低] 严重性已经合理，但审查建议将其作为 patch（需修订）有些过重。`--list` 功能本质上是一个发现/探索工具，输出"这个目录下有什么"是合理的行为。用户即使看到一个非 rule-matched 的子目录，安装时也会因规则不匹配而跳过，不会产生数据风险。

**修订建议**：可行但属于锦上添花 — 收窄文案从"可安装子目录"到"现有子目录"是最小成本方案。但如果 AC 本身并未使用"可安装"措辞，则可能只需调整 UI 文案措辞即可，无需修改设计。

**误报评估**：非误报（语义差距确实存在），但实际影响有限，降级为后续改善更合适。

## 整体评估结论

### 需要修订（阻塞进入开发）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 1 | AC #3 增量同步依赖不存在的目录级 skip 链路 | [高] | P1 | 设计与实现能力断裂，需重写实现策略 |
| 2 | filter 后空 item 仍进入 dry-run 计划 | [中] | P1 | 违反 AC #5，需补 item 剔除逻辑 |
| 4 | enableUniversal ownership 与验证路径分叉 | [中] | P1 | 需锁定唯一方案，迁移测试到集成层 |

### 建议纳入后续改善跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 3 | reportList 共享接口迁移面未入任务 | [中] | P2 | TypeScript 编译守卫可兜底，补注释即可 |
| 5 | "可安装子目录"语义漂移 | [低] | P2 | AC 原文并未使用该措辞，影响有限 |

### 可忽略（误报）

| # | 发现 | 原始严重性 | 忽略理由 |
|---|------|----------|---------|
| — | 无 | — | — |

### 评估决定

**整体结论**：需修订后再审

Story 6-3 承载了本轮最大阻塞面：Finding #1（AC #3 增量同步不可达）和 Finding #4（enableUniversal 路径分叉）形成联合阻塞，建议优先重写 AC #3 的实现策略、锁定 enableUniversal 唯一 ownership 后再进入下一轮审查。Story 6-2 的 Finding #2（filter 空 item）修订面较小，可在同一轮修订中一并处理。两条 P2 项建议在 Story 文档中以注释形式标注即可，不阻塞进入开发。

## 修订执行记录

### 修订执行记录
- **Date**: 2026-04-15
- **Model Used**: Claude Opus 4.6 (claude-opus-4-6)
- **Fix Items**: 3

#### 修订项 #1: Story 6-3 AC #3 增量同步依赖不存在的目录级 skip 链路
- **文件**: `_bmad-output/implementation-artifacts/stories/6-3-universal-directory-install.md`
- **章节**: Task 6.4、Dev Notes (核心设计原则 NFR-C7)
- **修改摘要**:
  - **Task 6.4**: 原文声称"`checkConflict()` 基于 targetPath + hash 比对，已有逻辑自动处理"，实际 `determineDirStatus()` 仅返回 `'new'`/`'updated'`，不存在 `'skipped'` 路径。重写为**文件级 hash 比对方案**：在 `copyDir()` 内部逐文件计算 hash 与 manifest 比对，hash 相同跳过，不同则重新写入；manifest 为 `Directories` 类型每个文件单独记录 entry（而非整目录单条空 hash）
  - **Dev Notes NFR-C7 核心设计原则**: 标题从"不引入新代码路径"修正为"复用现有安装引擎"；删除 `executeInstall()` 和 `saveManifest()` "零改动"声明，改为"需有限扩展"并注明原因和 Task 6.4 引用
- **状态**: 已完成

#### 修订项 #2: Story 6-2 filter 后空 item 仍进入 dry-run 计划
- **文件**: `_bmad-output/implementation-artifacts/stories/6-2-filter-subdirectory-install.md`
- **章节**: Task 3.3、Task 3.6、Task 6.2
- **修改摘要**:
  - **Task 3.3**: 在 filter 过滤逻辑后增加 `if (sourceFiles.length === 0) → 不执行 items.push，跳过此条规则` 守卫，附注释说明"空 item 必须在 push 前剔除，否则 `reportPlan()` 会输出 `emptySourceDir` 行，违反 AC #5"
  - **Task 3.6**: 删除"无需额外处理"的绝对语句，修正为"filter 后必须剔除空 item（Task 3.3 守卫），以保证 dry-run 预览中不包含未匹配规则的 emptySourceDir 输出行"
  - **Task 6.2**: 新增"部分规则命中 + dry-run 仅包含非空匹配项"测试用例（AC #5 回归保护）
- **状态**: 已完成

#### 修订项 #3: Story 6-3 enableUniversal ownership 与验证路径分叉
- **文件**: `_bmad-output/implementation-artifacts/stories/6-3-universal-directory-install.md`
- **章节**: Task 5、Dev Notes (universalDirs 偏好传递)、Task 9.3
- **修改摘要**:
  - **Task 5**: 删除"方案 A（推荐）"/"替代方案"双路径表述，合并为唯一实现方案（已锁定）：`createProductionStages()` 工厂 match 闭包内加载 config 计算 `enableUniversal`，通过闭包捕获传递。原 5.1/5.2/5.3/5.4 四个子任务重组为 5.1(唯一方案)/5.2(合并逻辑)/5.3(降级规则)/5.4(闭包传递)
  - **Dev Notes universalDirs 偏好传递**: 标题加"（已锁定方案）"后缀；删除"传递方式"段落和"替代方案"段落，仅保留"唯一实现方案"的完整代码示例
  - **Task 9.3**: 将增量同步测试（"第二次安装时通用目录中未变更的文件被 skip"）从 mocked `pipeline.test.ts` 移出，改为独立的 Task 9.5 集成测试，要求使用真实 `executeInstall()` → `saveManifest()` 链路验证文件级 hash 比对运行时行为，覆盖首次安装/无变更 skip/部分变更重写三个场景
- **状态**: 已完成
