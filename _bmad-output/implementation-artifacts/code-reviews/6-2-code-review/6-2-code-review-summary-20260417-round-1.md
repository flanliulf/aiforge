---
Story: 6-2
Round: 1
Date: 2026-04-17
Model Used: GPT-5.4 (gpt-5.4)
Type: Code Review Summary
---

## 审查结论

首轮审查。三层审查均执行成功，`npm test`、`npm run lint:src`、`npm run build` 全部通过；但仍发现 1 个高优先级、2 个中优先级和 1 个低优先级问题，当前不建议通过。

## 新发现

### 1. [高] 无前缀零匹配恢复枚举了不可命中的候选，并在用户选择后静默返回空计划

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `src/stages/match-rules.ts:206-218` 在无前缀场景下对 `repo.repoDir` 调用 `scanAvailableTopDirs()`，得到的是 `skills`、`agents` 这类顶层目录名。
  - `src/stages/match-rules.ts:230-248` 又把用户选择重新解析成 glob，并继续与 `basename(sf)` 比较；像 `skills` 这样的值无法命中 `git-commit`、`git-agent.md` 等真实候选。
  - 当前重试分支没有在二次扫描后再次校验 `items.length === 0`，因此这条错误路径会以“成功但空计划”结束。

- **影响**
  - `--filter git*` 的零匹配恢复路径实际上不可恢复。
  - TTY 场景下用户完成选择后仍可能得到空安装计划；非 TTY 场景下 fix 文案也会把用户引向不可命中的值。

- **建议**
  - 无前缀零匹配时，不要枚举仓库顶层目录；应枚举与当前 basename 过滤模型一致的“可匹配安装项名称”。
  - 重试后必须再次检查是否仍为零匹配；若仍为空，应继续提示或抛出明确错误，而不是静默返回空计划。
  - 补充 `--filter git*` 的零匹配 + TTY 选择回归测试。

### 2. [中] Files 类型的零匹配恢复只扫描目录，agents/instructions 场景拿不到可重试候选

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `src/stages/list-contents.ts:33-41` 的 `scanAvailableTopDirs()` 只返回目录名。
  - `src/stages/match-rules.ts:206-216` 把它复用于所有 `--filter` 零匹配恢复场景，而主过滤逻辑本身会对 Files 规则的文件 basename 也执行 glob 匹配。

- **影响**
  - `agents/`、`instructions/` 这类 Files 规则在零匹配时，TTY 菜单可能只剩“取消”，非 TTY `fixAvailable` 也不会给出真实可选文件名。
  - Story 6-2 Task 3.5 扩展到 Files 类型后的恢复路径与主路径语义已经不一致。

- **建议**
  - 零匹配恢复应按 `rule.type` 枚举候选：Directories/Flatten 枚举目录名，Files 枚举文件 basename。
  - 为 Files 类型补充零匹配恢复测试，而不是只覆盖 `skills/` 目录型场景。

### 3. [中] 空 sourceFiles 守卫被提升为通用行为，回归了未使用 --filter 的既有计划/预览语义

- **来源**：blind
- **分类**：patch

- **证据**
  - `src/stages/match-rules.ts:185-190` 在所有路径上对空 `sourceFiles` 直接 `continue`。
  - `src/core/reporter.ts:228-231` 既有逻辑本来会为这类 item 输出 `emptySourceDir` 提示。
  - `tests/stages/match-rules.test.ts:548-576` 已把旧测试改写成接受“空 item 不进 plan”，说明回归被测试吸收而不是被保护。

- **影响**
  - 未使用 `--filter` 时，空目录或缺失目录规则也会被静默隐藏，用户失去原先的空源提示。
  - Story 6-2 为避免 dry-run 噪音引入的防护，扩大成了对整个 match/report 语义的改写。

- **建议**
  - 将空 item 剔除严格限定在 `args.filter` 相关路径，或用更精确的条件只处理“被 filter 清空”的情况。
  - 恢复非 filter 场景下的 `emptySourceDir` 预览语义，并把旧测试改回回归保护。

### 4. [低] 不可命中的 filter 语法没有被前置拒绝，而是延后到零匹配流程中暴露

- **来源**：blind
- **分类**：patch

- **证据**
  - `src/stages/filter-utils.ts:27-35` 接受 `skills/` 这类空 glob，以及 `skills/git/extra` 这类带额外斜杠的 pattern。
  - 现有匹配语义始终是把 glob 与 `basename(sf)` 比较，这两类输入都不可能命中任何候选。

- **影响**
  - 明显无效的参数不会被立即判定为参数错误，而是延后进入零匹配/交互分支，增加排查成本。

- **建议**
  - 在参数解析阶段校验 filter grammar，只接受 `<glob>` 或 `<topDir>/<glob>` 且 `glob` 非空、无额外斜杠的形式。
  - 为非法 filter 输入补充单元测试，避免后续再次退化为“零匹配再兜底”。

## 验证摘要

- `npm test` ✅ 通过（775 / 775）
- `npm run lint:src` ✅ 通过
- `npm run build` ✅ 通过
- 定向复核 ❌ `--filter git*` 零匹配时当前恢复候选来自仓库顶层目录，二次匹配仍按 basename 执行，选择后会落入空计划返回路径
- 定向复核 ❌ `--filter agents/xyz*` 这类 Files 规则零匹配时，恢复逻辑只扫描目录名，无法给出真实文件候选
- 定向复核 ❌ 非 `--filter` 场景下的空源提示已被全局 `continue` 删除，既有 `emptySourceDir` 输出语义失效

## 通过项

- `--filter` 选项已经从 commander 参数定义贯通到 `ParsedArgs` 和 match 阶段主流程。
- `parseFilterPattern()` / `matchesGlob()` 的基础匹配路径有独立单元测试覆盖。
- dry-run 仍然复用 match 阶段产出的 plan，`npm test`、`npm run lint:src`、`npm run build` 均通过。
- `FilterCancelledSignal` 已与 pipeline 的正常短路路径打通，取消不会再走 fatal error 报告。
