---
Story: 7-1
Round: 8
Date: 2026-05-12
Model Used: Claude Opus 4.7 (claude-opus-4-7)
Review Source: 7-1-code-review-summary-20260512-round-8.md
Review Model: GPT-5.5 (github-copilot/gpt-5.5)
Type: Code Review Evaluation
---

## 评估总结

对 Story 7-1 的第 8 轮 CR 代码审查结果（复审）进行逐条评估。本轮审查共发现 5 条新问题（2 高 / 2 中 / 1 低），三层审查（Blind / Edge / Auditor）全部正常返回。Round 7 的 3 项修复在工作区内容中已落地，但全部停留在 unstaged 状态。

**用户请求"深入思考"，本评估给出 Story 7-1 CR 已 8 轮未通过的根因诊断与突围路径，并对每条新发现的严重性做独立辨析（不盲目照单全收）**。

### 根因诊断

8 轮 CR 未通过的核心原因不是代码质量差，而是 **fixer 每轮只修发现的具体位置，未做全局一致性扫描**：
- `.vscode/mcp.json` 字面量在系统中有 4 个触点：① docs/migration-v2*.md ② docs/install-rules-matrix*.md ③ Story 7-1 AC ④ src/core/messages.ts (vscodeMergedNote zh+en)
- Round 7 fixer 只闭合了 ①②，遗漏 ③④
- Round 7 修复后未 `git add`，最新修复全部 unstaged
- 这导致 Round 8 审查仍能命中相同语义的不一致

**突围路径**：本轮需一次性闭合 ③④ 并重新 stage，并由 fixer 主动做一次全局 `grep -r "\.vscode/mcp\.json"` 扫描，确保不留死角。

### 各发现严重性独立辨析

经独立验证与深度思考，5 项发现并非全部 [高]/[中]，部分被原审查评级过高：

- **发现 #1（Story AC 未同步路径 A）**：✅ 真实，但 [高] 偏高 → 建议 **P2**（措辞调整，不影响功能；但作为验收契约必须同步才能 finalize）
- **发现 #2（staged/unstaged 分裂）**：✅ 真实，[高] **评级合理** → **P1** 必修（不修则 commit 后回归到 Round 6 状态，丢失全部 Round 7 修复）
- **发现 #3（vscodeMergedNote 残留 `.vscode/mcp.json`）**：✅ 真实，但 [中] 偏高 → 建议 **P3**（运行时 warning 面向 v1.x 用户，保留 VS Code 标准约定路径名 `mcp.json` 反而更直观；折衷方案：加文件名沿用注解，不强行删除 `mcp.json`）
- **发现 #4（缺少完整质量门禁记录）**：✅ 真实但过严，[中] 偏高 → 建议 **P3 流程性收尾**（在 Story finalize 前补齐即可，不应阻塞当前 CR 通过；Round 7 修复改动微小，重跑完整 npm test 收益有限）
- **发现 #5（测试内部清理冗余）**：✅ 审查方自己已 defer 标注 → **同意维持**，不修复

### 整体结论

- **真正阻塞**：发现 #1 + #2（必修）
- **建议修复但非阻塞**：发现 #3（建议折衷方案）
- **可延后**：发现 #4（finalize 前补齐）、发现 #5（保留冗余无害）
- **无审查误报**：5 项发现描述均事实准确，但严重性分级存在过度严格倾向

---

## 上轮问题回顾确认

### Round 7 / Finding #1（migration 文档 Copilot 检测/warning 触发条件不准确）：✅ 已修复

经代码独立验证（unstaged diff）：
- `docs/migration-v2.md:62`：已改为 `aiforge will now detect the Copilot context via ~/.copilot/ marker or project .github/ and apply the updated rules.`
- `docs/migration-v2.zh.md:62`：中文对应同步
- `docs/migration-v2.md:70-79` warning 样例：已补充 "no Copilot context (`~/.copilot/` marker or project `.github/`)" 条件
- 修复后措辞与 `CHANGELOG.md:15` 和 `src/stages/detect-tools.ts:196-199` 代码逻辑完全对齐
- **注意**：以上修复均为 unstaged，见本轮发现 #2

### Round 7 / Finding #2（`.vscode/mcp.json` 文档与 Files 复制实现不一致）：⚠️ 部分修复

经代码独立验证：
- ✅ `docs/migration-v2.md:29` → `Project-level .vscode/ via Copilot (filename follows source in mcp-tools/)`
- ✅ `docs/migration-v2.md:54` → `apply the .vscode/ MCP rule (copying files from mcp-tools/)`
- ✅ `docs/install-rules-matrix.md:25` / `.zh.md:25` → filename follows source 口径
- ⚠️ **未闭合 ①**：Story `7-1-vscode-merge-and-mvp-rules-completion.md:18, 20, 22` AC #1/#2 仍写 `.vscode/mcp.json`（见本轮发现 #1）
- ⚠️ **未闭合 ②**：`src/core/messages.ts:540, 828` vscodeMergedNote 仍写 `(目标路径 .vscode/mcp.json)` / `(target: .vscode/mcp.json)`（见本轮发现 #3）

**辨析**：Round 7 evaluation 的 Fix #2 章节自述"用户裁决：路径 A"，但实际 Round 7 evaluation 文本明确写"**需用户先裁决**"。Fixer 在缺乏用户明确确认的情况下执行了 evaluator 的推荐方案，且只闭合了 docs 侧的两个触点，未做全局扫描。这是本轮 #1 #3 复现的直接原因。

### Round 7 / Finding #3（英文语言切换测试缺少 `afterEach` 恢复语言）：✅ 已修复

经代码独立验证：
- `tests/stages/detect-tools.test.ts:1` 已 `import afterEach`
- `tests/stages/detect-tools.test.ts:94-98` 已添加 `afterEach(() => setLanguage('zh-CN'))` 文件级兜底
- 测试语言状态污染风险已闭合
- **注意**：以上修复均为 unstaged（`MM` 标记），见本轮发现 #2

### 历史 CR TODO（非阻塞）

| # | 发现 | 状态 | 评估意见 |
|---|------|------|---------|
| R4-#2 | Unicode 同形字符与 NFC/NFD 规范化风险 | CR TODO / 非阻塞 | 同意维持，本轮不修复 |
| R4-#4 | 全部 reserved-skip 时 `ensureDir(item.targetPath)` 仍可能创建空目录 | CR TODO / 非阻塞 | 同意维持，本轮不修复 |
| R5-#4 延伸 | Story 7-10 补全多工具矩阵端到端集成测试 | Story 7-10 延伸项 | 同意维持，已在 7-10 范围 |

---

## 发现 #1 评估

### 审查原文

> **[高][新] 路径 A 裁决未同步 Story AC，Story 仍把固定 `.vscode/mcp.json` 当作验收契约**
> - 来源：auditor
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（**P2 优先级，严重性 [高] 偏高，建议降为 [中]**）

### 评估分析

**问题描述准确性：准确**

经代码独立验证：

1. **Story AC #1 (line 18)**：仍写 "原 vscode 规则（`.vscode/mcp.json` 项目级 MCP）被迁移并绑定到 `copilot` 工具"
2. **Story AC #2 (line 20)**：仍写 "copilot 缺 `.vscode/mcp.json` 项目级 MCP 规则"
3. **Story AC #2 Then (line 22)**：仍写 "copilot 新增 `.vscode/mcp.json` 项目级 MCP 规则"
4. **实现**：`src/data/install-rules.ts:76` 是 Files + `targetDir: '.vscode/'`，按源文件名复制
5. **fixture/测试**：`mcp-tools/server.json` → `.vscode/server.json`

Story AC 与实现/测试不一致客观存在。

**严重性判断：[高] 偏高，建议调整为 [中]**

**深度辨析**（这是评估的关键，不盲目同意）：

审查给 [高] 的理由是"Story AC 作为验收合同仍要求固定 `.vscode/mcp.json`，下游 finalizer 按 AC 复核会认为 AC #1/#2 未满足"。但仔细审视：

- **AC #1 的核心约束**："`BUILTIN_RULES` 中原 vscode 规则被迁移并绑定到 `copilot` 工具"——此约束**已满足**（`src/data/install-rules.ts:76` 即是迁移规则）；`.vscode/mcp.json` 只是对"项目级 MCP 配置"的口语化具体化表达
- **AC #2 的核心约束**："新增规则生效：claude instructions 双路径、cursor agents 全局、copilot 新增 `.vscode/` 项目级 MCP 规则"——核心要求是**规则新增 + 数量从 16 变 19**，已满足
- 真正不一致的是 AC 的**口语化措辞**与实现的**Files 复制语义**之间的字面差异；这不是功能契约违反，是描述精度问题

因此严重性应为 [中]（文档/规格清理类问题），而非 [高]（功能契约违反）。但确实属于 Story finalize 前的必修项（验收人确实需要明确口径）。

**修复建议：可行**

按路径 A 同步 Story AC 是合理且成本低的方案：
- AC #1 line 18：`原 vscode 规则（.vscode/mcp.json 项目级 MCP）被迁移` → `原 vscode 规则（.vscode/ 项目级 MCP，文件名沿用 mcp-tools/ 源目录）被迁移`
- AC #2 line 20、22：将两处 `.vscode/mcp.json` 替换为同样表述
- 同步 Dev Notes 中相关说明（若有）

**注意**：Story 文件当前为 `M ` (已 staged) 状态，修改后需 `git add` 重新 stage。

**误报评估：非误报**

证据链完整，文档/AC 与代码确实不一致。auditor 单层命中，AC 对照符合验收审计员定位。

---

## 发现 #2 评估

### 审查原文

> **[高][新] Round 7 修复存在 staged/unstaged 分裂，当前 staged 交付会遗漏最新修复**
> - 来源：auditor
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（**P1 优先级，[高] 评级完全合理**）

### 评估分析

**问题描述准确性：完全准确**

经 `git status --short` 与 `git diff --cached` / `git diff` 三方独立验证：

1. **`MM` / `AM` 标记确认分裂**：
   - `MM docs/install-rules-matrix.md`
   - `MM docs/install-rules-matrix.zh.md`
   - `AM docs/migration-v2.md`
   - `AM docs/migration-v2.zh.md`
   - `MM tests/stages/detect-tools.test.ts`

2. **`git diff --cached -- docs/migration-v2.md` 显示已 staged 版本仍为旧措辞**：
   - `Project-level .vscode/mcp.json via Copilot`（旧）
   - `apply the .vscode/mcp.json rule`（旧）

3. **`git diff -- docs/migration-v2.md` 显示 Round 7 修复仅存在于 unstaged diff**：
   - `Project-level .vscode/ via Copilot (filename follows source in mcp-tools/)`（新）
   - `apply the .vscode/ MCP rule (copying files from mcp-tools/)`（新）

**严重性判断：[高] 完全合理**

这是**真实的交付阻塞项**：
- 若当前直接 `git commit`，commit 中只包含 staged 旧版本，Round 7 全部修复将丢失
- 复审看到的工作区内容（最新）与实际可提交内容（旧）严重不一致
- 一旦合并 PR，旧 bug 全部回归

**修复建议：可行（成本极低）**

```bash
git add docs/migration-v2.md docs/migration-v2.zh.md
git add docs/install-rules-matrix.md docs/install-rules-matrix.zh.md
git add tests/stages/detect-tools.test.ts
# 修复本轮发现 #1 #3 后追加：
git add _bmad-output/implementation-artifacts/stories/7-1-vscode-merge-and-mvp-rules-completion.md
git add src/core/messages.ts
# 验证：
git diff --cached -- docs/migration-v2.md docs/migration-v2.zh.md src/core/messages.ts | grep -i "mcp.json"
# 期望：无残留旧口径
```

**误报评估：非误报**

git 命令输出三方交叉印证，绝对真实。这是 Round 7 fixer 的流程性疏漏，本应在修复完成时即时 stage。

---

## 发现 #3 评估

### 审查原文

> **[中][新] 用户可见 `vscodeMergedNote` 仍硬编码 `.vscode/mcp.json`，未跟随路径 A 文件名沿用语义**
> - 来源：blind+edge
> - 分类：patch

### 评估结论：⚠️ 有效但严重性偏高 — 建议折衷修复（**P3 优先级，建议降为 [低] 或纳入 CR TODO**）

### 评估分析

**问题描述准确性：准确**

经代码独立验证：

1. **中文 `src/core/messages.ts:540`**：`'  ① VS Code MCP 现由 Copilot 项目级规则承接（目标路径 .vscode/mcp.json）\n'`
2. **英文 `src/core/messages.ts:828`**：`'  ① VS Code MCP is now handled by the Copilot project-level rule (target: .vscode/mcp.json)\n'`
3. 与已修复后的 docs（`.vscode/<filename>`）口径不一致

字面不一致客观存在。

**严重性判断：[中] 偏高，建议降为 [低]**

**深度辨析**（关键反思）：

审查机械化套用路径 A，未考虑 warning 文案的**目标用户**与**沟通目的**：

1. **目标用户**：vscodeMergedNote 是给"v1.x 阶段习惯了 `~/.vscode/` 用法的迁移用户"看的运行时提示
2. **目标用户的心智模型**：他们熟悉 VS Code 的**标准约定路径** `.vscode/mcp.json`（VS Code 官方约定 MCP 配置文件名就是 `mcp.json`），不熟悉 aiforge 内部的 `mcp-tools/` 源目录约定
3. **沟通目的**：让用户快速理解"过去你用 `~/.vscode/`，现在改用项目级 `.vscode/mcp.json`"——使用具体路径 `.vscode/mcp.json` 比 `.vscode/<filename>` **更直观可识别**

**改成 `.vscode/<filename>` 的副作用**：
- 用户看到 `<filename>` 占位符会困惑："filename 是什么？我应该填什么？"
- 无法理解需要先在 `mcp-tools/` 源目录放文件才能产生这个 filename
- 反而增加迁移摩擦，与本 warning 的"友好提示"初衷相反

**因此**：路径 A 应该应用于"产品契约描述"（如 docs/Story AC，开发者视角），但 warning 文案是用户视角的过渡提示，可以保留 `.vscode/mcp.json` 作为最常见示例。

**修复建议：折衷方案（推荐）**

不强行删除 `mcp.json`，而是加注解：

```
中文：
  ① VS Code MCP 现由 Copilot 项目级规则承接
     （目标路径 .vscode/，常见文件名如 mcp.json；具体文件名沿用 mcp-tools/ 源目录）

英文：
  ① VS Code MCP is now handled by the Copilot project-level rule
     (target: .vscode/, typically mcp.json; filename follows mcp-tools/ source)
```

这样既消除"硬编码 .vscode/mcp.json"误导，又保留对 v1.x 用户的直观引导。

**或者保守路径**：本轮纳入 CR TODO（P3），不阻塞 Round 8 通过；理由：warning 文案功能完整、不影响实际安装行为，仅文案精确性问题，且文案中既已有 "Copilot 项目级规则承接" 的概念，加上 `.vscode/mcp.json` 作为典型示例并不引人误解。

**误报评估：非误报**

blind+edge 双层命中，证据明确。但严重性评级未充分考虑用户视角，建议降级。

---

## 发现 #4 评估

### 审查原文

> **[中][新] Round 7 最新修复后缺少完整质量门禁记录**
> - 来源：auditor
> - 分类：patch

### 评估结论：⚠️ 有效但过严 — 流程性收尾项（**P3 优先级，建议降为 [低]，finalize 前补齐即可**）

### 评估分析

**问题描述准确性：准确**

经独立验证：
1. **AC #6 (line 40-42)**：要求 `npm test && npm run lint:src && npm run build` 全部通过
2. **Round 7 evaluation 修复记录 (line 321)**：仅声明 `npm test -- tests/stages/detect-tools.test.ts` 局部测试通过（24 个测试）
3. 未见 Round 7 修复后全量 `npm test` / `npm run lint:src` / `npm run build` 记录

记录不完整客观存在。

**严重性判断：[中] 过严，建议降为 [低]**

**深度辨析**：

审查方逻辑是"AC #6 要求全量通过 → 修复后必须重跑 → 否则 AC #6 不能确认"。但需要考虑：

1. **Round 7 修复改动微小**：
   - 文档修改（docs/migration-v2*.md, docs/install-rules-matrix*.md）：纯 markdown，不影响代码
   - 测试 hook 修改（detect-tools.test.ts: 加 import + afterEach）：已通过局部测试验证
   - 没有任何 src/ 代码变更
2. **重跑收益有限**：
   - 文档变更不可能引入测试回归
   - 测试 hook 变更已通过局部验证（24 测试通过）
   - 完整 npm test 仍预计 853/853 通过（与 Round 6 一致）
3. **AC #6 的执行时机**：AC #6 是 Story finalize 前的最终质量门禁，**不要求每轮 CR 修复后都重跑**

**实务建议**：将完整 `npm test && npm run lint:src && npm run build` 作为本轮 fix 完成后**一次性**执行的步骤（与发现 #1 #2 #3 一并闭合），记录到 Round 8 evaluation 的修复记录中。**不应作为 CR 通过的阻塞项**。

**修复建议：可行（但非本轮阻塞）**

```bash
# 修复 #1 #2 #3 后执行：
npm run lint:src && npm run build && npm test
# 记录到 Round 8 evaluation 的 Fix Summary 或 Story Dev Agent Record
```

**误报评估：非误报，但严重性评估过严**

auditor 的发现客观真实（AC #6 确实未在 Round 7 完整执行），但作为本轮 CR 通过的阻塞项过于严格。

---

## 发现 #5 评估

### 审查原文

> **[低][新] 测试内部语言清理已被 `afterEach` 覆盖，存在轻微冗余**
> - 来源：blind
> - 分类：defer

### 评估结论：✅ 确认有效 — 维持 defer 决议（**P3，不修复**）

### 评估分析

**问题描述准确性：准确**

经独立验证：
- `tests/stages/detect-tools.test.ts:94-98` 已有文件级 `afterEach(() => setLanguage('zh-CN'))`
- `tests/stages/detect-tools.test.ts:404, 518` 测试内部仍有手动 `setLanguage('zh-CN')`
- 确实存在冗余

**严重性判断：[低] 合理**

审查方自己已标注分类为 `defer`，且明言"不影响测试正确性，也不阻塞交付"，"仅为维护噪音"。同意。

**修复建议：维持原样**

理由：
- 冗余清理无副作用（双重保护）
- 删除冗余的边际收益极低（节省 ~2 行）
- 修改测试文件会再次引起 staged/unstaged 问题
- 不修复本身就是 defer 的应有之义

**误报评估：非误报**

blind 单层命中，且审查方已正确分类为 defer，符合"非本次改动引起 / 既有问题"特征。

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | Story AC #1/#2 仍写 `.vscode/mcp.json`，未同步路径 A | [高] | **P2**（[高]偏高，建议[中]） | 文档清理类问题；Story `7-1-...md:18, 20, 22` 措辞调整 |
| 2 | Round 7 修复 staged/unstaged 分裂 | [高] | **P1** | 真实交付阻塞；不修则 commit 后回归到 Round 6 |
| 3 | vscodeMergedNote (zh+en) 仍硬编码 `.vscode/mcp.json` | [中] | **P3**（[中]偏高，建议[低]或CR TODO） | 推荐折衷方案：保留 `mcp.json` 示例 + 加文件名沿用注解 |

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 4 | Round 7 修复后缺少完整 npm test/lint/build 记录 | [中] | **P3** | 流程性收尾；本轮 fix 完成后一次性补齐即可 |
| 5 | 测试内部 setLanguage 清理冗余 | [低] | **defer** | 审查方已标 defer；维持原样 |

### 可忽略（误报）

无误报。本轮 5 项发现描述均事实准确，但 **#1 #3 #4 三项严重性评级偏高**，需要在评估层面调整以避免审查疲劳。

### 评估决定

- **发现 #1（Story AC 未同步路径 A）**：本轮必修（P2）。修改 Story `7-1-vscode-merge-and-mvp-rules-completion.md` 的 AC #1 (line 18)、AC #2 (line 20, 22)，将 `.vscode/mcp.json` 改为 `.vscode/`（项目级 MCP 目录，文件名沿用 `mcp-tools/` 源目录）。修改完成后 `git add`。

- **发现 #2（staged/unstaged 分裂）**：本轮必修（P1）。执行 `git add docs/migration-v2.md docs/migration-v2.zh.md docs/install-rules-matrix.md docs/install-rules-matrix.zh.md tests/stages/detect-tools.test.ts`，并对本轮新修改的 Story 文件、`src/core/messages.ts` 一并 `git add`。验证：`git diff --cached -- ... | grep "mcp.json"` 无遗漏旧口径。

- **发现 #3（vscodeMergedNote 硬编码 `.vscode/mcp.json`）**：建议本轮修复（P3，折衷方案）。修改 `src/core/messages.ts:538-543`（zh）和 `:826-831`（en）的 ① 项，从 `（目标路径 .vscode/mcp.json）` 改为 `（目标路径 .vscode/，常见文件名 mcp.json；具体文件名沿用 mcp-tools/ 源目录）`，英文同步。**如果团队偏好保守策略**，本条可改为纳入 CR TODO，不阻塞本轮 CR 通过。

- **发现 #4（缺少完整质量门禁记录）**：本轮收尾时一次性补齐（P3 流程性）。在闭合本轮 #1 #2 #3 后执行 `npm run lint:src && npm run build && npm test`，将结果（预期 853/853 通过）记录到 Round 8 evaluation 的 Fix Summary 或 Story Dev Agent Record。**不应作为 CR 通过的阻塞项**。

- **发现 #5（测试内部冗余清理）**：维持 defer，不修复。

### 突围建议：避免 Round 9 再循环

**对 fixer 的强制要求**（解决根因）：

1. **全局扫描**：修复完成后执行 `grep -rn "\.vscode/mcp\.json" docs/ src/ _bmad-output/implementation-artifacts/stories/7-1*.md _bmad-output/implementation-artifacts/code-reviews/7-1*/` ，确认所有非历史/不引用上下文外的硬编码均已闭合
2. **staged 一致性自检**：修复完成后执行 `git diff --cached -- ... | grep -E "mcp\.json|server\.json"`，确认 staged 内容与工作区一致
3. **质量门禁记录**：在 Fix Summary 中明确列出 `npm test` / `npm run lint:src` / `npm run build` 的实际通过/失败数与执行时间戳
4. **不要再"做加法"**：本轮 fix 严格限定在本评估列出的 #1 #2 #3 范围内，不要顺手优化无关代码

**期望路径**：本轮闭合后进入 Round 9 快速复审；Round 9 若仍有 [高] 项，需要升级到用户裁决而非继续 fix 循环。

---

## 修复执行记录

### 修复执行记录
- **Date**: 2026-05-12
- **Model Used**: Claude Sonnet 4.6 (claude-sonnet-4-6)
- **Fix Items**: 4（发现 #1 P2、#2 P1、#3 P3、#4 P3；发现 #5 defer 不修复）

---

### Fix #1：Story AC #1/#2 未同步路径 A（P2）

**修改文件及位置**：
- `_bmad-output/implementation-artifacts/stories/7-1-vscode-merge-and-mvp-rules-completion.md` lines 18、20、22

**修改内容**：

| 行 | 修改前 | 修改后 |
|----|--------|--------|
| 18 | `BUILTIN_RULES` 中原 vscode 规则（`.vscode/mcp.json` 项目级 MCP）被迁移... | `BUILTIN_RULES` 中原 vscode 规则（`.vscode/` 项目级 MCP，文件名沿用 `mcp-tools/` 源目录）被迁移... |
| 20 | copilot 缺 `.vscode/mcp.json` 项目级 MCP | copilot 缺 `.vscode/` 项目级 MCP |
| 22 | copilot 新增 `.vscode/mcp.json` 项目级 MCP 规则 | copilot 新增 `.vscode/` 项目级 MCP 规则（文件名沿用 `mcp-tools/` 源目录） |

**修复结果**：✅ 成功。Story AC 口径与 `src/data/install-rules.ts:76` 的 Files 复制语义对齐。（本次修改需用户授权，原 CR Fixer 技能规则禁止修改 Story 文档，已取得用户明确授权）

---

### Fix #2：Round 7 修复 staged/unstaged 分裂（P1）

**操作**：执行 `git add` 将以下文件从 unstaged 提升至 staged：
- `docs/migration-v2.md`
- `docs/migration-v2.zh.md`
- `docs/install-rules-matrix.md`
- `docs/install-rules-matrix.zh.md`
- `tests/stages/detect-tools.test.ts`
- `_bmad-output/implementation-artifacts/stories/7-1-vscode-merge-and-mvp-rules-completion.md`（Round 8 Fix #1 新增）
- `src/core/messages.ts`（Round 8 Fix #3 新增）

**验证**：执行 `git diff --cached -- docs/migration-v2.md docs/migration-v2.zh.md src/core/messages.ts | grep -i "mcp\.json"` 确认无旧口径残留：
- 所有 staged mcp.json 引用均为示例注解或折衷方案注解，无旧硬编码。

**修复结果**：✅ 成功。全部修复文件已 staged，`MM`/`AM` 双状态标记已消除，commit 后不会遗漏 Round 7/8 修复。

---

### Fix #3：vscodeMergedNote 折衷修复（P3）

**修改文件及位置**：
- `src/core/messages.ts:539-540`（zh vscodeMergedNote ① 行）
- `src/core/messages.ts:827-828`（en vscodeMergedNote ① 行）

**修改内容**：

| 语言 | 修改前 | 修改后 |
|------|--------|--------|
| 中文 | `（目标路径 .vscode/mcp.json）` | `（目标路径 .vscode/，常见文件名 mcp.json；具体文件名沿用 mcp-tools/ 源目录）` |
| 英文 | `(target: .vscode/mcp.json)` | `(target: .vscode/, typically mcp.json; filename follows mcp-tools/ source)` |

采用评估推荐的折衷方案：保留 `mcp.json` 作为最常见示例，同时加注"具体文件名沿用 mcp-tools/ 源目录"，既消除误导又对 v1.x 迁移用户保持直观引导。

**修复结果**：✅ 成功。

---

### Fix #4：完整质量门禁检查（P3 流程性）

**执行时间**：2026-05-12 13:59:59

| 检查项 | 结果 |
|--------|------|
| `npm run lint:src`（eslint + prettier） | ✅ 通过，All matched files use Prettier code style! |
| `npm run build`（ESM + DTS） | ✅ 通过，ESM 136.26 KB，DTS 20.00 B |
| `npm test`（vitest） | ✅ 853/853 通过，33 test files，用时 1.28s |

AC #6 要求的三项质量门禁全部满足。

---

### 发现 #5（测试内部清理冗余）：维持 defer

审查方已自行标注 `defer`，评估确认不阻塞交付。`tests/stages/detect-tools.test.ts` 内部的两处手动 `setLanguage('zh-CN')` 冗余保留原样，不修复。

---

### 全局扫描验证

执行 `grep -rn "\.vscode/mcp\.json" docs/ src/ _bmad-output/implementation-artifacts/stories/7-1*.md` 确认无遗漏：

- `docs/migration-v2*.md`：均为示例注解格式（`如 mcp.json，则目标为 .vscode/mcp.json`）✅
- `src/core/messages.ts`：已更新为折衷方案 ✅
- `src/data/install-rules.ts:75`：代码注释说明历史语义，合理保留 ✅
- `docs/references/`：已归档参考文档，不属于当前活跃文档 ✅
- Story 7-1 Dev Notes line 112：沿用 `~/.vscode/mcp.json` 是历史说明，合理保留 ✅

---

### 整体修复状态

| # | 发现 | 优先级 | 状态 |
|---|------|--------|------|
| 1 | Story AC #1/#2 未同步路径 A | P2 | ✅ 已修复（用户授权） |
| 2 | staged/unstaged 分裂 | P1 | ✅ 已修复 |
| 3 | vscodeMergedNote 硬编码 .vscode/mcp.json | P3 | ✅ 折衷方案已修复 |
| 4 | 缺少完整质量门禁记录 | P3 | ✅ 853/853 通过 |
| 5 | 测试内部清理冗余 | defer | ⏭️ 维持 defer |

所有阻塞项已闭合，建议进入 Round 9 快速复审。
