---
Story: 6-3
Round: 1
Date: 2026-04-17
Model Used: GPT-5.4 (gpt-5.4)
Type: Code Review Summary
---

## 审查结论

首轮审查。三层审查均可用，`npm test`、`npm run lint:src`、`npm run build` 全部通过，但仍存在 2 个高优先级和 2 个中优先级问题。当前不建议通过。

## 新发现

### 1. [高] Directories copy 模式会静默覆盖同名用户文件，并绕过原有冲突决策链路

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `src/stages/execute-install.ts:536-595` 只在 `item.mode === 'symlink'` 分支执行 `detectDirConflict()` 和 `processConflict()`；copy 分支直接 `walkDirFiles()` 后按 `determineStatus()` / `copyFile()` 写入。
  - `tests/stages/execute-install.test.ts:1403` 开始把“无目录备份”作为预期，`tests/stages/execute-install.test.ts:1433` 把“忽略 force 标志”作为预期，但没有覆盖最危险的“同路径用户修改文件”场景。

- **影响**
  - 目标目录中被用户修改过的同名文件会在下一次安装时被直接覆盖，用户失去 `skip`、`backup` 和 `--force` 的一致性语义，存在明确的数据丢失风险。

- **建议**
  - 对 Directories copy 模式的每个目标文件恢复文件级冲突检测，并复用现有 `processConflict()` 决策链路。
  - 至少补一条同名用户文件的回归测试，覆盖 `skip`、`backup` 和 `--force` 的行为。

### 2. [高] 嵌套文件写入未重做边界校验，子目录 symlink 可把内容写出允许根目录

- **来源**：blind
- **分类**：patch

- **证据**
  - `src/stages/execute-install.ts:582-592` 只对目录根 `destPath` 做过一次安全校验，随后对嵌套文件仅执行 `ensureDir(dirname(destFilePath))` 和 `copyFile(srcFilePath, destFilePath)`。
  - 定向复现：在本地 Node 环境中，对指向外部目录的中间 symlink 执行 `mkdir({ recursive: true })` 和 `writeFile()`，结果为 `mkdir_ok`、`write_ok`、`written_exists true`，证明写入会沿 symlink 落到外部目录。

- **影响**
  - 预先构造的目标树 symlink 可以绕过 `allowedRoot` 边界，把安装内容写到项目根或用户目录之外，属于路径边界失守。

- **建议**
  - 在 Directories copy 模式下，对每个 `dirname(destFilePath)` 重新执行 realpath 级别的边界验证，或在写入前拒绝任何中间 symlink。
  - 补一条目录内嵌 symlink 的安全回归测试。

### 3. [中] 无条件读取 config，使全局安装和 `--no-universal` 也会被无关配置错误阻断

- **来源**：edge
- **分类**：patch

- **证据**
  - `src/pipeline.ts:210-223` 在任何 scope、任何参数组合下都先执行 `loadConfig(pathResolver)`，只有成功后才计算 `enableUniversal`。
  - 当前异常分支只对白名单 `CONFIG_NOT_FOUND` 降级；`CONFIG_CORRUPT`、`CONFIG_READ_FAILED` 会直接抛出。

- **影响**
  - 即便用户执行的是 global 安装，或已经显式传入 `--no-universal`，流程仍会因为与 universal 目录无关的配置损坏而失败，破坏了参数优先级和功能隔离。

- **建议**
  - 仅在 `project` scope 且未传 `--no-universal` 时读取 `universalDirs` 偏好。
  - 为“global install + corrupt config”与“`--no-universal` + corrupt config”补回归测试。

### 4. [中] `--filter` 零命中后的交互恢复没有重新并入通用目录规则

- **来源**：edge
- **分类**：patch

- **证据**
  - `src/stages/match-rules.ts:208-235` 首轮匹配会在常规规则之后追加 `UNIVERSAL_RULES`。
  - `src/stages/match-rules.ts:295-312` 零命中后的交互恢复只遍历 `env.tools` + `RULE_INDEX` 重建 `items`，没有重新追加 `UNIVERSAL_RULES`。

- **影响**
  - 用户修正 filter 后，恢复出来的计划只包含 IDE 专属规则，`.agents/` / `.agent/` 的通用目录计划会被静默漏装，和“`--filter` 同样适用于通用目录规则”的设计不一致。

- **建议**
  - 把恢复分支的重放逻辑抽成共享函数，并在启用 universal 时把 `UNIVERSAL_RULES` 一并纳入。
  - 为“零命中后选择修正 filter”的 universal 场景新增测试。

## 验证摘要

- `npm test` ✅（797 / 797）
- `npm run lint:src` ✅
- `npm run build` ✅
- 定向复现 ✅
  - 用最小 Node 脚本验证“目录内 symlink + mkdir recursive + writeFile”会把文件写到 symlink 指向的外部目录。

## 通过项

- AC #1 / #2 的主路径已接入：默认安装会追加 universal 计划，`--no-universal` 会关闭通用目录。
- AC #3 的文件级 hash 与 manifest 记录链路已打通，并有 `tests/integration/universal-dirs-sync.test.ts` 覆盖首次安装、二次跳过等基本场景。
- AC #4 的 dry-run 计划输出已包含通用目录条目，相关测试通过。
- AC #5 依赖现有 `ensureDir()` 自动创建目标目录，基础行为正常。