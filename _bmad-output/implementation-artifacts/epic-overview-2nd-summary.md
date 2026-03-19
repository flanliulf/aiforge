# Epic 1 ~ 5 二次总审查结论

## 审查范围

- 复核文件：
  - `_bmad-output/implementation-artifacts/epic-1-review-summary.md`
  - `_bmad-output/implementation-artifacts/epic-2-review-summary.md`
  - `_bmad-output/implementation-artifacts/epic-3-review-summary.md`
  - `_bmad-output/implementation-artifacts/epic-4-review-summary.md`
  - `_bmad-output/implementation-artifacts/epic-5-review-summary.md`
- 重点核对：各文件末尾追加的“实际修正总结”是否与当前 story / 架构文档一致
- 抽查对象：相关 story 文档、`project-context.md`、`architecture/03-core-decisions.md`

## 审查方法

本次不是重复首轮审查，而是做“修订正确性复核”：

1. 提取 5 份 review summary 末尾声明的修正项
2. 回到实际 story / 架构文件核对关键语句是否真正落地
3. 判断这些修正是否：
   - 真正关闭了首轮问题
   - 仍然只停留在局部修补
   - 是否引入新的跨文档冲突

## 总体结论

**结论：本轮修订整体方向正确、落实度高，较首轮明显收敛；但还不能判定为“全部问题已完全关闭”，当前状态应定为：有条件通过。**

可以确认，团队已经真正解决了大量一轮审查中的核心问题，尤其是在以下方面：

- `Reporter` 接口补齐了 `reportPlan()` / `warn()`，并同步回架构文档
- Epic 2 中 `HostAuth`、Token URL、`CONFIG_CORRUPT` 分流、init 重复 URL 解析等问题大体已收口
- Epic 3 中工具检测语义、`-l` 项目级拒绝、dry-run 验收边界已显著改善
- Epic 4 中 conflict 判定矩阵、`unknown-origin` / `user-modified` 区分、manifest 职责边界已有实质修正
- Epic 5 中 i18n 范围、E2E 真实矩阵、Go/No-Go 验证“看最终产物而非绑定实现手段”的方向是正确的

但同时，二次复核也确认：**仍有 2 组关键契约没有完全收口**，它们会继续影响 Epic 4 / 5 的一致性判断。

## 分 Epic 复核结论

### Epic 1

**结论：基本通过**

- `Reporter` 接口与架构文档同步补齐，属于真实落地修正
- 首轮最关键的跨 Epic 问题（`warn()` / `reportPlan()` 缺口）已被关闭
- `1.3` 的工具路径语义仍偏“先定义一套自身约定，再由后续 story 解释业务含义”，但已不构成当前主阻塞

### Epic 2

**结论：有条件通过**

- `HostAuth`、Token URL、`CONFIG_CORRUPT` 分流、复用 `GitSourceResolver` 等修正均已落地
- 但 `2.5` 明确写成“init 继续使用 `console.log`，不复用 Reporter”，这与全局基线仍存在冲突（见后文“未完全关闭的问题 #2”）

### Epic 3

**结论：通过**

- `3.1` 的检测语义、`3.2` 的 PathResolver 收口、`3.3` 的 dry-run 边界和 `-l` 拒绝逻辑，均已较好修复
- 这是本轮修订里**收口质量最好**的一组 story

### Epic 4

**结论：有条件通过**

- conflict 签名、冲突类型、manifest/pipeline 责任分工，整体修正方向正确
- 但“错误模型 / 结果模型”并未真正全局统一：
  - `4.6a` 明确写“Install 不存在 partial，InstallResult 只有 new/updated/skipped”
  - 但 `4.2` 仍保留 `status: 'failed'`
  - `4.6a` 的测试任务仍写着“partial 错误继续”
  - `4.6b` 仍按 `failed` 统计和输出

### Epic 5

**结论：有条件通过**

- `5.3` 的 Reporter 工厂签名修正是正确的
- `5.5b` / `5.5c` 对测试矩阵和 packlist 验证的修正也是正确的
- 但 Epic 5 仍继承了 Epic 4 与全局基线未收口的问题：
  - `5.2` / `5.3` 仍在使用 `failed` 统计口径
  - `5.5a` 为 `process.stderr.write()` 和 init `console.log` 引入例外，但全局规则文档未同步承认这些例外

## 已确认关闭的主要问题

以下问题可视为**已真正关闭**：

1. `Reporter` 缺失 `reportPlan()` / `warn()`
2. Epic 2 的 Token URL 格式不一致
3. Epic 2 对 `CONFIG_CORRUPT` 的吞错问题
4. Epic 3 的检测路径语义冲突
5. Epic 3 中项目级 `-l` 静默降级问题
6. Epic 4 中 `checkConflict()` 签名和冲突类型定义不清
7. Epic 5 中 E2E 理想化 4×4 矩阵问题
8. Epic 5 中 Go/No-Go 绑定 `.npmignore` 的问题

## 未完全关闭的关键问题

### 1. 错误模型 / 结果模型仍未全局统一

当前文档中同时存在两套口径：

- **口径 A（Epic 4 修订后）**
  - Install 阶段无 `partial`
  - `InstallResult` 只有 `new / updated / skipped`

- **口径 B（全局基线与部分 story 仍保留）**
  - `project-context.md`：`severity: 'fatal' | 'partial'`
  - `architecture/03-core-decisions.md`：仍写 `partial` 继续
  - `4-2-copy-mode-install.md`：仍写 `status: 'failed'`
  - `4-6b-install-result-summary-and-output.md`：仍统计 `failed`
  - `5-2`、`5-3`：仍以 `failed` 为统计口径

**判断：这说明“错误语义统一”只完成了局部修订，没有完成全局基线收口。**

### 2. 输出规则的例外处理未正式写回全局规则

当前文档中同时存在两套口径：

- `project-context.md` 明确要求：**所有用户可见输出必须通过 Reporter，禁止直接 `console.log`**
- 但修订后的 story 又明确保留：
  - `2.5`：init 使用 `console.log`
  - `5.5a`：语言回退阶段允许 `process.stderr.write()`
  - `5.5a`：init 继续 `console.log`，但文案来源改为 `msg()`

**判断：这些例外本身未必错误，但它们必须被提升为“正式全局规则例外”，否则仍然属于文档级自相矛盾。**

## 最终判定

### 最终结论

**本轮修订可以判定为：大部分修正正确，且显著提升了 Story 准备质量；但 Epic 1 ~ 5 目前仍不宜宣告“全部审查问题已关闭”。正式状态建议标记为：有条件通过。**

### 交付建议

建议在正式封板前，再做**最后一轮小范围一致性修订**，只收口以下两件事：

1. **统一错误/结果模型**
   - 二选一，不要并存：
     - 要么保留 `partial` / `failed`
     - 要么彻底移除它们，并同步更新 `project-context.md`、`03-core-decisions.md`、`4.2`、`4.6b`、`5.2`、`5.3`
   - 以当前修订方向看，**更建议统一到：Install fail-fast，InstallResult 只有 `new / updated / skipped`**

2. **把输出规则例外正式写回全局基线**
   - 明确声明以下是否为正式允许例外：
     - Reporter 创建前的语言回退提示
     - `aiforge init` 的交互式输出
   - 如果允许，就更新 `project-context.md` / 架构文档
   - 如果不允许，就回退 story 中的 `console.log` / `stderr.write` 方案

## 建议的最终动作

如果要把这批 Story 作为“最终可开发版本”移交，我建议顺序如下：

1. 先修 `project-context.md`
2. 再同步 `architecture/03-core-decisions.md`
3. 然后统一修 `4.2`、`4.6a`、`4.6b`、`5.2`、`5.3`、`2.5`、`5.5a`
4. 最后再做一次只针对“契约一致性”的快速复核

完成这一步后，再宣布 Epic 1 ~ 5 全部 story 审查收口，会更稳妥。

---

> **注意：以上内容为二次审查的历史分析记录。最终结论以下方"最终修正记录"与"最终状态"为准。**

---

## 最终修正记录（2026-03-18）

基于上述二次审查结论，已按建议顺序完成最后一轮一致性修订。

### 修正 #1：统一错误/结果模型

**决策：Install fail-fast，InstallResult 只有 `new` / `updated` / `skipped`，移除 `partial` 和 `failed`。**

修改文件及内容：

| 文件 | 修正内容 |
|------|---------|
| `project-context.md` | `severity` 改为只有 `'fatal'`；移除 `partial → 收集继续` 规则；新增 `InstallResult` 三状态说明；统计行和图标移除 `failed` |
| `architecture/03-core-decisions.md` | D4a 决策表改为 `fatal only`；`AiforgeError.severity` 类型改为 `'fatal'`；移除 `partial → 收集错误继续执行`；补充 `InstallResult` 三状态说明 |
| `1-4-data-layer-configuration.md` | Task 4.2 移除 `ICON_FAILED` |
| `1-5-cli-entry-and-pipeline-skeleton.md` | 移除 Task 2.7 partial 错误收集；测试用例移除 partial 错误收集；Dev Notes 示例移除 partial 注释 |
| `4-2-copy-mode-install.md` | `InstallResult` 类型移除 `'failed'` 和 `error?` 字段；Task 1.7 移除 `'failed'`；References 移除 partial |
| `4-3-symlink-and-flatten-mode.md` | 断链检测过滤条件移除 `status !== 'failed'` |
| `4-6a-pipeline-orchestration-and-error-flow.md` | 测试用例移除"partial 错误继续" |
| `4-6b-install-result-summary-and-output.md` | `buildStats()` 移除 `failed` 计数；`STATUS_ICONS` 移除 `ICON_FAILED` |
| `5-2-tree-result-summary-and-stats.md` | 移除 failed 项红色输出任务；统计行移除 `失败: N 项`；示例移除 `❌` 失败项和 `失败` 统计；chalk 示例移除 `failedItem` |
| `5-3-tty-adaptive-and-quiet-mode.md` | PlainReporter 示例移除 `failed: 0`；QuietReporter 示例移除 `失败: 0 项` |
| `5-5a-i18n-language-selection.md` | 中英文统计行模板移除 `{failed}` / `Failed` |

### 修正 #2：输出规则例外正式写回全局基线

**决策：正式承认两个允许例外，写入 `project-context.md`。**

| 文件 | 修正内容 |
|------|---------|
| `project-context.md` | Output Rules 新增 `Exceptions (formally allowed)` 子节，声明：(1) `aiforge init` 交互式命令允许 `console.log` + `@inquirer/prompts`；(2) Reporter 创建前的语言回退提示允许 `process.stderr.write()` |

### 修正覆盖验证

修正完成后执行全文搜索验证：

- Story 文件中不再有活跃的 `status: 'failed'`、`ICON_FAILED`、`partial 错误收集/继续` 残留（包括 Story 描述、AC、示例输出、测试任务和 Task 清单）
- 仅 review-summary 和本文件中保留历史审查记录中的引用（属于正常的审查历史描述）
- `project-context.md` 和 `architecture/03-core-decisions.md` 两份全局基线已完全统一

### 最终状态

**二次审查提出的 2 个未关闭问题现已全部关闭。Epic 1 ~ 5 全部 Story 审查正式收口。**