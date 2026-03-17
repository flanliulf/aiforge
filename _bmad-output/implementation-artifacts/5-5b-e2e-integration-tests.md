# Story 5.5b: 端到端集成测试

Status: ready-for-dev

## Story

As a 开发者,
I want 端到端集成测试覆盖核心安装流程、安装模式和目标平台,
So that 在发布前能够自动验证系统整体可用性，并及时发现回归问题。

## Acceptance Criteria

1. **Given** 模拟知识仓库 **When** 执行全局和项目级安装 **Then** 4 个工具的安装流程均成功，结果与规则映射一致
2. **Given** 三种安装模式 **When** 分别执行复制、符号链接、flatten **Then** 三种模式均通过验证，输出符合预期
3. **Given** `--dry-run` 模式 **When** 执行测试 **Then** 不发生任何文件写入，dry-run 输出与实际安装结果一致（NFR-U5）
4. **Given** 文件冲突场景 **When** 执行安装测试 **Then** 备份、跳过、覆盖行为符合设计
5. **Given** 零结果场景 **When** 执行测试 **Then** 触发零结果诊断输出
6. **Given** macOS 环境 **When** 执行测试 **Then** 所有测试通过（NFR-C1）
7. **Given** Linux 环境（CI）**When** 执行测试 **Then** 所有测试通过（NFR-C2）

## Tasks / Subtasks

- [ ] Task 1: 创建测试 fixture 仓库 (AC: #1)
  - [ ] 1.1 `tests/fixtures/sample-repo/` — 模拟知识仓库结构
  - [ ] 1.2 包含 agents/、skills/、instructions/、mcp-tools/ 四类资源
  - [ ] 1.3 skills/ 下包含子目录（用于 directories 和 flatten 测试）
  - [ ] 1.4 包含 README.md、.gitkeep 等应被排除的文件
- [ ] Task 2: 编写核心安装流程 E2E 测试 (AC: #1, #6, #7)
  - [ ] 2.1 `tests/integration/pipeline.test.ts` — 扩展或新建
  - [ ] 2.2 全局安装测试：验证 4 工具 × 4 资源类型的安装结果
  - [ ] 2.3 项目级安装测试：验证项目目录下的安装结果
  - [ ] 2.4 使用临时目录隔离测试环境
  - [ ] 2.5 Mock Git 克隆（使用本地 fixture 仓库代替）
- [ ] Task 3: 编写安装模式 E2E 测试 (AC: #2)
  - [ ] 3.1 复制模式：验证文件内容一致
  - [ ] 3.2 符号链接模式：验证链接指向正确
  - [ ] 3.3 flatten 模式：验证目录扁平化和重命名
- [ ] Task 4: 编写 dry-run 一致性测试 (AC: #3)
  - [ ] 4.1 执行 dry-run 获取安装计划
  - [ ] 4.2 执行实际安装获取结果
  - [ ] 4.3 对比两者的文件列表和目标路径完全一致
  - [ ] 4.4 验证 dry-run 不产生文件系统副作用
- [ ] Task 5: 编写冲突和边界场景测试 (AC: #4, #5)
  - [ ] 5.1 冲突场景：预先在目标路径创建文件，验证 --force 覆盖行为
  - [ ] 5.2 零结果场景：空仓库或全部跳过，验证诊断输出
  - [ ] 5.3 排除列表：验证 README.md 等文件不被安装

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

```typescript
it('dry-run output matches actual install', async () => {
  // 1. dry-run
  const plan = await runPipelineDryRun(args);
  const plannedFiles = plan.items.flatMap(i => i.sourceFiles.map(f => f.relativePath));

  // 2. actual install
  const results = await runPipelineInstall(args);
  const installedFiles = results.filter(r => r.status !== 'failed').map(r => basename(r.targetPath));

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

### Debug Log References

### Completion Notes List

### File List
