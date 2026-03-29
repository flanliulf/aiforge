---
Story: 4-4
Round: 1
Date: 2026-03-29
Model Used: GPT-5.4
Type: Code Review Summary
---

## 审查结论

本轮为**首轮审查**。整体实现方向正确，`loadManifest` / `saveManifest` / `checkConflict` 的主体逻辑与 AC 基本对齐，相关单测、全量测试、`build`、`lint` 均通过。

但当前实现仍有 **2 个需要修复的问题**，其中 1 个属于数据契约不一致，1 个属于 manifest 数据完整性风险。建议修复后再进入下一轮 CR。

## 审查发现

### 1. `manifest.source` 写入了绝对路径，违背 Story 约定的“源文件相对路径”

- 严重级别：**Major**
- 证据：
  - Story 中 `ManifestEntry` 说明明确要求 `source: string; // 源文件相对路径`：`_bmad-output/implementation-artifacts/4-4-manifest-state-and-conflict-detection.md:44`
  - `scanSourceFiles()` 明确返回**绝对路径**：`src/stages/match-rules.ts:89-91,116,126`
  - `buildManifestEntries()` 直接把 `item.sourcePath` 原样写入 `source`：`src/services/manifest.ts:173-182`
- 问题说明：
  - 当前 manifest 会持久化机器本地 repo 绝对路径，例如 `/repo/.../CLAUDE.md`，这与 Story 约定的数据语义不一致。
  - 绝对路径会把 manifest 绑定到当前克隆目录，降低可移植性，也会让后续基于 `source` 的诊断/比对失去稳定语义。
- 建议修复：
  - 在构建 manifest 条目时，把 `sourcePath` 规范化为相对于知识仓库根目录的相对路径，再写入 `source`。
  - 同时补一条单测，明确断言 `source` 为相对路径而非绝对路径。

### 2. `buildManifestEntries()` 对缺失 hash 静默写入空字符串，会生成不合法的 manifest 条目

- 严重级别：**Major**
- 证据：
  - AC 要求每条记录包含 `hash`（SHA256）：`_bmad-output/implementation-artifacts/4-4-manifest-state-and-conflict-detection.md:11-14`
  - 当前实现使用 `hashes.get(item.targetPath) ?? ''`：`src/services/manifest.ts:181`
- 问题说明：
  - 如果调用方漏传某个 `targetPath` 的 hash，当前代码不会报错，而是把空字符串写入 manifest。
  - 这会产生“看起来成功、但数据已损坏”的结果，后续 `checkConflict()` 基于该条目判断时也可能出现错误分类。
- 建议修复：
  - 不要使用 `?? ''` 兜底；应在缺失 hash 时显式抛错，或在函数内部补算 hash，确保写出的 manifest 条目始终满足 AC 的数据完整性要求。
  - 增加对应失败路径测试，防止再次回归为静默空值。

## 正向观察

- `loadManifest()` 对丢失/损坏 manifest 的降级语义清晰，且 `degraded` 标志能支撑 `unknown-origin` 与 `user-file` 的语义区分：`src/services/manifest.ts:52-65,133-148`
- `saveManifest()` 采用 `tmp + rename` 的原子写入，符合 AC #2：`src/services/manifest.ts:79-93`
- `checkConflict()` 的冲突矩阵与 Story 描述一致，相关单测覆盖完整：`src/services/manifest.ts:113-148`，`tests/services/manifest.test.ts`

## 验证记录

已执行并通过：

- `npm test -- tests/services/manifest.test.ts`
- `npm test`
- `npm run build`
- `npm run lint`

## 建议

先修复以上 2 项，再发起第 2 轮 CR。复审时建议重点核对：

1. `manifest.source` 是否已改为 repo-relative 路径
2. `buildManifestEntries()` 是否已消除空 hash 的静默兜底
3. 是否新增针对上述两点的回归测试
