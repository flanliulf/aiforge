---
Story: 7-1
Round: 3
Date: 2026-05-11
Model Used: Claude Opus 4.7 (claude-opus-4-7)
Type: Code Review Summary
---

## 审查结论

本轮为复审（Round 3）。三层并行审查（Blind Hunter / Edge Case Hunter / Acceptance Auditor）全部正常返回。Round 2 评估文件「修复执行记录」中的 3 项 ID-1 (a)/(b)/(c) 在本轮复审中均被观察到对应实现，但 **ID-1 (a)「Files/Directories/Flatten 三种 InstallType 统一守卫」声明与实际代码存在覆盖偏差**：实测守卫位于 `else` 分支（Files + Directories），Flatten 分支内部无守卫，代码注释甚至明确写为「Files + Directories 共享前置守卫」，与 R2 修复声明矛盾。质量门禁全部通过：`npm test` 848/848、`npm run lint:src` ✅、`npm run build` ✅（134.20 KB / 17ms）。

本轮新发现 0 处 [高] 阻塞项 + 7 处 [中] 新问题（Flatten 覆盖偏差、reserved-skip 跳过 validateDestPathSecurity 安全校验链、reserved-skip 让 completePhase 误导用户、toLowerCase Turkish locale 风险、migration 文档承诺与 Copilot 实际行为不符、`~/.copilot/` 检测路径与实际安装位置不符、reserved-name 保护范围未覆盖 claude:agents）+ 3 处 [低] 新问题（CHANGELOG 叙述歧义、reserved-skip 消息路径不一致、vaporware 表述）。

**关键观察**：本轮新发现 [中] 多为「修复引入的边界 / 文档与代码事实不符」问题，无单点阻塞性缺陷；可由评估阶段决定是否在本轮内一并修复或下放 CR TODO。其中 **ID-2（safety bypass）** 和 **ID-3（用户感知误导）** 属于修复回退风险，建议优先评估；**ID-5 + ID-6（migration 文档与 detect 路径与 Copilot 实际行为不符）** 暴露了一条更深层的"Copilot 实际安装位置识别"问题，可能需要单独 Story 治理。

**建议：通过/暂不通过 由评估阶段裁决**。本轮无单点 [高] 阻塞项，技术实现层 Round 2 修复成立；但若需保持 spec/code 严格一致或修复 NFR-S5 早返回绕过，则需追加 patch。

## 上轮问题回顾

### 已修复

1. Round 2 / Finding #1 (b) — CLAUDE_INSTRUCTIONS_RESERVED_NAMES 大小写不敏感
   - 修复位置：`src/stages/execute-install.ts:165-173` 常量改为全小写 Set；line 549 改用 `basename(srcPath).toLowerCase()` 与 Set 比较
   - 验证结果：✅ 5 组大小写变体测试（`tests/stages/execute-install.test.ts:1880-1903`）覆盖；本轮 ID-4 揭示 Turkish locale 边界问题，建议追加

2. Round 2 / Finding #1 (c) — 保留名清单扩展为 7 项
   - 修复位置：`src/stages/execute-install.ts:165-173` Set 大小 7 项（`claude.md` / `agents.md` / `settings.json` / `settings.local.json` / `claude.local.md` / `agents.local.md` / `.claudeignore`）；`tests/stages/execute-install.test.ts:1771-1779` `RESERVED_NAMES` 数组同步
   - 验证结果：✅ 已落地，与 spec 完全一致

3. Round 2 / Finding #1 (a) — reserved-name 守卫前置化（声明：覆盖 Files / Directories / Flatten 三种 InstallType）
   - 修复位置：`src/stages/execute-install.ts:544-568` 守卫从 Files 分支内移至 for-of 循环顶部
   - 验证结果：**⚠️ 部分通过** — 代码实际位于 `else` 分支（覆盖 Files + Directories），Flatten 分支内部 (line 437-538) 无守卫；代码注释写为「Files + Directories 共享前置守卫」与 R2 修复声明矛盾（详见本轮 ID-1）

### 仍为非阻塞待办（CR TODO）

经审查，以下 Round 1 / Round 2 CR TODO 项在本轮**未被恶化**：

1. Round 2 / Finding #1 (d) — Directories 嵌套保留名 → 维持 CR TODO（P3，详见本轮 ID-11）
2. Round 2 / Finding #1 (e) — symlink basename 绕过 → 维持 CR TODO（P3，详见本轮 ID-11）
3. Round 2 / Finding #2 — detectLegacyVscodeOnly 守卫不等价 → 维持 CR TODO（P3）
4. Round 2 / Finding #3 — process.cwd() 直接调用 → 维持 CR TODO（P3，与既有 detectSingleTool 模式一致）
5. Round 2 / Finding #4 — Promise.all 单点失败阻塞 → 维持 CR TODO（P3）
6. Round 2 / Finding #5 — reserved-skip 不更新 manifest → 维持 CR TODO（P3）
7. Round 2 / Finding #6 — migration-v2 FAQ 触发条件信息缺口 → 维持 CR TODO（P3）
8. Round 2 / Finding #7 — mcp-tools 双写文档说明缺失 → 维持 CR TODO（P3，合并 R1-#3）
9. Round 2 / Finding #8 — AC #5 version 测试断言缺失 → 维持 CR TODO（P3）
10. Round 2 / Finding #9 — install-rules.test.ts it title 同步遗漏 → 维持 CR TODO（P3）
11. Round 2 / Finding #10 — CHANGELOG migration 步骤索引摘要 → 维持 CR TODO（P3）
12. Round 1 / Finding #3 — copilot:project:mcp-tools 同源双规则 → 维持 CR TODO（合并 R2-#7）
13. Round 1 / Finding #4 — cursor:global agents/skills basename 冲突 → 维持 CR TODO
14. Round 1 / Finding #8 — pipeline.test.ts E2E 后置 Story 7-10 → 维持 CR TODO
15. Round 1 / Finding #10 — messages.ts / stages 范围蔓延 → 用户已决策，详见本轮 ID-12
16. Round 1 / Finding #11 — vscodeMergedNote 文案歧义 → 维持 CR TODO（本轮 Blind#20 重叠）
17. Round 1 / Finding #12 — `--tools vscode` 手动模式 → 维持 CR TODO（本轮 Edge#5 重叠）
18. Round 1 / Finding #13（非目录） — detectLegacyVscodeOnly 非目录辨别 → 维持 CR TODO
19. Round 1 / Finding #14 — 测试硬编码绝对路径 → 维持 CR TODO
20. Round 1 / Finding #18 — dry-run filter 维度 → 维持 CR TODO

## 新发现

### 1. [中][新] Round 2 ID-1 (a) 「Files/Directories/Flatten 三种 InstallType 统一守卫」声明与实现存在 Flatten 分支覆盖偏差

- **来源**：blind+edge+auditor
- **分类**：patch

- **证据**
  - `src/stages/execute-install.ts:437-538` `if (item.rule.type === InstallType.Flatten) { ... }` 分支内部**无 reserved-name 守卫**
  - `src/stages/execute-install.ts:544-545` 代码注释明确写「Files + Directories 共享前置守卫」
  - Round 2 评估文件「修复执行记录」声明覆盖 Files / Directories / Flatten 三种 InstallType
  - 当前 BUILTIN_RULES 中无 `claude:instructions:Flatten` 规则（业务路径未触发）

- **影响**
  - spec 声明与代码实现一致性破坏
  - 未来若引入 Flatten 类型的 claude:instructions 规则，保护立即失效
  - 代码注释与 R2 修复声明矛盾，维护者阅读时易困惑

- **建议**
  - 方案 A：在 `Flatten` 分支内对每个 `srcFilePath` 加同样的 `basename(srcFilePath).toLowerCase()` 检查（与 R2 ID-1 (a) 声明完全一致）
  - 方案 B：修订 R2 修复声明为「覆盖 Files + Directories 两种类型；当前无 Flatten 业务路径」并同步修订代码注释，使两者一致
  - 建议选方案 A 以保持防御性编程一致性

### 2. [中][新] reserved-name 命中后 continue 早返回，跳过 `validateDestPathSecurity(destPath, allowedRoot)` 安全校验

- **来源**：blind
- **分类**：patch

- **证据**
  - `src/stages/execute-install.ts:546-568` reserved-name 命中后立即 `continue`
  - Files / Directories 分支内的 `validateDestPathSecurity(destPath, allowedRoot)` 调用在 continue 之后，被跳过
  - 这是 NFR-S5（路径穿越保护）的早期警报点

- **影响**
  - 若源仓库中存在 `../CLAUDE.md` 等路径穿越载荷且 basename 命中保留名，会先 push 到 resultItems 再 continue，绕过早期安全警报
  - 攻击者可借此试探目标系统是否启用 reserved-name 保护
  - 未来若保留名检查策略放宽，可能演化为真实漏洞

- **建议**
  - 在 reserved-skip 早返回之前，先对 destPath 调用 `validateDestPathSecurity(destPath, allowedRoot)`——若校验失败则按 path-traversal 错误处理而非简单 skip
  - 或将 reserved-name 检查移至 Files / Directories 分支内的 validateDestPathSecurity 之后

### 3. [中][新] reserved-skip 让 `resultItems.length>0`，触发 completePhase「全部已是最新或被跳过」摘要，对用户隐藏拦截事实

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - reserved-name 命中后 push `{status: 'skipped'}` 到 resultItems
  - `src/stages/execute-install.ts:724-731` 在 `hasActualInstall === false && resultItems.length > 0` 时走 `completePhase('全部已是最新或被跳过')`

- **影响**
  - 「被硬保护拒绝写入」与「文件已经最新」被混为一谈
  - 用户使用 `--force` 期望覆盖时也得不到额外提示（hard-protected 不响应 --force）
  - 拦截事实被掩盖，用户可能反复尝试或误认为安装成功

- **建议**
  - completePhase 摘要中区分 `skippedDueToReserved` 与 `alreadyUpToDate`
  - 若 resultItems 中含 reserved-skip 项，输出额外 reporter.warn：「N 个保留文件因 v2.0 reserved-name 保护被拒绝写入，--force 也无法覆盖。如需更新这些文件，请手动维护源目录之外的内容。」

### 4. [中][新] toLowerCase() 在 Turkish 等特殊 locale 下可能将 `I`/`İ` 误转，导致 reserved-name 大小写比较失效

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `src/stages/execute-install.ts:549` `basename(srcPath).toLowerCase()`
  - JavaScript `toLowerCase()` 受运行时 locale 影响：Turkish locale 下 `I` → `ı`、`İ` → `i̇`
  - Set 中常量为 `claude.md`（ASCII `i`），与 Turkish locale 下 `CLAUDE.MD` 转换后的 `claude.md`（含或不含 dotless）可能不匹配

- **影响**
  - 土耳其 / 阿塞拜疆等 locale 用户的 `CLAUDE.MD` 大小写变体可能绕过守卫
  - 测试未覆盖 i18n locale 维度

- **建议**
  - 改用 `basename(srcPath).toLocaleLowerCase('en-US')` 锁定 locale
  - 或使用显式 ASCII 转换（仅处理 [A-Z] → [a-z]）
  - 补 i18n locale 测试：`Intl.Collator('tr').compare(...)` 或 mock `process.env.LANG = 'tr_TR.UTF-8'`

### 5. [中][新] migration 文档承诺「安装 Copilot 扩展后重新执行 aiforge install」会让 `~/.copilot/` 出现，与实际 Copilot 行为不符

- **来源**：blind
- **分类**：patch

- **证据**
  - `docs/migration-v2.md` FAQ：「Install the GitHub Copilot extension and re-run `aiforge install`」
  - GitHub Copilot 扩展实际**不会创建 `~/.copilot/` 目录**——配置存储在 `~/.vscode/extensions/github.copilot-*/` 或 IDE-specific 路径下
  - 用户按文档操作后 detect 仍 miss copilot，vscodeMergedNote 仍触发

- **影响**
  - 「文档承诺解决方案 → 用户操作 → 现象未消除」死循环
  - 严重损害文档可信度（用户首次接触 migration 文档时即被误导）
  - 与 ID-6 互为因果

- **建议**
  - migration 文档需校准 Copilot 实际配置路径与 aiforge 检测路径的关系
  - 短期方案：FAQ 增加澄清「aiforge 检测的 `~/.copilot/` 是 aiforge 自身约定的标志路径；如未存在，可手动创建 `~/.copilot/` 作为占位（如 `mkdir -p ~/.copilot`）以绕过检测」
  - 长期方案：与 ID-6 一并修复 copilot 检测路径

### 6. [中][新][决策] detectLegacyVscodeOnly 与 TOOL_DEFINITIONS 中 copilot 检测路径 `~/.copilot/` 都与 Copilot 实际安装位置不符

- **来源**：blind
- **分类**：decision_needed

- **证据**
  - `src/data/tool-registry.ts` copilot 的 `detect.global` 为 `~/.copilot`
  - `src/stages/detect-tools.ts:94-102` detectLegacyVscodeOnly 也以 `~/.copilot` 作为 copilot 是否存在的唯一判定
  - GitHub Copilot 扩展通常位于 `~/.vscode/extensions/github.copilot-*`，与 `~/.config/github-copilot/` 或 `~/Library/Application Support/Code/User/...`

- **影响**
  - 已安装 Copilot 的真实用户大概率仍被 detect 视为「未检测到 copilot」，触发 vscodeMergedNote 误导
  - ID-5 的文档承诺死循环本质源于此
  - 影响 AC #3 的实际有效性

- **建议**
  - **需用户裁决**：是否在本 Story 内修正 copilot 检测路径
    - 方向 A：扩展 TOOL_DEFINITIONS.copilot.detect 支持多路径（如 `[~/.copilot, ~/.vscode/extensions/github.copilot-*, ~/.config/github-copilot]`）
    - 方向 B：保持当前路径（aiforge 约定值），在 migration 文档中明确「`~/.copilot/` 是 aiforge 内部标识，与 GitHub Copilot 扩展位置无关」
    - 方向 C：推迟到 Story 7-2 或专项 Story 治理
  - 当前 PR 与 Round 1/2 决策默认保持原路径（含 Round 1 ID-5 评估对此点未做调整），但本轮明确该选择对 AC #3 的可用性影响

### 7. [中][新][决策] reserved-name 保护仅覆盖 `claude:instructions`，未保护 `claude:agents` 写入 `.claude/agents/CLAUDE.md` 等场景

- **来源**：blind
- **分类**：decision_needed

- **证据**
  - `src/stages/execute-install.ts:546-555` 守卫条件限定 `item.rule.tool === 'claude' && item.rule.sourceDir === 'instructions'`
  - 同 Story 新增 `claude:global:agents` / `claude:project:agents` 也写入 `.claude/agents/`
  - 测试 `tests/stages/execute-install.test.ts:1840-1860` `it('non-claude-instructions rules can install CLAUDE.md')` 明确允许 `agents/CLAUDE.md` 被复制

- **影响**
  - 若用户在 `agents/` 目录中放入 `CLAUDE.md`，会被无保护复制到 `.claude/agents/CLAUDE.md`
  - 这与 Round 1 ID-5 修复目标「保护 Claude 最高优先级配置」存在张力
  - `.claude/agents/CLAUDE.md` 是否属于 Claude Code 关注的高优先级配置需用户裁决

- **建议**
  - **需用户裁决**：
    - 方向 A：扩展守卫到所有 `claude:*` 规则（`item.rule.tool === 'claude'` 单独条件，去掉 sourceDir 限定）
    - 方向 B：保持当前守卫范围，明确「reserved-name 保护仅针对 instructions 源目录文件名」并在文档中说明
    - 方向 C：维持现状，纳入 CR TODO 在后续 Story 治理
  - 当前测试已显式允许 agents/CLAUDE.md 路径，方向 B 与现状一致

### 8. [低][新] CHANGELOG 「Existing ~/.vscode/ files NOT modified」叙述与新规则 `copilot:project:mcp-tools → .vscode/` 写入项目根 `.vscode/` 存在歧义

- **来源**：blind
- **分类**：patch

- **证据**
  - `CHANGELOG.md` v2.0.0 BREAKING CHANGES 段落「Existing `~/.vscode/` files are NOT modified (NFR-C7 compliance)」
  - 新规则 `copilot:project:mcp-tools → .vscode/` 写入项目根 `.vscode/`（NOT `~/.vscode/`）

- **影响**
  - 用户可能误以为 v2.0 不会写入任何 `.vscode/` 路径
  - 与 R2 ID-7 双写文档说明缺失相关，加剧理解负担

- **建议**
  - CHANGELOG 改为「Existing files under user's home directory `~/.vscode/` are NOT modified (NFR-C7 compliance). Note: project-level `.vscode/` will receive mcp-tools writes via copilot project-scope rules when GitHub Copilot is detected.」
  - 中英双语同步

### 9. [低][新] claudeInstructionsReservedSkip 警告消息使用 `{targetDir}` 渲染模板路径，与 resultItem 的 `targetGroupPath`（绝对路径）不一致

- **来源**：blind+auditor
- **分类**：patch

- **证据**
  - `src/stages/execute-install.ts:551-555` reporter.warn 中使用 `item.rule.targetDir`（值如 `~/.claude/` 模板路径）
  - 同函数 push 到 resultItems 时使用 `item.targetPath`（pathResolver 解析后的绝对路径）

- **影响**
  - reporter 警告显示模板路径，最终 result 展示绝对路径，用户调试时困惑「实际是哪个目录被保护？」

- **建议**
  - 统一使用 `item.targetPath` 渲染 warning（用户友好的绝对路径）
  - 或在 reporter 文案中同时呈现模板路径与解析后路径

### 10. [低][新] migration 文档 vaporware：「aiforge.json planned for a future release」无 issue 链接或里程碑

- **来源**：blind
- **分类**：patch

- **证据**
  - `docs/migration-v2.md` 提到 per-project overrides via `aiforge.json` 是「planned for a future release」
  - 无 GitHub issue 链接、Story 编号或里程碑

- **影响**
  - 违背项目 CLAUDE.md 顶部「不假设不猜测」承诺
  - 若该功能从未实现，将留下虚假承诺
  - 用户期望与实际可获能力之间产生偏差

- **建议**
  - 替换为「无具体计划，如有需求请提 issue: https://github.com/.../issues」或加上对应 GitHub issue/Story 链接
  - 中英双语同步

## 验证摘要

- `npm test` ✅（848 / 848，33 test files all passed，duration 1.81s）—— 与 Round 2 评估声明完全一致（848），无回归
- `npm run lint:src` ✅（eslint + prettier 全部通过）
- `npm run build` ✅（ESM 134.20 KB / 17ms，DTS 805ms）
- 三层并行审查 ✅（Blind Hunter / Edge Case Hunter / Acceptance Auditor 均正常返回）
- 额外复核：
  - Round 2 已修复项 ID-1 (b) 大小写不敏感 ✅、ID-1 (c) 保留名清单 7 项 ✅
  - Round 2 ID-1 (a) 守卫前置化 ⚠️ 部分通过（Flatten 分支未覆盖，详见本轮 ID-1）

## 通过项

- Round 2 ID-1 (b) 与 ID-1 (c) 完整落地，未发现回归
- AC #1-#5 完整满足（vscode 删除 + 19 条规则 + vscode-only warn + CHANGELOG/migration 双语 + version 2.0.0）
- AC #6 质量门禁全部通过（npm test/lint/build 全绿，848/848）
- 历史 Round 1 / Round 2 全部 CR TODO 项经本轮抽查**未恶化**，与上轮决策一致
- `CLAUDE_INSTRUCTIONS_RESERVED_NAMES` 7 项保留名（claude.md / agents.md / settings.json / settings.local.json / claude.local.md / agents.local.md / .claudeignore）覆盖 Claude Code 核心配置文件
- 大小写不敏感比较与 5 组测试覆盖（claude.md / Claude.MD / CLAUDE.MD / Settings.JSON / .ClaudeIgnore）

### 已知既有问题（defer，非本次改动引起 / 用户已决策不在本 Story 处理）

- **ID-11** — Round 2 ID-1 (d)/(e)：Directories 嵌套保留文件 + symlink basename 绕过 → 维持 R2 CR TODO（P3），未恶化
- **ID-12** — Round 1 ID-10 / Round 2 ID-12 范围蔓延延伸：execute-install reporter UX 重构内部多项缺陷（`formatInstallProgress` replace 省略号、`summarizeDiagnosticValues` 单次 replace、INSTALL_PROGRESS_MILESTONES/DETAIL_THRESHOLD 命名歧义、Directories 模式进度跳跃、`totalFiles` 极端值防御、`targetGroupLabel` 测试覆盖单一、values join 逗号歧义）→ 用户已决策不在本 Story 处理，维持现状
- **ID-13** — Round 1 各项 CR TODO 维持（R1-#3 mcp-tools 双规则计数 / R1-#4 cursor:global basename / R1-#8 E2E 后置 / R1-#11 vscodeMergedNote 文案 / R1-#12 --tools vscode / R1-#13 非目录辨别 / R1-#14 测试硬编码 / R1-#18 dry-run filter 维度）

## 结论

- **结论：暂不通过 / 待评估** —— Round 2 ID-1 (a) 实现与声明存在 Flatten 覆盖偏差（ID-1），叠加本轮新发现 ID-2（NFR-S5 早返回绕过）+ ID-3（completePhase 误导用户）+ ID-4（Turkish locale 风险），是否阻塞需评估
- **阻塞项**：无单点 [高] 阻塞；但 ID-1 / ID-2 / ID-3 三条建议在本轮内合并修复以闭合 R2 ID-1 (a)「Files/Directories/Flatten 三种 InstallType 统一守卫」承诺并修复 NFR-S5 早返回
- **建议**：
  - **必修（评估阶段裁决）**：ID-1（spec/code 一致性）+ ID-2（NFR-S5 早返回）+ ID-3（completePhase 误导）—— 三者代码改动量小且联动
  - **建议本轮一并**：ID-4（Turkish locale）+ ID-5（migration 文档承诺与 Copilot 实际行为）+ ID-8（CHANGELOG NFR-C7 路径范围）+ ID-9（reserved-skip 路径不一致）+ ID-10（vaporware 表述）
  - **需用户裁决**：ID-6（copilot 检测路径方向 A/B/C）+ ID-7（reserved-name 守卫是否扩展到 `claude:*` 全部规则）
  - **可下放 CR TODO**：本轮无新引入需下放项；R2 ID-1 (d)(e) + R1 全部 CR TODO 维持
  - 若本轮决定全部 [中] 项下放 CR TODO，则本轮可直接通过；否则建议至少修复 ID-1 + ID-2 + ID-3 后进入 Round 4 复审
