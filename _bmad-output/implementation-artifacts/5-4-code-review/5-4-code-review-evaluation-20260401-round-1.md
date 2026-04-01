---
Story: 5-4
Round: 1
Date: 2026-04-01
Model Used: Claude Sonnet 4 (Anthropic)
Review Source: 5-4-code-review-summary-20260401-round-1.md
Review Model: GPT-5.4
Type: Code Review Evaluation
---

## 评估概述

本轮对 GPT-5.4 产出的 Story 5-4 第 1 轮代码审查结果（3 条发现）逐条进行独立评估，交叉验证代码事实与 Story AC 要求。

## 逐条评估

### Finding #1: [高] 认证失败真实链路没有生成 AC #1 要求的 `无法访问仓库 / 401 / 修复命令`

**审查描述准确性**：✅ 准确

**代码事实核实**：

- `src/stages/clone.ts:245-261` 确认：`git.clone()` 失败时统一抛出 `CLONE_FAILED`，`message` 固定为 `'克隆仓库失败'`，`why` 直接取 `error.message`。**没有**根据底层错误内容（如 401、`Authentication failed`）做条件判断分支，也**没有**映射为 `AUTH_FAILED` 错误类型。
- `src/` 全目录 Grep `AUTH_FAILED` 结果为空——生产代码中**不存在**任何创建 `AUTH_FAILED` 错误的代码路径。
- `tests/core/reporter.test.ts:981-1001` 手工构造了一个 `new AiforgeError('无法访问仓库', 'AUTH_FAILED', ...)` 来测试渲染，但这个 `AUTH_FAILED` 对象在生产代码中不会被任何模块创建。
- Story AC #1 明确要求：认证失败时显示 `❌ 无法访问仓库` → `Git 服务器返回 401` → 修复命令。当前代码无法满足。

**严重性判断**：✅ 合理。这是 Story 核心 AC #1 的未达标，标 [高] 恰当。

**修复建议可行性**：✅ 可行。在 clone/pull 失败的 catch 块中识别认证相关错误关键词并映射为专门的 `AiforgeError` 是标准做法。

**评估结论**：🔴 **需要修复（高优先级）**。CR 判断完全正确，生产代码确实缺失 `AUTH_FAILED` 的创建链路，导致 AC #1 实质未满足。

---

### Finding #2: [高] `CLONE_FAILED` / `PULL_FAILED` 直接透传底层 git 错误，存在 token 泄露风险

**审查描述准确性**：✅ 准确

**代码事实核实**：

- `src/stages/authenticate.ts:24-25` 确认 token 模式构建 `https://oauth2:${token}@host/repo.git`。
- `src/stages/clone.ts:250` — `CLONE_FAILED` 的 `why` 直接取 `error instanceof Error ? error.message : '未知网络错误'`，**没有**调用 `sanitizeUrl()` 或 `sanitizeToken()`。
- `src/stages/clone.ts:280` — `PULL_FAILED` 的 `why` 同样直接取 `error.message`，**没有**脱敏。
- `src/core/sanitize.ts` 存在 `sanitizeUrl()` 和 `sanitizeToken()` 函数，但 clone.ts 的错误创建路径**未引用**这两个函数。
- `_bmad-output/project-context.md:149` 明确规定 "All logs/errors use `sanitizeToken()` from `core/sanitize.ts`"。
- `_bmad-output/project-context.md:156` 明确规定 "新增任何 `AiforgeError` 的 `why` 字段时，检查是否包含用户原始输入——如果是，必须通过 sanitizeUrl/sanitizeToken 处理，不能有'漏调'"。
- simple-git 在 clone 失败时的错误信息中**可能**包含完整的远端 URL（含 token），这将导致 token 通过 reporter 输出到 stderr。

**严重性判断**：✅ 合理。安全风险 + 违反项目明确的脱敏规则，标 [高] 恰当。

**修复建议可行性**：✅ 可行。在写入 `why` 前调用 `sanitizeUrl(errorMessage)` 即可。建议同时增加负向测试。

**评估结论**：🔴 **需要修复（高优先级）**。CR 判断完全正确，这是一个真实的安全风险点。token 泄露是 P0 级别问题。

---

### Finding #3: [中] "跨模块错误文案审计"并未真正收口，`NO_TOOLS` / `PERMISSION_DENIED` 等场景仍与 Story 约定不一致

**审查描述准确性**：⚠️ 部分准确，存在争议点

**代码事实核实**：

**NO_TOOLS 场景：**
- Story Task 2.7 原文：`fix: ['npx aiforge --tools copilot claude']`
- `src/stages/detect-tools.ts:179-182` 实际产出：`'安装 GitHub Copilot、Claude Code、Cursor 或 VS Code'` + `` `使用 --tools <id> 手动指定工具，支持: ${TOOL_DEFINITIONS.map((t) => t.id).join(', ')}` ``
- CR 说"Story 要求 `npx aiforge --tools copilot claude`，但生产代码仍返回占位式说明"——**这一点准确**。生产代码给出的是一条**描述性说明**（`使用 --tools <id> 手动指定工具`），而非 Story 要求的可直接复制执行的命令。用户需要自己替换 `<id>` 才能运行。
- 但需指出：`detect-tools.test.ts:386` 的测试断言的是 `f.includes('--tools') && f.includes('copilot')`——这是因为动态拼接的字符串确实包含 `copilot` 作为支持工具列表的一部分（逗号分隔），测试技术上能通过，但这并不等价于 Story 要求的 `npx aiforge --tools copilot claude` 可复制命令格式。

**PERMISSION_DENIED 场景：**
- Story Task 2.4 原文：`fix: ['chmod 755 <target-dir>', 'sudo npx aiforge -g']`
- `src/services/fs-utils.ts:429-431` 实际产出：`['检查目录权限: ls -la ${dirname(ancestorDir)}', '尝试以 sudo 运行，或联系系统管理员修复权限']`
- CR 说"Story 要求 `chmod 755 <target-dir>` / `sudo npx aiforge -g`"——**这一点准确**。生产代码给出的是诊断建议，而非 Story 约定的可复制命令。
- 更值得注意的是 `reporter.test.ts:1008-1014` 手工构造的测试对象使用了 Story 要求的理想文案（`chmod 755 <target-dir>`, `sudo npx aiforge -g`），但这和生产代码实际抛出的 fix 内容**不一致**。这正是 CR 指出的"手工伪造错误对象代替真实错误源"问题的具体表现。

**严重性判断**：✅ 合理。标 [中] 恰当——功能不影响核心流程可用性，但与 Story 承诺的 AC #4 不一致。

**修复建议可行性**：✅ 可行。直接修改生产代码中的 fix 文案对齐 Story 要求即可。补充真实链路测试也是正确方向。

**评估结论**：🟡 **需要修复（中优先级）**。CR 判断正确，生产代码的 fix 内容确实与 Story 约定不一致。特别值得关注的是测试体系存在的"手工构造 vs 真实生产"脱节问题——测试全绿不代表 AC 满足。

---

## 关于 Dev Agent Record 的补充观察

Dev Agent Record（Story 文件中 Task 2.4 / 2.7 的 Completion Notes）声称"PERMISSION_DENIED 已有 `ls -la` / `sudo` 命令，符合要求，无需修改"和"NO_TOOLS 的 fix 动态包含了所有支持工具 ID 的 `--tools` 命令，已满足 Story 要求"。

实际情况是：
- PERMISSION_DENIED 的 fix 是 `ls -la` + 泛化 sudo 提示，而非 Story 要求的 `chmod 755` + `sudo npx aiforge -g`
- NO_TOOLS 的 fix 是描述性说明，而非 Story 要求的可复制命令

这两处 Completion Notes 的"无需修改"结论与代码事实存在出入，需在修复时一并更正。

---

## 整体评估结论

### 需要修复（按优先级排序）

| # | 优先级 | 问题 | 理由 |
|---|--------|------|------|
| 1 | 🔴 高 | 认证失败链路缺失 AUTH_FAILED 映射 | AC #1 核心未满足，且 Finding #2 的脱敏修复依赖此项（需要先识别认证失败才能正确脱敏） |
| 2 | 🔴 高 | CLONE_FAILED / PULL_FAILED 的 why 未脱敏 | 安全风险，违反项目脱敏规则，P0 |
| 3 | 🟡 中 | NO_TOOLS / PERMISSION_DENIED fix 文案与 Story 不一致 | AC #4 部分未满足，测试存在覆盖空洞 |

### 可以忽略的发现

无。本轮 CR 的 3 条发现均经代码核实，无误报。

### 需要进一步讨论的事项

无。3 条发现的修复方向明确，无需额外讨论。

## 对 CR AC 复核结论的评估

| AC | CR 结论 | 评估意见 |
|----|---------|----------|
| #1 | ❌ 未满足 | ✅ 同意。`AUTH_FAILED` 链路确实不存在于生产代码 |
| #2 | ✅ 基本满足 | ✅ 同意。三段式排版实现正确 |
| #3 | ✅ 满足 | ✅ 同意。stderr 输出正确 |
| #4 | ⚠️ 部分满足 | ✅ 同意。多个场景的 fix 文案未对齐 Story 要求 |

## 修复执行记录

### 修复执行记录
- **Date**: 2026-04-01
- **Model Used**: Claude Sonnet 4 (claude-sonnet-4.6)
- **Fix Items**: 4

---

#### 修复项 #1（高优先级）：CLONE_FAILED / PULL_FAILED 的 why 未脱敏

**涉及文件**：
- `src/core/sanitize.ts`：新增 `sanitizeMessage()` 函数，支持对嵌入任意字符串中的 token-bearing URL 做全局脱敏（`sanitizeUrl` 仅处理纯 URL，正则带 `^` 锚点，无法处理 git 错误消息中嵌入的 URL）
- `src/stages/clone.ts`：`freshClone` 和 `incrementalUpdate` 的 catch 块引入 `sanitizeMessage`，`why` 字段改用 `safeMessage = sanitizeMessage(rawMessage)`

**修改前后差异**：
- `sanitize.ts`：新增 `sanitizeMessage` 函数，使用全局替换正则 `/(https?:\/\/)([^@\s]+)(@[^\s]*)/g`
- `clone.ts`：`import { sanitizeMessage }` from sanitize.ts；`why` 字段由 `error.message` 改为 `sanitizeMessage(rawMessage)`

**验证结果**：测试 `clone 失败（非认证）时 CLONE_FAILED.why 不包含原始 token` 和 `pull 失败（非认证）时 PULL_FAILED.why 不包含原始 token` 均通过

---

#### 修复项 #2（高优先级）：认证失败链路缺失 AUTH_FAILED 映射

**涉及文件**：
- `src/stages/clone.ts`：`freshClone` 和 `incrementalUpdate` 的 catch 块新增认证失败识别逻辑
- `src/core/errors.ts`：`EXIT_AUTH_FAILURE` 已存在，直接引用

**修改后逻辑**：
```
rawMessage = error.message
if /Authentication failed|could not read Username|401|Invalid credentials|unauthorized/i.test(rawMessage):
  → throw AiforgeError('无法访问仓库', 'AUTH_FAILED', EXIT_AUTH_FAILURE, 'fatal', 'Git 服务器返回 401（认证失败）', ['npx aiforge --ssh', 'npx aiforge --token <your-token>', 'npx aiforge init'])
else:
  → throw AiforgeError('克隆仓库失败'/'增量更新失败', 'CLONE_FAILED'/'PULL_FAILED', ...)
```

**Story AC #1 满足情况**：`❌ 无法访问仓库` → `Git 服务器返回 401（认证失败）` → 修复命令（含 --ssh / --token / init）✅

**验证结果**：新增 `clone 认证失败（401）时抛出 AUTH_FAILED`、`pull 认证失败（401）时抛出 AUTH_FAILED` 等 4 条真实链路测试，均通过

---

#### 修复项 #3（中优先级）：NO_TOOLS fix 文案与 Story Task 2.7 不一致

**涉及文件**：
- `src/stages/detect-tools.ts` 第 181 行

**修改前**：
```
`使用 --tools <id> 手动指定工具，支持: ${TOOL_DEFINITIONS.map((t) => t.id).join(', ')}`
```
**修改后**：
```
`npx aiforge --tools ${TOOL_DEFINITIONS.map((t) => t.id).join(' ')}`
```

**Story Task 2.7 约定**：`fix: ['npx aiforge --tools copilot claude']`，即可直接复制执行的命令。修改后命令格式为 `npx aiforge --tools copilot claude cursor vscode`，满足约定。

**验证结果**：已有测试 `NO_TOOLS fix 包含 npx aiforge --tools 具体命令` 通过（断言 `f.includes('--tools') && f.includes('copilot')` ✅）

---

#### 修复项 #4（中优先级）：PERMISSION_DENIED fix 文案与 Story Task 2.4 不一致

**涉及文件**：
- `src/services/fs-utils.ts` 第 429-431 行（`checkTargetWritability` 函数中目标不存在场景的 fix）

**修改前**：
```
`检查目录权限: ls -la ${dirname(ancestorDir)}`
`尝试以 sudo 运行，或联系系统管理员修复权限`
```
**修改后**：
```
`chmod 755 ${ancestorDir}`
`sudo npx aiforge -g`
```

**Story Task 2.4 约定**：`fix: ['chmod 755 <target-dir>', 'sudo npx aiforge -g']`，修改后对齐。

**验证结果**：新增真实链路测试 `PERMISSION_DENIED fix 包含 chmod 755 和 sudo npx aiforge -g` 通过

---

#### 新增测试汇总

| 文件 | 新增测试数 | 描述 |
|------|-----------|------|
| `tests/stages/clone.test.ts` | +4 | AUTH_FAILED 真实链路、CLONE_FAILED why 脱敏、PULL_FAILED 认证失败、PULL_FAILED why 脱敏 |
| `tests/services/fs-utils.test.ts` | +1 | PERMISSION_DENIED fix 文案验证 |
| `tests/core/sanitize.test.ts` | +4 | sanitizeMessage 函数各场景覆盖 |

**全仓测试结果**：28 文件 / 629 测试 / 100% 通过 ✅

