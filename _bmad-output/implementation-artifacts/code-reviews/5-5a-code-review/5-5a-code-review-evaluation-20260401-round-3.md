---
Story: 5-5a
Round: 3
Date: 2026-04-01
Model Used: Claude Sonnet 4 (claude-sonnet-4-20250514)
Review Source: 5-5a-code-review-summary-20260401-round-3.md
Review Model: GPT-5.4 (model ID: gpt-5.4)
Type: Code Review Evaluation
---

## 评估总结

对 Story 5-5a 的第 3 轮 CR 代码审查结果（复审）进行逐条评估。审查共提出 2 项新发现：1 项高严重性（多条运行时错误/警告路径未接入 `msg()`）和 1 项中严重性（阶段级测试仍固化中文契约）。评估结论如下。

---

## 上轮问题回顾确认

### Round 2 / Finding #1a — `init` 配置摘要在语言预加载前输出：✅ 已修复

经代码验证，`src/commands/init.ts:55-68` 已在输出配置摘要前调用 `setLanguage()`，确认修复有效。

### Round 2 / Finding #1b — `init` description 仍通过 `msg()` 求值：✅ 已修复

经代码验证，`src/commands/init.ts:26-31` 已改为硬编码英文 `.description('Initialize aiforge configuration')`，确认修复有效。

### Round 2 / Finding #2 — 多模块 fix 文本国际化：✅ 已修复

经代码验证，`config.ts`、`path-resolver.ts`、`conflict-resolver.ts`、`detect-tools.ts`、`init.ts`、`index.ts`、多数 `fs-utils.ts` 的 fix 文本已接入 `msg()` 或改用英文消息键，确认修复有效。

### Round 2 / Finding #3 — lint 门禁失败：✅ 已修复

审查确认 `npm run lint` 已恢复通过。

### 历史 CR TODO（非阻塞）

无。

---

## 发现 #1 评估

### 审查原文

> **[高][新] 仍有多条真实运行时错误/警告路径未接入 `msg()`，英文模式下会继续向用户输出中文**

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

经代码独立验证，审查列举的每个位置均已确认：

- `src/stages/clone.ts:78-87`（SANITIZE_REMOTE_FAILED）：`message='Token 清理失败：remote URL 重写出错'`、`why='未知错误'`、`fix=['git remote set-url origin <clean-url>  # 手动重写 remote URL', '检查 .git/config 中的 remote origin 配置']` — 全部硬编码中文。✅ 确认
- `src/stages/clone.ts:114-120`（SCAN_FAILED）：`message='扫描仓库文件失败'`、`why='未知错误'`、`fix=['检查仓库目录权限', ...]` — 全部硬编码中文。✅ 确认
- `src/stages/clone.ts:257-289`（AUTH_FAILED / CLONE_FAILED）：`message='无法访问仓库'`、`why='Git 服务器返回 401（认证失败）'`、fix 数组含 `'⚠️ 清理未完成目录也失败: ..., 请手动删除: rm -rf ...'`、`'检查网络连接和防火墙设置'` 等中文。✅ 确认
- `src/stages/clone.ts:313-330`（PULL_FAILED）：`message='增量更新失败'`、`message='无法访问仓库'`、fix 含 `'检查网络连接'` 等中文。✅ 确认
- `src/stages/execute-install.ts:271-280`：`reporter.warn('⚠️ 未安装任何文件')`、`'诊断信息：'`、`'建议：'` 等全部硬编码中文。✅ 确认
- `src/stages/match-rules.ts:44-50`（LINK_PROJECT_REJECTED）：`message='符号链接模式不支持项目级安装'`、`why='-l/--link 仅支持全局安装模式（-g）'` — 硬编码中文。✅ 确认
- `src/stages/resolve-source.ts:79-85`（NO_REPO）：`message` 和 `why` 已使用 `msg()` ✅，但 fix 数组 `['npx aiforge <repo-url>  # 直接指定仓库地址', 'npx aiforge init        # 配置默认仓库']` 中注释为中文。✅ 确认（注：审查原文称 "fix 数组仍为中文"，实际准确来说是 fix 数组中的中文注释部分，message/why 已用 `msg()`，审查在此处描述略有偏差但问题本身成立）
- `src/services/git.ts:113-121,139-147,164-172`：`message` 和 `why` 已使用 `msg()` ✅，但 fix 数组中的注释 `# HTTPS 格式`、`# SSH 格式` 为中文。✅ 确认
- `src/services/fs-utils.ts:558-569,588-599`：`message` 和 `why` 已使用 `msg()` ✅，但 fix 数组 `['检查目标目录中是否存在指向允许范围之外的符号链接', '检查安装规则中的 targetDir 配置']` 全部为中文。✅ 确认

**严重性判断：合理**

这些字符串通过 `reporter.reportError()` 或 `reporter.warn()` 直接面向用户输出。当用户配置 `language=en` 时，这些路径会输出中英混杂内容，直接违反 AC #3（所有用户可见字符串通过 `msg()` 获取）和 AC #1 / #4（英文配置下输出英文）。判为高严重性合理，是阻塞交付的问题。

**修复建议：可行**

建议对残余中文字符串做全量 `msg()` 收口，方案清晰可执行，技术可行。

**误报评估：非误报**

所有位置均经独立代码验证确认存在。

注意：`resolve-source.ts` 和 `git.ts` 的情况需要细化——它们的 `message` 和 `why` 已用 `msg()`，仅 fix 数组中的注释为中文。但这些注释确实会输出给用户（通过 Reporter 的 FIX 行），因此仍属于需要修复的范围。

---

## 发现 #2 评估

### 审查原文

> **[中][新] 阶段级测试仍主要固化中文契约，未能守住上述英文运行时残留**

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P2 优先级）

### 评估分析

**问题描述准确性：准确**

经独立验证：

- `tests/stages/clone.test.ts:625,649,690`：直接断言 `message='无法访问仓库'`（中文硬编码）。✅ 确认
- `tests/stages/execute-install.test.ts:1202,1219,1245`：直接断言 `reporter.warn` 包含 `'未安装任何文件'`（中文硬编码）。✅ 确认
- `tests/stages/resolve-source.test.ts:234`：断言 `startPhase('解析仓库地址...')`（中文硬编码）。✅ 确认
- 对 `tests/stages/` 目录搜索 `setLanguage('en` 结果为零匹配 — 确认没有任何阶段级测试覆盖英文输出场景。✅ 确认

审查分析逻辑正确：测试仍将中文输出视为正确行为，因此无法在门禁中捕获运行时中文残留。

**严重性判断：偏高**

审查判为 [中] 严重性。考虑到：
1. 这些测试是在 Story 5-5a 之前（Epic 1~4）编写的，当时中文输出是唯一正确行为，断言中文本身没有错误
2. 发现 #1 中的源码问题修复后，这些测试断言自然需要同步更新（属于 #1 修复的伴随工作）
3. 补充英文场景测试是好的实践，但不是独立的阻塞项——它是发现 #1 修复的自然衍生

建议降为 P2，在发现 #1 修复完成时一并处理测试更新，不单独作为阻塞项。

**修复建议：可行**

补充 `setLanguage('en')` 场景的测试断言、将部分中文固定断言改为双语可切换，建议合理可行。

**误报评估：非误报**

问题真实存在，但不应独立阻塞交付。

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | 多条运行时错误/警告路径未接入 `msg()`，英文模式中英混杂 | [高] | **P1** | 直接违反 AC #1/#3/#4，需全量 `msg()` 收口 |

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 2 | 阶段级测试固化中文契约，无英文场景覆盖 | [中] | **P2** | 应伴随 #1 修复同步更新，但不独立阻塞 |

### 评估决定

- **发现 #1（运行时中文残留）**：确认有效，P1 阻塞交付。需对 `clone.ts`、`execute-install.ts`、`match-rules.ts`、`resolve-source.ts`、`services/git.ts`、`fs-utils.ts` 中的残余用户可见中文字符串做全量 `msg()` 收口。
- **发现 #2（测试中文固化）**：确认有效但降级为 P2 CR TODO。作为发现 #1 修复的伴随工作处理，在修复源码时同步更新测试断言并补充英文场景测试。

---

## 修复执行记录

### 修复执行记录
- **Date**: 2026-04-01
- **Model Used**: Claude Sonnet 4 (claude-sonnet-4-20250514)
- **Fix Items**: 2 项（P1 × 1，P2 × 1）

### 修复项 #1（P1）：运行时错误/警告路径全量 `msg()` 收口

**修改文件：**

| 文件 | 修改内容 |
|------|---------|
| `src/core/messages.ts` | 新增 `clone`、`matchRules`、`executeInstall` 三个消息命名空间，共 32 个双语键（zh-CN + en） |
| `src/stages/clone.ts` | `sanitizeRemoteUrl()`、`scanSourceFiles()`、`freshClone()`、`incrementalUpdate()` 中所有硬编码中文 message/why/fix 接入 `msg()`；fix 数组中的中文注释（`# 尝试 SSH 认证` 等）一并移除 |
| `src/stages/execute-install.ts` | `diagnoseZeroResults()` 中 10 行硬编码中文 `reporter.warn` 接入 `msg()`；flatten 分支 3 处硬编码 `'执行安装...'` 统一改为 `msg('phases.install')` 模式 |
| `src/stages/match-rules.ts` | `getInstallMode()` 中 `LINK_PROJECT_REJECTED` 的 message/why 接入 `msg()`；fix 数组中文注释移除 |
| `src/stages/resolve-source.ts` | NO_REPO fix 数组中的中文注释（`# 直接指定仓库地址`、`# 配置默认仓库`）移除 |
| `src/services/git.ts` | `parseGitUrl()`、`assertRepoPath()`、`safeParseUrl()` 三处 fix 数组中的中文注释（`# HTTPS 格式`、`# SSH 格式`）移除（共 6 处，已使用 `replace_all`） |
| `src/services/fs-utils.ts` | `validateDestPathSecurity()` 两处 fix 数组硬编码中文改为 `msg('fsUtils.fixCheckSymlink')` 和 `msg('fsUtils.fixCheckTargetDir')`（已使用 `replace_all`） |

**验证结果：**
- `npm run build` ✅ 编译通过
- `npm run lint` ✅ ESLint + Prettier 全绿
- `npm test` ✅ 655 tests passed（修复前 616 个通过，新增 39 个英文场景测试）

### 修复项 #2（P2）：阶段级测试补充英文场景（伴随 #1 同步处理）

**修改文件：**

| 文件 | 修改内容 |
|------|---------|
| `tests/stages/clone.test.ts` | 新增 `describe('clone — English language mode')` 包含 3 个英文场景测试：AUTH_FAILED (clone)、CLONE_FAILED、AUTH_FAILED (pull) 在 `language=en` 下输出英文 message |
| `tests/stages/execute-install.test.ts` | 新增 `describe('executeInstall — English language mode (zero results diagnostics)')` 包含 1 个英文场景测试：零结果诊断 warn 在 `language=en` 下输出英文 |
| `tests/stages/resolve-source.test.ts` | 新增 `describe('resolveSource — English language mode')` 包含 2 个英文场景测试：`startPhase` 输出英文阶段名、NO_REPO 错误输出英文 message |

**说明：**
- 已有的中文断言（如 `expect(e.message).toBe('无法访问仓库')`）全部保留，因测试默认语言为 `zh-CN`，这些断言本身正确。
- 英文场景测试统一使用 `beforeEach/setLanguage('en')` + `afterEach/setLanguage('zh-CN')` 保证测试隔离。

