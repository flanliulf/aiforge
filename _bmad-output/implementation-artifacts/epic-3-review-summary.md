# Epic 3 Story 审查总结

## 审查范围

- Epic 3 全部 3 个 story：
  - `3-1-ai-tool-auto-detection.md`
  - `3-2-rule-matching-engine.md`
  - `3-3-dry-run-preview-and-install-plan.md`
- 对照基准：
  - `_bmad-output/project-context.md`
  - `_bmad-output/planning-artifacts/epics/epic-3.md`
  - `_bmad-output/implementation-artifacts/sprint-status.yaml`
  - `_bmad-output/planning-artifacts/implementation-readiness-report-2026-03-17.md`
  - `_bmad-output/planning-artifacts/architecture/03-core-decisions.md`
  - `_bmad-output/planning-artifacts/architecture/04-implementation-patterns.md`
  - Epic 1 相关 story（特别是 1.3 / 1.4 / 1.5）
  - `README.md`

## 审查维度

- Story 结构是否完整
- Acceptance Criteria 是否清晰、可测试、可实施
- 依赖链是否自然，是否存在职责漂移或前向假设
- 与 Reporter、PathResolver、规则数据层等核心契约是否一致
- 与项目上下文、公开 README、前序 story 的边界是否一致

## 总体结论

Epic 3 的用户价值非常清晰：自动检测工具、匹配安装规则、通过 `--dry-run` 预览计划，能够直接支撑“先建立信任，再执行安装”的核心体验。

3 个 story 的结构都完整，Epic 内部依赖顺序也基本合理：`3.1 检测 → 3.2 匹配 → 3.3 预览`。但与 Epic 1 已定义的核心契约相比，Epic 3 目前存在几处明显的跨文档不一致，且都落在“路径解析”和“输出接口”这两条主干能力上。

结论分级如下：

- 通过：0 个
- 有条件通过：3 个
- 硬阻塞：0 个

总体判断：**Epic 3 可以继续保留在 ready-for-dev 轨道上，但不建议直接交给开发代理实施；应先修正路径契约、过滤语义、dry-run 接口边界这 3 类问题，否则实现阶段很容易出现“单篇 story 自洽、跨 story 冲突”的返工。**

## 逐篇审查结论

### Story 3.1: AI 工具自动检测

**结论：有条件通过**

**优点**

- Story / AC / Tasks / Dev Notes / References 结构完整。
- FR-013 / FR-014 / FR-015 及 NFR-P5 / NFR-I3 覆盖清楚。
- 手动指定 `--tools`、无工具诊断输出、性能目标等关键用户行为都已写出。
- 明确要求基于 `TOOL_DEFINITIONS` 做数据驱动检测，而不是写死工具逻辑，方向正确。

**关键问题**

1. **`detect.global[]` 与 `PathResolver.toolGlobalDir()` 的关系存在直接冲突。**
   - Story 1.4 将 `detect.global[]` 定义为“Home 目录下的标志路径”。
   - Story 3.1 的 Dev Notes 示例也是 `home() + flagPath` 的思路。
   - 但 Task 1.4 又写成“使用 `pathResolver.toolGlobalDir(toolId)` 获取路径，检查 `detect.global[]` 中的标志路径”。
   - 而 Story 1.3 明确 `toolGlobalDir(toolId)` 是 `~/.aiforge/tools/${toolId}/`，这与 `~/.copilot/`、`~/.claude/` 这类真实工具目录不是一回事。
   - 这会导致开发者不知道应该检查“真实工具目录”还是 “aiforge 自己的工具目录”，属于高风险契约冲突。

2. **自动检测到底是“按安装范围扫描”还是“全局+项目都扫描”，文档没有说透。**
   - Epic 3 和本 Story 的 AC 表达是：存在 `~/.copilot/` **或** `.github/` 就能识别 Copilot。
   - 但 Tasks 里又根据 `args.global` 先确定 `scope`，然后只检查单侧路径：全局模式看 `detect.global[]`，项目模式看 `detect.project[]`。
   - 这样会造成语义分叉：默认项目模式下，若用户只在全局装了工具却没有项目标记，是否应被识别？当前 story 没有统一答案。

**建议动作**

- 明确 `detect.global[]` / `detect.project[]` 的存储约定：
  - 要么统一为相对 `home()` / `cwd()` 的标志路径；
  - 要么统一为绝对/模板路径；
  - 但不要同时混用 `toolGlobalDir()` 和“Home 目录标志路径”两套解释。
- 推荐将工具检测与 `PathResolver.toolGlobalDir()` 解耦：
  - `toolGlobalDir()` 继续负责 aiforge 的目标安装路径；
  - 检测阶段只消费 `TOOL_DEFINITIONS.detect.*` 中的真实标志路径。
- 在 AC 中明确检测语义：
  - 是“基于安装范围只扫描对应侧”；
  - 还是“统一扫描两侧，再决定安装 scope”。

### Story 3.2: 规则匹配引擎

**结论：有条件通过**

**优点**

- Match 阶段边界清楚，职责集中在“按工具+scope 找规则，再展开为安装计划”。
- `RULE_INDEX` 的 O(1) 查找、三种安装类型（`files` / `directories` / `flatten`）、全局排除列表都已覆盖。
- 明确“不执行安装，只构建 `MatchedPlan`”，与 Epic 4 的边界划分合理。
- “空目录/缺失目录静默跳过”的行为有助于兼容不完整知识仓库，设计上合理。

**关键问题**

1. **`--dirs` 的当前定义把 CLI 语义直接绑定到物理目录名，与项目上下文规则冲突。**
   - 当前 story 将 `--dirs skills agents` 解释为过滤 `rule.sourceDir`。
   - `project-context.md` 明确要求：**不要硬编码 source directory names**，也不要默认知识仓库一定使用固定目录结构。
   - 现在的 story 等于把 `skills` / `agents` / `instructions` / `mcp-tools` 直接暴露成稳定 CLI 契约，后续若规则层想支持别名、语义映射或不同仓库结构，会被当前参数设计反向绑定。

2. **目标路径解析示例绕开了 PathResolver，和已有架构原则不一致。**
   - Story 1.4 明确写过：`targetDir` 应使用 PathResolver 的方法解析，不硬编码绝对路径。
   - `project-context.md` 也要求平台相关路径由 `PathResolver` 集中管理。
   - 但本 Story 的 `resolveTargetDir()` 示例仍在手工做 `~/` 展开和 `process.cwd()` 拼接。
   - 这会把平台差异和路径模板规则重新散落回 Match 阶段，后续一旦路径约定变更，会造成多处同步修改。

**建议动作**

- 重新定义 `--dirs` 的语义：
  - 若它代表“资源类型过滤”，建议显式绑定到规则的语义字段，而不是直接绑定 `sourceDir` 字面值；
  - 若 MVP 仍沿用目录名，也应在文档中承认这是临时约束，并说明这是对当前规则数据的过滤，不是对通用仓库结构的假设。
- 将目标路径解析职责收口回 `PathResolver`：
  - Match 阶段只表达“我要解析哪个工具、哪个 scope、哪个 target template”；
  - 不自己展开 `~` 或自行判断项目路径基准。

### Story 3.3: dry-run 预览与安装计划输出

**结论：有条件通过**

**优点**

- 用户价值直接且清晰，是 Epic 3 的可见交付点。
- `dry-run` 在 Match 后分叉、与真实安装共用同一 `MatchedPlan` 的设计与总体架构一致。
- `stdout`/`stderr` 分工意识较强，能支撑可管道消费的输出。
- 同时覆盖了 Reporter 输出、管道编排和无副作用验证，测试意识较完整。

**关键问题**

1. **`reportPlan()` 在架构文档中的接口定义不一致。**
   - Story 1.3 的 AC 与 Dev Notes 已明确 `Reporter` 包含 `reportPlan(plan)`。
   - Story 3.3 也以“Story 1.3 已定义”为前提继续展开。
   - 但 `architecture/03-core-decisions.md` 的 `Reporter` 接口代码块只列出 `startPhase` / `updatePhase` / `completePhase` / `reportResult` / `reportError`，漏掉了 `reportPlan()`。
   - 同一份架构文档的 stdout/stderr 分工表却又提到了 `reportPlan()`。
   - 这说明契约已经被默认依赖，但架构基线没有完全收口。

2. **`-l` 在项目级安装时的行为与 FR-021 冲突。**
   - Story 3.3 的 `getInstallMode()` 示例是：`args.link && scope === 'global'` → `symlink`，否则 → `copy`。
   - 这意味着“项目级 + `-l`”会被静默降级为 `copy`。
   - 但 `project-context.md` 已明确：**项目级安装必须拒绝 `-l`**。
   - 因此 dry-run 不能默默改模式，必须与真实安装保持同样的参数校验语义。

3. **AC 对“真实完整链路”的要求，与 Dev Notes 中“前序阶段可保留占位”表述存在摇摆。**
   - AC #5 写的是 Resolve → Auth → Clone → Detect → Match 全部正常执行，只有 Install 被跳过。
   - 但 Dev Notes 又写“如果尚未替换，本 Story 中保持占位”。
   - 这会让开发者不清楚 dry-run 的验收标准到底是“真实完整链路”还是“只验证 Detect/Match + Reporter 分叉”。

**建议动作**

- 在架构基线中补齐 `Reporter.reportPlan(plan: MatchedPlan): void`，让 Story 1.3 / 3.3 / 架构文档三者一致。
- 明确项目级 `-l` 的行为：
  - dry-run 必须和真实安装共享同一参数校验；
  - 若 `scope === 'project' && args.link`，应报错而不是回退为 copy。
- 将 AC #5 改写得更具体：
  - 如果依赖 Epic 2 的真实阶段实现，就明确写“复用真实 Resolve/Auth/Clone 实现”；
  - 如果只要求 dry-run 分叉验证，则不要再声称前序链路“全部正常执行”。

## 关键问题汇总

### 需要优先修正

1. **Story 3.1 的工具检测路径契约冲突**
   - `detect.global[]`、`home()`、`toolGlobalDir()` 三套路径语义没有统一。

2. **Story 3.2 的 `--dirs` 过滤语义过度绑定物理目录名**
   - 与“不硬编码 source directory names”的项目规则存在张力。

3. **Story 3.2 的目标路径解析职责漂移**
   - 手工展开 `~/` 与 `cwd`，绕开 `PathResolver`。

4. **Story 3.3 的 `reportPlan()` 契约未在架构文档中完全收口**
   - Story 已依赖，但 architecture 接口代码块未定义。

5. **Story 3.3 对 `-l` 的处理与 FR-021 冲突**
   - 项目级不应静默降级为 copy，必须拒绝。

### 建议补充澄清

1. 自动检测到底是“按 scope 单侧扫描”还是“全局+项目同时扫描”
2. `--dirs` 是“资源类型”还是“源目录名”的正式用户契约
3. dry-run 验收是否要求前序真实阶段全部接入
4. README 当前宣称支持 Windsurf，但 Epic 3 的检测性能和工具注册表仍按 4 工具口径编写，建议尽快统一公开范围描述

## 最终判定

Epic 3 的 story 集合**具备较强的产品可读性和中等偏上的开发准备度**，主链路也清楚地表达了“检测 → 规划 → 预览”的交付价值。

但从 Story Preparation 质量标准看，目前最需要收口的是这三个原则：

- 路径相关能力必须只有一套解释，不可在注册表、PathResolver、阶段代码里各自定义
- CLI 参数语义应绑定稳定概念，而不是意外暴露当前物理目录实现细节
- dry-run 与真实安装必须共享同一套校验和接口契约，不能在预览时放宽规则

**建议：先修订 Story 3.1、3.2、3.3 中上述不一致项，再将 Epic 3 正式移交开发。**