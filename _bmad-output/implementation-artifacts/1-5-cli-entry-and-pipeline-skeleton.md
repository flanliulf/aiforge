# Story 1.5: CLI 入口与管道骨架

Status: done

## Story

As a 开发者,
I want CLI 命令定义和管道编排器骨架,
so that `npx aiforge --help` 可运行，管道框架就绪可逐步填充阶段实现。

## Acceptance Criteria

1. **Given** `index.ts` 已创建 **When** 运行 `npx aiforge --help` **Then** 显示完整的命令帮助，包含所有参数和选项定义，包含主命令 `aiforge [repo-url]` 和子命令 `aiforge init`
2. **Given** `index.ts` 已创建 **When** 运行 `npx aiforge --version` **Then** 显示 `package.json` 中的版本号
3. **Given** CLI 参数解析 **When** 传入 `-g -l -t copilot claude -d skills agents --dry-run --quiet --force` **Then** 正确解析为 `ParsedArgs` 对象，所有字段值正确
4. **Given** `pipeline.ts` 已创建 **When** 检查管道编排器 **Then** 定义了完整的阶段链类型签名（Resolve → Auth → Clone → Detect → Match → Install → Report），每个阶段为占位函数（抛出"未实现"错误），`dryRun` 标志控制 Install 阶段是否执行，`ParsedArgs` 由编排器持有按需注入
5. **Given** 管道编排器 **When** 某阶段抛出 `severity: 'fatal'` 的 AiforgeError **Then** 管道立即停止，通过 Reporter 输出错误
6. **Given** CLI 启动 **When** 测量从执行到首次输出的时间 **Then** < 1 秒（NFR-P4）

## Tasks / Subtasks

- [x] Task 1: 创建 `src/index.ts` — CLI 入口 (AC: #1, #2, #3)
  - [x] 1.1 使用 commander 定义主命令 `aiforge [repo-url]`
  - [x] 1.2 定义选项：`-g, --global`、`-l, --link`、`-t, --tools <tools...>`、`-d, --dirs <dirs...>`、`--dry-run`、`--quiet`、`--force`、`--ssh`、`--token <token>`、`--clone-dir <path>`
  - [x] 1.3 定义子命令 `aiforge init`
  - [x] 1.4 版本号从 package.json 读取（使用 `import { createRequire } from 'module'` 或 `fs.readFileSync`）
  - [x] 1.5 解析结果转换为 `ParsedArgs` 对象
  - [x] 1.6 添加 `#!/usr/bin/env node` shebang
- [x] Task 2: 创建 `src/pipeline.ts` — 管道编排器 (AC: #4, #5)
  - [x] 2.1 定义管道阶段类型签名：每个阶段函数接收上一阶段输出 + ParsedArgs，返回本阶段输出
  - [x] 2.2 实现 `runPipeline(args: ParsedArgs, reporter: Reporter): Promise<void>`
  - [x] 2.3 阶段链：resolve → auth → clone → detect → match → [install] → report
  - [x] 2.4 每个阶段为占位函数：`throw new AiforgeError('未实现', 'NOT_IMPLEMENTED', 1, 'fatal', '该阶段尚未实现', [])`
  - [x] 2.5 `dryRun` 为 true 时跳过 install 阶段，直接将 MatchedPlan 传给 report
  - [x] 2.6 fatal 错误捕获：立即停止管道，调用 `reporter.reportError()`
- [x] Task 3: 创建 `src/commands/init.ts` — init 子命令占位 (AC: #1)
  - [x] 3.1 占位实现，输出"aiforge init 尚未实现"
- [x] Task 4: 连接 CLI → Pipeline (AC: #1, #4)
  - [x] 4.1 主命令 action 中：解析参数 → 创建 Reporter → 调用 runPipeline
  - [x] 4.2 根据 `--quiet` 和 TTY 检测选择 Reporter 实现
  - [x] 4.3 管道错误时设置 `process.exitCode`
- [x] Task 5: 编写单元测试 (AC: #3, #4, #5)
  - [x] 5.1 `tests/pipeline.test.ts` — 管道阶段链执行顺序、dryRun 跳过 install、fatal 错误停止
  - [x] 5.2 CLI 参数解析测试（可选，commander 自身已有测试保障）
- [x] Task 6: 端到端验证 (AC: #1, #2, #6)
  - [x] 6.1 `npx aiforge --help` 输出正确
  - [x] 6.2 `npx aiforge --version` 输出版本号
  - [x] 6.3 启动到首次输出 < 1 秒

## Dev Notes

### 管道编排架构 [Source: architecture/03-core-decisions.md#D6]

```typescript
// 管道阶段类型签名
type Stage<In, Out> = (input: In, args: ParsedArgs, reporter: Reporter) => Promise<Out>;

// 管道编排器
export async function runPipeline(args: ParsedArgs, reporter: Reporter): Promise<void> {
  const source = await resolve(args, reporter);
  const authed = await authenticate(source, args, reporter);
  const repo = await clone(authed, args, reporter);
  const env = await detect(repo, args, reporter);
  const plan = await match(env, args, reporter);

  if (!args.dryRun) {
    const result = await install(plan, args, reporter);
    reporter.reportResult(result);
  } else {
    reporter.reportPlan(plan);
  }
}
```

**关键设计**：
- `ParsedArgs` 由编排器持有，按需注入到各阶段（不逐级传递）
- dry-run 在 Match 后分叉，架构保证预览一致性
- 每个阶段是独立函数，可单独测试

### 错误流控制 [Source: architecture/03-core-decisions.md#D4]

```typescript
try {
  // ... 阶段执行
} catch (error) {
  if (error instanceof AiforgeError && error.severity === 'fatal') {
    reporter.reportError(error);
    process.exitCode = error.exitCode;
    return; // 立即停止
  }
  // 所有错误统一为 fatal，立即停止
}
```

### CLI 参数定义 [Source: epic-1.md#Story-1.5]

| 参数 | 短选项 | 说明 |
|------|--------|------|
| `[repo-url]` | — | 知识仓库 URL（位置参数） |
| `--global` | `-g` | 全局安装 |
| `--link` | `-l` | 符号链接模式 |
| `--tools <tools...>` | `-t` | 手动指定工具 |
| `--dirs <dirs...>` | `-d` | 过滤资源类型 |
| `--dry-run` | — | 预览模式 |
| `--quiet` | — | 精简输出 |
| `--force` | — | 跳过冲突确认 |
| `--ssh` | — | 强制 SSH 认证 |
| `--token <token>` | — | 提供 Token |
| `--clone-dir <path>` | — | 自定义克隆路径 |

### 版本号读取

ESM 中不能用 `require('./package.json')`。推荐方式：

```typescript
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));
```

或使用 `createRequire(import.meta.url)('./package.json')`。

### 依赖关系

- 依赖 Story 1.1（项目骨架、commander 依赖）
- 依赖 Story 1.2（`ParsedArgs`、`AiforgeError` 等类型）
- 依赖 Story 1.3（`Reporter` 接口和实现、`createReporter` 工厂）

### 本 Story 不做的事

- 不实现任何管道阶段的真实逻辑（全部占位）
- 不实现 `aiforge init` 的交互式流程（Story 2.5）
- 不实现 Reporter 的完整格式化（Story 5.x）

### References

- [Source: architecture/03-core-decisions.md#D6] — 管道编排和 dry-run 分叉
- [Source: architecture/03-core-decisions.md#D4] — 错误处理和 severity
- [Source: architecture/05-project-structure.md] — 数据流和模块边界
- [Source: project-context.md#Architecture-Rules-Pipeline] — 管道架构

## Dev Agent Record

### Agent Model Used

claude-opus-4.6

### Debug Log References

无

### Completion Notes List

- **Task 1 (CLI 入口):** 使用 commander 定义完整 CLI 入口，含主命令 `aiforge [repo-url]` 和所有选项（-g, -l, -t, -d, --dry-run, --quiet, --force, --ssh, --token, --clone-dir）。ESM 下使用 `readFileSync` + `fileURLToPath` 读取 `package.json` 版本号。解析结果转换为扩展后的 `ParsedArgs` 对象。
- **Task 2 (管道编排器):** 创建 `pipeline.ts`，定义完整阶段类型签名（`ResolveFn`, `AuthenticateFn` 等）和 `PipelineStages` 接口支持依赖注入。所有阶段为占位函数，抛出 `NOT_IMPLEMENTED` AiforgeError。`runPipeline` 实现 dryRun 分叉和 fatal 错误捕获。非 AiforgeError 被包装为 fatal。
- **Task 3 (init 占位):** `commands/init.ts` 输出"aiforge init 尚未实现"，使用 console.log（init 不走管道，符合 Output Rules 豁免）。
- **Task 4 (连接 CLI→Pipeline):** 主命令 action 中解析参数、创建 Reporter（根据 --quiet 和 TTY 检测）、调用 runPipeline。
- **Task 5 (单元测试):** `tests/pipeline.test.ts` — 14 个测试覆盖：占位阶段 NOT_IMPLEMENTED 错误、DEFAULT_STAGES、阶段链执行顺序、dryRun 跳过 install、fatal 错误停止、exitCode 设置、非 AiforgeError 包装。`tests/commands/init.test.ts` — 2 个测试覆盖 init 注册和输出。
- **Task 6 (端到端验证):** `--help` 输出完整（含子命令）、`--version` 输出 0.1.0、启动到首次输出 0.43s < 1s (NFR-P4 ✅)。
- **类型扩展:** `ParsedArgs` 新增 `global`, `link`, `tools`, `dirs`, `force`, `ssh`, `token`, `cloneDir` 字段以匹配 CLI 参数定义。同步更新了 `types.test.ts` 中的 ParsedArgs 测试。

### File List

- `src/index.ts` — 重写：完整 CLI 入口，含选项定义、参数解析、pipeline 调用（模块边界合规：仅依赖 pipeline.ts + commands/）；R3 修复 `parse()` → `parseAsync()`；R4 修复 `parseAsync()` 加 `.catch()` 安全网
- `src/pipeline.ts` — 新增：管道编排器，7 阶段类型签名（含 ReportFn + mode 参数），PipelineStages 接口，占位阶段，report 三级判定实现，runPipeline；导出 `mapOptsToArgs`；重导出 createReporter/ParsedArgs/Reporter
- `src/commands/init.ts` — 重写：init 子命令占位实现
- `src/commands/index.ts` — 更新：导出 registerInitCommand
- `src/core/types.ts` — 更新：ParsedArgs 新增 global, link, tools, dirs, force, ssh, token, cloneDir 字段
- `tests/pipeline.test.ts` — 新增：管道编排器单元测试（含 report mode 参数、空 InstallResult 分流、runPipeline mode 传递）
- `tests/cli-args.test.ts` — 新增：CLI 参数解析测试，直接调用真实 `mapOptsToArgs` 函数，含 7 个测试用例
- `tests/commands/init.test.ts` — 新增：init 子命令 2 个测试
- `tests/core/types.test.ts` — 更新：ParsedArgs 测试适配新字段
- `.prettierignore` — 更新：新增 `CLAUDE.md` 和 `AGENTS.md` 排除项
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — 更新：story 状态 ready-for-dev → review

### Change Log

- 2026-03-23: Story 1.5 实现完成 — CLI 入口与管道骨架，全部 6 个 Task 完成，194 测试通过（新增 16 个）
- 2026-03-23: CR Round 1 修复 — TTY 检测改用 stdout、index.ts 模块边界合规、补齐 Report 阶段类型签名、补充 CLI 参数解析测试、File List 完善。203 测试通过（新增 25 个）
- 2026-03-23: CR Round 2 修复 — Prettier 格式修复、report mode 参数三级判定、mapOptsToArgs 提取至 pipeline.ts 消除测试漂移。206 测试通过
- 2026-03-23: CR Round 3 修复 — `program.parse()` → `parseAsync()` 消除 async 隐患、`.prettierignore` 新增 CLAUDE.md/AGENTS.md、Story 文档 File List/Change Log 同步更新
- 2026-03-23: CR Round 4 修复 — `parseAsync()` 裸调用加 `.catch()` 防御性安全网、Story 文档 File List/Change Log 同步更新。206 测试通过
