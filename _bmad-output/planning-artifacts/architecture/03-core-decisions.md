## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**

| # | 决策 | 选择 | 理由 |
|---|------|------|------|
| D1 | 知识源抽象 | SourceResolver 接口 + GitResolver | 最小成本预留本地源扩展 |
| D2a | 规则存储 | TS 常量 + 预留外部加载接口 | 类型安全 + M3 扩展路径 |
| D2b | 规则匹配 | Map 索引（tool:scope） | O(1) 查找，规则增长友好 |
| D3a | config.json 结构 | 按 host 分层认证 | FR-042 要求，多仓库就绪 |
| D3b | manifest.json 写入 | 内存累积 + 原子写入 + 崩溃降级 | 平衡性能与可靠性 |
| D4a | 错误类型 | 单一 AiforgeError + severity | fatal only，Install fail-fast |
| D4b | 输出抽象 | Reporter 接口 + 三种实现 | TTY/Plain/Quiet 集中管理 |
| D5a | 工具检测 | 数据驱动注册表 | 配置驱动，新增工具只加数据 |
| D5b | 路径解析 | PathResolver 集中管理 | 平台差异封装一处 |
| D6a | 管道数据流 | 类型安全的阶段链 | 编译时捕获数据流错误 |
| D6b | dry-run 实现 | 管道在 Match 后分叉 | 架构保证一致性 |

<!-- DECISIONS_APPEND_1 -->

### Decision Details

#### D1: Knowledge Source Abstraction — SourceResolver 接口

```typescript
interface SourceResolver {
  canHandle(source: string): boolean;
  resolve(source: string, options: ResolveOptions): Promise<ResolvedSource>;
}
```

- MVP 实现 `GitSourceResolver`（simple-git 封装）
- 未来扩展 `LocalSourceResolver`（Obsidian vault 等本地目录）
- 管道只依赖接口，不依赖具体实现

#### D2: Install Rules Data Architecture

**存储：** TypeScript 常量（MVP）+ 预留 `RuleLoader` 函数接口（M3 加载 aiforge.json）

**匹配：** Map 索引，key 为 `${tool}:${scope}`，启动时预构建

```typescript
// 规则加载抽象
function loadRules(): InstallRule[] {
  // MVP: 返回内置规则常量
  // M3: 合并内置规则 + aiforge.json 自定义规则
  return BUILTIN_RULES;
}

// 规则索引
const ruleIndex = new Map<string, InstallRule[]>();
for (const rule of loadRules()) {
  const key = `${rule.tool}:${rule.scope}`;
  ruleIndex.get(key)?.push(rule) ?? ruleIndex.set(key, [rule]);
}
```

#### D3: State Management

**config.json — 按 host 分层：**

```typescript
interface AiforgeConfig {
  defaultRepo?: string;
  cloneDir?: string;           // 默认 ~/.aiforge/repos/
  language?: string;           // 默认 zh-CN
  preferSSH?: boolean;         // 全局默认认证偏好（aiforge init 时设置）
  auth: Record<string, {       // 按 hostname 索引
    method: 'ssh' | 'token';
    token?: string;
  }>;
}
```

- `preferSSH` 是全局默认偏好，`aiforge init` 时用户选择 SSH 则设为 `true`
- 认证优先级链：CLI `--ssh`/`--token` > 环境变量 > `auth[host].method`（per-host） > `preferSSH`（全局默认） > 系统凭据
- per-host 的 `method` 覆盖全局 `preferSSH`，允许不同 Git 服务器使用不同认证方式

**manifest.json — 内存累积 + 原子写入：**

```typescript
interface ManifestEntry {
  source: string;              // 源文件相对路径
  target: string;              // 目标绝对路径
  tool: string;                // 工具 ID
  scope: 'global' | 'project';
  mode: 'copy' | 'symlink' | 'flatten';
  hash: string;                // 文件内容 SHA256
  installedAt: string;         // ISO 时间戳
}
```

- 写入策略：写临时文件 → `fs.rename()` 原子替换
- 损坏降级：manifest 不可读时视为空（所有文件为未知来源）

<!-- DECISIONS_APPEND_2 -->

#### D4: Error Handling & Output Strategy

**错误类型 — 单一类 + severity：**

```typescript
class AiforgeError extends Error {
  code: string;                // 'AUTH_FAILED' | 'CLONE_FAILED' | ...
  exitCode: number;            // 0=成功, 1=安装失败, 2=认证失败, 3=参数错误
  severity: 'fatal';           // 始终为 fatal（Install fail-fast，无 partial 概念）
  why: string;                 // 为什么（简短原因）
  fix: string[];               // 怎么修（可复制的命令列表）
}
```

- 管道编排器：`fatal` → 立即停止并报告
- Install 阶段 I/O 错误直接抛 `AiforgeError(severity: 'fatal')`，管道终止
- `InstallResult` 只有 `'new'` | `'updated'` | `'skipped'` 三种状态（无 `'failed'`）
- Reporter 渲染三段式：`❌ ${message}` → `${why}` → `${fix.join('\n')}`

**输出抽象 — Reporter 接口 + 三种实现：**

```typescript
interface Reporter {
  startPhase(name: string): void;
  updatePhase(message: string): void;
  completePhase(): void;
  reportResult(results: InstallResult): void;
  reportPlan(plan: MatchedPlan): void;
  reportError(error: AiforgeError): void;
  warn(message: string): void;
}
```

| 实现 | 触发条件 | 行为 |
|------|---------|------|
| TtyReporter | `process.stdout.isTTY && !quiet` | spinner + 彩色 + 树形结果 |
| PlainReporter | `!process.stdout.isTTY` | 纯文本行输出，无 spinner/彩色 |
| QuietReporter | `--quiet` | 只输出关键信息（成功/失败 + 统计） |

**stdout/stderr 分工规则（对齐 PRD 脚本化与非交互支持要求）：**

| 方法 | 输出流 | 理由 |
|------|--------|------|
| `reportResult()` | stdout | 安装结果可被管道消费（`npx aiforge \| grep copilot`） |
| `reportPlan()` | stdout | dry-run 计划输出同理，支持脚本化处理 |
| `startPhase()` | stderr | 进度信息是诊断性质，不应污染管道数据流 |
| `updatePhase()` | stderr | 同上 |
| `completePhase()` | stderr | 同上 |
| `reportError()` | stderr | 错误信息写 stderr 是 CLI 标准约定 |
| `warn()` | stderr | 非致命警告（断链、mainFile 缺失等），诊断性质 |

这确保 `npx aiforge --dry-run 2>/dev/null` 只输出纯安装计划，可被 `grep`/`awk`/`jq` 解析。

#### D5: Tool Detection & Platform Abstraction

**工具检测 — 数据驱动注册表：**

```typescript
interface ToolDefinition {
  id: string;                  // 'copilot' | 'claude' | 'cursor' | 'vscode'
  name: string;                // 'GitHub Copilot'
  detect: {
    global: string[];          // ['~/.copilot'] — 标志路径
    project: string[];         // ['.github'] — 标志路径
  };
}
```

- 检测逻辑统一：遍历注册表，检查标志路径是否存在
- `--tools` 手动指定时按 id 查找，跳过检测
- 新增工具只需在注册表加一条数据

**路径解析 — PathResolver 集中管理：**

```typescript
interface PathResolver {
  home(): string;
  toolGlobalDir(toolId: string): string;
  toolProjectDir(toolId: string): string;
  configDir(): string;         // ~/.aiforge/
  reposDir(): string;          // ~/.aiforge/repos/
}
```

- MVP 实现 macOS + Linux（`os.homedir()` + `path.join()`）
- M2 扩展 Windows（AppData 路径映射）
- 测试时可注入 mock 实现

#### D6: Pipeline Orchestration

**类型安全的阶段链：**

```typescript
type ResolveStage   = (args: ParsedArgs) => Promise<ResolvedSource>;
type AuthStage      = (source: ResolvedSource) => Promise<AuthenticatedSource>;
type CloneStage     = (source: AuthenticatedSource) => Promise<LocalRepo>;
type DetectStage    = (repo: LocalRepo, args: ParsedArgs) => Promise<DetectedEnv>;
type MatchStage     = (env: DetectedEnv, args: ParsedArgs) => Promise<MatchedPlan>;
type InstallStage   = (plan: MatchedPlan) => Promise<InstallResult>;
type ReportStage    = (results: InstallResult | MatchedPlan) => void;
```

**ParsedArgs 贯穿说明：**

`ParsedArgs` 包含用户 CLI 输入（`--dirs`、`--tools`、`--force`、`--dry-run` 等），需要在多个阶段被访问：
- `ResolveStage`：读取 repo-url、`--clone-dir`、`--ssh`、`--token`
- `DetectStage`：读取 `--tools` 手动指定（FR-014）
- `MatchStage`：读取 `--dirs` 过滤源目录（FR-024），只匹配用户指定的资源类型
- 管道编排器：读取 `--dry-run`、`--quiet`、`--force` 控制流程分叉和 Reporter 选择

`ParsedArgs` 不通过阶段链逐级传递，而是由管道编排器持有，按需注入到需要的阶段。

**dry-run 管道分叉：**

```
正常模式: Resolve → Auth → Clone → Detect → Match → Install → Report(results)
dry-run:  Resolve → Auth → Clone → Detect → Match → Report(plan)
```

- 管道编排器根据 `dryRun` 标志决定是否执行 Install 阶段
- dry-run 与正常模式共享 Resolve~Match 全部阶段，架构保证预览一致性

**预检查(preflight)设计决策：**

PRD 执行流程中"预检查"（目标路径可写性、权限验证，FR-030）不作为独立管道阶段，而是作为 Install 阶段的第一步执行。理由：
1. 预检查的输入数据（MatchedPlan 中的目标路径列表）与 Install 阶段完全相同，拆分为独立阶段会引入冗余的类型定义
2. 预检查失败时的行为（抛出 `severity: 'fatal'` 的 AiforgeError）与 Install 阶段的错误处理一致，无需独立的错误流
3. 保持管道阶段数最小化，降低编排器复杂度

实现要求：`execute-install.ts` 必须在执行任何文件操作前，先对 MatchedPlan 中所有目标路径执行预检查（可写性 + 权限），全部通过后才开始实际安装。预检查失败应立即 fail-fast。

### Deferred Decisions (Post-MVP)

| 决策 | 延迟到 | 理由 |
|------|--------|------|
| 外部规则加载（aiforge.json） | M3 | MVP 内置规则够用 |
| Windows PathResolver | M2 | 公司以 macOS 为主 |
| manifest 文件锁（并发安全） | M2 | MVP 单进程无并发 |
| 规则包生态系统 | P3 | 远期愿景 |
| 语义类型系统 | P3 | MVP 用目录名匹配 |
| LocalSourceResolver | M2+ | MVP 只支持 Git 仓库 |

### Decision Impact Analysis

**Implementation Sequence:**

1. D4a/D4b（错误类型 + Reporter）→ 所有模块依赖
2. D5b（PathResolver）→ 工具检测和安装都依赖
3. D1（SourceResolver + GitResolver）→ 管道第一阶段
4. D3a（config.json）→ 认证阶段依赖
5. D5a（工具注册表）→ 检测阶段依赖
6. D2a/D2b（规则存储 + 索引）→ 匹配阶段依赖
7. D3b（manifest.json）→ 安装阶段依赖
8. D6a/D6b（管道编排 + dry-run）→ 串联所有阶段

**Cross-Component Dependencies:**

- Reporter 被所有阶段引用（输出进度和错误）
- PathResolver 被工具检测、安装执行、配置管理引用
- AiforgeError 被所有阶段抛出，管道编排器统一处理
- MatchedPlan 是 Install 和 dry-run Report 的共享数据结构

