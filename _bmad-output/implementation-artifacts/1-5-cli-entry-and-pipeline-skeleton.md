# Story 1.5: CLI 入口与管道骨架

Status: ready-for-dev

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

- [ ] Task 1: 创建 `src/index.ts` — CLI 入口 (AC: #1, #2, #3)
  - [ ] 1.1 使用 commander 定义主命令 `aiforge [repo-url]`
  - [ ] 1.2 定义选项：`-g, --global`、`-l, --link`、`-t, --tools <tools...>`、`-d, --dirs <dirs...>`、`--dry-run`、`--quiet`、`--force`、`--ssh`、`--token <token>`、`--clone-dir <path>`
  - [ ] 1.3 定义子命令 `aiforge init`
  - [ ] 1.4 版本号从 package.json 读取（使用 `import { createRequire } from 'module'` 或 `fs.readFileSync`）
  - [ ] 1.5 解析结果转换为 `ParsedArgs` 对象
  - [ ] 1.6 添加 `#!/usr/bin/env node` shebang
- [ ] Task 2: 创建 `src/pipeline.ts` — 管道编排器 (AC: #4, #5)
  - [ ] 2.1 定义管道阶段类型签名：每个阶段函数接收上一阶段输出 + ParsedArgs，返回本阶段输出
  - [ ] 2.2 实现 `runPipeline(args: ParsedArgs, reporter: Reporter): Promise<void>`
  - [ ] 2.3 阶段链：resolve → auth → clone → detect → match → [install] → report
  - [ ] 2.4 每个阶段为占位函数：`throw new AiforgeError('未实现', 'NOT_IMPLEMENTED', 1, 'fatal', '该阶段尚未实现', [])`
  - [ ] 2.5 `dryRun` 为 true 时跳过 install 阶段，直接将 MatchedPlan 传给 report
  - [ ] 2.6 fatal 错误捕获：立即停止管道，调用 `reporter.reportError()`
  - [ ] 2.7 partial 错误收集：收集到内存数组中，保留扩展点供后续阶段消费（MVP 阶段不要求格式化输出 partial 错误列表，仅需确保收集机制就绪）
- [ ] Task 3: 创建 `src/commands/init.ts` — init 子命令占位 (AC: #1)
  - [ ] 3.1 占位实现，输出"aiforge init 尚未实现"
- [ ] Task 4: 连接 CLI → Pipeline (AC: #1, #4)
  - [ ] 4.1 主命令 action 中：解析参数 → 创建 Reporter → 调用 runPipeline
  - [ ] 4.2 根据 `--quiet` 和 TTY 检测选择 Reporter 实现
  - [ ] 4.3 管道错误时设置 `process.exitCode`
- [ ] Task 5: 编写单元测试 (AC: #3, #4, #5)
  - [ ] 5.1 `tests/pipeline.test.ts` — 管道阶段链执行顺序、dryRun 跳过 install、fatal 错误停止、partial 错误收集
  - [ ] 5.2 CLI 参数解析测试（可选，commander 自身已有测试保障）
- [ ] Task 6: 端到端验证 (AC: #1, #2, #6)
  - [ ] 6.1 `npx aiforge --help` 输出正确
  - [ ] 6.2 `npx aiforge --version` 输出版本号
  - [ ] 6.3 启动到首次输出 < 1 秒

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
  // partial 错误收集到数组，继续执行
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

### Debug Log References

### Completion Notes List

### File List
