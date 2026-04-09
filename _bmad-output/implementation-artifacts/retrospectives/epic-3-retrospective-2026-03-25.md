# Epic 3 Retrospective — 智能检测与安装规划

> **Date**: 2026-03-25
> **Epic**: Epic 3 — 智能检测与安装规划
> **Status**: ✅ Done（3/3 Stories 完成）
> **Duration**: 2026-03-25（1 天内完成全部 3 个 Story 及 CR）

---

## 1. Epic 交付总结

### 1.1 Story 完成情况

| Story | 名称 | 新增测试 | CR 轮数 | 审查模型 | 评估模型 |
|-------|------|---------|---------|----------|----------|
| 3-1 | AI 工具自动检测 | 16 | 2+2 | GPT-5.4 | Claude Opus 4.6 |
| 3-2 | 规则匹配引擎 | 20 | 2+2 | GPT-5.4 | Claude Sonnet 4 |
| 3-3 | dry-run 预览与安装计划 | 35 | 2+2 | GPT-5.4 | Claude Sonnet 4 |

### 1.2 数量指标

| 指标 | 数值 |
|------|------|
| Stories 完成数 | 3/3 |
| 新增源码文件 | 3 个（detect-tools.ts, match-rules.ts, reporter 扩展） |
| 修改源码文件 | 5 个（pipeline.ts, types.ts, reporter.ts, messages.ts, match-rules.ts） |
| 新增测试文件 | 4 个（detect-tools.test.ts, match-rules.test.ts, report.test.ts, dry-run.test.ts） |
| 全仓测试数（Epic 结束） | 401（Epic 2 结束时 330） |
| Epic 3 新增测试总数 | 71 |
| 总 CR 轮数（审查+评估） | 12 轮（3 Stories × 2 审查 + 2 评估 各轮） |
| CR 修复轮数 | 3 轮（3-1: 1, 3-2: 1, 3-3: 1） |
| 零回归 | ✅ 全程零回归 |
| Lint/Build | ✅ 全程绿色（收口时） |

---

## 2. What Went Well 🟢

### 2.1 Epic 2 Retrospective 行动项全部兑现

Epic 2 回顾中提出的 4 项行动建议在 Epic 3 中均得到落实：

| 行动项 | 兑现情况 |
|--------|---------|
| CR Fix 确保 Story Dev Agent Record 同步更新 | ✅ Story 3-3 修复后记录已同步更新 |
| 多分支对称逻辑主动做跨分支一致性检查 | ✅ detect-tools 四工具路径对称性在开发阶段即保证 |
| 统一 Epic 3 CR 模型组合 | ✅ 全部使用 GPT-5.4（审查）× Claude（评估） |
| TODO-001 如触及则顺手修复 | ⏸️ Epic 3 未触及 init.ts，保持 open |

### 2.2 CR 收敛效率显著提升

3 个 Story 全部在 **2 轮审查** 内收敛（对比 Epic 2 的 2-2 花了 6 轮），平均 CR 效率提升约 50%。关键因素：

- **Story 职责边界更清晰**：每个 Story 聚焦单一管道阶段（detect / match / report），逻辑分支少于 Epic 2 的 URL 解析
- **测试前置意识更强**：3 个 Story 均在首轮提交时就达到较高测试覆盖率，CR 修复主要集中在边界精度（如 targetPath 粒度）而非功能缺失
- **评估环节持续发挥降级作用**：Story 3-1 将"函数签名不匹配"降级为 TODO；Story 3-3 将"CLI 未接线"和"flatten 路径精度"均降级为非阻塞，避免了不必要的返工

### 2.3 TODO 追踪体系闭环运作

- **TODO-002**（detectTools 签名适配）在 Story 3-3 中被自然解决——`createProductionStages()` 闭包方案完美适配了签名差异
- 新增 **TODO-003**（CLI 接线，Epic 2 时机）和 **TODO-004**（flatten 路径精度，Epic 4.3 时机），延迟项追踪清晰有序
- `cr-todo-backlog.md` 的 check / resolve / add 工作流在本 Epic 中首次完整跑通

### 2.4 管道架构的可注入设计验证成功

`pipeline.ts` 的 `PipelineStages` 依赖注入设计在 Epic 3 中得到充分验证：

- `createProductionStages(pathResolver)` 工厂函数通过闭包优雅适配了 3 种函数签名差异（detect/match 各多 1 个参数，match 还需要 clone 输出的 repo）
- 测试中可以注入 mock stages，无需依赖真实前序阶段，测试独立性优秀
- `DEFAULT_STAGES`（占位）与 `createProductionStages`（生产）的并存设计，允许阶段逐步替换而不破坏已有功能

---

## 3. What Could Be Improved 🟡

### 3.1 Prettier 格式检查在开发阶段被遗漏

Story 3-3 的 Dev Agent Record 声称 "Lint: ESLint 零错误零警告 ✅"，但实际 `npm run lint` 包含 Prettier 检查，两个文件格式不通过。CR 才发现此问题。

**根因分析**：开发阶段只运行了 ESLint，未执行完整的 `npm run lint`（ESLint + Prettier）。

**改进建议**：
- 在 Story 完成自检中，明确要求运行 **`npm run lint`** 而非仅 ESLint
- 可考虑在 pre-commit hook 中加入 Prettier 检查（如尚未配置）

### 3.2 评估模型切换仍存在

虽然 Epic 2 回顾建议统一模型组合，但 Epic 3 中 Story 3-1 的评估使用了 Claude Opus 4.6，而 Story 3-2/3-3 使用了 Claude Sonnet 4。虽然两者评估质量均可靠，但一致性仍有改善空间。

**改进建议**：
- Epic 4 建议全程统一为 **GPT-5.4（审查）× Claude Sonnet 4（评估）**
- 仅在遇到评估质量问题时才升级到 Opus

### 3.3 flatten 语义的跨 Story 边界可更早明确

Story 3-3 CR Round 2 中 GPT-5.4 指出 flatten 目标路径不精确（`code-review` 而非 `code-review.md`），评估后降级为 Epic 4.3 的职责。但理想情况下，Story 3-3 的 Dev Notes 可以更早标注"flatten 目标路径精度依赖 Epic 4.3 的 mainFile 规则"，避免 CR 审查者对此产生阻塞判定。

**改进建议**：
- 在 Story Dev Notes 中为已知的跨 Epic 依赖添加明确标注（如 "⚠️ 本 Story 输出精度受限于 XXX，完整精度需 Story Y.Z 实现后回补"）

---

## 4. Risks & Issues Identified 🔴

### 4.1 CR TODO Backlog 遗留项

**来源**：`cr-todo-backlog.md`

| TODO ID | 描述 | 优先级 | 建议时机 |
|---------|------|--------|---------|
| TODO-001 | 合并 `sanitizeTokenDisplay()` 与 `sanitizeToken()` | P2 | 下次触及 `init.ts` 时 |
| TODO-003 | CLI 入口接线 `createProductionStages()` | P2 | Epic 2 resolve/auth/clone 真实阶段时 |
| TODO-004 | flatten 目标路径精度回补 | P2 | Epic 4 Story 4.3 完成后 |

**说明**：3 个 open 项均为 P2，无紧急风险。TODO-003 和 TODO-004 有明确的触发时机，不会遗漏。

### 4.2 推迟项汇总

| 推迟项 | 来源 | 建议时机 |
|--------|------|---------|
| CLI → `createProductionStages` 接线 | Story 3-3 CR eval round 1 | Epic 2 真实阶段完成后（注：Epic 2 代码已 done，此处指 pipeline 最终组装） |
| flatten dry-run 路径精度 | Story 3-3 CR eval round 2 | Story 4.3 实现 flatten 安装后 |

---

## 5. Metrics & Learnings

### 5.1 CR 收敛模式分析

| 模式 | Story | 说明 |
|------|-------|------|
| 快速收敛（2 轮） | 3-1、3-2、3-3 | 全部 Story 均 2 轮收敛 |

**对比 Epic 2**：Epic 2 最慢 6 轮（Story 2-2），平均 3.6 轮；Epic 3 全部 2 轮，平均 2.0 轮。**效率提升 44%。**

### 5.2 关键经验

1. **依赖注入+闭包是管道阶段组装的最佳实践**：`createProductionStages(pathResolver)` 通过闭包注入额外依赖，既不破坏类型签名又不牺牲可测试性。后续 Epic 2 真实阶段接入时应延续此模式。

2. **"Story 不做的事" 章节是 CR 降级的重要依据**：Story 3-3 的两条降级判定均引用了该章节。此章节在避免 scope creep 和减少不必要返工方面价值显著。

3. **评估环节的"降级"能力是 CR 效率的关键杠杆**：Epic 3 中 3 个 Story 的 6 条审查发现中，有 3 条被评估降级为非阻塞（命中率 50%），显著减少了修复工作量同时不损失代码质量。

4. **全仓从 330 → 401 测试的扩展路径健康**：71 个新测试分布在 4 个测试文件中，覆盖 detect/match/report/dry-run 四个维度，测试粒度均匀，无巨型测试文件。

---

## 6. Action Items for Epic 4

| # | 行动 | 负责 | 优先级 |
|---|------|------|--------|
| 1 | Story 完成自检使用 `npm run lint`（含 Prettier），不遗漏格式检查 | Dev Agent | 高 |
| 2 | 统一 Epic 4 CR 模型：GPT-5.4（审查）× Claude Sonnet 4（评估） | SM | 中 |
| 3 | Story Dev Notes 为跨 Epic 依赖添加明确标注，减少 CR 误判 | Dev Agent | 中 |
| 4 | TODO-004 在 Story 4.3 完成后立即回补 flatten 路径精度 | Dev Agent | 中 |
| 5 | TODO-003 在 pipeline 最终组装时接线 `createProductionStages` | Dev Agent | 低 |
| 6 | TODO-001 如触及 `init.ts` 则顺手修复 | Dev Agent | 低 |

---

## 7. Epic 3 最终状态

```
全仓测试：401/401 ✅
Lint：ESLint + Prettier ✅
Build：tsc ✅
CR TODO Backlog：3 项 open (TODO-001 P2, TODO-003 P2, TODO-004 P2), 1 项 resolved (TODO-002)
推迟项：2 项（CLI 接线 → pipeline 组装，flatten 路径 → Story 4.3）
CR 效率：全部 2 轮收敛，对比 Epic 2 提升 44%
```

**Epic 3 正式完成。** 🎉
