# Story 2.1: 配置管理服务

Status: done

## Story

As a 用户,
I want 系统持久化我的配置和认证信息,
So that 不需要每次运行都重新输入仓库地址和认证方式。

## Acceptance Criteria

1. **Given** `services/config.ts` 已创建 **When** 首次写入配置 **Then** 创建 `~/.aiforge/config.json`，文件权限为 `0o600`（NFR-S4），目录 `~/.aiforge/` 不存在时自动创建
2. **Given** 配置文件已存在 **When** 读取配置 **Then** 正确解析 `AiforgeConfig` 结构：`defaultRepo`、`cloneDir`、`language`、`preferSSH`、`auth`（FR-040）
3. **Given** 用户配置了多个 Git host 的认证 **When** 读取特定 host 的认证信息 **Then** 返回该 host 对应的 `method` 和 `token`（FR-042），不同 host 可以使用不同的认证方式
4. **Given** 配置文件损坏（非法 JSON）**When** 读取配置 **Then** 抛出 `AiforgeError`，提示配置文件损坏并建议运行 `aiforge init` 重新配置
5. **Given** 配置文件不存在 **When** 调用 `loadConfig()` **Then** 抛出 `AiforgeError(code: 'CONFIG_NOT_FOUND', severity: 'fatal')`，由调用方（CLI / pipeline）负责向用户提示运行 `aiforge init`（FR-041）

## Tasks / Subtasks

- [x] Task 1: 创建 `src/services/config.ts` — 配置读写服务 (AC: #1, #2, #3, #4, #5)
  - [x] 1.1 实现 `loadConfig(pathResolver: PathResolver): Promise<AiforgeConfig>` — 读取并解析 config.json
  - [x] 1.2 实现 `saveConfig(config: AiforgeConfig, pathResolver: PathResolver): Promise<void>` — 写入 config.json（原子写入：临时文件 + rename）
  - [x] 1.3 实现 `getHostAuth(config: AiforgeConfig, hostname: string): HostAuth | undefined` — 按 host 查找认证信息（`HostAuth` 类型需在 Story 1.2 的 `core/types.ts` 中补充定义：`{ method: AuthMethod; token?: string }`）
  - [x] 1.4 实现 `ensureConfigDir(pathResolver: PathResolver): Promise<void>` — 确保 `~/.aiforge/` 目录存在
  - [x] 1.5 文件权限处理：写入后 `fs.chmod(configPath, 0o600)`
  - [x] 1.6 错误处理：JSON 解析失败 → `AiforgeError(code: 'CONFIG_CORRUPT')`；文件不存在 → `AiforgeError(code: 'CONFIG_NOT_FOUND')`
- [x] Task 2: 编写单元测试 (AC: #1-5)
  - [x] 2.1 `tests/services/config.test.ts`
  - [x] 2.2 测试用例：正常读写、多 host 认证查找、损坏 JSON 抛错、文件不存在抛错、目录自动创建、文件权限 0o600
  - [x] 2.3 使用 vitest mock `fs` 模块，注入 mock PathResolver

## Dev Notes

### 架构约束 [Source: architecture/03-core-decisions.md#D3]

`AiforgeConfig` 接口已在 Story 1.2 的 `core/types.ts` 中定义：

```typescript
interface AiforgeConfig {
  defaultRepo?: string;
  cloneDir?: string;           // 默认 ~/.aiforge/repos/
  language?: string;           // 默认 zh-CN
  preferSSH?: boolean;         // 全局默认认证偏好
  auth: Record<string, {       // 按 hostname 索引
    method: 'ssh' | 'token';
    token?: string;
  }>;
}
```

认证优先级链（本 Story 只负责 config 层，完整链在 Story 2.3 实现）：
CLI `--ssh`/`--token` > 环境变量 > `auth[host].method`（per-host）> `preferSSH`（全局默认）> 系统凭据

### 模块边界 [Source: architecture/05-project-structure.md]

- `services/` 只依赖 `core/`（PathResolver、AiforgeError、types）
- 不依赖 `stages/`、`data/`、`commands/`
- 使用 `PathResolver.configDir()` 获取配置目录路径，不硬编码 `~/.aiforge/`

### 原子写入模式 [Source: architecture/03-core-decisions.md#D3b]

```typescript
import { writeFile, rename, chmod } from 'node:fs/promises';
import { join } from 'node:path';

async function saveConfig(config: AiforgeConfig, pathResolver: PathResolver): Promise<void> {
  const configPath = join(pathResolver.configDir(), 'config.json');
  const tmpPath = configPath + '.tmp';
  await writeFile(tmpPath, JSON.stringify(config, null, 2), 'utf-8');
  await rename(tmpPath, configPath);
  await chmod(configPath, 0o600);
}
```

### 错误创建模式 [Source: architecture/04-implementation-patterns.md]

```typescript
// 配置损坏
throw new AiforgeError(
  '配置文件损坏',
  'CONFIG_CORRUPT',
  3,
  'fatal',
  'config.json 不是有效的 JSON 格式',
  ['npx aiforge init  # 重新配置']
);

// 配置不存在
throw new AiforgeError(
  '未找到配置文件',
  'CONFIG_NOT_FOUND',
  3,
  'fatal',
  '尚未运行初始化配置',
  ['npx aiforge init  # 首次配置']
);
```

### JSON 字段命名 [Source: architecture/04-implementation-patterns.md]

config.json 字段一律 camelCase，与 TypeScript 接口一致：
```json
{
  "defaultRepo": "https://gitlab.com/org/aicoding-base.git",
  "cloneDir": "~/.aiforge/repos/",
  "language": "zh-CN",
  "preferSSH": false,
  "auth": {
    "gitlab.com": { "method": "token", "token": "glpat-xxx" },
    "github.com": { "method": "ssh" }
  }
}
```

### 依赖关系

- 依赖 Story 1.1（项目骨架、fs 依赖）
- 依赖 Story 1.2（`AiforgeConfig` 类型、`AiforgeError` 类）
- 依赖 Story 1.3（`PathResolver` 接口）
- 被 Story 2.2（知识源解析）、Story 2.3（认证链）、Story 2.5（init 命令）依赖

### 本 Story 不做的事

- 不实现 `aiforge init` 交互式流程（Story 2.5）
- 不实现认证解析链逻辑（Story 2.3）
- 不实现 manifest.json 管理（Story 4.4）

### Project Structure Notes

文件位置严格遵循架构定义：
- 实现文件：`src/services/config.ts`
- 测试文件：`tests/services/config.test.ts`
- 运行时数据：`~/.aiforge/config.json`（通过 PathResolver 解析）

### References

- [Source: architecture/03-core-decisions.md#D3] — config.json 结构和按 host 分层
- [Source: architecture/03-core-decisions.md#D4] — AiforgeError 和三段式错误
- [Source: architecture/04-implementation-patterns.md] — JSON 字段命名、错误创建模式
- [Source: architecture/05-project-structure.md] — services/ 模块边界
- [Source: project-context.md#Security-Rules] — 文件权限 0o600
- [Source: project-context.md#Data-Format-Rules] — JSON camelCase、原子写入

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4 (via Claude Code)

### Debug Log References

无异常

### Completion Notes List

- ✅ 实现 `loadConfig()` — 读取 config.json，ENOENT → CONFIG_NOT_FOUND，JSON.parse 失败 → CONFIG_CORRUPT
- ✅ 实现 `saveConfig()` — 原子写入（tmp + rename + chmod 0o600），写入前自动 ensureConfigDir
- ✅ 实现 `getHostAuth()` — 按 hostname 从 config.auth 查找 HostAuth
- ✅ 实现 `ensureConfigDir()` — access 检查 + recursive mkdir
- ✅ 新增 `HostAuth` 接口到 `core/types.ts`，`AiforgeConfig.auth` 改为 `Record<string, HostAuth>`
- ✅ 更新 `services/index.ts` barrel export
- ✅ 12 个单元测试全部通过：正常读写、多 host 认证、损坏 JSON、文件不存在、目录自动创建、权限 0o600
- ✅ 全量 218 测试零回归

### Change Log

- 2026-03-23: Story 2.1 实现完成 — 配置管理服务（loadConfig/saveConfig/getHostAuth/ensureConfigDir）+ 12 单元测试

### File List

- `src/services/config.ts` — 新增：配置读写服务（loadConfig、saveConfig、getHostAuth、ensureConfigDir）
- `src/services/index.ts` — 修改：添加 config 模块 barrel export
- `src/core/types.ts` — 修改：新增 HostAuth 接口，AiforgeConfig.auth 类型引用 HostAuth
- `tests/services/config.test.ts` — 新增：12 个单元测试
