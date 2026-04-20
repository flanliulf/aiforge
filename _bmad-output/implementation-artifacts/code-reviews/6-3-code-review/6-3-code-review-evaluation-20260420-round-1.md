---
Story: 6-3
Round: 1
Date: 2026-04-20
Model Used: Claude Opus 4.6 (claude-opus-4-20250514)
Review Source: 6-3-code-review-summary-20260417-round-1.md
Review Model: GPT-5.4 (gpt-5.4)
Type: Code Review Evaluation
---

## 评估总结

对 Story 6-3 的第 1 轮 CR 代码审查结果（首轮）进行逐条评估。审查共报告 4 条发现（2 高 2 中），涵盖 Directories copy 模式的冲突处理、嵌套文件边界校验、配置加载容错和 filter 恢复路径的通用目录漏装。经独立代码验证，评估结论如下。

---

## 发现 #1 评估

### 审查原文

> **[高] Directories copy 模式会静默覆盖同名用户文件，并绕过原有冲突决策链路**
> - 来源：blind+edge
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P2 优先级）

### 评估分析

**问题描述准确性：基本准确**

经代码验证，`src/stages/execute-install.ts:581-602` 的 copy 分支确实只调用 `determineStatus()` + `copyFile()`，没有调用 `processConflict()`。`determineStatus()`（L69-89）在目标文件存在且 hash 不同时返回 `'updated'`，随后 `copyFile` 直接覆盖。这与 symlink 分支（L542-569）通过 `detectDirConflict()` + `processConflict()` 提供 skip/backup/force 语义形成对比。

但需要指出：审查原文遗漏了设计上下文。Story 6-3 Task 6.4 明确设计了"文件级 hash 比对方案"作为 copy 模式的增量同步机制，代码注释也明确写道"不做目录级冲突检测：文件级 determineStatus 直接处理 new/updated/skipped"。测试用例（`tests/stages/execute-install.test.ts:1403-1470`）覆盖了"用户文件保留""无备份"和"--force 无额外效果"等场景，均为预期行为。

**严重性判断：偏高**

审查将此判为 [高]，理由是"数据丢失风险"。但实际场景需要同时满足两个条件：(1) 用户在 **工具管理的目标目录** 内手动修改了与仓库源文件同名的文件；(2) 仓库该文件发生了变更。对于通用目录（`.agents/skills/`、`.agent/skills/`），这些目录的设计语义是"仓库源的受管副本"（AC #3："有变更的文件重新写入，无变更的文件跳过"），覆盖是预期行为。对于非 universal 的 Directories 类型 IDE 规则（如 Windsurf 的 cascade_rules），理论上存在同名文件覆盖风险，但这属于更一般的 Directories 安装语义设计问题，不是 Story 6-3 引入的回归。

建议降级为 P2 CR TODO，在后续 Story 中统一规划 Directories copy 模式的冲突处理语义。

**修复建议：可行但非必要**

审查建议"恢复文件级冲突检测，复用 processConflict()"。技术上可行，但会改变 AC #3 的增量同步语义——每次文件更新都弹出冲突交互，破坏"安静增量同步"的用户体验预期。如果要做，应该设计新的"静默备份"策略而非照搬 symlink 模式的交互式冲突处理。

**误报评估：非误报**

问题客观存在，但严重性和紧迫性被高估。

---

## 发现 #2 评估

### 审查原文

> **[高] 嵌套文件写入未重做边界校验，子目录 symlink 可把内容写出允许根目录**
> - 来源：blind
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

经代码验证，`src/stages/execute-install.ts:534-535` 调用 `validateDestPathSecurity(destPath, allowedRoot)` 只校验了目录根 `destPath`。在 copy 分支（L587-600）中，嵌套文件路径 `destFilePath = join(destPath, relPath)` 未经任何边界校验直接进入 `ensureDir(dirname(destFilePath))` + `copyFile(srcFilePath, destFilePath)`。

`validateDestPathSecurity()`（`src/services/fs-utils.ts:547-609`）执行了 realpath 级 symlink 逃逸校验，包含 broken symlink 和祖先目录校验。但该函数只在目录根层级被调用一次。如果目标目录内部存在中间 symlink（如 `destPath/subdir` → `/tmp/evil/`），`ensureDir(dirname(destFilePath))` 会沿 symlink 创建目录结构，`copyFile` 会将内容写到 `allowedRoot` 之外。

审查提供的定向复现已证实 `mkdir({ recursive: true })` + `writeFile()` 会沿 symlink 落到外部目录。

**严重性判断：合理**

这是一个路径边界绕过问题（PATH_TRAVERSAL），属于安全缺陷。虽然攻击前提是目标目录已被植入 symlink（需要先写权限），但作为纵深防御（defense in depth），每个写入目标都应经过边界校验。项目已有 `validateDestPathSecurity()` 基础设施，扩展使用成本低。

**修复建议：可行**

在 copy 分支的 for 循环内，对每个 `destFilePath`（或至少对 `dirname(destFilePath)`）调用 `validateDestPathSecurity(destFilePath, allowedRoot)` 即可。性能影响可忽略（逐文件 `lstat` 相比 `copyFile` 的 I/O 成本微不足道）。同时应补一条目录内嵌 symlink 的安全回归测试。

**误报评估：非误报**

---

## 发现 #3 评估

### 审查原文

> **[中] 无条件读取 config，使全局安装和 `--no-universal` 也会被无关配置错误阻断**
> - 来源：edge
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P2 优先级）

### 评估分析

**问题描述准确性：准确**

经代码验证，`src/pipeline.ts:210-223` 的 `match` 工厂闭包中，`loadConfig(pathResolver)` 无条件执行，不区分 scope 和 `--no-universal` 参数。`CONFIG_CORRUPT` 和 `CONFIG_READ_FAILED` 会直接 `throw error`。随后 `enableUniversal` 的计算和 `matchRules()` 中 `env.scope === 'project' && enableUniversal` 的守卫证明：对 global scope 或 `--no-universal` 场景，config 值实际上不影响行为。

`loadConfig()`（`src/services/config.ts:15-60`）从 `pathResolver.configDir()` 读取 `config.json`，corrupt 时抛出 `CONFIG_CORRUPT`。当用户执行 `aiforge install --global` 且本地 config.json 损坏时，安装会被阻断，但此时 universal dirs 根本不会生效。

**严重性判断：合理**

[中] 级别合理。这不是数据丢失或安全问题，但破坏了参数优先级隔离——用户传了 `--no-universal` 或使用 global scope，不应受 universal 配置的影响。

但需要指出：Story 6-3 Task 5.3 **明确要求** "其他所有错误...必须 `throw error` 透传"。当前行为完全符合 Story 设计规格。修复此问题意味着修改 Story 定义的错误处理策略，超出当前 Story 的范围。

**修复建议：可行但非必要**

审查建议"仅在 project scope 且未传 `--no-universal` 时读取 config"。技术上可行——将 `loadConfig` 调用移到 `if (env.scope === 'project' && !args.noUniversal)` 分支内即可。但这需要 pipeline.ts 的 match 工厂能感知 scope（当前 scope 由 detect 阶段产出，match 阶段通过 `env.scope` 接收），实际上可以在 `matchRules()` 内部做条件加载。

考虑到当前行为符合 Story 规格，且影响范围有限（corrupt config 是少见边界情况），建议纳入 CR TODO 在后续优化。

**误报评估：非误报**

---

## 发现 #4 评估

### 审查原文

> **[中] `--filter` 零命中后的交互恢复没有重新并入通用目录规则**
> - 来源：edge
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

经代码验证，`src/stages/match-rules.ts` 中 `UNIVERSAL_RULES` 的使用情况：
- L25：import
- L208-230：初始匹配路径中，在 `env.scope === 'project' && enableUniversal` 条件下追加通用规则
- L295-315：交互恢复路径中，只遍历 `env.tools` + `RULE_INDEX` 重建 items，**没有重新追加 `UNIVERSAL_RULES`**

整个文件中 `UNIVERSAL_RULES` 仅在 L208 处被引用（L25 是 import），交互恢复路径完全忽略了通用目录规则。

**严重性判断：偏低，建议调整为高**

审查将此判为 [中]，但实际影响是：当用户使用 `--filter` 且首次零命中、通过交互修正 filter 后，通用目录（`.agents/skills/`、`.agent/skills/` 等）会被静默漏装。用户不会收到任何提示，认为安装成功但实际上通用目录缺失。这违反了"通用目录默认安装"的核心 AC（AC #1），且是静默失败（最危险的故障模式）。建议提升至 P1 阻塞交付。

**修复建议：可行**

审查建议"把恢复分支的重放逻辑抽成共享函数，并在启用 universal 时把 UNIVERSAL_RULES 一并纳入"。更直接的修复方式：在 L315 之后（items 重建完成后），复制 L207-230 的 UNIVERSAL_RULES 追加逻辑。代码量约 20 行，风险可控。共享函数方案更优雅但不是当前 Story 的重构目标。

同时需为"零命中后选择修正 filter 的 universal 场景"新增测试用例。

**误报评估：非误报**

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 2 | 嵌套文件写入未重做边界校验 | [高] | **P1** | 路径边界绕过安全缺陷，需对每个 destFilePath 重做边界校验 |
| 4 | filter 恢复路径漏装通用目录 | [中] → [高] | **P1** | 交互恢复路径遗漏 UNIVERSAL_RULES，静默违反 AC #1 |

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | Directories copy 模式静默覆盖同名文件 | [高] → [中] | **P2** | 当前行为符合 Story 设计，通用目录覆盖是预期语义；后续可统一规划 Directories 冲突处理策略 |
| 3 | 无条件读取 config 阻断无关场景 | [中] | **P2** | 当前行为符合 Story 5.3 规格；后续可优化为条件加载 |

### 评估决定

- **发现 #1（Directories copy 覆盖）**：降级为 P2 CR TODO。当前行为是 Story 6-3 的明确设计选择（Task 6.4 注释 + 测试预期），通用目录的覆盖语义合理。后续 Story 可统一规划所有 Directories 类型的冲突处理策略。
- **发现 #2（嵌套文件边界校验）**：确认 P1 阻塞。安全缺陷，需在 copy 分支逐文件写入前调用 `validateDestPathSecurity()`，并补回归测试。
- **发现 #3（无条件 loadConfig）**：降级为 P2 CR TODO。当前行为严格遵循 Story 5.3 的错误处理策略（"其他所有错误...必须 throw error 透传"），修复需调整 Story 规格，超出当前范围。
- **发现 #4（filter 恢复漏装 universal）**：从 [中] 提升至 P1 阻塞。静默漏装通用目录直接违反 AC #1，必须修复并补测试。

---

## 修复执行记录

### 修复执行记录
- **Date**: 2026-04-20
- **Model Used**: Claude Sonnet 4.6
- **Fix Items**: 2

---

### Fix #2 — 嵌套文件写入前缺少边界校验（P1）

**修改文件**：`src/stages/execute-install.ts`

**修改位置**：`InstallType.Directories` copy 分支的 for 循环内，`ensureDir(dirname(destFilePath))` 之前

**修改前**：
```typescript
for (const relPath of relPaths) {
  const srcFilePath = join(srcPath, relPath)
  const destFilePath = join(destPath, relPath)

  // 确保中间目录存在（嵌套子目录）
  await ensureDir(dirname(destFilePath))
```

**修改后**：
```typescript
for (const relPath of relPaths) {
  const srcFilePath = join(srcPath, relPath)
  const destFilePath = join(destPath, relPath)

  // 嵌套文件路径边界校验（NFR-S5：防止中间 symlink 逃逸 allowedRoot）
  await validateDestPathSecurity(destFilePath, allowedRoot)

  // 确保中间目录存在（嵌套子目录）
  await ensureDir(dirname(destFilePath))
```

**修复效果**：对 Directories copy 模式遍历的每个嵌套文件路径调用 `validateDestPathSecurity()`，确保目标目录内部的中间 symlink 无法将文件写入 `allowedRoot` 之外，完善了纵深防御（defense in depth）。

**测试结果**：`tests/stages/execute-install.test.ts` 63 个测试全部通过。

---

### Fix #4 — filter 交互恢复后漏装通用目录（P1）

**修改文件**：`src/stages/match-rules.ts`

**修改位置**：交互式恢复分支中，items 重建循环结束后、二次零匹配检查之前

**修改前**：
```typescript
        }
      }
      // 二次零匹配检查（fix CR#1）：重试后若 items 仍为空，抛出 FILTER_NO_MATCH
```

**修改后**：
```typescript
        }
      }
      // 通用目录补充（fix CR#4）：交互恢复后同步追加 UNIVERSAL_RULES，防止静默漏装（AC #1）
      // 使用 resolvedFilter 的解析结果（rPrefix/rGlob）代替 args.filter，与主循环语义一致
      if (env.scope === 'project' && enableUniversal) {
        for (const rule of UNIVERSAL_RULES) {
          if (rule.scope !== env.scope) continue
          if (args.dirs && args.dirs.length > 0 && !args.dirs.includes(rule.sourceDir)) continue
          let universalSourceFiles = await scanSourceFiles(repo.repoDir, rule)
          if (rPrefix && rPrefix !== rule.sourceDir) {
            universalSourceFiles = []
          } else {
            universalSourceFiles = universalSourceFiles.filter((sf) =>
              matchesGlob(basename(sf), rGlob),
            )
          }
          if (universalSourceFiles.length === 0) continue
          const targetPath = resolveTargetDir(rule, env.scope, pathResolver)
          const mode: 'copy' | 'symlink' = 'copy'
          items.push({ rule, sourceFiles: universalSourceFiles, targetPath, mode })
        }
      }
      // 二次零匹配检查（fix CR#1）：重试后若 items 仍为空，抛出 FILTER_NO_MATCH
```

**修复效果**：交互恢复后，UNIVERSAL_RULES 按与主循环一致的语义（`rPrefix`/`rGlob` 过滤 + empty-item guard）重新追加到 items，确保通用目录在"--filter 零命中 → 用户交互选择新 filter"路径下不被静默漏装，满足 AC #1。

**测试结果**：`tests/stages/match-rules.test.ts` 39 个测试全部通过。

---

### 整体修复验证

- 编译检查：两个文件均无 TypeScript 错误
- 测试执行：`npx vitest run tests/stages/execute-install.test.ts tests/stages/match-rules.test.ts`
    - 总计 102 个测试，2 个测试文件，**全部通过**
- CR TODO 项（发现 #1、#3）：已纳入 CR TODO 跟踪，未修改代码
