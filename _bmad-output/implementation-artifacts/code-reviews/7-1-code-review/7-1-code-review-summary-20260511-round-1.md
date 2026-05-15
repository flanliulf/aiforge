---
Story: 7-1
Round: 1
Date: 2026-05-11
Model Used: Claude Opus 4.7 (claude-opus-4-7)
Type: Code Review Summary
---

## 审查结论

首轮审查。三层并行审查（Blind Hunter / Edge Case Hunter / Acceptance Auditor）全部正常返回。`npm test`、`npm run lint:src`、`npm run build` 全部通过（831/831 tests，lint 无报错，ESM 构建 16ms），AC #1（vscode 删除 + 迁移）、AC #5（version 2.0.0）、AC #6（质量门禁）已完全满足。

但本次审查发现 **2 处 [高] 阻塞项** —— ID 1（`detectLegacyVscodeOnly` 触发场景过窄，AC #3 在混合工具与项目级 `.vscode/` 场景下不输出迁移提示）和 ID 5（claude global/project instructions 直接写入 `~/.claude/` 与 `.claude/` 根目录，可能覆盖用户 `CLAUDE.md` / `settings.json`，需用户裁决）；以及多处 [中] 优先级问题：copilot:project:mcp-tools 同源双规则导致双倍计数、cursor:global agents/skills 共用目录 basename 冲突、E2E 测试后置到 Story 7-10、AC #2 规则数量口径漂移（16→20 vs 16→19）、CHANGELOG/migration FAQ 与实现行为脱钩、`messages.ts` 出现多条与 Story 7-1 无关的 i18n 键、Rule Document Registry 同步合规性未确认。

**建议：不通过（需修复 ID 1、ID 5 阻塞项后复审）**。其他 [中] 项可在本轮内一并处理或在评估阶段决定下放为 CR TODO / 后置 Story。

## 新发现

### 1. [高] detectLegacyVscodeOnly 触发场景过窄：仅在 NO_TOOLS 分支调用 + 仅检查 home 目录

- **来源**：blind+edge+auditor
- **分类**：patch

- **证据**
  - `src/stages/detect-tools.ts`：`detectLegacyVscodeOnly` 仅在 `detectedTools.length === 0` 分支被调用，提示路径在以下场景不会触发：
    - 用户同时安装了 Claude 或 Cursor 但未安装 Copilot 且 `~/.vscode/` 存在（detectedTools 非空，外层 if 短路）
    - 用户仅在项目侧拥有 `.vscode/` 而 home 无 `~/.vscode/`（detectLegacyVscodeOnly 内部不检查项目目录）
    - 仓库含 `.github/` 时 copilot 被自动识别，使 vscode-only 用户绕过整个 length===0 分支
  - 内部冗余守卫 `!detectedTools.includes('copilot')` 出现在 `detectedTools.length === 0` 内部，逻辑恒为 true（属于 ID 2 死代码）
  - AC #3 Given 描述「环境存在 ~/.vscode/ 但无 ~/.copilot/」并未限定其他工具不存在

- **影响**
  - AC #3 的「告知 vscode-only 用户为何 vscode 不再被识别」语义在三大主要场景下失效，违反 NFR-C7 友好迁移意图
  - 包含 `.github/` 的仓库（自动识别 copilot）+ 仅 home 安装 VS Code 的用户得不到提示
  - 项目级 `.vscode/`（最常见的 VS Code 用户布局）完全未被检测

- **建议**
  - 将 `detectLegacyVscodeOnly` 调用从 `length===0` 分支移到 detectTools 主流程出口前的独立检查点，覆盖任意工具组合
  - 在 `detectLegacyVscodeOnly` 内补充项目级 `.vscode/` 检测：`vscodeExists || (await pathExists(join(process.cwd(), '.vscode')))`
  - 移除内部冗余 `!detectedTools.includes('copilot')` 守卫，让"copilot 未在被检测列表中"成为外层调用方的判定条件
  - 测试补齐三组场景：(a) detectedTools=['claude'] + `~/.vscode/` 存在 → 应 warn；(b) 仅项目 `.vscode/` 存在 → 应 warn；(c) `.github/` 触发 copilot 自动识别但 home `~/.vscode/` 存在 → 应 warn

### 2. [低] detectLegacyVscodeOnly 调用点的 `!detectedTools.includes('copilot')` 死代码

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - 调用点位于 `detectedTools.length === 0` 内部分支，再追加 `!detectedTools.includes('copilot')` 判断等价为 true

- **影响**
  - 死代码误导读者；与 ID 1 联动暴露设计缺陷

- **建议**
  - 删除冗余 `!detectedTools.includes('copilot')` 判断，或与 ID 1 一并通过外移调用点解决

### 3. [中] copilot:project:mcp-tools 同 sourceDir 双规则（`.github/` + `.vscode/`），同源文件双倍安装/计数

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `src/data/install-rules.ts` 中 copilot:project 同时存在 `{ sourceDir: 'mcp-tools', targetDir: '.github/' }` 与 `{ sourceDir: 'mcp-tools', targetDir: '.vscode/' }` 两条规则
  - `src/stages/execute-install.ts` 进度计数与 manifest 写入按规则数量展开，未对 (sourceDir, sourceFile) 去重
  - README / install-rules-matrix 未说明二者并行执行语义与冲突优先级
  - 未见任何聚合/防冲突测试

- **影响**
  - 一份 mcp-tools 源文件被同时写入两处 → `totalFiles` 计数双倍夸大，进度条与用户感知不一致
  - manifest 出现重复条目，将影响 update / clean 命令对资源所有权的追溯
  - 用户使用 `--filter` 时无法单独选择目标目录
  - `RULE_INDEX.get('copilot:project')` 等聚合调用语义分裂

- **建议**
  - 评估是否真需要双 targetDir：若是，引入 plan 层去重或显式声明 multi-target 安装意图；若否，仅保留 `.vscode/` 承接（与 Story 7-1 AC #1 一致）并将 `.github/` 部分作为既有功能保留
  - 在 install-rules-matrix.md 与 migration-v2.md 中显式说明双写语义
  - 补充测试：同一 sourceDir 双规则下 `totalFiles` 不应被双倍计数

### 4. [中] cursor:global agents(Files) 与 skills(Flatten) 共用 `~/.cursor/rules/`，basename 冲突会静默覆盖

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - 新增 `cursor:global:agents → ~/.cursor/rules/` (Files) 与既有 `cursor:global:skills → ~/.cursor/rules/` (Flatten) 写入同一目标目录
  - 当源文件命名冲突（如 `agents/foo.md` 与 `skills/foo/index.md` Flatten 产物 `foo.md`），后写者覆盖先写者
  - 安装顺序依赖 BUILTIN_RULES 数组顺序，未来重排会导致行为不可预测
  - 无冲突检测、前缀/后缀策略，也无相关测试

- **影响**
  - 用户配置可能在不可见情况下被覆盖（data loss / 静默覆盖）
  - 安装结果与 BUILTIN_RULES 数组顺序耦合，可重复性差

- **建议**
  - 在 plan 阶段对 (target tool, target scope, target path basename) 做冲突检测，命中时 `reporter.warn` 或抛 conflict
  - 评估是否在 cursor:global 维度采用 sub-folder 隔离（`~/.cursor/rules/agents/` vs `~/.cursor/rules/skills/`），与 cursor:project 对称
  - 补充冲突场景单元测试

### 5. [高] claude global/project instructions 写入 `~/.claude/` 与 `.claude/` 根目录，可能覆盖用户 CLAUDE.md / settings.json

- **来源**：blind+edge
- **分类**：decision_needed

- **证据**
  - 新增规则 `claude:global:instructions → ~/.claude/` 与 `claude:project:instructions → .claude/`，type 为 Files
  - Claude Code 在这两个位置维护用户自己的 `CLAUDE.md`、`settings.json` 等关键配置
  - Story 7-1 Task 2.3 自己已经标注「CLAUDE.md/AGENTS.md 共存场景在 Story 7-3/7-9 进一步处理」，但本 Story 已经落地写入规则
  - 当前 PR 未在本 Story 加入任何 conflict 保护或 `reporter.warn` 提示

- **影响**
  - 若用户仓库 instructions 目录中存在 `CLAUDE.md`，安装会静默覆盖 Claude Code 自身的 CLAUDE.md（这是 Claude 用户最高优先级的配置文件）
  - 可能影响用户的 Claude Code 自定义配置；与 NFR-C7 「不破坏用户既有配置」原则冲突
  - 一旦覆盖发生，对受影响用户造成不可逆数据丢失（settings.json 等用户配置）

- **建议**
  - **需用户裁决**：以下两个方向择一
    - 方向 A（推荐）：保留新规则，但在 execute-install 阶段对 `claude:*:instructions` 目标路径中的 `CLAUDE.md`、`AGENTS.md`、`settings.json` 等 reserved name 做硬冲突检测，存在则 `reporter.warn` 且跳过；同时本 Story 必须提供对应测试用例（不下放到 Story 7-3/7-9）
    - 方向 B：将本 Story 中的 claude instructions 双路径规则推迟到 Story 7-3/7-9（与 CLAUDE.md/AGENTS.md 共存场景一并处理），仅在本 Story 完成 vscode 删除与 copilot mcp-tools 迁移
  - 在 docs/migration-v2.md 与 install-rules-matrix.md 中显式标注该写入路径的覆盖风险

### 6. [中] AC #2 规格文本 (16→20, +5/-1) 与实现 (16→19, +4/-1) 数量口径不一致，AC 主文未同步修订

- **来源**：blind+auditor
- **分类**：patch

- **证据**
  - Story 7-1 AC #2 字面要求「BUILTIN_RULES 总量从 16 条变为 20 条（+5/-1）」
  - `src/data/install-rules.ts:474` 头注释明确说明 19 条规则；`tests/data/install-rules.test.ts:636` 断言 `toHaveLength(19)`
  - Dev Notes Debug Log 第 2 条已记录「实际净变化 +3，最终 19」决策，但 AC 主文未同步修订
  - install-rules-matrix.md Total 显示 23（19 工具 + 4 通用），与 README 改文一致但 AC #2 中的 20 是否含通用规则口径不明
  - 测试描述 `+4 new rules -1 vscode = 16+3` 算术上吻合（4-1=3），但表述形式易让人误读

- **影响**
  - 后续读者只读 AC 时会误判为缺一条规则
  - 评估阶段需重新对账实际口径

- **建议**
  - 同步修订 AC #2 文本为「BUILTIN_RULES 总量从 16 条变为 19 条（+4/-1）」并附 Dev Notes 注释说明原计划 +5 中的某条被合并/取消
  - 在 install-rules-matrix.md 中明确「19 工具规则 + 4 通用规则 = 23」与 AC #2 数量口径的对应关系
  - 修正测试描述为更清晰的 `16-1+4 = 19`

### 7. [低] README / README.zh.md ASCII 流程图右侧出现 Cursor 重复，丢失第四个工具槽位语义

- **来源**：blind+auditor
- **分类**：patch

- **证据**
  - `README.md:10` 将原图右侧第四行的 `VS Code` 改为 `Cursor`
  - `README.md:8` 已存在 `Cursor`，导致 ASCII 图中第二、三行都显示 `Cursor`
  - `README.zh.md:75` 同样问题

- **影响**
  - 文档视觉缺陷，作为面向用户的首要入口可读性下降

- **建议**
  - 将该槽位空白化（保留 `│                │`）或将 ASCII 图压缩为 3 行，避免简单字面替换造成的重复
  - 双语保持一致

### 8. [中] pipeline.test.ts 删除 vscode:global E2E 但未补齐 copilot:project:mcp-tools → `.vscode/` 新 E2E

- **来源**：blind+auditor
- **分类**：patch

- **证据**
  - `tests/integration/pipeline.test.ts:874-908` 删除旧 vscode E2E，仅留注释「copilot:project mcp-tools → .vscode/ 的集成测试在 Story 7-10 统一补齐」
  - AC #1「`.vscode/mcp.json` 项目级 MCP 被迁移并绑定到 copilot」缺少 E2E 验证

- **影响**
  - E2E 覆盖率净下降（删除一条但未补齐对应一条）
  - 若 Story 7-10 因故延期或裁剪，新规则可能长时间无 E2E 验证
  - 与 AC #1「实施完成」语义存在覆盖缺口

- **建议**
  - 在本 Story 内补一条最小 E2E：触发 copilot 项目级安装后，验证产物在 `.vscode/` 目录下存在且 manifest 正确记录
  - 若决定保留 Story 7-10 收尾的安排，至少应将该 TODO 显式登记到 cr-todo-backlog.md

### 9. [中] CHANGELOG / migration FAQ 与实现行为脱钩（install flow 阻塞性、manifest 行为、产物文件名）

- **来源**：blind
- **分类**：patch

- **证据**
  - CHANGELOG v2.0.0 章节称 vscode-only 用户的 install flow「is not blocked」，但 `src/stages/detect-tools.ts` 在 `detectedTools.length === 0` 分支仍 `throw NO_TOOLS`（warn → fatal）
  - `docs/migration-v2.md` FAQ：「Only if the file exists and was previously managed by aiforge (tracked in the manifest)」—— diff 中无 manifest 标记 ownership 的对应实现引用
  - 同 FAQ：「MCP config will be written to `.vscode/mcp.json` in your project」—— `type: Files` 规则会复制源目录下任意文件名，不保证产物名为 `mcp.json`

- **影响**
  - 文档承诺与代码现状脱钩，存在虚假承诺风险
  - 用户阅读 CHANGELOG/迁移文档与实际行为出现预期落差

- **建议**
  - 校准 CHANGELOG 措辞为「install flow may still fail with NO_TOOLS, but a migration note is shown first」
  - 校准 FAQ：去掉对 manifest 行为的承诺（或确认是否在本 Story 内实现），并将产物文件名表述改为「与源目录中的文件一致，通常包含 `mcp.json`」
  - 双语保持一致

### 10. [中] messages.ts 引入多条与 Story 7-1 无关的 i18n 键且无 reporter 调用点（范围蔓延 + dead key）

- **来源**：blind+edge
- **分类**：decision_needed

- **证据**
  - `src/core/messages.ts` diff 引入：`collapsedItems`、`skippedOnlySummary`、`diagNoInstallSources`、`diagEmptyDirectories`、`suggestCheckSelection`、`suggestCheckRepoContent`、`suggestCheckEmptyDirectories`、`suggestCheckDirectoryContents`、`suggestForce`、`suggestCheckRepo` 等多个键
  - 在 reporter / execute-install.ts / detect-tools.ts 等调用点的 diff 中均未出现引用
  - Story 7-1 Dev Notes「精确锁定改动文件」原则与 NFR-I5「零引擎改动（仅 Task 4 允许有限扩展 detect-tools）」存在张力

- **影响**
  - 范围蔓延，混入与 Story 7-1 无关的变更，违背 NFR-I5
  - i18n 资源膨胀，未来 lint/dead-key 检查产生噪音
  - 评估与回归测试范围被无谓扩大

- **建议**
  - **需用户裁决**：确认这些键是否在 git status 中其他未列入 File List 的 stage 文件（如 `src/stages/execute-install.ts`、`src/stages/clone.ts`、`src/stages/authenticate.ts`）中被引用
  - 若是与 Story 7-1 无关的混入变更，应剥离到独立提交/Story；若属于遗漏的调用点，应将相关 stage 文件加入 File List 并补齐测试
  - 当前 git status 显示这些 stage 文件均有 modified，提示存在未声明的范围蔓延

### 11. [低] vscodeMergedNote 文案在保护范围、文件名承诺、排版方面存在歧义/兼容性问题

- **来源**：blind
- **分类**：patch

- **证据**
  - 文案声称「现有 ~/.vscode/ 文件不会被覆盖或删除」，但新增规则 `copilot:project:mcp-tools → .vscode/` 可能写入项目根 `.vscode/`，让用户混淆「项目级 .vscode/」是否受保护
  - 文案未明确告知 NFR-C7「manifest 不标记 ~/.vscode/ 既有文件为 owned by aiforge」承诺
  - 文案混用全角圆圈数字 ①②③，在部分 Windows 终端或简易 SSH 终端可能渲染为问号
  - 与同文件其他列表风格（`1.` / `2.`）不一致

- **影响**
  - 用户阅读时易混淆保护范围
  - 终端兼容性边缘场景下可读性下降

- **建议**
  - 文案显式区分「home 级 ~/.vscode/ 不受影响」与「项目级 .vscode/ 在安装 Copilot 后会作为 copilot:project 目标」
  - 增加 manifest 承诺：「也不会被 aiforge manifest 标记为本工具所有」
  - 将圆圈数字 ①②③ 改为 ASCII `1.` / `2.` / `3.` 并与同文件其他列表风格统一

### 12. [低] `--tools vscode` 手动模式抛 UNKNOWN_TOOL 时不输出 vscodeMergedNote

- **来源**：edge
- **分类**：patch

- **证据**
  - `src/stages/detect-tools.ts` 手动 `--tools` 校验分支若收到 `vscode` 直接 throw UNKNOWN_TOOL

- **影响**
  - 脚本化/CI 用户继续运行 `aiforge install --tools vscode` 时拿不到迁移指引
  - AC #3 隐含「告知 vscode 已归并」的语义在手动模式下覆盖缺口

- **建议**
  - 在手动模式校验分支命中 `vscode` 时，先 `reporter.warn(msg('detectTools.vscodeMergedNote'))` 再 throw UNKNOWN_TOOL；或单独抛带迁移文案的 VSCODE_MERGED 错误

### 13. [低] detectLegacyVscodeOnly 缺少非目录辨别 + pathExists 异常透传

- **来源**：edge
- **分类**：patch

- **证据**
  - 若 `~/.vscode` 是普通文件（少见但可能），access 仍返回 true，pathExists 返回 true，导致误判
  - 若 pathExists 内部对 EACCES/EIO 等非 ENOENT 错误向上抛出（取决于既有实现），detectLegacyVscodeOnly 调用链会冒泡，掩盖 NO_TOOLS 诊断

- **影响**
  - 误判 vscode-only 与 NO_TOOLS 诊断输出被异常掩盖（受限权限环境）

- **建议**
  - 用 `stat()` 并校验 `isDirectory()` 替代 pathExists；或 try/catch 包裹并把所有异常视为「未检测到」（与 NO_TOOLS 失败优雅降级一致）

### 14. [低] 测试中硬编码绝对路径 `String(p) === '/home/user/.vscode'`，缺乏路径规范化与跨平台覆盖

- **来源**：blind
- **分类**：patch

- **证据**
  - `tests/stages/detect-tools.test.ts` 中通过 `String(p) === '/home/user/.vscode'` 字面比对作为 mock 命中条件
  - 测试断言 vscodeMergedNote 内容使用 `includes('~/.vscode/')` 与 `includes('v2.0')`

- **影响**
  - 若 home 解析为 `/home/user/`（带尾斜杠）、Windows 风格路径或大小写差异，mock 失效
  - 未来文案重写为 `%HOME%/.vscode/` 等占位符或 v2.0 措辞变更时测试静默失效

- **建议**
  - 用 `path.join(pathResolver.home(), '.vscode')` 等动态拼接，或 mock pathResolver.home() 返回常量 + 通过 `path.posix` 标准化
  - 测试断言改为针对 vscodeMergedNote 的关键语义片段（如「VS Code merged」「migration」），而不是字面 `v2.0`

### 15. [低] CHANGELOG 中 `## [1.0.0] - 2026-03-XX` 日期占位符未替换

- **来源**：blind
- **分类**：patch

- **证据**
  - `CHANGELOG.md` 中 1.0.0 历史条目日期写为 `2026-03-XX`

- **影响**
  - 已发布版本的历史记录留下未填项，违背 Keep a Changelog 规范

- **建议**
  - 用真实日期（参考 `git log --grep "release.*1.0.0"` → `db6d15c chore(release): 发布 1.0.0 正式版本` 对应 commit 日期）替换占位符 `XX`

### 16. [低] package.json 版本 1.0.0 → 2.0.0 跳级，但 package-lock.json 未在 diff 中显式同步

- **来源**：blind
- **分类**：patch

- **证据**
  - `git status` 显示 package-lock.json 有 modified 状态但 File List 未包含
  - 无法在本审查范围内确认 lockfile 中 `name` / `version` 字段已同步到 2.0.0

- **影响**
  - npm publish 时若 lockfile 版本与 package.json 不一致会触发警告或锁定冲突
  - 发布元数据完整性存疑

- **建议**
  - 合并前显式确认 package-lock.json 已同步并加入 File List

### 17. [低] detectLegacyVscodeOnly 两次串行 await pathExists，未使用 Promise.all 并行

- **来源**：blind
- **分类**：patch

- **证据**
  - 函数对 `~/.vscode/` 与 `~/.copilot/` 两次串行 await pathExists

- **影响**
  - 非关键路径但每次调用多一次 I/O 等待

- **建议**
  - 改为 `const [vscodeExists, copilotExists] = await Promise.all([pathExists(vscodePath), pathExists(copilotPath)])`

### 18. [低] dry-run 测试 filter `targetPath.includes('.cursor')` 缺 rule 维度过滤

- **来源**：edge
- **分类**：patch

- **证据**
  - `tests/integration/dry-run.test.ts:613-616` 仅按 `targetPath.includes('.cursor')` 过滤计算 installedCursorGlobalTargets

- **影响**
  - 若临时目录路径意外包含 `.cursor` 子串，断言失真
  - 路径敏感，未来工具新增 `.cursor*` 形态目录时易破

- **建议**
  - 改为 `i.rule?.tool === 'cursor' && i.rule?.scope === 'global'` 维度过滤

### 19. [低] migration-v2.md / .zh.md 缺少「v1.x 中 vscode 共有 1 条规则」的显式表头声明

- **来源**：auditor
- **分类**：patch

- **证据**
  - `docs/migration-v2.md` 仅以表格形式列出单条 `vscode:global:mcp-tools → ~/.vscode/` 旧规则
  - 缺少更显式的「v1.x 中 `vscode` 共有以下 1 条规则」表头或说明
  - `docs/migration-v2.zh.md` 同样问题

- **影响**
  - 读者可能误以为有遗漏

- **建议**
  - 在表格上方增加显式说明：「v1.x 中 `vscode` 共有 1 条规则，迁移映射如下：」

### 20. [中] CLAUDE.md Rule Document Registry 同步要求在本 PR 内未验证

- **来源**：blind
- **分类**：decision_needed

- **证据**
  - 项目根 `CLAUDE.md` 明确「凡是确认/修改/新增任何规则、约定或豁免，必须同步更新 `project-context.md`、`04-implementation-patterns.md`、`03-core-decisions.md`」
  - 本 Story 7-1 修改了 BUILTIN_RULES 数量（16→19）与 TOOL_DEFINITIONS（4→3），属于规则边界变更
  - 本次 diff 未包含 `_bmad-output/planning-artifacts/architecture/04-implementation-patterns.md` 与 `03-core-decisions.md` 的对应更新
  - `git status` 显示 04-implementation-patterns.md 有 modified，但未确认其变更内容是否覆盖本次规则口径变更
  - `_bmad-output/project-context.md` 同样 modified 但未纳入 File List

- **影响**
  - 违反 CLAUDE.md 顶部「规则变更同步约束」
  - 后续 AI Agent 读取过时规则文档可能做出不一致决策

- **建议**
  - **需用户裁决**：确认 04-implementation-patterns.md / 03-core-decisions.md / project-context.md 是否已同步规则数量与工具列表变更；若未同步，需在本 Story 内补充并加入 File List

## 验证摘要

- `npm test` ✅（831 / 831，33 test files all passed，duration 1.25s）
- `npm run lint:src` ✅（eslint 无报错，prettier 全部文件符合代码风格）
- `npm run build` ✅（ESM 132.75 KB / 16ms，DTS 714ms）
- 三层并行审查 ✅（Blind Hunter / Edge Case Hunter / Acceptance Auditor 均正常返回）
- 静态分析未做运行时复现（detectLegacyVscodeOnly 的混合场景与 cursor:global basename 冲突场景）

## 通过项

- AC #1（vscode 工具 ID 删除 + `.vscode/mcp.json` 迁移到 copilot 项目级规则）核心实现到位
- AC #5（`package.json` version → 2.0.0）已落地
- AC #6（npm test / lint:src / build 三个质量门禁）全部通过
- `TOOL_DEFINITIONS` 数量从 4 降为 3（copilot/claude/cursor），断言对齐
- `BUILTIN_RULES` 总量 19 条（净变化 +3），data/install-rules.test.ts 断言对齐
- `messages.ts` 新增 `detectTools.vscodeMergedNote` 中英双语键值对齐既有 i18n 模式
- README / install-rules-matrix.md 工具支持表格修订与新规则行对齐
- CHANGELOG.md / migration-v2.md / migration-v2.zh.md 三份新建文档结构清晰，覆盖 Breaking Change、Added、用户操作步骤、FAQ
- vscode-only 用户的 fatal 路径在 warn 之后输出（NO_TOOLS 既有逻辑保留），未对 `~/.vscode/` 执行任何写操作（NFR-C7 核心约束满足）

### 已知既有问题（defer，非本次改动引起）

- ID 21 — 既有 `args.tools` 显式空数组 `[]` 与未指定 `undefined` 行为不一致：属于既有 args.tools 处理逻辑，本 Story 不引入，但与新增的 detectLegacyVscodeOnly 调用路径交互时可能放大误判面
- ID 22 — README / install-rules-matrix / migration-v2 / CHANGELOG 多处规则数量计数靠人工同步、无自动断言机制：属于既有文档维护方式，可在后续 Story 中通过构建期脚本/snapshot 测试覆盖
