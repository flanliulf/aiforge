# Story 2.5: aiforge init 交互式配置

Status: ready-for-dev

## Story

As a 新用户,
I want 通过交互式引导完成首次配置,
So that 不需要手动编辑配置文件就能开始使用。

## Acceptance Criteria

1. **Given** 用户运行 `aiforge init` **When** 交互式引导开始 **Then** 依次询问：默认仓库 URL、认证方式（SSH/Token）、连接验证（FR-033）
2. **Given** 用户选择 SSH 认证 **When** 执行连接验证 **Then** 尝试 SSH 连接到 Git 服务器，成功时显示确认信息，失败时显示三段式错误提示含 SSH Key 生成步骤和具体命令（FR-011）
3. **Given** 用户选择 Token 认证 **When** 输入 Token 后执行连接验证 **Then** 验证 Token 有效性，Token 存储到 `config.json` 的 `auth[host]` 中（按 host 分层）
4. **Given** 用户已有 `config.json` **When** 再次运行 `aiforge init` **Then** 显示当前配置，允许修改或保持不变
5. **Given** 非 TTY 环境 **When** 运行 `aiforge init` **Then** 直接失败并提示需要交互式终端

## Tasks / Subtasks

- [ ] Task 1: 实现 `src/commands/init.ts` — init 交互式流程 (AC: #1-5)
  - [ ] 1.1 替换 Story 1.5 的占位实现
  - [ ] 1.2 TTY 检测：`!process.stdin.isTTY` → 抛出 `AiforgeError(code: 'NON_TTY', severity: 'fatal')`
  - [ ] 1.3 使用 `@inquirer/prompts` 实现交互式问答：
    - Step 1: `input` — 默认仓库 URL（已有配置时显示当前值作为默认）
    - Step 2: `select` — 认证方式：SSH / Token
    - Step 3: 根据选择执行连接验证
  - [ ] 1.4 已有配置时：先显示当前配置摘要，询问是否修改
  - [ ] 1.5 调用 `saveConfig()` 保存配置
- [ ] Task 2: 实现 SSH 连接验证 (AC: #2)
  - [ ] 2.1 使用 `createGit().raw(['ls-remote', sshUrl])` 测试 SSH 连接
  - [ ] 2.2 成功：显示 `✅ SSH 连接成功`
  - [ ] 2.3 失败：三段式错误提示
    ```
    ❌ SSH 连接失败
    Git 服务器拒绝了 SSH 连接
    修复建议：
      ssh-keygen -t ed25519 -C "your-email@example.com"
      cat ~/.ssh/id_ed25519.pub  # 复制公钥到 GitLab Settings > SSH Keys
      ssh -T git@<hostname>  # 测试连接
    ```
- [ ] Task 3: 实现 Token 连接验证 (AC: #3)
  - [ ] 3.1 使用 `createGit().raw(['ls-remote', tokenUrl])` 测试 Token 有效性
  - [ ] 3.2 成功：显示 `✅ Token 验证成功`，Token 脱敏显示
  - [ ] 3.3 失败：三段式错误提示含 Token 生成链接
  - [ ] 3.4 Token 输入使用 `password` 类型（不回显）
- [ ] Task 4: 编写单元测试 (AC: #1-5)
  - [ ] 4.1 `tests/commands/init.test.ts`
  - [ ] 4.2 测试用例：完整流程（SSH）、完整流程（Token）、已有配置修改、非 TTY 拒绝、连接验证成功/失败
  - [ ] 4.3 Mock `@inquirer/prompts`、`services/git.ts`、`services/config.ts`

## Dev Notes

### @inquirer/prompts 使用 [Source: project-context.md#Technology-Stack]

```typescript
import { input, select, password, confirm } from '@inquirer/prompts';

// 仓库 URL
const repoUrl = await input({
  message: '默认知识仓库 URL:',
  default: existingConfig?.defaultRepo,
  validate: (val) => val.trim() ? true : '请输入仓库 URL',
});

// 认证方式
const authMethod = await select({
  message: '认证方式:',
  choices: [
    { name: 'SSH Key（推荐）', value: 'ssh' },
    { name: 'Personal Access Token', value: 'token' },
  ],
});

// Token 输入（不回显）
if (authMethod === 'token') {
  const token = await password({
    message: 'Personal Access Token:',
    validate: (val) => val.trim() ? true : '请输入 Token',
  });
}
```

### 连接验证策略

使用 `git ls-remote` 测试连接，这是最轻量的验证方式：
- 不需要克隆任何内容
- 只验证认证是否有效
- 超时设置：10 秒

```typescript
const git = createGit();
try {
  await git.raw(['ls-remote', '--exit-code', url]);
  // 连接成功
} catch (error) {
  // 连接失败，解析错误类型
}
```

### 配置保存流程

```
解析 URL → 提取 hostname（复用 Story 2.2 的 URL 解析逻辑）→ 选择认证 → 验证连接 → 构建 AiforgeConfig → saveConfig()
```

```typescript
// 复用 Story 2.2 的 GitSourceResolver 解析 URL，提取 hostname
// 不要在 init 中重复实现 URL 解析逻辑
import { GitSourceResolver } from '../services/git.js';

const resolver = new GitSourceResolver();
const resolved = resolver.resolve(repoUrl);
const hostname = resolved.hostname;

const config: AiforgeConfig = {
  defaultRepo: repoUrl,
  auth: {
    [hostname]: {
      method: authMethod,
      token: authMethod === 'token' ? token : undefined,
    },
  },
};

if (authMethod === 'ssh') {
  config.preferSSH = true;
}

await saveConfig(config, pathResolver);
```

### 已有配置处理

> **注意**：init 是交互式命令，信息输出直接使用 `console.log`（输出到 stdout），不复用 Reporter 接口。Reporter 专为管道阶段的进度/结果输出设计，init 的交互式场景不适用。

```typescript
try {
  const existing = await loadConfig(pathResolver);
  console.log(`当前配置：`);
  console.log(`  仓库: ${existing.defaultRepo}`);
  console.log(`  认证: ${Object.keys(existing.auth).map(h => `${h} (${existing.auth[h].method})`).join(', ')}`);

  const modify = await confirm({ message: '是否修改当前配置？', default: false });
  if (!modify) return;
} catch (error) {
  if (error instanceof AiforgeError && error.code === 'CONFIG_CORRUPT') {
    // 配置损坏：显式提示用户，询问是否重建
    console.log('⚠️ 配置文件损坏，将重新配置。');
  }
  // CONFIG_NOT_FOUND：无配置，继续首次配置流程
}
```

### 非 TTY 检测 [Source: project-context.md#Critical-Dont-Miss-Rules]

```typescript
if (!process.stdin.isTTY) {
  throw new AiforgeError(
    'aiforge init 需要交互式终端',
    'NON_TTY',
    3,
    'fatal',
    '当前环境不支持交互式输入（如 CI/CD 管道）',
    [
      '在本地终端运行 aiforge init',
      '或手动创建 ~/.aiforge/config.json'
    ]
  );
}
```

### 模块边界

- `commands/init.ts` 依赖 `core/`（errors、types）、`services/config.ts`、`services/git.ts`
- 依赖 `@inquirer/prompts`（交互式输入）
- 信息输出使用 `console.log`（不复用 Reporter，init 是交互式命令而非管道阶段）
- 不依赖 `stages/`、`data/`、`pipeline.ts`

### 依赖关系

- 依赖 Story 1.2（`AiforgeConfig` 类型、`AiforgeError`）
- 依赖 Story 1.3（`Reporter`、`PathResolver`）
- 依赖 Story 1.5（CLI 子命令注册框架，替换占位实现）
- 依赖 Story 2.1（`loadConfig`、`saveConfig`）
- 依赖 Story 2.2（`createGit` 用于连接验证）
- 这是 Epic 2 的最后一个 Story，整合前面所有服务

### 本 Story 不做的事

- 不实现多仓库配置（MVP 只支持一个默认仓库）
- 不实现 Token 自动刷新
- 不实现 SSH Key 自动生成（只提供命令建议）
- 不实现配置迁移（从旧版本格式升级）

### References

- [Source: architecture/03-core-decisions.md#D3] — config.json 结构
- [Source: architecture/04-implementation-patterns.md] — 错误创建模式
- [Source: architecture/05-project-structure.md] — commands/ 模块边界
- [Source: project-context.md#Technology-Stack] — @inquirer/prompts
- [Source: project-context.md#Critical-Dont-Miss-Rules] — 非 TTY 环境处理

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
