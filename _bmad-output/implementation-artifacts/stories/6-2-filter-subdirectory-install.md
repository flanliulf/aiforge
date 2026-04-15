# Story 6.2: `--filter` 精准子目录安装

Status: ready-for-dev

## Story

As a 开发者,
I want 通过 `--filter <dir>/<glob>` 只安装仓库某顶层目录下名称匹配的子目录,
So that 我不必安装整个仓库内容，只取我需要的几个 skill 或 agent。

## Acceptance Criteria

1. **Given** 仓库 `skills/` 下有 `git-commit/`、`git-push/`、`code-review/`、`deploy/` 四个子目录 **When** 用户执行 `aiforge install --filter skills/git*` **Then** 只安装 `git-commit/` 和 `git-push/`，其余两个子目录不被安装，安装结果汇总中只展示匹配到的两个条目
2. **Given** 用户同时指定 `--dirs skills --filter skills/git*` **When** 命令执行 **Then** `--dirs skills` 限定顶层目录为 `skills/`，`--filter skills/git*` 在此范围内筛选，结果与单独使用 `--filter skills/git*` 一致
3. **Given** 用户只指定 `--filter git*`（不带顶层目录前缀）**When** 命令执行 **Then** 对所有顶层目录（`skills/`、`agents/` 等）下名称匹配 `git*` 的子目录均执行安装，不限定顶层目录范围
4. **Given** 用户执行 `--filter skills/xyz*`，但 `skills/` 下没有任何以 `xyz` 开头的子目录 **When** 命令执行 **Then** 触发交互式询问，展示 `skills/` 下所有可用子目录名称列表（NFR-U6），提示用户修正 pattern 或选择取消，不直接以错误码退出
5. **Given** 用户在 `--dry-run` 模式下同时使用 `--filter` **When** 命令执行 **Then** 预览计划中只展示匹配子目录的安装条目，与实际安装结果一致

## Tasks / Subtasks

- [ ] Task 1: 扩展 `ParsedArgs` 和 CLI 参数解析 (AC: #1)
  - [ ] 1.1 在 `src/core/types.ts` 的 `ParsedArgs` 接口中添加 `filter?: string` 字段（可选，值为用户指定的 filter pattern）
  - [ ] 1.2 在 `src/index.ts` 的 commander 定义中添加 `--filter <pattern>` 选项：`.option('--filter <pattern>', 'filter subdirectories by glob pattern')`
  - [ ] 1.3 在 `src/pipeline.ts` 的 `mapOptsToArgs()` 中映射 `filter` 字段：`filter: opts['filter'] as string | undefined`
  - [ ] 1.4 CLI help 文案使用英文硬编码

- [ ] Task 2: 实现 filter pattern 解析逻辑 (AC: #1, #2, #3)
  - [ ] 2.1 创建 `src/stages/filter-utils.ts`，导出 `parseFilterPattern(pattern: string): { dirPrefix?: string; glob: string }`
  - [ ] 2.2 解析规则：
    - `skills/git*` → `{ dirPrefix: 'skills', glob: 'git*' }`（带顶层目录前缀）
    - `git*` → `{ dirPrefix: undefined, glob: 'git*' }`（无前缀，匹配所有顶层目录）
    - 分割点为第一个 `/`：`/` 左侧为 `dirPrefix`，右侧为 `glob`
  - [ ] 2.3 导出 `matchesGlob(name: string, glob: string): boolean` — 简单 glob 匹配（支持 `*` 通配符和 `?` 单字符匹配，MVP 不需要 `**` 递归）
  - [ ] 2.4 实现注意：不引入外部 glob 库（如 minimatch），使用简单正则转换即可覆盖 `*` 和 `?` 场景（MVP 够用）

- [ ] Task 3: 在 Match 阶段集成 filter 逻辑 (AC: #1, #2, #3, #5)
  - [ ] 3.1 在 `src/stages/match-rules.ts` 的 `matchRules()` 主循环中集成 filter 逻辑：过滤位置统一为 `scanSourceFiles` 返回后、`items.push` 之前（**不修改 `scanSourceFiles()` 函数本身**，保持其为纯扫描职责）
  - [ ] 3.2 过滤逻辑位置：在 `scanSourceFiles` 返回后、`items.push` 之前，对 `sourceFiles` 执行二次过滤
  - [ ] 3.3 具体实现：在 `matchRules()` 主循环内，`scanSourceFiles` 返回后：
    ```
    如果 args.filter 非空：
      解析 filter → { dirPrefix, glob }
      如果 dirPrefix 存在且 dirPrefix !== rule.sourceDir → sourceFiles = []（不匹配当前规则的顶层目录）
      否则：过滤 sourceFiles，只保留 basename 匹配 glob 的条目
    过滤完成后：如果 sourceFiles.length === 0 → 不执行 items.push，跳过此条规则
    ```
    **注意**：空 item 必须在 push 前剔除，否则 `reportPlan()` 会为空 item 输出 `emptySourceDir` 行，违反 AC #5（dry-run 只展示匹配条目）
  - [ ] 3.4 `--dirs` 与 `--filter` 联合语义（AC #2）：`--dirs` 先过滤规则级别（已有逻辑），`--filter` 再过滤文件级别。两者正交、叠加，无需特殊交互逻辑
  - [ ] 3.5 注意 `--filter` 对三种 InstallType 的影响：
    - `Directories` / `Flatten`：`sourceFiles` 是子目录列表，按子目录 basename 匹配 glob ✅
    - `Files`：`sourceFiles` 是文件列表，按文件 basename 匹配 glob ✅（虽然 FR-048 描述为"子目录"过滤，但 filter 逻辑应通用于所有 sourceFiles）
  - [ ] 3.6 dry-run 一致性（AC #5）：filter 在 Match 阶段执行，Match 输出同时供 Install 和 Report 消费。filter 后必须剔除空 item（Task 3.3 守卫），以保证 dry-run 预览中不包含未匹配规则的 `emptySourceDir` 输出行

- [ ] Task 4: 实现零匹配交互式询问 (AC: #4)
  - [ ] 4.1 在 `src/stages/match-rules.ts` 的 `matchRules()` 中，全部规则处理完毕后检测：如果 `args.filter` 非空，且最终 `items` 中所有条目的 `sourceFiles` 均为空，触发零匹配处理
  - [ ] 4.2 零匹配处理逻辑：
    - 扫描可用子目录列表：**复用 Story 6-1 `list-contents.ts` 导出的 `scanAvailableTopDirs(baseDir)`**；传入的 `baseDir` 必须按以下规则确定：
      - **prefixed case**（如 `--filter skills/xyz*`，`dirPrefix = 'skills'`）：传入 `join(repo.repoDir, dirPrefix)`，扫描 `skills/` 下的子目录（即用户关心的候选列表）
      - **unprefixed case**（如 `--filter xyz*`，`dirPrefix = undefined`）：传入 `repo.repoDir`，扫描仓库顶层目录
      - 两种 case 统一使用 `const scanDir = dirPrefix ? join(repo.repoDir, dirPrefix) : repo.repoDir`
    - TTY 环境：通过 `@inquirer/prompts` 的 `select()` 展示可用子目录，用户可选择或取消
    - 非 TTY 环境：抛出 `AiforgeError`，错误码 `FILTER_NO_MATCH`，`fix[]` 中列出可用子目录
  - [ ] 4.3 用户选择后：用局部变量 `resolvedFilter` 保存用户选择的**限定名称**（如 `skills/git-commit`，必须保留顶层目录前缀 `dirPrefix/`），重新执行 `scanSourceFiles` + filter 逻辑；**禁止改写 `args.filter`**（`ParsedArgs` 只读原则，改写 args 会丢失原始 `dirPrefix` 作用域，导致重新匹配时跨目录扩散）
  - [ ] 4.4 用户取消：抛出独立 sentinel class `FilterCancelledSignal`（**不继承 `AiforgeError`**，也不继承 `Error` 的错误语义——取消是正常流而非错误），管道编排器用 `instanceof FilterCancelledSignal` 识别后以 exit code 0 正常退出——**禁止**返回 `{ items: [] }` 空计划（与"合法空安装计划"结构不可区分）；**禁止**使用 `AiforgeError`（`Severity = 'fatal' | 'partial'` 类型不含 `'info'`，编译直接失败）
  - [ ] 4.5 TTY 检测：使用 `process.stdin.isTTY`（与 `commands/init.ts` 模式一致）
  - [ ] 4.6 注意：`@inquirer/prompts` 是已有依赖（`commands/init.ts` 已使用），不引入新依赖

- [ ] Task 5: 添加 i18n 消息键 (AC: #1, #4)
  - [ ] 5.1 在 `src/core/messages.ts` 的 `MessageSet` 接口中添加 `filter` 分组
  - [ ] 5.2 添加中英文消息键：
    - `filter.noMatch`：`"没有子目录匹配 pattern: {pattern}"` / `"No subdirectories match pattern: {pattern}"`
    - `filter.noMatchWhy`：`"指定的 glob 模式未匹配到任何可安装内容"` / `"The specified glob pattern did not match any installable content"`
    - `filter.fixAvailable`：`"可用子目录: {dirs}"` / `"Available subdirectories: {dirs}"`
    - `filter.selectPrompt`：`"没有匹配结果，请选择一个子目录或取消："` / `"No matches found. Select a subdirectory or cancel:"`
    - `filter.cancelled`：`"已取消"` / `"Cancelled"`

- [ ] Task 6: 编写单元测试 (AC: #1-5)
  - [ ] 6.1 创建 `tests/stages/filter-utils.test.ts`
    - 测试 `parseFilterPattern()`：带前缀、不带前缀、边界输入
    - 测试 `matchesGlob()`：`*` 通配符、`?` 单字符、精确匹配、大小写
  - [ ] 6.2 扩展 `tests/stages/match-rules.test.ts`
    - `--filter skills/git*` 只返回匹配的子目录
    - `--filter git*` 跨所有顶层目录匹配
    - `--dirs skills --filter skills/git*` 联合语义正确
    - `--filter` 对 Files/Directories/Flatten 三种类型均有效
    - **部分规则命中 + dry-run**：`--filter skills/git*` 匹配部分规则时，dry-run 输出仅包含非空匹配项，不含未匹配规则的 `emptySourceDir` 行（AC #5 回归保护）
    - filter 零匹配时非 TTY 抛出 `FILTER_NO_MATCH`
    - **TTY 选择重试成功**：mock `process.stdin.isTTY = true` + mock `select()` 返回限定名（如 `skills/git-commit`）→ 验证 `matchRules()` 返回包含 `git-commit` 的非空 items（重试逻辑生效）
    - **TTY 取消抛出 FilterCancelledSignal**：mock `select()` 返回 `'__cancel__'` → 验证 `matchRules()` 抛出 `FilterCancelledSignal`（而非 `AiforgeError`，且不返回空计划）
  - [ ] 6.3 扩展 `tests/pipeline.test.ts`：`--filter` + `--dry-run` 预览结果只包含匹配条目
  - [ ] 6.4 新增错误码 `FILTER_NO_MATCH` 从真实创建模块入口触发的负向测试
  - [ ] 6.5 扩展 `tests/pipeline.test.ts`：`FilterCancelledSignal` 编排器捕获行为
    - **取消正常返回**：mock `matchRules()` 抛出 `FilterCancelledSignal` → 验证 `runPipeline()` 正常返回（不 throw）、`process.exitCode` 为 0 或 undefined、`reporter.reportError()` 未被调用、Install/Report 阶段未执行（Round 3 P0 修订的回归保护）

- [ ] Task 7: 质量门禁验证 (AC: #1-5)
  - [ ] 7.1 `npm test` — 全绿
  - [ ] 7.2 `npm run lint:src` — 退出码 0
  - [ ] 7.3 `npm run build` — 构建通过

## Dev Notes

### filter 在管道中的位置 [Source: architecture/03-core-decisions.md#D6]

`--filter` 在 Match 阶段执行（不需要独立的管道阶段），是对 `scanSourceFiles` 返回结果的二次过滤：

```
Resolve → Auth → Clone → Detect → Match(含 filter) → [Install] → Report
                                      ↑
                                  filter 在此处过滤 sourceFiles
```

这保证了：
1. dry-run 一致性：Match 输出是唯一数据源，无论 Install 还是 Report 都消费同一个 MatchedPlan
2. 最小改动：不引入新管道阶段，只在 Match 内部增加过滤逻辑

### filter 与 --dirs 的正交关系 [Source: FR-049]

```
--dirs:   规则级过滤（rule.sourceDir ∈ args.dirs）— 已有实现
--filter: 文件级过滤（sourceFile basename matches glob）— 本 Story 新增
```

执行顺序：`--dirs` 先过滤规则 → `scanSourceFiles` 扫描 → `--filter` 过滤结果。两者正交叠加，无特殊交互。

示例：`--dirs skills --filter skills/git*`
1. `--dirs skills` → 只保留 `rule.sourceDir === 'skills'` 的规则
2. `scanSourceFiles` → 获取 `skills/` 下所有子目录
3. `--filter skills/git*` → 只保留 basename 匹配 `git*` 的子目录

### parseFilterPattern 解析逻辑

```typescript
export function parseFilterPattern(pattern: string): { dirPrefix?: string; glob: string } {
  const slashIndex = pattern.indexOf('/')
  if (slashIndex === -1) {
    // 无前缀：git* → 匹配所有顶层目录下的子目录
    return { glob: pattern }
  }
  // 有前缀：skills/git* → 只匹配 skills/ 下的子目录
  return {
    dirPrefix: pattern.slice(0, slashIndex),
    glob: pattern.slice(slashIndex + 1),
  }
}
```

### matchesGlob 简单实现

```typescript
export function matchesGlob(name: string, glob: string): boolean {
  // 转换 glob → 正则：* → .*, ? → .
  const regexStr = '^' + glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // 转义正则特殊字符
    .replace(/\*/g, '.*')                     // * → .*
    .replace(/\?/g, '.')                       // ? → .
    + '$'
  return new RegExp(regexStr).test(name)
}
```

不引入 `minimatch` 等外部依赖——MVP 场景下 `*` 和 `?` 足够覆盖用户需求。

### match-rules.ts 中的 filter 集成点 [Source: src/stages/match-rules.ts]

在 `matchRules()` 的主循环中，`scanSourceFiles` 返回后添加过滤：

```typescript
for (const rule of filteredRules) {
  let sourceFiles = await scanSourceFiles(repo.repoDir, rule)

  // --filter 文件级过滤（Story 6-2）
  if (args.filter) {
    const { dirPrefix, glob } = parseFilterPattern(args.filter)
    // 如果 filter 指定了顶层目录前缀，且当前规则的 sourceDir 不匹配，跳过全部 sourceFiles
    if (dirPrefix && dirPrefix !== rule.sourceDir) {
      sourceFiles = []
    } else {
      sourceFiles = sourceFiles.filter((sf) => matchesGlob(basename(sf), glob))
    }
  }

  // empty-item guard（Task 3.3）：filter 后 sourceFiles 为空则跳过，不 push 空 item
  // 否则 reportPlan() 会为空 item 输出 emptySourceDir 行，违反 AC #5
  if (sourceFiles.length === 0) continue

  const targetPath = resolveTargetDir(rule, env.scope, pathResolver)
  const mode = getInstallMode(args, env.scope)
  items.push({ rule, sourceFiles, targetPath, mode })
}
```

### FilterCancelledSignal 设计 [Source: project-context.md — Error Handling Rules]

取消操作是正常流而非错误，不应使用 `AiforgeError`（`Severity = 'fatal' | 'partial'` 不含 `'info'`，会导致 TypeScript 编译失败）。推荐定义独立 sentinel class：

```typescript
// src/core/errors.ts（或 src/stages/filter-utils.ts）
export class FilterCancelledSignal {
  readonly kind = 'filter-cancelled' as const
}
```

管道编排器（`runPipeline()`）在 `matchRules()` 调用处捕获：

```typescript
try {
  const plan = await stages.matchRules(repo, env, args, reporter)
  // ...
} catch (err) {
  if (err instanceof FilterCancelledSignal) {
    // 取消是正常流：直接 return，不调用 process.exit()
    // process.exitCode 默认为 0，与现有编排契约一致（AiforgeError 路径用 process.exitCode = error.exitCode + return）
    return
  }
  throw err  // 其他错误透传
}
```

### 零匹配交互式询问 [Source: NFR-U6、commands/init.ts 交互模式]

零匹配检测在 `matchRules()` 完成所有规则处理后执行：

```typescript
// 零匹配检测（全部 items 的 sourceFiles 合计为 0）
if (args.filter) {
  const totalMatched = items.reduce((sum, item) => sum + item.sourceFiles.length, 0)
  if (totalMatched === 0) {
    const { dirPrefix } = parseFilterPattern(args.filter)
    // prefixed case（如 `--filter skills/xyz*`）必须扫描 `join(repo.repoDir, dirPrefix)` 下的子目录
    // 而非仓库根目录——否则会生成 skills/agents、skills/skills 等完全错误的候选值
    const scanDir = dirPrefix ? join(repo.repoDir, dirPrefix) : repo.repoDir
    const availableDirs = await scanAvailableTopDirs(scanDir)  // 复用 list-contents.ts 导出的共享函数（Story 6-1）

    if (process.stdin.isTTY) {
      // 交互式选择
      const { select } = await import('@inquirer/prompts')
      const choice = await select({
        message: msg('filter.selectPrompt'),
        choices: [
          // 候选值使用限定名（保留 dirPrefix 前缀，如 `skills/git-commit`），防止重新匹配时丢失作用域
          ...availableDirs.map((d) => ({ name: d, value: dirPrefix ? `${dirPrefix}/${d}` : d })),
          { name: msg('filter.cancelled'), value: '__cancel__' },
        ],
      })
      if (choice === '__cancel__') {
        reporter.completePhase()
        // 取消 = 独立短路信号，不继承 AiforgeError（AiforgeError.severity 类型为 'fatal'|'partial'，不含 'info'，编译失败）
        throw new FilterCancelledSignal()
      }
      // 使用局部变量 resolvedFilter（限定名），不改写 args.filter
      const resolvedFilter = choice
      // 重新扫描：直接过滤 items，用 resolvedFilter 替代 args.filter
      // ...（保持 dirPrefix 作用域的精确匹配）
    } else {
      // 非 TTY：抛出错误
      throw new AiforgeError(
        msg('filter.noMatch').replace('{pattern}', args.filter),
        'FILTER_NO_MATCH',
        EXIT_ARG_ERROR,
        'fatal',
        msg('filter.noMatchWhy'),
        [msg('filter.fixAvailable').replace('{dirs}', availableDirs.join(', '))],
      )
    }
  }
}
```

### 依赖关系

- 本 Story 依赖 Story 6-1 添加的 `ParsedArgs.list` 字段扩展模式（类型扩展方式一致）
- 本 Story 零匹配处理依赖 Story 6-1 `list-contents.ts` 导出的 `scanAvailableTopDirs()` 函数（DRY，避免两份独立扫描实现行为不一致）；Story 6-1 必须先于本 Story 实现
- `filter-utils.ts` 放在 `src/stages/` 目录（被 `match-rules.ts` 引用）
- `FilterCancelledSignal` 定义在 `src/core/errors.ts` 或 `src/stages/filter-utils.ts`，由 `pipeline.ts` 导入识别
- 不引入新的外部依赖

### 错误处理要点 [Source: project-context.md]

- `FILTER_NO_MATCH` 使用 `EXIT_ARG_ERROR`（exit code 3）
- 非 TTY 环境下零匹配必须抛错（不能静默返回空结果——用户可能误以为安装成功）
- TTY 环境下零匹配走交互式询问（NFR-U6 友好体验）
- **用户取消使用 `FilterCancelledSignal`**（独立 sentinel class，不继承 `AiforgeError`）——取消是正常流，`AiforgeError` 的 `Severity = 'fatal' | 'partial'` 类型不适用

### 横切关注点自查

本 Story 改动涉及 `core/types.ts`、`core/messages.ts`、`stages/match-rules.ts`，加上新增的 `stages/filter-utils.ts`——共 4 个 `src/` 子目录（core、stages、index.ts 根目录、pipeline.ts）。根据项目规则，满足横切关注点标准。开发前需执行三步检查清单：

1. `grep -rn "args.filter\|ParsedArgs" src/ --include="*.ts"` — 生成受影响文件列表
2. 逐文件标注处置方式
3. 按模块分组确认改动计划

### Project Structure Notes

- 新增文件：`src/stages/filter-utils.ts`、`tests/stages/filter-utils.test.ts`
- 修改文件：`src/core/types.ts`（ParsedArgs 扩展）、`src/index.ts`（CLI 选项）、`src/pipeline.ts`（mapOptsToArgs）、`src/stages/match-rules.ts`（filter 集成）、`src/core/messages.ts`（i18n 键）
- 测试：`tests/stages/filter-utils.test.ts`（新增）、`tests/stages/match-rules.test.ts`（扩展）、`tests/pipeline.test.ts`（扩展）

### References

- [Source: epic-6.md — Story 6-2 Acceptance Criteria]
- [Source: FR-048 — `--filter <dir>/<glob>` 精准安装]
- [Source: FR-049 — `--filter` 与 `--dirs` 联合语义]
- [Source: NFR-U6 — 零匹配交互式询问]
- [Source: architecture/03-core-decisions.md#D6 — dry-run 一致性保证]
- [Source: src/stages/match-rules.ts — 现有 --dirs 过滤和 scanSourceFiles 实现]
- [Source: src/commands/init.ts — @inquirer/prompts 使用模式]
- [Source: project-context.md — 横切关注点检查清单]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
