## Epic 5: 端到端体验与发布就绪

精致的终端交互体验——阶段式 spinner 进度、按工具分组的树形结果、TTY/非TTY 自适应、quiet 模式、国际化支持。端到端集成测试通过，达到 MVP Go/No-Go 门禁标准。

### Story 5.1: 阶段式进度与 spinner 动画

As a 用户,
I want 在安装过程中看到实时进度,
So that 知道系统在做什么，不会以为卡住了。

**Acceptance Criteria:**

**Given** TTY 终端环境下执行安装
**When** 管道进入每个阶段
**Then** 显示 ora spinner + 中文阶段名（"解析仓库地址..."、"验证认证信息..."、"克隆仓库..."、"检测 AI 工具..."、"匹配安装规则..."、"执行安装..."）（FR-035）
**And** 阶段完成时 spinner 停止并显示 ✓ 标记

**Given** 安装阶段处理多个文件
**When** 每个文件处理完成
**Then** 更新 spinner 文本显示当前进度（如 "执行安装... (3/7)"）

**Given** 进度输出
**When** 检查输出流
**Then** 所有进度信息输出到 stderr（不污染 stdout 的数据流）

### Story 5.2: 树形结果汇总与统计

As a 用户,
I want 安装完成后看到按工具分组的树形结果,
So that 一目了然地知道每个工具安装了什么。

**Acceptance Criteria:**

**Given** 安装完成，涉及多个工具
**When** Reporter 输出结果
**Then** 按工具分组展示树形结构（FR-036）：
```
GitHub Copilot (7 项)
  ✅ agents/api-dev.agent.md → ~/.copilot/agents/
  ✅ skills/code-review/ → ~/.copilot/skills/
  ...
Claude Code (2 项)
  ✅ skills/code-review/ → ~/.claude/skills/
  ...
```

**Given** 结果汇总
**When** 所有文件展示完毕
**Then** 显示统计行：`安装: 7 项  更新: 1 项  跳过: 1 项  失败: 0 项`

**Given** 结果输出
**When** 检查输出流
**Then** 树形结果和统计行输出到 stdout（可被管道消费）

### Story 5.3: TTY 自适应与 quiet 模式

As a 用户,
I want 系统根据终端环境自动调整输出格式,
So that 在 CI 管道中也能正常工作，在脚本中输出可解析。

**Acceptance Criteria:**

**Given** 非 TTY 环境（如 `npx aiforge | grep copilot`）
**When** 执行安装
**Then** 自动禁用 spinner 动画和 ANSI 彩色码（FR-038，NFR-U4）
**And** 输出纯文本行，可被 `grep`/`awk` 解析

**Given** 用户指定 `--quiet`
**When** 执行安装
**Then** 只输出关键信息：最终成功/失败状态 + 统计行（FR-039）
**And** 不显示进度 spinner、不显示逐文件详情

**Given** `npx aiforge --dry-run 2>/dev/null`
**When** 执行
**Then** stdout 只输出纯安装计划（无进度信息），可被脚本解析

**Given** 非 TTY 环境下遇到需要用户决策的场景（如冲突处理）
**When** 需要交互
**Then** 直接失败，exit code 非 0，不挂起等待输入

### Story 5.4: 三段式错误提示完善

As a 用户,
I want 错误发生时看到清晰的修复指引,
So that 不需要搜索文档就能自己解决问题。

**Acceptance Criteria:**

**Given** 认证失败
**When** Reporter 输出错误
**Then** 显示三段式提示（FR-037，NFR-U2）：
```
❌ 无法访问仓库
   Git 服务器返回 401（认证失败）
   修复方法：
   npx aiforge --ssh
   npx aiforge --token <your-token>
   npx aiforge init
```

**Given** 任何 `AiforgeError`
**When** Reporter 渲染错误
**Then** 格式为：`❌ ${message}` → `${why}` → `${fix.join('\n')}`
**And** 修复命令可直接复制执行

**Given** 错误输出
**When** 检查输出流
**Then** 所有错误信息输出到 stderr

**Given** 各类错误场景（认证失败、网络错误、权限不足、参数错误）
**When** 触发错误
**Then** 每种错误都有针对性的 `why` 和 `fix` 内容，不是通用的"请检查配置"

### Story 5.5a: 国际化语言选择与配置

As a 用户,
I want 在初始化时选择界面语言，并能在安装后通过配置修改语言设置,
So that 中英文用户都能舒适使用，且后续无需重新初始化即可切换输出语言。

**Acceptance Criteria:**

**Given** 用户在 `aiforge init` 中选择语言
**When** 选择英文
**Then** 后续所有用户可见输出使用英文（FR-046）
**And** 语言设置保存到 `config.json` 的 `language` 字段

**Given** 默认配置
**When** 未设置语言
**Then** 系统默认使用中文输出（NFR-U1）

**Given** `data/messages.ts`
**When** 检查实现
**Then** 所有用户可见字符串通过 messages 模块获取
**And** 支持根据 `language` 配置切换中英文文案

**Given** 用户已完成安装，且 `config.json` 中的 `language` 从 `zh-CN` 修改为 `en`
**When** 再次执行任意包含用户可见输出的命令（如 `npx aiforge --dry-run`）
**Then** 系统使用英文输出
**And** 无需重新运行 `aiforge init`（FR-046）

**Given** `config.json` 中的 `language` 配置值非法、缺失或不受支持
**When** 系统加载语言配置
**Then** 自动回退到默认中文输出
**And** 给出明确提示，说明当前语言配置无效并已使用默认语言

### Story 5.5b: 端到端集成测试

As a 开发者,
I want 端到端集成测试覆盖核心安装流程、安装模式和目标平台,
So that 在发布前能够自动验证系统整体可用性，并及时发现回归问题。

**Acceptance Criteria:**

**Given** 一个符合约定目录结构的模拟知识仓库
**When** 执行全局安装和项目级安装
**Then** 4 个目标工具（Copilot、Claude、Cursor、VS Code）的安装流程均可成功完成
**And** 安装结果与规则映射一致

**Given** 三种安装模式
**When** 分别执行复制模式、符号链接模式和 flatten 模式
**Then** 三种模式均通过端到端验证
**And** 各自输出符合预期目标路径和文件形态

**Given** `--dry-run` 模式
**When** 执行端到端测试
**Then** 不发生任何文件写入、复制、覆盖或创建行为
**And** dry-run 输出的安装计划与实际安装结果一致（NFR-U5）

**Given** 存在文件冲突场景
**When** 执行安装测试
**Then** 系统触发冲突处理流程
**And** 备份、跳过、覆盖等行为符合设计预期

**Given** 安装结果为零项的场景
**When** 执行端到端测试
**Then** 系统触发零结果诊断输出
**And** 输出包含扫描路径、匹配结果和修复建议

**Given** macOS 环境
**When** 执行端到端测试
**Then** 所有测试通过（NFR-C1）

**Given** Linux 环境（CI）
**When** 执行端到端测试
**Then** 所有测试通过（NFR-C2）

**Given** 端到端测试完成
**When** 查看测试结果
**Then** 能明确区分通过项、失败项及失败原因
**And** 失败结果可作为发布阻塞依据

### Story 5.5c: MVP Go/No-Go 发布门禁验收

> **性质说明：** 本 Story 更偏发布门禁/验收清单，而非标准开发 Story。保留在 epics.md 中以确保发布验收有据可查。

As a PM / QA,
I want 一份明确的 MVP 发布门禁清单并逐项完成验证,
So that 团队对产品是否达到发布标准有客观、一致、可追溯的判断。

**Acceptance Criteria:**

**Given** MVP Go/No-Go 门禁清单
**When** 逐项执行发布前验证
**Then** 以下条件必须全部满足：
- 新员工首次配置旅程可完整走通
- `--dry-run` 输出与实际安装结果一致
- 冲突场景存在备份保护
- 零结果场景存在诊断输出
- npm 包中不包含公司域名、仓库地址、Token 或其他敏感信息（NFR-S1）

**Given** 端到端验证结果、关键旅程验证结果和发布检查结果
**When** 汇总发布评审材料
**Then** 每一项门禁都有明确状态：通过 / 未通过 / 阻塞
**And** 每个未通过项都附带对应风险说明和处理建议

**Given** 存在任一未通过的 blocker 项
**When** 执行 Go/No-Go 评审
**Then** 发布结论为 No-Go
**And** 不进入正式发布

**Given** 所有 blocker 项均已关闭
**When** 执行 Go/No-Go 评审
**Then** 发布结论为 Go
**And** 形成可追溯的发布验收记录

**Given** 发布门禁验收完成
**When** 复盘本次验收结果
**Then** 团队可以明确知道 MVP 当前的已知风险、剩余限制和上线边界

### Story 5.6: 技术债快速清理与 lint 门禁修正

> **性质说明：** Epic 5 回顾追加 Story。清理跨 Epic 积累的极小技术债，修正 lint 门禁作用域。

As a 开发者,
I want 清理跨 Epic 积累的 4 个极小技术债项并修正 lint 门禁作用域,
So that 发布前代码库干净、lint 全仓绿、门禁文档无自相矛盾。

**Acceptance Criteria:**

**Given** `src/commands/init.ts` 中存在 `sanitizeTokenDisplay()` 函数
**When** 审查代码
**Then** 该函数已被删除，调用处改为 `import { sanitizeToken }`，现有测试零回归（CR TODO-001）

**Given** `.prettierignore`
**When** 执行 `npm run lint`
**Then** `.agent`、`.agents`、`.gemini` 目录被正确忽略，退出码为 0（CR TODO-012）

**Given** `package.json`
**When** 查看 scripts
**Then** 存在 `lint:src` 脚本，作用域仅为 `src/` 和 `tests/`（CR TODO-016）

**Given** `mvp-go-nogo-checklist.md` Warning 汇总行
**When** 审查内容
**Then** 措辞与各行状态一致，无自相矛盾（CR TODO-015）

### Story 5.7: 回归防护测试补全与 preflight 增强

> **性质说明：** Epic 5 回顾追加 Story。补全关键回归防护测试缺口，增强 preflight 诊断精度。

As a 开发者,
I want 补全 4 个关键的回归防护测试缺口并增强 preflight 诊断精度,
So that 发布后代码变更有自动化测试守护，不会因回归而损害质量。

**Acceptance Criteria:**

**Given** `targetPath` 为普通文件（非目录）
**When** preflight 阶段执行 `checkTargetWritability()`
**Then** 提前抛出 `PATH_NOT_DIRECTORY` 错误（CR TODO-006）

**Given** `pipeline.ts` 的 `report` 闭包
**When** 执行集成测试
**Then** 有测试断言 `items[].sourcePath` 为 repo-relative 路径（CR TODO-010）

**Given** `process.stdout.isTTY = false` 且 `process.stderr.isTTY = true`
**When** 入口层创建 Reporter
**Then** 有测试断言选择 TtyReporter（CR TODO-011）

**Given** `BUILTIN_RULES` 共 16 条规则
**When** 执行 E2E 集成测试
**Then** 覆盖率从 ~31% 提升到 80%+（CR TODO-013）

