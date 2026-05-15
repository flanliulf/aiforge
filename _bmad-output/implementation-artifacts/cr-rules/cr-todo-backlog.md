# CR TODO Backlog — 跨 Story 延迟事项追踪

> 本文档由 `bmad-enhance-05-cr-todo-tracker` 技能维护。
> 记录 Code Review 中发现的非阻塞改进项，跨 Story 追踪直到解决。

## 统计摘要

| 状态 | 数量 |
|------|------|
| 🔴 open | 32 |
| 🟡 in-progress | 0 |
| ✅ resolved | 12 |

---

## Open Items

<!-- 按优先级排序：P1 > P2 > P3 -->

### TODO-017: `--list` 顶层 symlink 可导向仓库外目录（纵深防御）

- **来源**: 6-1 CR round 2 (2026-04-16)
- **优先级**: P1
- **类别**: tech-debt
- **描述**: `src/stages/list-contents.ts:78` 的 `readdir(targetDir, { withFileTypes: true })` 会默认跟随 symlink。若仓库中存在 `skills -> /outside/dir` 的顶层 symlink，`readdir` 将枚举仓库外目录内容，泄漏外部目录名列表。Round 1 修复的字符串级校验（`LIST_INVALID_INPUT`）仅拦截输入参数中的路径分隔符和点号前缀，不覆盖文件系统层面的 symlink 跟随行为。威胁模型极窄：需恶意仓库放置 symlink + 用户主动 clone + 仅泄漏目录名（用户本身已有完整文件系统访问权）。修复需独立设计决策：拒绝所有 symlink（简单但可能破坏合法用例）vs 仅拒绝越界 symlink（`realpath` 后检查仍在 `repoDir` 下，更精确但增加复杂度）。
- **涉及文件**: `src/stages/list-contents.ts`
- **建议时机**: 安全加固 Story 中系统性处理，需先做 symlink 策略设计决策
- **状态**: open
- **解决记录**:

### TODO-018: `--list` Commander 解析链路无端到端测试覆盖

- **来源**: 6-1 CR round 1 (2026-04-16)
- **优先级**: P2
- **类别**: test-gap
- **描述**: `src/index.ts:45` 新增了 `.option('--list <dir>', ...)`，但 `tests/cli-args.test.ts:23-35` 的本地 Commander program 定义仅覆盖到 `--clone-dir <path>`，未同步添加 `--list <dir>` 选项和对应测试场景。`tests/pipeline.test.ts:435-471` 使用手工构造的 `ParsedArgs`，不覆盖 Commander → `mapOptsToArgs()` 的真实解析链路。若后续选项名、取值名或映射逻辑发生漂移，当前测试集不会报警，CLI 入口存在回归盲区。修复方案：在 `tests/cli-args.test.ts` 的本地 Commander program 中增加 `.option('--list <dir>', ...)`，并添加 `--list skills` 和 `repo-url + --list skills` 两个测试场景。
- **涉及文件**: `tests/cli-args.test.ts`, `src/index.ts`
- **建议时机**: 下次触及 `tests/cli-args.test.ts` 时
- **状态**: open
- **解决记录**:

### TODO-007: `allowedRoot` 内部 broken symlink 被保守拒绝

- **来源**: Story 4-2 CR round 2 (2026-03-26)
- **优先级**: P2
- **类别**: tech-debt
- **描述**: `validateDestPathSecurity()` (fs-utils.ts) 对 broken symlink 采用"一律拒绝"的保守策略——即使 symlink 的目标路径完全在 `allowedRoot` 内部（只是目标文件尚未创建），也会被误判为 `PATH_TRAVERSAL`。当前设计基于安全优先原则：broken symlink 目标不存在意味着后续可能被外部操作创建为指向不安全位置的文件。错误信息已提示"删除该 symlink 后重试"，有清晰的 recovery 路径。场景罕见且不影响正常安装流程。如后续有真实用户反馈，可在安全增强 Story 中细化对 broken symlink 的边界校验后选择性放行。
- **涉及文件**: `src/services/fs-utils.ts`
- **建议时机**: 安全策略专项优化时
- **状态**: open
- **解决记录**:

### TODO-008: fail-fast 后无法返回已完成操作清单

- **来源**: Story 4-2 CR round 3 (2026-03-27)
- **优先级**: P2
- **类别**: tech-debt
- **描述**: `executeInstall()` 将结果累积在本地变量 `resultItems` 中，异常抛出时该变量不会返回给调用方。`AiforgeError` 也不包含 `completedItems` 等附加 payload 字段。AC #6 要求"返回已完成的操作清单（FR-031）"，但当前 throw 模式下无法通过函数返回值传递 partial results。这是跨模块架构变更（影响 `core/errors.ts`、`stages/execute-install.ts`、`pipeline.ts`、`core/reporter.ts`），Story 4-6a（管道编排与错误流控制）Task 2.3 明确排除了该需求，定性为"fail-fast 模式，hash 相同跳过是正常结果"。待后续专项优化 Story 中评估是否需要改变错误语义以支持 partial results 传递。
- **涉及文件**: `src/stages/execute-install.ts`, `src/core/errors.ts`, `src/pipeline.ts`
- **建议时机**: 错误流专项优化 Story（原 Story 4-6a 已决策采用 fail-fast 模式，不实现 partial results）
- **状态**: open
- **解决记录**:

### TODO-011: 补充入口层 stderr TTY 绑定的真实自动化回归守护

- **来源**: Story 5-1 CR round 2 evaluation (2026-03-31)；Story 5-7 CR evaluation round 1 (2026-04-03)
- **优先级**: P2
- **类别**: test-gap
- **描述**: `src/index.ts:80` 将 `isTty` 绑定到 `process.stderr.isTTY === true`（正确）。此问题经历两轮 Story 均未彻底关闭，根本原因是 `src/index.ts` 为 ESM 顶层脚本，无法通过普通 import + spy 真正 mock `process.stderr.isTTY` 后驱动入口层代码路径。**Story 5-7 的工程折衷**：在 `tests/core/reporter.test.ts` 新增 `describe('入口层 TTY 判定契约守护 CR TODO-011')` 共 3 个测试，但这 3 个测试全部直接传入硬编码 `isTty: true/false`，完全绕过 `process.stderr.isTTY` 的读取——若将 `index.ts:80` 改回 `process.stdout.isTTY === true`，这 3 个测试仍全绿，回归守护目标**仍未达成**。**真正能关闭此 TODO 的方案**：将 `isTty` 推导逻辑从 `index.ts` action 回调中提取为独立窄辅助函数（如 `buildReporterOptions(stderr: NodeJS.WriteStream): { isTty: boolean }`），再对该辅助函数做单元测试，通过传入 mock 的 `{ isTTY: true }` / `{ isTTY: false }` 对象来真正覆盖推导链路，使入口层 wiring 变更可被自动化检出。
- **涉及文件**: `src/index.ts`, `tests/core/reporter.test.ts`
- **建议时机**: 下次触及 `src/index.ts` 时，采用辅助函数提取方案（将 `isTty: process.stderr.isTTY === true` 推导逻辑提取为可测函数）彻底关闭此项
- **前置条件**: 需要先重构——将 `isTty` 推导逻辑从 `index.ts` action 回调提取为独立函数，然后才能编写有效的单元测试
- **状态**: open
- **解决记录**:

### TODO-019: 不可命中的 filter 语法（空 glob、多斜杠）未被前置拒绝

- **来源**: 6-2 CR round 1 (2026-04-17)
- **优先级**: P2
- **类别**: tech-debt
- **描述**: `src/stages/filter-utils.ts:27-35` 的 `parseFilterPattern()` 接受 `skills/`（空 glob，生成正则 `^$` 只能匹配空字符串）和 `skills/git/extra`（多斜杠，glob 含 `/` 但 basename 永远不含 `/`）等明显无效输入。这些 pattern 不可能命中任何候选但不会被立即拒绝，而是延后进入零匹配/交互分支，增加用户排查成本。最终仍会被零匹配流程捕获（非 TTY 抛错，TTY 进入交互），不存在数据丢失或安全风险。修复方案：在参数解析阶段校验 filter grammar，只接受 `<glob>` 或 `<topDir>/<glob>` 且 glob 非空、无额外斜杠的形式，并为非法 filter 输入补充单元测试。
- **涉及文件**: `src/stages/filter-utils.ts`
- **建议时机**: 下次触及 `filter-utils.ts` 时，或 filter 功能增强 Story 中
- **状态**: open
- **解决记录**:

### TODO-021: Directories copy 模式静默覆盖同名用户文件，绕过冲突决策链路

- **来源**: 6-3 CR round 1 (2026-04-20)
- **优先级**: P2
- **类别**: tech-debt
- **描述**: `executeInstallForRule()` 的 Directories copy 分支通过 `walkDirFiles()` 展开目录后，对每个文件直接执行 `copyFileSync(srcFilePath, destFilePath)`，不经过 `shouldInstallFile()` 冲突检测。若目标目录中已存在同名用户文件，将被静默覆盖而无任何提示或差异比对，绕过了 Files 安装类型中已实现的冲突决策链路（overwrite/skip/diff 策略）。触发条件：Directories 类型规则的源目录内含同名文件，且目标目录已有用户修改过的同名文件。当前无用户报告，但随着 Directories 类型规则增多风险升高。修复方向：在 Directories copy 分支复用或适配 `shouldInstallFile()` 逻辑，或设计独立的目录级冲突处理策略。
- **涉及文件**: `src/stages/execute-install.ts`
- **建议时机**: 后续统一规划 Directories 冲突处理策略的 Story 中
- **状态**: open
- **解决记录**:

### TODO-022: 无条件读取 config，使 global 安装和 `--no-universal` 也被无关配置错误阻断

- **来源**: 6-3 CR round 1 (2026-04-20)
- **优先级**: P2
- **类别**: tech-debt
- **描述**: `pipeline.ts` 的 `executePipeline()` 在入口处无条件调用 `loadConfig()` 解析工作区配置文件；若配置文件格式错误或包含无效字段，即使当前执行的是 `--global` 安装或 `--no-universal` 等完全不依赖配置的场景，也会直接抛出异常终止整个流程。`loadConfig()` 当前设计为找不到文件时返回空对象（不报错），但**找到文件后解析失败则抛出错误**。修复方向：将 `loadConfig()` 调用延迟到实际需要配置的分支中（如 workspace 安装 + 需要读取排除规则时），或对解析错误降级为警告而非致命异常。
- **涉及文件**: `src/pipeline.ts`, `src/services/config.ts`
- **建议时机**: 后续优化 pipeline 条件加载策略时
- **状态**: open
- **解决记录**:

### TODO-023: Directories copy 的 `walkDirFiles` 静默丢失空目录和符号链接条目

- **来源**: 6-3 CR round 2 (2026-04-20)
- **优先级**: P2
- **类别**: tech-debt
- **描述**: `executeInstallForRule()` 的 Directories copy 分支使用 `walkDirFiles()` 递归枚举源目录内容，该函数仅 yield 常规文件（`entry.isFile()`），静默跳过空目录和符号链接条目。若规则包源目录中包含空子目录（作为占位结构）或符号链接文件，安装后目标目录将缺少这些条目，可能导致工具运行时找不到预期的目录结构或链接目标。当前规则包生态中尚无实际依赖空目录或 symlink 的场景，风险较低。修复方向：（1）空目录：在 walkDirFiles 或调用侧补充 `mkdirSync` 保证目录结构完整性；（2）符号链接：需先明确 symlink 策略决策（复制目标 vs 重建链接 vs 忽略），再统一实现。
- **涉及文件**: `src/stages/execute-install.ts`
- **建议时机**: 后续 symlink 策略设计决策时或空目录处理优化 Story 中
- **状态**: open
- **解决记录**:

### TODO-020: 零匹配恢复候选对 dot-prefixed 条目过滤与主匹配不一致

- **来源**: 6-2 CR round 2 (2026-04-17)
- **优先级**: P3
- **类别**: tech-debt
- **描述**: `src/stages/match-rules.ts` 的零匹配恢复路径候选收集逻辑对 `entry.name.startsWith('.')` 直接跳过，而主匹配路径 `scanSourceFiles()` 在 Files/Directories/Flatten 分支下仅排除 `DEFAULT_EXCLUDES`（含 `.gitkeep`、`.DS_Store` 等 6 项），不额外排除所有 `.` 开头条目。导致恢复路径候选空间比主匹配空间更窄。触发条件极端：需同时满足 dot-prefixed 可安装项 + 零匹配 + 该项恰好是用户想要的候选，实际风险极低。修复方向：将候选枚举的过滤条件收敛到与 `scanSourceFiles()` 一致，或统一决策对 dot items 的处理策略后两处同步调整。
- **涉及文件**: `src/stages/match-rules.ts`
- **建议时机**: 后续统一 dot-item 处理策略时一并修复
- **状态**: open
- **解决记录**:

### TODO-019: copilot:project mcp-tools 同源双规则 totalFiles 计数与 manifest 去重

- **来源**: 7-1 CR round 1 ID #3 (2026-05-11)
- **优先级**: P2
- **类别**: design-debt
- **描述**: `src/data/install-rules.ts:74,76` 中 copilot:project 同时存在 `mcp-tools → .github/` 与 `mcp-tools → .vscode/` 两条规则，同一源文件被安装两次（双倍 totalFiles 计数、可能出现 manifest 重复条目）。属于显式设计决策（承接 v1.x vscode MCP 路径语义），但引发的计数与 manifest 行为需补文档和测试说明。建议：(1) install-rules-matrix.md 显式说明双写语义；(2) 单元测试断言 totalFiles 计数预期行为；(3) 长期评估 plan 层 (sourceDir, sourceFile) 跨规则去重或显式 multi-target 标注。
- **涉及文件**: `src/data/install-rules.ts`, `docs/install-rules-matrix.md`
- **建议时机**: Story 7-10 E2E 收尾时统一处理
- **状态**: open
- **解决记录**:

### TODO-020: cursor:global agents/skills 共用 ~/.cursor/rules/ basename 冲突静默覆盖

- **来源**: 7-1 CR round 1 ID #4 (2026-05-11)
- **优先级**: P2
- **类别**: design-debt
- **描述**: `src/data/install-rules.ts` cursor:global 的 `agents(Files)` 与 `skills(Flatten)` 均写入 `~/.cursor/rules/`，若源仓库存在 `agents/foo.md` 与 `skills/foo/index.md`（Flatten 产物 `foo.md`），basename 一致时后写者静默覆盖先写者。`--force` 模式或 aiforge-current/outdated 状态下缓解失效。cursor:project 同样存在此模式（既有，非本次引入）。建议在 plan 阶段对 (targetPath basename) 跨规则去重检测，命中时 reporter.warn；或采用 sub-folder 隔离。
- **涉及文件**: `src/data/install-rules.ts`, `src/stages/match-rules.ts`（或 plan 层）
- **建议时机**: Story 7-3/7-9 或专项 backlog 治理
- **状态**: open
- **解决记录**:

### TODO-021: Story 7-10 补齐 copilot:project:mcp-tools → .vscode/ E2E 测试

- **来源**: 7-1 CR round 1 ID #8 (2026-05-11)
- **优先级**: P2
- **类别**: test-gap
- **描述**: `tests/integration/pipeline.test.ts` 原 `vscode:global mcp-tools` E2E 已在 v2.0 移除，对应的 `copilot:project:mcp-tools → .vscode/` 新 E2E 尚未补齐。Story 7-1 单元测试已覆盖规则存在性，但端到端集成验证后置到 Story 7-10。
- **涉及文件**: `tests/integration/pipeline.test.ts`
- **建议时机**: Story 7-10（Epic 7 收尾）必须交付
- **状态**: open
- **解决记录**:

### TODO-022: vscodeMergedNote 文案保护范围歧义与排版风格不一致

- **来源**: 7-1 CR round 1 ID #11 (2026-05-11)
- **优先级**: P3
- **类别**: ux
- **描述**: `src/core/messages.ts` vscodeMergedNote (zh-CN: ~530, en: ~810) 使用 ①②③ 圆圈数字，与同文件其他列表（1./2.）风格不一致。"现有 ~/.vscode/ 文件不会被覆盖或删除"未区分 home 级与项目级 .vscode/，存在歧义。
- **涉及文件**: `src/core/messages.ts`
- **建议时机**: 文案专项优化时
- **状态**: open
- **解决记录**:

### TODO-023: --tools vscode 手动模式未输出 vscodeMergedNote 迁移提示

- **来源**: 7-1 CR round 1 ID #12 (2026-05-11)
- **优先级**: P3
- **类别**: ux
- **描述**: `src/stages/detect-tools.ts` 手动 `--tools` 校验分支命中 `vscode` 时直接 throw UNKNOWN_TOOL，未先输出 vscodeMergedNote 提示。AC #3 字面未限定"自动检测 vs 手动模式"，技术上应同样覆盖手动模式。修复：手动分支命中 vscode 时先 `reporter.warn(msg('detectTools.vscodeMergedNote'))` 再 throw。
- **涉及文件**: `src/stages/detect-tools.ts`
- **建议时机**: 下次触及 detect-tools.ts 手动模式分支时
- **状态**: open
- **解决记录**:

### TODO-024: detectLegacyVscodeOnly 非目录辨别（~/.vscode 为普通文件时误判）

- **来源**: 7-1 CR round 1 ID #13（非目录辨别部分）(2026-05-11)
- **优先级**: P3
- **类别**: edge-case
- **描述**: `src/stages/detect-tools.ts` 的 `detectLegacyVscodeOnly` 使用 `pathExists`（access），若 `~/.vscode` 为普通文件（非目录）时仍返回 true，可能误判为 vscode-only 场景。修复：改用 `stat() + isDirectory()` 替代 `pathExists`。（注：异常透传部分为预期架构行为，不修复）
- **涉及文件**: `src/stages/detect-tools.ts`
- **建议时机**: 下次触及 detectLegacyVscodeOnly 时
- **状态**: open
- **解决记录**:

### TODO-025: detect-tools 测试硬编码绝对路径 '/home/user/.vscode'

- **来源**: 7-1 CR round 1 ID #14 (2026-05-11)
- **优先级**: P3
- **类别**: test-quality
- **描述**: `tests/stages/detect-tools.test.ts:414, 446` 字面比对 `/home/user/.vscode`，跨平台风险存在（mock home 依赖 `/home/user` 硬编码）。建议改用 `path.join(pathResolver.home(), '.vscode')` 动态拼接；断言改为检查语义关键词组合（如 VS Code / v2.0 / Copilot）。
- **涉及文件**: `tests/stages/detect-tools.test.ts`
- **建议时机**: 下次重构 detect-tools 测试时
- **状态**: open
- **解决记录**:

### TODO-026: dry-run 测试 filter 缺 rule 维度过滤

- **来源**: 7-1 CR round 1 ID #18 (2026-05-11)
- **优先级**: P3
- **类别**: test-quality
- **描述**: `tests/integration/dry-run.test.ts:613-616` 仅按 `targetPath.includes('.cursor')` 字符串过滤计划目标，缺乏 rule 维度验证。建议改为 `i.rule?.tool === 'cursor' && i.rule?.scope === 'global'` 精确匹配。
- **涉及文件**: `tests/integration/dry-run.test.ts`
- **建议时机**: 下次触及 dry-run 测试时
- **状态**: open
- **解决记录**:

### TODO-027: migration-v2.md 缺少 v1.x vscode 规则数量说明表头

- **来源**: 7-1 CR round 1 ID #19 (2026-05-11)
- **优先级**: P3
- **类别**: docs
- **描述**: `docs/migration-v2.md` 和 `docs/migration-v2.zh.md` 中旧规则映射表直接列出单条规则但缺少表头说明（"v1.x 中 vscode 共有 1 条规则，迁移映射如下："）。中英双语需同步补充。
- **涉及文件**: `docs/migration-v2.md`, `docs/migration-v2.zh.md`
- **建议时机**: 文档优化时
- **状态**: open
- **解决记录**:

### TODO-028: detectLegacyVscodeOnly 外层守卫与函数内 copilotExists 不等价（单一职责）

- **来源**: 7-1 CR round 2 ID #2 (2026-05-11)
- **优先级**: P3
- **类别**: tech-debt
- **描述**: `src/stages/detect-tools.ts:198` 外层守卫 `!detectedTools.includes('copilot')` 与函数内 `!copilotExists`（`~/.copilot/` 检测）存在不等价：copilot 可通过项目级 `.github/` 检测到，此时 detectedTools 含 'copilot' 但 `~/.copilot/` 可能不存在。两者逻辑不完全对应。建议单一职责改进：函数仅返回「vscode 路径是否存在」，copilot 检测完全由外层 `!detectedTools.includes('copilot')` 负责；移除函数内 copilotExists 冗余判断。
- **涉及文件**: `src/stages/detect-tools.ts`
- **建议时机**: 下次重构 detect-tools 检测逻辑时
- **状态**: open
- **解决记录**:

### TODO-029: detectLegacyVscodeOnly 直接调用 process.cwd()，需专项治理

- **来源**: 7-1 CR round 2 ID #3 (2026-05-11)
- **优先级**: P3
- **类别**: tech-debt
- **描述**: `src/stages/detect-tools.ts:98` 直接调用 `process.cwd()` 获取项目根，与 `detectSingleTool`/`emitDiagnostics` 中的既有模式一致。但这使测试需 patch `process.cwd` 而非通过 pathResolver 注入。建议在 PathResolver 接口添加 `projectRoot()` 方法，批量替换 detect-tools.ts 内所有直接 process.cwd() 调用。
- **涉及文件**: `src/stages/detect-tools.ts`, `src/core/types.ts`（PathResolver 接口）
- **建议时机**: PathResolver 专项扩展 Story 中批量处理
- **状态**: open
- **解决记录**:

### TODO-030: detectLegacyVscodeOnly Promise.all 单点失败阻塞整体检测

- **来源**: 7-1 CR round 2 ID #4 (2026-05-11)
- **优先级**: P3
- **类别**: tech-debt
- **描述**: `src/stages/detect-tools.ts:96-100` 的 `Promise.all([pathExists(~/.vscode), pathExists(.vscode), pathExists(~/.copilot)])` 在任一 pathExists 抛出非 ENOENT/ENOTDIR 错误（如 EACCES、ELOOP）时整体 reject，阻塞 detect 流程。与 detectSingleTool 同病相怜。建议改为 `Promise.allSettled` + rejected 视为 false；或整体 try/catch 降级。需与 detectSingleTool 一同治理保持一致。
- **涉及文件**: `src/stages/detect-tools.ts`
- **建议时机**: detect-tools 专项加固时
- **状态**: open
- **解决记录**:

### TODO-031: reserved-name skip 分支不清理旧 manifest stale 条目

- **来源**: 7-1 CR round 2 ID #5 (2026-05-11)
- **优先级**: P3
- **类别**: tech-debt
- **描述**: `src/stages/execute-install.ts` reserved-name 命中时写 `status:'skipped'` + continue，但不调用 manifest API。若 v1.x 已写入该 reserved-name 到 manifest（升级前旧版本），升级到 v2.0 后保护跳过，旧 manifest 条目残留为 stale。触发链路：v1.x install → v2.0 upgrade + reserved 保护 → manifest 残留。建议 skip 分支前查询 manifest，若有同 target 条目则 `manifest.remove`；或标记 `status:'reserved-skipped'`。
- **涉及文件**: `src/stages/execute-install.ts`
- **建议时机**: manifest 生命周期治理专项时
- **状态**: open
- **解决记录**:

### TODO-032: migration-v2.md FAQ 未说明 vscodeMergedNote 在 claude/cursor 已检测时仍触发

- **来源**: 7-1 CR round 2 ID #6 (2026-05-11)
- **优先级**: P3
- **类别**: docs
- **描述**: `docs/migration-v2.md:77` / `docs/migration-v2.zh.md:76` FAQ 仅说明「NO_TOOLS 是否触发」，未明确 vscodeMergedNote 触发条件：即便 claude/cursor 已被检测到，只要 copilot 未检测且存在 `~/.vscode/` 或项目 `.vscode/`，migration note 仍会输出。建议在 FAQ 增加说明：「migration note 在 detect 阶段当 copilot 未被识别且检测到 `.vscode/` 时输出（与是否同时检测到 claude/cursor 无关）；不阻塞安装；但若同时未检测到任何受支持工具，仍因 NO_TOOLS 退出」。中英双语同步。
- **涉及文件**: `docs/migration-v2.md`, `docs/migration-v2.zh.md`
- **建议时机**: 文档完善时
- **状态**: open
- **解决记录**:

### TODO-033: mcp-tools 双写文档说明缺失（合并 R1-TODO-019）

- **来源**: 7-1 CR round 2 ID #7 / round 1 ID #3 (2026-05-11)
- **优先级**: P3
- **类别**: docs
- **描述**: `docs/install-rules-matrix.md:24-25` 列出 `mcp-tools → .github/` 与 `mcp-tools → .vscode/` 两行，但无双写语义注释；`docs/migration-v2.md` 未明示双写行为。建议在 migration-v2.md 增加 FAQ「为什么 mcp-tools 文件同时出现在 .github/ 和 .vscode/？」；install-rules-matrix.md 表格上方加注「※ mcp-tools 为双写规则，文件同时安装到 .github/ 和 .vscode/ 两处」。与 TODO-019 合并跟踪。
- **涉及文件**: `docs/install-rules-matrix.md`, `docs/migration-v2.md`, `docs/install-rules-matrix.zh.md`, `docs/migration-v2.zh.md`
- **建议时机**: 文档完善时
- **状态**: open
- **解决记录**:

### TODO-034: AC #5 package.json version 字段无测试断言

- **来源**: 7-1 CR round 2 ID #8 (2026-05-11)
- **优先级**: P3
- **类别**: test-quality
- **描述**: AC #5 要求 package.json version = '2.0.0'，但无测试覆盖此断言，未来误改 version 不会被测试捕获。建议新增 `tests/version.test.ts` 或在 `tests/data/install-rules.test.ts` 末尾加 `expect(pkg.version).toBe('2.0.0')`（通过 ESM JSON import）。
- **涉及文件**: `tests/`（新增）
- **建议时机**: 下次补充 release 回归测试时
- **状态**: open
- **解决记录**:

### TODO-035: install-rules.test.ts it title 与 AC #2 文本未同步

- **来源**: 7-1 CR round 2 ID #9 (2026-05-11)
- **优先级**: P3
- **类别**: test-quality
- **描述**: `tests/data/install-rules.test.ts:13` it title 为 `'+4 new rules -1 vscode = 16+3'`，Round 1 已将 AC #2 修订为「16 → 19（+4/-1）」但 it title 未同步。建议改为 `contains exactly 19 rules (v2.0: 16 - 1 + 4 = 19)` 与 AC 文本一致。
- **涉及文件**: `tests/data/install-rules.test.ts`
- **建议时机**: 下次触及 install-rules 测试时
- **状态**: open
- **解决记录**:

### TODO-036: CHANGELOG v2.0.0 Migration 行缺少步骤摘要

- **来源**: 7-1 CR round 2 ID #10 (2026-05-11)
- **优先级**: P3
- **类别**: docs
- **描述**: `CHANGELOG.md:10` Migration 行仅写链接索引，未提供步骤摘要。按 Keep a Changelog 最佳实践，建议在 Migration 行尾追加摘要：`(steps: 1. upgrade aiforge → 2. install Copilot extension → 3. re-run aiforge install)`。
- **涉及文件**: `CHANGELOG.md`
- **建议时机**: 文档完善时
- **状态**: open
- **解决记录**:

### TODO-037: Story 7-10 补全多工具矩阵端到端集成测试（AC #2 .vscode/ 延伸覆盖）

- **来源**: 7-1 CR round 5 ID #4 (2026-05-12)
- **优先级**: P2
- **类别**: test-gap
- **描述**: AC #2 要求 `copilot:project mcp-tools → .vscode/` 生效；本 Story 7-1 已在 `pipeline.test.ts:928` 的 `copilot:project` it block 中追加 `.vscode/server.json` 存在性断言（最小集成验证，AC #2 已基本闭合）。Story 7-10 计划补充更完整的多工具矩阵 E2E 测试，包括：多 mcp-tools 文件、全局+项目级组合、symlink 模式下的 `.vscode/` 写入验证。本条目确保该计划在 Story 7-10 中可追溯执行，不被遗忘。
- **涉及文件**: `tests/integration/pipeline.test.ts`
- **建议时机**: Story 7-10 执行时（计划内延伸覆盖）
- **状态**: open
- **解决记录**:

### TODO-038: 项目 `.github/` 命中时抑制 legacy VS Code 迁移提示（语义待明确）

- **来源**: 7-1 CR round 9 发现 #1 (2026-05-12)
- **优先级**: P3
- **类别**: tech-debt
- **描述**: `src/stages/detect-tools.ts:196-199` 的 vscodeMergedNote warning 触发条件为 `!detectedTools.includes('copilot') && detectLegacyVscodeOnly()`。当项目存在 `.github/` 时，copilot 通过项目级检测路径被识别（`detectedTools.includes('copilot') = true`），warning 被抑制——即使 `~/.copilot/` 不存在。此场景下不触发 warning 实际上更智能（Copilot 已通过 `.github/` 识别，无需再提示安装），但与 AC #3 字面表述（"无 `~/.copilot/` 则显示警告"）存在间隙。建议：路径 A（推荐）在后续 Story Dev Notes 或 AC 修订中明确"`.github/` 存在视为 Copilot context，因此不输出 legacy warning"；路径 B 补充测试覆盖 `~/.vscode/ + 无 ~/.copilot/ + 项目 .github/` 边界场景。
- **涉及文件**: `src/stages/detect-tools.ts`
- **建议时机**: 后续轻量化优化 Story 或 Story 7-2/7-10 中一并处理；如选路径 A 可在 Story 7-1 finalize 时顺手更新 AC 描述
- **状态**: open
- **解决记录**:

### TODO-039: `install-rules.ts` 注释残留 `.vscode/mcp.json` 历史示例（可能引发固定文件名误解）

- **来源**: 7-1 CR round 9 发现 #2 (2026-05-12)
- **优先级**: P3
- **类别**: tech-debt
- **描述**: `src/data/install-rules.ts:75` 注释 `// v2.0: 承接原 vscode 项目级 MCP 配置语义（.vscode/mcp.json）` 字面使用 `.vscode/mcp.json` 描述历史路径语义，与实际规则 `type: Files, targetDir: '.vscode/'`（文件名沿用 `mcp-tools/` 源目录）存在字面差异。该注释是开发者内部历史溯源说明，不影响运行时行为，但可能在后续维护中引发"目标固定为 mcp.json"的误解。建议改为：`// v2.0: 承接原 vscode 项目级 MCP 配置语义（目标目录 .vscode/，文件名沿用 mcp-tools/ 源目录）`。
- **涉及文件**: `src/data/install-rules.ts`
- **建议时机**: 下次触及 `install-rules.ts` 时或常规代码清理
- **状态**: open
- **解决记录**:

### TODO-009: `pipeline.ts` manifest mode 类型断言用函数封装替代

- **来源**: Story 4-6a CR round 3 evaluation (2026-03-30)
- **优先级**: P3
- **类别**: refactor
- **描述**: `pipeline.ts:330` 处通过 `as 'copy' | 'symlink' | 'flatten'` 类型断言确保 manifest mode 类型正确。虽然三元表达式逻辑保证了值域正确（Flatten 规则写 `'flatten'`，其余写 `planInfo.mode`），但 `as` 断言绕过了类型系统的静态验证。可考虑将该映射提取为一个辅助函数（如 `resolveManifestMode(ruleType, installMode): ManifestEntry['mode']`），明确输入输出类型，让 TypeScript 通过类型推断而非断言来保证正确性。CR 评估方明确标注为"代码风格偏好，不构成审查发现"，无功能风险。
- **涉及文件**: `src/pipeline.ts`
- **建议时机**: 下次触及 `pipeline.ts` saveManifest 逻辑时，或代码质量专项优化时
- **状态**: open
- **解决记录**:

---

## Resolved Items

<!-- 已解决事项归档于此，保留用于回顾 -->

### TODO-003: CLI 入口接线 `createProductionStages()` 工厂函数

- **来源**: Story 3-3 CR evaluation round 1-2 (2026-03-25)
- **优先级**: P2
- **类别**: tech-debt
- **描述**: `src/index.ts:49` 调用 `runPipeline(args, reporter)` 未传入第三参数 `stages`，因此使用 `DEFAULT_STAGES`（全占位）。`createProductionStages(pathResolver)` 工厂函数已就绪（`pipeline.ts:166-184`），但 resolve/auth/clone 阶段仍为占位，接线需等 Epic 2 实现前序阶段后一并完成。届时改为 `runPipeline(args, reporter, createProductionStages(new UnixPathResolver()))`。
- **涉及文件**: `src/index.ts`, `src/pipeline.ts`
- **建议时机**: Epic 2 中实现 resolve/auth/clone 真实阶段的 Story
- **状态**: resolved
- **解决记录**: Story 4-6a 中通过 `createProductionStages(pathResolver)` 工厂函数完整接线，所有 6 个占位阶段替换为真实 import。

### TODO-004: flatten 目标路径精度回补（dry-run 预览需体现重命名语义）

- **来源**: Story 3-3 CR evaluation round 2 (2026-03-25)
- **优先级**: P2
- **类别**: tech-debt
- **描述**: 当前 `reporter.ts` 的 `resolveFileTarget()` 对 flatten 类型使用 `join(targetPath, basename(srcFile))`，输出为 `~/.cursor/rules/code-review`（目录名），但 PRD 定义 flatten 应提取主文件并重命名为 `code-review.md`。精确输出需要 `InstallRule` 类型引入 `mainFile` 字段并实现主文件提取逻辑——这属于 Epic 4 Story 4.3 的核心能力。待 4.3 实现后，reporter 层需同步更新 flatten 的目标路径计算，并补充对应测试断言。
- **涉及文件**: `src/core/reporter.ts`, `src/core/types.ts`, `tests/stages/report.test.ts`
- **建议时机**: Epic 4 Story 4.3（符号链接与 flatten 模式）完成后
- **状态**: resolved
- **解决记录**: Story 4-3 中完整实现 flatten mainFile 提取和重命名逻辑。

### TODO-006: `targetPath` 为普通文件时 preflight 未提前拒绝

- **来源**: Story 4-2 CR round 1 (2026-03-26)
- **优先级**: P2
- **类别**: tech-debt
- **描述**: `checkTargetWritability()` (fs-utils.ts) 对 `targetPath` 是普通文件的情况只检查 `W_OK` 可写性，不会抛出"不是目录"的错误。随后 `executeInstall()` 调用 `ensureDir(item.targetPath)` 时才因 `ENOTDIR` 失败，被包装为 `ENSURE_DIR_FAILED`。虽然安装最终仍会失败（非安全问题），但错误时机延迟且报错信息不够精确。改进方案：在 `checkTargetWritability()` 中增加 `targetStat.isFile()` 分支，提前抛出更精确的 `PATH_NOT_DIRECTORY` 错误，提升 fail-fast 诊断体验。
- **涉及文件**: `src/services/fs-utils.ts`
- **建议时机**: 下次触及 `checkTargetWritability` 时
- **状态**: resolved
- **解决记录**: Story 5-7 Task 1 中解决。`checkTargetWritability()` 增加 `isFile()` 分支抛出 `PATH_NOT_DIRECTORY`，同步新增中英文 i18n 消息键，补 3 个测试（含负向和 i18n）。

### TODO-010: `createProductionStages().report` 闭包的 repo-relative 路径转换缺少直接集成测试覆盖

- **来源**: Story 4-6b CR round 3 evaluation (2026-03-31)
- **优先级**: P2
- **类别**: test-gap
- **描述**: `pipeline.ts:348-360` 中的 `sourcePath` repo-relative 转换逻辑（`report` 闭包内，将绝对 clone 路径裁剪为 repo-relative 路径后再传给 Reporter）没有直接命中它的自动化测试。现有测试覆盖的是 Reporter 组件层（输入已经是 relative path 时的格式化）和 saveManifest（不涉及 report 闭包）。如果该段逻辑被删除或改坏，现有测试仍有较大概率全绿。建议补一条针对 `createProductionStages().report` 的集成测试，断言传给 `reporter.reportResult()` 的 `items[].sourcePath` 已是 repo-relative 路径（不以 `repoDir` 开头）。代码本身仅 12 行、结构简单，当前风险可控。
- **涉及文件**: `src/pipeline.ts`, `tests/integration/pipeline-production-stages.test.ts`
- **建议时机**: Epic 5（输出体验优化）或下次触及 `pipeline.ts` report 闭包时
- **状态**: resolved
- **解决记录**: Story 5-7 Task 2 中解决。在 `pipeline-production-stages.test.ts` 新增独立 describe 块，通过真实 clone mock 断言 `sourcePath` 为 repo-relative 路径，补 2 个测试（主路径+边界值）。

### TODO-013: 补充 copilot / vscode / cursor:project 规则矩阵 E2E 覆盖

- **来源**: Story 5-5b CR round 1-2 (2026-04-02)
- **优先级**: P2
- **类别**: test-gap
- **描述**: `BUILTIN_RULES` 共 16 条规则，Story 5-5b AC #1 E2E 测试仅覆盖 claude:global、claude:project、cursor:global（约 31% 覆盖率）。copilot（8 条规则）、vscode（1 条规则）、cursor:project（2 条规则）完全未覆盖。CR R1/R2 均评估为 P2 非阻塞 CR TODO（理由：copilot/vscode 与 claude/cursor 共享相同安装代码路径，三种 InstallType 代表性路径已覆盖）。建议后续补齐三类工具的 match + install 全链路断言，使 AC #1"按 BUILTIN_RULES 真实规则矩阵验证"真正落地。
- **涉及文件**: `tests/integration/pipeline.test.ts`, `tests/fixtures/sample-repo/`
- **建议时机**: Epic 5 收尾或 Story 5-5c（Go/No-Go 门禁）开发前，亦可在专项测试完整性 Story 中处理
- **状态**: resolved
- **解决记录**: Story 5-7 Task 4 中解决。在 `pipeline.test.ts` 新增 10 个 E2E 测试覆盖 copilot:global（4）、copilot:project（2）、vscode:global（1）、cursor:project（2），E2E 覆盖率从 ~31% 提升到 87.5%（14/16 规则）。

- **来源**: Story 2-5 CR round 1-4 (2026-03-24)
- **优先级**: P2
- **类别**: duplication
- **描述**: `src/commands/init.ts` 中的 `sanitizeTokenDisplay()` 与 `src/core/sanitize.ts` 中的 `sanitizeToken()` 逻辑完全一致（前 8 + \*\*\*\* + 后 4 / 短 token 前 4 + \*\*\*\*），仅判断条件写法不同。应删除 `sanitizeTokenDisplay()` 并改为 `import { sanitizeToken } from '../core/sanitize.js'`，避免后续安全脱敏规则调整时出现实现漂移。
- **涉及文件**: `src/commands/init.ts`, `src/core/sanitize.ts`
- **建议时机**: 下次触及 `src/commands/init.ts` 时
- **状态**: resolved
- **解决记录**: Story 5-6 Task 1 中解决。删除 `sanitizeTokenDisplay()` 函数定义，添加 `import { sanitizeToken } from '../core/sanitize.js'`，调用处从 `sanitizeTokenDisplay(token)` 改为 `sanitizeToken(token)`。692 条测试零回归。

### TODO-012: `.agent` / `.agents` / `.gemini` 外部目录污染全仓 lint

- **来源**: 5-5a CR round 2-6 (2026-04-01)
- **优先级**: P3
- **类别**: tech-debt
- **描述**: `.agent`/`.agents`/`.gemini` 目录中的外部 agent/gemini 配置文件被 `prettier --check .` 扫描，导致 `npm run lint` 返回非零。R2 修复时已将 `_analysis_output/` 加入 `.prettierignore`，但上述三个目录未一并处理，问题持续存在至 R6 审查结论。
- **涉及文件**: `.prettierignore`
- **建议时机**: 下次触及 `.prettierignore` 或全仓 lint 清理专项时
- **状态**: resolved
- **解决记录**: Story 5-6 Task 2 中解决。`.prettierignore` 末尾追加 `.agent`、`.agents`、`.gemini` 三行，`npm run lint`（含 `prettier --check .`）退出码已恢复为 0。

### TODO-014: 清理 Story 5-5b Dev Agent Record 中的过时"规避策略"描述

- **来源**: Story 5-5b CR round 2 (2026-04-02)
- **优先级**: P3
- **类别**: other
- **描述**: `_bmad-output/implementation-artifacts/5-5b-e2e-integration-tests.md` 的 Debug Log References 中记录了"使用 cursor 工具规避 Directories bug / 无需修改生产代码"的历史描述，但该 bug 已在 CR R1 修复阶段修复（`src/pipeline.ts` 已区分 Directories 类型跳过 fileHash）。当前描述与实际修复状态不一致，可能误导后续阅读者。建议将该描述更新为"已修复"，或移除规避说明并指向修复记录。
- **涉及文件**: `_bmad-output/implementation-artifacts/5-5b-e2e-integration-tests.md`
- **建议时机**: Story 5-5b 关闭流程中（bmenhance-06-cr-done 执行时）或下次触及该 Story 文档时
- **状态**: resolved
- **解决记录**: Story 5-5b cr-done 收尾时处理。Debug Log References 已更新：将"规避策略"描述替换为"已修复（CR R1）"说明，并指向修复记录。

### TODO-005: 质量门禁验证的完整执行流程规则增强

- **来源**: Story 4-1 CR round 1-5 (2026-03-25 ~ 2026-03-26)
- **优先级**: P2
- **类别**: other
- **描述**: 现有 "CR 修复后必须同步更新 Story Dev Agent Record" 规则已覆盖意图，但执行不到位，需增强为具体操作流程。CR 修复完成后，必须按以下顺序执行完整验证并将每项结果逐行更新到 Story Dev Agent Record：(1) `npm test` — 记录通过数（含新增测试的增量说明）；(2) `npm run lint` — 记录 error/warning 数（含 Prettier 格式检查）；(3) `npm run build` — 记录构建状态。禁止：只执行部分验证（如只跑 test 不跑 lint）；复用上轮的验证结果（每次修复后必须重新执行）；在验证未全部通过时更新 Story 记录为"通过"。Story 4-1 CR 中该问题出现 3 次：Round 1 lint error 漏报、Round 2 Prettier 问题漏报、Round 3 测试计数过期。
- **涉及文件**: `_bmad-output/project-context.md`, `_bmad-output/planning-artifacts/architecture/04-implementation-patterns.md`
- **建议时机**: 下一次 Sprint 规划或规则文档专项维护时
- **状态**: resolved
- **解决记录**: Story 4-2 CR 规则提炼中正式化为全局规则"CR 修复后必须执行完整质量门禁三件套"，已同步写入 `project-context.md` (CR Workflow Rules) 和 `04-implementation-patterns.md` (CR Workflow Patterns)。

### TODO-002: `detectTools` 函数签名与 `DetectFn` 类型不匹配，pipeline 集成需适配

- **来源**: Story 3-1 CR round 1-2 (2026-03-25)
- **优先级**: P2
- **类别**: tech-debt
- **描述**: `detectTools(repo, args, reporter, pathResolver)` 有 4 个参数，而 `pipeline.ts` 中 `DetectFn = (repo, args, reporter) => Promise<DetectedEnv>` 只有 3 个参数（缺少 `pathResolver`）。将 detect 阶段接入 pipeline 时需决定：修改 `DetectFn` 类型签名加入 `pathResolver`，或通过闭包/偏函数在接入层适配。
- **涉及文件**: `src/stages/detect-tools.ts`, `src/pipeline.ts`
- **建议时机**: Epic 3/4 中负责 pipeline 阶段接入的 Story
- **状态**: resolved
- **解决记录**: Story 3-3 中通过 `createProductionStages(pathResolver)` 工厂函数解决，使用闭包适配 3 参数 `DetectFn` → 4 参数 `detectTools` 调用（`pipeline.ts:179`）。

### TODO-015: 修正 mvp-go-nogo-checklist.md 中 W1/W2 汇总措辞

- **来源**: Story 5-5c CR round 1 (2026-04-02)
- **优先级**: P2
- **类别**: tech-debt
- **描述**: `mvp-go-nogo-checklist.md:35` 汇总写为 "4/4 已验证（W1/W2 依赖真实网络环境，本次为已知限制）"，但 W1/W2 状态为 "⚠️ 未验证"，存在语义冲突。建议改为 "2/4 通过，2/4 未验证（已知限制：W1/W2 依赖真实网络环境，无法在 E2E 中自动化验证）"，与各行状态保持一致。
- **涉及文件**: `_bmad-output/implementation-artifacts/mvp-go-nogo-checklist.md`
- **建议时机**: 下次更新发布门禁文档时
- **状态**: resolved
- **解决记录**: Story 5-6 Task 4 中解决。`mvp-go-nogo-checklist.md:35` 汇总行已改为 "2/4 通过，2/4 未验证（已知限制：W1/W2 依赖真实网络环境，无法在 E2E 中自动化验证）"，与表格中 W1/W2 的 ⚠️ 状态完全一致。

### TODO-016: 定义"发布 lint 门禁"的明确检查范围脚本

- **来源**: Story 5-5c CR round 1 (2026-04-02)
- **优先级**: P2
- **类别**: tech-debt
- **描述**: 项目标准 lint 脚本 `npm run lint`（`eslint . && prettier --check .`）作用域为整个项目根目录，包含 `.gemini/**` 等 339 个非发布产物文件，导致 lint 返回退出码 1。建议新增一个专用于发布门禁的 lint 脚本（如 `npm run lint:src`，只检查 `src/` 和 `tests/`），并在门禁清单中明确标注使用哪个脚本。当前 Story Dev Agent Record 中的 "Lint：ESLint exit 0，Prettier src/tests 全绿" 描述的是局部范围检查，应在脚本名称中体现。
- **涉及文件**: `package.json`, `_bmad-output/implementation-artifacts/mvp-go-nogo-checklist.md`
- **建议时机**: 下次修改 package.json 时
- **状态**: resolved
- **解决记录**: Story 5-6 Task 3 中解决。`package.json` 新增 `"lint:src": "eslint src/ tests/ && prettier --check \"src/**/*.ts\" \"tests/**/*.ts\""`，`npm run lint:src` 退出码 0。同步将 lint 作用域规则写入 `project-context.md` 和 `04-implementation-patterns.md`（CR Workflow 章节）。

---

## 条目模板（不要删除）

<!--
### TODO-{NNN}: {简短标题}

- **来源**: {story-id} CR round {N} ({YYYY-MM-DD})
- **优先级**: P1 / P2 / P3
- **类别**: refactor / duplication / tech-debt / naming / test-gap / other
- **描述**: {具体问题描述}
- **涉及文件**: `{file-path}` (可多个)
- **建议时机**: {例如 "下次触及 init.ts 时" / "epic-3 开始前" / "专项重构"}
- **状态**: open / in-progress / resolved
- **解决记录**: {解决时填写：在哪个 story 中解决，PR/commit 引用}
-->