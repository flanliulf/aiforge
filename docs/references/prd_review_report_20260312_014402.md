# PRD 审核报告：ai-forge

- 审核对象：`_bmad-output/planning-artifacts/prd.md`
- 对照文档：`_bmad-output/planning-artifacts/product-brief-ai-forge-2026-03-11.md`
- 审核时间：`2026-03-12 01:44:02 UTC`
- 审核角色：PM / Validation Architect
- 审核结论：`Warning`
- 综合评级：`4/5`

## 1. 总体结论

这份 PRD 已经具备进入下一阶段的基础，足以支撑架构讨论、方案拆解和范围对齐；但还不适合作为“最终冻结版”直接下发。

优点很明确：结构完整，叙事清楚，用户旅程真实，范围分期合理，NFR 相对成熟，产品定位和差异化叙事已成型。

问题也很明确：分类不收口、frontmatter 不完整、Product Brief 与 PRD 的编号追踪断链、少量 FR 混入实现细节、`cli_tool` 视角下的脚本化支持边界不够显式。

一句话结论：**可以往下走，但建议先做一轮结构性修订，再作为后续架构/epic 的基线版本。**

## 2. 审核摘要

### 2.1 通过项

- **格式：Pass**
  - 已包含 BMAD 核心章节：Executive Summary / Success Criteria / User Journeys / Functional Requirements / Non-Functional Requirements / Product Scope
  - 主结构清晰，章节顺序合理

- **信息密度：Pass**
  - 未发现明显英文模板腔或常见冗词模式
  - 语义密度较高，整体不是“空话 PRD”

- **Product Brief 覆盖：Good**
  - 用户画像、问题陈述、核心价值、MVP 范围、成功指标、分期规划都承接到了 PRD
  - 核心产品思想（标准适配器、零信任解耦、终端输出即对话）延续良好

- **整体可用性：Good**
  - 文档足够让读者理解产品是什么、为什么做、MVP 做到哪里、怎么判断是否成功

### 2.2 风险项

- **完整性：Warning**
  - frontmatter 缺少 `date`

- **可追踪性：Warning**
  - Product Brief 与 PRD 的需求编号体系不一致，导致追踪链不闭环

- **项目类型一致性：Warning**
  - `projectType` 使用复合值，不利于 BMAD 后续校验和下游文档统一解释

- **需求纯度：Warning**
  - 少量 FR 混入 HOW 层面的实现细节，容易污染后续架构决策空间

- **CLI 项目类型完备度：Warning**
  - 当前文档已覆盖命令结构、输出格式、配置规范，但对脚本化/非交互边界定义仍偏弱

## 3. 三档问题清单

## 3.1 必须改

### 1) frontmatter 的 `projectType` 不应写成复合值

当前写法：

- `projectType: cli_tool + developer_tool`

问题：

- BMAD 的项目类型校验数据是单值分类，不是复合分类
- 后续做 project-type validation、架构分流、epic 拆解时，会不知道应按 `cli_tool` 还是 `developer_tool` 模板解释

建议：

- 选一个主类型
- **优先建议使用 `cli_tool` 作为主类型**
- `developer_tooling` 更适合保留在 domain / 标签 / 文档说明里，而不是与 projectType 并列复合

### 2) frontmatter 缺少 `date`

问题：

- 在 BMAD 完整性校验里，frontmatter 缺字段会被判为不完整
- 文档版本追踪与后续基线对比也会少一个关键元数据

建议：

- 在 frontmatter 中补充 `date: 2026-03-11`

### 3) Product Brief 与 PRD 的需求编号断链

现状：

- Product Brief 使用 `F-001 / F-002 / F-013 / F-105` 一类编号
- PRD 使用 `FR1 ~ FR46`

问题：

- Brief 到 PRD 的追踪链无法直接映射
- 读者无法判断 Brief 中引用的功能项究竟对应 PRD 哪一条需求
- 后续做 Epic / Story traceability 时会继续放大这个问题

建议：

- 统一成同一套编号体系
- 推荐统一为 `FR-001` 这种格式
- 至少做到：**Brief 引用编号与 PRD 中正式编号一一对应**

### 4) 项目类型要求没有完全闭环

如果主类型定为 `cli_tool`，BMAD 对应的关键要求包括：

- `command_structure`
- `output_formats`
- `config_schema`
- `scripting_support`

当前状态：

- 前三项基本具备
- `scripting_support` 没有形成独立、明确、可验证的约束集合

如果你坚持把主类型定义为 `developer_tool`，那缺口更大，至少还缺：

- `language_matrix`
- `installation_methods`
- `api_surface`
- `code_examples`
- `migration_guide`

结论：

- **必须先收口主类型，再补齐该主类型的必需内容**

## 3.2 建议改

### 1) 将 HOW 细节从 FR 中下沉

当前若干 FR 写法混入了具体实现，例如：

- `FR3`：直接写浅克隆 `--depth 1`
- `FR4`：直接写 `git pull`
- `FR5`：直接写固定持久化路径 `~/.aiforge/repos/`
- `FR25`：直接绑定 `manifest.json`
- `FR40`：直接绑定 `config.json`
- `FR44`：直接绑定 `files/directories/flatten` 三种内部安装类型

问题：

- PRD 应优先定义 WHAT，而不是过早锁死 HOW（即使是对于定位为 `cli_tool` 的本产品，也应该是注明推荐实现方式，而不是直接写）
- 这些实现细节更适合放在“CLI 接口与技术规范”或后续架构文档

建议：

- FR 保留能力合同
- 技术规范章节保留具体参数、文件名、目录和实现策略

### 2) 增加显式的追踪矩阵

建议补一张表，至少覆盖：

- Success Criteria → User Journeys
- User Journeys → Functional Requirements
- MVP Scope → Functional Requirements / NFR

WHY：

- 现在读起来“基本能看出对应关系”，但不是“显式闭环”
- 对人类评审还行，对下游 AI/结构化拆解不够稳

### 3) 显式说明 Product Brief 到 PRD 的“有意裁剪”

例如：

- Brief 中有 `aiforge update` 的使用心智
- PRD 中将 `aiforge update` 放到 M2，并以“符号链接 + git pull”承接 MVP 的更新路径

这个决策本身合理，但建议写得更显式：

- 哪些能力是“现在不做”
- 为什么不做
- MVP 期间由什么替代路径承接

### 4) 强化 CLI 的脚本化边界定义

当前文档已经提到：

- 非 TTY 降级为纯文本
- CI 场景下禁用 spinner / 彩色
- CI/CD 自动化放到 M2/M3

但仍建议补清楚：

- 非交互环境下遇到冲突是否直接失败
- 哪些场景必须返回非 0 exit code
- 标准输出和错误输出的分工
- MVP 与 M2/M3 的自动化边界

## 3.3 可不改

### 1) 术语表可以保留

术语表并不臃肿，反而有利于统一后续讨论语言，建议保留。

### 2) 用户旅程整体质量较好

“小明 / 小李 / chunxiao” 三条线足够支撑产品决策，不必为了“更模板化”而重写。

### 3) NFR 主体结构可以保留

这部分是当前文档的强项，安全、可靠性、兼容性、用户体验都比较扎实，不建议大动。

### 4) 分期策略整体合理

`MVP / M2 / M3 / P3` 的切分基本符合当前产品阶段，不需要推倒重来。

## 4. 逐条修订清单

下面这部分按“可以直接照着改”的粒度给出。

### 修订 1：先修 frontmatter

目标：

- 收口分类
- 补齐元数据
- 让 BMAD 校验能稳定通过

建议方向：

```yaml
---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-complete']
classification:
  projectType: cli_tool
  domain: developer_tooling
  complexity: medium
  projectContext: greenfield
inputDocuments:
  ...
documentCounts:
  ...
workflowType: 'prd'
date: 2026-03-11
---
```

备注：

- 如果你更看重 BMAD 默认 taxonomy 的严格兼容性，也可以把 `domain` 收敛成 `general`
- 但在当前业务语义下，`domain: developer_tooling` 也说得通，只是要接受它不一定与 BMAD 内置 domain CSV 完全对齐

### 修订 2：统一 Brief 与 PRD 的需求编号

目标：

- 让追踪链可读、可验证、可下游消费

推荐方案：

- 将 PRD 的 `FR1 ~ FR46` 统一改为 `FR-001 ~ FR-046`
- 将 Product Brief 中原本的 `F-001 / F-002 / F-013 / F-105` 替换为对应的正式 PRD 编号

如果暂时不想全量改编号，至少做一张映射表，例如：

| Brief 编号 | PRD 正式编号 | 说明 |
|-----------|--------------|------|
| F-001 | FR-001 ~ FR-005 | 仓库获取能力 |
| F-008 | FR-006 ~ FR-012 | 认证能力 |
| F-010 | FR-033 / FR-041 | 初始化与首次配置 |

最低标准：

- 读者能从 Brief 一路定位到 PRD 的正式需求编号

### 修订 3：为 `cli_tool` 明确补齐 `scripting_support`

建议新增一个小节，位置可选：

- 放在 `## CLI 接口与技术规范` 下
- 或单列 `## CLI 脚本化与自动化约束`

建议至少写清以下 5 点：

1. 非 TTY 环境默认不进入交互式选择
2. 遇到必须人工决策的冲突时，系统应明确失败并返回非 0 exit code
3. 成功与失败退出码的基本约定应稳定
4. 标准输出用于结果和计划，错误输出用于诊断信息
5. MVP 仅保证“非 TTY 纯文本 + 明确失败”；完整 CI/CD 自动化能力放在 M2/M3

WHY：

- 这样既不把 CI/CD 强行拉进 MVP
- 又能让 `cli_tool` 的项目类型要求闭环

### 修订 4：把 HOW 从 FR 中下沉到技术规范

建议优先处理以下几条：

#### FR3

当前倾向：

- “系统可以使用浅克隆（`--depth 1`）降低网络传输量”

建议改写方向：

- “系统在首次获取知识仓库时应最小化不必要的数据传输，以满足首次安装性能目标”

把 `--depth 1` 保留到技术规范中。

#### FR4

当前倾向：

- “执行更新（git pull）而非重新克隆”

建议改写方向：

- “系统在检测到已有本地仓库副本时应优先执行增量更新，而非全量重新获取”

把 `git pull` 放进实现/技术规范。

#### FR5

当前倾向：

- 直接绑定 `~/.aiforge/repos/`

建议改写方向：

- “系统应为可复用的仓库副本提供稳定、持久化的本地存储位置”

#### FR25

当前倾向：

- 直接绑定 `manifest.json`

建议改写方向：

- “系统应持久化记录已安装资源的来源、目标、模式和状态，以支持冲突检测和后续更新判断”

#### FR40

当前倾向：

- 直接绑定 `~/.aiforge/config.json`

建议改写方向：

- “系统应支持持久化用户配置，包括默认仓库、认证偏好和相关安装设置”

#### FR44

当前倾向：

- 直接绑定三种内部安装类型名称

建议改写方向：

- “系统应支持多种资源安装策略，以覆盖文件复制、目录复制和结构转换类场景”

结论：

- **PRD 讲能力**
- **技术规范讲实现**

### 修订 5：补一张显式追踪矩阵

建议新增一张最小可用表：

| Success Criteria / Scope | User Journey | FR / NFR |
|--------------------------|-------------|----------|
| 首次安装成功率 > 90% | 旅程 1 / 旅程 2 | FR6-12, FR33-39, NFR-U2, NFR-U5 |
| 多工具覆盖率 100% | 旅程 1 / 旅程 4 | FR13-24, FR43-45 |
| 冲突不丢文件 | 旅程 3 | FR25-31, NFR-R4, NFR-R5 |
| 日常更新低成本 | 旅程 5 | FR20, FR23, Scope 决策记录 |

目标：

- 让“为什么存在这条 FR”可以被一眼看明白

### 修订 6：把范围裁剪写得更明确

建议在 Scope / 决策记录附近补两类说明：

#### 6.1 `aiforge update`

- MVP 不做独立命令
- 原因：符号链接模式下，`git pull` 已可承接核心更新场景
- 风险：项目级复制模式下更新体验不一致
- 后续：M2 增补 `aiforge update`

#### 6.2 CI/CD

- MVP 不承诺完整非交互自动化安装
- 但要求：非 TTY 纯文本、错误可诊断、退出码清晰
- 完整 CI 支持进入 M2/M3

这样写的价值：

- 读者会知道这是“有意识的取舍”，不是“想漏了”

### 修订 7：做一次术语与需求层级清洗

重点检查：

- 术语表里定义的是“概念”，FR 里写的是“能力”，技术规范里写的是“实现”
- 不要让同一件事在三个层级里重复、且说法不一致

建议重点核对：

- `manifest.json`
- `config.json`
- `flatten`
- `符号链接模式`
- `全局安装 / 项目安装`

### 修订 8：最后做一遍“冻结前检查”

在 PRD 正式冻结前，建议按下面顺序做最终检查：

1. frontmatter 完整
2. projectType 单值化
3. 编号统一
4. `cli_tool` 必需内容闭环
5. FR 中 HOW 下沉
6. 追踪矩阵补齐
7. 范围裁剪说明写显式

完成以上 7 步后，这份 PRD 的状态可以从当前的 `Warning` 提升到接近 `Pass`。

## 5. 最终建议

如果目标是：

- **进入架构讨论**：当前版本已经够用
- **作为正式基线冻结**：建议先完成本报告中的“必须改”

最优先顺序只有三件事：

1. **先收口分类与 frontmatter**
2. **再修编号追踪链**
3. **最后做 WHAT / HOW 分层**

WHY？

- 因为这三件事不解决，后面所有“架构、epic、实现、验证”都会在不一致的基线上继续扩散

---

**结论重申：**

这不是一份差的 PRD。相反，它已经很接近一份“能打”的 PRD。现在差的不是方向，而是最后一轮结构收口。把这轮收口做完，它就能更稳地成为后续工作的基线文档。
