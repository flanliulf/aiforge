---
Epic: 6
Scope: epic
Round: 2
Date: 2026-04-14
Model Used: Codex (GPT-5-based) (codex)
Type: Story Review Summary
Stories Reviewed: 4
---

## 审查结论

第 2 轮复审。共复审 Epic 6 下 4 个 Story。审查层状态：3/3 层完成（`structure` / `consistency` / `contract`）。

- 通过：0 个
- 有条件通过：2 个
- 硬阻塞：2 个

总体判断：Round 1 的主修订已在 Story 层大体落地，尤其是 `--no-universal` Commander 契约、`--list` 的 Reporter-only 输出边界、以及 `--filter` 的作用域保持方案均已收口。但当前仍有 3 个阻塞开发的设计问题未闭环：Epic 级优先级链未同步、Story 6-2 的取消路径突破全局错误模型、Story 6-4 的 AC 仍超出自身边界。此外还有 3 个中优先级文档/契约缺口需要在进入开发前补齐。

## 审查范围

- Story 文件：
  - `6-1-list-subdirectory-contents.md`
  - `6-2-filter-subdirectory-install.md`
  - `6-3-universal-directory-install.md`
  - `6-4-init-universal-directory-preference.md`
- 对照基准：
  - `project-context.md`
  - `planning-artifacts/epics/epic-6.md`
  - `planning-artifacts/architecture/03-core-decisions.md`
  - `planning-artifacts/architecture/04-implementation-patterns.md`
  - `epic-6-story-review-summary-20260413-round-1.md`
  - `epic-6-story-review-evaluation-20260414-round-1.md`
- 审查维度：
  - 结构完整性
  - AC 可测性
  - 与 Epic 一致性
  - 与架构文档一致性
  - Story 间冲突与依赖
  - 任务拆分合理性
  - 交互/认证/安全/性能口径
  - 跨 Epic 共享契约

## 上轮问题回顾

### 已修复

1. Round 1 / Finding #2 — `--no-universal` Commander 选项设计不可工作
   - `6-3` 已改为 `.option('--no-universal', 'skip universal directory installation')`，并统一读取 `opts.universal === false`。
   - 复核结论：此项关闭。

2. Round 1 / Finding #6 — `--filter` 零匹配回退会丢失作用域
   - `6-2` 已禁止改写 `args.filter`，改为使用局部变量 `resolvedFilter`，并明确禁止返回空计划复用“取消”语义。
   - 复核结论：作用域保持问题关闭；但取消路径引入了新的错误模型冲突，见本轮 Finding #2。

3. Round 1 / Finding #7 — `--list` 允许绕过 Reporter 输出
   - `6-1` Task 3.7 已收敛为 Reporter-only 输出。
   - 复核结论：此项关闭。

### 仍为非阻塞待办

1. Round 1 / Finding #4 — `tool: 'universal'` 仍作为共享 `tool` 字段的例外语义
   - 本轮未收敛，继续列为已知 defer 项。

2. Round 1 / Finding #5 — `--filter` “子目录”与 `sourceFiles` 口径不一致
   - 本轮未收敛，继续列为已知 defer 项。

## 新发现

### 1. [高] Epic 6 仍保留四层优先级链，和 Story 6-3/6-4 的三层契约不一致
- **来源**：consistency
- **分类**：patch
- **涉及 Story**：6-3, 6-4
- **证据** - `epic-6.md` 第 130-132 行仍写“CLI > 环境变量 > config > 默认值”；而 `6-3` Task 2.3 与 `6-4` AC #4 已同步改为“CLI > config > 默认值”。
- **影响** - Epic 与 Story 对同一行为给出两套验收口径，开发者和评审者可能重新按 Epic 文本回滚设计。
- **建议** - 立即同步修订 Epic 6 AC #4，明确本 Epic 不支持 environment variable 层。

### 2. [高][新] `FILTER_CANCELLED` 取消路径同时突破错误模型且未形成编排闭环
- **来源**：structure+consistency+contract
- **分类**：decision_needed
- **涉及 Story**：6-2
- **证据** - `6-2` Task 4.4 仍推荐 `FilterCancelledError extends AiforgeError`；Dev Notes 第 204-211 行直接示例 `AiforgeError(..., 'FILTER_CANCELLED', EXIT_SUCCESS, 'info', '', [])`；Task 6 只覆盖 `FILTER_NO_MATCH`，没有覆盖 `FILTER_CANCELLED` 的真实创建链路、TTY 取消或 orchestrator 短路退出。
- **影响** - 当前设计同时违反全局 `AiforgeError` 契约，并让“正常取消”混入错误通道；实现时很容易出现类型不匹配、错误渲染异常或取消后仍继续进入下游阶段。
- **建议** - 不要用 `AiforgeError` 表达取消。改成非错误 short-circuit sentinel/result，并补 `pipeline/orchestrator` 处理与 TTY 取消测试；若坚持扩展错误模型，必须先同步更新 Rule Document Registry 三文档。

### 3. [高] Story 6-4 的 AC 范围仍超出本 Story 边界
- **来源**：structure
- **分类**：decision_needed
- **涉及 Story**：6-4
- **证据** - `6-4` 的 AC #3-#5 验证的是 `aiforge install` 运行时行为，但 Tasks 1-6 仅覆盖 `init.ts` 询问、`config.json` 持久化、摘要展示和 `init.test.ts`；Dev Notes 第 165-179 行还明确写明 AC #3-#5 的运行时行为由 Story 6-3 负责。
- **影响** - 当前 Story 无法独立 ready-for-dev，也无法独立验收；开发边界和责任边界均不清晰。
- **建议** - 二选一：1) 收窄 Story 6-4 的 AC，只保留 init/persistence；2) 保留现有 AC，但补显式依赖、跨 Story 集成任务和验收测试，并取消其独立 ready-for-dev 口径。

### 4. [中][新] `--list` 空目录成功结果仍经由 `warn()` 写入 stderr
- **来源**：contract
- **分类**：patch
- **涉及 Story**：6-1
- **证据** - `6-1` Task 3.6 把“目录为空”定义为非错误、正常退出；但 Dev Notes 第 144-147 行仍使用 `reporter.warn(msg('list.empty'))`。
- **影响** - 成功结果会被误归类为诊断输出，破坏 stdout/stderr 分工，也不利于脚本化消费。
- **建议** - 为空目录定义 stdout 成功输出路径，例如让 `reportList(dir, [])` 处理空态，或新增 `reportListEmpty()`。

### 5. [中][新] `scanAvailableTopDirs()` 仍使用裸 `catch {}` 吞掉根目录扫描失败
- **来源**：consistency+contract
- **分类**：patch
- **涉及 Story**：6-1
- **证据** - `6-1` Dev Notes 第 158-166 行仍是 `catch { return [] }`。
- **影响** - `EACCES`/`EIO` 等真实故障会被伪装成“无可用顶层目录”，污染 `LIST_DIR_NOT_FOUND` 的错误语义，并再次违反项目的 catch 白名单规则。
- **建议** - 改成显式 `catch (error)`；除非有充分的白名单理由，否则 repo 根目录扫描失败应透传原始错误。

### 6. [中] Story 6-3 的白名单降级示例仍未使用 `instanceof AiforgeError` 守卫
- **来源**：contract
- **分类**：patch
- **涉及 Story**：6-3
- **证据** - `6-3` Dev Notes 第 171-179 行仍直接检查 `(error as ...).code !== 'CONFIG_NOT_FOUND'`，没有先确认 `error instanceof AiforgeError`。
- **影响** - 这会把本应严格的白名单降级再次写成泛化的属性检查，增加实现时误吞非 AiforgeError 的风险，导致 Round 1 的错误处理修订没有完全闭环。
- **建议** - 将示例改成 `if (error instanceof AiforgeError && error.code === 'CONFIG_NOT_FOUND') { ... } else { throw error }`。

## 逐篇审查结论

### Story 6.1: `--list` 子目录内容列举

**结论：有条件通过**

**优点**
- `--list` 的正常输出路径已经收敛到 Reporter 接口，Round 1 的 direct stdout 缺口已关闭。
- `Clone` 后分叉到 `ListContents` 的整体设计仍与现有 pipeline 架构一致。

**关键问题**
1. **空目录成功态仍走 stderr** — `warn()` 属于诊断通道，与 AC #3 的成功语义不一致。
2. **辅助函数仍有裸 catch** — `scanAvailableTopDirs()` 会吞掉 repo 根目录读取失败。

**建议动作**
- 为空目录定义明确的 stdout 成功输出路径。
- 修正 `scanAvailableTopDirs()` 的错误处理示例，不再使用 `catch {}`。

### Story 6.2: `--filter` 精准子目录安装

**结论：硬阻塞**

**优点**
- `resolvedFilter` 替代改写 `args.filter` 后，零匹配回退的作用域保持问题已关闭。
- `--filter` 继续放在 Match 阶段处理，dry-run 一致性方向仍正确。

**关键问题**
1. **取消路径模型不合法** — 当前把“用户取消”建模成非 fatal 的 `AiforgeError`，与全局错误契约冲突。
2. **编排与测试未闭环** — 缺少 orchestrator 处理项，也没有覆盖 TTY 取消 / 正常短路退出测试。

**建议动作**
- 改用非错误 short-circuit 机制表达取消。
- 显式补充 `pipeline/orchestrator` 处理任务与对应测试。

### Story 6.3: 通用目标目录默认安装

**结论：有条件通过**

**优点**
- `--no-universal` 的 Commander 契约已闭环，Round 1 的 P0 设计错误已修复。
- Story 层面的优先级链和 `CONFIG_NOT_FOUND` 白名单降级方向已基本收敛。

**关键问题**
1. **Epic 级优先级链仍未同步** — Story 层已改为三层，但 Epic 6 本身还保留四层口径。
2. **白名单降级示例仍不够严格** — Dev Notes 仍未按 `instanceof AiforgeError` 模式书写。

**关注点**
- `tool: 'universal'` 继续作为共享 `tool` 字段的例外语义存在，当前仍列为 defer 项。

**建议动作**
- 先同步修正 Epic 6 AC #4，再修正降级示例代码。
- 将 `tool: 'universal'` 明确记录为已接受的 deferred contract debt，避免后续被误认为已正式收敛。

### Story 6.4: `aiforge init` 通用目录偏好配置

**结论：硬阻塞**

**优点**
- `confirm()` 询问插入点和默认值逻辑合理。
- `universalDirs` 的持久化与升级兼容方向清晰。

**关键问题**
1. **AC #3-#5 超出 Story 自身范围** — 这些 AC 本质上要求验证 `install` 运行时行为，但本 Story Tasks 并未覆盖。
2. **与 Story 6.3 的责任边界不清** — 当前文档自己已经承认运行时行为由 6-3 实现，却仍把这部分验收放在 6-4 名下。

**建议动作**
- 重划 Story 边界：要么收窄 6-4，只保留 init/persistence；要么显式把跨 Story 验收和依赖写完整。

## 通过项

- `--no-universal` Commander 选项规格已按 Round 1 评估结论修正，可关闭。
- `--filter` 零匹配回退已禁止改写 `args.filter`，并不再复用空计划表达“用户取消”。
- `--list` 的正常输出路径已收敛到 Reporter-only。
- 已知 defer 项：
  - `tool: 'universal'` 仍是共享 `tool` 字段的例外语义。
  - `--filter` 的“子目录”与“全部 sourceFiles”术语仍未统一。

## 结论

- **结论**：不通过
- **阻塞项**：
  - Epic 6 AC #4 仍保留已废弃的 environment variable 层
  - Story 6-2 的 `FILTER_CANCELLED` 取消路径与全局错误模型冲突，且缺少编排闭环
  - Story 6-4 的 AC 范围仍超出本 Story 边界
- **建议**：
  - 先同步修正 Epic 6 AC #4
  - 然后重构 Story 6-2 的取消短路模型，并补 `pipeline` / TTY 测试
  - 最后收窄或重划 Story 6-4 的边界，再顺手关闭 6-1 / 6-3 的中优先级文档缺口
