---
Story: 7-1
Round: 4
Date: 2026-05-11
Model Used: Claude Opus 4.7 (claude-opus-4-7)
Type: Code Review Summary
---

## 审查结论

本轮为复审（Round 4）。三层并行审查（Blind Hunter / Edge Case Hunter / Acceptance Auditor）全部正常返回。**Round 3 修复执行清单逐项验证结果**：

- ✅ **R3 ID-1（Flatten 分支 reserved-name 守卫）**：已落地 — `src/stages/execute-install.ts:455-477` Flatten `for srcDir` 循环顶部新增守卫，覆盖三种 InstallType 一致。
- ✅ **R3 ID-2（validateDestPathSecurity 前置）**：已落地 — Flatten 分支 line 450 与 Files/Directories 分支 line 574 均位于 reserved-name 守卫之前。
- ⚠️ **R3 ID-3（reservedSkippedSummary 聚合 warn）**：已落地（方案 B）但**部分通过**——line 751-753 输出 reservedSkippedSummary warn，但 line 767 仍走 `completePhase(chalk.gray(msg('skippedOnlySummary')))` 灰色「成功」摘要，警告与完成态共存语义冲突（详见本轮 ID-3）。
- ✅ **R3 ID-4（toLocaleLowerCase('en-US')）**：已落地 — Files/Directories/Flatten 三处均使用 locale-locked 转换。
- ⚠️ **R3 ID-5（migration 文档 ② 项 marker 说明）**：文档侧已修改，**但代码侧未同步**——`src/core/messages.ts:538/823` 中 vscodeMergedNote ② 项仍为「请安装 GitHub Copilot 扩展后重新执行」，与文档样例「Create ~/.copilot/ as an aiforge marker」严重不一致（详见本轮 ID-1）。
- ✅ **R3 ID-6（用户裁决方向 B）**：无代码变更，符合预期。
- ✅ **R3 ID-7（守卫注释方向 B）**：execute-install.ts:454 注释明确「agents/ 子目录写入不冲突，不在保护范围内（方向 B，CR R3 ID-7）」。
- ✅ **R3 ID-8（CHANGELOG NFR-C7 区分）**：已落地。
- ✅ **R3 ID-9（reserved-skip warn 使用 item.targetPath）**：已落地。
- ✅ **R3 ID-10（migration aiforge.json 去 vaporware）**：已落地。

本轮新发现 **0 处 [高] 阻塞项** + **4 处 [中] 新问题**（vscodeMergedNote 与 migration 文档不一致 / reserved-name Unicode 同形绕过 / reserved-skip 与 completePhase 语义冲突 / 全部 reserved-skip 时 ensureDir 污染目录） + **1 处 [中][决策] 项**（Rule Document Registry 同步未在 diff 范围内显示）+ **9 处 [低] 新问题**。质量门禁基于 R3 修复执行声明 850/850 通过（本轮无新代码改动，未独立验证）。

**关键观察**：本轮 ID-1 是 R3 ID-5 修复引入的**真实文档↔代码偏差**——R3 修改了 docs/migration-v2 中的样例文本但忘了同步 src/core/messages.ts 的真实 warn 输出。ID-3 是 R3 ID-3 方案 B 的固有局限残留。ID-2 与 ID-4 是审查层穷举到的潜在副作用，与已修复内容无关。ID-5 涉及项目级 CLAUDE.md Rule Document Registry 同步约束，需用户确认 modified 状态文件是否真实包含本 Story 规则变更。

**建议：通过/暂不通过 由评估阶段裁决**。本轮无单点 [高] 阻塞项；但 ID-1（文档↔代码不一致）属于 R3 ID-5 修复未闭合，强烈建议本轮一并修复以避免 migration 文档可信度受损。

## 上轮问题回顾

### 已修复

1. Round 3 / Finding #1 — Flatten 分支 reserved-name 守卫缺失
   - 修复位置：`src/stages/execute-install.ts:455-477` Flatten `for srcDir` 循环顶部新增 reserved 守卫
   - 验证结果：✅ 守卫覆盖 Files / Directories / Flatten 三种 InstallType，闭合 R2 ID-1(a)「三种 InstallType」承诺

2. Round 3 / Finding #2 — reserved-skip early-return 跳过 validateDestPathSecurity（NFR-S5）
   - 修复位置：`src/stages/execute-install.ts:450,574` 将 `validateDestPathSecurity(destPath, allowedRoot)` 前置到 Files/Directories/Flatten 三分支 reserved 守卫之前
   - 验证结果：✅ NFR-S5 路径穿越检查在 reserved-skip early-return 之前执行

3. Round 3 / Finding #4 — toLowerCase Turkish locale 风险
   - 修复位置：`src/stages/execute-install.ts:458,583` 改用 `toLocaleLowerCase('en-US')` 锁定 locale
   - 验证结果：✅ Files/Directories/Flatten 三处统一使用

4. Round 3 / Finding #7 — agents/CLAUDE.md 守卫范围说明（方向 B）
   - 修复位置：`src/stages/execute-install.ts:453-454` 注释明确「守卫范围限定 instructions；agents/ 子目录写入不冲突，不在保护范围内（方向 B，CR R3 ID-7）」
   - 验证结果：✅ 测试 `tests/stages/execute-install.test.ts:1840-1860` 显式允许 agents/CLAUDE.md 复制，符合方向 B

5. Round 3 / Finding #8 — CHANGELOG NFR-C7 路径范围歧义
   - 修复位置：`CHANGELOG.md:2099-2104` 显式区分「Existing files under `~/.vscode/` (user home) are NOT modified」与「project-level `.vscode/` will receive mcp-tools writes」
   - 验证结果：✅ 中英双语已明确

6. Round 3 / Finding #9 — reserved-skip 消息使用 {targetDir} 模板路径
   - 修复位置：`src/stages/execute-install.ts:463,594` warn 调用改为 `.replace('{targetDir}', item.targetPath)`（绝对路径）；messages.ts 描述「目标:」→「目标目录:」
   - 验证结果：✅ 已落地

7. Round 3 / Finding #10 — migration aiforge.json vaporware
   - 修复位置：`docs/migration-v2.md` / `docs/migration-v2.zh.md` 移除「planned for a future release」，替换为「使用 --tools copilot 获取项目级 MCP 支持」
   - 验证结果：✅ 中英双语同步

### 部分通过 / 修复偏差

1. Round 3 / Finding #3 — reserved-skip 让 completePhase 输出「成功摘要」误导用户
   - 修复位置：`src/stages/execute-install.ts:751-753` 新增 `reservedSkippedSummary` 聚合 warn（方案 B）
   - 验证结果：⚠️ **部分通过** — 方案 B 仅在 reservedSkipCount>0 时额外输出 warn，但未替换 completePhase 的灰色「成功」摘要。当所有源文件均被 reserved 拦截且无其他写入时，用户看到 ⚠️ warning + ✔ completePhase 灰色「全部已是最新或被跳过」共存，CI/非 TTY 场景安全策略拦截事实仍可能被淡化（详见本轮 ID-3）。

2. Round 3 / Finding #5 — migration 文档 Copilot 路径说明
   - 修复位置：`docs/migration-v2.md` / `docs/migration-v2.zh.md` ② 项改为「Create ~/.copilot/ as an aiforge marker」+ Note 块说明 + `mkdir -p ~/.copilot/`
   - 验证结果：⚠️ **文档侧已修，但代码侧未同步** — `src/core/messages.ts:538,823` 中 vscodeMergedNote ② 项仍为「请安装 GitHub Copilot 扩展后重新执行」/「Install the GitHub Copilot extension and re-run」，与文档样例输出不一致（详见本轮 ID-1）。

### 仍为非阻塞待办（CR TODO）

经审查，以下 Round 1/2/3 CR TODO 项在本轮**未被恶化**：

1. Round 2 / Finding #1 (d) — Directories 嵌套保留名 → 维持 CR TODO（P3，本轮 Edge#1 重叠）
2. Round 2 / Finding #1 (e) — symlink basename 绕过 → 维持 CR TODO（P3）
3. Round 2 / Finding #2 — detectLegacyVscodeOnly 守卫不等价 → 维持 CR TODO（P3）
4. Round 2 / Finding #3 — process.cwd() 直接调用 → 维持 CR TODO（P3，本轮 Blind 重新提出但属于 R2 维持决策）
5. Round 2 / Finding #4 — Promise.all 单点失败 → 维持 CR TODO（P3，本轮 Blind/Edge EACCES 兜底重叠）
6. Round 2 / Finding #5 — reserved-skip 不更新 manifest → 维持 CR TODO（P3）
7. Round 2 / Finding #6 — migration-v2 FAQ 触发条件信息缺口 → 维持 CR TODO（P3）
8. Round 2 / Finding #7 — mcp-tools 双写文档说明 → 维持 CR TODO（P3，本轮 Blind#7 重叠）
9. Round 2 / Finding #8 — AC #5 version 测试断言 → 维持 CR TODO（P3）
10. Round 2 / Finding #9 — install-rules.test.ts it title → 维持 CR TODO（P3）
11. Round 2 / Finding #10 — CHANGELOG migration 步骤索引 → 维持 CR TODO（P3）
12. Round 1 / Finding #3 — copilot:project:mcp-tools 双规则计数 → 维持 CR TODO（合并 R2-#7）
13. Round 1 / Finding #4 — cursor:global agents/skills basename 冲突 → 维持 CR TODO
14. Round 1 / Finding #8 — pipeline.test.ts E2E 后置 Story 7-10 → 维持 CR TODO
15. Round 1 / Finding #10 — messages.ts / stages 范围蔓延 → 用户已决策维持现状
16. Round 1 / Finding #11 — vscodeMergedNote 文案歧义 → 维持 CR TODO（本轮 Blind#6 高频噪声重叠）
17. Round 1 / Finding #12 — `--tools vscode` 手动模式 → 维持 CR TODO（本轮 Blind config 残留重叠）
18. Round 1 / Finding #13 — detectLegacyVscodeOnly 非目录辨别 → 维持 CR TODO
19. Round 1 / Finding #14 — 测试硬编码绝对路径 → 维持 CR TODO
20. Round 1 / Finding #18 — dry-run filter 维度 → 维持 CR TODO（本轮 Blind#13 重叠）
21. Round 3 / Finding #6 — copilot 检测路径与实际不符 → 用户裁决方向 B，维持
22. Round 3 / Finding #7 — reserved-name 守卫仅覆盖 instructions → 用户裁决方向 B，维持

## 新发现

### 1. [中][新] vscodeMergedNote ② 项实际文案与 migration-v2 文档样例输出不一致

- **来源**：blind+edge+auditor
- **分类**：patch

- **证据**
  - `src/core/messages.ts:538` 中文 vscodeMergedNote ② 项为「请安装 GitHub Copilot 扩展后重新执行 aiforge install」
  - `src/core/messages.ts:823` 英文 ② 项为「Install the GitHub Copilot extension and re-run aiforge install」
  - `docs/migration-v2.md:73` 引用同一段 warning 的样例输出却是「Create ~/.copilot/ as an aiforge marker (see note below), then re-run aiforge install」
  - `docs/migration-v2.zh.md:72` 中文样例输出为「创建 ~/.copilot/ 作为 aiforge 标识目录（见下方说明），再重新执行 aiforge install」

- **影响**
  - R3 ID-5 修复仅改写了文档侧的样例输出，但未同步修改 `messages.ts` 中的真实 warn 文案
  - 用户运行 `aiforge install` 看到的提示 ②「请安装 Copilot 扩展」与文档样例 ②「创建 ~/.copilot/ 作为 marker」不一致
  - 按文档操作创建 marker 后用户得到的命令行输出与文档样例不匹配，引导路径失真
  - migration 文档可信度受损（AC #4 隐含的「migration 步骤索引完整」契约弱化）
  - 三层共同命中（blind+edge+auditor）说明问题严肃

- **建议**
  - 方案 A（推荐）：将 messages.ts:538/823 vscodeMergedNote ② 项改为与文档一致的「Create ~/.copilot/ as an aiforge marker, then re-run aiforge install」/「创建 ~/.copilot/ 作为 aiforge 标识目录后重新执行 aiforge install」
  - 方案 B：修订 migration-v2 文档样例输出，保持「Install the GitHub Copilot extension」措辞，并在 Note 块单独说明 mkdir 选项
  - 建议方案 A 以保持 R3 ID-5 「mkdir marker」修复路径一致

### 2. [中][新] reserved-name 硬保护未处理 Unicode 同形字符与 NFC/NFD 规范化

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `src/stages/execute-install.ts:458,583` 守卫使用 `toLocaleLowerCase('en-US')` 比较保留名
  - `src/stages/execute-install.ts:165-173` `CLAUDE_INSTRUCTIONS_RESERVED_NAMES` 仅列出 ASCII 形式
  - 用户若提交 `CLAUDЕ.md`（西里尔 Е U+0415）、`ＣＬＡＵＤＥ.md`（全角）或 macOS NFD 编码 `CLAUDE.md`，归一化后仍不匹配 Set

- **影响**
  - 大小写不敏感文件系统（APFS / HFS+）上，绕过守卫的同形字符变体可能写入并覆盖真实 `CLAUDE.md`
  - 「v2.0 reserved-name 保护」文案宣称硬保护，但 Unicode 同形场景下保护失效
  - 安全/数据完整性敏感场景（NFR-S5 reserved-name 守卫）

- **建议**
  - 在 `basename(srcPath)` 后追加 `.normalize('NFC')` 规范化
  - 显式 ASCII 同形字符黑名单（西里尔/希腊/全角/Cherokee 等高风险字符集）
  - 测试补充：claudе.md（西里尔 е）、ＣＬＡＵＤＥ.md（全角）、NFD 编码的 `CLAUDE.md`
  - 文档明确「reserved-name 保护针对 ASCII 字符；Unicode 同形字符不在保护范围」（若选择不实现规范化）

### 3. [中][新] reserved-skip 全部命中时 completePhase 仍输出「全部已是最新或被跳过」灰色成功摘要，与 reservedSkippedSummary 警告语义冲突

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `src/stages/execute-install.ts:751-753` 在 `reservedSkipCount > 0` 时通过 `reporter.warn(reservedSkippedSummary)` 输出聚合警告（R3 ID-3 方案 B）
  - `src/stages/execute-install.ts:767` 仍走 `completePhase(chalk.gray(msg('executeInstall.skippedOnlySummary')))` 灰色「成功」摘要
  - 当所有源文件均被 reserved 拦截且无其他写入时，用户终端同时看到 ⚠️ warning + ✔ 灰色「成功」标识

- **影响**
  - R3 ID-3 采用方案 B（额外 warn）但未替换 completePhase；R3 评估文件中评估意见列出方案 A/B/C 均可，方案 B 实现最简但留下当前残留
  - CI/非 TTY 场景下 completePhase 完成态主导终端解析，安全策略拦截事实被淡化
  - `--force` 无法响应 reserved-skip 但成功摘要不提示，用户可能反复尝试
  - 「被硬保护拒绝写入」与「文件已是最新」语义混淆

- **建议**
  - 方案 A（推荐 R3 评估推荐方向）：在 `reservedSkipCount === processedCount && !hasActualInstall` 时替换 completePhase 文案为专属 `reservedSkippedOnlySummary`（如「⚠️ 全部源文件均被 reserved-name 保护拦截，未执行任何写入」）
  - 方案 B：在 reservedSkipCount > 0 时跳过 completePhase，仅保留 reservedSkippedSummary warn 作为终态
  - 方案 C：让 reservedSkippedSummary 替代 skippedOnlySummary 渲染（区分 status: 'reserved-skipped' 在 resultItems 中）

### 4. [中][新] 全部 reserved-skip 时 `ensureDir(item.targetPath)` 仍创建空目标目录，污染用户配置目录

- **来源**：edge
- **分类**：patch

- **证据**
  - `src/stages/execute-install.ts:436` `await ensureDir(item.targetPath)` 在 sourceFiles 循环之前无条件执行
  - 当 sourceFiles 非空但全部命中 reserved-name 守卫被 skip 时，目标目录（如 `~/.claude/`）已被 ensureDir 创建
  - 即便最终没有任何写入也会留下空目录

- **影响**
  - 「reserved-name 拦截不应触及用户配置目录」的语义被破坏
  - 用户 `~/.claude/` 在原本不存在的情况下被 aiforge 创建为空目录
  - 下次 `aiforge install` 时空目录可能误导冲突检测或 manifest 推理
  - 与 R3 ID-3 文案「未写入目标目录」存在矛盾——目录已被创建只是文件未写入

- **建议**
  - 方案 A：在 `ensureDir(item.targetPath)` 前预扫 sourceFiles 是否全部命中 reserved 集合，全部命中时跳过 ensureDir
  - 方案 B：记录 ensureDir 前的目录存在状态，若全部 reserved-skip 且原本不存在则回滚（rmdir 如空）
  - 方案 C：将 ensureDir 移到首个真实写入之前（lazy ensure），但需要重构 Files/Directories/Flatten 三分支

### 5. [中][新][决策] Rule Document Registry 三个文档未在本 diff 范围内显示同步

- **来源**：auditor
- **分类**：decision_needed

- **证据**
  - 本 Story 修改了规则边界：删除 vscode、新增 4 条规则、增加 reserved-name 硬保护与 vscodeMergedNote 检测
  - 按 `CLAUDE.md` Rule Document Registry 约束「凡是确认/修改/新增任何规则、约定或豁免，必须同步更新以下所有文档」要求，需同步：
    - `_bmad-output/project-context.md`
    - `_bmad-output/planning-artifacts/architecture/04-implementation-patterns.md`
    - `_bmad-output/planning-artifacts/architecture/03-core-decisions.md`
  - `git status` 显示这三个文件处于 modified 状态但本审查 diff 范围（src/tests/docs）外，CR 内无法验证内容

- **影响**
  - 若三个文档未真实反映本 Story 规则变更（19 条规则、3 工具、reserved-name 硬保护、vscodeMergedNote），将违反项目核心约束
  - 后续 Epic 7 story 实施时可能因规则文档不一致而引入回归
  - AC #4「Breaking Change 有完整文档依据」隐含要求

- **建议**
  - **需用户裁决**：是否将三个 Rule Document 同步纳入本 Story Round 4 修复范围
    - 方向 A（推荐）：审查 modified 状态下的三个文件，确认是否包含：① TOOL_DEFINITIONS 由 4 工具变为 3 工具的描述；② BUILTIN_RULES 总量 16→19 的更新；③ reserved-name 硬保护机制说明；④ vscodeMergedNote 检测设计。若不完整则补齐
    - 方向 B：维持当前状态，假定 modified 文件已包含必要变更（需用户口头确认）
    - 方向 C：将 Rule Document Registry 同步独立为 Story 7-10 收尾任务

### 6. [低][新] detectLegacyVscodeOnly 同时检查项目级 .vscode/，几乎所有 VS Code 项目都触发噪声

- **来源**：blind
- **分类**：patch

- **证据**
  - `src/stages/detect-tools.ts:96-101` 条件为 `(vscodeHomeExists || vscodeProjExists) && !copilotExists`
  - `tests/stages/detect-tools.test.ts` 显式验证项目级 `.vscode/` 触发 vscodeMergedNote
  - 几乎所有 VS Code 项目都有 `.vscode/launch.json` 等配置目录

- **影响**
  - 所有未创建 `~/.copilot/` marker 的 VS Code 用户每次 `aiforge install` 都收到 vscodeMergedNote 警告
  - 结合 R3 ID-5 教用户 mkdir ~/.copilot/ 的副作用，新用户初次安装即被噪声警告
  - 破坏 AC #3「面向 v1.x 迁移用户」的精准提示语义——非迁移用户也被打扰
  - Round 1 ID-11 vscodeMergedNote 文案歧义 + Round 1 ID-12 `--tools vscode` 在本轮重叠

- **建议**
  - 方案 A：仅检测 home 级 `~/.vscode/`（去掉项目级判断）
  - 方案 B：项目级 `.vscode/` 内存在 v1.x aiforge 产物标志（如 `mcp.json` + 内容签名）才触发
  - 方案 C：维持现状但文档明确「该警告对所有 VS Code 项目用户可能触发，不代表 aiforge 强制要求安装 Copilot」

### 7. [低][新] migration-v2 教用户 `mkdir -p ~/.copilot/` 作为 aiforge 标识目录是脆弱反模式

- **来源**：blind
- **分类**：patch

- **证据**
  - `docs/migration-v2.md:79` `mkdir -p ~/.copilot/`
  - `docs/migration-v2.zh.md:78` 同上
  - 该路径与 `TOOL_DEFINITIONS.copilot.detect.global = ['~/.copilot']` 隐式耦合

- **影响**
  - 用户为绕过 detect 逻辑创建空目录的契约脆弱、不可发现（删除/重置 home 后不可恢复）
  - 与 GitHub Copilot 扩展真实位置（`~/.vscode/extensions/github.copilot-*/`）解耦
  - 「污染 home 目录」违背平台习惯

- **建议**
  - 短期：维持文档但补充注释「该 marker 与 Copilot 扩展位置无关，是 aiforge 内部识别约定」（部分已在 Note 块覆盖）
  - 中期：在 CLI 中加 `aiforge install --assume-copilot` 显式标志或 `aiforge.config.json` 中支持 `tools=['copilot']` 跳过 detect
  - 长期：读取真实 IDE 配置文件（VS Code settings.json 中 `github.copilot.enable`）作为替代检测路径

### 8. [低][新] reservedSkippedSummary 文案泛化「v2.0 reserved-name 保护」但实际仅 claude:instructions 触发

- **来源**：blind
- **分类**：patch

- **证据**
  - `src/core/messages.ts:499-500`（zh）「⚠️ {count} 个保留文件被 v2.0 reserved-name 保护拦截...」
  - `src/core/messages.ts:783-784`（en）「⚠️ {count} reserved file(s) were blocked by v2.0 reserved-name protection...」
  - reservedSkipCount 仅在 `src/stages/execute-install.ts:474,599` 即 `tool === 'claude' && sourceDir === 'instructions'` 上下文累计

- **影响**
  - 用户误以为存在统一的「v2.0 reserved-name 保护机制」覆盖所有工具
  - 未来若新增 copilot 等工具 reserved 名单将需要重新设计语义或文案

- **建议**
  - 文案明确为「{count} 个 Claude Code 保留文件被拦截」/「{count} Claude Code reserved file(s) blocked」
  - 或保留泛化文案但在 Note 中说明「当前仅 Claude Code instructions 启用保护」

### 9. [低][新] Flatten 分支 reserved-name 守卫先于 mainPath 存在性校验，源不存在仍计入 reservedSkipCount 导致 summary 虚高

- **来源**：edge
- **分类**：patch

- **证据**
  - `src/stages/execute-install.ts:455-477` reserved-name 守卫
  - `src/stages/execute-install.ts:481-507` `access(mainPath)` ENOENT/ENOTDIR 检查在 reserved 守卫之后
  - 当 srcDir 已被删除、mainPath 不存在但 `basename(srcDir)+'.md'` 命中保留名时仍 reservedSkipCount++

- **影响**
  - reservedSkippedSummary 显示拦截 N 个但其中包含「源就不存在」的伪命中，summary 失真
  - 与 Files/Directories 分支不一致——后者源不存在自然不触发 reserved-skip

- **建议**
  - Flatten 分支调整顺序：先 `access(mainPath)` 检查源存在 → 再 reserved-name 守卫
  - 或在 reserved-skip 前内嵌 mainPath 存在性快速检查

### 10. [低][新] diagnoseZeroResults 早返被 skipped/reserved-skip 项污染，遮蔽诊断信息

- **来源**：blind
- **分类**：patch

- **证据**
  - `src/stages/execute-install.ts:744-746` 通过 `resultItems.length > 0` 判断早返
  - reserved-skip 与 manifest-skip 项都会 push 到 resultItems

- **影响**
  - 当所有源文件被 reserved-name 或 manifest skip 拦截时，诊断早返，用户失去「为何没有任何 new/updated」的扫描目录/匹配规则上下文
  - 混合 reserved-skip + 其他 skip 时也走 completePhase 路径，可能掩盖真正问题

- **建议**
  - 早返条件改为 `resultItems.some((i) => i.status === 'installed' || i.status === 'updated')`
  - 或在所有项为 skipped 时强制运行 diagnoseZeroResults 补充上下文

### 11. [低][新] tests/stages/execute-install.test.ts 大小写变体测试依赖文件系统大小写敏感性，macOS APFS/HFS+ 可能 false-pass

- **来源**：blind
- **分类**：patch

- **证据**
  - `tests/stages/execute-install.test.ts:1943-1976` 5 组大小写变体测试用 `await expect(access(destPath)).rejects.toThrow()` 断言「未写入」
  - macOS APFS / HFS+ 默认大小写不敏感

- **影响**
  - 守卫失效写入 `target/Settings.JSON` 时，`access('target/settings.json')` 仍能成功，测试 false-pass
  - 跨平台 CI 行为不一致

- **建议**
  - 在 setup 中检查 fs 大小写敏感性并 skip 不可信用例
  - 或使用 `readdir` 精确比对 basename 而非 `access`

### 12. [低][新] 聚合 warn 测试断言 `includes('2') && includes('reserved')` 校验过弱

- **来源**：blind
- **分类**：patch

- **证据**
  - `tests/stages/execute-install.test.ts:2078-2083` 用 `warnCalls.find((w) => w.includes('2') && w.includes('reserved'))` 匹配 reservedSkippedSummary

- **影响**
  - 可能匹配到任何同时含「2」和「reserved」的字符串（如 'Step 2: reserved area'）
  - 语言切换为英文时也存在歧义

- **建议**
  - 改为精确匹配 reservedSkippedSummary 关键字串
  - 或通过 i18n key 间接断言

### 13. [低][新] tests/integration/dry-run.test.ts 使用 `includes('.cursor')` 过滤可能假阳性

- **来源**：blind
- **分类**：patch

- **证据**
  - `tests/integration/dry-run.test.ts:1338` 新断言 `filter((i) => i.targetPath.includes('.cursor'))`
  - 原本使用 `.endsWith('.md')`

- **影响**
  - 若 fixture 存在 `foo.cursor.backup.md` 类命名，会假阳性命中
  - 与 Debug Log #4 描述的「dry-run 过滤维度变化」一致

- **建议**
  - 精确化为 `(i) => i.targetPath.includes('/.cursor/') || i.targetPath.endsWith('/.cursor.md')`
  - 或恢复 `.endsWith('.md')` + 单独断言 cursor 路径数量

### 14. [低][新] README v2.0 提示框使用「项目规则 / project rules」复数，与实际单条规则不严格一致

- **来源**：auditor
- **分类**：patch

- **证据**
  - `README.md` v2.0 提示框「VS Code MCP configuration is now managed via copilot project rules」
  - `README.zh.md` v2.0 提示框「VS Code MCP 配置现由 copilot 项目规则管理」
  - 实际新增 1 条 `copilot:project:mcp-tools → .vscode/` 规则

- **影响**
  - 表述与精确事实出入，不影响功能

- **建议**
  - 单数化「the copilot project rule」/「copilot 项目规则」
  - 或保持复数表述（涵盖未来扩展可能性）

## 验证摘要

- `npm test` ✅（基于 R3 修复执行声明 850/850，本轮无新代码改动，未独立验证）
- `npm run lint:src` ✅（基于 R3 修复执行声明，未独立验证）
- `npm run build` ✅（基于 R3 修复执行声明 dist/index.js 135.54 KB，未独立验证）
- 三层并行审查 ✅（Blind Hunter 19 条 / Edge Case Hunter 13 条 / Acceptance Auditor 2 条主要发现 + 横向 2 条，均正常返回）
- 额外复核：
  - Round 3 修复执行清单 10 项中 7 项 ✅ 完整落地（ID-1, ID-2, ID-4, ID-6, ID-7, ID-8, ID-9, ID-10）
  - Round 3 ID-3 ⚠️ 部分通过（方案 B 仅增加 warn 未替换 completePhase，详见本轮 ID-3）
  - Round 3 ID-5 ⚠️ 文档侧修复但代码侧未同步（详见本轮 ID-1）

## 通过项

- AC #1-#5 完整满足（vscode 删除 + 19 条规则 + vscode-only warn + CHANGELOG/migration 双语 + version 2.0.0）
- AC #6 质量门禁通过（基于 R3 声明 850/850，无新代码改动）
- Round 3 ID-1（Flatten 守卫）/ ID-2（validateDestPathSecurity 前置）/ ID-4（toLocaleLowerCase 锁定）三项关键修复 ✅ 完整落地
- 历史 Round 1 / Round 2 / Round 3 CR TODO 项经本轮抽查**未恶化**
- `CLAUDE_INSTRUCTIONS_RESERVED_NAMES` 7 项保留名（claude.md / agents.md / settings.json / settings.local.json / claude.local.md / agents.local.md / .claudeignore）覆盖 Claude Code 核心 ASCII 配置文件
- 三种 InstallType（Files / Directories / Flatten）reserved-name 守卫 + validateDestPathSecurity 前置统一覆盖
- R3 ID-7 守卫范围注释（agents/ 不在保护）方向 B 已落地，与现有测试一致
- R3 ID-8 CHANGELOG NFR-C7 路径区分（~/.vscode/ home vs .vscode/ project）已落地
- R3 ID-9 reserved-skip warn 使用 absolute path（item.targetPath）已落地
- R3 ID-10 migration aiforge.json 去 vaporware 已落地

### 已知既有问题（defer，非本次改动引起 / 用户已决策不在本 Story 处理）

- **R2 ID-1 (d)(e)**：Directories 嵌套保留文件 + symlink basename 绕过 → 维持 CR TODO（P3），未恶化
- **R2 ID-2~10**：detectLegacyVscodeOnly 守卫不等价 / process.cwd() / Promise.all 单点失败 / reserved-skip 不更新 manifest / migration-v2 FAQ / mcp-tools 双写 / AC #5 version 断言 / install-rules.test.ts it title / CHANGELOG migration 步骤索引 → 维持 CR TODO（P3）
- **R3 ID-6**：copilot 检测路径方向 B → 用户裁决维持
- **R3 ID-7**：reserved-name 守卫仅覆盖 instructions 方向 B → 用户裁决维持
- **R1 全部 CR TODO**（mcp-tools 双规则 / cursor:global basename / pipeline.test.ts E2E / messages.ts 范围蔓延 / vscodeMergedNote 文案 / `--tools vscode` 手动模式 / 非目录辨别 / 测试硬编码 / dry-run filter 维度）维持

## 结论

- **结论：暂不通过 / 待评估** —— Round 3 ID-5 修复存在文档↔代码偏差（本轮 ID-1），属于 R3 修复未闭合；ID-3 方案 B 残留语义冲突；ID-2、ID-4 是审查层穷举到的潜在副作用
- **阻塞项**：无单点 [高] 阻塞；但 ID-1（vscodeMergedNote ② 项不一致）属于 R3 ID-5 未闭合修复，建议本轮一并修复以维护文档可信度
- **建议**：
  - **必修（评估阶段裁决）**：ID-1（messages.ts ② 项与 migration-v2 样例对齐）—— 闭合 R3 ID-5
  - **建议本轮一并**：ID-3（reserved-skip 与 completePhase 语义冲突，按 R3 评估推荐方向方案 A 替换文案）+ ID-4（ensureDir 污染空目录修复成本低）
  - **建议本轮一并（[低]）**：ID-6（detectLegacyVscodeOnly 高频噪声）+ ID-8（reservedSkippedSummary 文案明确范围）+ ID-9（Flatten 顺序）+ ID-14（README 复数表述）
  - **需用户裁决**：ID-5（Rule Document Registry 三文档同步） + ID-2（Unicode 同形是否在本 Story 处理或下放 CR TODO）+ ID-7（mkdir ~/.copilot/ 反模式是否本 Story 治理）
  - **可下放 CR TODO**：ID-10/11/12/13（诊断早返 / 测试 false-pass / 断言过弱 / dry-run 过滤）
  - 若本轮决定保守路径（仅修 ID-1 + ID-3 + ID-4），则下放 ID-2/5/6/7/8/9/10-14 至 CR TODO；否则建议至少修复 ID-1 + ID-3 + ID-4 后进入 Round 5 复审
