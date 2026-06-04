# aiforge - 组件清单

**日期：** 2026-05-25 14:48:20 +0800

## 说明

`aiforge` 是 CLI 项目，没有浏览器 UI 组件库。这里的“组件”按功能模块而不是视觉组件来整理，目标是帮助后续开发者快速判断“某类变更应该改哪里”。

## 核心组件总览

| 组件           | 位置                                                   | 类型          | 职责                                                     | 变更时通常联动                                              |
| -------------- | ------------------------------------------------------ | ------------- | -------------------------------------------------------- | ----------------------------------------------------------- |
| CLI 入口       | `src/index.ts`                                         | 入口组件      | 定义主命令、解析参数、创建 Reporter、启动流水线          | `pipeline.ts`、`commands/`                                  |
| Init 向导      | `src/commands/init.ts`                                 | 交互命令组件  | 首次配置、仓库地址与认证方式验证、语言选择、通用目录偏好 | `services/config.ts`、`services/git.ts`、`core/messages.ts` |
| 流水线编排器   | `src/pipeline.ts`                                      | 编排组件      | 串联各阶段、处理 dry-run/list 分叉、持久化 manifest      | `stages/*`、`services/manifest.ts`                          |
| Reporter       | `src/core/reporter.ts`                                 | 输出组件      | 普通/TTY/quiet 三种输出风格，计划与结果渲染              | `core/messages.ts`                                          |
| 消息目录       | `src/core/messages.ts`                                 | i18n 组件     | 双语文案与 key 访问                                      | `core/reporter.ts`、所有用户可见输出                        |
| 类型契约       | `src/core/types.ts`                                    | 契约组件      | 定义阶段输入输出和规则模型                               | `pipeline.ts`、`stages/*`                                   |
| 工具注册表     | `src/data/tool-registry.ts`                            | 数据组件      | 定义 11 个 AI 工具的检测路径                             | `stages/detect-tools.ts`                                    |
| 安装规则表     | `src/data/install-rules.ts`                            | 数据组件      | 定义 55 条工具规则 + 4 条通用规则                        | `stages/match-rules.ts`、`execute-install.ts`               |
| 源地址解析     | `src/stages/resolve-source.ts` + `src/services/git.ts` | 阶段/服务组件 | 从 CLI/config 解析知识仓库 URL，并生成标准化 Git 源对象  | `commands/init.ts`                                          |
| 认证链         | `src/stages/authenticate.ts`                           | 阶段组件      | 处理 CLI/env/config/credential-manager 四层认证          | `services/config.ts`                                        |
| 仓库同步       | `src/stages/clone.ts`                                  | 阶段组件      | clone/pull、token remote 清理、源文件扫描                | `services/git.ts`                                           |
| 环境检测       | `src/stages/detect-tools.ts`                           | 阶段组件      | 自动或手动确定目标 AI 工具集合                           | `data/tool-registry.ts`                                     |
| 计划构建       | `src/stages/match-rules.ts`                            | 阶段组件      | 根据工具、scope、dirs、filter 产出安装计划               | `data/install-rules.ts`                                     |
| 列表模式       | `src/stages/list-contents.ts`                          | 阶段组件      | 实现 `--list` 子流程                                     | `core/reporter.ts`                                          |
| 安装执行器     | `src/stages/execute-install.ts`                        | 核心执行组件  | preflight、冲突检测、复制/链接/flatten、零结果诊断       | `services/fs-utils.ts`、`services/manifest.ts`              |
| 冲突处理器     | `src/stages/conflict-resolver.ts`                      | 交互组件      | 用户文件冲突时给出交互选项                               | `execute-install.ts`                                        |
| 文件系统安全层 | `src/services/fs-utils.ts`                             | 安全基础组件  | hash、复制、symlink、preflight、路径边界验证             | `execute-install.ts`                                        |
| Manifest 管理  | `src/services/manifest.ts`                             | 状态组件      | 已安装文件记录、冲突类型推断、合并更新                   | `pipeline.ts`、`execute-install.ts`                         |
| Gemini 预检查  | `src/services/version-check.ts`                        | 约束组件      | 校验 Gemini CLI 版本下限                                 | `data/install-rules.ts`、匹配/提示逻辑                      |

## 组件分组

## 1. 命令面组件

- `src/index.ts`
- `src/commands/init.ts`

这组组件直接面向终端用户。若要新增命令、调整 CLI 参数语义、改变默认输出风格，优先从这里入手。

## 2. 编排与阶段组件

- `src/pipeline.ts`
- `src/stages/*.ts`

这是业务主流程的中心。凡是“安装前/安装中/安装后”的流程变化，大概率都会触及这里。

## 3. 基础设施组件

- `src/core/*.ts`
- `src/services/*.ts`

这组组件决定系统的基础边界：错误模型、消息模型、路径模型、文件系统模型、manifest 模型。涉及安全、I/O、全局配置、输出一致性的问题，应先看这层。

## 4. 策略与注册表组件

- `src/data/tool-registry.ts`
- `src/data/install-rules.ts`
- `src/data/excludes.ts`

这组组件定义“支持哪些工具、如何安装、默认跳过什么”。新增工具时通常优先改这里，而不是改安装执行器。

## 5. 支撑资产组件

- `tests/fixtures/sample-repo/`
- `.github/agents/`
- `.github/skills/`
- `_bmad-output/`

这些目录不是运行时主路径，但对测试、dogfooding、规则验证和 brownfield 规划非常关键。

## 可复用设计模式

### 数据驱动扩展

`tool-registry.ts` 和 `install-rules.ts` 让大多数扩展工作停留在数据层。只要目标工具不需要新的底层安装语义，往往无需改 `execute-install.ts`。

### 阶段产物显式建模

`ParsedArgs -> ResolvedSource -> AuthenticatedSource -> LocalRepo -> DetectedEnv -> MatchedPlan -> InstallResult` 这一链条让每一层的输入输出都可独立测试。

### 安全前置

`fs-utils.ts` 把路径穿越、symlink 逃逸、目录类型错误、权限不足等问题尽量在真实写盘前暴露出来，避免“部分写入成功后再失败”的不一致状态。

### 文案集中化

所有用户可见消息统一通过 `msg(key)` 读取，降低了多语言和输出风格漂移的风险。

## 适合落变更的位置

### 新增 AI 工具支持

优先改：

1. `src/data/tool-registry.ts`
2. `src/data/install-rules.ts`
3. 对应测试
4. `docs/install-rules-matrix*.md` 与 `README*`

### 调整安装安全边界

优先改：

1. `src/services/fs-utils.ts`
2. `src/services/manifest.ts`
3. `src/stages/execute-install.ts`
4. 相关 tests 和规则文档

### 调整输出文案或语言

优先改：

1. `src/core/messages.ts`
2. `src/core/reporter.ts`
3. i18n 相关测试

### 新增 CLI 子命令

优先改：

1. `src/commands/`
2. `src/index.ts`
3. 若复用主流程，再接入 `pipeline.ts`

## 当前不存在的组件类型

- 无 Web 页面、无 React/Vue 组件
- 无 API controller/service/repository 分层
- 无数据库 schema/model 层
- 无消息队列或后台 worker 进程

所以如果后续需求开始引入这些内容，应把它视为产品边界扩张，而不是在现有目录里“顺手塞进去”。

---

_Generated using BMAD Method `document-project` workflow_
