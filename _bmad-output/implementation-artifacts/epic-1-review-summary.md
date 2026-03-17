# Epic 1 Story 审查总结

## 审查范围

- Epic 1 全部 5 个 story：
  - `1-1-project-init-and-toolchain.md`
  - `1-2-core-types-and-error-system.md`
  - `1-3-output-abstraction-and-path-resolver.md`
  - `1-4-data-layer-configuration.md`
  - `1-5-cli-entry-and-pipeline-skeleton.md`
- 对照基准：
  - `project-context.md`
  - `planning-artifacts/epics/epic-1.md`
  - `implementation-artifacts/sprint-status.yaml`
  - `planning-artifacts/implementation-readiness-report-2026-03-17.md`
  - BMAD `create-story` 模板与 story 质量规则

## 审查维度

- Story 模板结构是否完整
- Acceptance Criteria 是否清晰、可测试、可落地
- 是否与 Epic 1 目标和项目上下文一致
- 是否存在前向依赖、职责漂移或实现歧义
- 是否具备开发前的足够上下文、任务拆解与测试指引

## 总体结论

Epic 1 的 5 个 story 整体质量良好，结构完整，任务拆解充分，基本符合 `ready-for-dev` 预期。

结论分级如下：

- 通过：1 个
- 有条件通过：4 个
- 阻塞：0 个硬阻塞

总体判断：**Epic 1 可以进入开发，但建议先修正文档中的 3 类关键歧义/不一致问题，再开始实施，以减少返工和测试争议。**

## 逐篇审查结论

### Story 1.1: 项目初始化与工具链配置

**结论：通过**

**优点**

- 结构完整，包含 Story、AC、Tasks、Dev Notes、References。
- 与 Epic 1 目标一致，能建立 TypeScript ESM 工具链基础。
- 任务拆解到位，构建、测试、lint、CLI 占位验证均已覆盖。
- 与 `project-context.md` 中的 ESM、命名规范、模块边界基本一致。

**关注点**

- AC #5 在 story 文件中被压缩为“包含所有核心依赖和开发依赖”，不如 Epic 原文中逐项列出依赖清单那样自包含；开发者需要再跳转到 Dev Notes 才能确认精确包名。
- Dev Notes 允许 `src/index.ts` 使用 `console.log('aiforge')` 作为占位示例，这与 `project-context.md` 中“所有用户可见输出都应通过 Reporter”存在轻微张力。虽然这是占位阶段，可接受，但建议用“空 commander 程序”替代该示例，避免误导实现。

**建议动作**

- 将 AC #5 中的依赖清单恢复为显式列表。
- 将占位实现示例改成不直接输出用户可见文本的形式。

### Story 1.2: 核心类型定义与错误体系

**结论：有条件通过**

**优点**

- 核心类型、错误体系、脱敏能力、模块边界和测试任务均有覆盖。
- 与 Epic 1 中“错误体系就绪”的目标高度一致。
- `core/` 零依赖、命名导出、`.js` 扩展名等约束写得明确。

**关键问题**

- `sanitizeToken()` 的规则存在文档内外不一致：
  - AC 和 Dev Notes 中示例输出为 `glpat-ab****op`，只保留了后 2 位。
  - 同时文字说明写的是“前 8 + 后 4”。
  - `project-context.md` 的 Token 显示规则也给出了与示例不完全一致的描述。

这会直接影响实现方式、单元测试断言和后续安全日志格式，属于**必须统一**的验收口径问题。

**建议动作**

- 在 Story 1.2 中明确唯一合法规则，推荐统一为“前 8 + `****` + 后 4”，并同步修正所有示例。
- 在 AC 或 Dev Notes 中补充短 Token 的边界规则，使测试可直接据此编写。

### Story 1.3: 输出抽象与路径解析

**结论：有条件通过**
image.png
**优点**

- Reporter 三种实现、stdout/stderr 分工、TTY/quiet 分支、PathResolver 接口都定义得比较完整。
- 与 `project-context.md` 的输出规则、路径规则、跨平台要求基本对齐。
- 已包含针对 `os.homedir()` 异常场景的错误处理要求。

**关键问题**

- `toolGlobalDir(toolId)` / `toolProjectDir(toolId)` 的具体映射在本 Story 的 AC 中是应交付内容，但 Dev Notes 又说明“具体映射将在 Story 1.4 的 TOOL_DEFINITIONS 中定义，可先硬编码或后续对接”。

这带来两个风险：

- Story 1.3 对 Story 1.4 形成事实上的前向依赖。
- 开发者可能采用临时硬编码，随后在 1.4 再次返工。

**建议动作**

- 二选一明确：
  - 要么把 1.3 的范围收窄为接口 + `home/configDir/reposDir` 基础路径；
  - 要么在 1.3 中直接写清 4 个工具的临时/正式路径映射规则，不再依赖 1.4 补定义。

### Story 1.4: 数据层配置

**结论：有条件通过**

**优点**

- `install-rules`、`tool-registry`、`excludes`、`messages` 四类基础数据都已纳入。
- 任务拆解合理，兼顾常量、索引、加载函数和测试。
- 与“新增工具只改数据不改引擎”的设计原则一致。

**关键问题**

- AC #5 强调 `data/` 目录不依赖其他 `src/` 目录；但 Dev Notes 同时允许 `import type { InstallRule } from '../core/types.js'`。虽然类型导入不会形成运行时依赖，但当前表述会让“零依赖”与“允许 type-only import”看起来互相冲突。
- 需求追踪存在轻微不一致：`implementation-readiness-report-2026-03-17.md` 将 `FR-045 全局排除文件列表` 归到 Epic 3 Story 3.2，而 Story 1.4 已经交付 `DEFAULT_EXCLUDES`。这会削弱跨文档追踪的一致性。

**建议动作**

- 将“零依赖”表述改为“零运行时依赖，允许 type-only import”。
- 统一 `FR-045` 的归属说明：要么确认它在 1.4 先建立基础数据、3.2 再消费；要么修正 readiness report 的映射。

### Story 1.5: CLI 入口与管道骨架

**结论：有条件通过**

**优点**

- CLI 帮助、版本号、参数解析、管道骨架、dry-run 分叉、fatal 错误处理均已覆盖。
- 与 Epic 1 的“`npx aiforge --help` 可运行”最小交付目标直接对应。
- 任务拆分合理，CLI、pipeline、init 占位、测试和验证均有安排。

**关注点**

- 任务中写到“partial 错误收集：继续执行，最终汇总”，但 AC 只明确校验 fatal 错误停止，未明确 partial 错误应如何存储、汇总到哪里、最终由谁输出。这不是阻塞问题，但会让实现者对 MVP 范围产生不同理解。

**建议动作**

- 在 AC 或 Dev Notes 中补一句：MVP 阶段 partial 错误仅需收集到内存并保留扩展点，还是必须在本 Story 中形成统一输出格式。

## 关键问题汇总

### 需要优先修正

1. **Story 1.2 脱敏规则不一致**
   - 直接影响实现与测试
   - 建议在开发前先统一

2. **Story 1.3 存在前向依赖倾向**
   - PathResolver 的工具路径映射不应依赖未来 story 才清晰

3. **Story 1.4 的“零依赖”定义不够严谨**
   - 需明确是否允许 type-only import

### 可以后续顺手优化

1. Story 1.1 的依赖列表恢复显式化，提高自包含性
2. Story 1.1 的占位输出示例避免使用 `console.log`
3. Story 1.5 补足 partial 错误的 MVP 口径

## 最终判定

Epic 1 当前 story 集合**整体可用，且足以支持 Sprint 进入开发准备阶段**。

但从 Scrum Master / Story Preparation 的标准看，以下原则仍应收口：

- 验收标准必须只有一种解释
- Story 不应依赖未来 Story 才能定义清楚当前交付
- 跨文档的 FR 追踪应保持一致

**建议：先修正 Story 1.2、1.3、1.4 的文档表述，再正式交给开发。**