---
Story: 5-5a
Round: 1
Date: 2026-04-01
Model Used: GPT-5.4 (model ID: gpt-5.4)
Type: Code Review Summary
---

## 审查结论

本轮为 **第 1 轮首轮审查**。

结论：**不建议通过（Changes Requested）**。当前实现已经完成了 `language` 字段持久化、`setLanguage()/msg()` 基础能力以及部分 phase 文案切换，`npm test`、`npm run lint`、`npm run build` 也全部通过；但 Story 5.5a 的核心验收点是“选择英文后，所有用户可见输出切到英文，并统一通过 messages 模块管理”。这一点目前尚未达成：`init` 本次运行不会即时切换语言，pipeline / reporter / 错误链路仍存在大量硬编码中文，新增测试也主要停留在“language 被保存”，没有覆盖真实英文输出契约。

## 本轮新增问题

### 1. [高] `aiforge init` 选择英文后，本次 init 运行内的提示与结果仍然是中文

- **影响 AC**：#1、#3
- **位置**：
  - `src/commands/init.ts:56-60`
  - `src/commands/init.ts:66`
  - `src/commands/init.ts:80-121`
  - `src/commands/init.ts:177-215`
  - `src/data/messages.ts:105-123`
- **说明**：
  - `messages.ts` 已经定义了 `init.*` 的中英文文案，但 `init.ts` 没有引入 `msg()` / `setLanguage()`，而是继续直接输出和提示中文。
  - 语言选择发生在第一个 `select()`，但选择结果只在保存配置时写入 `language` 字段（`src/commands/init.ts:139-149`），并没有在当前运行中立即调用 `setLanguage(language)`。因此 repo URL、认证方式、Token 提示、SSH/Token 验证结果都不会切到英文。
  - 已有配置场景下也存在同类问题：`loadConfig()` 成功后，“当前配置”摘要和“是否修改当前配置？”会在语言选择前就以中文输出；即使已有 `language: 'en'`，本次 `init` 仍先显示中文。
- **建议**：
  - 在进入交互前先用 `existingConfig?.language` 预加载一次语言；用户在 Step 0 选择新语言后，再立即 `setLanguage(language)`，让后续 prompt / console 输出实时切换。
  - 将 `init.ts` 中全部用户可见字符串改为 `msg('init.*')` 或新增 message keys，而不是直接内联中文。

### 2. [高] “跨 Epic 字符串抽取”没有真正收口，`language = en` 时后续命令仍会输出大量中文

- **影响 AC**：#1、#3、#4
- **位置**：
  - `src/core/reporter.ts:60-70`
  - `src/core/reporter.ts:137-162`
  - `src/core/reporter.ts:184-200`
  - `src/core/reporter.ts:345`
  - `src/core/reporter.ts:375-387`
  - `src/stages/detect-tools.ts:95-112`
  - `src/stages/detect-tools.ts:174-181`
  - `src/services/config.ts:23-40`
  - `src/services/git.ts:111-118`
  - `src/services/git.ts:137-145`
  - `src/services/git.ts:162-169`
  - `src/index.ts:34-44`
- **说明**：
  - 当前英文化只覆盖了 `msg('phases.*')` 这一小部分 phase 文案；而 Reporter 的统计行、计划标题、quiet 输出仍内联中文，错误源（`services/config.ts`、`services/git.ts`、`stages/detect-tools.ts` 等）也仍直接构造中文 `AiforgeError`。
  - `src/index.ts` 的 CLI 参数说明和 `src/commands/init.ts` 的命令描述也仍是硬编码中文帮助文本。
  - 因此即便 `index.ts` 在启动前读取了 `config.language` 并调用 `setLanguage()`，实际用户仍会在 report/result/warn/error/help 等大量入口看到中文；这与 AC #1“后续所有用户可见输出使用英文”和 AC #3“所有用户可见字符串通过 messages 模块的 `msg()` 函数获取”不一致。
  - 这也说明 Story 中“Task 1.7 跨 Epic 字符串抽取已完成”的记录过于乐观：phase 名已切换，但真实生产输出层还没有完成 i18n 收口。
- **建议**：
  - 以“所有 user-visible string source 统一由 message key 驱动”为目标，对 Reporter、错误创建点、诊断输出、CLI help 文案做一次全仓收口，而不是只替换 phase 名。
  - 若 `core/` 不能直接依赖 `data/`，应引入 message provider / formatter 注入层，避免 `reporter.ts` 永久停留在中文内联字符串。

### 3. [中] 测试覆盖主要验证“language 被保存”，没有守住“英文真的被输出”

- **影响 AC**：#1、#4、#5
- **位置**：
  - `tests/commands/init.test.ts:581-654`
  - `tests/core/reporter.test.ts:503-508`
  - `tests/core/reporter.test.ts:804-812`
  - `tests/core/reporter.test.ts:867-931`
  - `tests/stages/authenticate.test.ts:320-340`
  - `tests/stages/resolve-source.test.ts:228-246`
- **说明**：
  - `init` 相关新增测试只验证了 `select` 调用顺序和 `saveConfig()` 最终保存的 `language` 值，并没有断言英文模式下 prompt / console 输出是否真的变为英文。
  - Reporter 测试目前仍明确断言中文统计行与中文计划摘要，例如 `安装:`、`更新:`、`跳过:`、`计划安装:`；这说明 Story 5.5a 的英文输出目标并未被测试体系编码为契约。
  - 入口层也没有测试覆盖 `index.ts` 对非法语言值的 `process.stderr.write()` 提示，以及 `config.language = 'en'` 时 reporter / error / plan 输出是否真的切换语言。
- **建议**：
  - 补充面向真实运行链路的断言：`init` 英文选择后的后续 prompt / 验证结果、`index.ts` 读取 `language = en` 后 reporter/result/error 输出、非法语言回退提示。
  - 将“英文输出契约”落到 reporter / stage / integration 测试，而不是只测 `messages.ts` 的静态数据和 config 持久化。

## AC 复核结论

- **AC #1**：❌ 未满足。`language` 能保存，但“选择英文后所有用户可见输出使用英文”尚未实现：当前 `init` 运行内仍中文，后续命令的 reporter / error / help 也仍大量中文。
- **AC #2**：✅ 满足。未设置语言时默认中文这一路径成立。
- **AC #3**：❌ 未满足。大量用户可见字符串仍未通过 `msg()` 收口。
- **AC #4**：⚠️ 部分满足。`config.language = en` 能驱动部分 phase 文案切换，但并不能贯通所有输出层。
- **AC #5**：✅ 基本满足。非法 `language` 值有回退提示与中文默认；但入口层缺少直接测试覆盖。

## 补充观察

- `Rule Document Registry` 三文档同步未完全收口：`_bmad-output/project-context.md:136-137` 已记录 `init` 的 `console.log` 与 pre-reporter `process.stderr.write()` 例外，但 `_bmad-output/planning-artifacts/architecture/04-implementation-patterns.md:893` 仍保留“所有用户可见输出必须通过 Reporter，不直接 console.log”的绝对表述，镜像规则存在分歧。该问题不影响当前运行结果，但会继续误导后续 Story 实现与 CR 判准。

## 验证记录

本轮已执行并确认：

- `npm test` ✅ `641/641`
- `npm run lint` ✅
- `npm run build` ✅

## 最终建议

建议先修复上述 3 个问题，再进入下一轮 CR。优先级建议：

1. 先让 `init` 真正即时切语言；
2. 再收口 Reporter / 错误链路 / CLI help 的硬编码中文；
3. 最后补齐英文运行时测试与 Rule Document Registry 镜像同步。
