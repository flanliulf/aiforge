---
Story: 4-6a
Round: 2
Date: 2026-03-30
Model Used: GPT-5.4
Type: Code Review Summary
---

# 审查结论

本轮结论：**仍需修复后再合并**。

复审结果：

- 上轮发现 1（manifest `mode` 错写 / 共享 target root 元数据覆盖）→ ✅ **已修复**
- 上轮发现 2（必填字段空值兜底）→ ✅ **已修复**
- 上轮发现 3（缺少真实 `createProductionStages()` / manifest 集成覆盖）→ ✅ **已补充**
- 本轮新增 2 条问题：**1 条功能回归 + 1 条 lint 校验失败**

本轮验证结果：

- `npm run build` ✅
- `npm test` ✅（556/556）
- `npm run lint` ❌

## 已关闭问题

### 上轮发现 1：已关闭

`src/pipeline.ts` 的 `saveManifest()` 已不再对共享目标目录使用单值覆盖；`tests/integration/pipeline-production-stages.test.ts` 也补上了 `.cursor/rules/` 共享目标目录场景，当前代码能正确区分 `cursor skills[Flatten]` 与 `agents[Files]` 的 manifest 条目。

### 上轮发现 2：已关闭

`src/pipeline.ts` 已移除 `tool/scope/mode` 的 `?? ''` / `?? 'global'` / `?? 'copy'` 兜底，并在 `planInfo` 缺失时显式抛错；与 `project-context.md` 的规则一致。

### 上轮发现 3：已关闭

新增 `tests/integration/pipeline-production-stages.test.ts`，已实际覆盖 `createProductionStages()` 的真实闭包路径与 manifest 持久化行为，不再是纯 mock 编排测试。

## 发现 1（新发现）

**标题：修复把 `MatchedPlan.mode` 混成“规则类型”，导致 `Flatten + --link` 在真实管道中退化为 copy**

- 严重性：中（功能回归）
- 位置：
  - `src/stages/match-rules.ts:40-57`
  - `src/stages/match-rules.ts:174-184`
  - `src/stages/execute-install.ts:339-396`
  - `src/core/reporter.ts:132`
  - `src/core/reporter.ts:206-213`
  - `tests/stages/execute-install.test.ts:802-840`

**问题说明：**

本轮修复把 `MatchedPlan.items[].mode` 从“安装模式（copy/symlink）”扩展成了 `'copy' | 'symlink' | 'flatten'`，并在 `matchRules()` 中对所有 `InstallType.Flatten` 规则直接返回 `mode: 'flatten'`。

但 `executeInstall()` 的 flatten 分支仍然只在 `item.mode === 'symlink'` 时创建符号链接；否则走 copy 分支。这意味着：

- `cursor` 全局安装 + `--link`
- 经过真实链路 `matchRules() → executeInstall()`

时，plan 会产出 `mode: 'flatten'`，安装阶段却不会创建 symlink，而是直接 copy。

这不是推测；我已做最小复现，结果如下：

- `matchRules()` 产出：`{ type: 'Flatten', mode: 'flatten' }`
- `executeInstall()` 结果文件存在，但 `lstat(...).isSymbolicLink() === false`

同时，`reporter.reportPlan()` 也直接展示 `item.mode`，因此 dry-run / plan 输出会退化成：

- TTY：`[flatten/flatten]`
- Plain：`flatten  flatten`

这说明当前 `mode` 字段已经同时承担了“安装方式”和“规则类型”两层语义，字段语义发生了冲突。

**影响：**

- 现有支持路径 `Flatten + symlink` 被回归破坏；
- `--link` 对 `cursor` / flatten 规则不再生效，用户看到的计划输出也与真实意图不一致；
- 现有单测 `tests/stages/execute-install.test.ts:802-840` 明确表明 flatten symlink 是支持场景，但本轮修复没有覆盖 `matchRules() → executeInstall()` 这条真实链路，因此回归未被捕获。

**建议：**

不要再用 `MatchedPlan.mode` 同时表达“规则类型”和“安装方式”。至少需要二选一：

1. 保持 `MatchedPlan.mode` 继续只表示 `copy | symlink`，manifest 写入时改走独立字段/独立映射来表达 flatten；
2. 或新增独立字段区分 `rule.type` 与 `install mode`，避免 `executeInstall()` / `reporter` / manifest 共享一个互相冲突的枚举。

并补一条真实集成测试覆盖：

- `cursor`
- `global`
- `--link`
- `Flatten`

断言结果必须是符号链接，而不是普通文件。

## 发现 2（新发现）

**标题：新增真实集成测试文件当前未通过 lint，Story 验证状态仍非全绿**

- 严重性：低
- 位置：
  - `tests/integration/pipeline-production-stages.test.ts:175`

**问题说明：**

本轮新增的真实集成测试里存在未使用变量：

```ts
const copyItems = plan.items.filter((item) => item.mode === 'copy')
```

`npm run lint` 当前直接失败：

```text
tests/integration/pipeline-production-stages.test.ts
  175:11  error  'copyItems' is assigned a value but never used  @typescript-eslint/no-unused-vars
```

**影响：**

- 虽然 `npm test` 和 `npm run build` 都通过，但仓库级校验并未全绿；
- Story 当前仍不满足“实现完成后全量校验通过”的交付标准。

**建议：**

删除未使用变量，或补上对应断言后重新执行 `npm run lint`。

## 总体评价

- **上轮问题 1/2/3：已关闭，无遗留。**
- **本轮新增问题：2 条，均为新发现。**

其中：

- 发现 1 是功能回归，影响真实安装行为，应优先修复；
- 发现 2 是交付校验问题，修复成本低，但必须处理，否则 Story 不能视为完成。

**建议状态：修复后再复审。**
