---
Epic: 6
Scope: epic
Round: 1
Date: 2026-04-13
Model Used: Codex (GPT-5-based) (codex)
Type: Story Review Summary
Stories Reviewed: 4
---

## 审查结论

首轮审查。共审查 Epic 6 下 4 个 Story。三层审查均完成（`structure` / `consistency` / `contract`）。

- 通过：0 个
- 有条件通过：1 个
- 硬阻塞：3 个

总体判断：Epic 6 的功能方向和 Story 拆分主线基本成立，但当前文档在 `universalDirs` 优先级契约、`--no-universal` 选项设计、`--filter` 作用对象与零匹配回退语义上存在高风险缺口。若按现状直接进入开发，极易出现实现分叉、AC 不可验收，或在运行时把真实错误静默降级。

## 审查范围

- Story 文件：
  - `6-1-list-subdirectory-contents.md`
  - `6-2-filter-subdirectory-install.md`
  - `6-3-universal-directory-install.md`
  - `6-4-init-universal-directory-preference.md`
- 对照基准：
  - `project-context.md`
  - `planning-artifacts/epics/epic-6.md`
  - `planning-artifacts/architecture/03-core-decisions.md`
  - `planning-artifacts/architecture/04-implementation-patterns.md`
- 审查维度：
  - 结构完整性
  - AC 可测性
  - 与 Epic 一致性
  - 与架构文档一致性
  - Story 间冲突与依赖
  - 任务拆分合理性
  - 交互/认证/安全/性能口径
  - 跨 Epic 共享契约

## 新发现

### 1. [高] `universalDirs` 四层优先级链缺少环境变量契约，导致 AC 不可实现
- **来源**：consistency+contract+structure
- **分类**：decision_needed
- **涉及 Story**：6-3, 6-4
- **证据** - `epic-6.md` 与 `6-4-init-universal-directory-preference.md` 的 AC 明确写了 `CLI > 环境变量 > config > 默认值`，但 `6-3-universal-directory-install.md` 仅定义了 `CLI > config > 默认值`，没有给出环境变量名称、合法值、解析位置、非法值处理规则或对应测试。
- **影响** - Story 6-4 的 AC #4 当前既无法实现也无法验收；不同开发者很可能各自发明 env 语义，导致运行时行为和测试口径分裂。
- **建议** - 二选一并全量同步：1) 明确 `universalDirs` 环境变量契约（变量名、取值、覆盖关系、错误处理、测试）；2) 删除 Epic 6 与 Story 6-4 中“环境变量”层，统一收敛为 `CLI > config > 默认值`。

### 2. [高] `--no-universal` 的 Commander 选项设计会让“默认开启 / 显式关闭”同时失效
- **来源**：structure
- **分类**：patch
- **涉及 Story**：6-3
- **证据** - `6-3-universal-directory-install.md` Task 1.2 指定 `.option('--no-universal', 'skip universal directory installation', false)`，Task 1.3 再读取 `opts['noUniversal']`。在当前仓库依赖的 Commander 行为下，本地最小验证结果为“未传”和“传入 `--no-universal`”都解析成 `{ universal: false }`，且不会生成 `noUniversal` 这个键。
- **影响** - AC #1 的“默认启用”与 AC #2 的“显式关闭”无法同时成立；实现者即使照文档编码，也会得到始终关闭通用目录的错误行为。
- **建议** - 固定一种可工作的设计：要么保留 `--no-universal` 并明确 `noUniversal = opts.universal === false`；要么改成正向布尔选项。同步修正 Tasks、Dev Notes 和测试断言。

### 3. [高] 把“config 加载失败”整体降级为默认开启，违反错误处理白名单规则
- **来源**：consistency+contract
- **分类**：patch
- **涉及 Story**：6-3
- **证据** - `6-3-universal-directory-install.md` Task 5.4 与 Dev Notes 使用“config 加载失败则视为 `true`”和 `catch {}` 风格示例；而 `project-context.md` 与 `04-implementation-patterns.md` 明确要求 catch 降级必须逐码白名单，不能把 `CONFIG_CORRUPT`、`CONFIG_READ_FAILED` 与 `CONFIG_NOT_FOUND` 一起吞掉。
- **影响** - 配置损坏、读取失败等真实故障会被静默折叠成“默认开启通用目录”，用户拿到的是伪正常行为而不是真实错误，后续排障和验收都会被误导。
- **建议** - 仅对白名单错误码降级，最小集合至少应是“配置不存在”；`CONFIG_CORRUPT`、`CONFIG_READ_FAILED` 等必须继续抛出，并在 Story 中把降级条件写成逐码规则。

### 4. [高] 用 `tool: 'universal'` 承载“通用目录”语义，扩展了共享字段边界
- **来源**：contract+structure
- **分类**：decision_needed
- **涉及 Story**：6-3
- **证据** - `6-3-universal-directory-install.md` Task 3 把 `tool: 'universal'` 定义为虚拟工具 ID，并让它流经 `MatchedPlan`、`InstallResult`、`manifest.json`；但 `project-context.md` 明确禁止通过扩展共享字段值域来承载新语义，尤其是会影响多个消费方的字段。
- **影响** - 这会把原本表示“真实工具 ID”的 `tool` 字段扩成“安装通道/分组”，影响按 tool 分组、未来按 tool 统计或卸载，以及所有假设 tool 可在注册表中解析的消费方，属于典型的跨层语义扩展风险。
- **建议** - 保留 `tool` 原语义，新增独立字段或 rule metadata 表示“IDE 目录 vs 通用目录”；如果坚持使用伪 tool，必须先在共享契约层正式重定义 `tool` 语义，并逐一审查全部消费方与持久化格式。

### 5. [高] `--filter` 的 Story 契约仍写“子目录”，但任务已经扩展到全部 sourceFiles
- **来源**：consistency+structure
- **分类**：decision_needed
- **涉及 Story**：6-2, 6-1, 6-3
- **证据** - Epic 6、Story 6-2 的标题、叙述和 AC 多次强调“子目录过滤”，而 `6-2-filter-subdirectory-install.md` Task 3.5 明确要求对 `Files` / `Directories` / `Flatten` 三种类型都生效；Story 6-3 又要求把这套行为作用到 `agents` 这类文件型规则上。
- **影响** - 现在的文档对“`--filter` 到底过滤子目录还是所有可安装条目”没有单一答案，直接破坏 Story 6-1 的 `--list` 探索路径，也会让测试按错误的语义单元编写。
- **建议** - 二选一并同步全 Epic：1) 收窄回目录级过滤，删除 Files/Flatten 支持；2) 把术语统一改成“installable entries / 可安装条目”，并补文件型示例、探索流程和验证要求。

### 6. [高] `--filter` 的零匹配回退路径会改变原始作用域，且“取消”没有独立边界
- **来源**：contract+structure
- **分类**：patch
- **涉及 Story**：6-2
- **证据** - `6-2-filter-subdirectory-install.md` Task 4.3/4.4 与 Dev Notes 让 Match 阶段在交互后直接改写 `args.filter`，选择项值还是裸名称；对 `skills/xyz*` 这类有前缀的输入，回写后会丢失原始 `skills/` 作用域。用户取消时则返回 `{ items: [] }`，但文档没有定义管道应否短路退出，导致“用户取消”和“合法空计划”共用同一结构。
- **影响** - 零匹配补救流程可能把原本限定在单个顶层目录的过滤扩成跨目录过滤，或把“用户取消”误实现为“空结果成功继续执行”，直接影响 Install/Report 路径的一致性。
- **建议** - `ParsedArgs` 保持只读，交互后选择值放到局部变量或独立的 match 选项对象中；无前缀场景的候选值应使用限定名（如 `skills/git-commit`）；“用户取消”应定义为编排器可识别的独立短路信号，而不是空 `MatchedPlan`。

### 7. [中] `--list` 仍允许直接写 stdout，绕过 Reporter 输出契约
- **来源**：structure+contract
- **分类**：patch
- **涉及 Story**：6-1
- **证据** - `6-1-list-subdirectory-contents.md` Task 3.7 写的是“通过 Reporter 的新方法或直接 `process.stdout.write()` 输出”；但 `project-context.md` 的 Output Rules 明确要求除 `aiforge init` 外，所有用户可见输出都必须经过 Reporter。
- **影响** - 这会把 `--list` 的 TTY/Plain/Quiet 行为、输出流选择、i18n 和分隔符规则交给实现者自由发挥，削弱 Reporter 作为统一输出边界的约束。
- **建议** - 删除 direct stdout 备选分支，明确 `--list` 只能通过 `Reporter.reportList()` 输出，并以三种 Reporter 的测试作为唯一验收路径。

## 逐篇审查结论

### Story 6.1: `--list` 子目录内容列举

**结论：有条件通过**

**优点**
- Clone 后分叉到 `ListContents` 的主路径，与架构文档 D6 的管道分叉模式一致。
- `reportList()`、i18n 键和真实错误码测试入口已经有基本设计骨架。

**关键问题**
1. **输出边界不闭合** — Task 3.7 仍允许绕过 Reporter，和项目输出规则冲突。

**建议动作**
- 删除 direct stdout 方案，只保留 `Reporter.reportList()`。
- 顺手把“可用目录扫描”辅助逻辑也按错误码白名单规则补充清楚，避免后续实现再引入宽泛吞错。

### Story 6.2: `--filter` 精准子目录安装

**结论：硬阻塞**

**优点**
- 把过滤放在 Match 阶段以继承 dry-run 一致性，这个方向本身是正确的。
- 零匹配时区分 TTY / 非 TTY 的意识是对的。

**关键问题**
1. **过滤对象语义漂移** — 文档表述仍是“子目录过滤”，但任务已扩成对全部 sourceFiles 过滤。
2. **零匹配补救路径会丢失作用域** — 改写 `args.filter` + 裸名称候选会破坏原始过滤边界。
3. **取消语义未独立建模** — 返回空 `MatchedPlan` 无法和“合法空计划”区分。

**建议动作**
- 先冻结 `--filter` 的契约对象，到底是“子目录”还是“可安装条目”。
- 为零匹配重选和取消建立独立的边界，不要复用可变 `ParsedArgs` 和空 `MatchedPlan`。

### Story 6.3: 通用目标目录默认安装

**结论：硬阻塞**

**优点**
- 复用现有 install engine 的目标与 NFR-C7 一致。
- 把通用目录计划放在 Match 阶段追加，有利于保持 dry-run 与正常安装的一致数据源。

**关键问题**
1. **`--no-universal` 选项规格本身不可工作** — 当前 Commander 设计无法区分“未传”和“显式关闭”。
2. **`universalDirs` 优先级链不完整** — 缺少环境变量层的正式契约。
3. **配置加载降级过宽** — 会吞掉真实配置错误。
4. **`tool: 'universal'` 扩展了共享字段语义** — 违反现有跨层字段边界规则。

**建议动作**
- 先修正 CLI 选项契约和优先级链，再进入实现。
- 将“通用目录”从 `tool` 字段中解耦，改为独立元数据或新字段。

### Story 6.4: `aiforge init` 通用目录偏好配置

**结论：硬阻塞**

**优点**
- 询问插入在连接验证成功之后、配置保存之前，交互顺序合理。
- `universalDirs` 作为可选字段落到 config 的设计，与升级兼容方向一致。

**关键问题**
1. **AC #4 依赖未定义的环境变量层** — 当前没有可实现、可测试的契约。
2. **Story 自身 AC 与 Tasks 不闭合** — Tasks 只覆盖 init 持久化，运行时语义全转交给 Story 6.3。

**建议动作**
- 要么收窄 Story 6.4 的 AC，只保留 init/persistence；
- 要么显式声明对 Story 6.3 的依赖，并把 env 层契约、运行时测试和验收口径一起补齐。

## 通过项

- `--list` 在 `Clone` 之后分叉，整体方向符合现有 pipeline 架构。
- `--filter` 放在 Match 阶段处理，有利于保持 dry-run / install 共用同一 `MatchedPlan`。
- 通用目录尽量复用现有安装引擎、不额外开新执行路径的目标，与 NFR-C7 一致。
- `aiforge init` 的通用目录偏好询问插入点合理，默认值与升级兼容思路明确。
