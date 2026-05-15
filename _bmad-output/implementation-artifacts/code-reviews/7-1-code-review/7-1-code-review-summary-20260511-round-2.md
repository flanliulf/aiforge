---
Story: 7-1
Round: 2
Date: 2026-05-11
Model Used: Claude Opus 4.7 (claude-opus-4-7)
Type: Code Review Summary
---

## 审查结论

本轮为复审。三层并行审查（Blind Hunter / Edge Case Hunter / Acceptance Auditor）全部正常返回。Round 1 评估文件「修复执行记录」中的 9 项已实施修复在本轮复审中均被观察到对应实现，**未发现回归**。质量门禁全部通过：`npm test` 839/839、`npm run lint:src` ✅、`npm run build` ✅（134.23 KB / 16ms）。

本轮新发现 1 处 [高] 阻塞项 —— ID-1（Round 1 ID-5 修复引入的 `CLAUDE_INSTRUCTIONS_RESERVED_NAMES` 保护机制存在 5 个绕过路径：仅 Files 分支、大小写敏感、保留名列表不完整、不护嵌套、不护 symlink），属于安全/数据完整性问题，建议在本轮内修复或将剩余路径显式记为 CR TODO；以及 6 处 [中] 问题（detectLegacyVscodeOnly 守卫口径不等价、process.cwd 直接调用、Promise.all 异常放大、migration-v2 措辞与触发条件错位、双写行为文档未明示、execute-install 范围蔓延延伸）和 4 处 [低] 问题（reserved-skip 与 manifest 不同步、AC #5 测试缺失、install-rules.test 描述歧义、CHANGELOG 步骤索引、lockfile 起点漂移）。

**建议：不通过（需修复 ID-1 阻塞项后再复审，其他 [中]/[低] 项可由评估阶段决定纳入本轮或 CR TODO）**。

## 上轮问题回顾

### 已修复

1. Round 1 / Finding #1 — detectLegacyVscodeOnly 触发场景过窄
   - 修复位置：`src/stages/detect-tools.ts:95-102` 用 `Promise.all` 并行检测 home `~/.vscode/` + 项目 `.vscode/` + `~/.copilot/`；调用点外移到 NO_TOOLS 分支之外的 `!detectedTools.includes('copilot')` 守卫处
   - 验证结果：✅ 测试 `tests/stages/detect-tools.test.ts:1362-1448` 覆盖 home/project 双路径 + 调用点外移；本轮 ID-2/ID-3/ID-4 揭示新衍生问题，但 ID-1 主修复已落地

2. Round 1 / Finding #2 — detectLegacyVscodeOnly 调用点 `!detectedTools.includes('copilot')` 死代码
   - 修复位置：随 ID-1 修复，调用点外移到 length===0 分支之外，守卫不再恒为 true
   - 验证结果：✅ 自动消解；本轮 ID-2 指出守卫与函数内 copilotExists 检查不等价是新衍生问题，与 Round 1 ID-2 主题不同

3. Round 1 / Finding #5 — claude instructions 可能覆盖用户 CLAUDE.md / settings.json
   - 修复位置：`src/stages/execute-install.ts:539-562` 新增 `CLAUDE_INSTRUCTIONS_RESERVED_NAMES` 常量保护；`src/core/messages.ts` 新增 `claudeInstructionsReservedSkip` 中英双语
   - 验证结果：✅ 测试 `tests/stages/execute-install.test.ts:1828-1859` 覆盖三组场景（each reserved name / 非保留文件 / 非 instructions 规则）；但本轮 ID-1 揭示保护边界存在 5 个绕过路径，需进一步收紧

4. Round 1 / Finding #6 — AC #2 数量口径不一致（16→20 vs 16→19）
   - 修复位置：`_bmad-output/implementation-artifacts/stories/7-1-vscode-merge-and-mvp-rules-completion.md:23` AC #2 文本更新为「16 → 19（+4/-1；规格标注 20 为笔误，见 Dev Notes Debug Log #2）」
   - 验证结果：✅ AC 文本与实现一致；本轮 ID-9 指出测试 it title 仍有 `16+3` 歧义，是文档同步遗漏

5. Round 1 / Finding #7 — README ASCII 流程图 Cursor 重复
   - 修复位置：`README.md` / `README.zh.md` 第 4 格清空 `│                │`；Multi-tool support 描述与 Supported AI Tools 表格同步移除 VS Code 行
   - 验证结果：✅ 中英双语对称落地

6. Round 1 / Finding #9 — CHANGELOG / migration FAQ 与实现脱钩
   - 修复位置：`docs/migration-v2.md` / `docs/migration-v2.zh.md` FAQ 补充「migration note 不阻塞安装；但若无受支持工具则仍报 NO_TOOLS」
   - 验证结果：✅ 部分修复；本轮 ID-6 指出新措辞与 Round 1 ID-1 修复后的实际触发条件存在新错位（措辞暗示「只要有 claude/cursor 就不会提示」与实际行为相反）

7. Round 1 / Finding #15 — CHANGELOG 1.0.0 日期占位符
   - 修复位置：`CHANGELOG.md` `2026-03-XX` → `2026-04-21`（从 git log db6d15c 提取）
   - 验证结果：✅ 已落地

8. Round 1 / Finding #16 — package-lock.json 未同步到 2.0.0
   - 修复位置：`npm install` 重新生成；lockfile name 块 version 字段更新为 2.0.0
   - 验证结果：✅ name 块同步；但本轮 ID-11 指出顶层 version 字段从 0.1.0 跳到 2.0.0 显示历史漂移（既有问题，非本次引入）

9. Round 1 / Finding #20 — Rule Document Registry 同步
   - 修复位置：`_bmad-output/planning-artifacts/architecture/03-core-decisions.md` D5 注释更新「vscode removed」；`_bmad-output/project-context.md` 新增 v2.0 变更说明
   - 验证结果：✅ 已落地

### 仍为非阻塞待办（CR TODO）

经审查，以下 Round 1 / Round 2 CR TODO 项在本轮**未被恶化**，维持原评估结论：

1. Round 1 / Finding #3 — copilot:project:mcp-tools 同源双规则（.github/ + .vscode/）→ 维持 CR TODO（P2）
   - 本轮 ID-7 指出 migration-v2 / install-rules-matrix 仍未补双写行为说明，作为新发现细化

2. Round 1 / Finding #4 — cursor:global agents/skills basename 冲突 → 维持 CR TODO（P2）

3. Round 1 / Finding #8 — pipeline.test.ts 新规则 E2E 后置 Story 7-10 → 维持 CR TODO（P2）

4. Round 1 / Finding #10 — messages.ts / stages 范围蔓延 → 用户已决策不在本 Story 处理；本轮 ID-12 揭示这些 stages 代码内部存在更多缺陷（i18n 占位符兜底、magic numbers、Math.ceil、duplicate dedup、Directories 进度等），归属问题待评估阶段最终裁决

5. Round 1 / Finding #11 — vscodeMergedNote 文案歧义 / 圆圈数字 → 维持 CR TODO（P3）

6. Round 1 / Finding #12 — `--tools vscode` 手动模式不输出提示 → 本轮 Auditor F-7 指出：v2.0 已使 `--tools vscode` 直接抛 UNKNOWN_TOOL，行为从「warn 缺失」自然演化为「fatal error」（Breaking Change 自然结果），TODO 描述需在追踪文档中重命名为「UNKNOWN_TOOL 文案可加入 v2.0 迁移提示」

7. Round 1 / Finding #13（非目录辨别部分） — detectLegacyVscodeOnly 缺非目录辨别 → 维持 CR TODO（P3）

8. Round 1 / Finding #14 — 测试硬编码绝对路径 → 维持 CR TODO（P3）

9. Round 1 / Finding #17 — detectLegacyVscodeOnly 两次串行 await → 本轮 Auditor F-4 确认：函数已用 Promise.all 单次并行，TODO 描述错位，**Round 1 实际已修复**，建议在 TODO 追踪中标注「已隐式解决」

10. Round 1 / Finding #18 — dry-run 测试 filter 维度 → 维持 CR TODO（P3）

11. Round 1 / Finding #19 — migration-v2 缺少 v1.x vscode 规则数量表头 → 本轮 Auditor F-9 确认 `docs/migration-v2.md:24` 表格已含 `BUILTIN_RULES count | 16 | 19`，**已隐式解决**，建议在 TODO 追踪中标注「已隐式解决」

## 新发现

### 1. [高][新] CLAUDE_INSTRUCTIONS_RESERVED_NAMES 保护机制存在多个绕过路径

- **来源**：blind+edge+auditor
- **分类**：patch

- **证据**
  - `src/stages/execute-install.ts:539-562` reserved name 分支仅命中 `type === InstallType.Files`，Directories / Flatten 分支不触发保护
  - `CLAUDE_INSTRUCTIONS_RESERVED_NAMES` 使用 `basename(srcPath)` 大小写敏感比较；macOS / Windows 默认大小写不敏感 FS 上 `claude.md`、`Agents.md`、`SETTINGS.JSON` 可绕过
  - 保留名清单（CLAUDE.md / AGENTS.md / settings.json / settings.local.json）未涵盖 Claude Code 同样维护的 `CLAUDE.local.md`、`AGENTS.local.md`、`commands/`、`.claudeignore`
  - 嵌套子目录文件（`instructions/sub/CLAUDE.md`）若 instructions 规则未来切到 Directories 类型，basename 检查仍无法触发
  - 攻击者可控的知识仓库可通过软链接 `safe.md -> ../CLAUDE.md` 绕过 basename(srcPath) 检查（需 `realpath` 解析）

- **影响**
  - 直接影响 Round 1 ID-5 修复（claude instructions 覆盖 CLAUDE.md / settings.json）的保护意图——5 类绕过路径中任一被触发都可能造成用户 Claude Code 关键配置被静默覆盖
  - 第 (e) 项 symlink 绕过涉及供应链安全风险，违反 NFR-C7 「不破坏用户既有配置」

- **建议**
  - **必须修复**（部分）：(a) 将保护从 `if (rule.type === Files)` 分支移出，作为前置守卫覆盖 Files / Directories / Flatten 三个分支；(b) basename 比较改为 `basename(srcPath).toLowerCase()` 与 lowercased 集合比较，或读取目标文件系统大小写敏感性并适配
  - **建议补齐**：(c) 扩充保留名集合至 `CLAUDE.local.md` / `AGENTS.local.md` / `.claudeignore`；对 `commands/` 等目录级保留，需在 Directories 分支识别 `basename === 'commands'`
  - **决策需用户确认**：(d) Directories 分支的嵌套保留名检查粒度（仅顶层 / 递归全部）；(e) 是否对源文件做 `realpath` 解析以防 symlink 绕过——若涉及性能或权限边界，可标注为 CR TODO 后续治理
  - 补对应测试：每个绕过路径一组覆盖

### 2. [中][新] detectLegacyVscodeOnly 调用点守卫 `!detectedTools.includes('copilot')` 与函数内 `!copilotExists` 检查口径不等价

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `src/stages/detect-tools.ts:198` 外层守卫：`!detectedTools.includes('copilot') && (await detectLegacyVscodeOnly(pathResolver))`
  - `src/stages/detect-tools.ts:95-101` 函数内：`return (vscodeHomeExists || vscodeProjExists) && !copilotExists`，其中 `copilotExists = pathExists(join(home, '.copilot'))`
  - 两条件不等价：copilot 通过项目级 `.github/` 自动识别时 `detectedTools` 含 'copilot' 但 `~/.copilot/` 可能不存在；反之亦然

- **影响**
  - 函数内 `&& !copilotExists` 在大多数场景下是冗余检查（外层守卫已先短路）
  - 若两条件出现分歧，提示行为可能与用户预期不一致

- **建议**
  - 在函数内移除 copilotExists 判定，仅返回「home 或 project `.vscode/` 是否存在」，将"copilot 是否已检测"完全交给外层调用方判定（单一职责）
  - 或反过来：函数自包含完整判定，调用方不再加守卫
  - 二选一，避免双重判定语义分歧

### 3. [中][新] detectLegacyVscodeOnly 直接调用 `process.cwd()` 而非通过 pathResolver 注入项目根

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `src/stages/detect-tools.ts:97` `pathExists(join(process.cwd(), '.vscode'))`
  - 项目其他检测路径都从 pathResolver / mockRepo 获取项目根

- **影响**
  - 单元测试需 patch `process.cwd()` 才能稳定测试，与既有 mockPathResolver 注入模式不一致
  - 未来 CLI 引入 `--cwd <path>` 参数或 IDE 子进程工作目录非项目根时行为分歧
  - Windows 与 pathResolver.posix 化习惯不对称

- **建议**
  - 改为 `pathResolver.projectRoot()` 或类似抽象接口；若 pathResolver 暂未提供项目根方法，可在本 Story 内补充该方法并保持注入模式一致

### 4. [中][新] Promise.all 在三次 pathExists 任一抛 EACCES/ELOOP 时整体 reject，阻塞 detect 流程

- **来源**：edge
- **分类**：patch

- **证据**
  - `src/stages/detect-tools.ts:95-101` `await Promise.all([pathExists(~/.vscode), pathExists(.vscode), pathExists(~/.copilot)])`
  - pathExists 按项目规范对 ENOENT/ENOTDIR 白名单降级、其他 errno（EACCES/ELOOP/EIO）向上抛出（Round 1 评估已确认为预期）

- **影响**
  - Promise.all + 单点失败 → 整个并行查询 reject
  - 若任一目录因权限/符号链接破损抛错，detect 主流程被阻塞（除非外层 try/catch 覆盖）
  - 用户「有 claude/cursor 可用却因 ~/.vscode/ 不可访问而无法继续」与预期不符

- **建议**
  - 改用 `Promise.allSettled` 并将 rejected 视为「未检测到」
  - 或在函数内包 try/catch，把异常降级为 false 并 reporter.debug 记录
  - 补一条单元测试：mock pathExists 抛 EACCES → 函数应返回 false 而非 throw

### 5. [低][新] reserved-name skip 路径写入 resultItems（status: 'skipped'）但不更新 manifest，可能留下 stale 条目

- **来源**：edge
- **分类**：patch

- **证据**
  - `src/stages/execute-install.ts:539-562` reserved-name 命中时 `reporter.warn` + push skipped resultItem + continue
  - manifest 同步逻辑（`src/services/manifest.ts`）未被调用

- **影响**
  - 若上一次 install 已将该 reserved-name 写入并登记 manifest，本次跳过不会移除条目
  - 后续运行可能将该 manifest 条目判定为 outdated 而反复重试 skip

- **建议**
  - 在 skip 分支前调用 manifest 检查，若已有同 target 条目，应同步 manifest.remove 或显式记录为 `status: 'reserved-skipped'` 用于诊断

### 6. [中][新] migration-v2.md 措辞与代码 vscodeMergedNote 实际触发条件存在错位

- **来源**：blind+auditor
- **分类**：patch

- **证据**
  - Round 1 ID-1 修复后 vscodeMergedNote 触发条件为 `!detectedTools.includes('copilot') && (~/.vscode/ 或 .vscode/ 存在)`
  - `docs/migration-v2.md` / `docs/migration-v2.zh.md` Round 1 ID-9 修订的 FAQ 文案写「除非未检测到任何受支持的 AI 工具…aiforge 仍会因 NO_TOOLS 错误退出」
  - 读者会推断「只要检测到 claude/cursor 就不会出现 vscodeMergedNote」，与实际「只要未检测到 copilot 就提示」相反

- **影响**
  - 文档错位，可能让用户误以为 migration 提示在所有 detectedTools 非空场景下都不出现

- **建议**
  - 调整为「migration note 在 detect 阶段当 copilot 未被识别且检测到 ~/.vscode/ 或 .vscode/ 时输出；不阻塞安装；但若同时未检测到任何受支持工具，仍会因 NO_TOOLS 退出」
  - 中英双语同步

### 7. [中][新] copilot:project:mcp-tools 同源双写 `.github/` 与 `.vscode/` 行为未在 migration-v2 / install-rules-matrix 显式说明

- **来源**：blind
- **分类**：patch

- **证据**
  - `docs/migration-v2.md` / `docs/migration-v2.zh.md` 仅说明 vscode 规则迁移到 copilot，未明示「同一 mcp-tools 源目录会被 copilot:project 同时复制到 .github/ 和 .vscode/」
  - `docs/install-rules-matrix.md` 列表中两条规则并列但无并行执行/双写语义注释

- **影响**
  - 老用户从 v1.x 升级后看到同份 `mcp.json` 同时出现两处会产生困惑
  - 与 Round 1 ID-3 CR TODO 关联，但本条更聚焦文档面

- **建议**
  - migration-v2 增加 FAQ 项：「为什么我的 mcp-tools 文件同时出现在 .github/ 和 .vscode/？」
  - install-rules-matrix 表格上方加注「`mcp-tools` 源目录由 copilot:project 双写以兼容历史路径」

### 8. [低][新] AC #5（package.json version = 2.0.0）未由测试覆盖

- **来源**：auditor (F-3)
- **分类**：patch

- **证据**
  - Round 1 ID-16 修复 package-lock.json 同步，但仓库未在测试中加入 version 字段断言
  - `grep -rn '"2\.0\.0"' tests/` 无结果

- **影响**
  - 未来 release 流程或脚本不慎回退版本时 CR ID-15/ID-16 修复无回归保障

- **建议**
  - 新增 `tests/version.test.ts` 或在 `tests/data/install-rules.test.ts` 内加 `expect(require('../../package.json').version).toBe('2.0.0')`

### 9. [低][新] tests/data/install-rules.test.ts 描述 `+4 new rules -1 vscode = 16+3` 在 AC 文本修订后未同步

- **来源**：blind
- **分类**：patch

- **证据**
  - Round 1 ID-6 已将 AC #2 修订为「16 → 19（+4/-1）」
  - `tests/data/install-rules.test.ts:636` it title 仍为 `v2.0: +4 new rules -1 vscode = 16+3`，`+4 -1` 与 `16+3` 算术吻合（4-1=3）但表述不直观

- **影响**
  - 文档同步遗漏，读者读 test title 时易产生「+3」与「+4 -1」不一致的错觉

- **建议**
  - 改为 `v2.0: 16 - 1 + 4 = 19`，与 AC 文本表述一致

### 10. [低][新] CHANGELOG v2.0.0 Breaking Change 缺少 migration 步骤索引摘要

- **来源**：auditor (F-5)
- **分类**：patch

- **证据**
  - AC #4 字面要求「Breaking Change 条目明确记录：vscode 工具 ID 删除、归并路径、**migration 步骤索引**」
  - `CHANGELOG.md` v2.0.0 章节仅写「Migration: See docs/migration-v2.md / migration-v2.zh.md」

- **影响**
  - 用户从 CHANGELOG 跳转到 migration-v2 需额外一次阅读才能看到步骤索引
  - AC #4 字面要求未完全满足

- **建议**
  - CHANGELOG Breaking Change 行尾加摘要：`(steps: upgrade → install copilot extension → re-run aiforge install)`

### 11. [低][新] package-lock.json 顶层 version 字段从 0.1.0 跳到 2.0.0 显示历史漂移

- **来源**：blind
- **分类**：patch

- **证据**
  - `head package-lock.json`：顶层 `version` 字段 0.1.0 → 2.0.0；name 块 version 1.0.0 → 2.0.0
  - 两个起点不一致，暗示 lockfile 顶层 version 历史未随 1.x 同步

- **影响**
  - release-please / `npm version` 等自动化基于错误起点计算 diff
  - 既有 lockfile 维护问题，非本次 ID-16 修复引入

- **建议**
  - 本次提交中将 lockfile 顶层 version 也设为 2.0.0，或在 CHANGELOG 标注 lockfile 历史漂移已修正
  - 未来 release 流程对 lockfile 做 version 一致性校验

## 验证摘要

- `npm test` ✅（839 / 839，33 test files all passed，duration 1.18s）—— Round 1 修复后从 831 增至 839（+8），覆盖 ID-1（detectLegacyVscodeOnly 多场景）和 ID-5（reserved name 保护）新增测试
- `npm run lint:src` ✅（eslint + prettier 全部通过）
- `npm run build` ✅（ESM 134.23 KB / 16ms，DTS 714ms）
- 三层并行审查 ✅（Blind Hunter / Edge Case Hunter / Acceptance Auditor 均正常返回）
- 额外复核：Round 1 已修复项（ID-1/2/5/6/7/9/15/16/20）在代码 / 文档 / 测试中均观察到对应修复，未发现回归

## 通过项

- Round 1 全部 9 项修复已落地，未发现回归
- AC #1（vscode 工具 ID 删除 + `.vscode/mcp.json` 迁移到 copilot 项目级规则）持续满足
- AC #2（BUILTIN_RULES 总量 16→19）持续满足，AC 文本与实现/测试/文档全链路一致
- AC #3（vscode-only warn）触发场景已扩展到 home 与项目级 .vscode/ + 任意 copilot 未检测场景
- AC #4（CHANGELOG / migration-v2 中英双语）核心结构落地，本轮 ID-6/ID-7/ID-10 为细化项
- AC #5（package.json version = 2.0.0）+ lockfile 同步落地
- AC #6（npm test / lint:src / build）三个质量门禁全部通过（839/839）
- CLAUDE_INSTRUCTIONS_RESERVED_NAMES 主守卫（type === Files + 大小写敏感 basename）覆盖了 Story 文档列出的 4 个核心保留名（CLAUDE.md / AGENTS.md / settings.json / settings.local.json），单元测试覆盖完整 —— 但本轮 ID-1 揭示边界场景仍存在绕过
- Rule Document Registry 同步（03-core-decisions.md / project-context.md）已落地，符合 CLAUDE.md 顶部约束

### 已知既有问题（defer，非本次改动引起 / 用户已决策不在本 Story 处理）

- ID-12 — execute-install.ts 范围蔓延延伸：诊断/进度刷新/i18n 占位符相关代码内部存在多项缺陷（i18n 占位符兜底缺失、`INSTALL_PROGRESS_DETAIL_THRESHOLD=10` 等 magic numbers、`msg('phases.install').replace('...', '')` 国际化脆性、`shouldReportInstallProgress` 异常路径行为、`targetGroupLabel`/`targetGroupPath` 命名重叠、`InstallResult` 类型扩展未在本 diff 呈现、Math.ceil overflow、duplicate 切片 dedup、Directories 多文件进度上报、reserved-skip only 摘要可能掩盖用户预期）。Round 1 ID-10 评估已由用户决策「属其他 Story 残留，不在本 Story 范围处理」，本轮维持该决策。需在评估阶段确认是否需要将这些 stages 改动剥离到独立提交或推迟到独立 Story。

## 结论

- **结论：不通过（需修复后再复审）**
- **阻塞项**：ID-1（CLAUDE_INSTRUCTIONS_RESERVED_NAMES 保护机制 5 个绕过路径，涉及数据完整性 / 供应链安全风险）
- **建议**：
  - 本轮应至少修复 ID-1 (a) (b) 两项（Files/Directories/Flatten 分支统一保护 + 大小写不敏感比较），其余 (c)(d)(e) 可下放为 CR TODO 后续治理
  - [中] 级别的 ID-2/ID-3/ID-4/ID-6/ID-7 建议在本轮一并修复（代码与文档成本较低）；若评估阶段决定后置，需明确登记 CR TODO
  - [低] 级别的 ID-5/ID-8/ID-9/ID-10/ID-11 可全部下放 CR TODO
  - Round 1 CR TODO 项 17（detectLegacyVscodeOnly 串行 await）与 19（migration-v2 vscode 规则数量表头）已隐式解决，建议在评估阶段将其在 `cr-todo-backlog.md` 中标注为「已隐式解决」
  - ID-12 范围蔓延延伸需在评估阶段最终裁决归属（剥离 / 推迟 / 接受）
