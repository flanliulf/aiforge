---
Story: 4-3
Round: 1
Date: 2026-03-28
Model Used: Claude Sonnet 4 (via Claude Code)
Review Source: 4-3-code-review-summary-20260328-round-1.md
Review Model: GPT-5.4
Type: Code Review Evaluation
---

## 评估概述

本轮评估对象为 GPT-5.4 产出的首轮代码审查结果（round-1），共 1 条发现（高严重级别），包含 2 个子问题。以下逐条评估。

## 逐条评估

### Finding #1：已损坏的既有 symlink 无法按 AC #5 输出"明确警告"，反而会在重装时直接 fatal

#### 子问题 A：`validateDestPathSecurity()` 对 broken symlink 直接抛 `PATH_TRAVERSAL` fatal

**评估结论：确认有效 ✅ — 需要修复（高优先级）**

**验证过程：**

1. 代码路径分析：`execute-install.ts` 中安装流程为 `validateDestPathSecurity(destPath)` → `determineSymlinkStatus()` → `createSymlink()`。安全校验在状态判定**之前**执行。
2. `fs-utils.ts:504-532`：当 `destPath` 是 broken symlink 时，`lstat()` 成功（symlink 元数据存在），进入 `isSymbolicLink()` 分支。`realpath(destPath)` 抛 `ENOENT`，进入 catch 块。catch 块做了 `readlink` + `validatePathSecurity` 字符串校验后，**无条件抛出 `AiforgeError('PATH_TRAVERSAL', fatal)`**。
3. 关键矛盾：注释明确写了 *"broken symlink 在安装场景中没有合法用途"*，但 AC #5 的场景（先安装成功的 symlink 后来因源文件删除变成 broken）恰恰是一个合法的业务场景，不是安全攻击。

**影响确认：**
- 复现路径清晰：`symlink 安装成功` → `rm 源文件` → `再次执行安装` → `validateDestPathSecurity fatal`。
- 用户拿到的是 fatal 错误而非 AC #5 要求的"明确警告"，验收标准未兑现。

**修复方向认可度：**
- CR 建议"对目标位于 allowedRoot 内的 broken symlink 区分安全问题与业务状态问题"是合理的。
- 具体来说：当 broken symlink 的**目标路径**（通过 `readlink` + `resolve` 得到的绝对路径）在 `allowedRoot` 范围内时，不应视为安全攻击，应允许继续流程（先删除旧 broken link，再创建新链接）。
- 仅当目标路径超出 allowedRoot 时才应拒绝。

---

#### 子问题 B：`checkBrokenLinks()` 跳过 `status === 'skipped'` 的 symlink

**评估结论：确认有效 ✅ — 需要修复（中优先级，依赖子问题 A 先修复）**

**验证过程：**

1. `execute-install.ts:131-133`：`checkBrokenLinks` 中 `if (item.status === 'skipped') continue` 会跳过所有 skipped 状态的结果项。
2. `determineSymlinkStatus`（第 103-118 行）：通过 `readlink(destPath)` 对比 `srcPath`。即使源文件已被删除，symlink 存储的目标路径**字符串值不变**（`readlink` 读的是 symlink 元数据，不检查目标是否存在），因此 `existingTarget === srcPath` 仍为 `true`，返回 `skipped`。
3. 路径分析：当前因子问题 A 存在，broken symlink 会在 `validateDestPathSecurity` 处 fatal，根本到不了 `checkBrokenLinks`。但如果子问题 A 被修复（允许 allowedRoot 内的 broken symlink 通过安全校验），那么：
   - `determineSymlinkStatus` 返回 `skipped`（同路径同目标）
   - `checkBrokenLinks` 跳过 `skipped` 项
   - **断链警告不会输出**，AC #5 仍未兑现

**影响确认：**
- 这是子问题 A 修复后才会暴露的潜在缺口。
- CR 指出的"同路径同目标的 skipped symlink 若已断链仍应告警"分析完全正确。

**修复方向认可度：**
- `checkBrokenLinks` 不应跳过 `status === 'skipped'` 的 symlink 项。断链检测应独立于安装状态——即使链接未被重建（skipped），仍应检查其有效性。
- 或者更精确地说：`checkBrokenLinks` 应该检查**所有 mode='symlink' 的结果项**，而不是排除 skipped。

---

## 测试覆盖评估

CR 指出现有测试"缺失 AC #5 的既有断链复检场景"。

**评估结论：确认准确 ✅**

验证：现有断链测试（第 850-888 行）覆盖的是"新建/更新后形成断链"路径——通过构造指向不存在文件的新 symlink 触发 warn。但未覆盖：
- "**既有 symlink 后来变成 broken，同 plan 再次执行安装**"的场景
- "**skipped 状态的 symlink 断链检测**"的场景

需要补充的测试用例与 CR 建议一致。

---

## 整体评估结论

| 发现 | 子问题 | 严重性 | 评估结论 | 优先级 | 是否误报 |
|------|--------|--------|----------|--------|---------|
| #1 | A — validateDestPathSecurity broken symlink fatal | 高 | **需要修复** | P0 | 否 |
| #1 | B — checkBrokenLinks 跳过 skipped | 中 | **需要修复** | P1（依赖 A） | 否 |
| — | 测试覆盖缺口 | 中 | **需要补充** | P1 | 否 |

### 修复建议优先级排序

1. **P0**：修改 `validateDestPathSecurity` 对 broken symlink 的处理——当目标路径在 allowedRoot 内时，不抛 fatal，允许进入正常安装流程（删旧建新）
2. **P1**：修改 `checkBrokenLinks` 移除 `status === 'skipped'` 的跳过逻辑，确保所有 symlink 结果项都参与断链检测
3. **P1**：补充测试用例覆盖"既有 symlink 断链后重装"和"skipped symlink 断链告警"场景

### 总结

GPT-5.4 本轮审查质量高，发现准确、分析透彻、无误报。所提修复建议方向正确可行。建议按上述优先级执行修复后提交第 2 轮 CR。

## 修复执行记录

### 修复执行记录
- **Date**: 2026-03-28
- **Model Used**: Claude Sonnet 4 (via Claude Code)
- **Fix Items**: 3

---

#### 修复项 1（P0）：`validateDestPathSecurity` broken symlink 处理

**文件**：`src/services/fs-utils.ts`（第 516-525 行）

**修改前**：
- catch 块中 `readlink` + `resolve` 得到 `resolvedTarget` 后，即使 `validatePathSecurity` 通过（目标路径在 `allowedRoot` 内），仍**无条件抛出** `AiforgeError('PATH_TRAVERSAL', fatal)`
- 注释说明"broken symlink 在安装场景中没有合法用途"

**修改后**：
- `validatePathSecurity` 通过后 **直接 `return`**，允许安装流程继续（后续删旧建新）
- 注释更新为"这是合法的业务场景（如：先安装成功的 symlink 后来因源文件删除变成 broken）"
- 仅当 `validatePathSecurity` 抛异常（目标路径超出 `allowedRoot`）时才拒绝

**修复状态**：✅ 成功

---

#### 修复项 2（P1）：`checkBrokenLinks` 移除 `skipped` 跳过逻辑

**文件**：`src/stages/execute-install.ts`（第 131-134 行）

**修改前**：
- `if (item.status === 'skipped') continue` 导致 skipped 状态的 symlink 不参与断链检测

**修改后**：
- 移除 `if (item.status === 'skipped') continue`
- 添加注释说明：即使 symlink 未被重建（同路径同目标），仍应检测链接有效性，确保 AC #5 既有断链场景能输出警告

**修复状态**：✅ 成功

---

#### 修复项 3（P1）：补充 AC #5 断链场景测试用例

**文件**：`tests/stages/execute-install.test.ts`

**新增测试用例**：

1. **"既有 symlink 断链后重装：应输出断链 warn 而非 fatal（AC #5 复检场景）"**
   - 场景：symlink 安装成功 → 删除源文件 → 再次执行相同 plan → 不应 fatal + 应输出断链 warn
   - 验证 P0 修复后 `validateDestPathSecurity` 允许通过，且 `checkBrokenLinks` 检测到断链

2. **"skipped 状态的 symlink 断链告警：同路径同目标但目标不存在时应 warn"**
   - 场景：构造 skipped 状态（同路径同目标）但目标文件不存在的 symlink
   - 验证 P1 修复后 skipped 状态的 symlink 也参与断链检测

**修复状态**：✅ 成功

---

### 验证结果

- `tests/stages/execute-install.test.ts`：**35 测试全部通过**
- 完整测试套件（24 个文件 / 475 个测试）：**全部通过，无回归**
