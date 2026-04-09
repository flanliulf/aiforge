# Epic 5 Story 审查总结

## 审查范围

- Epic 5 全部 7 个 story：
  - `5-1-phase-progress-and-spinner.md`
  - `5-2-tree-result-summary-and-stats.md`
  - `5-3-tty-adaptive-and-quiet-mode.md`
  - `5-4-three-part-error-messages.md`
  - `5-5a-i18n-language-selection.md`
  - `5-5b-e2e-integration-tests.md`
  - `5-5c-mvp-go-nogo-gate.md`
- 对照基准：
  - `_bmad-output/project-context.md`
  - `_bmad-output/planning-artifacts/epics/epic-5.md`
  - `_bmad-output/implementation-artifacts/sprint-status.yaml`
  - `_bmad-output/planning-artifacts/implementation-readiness-report-2026-03-17.md`
  - `_bmad-output/planning-artifacts/architecture/03-core-decisions.md`
  - `_bmad-output/planning-artifacts/architecture/04-implementation-patterns.md`
  - Epic 1 / 2 / 4 相关 story（特别是 1.3 / 1.4、2.1 / 2.5、4.5 / 4.6b）
  - `README.md`

## 审查维度

- Story 结构是否完整
- Acceptance Criteria 是否清晰、可测试、可实施
- 输出体验、错误渲染、国际化、E2E 验证之间的责任边界是否清楚
- 是否与 Epic 4 的输出 story 发生重复定义或职责漂移
- 是否存在“文档上像增强，实际却需要跨全项目重构”的隐藏范围膨胀

## 总体结论

Epic 5 的目标很明确：把前四个 Epic 已能工作的主链路，打磨成真正可发布的 CLI 体验，并通过端到端测试和门禁清单完成 MVP 的收口。

从用户价值上看，这一 Epic 很完整：进度反馈、结果汇总、TTY/非TTY 自适应、三段式错误、语言配置、E2E 测试、Go/No-Go 验收，几乎覆盖了“发布前最后一公里”的所有关键要素。

但这也是当前 story 集中里**跨 story 契约压力最大**的一组：Epic 5 不只是“补体验”，而是在很多地方重新定义 `Reporter`、`messages.ts`、错误文案、测试验收矩阵、发布门禁口径。如果不先把边界收口，开发阶段很容易出现“每个 story 看起来都对，但合起来范围重叠、接口不兼容”的情况。

结论分级如下：

- 通过：0 个
- 有条件通过：7 个
- 硬阻塞：0 个

总体判断：**Epic 5 具备较强的发布就绪目标感，但当前仍不建议直接整体移交开发；应先修正 Reporter 工厂签名、输出边界、i18n 重构范围、E2E 验收矩阵这 4 类问题，否则实现阶段会出现跨 Epic 返工。**

## 逐篇审查结论

### Story 5.1: 阶段式进度与 spinner 动画

**结论：有条件通过**

**优点**

- 用户价值明确，FR-035 的落点非常直观。
- 进度信息走 stderr 的设计与架构、dry-run 可管道消费目标一致。
- 明确复用 `MESSAGES.phases`，没有在本 Story 中再次硬编码阶段名，方向正确。

**关键问题**

1. **“错误时 spinner 显示 ✗ 标记”尚未对应到明确接口。**
   - 当前 Reporter 接口只有 `startPhase()` / `updatePhase()` / `completePhase()` / `reportError()`。
   - Story 写了“错误时 spinner 显示 ✗ 标记”，但没有说明是通过 `reportError()` 间接触发，还是要扩展新的 phase-fail 语义。
   - 如果不先说清楚，开发者可能在 `reportError()`、`completePhase()` 或额外私有方法里各自实现，导致行为不一致。

**建议动作**

- 在 Story 中明确：错误时 spinner 的失败态由哪一个 Reporter 方法负责触发，不要把“UI 期望”留给实现者自己解释。

### Story 5.2: 树形结果汇总与统计

**结论：有条件通过**

**优点**

- FR-036 的目标表达清楚，用户完成安装后确实需要更好的结果可视化。
- 按工具分组、状态图标、统计行三部分组成一个完整的结果视图，体验目标合理。
- 使用 `TOOL_DEFINITIONS.name` 做工具显示名映射，也体现了复用已有数据层的意识。

**关键问题**

1. **与 Story 4.6b 的职责重叠仍然存在。**
   - Story 4.6b 已经定义 `reportResult()`、按工具分组、PlainReporter 输出、QuietReporter 输出、统计行。
   - Story 5.2 再次要求实现 `TtyReporter.reportResult()` 和 `PlainReporter.reportResult()`，只是把输出形式做得更精致。
   - 当前两篇 story 的边界仍偏模糊：到底 4.6b 交付“基础可用版”，还是 5.2 才是第一次真正实现结果输出？

**建议动作**

- 在本 Story 开头或 Dev Notes 中明确：
  - 4.6b 提供最小可用输出；
  - 5.2 仅增强 TTY 树形展示和统计格式。
- 避免让 `PlainReporter` 的完整格式在 4.6b 和 5.2 中重复实现两遍。

### Story 5.3: TTY 自适应与 quiet 模式

**结论：有条件通过**

**优点**

- FR-038 / FR-039 与 NFR-U4 的用户价值都很明确。
- 非 TTY 降级、`--quiet` 精简、dry-run stdout 纯净，这三类行为目标一致性较高。
- 与 `project-context.md` 的“非 TTY 环境不能等待交互输入”原则保持一致。

**关键问题**

1. **`createReporter` 的函数签名与 Story 1.3 不一致。**
   - Story 1.3 定义的是 `createReporter(options: { quiet: boolean; isTty: boolean }): Reporter`。
   - 本 Story Dev Notes 改成了 `createReporter(args: ParsedArgs): Reporter`。
   - 这会让 Epic 5 在增强 Reporter 工厂时，隐式重写 Epic 1 的公共接口契约。

2. **本 Story 与 Epic 4 的非 TTY 冲突行为有重复定义。**
   - Epic 4 Story 4.5 已明确：非 TTY 遇到需要用户决策时直接失败。
   - 本 Story AC #4 又重复定义了一次同样规则。
   - 这不一定错误，但应该说明 5.3 是“统一收口输出层行为”，而不是再次定义冲突处理业务规则。

**建议动作**

- 统一 `createReporter` 的正式签名，避免 Epic 5 临时改写 Epic 1 的公共接口。
- 将 AC #4 改写为“验证 Epic 4 的非 TTY 冲突策略在 Reporter / CLI 层正确生效”，以消除职责漂移。

### Story 5.4: 三段式错误提示完善

**结论：有条件通过**

**优点**

- FR-037 / NFR-U2 的用户价值高，属于 CLI 可用性的核心组成部分。
- “message → why → fix” 的三段式模型与项目上下文一致。
- 列出一组常见错误码及对应修复建议，对后续实现很有帮助。

**关键问题**

1. **PlainReporter 示例与 AC 的统一格式要求不一致。**
   - AC #2 写的是：任何 `AiforgeError` 都渲染为 `❌ ${message}` → `${why}` → `${fix}`。
   - 但 Dev Notes 中的 PlainReporter 示例却变成：`ERROR:` / `WHY:` / `FIX:` 前缀格式。
   - 这会让开发者不清楚 PlainReporter 是要“保留三段式语义”还是“采用另一套文本协议”。

2. **Task 2 的范围实际上是全项目审计，不再是单一 story 范围。**
   - “审查所有 AiforgeError 创建点，确保 why/fix 有针对性”已经超出了单个 Reporter story 的局部改造。
   - 它会牵动 Epic 2 ~ 4 的所有错误创建代码与文案。
   - 这类工作不是不能做，但文档需要承认它是一次跨模块收口，而不是普通 UI 优化任务。

**建议动作**

- 统一 PlainReporter 是否也使用 `❌ / why / fix` 三段式视觉格式，还是仅保留语义三段式。
- 将 Task 2 明确标注为“跨模块错误文案审计”，并补一句实施范围说明，避免低估工作量。

### Story 5.5a: 国际化语言选择与配置

**结论：有条件通过**

**优点**

- FR-046 / NFR-U1 的用户价值明确，中英文切换是典型的发布前增强需求。
- 复用 `config.json.language` 字段有前置基础，不需要另起持久化模型。
- 从 `messages.ts` 入手做双语扩展，方向上是正确的。

**关键问题**

1. **本 Story低估了国际化对前序 story 的重构范围。**
   - 当前前序文档中大量用户可见字符串仍是直接写死的中文：
     - `reporter.startPhase('执行安装...')`
     - 各种 `AiforgeError('未找到配置文件', ...)`
     - init 命令中的交互提示与确认文案
   - 本 Story AC #3 却要求“所有用户可见字符串通过 messages 模块获取”。
   - 这意味着它不只是给 `messages.ts` 加英文，而是要把前 1~4 Epic 的字符串来源整体重构为消息键/消息工厂。

2. **Dev Notes 明确使用 `console.error`，与项目上下文规则冲突。**
   - 回退逻辑示例中直接 `console.error('⚠️ 不支持的语言...')`。
   - 但 `project-context.md` 明确规定：**所有用户可见输出必须通过 Reporter 接口**。
   - 而 Story 2.5 又明确 init 命令当前直接使用 `console.log`，这与本 Story的“所有字符串统一由 messages 模块与 Reporter 管理”形成二次冲突。

3. **Reporter 工厂与语言注入方式尚未被正式定义。**
   - Task 3.3 写“将 language 传递给 Reporter 和 messages 模块”。
   - 但 Story 1.3 的 Reporter / `createReporter()` 设计里没有 language 维度。
   - 如果这里不先定义清楚，开发者可能分别走“全局单例 messages 状态”或“Reporter 构造时注入 language”两条路线，后续难以统一。

**建议动作**

- 将本 Story 明确为“带有跨 Epic 文案抽取的重构 Story”，不要把范围伪装成只改 `messages.ts`。
- 先统一语言注入机制：
  - 是 `setLanguage()` 全局状态；
  - 还是 Reporter / command 层显式传入 language。
- 对 init 命令单独说明：
  - 如果它继续不走 Reporter，就要定义一套与 messages 模块兼容的交互文案获取方式；
  - 否则需要先修订 Story 2.5 的输出边界。

### Story 5.5b: 端到端集成测试

**结论：有条件通过**

**优点**

- E2E 测试作为发布前信心来源是合理的。
- 覆盖全局/项目安装、三种模式、dry-run、一致性、冲突场景、零结果场景，测试目标完整。
- 使用真实文件系统和临时目录隔离环境，思路正确。

**关键问题**

1. **测试矩阵与现有规则数据不一致。**
   - Task 2.2 写“验证 4 工具 × 4 资源类型的安装结果”。
   - 但 Story 1.4 已明确：MVP 实际 16 条规则（Copilot 8 + Claude 4 + Cursor 3 + VS Code 1）；部分工具并不支持所有资源类型。
   - README 也显示：Claude、Cursor、VS Code 各自支持的资源类型不同，VS Code 甚至没有项目级安装。
   - 如果按当前任务文字执行，会要求开发者验证一个并不存在的全覆盖矩阵。

2. **冲突场景 AC 比任务更大，测试覆盖不完整。**
   - AC #4 要求“备份、跳过、覆盖”等行为符合设计。
   - 但 Task 5.1 目前只写了 `--force` 覆盖验证。
   - 这会导致 AC 想测三类决策，任务却只真正实现一种。

3. **dry-run 一致性示例验证口径过弱。**
   - Dev Notes 示例只比对 `relativePath` 与目标 basename。
   - 这不足以验证目标路径一致，更无法可靠覆盖 flatten 场景的重命名规则。
   - 与 NFR-U5 要求的“文件列表 + 目标路径一致”不完全匹配。

4. **Linux（CI）通过要求仍缺少明确执行载体。**
   - readiness report 已指出目前没有显式 CI/CD Story。
   - 5.5b AC #7 却直接把“Linux 环境（CI）全部通过”作为验收项。
   - 这不是不可做，但至少应明确由何种 CI 承载，否则验收口径会悬空。

**建议动作**

- 将测试矩阵改成“按真实规则矩阵验证”，而不是 4×4 理想满覆盖。
- 明确冲突测试至少覆盖：跳过、备份后覆盖、`--force` 覆盖 三条主路径。
- 将 dry-run 一致性对比升级为：**目标路径列表 + 安装模式语义** 的对比，而不只是文件名比对。
- 为 Linux CI 验收补一句“若当前无 CI，先作为手动/临时 runner 验证项”，或补一个独立的 CI Story。

### Story 5.5c: MVP Go/No-Go 发布门禁验收

**结论：有条件通过**

**优点**

- 已明确说明这不是标准开发 Story，而是发布门禁/验收清单，定位坦诚。
- Blocker / Warning 两级门禁设计合理，适合作为最终验收记录。
- 将新员工旅程、dry-run 一致性、冲突备份、零结果诊断、npm 包安全审计统一纳入清单，覆盖面较完整。

**关键问题**

1. **门禁检查项里混入了过于具体的实现假设。**
   - Task 2.2 直接要求检查 `.npmignore` 是否排除了 tests/、src/、`.eslintrc` 等。
   - 但 npm 打包是否依赖 `.npmignore`，还是 `package.json.files` / build 产物控制，并不是稳定前提。
   - 发布门禁应验证“最终 packlist 是否安全”，而不是绑定某一种打包实现手段。

2. **发布门禁对前置自动化能力的依赖，没有单独收口。**
   - 它依赖 5.5b 的 E2E 全量通过、关键旅程验证、打包审计、退出码验证。
   - 但这些能力本身仍存在测试矩阵和 CI 载体的不确定性。
   - 如果不先修正 5.5b，这份门禁清单会变成“看起来很完整，但验证来源并不稳定”的文档。

**建议动作**

- 将安全审计项改写为“检查最终 `npm pack --dry-run` 的产物列表和元数据”，不要强耦合 `.npmignore`。
- 在 Story 中补一句：门禁结论依赖于 5.5b 的测试与关键旅程验证先收口完成。

## 关键问题汇总

### 需要优先修正

1. **Story 5.3 的 Reporter 工厂签名与 Story 1.3 不一致**
   - `createReporter(options)` vs `createReporter(args)`

2. **Story 5.5a 低估了 i18n 的真实改造范围**
   - 不只是 messages.ts 加英文，而是前 1~4 Epic 的用户可见字符串都要抽离

3. **Story 5.5a / 2.5 / project-context 在输出规则上互相冲突**
   - project-context 要求所有输出走 Reporter
   - 2.5 明确 init 使用 `console.log`
   - 5.5a 又想把所有字符串统一到 messages + language

4. **Story 5.5b 的测试矩阵与真实规则矩阵不一致**
   - 4 工具 × 4 资源类型并不是当前 MVP 的真实支持范围

5. **Story 5.2 / 5.3 与 Epic 4 输出 story 仍有明显重叠**
   - 结果输出、PlainReporter、QuietReporter 的边界没有彻底收口

6. **Story 5.4 的 PlainReporter 错误格式与 AC 不一致**
   - `ERROR/WHY/FIX` 与 `❌ + why + fix` 两套协议并存

### 建议补充澄清

1. spinner 失败态由哪个 Reporter 接口负责触发
2. PlainReporter 是否保留 emoji，还是只保留纯文本三段式语义
3. init 命令在 i18n 之后是否仍允许独立于 Reporter 输出
4. Linux CI 验收由什么执行载体承接
5. 发布门禁验证项应检查“最终产物”还是检查某一种打包机制

## 最终判定

Epic 5 的 story 集合**产品目标完整、发布导向清晰、验收意识强**，是整个规划里最接近“上线前总收口”的一组文档。

但从 Story Preparation 质量标准看，目前最需要收口的是下面三条原则：

- **公共接口不能临时改写**：Reporter、messages、Reporter 工厂等公共契约必须先统一，再做体验增强
- **体验增强不应掩盖重构成本**：i18n 实际是跨多个 Epic 的字符串来源重构，必须承认范围
- **验收矩阵必须基于真实能力边界**：E2E 和 Go/No-Go 不能按理想化满矩阵来写

**建议：优先修订 Story 5.3、5.5a、5.5b，再整体回看 5.2 / 5.4 / 5.5c 的边界与验收口径，然后再将 Epic 5 正式移交开发。**

---

## 实际修正总结（2026-03-17）

基于上述审查结论，已在 commit `0a08cd7` 中完成以下修正：

### Story 5.1: 阶段式进度与 spinner 动画

**已修正**：

1. Task 1.5 补充明确说明：spinner 失败态由 `reportError()` 内部触发——如果当前有活跃 spinner，先调用 `this.spinner.fail()` 显示 ✗，再渲染三段式错误。这是 TtyReporter 的内部实现细节，不需要扩展 Reporter 接口。

### Story 5.2: 树形结果汇总与统计

**已修正**：

1. Dev Notes 新增"与 Story 4.6b 的边界"章节，明确：4.6b 提供最小可用的 `reportResult()` 实现（按工具分组逐行输出 + 统计行），本 Story 在此基础上增强 TtyReporter 为树形展示；PlainReporter 的制表符分隔格式已在 4.6b 中完成，本 Story 不重复实现。

### Story 5.3: TTY 自适应与 quiet 模式

**已修正**：

1. `createReporter` 保持 Story 1.3 定义的签名 `createReporter(options: { quiet: boolean; isTty: boolean }): Reporter`，不接受 `ParsedArgs`（避免 core 层反向依赖 CLI 层类型）— 消除与 Story 1.3 的签名冲突
2. Dev Notes 示例代码完全重写：在 `index.ts` 中从 `ParsedArgs` 提取参数后传入，`core/reporter.ts` 中签名不变
3. AC #4 改写为"验证 Epic 4 Story 4.5 的非 TTY 冲突策略在 CLI 层正确生效"，明确本 Story 不重新定义冲突处理规则，只确保 Reporter/CLI 层行为一致 — 消除职责漂移

### Story 5.4: 三段式错误提示完善

**已修正**：

1. AC #2 区分 TtyReporter 和 PlainReporter 的视觉格式：TtyReporter 使用 `❌` + chalk 着色，PlainReporter 使用 `ERROR:/WHY:/FIX:` 纯文本前缀（无 emoji，CI 兼容），两者保持三段式语义一致 — 消除格式协议并存的歧义
2. Task 2 标题改为"跨模块错误文案审计"，Task 2.1 明确标注"这是一次跨模块收口，涉及多个 Epic 的错误创建代码，工作量不应被低估" — 承认真实范围

### Story 5.5a: 国际化语言选择与配置

**已修正**：

1. AC #3 明确承认这是一次"跨 Epic 字符串来源重构"，列举需要抽离的硬编码字符串来源
2. Task 1 新增 Task 1.7"跨 Epic 字符串抽取"，明确将 Epic 1~4 中所有硬编码的用户可见中文字符串替换为 `msg()` 调用
3. 语言注入机制统一为 `setLanguage(lang: string): void`（模块级全局状态）+ `msg(key: string): string`（按 dot notation 查找），Reporter 和所有阶段通过 `msg()` 获取文案，不需要显式传递 language 参数
4. Task 3.2 的非法语言回退提示改为 `process.stderr.write()`（替代 `console.error`），并标注"这是唯一允许不经过 Reporter 的输出场景——因为语言加载发生在 Reporter 创建之前"
5. Dev Notes 新增"init 命令的 i18n 处理"章节：init 继续使用 `console.log` 输出（见 Story 2.5），但文案来源改为 `msg()` 消息键调用，实现不走 Reporter 但仍支持双语

### Story 5.5b: 端到端集成测试

**已修正**：

1. AC #1 测试矩阵改为"按 `BUILTIN_RULES` 真实规则矩阵（约 14 条，非理想化 4×4）验证"
2. AC #3 dry-run 一致性对比升级为"完整目标路径列表和安装模式"，不仅仅比对文件名
3. AC #4 冲突测试明确覆盖三条主路径：`--force` 覆盖、备份后覆盖、跳过
4. AC #7 Linux CI 补充"若当前无 CI 环境，先作为手动 runner 验证项，后续补充 CI 自动化"
5. Task 2.2 改为按真实 `BUILTIN_RULES` 验证，不按理想化满矩阵
6. Task 4.3 对比逻辑升级为完整目标路径 + 安装模式，需覆盖 flatten 场景的重命名规则
7. Task 5 拆分为 5.1~5.5 五个子任务，分别覆盖 `--force` 覆盖、备份后覆盖、跳过、零结果、排除列表
8. Dev Notes 的 dry-run 一致性验证示例代码完全重写，对比 `targetPath` + `mode` 而非仅 `basename`

### Story 5.5c: MVP Go/No-Go 发布门禁验收

**已修正**：

1. Task 2.1 改为检查 `npm pack --dry-run` 输出的"最终产物列表"
2. Task 2.2 改为检查"最终 packlist"不包含非发布内容，不再绑定 `.npmignore` 或 `package.json.files` 某一种打包机制 — 验证产物而非实现手段
3. 依赖关系说明补充"门禁结论的可信度直接取决于 5.5b 的测试覆盖质量，5.5b 必须先收口完成"

### 修正覆盖评估

| 审查问题 | 修正状态 |
|---------|---------|
| Story 5.3 Reporter 工厂签名与 Story 1.3 不一致 | ✅ 已修正（保持 Story 1.3 签名） |
| Story 5.5a 低估 i18n 真实改造范围 | ✅ 已修正（承认跨 Epic 重构，新增字符串抽取任务） |
| Story 5.5a/2.5/project-context 输出规则冲突 | ✅ 已修正（init 用 `console.log` + `msg()`，语言回退用 `stderr.write`） |
| Story 5.5b 测试矩阵与真实规则不一致 | ✅ 已修正（改为真实规则矩阵） |
| Story 5.2/5.3 与 Epic 4 输出 Story 重叠 | ✅ 已修正（明确 4.6b 为基础版，5.x 为增强版） |
| Story 5.4 PlainReporter 错误格式与 AC 不一致 | ✅ 已修正（区分 TTY/Plain 两套视觉格式） |
| spinner 失败态由哪个接口触发 | ✅ 已修正（`reportError()` 内部触发） |
| Linux CI 验收执行载体 | ✅ 已修正（补充手动验证项说明） |
| 发布门禁验证项绑定打包机制 | ✅ 已修正（改为检查最终产物） |