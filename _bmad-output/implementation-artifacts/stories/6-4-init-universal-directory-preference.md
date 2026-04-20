# Story 6.4: `aiforge init` 通用目录偏好配置

Status: done

## Story

As a 首次使用 aiforge 的开发者,
I want 在 `aiforge init` 交互流程中设置是否默认安装通用目标目录,
So that 我的偏好被持久化到 `config.json`，后续安装无需每次手动加 `--no-universal`。

## Acceptance Criteria

> **跨 Story 依赖声明**：本 Story 负责 `aiforge init` 的偏好询问与 `config.json` 持久化（AC #1-#2）。AC #3-#5 描述 `aiforge install` 的端到端运行时行为，**由 Story 6-3 实现**，本 Story 的测试只验证 config.json 正确保存了 `universalDirs` 字段值。AC #3-#5 的运行时测试按职责拆分归属 Story 6-3：dry-run 展示与分组验证由 `tests/pipeline.test.ts`（Task 9.3）覆盖；真实 install / manifest / incremental-sync 行为由 Task 9.5 集成测试覆盖。

1. **Given** 用户首次运行 `aiforge init` **When** 执行到通用目录配置步骤 **Then** 终端展示询问"是否默认安装通用目标目录（.agents/、.agent/）？[Y/n]"，默认值为 Y（直接回车即为启用）
2. **Given** 用户在 `aiforge init` 中选择"否"（输入 n）**When** 初始化完成 **Then** `~/.aiforge/config.json` 中写入 `"universalDirs": false`
3. **Given** `config.json` 中 `universalDirs: false`，用户执行 `aiforge install`（不带 `--no-universal`）**When** 安装执行 **Then** 不写入通用目录，行为等同于 `--no-universal`，CLI 参数 `--no-universal` 仍可显式触发（幂等）
4. **Given** `config.json` 中 `universalDirs: true`，用户执行 `aiforge install --no-universal` **When** 安装执行 **Then** CLI 参数优先级高于配置文件，不写入通用目录（遵循三层优先级链：CLI > config > 默认值）
5. **Given** 已有 `config.json` 但缺少 `universalDirs` 字段（升级兼容场景）**When** 执行 `aiforge install` **Then** 系统将缺省值视为 `true`，默认安装通用目录，向下兼容，不报错

## Tasks / Subtasks

- [x] Task 1: 在 `aiforge init` 交互流程中添加通用目录偏好询问 (AC: #1, #2)
  - [x] 1.1 在 `src/commands/init.ts` 的 `runInit()` 中，在连接验证成功后、配置保存之前，添加通用目录偏好询问步骤
  - [x] 1.2 使用 `confirm()` 交互组件（已从 `@inquirer/prompts` 导入）：`const universalDirs = await confirm({ message: msg('init.universalDirsPrompt'), default: true })`
  - [x] 1.3 询问位置：在认证方式选择 + 连接验证成功之后、`const config: AiforgeConfig = { ... }` 配置对象构建之前
  - [x] 1.4 连接验证失败时不询问（因为 `connectionOk === false` 会直接 `return`，自然跳过后续步骤）
  - [x] 1.5 已有配置修改场景：`existingConfig?.universalDirs` 作为 `confirm()` 的 `default` 值（若存在），否则默认 `true`
  - [x] 1.6 注意：`confirm()` 已在 `init.ts` 第 18 行导入（用于“是否修改当前配置”询问），无需新增 import

- [x] Task 2: 将 `universalDirs` 写入配置对象 (AC: #2)
  - [x] 2.1 在 `runInit()` 的配置对象构建中追加 `universalDirs` 字段：
    ```typescript
    const config: AiforgeConfig = {
      ...existingConfig,
      defaultRepo: repoUrl,
      language,
      universalDirs,  // ← 新增
      auth: { ... },
    }
    ```
  - [x] 2.2 `saveConfig()` 已有逻辑直接 `JSON.stringify(config)` 序列化，`universalDirs` 字段自动持久化，无需修改 `services/config.ts`

- [x] Task 3: 扩展 `AiforgeConfig` 类型 (AC: #5)
  - [x] 3.1 **注意**：Story 6-3 已在 `src/core/types.ts` 的 `AiforgeConfig` 接口中添加 `universalDirs?: boolean`。如果 Story 6-3 先于 6-4 实现，此 Task 可跳过
  - [x] 3.2 如果 Story 6-4 先于 6-3 实现：在 `AiforgeConfig` 接口中添加 `universalDirs?: boolean`（可选字段，缺省视为 `true`）
  - [x] 3.3 `isValidConfigStructure()` 无需修改：该函数只校验 `auth` 字段是否为 object，不校验其他可选字段

- [x] Task 4: 已有配置摘要展示 universalDirs 状态 (AC: #1)
  - [x] 4.1 在 `runInit()` 的“显示当前配置摘要”部分（`console.log` 输出区域），追加一行展示 universalDirs 当前状态
  - [x] 4.2 实现：`console.log(\`${msg('init.universalLabel')}${existingConfig.universalDirs !== false ? msg('init.enabled') : msg('init.disabled')}\`)`
  - [x] 4.3 位置：在 `console.log(\`${msg('init.authLabel')}...\`)` 之后

- [x] Task 5: 添加 i18n 消息键 (AC: #1)
  - [x] 5.1 在 `src/core/messages.ts` 的 `MessageSet.init` 分组中添加：
    - `init.universalDirsPrompt`：`"是否默认安装通用目标目录（.agents/、.agent/）？"` / `"Install to universal directories (.agents/, .agent/) by default?"`
    - `init.universalLabel`：`"  通用目录: "` / `"  Universal dirs: "`
    - `init.enabled`：`"启用"` / `"enabled"`
    - `init.disabled`：`"禁用"` / `"disabled"`

- [x] Task 6: 编写单元测试 (AC: #1-5)
  - [x] 6.1 扩展 `tests/commands/init.test.ts`，在现有测试套件中新增 `describe('通用目录偏好 (AC Story 6-4)', () => { ... })` 块
  - [x] 6.2 测试用例：
    - 首次 init 流程中 `confirm()` 被调用，message 包含 `.agents/` 和 `.agent/`，default 为 true
    - 用户选择 `true`（默认）→ 保存的 config 中 `universalDirs: true`
    - 用户选择 `false` → 保存的 config 中 `universalDirs: false`
    - 已有配置含 `universalDirs: false` 且用户选择修改 → `confirm()` 的 `default` 为 `false`（继承已有偏好）
    - 已有配置不含 `universalDirs` 字段 → `confirm()` 的 `default` 为 `true`（缺省值）
    - 已有配置摘要中展示通用目录状态（启用/禁用）
    - 连接验证失败时不询问 universalDirs（不调用对应的 `confirm`）
  - [x] 6.3 测试 mock 模式：复用现有 `mocks.confirm` mock（在 `vi.hoisted` 中已定义），注意区分“是否修改配置” confirm 和 “universalDirs” confirm 的调用顺序
  - [x] 6.4 `confirm` 调用顺序说明：
    - 首次 init（无已有配置）：只有 universalDirs confirm（1 次 confirm 调用）
    - 已有配置修改：先"是否修改？" confirm → ... → universalDirs confirm（2 次 confirm 调用）
    - 使用 `mockResolvedValueOnce` 按序模拟

- [x] Task 7: 跨 Story 验证 AC #3-#5 (AC: #3, #4, #5)
  - [x] 7.1 确认 Story 6-3 已实现并通过以下测试：
    - **`tests/pipeline.test.ts`（Task 9.3）**：dry-run 预览包含/不包含通用目录条目、分组展示正确
    - **Task 9.5 集成测试**：`config.universalDirs: false` 时不写入通用目录（AC #3）；`args.noUniversal = true` 覆盖 `config.universalDirs: true`（AC #4）；`config` 缺少 `universalDirs` 字段时默认启用（AC #5）；真实 install → manifest → incremental-sync 链路验证
  - [x] 7.2 如果 Story 6-3 测试尚未覆盖上述场景，在本 Story 完成后通知 Story 6-3 补充对应测试（本 Story 不直接修改 Story 6-3 文件）
  - [x] 7.3 **注意**：本 Story 自身测试（`tests/commands/init.test.ts`）只验证 config.json 写入正确，不验证运行时安装行为

- [x] Task 8: 质量门禁验证 (AC: #1-5)
  - [x] 8.1 `npm test` — 全绿
  - [x] 8.2 `npm run lint:src` — 退出码 0
  - [x] 8.3 `npm run build` — 构建通过

## Dev Notes

### init.ts 交互流程中的插入位置 [Source: src/commands/init.ts]

当前 `runInit()` 的交互步骤顺序：

```
1. TTY 检测
2. 已有配置检测 → 展示摘要 → 询问是否修改
3. 语言选择（select）
4. 仓库 URL 输入（input）
5. URL 解析（GitSourceResolver.resolve）
6. 认证方式选择（select）
7. 连接验证（SSH 或 Token）
8. 构建配置对象 → 保存
```

**本 Story 的 universalDirs 询问插入在步骤 7 和 8 之间：**

```
7. 连接验证
7.5 通用目录偏好询问（confirm）  ← 新增
8. 构建配置对象 → 保存
```

这确保了：
- 连接验证失败时不询问（步骤 7 失败后 `return`）
- 询问在所有验证完成后、保存前，用户体验流畅

### 具体代码插入点 [Source: src/commands/init.ts 第 148-174 行]

```typescript
  // 连接失败时不保存配置
  if (!connectionOk) {
    return
  }

  // Story 6-4: 通用目录偏好询问
  const universalDirs = await confirm({
    message: msg('init.universalDirsPrompt'),
    default: existingConfig?.universalDirs !== false,  // 缺省或 true → default true；false → default false
  })

  // CR Fix #3: 以 existingConfig 为基础 merge，保留已有字段
  const config: AiforgeConfig = {
    ...existingConfig,
    defaultRepo: repoUrl,
    language,
    universalDirs,  // ← 新增
    auth: {
      ...existingConfig?.auth,
      [hostname]: {
        method: authMethod as 'ssh' | 'token',
        token: authMethod === 'token' ? token : undefined,
      },
    },
  }
```

### confirm 的 default 值逻辑

```typescript
default: existingConfig?.universalDirs !== false
```

- `existingConfig` 不存在（首次配置）：`undefined !== false` → `true`（默认启用）
- `existingConfig.universalDirs === true`：`true !== false` → `true`
- `existingConfig.universalDirs === false`：`false !== false` → `false`（继承已有禁用偏好）
- `existingConfig.universalDirs === undefined`（升级兼容）：`undefined !== false` → `true`（缺省视为启用）

### 已有配置摘要展示

在 `runInit()` 中现有的配置摘要输出区域追加一行：

```typescript
// 现有代码：
console.log(msg('init.currentConfig'))
console.log(`${msg('init.repoLabel')}${existingConfig.defaultRepo ?? msg('init.notSet')}`)
console.log(`${msg('init.authLabel')}${authSummary || msg('init.notSet')}`)
// 新增：
console.log(`${msg('init.universalLabel')}${existingConfig.universalDirs !== false ? msg('init.enabled') : msg('init.disabled')}`)
```

### AC #3 和 #4 的运行时行为（Story 6-3 负责实现）

AC #3（`config.universalDirs: false` 等同于 `--no-universal`）和 AC #4（CLI 参数覆盖 config）的**运行时行为**由 Story 6-3 实现（`pipeline.ts` 中的 `enableUniversal` 计算逻辑）。本 Story 只负责**持久化偏好到 config.json**。

验证方式：
- AC #3 和 #4 的**运行时行为**（真实 install / manifest / incremental-sync）由 Story 6-3 Task 9.5 集成测试覆盖
- AC #3-#5 的 **dry-run 展示与分组验证**由 `tests/pipeline.test.ts`（Story 6-3 Task 9.3）覆盖
- 本 Story 的测试只验证 `config.json` 正确保存了 `universalDirs` 字段值

### AC #5 升级兼容

AC #5（缺少 `universalDirs` 字段时默认为 `true`）的运行时行为由 Story 6-3 在 `pipeline.ts` 中实现：

```typescript
configUniversal = config.universalDirs !== false  // undefined → true
```

本 Story 确保 `AiforgeConfig` 接口中 `universalDirs` 是可选字段（`universalDirs?: boolean`），使得缺少该字段的旧配置文件仍能通过 `isValidConfigStructure()` 校验。

### confirm mock 调用顺序详解 [Source: tests/commands/init.test.ts]

现有测试中 `mocks.confirm` 用于"是否修改当前配置？"（已有配置场景）。新增 universalDirs confirm 后调用顺序：

**首次 init（CONFIG_NOT_FOUND）：**
```
select (语言) → input (URL) → select (认证) → password? (Token) → confirm (universalDirs)
```
- `mocks.confirm` 只调用 1 次：universalDirs

**已有配置修改：**
```
confirm (是否修改) → select (语言) → input (URL) → select (认证) → password? (Token) → confirm (universalDirs)
```
- `mocks.confirm` 调用 2 次：
  - 第 1 次：`mockResolvedValueOnce(true)` — 是否修改配置
  - 第 2 次：`mockResolvedValueOnce(true/false)` — universalDirs

**已有配置不修改：**
```
confirm (是否修改 → false) → return
```
- `mocks.confirm` 调用 1 次：mockResolvedValueOnce(false)，不触发 universalDirs

### 与 Story 6-3 的依赖关系

- **类型定义**：`AiforgeConfig.universalDirs` 字段可能被 Story 6-3 和 6-4 同时需要。两个 Story 独立实现时需注意不要重复添加。Dev Agent 应先检查字段是否已存在
- **运行时行为**：Story 6-3 实现 `pipeline.ts` 中 universalDirs 偏好的读取和应用逻辑。Story 6-4 只实现 `init.ts` 中的写入逻辑
- **可独立开发**：两个 Story 可以独立实现，不互相阻塞。唯一共享点是 `AiforgeConfig` 类型定义

### 模块边界 [Source: architecture/05-project-structure.md]

- 改动文件：`src/commands/init.ts`（交互逻辑）、`src/core/messages.ts`（i18n）、可能 `src/core/types.ts`（AiforgeConfig 类型）
- 不涉及 `stages/`、`services/`、`data/` 目录
- 依赖链：`commands/init.ts` → `core/types.ts` + `core/messages.ts` + `services/config.ts`（均为已有依赖）

### Project Structure Notes

- 新增文件：无
- 修改文件：`src/commands/init.ts`（交互步骤）、`src/core/messages.ts`（i18n 键）、可能 `src/core/types.ts`（AiforgeConfig 扩展，若 6-3 未先实现）
- 测试文件：`tests/commands/init.test.ts`（扩展）

### References

- [Source: epic-6.md — Story 6-4 Acceptance Criteria]
- [Source: FR-053 — `aiforge init` 交互新增通用目录偏好，持久化到 config.json]
- [Source: src/commands/init.ts — 现有交互流程和 confirm 使用模式]
- [Source: src/services/config.ts — saveConfig 序列化逻辑]
- [Source: src/core/types.ts — AiforgeConfig 接口]
- [Source: tests/commands/init.test.ts — 现有测试结构和 mock 模式]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (via GitHub Copilot)

### Debug Log References

无

### Completion Notes List

- Task 3 跳过：Story 6-3 已在 `AiforgeConfig` 接口中添加 `universalDirs?: boolean`
- Task 5：在 `MessageSet` 接口和 zh-CN/en 两套数据中分别添加 4 个新键（`universalDirsPrompt`、`universalLabel`、`enabled`、`disabled`）
- Task 1：在 `init.ts` 连接验证成功后、配置对象构建前插入 `confirm({ message: msg('init.universalDirsPrompt'), default: existingConfig?.universalDirs !== false })`
- Task 2：配置对象中新增 `universalDirs` 字段，`saveConfig()` 自动持久化
- Task 4：已有配置摘要输出中追加通用目录状态行
- Task 6：新增 8 个测试用例，覆盖首次 init、已有配置修改、缺省值、摘要展示、连接失败场景
- Task 7：Story 6-3 已完成，`pipeline.ts` 中 `configUniversal = config.universalDirs !== false` 逻辑已实现
- Task 8：805 测试全绿，lint 和 build 均通过

### File List

- `src/commands/init.ts` — 新增 universalDirs confirm 询问、配置对象写入、摘要展示
- `src/core/messages.ts` — 新增 4 个 i18n 键（MessageSet 接口 + zh-CN/en 数据）
- `tests/commands/init.test.ts` — 新增 8 个测试用例（通用目录偏好 describe 块）
