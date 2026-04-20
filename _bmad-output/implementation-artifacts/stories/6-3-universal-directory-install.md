# Story 6.3: 通用目标目录默认安装

Status: done

## Story

As a 开发者,
I want aiforge 在安装时默认同时将配置写入通用目标目录（`.agents/`、`.agent/`）,
So that 我的项目能兼容多种 AI 工具的新兴目录约定，无需额外操作。

## Acceptance Criteria

1. **Given** 用户执行 `aiforge install`（不带任何额外参数），且 `config.json` 中 `universalDirs` 未设为 false **When** 安装完成 **Then** 除写入 IDE 特定目录外，同时将对应资源完整复制到 `.agents/skills/`、`.agents/agents/`、`.agent/skills/`、`.agent/agents/`，目录结构与 IDE 特定目录一致（完整复制，不扁平化），满足 NFR-C7（复用现有安装引擎，不引入新代码路径）
2. **Given** 用户执行 `aiforge install --no-universal` **When** 安装完成 **Then** 仅写入 IDE 特定目录，不写入任何通用目标目录
3. **Given** 已执行过一次安装（通用目录已有文件），仓库有更新后再次执行 `aiforge install` **When** 安装执行 **Then** 系统检查通用目录中已安装文件与仓库最新版本的哈希差异，有变更的文件重新写入，无变更的文件跳过，`manifest.json` 中通用目录文件与 IDE 特定目录文件分开追踪（通过目标路径前缀区分，无需新增字段）
4. **Given** 用户执行 `--dry-run` **When** 预览输出 **Then** 预览结果中包含通用目录的安装条目（与 IDE 目录并列展示），除非使用了 `--no-universal`
5. **Given** 目标项目目录中通用目录（如 `.agents/`）尚不存在 **When** 安装执行 **Then** 自动创建所需目录，安装正常完成（NFR-R2）

## Tasks / Subtasks

- [x] Task 1: 扩展 `ParsedArgs` 和 CLI 参数解析 (AC: #2)
  - [x] 1.1 在 `src/core/types.ts` 的 `ParsedArgs` 接口中添加 `noUniversal: boolean` 字段（默认 false）
  - [x] 1.2 在 `src/index.ts` 的 commander 定义中添加 `--no-universal` 选项：`.option('--no-universal', 'skip universal directory installation')`（不传第三参数，让 Commander 使用隐式 `--universal` 布尔选项，默认 true）
  - [x] 1.3 在 `src/pipeline.ts` 的 `mapOptsToArgs()` 中映射：`noUniversal: opts.universal === false`（Commander `--no-X` 模式：未传时 `opts.universal === true`，传入 `--no-universal` 时 `opts.universal === false`）
  - [x] 1.4 CLI help 文案使用英文硬编码

- [x] Task 2: 扩展 `AiforgeConfig` 类型和配置加载 (AC: #1, #2)
  - [x] 2.1 在 `src/core/types.ts` 的 `AiforgeConfig` 接口中添加 `universalDirs?: boolean` 字段（可选，缺省视为 true）
  - [x] 2.2 在 `src/pipeline.ts` 的 `runPipeline()` 中（或 `createProductionStages` 工厂中），在 Match 阶段之前从 config 读取 `universalDirs` 偏好
  - [x] 2.3 优先级链（三层）：CLI `--no-universal` > `config.universalDirs` > 默认值 true（不支持环境变量层，MVP 阶段保持简单）

- [x] Task 3: 定义通用目录安装规则 (AC: #1)
  - [x] 3.1 在 `src/data/install-rules.ts` 中新增通用目录规则常量 `UNIVERSAL_RULES: InstallRule[]`
  - [x] 3.2 通用目录规则定义（仅 project scope，4 条规则）：
    ```
    { tool: 'universal', scope: 'project', sourceDir: 'skills',  type: Directories, targetDir: '.agents/skills/' }
    { tool: 'universal', scope: 'project', sourceDir: 'agents',  type: Files,       targetDir: '.agents/agents/' }
    { tool: 'universal', scope: 'project', sourceDir: 'skills',  type: Directories, targetDir: '.agent/skills/' }
    { tool: 'universal', scope: 'project', sourceDir: 'agents',  type: Files,       targetDir: '.agent/agents/' }
    ```
  - [x] 3.3 `UNIVERSAL_RULES` 不加入 `RULE_INDEX`（不参与工具检测匹配），由 Match 阶段在常规规则匹配完成后单独追加
  - [x] 3.4 注意 `tool: 'universal'` 是虚拟工具 ID，不在 `TOOL_DEFINITIONS` 注册表中（无需检测）

- [x] Task 4: 在 Match 阶段追加通用目录计划 (AC: #1, #4)
  - [x] 4.1 修改 `src/stages/match-rules.ts` 的 `matchRules()` 函数：在常规规则匹配完成后，如果 `universalDirs` 启用（非 `--no-universal`），追加通用目录规则的 MatchedPlan items
  - [x] 4.2 实现方式：从 `UNIVERSAL_RULES` 中过滤出与当前 scope 匹配的规则，对每条规则执行 `scanSourceFiles` + `resolveTargetDir`，追加到 `items` 数组
  - [x] 4.3 通用目录的 mode 始终为 `'copy'`（NFR-C7：复用现有安装引擎的复制模式，即使用户指定了 `--link`）
  - [x] 4.4 通用目录只在 project scope 下生效（global 安装不写通用目录——通用目录是项目级的 `.agents/`、`.agent/`）
  - [x] 4.5 `--filter` 同样适用于通用目录规则（保持一致性）
  - [x] 4.6 dry-run 一致性（AC #4）：通用目录计划包含在 MatchedPlan 中，自动参与 Report 输出

- [x] Task 5: 传递 universalDirs 参数到 Match 阶段 (AC: #1, #2)
  - [x] 5.1 **唯一实现方案（已锁定）**：在 `createProductionStages()` 工厂中，match 闭包内加载 config 获取 `universalDirs` 偏好，与 `args.noUniversal` 合并后决定是否追加通用规则
  - [x] 5.2 合并逻辑：`const enableUniversal = !args.noUniversal && (config.universalDirs !== false)`
  - [x] 5.3 config 加载失败时的降级规则：**仅对 `error instanceof AiforgeError && error.code === 'CONFIG_NOT_FOUND'` 降级**（`universalDirs` 视为 true，默认启用）；其他所有错误（包括 `CONFIG_CORRUPT`、`CONFIG_READ_FAILED` 及 Node.js 原生 SystemError）必须 `throw error` 透传——禁止类型断言（`as NodeJS.ErrnoException`）绕过 `instanceof` 守卫，防止误判带 `code` 属性的非 `AiforgeError` 异常（遵循项目 Error Handling 逐码白名单规则）
  - [x] 5.4 `enableUniversal` 通过闭包捕获传透给 `matchRules()` 的通用目录追加逻辑（与项目现有的阶段工厂模式一致）

- [x] Task 6: 确保 Install + Manifest 正确处理通用目录 (AC: #3, #5)
  - [x] 6.1 通用目录的安装走现有 `executeInstall()` 逻辑——因为它们已作为 `MatchedPlan.items` 追加，Install 阶段无需知道"这些是通用目录"（NFR-C7 核心要求：不引入新代码路径）
  - [x] 6.2 `ensureDir()` 自动创建不存在的目录（AC #5，已有逻辑）
  - [x] 6.3 manifest 追踪：通用目录文件的 `ManifestEntry.tool` 为 `'universal'`，`target` 路径以 `.agents/` 或 `.agent/` 开头，与 IDE 特定目录文件自然区分（AC #3 "通过目标路径前缀区分，无需新增字段"）
  - [x] 6.4 增量同步（AC #3）：当前 `Directories` 类型的 `determineDirStatus()` 仅返回 `'new'` / `'updated'`，不存在 `'skipped'` 路径，`copyDir()` 对两种状态均无条件执行全量复制，`pipeline.ts` 为 `Directories` 类型写入空 hash `''`。**因此现有目录级链路无法实现 AC #3 的增量同步。**
    
    **实现策略（文件级 hash 比对方案）**：通用 skills 目录（`type: Directories`）的增量同步采用文件级可比对方案（与 AC #3 原文“有变更的文件重新写入，无变更的文件跳过”的文件粒度描述一致）：
    - 在 `copyDir()` 内部（或其前置步骤）遍历源目录文件，逐文件计算 hash
    - 与 manifest 中该目标路径的已记录 hash 比对
    - hash 相同→ skip，hash 不同或无记录→ write + 更新 manifest entry
    - manifest 为 `Directories` 类型每个文件单独记录 entry（而非当前整目录单条空 hash）
    - 这复用了现有 `Files` 类型已验证可用的文件级 hash 机制
    
    **注意**：此方案需要在 `executeInstall()` 的 `Directories` 分支新增文件级比对逻辑，是对现有代码路径的有限扩展（而非“零改动”），但这是满足 AC #3 的必要改动

- [x] Task 7: 扩展 Reporter 以展示通用目录结果 (AC: #1, #4)
  - [x] 7.1 通用目录安装结果的 `tool` 字段为 `'universal'`，Reporter 按工具分组时会单独列出
  - [x] 7.2 为 `'universal'` 提供显示名称：在 `TOOL_DEFINITIONS` 之外单独处理（因为 universal 不是真实工具）
  - [x] 7.3 方案：在 `executeInstall()` 的 `toolNameMap` 构建后，手动追加 `toolNameMap.set('universal', 'Universal Dirs')`，或者在 `InstallResult.items` 中直接设置 `toolDisplayName`
  - [x] 7.4 替代方案（更简洁）：在 `matchRules` 追加通用规则 item 时，利用与 `TOOL_DEFINITIONS` 查找相同的逻辑——但 universal 不在注册表中，所以需要 fallback 到 `tool` id 本身

- [x] Task 8: 添加 i18n 消息键 (AC: #1)
  - [x] 8.1 在 `src/core/messages.ts` 添加：
    - `reporter.universalDirsLabel`：`"通用目录"` / `"Universal Dirs"`（Reporter 分组标题）

- [x] Task 9: 编写单元测试 (AC: #1-5)
  - [x] 9.1 扩展 `tests/stages/match-rules.test.ts`：
    - 默认（无 `--no-universal`）时 MatchedPlan 包含通用目录 items
    - `--no-universal` 时 MatchedPlan 不包含通用目录 items
    - `config.universalDirs: false` 时 MatchedPlan 不包含通用目录 items
    - CLI `--no-universal` 覆盖 `config.universalDirs: true`
    - global scope 下不追加通用目录规则
    - `--filter` 同样过滤通用目录的 sourceFiles
  - [x] 9.2 扩展 `tests/stages/execute-install.test.ts`：通用目录安装验证文件级 hash 扩展行为
    - Files 类型通用规则：走现有 copy 逻辑，目录自动创建
    - Directories 类型通用规则：验证 `Directories` 分支的文件级 hash 比对逻辑（hash 相同→ skip，hash 不同→ write）
    - `toolNameMap` 对 `'universal'` 的 fallback 显示名称正确
  - [x] 9.3 扩展 `tests/pipeline.test.ts`（仅负责 dry-run 展示和分组验证）：
    - dry-run 预览包含通用目录条目（与 IDE 目录并列展示）
    - `--no-universal` 时 dry-run 不包含通用目录
    - 注意：manifest 运行时正确性验证由 Task 9.5 的集成测试负责，此处不重复覆盖
  - [x] 9.5 新增增量同步集成测试（`tests/integration/` 或使用真实 stages 工厂）：
    - 增量同步：第二次安装时通用目录中未变更的文件被 skip
    - 必须使用真实 `executeInstall()` → `saveManifest()` 链路（而非 mocked stages），验证文件级 hash 比对的运行时行为
    - 覆盖场景：首次安装全量写入 → 二次安装无变更 skip → 三次安装有变更部分重新写入
  - [x] 9.4 `tests/data/install-rules.test.ts`：验证 `UNIVERSAL_RULES` 定义正确，不在 `RULE_INDEX` 中

- [x] Task 10: 质量门禁验证 (AC: #1-5)
  - [x] 10.1 `npm test` — 全绿
  - [x] 10.2 `npm run lint:src` — 退出码 0
  - [x] 10.3 `npm run build` — 构建通过

## Dev Notes

### 核心设计原则：NFR-C7 — 复用现有安装引擎 [Source: epic-6.md]

通用目录安装**复用现有安装引擎**，实现方式是在 Match 阶段将通用规则作为额外的 `MatchedPlan.items` 追加。从 Install 阶段视角看，通用目录 items 与 IDE 特定目录 items 没有区别——都是 `{ rule, sourceFiles, targetPath, mode }` 结构。

**注意**：AC #3 增量同步要求通用 skills 目录（`type: Directories`）支持文件级 hash 比对。当前 `determineDirStatus()` 仅返回 `'new'` / `'updated'`，`copyDir()` 对两种状态均全量复制，`pipeline.ts` 为 `Directories` 写入空 hash。因此 `executeInstall()` 的 `Directories` 分支**需要有限扩展**以支持文件级 hash 比对——这是满足 AC #3 的必要改动（详见 Task 6.4）。

这意味着：
- `executeInstall()` 需有限扩展：`Directories` 分支需新增文件级 hash 比对逻辑以支持 AC #3 增量同步（详见 Task 6.4）
- `saveManifest()` 需调整：manifest 为 `Directories` 类型每个文件单独记录 entry（而非当前整目录单条空 hash）
- `preflight()` 零改动（通用目录路径同样参与安全校验）
- 冲突检测零改动（基于 targetPath + hash）

### 通用目录规则定义 [Source: FR-050]

```typescript
// src/data/install-rules.ts

export const UNIVERSAL_RULES: InstallRule[] = [
  // .agents/ 目录
  { tool: 'universal', scope: 'project', sourceDir: 'skills',  type: Directories, targetDir: '.agents/skills/' },
  { tool: 'universal', scope: 'project', sourceDir: 'agents',  type: Files,       targetDir: '.agents/agents/' },
  // .agent/ 目录
  { tool: 'universal', scope: 'project', sourceDir: 'skills',  type: Directories, targetDir: '.agent/skills/' },
  { tool: 'universal', scope: 'project', sourceDir: 'agents',  type: Files,       targetDir: '.agent/agents/' },
]
```

**关键决策：**
- `tool: 'universal'` — 虚拟工具 ID，不在检测注册表中
- `scope: 'project'` — 通用目录只在项目级（`.agents/` 是项目根目录下的目录，不是全局配置）
- `type: Directories` for skills / `type: Files` for agents — 与主流 IDE 规则一致（skills 是目录级安装，agents 是文件级安装）
- 不含 `instructions`、`mcp-tools`、`Flatten` 类型（通用目录约定只覆盖 skills 和 agents）

### Match 阶段追加逻辑 [Source: src/stages/match-rules.ts]

在 `matchRules()` 函数的 `reporter.completePhase()` 之前：

```typescript
// 通用目录追加（Story 6-3）
// 仅在 project scope 且 universalDirs 启用时追加
if (env.scope === 'project' && enableUniversal) {
  for (const rule of UNIVERSAL_RULES) {
    // 只处理当前 scope 匹配的规则（UNIVERSAL_RULES 全部是 project，此处为防御性校验）
    if (rule.scope !== env.scope) continue

    // --dirs 过滤同样适用于通用规则
    if (args.dirs && args.dirs.length > 0 && !args.dirs.includes(rule.sourceDir)) continue

    const sourceFiles = await scanSourceFiles(repo.repoDir, rule)

    // --filter 同样适用于通用规则
    if (args.filter) {
      // ... 复用 Task 6-2 的 filter 逻辑
    }

    const targetPath = resolveTargetDir(rule, env.scope, pathResolver)
    // 通用目录始终 copy 模式（NFR-C7）
    const mode: 'copy' | 'symlink' = 'copy'

    items.push({ rule, sourceFiles, targetPath, mode })
  }
}
```

### universalDirs 偏好传递（已锁定方案）

`matchRules` 需要知道是否启用通用目录。两个信息源：
1. `args.noUniversal`（CLI 参数，已在 ParsedArgs 中）
2. `config.universalDirs`（配置文件偏好）

**唯一实现方案**：在 `createProductionStages()` 工厂中，match 闭包内加载 config 并计算 `enableUniversal`，通过闭包捕获传透给 `matchRules()` 的通用目录追加逻辑（与项目现有的阶段工厂模式一致）：

```typescript
// 在 createProductionStages 的 match 闭包中
// 注意：config 加载可能失败（首次使用无配置），失败时默认启用通用目录
let configUniversal = true
try {
  const config = await loadConfig(pathResolver)
  configUniversal = config.universalDirs !== false
} catch (error) {
  // 仅对 AiforgeError(CONFIG_NOT_FOUND) 降级为默认启用
  // 使用 instanceof 守卫而非类型断言，防止误判带 code 属性的 Node.js 原生 SystemError
  if (error instanceof AiforgeError && error.code === 'CONFIG_NOT_FOUND') {
    // CONFIG_NOT_FOUND = 首次使用，配置文件尚未创建，正常降级
  } else {
    throw error  // CONFIG_CORRUPT / CONFIG_READ_FAILED / 其他错误透传
  }
}
const enableUniversal = !args.noUniversal && configUniversal
```

### manifest 追踪细节 [Source: project-context.md — Data Format Rules]

通用目录文件的 `ManifestEntry` 示例：

```json
{
  "source": "skills/git-commit/index.md",
  "target": "/path/to/project/.agents/skills/git-commit/index.md",
  "tool": "universal",
  "scope": "project",
  "mode": "copy",
  "hash": "abc123...",
  "installedAt": "2026-04-13T..."
}
```

- `tool: 'universal'` 自动区分于 `tool: 'copilot'` 等 IDE 条目
- `target` 路径前缀 `.agents/` 或 `.agent/` 进一步标识
- 同一个源文件（如 `skills/git-commit/`）会有多个 manifest 条目：一个 for copilot（`.github/skills/git-commit/`）、一个 for `.agents/skills/git-commit/`、一个 for `.agent/skills/git-commit/`

### 跨层共享字段安全检查 [Source: project-context.md — 跨层共享字段禁止语义扩展]

本 Story 新增 `tool: 'universal'`。需确认所有消费 `tool` 字段的模块是否兼容：

1. `executeInstall()`：`toolNameMap.get(item.rule.tool)` — universal 不在 `TOOL_DEFINITIONS` 中，`get()` 返回 `undefined`，`toolDisplayName` 为 `undefined`，Reporter fallback 到 `tool` id 本身 → 需要处理
2. `Reporter.reportResult()`：按 `item.tool` 分组，`displayName = items[0]?.toolDisplayName ?? tool` → universal 会显示为 `'universal'`，不太友好 → Task 7 处理
3. `Reporter.reportPlan()`：按 `item.rule.tool` 分组 → 同上
4. `saveManifest()`：`planInfo.tool` 直接写入 manifest → OK，`'universal'` 是合法字符串
5. `checkConflict()`：按 `target` 路径匹配 → 不涉及 `tool` 字段 → OK

结论：只需在 Reporter 层为 `'universal'` 提供友好显示名称。

### 与 Story 6-4 的关系

Story 6-4（`aiforge init` 通用目录偏好配置）负责在 init 流程中添加 `universalDirs` 偏好询问。本 Story（6-3）实现运行时行为，可以独立开发——config 中缺少 `universalDirs` 字段时默认为 true（AC #1 中"未设为 false"的语义）。

### Project Structure Notes

- 新增文件：无新文件（所有改动在现有文件中）
- 修改文件：
  - `src/core/types.ts`（ParsedArgs + AiforgeConfig 扩展）
  - `src/index.ts`（CLI 选项 `--no-universal`）
  - `src/pipeline.ts`（mapOptsToArgs + config 加载 + enableUniversal 计算 + `Directories` 类型 manifest 条目从整目录空 hash 改为文件级单独记录）
  - `src/data/install-rules.ts`（新增 UNIVERSAL_RULES）
  - `src/stages/match-rules.ts`（通用目录追加逻辑）
  - `src/stages/execute-install.ts`（`Directories` 分支新增文件级 hash 比对逻辑以支持 AC #3 增量同步 + toolNameMap fallback）
  - `src/core/messages.ts`（i18n 键）
- 测试：`tests/stages/match-rules.test.ts`（扩展）、`tests/stages/execute-install.test.ts`（扩展，含 Directories 文件级 hash 验证）、`tests/pipeline.test.ts`（扩展，dry-run 展示）、`tests/data/install-rules.test.ts`（扩展）、`tests/integration/`（新增增量同步集成测试，Task 9.5）

### References

- [Source: epic-6.md — Story 6-3 Acceptance Criteria]
- [Source: FR-050 — 通用目录默认并行安装]
- [Source: FR-051 — `--no-universal` opt-out]
- [Source: FR-052 — 增量同步检查通用目录]
- [Source: NFR-C7 — 复用现有安装引擎]
- [Source: NFR-R2 — 目标目录不存在时自动创建]
- [Source: architecture/03-core-decisions.md#D2 — 规则存储与匹配]
- [Source: src/data/install-rules.ts — BUILTIN_RULES 结构]
- [Source: src/stages/match-rules.ts — matchRules 主循环]
- [Source: project-context.md — 跨层共享字段禁止语义扩展规则]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (GitHub Copilot)

### Completion Notes List

1. **Directories copy 模式架构决策**：执行 AC #3 增量同步时，将 `executeInstall()` 的 `Directories copy` 分支从整目录级（`determineDirStatus` + `copyDir`）全面改为文件级 hash 比对（`walkDirFiles` + `determineStatus` per file）。`detectDirConflict` 仅保留在 `symlink` 子分支，copy 模式不做目录级冲突检测。这导致旧的 4 个"Directories copy + user-file 冲突"测试语义变化，已更新为新行为：copy 模式保留目标目录中 src 不存在的用户文件，仅按 hash 安装/跳过 src 中的文件。

2. **`pipeline.ts` `saveManifest` hash 计算修改**：`isDirectoryType`（原用 `startsWith` 匹配 `.../` 路径）改为 `isDirectoryLevelEntry`（仅 `directMatch`），确保 Directories 类型每个文件级 entry 进行真实 hash 计算而非写空 hash `''`。

3. **未使用代码清理**：`copyDir` 导入从 `execute-install.ts` 移除（Directories copy 模式改用 `walkDirFiles + copyFile`）；`determineDirStatus` 函数删除。

4. **集成测试 cwd 隔离**：`tests/integration/universal-dirs-sync.test.ts` 中使用 `process.chdir(tmpDir)` 避免 project scope 路径写入真实项目目录（`.claude/` 存在导致 `CONFLICT_NON_TTY` 错误）。

### File List

**源码修改：**
- `src/core/types.ts` — `ParsedArgs.noUniversal: boolean`，`AiforgeConfig.universalDirs?: boolean`
- `src/core/messages.ts` — `MessageSet.reporter.universalDirsLabel` i18n
- `src/data/install-rules.ts` — `UNIVERSAL_RULES` 常量（4 条规则）
- `src/index.ts` — `--no-universal` CLI 选项
- `src/pipeline.ts` — `mapOptsToArgs`、`enableUniversal` 计算、`isDirectoryLevelEntry` hash 修复
- `src/stages/match-rules.ts` — `enableUniversal` 参数、通用目录追加逻辑
- `src/stages/execute-install.ts` — `walkDirFiles` 辅助函数、Directories copy 文件级 hash、`toolNameMap.set('universal', ...)`、删除 `determineDirStatus`

**测试修改：**
- `tests/stages/match-rules.test.ts` — 6 个新 universal 测试
- `tests/stages/execute-install.test.ts` — 5 个新文件级 hash 测试，4 个旧冲突测试更新语义
- `tests/integration/pipeline.test.ts` — `noUniversal: false`，item count 断言更新
- `tests/integration/pipeline-production-stages.test.ts` — `noUniversal: false`，cursor 项目用 `noUniversal: true` 隔离
- `tests/cli-args.test.ts` — 2 个 `--no-universal` 测试
- `tests/data/install-rules.test.ts` — 5 个 `UNIVERSAL_RULES` 测试

**新增文件：**
- `tests/integration/universal-dirs-sync.test.ts` — AC #1/2/3 端到端集成测试（3 个测试）
