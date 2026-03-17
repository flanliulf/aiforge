# Story 3.2: 规则匹配引擎

Status: ready-for-dev

## Story

As a 用户,
I want 系统根据检测到的工具和安装范围自动匹配安装规则,
So that 知道哪些文件需要安装到哪里。

## Acceptance Criteria

1. **Given** 检测到 copilot 工具，安装范围为全局（`-g`）**When** 执行规则匹配 **Then** 从 `BUILTIN_RULES` 中匹配出 copilot:global 的所有规则，返回 `MatchedPlan` 包含每条规则对应的源文件和目标路径（FR-023）
2. **Given** 用户指定 `--dirs skills agents` **When** 执行规则匹配 **Then** 只匹配 `sourceDir` 为 skills 或 agents 的规则，过滤掉其他资源类型（FR-024）。注意：MVP 阶段 `--dirs` 直接匹配 `rule.sourceDir` 字面值，这是对当前规则数据结构的过滤，不是对通用仓库目录结构的假设。后续如需支持别名或语义映射，应在规则层扩展而非修改 CLI 参数语义。
3. **Given** 知识仓库中存在 `README.md`、`.gitkeep`、`.DS_Store` **When** 执行规则匹配 **Then** 这些文件被全局排除列表过滤，不出现在 `MatchedPlan` 中（FR-045）
4. **Given** 规则匹配引擎 **When** 检查实现方式 **Then** 使用 `Map<string, InstallRule[]>` 索引，key 为 `${tool}:${scope}`，O(1) 查找，新增工具只需添加数据不改引擎（FR-043）
5. **Given** 规则映射表 **When** 检查支持的安装类型 **Then** 支持 `files`、`directories`、`flatten` 三种类型（FR-044）

## Tasks / Subtasks

- [ ] Task 1: 创建 `src/stages/match-rules.ts` — Match 管道阶段 (AC: #1-5)
  - [ ] 1.1 实现 `matchRules(env: DetectedEnv, args: ParsedArgs, reporter: Reporter): Promise<MatchedPlan>`
  - [ ] 1.2 使用 `RULE_INDEX`（Story 1.4 构建的 Map）按 `${tool.id}:${scope}` 查找规则
  - [ ] 1.3 对每个检测到的工具，查找其对应 scope 的所有规则
  - [ ] 1.4 `--dirs` 过滤：如果 `args.dirs` 非空，只保留 `rule.sourceDir` 在 `args.dirs` 中的规则
  - [ ] 1.5 源文件扫描：对每条规则，在 `repo.repoDir` 中扫描 `rule.sourceDir` 目录下的文件
  - [ ] 1.6 排除过滤：使用 `DEFAULT_EXCLUDES` 过滤掉不需要的文件
  - [ ] 1.7 目标路径计算：使用 `PathResolver` 解析 `rule.targetDir` 中的路径模板
  - [ ] 1.8 构建 `MatchedPlan`：每个匹配项包含 rule、sourceFiles、targetPath
  - [ ] 1.9 调用 `reporter.startPhase('匹配安装规则...')` 输出进度
- [ ] Task 2: 实现源文件扫描逻辑 (AC: #3, #5)
  - [ ] 2.1 `files` 类型：扫描 sourceDir 下所有文件（不递归子目录）
  - [ ] 2.2 `directories` 类型：扫描 sourceDir 下所有子目录（每个子目录作为一个安装单元）
  - [ ] 2.3 `flatten` 类型：扫描 sourceDir 下所有子目录，每个子目录的内容将被合并到 mainFile
  - [ ] 2.4 所有类型都应用 `DEFAULT_EXCLUDES` 过滤
- [ ] Task 3: 编写单元测试 (AC: #1-5)
  - [ ] 3.1 `tests/stages/match-rules.test.ts`
  - [ ] 3.2 测试用例：单工具全局匹配、多工具匹配、--dirs 过滤、排除列表过滤、files/directories/flatten 三种类型扫描、空目录处理
  - [ ] 3.3 Mock fs 操作（readdir）、注入 mock PathResolver、使用 fixture 目录结构

## Dev Notes

### MatchedPlan 类型 [Source: core/types.ts, Story 1.2]

```typescript
interface MatchedPlan {
  items: MatchedItem[];
  scope: 'global' | 'project';
}

interface MatchedItem {
  rule: InstallRule;
  sourceFiles: SourceFile[];  // 源文件列表
  targetDir: string;          // 解析后的目标目录绝对路径
}

interface SourceFile {
  relativePath: string;  // 相对于 sourceDir 的路径
  absolutePath: string;  // 仓库中的绝对路径
}
```

### RULE_INDEX 使用 [Source: data/install-rules.ts, Story 1.4]

```typescript
import { RULE_INDEX } from '../data/install-rules.js';

// O(1) 查找
const rules = RULE_INDEX.get(`${tool.id}:${scope}`) || [];
```

不要重新构建索引，直接使用 Story 1.4 导出的 `RULE_INDEX`。

### 三种安装类型的扫描逻辑

| 类型 | sourceDir 扫描方式 | 安装行为（本 Story 只扫描，不安装） |
|------|-------------------|--------------------------------------|
| `files` | 列出目录下所有文件 | 每个文件独立复制到 targetDir |
| `directories` | 列出目录下所有子目录 | 每个子目录整体复制到 targetDir |
| `flatten` | 列出目录下所有子目录 | 每个子目录内容合并到 mainFile |

```typescript
import { readdir } from 'node:fs/promises';

async function scanSourceFiles(
  repoDir: string,
  rule: InstallRule
): Promise<SourceFile[]> {
  const sourceDir = join(repoDir, rule.sourceDir);
  const entries = await readdir(sourceDir, { withFileTypes: true });

  switch (rule.type) {
    case InstallType.Files:
      return entries
        .filter(e => e.isFile() && !DEFAULT_EXCLUDES.includes(e.name))
        .map(e => ({
          relativePath: e.name,
          absolutePath: join(sourceDir, e.name),
        }));

    case InstallType.Directories:
    case InstallType.Flatten:
      return entries
        .filter(e => e.isDirectory() && !DEFAULT_EXCLUDES.includes(e.name))
        .map(e => ({
          relativePath: e.name,
          absolutePath: join(sourceDir, e.name),
        }));
  }
}
```

### --dirs 过滤 [Source: FR-024]

```typescript
let matchedRules = rules;
if (args.dirs && args.dirs.length > 0) {
  matchedRules = rules.filter(r => args.dirs!.includes(r.sourceDir));
}
```

> **MVP 临时约束**：`--dirs` 当前直接匹配 `rule.sourceDir` 字面值（如 `skills`、`agents`）。这是对 `BUILTIN_RULES` 数据的过滤，不是对知识仓库物理目录结构的假设。遵循 `project-context.md` 的"不硬编码 source directory names"原则，后续如需支持不同仓库结构或语义别名，应在规则层（`InstallRule` 或 `loadRules()`）扩展映射关系，CLI 参数语义保持稳定。

### 目标路径解析

`rule.targetDir` 包含路径模板（如 `~/.copilot/agents/`），**必须通过 PathResolver 解析**，不手工展开 `~/` 或自行判断项目路径基准（遵循 project-context.md 和 Story 1.4 的路径集中管理原则）。

Match 阶段只表达"哪个工具、哪个 scope、哪个 target template"，由 PathResolver 负责平台相关的路径拼接：

```typescript
function resolveTargetDir(
  rule: InstallRule,
  scope: 'global' | 'project',
  pathResolver: PathResolver
): string {
  if (scope === 'global') {
    // 全局路径：PathResolver.home() + 相对路径部分
    // rule.targetDir 格式如 '~/.copilot/agents/'，去掉 '~/' 前缀
    const relativePart = rule.targetDir.replace(/^~\//, '');
    return join(pathResolver.home(), relativePart);
  }
  // 项目级路径：相对于项目根目录
  return join(process.cwd(), rule.targetDir);
}
```

> **注意**：上述 `process.cwd()` 用于项目级路径是 MVP 的简化处理。如果后续 PathResolver 扩展了 `projectRoot()` 方法，应替换为 `pathResolver.projectRoot()`。

### 空目录处理

如果 sourceDir 在仓库中不存在或为空，该规则的 `sourceFiles` 为空数组，不报错（静默跳过）。这允许知识仓库只包含部分资源类型。

### 模块边界

- `stages/match-rules.ts` 依赖 `core/`（types、errors）、`data/install-rules.ts`、`data/excludes.ts`
- 使用 `PathResolver` 解析目标路径
- 不依赖 `services/`

### 依赖关系

- 依赖 Story 1.2（`MatchedPlan`、`InstallRule`、`InstallType` 类型）
- 依赖 Story 1.3（`Reporter`、`PathResolver`）
- 依赖 Story 1.4（`RULE_INDEX`、`DEFAULT_EXCLUDES`）
- 依赖 Story 3.1（`DetectedEnv` 作为输入）
- 被 Story 3.3（dry-run 预览）和 Epic 4（安装执行）依赖

### 本 Story 不做的事

- 不执行文件复制/安装（Epic 4）
- 不检查目标路径冲突（Story 4.4/4.5）
- 不实现 aiforge.json 自定义规则加载（延迟决策，M3）
- 不实现 manifest 对比（Story 4.4）

### References

- [Source: architecture/03-core-decisions.md#D2] — 规则存储和 Map 索引
- [Source: architecture/03-core-decisions.md#D6] — 管道阶段类型签名
- [Source: architecture/05-project-structure.md] — 数据流 DetectedEnv → MatchedPlan
- [Source: project-context.md#Install-Rules-Data-Architecture] — 规则数据架构
- [Source: project-context.md#Critical-Dont-Miss-Rules] — 不硬编码源目录名

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
