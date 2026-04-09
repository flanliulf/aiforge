---
Story: 5-5b
Round: 1
Date: 2026-04-02
Model Used: GPT-5.4 (model ID: gpt-5.4)
Type: Code Review Summary
---

## 审查结论

首轮审查。`npm test` ✅ `691/691`、`npm run build` ✅；仓库级 `npm run lint` ❌，但失败来源是 `.agent/` 下外部技能文件被 `prettier --check .` 扫描，不是 Story 5-5b 新增测试文件。对本 Story 新增的 `tests/integration/*` 与 fixture 文件做定向 `eslint + prettier --check` 已通过。

当前仍存在 **1 个真实阻塞问题** 和 **1 个 AC 覆盖缺口**：`Directories` 规则在真实管道执行到 `saveManifest` 时会直接 fatal，且 Story 所称的“按 `BUILTIN_RULES` 真实规则矩阵验证”尚未完整落地。因此，**本轮不建议通过**。

## 新发现

### 1. [高] `Directories` 规则在真实管道中会于 `saveManifest` 阶段触发 `FILE_HASH_FAILED`

- **证据**
  - `src/stages/execute-install.ts:527-589` 对 `InstallType.Directories` 产出的 `InstallResult.item.targetPath` 是目录路径，例如 `~/.claude/skills/code-review`。
  - `src/pipeline.ts:253-257` 在 `saveManifest` 中对所有 `status: 'new' | 'updated'` 项统一执行 `fileHash(item.targetPath)`。
  - `src/services/fs-utils.ts:230-248` 的 `fileHash()` 通过文件流读取目标路径；对目录路径会抛出 `AiforgeError(code: 'FILE_HASH_FAILED')`。
  - `_bmad-output/implementation-artifacts/5-5b-e2e-integration-tests.md:169-170` 已明确记录：本 Story 的 `saveManifest` E2E 测试为规避该问题，刻意改用只含 `Flatten + Files` 的 `cursor` 路径，而不是修复生产链路。
  - 定向复现结果：对 `claude + sample-repo` 的真实 `matchRules → executeInstall` 输出目录项执行 `fileHash()`，实际返回 `FILE_HASH_FAILED`，目录样例为 `.../.claude/skills/code-review`。

- **影响**
  - 真实用户执行 `runPipeline()` 时，只要命中 `Directories` 规则（如 `claude skills`、`copilot skills`），安装动作完成后就会在 `saveManifest` 阶段以 fatal 失败结束。
  - 这不是单纯“测试缺口”，而是核心全局/项目安装路径的真实发布阻塞；当前 Story 通过“绕开故障路径”的方式拿到绿灯，未能证明系统整体可用。

- **建议**
  - 修复 `saveManifest` 对目录安装项的持久化语义：目录型结果不能直接复用 `fileHash(item.targetPath)`；应改为目录级稳定摘要，或为目录型条目采用独立的 manifest 表达方式。
  - 新增真实集成测试，至少覆盖 `claude global/project skills[Directories]` 与 `copilot global/project skills[Directories]` 的 `runPipeline → saveManifest` 全链路，并断言不会再抛 `FILE_HASH_FAILED`。

### 2. [中] AC #1 要求的“真实规则矩阵”尚未被完整 E2E 覆盖

- **证据**
  - `src/data/install-rules.ts:13-127` 当前 `BUILTIN_RULES` 共 16 条，覆盖 `copilot` / `claude` / `cursor` / `vscode` 的 global/project 组合。
  - `tests/integration/pipeline.test.ts:546-688` 的 Story 5-5b 新增 E2E 只覆盖了 `claude global`、`claude project` 和 `cursor global` 的局部路径；未看到 `copilot`、`vscode`、`cursor project` 的矩阵级断言。
  - `_bmad-output/implementation-artifacts/5-5b-e2e-integration-tests.md:13-19` 的 AC #1 明确要求“按 `BUILTIN_RULES` 真实规则矩阵验证安装结果与规则映射一致”。

- **影响**
  - 当前更接近“代表性样例验证”，而不是 Story AC 声称的规则矩阵验证；`copilot` / `vscode` 等工具的目标路径、资源类型和规则映射回归仍可能漏检。
  - 这会削弱 Story 5-5b “发布前自动验证系统整体可用性”的目标，也使 Finding #1 这类跨工具问题更容易被局部样例掩盖。

- **建议**
  - 将 AC #1 直接落成矩阵测试：以 `BUILTIN_RULES` 为基准遍历 tool/scope/type，对每条存在 fixture 资源的规则验证 `match` 产物与最终安装结果。
  - 若个别规则因 fixture 不具备对应资源而暂不覆盖，需在 Story 文档中显式记录豁免范围与理由，而不是默认跳过。

## 验证摘要

- `npm test` ✅（`691 / 691`）
- `npm run lint` ❌（`prettier --check .` 被 `.agent/` 下外部技能文件拖红；Story 5-5b 新增测试与 fixture 的定向 `eslint + prettier --check` 已通过）
- `npm run build` ✅
- 定向复现 ❌
  - 复现 `Directories + saveManifest` 链路时，目录目标 `.../.claude/skills/code-review` 触发 `FILE_HASH_FAILED`
  - 仓库扫描未发现 `.github/workflows/*`，因此本轮未找到 Linux CI 自动验证证据

## 通过项

- `tests/integration/install-modes.test.ts` 已对 copy / symlink / flatten 三种安装模式给出真实闭包级验证，并覆盖 `LINK_PROJECT_REJECTED`。
- `tests/integration/edge-cases.test.ts` 已覆盖 `--force`、backup、skip、零结果诊断与排除列表，样例质量整体较好。
- `tests/integration/dry-run.test.ts` 已验证 dry-run 的无副作用，以及 copy / flatten 场景下的完整目标路径一致性。
- 新增 `tests/fixtures/sample-repo/` 结构真实、可读性好，适合作为后续矩阵扩展的基础 fixture。

## 结论

- **结论：不通过**
- **阻塞项**：
  - Finding #1：`Directories` 规则真实管道执行会在 `saveManifest` 阶段 fatal
  - Finding #2：AC #1 的“真实规则矩阵”覆盖尚未达成
- **建议**：
  - 先修复目录型 manifest 持久化缺陷，并补齐 `Directories` 全链路回归测试；
  - 再扩展 AC #1 的矩阵验证范围，至少覆盖 `copilot` / `claude` / `cursor` / `vscode` 当前内置规则中有 fixture 支撑的全部路径；
  - 修复后重新发起 Round 2 CR。
