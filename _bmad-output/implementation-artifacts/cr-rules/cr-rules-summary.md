# CR Rules Summary

用于沉淀跨 Story 可复用的 CR 规则提炼结果，记录规则来源、量化升格判定、适用范围、落地位置与同步状态。

---

## 规则索引

| 规则编号 | 标题 | 来源 Story | 总分 | 建议去向 | 同步状态 |
|----------|------|------------|------|----------|----------|
| CR-PROCESS-01 | 规则数量验收口径必须绑定已批准基线与本 Story 明确新增范围 | 7-3, 7-5 | 8/12 | global-doc | 已同步全局文档 |
| CR-PROCESS-02 | 交互式确认中断必须统一转换为管道取消信号 | 7-6 | 8/12 | global-doc | 已同步全局文档 |
| CR-TEST-01 | 新增工具安装规则必须用端到端测试锁定真实落盘路径 | 7-3 | 7/12 | rules-summary | 已写入规则总结 |
| CR-API-01 | 能力边界提示必须按契约触发条件检查 | 7-9, 7-10 | 9/12 | global-doc | 已同步全局文档 |
| CR-API-02 | 信息性提示的存在性检查必须与决策路径隔离并保持非阻断 | 7-10 | 8/12 | global-doc | 已同步全局文档 |
| CR-API-03 | 安装结果摘要状态必须由结构化结果项承载 | 7-2 | 7/12 | rules-summary | 已写入规则总结 |

---

## Story 记录

<!-- 新 Story 规则沉淀记录追加在本章节下方，按日期升序或项目既有顺序排列。 -->

### Story 7-3 / 2026-05-18

- **Story**: 7-3
- **分析来源**:
  - `7-3-code-review-summary-20260518-round-1.md`
  - `7-3-code-review-evaluation-20260518-round-1.md`
  - `7-3-code-review-summary-20260518-round-2.md`
  - `7-3-code-review-evaluation-20260518-round-2.md`
- **结论概览**:
  - Round 1 发现 2 个阻塞项：`BUILTIN_RULES` 总量验收口径冲突、Auggie 缺少端到端安装测试。
  - Round 1 evaluation 已确认两项有效；修复后 Round 2 reviewer 与 evaluator 均确认通过，Fix Items = 0，CR TODO = 0。
  - 本次仅沉淀已解决且可复用的规则总结，不升格全局文档，不新增 TODO backlog。
   - 本次执行模型：GPT-5.4。
   - Story 7-5 再次复现同类 `BUILTIN_RULES` 总量口径冲突（41 vs 40），已按 `33 + 7 = 40` 裁定为规格累计计数误差；该重复证据使本规则从 rules-summary 升格为 global-doc。

#### 升格判定摘要

| 候选规则 | 硬性门槛 | 总分 | 建议去向 | 用户确认结果 |
|----------|----------|------|----------|--------------|
| 规则数量验收口径必须绑定已批准基线与本 Story 明确新增范围 | 通过 | 8/12 | global-doc | Story 7-5 复现后按默认决策升格 |
| 新增工具安装规则必须用端到端测试锁定真实落盘路径 | 通过 | 7/12 | rules-summary | 按流程默认推荐记录 |

### 提炼规则

#### CR-PROCESS-01：规则数量验收口径必须绑定已批准基线与本 Story 明确新增范围

- **来源问题**: Story AC #5 曾要求 `BUILTIN_RULES` 总量为 30，但当前仓库已批准基线为 24，本 Story 明确只新增 Auggie 5 条规则，有效总量应为 29；若为满足旧数字而添加超范围规则，会破坏 Story 边界。
- **CR 证据**:
   - `7-3-code-review-summary-20260518-round-1.md`: Finding #1 指出 30 vs 29 的验收口径冲突，并建议由 Story owner 裁决，不应通过新增规则凑数。
   - `7-3-code-review-evaluation-20260518-round-1.md`: 确认有效并采用推荐决策，明确有效规则总量口径为 29。
   - `7-3-code-review-evaluation-20260518-round-2.md`: 确认 Story、测试和实现均已收敛到 29，且未新增超范围规则凑数。
   - `7-5-code-review-summary-20260518-round-1.md`: Finding #1 指出 Story AC #5 的 `BUILTIN_RULES` 41 与实现/测试/Dev Agent Record 的 40 不一致。
   - `7-5-code-review-evaluation-20260518-round-1.md`: 采纳 `33 条当前基线 + 7 条 OpenCode 新增 = 40 条`，将 41 降级为 P2 非阻塞规格澄清项。
   - `7-5-code-review-evaluation-20260518-round-2.md`: 复核确认继续维持 40 口径，无 fixer 必须处理事项。
- **硬性门槛**:
  - 有证据: 是
  - 可规则化: 是
  - 非纯特例: 是
  - 不重复: 是
  - 状态明确: 是
- **量化评分**:

  | 维度 | 分数 | 理由 |
  |------|------|------|
| 复现频次 | 2 | Story 7-3 与 Story 7-5 均出现规则总量数字与已批准基线/新增范围不一致的问题。 |
  | 影响范围 | 1 | 影响安装规则矩阵、Story AC、测试断言和 CR finalizer 判断。 |
  | 风险等级 | 1 | 可能导致验收误判或通过超范围规则污染规则矩阵。 |
  | 根因稳定性 | 1 | 源于规则总量数字与批准基线分离的流程习惯。 |
  | 可执行性 | 2 | 可通过 Story AC、测试断言和 `BUILTIN_RULES.length` 对照检查。 |
  | 文档缺口 | 1 | 全局文档有规则矩阵原则，但未细化数字口径冲突处理。 |

- **总分**: 8/12
- **建议去向**: global-doc
- **适用范围**: 涉及内置规则数量、工具矩阵基线、Story AC 数字口径的 Story 和 CR 修复。
- **规避指南**:
  - 禁止为了满足过期的总量数字而新增无 Story 来源的安装规则。
  - 禁止只修改测试断言而不同步 Story AC 与 Dev Agent Record 中的规则数量口径。
- **最佳实践**:
   - 先确认已批准基线，再按本 Story 明确新增/删除范围计算目标总量。
   - 若 AC 数字与实现边界冲突，裁决应优先同步 Story/测试/记录口径，而不是扩大代码变更范围。
- **全局文档建议**:
   - 已升格并同步到 Rule Document Registry 三文档：`project-context.md`、`04-implementation-patterns.md`、`03-core-decisions.md`。
- **本次落地**:
   - Story 7-3、测试断言和实现已统一为 `BUILTIN_RULES = 29`。
   - Story 7-5、测试断言和实现已统一为 `BUILTIN_RULES = 40`；Story/Epic/PLAN 中残留的 41 作为 CR TODO 跟踪。
- **同步状态**: 已同步全局文档

### Story 7-5 / 2026-05-18

- **Story**: 7-5
- **分析来源**:
  - `7-5-code-review-summary-20260518-round-1.md`
  - `7-5-code-review-evaluation-20260518-round-1.md`
  - `7-5-code-review-summary-20260518-round-2.md`
  - `7-5-code-review-evaluation-20260518-round-2.md`
- **结论概览**:
  - Round 1 发现 `BUILTIN_RULES` 41 vs 40 的验收口径冲突；evaluation 已裁定当前实现的 40 为有效口径。
  - Round 2 reviewer/evaluator 均确认 OpenCode 7 条规则、XDG 检测路径、MCP merge hint 与质量门禁通过。
  - 本 Story 没有新增独立规则；同类规则数量口径问题合并更新既有 `CR-PROCESS-01`，并因跨 Story 复现升格到全局规则文档。

#### 升格判定摘要

| 候选规则 | 硬性门槛 | 总分 | 建议去向 | 用户确认结果 |
|----------|----------|------|----------|--------------|
| 规则数量验收口径必须绑定已批准基线与本 Story 明确新增范围 | 通过 | 8/12 | global-doc | 按本次用户指令采用默认决策并落地 |

#### CR-TEST-01：新增工具安装规则必须用端到端测试锁定真实落盘路径

- **来源问题**: Auggie project instructions 规则涉及 `targetDir: './'` 与 `fileFilter: ['AGENTS.md']`，仅有规则矩阵和 match 阶段测试不足以证明 install 阶段真实落盘行为，尤其不能证明项目根只生成 `AGENTS.md` 且不会分发 `CLAUDE.md`。
- **CR 证据**:
  - `7-3-code-review-summary-20260518-round-1.md`: Finding #2 指出 Auggie 缺少端到端安装测试覆盖项目根 `AGENTS.md` 写入路径。
  - `7-3-code-review-evaluation-20260518-round-1.md`: 确认该测试缺口有效，并要求补充 pipeline/install 级测试。
  - `7-3-code-review-evaluation-20260518-round-2.md`: 确认新增 `auggie:project` 集成测试已覆盖 `.augment/skills/`、`.augment/agents/`、项目根 `AGENTS.md`，并验证项目根 `CLAUDE.md` 不会被安装。
- **硬性门槛**:
  - 有证据: 是
  - 可规则化: 是
  - 非纯特例: 是
  - 不重复: 是
  - 状态明确: 是
- **量化评分**:

  | 维度 | 分数 | 理由 |
  |------|------|------|
  | 复现频次 | 1 | 单 Story 中由 reviewer 与 evaluator 连续确认，且与既有 E2E 覆盖缺口模式相近。 |
  | 影响范围 | 1 | 影响新增工具安装规则的 match/install 全链路验收。 |
  | 风险等级 | 1 | 可能导致安装落盘路径或文件过滤回归未被测试发现。 |
  | 根因稳定性 | 1 | 常见根因是只验证规则定义和 match 输出，未覆盖真实 install 阶段。 |
  | 可执行性 | 2 | 可用 pipeline 集成测试断言源文件过滤、目标目录和实际文件存在性。 |
  | 文档缺口 | 1 | 全局文档已有集成测试分层原则，但未细化新增工具安装规则的真实落盘路径要求。 |

- **总分**: 7/12
- **建议去向**: rules-summary
- **适用范围**: 新增 AI 工具、安装规则矩阵、`targetDir` 特殊路径、`fileFilter` 或文件分发语义变更。
- **规避指南**:
  - 禁止只用规则存在性测试或 match 阶段测试替代真实安装落盘验证。
  - 对 `targetDir: './'`、白名单过滤、跨工具 instructions 分发等敏感路径，禁止缺少端到端回归保护。
- **最佳实践**:
  - 新增工具安装规则时至少补一条 pipeline/install 级集成测试，断言匹配规则、目标路径和实际落盘文件。
  - 若源目录存在同类竞争文件，应同时断言未被白名单允许的文件不会被安装。
- **全局文档建议**:
  - 不建议升格全局文档。该规则是现有“集成测试使用端到端管道”原则在新增工具矩阵场景下的细化，先作为 CR 规则总结记录。
- **本次落地**:
  - 已新增 Auggie project 端到端安装测试并通过完整质量门禁。
- **同步状态**: 已写入规则总结

### Story 7-6 / 2026-05-19

- **Story**: 7-6
- **分析来源**:
  - `7-6-code-review-summary-20260519-round-1.md`
  - `7-6-code-review-evaluation-20260519-round-1.md`
  - `7-6-code-review-summary-20260519-round-2.md`
  - `7-6-code-review-evaluation-20260519-round-2.md`
- **结论概览**:
  - Round 1 共 4 条发现：`decision_needed=1`（AC#5 口径矛盾）、`patch=2`（confirm 中断未捕获、动态 i18n 键无防护）、`defer=1`（stdout/stdin TTY 历史约定）。
  - Round 1 evaluation 确认仅 1 项阻塞修复：`confirm()` 中断异常需统一处理；其余 3 项降级为 CR TODO。
  - 修复后 Round 2 reviewer/evaluator 均通过，阻塞项关闭；本次提炼 1 条可复用且可执行的全局规则。

#### 升格判定摘要

| 候选规则 | 硬性门槛 | 总分 | 建议去向 | 用户确认结果 |
|----------|----------|------|----------|--------------|
| 交互式确认中断必须统一转换为管道取消信号 | 通过 | 8/12 | global-doc | apply-confirmed 自动落地 |
| 动态 i18n 键访问必须具备键存在性防护或类型收窄 | 通过 | 7/12 | todo-tracker | 本次仅分析，不在 04 中写入 TODO |
| stdout/stdin TTY 判定语义统一 | 通过 | 6/12 | todo-tracker | 本次仅分析，不在 04 中写入 TODO |

### 提炼规则

#### CR-PROCESS-02：交互式确认中断必须统一转换为管道取消信号

- **来源问题**: 在 TTY 交互确认中按 Ctrl+C 会抛出 `ExitPromptError`。若 stage 未捕获并转换，异常会绕过既有取消语义，导致 phase 无法按统一取消链路收敛，并可能留下未闭合的交互状态。
- **CR 证据**:
  - `7-6-code-review-summary-20260519-round-1.md`: Finding #2 指出 `applySemanticWarnings` 未捕获 `confirm()` 中断异常，建议转换为统一取消信号。
  - `7-6-code-review-evaluation-20260519-round-1.md`: 明确确认为需修复项（P2），并要求与既有取消机制保持一致。
  - `7-6-code-review-evaluation-20260519-round-1.md`: 修复记录显示已将 `ExitPromptError` 转换为 `FilterCancelledSignal`。
  - `7-6-code-review-summary-20260519-round-2.md`: 复审确认该修复持续有效，无新增阻塞。
- **硬性门槛**:
  - 有证据: 是
  - 可规则化: 是
  - 非纯特例: 是
  - 不重复: 是
  - 状态明确: 是
- **量化评分**:

  | 维度 | 分数 | 理由 |
  |------|------|------|
  | 复现频次 | 1 | 单 Story 多轮（审查→评估→修复→复审）持续出现并验证。 |
  | 影响范围 | 1 | 涉及 stage 交互、pipeline 取消分支与 reporter phase 生命周期。 |
  | 风险等级 | 1 | 会导致用户中断路径异常退出或状态不一致，影响 CLI 可靠性。 |
  | 根因稳定性 | 1 | 根因是交互式 prompt 异常语义未纳入统一取消协议，具有复发性。 |
  | 可执行性 | 2 | 可明确检查：捕获 `ExitPromptError` 并转换为项目取消信号，且有回归点。 |
  | 文档缺口 | 2 | 现有全局规则覆盖 catch 原则，但未明确交互中断的协议化转换要求。 |

- **总分**: 8/12
- **建议去向**: global-doc
- **适用范围**: 所有使用 `@inquirer/prompts` 等交互式确认/选择的 stage 或辅助函数。
- **规避指南**:
  - 禁止将交互中断异常直接向上裸抛并依赖外层兜底。
  - 禁止在交互分支中引入与现有取消信号并行的“私有取消语义”。
- **最佳实践**:
  - 在交互调用点捕获 `ExitPromptError`，统一转换为 `FilterCancelledSignal`（或项目统一取消信号）。
  - 让 pipeline 仅识别统一取消信号，保证取消路径行为一致、可测试、可观测。
- **全局文档建议**:
  - 升格并同步到 Rule Document Registry 三文档：`project-context.md`、`04-implementation-patterns.md`、`03-core-decisions.md`。
- **本次落地**:
  - `src/stages/semantic-warnings.ts` 已在 `confirm()` 调用处捕获 `ExitPromptError` 并转抛 `FilterCancelledSignal`。
- **同步状态**: 已同步全局文档

### Story 7-7 / 2026-05-19

- **Story**: 7-7
- **分析来源**:
  - `7-7-code-review-summary-20260519-round-1.md`
  - `7-7-code-review-evaluation-20260519-round-1.md`
- **结论概览**:
  - Round 1 reviewer 与 evaluator 均确认通过，`decision_needed=0`、`patch=0`、`defer=0`，Fix Items = 0。
  - 本轮 CR 历史仅 1 轮且无 Findings、无 TODO 候选，不构成可泛化规则；本次按默认决策记录为“无需升格/无需写入”。
  - 本次执行模型：GPT-5.4。

#### 升格判定摘要

| 候选规则 | 硬性门槛 | 总分 | 建议去向 | 用户确认结果 |
|----------|----------|------|----------|--------------|
| 无候选规则 | 不适用（无 Findings） | - | none | 无需升格/无需写入 |

### Story 7-9 / 2026-05-19

- **Story**: 7-9
- **分析来源**:
  - `7-9-code-review-summary-20260519-round-1.md`
  - `7-9-code-review-evaluation-20260519-round-1.md`
  - `7-9-code-review-summary-20260519-round-2.md`
  - `7-9-code-review-evaluation-20260519-round-2.md`
- **结论概览**:
  - Round 1 发现 2 个 `patch` 项：Trae unsupported notice 误用安装项扫描结果作为触发条件、`Reporter.info()` 新增后部分既有测试 mock 未补齐。
  - Round 1 evaluation 确认 Finding #1 为 AC #3 边界合规缺口并要求修复；Finding #2 降级为 P2 非阻塞 CR TODO。
  - 修复后 Round 2 reviewer/evaluator 均确认通过；本次仅将已修复且可复用的能力边界提示规则写入规则总结，不升格全局文档。
  - Story 7-10 复现同类 notice 契约缺口后，本规则升格为 global-doc，并同步到 Rule Document Registry 三文档。

#### 升格判定摘要

| 候选规则 | 硬性门槛 | 总分 | 建议去向 | 用户确认结果 |
|----------|----------|------|----------|--------------|
| 能力边界提示必须按契约触发条件检查 | 通过 | 9/12 | global-doc | Story 7-10 复现后按默认决策升格 |
| Reporter 接口新增必需方法时同步补齐既有测试 mock | 通过 | 6/12 | todo-tracker | 交给 05 TODO Tracker |

### 提炼规则

#### CR-API-01：能力边界提示必须按契约触发条件检查

- **来源问题**: Trae Skills 明确不支持文件系统安装，Story AC #3 要求当知识仓库包含 `skills/` 目录时输出 info 级能力边界提示。初始实现复用 `scanSourceFiles(... Directories ...)` 的非空结果判断是否提示，导致空 `skills/` 目录或仅含 `.gitkeep` 占位文件时不输出说明。
- **CR 证据**:
  - `7-9-code-review-summary-20260519-round-1.md`: Finding #1 指出 unsupported notice 依赖可扫描子目录，和 AC #3 的目录存在性语义不一致。
  - `7-9-code-review-evaluation-20260519-round-1.md`: 确认该问题为 P1 必修，并要求改为按 `sourceDir` 存在且为目录触发提示。
  - `7-9-code-review-evaluation-20260519-round-1.md`: 修复记录显示已新增 `sourceDirExists()`，并补充空目录与占位文件测试。
  - `7-9-code-review-evaluation-20260519-round-2.md`: 确认 Round 1 Finding #1 已修复，且非空、空目录、仅占位文件三类场景均有测试覆盖。
- **硬性门槛**:
  - 有证据: 是
  - 可规则化: 是
  - 非纯特例: 是
  - 不重复: 是
  - 状态明确: 是
- **量化评分**:

  | 维度 | 分数 | 理由 |
  |------|------|------|
  | 复现频次 | 2 | Story 7-9 的 Trae unsupported notice 与 Story 7-10 的 iFlow stale notice 均出现“提示触发条件未覆盖 AC 契约”的同类问题。 |
  | 影响范围 | 2 | 影响 match 阶段能力边界提示、detect 阶段 stale-tool 提示、手动/自动工具入口与用户反馈契约。 |
  | 风险等级 | 1 | 可能导致用户无法获知能力边界，误以为 unsupported 资源被静默忽略。 |
  | 根因稳定性 | 1 | 根因是将“可安装项扫描结果”误作“提示触发契约”，未来新增类似 notice 时容易复现。 |
  | 可执行性 | 2 | 可明确检查：提示触发条件必须直接验证契约要求，并覆盖空目录、占位文件等边界测试。 |
  | 文档缺口 | 2 | 全局文档未覆盖 unsupported/stale notice 的触发契约与手动/自动入口一致性。 |

- **总分**: 9/12
- **建议去向**: global-doc
- **适用范围**: `TOOL_UNSUPPORTED_NOTICES`、停服/不支持能力提示、数据驱动 info 级用户通知，以及类似“无安装规则但需要解释”的 match 阶段场景。
- **规避指南**:
  - 禁止用安装项扫描结果替代能力边界提示的契约触发条件。
  - 禁止让提示行为依赖目录内容形态，而 Story/AC 明确要求按目录存在性触发。
  - 禁止只在自动检测路径输出 stale/unsupported notice，而遗漏手动 `--tools` 等同样满足契约的入口。
- **最佳实践**:
  - 为每类 unsupported/stale notice 明确触发契约，例如目录存在、配置文件存在或工具命中。
  - 对目录存在性触发的 notice，应直接检查 `sourceDir` 是否存在且为目录，并覆盖空目录和仅占位文件场景。
  - 保持提示为 `reporter.info()` 等非失败通道，避免把能力边界说明误呈现为安装失败。
- **全局文档建议**:
  - 已升格并同步到 Rule Document Registry 三文档：`project-context.md`、`04-implementation-patterns.md`、`03-core-decisions.md`。
- **本次落地**:
  - `src/stages/match-rules.ts` 已改为通过 `sourceDirExists()` 按 `skills/` 目录存在性触发 Trae unsupported notice。
  - `tests/stages/match-rules.test.ts` 已新增空 `skills/` 目录和仅 `.gitkeep` 占位文件场景测试。
- **同步状态**: 已同步全局文档

### Story 7-10 / 2026-05-19

- **Story**: 7-10
- **分析来源**:
  - `7-10-code-review-summary-20260519-round-1.md`
  - `7-10-code-review-evaluation-20260519-round-1.md`
  - `7-10-code-review-summary-20260519-round-2.md`
  - `7-10-code-review-evaluation-20260519-round-2.md`
  - `7-10-code-review-summary-20260519-round-3.md`
  - `7-10-code-review-evaluation-20260519-round-3.md`
- **结论概览**:
  - Round 1 发现 2 个 `patch` 项：手动 `--tools` 分支绕过 `.iflow/` stale-tool 提示、信息性 `.iflow/` 检查可能因权限/I/O 错误阻断安装。
  - Round 2 发现 1 个 `patch` 项：dry-run 集成测试 Reporter mock 缺少 `info()`，在项目级 `.iflow/` 存在时导致全量 `npm test` 失败。
  - Round 3 reviewer 与 evaluator 均确认通过：decision_needed 0、patch 0、defer 0；Round 1/2 的 3 个 P1 均已关闭，无新增 CR TODO。
  - 本次将 `CR-API-01` 从 rules-summary 升格为 global-doc，并新增 `CR-API-02` 作为信息性提示非阻断豁免规则。

#### 升格判定摘要

| 候选规则 | 硬性门槛 | 总分 | 建议去向 | 用户确认结果 |
|----------|----------|------|----------|--------------|
| 能力边界提示必须按契约触发条件检查 | 通过 | 9/12 | global-doc | 按本次用户指令采用默认决策并落地 |
| 信息性提示的存在性检查必须与决策路径隔离并保持非阻断 | 通过 | 8/12 | global-doc | 按本次用户指令采用默认决策并落地 |
| Reporter 接口新增必需方法时同步补齐既有测试 mock | 通过 | 7/12 | todo-tracker | 已存在 TODO-045；交给 05 更新证据 |

### 提炼规则

#### CR-API-02：信息性提示的存在性检查必须与决策路径隔离并保持非阻断

- **来源问题**: `.iflow/` stale-tool 提示是 AC #6 / Task 5.3 定义的信息性提示，不应阻断安装流程。初始实现复用严格 `pathExists()`，当 `~/.iflow` 或项目 `.iflow` 检查遇到 `EACCES`、`EIO` 等非 ENOENT/ENOTDIR 错误时会抛错并中断 `detectTools()`。
- **CR 证据**:
  - `7-10-code-review-summary-20260519-round-1.md`: Finding #2 指出 `.iflow/` 信息性检查可能因权限/I/O 错误阻断安装流程。
  - `7-10-code-review-evaluation-20260519-round-1.md`: 确认该发现有效，并要求保持通用 `pathExists()` 严格语义不变，仅为 `.iflow/` stale-tool 提示引入专用非阻断降级。
  - `7-10-code-review-evaluation-20260519-round-1.md`: 修复记录显示已新增专用非阻断 helper，`EACCES`/I/O 异常时静默跳过提示而不阻断安装。
  - `7-10-code-review-summary-20260519-round-3.md`: 复审确认该 P1 持续关闭，且 `.iflow/` stale-tool 提示仍为信息性输出，不新增安装目标。
- **硬性门槛**:
  - 有证据: 是
  - 可规则化: 是
  - 非纯特例: 是
  - 不重复: 是
  - 状态明确: 是
- **量化评分**:

  | 维度 | 分数 | 理由 |
  |------|------|------|
  | 复现频次 | 1 | 单 Story 中由 reviewer、evaluator、fixer、复审连续确认，且属于可复用的 info notice 异常边界。 |
  | 影响范围 | 1 | 影响 detect 阶段、手动/自动工具入口和用户提示链路。 |
  | 风险等级 | 1 | 信息提示失败会误阻断安装流程，违反非阻断 AC。 |
  | 根因稳定性 | 1 | 根因是可选提示复用主决策路径的严格存在性检查 helper，未来新增 notice 时容易复现。 |
  | 可执行性 | 2 | 可明确检查：专用 helper、与主检测隔离、异常降级测试、不得改变通用 `pathExists()`。 |
  | 文档缺口 | 2 | 既有全局 fs 存在性规则要求非 ENOENT/ENOTDIR 透传，需要补充信息性提示路径的窄豁免，避免规则冲突。 |

- **总分**: 8/12
- **建议去向**: global-doc
- **适用范围**: unsupported/stale notice、停服提示、迁移提示等只影响用户说明、不参与工具识别/安装/安全边界决策的可选信息性检查。
- **规避指南**:
  - 禁止让信息性提示的文件系统探测失败阻断安装主流程。
  - 禁止将信息性提示的非阻断存在性 helper 复用到工具识别、安全校验、安装决策或数据完整性路径。
- **最佳实践**:
  - 主决策路径继续使用严格存在性检查：`ENOENT`/`ENOTDIR` 降级，其他错误透传。
  - 信息性提示若明确要求非阻断，应使用命名清晰的专用 helper，并用测试覆盖 `EACCES`/I/O 异常时主流程继续执行。
  - 在修复记录中说明该 helper 的适用边界，避免后续被误推广。
- **全局文档建议**:
  - 升格并同步到 Rule Document Registry 三文档：`project-context.md`、`04-implementation-patterns.md`、`03-core-decisions.md`。
- **本次落地**:
  - `src/stages/detect-tools.ts` 已新增 `.iflow/` stale-tool 专用非阻断检查；`tests/stages/detect-tools.test.ts` 已覆盖 `EACCES` 不阻断检测结果。
- **同步状态**: 已同步全局文档

### Story 7-2 / 2026-05-20

- **Story**: 7-2
- **分析来源**:
  - `7-2-code-review-summary-20260518-round-1.md`
  - `7-2-code-review-evaluation-20260518-round-1.md`
  - `7-2-code-review-summary-20260518-round-2.md`
  - `7-2-code-review-evaluation-20260518-round-2.md`
- **结论概览**:
  - Round 1 发现 2 个阻塞项：`decision_needed=1`（Codex instructions 与规则总量口径冲突）、`patch=1`（mcp-tools 安装结果摘要缺少“需手动合并”状态）。
  - Round 1 evaluation 确认两项均有效；修复后 Round 2 reviewer 与 evaluator 均确认通过，Fix Items = 0，CR TODO = 0。
  - 规则总量口径冲突已被既有 `CR-PROCESS-01` 覆盖；本次仅按用户确认的 record-only 模式沉淀“结果摘要状态必须进入结构化结果项”这一细化规则，不升格全局文档。

#### 升格判定摘要

| 候选规则 | 硬性门槛 | 总分 | 建议去向 | 用户确认结果 |
|----------|----------|------|----------|--------------|
| 安装结果摘要状态必须由结构化结果项承载 | 通过 | 7/12 | rules-summary | 按用户确认执行 record-only |

### 提炼规则

#### CR-API-03：安装结果摘要状态必须由结构化结果项承载

- **来源问题**: Story AC #4 要求安装结果摘要中将 Codex `mcp-tools` 标注为“需手动合并”，而初始实现只额外输出 `Reporter.warn()` 合并提示，结果项本身仍按普通 `new` 状态展示。用户会同时看到 warning 和普通完成摘要，TTY / Plain / Quiet 输出及自动化消费方都无法从结果项语义判断后续仍需人工合并。
- **CR 证据**:
  - `7-2-code-review-summary-20260518-round-1.md`: Finding #2 指出 warning 不等同于安装结果摘要状态，mcp-tools 仍可能显示为普通完成。
  - `7-2-code-review-evaluation-20260518-round-1.md`: 确认该发现有效，并建议保留 `InstallResult.items[].status` 三态，同时增加结果项级附加元数据或可追溯展示标记。
  - `7-2-code-review-evaluation-20260518-round-1.md`: 修复记录显示已新增 `manualAction: 'mcp-merge-required'`，并让 TTY / Plain / Quiet 输出消费该字段。
  - `7-2-code-review-evaluation-20260518-round-2.md`: 复核确认结果项级 `manualAction`、Reporter 输出和测试断言均已覆盖“需手动合并”语义。
- **硬性门槛**:
  - 有证据: 是
  - 可规则化: 是
  - 非纯特例: 是
  - 不重复: 是
  - 状态明确: 是
- **量化评分**:

  | 维度 | 分数 | 理由 |
  |------|------|------|
  | 复现频次 | 1 | 单 Story 中由 reviewer、evaluator、fixer、复审连续确认并闭环，具有同类输出契约复现迹象。 |
  | 影响范围 | 1 | 影响 `InstallResult.items[]`、Reporter 三种实现和脚本化输出消费语义。 |
  | 风险等级 | 1 | 可能误导用户认为安装已完全完成，或让自动化消费方把需人工合并项当作普通完成项。 |
  | 根因稳定性 | 1 | 根因是将旁路提示误当作结构化摘要状态，未来新增手动操作类安装结果时容易复现。 |
  | 可执行性 | 2 | 可检查：结果项必须携带可渲染元数据，TTY / Plain / Quiet 均有断言覆盖。 |
  | 文档缺口 | 1 | 全局文档已有“共享字段禁止语义扩展”和 `InstallResult.status` 三态规则，但未细化“warning 不能替代摘要状态”的输出契约。 |

- **总分**: 7/12
- **建议去向**: rules-summary
- **适用范围**: 安装结果摘要、Reporter 输出、需要用户后续手动操作的安装项、以及任何 AC 明确要求“摘要状态/结果项状态”的 CLI 输出场景。
- **规避指南**:
  - 禁止用 `Reporter.warn()`、`info()` 或其他旁路提示替代 AC 要求的结果摘要状态。
  - 禁止为了表达新语义而扩展 `InstallResult.items[].status` 三态；新语义应使用独立字段或可追溯元数据承载。
  - 禁止只覆盖 TTY 输出而遗漏 Plain / Quiet 等脚本化或静默模式。
- **最佳实践**:
  - 当安装项需要表达“需手动合并”“需后续操作”等附加状态时，在结果项上新增明确元数据（如 `manualAction`），再由 Reporter 统一渲染。
  - 保持基础状态字段语义稳定，使用附加字段表达非文件级成功/跳过状态。
  - 同步补充 TTY / Plain / Quiet 测试，断言用户可见文案、机器可读标记和摘要计数都能体现该附加状态。
- **全局文档建议**:
  - 不建议升格全局文档。该规则是既有 `InstallResult.status` 三态规则、跨层共享字段禁止语义扩展规则和 Reporter 输出契约在手动合并场景下的细化，当前先作为 CR 规则总结记录。
- **本次落地**:
  - Story 7-2 已通过 `manualAction: 'mcp-merge-required'` 在结果项层承载手动合并语义；Reporter TTY / Plain / Quiet 输出及相关测试已闭环。
- **同步状态**: 已写入规则总结
