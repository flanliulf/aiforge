# Implementation Artifacts Index

开发实施阶段（4-implementation）全部产物索引，涵盖 Epic 1~5 共 29 个 Story。

## 根目录文件

- **[sprint-status.yaml](./sprint-status.yaml)** — Sprint 进度跟踪，所有 Story 状态总览

---

## stories/ — Story 规格文件

Epic 1：项目基础设施与核心框架

- **[1-1-project-init-and-toolchain.md](./stories/1-1-project-init-and-toolchain.md)** — 项目初始化与工具链配置
- **[1-2-core-types-and-error-system.md](./stories/1-2-core-types-and-error-system.md)** — 核心类型定义与错误体系
- **[1-3-output-abstraction-and-path-resolver.md](./stories/1-3-output-abstraction-and-path-resolver.md)** — 输出抽象层与路径解析器
- **[1-4-data-layer-configuration.md](./stories/1-4-data-layer-configuration.md)** — 数据层配置（工具注册表与安装规则）
- **[1-5-cli-entry-and-pipeline-skeleton.md](./stories/1-5-cli-entry-and-pipeline-skeleton.md)** — CLI 入口与管道骨架

Epic 2：知识仓库获取与认证

- **[2-1-config-management-service.md](./stories/2-1-config-management-service.md)** — 配置管理服务
- **[2-2-source-resolver-and-git-service.md](./stories/2-2-source-resolver-and-git-service.md)** — 知识源解析与 Git 服务封装
- **[2-3-four-layer-auth-chain.md](./stories/2-3-four-layer-auth-chain.md)** — 四层认证解析链
- **[2-4-git-clone-and-incremental-update.md](./stories/2-4-git-clone-and-incremental-update.md)** — Git 克隆与增量更新
- **[2-5-aiforge-init-interactive-setup.md](./stories/2-5-aiforge-init-interactive-setup.md)** — aiforge init 交互式配置向导

Epic 3：智能检测与安装规划

- **[3-1-ai-tool-auto-detection.md](./stories/3-1-ai-tool-auto-detection.md)** — AI 工具自动检测
- **[3-2-rule-matching-engine.md](./stories/3-2-rule-matching-engine.md)** — 规则匹配引擎
- **[3-3-dry-run-preview-and-install-plan.md](./stories/3-3-dry-run-preview-and-install-plan.md)** — dry-run 预览与安装计划输出

Epic 4：安装执行与冲突保护

- **[4-1-fs-utils-and-preflight-check.md](./stories/4-1-fs-utils-and-preflight-check.md)** — 文件操作工具与预检查
- **[4-2-copy-mode-install.md](./stories/4-2-copy-mode-install.md)** — 复制模式安装执行
- **[4-3-symlink-and-flatten-mode.md](./stories/4-3-symlink-and-flatten-mode.md)** — 符号链接与 Flatten 模式
- **[4-4-manifest-state-and-conflict-detection.md](./stories/4-4-manifest-state-and-conflict-detection.md)** — manifest 状态管理与冲突检测
- **[4-5-conflict-handling-and-safety.md](./stories/4-5-conflict-handling-and-safety.md)** — 冲突处理与安全保护
- **[4-6a-pipeline-orchestration-and-error-flow.md](./stories/4-6a-pipeline-orchestration-and-error-flow.md)** — 管道完整编排与错误流控制
- **[4-6b-install-result-summary-and-output.md](./stories/4-6b-install-result-summary-and-output.md)** — 安装结果汇总与输出流分工

Epic 5：端到端体验与发布就绪

- **[5-1-phase-progress-and-spinner.md](./stories/5-1-phase-progress-and-spinner.md)** — 阶段式进度与 Spinner 动画
- **[5-2-tree-result-summary-and-stats.md](./stories/5-2-tree-result-summary-and-stats.md)** — 树形结果汇总与统计
- **[5-3-tty-adaptive-and-quiet-mode.md](./stories/5-3-tty-adaptive-and-quiet-mode.md)** — TTY 自适应与 quiet 模式
- **[5-4-three-part-error-messages.md](./stories/5-4-three-part-error-messages.md)** — 三段式错误提示完善
- **[5-5a-i18n-language-selection.md](./stories/5-5a-i18n-language-selection.md)** — 国际化语言选择与配置
- **[5-5b-e2e-integration-tests.md](./stories/5-5b-e2e-integration-tests.md)** — 端到端集成测试
- **[5-5c-mvp-go-nogo-gate.md](./stories/5-5c-mvp-go-nogo-gate.md)** — MVP Go/No-Go 发布门禁验收
- **[5-6-tech-debt-cleanup.md](./stories/5-6-tech-debt-cleanup.md)** — 技术债快速清理与 lint 门禁修正
- **[5-7-regression-test-hardening.md](./stories/5-7-regression-test-hardening.md)** — 回归防护测试补全与 preflight 增强

---

## code-reviews/ — 跨 LLM Code Review 记录

每个 Story 对应一个子目录，内含各轮次的 `summary`（审查报告）和 `evaluation`（评估结论）文件。

| 目录 | Story | 轮次数 |
|------|-------|:------:|
| [1-2-code-review/](./code-reviews/1-2-code-review/) | 核心类型与错误体系 | 1 |
| [1-3-code-review/](./code-reviews/1-3-code-review/) | 输出抽象与路径解析 | 4 |
| [1-4-code-review/](./code-reviews/1-4-code-review/) | 数据层配置 | 2 |
| [1-5-code-review/](./code-reviews/1-5-code-review/) | CLI 入口与管道骨架 | 4 |
| [2-1-code-review/](./code-reviews/2-1-code-review/) | 配置管理服务 | 3 |
| [2-2-code-review/](./code-reviews/2-2-code-review/) | 知识源解析与 Git 服务 | 6 |
| [2-3-code-review/](./code-reviews/2-3-code-review/) | 四层认证链 | 3 |
| [2-4-code-review/](./code-reviews/2-4-code-review/) | Git 克隆与增量更新 | 3 |
| [2-5-code-review/](./code-reviews/2-5-code-review/) | aiforge init 交互式配置 | 4 |
| [3-1-code-review/](./code-reviews/3-1-code-review/) | AI 工具自动检测 | 2 |
| [3-2-code-review/](./code-reviews/3-2-code-review/) | 规则匹配引擎 | 2 |
| [3-3-code-review/](./code-reviews/3-3-code-review/) | dry-run 预览与安装计划 | 2 |
| [4-1-code-review/](./code-reviews/4-1-code-review/) | 文件操作工具与预检查 | 5 |
| [4-2-code-review/](./code-reviews/4-2-code-review/) | 复制模式安装 | 5 |
| [4-3-code-review/](./code-reviews/4-3-code-review/) | 符号链接与 Flatten 模式 | 2 |
| [4-4-code-review/](./code-reviews/4-4-code-review/) | manifest 状态与冲突检测 | 3 |
| [4-5-code-review/](./code-reviews/4-5-code-review/) | 冲突处理与安全保护 | 3 |
| [4-6a-code-review/](./code-reviews/4-6a-code-review/) | 管道编排与错误流控制 | 3 |
| [4-6b-code-review/](./code-reviews/4-6b-code-review/) | 安装结果汇总与输出 | 6 |
| [5-1-code-review/](./code-reviews/5-1-code-review/) | 阶段式进度与 Spinner | 2 |
| [5-2-code-review/](./code-reviews/5-2-code-review/) | 树形结果汇总与统计 | 3 |
| [5-3-code-review/](./code-reviews/5-3-code-review/) | TTY 自适应与 quiet 模式 | 3 |
| [5-4-code-review/](./code-reviews/5-4-code-review/) | 三段式错误提示 | 3 |
| [5-5a-code-review/](./code-reviews/5-5a-code-review/) | i18n 语言选择与配置 | 6 |
| [5-5b-code-review/](./code-reviews/5-5b-code-review/) | 端到端集成测试 | 2 |
| [5-5c-code-review/](./code-reviews/5-5c-code-review/) | MVP Go/No-Go 门禁验收 | 2 |
| [5-6-code-review/](./code-reviews/5-6-code-review/) | 技术债清理与 lint 门禁 | 1 |
| [5-7-code-review/](./code-reviews/5-7-code-review/) | 回归防护测试补全 | 1 |

---

## retrospectives/ — 回顾与评审文档

Epic 回顾

- **[epic-1-retrospective-2026-03-23.md](./retrospectives/epic-1-retrospective-2026-03-23.md)** — Epic 1 项目基础设施回顾
- **[epic-2-retrospective-2026-03-25.md](./retrospectives/epic-2-retrospective-2026-03-25.md)** — Epic 2 知识仓库获取与认证回顾
- **[epic-3-retrospective-2026-03-25.md](./retrospectives/epic-3-retrospective-2026-03-25.md)** — Epic 3 智能检测与安装规划回顾
- **[epic-4-retrospective-2026-03-31.md](./retrospectives/epic-4-retrospective-2026-03-31.md)** — Epic 4 安装执行与冲突保护回顾
- **[epic-5-retro-round1-2026-04-03.md](./retrospectives/epic-5-retro-round1-2026-04-03.md)** — Epic 5 端到端体验回顾（第一轮）
- **[epic-5-retro-final-2026-04-07.md](./retrospectives/epic-5-retro-final-2026-04-07.md)** — Epic 5 端到端体验回顾（最终轮）

Story 审查总结

- **[epic-1-review-summary.md](./retrospectives/epic-1-review-summary.md)** — Epic 1 全部 Story 审查总结
- **[epic-2-review-summary.md](./retrospectives/epic-2-review-summary.md)** — Epic 2 全部 Story 审查总结
- **[epic-3-review-summary.md](./retrospectives/epic-3-review-summary.md)** — Epic 3 全部 Story 审查总结
- **[epic-4-review-summary.md](./retrospectives/epic-4-review-summary.md)** — Epic 4 全部 Story 审查总结
- **[epic-5-review-summary.md](./retrospectives/epic-5-review-summary.md)** — Epic 5 全部 Story 审查总结
- **[epic-overview-2nd-summary.md](./retrospectives/epic-overview-2nd-summary.md)** — Epic 1~5 二次总审查结论

发布门禁

- **[mvp-go-nogo-checklist.md](./retrospectives/mvp-go-nogo-checklist.md)** — MVP Go/No-Go 发布门禁检查清单

---

## cr-rules/ — CR 规则与工作流文档

- **[cr-todo-backlog.md](./cr-rules/cr-todo-backlog.md)** — 跨 Story CR 延迟事项追踪 backlog
- **[CR_RULE_EXTRACTION_CONTEXT.md](./cr-rules/CR_RULE_EXTRACTION_CONTEXT.md)** — CR 规则提炼的文档结构与行号索引
- **[QUICK_REFERENCE_CR_RULES.md](./cr-rules/QUICK_REFERENCE_CR_RULES.md)** — CR 规则分类快速导航速查表
