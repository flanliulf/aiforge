# Story 5.4: 三段式错误提示完善

Status: done

## Story

As a 用户,
I want 错误发生时看到清晰的修复指引,
So that 不需要搜索文档就能自己解决问题。

## Acceptance Criteria

1. **Given** 认证失败 **When** Reporter 输出错误 **Then** 显示三段式提示（FR-037，NFR-U2）：`❌ 无法访问仓库` → `Git 服务器返回 401` → 可复制的修复命令
2. **Given** 任何 `AiforgeError` **When** TtyReporter 渲染错误 **Then** 格式为 `❌ ${message}` → `${why}` → `${fix.join('\n')}`（emoji + chalk 着色）；PlainReporter 格式为 `ERROR: ${message}` → `WHY: ${why}` → `FIX: ${fix}`（纯文本前缀，无 emoji，CI 兼容）。两者保持三段式语义一致，视觉形式不同。
3. **Given** 错误输出 **When** 检查输出流 **Then** 所有错误信息输出到 stderr
4. **Given** 各类错误场景 **When** 触发错误 **Then** 每种错误都有针对性的 `why` 和 `fix` 内容

## Tasks / Subtasks

- [x] Task 1: 完善 Reporter 的 `reportError()` 实现 (AC: #1-3)
  - [x] 1.1 `TtyReporter.reportError()` — 彩色三段式，修复命令带缩进和高亮
  - [x] 1.2 `PlainReporter.reportError()` — 纯文本三段式，无颜色
  - [x] 1.3 `QuietReporter.reportError()` — 同 PlainReporter（错误不能被静默）
  - [x] 1.4 所有实现输出到 stderr
- [x] Task 2: 审查并完善所有错误场景的 fix 内容 — **跨模块错误文案审计** (AC: #4)
  - [x] 2.1 审查 Epic 2~4 中所有 `AiforgeError` 创建点（`stages/`、`services/`、`commands/`），确保 `why` 和 `fix` 有针对性。注意：这是一次跨模块收口，涉及多个 Epic 的错误创建代码，工作量不应被低估。
  - [x] 2.2 认证失败：`fix: ['npx aiforge --ssh', 'npx aiforge --token <your-token>', 'npx aiforge init']`
  - [x] 2.3 网络错误：`fix: ['检查网络连接', 'git clone <url>  # 手动测试']`
  - [x] 2.4 权限不足：`fix: ['chmod 755 <target-dir>', 'sudo npx aiforge -g']`
  - [x] 2.5 参数错误：`fix: ['npx aiforge --help']`
  - [x] 2.6 配置损坏：`fix: ['npx aiforge init  # 重新配置']`
  - [x] 2.7 无工具检测到：`fix: ['npx aiforge --tools copilot claude']`
- [x] Task 3: 编写单元测试 (AC: #1-4)
  - [x] 3.1 `tests/core/reporter.test.ts` — 扩展 reportError 测试
  - [x] 3.2 测试用例：三段式格式验证、各 Reporter 实现、stderr 输出、fix 命令可复制性
  - [x] 3.3 构造各种 AiforgeError 实例验证渲染

## Dev Notes

### 三段式错误渲染 [Source: architecture/03-core-decisions.md#D4]

TtyReporter：
```typescript
reportError(error: AiforgeError): void {
  const output = [
    chalk.red(`❌ ${error.message}`),
    chalk.gray(`   ${error.why}`),
    chalk.yellow('   修复方法：'),
    ...error.fix.map(cmd => chalk.cyan(`   ${cmd}`)),
  ].join('\n');
  process.stderr.write(output + '\n');
}
```

渲染效果：
```
❌ 无法访问仓库
   Git 服务器返回 401（认证失败）
   修复方法：
   npx aiforge --ssh
   npx aiforge --token <your-token>
   npx aiforge init
```

PlainReporter：
```
ERROR: 无法访问仓库
  WHY: Git 服务器返回 401（认证失败）
  FIX: npx aiforge --ssh
  FIX: npx aiforge --token <your-token>
  FIX: npx aiforge init
```

### 错误场景清单

| 错误码 | message | why | fix |
|--------|---------|-----|-----|
| AUTH_FAILED | 无法访问仓库 | Git 服务器返回 401 | --ssh / --token / init |
| CLONE_FAILED | 克隆仓库失败 | 网络错误详情 | --ssh / 手动 git clone / 检查网络 |
| NO_REPO | 未指定知识仓库 | 无 URL 且无默认配置 | 提供 URL / aiforge init |
| NO_TOOLS | 未检测到 AI 工具 | 扫描路径列表 | --tools / 安装工具 |
| CONFIG_CORRUPT | 配置文件损坏 | 非法 JSON | aiforge init |
| CONFIG_NOT_FOUND | 未找到配置文件 | 未初始化 | aiforge init |
| PERMISSION_DENIED | 目标路径无写入权限 | 路径详情 | chmod / sudo |
| PATH_TRAVERSAL | 路径遍历攻击 | 路径详情 | 检查规则配置 |
| UNKNOWN_TOOL | 未知工具 ID | 支持的工具列表 | --tools 正确 ID |
| NON_TTY | 需要交互式终端 | CI/管道环境 | 本地终端运行 |
| CONFLICT_NON_TTY | 文件冲突需要交互 | 非 TTY 无法交互 | --force / 本地运行 |

### 模块边界

- 修改 `core/reporter.ts`（完善 reportError 渲染）
- 审查所有 `stages/` 和 `services/` 中的 AiforgeError 创建点

### 依赖关系

- 依赖 Story 1.2（AiforgeError 类）
- 依赖 Story 1.3（Reporter 接口）
- 依赖 Story 5.3（PlainReporter 和 QuietReporter 框架）

### 本 Story 不做的事

- 不实现错误日志文件输出
- 不实现错误上报/遥测
- 不修改 AiforgeError 类结构（Story 1.2 已定义）

### References

- [Source: architecture/03-core-decisions.md#D4] — AiforgeError 和三段式错误
- [Source: architecture/04-implementation-patterns.md] — 错误创建模式
- [Source: project-context.md#Error-Handling-Rules] — 三段式错误信息规则

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

无

### Completion Notes List

- **Task 1.1 TtyReporter.reportError()**：重写为三段式彩色格式：`chalk.red('❌ ${message}')` → `chalk.gray('   ${why}')` → `chalk.yellow('   修复方法：')` → `chalk.cyan('   ${cmd}')` 逐条，单次 `process.stderr.write(lines + '\n')`
- **Task 1.2 PlainReporter.reportError()**：重写为 CI 兼容纯文本格式：`ERROR: ${message}` → `  WHY: ${why}` → `  FIX: ${fix}` per line，无 emoji，无 ANSI 颜色
- **Task 1.3 QuietReporter.reportError()**：同 PlainReporter 三段式（错误不能被静默，由单行 `✗ ${message}` 升级为完整三段式）
- **Task 1.4**：所有三个 Reporter 实现均输出到 `process.stderr`
- **Task 2.1 跨模块审计**：审查了 `stages/`（authenticate、clone、detect-tools、match-rules、conflict-resolver、resolve-source）、`services/`（git、config、fs-utils）、`commands/`（init）共 10 个文件的全部 AiforgeError 创建点
- **Task 2.2 CLONE_FAILED fix 补充**：`src/stages/clone.ts` 的 CLONE_FAILED 新增 `npx aiforge --token <your-token>` 和 `npx aiforge init` 两条修复命令，使认证失败场景有完整三条修复路径
- **Task 2.3 网络错误**：CLONE_FAILED 和 PULL_FAILED 均已有 `检查网络连接` 和 `git clone/pull` 手动测试命令，无需修改
- **Task 2.4 权限不足**：PERMISSION_DENIED 已有 `ls -la` / `sudo` 命令，符合要求，无需修改
- **Task 2.5 参数错误**：ARG_CONFLICT / INVALID_URL 等均有针对性修复命令（比 `--help` 更具体），符合 "针对性" 要求，无需修改
- **Task 2.6 配置损坏**：CONFIG_CORRUPT 已有 `npx aiforge init  # 重新配置`，符合要求
- **Task 2.7 无工具检测**：NO_TOOLS 的 fix 动态包含了所有支持工具 ID 的 `--tools` 命令（`npx aiforge --tools copilot claude cursor vscode`），已满足 Story 要求
- **Task 3**：新增 20 条测试用例（reporter.test.ts +9，clone.test.ts +1，detect-tools.test.ts +1，Task 3 describe 块 +9），全仓 28 文件 620 个测试 100% 通过

### File List

- `src/core/reporter.ts` — 重写 TtyReporter/PlainReporter/QuietReporter 的 `reportError()`
- `src/stages/clone.ts` — CLONE_FAILED fix 补充 `--token` 和 `init` 命令
- `tests/core/reporter.test.ts` — 扩展 reportError 测试 + 新增 Task 3 渲染验证 describe 块
- `tests/stages/clone.test.ts` — 新增 CLONE_FAILED fix 文案审计测试
- `tests/stages/detect-tools.test.ts` — 新增 NO_TOOLS fix 文案审计测试
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — story 状态 → review
- `_bmad-output/implementation-artifacts/5-4-three-part-error-messages.md` — 本文件