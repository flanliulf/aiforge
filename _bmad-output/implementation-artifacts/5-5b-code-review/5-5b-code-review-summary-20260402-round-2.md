---
Story: 5-5b
Round: 2
Date: 2026-04-02
Model Used: GPT-5.4 (model ID: gpt-5.4)
Type: Code Review Summary
---

## 审查结论

本轮为复审。Round 1 指出的 P1 阻塞项（`Directories` 规则在 `saveManifest` 阶段触发 `FILE_HASH_FAILED`）已修复：`src/pipeline.ts:253-283` 现对 `InstallType.Directories` 结果跳过 `fileHash()`，改为显式写入目录型占位 hash；同时 `tests/integration/pipeline.test:691-736` 已补上 `claude:global` 含 `Directories` 的真实全链路回归测试。当前 `npm test` ✅ `692/692`、`npm run build` ✅；仓库级 `npm run lint` 仍 ❌，但失败来源仍是 `.agent/` 下外部技能文件被 `prettier --check .` 扫描，Story 5.5b 范围内定向 `eslint + prettier --check` 已通过。Round 1 的矩阵覆盖缺口本轮未继续扩展，但维持非阻塞 CR TODO 评估。因此，**本轮建议通过（保留 CR TODO）**。

## 上轮问题回顾

### 已修复

1. Round 1 / Finding #1 — `Directories` 规则在真实管道中会于 `saveManifest` 阶段触发 `FILE_HASH_FAILED`
   - `src/pipeline.ts:253-283` 已新增 `InstallType.Directories` 分支：目录型结果不再调用 `fileHash(item.targetPath)`，而是写入显式占位值 `''`。
   - `tests/integration/pipeline.test:691-736` 已新增 `saveManifest：claude:global（含 Directories 类型 skills）全链路不抛 FILE_HASH_FAILED`，验证 `stages.saveManifest(result)` 不再抛错，且 `skills` 目录条目成功写入 manifest。
   - 全量回归 `npm test` 现为 `692/692`，包括既有 `pipeline-production-stages` manifest 集成测试，说明本次修复未回退现有 `Files` / `Flatten` 语义。
   - **验证结果**：✅ 已修复。

### 仍为非阻塞待办

1. Round 1 / Finding #2 — AC #1 要求的“真实规则矩阵”尚未被完整 E2E 覆盖
   - 本轮未看到 `copilot` / `vscode` / `cursor:project` 的矩阵级扩展；当前 Story 级 AC #1 覆盖仍主要集中在 `claude:global`、`claude:project`、`cursor:global`，外加本轮新增的 `claude:global + saveManifest` 修复验证。
   - 维持 Round 1 评估文件中的既有结论：**CR TODO / 非阻塞**。当前代表性路径与三种 `InstallType` 已有覆盖，剩余矩阵扩展可后续补齐。

## 新发现

本轮未发现新的阻塞项或中高优先级问题。

## 验证摘要

- `npm test` ✅（`692 / 692`）
- `npm run lint` ❌（`prettier --check .` 仍被 `.agent/` 下外部技能文件拖红；不属于 Story 5.5b 变更路径）
- `npm run build` ✅
- 额外复核：
  - `npx eslint src/pipeline.ts tests/integration/pipeline.test.ts tests/integration/pipeline-production-stages.test.ts tests/integration/dry-run.test.ts tests/integration/install-modes.test.ts tests/integration/edge-cases.test.ts` ✅
  - `npx prettier --check src/pipeline.ts tests/integration/pipeline.test.ts tests/integration/pipeline-production-stages.test.ts tests/integration/dry-run.test.ts tests/integration/install-modes.test.ts tests/integration/edge-cases.test.ts tests/fixtures/sample-repo/...` ✅
  - 代码复核 `src/services/manifest.ts:167-191`：目录冲突判定仍走 `checkDirConflict()`，不消费目录条目的 `hash` 字段，本轮占位值方案未引入新的冲突判定回归

## 通过项

- Round 1 的 P1 缺陷已进入生产代码修复，而非继续通过测试绕行规避。
- 新增 `claude + Directories + saveManifest` 全链路验证后，真实目录安装路径已被回归保护覆盖。
- 原有 `dry-run`、安装模式、边界场景、`pipeline-production-stages` 与 manifest 相关测试全部持续通过。
- `Files` 与 `Flatten` 的既有 manifest 语义未受本轮修复影响，构建输出也保持正常。

## 结论

- **结论：通过（Story Scope Approved with CR TODO）**
- **阻塞项**：无
- **建议**：
  - Story 5.5b 可进入关闭/合并流程；
  - 将 Round 1 / Finding #2 继续作为 CR TODO 跟踪，后续补齐 `copilot` / `vscode` / `cursor project` 的规则矩阵覆盖；
  - 可顺手同步 `_bmad-output/implementation-artifacts/5-5b-e2e-integration-tests.md` 的 `Dev Agent Record`，移除“仅用 cursor 规避 Directories bug / 无需修改生产代码”的过时描述，避免和当前实际修复状态不一致。
