---
Epic: 6
Scope: epic
Round: 2
Date: 2026-04-14
Model Used: Claude Opus 4.6 (claude-opus-4-6)
Review Source: epic-6-story-review-summary-20260414-round-2.md
Review Model: Codex (GPT-5-based) (codex)
Type: Story Review Evaluation
---

## 评估总结

本轮评估针对 Round 2 复审结果（6 条新发现：1 高 4 中 1 低）。Round 1 的 5 条阻塞项（P0×1 + P1×4）已在 Story 文档中得到有效修订，交叉验证确认全部收敛。Round 2 的 6 条新发现中：1 条确认有效需立即修订（P0 — `FILTER_CANCELLED` 使用 `AiforgeError` 导致 TypeScript 编译不过），2 条有效需修订（P1），1 条降级为产品讨论项，2 条降级为后续改善跟踪。整体判断：**需修订后再审**，核心阻塞项 1 条。

## 上轮问题回顾确认

| R1 编号 | 问题 | 修订状态 | 验证结论 |
|---------|------|---------|---------|
| R1-#1 | universalDirs 优先级链缺环境变量契约 | ✅ 已修订 | Story 6-3 Task 2.3 已改为"三层：CLI > config > 默认值（不支持环境变量层）"；Story 6-4 AC#4 已同步修改。**确认收敛** |
| R1-#2 | --no-universal Commander 选项不可工作 | ✅ 已修订 | Task 1.2 已改为不传第三参数，Task 1.3 已改为 `opts.universal === false`。**确认收敛** |
| R1-#3 | config 加载 catch 降级违反白名单规则 | ✅ 已修订 | Task 5.4 和 Dev Notes 均已改为 `error.code !== 'CONFIG_NOT_FOUND'` 逐码白名单。**确认收敛** |
| R1-#6 | --filter 零匹配回退丢失作用域 + 取消无独立边界 | ✅ 已修订 | Task 4.3 改为 `resolvedFilter` 局部变量 + 限定名保留前缀，Task 4.4 改为 `FilterCancelledError` 短路信号。**确认收敛**（但 Task 4.4 引入新问题，见 Finding #2） |
| R1-#7 | --list 允许绕过 Reporter 输出 | ✅ 已修订 | Task 3.7 已删除 `process.stdout.write()` 备选，明确"只通过 `reporter.reportList()` 输出"。**确认收敛** |

## 发现 #1 评估

### 审查原文

> **[中] Story 6-1 的 `scanAvailableTopDirs` 仍使用裸 `catch {}` 降级**
> - 来源：consistency
> - 分类：patch
> - 涉及 Story：6-1
> - 证据 - Dev Notes 代码 `catch { return [] }` 未区分错误类型
> - 影响 - EACCES 等权限错误被静默吞掉
> - 建议 - 改为仅对 ENOENT/ENOTDIR 降级

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — Story 6-1 Dev Notes 第 165 行确实使用 `catch { return [] }` 无差别降级，且注释"仓库根目录不可读时返回空数组"暗示意图吞掉所有错误。
**严重性判断**：合理 — project-context.md 明确规定"禁止使用 `catch {}` 或 `catch { /* ignore */ }`"。虽然 `scanAvailableTopDirs` 是错误路径中的辅助函数（提供修复建议），但规则是绝对的。且 `fs 存在性检查必须使用 ENOENT/ENOTDIR 白名单降级`规则同样适用。
**修订建议**：可行 — 改为 `catch (error) { if (code === 'ENOENT' || code === 'ENOTDIR') return []; throw error }`。修改量极小。
**误报评估**：非误报 — 规则引用准确，代码证据明确。

## 发现 #2 评估

### 审查原文

> **[高] `FILTER_CANCELLED` 将 `AiforgeError` 用于非错误的正常取消流，且 `severity: 'info'` 不在类型约束内**
> - 来源：contract+structure
> - 分类：decision_needed
> - 涉及 Story：6-2
> - 证据 - Task 4.4 的 Dev Notes 使用 `new AiforgeError(..., EXIT_SUCCESS, 'info', '', [])`，但 `Severity = 'fatal' | 'partial'`，'info' 编译不过
> - 影响 - TypeScript 编译失败 + AiforgeError 语义滥用
> - 建议 - 用独立 sentinel class 或 non-Error 对象表达取消

### 评估结论：✅ 确认有效 — 需要修订（P0 优先级）

### 评估分析

**问题描述准确性**：准确且关键 — 交叉验证确认：`src/core/types.ts` 第 3 行定义 `Severity = 'fatal' | 'partial'`，Story 6-2 Dev Notes 使用 `severity: 'info'` **不在联合类型范围内**，会导致 TypeScript 编译错误。此外，`why: ''` 和 `fix: []` 违反 AiforgeError 的 "Three-part error messages" 设计意图（空 why = 没有解释为什么出错）。
**严重性判断**：合理且应提升 — 这不仅是设计异味，而是 **TypeScript 编译级阻塞**。`severity: 'info'` 字面量无法赋值给 `'fatal' | 'partial'` 类型。即使用类型断言绕过，`AiforgeError` 的管道捕获逻辑（`severity === 'fatal'` 判断）也会对 `'info'` 产生未定义行为。
**修订建议**：可行 — 推荐方案：定义独立的 `FilterCancelledSignal`（不继承 `AiforgeError`，可以是 plain object 或独立 Error 子类），管道编排器用 `instanceof` 识别。替代方案：扩展 `Severity` 类型加入 `'info'`，但这会影响所有 severity 消费方，改动面大且违反 D4 "severity always fatal" 设计意图。
**误报评估**：非误报 — TypeScript 类型定义可直接验证。

## 发现 #3 评估

### 审查原文

> **[中] Story 6-1 和 6-2 各自独立实现"扫描可用顶层目录"，违反 DRY**
> - 来源：structure
> - 分类：patch
> - 涉及 Story：6-1, 6-2
> - 证据 - 6-1 定义 `scanAvailableTopDirs()`，6-2 Task 4.2 也扫描目录但无共享引用
> - 影响 - 两份实现在过滤规则、排序方式上可能不一致
> - 建议 - 提取到共享工具模块

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — Story 6-1 在 Dev Notes 中定义了完整的 `scanAvailableTopDirs()` 函数（扫描 `repoDir` 下非隐藏子目录），Story 6-2 Task 4.2 也需要"扫描仓库中 filter.dirPrefix 对应目录（或所有顶层目录）下的可用子目录列表"。两处需求高度重叠。
**严重性判断**：合理 — 如果两份代码独立实现，过滤逻辑（如 `DEFAULT_EXCLUDES` vs `.startsWith('.')`）和排序方式可能不一致，导致相同场景下用户看到不同的建议列表。
**修订建议**：可行 — 将 `scanAvailableTopDirs` 放入 `src/stages/list-contents.ts` 并导出（或提取到独立 utils），Story 6-2 的零匹配处理引用同一函数。需注意两者的细微差异：6-1 扫描顶层目录，6-2 可能扫描子目录（取决于 `dirPrefix`），函数签名可能需要接受目标路径参数。
**误报评估**：非误报 — 代码重复确实存在。

## 发现 #4 评估

### 审查原文

> **[中] UNIVERSAL_RULES 仅覆盖 skills 和 agents，但仓库还有 instructions 和 mcp-tools**
> - 来源：consistency
> - 分类：defer
> - 涉及 Story：6-3
> - 证据 - UNIVERSAL_RULES 只有 skills + agents 的 4 条规则
> - 影响 - 用户可能预期所有仓库内容都写入通用目录
> - 建议 - 确认是有意为之还是遗漏

### 评估结论：⚠️ 有效但降级 — 产品讨论项（不阻塞 Story 修订）

### 评估分析

**问题描述准确性**：准确 — UNIVERSAL_RULES 确实只覆盖 `skills(Directories)` + `agents(Files)` 两种类型。
**严重性判断**：偏高 — 这是一个**产品决策**而非 Story 设计缺陷。交叉验证确认：Epic-6 AC#1 明确写"将对应资源完整复制到 `.agents/skills/`、`.agents/agents/`、`.agent/skills/`、`.agent/agents/`"——**只提到 skills 和 agents**。Story 6-3 Dev Notes 明确说明"不含 instructions、mcp-tools、Flatten 类型"。这是从 Epic 到 Story 的忠实实现，不是遗漏。
**修订建议**：不适用于 Story 层面 — 如需扩展应回到 Epic/PRD 层面修改需求。
**误报评估**：非误报但不构成 Story 缺陷 — 建议转为产品 backlog 讨论。

## 发现 #5 评估

### 审查原文

> **[低] `AiforgeConfig` 类型中尚无 `universalDirs` 字段定义**
> - 来源：contract
> - 分类：defer
> - 涉及 Story：6-3, 6-4
> - 证据 - 当前 types.ts 的 AiforgeConfig 无此字段
> - 影响 - 两个 Story 可能同时添加，存在竞争风险
> - 建议 - 在某个 Story 中明确"负责添加"

### 评估结论：⚠️ 有效但降级 — 建议纳入后续改善跟踪（P3）

### 评估分析

**问题描述准确性**：准确 — `src/core/types.ts` 当前 `AiforgeConfig` 确实无 `universalDirs` 字段。
**严重性判断**：合理（低） — Story 设计中已有充分的防护机制：Story 6-3 Task 2.1 明确负责添加；Story 6-4 Task 3.1 写明"如果 Story 6-3 先于 6-4 实现，此 Task 可跳过"；Story 6-4 Dev Notes 专门说明"Dev Agent 应先检查字段是否已存在"。两个 Story 已通过条件执行逻辑避免了竞争。
**修订建议**：可行但非必要 — 当前条件检查机制已足够。
**误报评估**：非误报 — 但风险已被 Story 设计缓解。

## 发现 #6 评估

### 审查原文

> **[中] Epic-6 AC#4 仍引用"四层优先级链"，与 Story 修订后的"三层"不一致**
> - 来源：consistency
> - 分类：patch
> - 涉及 Story：Epic-6
> - 证据 - epic-6.md AC#4 写"四层"，Story 6-3/6-4 已改为"三层"
> - 影响 - Epic/Story 文档不一致可能导致混乱
> - 建议 - 同步更新 Epic-6 AC#4

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — Epic-6.md 第 132 行仍写"遵循四层优先级链：CLI > 环境变量 > config > 默认值"，但 Story 6-3 Task 2.3 和 Story 6-4 AC#4 均已修订为"三层"。这是 R1 修订时只更新了 Story 层而遗漏了 Epic 层的同步问题。
**严重性判断**：合理 — Epic 是 Story 的上游规范，二者不一致会让开发者产生疑虑。虽然 Story 已明确三层，但 Epic 的四层措辞可能在后续 Story 创建或回归审查时引起混淆。
**修订建议**：可行 — Epic-6.md AC#4 改为"遵循三层优先级链：CLI > config > 默认值"，删除环境变量层。修改量极小（一行文字）。
**误报评估**：非误报 — 文档不一致可直接验证。

## 整体评估结论

### 需要修订（阻塞进入开发）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 2 | FILTER_CANCELLED 使用 AiforgeError + severity 'info' 导致 TS 编译失败 | [高] | P0 | 需改为独立 sentinel class，不继承 AiforgeError |
| 1 | scanAvailableTopDirs 裸 catch {} 降级 | [中] | P1 | 改为 ENOENT/ENOTDIR 白名单 |
| 3 | 两个 Story 独立实现目录扫描逻辑 | [中] | P1 | 提取共享函数，避免行为不一致 |
| 6 | Epic-6 AC#4 仍写"四层"与 Story "三层"不一致 | [中] | P1 | 同步 Epic 文档 |

### 建议纳入后续改善跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 5 | AiforgeConfig 类型竞争风险 | [低] | P3 | Story 已有条件检查机制，风险极低 |

### 产品讨论项（非 Story 缺陷）

| # | 发现 | 原始严重性 | 说明 |
|---|------|----------|------|
| 4 | UNIVERSAL_RULES 仅覆盖 skills/agents | [中] | Epic 规范如此，Story 忠实实现，如需扩展应回到 PRD 层面 |

### 可忽略（误报）

| # | 发现 | 原始严重性 | 忽略理由 |
|---|------|----------|---------|
| — | （无误报） | — | — |

### 评估决定

**整体结论**：需修订后再审

4 条发现需要修订（1 条 P0 + 3 条 P1）。核心阻塞项是 Story 6-2 的 `FILTER_CANCELLED` 设计——`severity: 'info'` 在 TypeScript 类型层面直接编译失败，且 AiforgeError 语义不适合表达非错误的取消流。建议优先修正 Finding #2，然后处理 Finding #1 + #3（可合并处理，涉及目录扫描的 catch 和共享逻辑），最后同步 Epic-6 文档。修订完成后提交 Round 3 审查。

---

## 修订执行记录

### 修订执行记录
- **Date**: 2026-04-14
- **Model Used**: Claude Sonnet 4 (claude-sonnet-4)
- **Fix Items**: 4

#### 修订项 #1: `FILTER_CANCELLED` 使用 `AiforgeError` + `severity: 'info'` 导致 TS 编译失败（P0）
- **文件**: `_bmad-output/implementation-artifacts/stories/6-2-filter-subdirectory-install.md`
- **章节**: Tasks / Subtasks — Task 4.4；Dev Notes — FilterCancelledSignal 设计（新增）、零匹配交互式询问代码示例、错误处理要点
- **修改摘要**:
  - Task 4.4：`FilterCancelledError extends AiforgeError` → `FilterCancelledSignal`（独立 sentinel class，不继承 `AiforgeError`）；补充说明"取消是正常流，`Severity = 'fatal' | 'partial'` 不含 `'info'`，编译直接失败"
  - Dev Notes 代码示例：`throw new AiforgeError(..., EXIT_SUCCESS, 'info', '', [])` → `throw new FilterCancelledSignal()`
  - Dev Notes 新增 `FilterCancelledSignal 设计` 章节：包含 sentinel class 定义和管道编排器 `instanceof` 捕获模式
  - 错误处理要点：补充"用户取消使用 `FilterCancelledSignal`，`AiforgeError` 的 `Severity` 类型不适用"说明
- **状态**: 已完成

#### 修订项 #2: `scanAvailableTopDirs` 裸 `catch {}` 降级（P1）
- **文件**: `_bmad-output/implementation-artifacts/stories/6-1-list-subdirectory-contents.md`
- **章节**: Dev Notes — 可用顶层目录扫描辅助函数代码示例
- **修改摘要**:
  - `catch { return [] }` → `catch (error) { if (code === 'ENOENT' || code === 'ENOTDIR') return []; throw error }`
  - 补充注释说明：ENOENT/ENOTDIR 降级为空数组，EACCES 等权限错误透传（禁止裸 catch {} 静默吞掉）
- **状态**: 已完成

#### 修订项 #3: 两个 Story 独立实现目录扫描逻辑，违反 DRY（P1）
- **文件**:
  - `_bmad-output/implementation-artifacts/stories/6-1-list-subdirectory-contents.md`
  - `_bmad-output/implementation-artifacts/stories/6-2-filter-subdirectory-install.md`
- **章节**:
  - Story 6-1 Dev Notes — 可用顶层目录扫描辅助函数；Project Structure Notes
  - Story 6-2 Tasks — Task 4.2；Dev Notes — 依赖关系
- **修改摘要**:
  - Story 6-1：`async function scanAvailableTopDirs` → `export async function scanAvailableTopDirs`（改为导出）；Project Structure Notes 补充"供 Story 6-2 复用"说明
  - Story 6-2 Task 4.2：扫描逻辑改为"复用 Story 6-1 `list-contents.ts` 导出的 `scanAvailableTopDirs()`"；依赖关系章节补充对 Story 6-1 函数的显式依赖，以及 Story 6-1 必须先实现的顺序约束
- **状态**: 已完成

#### 修订项 #4: Epic-6 AC#4 仍写"四层"与 Story "三层"不一致（P1）
- **文件**: `_bmad-output/planning-artifacts/epics/epic-6.md`
- **章节**: Story 6-4 Acceptance Criteria — AC#4
- **修改摘要**:
  - `遵循四层优先级链：CLI > 环境变量 > config > 默认值` → `遵循三层优先级链：CLI > config > 默认值`
  - 与 Story 6-3 Task 2.3 和 Story 6-4 AC#4 保持一致（三层均已在 R1 修订中对齐）
- **状态**: 已完成