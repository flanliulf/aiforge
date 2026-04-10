# 文档目录整理变化清单

> **版本区间：** v0.1.0 → v0.1.1  
> **执行日期：** 2026-04-10  
> **涉及提交：** 4 次（`9d2c868` → `659b2fd`）

---

## 一、整理目标

1. `docs/` 目录只保留 README 关联的核心用户文档，早期草稿归档到子目录
2. 所有核心文档补全中英双语版本（`.md` + `.zh.md`）
3. `_bmad-output/implementation-artifacts/` 按文件性质分类到子目录，解决根目录 72 个条目混杂的问题
4. README 双语版补充版本号规则、Issue 提交指南、AI 辅助配置等章节

---

## 二、docs/ 目录变更

### 2.1 核心文档（保留在 `docs/` 根目录）

| 文档 | 变更 | 说明 |
|------|------|------|
| `getting-started.md` | 不变 | 英文快速入门 |
| `getting-started.zh.md` | **修改** | 内部交叉链接更新为指向 `.zh.md` |
| `configuration.md` | 不变 | 英文配置参考 |
| `configuration.zh.md` | **新增** | 中文配置参考 |
| `troubleshooting.md` | 不变 | 英文故障排除 |
| `troubleshooting.zh.md` | **新增** | 中文故障排除 |
| `extending.md` | 不变 | 英文扩展指南 |
| `extending.zh.md` | **新增** | 中文扩展指南 |
| `install-rules-matrix.md` | 不变 | 英文安装规则矩阵 |
| `install-rules-matrix.zh.md` | **新增** | 中文安装规则矩阵 |

### 2.2 迁移到 `docs/references/`（21 个文件）

以下文件从 `docs/` 根目录移至 `docs/references/` 子目录：

| 文件 | 类型 |
|------|------|
| `AI Coding IDE 工具对比.md` | 工具调研 |
| `AI Coding IDE 工具概念目录对比.md` | 工具调研 |
| `AI Coding IDE 工具统一路径映射矩阵.md` | 工具调研 |
| `architec(draft).md` | 架构草稿 |
| `CLI-INTERFACE-REFERENCE.md` | CLI 参考（已被 README 替代） |
| `DISCOVERY-SUMMARY.txt` | 发现阶段总结 |
| `EXECUTIVE-SUMMARY.md` | 执行摘要 |
| `PRD(draft).md` | PRD 草稿 |
| `PRD(draft) - 两种安装方式详解.md` | PRD 补充草稿 |
| `prd-review-system-prompt.md` | PRD 审查提示词 |
| `prd_review_report_20260312_014402.md` | PRD 审查报告 |
| `creat-epic-and-story二次审核结论.md` | Story 审核 |
| `creat-epic-and-story第三次审核结论.md` | Story 审核 |
| `从 PRD 创建 Epic 及 Story 审核结论.md` | Story 审核 |
| `混沌工程报告审核总结与修订清单.md` | 混沌工程 |
| `混沌工程攻击向量 #1： 双层检测机制.md` | 混沌工程 |
| `混沌工程攻击向量 #2：文件安装机制.md` | 混沌工程 |
| `混沌工程攻击向量 #3：认证系统.md` | 混沌工程 |
| `混沌工程攻击向量 #4：语义类型系统.md` | 混沌工程 |
| `混沌工程攻击向量 #5：规则包生态系统.md` | 混沌工程 |
| `混沌工程攻击向量 #6：更新机制的安全边界.md` | 混沌工程 |

### 2.3 整理后的 `docs/` 结构

```
docs/
├── getting-started.md / .zh.md       ← 核心：快速入门
├── configuration.md / .zh.md         ← 核心：配置参考
├── troubleshooting.md / .zh.md       ← 核心：故障排除
├── extending.md / .zh.md             ← 核心：扩展指南
├── install-rules-matrix.md / .zh.md  ← 核心：安装规则矩阵
└── references/                       ← 归档：21 个早期草稿/分析文档
```

---

## 三、_bmad-output/implementation-artifacts/ 目录变更

### 3.1 整理前（72 个条目平铺）

```
implementation-artifacts/
├── 1-1-project-init-and-toolchain.md    ← Story 文件（29 个）
├── 1-2-code-review/                     ← CR 目录（28 个）
├── epic-1-retrospective-2026-03-23.md   ← 回顾文件（13 个）
├── cr-todo-backlog.md                   ← CR 规则文件
├── sprint-status.yaml                   ← Sprint 跟踪
└── ...（共 72 个条目混杂）
```

### 3.2 整理后（4 个子目录 + 1 个根文件）

```
implementation-artifacts/
├── index.md                  ← 新增：全目录内容导航索引
├── sprint-status.yaml        ← 保留根目录
├── stories/                  ← 29 个 Story 规格文件
│   ├── 1-1-project-init-and-toolchain.md
│   ├── 1-2-core-types-and-error-system.md
│   └── ... (Epic 1~5 共 29 个)
├── code-reviews/             ← 28 个 CR 目录
│   ├── 1-2-code-review/
│   ├── 1-3-code-review/
│   └── ... (每个 Story 一个目录)
├── retrospectives/           ← 13 个回顾与评审文件
│   ├── epic-1-retrospective-2026-03-23.md
│   ├── epic-1-review-summary.md
│   ├── ...
│   ├── epic-overview-2nd-summary.md
│   └── mvp-go-nogo-checklist.md
└── cr-rules/                 ← 3 个 CR 规则文件
    ├── cr-todo-backlog.md
    ├── CR_RULE_EXTRACTION_CONTEXT.md    ← 从 _bmad-output/ 根目录迁入
    └── QUICK_REFERENCE_CR_RULES.md      ← 从 _bmad-output/ 根目录迁入
```

### 3.3 文件来源追溯

| 子目录 | 文件数 | 来源 | 说明 |
|--------|:------:|------|------|
| `stories/` | 29 | 原 `implementation-artifacts/` 根目录 | Story 规格文件（`x-x-*.md`） |
| `code-reviews/` | 28 目录 | 原 `implementation-artifacts/` 根目录 | CR 目录（`x-x-code-review/`） |
| `retrospectives/` | 13 | 原 `implementation-artifacts/` 根目录 | Epic 回顾 + review-summary + mvp 门禁 |
| `cr-rules/` | 1+2 | 1 个原根目录 + 2 个原 `_bmad-output/` 根目录 | CR 工作流文档 |

---

## 四、README 变更

### 4.1 新增章节（README.md + README.zh.md 同步）

| 章节 | 位置 | 说明 |
|------|------|------|
| 版本号规则 | Documentation 之后 | 语义化版本 0.x 阶段规则表 |
| AI 辅助配置 | 版本号规则之后 | 三类可复制提示词（首次配置/项目安装/排查问题） |
| 提交 Issue | AI 辅助配置之后 | 提交指南 + Issue 模板代码块 + AI 辅助撰写提示词 |

### 4.2 链接修正

| 文件 | 变更 |
|------|------|
| `README.zh.md` | 文档链接全部从 `.md` 改为 `.zh.md` |
| `docs/getting-started.zh.md` | 内部交叉链接从 `.md` 改为 `.zh.md` |

---

## 五、提交记录

| 序号 | Hash | Commit Message |
|:----:|------|----------------|
| 1 | `9d2c868` | `docs: 迁移早期草稿和分析文档到 docs/references/ 子目录` |
| 2 | `4ee2ed2` | `docs: 补全中文文档并增加版本号规则和 Issue 提交指南` |
| 3 | `108ce8c` | `docs(readme): 增加 AI 辅助配置章节（含三类场景提示词）` |
| 4 | `659b2fd` | `chore(bmad-output): 整理 implementation-artifacts 目录结构并新增索引` |

**Tag：** `v0.1.1` → `659b2fd`

---

## 六、文档归属规则

新增或移动文档时，按以下规则判断归属目录。

### docs/

面向**最终用户**的产品文档。

| 目录 | 放什么 | 不放什么 |
|------|--------|----------|
| `docs/` 根目录 | README 直接链接的核心文档（双语 `.md` + `.zh.md`） | 任何不被 README 引用的文件 |
| `docs/references/` | 早期草稿、调研报告、审核结论等已归档的过程性文档 | 仍在迭代中的活跃文档 |

**判断方法：** README 的「文档」章节是否链接了它？是 → `docs/` 根目录；否 → `docs/references/`。

### _bmad-output/

BMad 框架在各阶段产生的**过程与工件文档**。

| 目录 | 放什么 | 对应 BMad 阶段 |
|------|--------|----------------|
| `analysis/` | 头脑风暴、市场调研、混沌工程等前置分析 | 1-analysis |
| `planning-artifacts/` | PRD、架构设计、Epic/Story 规划 | 2-plan + 3-solutioning |
| `archive/` | 已归档的早期架构/Epic 快照 | 跨阶段归档 |
| `implementation-artifacts/` | 开发实施阶段全部产物 | 4-implementation |
| 根目录 `project-context.md` | AI Agent 主规则文件 | 跨阶段（持续更新） |

### _bmad-output/implementation-artifacts/

开发实施产物按**文件性质**分为四个子目录：

| 子目录 | 放什么 | 命名规则 |
|--------|--------|----------|
| `stories/` | Story 规格文件 | `{epic}-{story}-{name}.md`（如 `1-1-project-init-and-toolchain.md`） |
| `code-reviews/` | 跨 LLM Code Review 各轮次记录 | `{epic}-{story}-code-review/` 目录，内含 `summary` 和 `evaluation` 文件 |
| `retrospectives/` | Epic 回顾、Story 审查总结、发布门禁 | `epic-{n}-retrospective-*.md`、`epic-{n}-review-summary.md`、`mvp-go-nogo-checklist.md` |
| `cr-rules/` | CR 工作流的规则提炼、TODO 追踪等元文档 | 不限定命名 |
| 根目录 | 跨子目录的全局跟踪文件 | `sprint-status.yaml`、`index.md` |

**判断方法：**
1. 它是某个 Story 的规格定义？→ `stories/`
2. 它是某次 Code Review 的 summary 或 evaluation？→ `code-reviews/{story}/`
3. 它是 Epic 级别的回顾、审查总结或发布门禁？→ `retrospectives/`
4. 它是 CR 流程本身的工具/规则/追踪文档？→ `cr-rules/`
5. 它是跨所有子目录的全局状态文件？→ 根目录
