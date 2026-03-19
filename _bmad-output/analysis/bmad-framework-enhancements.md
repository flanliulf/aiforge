# BMad 框架改动讨论与研发流程增强记录

_本文档记录对 bmad 框架的改动决策、讨论过程，以及项目层面的研发流程增强措施。_
_更新时间：2026-03-19_

---

## 一、改动原则

| 类型 | 原则 |
|------|------|
| bmad workflow 定义（yaml/xml） | **不改动** — 影响框架升级兼容性，且 workflow 逻辑变更风险高 |
| bmad 模板文件（*.md 模板） | **可改动** — 模板是内容骨架，改动不影响框架逻辑；升级时需人工合并 |
| 项目层 hooks / CLAUDE.md | **推荐** — 完全在项目控制范围内，不依赖框架 |

---

## 二、已实施改动

### 2.1 generate-project-context 模板增加 Rule Document Registry 章节

- **文件：** `_bmad/bmm/workflows/generate-project-context/project-context-template.md`
- **备份：** `project-context-template.md.bak`
- **改动内容：** 在模板 frontmatter 之后、Technology Stack 之前插入 Rule Document Registry 章节
- **原因：** bmad 原始模板不含该章节，每次 generate-project-context 生成的文件缺少规则文档同步索引，导致 AI 不知道需要同步哪些文档
- **决策过程：**
  - 备选方案 A：加 PostToolUse hook 在文件生成后提示补充 → 被动，依赖 AI 响应
  - 备选方案 B：改模板 → 主动预置，一次性解决，零维护成本
  - **选择 B**，同时配合 CLAUDE.md 规则作为双重保障
- **升级注意：** bmad 框架升级时，需手动将 Rule Document Registry 章节合并回新模板

---

## 三、已实施研发流程增强

### 3.1 规则文档同步 Hook（PostToolUse）

- **文件：** `.claude/hooks/rule-sync-check.sh`
- **注册：** `.claude/settings.json`
- **触发场景与行为：**

| 场景 | 触发条件 | 行为 |
|------|---------|------|
| Hook 1 | 修改规则文档（`project-context.md` / `architecture/04-implementation-patterns.md`） | **阻断（exit 2）**，提示检查其他规则文档是否同步 |
| Hook 2 | 修改任意业务文件，写入内容含规则决策关键词（豁免/规则边界/override 等） | **阻断（exit 2）**，提示是否需要同步到规则文档 |
| Hook 3 | 修改 story 文件（`_bmad-output/implementation-artifacts/[0-9]*.md`），写入含 CR 特征（`[AI-Review]`/`Senior Developer Review`） | **非阻断（exit 0）**，仅提示检查 |

- **排除路径（Hook 2 白名单机制）：**
  - Hook 2 仅对 `src/` 和 `tests/` 下的业务代码文件触发
  - 文档类文件（`_bmad-output/`、`CLAUDE.md`、`_bmad/`、`.claude/`）均不触发，避免描述性文字误报

- **设计决策：**
  - Hook 3 改为非阻断的原因：story 文件的 CR 内容不一定每次都含规则决策，强制阻断噪音过大
  - Hook 1/2 保持阻断：规则文档修改和规则决策写入是高确定性场景，必须强制处理

### 3.2 CLAUDE.md 规则约束

- **文件：** `CLAUDE.md`（项目根目录）
- **内容：**
  1. 执行 `generate-project-context` 后必须确认 Rule Document Registry 章节存在，缺失时立即补充
  2. 任何规则边界变更必须在同一次操作中同步所有 Rule Document Registry 文档

---

## 四、待讨论 / 未决事项

### 4.1 bmad workflow 定义是否需要增强

**背景：** Story 1.1 实施过程中发现，dev-story workflow 的 Step 9（story 完成）没有显式要求检查规则文档同步。

**讨论结论：**
- 在 workflow Step 9 加规则 → **否决**，破坏原生 bmad 框架定义，升级不友好
- 在 project-context.md 末尾加规则 → **否决**，不能保证 AI 在 story 执行中必然读取该文档
- **最终方案：** 通过 PostToolUse hook（Hook 2/3）在写入时触发，不依赖 AI 主动记忆

### 4.2 Rule Document Registry 的维护边界

**当前状态：** Registry 同时存在于：
1. `project-context.md`（已有）
2. `_bmad/bmm/workflows/generate-project-context/project-context-template.md`（已加入模板）
3. `CLAUDE.md`（规则约束）

**待确认：** 如果项目架构文档发生重组（如 `04-implementation-patterns.md` 路径变更），需同步更新：
- `project-context.md` 中的 Registry 表格
- `rule-sync-check.sh` 中的 `RULE_DOCS` 数组
- `CLAUDE.md` 中的文档路径引用

### 4.3 Hook 关键词列表的维护

**当前关键词（Hook 2）：** `豁免` `规则边界` `已确认豁免` `exemption` `override` `规则变更` `约定变更` `仅约束`

**潜在问题：** 关键词可能随项目演进出现漏报（新的表达方式）或误报（业务代码中的正常词汇）。建议在每次出现误报/漏报时更新 `rule-sync-check.sh` 中的 `RULE_KEYWORDS` 数组。

---

## 五、变更日志

| 日期 | 变更内容 | 操作人 |
|------|---------|--------|
| 2026-03-19 | 初始创建本文档，记录 Story 1.1 实施过程中的框架改动讨论 | chunxiao + Claude |
| 2026-03-19 | 实施 rule-sync-check.sh hook（3 个场景） | chunxiao + Claude |
| 2026-03-19 | 修改 generate-project-context 模板，加入 Rule Document Registry | chunxiao + Claude |
| 2026-03-19 | 创建项目 CLAUDE.md，加入规则同步约束 | chunxiao + Claude |
