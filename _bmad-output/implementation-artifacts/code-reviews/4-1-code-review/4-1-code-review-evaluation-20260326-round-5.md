---
Story: 4-1
Round: 5
Date: 2026-03-26
Model Used: Claude Sonnet 4 (Thinking)
Review Source: 4-1-code-review-summary-20260326-round-5.md
Review Model: GPT-5.4 (gpt-5.4)
Type: Code Review Evaluation
---

## 评估总结

对 Story 4-1 第五轮代码审查（GPT-5.4 复审）的发现逐条评估。本轮包含：1 条上轮 P0 修复确认 + 1 条新发现。

**整体结论：上轮 P0 symlink 逃逸修复确认有效。新发现（targetPath 被普通文件占用时 preflight 误判）经源码和 Story 文档交叉验证，判定为误报——Story 权限判定矩阵明确将类型冲突判定排除在 preflight 职责之外，交由 Story 4.4/4.5 处理。建议 Approved。**

---

## 上轮修复确认评估

| Round 4 Finding | 审查结论 | 评估 |
|-----------------|---------|------|
| #1 现存 `targetPath` symlink 目录逃逸 `allowedRoot` | ✅ 已修复 | ✅ **同意** — 源码 `fs-utils.ts:413-433` 确认 `isDirectory()` 和 `isSymbolicLink()` 分支均已补 `validateAncestorRealpath()` 安全校验，测试 `:492-509` 覆盖"targetPath 本身是现存外部 symlink"场景 |
| 质量门禁 | ✅ 440/440, lint green, build green | ✅ **同意** |

上轮修复确认准确，P0 symlink 逃逸问题已真正闭环。

---

## 新发现逐条评估

### Finding #1 [新]: `targetPath` 若被普通文件占用，`preflight()` 仍误判通过 — [中]

| 维度 | 评估 |
|------|------|
| 问题描述准确性 | ⚠️ **技术描述准确，但问题归属错误** |
| 严重性判断 | ❌ **不合理——超出 Story 4-1 职责范围** |
| 修复建议可行性 | ⚠️ **可行但不应在 Story 4-1 中修复** |
| 是否误报 | ✅ **是误报（基于 Story 契约）** |

**评估详情：**

#### 1. CR 的技术观察准确

CR 指出的技术事实经源码验证确认：

- `matchRules()` 产出的 `targetPath` 语义是**目标目录**（`resolveTargetDir()` 返回值，`match-rules.ts:171`）
- 下游 `reporter.ts:26-27` 使用 `join(targetPath, basename(srcFile))` 计算文件级路径，进一步确认 `targetPath` 的目录语义
- `checkTargetWritability()` 的 `else` 分支（`fs-utils.ts:435-441`）对普通文件仅做 `access(W_OK)` 检查，不区分"文件作为安装目标"还是"文件占用了目标目录路径"
- 如果 `targetPath` 位置被普通文件占用，后续 `ensureDir(targetDir)` 或 `join(targetPath, filename)` 操作会失败

这些观察全部正确。

#### 2. 但 Story 权限判定矩阵明确将此场景排除在 preflight 职责之外

**关键证据——Story 4-1 文档（`4-1-fs-utils-and-preflight-check.md:47-56`）权限判定矩阵：**

| 目标状态 | 判定方式 | 结果 |
|---------|---------|------|
| 目标为文件，可写 | `fs.access(targetPath, W_OK)` | **通过**（覆盖由冲突检测 Story 4.4/4.5 决定） |
| 目标为文件，不可写 | `fs.access(targetPath, W_OK)` 失败 | fail-fast |
| 目标为目录 | `fs.stat` 检测 | **通过**（directories 类型正常，files 类型由冲突检测处理） |
| 目标为符号链接 | `fs.lstat` 检测 | **通过**（symlink 模式会先删除再创建） |

矩阵后的注释（第 56 行）明确声明：

> **注意：preflight 只做权限和路径安全校验，不做冲突判定——冲突判定是 Story 4.4/4.5 的职责。**

当前实现完全符合 Story 文档定义的 contract：
- `targetPath` 为普通文件且可写 → 通过 ✅（符合矩阵第 3 行）
- 类型冲突判定（"目标目录位置被文件占用"）→ 不在 preflight 职责范围，交由 Story 4.4/4.5 的冲突检测逻辑处理

#### 3. AC 验证

CR 声称该问题"破坏 AC #2 / AC #4 的 fail-fast 承诺"，逐条验证：

- **AC #2**："验证所有目标路径的父目录可写，验证当前用户有足够权限创建/覆盖文件" — 当 `targetPath` 是可写文件时，权限校验确实通过了。AC #2 描述的是**权限**校验，不是**类型**校验。
- **AC #4**："某个目标路径无写入权限 → fail-fast" — 该 AC 的触发条件是"无写入权限"，而 CR 描述的场景中文件是**有写入权限**的。fail-fast 的承诺没有被违反。

CR 将 `preflight()` 应该做的事情（权限校验）与 Story 4.4/4.5 应该做的事情（类型冲突检测）混淆在一起。

#### 4. 关于 `ensureDir()` 类比的评价

CR 指出 `ensureDir()` 已明确把"目录路径被普通文件占用"视为 fatal（`fs-utils.ts:143-155`）。这是正确的，但 `ensureDir()` 是**安装执行阶段**（Story 4.2/4.3）的工具函数，它在实际执行 `mkdir` 时发现类型冲突并报错，这正是 Story 设计的分层防御策略：

1. **preflight** → 权限 + 路径安全校验（Story 4-1）
2. **冲突检测** → 类型冲突、文件存在性判定（Story 4.4/4.5）
3. **安装执行** → 实际文件操作，有 `ensureDir()` 等兜底错误处理（Story 4.2/4.3）

在 preflight 中提前检测类型冲突虽然技术上可行，但**超出了 Story 4-1 的 AC 范围**，且会与 Story 4.4/4.5 的冲突检测逻辑产生职责重叠。

#### 5. 是否值得作为增强项记录

虽然判定为误报，但 CR 观察到的问题**确实存在设计张力**：`MatchedPlan.targetPath` 在运行时语义上是目录，但 `checkTargetWritability()` 没有利用这个语义信息来做更精确的预检查。

如果在 Story 4.4/4.5 中确实实现了冲突检测（检测到 targetPath 位置被文件占用时报错），那么这个问题就被正确地在后续 Story 中解决了。如果 4.4/4.5 的冲突检测没有覆盖这个场景，那应该在 4.4/4.5 的 Story 中补充，而不是回溯修改 4-1。

**建议**：将此观察记录为 Story 4.4/4.5 的冲突检测注意事项，而不是 Story 4-1 的阻塞项。

---

## 修复优先级汇总

| 优先级 | Finding | 评估结论 |
|--------|---------|----------|
| ~~P0~~ | #1 targetPath 被普通文件占用误判 | **误报** — 符合 Story 权限判定矩阵，类型冲突判定是 Story 4.4/4.5 的职责 |

## 需要修复的项目

无。本轮新发现经评估为误报。

## 可忽略项

| Finding | 忽略理由 |
|---------|---------|
| #1 targetPath 被普通文件占用 | Story 4-1 权限判定矩阵（第 51 行）明确定义"目标为文件，可写 → 通过"，注释（第 56 行）声明"preflight 只做权限和路径安全校验，不做冲突判定"。当前实现完全符合 Story contract。类型冲突检测属于 Story 4.4/4.5 职责范围。 |

## 需进一步讨论项

| 项目 | 讨论内容 |
|------|---------|
| Story 4.4/4.5 冲突检测覆盖范围 | 建议在 Story 4.4/4.5 的冲突检测逻辑中确保覆盖"targetPath（目录语义）位置被普通文件占用"场景，作为 `PATH_NOT_DIRECTORY` 或等价错误处理。这是后续 Story 的增强项，不是 4-1 的阻塞项。 |

## 整体评估结论

**Approved — 建议通过。**

本轮 CR 的上轮修复确认准确（P0 symlink 逃逸已闭环），但新发现经 Story 文档交叉验证为**误报**：

1. **Story 权限判定矩阵**（`4-1-fs-utils-and-preflight-check.md:47-56`）明确定义了 `targetPath` 为普通文件时的行为，并在注释中声明"preflight 只做权限和路径安全校验，不做冲突判定"。
2. **AC #2 和 AC #4** 描述的是权限校验的 fail-fast 承诺，不涉及类型冲突检测。
3. 当前实现完全符合 Story contract，CR 将 preflight 的职责与 Story 4.4/4.5 冲突检测的职责混淆。

**关于 CR 轮次收敛的总结观察：**

Story 4-1 经过 5 轮 CR：
- Round 1：实现正确性（4 条属实）→ 已修复
- Round 2：symlink 边界（3 条属实）→ 已修复
- Round 3：安全语义 + POSIX 精确性（2 条属实 + 1 条遗留）→ 已修复
- Round 4：P0 修复完整性（1 条属实）→ 已修复
- Round 5：P0 已闭环 + 1 条误报（越界到 Story 4.4/4.5 职责）

审查焦点已从"实现正确性"收敛到"跨 Story 职责边界"，表明 Story 4-1 自身的实现已达到稳定状态。建议 Approved 并进入后续 Story 开发。

**质量门禁确认：**
- `npm test` ✅（440 / 440）
- `npm run lint` ✅
- `npm run build` ✅
