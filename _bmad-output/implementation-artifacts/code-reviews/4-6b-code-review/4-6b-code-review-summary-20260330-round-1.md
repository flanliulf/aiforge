---
Story: 4-6b
Round: 1
Date: 2026-03-30
Model Used: GPT-5.4
Type: Code Review Summary
---

## 审查结论

本轮为**首轮审查**。

`reportResult()` 的分流方向（结果走 stdout、错误走 stderr）以及按工具聚合的基本思路已经落地，`npm test`、`npm run build`、`npm run lint` 也均已通过。但当前实现仍有 **2 个需要修复的问题**，外加 **1 个测试/类型一致性问题**；其中第 1 项会直接导致 Story 4.6b 承诺的输出格式未完整交付。

**建议状态：修复后再复审。**

## 审查发现

### 1. `reportResult()` 的实际输出格式仍与 Story 约定不一致

- 严重级别：**Major**
- 证据：
  - Story 明确给出了期望输出格式：TTY 需显示 `🔧 GitHub Copilot` / `🔧 Claude Code`，并逐行展示 `source → target`；Plain 需输出 `status  tool  source  target` 四列：`_bmad-output/implementation-artifacts/4-6b-install-result-summary-and-output.md:36-56`
  - `TtyReporter.reportResult()` 当前仅输出 `item.tool` 和 `item.targetPath`，没有输出 `sourcePath`，且标题直接使用内部 tool id：`src/core/reporter.ts:121-147`
  - `PlainReporter.reportResult()` 当前仅输出 `status + tool + targetPath` 三列，同样丢失 `sourcePath`：`src/core/reporter.ts:256-279`
  - 工具展示名其实已有标准来源：`src/data/tool-registry.ts:8-41`
- 问题说明：
  - 当前 TTY 输出形态实际更接近：
    - `🔧 copilot`
    - `  ✅ ~/.copilot/agents/coding-agent.md`
  - Plain 输出实际为：
    - `new<TAB>copilot<TAB>~/.copilot/agents/coding-agent.md`
  - 这与 Story 中承诺的 `source → target` / `status tool source target` 契约不一致；而本次 Story 专门新增了 `sourcePath` 字段并在安装阶段完整填充，但 Reporter 并未消费这些信息。
- 影响：
  - 用户无法从结果输出中直接看出“仓库中的哪个源文件/目录”对应“本地哪个目标路径”，对于 `updated` / `skipped` 尤其不利于排查。
  - TTY 模式下展示内部 id（`copilot` / `claude`）而不是用户可识别名称（`GitHub Copilot` / `Claude Code`），可读性也低于 Story 约定。
- 建议修复：
  - 在 `reportResult()` 中显式输出 `sourcePath -> targetPath`（Plain/TTY 分别按 Story 示例格式组织）。
  - 在不破坏模块边界的前提下，为 TTY 标题补齐 tool display name 映射，而不是直接暴露内部 id。

### 2. `tests/core/reporter.test.ts` 没有锁定 Story 承诺的关键输出契约，导致上述偏差漏检

- 严重级别：**Major**
- 证据：
  - 测试 fixture 已经提供了 `sourcePath` 数据：`tests/core/reporter.test.ts:8-57`
  - 但 PlainReporter 相关断言只校验了状态、目标路径、工具 id、统计行，没有校验 `sourcePath` 是否输出，也没有校验四列格式：`tests/core/reporter.test.ts:175-206`
  - TtyReporter 相关断言只校验了工具 id、状态图标和统计行，同样没有校验 `source → target` 以及显示名：`tests/core/reporter.test.ts:298-328`
- 问题说明：
  - 正因为测试没有锁定 Story 示例中的关键 contract，当前实现即便丢失 `sourcePath`、TTY 标题退化为内部 id，也依然可以全绿通过。
- 影响：
  - Story 4.6b 最核心的“输出格式”要求没有被测试真正保护。
  - 后续继续调整 Reporter 时，同类回归还会再次漏过。
- 建议修复：
  - 为 PlainReporter 增加对 `status / tool / source / target` 全列输出的精确断言。
  - 为 TtyReporter 增加对 `🔧 GitHub Copilot` / `🔧 Claude Code` 以及 `source → target` 行格式的断言。

### 3. `InstallResult.items.tool` 新字段没有全仓同步，`tests/pipeline.test.ts` 中已出现静态类型漂移

- 严重级别：**Medium**
- 证据：
  - `InstallResult.items` 已新增必填 `tool: string`：`src/core/types.ts:69-77`
  - 但 `tests/pipeline.test.ts` 里仍存在多个显式标注为 `InstallResult` 的对象缺少 `tool` 字段：`tests/pipeline.test.ts:173-175`、`tests/pipeline.test.ts:203-205`、`tests/pipeline.test.ts:325-329`
  - 我额外执行了针对性静态检查，输出中明确包含这些报错：`Property 'tool' is missing ... tests/pipeline.test.ts(174/204/327/328/329)`
- 问题说明：
  - 运行时门禁没有暴露这个问题，是因为当前 `tsconfig.json` 排除了 `tests/`，而 Vitest 默认也是 transpile-only；但从类型契约角度看，这些 fixture 已经和接口定义脱节。
- 影响：
  - 测试数据模型与真实契约不一致，后续重构或补充 typecheck 时会形成额外噪音。
  - 这也说明“修改共享类型定义后全仓同步引用”的动作没有完全做完。
- 建议修复：
  - 把 `tests/pipeline.test.ts` 中所有 `InstallResult` fixture 同步补齐 `tool` 字段。
  - 如后续继续演进类型契约，建议至少保留一条覆盖 tests 目录的静态检查路径，避免这类漂移长期潜伏。

## 正向观察

- `executeInstall()` 已在 `flatten / files / directories` 的各条成功/跳过分支中一致写入 `tool: item.rule.tool`，说明数据供给侧已经准备完整：`src/stages/execute-install.ts:358-416`、`src/stages/execute-install.ts:438-523`
- `reportResult()` / `reportError()` 的 stdout / stderr 分工与 Story 约定一致，本轮未见输出流回归：`_bmad-output/implementation-artifacts/4-6b-install-result-summary-and-output.md:59-66`，`src/core/reporter.ts:121-147`，`src/core/reporter.ts:256-279`

## 验证记录

本轮实际执行并通过：

- `npm test` ✅（572 / 572）
- `npm run build` ✅
- `npm run lint` ✅

额外做了针对性静态检查：

- `npx tsc --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext tests/pipeline.test.ts`
  - 其中命中了本 Story 相关的 `tests/pipeline.test.ts` 缺少 `tool` 字段报错

## 结论建议

当前实现的主干已经成型，但 Story 4.6b 作为“安装结果汇总与输出流分工”故事，输出内容本身就是核心交付物。建议优先修正 `reportResult()` 的格式契约和对应测试，再进入第 2 轮 CR。
