---
Story: 6-1
Round: 1
Date: 2026-04-16
Model Used: GPT-5.4 (gpt-5.4)
Type: Code Review Summary
---

## 审查结论

首轮审查。三层审查均已执行，`npm test`、`npm run lint:src`、`npm run build` 全部通过，但仍存在 1 个中优先级路径边界问题和 1 个低优先级测试覆盖缺口。本轮建议不通过。

## 新发现

### 1. [中] `--list` 未限制为顶层目录名，允许跨目录列举

- **来源**：edge
- **分类**：patch

- **证据**
  - `src/stages/list-contents.ts:65` 直接对 `join(repo.repoDir, args.list!)` 执行 `readdir`，未校验 `args.list` 是否为单个顶层目录名。
  - `src/pipeline.ts:417-418` 只要 `args.list` 为 truthy 就进入 list 分叉，因此 `--list ../..`、`--list skills/nested` 等输入都会走到该路径。

- **影响**
  - 偏离 Story 对“顶层目录名”的约束，能够列举嵌套目录。
  - 在包含 `..` 或路径分隔符的输入下，可越出仓库根目录读取本地目录结构，属于路径边界缺失。

- **建议**
  - 限制 `--list` 仅接受单个顶层目录名，拒绝包含 `/`、`\\`、`.`、`..` 等路径段的值。
  - 对解析后的目标路径再做一次 `relative` / `realpath` 校验，确保目标仍位于 `repo.repoDir` 下且是直接子目录。
  - 增加 `../..`、`skills/nested`、`.` 的负向测试用例。

### 2. [低] `--list` 的 Commander 解析链路没有真实测试覆盖

- **来源**：blind
- **分类**：patch

- **证据**
  - `src/index.ts:45` 新增了 `.option('--list <dir>', 'list installable subdirectories under a top-level dir')`。
  - `tests/cli-args.test.ts:23-35` 的本地 Commander 定义只覆盖到 `--clone-dir <path>`，没有同步加入 `--list`。
  - `tests/pipeline.test.ts:435-471` 使用的是手工构造的 `ParsedArgs`，不会覆盖 Commander → `mapOptsToArgs()` 的真实解析链路。

- **影响**
  - 如果后续 `src/index.ts` 的选项名、取值名或 `mapOptsToArgs()` 的映射发生漂移，当前测试集不会报警，CLI 入口存在回归盲区。

- **建议**
  - 在 `tests/cli-args.test.ts` 增加 `--list skills` 和 `repo-url + --list skills` 场景，直接验证 Commander → `mapOptsToArgs()` 的完整链路。

## 验证摘要

- `npm test` ✅ 通过（729 / 729）
- `npm run lint:src` ✅ 通过
- `npm run build` ✅ 通过
- 定向复核 ⚠ 未执行真实远端缓存命中场景的耗时测量，AC 4 目前只有设计说明与功能分叉测试，无性能实测证据

## 通过项

- `src/pipeline.ts` 已在 clone 后对 `--list` 做分叉，且 `tests/pipeline.test.ts` 已验证不会进入 detect / match / install。
- `src/stages/list-contents.ts` 已覆盖正常列举、空目录、ENOENT / ENOTDIR 和 EACCES 分支，错误码 `LIST_DIR_NOT_FOUND` 也有真实入口测试。
- `src/core/reporter.ts` 的三种 Reporter 都补齐了 `reportList()`，并通过了对应单测；整体质量门禁保持全绿。