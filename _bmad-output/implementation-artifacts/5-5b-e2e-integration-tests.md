# Story 5.5b: 端到端集成测试

Status: done

## Story

As a 开发者,
I want 端到端集成测试覆盖核心安装流程、安装模式和目标平台,
So that 在发布前能够自动验证系统整体可用性，并及时发现回归问题。

## Acceptance Criteria

1. **Given** 模拟知识仓库 **When** 执行全局和项目级安装 **Then** 按 `BUILTIN_RULES` 真实规则矩阵（约 14 条，非理想化 4×4）验证安装结果与规则映射一致
2. **Given** 三种安装模式 **When** 分别执行复制、符号链接、flatten **Then** 三种模式均通过验证，输出符合预期
3. **Given** `--dry-run` 模式 **When** 执行测试 **Then** 不发生任何文件写入，dry-run 输出的完整目标路径列表和安装模式与实际安装结果一致（NFR-U5）
4. **Given** 文件冲突场景 **When** 执行安装测试 **Then** 至少覆盖三条主路径：`--force` 覆盖、备份后覆盖、跳过，行为符合设计
5. **Given** 零结果场景 **When** 执行测试 **Then** 触发零结果诊断输出
6. **Given** macOS 环境 **When** 执行测试 **Then** 所有测试通过（NFR-C1）
7. **Given** Linux 环境（CI）**When** 执行测试 **Then** 所有测试通过（NFR-C2）。若当前无 CI 环境，先作为手动 runner 验证项，后续补充 CI 自动化。

## Tasks / Subtasks

- [x] Task 1: 创建测试 fixture 仓库 (AC: #1)
  - [x] 1.1 `tests/fixtures/sample-repo/` — 模拟知识仓库结构
  - [x] 1.2 包含 agents/、skills/、instructions/、mcp-tools/ 四类资源
  - [x] 1.3 skills/ 下包含子目录（用于 directories 和 flatten 测试）
  - [x] 1.4 包含 README.md、.gitkeep 等应被排除的文件
- [x] Task 2: 编写核心安装流程 E2E 测试 (AC: #1, #6, #7)
  - [x] 2.1 `tests/integration/pipeline.test.ts` — 扩展或新建
  - [x] 2.2 全局安装测试：按 Story 1.4 的真实 `BUILTIN_RULES`（16 条规则）验证安装结果，不按理想化的 4×4 满矩阵（部分工具不支持所有资源类型）
  - [x] 2.3 项目级安装测试：验证项目目录下的安装结果
  - [x] 2.4 使用临时目录隔离测试环境
  - [x] 2.5 Mock Git 克隆（使用本地 fixture 仓库代替）
- [x] Task 3: 编写安装模式 E2E 测试 (AC: #2)
  - [x] 3.1 复制模式：验证文件内容一致
  - [x] 3.2 符号链接模式：验证链接指向正确
  - [x] 3.3 flatten 模式：验证目录扁平化和重命名
- [x] Task 4: 编写 dry-run 一致性测试 (AC: #3)
  - [x] 4.1 执行 dry-run 获取安装计划
  - [x] 4.2 执行实际安装获取结果
  - [x] 4.3 对比两者的**完整目标路径列表**和**安装模式**（copy/symlink）一致，不仅仅比对文件名（需覆盖 flatten 场景的重命名规则）
  - [x] 4.4 验证 dry-run 不产生文件系统副作用
- [x] Task 5: 编写冲突和边界场景测试 (AC: #4, #5)
  - [x] 5.1 冲突场景 — `--force` 覆盖：预先在目标路径创建文件，验证 `--force` 直接覆盖行为
  - [x] 5.2 冲突场景 — 备份后覆盖：验证 `{filename}.aiforge-backup-{YYYYMMDD}` 备份文件生成
  - [x] 5.3 冲突场景 — 跳过：验证用户选择跳过时文件未被修改，结果为 `status: 'skipped'`
  - [x] 5.4 零结果场景：空仓库或全部跳过，验证诊断输出
  - [x] 5.5 排除列表：验证 README.md 等文件不被安装

## Dev Notes

### 测试架构 [Source: project-context.md#Testing-Rules]

```
tests/integration/
├── pipeline.test.ts          # 管道端到端测试
├── install-modes.test.ts     # 安装模式测试
├── dry-run.test.ts           # dry-run 一致性测试
└── edge-cases.test.ts        # 冲突和边界场景
```

### fixture 仓库结构

```
tests/fixtures/sample-repo/
├── agents/
│   ├── coding-agent.md
│   └── review-agent.md
├── skills/
│   ├── code-review/
│   │   ├── index.md
│   │   └── examples.md
│   └── refactor/
│       └── index.md
├── instructions/
│   └── CLAUDE.md
├── mcp-tools/
│   └── server.json
├── README.md          # 应被排除
└── .gitkeep           # 应被排除
```

### 测试环境隔离

```typescript
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let testDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'aiforge-test-'));
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});
```

### Mock 策略

- Git 克隆：使用本地 fixture 目录代替真实 Git 操作
- PathResolver：注入 mock，所有路径指向临时目录
- config.json：在临时目录中创建测试配置
- 不 mock 文件系统操作（E2E 测试需要真实文件操作）

### dry-run 一致性验证

对比完整目标路径和安装模式，不仅仅比对文件名（需覆盖 flatten 场景的重命名规则）：

```typescript
it('dry-run output matches actual install', async () => {
  // 1. dry-run
  const plan = await runPipelineDryRun(args);
  const plannedTargets = plan.items.flatMap(i =>
    i.sourceFiles.map(f => ({
      targetPath: join(i.targetDir, f.relativePath),
      mode: getInstallMode(args, plan.scope),
    }))
  );

  // 2. actual install
  const results = await runPipelineInstall(args);
  const installedTargets = results
    .filter(r => r.status !== 'skipped')
    .map(r => ({ targetPath: r.targetPath, mode: r.mode }));

  // 3. compare full target paths + install mode
  expect(plannedTargets.sort(byPath)).toEqual(installedTargets.sort(byPath));

  // 3. compare
  expect(plannedFiles.sort()).toEqual(installedFiles.sort());
});
```

### 模块边界

- 创建 `tests/integration/` 下的测试文件
- 创建 `tests/fixtures/sample-repo/` fixture 数据
- 不修改 src/ 下的任何文件

### 依赖关系

- 依赖 Epic 1-4 全部 Story（完整管道实现）
- 依赖 Story 5.1-5.4（输出体验完善）
- 被 Story 5.5c（Go/No-Go 门禁）依赖

### 本 Story 不做的事

- 不实现性能基准测试（NFR-P 指标由手动验证）
- 不实现 Windows E2E 测试（延迟决策，M2）
- 不实现网络集成测试（真实 Git 服务器）

### References

- [Source: architecture/04-implementation-patterns.md] — 测试命名和 Mock 策略
- [Source: architecture/05-project-structure.md] — tests/ 目录结构
- [Source: project-context.md#Testing-Rules] — 测试分层和 fixture

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-5 (claude-sonnet-4.6)

### Debug Log References

- `saveManifest` 对 Directories 类型路径调用 `fileHash()` 失败 → **已修复（CR R1）**：`src/pipeline.ts` 中新增 `isDirectoryType` 检测，Directories 类型条目跳过 `fileHash()`，改用空字符串 `''` 占位值；saveManifest E2E 测试已补充 claude:global 全链路验证（TODO-014 已关闭）
- `dry-run.test.ts` 追加内容导致 ESM 重复 import 声明 → 完整重写文件，合并新旧 imports
- `edge-cases.test.ts` 中 `handleConflict` 需要 mock 整个模块（含完整 backup/skip 逻辑）以避免 TTY 依赖

### Completion Notes List

- Task 1: 创建 `tests/fixtures/sample-repo/` — 包含 agents/coding-agent.md、agents/review-agent.md、skills/code-review/index.md、skills/code-review/examples.md、skills/refactor/index.md、instructions/CLAUDE.md、mcp-tools/server.json、README.md（排除）、.gitkeep（排除）
- Task 2: 扩展 `tests/integration/pipeline.test.ts`，追加 Story 5.5b AC #1 describe 块，共 5 个 E2E 测试，全部通过
- Task 3: 新建 `tests/integration/install-modes.test.ts`，9 个测试覆盖 copy/symlink/flatten 三种模式，全部通过
- Task 4: 重写 `tests/integration/dry-run.test.ts`，保留原有 8 个测试并新增 3 个 AC #3 E2E 测试，共 11 个测试全部通过
- Task 5: 新建 `tests/integration/edge-cases.test.ts`，10 个测试覆盖冲突场景/零结果/排除列表，全部通过
- 全量测试：692/692 通过（CR R1 修复新增 1），ESLint 无错误

### File List

**新建文件:**
- `tests/fixtures/sample-repo/agents/coding-agent.md`
- `tests/fixtures/sample-repo/agents/review-agent.md`
- `tests/fixtures/sample-repo/skills/code-review/index.md`
- `tests/fixtures/sample-repo/skills/code-review/examples.md`
- `tests/fixtures/sample-repo/skills/refactor/index.md`
- `tests/fixtures/sample-repo/instructions/CLAUDE.md`
- `tests/fixtures/sample-repo/mcp-tools/server.json`
- `tests/fixtures/sample-repo/README.md`
- `tests/fixtures/sample-repo/.gitkeep`
- `tests/integration/install-modes.test.ts`
- `tests/integration/edge-cases.test.ts`

**修改文件:**
- `tests/integration/pipeline.test.ts` — 追加 Story 5.5b AC #1 E2E 测试块（含新 mock + FIXTURE_REPO + 5个测试），修复 unused `writeFile` 和 `installedPaths`
- `tests/integration/dry-run.test.ts` — 完整重写，合并原有内容与 Story 5.5b AC #3 新测试（3个测试）
- `_bmad-output/implementation-artifacts/5-5b-e2e-integration-tests.md` — 更新 status/tasks/Dev Agent Record，CR 收尾清理过时描述
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — 5-5b 状态 → done
- `src/pipeline.ts` — CR R1 修复：saveManifest 区分 Directories 类型跳过 fileHash，使用空字符串占位
- `_bmad-output/project-context.md` — CR 规则提炼：新增"禁止通过选择性测试路径绕行已知缺陷"规则
- `_bmad-output/planning-artifacts/architecture/04-implementation-patterns.md` — 同步上述新规则（含代码示例）
- `_bmad-output/implementation-artifacts/cr-todo-backlog.md` — 新增 TODO-013、TODO-014