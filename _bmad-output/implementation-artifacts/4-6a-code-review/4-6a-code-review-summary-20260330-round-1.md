---
Story: 4-6a
Round: 1
Date: 2026-03-30
Model Used: GPT-5.4
Type: Code Review Summary
---

# 审查结论

本轮结论：**需要修复后再合并**。

主流程编排、fatal 错误停止、`saveManifest()` 调用时序都已接通；`npm run lint`、`npm run build`、`npm test` 也全部通过（553/553）。但本次实现仍有 2 个会污染 manifest 数据的缺陷，以及 1 个直接导致缺陷漏检的测试覆盖缺口。

## 发现 1（新发现）

**标题：`saveManifest()` 会把 flatten 安装记录写成错误的 `mode`，并丢失规则类型信息**

- 严重性：中
- 位置：
  - `src/pipeline.ts:219-268`
  - `src/core/types.ts:99-105`
  - `src/services/manifest.ts:208-234`
  - `src/data/install-rules.ts:110-122`

**问题说明：**

`ManifestEntry.mode` 的契约明确允许 `'copy' | 'symlink' | 'flatten'`，而现实现从 `MatchedPlan.mode` 回填 manifest，只能写出 `'copy' | 'symlink'`。这意味着所有 flatten 安装都会被错误持久化为 copy/symlink。

这个问题在当前规则表里已经可命中：`cursor` 项目级同时存在两条目标为 `.cursor/rules/` 的规则：

- `skills` → `Flatten`
- `agents` → `Files`

`saveManifest()` 里又用 `targetPath` 作为唯一 key 建 `Map`，同目标根目录的规则会互相覆盖，最终无法恢复“这条记录来自 flatten 规则”这一关键信息。

**影响：**

- manifest 写入的数据与类型契约不一致；
- flatten 结果在后续诊断、迁移或依赖 `ManifestEntry.mode` 的逻辑中会被误判；
- 现有 `buildManifestEntries()` 已经支持 `mode: 'flatten'`，但新实现绕开了它，导致同类逻辑出现行为分叉。

**建议：**

优先复用 `buildManifestEntries()`，或至少在 pipeline 层保留足够的规则类型信息（不仅是 install mode），确保 flatten 结果写入 `mode: 'flatten'`，并补一条覆盖“共享 target root + flatten”场景的测试。

## 发现 2（新发现）

**标题：manifest 必填字段在映射失败时被静默兜底，数据损坏会被伪装成成功写入**

- 严重性：中
- 位置：
  - `src/pipeline.ts:247-268`
  - `_bmad-output/project-context.md:118-119`

**问题说明：**

当 `saveManifest()` 通过 `targetPath` 反查 plan 元数据失败时，当前代码会写入：

- `tool: ''`
- `scope: 'global'`
- `mode: 'copy'`

这属于对必填字段使用空值/默认值兜底。项目规则已经明确禁止这种做法，因为它会把“数据完整性错误”降级成“看起来成功，但 manifest 已损坏”。

**影响：**

- 一旦路径映射规则发生漂移、共享目标目录场景增多，或后续做路径规范化调整，manifest 会静默写入错误元数据；
- 后续冲突判断、问题排查和数据修复都会失去真实根因。

**建议：**

这里应改成显式校验并抛错，错误信息至少包含 `targetPath` 和匹配失败的上下文；不要用默认值掩盖数据不一致。

## 发现 3（新发现）

**标题：新增的“集成测试”实际上是全 Mock 编排测试，没有覆盖真实 `createProductionStages()` / manifest 持久化路径**

- 严重性：中
- 位置：
  - `_bmad-output/implementation-artifacts/4-6a-pipeline-orchestration-and-error-flow.md` Task 4.3
  - `tests/integration/pipeline.test.ts:119-156`

**问题说明：**

`tests/integration/pipeline.test.ts` 中所有阶段都是 mock/stub，测试对象本质上仍是 `runPipeline()` 的编排顺序，而不是 Story 4.6a 要求的“临时目录 + fixture 仓库 + mock Git 服务”的真实集成路径。

这导致以下关键逻辑没有被实际验证：

- `createProductionStages()` 是否正确接通真实阶段；
- pipeline 层 `saveManifest()` 写出的 manifest 内容是否符合契约；
- flatten / shared target root 等真实文件布局下的持久化行为。

**影响：**

本轮前两个问题之所以能在 `553/553` 全绿下漏过，根因就是这里没有测到真实 manifest 输出。

**建议：**

至少补一条真正的集成测试：使用 `createProductionStages()`、临时 repo、临时 config 目录执行一次真实安装，然后断言生成的 manifest 内容（特别是 `source` / `tool` / `scope` / `mode` / `hash`）。

## 总体评价

- AC #1：主阶段链已接通。
- AC #2：fatal 错误停止与 `reporter.reportError()` / `process.exitCode` 处理基本正确。
- AC #3：pipeline 层确实承担了 `saveManifest()` 收尾职责，但 manifest 元数据构建仍存在 correctness 缺陷。

**建议状态：退回修复后再复审。**
