# Epic 7 技术调研后推进进度追踪

> 本文档记录 Epic 7（AI IDE 工具覆盖扩展）在技术调研完成后的分阶段推进计划与进度状态。
> 调研产物：`_bmad-output/planning-artifacts/research/technical-ai-ide-tools-coverage-research-2026-04-20.md`

---

## 📋 最终决策表速览（Step 6 核心产出）

| 维度 | 最终结论 |
|------|----------|
| 工具清单 | 11 个（copilot · claude · cursor · codex · auggie · gemini · opencode · windsurf · kiro · antigravity · trae） |
| 规则矩阵 | MVP 16 条 → Epic 7 完成后 ~54 条（+38/-1/5 微调） |
| InstallType 变更 | 不新增（Files/Directories/Flatten 够用；MCP 配置文件采用"模板 + 手动合并"降级） |
| Story 拆分 | 10 个 Story（7-1 归并 → 7-2 Codex → 7-3 Auggie → 7-4 Gemini → 7-5 OpenCode → 7-6 Windsurf → 7-7 Kiro → 7-8 Antigravity → 7-9 Trae → 7-10 收尾） |
| PRD 变更 | 约 12-15 条 FR 新增/修订（见研究文档 §6.5） |
| Breaking Change | VS Code 归并（Story 7-1）—— 需 migration note |
| 路径修正 | Windsurf `~/.codeium/windsurf/`（非 `~/Library/...`） · OpenCode `~/.config/opencode/`（非 `~/.opencode/`） |
| 版本修正 | Gemini CLI Skills 稳定版需 v0.26.0+（非 v0.24.0） |
| 未解决 Open Issues | 6 项（见研究文档 §6.6）— 下放到具体 Story 解决 |

---

## 🎯 下一步推荐执行顺序

```
当前
  ├─ Story 6-4 CR 流程（独立推进，PM 不介入）
  └─ [你在这里] ✅ 技术调研完成

接下来（建议每步新开 context window）
```

### 步骤 1：`bmad-edit-prd`
- **输入**：研究文档 §6.5（PRD 变更范围建议）
- **产出**：更新后的 PRD（46+ → 58+26 条 FR+NFR，v2.0.0-draft）
- **状态**：✅ 已完成（2026-04-21）
- **产物**：`prd.md`（v2.0.0-draft，FR-047~058 新增，NFR-P6/I5/C7 新增）
- **验证**：`prd-validation-report-2026-04-21.md`（Overall: Pass，4.5/5，V-01~V-13 全通过）

### 步骤 2：`bmad-create-architecture`（可选）
- **触发条件**：仅当确定采用 MCP 配置降级策略时
- **产出**：更新 `_bmad-output/planning-artifacts/architecture/03-core-decisions.md`
- **状态**：⏳ 待评估

### 步骤 3：`bmad-create-epics-and-stories`
- **输入**：研究文档 §6.4（Story Backlog）
- **产出**：`epic-7.md` + 10 个 Story 规格
- **状态**：⏳ 待执行

### 步骤 4：`bmad-check-implementation-readiness`
- **目的**：确保 PRD / 架构 / Epic 对齐
- **状态**：⏳ 待执行

### 步骤 5：`bmad-sprint-planning`
- **产出**：更新 `sprint-status.yaml`
- **状态**：⏳ 待执行

### 步骤 6：`bmad-create-story` + `bmad-dev-story`
- **起始 Story**：Story 7-1 首发（VS Code 归并，Breaking Change 需谨慎）
- **状态**：⏳ 待执行

---

## 💡 John 给出的告诫（Story 7-1 Breaking Change 风险）🔍

Story 7-1 是 Breaking Change，会影响已经 `npm install -g @xxx/aiforge` 并配置过的用户。**强烈建议** Story 7-1 至少包含：

1. 一轮 `bmad-correct-course` 风格的风险评审（是否真的值得破坏性归并？）
2. 主版本号变更（v1.x → v2.0）或至少明确的 deprecation warning 一个版本
3. CHANGELOG + migration guide 作为 AC 硬门禁

**落地要求**：这些决策应该在 `bmad-edit-prd` 阶段明确下来，不要等到 Dev 阶段再补。

---

## 📅 进度日志

| 日期 | 事件 | 负责 | 产物 |
|------|------|------|------|
| 2026-04-20 | 技术调研完成（Step 6） | PM（John） | research/technical-ai-ide-tools-coverage-research-2026-04-20.md |
| 2026-04-21 | 创建 Epic 7 进度追踪文档 | PM | 本文件 |
| 2026-04-21 | 触发 `bmad-edit-prd`（步骤 1） | PM | `prd.md` v2.0.0-draft（FR-047~058，NFR-P6/I5/C7）|
| 2026-04-21 | 触发 `bmad-validate-prd`（步骤 1 验证） | PM | `prd-validation-report-2026-04-21.md`（Pass，4.5/5）|
