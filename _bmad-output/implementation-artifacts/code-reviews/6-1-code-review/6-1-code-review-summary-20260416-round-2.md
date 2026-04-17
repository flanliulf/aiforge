---
Story: 6-1
Round: 2
Date: 2026-04-16
Model Used: GPT-5.4 (gpt-5.4)
Type: Code Review Summary
---

## 审查结论

本轮为复审。上轮阻塞项中，基于字符串的 `../..` / `skills/nested` 输入绕过已通过 `LIST_INVALID_INPUT` 校验修复，但当前实现仍存在 2 个新的中优先级问题：顶层 symlink 可将 `--list` 读取导向仓库外目录，且 `--list ""` 会绕过只读分叉并落入正常安装管道；同时历史 P2 CLI 解析链路测试缺口仍未关闭。`npm test` 和 `npm run build` 通过，`npm run lint:src` 因 `src/core/messages.ts` Prettier 格式问题失败。本轮建议不通过。

## 上轮问题回顾

### 已修复

1. Round 1 / Finding #1 — `--list` 未限制为顶层目录名，允许跨目录列举
   - `src/stages/list-contents.ts:63-72` 新增 `LIST_INVALID_INPUT` 输入校验，已拒绝 `../..`、`skills/nested`、`.`、`..` 这类字符串型路径输入。
   - `tests/stages/list-contents.test.ts:201-246` 已新增 5 个负向用例并验证 `readdir` 不会被调用。

### 仍为非阻塞待办

1. Round 1 / Finding #2 — `--list` 的 Commander 解析链路没有真实测试覆盖
   - 维持既有评估结论：CR TODO / 非阻塞。
   - `tests/cli-args.test.ts:23-35` 仍未声明 `--list <dir>`，对应端到端解析用例仍缺失。

## 新发现

### 1. [中][新] 顶层 symlink 仍可把 `--list` 读取导向仓库外目录

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `src/stages/list-contents.ts:63-81` 只校验输入字符串，不校验 `targetDir` 的真实路径或是否为 symlink；随后直接对 `join(repo.repoDir, args.list!)` 执行 `readdir`。
  - `tests/stages/list-contents.test.ts:201-246` 的新增防护测试只覆盖字符串型路径输入，没有顶层 symlink 场景。
  - 定向复现：在临时仓库中创建 `repo/skills -> outside/` symlink 后，对 `join(repoDir, 'skills')` 执行 `readdir` 会返回仓库外目录条目 `secret-dir`；说明当前实现仍会跟随 symlink 枚举外部目录。

- **影响**
  - 上轮阻塞项只修复了参数字符串层面的绕过，未修复文件系统层面的边界缺失。恶意或异常仓库仍可通过顶层 symlink 让 `--list` 泄露仓库外目录结构。

- **建议**
  - 在 `readdir` 前对 `targetDir` 做 `lstat` / `realpath` 校验，拒绝顶层 symlink，或至少确保解析后的真实路径仍位于 `repo.repoDir` 内且为直接子目录。
  - 增加“顶层目录是指向仓库外目录的 symlink”负向测试，确保进入读取前就拦截。

### 2. [中][新] `--list ""` 会跳过只读分叉并继续进入正常安装管道

- **来源**：edge
- **分类**：patch

- **证据**
  - `src/pipeline.ts:64` 原样保留 `opts['list']`，`src/pipeline.ts:416-419` 仅用 `if (args.list)` 控制是否进入 `listContents` 分叉。
  - `tests/cli-args.test.ts:23-35` 的 Commander 测试桩未声明 `--list`，因此没有覆盖显式空字符串场景。
  - 定向复现：Commander 解析 `--list ""` 的结果为 `{"list":"","hasOwn":true}`，说明“选项已显式提供但值为空字符串”是可达输入；在当前实现下它会因 falsy 判断跳过 `--list` 分叉。

- **影响**
  - 用户或脚本若把目录变量展开为空字符串，命令会从本应“只读列举”的语义退回正常安装流程，安装相关 flags 也不再被静默忽略，存在误安装风险。

- **建议**
  - 在 CLI 映射或 `runPipeline()` 分叉前把空字符串 / 全空白值统一视为 `LIST_INVALID_INPUT`。
  - 分叉条件不要依赖 truthy；应区分“未提供 `--list`”和“提供了无效的 `--list` 值”。
  - 补充 `--list ""` 与空白字符串输入的 CLI 集成测试。

## 验证摘要

- `npm test` ✅ 通过（734 / 734）
- `npm run lint:src` ❌ 失败
  - `src/core/messages.ts` 存在 Prettier 格式问题，当前 lint 门禁未全绿
- `npm run build` ✅ 通过
- 额外复核：
  - 历史修复项回归验证 ✅ `tests/stages/list-contents.test.ts:201-246` 已覆盖 `../..`、`skills/nested`、`.`、`..` 等字符串型非法输入
  - symlink 越界复现 ✅ 仓库顶层 symlink 指向外部目录时，`readdir(join(repoDir, 'skills'))` 仍会返回仓库外目录条目
  - 空字符串分叉复现 ✅ Commander 会把 `--list ""` 解析为已提供但值为空字符串，当前 truthy 判断会跳过 list 分叉
  - 性能要求 ⚠ 仍无缓存命中 `< 2s` 的实测证据，本轮未新增性能结论

## 通过项

- `src/stages/list-contents.ts:63-72` 的新增输入校验已阻断上轮确认的字符串型路径绕过。
- `tests/stages/list-contents.test.ts:201-246` 的负向测试对 `LIST_INVALID_INPUT` 新分支形成了回归守护。
- `tests/pipeline.test.ts` 仍覆盖了正常 `--list` 分叉和错误上报主路径。
- `src/core/reporter.ts` 和对应测试维持上轮通过状态，QuietReporter 的无标题无序号输出仍符合 Story 说明。

## 结论

- **结论：不通过**
- **阻塞项**：
  - 顶层 symlink 仍可把 `--list` 读取导向仓库外目录
  - `--list ""` 会跳过只读分叉并继续进入正常安装管道
- **建议**：
  - 先补齐真实路径边界校验和空字符串输入校验，再做下一轮复审
  - 历史 CLI 解析链路测试缺口继续保留为非阻塞 TODO，但建议在修上述问题时一并补上