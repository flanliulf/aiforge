# Epic 2 Retrospective — 知识仓库获取与认证

> **Date**: 2026-03-25
> **Epic**: Epic 2 — 知识仓库获取与认证
> **Status**: ✅ Done（5/5 Stories 完成）
> **Duration**: 2026-03-23 ~ 2026-03-25（3 天）

---

## 1. Epic 交付总结

### 1.1 Story 完成情况

| Story | 名称 | 测试数 | CR 轮数 | 收敛审查模型 | 收敛评估模型 |
|-------|------|--------|---------|-------------|-------------|
| 2-1 | 配置管理服务 | 16 | 3+1 | GPT-5.4 | Claude Sonnet 4 |
| 2-2 | 知识源解析与 Git 服务封装 | 27 | 6 | GPT-5.4 | Claude Sonnet 4 |
| 2-3 | 四层认证解析链 | 21 | 3 | GPT-5.4 | Claude Opus 4.6 |
| 2-4 | Git 克隆与增量更新 | 31 | 3+1 | GPT-5.4 | Claude Opus 4.6 |
| 2-5 | aiforge init 交互式配置 | 13 | 3+1 | GPT-5.4 | Claude Sonnet 4 (Thinking) |

### 1.2 数量指标

| 指标 | 数值 |
|------|------|
| Stories 完成数 | 5/5 |
| 新增/修改源码文件 | ~10 个 |
| 新增/修改测试文件 | ~6 个 |
| 全仓测试数（Epic 结束） | 330（Epic 1 结束时 ~206） |
| Epic 2 新增测试总数 | ~108 |
| 总 CR 轮数（审查+评估） | 20 轮（3+6+3+4+4） |
| CR 修复轮数 | 5 轮（含最终收尾修复） |
| 零回归 | ✅ 全程零回归 |
| Lint/Build | ✅ 全程绿色（收口时） |

---

## 2. What Went Well 🟢

### 2.1 跨 LLM 代码审查体系有效收敛

Epic 2 全面使用了 **GPT-5.4 审查 × Claude 评估** 的跨 LLM CR 工作流，5 个 Story 全部成功收敛。关键亮点：

- **Story 2-2 展示了体系极限**：经历 6 轮 CR 才收敛，但每一轮都精准发现了真实问题（host-only URL、SCP-style 归一化后空 `repoPath`），证明多轮迭代不是浪费而是必要的深度防御
- **评估环节有效过滤了过度审查**：Story 2-1 Round 3 的"per-host auth schema validation"被评估正确识别为超出 AC 范围的 scope creep 并驳回
- **关键洞察纠正**：Story 2-2 Round 6 评估纠正了 Round 5 "SCP-style 天然安全"的错误结论，发现了归一化后置条件的盲区

### 2.2 测试质量稳步提升

- 每个 Story 均保持 **全仓零回归**
- CR 修复过程中不断补充负向测试，测试从初始实现的覆盖范围持续扩展
- Story 2-4 的 cleanup 失败场景测试（正反两条）是 CR 推动测试质量的典型案例

### 2.3 错误处理体系一致性

Epic 2 建立了完整的错误处理范式：
- 三段式错误提示（什么坏了 → 为什么 → 怎么修）贯穿所有 Story
- `AiforgeError` 的 `code`/`severity`/`exitCode` 模式在 5 个 Story 中保持一致
- Token 脱敏 (`sanitizeToken`) 在认证链和 init 中统一应用

---

## 3. What Could Be Improved 🟡

### 3.1 Story 2-2 CR 轮数过多（6 轮）

**根因分析**：Story 2-2 涉及三种 URL 协议（HTTPS / `ssh://` / SCP-style）的解析，边界条件丰富。前 3 轮集中在功能问题，后 3 轮进入"边界条件打地鼠"模式——修复一个分支的校验缺口，下一轮发现另一个分支遗漏同样的校验。

**改进建议**：
- 对涉及**多分支对称逻辑**的实现（如三种协议解析），开发阶段应主动检查各分支的校验一致性，不依赖 CR 逐一发现
- CR 评估阶段可增加**"对称性检查"**步骤：当一个分支修复了某类问题后，主动核查其他分支是否存在同类问题

### 3.2 Dev Agent Record 频繁漂移

多个 Story（2-3、2-5）在 CR 修复后 Story 文件中的测试数/全仓数/Lint 状态未同步更新，导致后续轮次反复发现"文档漂移"问题。

**根因分析**：CR 修复新增测试后，修复执行者未将 Story 记录更新视为必要步骤。

**改进建议**：
- 在 CR Fix 工作流（`bmad-enhance-03-cr-fix`）中，将"同步 Story Dev Agent Record"作为 **固定收尾步骤**而非可选项
- CR Fix 修复记录已内置此逻辑（当前版本），后续 Story 应减少此类问题

### 3.3 评估模型不一致

Epic 2 中评估模型在 Claude Sonnet 4、Claude Opus 4.6 之间切换，部分轮次还使用了 Claude Sonnet 4 (Thinking)。虽然评估质量均可靠，但模型切换增加了工作流复杂度。

**改进建议**：
- 在 Epic 级别统一指定审查/评估模型组合，减少随机切换
- 建议 Epic 3 统一使用 GPT-5.4（审查）× Claude Sonnet 4（评估）

---

## 4. Risks & Issues Identified 🔴

### 4.1 CR TODO Backlog 遗留项

**来源**：`cr-todo-backlog.md`

| TODO ID | 描述 | 优先级 | 建议时机 |
|---------|------|--------|---------|
| TODO-001 | 合并 `sanitizeTokenDisplay()` 与 `sanitizeToken()` 重复实现 | P2 | 下次触及 `src/commands/init.ts` 时 |

**说明**：`init.ts` 中的 `sanitizeTokenDisplay()` 与 `core/sanitize.ts` 中的 `sanitizeToken()` 逻辑完全一致，存在实现漂移风险。CR 多轮均提及但标记为不阻塞。Epic 3 不直接涉及 `init.ts`，预计在后续迭代中自然触发修复。

### 4.2 推迟项汇总（继承自各 Story CR）

| 推迟项 | 来源 | 建议时机 |
|--------|------|---------|
| `ResolveFn` 签名契约统一 | Story 2-2 CR Round 1-6 | Story 4.6a（管道接线） |
| `'/'` 等极端 repoPath 拦截 | Story 2-2 CR Round 6 | 后续统一 URL 校验规范 |
| per-host auth 条目 schema validation | Story 2-1 CR Round 3 | 已在 Story 2-3 自然覆盖（认证链消费时校验） |

---

## 5. Metrics & Learnings

### 5.1 CR 收敛模式分析

| 模式 | Story | 说明 |
|------|-------|------|
| 快速收敛（≤3 轮） | 2-3、2-5 | 逻辑边界清晰，AC 覆盖充分 |
| 中速收敛（3-4 轮） | 2-1、2-4 | 有 1-2 个非平凡边界条件需要迭代 |
| 慢收敛（>4 轮） | 2-2 | 多分支对称逻辑 + 归一化后置条件盲区 |

### 5.2 关键经验

1. **跨 LLM CR 的互补价值已验证**：GPT-5.4 擅长发现边界条件和规则合规问题；Claude 擅长评估问题的实际影响和 scope 合理性。两者互补形成有效的质量闭环。

2. **"天然安全"结论需要验证后置条件**：Story 2-2 的教训——当一个分支声称"天然安全"（如正则保证非空），需要额外验证后续处理（如 `stripGitSuffix()`）是否会改变该前提。

3. **best-effort cleanup 的合规策略已建立**：Story 2-4 的 `catch {}` 讨论产出了明确的项目策略——采纳立场 A（最小化合规修复），将 cleanup 失败信息暴露到错误输出中。这为后续类似场景提供了先例。

4. **Epic 级代码量与 Story 分解合理**：5 个 Story 每个独立可测、边界清晰，依赖链（2-1 → 2-2 → 2-3 → 2-4 → 2-5）顺序合理。

---

## 6. Action Items for Epic 3

| # | 行动 | 负责 | 优先级 |
|---|------|------|--------|
| 1 | CR Fix 工作流确保 Story Dev Agent Record 同步更新 | Dev Agent | 高 |
| 2 | 多分支对称逻辑实现时，主动做跨分支一致性检查 | Dev Agent | 中 |
| 3 | 统一 Epic 3 的 CR 模型组合（GPT-5.4 × Claude Sonnet 4） | SM | 低 |
| 4 | TODO-001 (`sanitizeTokenDisplay` 重复) 如触及则顺手修复 | Dev Agent | 低 |

---

## 7. Epic 2 最终状态

```
全仓测试：330/330 ✅
Lint：ESLint + Prettier ✅
Build：tsc ✅
CR TODO Backlog：1 项 open (TODO-001, P2)
推迟项：2 项（ResolveFn 契约 → 4.6a，'/' repoPath → 后续）
```

**Epic 2 正式完成。** 🎉
