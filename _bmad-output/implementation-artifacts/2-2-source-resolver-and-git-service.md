# Story 2.2: 知识源解析与 Git 服务封装

Status: ready-for-dev

## Story

As a 用户,
I want 通过 Git URL 或默认配置指定知识仓库,
So that 系统知道从哪里获取 AI 编码配置内容。

## Acceptance Criteria

1. **Given** 用户提供了 Git 仓库 URL（如 `https://gitlab.com/org/repo.git`）**When** 执行知识源解析 **Then** 正确解析出 hostname、repoPath、protocol（HTTPS/SSH），返回 `ResolvedSource` 对象（FR-001）
2. **Given** 用户未提供 URL 但 `config.json` 中有 `defaultRepo` **When** 执行知识源解析 **Then** 使用配置服务读取默认仓库地址（FR-002）
3. **Given** 用户未提供 URL 且无默认配置 **When** 执行知识源解析 **Then** 抛出 `AiforgeError`（code: 'NO_REPO'，severity: 'fatal'），提示用户提供 URL 或运行 `aiforge init`
4. **Given** `services/git.ts` 已创建 **When** 检查 GitSourceResolver **Then** 实现 `SourceResolver` 接口（`canHandle()`、`resolve()`），对 simple-git 进行薄封装
5. **Given** SSH 格式 URL（如 `git@gitlab.com:org/repo.git`）**When** 执行知识源解析 **Then** 正确识别为 SSH 协议（NFR-I1）

## Tasks / Subtasks

- [ ] Task 1: 创建 `src/stages/resolve-source.ts` — Resolve 管道阶段 (AC: #1, #2, #3, #5)
  - [ ] 1.1 实现 `resolveSource(args: ParsedArgs, reporter: Reporter): Promise<ResolvedSource>`
  - [ ] 1.2 URL 解析逻辑：HTTPS URL → 提取 hostname、repoPath、protocol='https'
  - [ ] 1.3 SSH URL 解析：`git@host:org/repo.git` → hostname、repoPath、protocol='ssh'
  - [ ] 1.4 无 URL 时回退到 `loadConfig()` 读取 `defaultRepo`
  - [ ] 1.5 无 URL 且无默认配置 → 抛出 `AiforgeError(code: 'NO_REPO', severity: 'fatal')`
  - [ ] 1.6 调用 `reporter.startPhase('解析仓库地址...')` 输出进度
- [ ] Task 2: 创建 `src/services/git.ts` — Git 服务封装 (AC: #4)
  - [ ] 2.1 实现 `GitSourceResolver` 类，实现 `SourceResolver` 接口
  - [ ] 2.2 `canHandle(source: string): boolean` — 判断是否为 Git URL（HTTPS 或 SSH 格式）
  - [ ] 2.3 `resolve(source: string, options: ResolveOptions): Promise<ResolvedSource>` — 解析 URL
  - [ ] 2.4 对 simple-git 的薄封装：导出 `createGit()` 工厂函数，返回 `SimpleGit` 实例
- [ ] Task 3: 编写单元测试 (AC: #1-5)
  - [ ] 3.1 `tests/stages/resolve-source.test.ts` — HTTPS URL 解析、SSH URL 解析、默认配置回退、无配置抛错
  - [ ] 3.2 `tests/services/git.test.ts` — canHandle 各种 URL 格式、resolve 返回正确结构
  - [ ] 3.3 Mock `services/config.ts` 的 `loadConfig`，mock simple-git

## Dev Notes

### SourceResolver 接口 [Source: architecture/03-core-decisions.md#D1]

```typescript
interface SourceResolver {
  canHandle(source: string): boolean;
  resolve(source: string, options: ResolveOptions): Promise<ResolvedSource>;
}
```

MVP 只实现 `GitSourceResolver`，未来扩展 `LocalSourceResolver`。管道只依赖接口。

### ResolvedSource 类型 [Source: core/types.ts, Story 1.2]

```typescript
interface ResolvedSource {
  hostname: string;      // 'gitlab.com'
  repoPath: string;      // 'org/repo'
  protocol: 'https' | 'ssh';
  originalUrl: string;   // 用户输入的原始 URL
}
```

### URL 解析规则

| 输入格式 | hostname | repoPath | protocol |
|---------|----------|----------|----------|
| `https://gitlab.com/org/repo.git` | `gitlab.com` | `org/repo` | `https` |
| `https://gitlab.com/org/repo` | `gitlab.com` | `org/repo` | `https` |
| `git@gitlab.com:org/repo.git` | `gitlab.com` | `org/repo` | `ssh` |
| `ssh://git@gitlab.com/org/repo.git` | `gitlab.com` | `org/repo` | `ssh` |

- 去除尾部 `.git` 后缀再提取 repoPath
- 使用 `URL` 构造函数解析 HTTPS，正则解析 SSH 格式

### simple-git 封装 [Source: project-context.md]

simple-git 版本 ~3.32.x。薄封装原则：
```typescript
import simpleGit, { type SimpleGit } from 'simple-git';

export function createGit(baseDir?: string): SimpleGit {
  return simpleGit(baseDir ? { baseDir } : undefined);
}
```

不要过度封装 simple-git，只暴露项目需要的操作。

### 管道阶段签名 [Source: architecture/03-core-decisions.md#D6]

Resolve 是管道第一阶段，输入为 `ParsedArgs`，输出为 `ResolvedSource`：
```typescript
type ResolveStage = (args: ParsedArgs, reporter: Reporter) => Promise<ResolvedSource>;
```

### 模块边界

- `stages/resolve-source.ts` 可依赖 `core/`、`services/config.ts`、`services/git.ts`
- `services/git.ts` 只依赖 `core/`（types、errors）和 simple-git
- 不依赖 `data/`（本阶段不需要规则或注册表数据）

### 依赖关系

- 依赖 Story 1.2（`ResolvedSource`、`ParsedArgs`、`AiforgeError` 类型）
- 依赖 Story 1.3（`Reporter` 接口）
- 依赖 Story 2.1（`loadConfig` 读取默认仓库）
- 被 Story 2.3（认证阶段）依赖（接收 ResolvedSource）

### 本 Story 不做的事

- 不实现认证逻辑（Story 2.3）
- 不实现克隆逻辑（Story 2.4）
- 不实现 LocalSourceResolver（延迟决策，M2+）

### References

- [Source: architecture/03-core-decisions.md#D1] — SourceResolver 接口设计
- [Source: architecture/03-core-decisions.md#D6] — 管道阶段类型签名
- [Source: architecture/05-project-structure.md] — stages/ 和 services/ 模块边界
- [Source: project-context.md#Architecture-Rules-Pipeline] — 管道架构
- [Source: project-context.md#Critical-Dont-Miss-Rules] — SourceResolver 抽象

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
