# Epic 4 Retrospective — 安装执行与冲突保护

> **Date**: 2026-03-31
> **Epic**: Epic 4 — 安装执行与冲突保护
> **Status**: ✅ Done（7/7 Stories 完成）
> **Duration**: 2026-03-25 ~ 2026-03-31（7 天完成全部 7 个 Story 及 CR）

---

## 1. Epic 交付总结

### 1.1 Story 完成情况

| Story | 名称 | 新增测试 | CR 轮数 | 关键修复 |
|-------|------|---------|---------|---------|
| 4-1 | 文件操作工具与预检查 | 39 | 5 轮（审查+评估） | P0 symlink 逃逸安全漏洞修复（4 轮迭代） |
| 4-2 | 复制模式安装执行 | 15 | 6 轮（审查+评估） | InstallResult 结构对齐架构文档 |
| 4-3 | 符号链接与 flatten 模式 | 13 | 2 轮（审查+评估） | flatten mainFile 规则 + symlink 断链检测 |
| 4-4 | manifest 状态管理与冲突检测 | 19 | 3 轮（审查+评估） | 6 种冲突类型判定 + 原子写入 |
| 4-5 | 冲突处理与安全保护 | 23 | 3 轮（审查+评估） | 交互式冲突解决 + 零结果诊断 + 临时文件清理 |
| 4-6a | 管道完整编排与错误流控制 | 18 | 3 轮（审查+评估） | 占位函数全部替换 + saveManifest pipeline 收尾 |
| 4-6b | 安装结果汇总与输出流分工 | 27 | 6 轮（审查+评估） | InstallResult.items 补 tool 字段 + sourcePath repo-relative 转换 |

### 1.2 数量指标

| 指标 | 数值 |
|------|------|
| Stories 完成数 | 7/7 |
| 新增源码文件 | 4 个（fs-utils.ts, execute-install.ts, manifest.ts, conflict-resolver.ts） |
| 修改源码文件 | 5 个（pipeline.ts, index.ts, types.ts, reporter.ts, execute-install.ts） |
| 新增测试文件 | 5 个（fs-utils.test.ts, execute-install.test.ts, manifest.test.ts, conflict-resolver.test.ts, pipeline.test.ts） |
| 全仓测试数（Epic 结束） | 576（Epic 3 结束时 401） |
| Epic 4 新增测试总数 | 171（实际从 401 → 576，含 CR 修复新增） |
| 总 CR 轮数（审查+评估） | 约 28 轮 |
| 零回归 | ✅ 全程零回归 |
| Lint/Build | ✅ 全程绿色 |

---

## 2. What Went Well

### 2.1 Epic 3 回顾行动项高执行率

Epic 3 回顾中提出的 6 项行动建议在 Epic 4 中执行率达 83%：

| 行动项 | 兑现情况 |
|--------|---------|
| Story 完成自检用 `npm run lint`（含 Prettier） | ✅ 7 个 Story 均记录 Lint 通过 |
| 统一 CR 模型 GPT-5.4 × Claude Sonnet 4 | ⚠️ 基本兑现（4.6b 使用 claude-sonnet-4.6 小版本偏差） |
| Dev Notes 为跨 Epic 依赖添加明确标注 | ✅ 每个 Story 均有"本 Story 不做的事"章节 |
| TODO-004 → Story 4.3 完成后回补 flatten 路径精度 | ✅ Story 4.3 完整实现 |
| TODO-003 → pipeline 组装时接线 createProductionStages | ✅ Story 4.6a 完成 |
| TODO-001 → 触及 init.ts 时修复 | ⏸️ Epic 4 未触及 init.ts |

### 2.2 CR TODO Backlog 高效清理

- **TODO-003**（CLI 接线）在 Story 4.6a 中按预期时机解决
- **TODO-004**（flatten 路径精度）在 Story 4.3 中按预期时机解决
- Backlog 从 3 项 open 降至 1 项 open（TODO-001 P2）

### 2.3 架构占位债务彻底清零

`DEFAULT_STAGES` 占位设计从 Epic 1 保留至今，Epic 4 Story 4.6a 将全部 6 个占位阶段替换为真实 import，`createProductionStages()` 工厂函数完整接线。管道从"骨架"变为"可运行产品"。

### 2.4 安全防护深度验证

Story 4.1 的 symlink 逃逸漏洞经 5 轮 CR 迭代修复，最终实现了 `validateAncestorRealpath()` 的分支完备覆盖：
- Round 2: 基本 realpath 校验
- Round 3: `findExistingAncestor` 路径覆盖
- Round 4: `isSymbolicLink()` + `isDirectory()` 分支覆盖
- Round 5: 最终评估通过

这一过程验证了跨 LLM CR 在安全领域的深度发现能力。

### 2.5 管道端到端可运行

Epic 4 结束后，`aiforge` CLI 可完整执行：
```
Resolve → Auth → Clone → Detect → Match → Install → SaveManifest → Report
```
dry-run 预览和真实安装均已跑通。

---

## 3. What Could Be Improved

### 3.1 Story 4.1 安全修复迭代轮数过多（5 轮）

symlink 逃逸漏洞虽然最终修复彻底，但经历了 5 轮 CR 才完全封堵。根因是每轮只修报告的那一个分支点，未做分支完备性分析。

**改进建议**：
- 安全相关代码修复时，必须执行**分支完备性分析**——列出所有 if/else/switch 路径，逐一确认每个路径是否存在同类漏洞
- 不能只修 CR 报告的那一个点

### 3.2 Story 4.2 和 4.6b CR 轮数偏高（各 6 轮）

Story 4.2 的 6 轮主要因为 `InstallResult` 结构与架构文档不一致（Dev Notes vs project-context.md 的差异）。
Story 4.6b 的 6 轮主要因为 `InstallResult.items` 缺少 `tool` 字段，以及 `sourcePath` 的 repo-relative 转换时机问题。

**改进建议**：
- 开发前先核对 `core/types.ts` 中的类型定义是否已包含所需字段，避免开发中途发现需要补字段导致全仓级联修改
- `sourcePath` 等路径的 "绝对 vs 相对" 语义应在架构文档中明确约定

### 3.3 CR 模型版本仍有小偏差

虽然 Epic 3 回顾建议统一模型，但 Epic 4 中 Story 4.6b 评估使用了 claude-sonnet-4.6（版本迭代导致）。

**改进建议**：
- 不再锁定模型小版本号，改为约定"当前可用最新 Sonnet"即可

---

## 4. Risks & Issues Identified

### 4.1 CR TODO Backlog 遗留项

| TODO ID | 描述 | 优先级 | 建议时机 |
|---------|------|--------|---------|
| TODO-001 | 合并 `sanitizeTokenDisplay()` 与 `sanitizeToken()` | P2 | Epic 5 Story 5.5a 触及 init.ts 时 |

**说明**：仅剩 1 个 open 项，为纯重构类 P2，无功能风险。Epic 5 Story 5.5a（i18n 语言选择）预期会修改 `init.ts`，届时自然触发。

### 4.2 spinner 残留问题

dry-run 模式下，克隆阶段的 spinner 在安装计划输出后仍残留在终端。属于显示问题，不影响功能。应在 Epic 5 Story 5.1（spinner 动画）中解决。

---

## 5. Metrics & Learnings

### 5.1 CR 收敛模式分析

| 模式 | Story | CR 轮数 | 说明 |
|------|-------|---------|------|
| 快速收敛（2-3 轮） | 4-3, 4-4, 4-5, 4-6a | 2-3 | 职责清晰，边界明确 |
| 中等收敛（5 轮） | 4-1 | 5 | 安全修复需分支完备性迭代 |
| 较慢收敛（6 轮） | 4-2, 4-6b | 6 | 类型定义不完整导致级联修改 |

**对比 Epic 3**：Epic 3 全部 2 轮收敛（平均 2.0），Epic 4 平均约 4.0 轮。轮数上升的主要原因是 Epic 4 Story 复杂度显著高于 Epic 3（安全防护 + 管道编排 + 类型补全），并非效率退化。

### 5.2 测试增长

| Epic | 起始测试数 | 结束测试数 | 新增 | 增长率 |
|------|-----------|-----------|------|--------|
| Epic 1 | 0 | 168 | 168 | — |
| Epic 2 | 168 | 330 | 162 | 96% |
| Epic 3 | 330 | 401 | 71 | 21% |
| Epic 4 | 401 | 576 | 171 | 43% |

Epic 4 新增 171 个测试，是 Epic 3（71 个）的 2.4 倍，反映了安装执行层的复杂度。

### 5.3 关键经验

1. **安全修复必须做分支完备性分析**：Story 4.1 的 symlink 逃逸经历 4 轮才封堵所有路径。教训：每次安全修复后，列出该函数所有分支，逐一确认是否存在同类漏洞。

2. **类型定义先行**：Story 4.6b 发现 `InstallResult.items` 缺少 `tool` 字段，导致全仓 `resultItems.push()` 调用都需要补充。教训：开发 Story 前先核对 `core/types.ts` 的类型定义是否完整。

3. **`core/` 不得引用 `data/` 是有效的架构边界**：Story 4.6b 的 Dev Notes 建议 import `data/messages.ts`，但 project-context.md 禁止此依赖方向。开发者正确选择了内联常量。说明架构边界规则在实际开发中发挥了防腐作用。

4. **`createProductionStages()` 闭包+共享变量模式验证成功**：通过 `lastRepo`/`lastPlan` 共享变量在闭包间传递数据，避免了修改 `InstallResult` 类型。该模式在 Epic 3 提出，Epic 4 中大规模使用并验证稳定。

5. **"本 Story 不做的事" 章节持续发挥降级作用**：多个 CR 审查发现被引用该章节后降级为非阻塞，有效控制了 scope creep。

---

## 6. 遗留项跟进总览

### 6.1 Epic 3 → Epic 4 遗留项清理

| 类别 | 总数 | 已清理 | 仍 Open | 清理率 |
|------|------|--------|---------|-------|
| CR TODO Backlog | 3 | 2 | 1 (TODO-001) | 67% |
| 推迟项 | 2 | 2 | 0 | 100% |
| 行动建议 | 6 | 4 完成 + 1 基本兑现 | 1 延续 | 83% |
| 架构占位债务 | 1 | 1 | 0 | 100% |
| **总计** | **12** | **10** | **1** | **92%** |

### 6.2 进入 Epic 5 的遗留项

| 项目 | 类型 | 优先级 | 触发时机 |
|------|------|--------|---------|
| TODO-001: 合并 sanitizeTokenDisplay/sanitizeToken | 纯重构 | P2 | Story 5.5a 触及 init.ts 时 |

---

## 7. Action Items for Epic 5

| # | 行动 | 负责 | 优先级 |
|---|------|------|--------|
| 1 | TODO-001 在 Story 5.5a 触及 init.ts 时修复 | Dev Agent | P2 |
| 2 | 安全相关代码 CR 需执行分支完备性分析（覆盖所有 if/else 路径） | Dev Agent + CR 审查者 | 高 |
| 3 | CR 模型不再锁定小版本号，统一约定为"当前可用最新 Sonnet" | SM | 中 |
| 4 | Story 4.1 的 symlink 安全防护模式（validateAncestorRealpath）记录为安全最佳实践 | Dev Agent | 中 |
| 5 | 开发前先核对 core/types.ts 类型定义完整性，避免开发中途补字段 | Dev Agent | 中 |

---

## 8. Epic 4 最终状态

```
全仓测试：576/576 ✅
Lint：ESLint + Prettier ✅
Build：tsup ✅
CR TODO Backlog：1 项 open (TODO-001 P2), 2 项 resolved (TODO-003, TODO-004)
推迟项：0 项（全部清零）
管道状态：端到端可运行（dry-run + 真实安装均已验证）
遗留项清理率：92%（12 项中清理 10 项）
```

**Epic 4 正式完成。** 🎉
