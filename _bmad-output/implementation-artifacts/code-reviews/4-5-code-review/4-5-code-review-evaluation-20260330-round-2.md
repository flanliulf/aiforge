---
Story: 4-5
Round: 2
Date: 2026-03-30
Model Used: Claude Sonnet 4 (claude-sonnet-4-20250514)
Review Source: 4-5-code-review-summary-20260330-round-2.md
Review Model: GPT-5.4
Type: Code Review Evaluation
---

## 评估结论摘要

本轮审查共提出 **2 条新增发现**，并对上轮 2 条问题进行了复核。经逐条源码验证：

| # | 严重性 | 审查发现 | 评估结论 | 说明 |
|---|--------|----------|----------|------|
| 上轮 #1 | 高 | Directories 分支绕过冲突处理 | ✅ 复核通过 — 已修复 | 同意审查方复核结论 |
| 上轮 #2 | 中 | 临时文件清理空壳 | ✅ 复核通过 — 已修复 | 同意审查方复核结论 |
| 本轮 #1 | 高 | 目录冲突 backup 会调用文件级 API 失败 | ✅ **确认有效 — 需要修复** | 问题描述准确，严重性合理 |
| 本轮 #2 | 低 | Lint 格式门禁失败 | ✅ **确认有效 — 需要修复** | 问题描述准确，修复简单 |

**整体评估：上轮问题修复质量良好；本轮 2 条新增发现均为真实问题，无误报。建议全部修复。**

---

## 上轮问题复核评估

### 上轮 #1：Directories 分支冲突检测

**审查方复核结论：✅ 已修复**

**评估：同意。** 经源码验证：
- `execute-install.ts:196-203` 新增 `detectDirConflict()` 辅助函数
- `execute-install.ts:438-446` Directories 分支在安装前已调用 `detectDirConflict` + `processConflict`
- `manifest.ts:151-192` 新增 `checkDirConflict()` 目录级冲突判定
- 测试覆盖 skip / overwrite / force / 无冲突 / 无 manifestContext / symlink 6 条路径

修复完整，复核结论正确。

### 上轮 #2：临时文件清理空壳

**审查方复核结论：✅ 已修复**

**评估：同意。** 经源码验证：
- `tmpFiles` 声明和 `finally` 清理块已移除
- 文件头注释和 JSDoc 已更新为描述当前原子写入自清理机制
- `saveManifest()` 的 write-then-rename 逻辑未变，`.tmp` 文件由 `rename()` 原子替换

修复完整，复核结论正确。

---

## 本轮新增发现评估

### 发现 1：[高] 目录冲突选择"备份后覆盖"会走到 `backupFile(dir)` 并直接失败

**评估结论：✅ 确认有效 — 需要修复（优先级：高）**

**问题描述是否准确？** — 是

经源码验证，完整的调用链如下：

1. `execute-install.ts:438-446`：Directories 分支检测到 `user-file` 冲突后进入 `processConflict()`
2. `execute-install.ts:225-230`：`processConflict()` 中 `case 'backup'` 直接调用 `await backupFile(destPath)`
3. `fs-utils.ts:117-132`：`backupFile()` 内部调用 `fsCopyFile(filePath, backupPath)`
4. `fsCopyFile` 是 `node:fs/promises` 的 `copyFile`，这是**文件级 API**，传入目录路径会抛出 `EISDIR` / `ENOTSUP` 错误

同时确认 `conflict-resolver.ts:73-81` 中交互菜单固定包含"备份后覆盖（推荐）"选项，无论冲突目标是文件还是目录。因此目录冲突场景下，用户**可以选择**这个选项，且会触发上述失败路径。

**严重性判断是否合理？** — 是

这是一个由上轮修复（Directories 接入冲突检测）**引入的回归缺陷**：
- 上轮修复前：Directories 不做冲突检测，`backup` 路径不可达 → 无问题
- 上轮修复后：Directories 接入了冲突检测但复用了文件级的 `processConflict()` → `backup` 路径可达但会崩溃

审查方正确识别了这是上轮修复的"附带缺陷"。标记 [高] 合理，因为：
1. 这是用户可见的交互路径（菜单推荐选项）
2. 触发后以 fatal 中断，用户体验差
3. skills 安装（4 条内置规则）是真实使用的高频路径

**修复建议是否可行？** — 可行，建议采用方案 B

审查提出了两个方向：
- **方案 A**：禁止目录场景出现 `backup` 选项 — 可行但体验退化，用户可能期望备份
- **方案 B**：实现目录级备份（递归复制到 `<dir>.aiforge-backup-YYYYMMDD`）— 更完整

建议采用 **方案 B**：在 `fs-utils.ts` 中新增 `backupDir()` 或扩展 `backupFile()` 使其支持目录（内部判断类型后分别调用 `copyFile` 或 `cp -r`），然后在 `processConflict()` 中根据目标类型分发。

如果实现成本考量，方案 A 也可接受（在 `resolveConflict` 或 `processConflict` 中检测目标是否为目录，如果是则过滤掉 backup 选项或 fallback 为 overwrite）。

**评估：需要修复。严重性 [高] 合理。**

---

### 发现 2：[低] 当前 `npm run lint` 失败

**评估结论：✅ 确认有效 — 需要修复（优先级：低）**

**问题描述是否准确？** — 是

经独立执行 `npx prettier --check` 验证，确认以下 2 个文件存在格式问题：
- `src/stages/execute-install.ts`
- `tests/stages/execute-install.test.ts`

**严重性判断是否合理？** — 是

格式问题不影响功能，但属于项目质量门禁要求。标记 [低] 合理。

**修复建议是否可行？** — 是

执行 `npx prettier --write` 即可一键修复，修复成本极低。

**是否为误报？** — 否

这大概率是上轮 CR 修复过程中引入的格式偏差（手动编辑未经过 Prettier 格式化）。

**评估：需要修复。严重性 [低] 合理。**

---

## 修复优先级排序

| 优先级 | 发现 # | 问题 | 修复建议 |
|--------|--------|------|----------|
| P0（高） | 本轮 #1 | 目录冲突 backup 路径会 fatal | 扩展 `backupFile` 支持目录，或在目录场景过滤 backup 选项 |
| P2（低） | 本轮 #2 | Prettier 格式门禁失败 | `npx prettier --write` 修复 2 个文件 |

## 整体评估

本轮 CR 审查质量 **高**，审查方（GPT-5.4）连续两轮保持高质量输出：

- **上轮复核准确**：2 条已修复问题复核结论正确，验证位置精准
- **新增发现有效**：发现 #1 精准捕捉了上轮修复引入的回归缺陷，这种"修复带来的新问题"检测尤为有价值
- **0 条误报**：本轮 2 条发现均经验证确认为真实问题
- **建议实用**：修复方向均可行，且给出了多种选择

建议先修复发现 #1（目录 backup 缺陷）和发现 #2（Prettier 格式），然后进入第 3 轮 CR 确认收口。

## 修复执行记录

### 修复执行记录
- **Date**: 2026-03-30
- **Model Used**: Claude Sonnet 4 (claude-sonnet-4-20250514)
- **Fix Items**: 2

---

#### 修复 #1：[P0/高] 目录冲突 backup 路径支持

**修复状态：✅ 已完成**

**问题根因：** `processConflict()` 中 `case 'backup'` 直接调用 `backupFile(destPath)`，该函数内部使用 `fsCopyFile`（文件级 API），传入目录路径会抛出 `EISDIR` 错误。这是 Round-1 修复（Directories 接入冲突检测）引入的回归缺陷。

**修复方案：** 方案 B — 实现目录级备份

**修改文件：**

1. **`src/services/fs-utils.ts`**
   - 新增 `backupDir()` 导出函数：使用 `cp(dirPath, backupPath, { recursive: true })` 递归复制目录
   - 备份命名规则与 `backupFile` 一致：`<原路径>.aiforge-backup-YYYYMMDD`
   - 错误处理：捕获异常后抛出 `AiforgeError(code: 'BACKUP_FAILED', severity: 'fatal')`

2. **`src/stages/execute-install.ts`**
   - 新增 `stat` import（用于判断目标类型）
   - 新增 `backupDir` import
   - `processConflict()` 中 `case 'backup'` 修改为：
     - 先通过 `stat(destPath)` 判断目标是文件还是目录
     - 目录 → 调用 `backupDir(destPath)`
     - 文件 → 调用 `backupFile(destPath)`（原逻辑不变）

3. **`tests/services/fs-utils.test.ts`**
   - 新增 `backupDir` describe 块，3 个测试用例：
     - 递归备份目录并返回备份路径
     - 原目录备份后保持不变
     - 目录不存在时抛出 `BACKUP_FAILED`

4. **`tests/stages/execute-install.test.ts`**
   - 新增集成测试：Directories copy + user-file 冲突 + 备份后覆盖 → 备份目录存在 + 新目录被安装
   - 验证备份目录内容完整性

---

#### 修复 #2：[P2/低] Prettier 格式门禁修复

**修复状态：✅ 已完成**

**修改文件：**

1. **`src/stages/execute-install.ts`** — Prettier 自动格式化
2. **`tests/stages/execute-install.test.ts`** — Prettier 自动格式化

**修复方式：** `npx prettier --write` 一键修复，修复后 `npx prettier --check` 验证通过。

---

#### 测试验证

| 指标 | 修复前 | 修复后 |
|------|--------|--------|
| Story 相关测试 | 70 | 74 (+4) |
| 全仓测试总数 | 531 | 535 (+4) |
| 通过率 | 100% | 100% |
| 新增 `backupDir` 单元测试 | 0 | 3 |
| 新增 Directories backup 集成测试 | 0 | 1 |
| Prettier 检查 | ❌ 失败 | ✅ 通过 |
