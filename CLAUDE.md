# ai-forge Project — AI Agent Instructions

## Rule Document Registry 同步规则

执行 `generate-project-context` workflow 生成 `project-context.md` 后，必须确认文件包含 **Rule Document Registry** 章节。如果生成的文件缺少该章节，立即补充以下内容到文件顶部（frontmatter 之后、Technology Stack 之前）：

```markdown
## Rule Document Registry

**凡是确认/修改/新增任何规则、约定或豁免，必须同步更新以下所有文档：**

| 文档 | 职责 |
|------|------|
| `_bmad-output/project-context.md` | AI agent 主规则文件，优化为 LLM 消费 |
| `_bmad-output/planning-artifacts/architecture/04-implementation-patterns.md` | 实现模式，面向人类可读 |

> 两份文档内容互为镜像，任何一处规则变更必须同时更新另一处。
```

## 规则变更同步约束

任何 story 执行、code review、或临时决策中，凡确认/修改/新增规则边界（包括豁免、约定变更），必须在同一次操作中同步更新 Rule Document Registry 中列出的所有文档，不得遗漏。
