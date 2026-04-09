# Epic 4 Story 审查总结

## 审查范围

- Epic 4 全部 6 个 story：
  - `4-1-fs-utils-and-preflight-check.md`
  - `4-2-copy-mode-install.md`
  - `4-3-symlink-and-flatten-mode.md`
  - `4-4-manifest-state-and-conflict-detection.md`
  - `4-5-conflict-handling-and-safety.md`
  - `4-6a-pipeline-orchestration-and-error-flow.md`
  - `4-6b-install-result-summary-and-output.md`
- 对照基准：
  - `_bmad-output/project-context.md`
  - `_bmad-output/planning-artifacts/epics/epic-4.md`
  - `_bmad-output/implementation-artifacts/sprint-status.yaml`
  - `_bmad-output/planning-artifacts/implementation-readiness-report-2026-03-17.md`
  - `_bmad-output/planning-artifacts/architecture/03-core-decisions.md`
  - `_bmad-output/planning-artifacts/architecture/04-implementation-patterns.md`
  - Epic 1 / 3 / 5 相关 story（特别是 1.2 / 1.3 / 1.4 / 1.5、3.2 / 3.3、5.2 / 5.3）

## 审查维度

- Story 结构是否完整
- Acceptance Criteria 是否清晰、可测试、可实施
- 安装执行、manifest、冲突处理、结果输出之间的责任边界是否清楚
- `AiforgeError` / `severity` / `Reporter` / `PathResolver` 契约是否一致
- 是否与 Epic 5 的输出体验 Story 发生重复定义或前向覆盖

## 总体结论

Epic 4 是当前规划中**最接近真实交付主链路**的一组 story：用户是否能“安全安装、可恢复、可理解结果”，基本都在这一 Epic 中决定。

从结构上看，Epic 4 的 story 覆盖面完整：预检查、复制模式、symlink/flatten、manifest、冲突保护、管道整合、结果输出都已纳入，FR-016 ~ FR-032 的主干也能一一对应。

但也正因为 Epic 4 站在多个前序能力的交汇处，它目前暴露出的跨文档冲突也最多，主要集中在三类问题：

- **安装失败到底是 fail-fast 还是 partial continue**
- **manifest / conflict 检测到底依据什么 hash 与谁比较**
- **结果输出到底在 Epic 4 完成，还是在 Epic 5 才完成正式形态**

结论分级如下：

- 通过：0 个
- 有条件通过：6 个
- 硬阻塞：0 个

总体判断：**Epic 4 可以继续保持 ready-for-dev，但不建议直接交付开发代理顺序实现；应先收口安装错误语义、manifest 判定规则、Reporter 输出边界，否则非常容易出现“安装能跑，但状态判断和输出解释互相打架”的返工。**

## 逐篇审查结论

### Story 4.1: 文件操作工具与预检查

**结论：有条件通过**

**优点**

- Story 范围清楚，把文件工具集和 preflight 收口为 Install 阶段第一步，符合架构。
- FR-030、NFR-R2、NFR-S5 覆盖自然，且与 Install 阶段前置校验职责一致。
- `copyFile` / `copyDir` / `createSymlink` / `backupFile` / `fileHash` 这些基础能力拆分合理，后续 story 可复用。

**关键问题**

1. **“可创建/可覆盖”权限判定口径还不够完整。**
   - AC #2 要求验证“当前用户有足够权限创建/覆盖文件”。
   - 但 Tasks 主要写的是对目标路径父目录做 `fs.access(dir, W_OK)`。
   - 这只能覆盖一部分创建场景，却没有明确已有目标为文件/目录/符号链接时的覆盖判定规则。
   - 开发者可能分别按“父目录可写即可”“目标本身也必须可写”“已存在目录视为冲突”三种不同口径实现。

2. **路径遍历校验示例没有把 allowed root 的来源说清楚。**
   - Dev Notes 给了 `validatePath(targetPath, allowedRoot)` 示例。
   - 但 allowedRoot 到底来自 `PathResolver`、规则目标目录模板，还是安装 scope 的固定根目录，并未明确。
   - 这会让 preflight 的安全边界和目标路径解析边界混在一起。

**建议动作**

- 明确 preflight 的权限判断矩阵：
  - 新建文件看哪一级目录；
  - 覆盖现有文件/目录/符号链接分别怎么判定；
  - 与冲突检测（Story 4.4/4.5）谁先执行。
- 明确路径遍历的 allowed root 生成规则，并要求与目标路径解析使用同一套来源，不要在 preflight 本地再发明一套根目录规则。

### Story 4.2: 复制模式安装执行

**结论：有条件通过**

**优点**

- Install 阶段的主流程已经成形：preflight → 分发执行 → 状态判定 → 结果积累。
- `files` / `directories` 两类 copy 模式拆解清楚，便于后续 4.3 继续扩展。
- new / updated / skipped 的状态意识较强，和最终结果汇总 story 有可连接性。

**关键问题**

1. **fail-fast 语义与示例实现不一致。**
   - AC #6 写的是：某个文件操作失败时，立即停止后续安装。
   - 但 Dev Notes 示例是在内层 `for` 循环里 `break`，这只停止当前 rule 的文件遍历，不保证停止后续 `plan.items`。
   - 同时示例把错误转成 `status: 'failed'` 结果继续返回，而不是抛出 `AiforgeError`。
   - 这与 `project-context.md` 中“所有错误必须使用 AiforgeError”以及 FR-031 的 fail-fast 预期存在明显张力。

2. **AC #5 的范围已经超出本 Story 自身边界。**
   - AC #5 写“agents、skills、instructions、mcp-tools 四类资源全部正确安装”。
   - 但本 Story 明确“不实现 flatten 模式（Story 4.3）”。
   - Cursor 的 skills 又恰好是 flatten 场景，因此“全部四类资源都由 4.2 验收完毕”并不成立。

**建议动作**

- 统一安装失败语义：
  - 如果文件操作失败属于 fatal，就抛 `AiforgeError(severity: 'fatal')` 并立即终止整个 Install；
  - 如果允许 partial，就必须明确哪些失败属于 partial，且不能再写 FR-031 的“立即停止后续安装”。
- 将 AC #5 改写为“本 Story 覆盖 copy 模式下适用的资源类型”，不要提前宣称 Epic 4 全量资源都在本 Story 闭环。

### Story 4.3: 符号链接与 flatten 模式

**结论：有条件通过**

**优点**

- `-l` 必须搭配 `-g` 的参数约束写得很明确，与 FR-021 一致。
- flatten 对 Cursor 规则的重命名逻辑描述具体，开发者可直接据此实现。
- symlink 与 flatten 作为对 `execute-install.ts` 的增量扩展，依赖链自然。

**关键问题**

1. **Story 使用了未定义的 `reporter.warn()` 契约。**
   - Dev Notes 的断链检测直接调用 `reporter.warn(...)`。
   - 但 Story 1.3 的 Reporter 接口只有 `startPhase` / `updatePhase` / `completePhase` / `reportResult` / `reportPlan` / `reportError`。
   - 这会让“断链警告”和“mainFile 缺失 warning”没有正式落点，开发者很容易回退到 `console.log`/`console.warn`。

2. **flatten 的“主文件缺失”只说记录 warning，没有定义结果语义。**
   - Task 2.4 说 `mainFile` 缺失时跳过并记录 warning。
   - 但没有说明它在 `InstallResult` 中应记为 `skipped`、`failed`，还是完全不产生结果项。
   - 这会直接影响 Story 4.4 的 manifest 更新、Story 4.6b 的统计行，以及零结果诊断的判断。

**建议动作**

- 明确 warning 的输出机制：
  - 要么扩展 Reporter；
  - 要么规定此类提示如何折叠到 `reportResult` / `reportError` / phase update 中。
- 为 flatten 缺失 `mainFile` 定义明确的结果状态和是否写入 manifest 的规则。

### Story 4.4: manifest 状态管理与冲突检测

**结论：有条件通过**

**优点**

- manifest 字段完整，原子写入与崩溃降级都与架构保持一致。
- 通过 `source` / `target` / `tool` / `scope` / `mode` / `hash` / `installedAt` 建立安装追踪，方向正确。
- 把“状态追踪”和“冲突检测”绑定在一起，也符合用户视角下的同一问题域。

**关键问题**

1. **`checkConflict()` 的契约前后不一致，当前定义不足以判断“已是最新 / 有更新”。**
   - Task 2.1 的签名是 `checkConflict(targetPath, manifest)`。
   - Dev Notes 的签名又变成 `checkConflict(targetPath, sourceHash, manifest)`。
   - 但示例实现虽然接收了 `sourceHash`，实际却只拿目标文件 hash 去比 manifest 里的旧 hash，并没有把“当前源文件 hash”纳入判断。
   - 这样就无法可靠区分“目标与上次安装一致，但源仓库已经更新”的场景。

2. **“未知来源”与“用户手写文件”被混成了一类。**
   - AC #4 写的是：manifest 损坏或丢失时，所有已存在文件视为“未知来源”。
   - Dev Notes 又说冲突检测会把它们标记为 `user-file`。
   - 这两者在产品语义上并不相同：未知来源是“系统无法判断”，用户手写是“可以确定不是 aiforge 安装”。
   - 若后续 4.5 依据这个标签做交互提示，会误导用户。

**建议动作**

- 统一 `checkConflict()` 的签名和判定逻辑：必须明确比较的是“源文件 hash vs 当前目标 hash vs manifest 记录 hash”中的哪几项。
- 将“未知来源”从 `user-file` 中分离，至少在文案或内部枚举上保留独立语义。
- `loadManifest()` 的降级条件应限定为“文件不存在 / JSON 损坏”，不要在示例里用宽泛 `catch` 吞掉所有 I/O 异常。

### Story 4.5: 冲突处理与安全保护

**结论：有条件通过**

**优点**

- FR-027 / 028 / 029 / 032 和 NFR-S6 覆盖完整，用户保护意识强。
- “备份后覆盖（推荐）”“非 TTY 直接失败”“--force 跳过交互”这些关键策略很实用。
- 交互选项设计也比较完整，符合 CLI 工具的实际使用场景。

**关键问题**

1. **本 Story 依赖的 `checkConflict()` 契约与 Story 4.4 仍未对齐。**
   - 4.5 Dev Notes 调用的是 `checkConflict(targetPath, sourceHash, manifest)`。
   - 但 4.4 的 Task 2.1 仍定义为 `checkConflict(targetPath, manifest)`。
   - 这意味着冲突处理 Story 已默认依赖一个“尚未在前置 Story 明确定义”的接口。

2. **多种用户可见提示没有明确归属到 Reporter 契约。**
   - 本 Story要求展示交互式冲突提示、查看差异、零结果诊断。
   - 但 Reporter 当前没有 `warn()` / `info()` / `diff()` 之类的方法。
   - 如果这里不先定义输出约束，开发实现时极易直接引入散落的 `console.*` 或各自格式化逻辑，破坏输出一致性。

**建议动作**

- 先与 Story 4.4 一起收口 `checkConflict()` 的正式签名，再写 4.5 的调用任务。
- 明确交互提示、差异预览、零结果诊断各自通过什么输出渠道呈现：
  - prompt 自身可交由 `@inquirer/prompts`；
  - 但诊断文本和差异摘要仍应绑定到统一输出约定。

### Story 4.6a: 管道完整编排与错误流控制

**结论：有条件通过**

**优点**

- 作为集成 Story，它把前 4 个 Epic 的主链路串联到了同一个编排器里，价值明确。
- 对正常模式和 dry-run 的分流关系有延续性，基本沿用了 Epic 1 / 3 的总体设计。
- readiness report 已提示它是技术集成型 Story；从文档角度看，这种定位是可接受的。

**关键问题**

1. **partial 错误语义与 Epic 4 的 fail-fast 安装语义正面冲突。**
   - AC #3 说 partial 错误被收集后继续执行后续文件。
   - 但 FR-031 / NFR-R3 以及 Story 4.2 的 AC #6 都强调“安装步骤失败时立即停止后续安装”。
   - Dev Notes 甚至进一步写成：partial 错误不会抛到管道层，而是变成 `InstallResult.status = 'failed'`。
   - 这与 `project-context.md` 里“所有错误都用 AiforgeError，severity 只有 fatal/partial”也不完全一致。

2. **manifest 保存责任与 Story 4.4 重复定义。**
   - Story 4.4 Task 3 已写“在 executeInstall 中安装完成后更新 manifest”。
   - 4.6a Task 3 又把 `saveManifest()` 放回 pipeline 层。
   - 这会导致开发者不清楚 manifest 是 Install 阶段内部职责，还是管道收尾职责。

**建议动作**

- 在 Epic 4 内部先做一个统一决策：
  - 安装失败到底是 fail-fast 还是允许 partial 继续；
  - 哪类错误能成为 partial，哪类必须 fatal。
- 将 manifest 保存责任固定在一处：
  - 要么由 Install 阶段完成并返回最终结果；
  - 要么由 pipeline 在 Install 成功后统一持久化；
  - 但不能两处都定义。

### Story 4.6b: 安装结果汇总与输出流分工

**结论：有条件通过**

**优点**

- 用户关心“到底装了什么、哪些成功、哪些失败”，把结果汇总单独拿出来是合理的。
- stdout/stderr 分工与整体架构方向一致。
- 使用 `data/messages.ts` 的图标和统计模板，说明它有试图复用已有数据层约定。

**关键问题**

1. **本 Story 与 Epic 5 的输出 Story 存在明显职责重叠。**
   - 4.6b 已要求 `TtyReporter.reportResult()`、`PlainReporter.reportResult()`、`QuietReporter.reportResult()`。
   - 而 Epic 5 的 Story 5.2 专门负责“树形结果汇总与统计”，Story 5.3 专门负责“TTY 自适应与 quiet 模式”。
   - 现在 4.6b 实际上已经把 5.2 / 5.3 的核心内容提前做掉了，导致 Epic 边界模糊。

2. **Story 自身也前后矛盾。**
   - Tasks 明确要求树形结构、PlainReporter、QuietReporter 全部实现。
   - 但“本 Story 不做的事”又说：
     - 不实现树形结构的高级格式化（Story 5.2）
     - 不实现 TTY 自适应和 quiet 模式的完整逻辑（Story 5.3）
   - 这会让开发者无法判断 4.6b 到底应该交付“基础 reportResult”还是“几乎完整的最终输出体验”。

**建议动作**

- 收窄 4.6b 的范围：
  - 只要求 `reportResult()` 的最小可用实现和 stdout/stderr 分工；
  - 把树形美化、TTY 自适应、quiet 行为继续留给 Epic 5。
- 或者反过来，如果决定在 4.6b 完成最终输出体验，就应同步瘦身 5.2 / 5.3，避免重复 Story。

## 关键问题汇总

### 需要优先修正

1. **Epic 4 对“安装失败”的语义没有统一**
   - `4.2` 强调 fail-fast
   - `4.6a` 又允许 partial continue
   - `project-context.md` 则要求所有错误用 `AiforgeError` 表达

2. **Story 4.4 / 4.5 的冲突检测接口未收口**
   - `checkConflict()` 是否需要 `sourceHash` 前后不一致
   - “已是最新 / 有更新 / 未知来源 / 用户手写”几种状态的判定依据不清

3. **Story 4.3 / 4.5 使用了 Reporter 尚未定义的提示能力**
   - `reporter.warn()` 未定义
   - warning / diff / 零结果诊断没有正式输出契约

4. **Story 4.6a 与 4.4 对 manifest 保存责任重复定义**
   - Install 内更新还是 pipeline 收尾更新，必须二选一

5. **Story 4.6b 与 Epic 5 输出 Story 重叠严重**
   - 树形结果、TTY 自适应、quiet 行为的实现边界不清

### 建议补充澄清

1. preflight 如何判定“覆盖现有目标”的权限是否合法
2. flatten 缺失 `mainFile` 时，是否生成 `skipped` 结果项
3. 非 TTY 冲突失败、零结果诊断、断链 warning 的输出格式由谁统一控制
4. Epic 4 的 reportResult 到底交付“基础可用版本”还是“接近最终体验版本”

## 最终判定

Epic 4 的 story 集合**具备较强的实施价值和较高的业务完整度**，已经把“能装、敢装、知道装了什么”这条主路径拆解得比较细。

但从 Story Preparation 质量标准看，它目前最需要收口的是以下三项：

- **错误语义统一**：安装失败是 fatal 还是 partial，必须只有一种主解释
- **状态判定统一**：manifest / conflict / result 的 hash 与状态映射必须只定义一次
- **输出边界统一**：Epic 4 先交付什么，Epic 5 再增强什么，不能前后重复覆盖

**建议：优先修订 Story 4.2、4.4、4.6a、4.6b，再将 Epic 4 正式移交开发。**

---

## 实际修正总结（2026-03-17）

基于上述审查结论，已在 commit `d4ca0b1` 中完成以下修正：

### Story 4.1: 文件操作工具与预检查

**已修正**：

1. Dev Notes 补充完整的权限判定矩阵（6 种目标状态 × 判定方式 × 结果），明确 preflight 只做权限和路径安全校验，不做冲突判定
2. 路径遍历的 `allowedRoot` 来源明确定义：全局安装 = `pathResolver.home()`，项目安装 = `process.cwd()`，与目标路径解析使用同一套来源

### Story 4.2: 复制模式安装执行

**已修正**：

1. AC #5 收窄为"copy 模式适用的资源类型（`files` 和 `directories`）"，明确 `flatten` 类型由 Story 4.3 实现
2. AC #6 统一为 fatal 错误语义：文件 I/O 操作失败抛出 `AiforgeError(severity: 'fatal')`，管道立即终止；hash 相同跳过是正常结果 `status: 'skipped'`，不是错误
3. Dev Notes 示例代码完全重写：移除 try-catch + break 的 partial 模式，改为 `determineStatus()` 判断 + fatal 抛出的 fail-fast 模式

### Story 4.3: 符号链接与 flatten 模式

**已修正**：

1. Task 2.4 明确 flatten 缺失 `mainFile` 时的完整行为：通过 `reporter.warn()` 记录警告，生成 `status: 'skipped'` 结果项，不写入 manifest — 消除结果语义的歧义

### Story 4.4: manifest 状态管理与冲突检测

**已修正**：

1. `checkConflict()` 签名统一为 4 参数：`(targetPath, sourceHash, manifest, manifestDegraded)` — 消除 Task 与 Dev Notes 的签名不一致
2. `ConflictType` 从 4 种扩展为 6 种：`'none'` | `'aiforge-current'` | `'aiforge-outdated'` | `'user-modified'` | `'user-file'` | `'unknown-origin'` — 新增 `'user-modified'`（用户修改了 aiforge 安装的文件）和 `'unknown-origin'`（manifest 降级时系统无法判断来源）
3. AC #3 重写为完整的冲突判定矩阵，明确三方 hash 比较逻辑（源hash、目标hash、manifest hash）
4. AC #4 将"未知来源"与"用户手写"分离：manifest 降级时返回 `'unknown-origin'`，manifest 正常时返回 `'user-file'`
5. manifest 保存职责明确为 pipeline 层：Task 3 改为"提供 manifest 服务供 pipeline 层调用"，导出 `buildManifestEntries()` 和 `mergeManifest()` 服务函数，持久化由 Story 4.6a 的 pipeline 层负责
6. Dev Notes 的 `loadManifest()` 降级说明补充 `manifestDegraded` 标志，`checkConflict()` 示例代码完全重写

### Story 4.5: 冲突处理与安全保护

**已修正**：

1. `checkConflict()` 调用签名与 Story 4.4 对齐，补充 `manifestDegraded` 参数
2. 冲突处理逻辑扩展为覆盖新增的冲突类型：`user-file`、`unknown-origin`、`user-modified` 三种类型统一归入"需要用户决策"分支

### Story 4.6a: 管道完整编排与错误流控制

**已修正**：

1. AC #3 从"partial 错误收集继续执行"改写为"Install 完成后由 pipeline 层调用 `saveManifest()` 持久化，然后调用 `reporter.reportResult()` 输出结果"
2. Task 2 移除 partial 错误概念：明确"Install 阶段不存在 partial 错误概念"，文件 I/O 错误统一为 fatal（fail-fast），hash 相同跳过和冲突跳过是正常结果
3. Task 3 明确 manifest 保存是 pipeline 收尾职责（不在 Install 阶段内部），只保存 `status: 'new'` 和 `status: 'updated'` 的文件记录
4. Dev Notes 新增"错误语义统一决策"章节，明确 `InstallResult[]` 只有 `'new'`、`'updated'`、`'skipped'` 三种状态，没有 `'failed'`

### Story 4.6b: 安装结果汇总与输出流分工

**已修正**：

1. Task 1 标题改为"最小可用版本"，TtyReporter 收窄为"按工具分组逐行输出 + 统计行（基础格式，树形美化留给 Epic 5 Story 5.2）"
2. Task 2 标题改为"基础版本"，移除 `ICON_FAILED`（因 InstallResult 不再有 failed 状态），移除 failed 项额外显示错误信息的任务
3. "本 Story 不做的事"补充明确的边界说明
4. 新增与 Epic 5 的边界声明："本 Story 交付最小可用的 `reportResult()` 实现，Epic 5 在此基础上增强为树形美化、彩色高亮、TTY 自适应等完整输出体验"

### 修正覆盖评估

| 审查问题 | 修正状态 |
|---------|---------|
| Epic 4 对"安装失败"的语义没有统一 | ✅ 已修正（统一为 fatal fail-fast，移除 partial 概念） |
| Story 4.4/4.5 冲突检测接口未收口 | ✅ 已修正（统一 4 参数签名 + 6 种冲突类型） |
| Story 4.3/4.5 使用未定义的 Reporter 提示能力 | ✅ 已修正（Story 1.3 新增 `warn()` 方法） |
| Story 4.6a 与 4.4 manifest 保存责任重复 | ✅ 已修正（统一为 pipeline 收尾职责） |
| Story 4.6b 与 Epic 5 输出 Story 重叠 | ✅ 已修正（收窄为最小可用版本，明确边界） |
| preflight 权限判定矩阵 | ✅ 已修正（补充完整矩阵） |
| flatten 缺失 mainFile 的结果语义 | ✅ 已修正（`warn()` + `skipped` + 不写 manifest） |