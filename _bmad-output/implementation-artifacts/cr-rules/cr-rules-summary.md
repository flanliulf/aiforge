# CR Rules Summary

用于沉淀跨 Story 可复用的 CR 规则提炼结果，记录规则来源、量化升格判定、适用范围、落地位置与同步状态。

---

## 规则索引

| 规则编号 | 标题 | 来源 Story | 总分 | 建议去向 | 同步状态 |
|----------|------|------------|------|----------|----------|
| CR-PROCESS-01 | 规则数量验收口径必须绑定已批准基线与本 Story 明确新增范围 | 7-3, 7-5 | 8/12 | global-doc | 已同步全局文档 |
| CR-PROCESS-02 | 交互式确认中断必须统一转换为管道取消信号 | 7-6 | 8/12 | global-doc | 已同步全局文档 |
| CR-TEST-01 | 新增工具安装规则必须用端到端测试锁定真实落盘路径 | 7-3 | 7/12 | rules-summary | 已写入规则总结 |

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
