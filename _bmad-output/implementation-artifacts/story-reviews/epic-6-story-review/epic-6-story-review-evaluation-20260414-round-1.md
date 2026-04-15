---
Epic: 6
Scope: epic
Round: 1
Date: 2026-04-14
Model Used: Claude Opus 4.6 (claude-opus-4-6)
Review Source: epic-6-story-review-summary-20260413-round-1.md
Review Model: Codex (GPT-5-based) (codex)
Type: Story Review Evaluation
---

## 评估总结

首轮审查共报告 7 条发现（6 高 1 中），整体质量较高，误报率低。审查模型对 Commander `--no-` 前缀行为、catch 白名单规则和 Reporter 输出约束的引用均有明确文档证据支撑。7 条发现中：4 条确认有效需修订（含 2 条需人工裁决的设计决策），2 条有效但严重性偏高建议降级为后续改善跟踪，1 条确认有效但优先级可适当降低。总体判断：**需修订后再审**，核心阻塞项集中在 Story 6-3 和 6-4 的优先级链契约、Commander 选项设计和 catch 降级规则。

## 发现 #1 评估

### 审查原文

> **[高] `universalDirs` 四层优先级链缺少环境变量契约，导致 AC 不可实现**
> - 来源：consistency+contract+structure
> - 分类：decision_needed
> - 涉及 Story：6-3, 6-4
> - 证据 - `epic-6.md` 与 `6-4` 的 AC 明确写了 `CLI > 环境变量 > config > 默认值`，但 `6-3` 仅定义了 `CLI > config > 默认值`
> - 影响 - Story 6-4 的 AC #4 当前既无法实现也无法验收
> - 建议 - 二选一：明确环境变量契约 或 删除环境变量层

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 交叉验证确认：Epic-6.md AC#4 和 Story 6-4 AC#4 均提到"四层优先级链：CLI > 环境变量 > config > 默认值"，但 Story 6-3 Task 2.3 只定义了三层 `CLI > config > 默认值`，无任何环境变量名称、取值范围或解析逻辑的定义。
**严重性判断**：合理 — AC 中明确引用的优先级层在 Story Tasks 中完全缺失，导致 AC #4 不可实现也不可验收。多来源命中（consistency+contract+structure）进一步佐证。
**修订建议**：可行 — 二选一方案均可落地。考虑到 MVP 阶段，建议收敛为三层优先级（删除环境变量层），降低实现复杂度，后续需要时再扩展。
**误报评估**：非误报 — 文档证据充分。

## 发现 #2 评估

### 审查原文

> **[高] `--no-universal` 的 Commander 选项设计会让"默认开启 / 显式关闭"同时失效**
> - 来源：structure
> - 分类：patch
> - 涉及 Story：6-3
> - 证据 - Task 1.2 `.option('--no-universal', ..., false)` + Task 1.3 读 `opts['noUniversal']`，Commander 行为下两者都解析成 `{ universal: false }`
> - 影响 - AC #1 和 #2 无法同时成立
> - 建议 - 固定可工作的设计方案

### 评估结论：✅ 确认有效 — 需要修订（P0 优先级）

### 评估分析

**问题描述准确性**：基本准确 — Commander.js 中 `--no-X` 前缀选项自动创建隐式 `--X` 布尔选项（默认 true），`--no-X` 将其设为 false。但 Task 1.2 传入第三参数 `false` 覆盖了隐式默认值，导致 `opts.universal` 在"未传"和"传入 --no-universal"时均为 `false`。Task 1.3 读取 `opts['noUniversal']` 则不会获取到任何值（Commander 不生成此 key）。审查模型的本地验证结论基本正确，但描述中"不会生成 `noUniversal` 这个键"的细节更为关键——即使 universal 默认值对了，读取路径也是错的。
**严重性判断**：合理，实际应提升到 P0 — 这是一个直接导致功能完全不可用的选项设计错误，实现者照搬文档编码会得到 100% 错误的行为。
**修订建议**：可行 — 推荐改为 `.option('--no-universal', 'skip universal directory installation')`（不传默认值，让 Commander 使用隐式 true），然后通过 `opts.universal === false` 判断。需同步修正 Task 1.3 和 `mapOptsToArgs`。
**误报评估**：非误报 — Commander 行为可复现验证。

## 发现 #3 评估

### 审查原文

> **[高] 把"config 加载失败"整体降级为默认开启，违反错误处理白名单规则**
> - 来源：consistency+contract
> - 分类：patch
> - 涉及 Story：6-3
> - 证据 - Task 5.4 与 Dev Notes 使用 `catch {}` 风格；project-context.md 要求逐码白名单
> - 影响 - 配置损坏等真实故障被静默折叠
> - 建议 - 仅对白名单错误码降级

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — Dev Notes 代码示例使用裸 `catch { // CONFIG_NOT_FOUND 等错误：默认启用 }` 且用"等"字暗示多码批量降级。project-context.md Error Handling Rules 明确规定"禁止 catch {} 或 catch { /* ignore */ }"，且"catch 降级必须逐码白名单"。
**严重性判断**：合理 — 违反的是项目 Error Handling 核心规则（来源于 Story 2-3 CR 的血泪教训），且 CONFIG_CORRUPT / CONFIG_READ_FAILED 被静默吞掉会导致用户在配置损坏时拿到伪正常行为。
**修订建议**：可行 — 仅对 `error.code === 'CONFIG_NOT_FOUND'` 降级，其余错误 `throw error` 透传。修复范围小，只需改 Dev Notes 中的 catch 示例和 Task 5.4 的描述。
**误报评估**：非误报 — 规则引用准确。

## 发现 #4 评估

### 审查原文

> **[高] 用 `tool: 'universal'` 承载"通用目录"语义，扩展了共享字段边界**
> - 来源：contract+structure
> - 分类：decision_needed
> - 涉及 Story：6-3
> - 证据 - project-context.md 禁止通过扩展共享字段值域承载新语义
> - 影响 - 把 `tool` 字段从"真实工具 ID"扩成"安装通道/分组"
> - 建议 - 新增独立字段或正式重定义 `tool` 语义

### 评估结论：⚠️ 有效但降级 — 建议纳入后续改善跟踪（P2）

### 评估分析

**问题描述准确性**：基本准确 — project-context.md 确实有此规则。但审查忽略了一个关键事实：Story 6-3 Dev Notes 的"跨层共享字段安全检查"章节已对 `tool` 字段的全部 5 个消费方逐一分析并确认兼容（executeInstall → toolNameMap fallback、Reporter → 需处理显示名、saveManifest → OK、checkConflict → OK）。
**严重性判断**：偏高 — Story 已经完成了规则要求的消费方分析，结论是"只需在 Reporter 层提供友好显示名称"。`tool: 'universal'` 作为虚拟 ID 不进入 TOOL_DEFINITIONS 注册表（Task 3.3 明确排除），影响面已被控制。当前设计可工作，只是不够优雅。
**修订建议**：可行但非必要 — 引入新字段（如 `category: 'ide' | 'universal'`）是更优方案，但对 MVP 来说增加了 MatchedPlan/InstallRule 的类型复杂度。建议作为 P2 改善项跟踪，当前方案加上消费方 fallback 可安全推进。
**误报评估**：非误报 — 规则引用准确，但 Story 已做了充分的风险缓解。


## 发现 #5 评估

### 审查原文

> **[高] `--filter` 的 Story 契约仍写"子目录"，但任务已经扩展到全部 sourceFiles**
> - 来源：consistency+structure
> - 分类：decision_needed
> - 涉及 Story：6-2, 6-1, 6-3
> - 证据 - Epic 6 标题和 Story 6-2 AC 强调"子目录过滤"，但 Task 3.5 要求对 Files/Directories/Flatten 三种类型都生效
> - 影响 - 没有单一答案定义 --filter 的过滤对象
> - 建议 - 收窄回目录级或统一术语为"可安装条目"

### 评估结论：⚠️ 有效但降级 — 建议纳入后续改善跟踪（P2）

### 评估分析

**问题描述准确性**：基本准确 — 术语确实存在漂移：标题说"子目录"，Task 3.5 明确扩展到 Files 类型。但 Task 3.5 对此有意识且留有注释："虽然 FR-048 描述为'子目录'过滤，但 filter 逻辑应通用于所有 sourceFiles"，说明这是一个**刻意的设计决策**而非疏忽。
**严重性判断**：偏高 — 这更接近文档术语不一致问题，而非功能阻塞。Task 3.5 已经给出了明确的实现指导（对所有 sourceFiles 生效），开发者不会因此产生实现分歧。AC 中的"子目录"表述可在后续文档优化中修正。
**修订建议**：可行但非必要 — 统一术语为"可安装条目"是更好的表述，但不构成开发阻塞。建议作为 P2 文档改善项，在 Story 进入开发前顺手修正标题和 AC 措辞即可。
**误报评估**：非误报 — 术语不一致确实存在，但影响被高估。

## 发现 #6 评估

### 审查原文

> **[高] `--filter` 的零匹配回退路径会改变原始作用域，且"取消"没有独立边界**
> - 来源：contract+structure
> - 分类：patch
> - 涉及 Story：6-2
> - 证据 - Task 4.3 改写 `args.filter`，回写裸名称会丢失 `skills/` 前缀作用域；用户取消返回 `{ items: [] }` 与"合法空计划"共用结构
> - 影响 - 零匹配补救可能把限定单目录的过滤扩成跨目录过滤
> - 建议 - ParsedArgs 保持只读，取消定义为独立短路信号

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — Task 4.3 写"更新 args.filter 为用户选择的具体子目录路径"确实修改了输入参数，违反了数据不可变原则。Dev Notes 代码示例中 `choice` 值为裸名称（如 `git-commit`），重新匹配时会丢失原始 `skills/` 前缀作用域。取消场景返回 `{ items: [] }` 确实与"合法空计划"（如所有规则的 sourceFiles 均为空）在结构上不可区分。
**严重性判断**：合理 — 作用域丢失是功能性 bug（用户指定 `skills/xyz*` 的意图是限定在 skills 目录内，回退后不应跨目录匹配）。取消语义不独立会导致下游 Install/Report 阶段无法正确短路。
**修订建议**：可行 — (1) 用局部变量或独立 match 选项对象替代 `args.filter` 改写；(2) 候选值使用限定名（如 `skills/git-commit`）保留前缀；(3) 取消定义为独立信号（如 `{ cancelled: true }` 或专用异常），使管道编排器可识别。
**误报评估**：非误报 — 两个子问题均有代码级证据。

## 发现 #7 评估

### 审查原文

> **[中] `--list` 仍允许直接写 stdout，绕过 Reporter 输出契约**
> - 来源：structure+contract
> - 分类：patch
> - 涉及 Story：6-1
> - 证据 - Task 3.7 写"通过 Reporter 新方法或直接 process.stdout.write()"；project-context.md 要求除 init 外所有输出经过 Reporter
> - 影响 - TTY/Plain/Quiet 行为交给实现者自由发挥
> - 建议 - 删除 direct stdout 备选，只用 Reporter.reportList()

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — Task 3.7 确实保留了"或直接 process.stdout.write()"作为备选方案。project-context.md Output Rules 明确规定"ALL user-visible output MUST go through Reporter interface"，且豁免列表只包含 `aiforge init` 和 Reporter 创建前的回退提示。`--list` 不在豁免列表中。
**严重性判断**：合理 — 中等严重性恰当。Task 4 已设计了完整的 `Reporter.reportList()` 方法（含三种 Reporter 实现），正确路径已存在。只需删除 Task 3.7 中的备选分支描述即可。
**修订建议**：可行 — 删除 Task 3.7 中"或直接 process.stdout.write()"措辞，明确只通过 `reporter.reportList()` 输出。修改量极小。
**误报评估**：非误报 — 规则引用准确，且 Reporter 路径已设计完备。

## 整体评估结论

### 需要修订（阻塞进入开发）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 2 | --no-universal Commander 选项设计不可工作 | [高] | P0 | 必须修正 option 定义和 opts 读取路径 |
| 1 | universalDirs 优先级链缺环境变量契约 | [高] | P1 | 建议删除 env 层，收敛为三层优先级 |
| 3 | config 加载降级违反逐码白名单规则 | [高] | P1 | 只对 CONFIG_NOT_FOUND 降级 |
| 6 | --filter 零匹配回退丢失作用域 + 取消无独立边界 | [高] | P1 | args 保持只读，取消定义独立信号 |
| 7 | --list 允许绕过 Reporter 输出 | [中] | P1 | 删除 direct stdout 备选分支 |

### 建议纳入后续改善跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 4 | tool: 'universal' 扩展共享字段语义 | [高] | P2 | Story 已做消费方分析，当前可工作 |
| 5 | --filter 术语"子目录"与实现不一致 | [高] | P2 | 刻意设计决策，顺手修正术语即可 |

### 可忽略（误报）

| # | 发现 | 原始严重性 | 忽略理由 |
|---|------|----------|---------|
| — | （无误报） | — | — |

### 评估决定

**整体结论**：需修订后再审

5 条发现需要修订（1 条 P0 + 4 条 P1），2 条降级为后续改善跟踪。建议优先修正 Story 6-3 的 Commander 选项设计（P0），然后处理优先级链契约、catch 降级规则和 --filter 零匹配路径设计，最后清理 --list 的 Reporter 备选分支。修订完成后提交复审。

---

## 修订执行记录

### 修订执行记录
- **Date**: 2026-04-14
- **Model Used**: Claude Sonnet 4 (claude-sonnet-4)
- **Fix Items**: 5

#### 修订项 #1: `--no-universal` Commander 选项设计不可工作（P0）
- **文件**: `_bmad-output/implementation-artifacts/stories/6-3-universal-directory-install.md`
- **章节**: Tasks / Subtasks — Task 1.2、Task 1.3；Dev Notes — `universalDirs 偏好传递` 代码示例
- **修改摘要**:
  - Task 1.2：`.option('--no-universal', 'skip universal directory installation', false)` → `.option('--no-universal', 'skip universal directory installation')`（去除第三参数 `false`，恢复 Commander `--no-X` 隐式布尔默认值 true）
  - Task 1.3：`noUniversal: Boolean(opts['noUniversal'])` → `noUniversal: opts.universal === false`（修正读取路径，Commander `--no-X` 生成 `opts.universal` 而非 `opts.noUniversal`）
  - Dev Notes 代码示例：裸 `catch { }` → `catch (error) { if (...code !== 'CONFIG_NOT_FOUND') throw error }`（同步修正，见修订项 #3）
- **状态**: 已完成

#### 修订项 #2: `universalDirs` 优先级链缺环境变量契约（P1）
- **文件**:
  - `_bmad-output/implementation-artifacts/stories/6-3-universal-directory-install.md`
  - `_bmad-output/implementation-artifacts/stories/6-4-init-universal-directory-preference.md`
- **章节**:
  - Story 6-3 Tasks — Task 2.3
  - Story 6-4 Acceptance Criteria — AC #4
- **修改摘要**:
  - Story 6-3 Task 2.3：`优先级链：CLI > config > 默认值 true` 增加注释"不支持环境变量层，MVP 阶段保持简单"，明确为三层
  - Story 6-4 AC #4：`四层优先级链：CLI > 环境变量 > config > 默认值` → `三层优先级链：CLI > config > 默认值`（删除环境变量层，与 Story 6-3 实现保持一致）
- **状态**: 已完成

#### 修订项 #3: config 加载降级违反逐码白名单规则（P1）
- **文件**: `_bmad-output/implementation-artifacts/stories/6-3-universal-directory-install.md`
- **章节**: Tasks / Subtasks — Task 5.4；Dev Notes — `universalDirs 偏好传递` 代码示例
- **修改摘要**:
  - Task 5.4：`config 加载失败（如 CONFIG_NOT_FOUND）时，universalDirs 视为 true` → 明确"仅对 `error.code === 'CONFIG_NOT_FOUND'` 降级，其余错误码必须 `throw error` 透传，禁止静默吞掉"
  - Dev Notes 代码示例：`catch { // CONFIG_NOT_FOUND 等错误：默认启用 }` → `catch (error) { if (error.code !== 'CONFIG_NOT_FOUND') throw error }`，精确白名单降级
- **状态**: 已完成

#### 修订项 #4: `--filter` 零匹配回退丢失作用域 + 取消无独立边界（P1）
- **文件**: `_bmad-output/implementation-artifacts/stories/6-2-filter-subdirectory-install.md`
- **章节**: Tasks / Subtasks — Task 4.3、Task 4.4；Dev Notes — 零匹配交互式询问代码示例
- **修改摘要**:
  - Task 4.3：`更新 args.filter 为用户选择的具体子目录路径` → `用局部变量 resolvedFilter 保存用户选择的限定名称（保留 dirPrefix/ 前缀）；禁止改写 args.filter`
  - Task 4.4：`用户取消：正常退出（exit code 0），不报错` → `抛出专用短路信号 FilterCancelledError（错误码 FILTER_CANCELLED，exit code 0）；禁止返回 { items: [] } 空计划`
  - Dev Notes 代码示例：候选值从裸名称（`value: d`）改为限定名（`value: dirPrefix ? \`${dirPrefix}/${d}\` : d`）；取消路径从 `return { items: [] }` 改为 `throw new AiforgeError(...'FILTER_CANCELLED'...)`；补充局部变量 `resolvedFilter` 注释
- **状态**: 已完成

#### 修订项 #5: `--list` 允许绕过 Reporter 输出（P1）
- **文件**: `_bmad-output/implementation-artifacts/stories/6-1-list-subdirectory-contents.md`
- **章节**: Tasks / Subtasks — Task 3.7
- **修改摘要**:
  - `通过 Reporter 的新方法或直接 process.stdout.write() 输出` → `只通过 reporter.reportList() 输出；禁止直接 process.stdout.write()`，并注明 Task 4 已设计完整的三种 Reporter 实现
- **状态**: 已完成