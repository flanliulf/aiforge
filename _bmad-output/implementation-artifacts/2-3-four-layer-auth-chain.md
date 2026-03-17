# Story 2.3: 四层认证解析链

Status: ready-for-dev

## Story

As a 用户,
I want 系统自动选择最合适的认证方式,
So that 无论在开发环境、CI 还是新电脑上都能顺利访问私有仓库。

## Acceptance Criteria

1. **Given** 用户同时传入 `--ssh` 和 `--token` **When** 执行认证解析 **Then** 立即抛出 `AiforgeError(code: 'ARG_CONFLICT', severity: 'fatal')`，提示两者互斥
2. **Given** 用户通过 `--ssh` CLI 参数指定 SSH **When** 执行认证解析 **Then** 使用 SSH Key 认证，忽略其他认证源（FR-006，优先级最高）
3. **Given** 用户通过 `--token <token>` CLI 参数提供 Token **When** 执行认证解析 **Then** 使用提供的 Token 认证（FR-007，优先级最高）
3. **Given** 环境变量 `AIFORGE_TOKEN` 或 `GITLAB_TOKEN` 已设置 **When** 执行认证解析且无 CLI 参数 **Then** 使用环境变量中的 Token（FR-008，优先级第二）
4. **Given** 通过配置服务读取 `config.json` 中有对应 host 的认证配置 **When** 执行认证解析且无 CLI 参数和环境变量 **Then** 使用配置文件中的认证方式（FR-010，优先级第三）
5. **Given** 无任何显式认证配置 **When** 执行认证解析 **Then** 降级到系统 Git 凭据管理器（FR-009，优先级最低）
7. **Given** 认证过程中涉及 Token **When** Token 出现在日志或错误输出中 **Then** 显示为脱敏格式 `glpat-ab****mnop`（前 8 + `****` + 后 4）（FR-012，NFR-S3）

## Tasks / Subtasks

- [ ] Task 1: 创建 `src/stages/authenticate.ts` — Auth 管道阶段 (AC: #1-7)
  - [ ] 1.1 实现 `authenticate(source: ResolvedSource, args: ParsedArgs, reporter: Reporter): Promise<AuthenticatedSource>`
  - [ ] 1.2 互斥校验：`args.ssh && args.token` 同时存在时抛出 `AiforgeError(code: 'ARG_CONFLICT', severity: 'fatal')`
  - [ ] 1.3 四层优先级链实现：
    - Layer 1: `args.ssh` → SSH 认证 / `args.token` → Token 认证（CLI 参数，最高优先级）
    - Layer 2: `process.env.AIFORGE_TOKEN` || `process.env.GITLAB_TOKEN`（环境变量）
    - Layer 3: `getHostAuth(config, source.hostname)`（配置文件 per-host）
    - Layer 4: 系统 Git 凭据管理器（降级，不注入任何认证信息）
  - [ ] 1.4 构建 `AuthenticatedSource`：包含 `cloneUrl`（注入 Token 的 HTTPS URL 或 SSH URL）和 `authMethod`
  - [ ] 1.5 Token 注入 HTTPS URL：`https://oauth2:${token}@${hostname}/${repoPath}.git`（GitLab 标准格式）
  - [ ] 1.6 所有日志输出中的 Token 使用 `sanitizeToken()` 脱敏
  - [ ] 1.7 调用 `reporter.startPhase('验证认证信息...')` 输出进度
- [ ] Task 2: 编写单元测试 (AC: #1-7)
  - [ ] 2.1 `tests/stages/authenticate.test.ts`
  - [ ] 2.2 测试用例：--ssh 与 --token 互斥报错、CLI --ssh 优先、CLI --token 优先、环境变量回退、配置文件回退、系统凭据降级、Token 脱敏验证
  - [ ] 2.3 Mock `process.env`、`services/config.ts`、`core/sanitize.ts`

## Dev Notes

### 四层认证优先级链 [Source: architecture/03-core-decisions.md#D3]

```
优先级从高到低：
1. CLI 参数：--ssh 或 --token <token>（FR-006, FR-007）
2. 环境变量：AIFORGE_TOKEN > GITLAB_TOKEN（FR-008）
3. 配置文件：config.json auth[hostname]（FR-010）
4. 系统凭据：Git credential manager（FR-009）
```

实现为简单的 if-else 链，不需要策略模式：

```typescript
export async function authenticate(
  source: ResolvedSource,
  args: ParsedArgs,
  reporter: Reporter
): Promise<AuthenticatedSource> {
  reporter.startPhase('验证认证信息...');

  // Layer 0: 互斥校验
  if (args.ssh && args.token) {
    throw new AiforgeError('--ssh 和 --token 不能同时使用', 'ARG_CONFLICT', 3, 'fatal',
      '两种认证方式互斥，请只选择其中一种',
      ['npx aiforge --ssh <repo>', 'npx aiforge --token <token> <repo>']);
  }

  // Layer 1: CLI 参数
  if (args.ssh) {
    return { ...source, cloneUrl: buildSshUrl(source), authMethod: 'ssh' };
  }
  if (args.token) {
    return { ...source, cloneUrl: buildTokenUrl(source, args.token), authMethod: 'token' };
  }

  // Layer 2: 环境变量
  const envToken = process.env.AIFORGE_TOKEN || process.env.GITLAB_TOKEN;
  if (envToken) {
    return { ...source, cloneUrl: buildTokenUrl(source, envToken), authMethod: 'token' };
  }

  // Layer 3: 配置文件
  // ... loadConfig + getHostAuth

  // Layer 4: 系统凭据（不注入认证，依赖 git credential manager）
  return { ...source, cloneUrl: buildPlainUrl(source), authMethod: 'credential-manager' };
}
```

### AuthenticatedSource 类型 [Source: core/types.ts, Story 1.2]

```typescript
interface AuthenticatedSource extends ResolvedSource {
  cloneUrl: string;           // 可直接用于 git clone 的完整 URL
  authMethod: AuthMethod;     // 'ssh' | 'token' | 'credential-manager'
}
```

### Token 注入 URL 构建

```typescript
// HTTPS + Token
function buildTokenUrl(source: ResolvedSource, token: string): string {
  return `https://${token}@${source.hostname}/${source.repoPath}.git`;
}

// SSH
function buildSshUrl(source: ResolvedSource): string {
  return `git@${source.hostname}:${source.repoPath}.git`;
}

// 无认证 HTTPS（依赖系统凭据）
function buildPlainUrl(source: ResolvedSource): string {
  return `https://${source.hostname}/${source.repoPath}.git`;
}
```

### Token 安全 [Source: project-context.md#Security-Rules]

- Token 只在内存中存在，注入到 cloneUrl 后由 Story 2.4 使用
- 克隆完成后 Token 从内存清除（Story 2.4 负责）
- 所有日志/错误输出必须使用 `sanitizeToken()` 脱敏
- `.git/config` 中不能包含 Token（Story 2.4 负责清理）

### 环境变量优先级

`AIFORGE_TOKEN` 优先于 `GITLAB_TOKEN`，因为前者是项目专属变量，后者是通用变量。两者都存在时取 `AIFORGE_TOKEN`。

### 模块边界

- `stages/authenticate.ts` 依赖 `core/`（types、errors、sanitize）和 `services/config.ts`
- 不直接依赖 simple-git（Git 操作在 Story 2.4 的 clone 阶段）

### 依赖关系

- 依赖 Story 1.2（`AuthenticatedSource`、`ResolvedSource`、`AuthMethod` 类型、`sanitizeToken`）
- 依赖 Story 1.3（`Reporter` 接口）
- 依赖 Story 2.1（`loadConfig`、`getHostAuth`）
- 依赖 Story 2.2（`ResolvedSource` 作为输入）
- 被 Story 2.4（克隆阶段）依赖（接收 AuthenticatedSource）

### 本 Story 不做的事

- 不实现 SSH 连接验证（Story 2.5 的 init 流程中做）
- 不实现 Token 有效性验证（克隆失败时由 Story 2.4 报错）
- 不实现 Token 存储（Story 2.1 的 config 服务负责）
- 不实现 Token 内存清除（Story 2.4 克隆完成后负责）

### References

- [Source: architecture/03-core-decisions.md#D3] — 认证优先级链和 config 结构
- [Source: architecture/03-core-decisions.md#D6] — 管道阶段类型签名
- [Source: architecture/04-implementation-patterns.md] — 错误创建模式
- [Source: project-context.md#Security-Rules] — Token 脱敏和安全规则

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
