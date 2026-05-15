---
Story: 7-1
Round: 7
Date: 2026-05-12
Model Used: Claude Opus 4.7 (claude-opus-4-7)
Review Source: 7-1-code-review-summary-20260512-round-7.md
Review Model: GPT-5.5 (github-copilot/gpt-5.5)
Type: Code Review Evaluation
---

## 评估总结

对 Story 7-1 的第 7 轮 CR 代码审查结果（复审）进行逐条评估。本轮审查共发现 3 条新问题（0 高 / 2 中 / 1 低），三层审查（Blind / Edge / Auditor）全部正常返回，无审查层失败。Round 6 的 4 项修复主体（migration 主步骤 marker 说明、CHANGELOG Copilot context 检测口径、AC #3 中英文测试断言、`detectTools` 调用处注释清理、staged 完整性）经代码验证已全部闭合。

经逐条独立代码验证，**结论与原审查完全一致**：

- 发现 #1（migration 文档 Copilot 检测/warning 触发条件残留不准确表述）：`docs/migration-v2.md:62` 与 `.zh.md:62` 仍写 “detect GitHub Copilot (if installed)”，未点明检测路径为 `~/.copilot/` marker 或项目 `.github/`；`migration-v2.md:70` / `.zh.md:70` warning 条件描述与 `src/stages/detect-tools.ts:196-199` 实际 `!detectedTools.includes('copilot') && detectLegacyVscodeOnly()` 逻辑存在间隙（项目 `.github/` 存在场景）。**建议本轮修复（P2）**
- 发现 #2（`.vscode/mcp.json` 文档/规格与 Files 复制实现/测试三方不一致）：Story `7-1-vscode-merge-and-mvp-rules-completion.md:20-22` AC #1/#2 与 `docs/migration-v2.md:29/75/107-115` 写 `.vscode/mcp.json`，但 `src/data/install-rules.ts:76` 为 `Files` + `targetDir: '.vscode/'`，fixture `tests/fixtures/sample-repo/mcp-tools/server.json`，集成测试 `tests/integration/pipeline.test.ts:958-960` 断言 `.vscode/server.json`，文件名沿用源文件名。**需要产品/规格裁决（P2 decision_needed）**
- 发现 #3（英文语言切换测试未使用 finally/afterEach 恢复语言）：`tests/stages/detect-tools.test.ts` 仅有 `beforeEach`（line 92），无文件级 `afterEach`，两处 `setLanguage('en')`（line 386、503）依赖测试末尾手动 `setLanguage('zh-CN')`，断言失败时存在污染后续测试的风险。**建议本轮一并修复（P3）**

**整体结论**：本轮无审查误报；3 项均为真实问题。发现 #1 和 #2 涉及 AC #4 migration 指引精确性和 AC #2 交付契约准确性，应作为 Story 7-1 完成前必修；发现 #3 修复成本极低，建议本轮一并闭合。无 [高] 阻塞项，但建议本轮修复后进入 Round 8 快速复审。

---

## 上轮问题回顾确认

### Round 6 / Finding #1（migration 文档与 CHANGELOG 暗示"安装 Copilot 扩展后即可被检测"）：✅ 主路径已修复

经代码独立验证：
- `docs/migration-v2.md:46-54` / `docs/migration-v2.zh.md:46-54` 已新增"安装扩展 + 创建 `~/.copilot/` marker"双步骤，明确扩展不会自动创建 marker
- `docs/migration-v2.md:52-53` / `.zh.md:52-53` 明确写 "the extension itself does **not** automatically create this directory" / "扩展本身**不会**自动创建此目录"
- `CHANGELOG.md:15` 已改为 "aiforge detects the Copilot context (via `~/.copilot/` marker or project `.github/`)"
- 但主路径以外的措辞仍有残留（见本轮 #1）

### Round 6 / Finding #2（AC #3 回归测试断言过弱）：✅ 已修复

经代码独立验证：
- `tests/stages/detect-tools.test.ts:482` 已改为 `expect(String(vscodeMergedCall![0])).toContain('GitHub Copilot 扩展')`，精确字符串断言
- `tests/stages/detect-tools.test.ts:502-518` 已新增英文模式测试，断言包含 `'Install the GitHub Copilot extension'`
- AC #3 中英文文案门禁已闭合
- 仅遗留测试语言状态清理健壮性问题（见本轮 #3）

### Round 6 / Finding #3（`detectTools` 调用处注释残留"或项目级 `.vscode/`"）：✅ 已修复

经代码独立验证：
- `src/stages/detect-tools.ts:196-197` 已改为 `// vscode-only 用户迁移提示（AC #3）：无论是否检测到其他工具，` / `// 只要 ~/.vscode/（home 级）存在且 ~/.copilot/ 不存在则输出提示`
- 注释与 `detectLegacyVscodeOnly` 函数语义（仅 home 级）和测试（`R5 Fix #2: 仅项目级 .vscode/ 不输出`）一致

### Round 6 / Finding #4（staged 状态不完整）：✅ 已修复

经代码独立验证：
- `git status` 显示 `M  CHANGELOG.md`、`M  src/stages/detect-tools.ts`、`M  tests/stages/detect-tools.test.ts`、`A  docs/migration-v2.md`、`A  docs/migration-v2.zh.md` 等 Story 7-1 相关核心文件均为 staged（大写 M/A，表示 index 中已 staged）
- Story 7-1 交付文件 staged 完整性已闭合

### 历史 CR TODO（非阻塞）

| # | 发现 | 状态 | 评估意见 |
|---|------|------|---------|
| R4-#2 | Unicode 同形字符与 NFC/NFD 规范化风险 | CR TODO / 非阻塞 | 同意维持，本轮不修复 |
| R4-#4 | 全部 reserved-skip 时 `ensureDir(item.targetPath)` 仍可能创建空目录 | CR TODO / 非阻塞 | 同意维持，本轮不修复 |
| R5-#4 延伸 | Story 7-10 补全多工具矩阵端到端集成测试 | Story 7-10 延伸项 | 同意维持，已在 7-10 范围 |

---

## 发现 #1 评估

### 审查原文

> **[中][新] migration 文档对 Copilot 检测与 warning 触发条件仍不完全准确**
> - 来源：edge+auditor
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P2 优先级）

### 评估分析

**问题描述准确性：准确**

经代码独立验证：

1. **`docs/migration-v2.md:62` / `.zh.md:62` 表述模糊**：
   - 英文：`aiforge will now detect GitHub Copilot (if installed) and apply the updated rules.`
   - 中文：`aiforge 现在会检测 GitHub Copilot（如已安装）并应用更新后的规则。`
   - 该句没有点明 "detect" 的具体路径，与 `CHANGELOG.md:15` "detects the Copilot context (via `~/.copilot/` marker or project `.github/`)" 的精确表述不一致，且暗示"已安装扩展 = 可被检测"，与步骤 2（line 46-54）反复强调的"必须手动 `mkdir -p ~/.copilot/`"产生矛盾感。

2. **`docs/migration-v2.md:70` / `.zh.md:70` warning 条件描述与代码行为存在间隙**：
   - 文档：`If aiforge detects ~/.vscode/ but not ~/.copilot/, it will display a warning` / `如果 aiforge 检测到 ~/.vscode/ 但未检测到 ~/.copilot/，将显示以下警告`
   - 代码（`src/stages/detect-tools.ts:198-199`）：`if (!detectedTools.includes('copilot') && (await detectLegacyVscodeOnly(pathResolver)))`
   - `detectLegacyVscodeOnly` 检测 `~/.vscode/` 存在且 `~/.copilot/` 不存在；但前置条件是 `!detectedTools.includes('copilot')`
   - 而 `copilot` 的检测路径包括 `~/.copilot/` 和项目 `.github/`：若项目存在 `.github/`，即使 `~/.copilot/` 不存在，`detectedTools.includes('copilot')` 为 true，warning 不输出
   - 因此存在文档承诺与代码行为不完全匹配的边界场景

3. **影响 AC #4 (migration 指引精确性)**：AC #4 要求 `docs/migration-v2.md` 包含"用户操作步骤"，当前文档在主步骤准确（Round 6 已修复），但后续解释段落的检测/警告条件表述仍存间隙。

**严重性判断：合理**

[中] 评级合理：
- 不是运行时阻塞（warning 仅为信息提示，不影响安装流程）
- 但属于 AC #4 文档准确性范畴，且 CHANGELOG 已用精确口径，文档应与之对齐
- edge+auditor 双来源命中，可信度高

**修复建议：可行**

审查给出的修复建议（line 67-70）具体可操作：
- 将 `docs/migration-v2.md:62` / `.zh.md:62` 改为 "detect the Copilot context via `~/.copilot/` marker or project `.github/`" / "通过 `~/.copilot/` 标识目录或项目 `.github/` 检测 Copilot 语境"
- 将 warning 条件改写为 "当未检测到 Copilot context，且存在 home `~/.vscode/` 但不存在 `~/.copilot/` 时显示 warning"
- 中英文同步修改

修复成本：纯文档措辞调整，无需改代码或测试。

**误报评估：非误报**

edge+auditor 双层命中，且代码与文档证据均可独立验证，非误报。

---

## 发现 #2 评估

### 审查原文

> **[中][新] 文档多处写死 `.vscode/mcp.json`，但当前 Files 规则和集成测试实际写入 `.vscode/server.json`**
> - 来源：blind
> - 分类：decision_needed

### 评估结论：✅ 确认有效 — 需要修复（P2 优先级，decision_needed）

### 评估分析

**问题描述准确性：准确**

经代码独立验证：

1. **Story AC 与文档一致使用 `.vscode/mcp.json`**：
   - Story `7-1-vscode-merge-and-mvp-rules-completion.md:18`（AC #1）："原 vscode 规则（`.vscode/mcp.json` 项目级 MCP）被迁移并绑定到 `copilot` 工具"
   - Story 同文件 line 20（AC #2）："copilot 缺 `.vscode/mcp.json` 项目级 MCP 规则"
   - Story line 22（AC #2 Then）："copilot 新增 `.vscode/mcp.json` 项目级 MCP 规则"
   - `docs/migration-v2.md:29`：`copilot:project:mcp-tools → .vscode/` ... `Project-level .vscode/mcp.json via Copilot`
   - `docs/migration-v2.md:75`：warning 样例 `target: .vscode/mcp.json`
   - `docs/migration-v2.md:107-115`：FAQ 中反复使用 `.vscode/mcp.json`

2. **实际规则是 Files 复制语义，无重命名**：
   - `src/data/install-rules.ts:76`：`{ tool: 'copilot', scope: 'project', sourceDir: 'mcp-tools', type: Files, targetDir: '.vscode/' }`
   - Files 类型按源文件名复制到目标目录，不固定生成 `mcp.json`

3. **fixture 与集成测试断言 `.vscode/server.json`**：
   - `tests/fixtures/sample-repo/mcp-tools/` 下源文件为 `server.json`
   - `tests/integration/pipeline.test.ts:958-960`：`const vscodeMcpTarget = pathJoin(tmpDir, '.vscode', 'server.json')` + 存在性断言

4. **三方不一致**：Story AC + 文档 = `.vscode/mcp.json`；实现 + fixture + 测试 = `.vscode/<源文件名>`（当前为 `.vscode/server.json`）

**严重性判断：合理**

[中] 评级合理：
- 单 blind 来源，但证据链完整、横跨规格/文档/代码/测试四方
- 属于 AC #1 / AC #2 交付契约准确性问题
- 不是运行时阻塞（功能可工作，只是文件名与文档承诺不符）
- decision_needed 分类准确：需要产品裁决目标契约

**修复建议：可行（但需先决策）**

审查的两条裁决路径都可行：
- **路径 A**（保持现有 Files 复制语义）：修文档与 Story AC，将 `.vscode/mcp.json` 改为 `.vscode/<mcp-tools 文件>` 或泛化为 `.vscode/`；在 install-rules matrix 说明文件名沿用源文件
- **路径 B**（固定 `.vscode/mcp.json`）：需要 (1) 调整 `mcp-tools` 源目录约定（例如将 fixture 重命名为 `mcp.json`），或 (2) 引入新的 InstallType 支持单文件重命名，或 (3) 增加规则层重命名逻辑；同步修改 fixture 和集成测试断言

**推荐路径 A**：当前 fixture/实现/测试链条已稳定，路径 A 仅改文档措辞，成本最低；且 Files 复制语义具有更好的扩展性（mcp-tools 目录未来可承载多个文件）。

需要用户裁决后再执行修复。

**误报评估：非误报**

证据链完整，是真实的规格-实现-文档三方不一致，非误报。

---

## 发现 #3 评估

### 审查原文

> **[低][新] 英文语言切换测试未使用 `finally` / `afterEach` 恢复语言，失败时可能污染后续测试**
> - 来源：blind+edge
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P3 优先级）

### 评估分析

**问题描述准确性：准确**

经代码独立验证：

1. **测试位置确认**：
   - `tests/stages/detect-tools.test.ts:385-405`：UNKNOWN_TOOL 英文 fix 测试，line 386 `setLanguage('en')` + line 404 `setLanguage('zh-CN')`
   - `tests/stages/detect-tools.test.ts:502-518`：vscodeMergedNote 英文测试，line 503 `setLanguage('en')` + line 518 `setLanguage('zh-CN')`

2. **缺少 finally/afterEach 兜底**：
   - 通过 `grep -n "afterEach\|setLanguage\|beforeEach"` 全文件搜索，只有 line 92 的 `beforeEach`（用于 mock 重置），无任何 `afterEach`
   - 两处英文测试都是顺序执行 `setLanguage('en') → ...断言... → setLanguage('zh-CN')`，无 `try/finally` 保护
   - 若中间断言抛出错误，末尾的 `setLanguage('zh-CN')` 不会执行

3. **`setLanguage` 是模块级状态**：
   - `src/core/messages.ts` 中 `setLanguage` 修改模块级语言状态
   - vitest 默认按文件维度共享模块状态（无 `--isolate` 等额外配置），同一文件内后续 `it` 块会受影响
   - 即便测试文件级别隔离，同 describe 块内顺序 it 仍受影响

**严重性判断：合理**

[低] 评级合理：
- 不是产品运行时缺陷
- 仅影响测试失败时的可诊断性（级联误判失败）
- 当前测试全部通过时不会触发该问题
- blind+edge 双层命中，且为测试稳定性范畴

**修复建议：可行**

审查的两条修复路径都可行：
- 选项 A：增加文件级 `afterEach(() => setLanguage('zh-CN'))`（推荐 — 一行兜底，覆盖所有未来新增英文测试）
- 选项 B：每个英文测试用 `try/finally` 包裹 `setLanguage('en')`

修复成本：< 5 行代码，无回归风险。

**误报评估：非误报**

双层命中、代码证据明确，非误报。

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | migration 文档 Copilot 检测/warning 触发条件残留不准确表述 | [中] | **P2** | 文档措辞与 CHANGELOG 精确口径和代码逻辑对齐；中英文同步 |
| 2 | `.vscode/mcp.json` Story AC/文档与 Files 复制实现/测试三方不一致 | [中] | **P2** | 需用户裁决路径 A（推荐：修文档/Story AC）或路径 B（改实现） |
| 3 | 英文语言切换测试未使用 finally/afterEach 恢复语言 | [低] | **P3** | 添加文件级 `afterEach(() => setLanguage('zh-CN'))`，5 行内闭合 |

### 建议纳入 CR TODO 跟踪（非阻塞）

无新增 CR TODO 项。

### 可忽略（误报）

无误报。

### 评估决定

- **发现 #1（migration 文档 Copilot 检测与 warning 触发条件不准确）**：建议本轮修复（P2）。具体操作：(1) `docs/migration-v2.md:62` / `.zh.md:62` 改写为 "detect the Copilot context via `~/.copilot/` marker or project `.github/`" / "通过 `~/.copilot/` 标识目录或项目 `.github/` 检测 Copilot 语境"；(2) `docs/migration-v2.md:70` / `.zh.md:70` warning 条件改写为 "当未检测到 Copilot context，且存在 home `~/.vscode/` 但不存在 `~/.copilot/` 时显示 warning"；(3) 中英文同步修改。

- **发现 #2（`.vscode/mcp.json` 三方不一致）**：建议本轮修复（P2 decision_needed）。**需用户先裁决目标契约**。**推荐路径 A**（保持 Files 复制语义）：(1) 修改 Story `7-1-vscode-merge-and-mvp-rules-completion.md:18, 20, 22` AC #1/#2 描述，将 `.vscode/mcp.json` 改为 `.vscode/<mcp-tools 文件>` 或在条款中注明 "文件名沿用源目录文件名"；(2) 修改 `docs/migration-v2.md:29, 75, 107-115` 与 `.zh.md` 对应位置，将 `.vscode/mcp.json` 改为 `.vscode/`（或保留 `.vscode/mcp.json` 作为示例并加注 "文件名取决于 `mcp-tools/` 源目录内容"）；(3) `docs/install-rules-matrix.md` 同步说明 Files 复制语义。**裁决前不要修改实现**。

- **发现 #3（测试语言状态清理健壮性）**：建议本轮一并修复（P3）。具体操作：在 `tests/stages/detect-tools.test.ts` 顶部增加 `import { afterEach } from 'vitest'`（若尚未导入），并在 describe 块中添加 `afterEach(() => setLanguage('zh-CN'))` 文件级兜底；可保留各测试内部的 `setLanguage('zh-CN')` 作为冗余保护。

**总体建议**：本轮 3 项发现全部本轮闭合后进入 Round 8 快速复审。发现 #1 与 #3 可直接执行；发现 #2 需先取得用户对契约方向（路径 A vs B）的明确裁决。

---

## 修复执行记录

### 修复执行记录
- **Date**: 2026-05-12
- **Model Used**: Claude Sonnet 4.6 (claude-sonnet-4-6)
- **Fix Items**: 3

---

### Fix #1：migration 文档 Copilot 检测/warning 触发条件不准确（P2）

**修改文件及位置**：
- `docs/migration-v2.md` line 62、line 70
- `docs/migration-v2.zh.md` line 62、line 70

**修改内容**：

| 文件 | 行 | 修改前 | 修改后 |
|------|----|--------|--------|
| `migration-v2.md` | 62 | `aiforge will now detect GitHub Copilot (if installed) and apply the updated rules.` | `aiforge will now detect the Copilot context via \`~/.copilot/\` marker or project \`.github/\` and apply the updated rules.` |
| `migration-v2.md` | 70 | `If aiforge detects \`~/.vscode/\` but not \`~/.copilot/\`, it will display a warning:` | `If aiforge detects \`~/.vscode/\` but no Copilot context (\`~/.copilot/\` marker or project \`.github/\`), it will display a warning:` |
| `migration-v2.zh.md` | 62 | `aiforge 现在会检测 GitHub Copilot（如已安装）并应用更新后的规则。` | `aiforge 现在会通过 \`~/.copilot/\` 标识目录或项目 \`.github/\` 检测 Copilot 语境并应用更新后的规则。` |
| `migration-v2.zh.md` | 70 | `如果 aiforge 检测到 \`~/.vscode/\` 但未检测到 \`~/.copilot/\`，将显示以下警告：` | `如果 aiforge 检测到 \`~/.vscode/\` 但未检测到 Copilot 语境（\`~/.copilot/\` 标识目录或项目 \`.github/\`），将显示以下警告：` |

**修复结果**：✅ 成功。文档措辞现与 `CHANGELOG.md:15` 精确口径及 `src/stages/detect-tools.ts:196-199` 代码逻辑完全对齐。

---

### Fix #2：`.vscode/mcp.json` 文档/Story AC 与 Files 复制实现不一致（P2，路径 A）

**用户裁决**：路径 A（保持 Files 复制语义不变，修改文档措辞）

**修改文件及位置**：
- `docs/migration-v2.md` lines 29、54、75、107-110、115
- `docs/migration-v2.zh.md` lines 29、54、74、106-113
- `docs/install-rules-matrix.md` line 25
- `docs/install-rules-matrix.zh.md` line 25

**核心改动**：
- 映射表描述：`Project-level .vscode/mcp.json via Copilot` → `Project-level .vscode/ via Copilot (filename follows source in mcp-tools/)`
- 步骤 2 结尾：`apply the .vscode/mcp.json rule` → `apply the .vscode/ MCP rule (copying files from mcp-tools/)`
- warning 文本 ①：`target: .vscode/mcp.json` → `target: .vscode/<filename>`
- FAQ 问题/答案中的 `.vscode/mcp.json` 硬编码 → 改为 `.vscode/` + 添加说明注解
- install-rules-matrix 描述：`(mcp.json)` → `(filename follows source in mcp-tools/)`
- 中文版对应位置同步更新

**修复结果**：✅ 成功。文档不再硬编码 `.vscode/mcp.json`，准确反映 Files 类型按源文件名复制的语义；未修改任何实现代码或测试。

---

### Fix #3：英文语言切换测试缺少 `afterEach` 语言状态恢复（P3）

**修改文件及位置**：
- `tests/stages/detect-tools.test.ts` line 1（import）和 line 95-97（新增 afterEach）

**修改内容**：
1. 在 import 语句中补充 `afterEach`：`import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'`
2. 在 `describe('detectTools')` 块中的 `beforeEach` 之后添加文件级兜底：
   ```ts
   afterEach(() => {
     setLanguage('zh-CN')
   })
   ```

**修复结果**：✅ 成功。运行 `npm test -- tests/stages/detect-tools.test.ts`，24 个测试全部通过。即使未来英文测试中间断言抛出错误，`afterEach` 也能确保语言状态被恢复，不会污染后续测试。

---

### 整体修复状态

| # | 发现 | 优先级 | 状态 |
|---|------|--------|------|
| 1 | migration 文档 Copilot 检测/warning 触发条件不准确 | P2 | ✅ 已修复 |
| 2 | `.vscode/mcp.json` 文档与实现不一致 | P2 | ✅ 已修复（路径 A） |
| 3 | 英文测试缺少 `afterEach` 语言状态恢复 | P3 | ✅ 已修复 |

所有修复已执行完毕，建议进入 Round 8 快速复审。
