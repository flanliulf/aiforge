---
Story: 4-2
Round: 1
Date: 2026-03-26
Model Used: GPT-5.4 (gpt-5.4)
Type: Code Review Summary
---

## 审查结论

首轮审查。`npm test`、`npm run lint`、`npm run build` 全部通过，但当前实现仍存在 **2 个阻塞问题**，暂不建议通过。

## 新发现

### 1. [高] `executeInstall()` 只校验 `item.targetPath`，未校验最终文件落点；预置同名 symlink 文件可把 copy 写到 `allowedRoot` 外

- **证据**
  - `src/stages/execute-install.ts:108-135` 先对 `plan.items[*].targetPath` 做一次 `preflight()`，随后对每个文件直接计算 `destPath = join(item.targetPath, basename(srcPath))` 并调用 `copyFile()`。
  - `src/services/fs-utils.ts:225-243,368-462` 的 `preflight()` / `checkTargetWritability()` 只检查 `targetPath` 本身，不检查最终 `destPath`。
  - `tests/stages/execute-install.test.ts:125-385` 未覆盖“目标子文件已存在且为 symlink”场景；`tests/services/fs-utils.test.ts:454-507` 只覆盖 `preflight()` 的 `targetPath` / 祖先 symlink，不覆盖 `executeInstall()` 的最终写入路径。
  - 定向复现：构造 `targetDir=<home>/.copilot/agents`，再预置 `targetDir/config.md -> <outside>/escaped.md`。执行 `executeInstall()` 后返回成功结果，同时 `<outside>/escaped.md` 被改写：
    ```json
    {
      "result": { "items": [{ "status": "updated" }] },
      "outsideContent": "SAFE-CONTENT"
    }
    ```

- **影响**
  - 违反 NFR-S5 / AC #6 的路径安全边界。
  - 攻击者只需在合法安装目录下预置一个同名 symlink 文件，即可把 copy 模式写入重定向到 Home / Project root 外部。
  - 由于结果仍显示为正常的 `updated` / `skipped` 路径，该逃逸不会被 CLI 显式暴露。

- **建议**
  - 在进入 `determineStatus()` / `copyFile()` 前，对每个具体 `destPath` 执行与 `allowedRoot` 对齐的 realpath 安全校验；对不存在的 `destPath`，应校验其最深已存在祖先。
  - 为 `tests/stages/execute-install.test.ts` 增加 1 条回归测试：`targetDir/<basename>` 为指向 root 外部的 symlink 时，`executeInstall()` 必须抛 `PATH_TRAVERSAL`，且外部文件内容不变。

### 2. [中] `preflight()` 会放过“`targetPath` 已存在且为普通文件”的非法状态，实际失败被延迟到安装阶段

- **证据**
  - `src/services/fs-utils.ts:232-240,435-460` 中，`checkTargetWritability()` 对“`targetPath` 是普通文件”的分支只检查 `W_OK`，不会把它视为目录契约违规。
  - `src/stages/execute-install.ts:113-115` 随后无条件执行 `ensureDir(item.targetPath)`；当该路径实际是文件时，会在 install 阶段抛 `ENSURE_DIR_FAILED`。
  - 定向复现：
    - `preflight(plan, pathResolver)` 返回 `{"ok":true,"dirsToCreate":[]}`
    - 紧接着 `executeInstall()` 抛出 `ENSURE_DIR_FAILED`
  - 现有测试 `tests/services/fs-utils.test.ts:233-239` 只验证了 `ensureDir()` 对“路径已是文件”会报错，没有验证 `preflight()` 与 4.2 安装契约的一致性。

- **影响**
  - 违背 AC #6 的 fail-fast 预期：一个已知不可能成功的目标形态绕过了 preflight，直到真正执行安装时才失败。
  - 错误定位被推迟，且报错点从“目标路径形态非法”变成了较晚的 `ENSURE_DIR_FAILED`，诊断精度下降。

- **建议**
  - 当 4.2 的 `MatchedPlan.targetPath` 已存在但不是目录（或合法的目录型 symlink）时，`preflight()` 应立即抛出明确的 fatal 错误（如 `PATH_NOT_DIRECTORY`）。
  - 补 1 条回归测试：`targetPath` 为现存普通文件时，`preflight()` 必须直接失败，而不是等到 `executeInstall()` 的 `ensureDir()`。

## 验证摘要

- `npm test` ✅（455 / 455）
- `npm run lint` ✅
- `npm run build` ✅
- `npm test -- tests/stages/execute-install.test.ts` ✅（15 / 15）
- 定向复现 ❌
  - 预置子级 symlink 文件后，`executeInstall()` 可写出 `allowedRoot` 外
  - `targetPath` 为现存普通文件时，`preflight()` 仍返回 `ok: true`

## 通过项

- `files` / `directories` 基础复制路径、`new` / `updated` / `skipped` 状态判定、缺失源文件时的 fatal 行为、以及 reporter 调用在现有测试覆盖范围内表现正常。
- 全仓测试、lint、build 当前均保持绿色，问题集中在安装边界校验而非基础功能稳定性。
