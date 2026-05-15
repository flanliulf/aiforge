---
Story: 7-1
Round: 6
Date: 2026-05-11
Model Used: Claude Opus 4.7 (claude-opus-4-7)
Review Source: 7-1-code-review-summary-20260512-round-6.md
Review Model: GPT-5.5 (github-copilot/gpt-5.5)
Type: Code Review Evaluation
---

## 评估总结

对 Story 7-1 的第 6 轮 CR 代码审查结果（复审）进行逐条评估。本轮审查共发现 4 条新问题（0 高 / 2 中 / 2 低），三层审查（Blind / Edge / Auditor）全部正常返回。Round 5 的 7 项评估决议全部进入修复：`vscodeMergedNote` 已恢复 Copilot 扩展指引、`detectLegacyVscodeOnly` 已收窄到 home 级、配置文档已移除 `vscode`、`.vscode/server.json` 端到端断言已补齐、`project-context.md` reserved-name 清单已完整、FAQ `--force` 措辞已澄清、3 份新增文档已进入 staged。

经逐条独立代码验证，**结论与原审查基本一致**：

- 发现 #1（migration 文档/CHANGELOG 检测机制表述矛盾）：`docs/migration-v2.md:51` / `.zh.md:51` 步骤 2 暗示 “安装扩展后 aiforge 自动检测 `~/.copilot/`”，但实际 Copilot 工具检测依赖 `~/.copilot/` 或 `.github/` marker，需手动 `mkdir`；`CHANGELOG.md:15` 同样错误归因为 “extension is detected”。**建议本轮修复（P2）**
- 发现 #2（AC #3 回归测试断言过弱）：`tests/stages/detect-tools.test.ts:482` 断言 `/Copilot/i` 不足以约束 “安装扩展” 指引；删除步骤 ② 仅保留 “Copilot 项目级规则” 仍可通过。**建议本轮修复（P2）**
- 发现 #3（`detectTools` 调用处注释残留旧语义）：`src/stages/detect-tools.ts:196-197` 仍写 “（或项目级 `.vscode/`）”，与函数注释 / 实现 / 测试不一致。**建议本轮一并修复（P3）**
- 发现 #4（staged 状态不完整）：`git diff --cached` 仅含 3 份新增 untracked 文件，R5 全部代码/测试/文档修复仍 unstaged。**建议本轮一并修复（P3 交付流程）**

**整体结论**：本轮无审查误报；4 项均为真实问题，修复成本均极低。强烈建议本轮一并闭合全部 4 项后进入 Round 7 快速复审。无 [高] 阻塞项，但 #1 / #2 涉及 AC #3 / AC #4 完整性，应作为 Story 7-1 完成前必修。

---

## 上轮问题回顾确认

### Round 5 / Finding #1（AC #3 回归：vscodeMergedNote 不含 “安装 Copilot 扩展”）：✅ 已修复

经代码独立验证：
- `src/core/messages.ts:538-543`（zh）vscodeMergedNote 现为 4 步结构，② 项明确为 “安装 GitHub Copilot 扩展”
- `src/core/messages.ts:826-831`（en）同样 4 步结构，② 项 “Install the GitHub Copilot extension”
- `docs/migration-v2.md:70-75` / `docs/migration-v2.zh.md:70-75` 警告样例同步为 4 步
- AC #3 文案契约已闭合；但**测试断言未跟上**（见本轮 #2）

### Round 5 / Finding #2（项目级 `.vscode/` 误触发 legacy 提示）：✅ 已修复

经代码独立验证：
- `src/stages/detect-tools.ts:95-101` `detectLegacyVscodeOnly` 已收窄为 `vscodeHomeExists && !copilotExists`
- `src/stages/detect-tools.ts:90-93` 函数注释已更新为 “仅检测 home 级 `~/.vscode/`，项目级 `.vscode/` 不触发”
- `tests/stages/detect-tools.test.ts:485-499` 新增 “R5 Fix #2：仅项目级 `.vscode/` 不输出提示” 反向断言
- 但**调用处注释（line 196-197）仍残留 “或项目级 `.vscode/`”**（见本轮 #3）

### Round 5 / Finding #3（配置文档 `vscode` 残留）：✅ 已修复

经代码独立验证：
- `docs/configuration.md:78` / `docs/configuration.zh.md:78` 已移除 `vscode` 并指向 v2.0 迁移指南
- AC #4 配置文档完整性已闭合

### Round 5 / Finding #4（`.vscode/` 集成测试缺失）：✅ 已修复

经代码独立验证：
- `tests/integration/pipeline.test.ts:958-960`（用户裁决方向 A）已新增 `.vscode/server.json` 存在性断言
- `_bmad-output/implementation-artifacts/cr-rules/cr-todo-backlog.md` 已新增 Story 7-10 “多工具矩阵端到端集成测试” 延伸 TODO
- AC #2 “生效” 最小端到端契约已闭合

### Round 5 / Finding #5（Rule Document Registry 同步不完整）：✅ 已修复

经代码独立验证：
- `_bmad-output/project-context.md:242` 已补齐 7 项保留名 + 三种 InstallType + `--force` 无效 + 黄色摘要语义
- 三份规则文档主体已 “互为镜像”

### Round 5 / Finding #6（migration FAQ `--force` 措辞）：✅ 已修复

经代码独立验证：
- `docs/migration-v2.md:104-106` / `docs/migration-v2.zh.md:103-105` 已澄清 `--force` 是跳过确认提示，并明确警告 “不要使用 `--force` 保留手写 `.vscode/mcp.json`”
- FAQ 误导风险已闭合

### Round 5 / Finding #7（新增文件未跟踪）：✅ 已修复 — 但引入本轮 #4 staged 不完整问题

经独立 `git diff --cached --name-status` 验证：
- `CHANGELOG.md` / `docs/migration-v2.md` / `docs/migration-v2.zh.md` 已为 `A`（staged）状态
- 7-7 之 untracked 闭合；但 R5 全部代码/测试/文档修复未一同 staged（见本轮 #4）

### 历史 CR TODO（非阻塞）

| # | 发现 | 状态 | 评估意见 |
|---|------|------|---------|
| R4-#2 | Unicode 同形字符与 NFC/NFD 规范化 | CR TODO（P3） | 维持，本轮无变化 |
| R4-#4 | 全 reserved-skip 时 `ensureDir` 创空目录 | CR TODO（P3） | 维持 |
| R4-#7 | `mkdir ~/.copilot/` 反模式 | CR TODO（P3） | 维持，长期重构 |
| R4-#9 | Flatten 守卫先于 `mainPath` 检查 | CR TODO（P3） | 维持 |
| R4-#10 | `diagnoseZeroResults` 早返被污染 | CR TODO（P3） | 维持 |
| R4-#12 | 聚合 warn 测试断言过弱 | CR TODO（P3） | 维持 |
| R4-#13 | dry-run `includes('.cursor')` 过滤 | CR TODO（P3） | 维持 |
| R5-#4 延伸 | Story 7-10 多工具矩阵端到端集成 | CR TODO（P3） | 维持，已纳入 7-10 |

---

## 发现 #1 评估

### 审查原文

> **[中][新] migration 文档与 CHANGELOG 仍暗示 “安装 Copilot 扩展后即可被检测”，与实际 marker 检测机制矛盾**
> - 来源：blind+auditor
> - 分类：patch

### 评估结论：✅ 确认有效 — 建议本轮修复（**P2 优先级**，闭合 AC #4 完整性）

### 评估分析

**问题描述准确性：准确**

经代码独立验证：
- `src/data/tool-registry.ts:11-16` Copilot 工具 `detect = { global: ['~/.copilot'], project: ['.github'] }` —— 检测路径而非扩展本身
- `docs/migration-v2.md:46-51` 步骤 2 “Install the GitHub Copilot Extension”：
  - `:51` “After installing, aiforge will detect `~/.copilot/` and activate the `copilot` rules”
  - 语义上把 “安装扩展” 与 “aiforge detect `~/.copilot/`” 因果连接，但**安装扩展不会自动创建 `~/.copilot/` marker**
- `docs/migration-v2.zh.md:46-51` 同样问题
- 同一文档 `:78-82` Note 块明确：`~/.copilot/` 是 aiforge 约定 marker，需用户手动 `mkdir -p ~/.copilot/`
- `CHANGELOG.md:15` “Activates only when GitHub Copilot extension is detected” —— 错误归因为 “extension is detected”，与实际 marker 检测机制不符

多来源审查命中（blind + auditor），代码侧证据完整，可信度高。

**严重性判断：合理（P2）**

理由：
1. 步骤 2 是 migration 指引主路径，先读步骤 2 → 跳到步骤 3 的用户路径很常见，可能跳过 Note 块
2. 跳过 Note 后用户只装扩展但未 `mkdir ~/.copilot/`，重跑 `aiforge install` 仍会触发 `NO_TOOLS` fatal 或 vscodeMergedNote 再次出现，造成 “明明按文档做了仍然失败” 的体验
3. CHANGELOG `extension is detected` 是发布级公开文档，严格意义上构成 AC #4 “Breaking Change 有完整文档依据” 的准确性缺口
4. 与 Round 5 #1 / #6 的 AC #3 修复一脉相承（消除迁移指引歧义），本轮是最后一公里
5. 修复成本极低：步骤 2 改 1-2 行 + CHANGELOG 改半行 + 双语同步

**修复建议：可行**

方案 A（推荐 — 步骤 2 改为两段）：
```md
### 2. Install the GitHub Copilot Extension and Create the `~/.copilot/` marker

If you previously used aiforge with VS Code and want to continue managing MCP configurations:

- **VS Code**: Install the [GitHub Copilot](...) extension
- **Then create the aiforge marker**: `mkdir -p ~/.copilot/`
  - This is an aiforge convention; the extension itself does not create this directory.
  - See the "Note on `~/.copilot/`" below for context.
- After both are in place, `aiforge install` will detect Copilot and apply the `.vscode/mcp.json` rule.
```

CHANGELOG `:15` 改为：
```md
- **Copilot project MCP rule** (`copilot:project:mcp-tools → .vscode/`): Inherits the
  VS Code project-level MCP configuration semantics. Activates when aiforge detects the
  Copilot context (via `~/.copilot/` marker or project `.github/`).
```

方案 B（最小路径）：仅在步骤 2 的 `:51` 添加一句 “(see Note below — you may need to `mkdir -p ~/.copilot/` for aiforge to detect Copilot)”，同时 CHANGELOG 同步澄清 —— 改动更小但不重构 heading 结构。

建议方案 A（修一次到位 + 与 Round 5 #1 文案对齐）。

**误报评估：非误报**

---

## 发现 #2 评估

### 审查原文

> **[中][新] AC #3 回归测试断言过弱，无法真正保护 “安装 Copilot 扩展” 文案**
> - 来源：auditor
> - 分类：patch

### 评估结论：✅ 确认有效 — 建议本轮修复（**P2 优先级**，闭合 AC #3 测试门禁）

### 评估分析

**问题描述准确性：准确**

经代码独立验证：
- `tests/stages/detect-tools.test.ts:481` 注释：「AC #3: 提示内容必须包含 "如何安装 GitHub Copilot 扩展"（防止文案回归）」
- `tests/stages/detect-tools.test.ts:482` 实际断言：`expect(String(vscodeMergedCall![0])).toMatch(/Copilot/i)`
- `src/core/messages.ts:538-543` 当前 ① “VS Code MCP 现由 Copilot 项目级规则承接”、② “安装 GitHub Copilot 扩展”、③ “创建 ~/.copilot/”、④ “现有 ~/.vscode/ 不会被覆盖”

**矛盾验证**：假设未来 ② 项被再次错误删除（如本 Story Round 4→5 之前的状态），文案仍含 “Copilot 项目级规则承接” —— `/Copilot/i` 仍命中 —— **测试通过**。注释声明的 “防止文案回归” 失效。

单来源审查（auditor），但断言代码本身可直接验证，结论唯一可信。

**严重性判断：合理（P2）**

理由：
1. 这是 R5 修复时新增的回归保护测试，但实际未达到保护目的
2. AC #3 是本 Story 最敏感的回归点（已发生过 R4→R5 一次回归），测试门禁必须有效
3. 修复成本极低（1 行断言改写）
4. 同步覆盖英文文案（增加 `setLanguage('en')` 场景）是可选增强

**修复建议：可行**

方案 A（推荐 — 强化默认中文断言 + 增加英文场景）：
```typescript
// AC #3: 提示内容必须包含 "如何安装 GitHub Copilot 扩展"（防止文案回归）
expect(String(vscodeMergedCall![0])).toContain('GitHub Copilot 扩展')

// 同时验证英文文案（额外覆盖）
setLanguage('en')
// ... 重新触发 detectTools ...
const enWarnCall = warnCalls2.find((call) => String(call[0]).includes('~/.vscode/'))
expect(String(enWarnCall![0])).toContain('Install the GitHub Copilot extension')
```

方案 B（最小路径）：仅改默认断言为 `expect(...).toContain('扩展')` 或 `.toMatch(/扩展|extension/i)`，不补英文场景。

建议方案 A。

**误报评估：非误报**

---

## 发现 #3 评估

### 审查原文

> **[低][新] `detectTools` 调用处注释仍残留 “或项目级 `.vscode/`” 旧语义**
> - 来源：blind+auditor
> - 分类：patch

### 评估结论：✅ 确认有效 — 建议本轮一并修复（**P3 优先级**）

### 评估分析

**问题描述准确性：准确**

经代码独立验证：
- `src/stages/detect-tools.ts:95-101` 实现：仅检测 home 级 `~/.vscode/` 与 `~/.copilot/`
- `src/stages/detect-tools.ts:90-93` 函数 JSDoc：「条件：~/.vscode/（home 级）存在且 ~/.copilot/ 不存在」 / 「注意：仅检测 home 级 ~/.vscode/，项目级 .vscode/ 不触发（AC #3 明文限定 home 路径）」
- `src/stages/detect-tools.ts:196-197` 调用处注释：「vscode-only 用户迁移提示（AC #3）：无论是否检测到其他工具，**只要 ~/.vscode/（或项目级 .vscode/）存在且 ~/.copilot/ 不存在**则输出提示」

调用处注释与函数注释 / 实现 / 测试三者均不一致。属注释维护遗漏。多来源（blind + auditor）命中，结论可信。

**严重性判断：合理（P3）**

理由：
1. 不影响运行行为或测试结果
2. 但是会误导未来维护者尝试 “恢复项目级 `.vscode/` 触发” —— 制造 R5 #2 再次回归的潜在路径
3. 修复成本接近 0（删除 “（或项目级 `.vscode/`）” 6 个字符）

**修复建议：可行**

方案 A（推荐）：
```typescript
// vscode-only 用户迁移提示（AC #3）：无论是否检测到其他工具，
// 只要 ~/.vscode/（home 级）存在且 ~/.copilot/ 不存在则输出提示
if (!detectedTools.includes('copilot') && (await detectLegacyVscodeOnly(pathResolver))) {
  reporter.warn(msg('detectTools.vscodeMergedNote'))
}
```

无其他可行方案；这是单一字面注释修正。

**误报评估：非误报**

---

## 发现 #4 评估

### 审查原文

> **[低][新] staged 状态仍不完整，若直接提交 staged 内容会遗漏 R5 代码/测试修复**
> - 来源：auditor
> - 分类：patch

### 评估结论：⚠️ 有效但属交付流程提醒 — 建议本轮一并修复（**P3 优先级**）

### 评估分析

**问题描述准确性：准确**

经独立 `git diff --cached --name-status` 与 `git diff --name-status` 验证：

`git diff --cached`（已 staged）：
```
A  CHANGELOG.md
A  docs/migration-v2.md
A  docs/migration-v2.zh.md
```

`git diff`（未 staged）包含 R5/R6 全部相关修复：
```
M  src/core/messages.ts
M  src/stages/detect-tools.ts
M  src/data/tool-registry.ts
M  src/data/install-rules.ts
M  src/stages/execute-install.ts
M  src/core/types.ts
M  src/core/reporter.ts
M  tests/stages/detect-tools.test.ts
M  tests/integration/pipeline.test.ts
M  tests/data/install-rules.test.ts
M  tests/data/tool-registry.test.ts
M  tests/stages/execute-install.test.ts
M  docs/configuration.md
M  docs/configuration.zh.md
M  docs/install-rules-matrix.md
M  docs/install-rules-matrix.zh.md
M  README.md
M  README.zh.md
M  _bmad-output/project-context.md
M  _bmad-output/planning-artifacts/architecture/03-core-decisions.md
M  _bmad-output/planning-artifacts/architecture/04-implementation-patterns.md
M  _bmad-output/implementation-artifacts/cr-rules/cr-todo-backlog.md
M  _bmad-output/implementation-artifacts/stories/7-1-vscode-merge-and-mvp-rules-completion.md
M  package.json
M  package-lock.json
...（其他历史 modified）
```

若直接 `git commit`（不再 `git add`），将仅提交 3 份迁移文档，遗漏 Story 7-1 全部代码 / 测试 / 配置文档 / 规则文档修复 → 复审结论与交付内容不一致，且后续 PR 会出现 “diff 文档说 R5 修了但代码没修” 的失配。

单来源审查（auditor），但 `git diff` 输出可直接验证，结论唯一可信。

**严重性判断：合理（P3）**

理由：
1. 这不是代码缺陷，是交付工作流问题
2. Story 7-1 status 仍为 `review`，正式 commit 在 Done 前进行 —— 严格意义上 “直接提交 staged” 的事件尚未发生
3. 但审查方提示的风险确实存在，且修复成本几乎为 0（一次 `git add` + 一次 staged 校验）
4. 与 R5 #7（untracked 新增文件）属同一类发布完整性，应一并完成 staging 一致化

**修复建议：可行**

方案 A（推荐）：
```bash
# 一次性 stage Story 7-1 全部相关修改
git add src/core/messages.ts src/stages/detect-tools.ts src/data/tool-registry.ts \
        src/data/install-rules.ts src/stages/execute-install.ts \
        src/core/types.ts src/core/reporter.ts \
        tests/stages/detect-tools.test.ts tests/integration/pipeline.test.ts \
        tests/data/install-rules.test.ts tests/data/tool-registry.test.ts \
        tests/stages/execute-install.test.ts \
        docs/configuration.md docs/configuration.zh.md \
        docs/install-rules-matrix.md docs/install-rules-matrix.zh.md \
        README.md README.zh.md \
        _bmad-output/project-context.md \
        _bmad-output/planning-artifacts/architecture/03-core-decisions.md \
        _bmad-output/planning-artifacts/architecture/04-implementation-patterns.md \
        _bmad-output/implementation-artifacts/cr-rules/cr-todo-backlog.md \
        _bmad-output/implementation-artifacts/stories/7-1-vscode-merge-and-mvp-rules-completion.md \
        package.json package-lock.json

git diff --cached --name-status   # 复核 staged 完整性
git status --short                # 确认无遗漏（无关 Story 的旧 M 项可保留 unstaged）
```

方案 B（分批提交）：将 Story 7-1 拆为多个原子 commit（如 “feat: vscode merge”、“test: AC #3 regression guards”、“docs: migration-v2”、“chore: rule registry sync”），每批均自洽 —— 适合需要 cherry-pick 的场景，成本中等。

建议方案 A（单批），与 Story 7-1 “Breaking Change v2.0 + MVP 规则补齐” 的原子语义一致。

**误报评估：非误报**

---

## 整体评估结论

### 需要修复（阻塞交付）

无 [高] 阻塞项。

### 建议本轮一并修复（非阻塞但成本极低且收益高）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | migration 文档/CHANGELOG 检测机制表述矛盾 | [中] | **P2** | 闭合 AC #4 完整性 + Round 5 #1 / #6 迁移指引一致性 |
| 2 | AC #3 回归测试断言过弱 | [中] | **P2** | 闭合 AC #3 测试门禁（R4→R5 已发生过一次回归） |
| 3 | `detectTools` 调用处注释残留旧语义 | [低] | **P3** | 避免维护者再次扩大触发面 |
| 4 | staged 状态不完整 | [低] | **P3** | 一次 `git add` 完成交付一致化 |

### 建议纳入 CR TODO 跟踪（非阻塞）

无新增。本轮 4 项均建议本轮闭合（修复成本极低）。

### 可忽略（误报）

无。本轮 4 项全部经代码 / git 状态独立验证为真实问题。

### 评估决定

- **发现 #1（migration/CHANGELOG 检测机制表述）**：**建议本轮（P2）** — 改 `docs/migration-v2.md:46-51` / `.zh.md:46-51` 步骤 2 heading 与说明，同步 `CHANGELOG.md:15`，从 “extension is detected” 改为 “Copilot context (via `~/.copilot/` marker or project `.github/`) is detected”
- **发现 #2（AC #3 测试断言过弱）**：**建议本轮（P2）** — `tests/stages/detect-tools.test.ts:482` 改为 `.toContain('GitHub Copilot 扩展')`；同步追加 `setLanguage('en')` 场景断言 `Install the GitHub Copilot extension`
- **发现 #3（调用处注释残留）**：**建议本轮（P3）** — `src/stages/detect-tools.ts:196-197` 删除 “（或项目级 `.vscode/`）” 描述，与函数注释 / 实现 / 测试三者对齐
- **发现 #4（staged 不完整）**：**建议本轮（P3）** — 在 Round 7 进入前执行 `git add` 完整 stage Story 7-1 相关修改；执行 `git diff --cached --name-status` 复核

### 复审判定

- **本轮新增阻塞项**：0 项（无 [高]，但 #1 / #2 强烈建议本轮闭合以稳固 AC #3 / AC #4）
- **R5 已修复项**：7 项完整落地（R5 #1～#7 全部经代码独立验证闭合）
- **R5 衍生收尾项**：本轮 #2（AC #3 测试断言收尾）、#3（注释收尾）、#4（staged 收尾） —— 三者均为 R5 修复未触及的边角
- **AC 满足度**：
  - AC #1（vscode 工具 ID 删除）：✅
  - AC #2（copilot/claude/cursor 新规则）：✅ 数据层 + 端到端断言均闭合
  - AC #3（vscode-only 提示）：✅ 文案与触发面已闭合；测试门禁待补强（本轮 #2）
  - AC #4（Breaking Change 文档依据）：⚠️ 配置文档 ✅；migration 步骤 2 + CHANGELOG :15 表述待修（本轮 #1）
  - AC #5（version 2.0.0）：✅
  - AC #6（质量门禁）：✅ Round 5 修复记录 852/852 测试通过 + lint:src + build 通过

- **建议复审路径**：
  - **路径 A（推荐）**：本轮一并修复 #1 + #2 + #3 + #4（4 项）→ 进入 Round 7 快速复审 → 通过即标记 Done
  - **路径 B（最小路径）**：仅修复 #1 + #2（闭合 AC #3 / AC #4 契约）+ #4（交付一致化）；#3 下放 CR TODO → 进入 Round 7
  - **路径 C（直接通过）**：可考虑 — 4 项均为 [中/低] 非阻塞；如发布时间窗紧迫且团队接受 “文档微缺口 + 测试门禁弱” 风险，可标记 Done 并将 #1 / #2 / #3 转为 CR TODO，本轮 #4 在提交前必须执行（否则提交不完整）

**强烈推荐路径 A**：4 项总修复量约 15 行代码 + 文档改动 + 一次 `git add`，能完整闭合 Story 7-1 全部 AC 与交付一致化；同时维持 Story 7-1 “干净通过” 的纪录，避免遗留 CR TODO 影响后续 Epic 7 推进节奏。

## 修复执行记录

### 修复执行记录
- **Date**: 2026-05-12
- **Model Used**: Claude Sonnet 4.6 (claude-sonnet-4-6)
- **Fix Items**: 4

#### #1（P2）：migration 文档/CHANGELOG 检测机制表述矛盾

- **文件**：`docs/migration-v2.md`、`docs/migration-v2.zh.md`、`CHANGELOG.md`
- **修复内容**：
  - `migration-v2.md` 步骤 2 heading 改为 "Install the GitHub Copilot Extension and Create the `~/.copilot/` Marker"；说明中新增独立 bullet 点 "Then create the aiforge marker directory: `mkdir -p ~/.copilot/`"，并明确标注 "the extension itself does **not** automatically create this directory"
  - `migration-v2.zh.md` 同步：heading 改为 "安装 GitHub Copilot 扩展并创建 `~/.copilot/` 标识目录"，补充 "`mkdir -p ~/.copilot/`" 步骤及 "扩展本身不会自动创建此目录" 说明
  - `CHANGELOG.md:15`：`Activates only when GitHub Copilot extension is detected` → `Activates when aiforge detects the Copilot context (via \`~/.copilot/\` marker or project \`.github/\`)`
- **结果**：✅ 修复成功

#### #2（P2）：AC #3 回归测试断言过弱

- **文件**：`tests/stages/detect-tools.test.ts`
- **修复内容**：
  - `:482` 改为 `expect(String(vscodeMergedCall![0])).toContain('GitHub Copilot 扩展')`（从弱正则 `/Copilot/i` 升级为精确字符串断言，确保 ② 项文案删除即失败）
  - 新增 `R6 Fix #2` it block：`setLanguage('en')` 场景下断言 `toContain('Install the GitHub Copilot extension')`，覆盖英文文案门禁（同时 mock `~/.claude/` 防止 NO_TOOLS）
  - Prettier 格式化后全量测试通过
- **结果**：✅ 修复成功（853 tests passed）

#### #3（P3）：detect-tools.ts 调用处注释残留旧语义

- **文件**：`src/stages/detect-tools.ts`
- **修复内容**：`:196-197` 注释 "（或项目级 `.vscode/`）" → "（home 级）"，与函数 JSDoc / 实现 / 测试三者对齐
- **结果**：✅ 修复成功

#### #4（P3）：staged 状态不完整

- **操作**：`git add` Story 7-1 全部相关修改（28 文件：3 个新增 + 25 个修改）
- **复核**：`git diff --cached --name-status` 输出 28 行，含全部 src/tests/docs/规则文档修改，无 Story 7-1 遗漏
- **结果**：✅ 修复成功

### 质量门控结果

```
Tests:  853 passed (33 files)
Lint:   All matched files use Prettier code style ✅
Build:  dist/index.js 136.10 KB, Build success ✅
Staged: 28 files (3 Added + 25 Modified), Story 7-1 交付范围完整 ✅
```
