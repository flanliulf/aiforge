---
Story: 6-1
Round: 3
Date: 2026-04-16
Model Used: GPT-5.4 (gpt-5.4)
Type: Code Review Summary
---

## 审查结论

本轮为复审。三层审查均已执行，Round 2 中要求修复的 `--list ""` 分叉问题和 lint 门禁问题已确认关闭，当前 `npm test`、`npm run lint:src`、`npm run build` 全部通过，未发现新的阻塞项或中高优先级回归。本轮建议通过。

## 上轮问题回顾

### 已修复

1. Round 1 / Finding #1 — `--list` 未限制为顶层目录名，允许跨目录列举
   - `src/stages/list-contents.ts:63-72` 现已通过 `LIST_INVALID_INPUT` 拦截 `../..`、`skills/nested`、`.`、`..` 等字符串型非法输入。
   - `tests/stages/list-contents.test.ts:201-262` 已对上述输入建立负向测试守护，复审未见回归。

2. Round 2 / Finding #2 — `--list ""` 会跳过只读分叉并继续进入正常安装管道
   - `src/pipeline.ts:416-420` 现已改为 `args.list !== undefined` 驱动分叉。
   - `src/stages/list-contents.ts:64-66` 已将空字符串和纯空白字符串纳入 `LIST_INVALID_INPUT`。
   - `tests/stages/list-contents.test.ts:248-261` 与 `tests/pipeline.test.ts:476-497` 已新增对应回归测试，复审未见回归。

3. Round 2 / lint 门禁 — `src/core/messages.ts` Prettier 格式问题
   - 本轮实际执行 `npm run lint:src` 已通过，说明上轮评估要求的格式修复已生效。

### 仍为非阻塞待办

1. Round 2 / Finding #1 — 顶层 symlink 仍可把 `--list` 读取导向仓库外目录
   - 维持既有评估结论：P1 CR TODO / 非阻塞。
   - 当前 `src/stages/list-contents.ts:78-82` 仍未做 `lstat` / `realpath` 边界校验；定向复现表明顶层 symlink 仍会被 `readdir` 跟随。

2. Round 1 / Finding #2 — `--list` 的 Commander 解析链路没有真实测试覆盖
   - 维持既有评估结论：P2 CR TODO / 非阻塞。
   - `tests/cli-args.test.ts:23-35` 仍未声明 `--list <dir>`，`tests/pipeline.test.ts:433-497` 的 `--list` 覆盖仍基于手工构造的 `ParsedArgs`。

## 新发现

本轮未发现新的阻塞项或中高优先级问题。

## 验证摘要

- `npm test` ✅ 通过（737 / 737）
- `npm run lint:src` ✅ 通过
- `npm run build` ✅ 通过
- 额外复核：
  - `src/pipeline.ts:416-420` 与 `src/stages/list-contents.ts:64-66` 已共同覆盖空字符串/空白字符串输入，不再退回安装流程。
  - 定向复现确认顶层 symlink 仍会被 `readdir` 跟随，和 Round 2 evaluation 的 P1 TODO 判断一致。
  - `tests/cli-args.test.ts:23-35` 仍未接入真实 `--list` Commander 解析链路，历史 P2 覆盖缺口仍在。

## 通过项

- `src/pipeline.ts:416-420` 的 `--list` 分叉逻辑与 `src/stages/list-contents.ts:63-66` 的输入校验协同工作，Round 2 阻塞修复保持有效。
- `tests/stages/list-contents.test.ts` 现已覆盖字符串型路径输入、空字符串和纯空白字符串，`tests/pipeline.test.ts` 也覆盖了空字符串仍进入 list 分叉的场景。
- `src/core/messages.ts` 当前已满足 Prettier 校验，质量门禁恢复全绿。
- `src/core/reporter.ts` 与 `tests/core/reporter.test.ts` 的 `reportList()` 输出契约保持稳定，未见回归。

## 结论

- **结论：通过**
- **阻塞项**：无
- **建议**：
  - 继续通过 CR TODO 跟踪顶层 symlink 边界问题（P1）和 `--list` CLI 真实解析链路测试缺口（P2）。
  - 若后续安排安全加固或入口层测试补强，可优先处理这两个遗留项。