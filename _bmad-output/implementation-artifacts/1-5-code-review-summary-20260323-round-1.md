# Story 1.5 Code Review Summary — Round 1

## 基本信息

- Story ID: `1-5`
- Story 文件: `_bmad-output/implementation-artifacts/1-5-cli-entry-and-pipeline-skeleton.md`
- 审核日期: `2026-03-23`
- 审核结论: **Changes Requested**

## 总体结论

本轮审核结论为 **需要修改后再进入下一步**。

主要原因：

1. **实际 bin 产物未满足 AC1**：`package.json` 的 bin 指向 `dist/index.js`，但实际运行 `node dist/index.js --help` 时，帮助输出不完整，缺少 `[repo-url]`、`init` 子命令以及完整选项集。
2. **Task 2 存在“已勾选但未完整实现”**：`pipeline.ts` 中并未将 `Report` 作为独立阶段类型签名/占位实现纳入阶段链，和 story 中“Resolve → Auth → Clone → Detect → Match → Install → Report”的声明不一致。
3. **存在实现与架构约束偏差**：TTY 检测使用了 `process.stderr.isTTY`，且 `index.ts` 直接依赖 `core/`，与架构文档约束不完全一致。

## 主要问题

### 1. 高优先级：AC1 在真实交付入口上不成立

- 源码入口 `npx tsx src/index.ts --help` 输出正确。
- 但真实 bin 目标 `node dist/index.js --help` 输出不完整。
- 因此 story 对 “`npx aiforge --help` 可运行且完整” 的验收结论，目前缺乏对真实交付物的一致性证明。

### 2. 严重：Task 2 标记完成，但阶段链定义不完整

- `PipelineStages` 中只定义了 `resolve / authenticate / clone / detect / match / install`。
- `report` 没有作为独立 stage 类型或占位函数存在。
- 这与 story 中的任务描述和 AC4 不完全匹配，属于“任务勾选状态与实现事实不一致”。

### 3. 中优先级：TTY 判定依据与架构文档不一致

- 当前 Reporter 选择逻辑使用 `process.stderr.isTTY`。
- 架构文档要求按 `stdout` 是否为 TTY 进行判定，以保证 `stdout` 可被脚本/管道消费。
- 在 `stdout` 被 pipe、`stderr` 仍为终端时，当前实现可能错误选择 `TtyReporter`。

### 4. 中优先级：`index.ts` 违反模块边界

- 架构要求 `index.ts` 只依赖 `pipeline.ts` 和 `commands/`。
- 但当前还直接依赖了 `core/types.ts` 和 `core/reporter.ts`。
- 这会增加 CLI 入口与核心实现细节的耦合。

### 5. 中优先级：AC3 缺少直接自动化验证

- 当前测试覆盖了 pipeline、init 子命令以及类型定义。
- 但没有针对 `src/index.ts` 的参数解析映射建立直接测试。
- 代码阅读显示实现大体正确，但 AC3 的验收证据仍偏弱。

### 6. 中优先级：Story File List 与实际变更不完全一致

- `git status` 显示还修改了 `_bmad-output/implementation-artifacts/sprint-status.yaml`。
- 但该文件未出现在 story 的 File List 中。
- 这属于文档追踪与透明度问题。

## 已确认通过项

- `--version` 行为正确，输出与 `package.json` 版本一致：`0.1.0`
- 启动到首次输出约 `0.420s`，满足 `< 1s`
- 当前全量测试通过：`194/194`

## 建议修复顺序

1. 先确保 `dist/index.js` 与 `src/index.ts` 行为一致，修复真实 bin 入口的 AC1 偏差。
2. 补齐 `Report` stage 的类型签名/占位实现，或回退 story 中对应 claim。
3. 将 TTY 判定调整为基于 `stdout` 的策略。
4. 为 CLI 参数解析补充直接测试，覆盖 AC3。
5. 同步更新 story 的 File List，确保与实际变更一致。

## 最终建议

**本 story 暂不建议直接标记为 done。**

建议在完成上述问题修复并重新验证真实交付入口后，再进入下一轮审核。