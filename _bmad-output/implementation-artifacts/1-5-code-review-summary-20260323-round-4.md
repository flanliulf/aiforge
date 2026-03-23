# Story 1.5 Code Review Summary — Round 4

## 基本信息

- Story ID: `1-5`
- Story 文件: `_bmad-output/implementation-artifacts/1-5-cli-entry-and-pipeline-skeleton.md`
- 审核日期: `2026-03-23`
- 审核结论: **Changes Requested**

## 总体结论

相较 Round 3，本轮实现再次收敛：

- `npm test`：✅ `206/206`
- `npm run lint`：✅ 通过
- `npx tsc --noEmit`：✅ 通过
- `npm run build`：✅ 通过
- `node dist/index.js --help`：✅ 输出完整
- `node dist/index.js --version`：✅ `0.1.0`
- `node dist/index.js init`：✅ 输出 `aiforge init 尚未实现`
- 首次输出时间：✅ `0.062s < 1s`

AC1 / AC2 / AC4 / AC5 / AC6 当前均成立，Round 3 中关于 lint 和 `program.parse()` 的问题已被处理了一半：

- `program.parse()` 已改为 `program.parseAsync()`
- `.prettierignore` 已补充 `CLAUDE.md` / `AGENTS.md`，仓库级 lint 已恢复为绿

但本轮复审后，**仍不建议直接标记为 done**。主要原因是：`parseAsync()` 虽已引入，但在 CLI 入口顶层**未被 await/捕获**，属于“修了一半”的 async 入口问题；此外仍存在测试绑定强度与文档追踪完整性上的遗留事项。

## 主要问题

### 1. 中优先级：`program.parseAsync()` 已引入，但顶层未 await，async 入口修复不完整

- 当前 `src/index.ts` 已将 `program.parse()` 改为 `program.parseAsync()`。
- 但文件末尾仍是裸调用：`program.parseAsync()`，没有 `await`，也没有 `.catch()`。
- 对 async action 而言，这意味着 Commander 返回的 Promise 没有被显式消费；若入口 action 未来在 `runPipeline()` 之外新增任何异步异常，仍可能以 unhandled rejection / 未受控方式终止进程。
- 本轮通过最小 Commander 复现实验验证：`parseAsync()` 裸调用下，async action 抛错会直接冒泡为未受控异常。

### 2. 低优先级：AC3 测试仍未真正绑定生产入口的 commander 注册

- `tests/cli-args.test.ts` 已复用真实 `mapOptsToArgs()`，这是 Round 2 的有效修复。
- 但测试内仍手写了一份 commander 选项定义，而不是直接复用 `src/index.ts` 的主命令注册逻辑。
- 因此它可以防止“映射逻辑漂移”，但仍不能完全防止“CLI 选项注册漂移”。

### 3. 低优先级：Story 文档与当前 git 工作区仍存在追踪差异

- Story 的 File List / Change Log 已比 Round 3 更完整，但当前 `git status` 仍显示若干已跟踪改动未体现在该 Story 的 File List 中。
- 其中包括：`src/core/errors.ts`、`src/core/path-resolver.ts`、`src/core/reporter.ts`、`tests/core/errors.test.ts`、`tests/core/reporter.test.ts`、`tests/core/types.test.ts` 等。
- 这更像审计追踪问题，不影响运行，但会削弱 Story 的变更透明度。

## 已确认通过项

- `npx tsc --noEmit`：✅
- `npm test`：✅ `206/206`
- `npm run lint`：✅
- `npm run build`：✅
- `node dist/index.js --help`：✅
- `node dist/index.js --version`：✅ `0.1.0`
- `node dist/index.js init`：✅
- 首次输出时间：✅ `0.062s < 1s`

## 建议修复顺序

1. 先将 CLI 入口的 `program.parseAsync()` 改为被显式 `await`（或等价地显式捕获 Promise）。
2. 若希望彻底闭合 AC3 回归保护，再提取可复用的 `createProgram()` / `configureMainCommand()`，让测试直接复用生产入口注册逻辑。
3. Story 标记 done 前，再统一清理 File List / Change Log 与当前 git 工作区的差异。

## 最终建议

本轮建议继续保持 **Changes Requested**。

结论不是因为 AC 未通过，而是因为 CLI 入口的 async 修复尚未闭环；修完该点后，Story 1-5 很可能即可进入最终收口阶段。