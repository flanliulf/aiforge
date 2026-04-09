---
Story: 5-7
Round: 1
Date: 2026-04-03
Model Used: GPT-5.4 (gpt-5.4)
Type: Code Review Summary
---

## 审查结论

首轮审查。`npm test`（708/708）、`npm run lint`、`npm run lint:src`、`npm run build` 均通过，但仍存在 1 个阻塞问题：AC #3 要求的**入口层 TTY 判定回归守护**未真正落地，当前测试只覆盖 `createReporter()` 工厂本身，未执行 `src/index.ts` 中 `process.stderr.isTTY === true` 的传参逻辑；因此本轮**不建议通过**。

## 新发现

### 1. [中] AC #3 未真正覆盖入口层 stderr TTY 绑定

- **证据**
  - `src/index.ts:78-80` 的真实契约位于入口层：`createReporter({ quiet: args.quiet, isTty: process.stderr.isTTY === true })`。这才是 Story 需要守护的 `stdout.isTTY=false && stderr.isTTY=true` 判定来源。
  - `tests/core/reporter.test.ts:1193-1200` 明确写明“直接测试 createReporter 工厂函数…入口层绑定 stderr 的正确性由代码审查和此测试的命名/注释共同保证”，说明当前测试**没有执行入口层**。
  - `tests/core/reporter.test.ts:1210-1260` 的 3 个新增用例全部直接调用 `createReporter({ quiet: false, isTty: true/false })`，传入的是硬编码布尔值，而不是通过 `src/index.ts` 在 `process.stdout.isTTY` / `process.stderr.isTTY` 组合下推导出的参数。

- **影响**
  - 如果后续有人把 `src/index.ts:80` 改回 `process.stdout.isTTY === true`，当前测试仍会全绿，`aiforge ... > result.txt` 一类 stdout 被重定向、stderr 仍在终端的场景会错误选择 PlainReporter/禁用 spinner。
  - AC #3 明确要求的是**入口层测试**，当前实现只验证了工厂行为，未形成对入口 wiring 的自动化回归保护，Story 仍未满足验收标准。

- **建议**
  - 在入口层新增测试，真实覆盖 `src/index.ts` 的 reporter 创建路径：mock `process.stdout.isTTY = false`、`process.stderr.isTTY = true`，spy `createReporter`，断言收到 `isTty: true`；并补反向场景 `stderr.isTTY = false` → `isTty: false`。
  - 若顶层脚本难以直接单测，可先抽取一个窄辅助函数（仅负责 `isTty` 推导和 reporter 创建参数组装），再对该入口辅助函数做测试，而不是继续只测 `createReporter()` 工厂。

## 验证摘要

- `npm test` ✅ 通过（708 / 708）
- `npm run lint` ✅ 通过
- `npm run build` ✅ 通过
- 定向复核 ❌ 发现 1 个阻塞问题
  - `src/index.ts:78-80` 与 `tests/core/reporter.test.ts:1193-1260` 对照后确认：新增测试仅覆盖工厂分支，不覆盖入口层 `stderr.isTTY` 绑定逻辑。
  - `src/services/fs-utils.ts:492-501` 与 `tests/services/fs-utils.test.ts:375-385,575-613` 已覆盖 `PATH_NOT_DIRECTORY` 生产错误码、message/fix 与英文 i18n。
  - `tests/integration/pipeline-production-stages.test.ts:401-452` 已专门断言 `reporter.reportResult()` 收到的 `items[].sourcePath` 为 repo-relative 路径。
  - `tests/integration/pipeline.test.ts:788-1051` 已补 copilot / vscode / cursor:project 的 match + install E2E 断言，覆盖 Story 要求的规则扩展面。
  - `npm run lint:src` ✅ 通过。

## 通过项

- AC #1：`src/services/fs-utils.ts:492-501` 在普通文件目标路径场景提前抛出 `PATH_NOT_DIRECTORY`，不再延迟到 `ensureDir` 才报 `ENSURE_DIR_FAILED`；相关负向/i18n 测试已补齐（`tests/services/fs-utils.test.ts:375-385,575-613`）。
- AC #2：`tests/integration/pipeline-production-stages.test.ts:401-452` 已直接守住 `createProductionStages().report` 的 repo-relative `sourcePath` 语义。
- AC #4：`tests/integration/pipeline.test.ts:788-1051` 已新增 copilot:global / copilot:project / vscode:global / cursor:project 的全链路 E2E，达到 Story 要求的扩展覆盖面。
- AC #5：质量门禁保持绿色，测试、全仓 lint、定向 lint、构建均通过。
