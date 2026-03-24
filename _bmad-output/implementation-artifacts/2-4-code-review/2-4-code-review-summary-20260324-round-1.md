---
Story: 2-4
Round: 1
Date: 2026-03-24
Model Used: GPT-5.4 (model ID: gpt-5.4)
Type: Code Review Summary
---

# Story 2-4 代码审查总结

## 审查结论

本轮为 **第 1 轮审查**。`src/stages/clone.ts` 的主链路基本完整，`npm run test`（`309/309`）与 `npm run build` 已通过，但当前实现仍存在 **1 个高优先级问题、2 个中优先级问题、1 个低优先级质量门禁问题**。结论：**Changes Requested**，暂不建议按“已完成”收口。

## 本轮核验范围

- Story：`_bmad-output/implementation-artifacts/2-4-git-clone-and-incremental-update.md`
- 实现：`src/stages/clone.ts`
- 测试：`tests/stages/clone.test.ts`
- 相关规则：
  - `_bmad-output/project-context.md`
  - `_bmad-output/planning-artifacts/architecture/03-core-decisions.md`
  - `_bmad-output/planning-artifacts/architecture/04-implementation-patterns.md`
  - `src/pipeline.ts`

## 审查发现

### 1. [高] 克隆失败清理边界过宽，可能删除用户预先存在的非 Git 目录

**证据**

- Story 明确要求“只清理不完整的克隆目录”：`_bmad-output/implementation-artifacts/2-4-git-clone-and-incremental-update.md:16,31,81-106`
- 自定义路径也是正式 AC：`_bmad-output/implementation-artifacts/2-4-git-clone-and-incremental-update.md:15`
- 当前实现仅用 `.git` 是否存在来判断“是否已有仓库”，随后在 fresh clone 失败时直接 `rm(targetDir, { recursive: true, force: true })`：`src/stages/clone.ts:128-140,152-160`
- 现有测试只覆盖“目标目录不存在时 rm 被调用”，没有覆盖“目标目录已存在但不是 Git 仓库”的场景：`tests/stages/clone.test.ts:179-191,197-211`

**影响**

当用户传入一个已存在的 `--clone-dir`，或默认目标路径上已有非 Git 目录时，只要 `git clone` 失败（例如网络中断、目录非空、权限问题），当前实现就会整目录删除。这样清理掉的并不一定是“本次克隆生成的不完整目录”，而可能是用户原本就存在的数据，风险较高。

**建议**

只在“目录由本次克隆尝试创建”或“已确认是本次产生的空/临时目录”时执行删除。至少要把“目标目录原本是否存在”单独记录下来，并为“existing non-git dir + clone failure”补负向测试。

### 2. [中] AC #5 / Task 2.3 未真正落地：token-bearing `cloneUrl` 仍保留在内存对象中

**证据**

- Story 对 NFR-S2 的要求不仅是改写 remote URL，还包括“代码中不再保留可访问的 token-bearing URL 引用”与“将 `source.cloneUrl` 中的 Token 引用置空（内存清除）”：`_bmad-output/implementation-artifacts/2-4-git-clone-and-incremental-update.md:17,35-37,73-75,151`
- 当前实现只做了 `git remote set-url origin <clean-url>`：`src/stages/clone.ts:66-75,138-140`
- `cloneRepo()` 返回前没有修改 `source.cloneUrl`；fresh clone 仍直接使用原始 token URL：`src/stages/clone.ts:120-141,155`
- 现有测试也只验证 `remote set-url` 被调用及 URL 不含 token，没有验证 `source.cloneUrl` 是否已被清理：`tests/stages/clone.test.ts:257-321`

**影响**

虽然 `.git/config` 理论上会被 clean URL 覆盖，但 token-bearing `source.cloneUrl` 仍保留在传入对象里。后续同进程中的日志、异常拼接、调试输出或其他阶段误用，仍有机会接触到原始敏感 URL，这与 Story 对“内存清理”的明确要求不一致。

**建议**

在 remote URL 重写成功后，同步把 `source.cloneUrl` 改写为 clean URL（或做等价的不可再访问处理）；同时补 1 条 stage-level 测试，验证 `cloneRepo()` 返回后传入的 `source.cloneUrl` 不再包含 token。

### 3. [中] Clone 阶段错误处理没有完全遵守全局 `AiforgeError` 契约，部分路径会吞错或退化成 generic `ERR_UNKNOWN`

**证据**

- 全局规则要求：所有错误都应使用 `AiforgeError`，且禁止 `catch {}` 静默吞错：`_bmad-output/project-context.md:101-110`
- `hasLocalRepo()` 对 `access()` 的所有异常一律 `return false`：`src/stages/clone.ts:100-106`
- `sanitizeRemoteUrl()` 与 `scanSourceFiles()` 没有把底层失败包装成 `AiforgeError`：`src/stages/clone.ts:66-75,86-93`
- 这些原始错误最终会在 pipeline 被统一包成通用 `ERR_UNKNOWN`，丢失具体 `why/fix`：`src/pipeline.ts:174-189`

**影响**

如果 `.git` 检查遇到的不是 `ENOENT`，而是权限问题或 I/O 故障，当前实现会把它误判成“本地无仓库”，然后走 fresh clone 路径。另一方面，`remote set-url` / `readdir` 失败时，用户收到的可能只是模糊的 `ERR_UNKNOWN`，拿不到 Story/规则要求的三段式可修复错误信息。这既影响定位，也会放大上一条清理问题的风险。

**建议**

`hasLocalRepo()` 只对白名单错误（至少 `ENOENT`）降级，其他错误直接抛出；`sanitizeRemoteUrl()` / `scanSourceFiles()` 需要定义明确的 `AiforgeError` 码并补对应负向测试。

### 4. [低] 当前 Story 相关质量门禁未全绿，且与 Dev Agent Record 记录不一致

**证据**

- Story 记录写的是 “Lint 无警告无错误”：`_bmad-output/implementation-artifacts/2-4-git-clone-and-incremental-update.md:164-173`
- 实测 `npm run lint` 失败，Prettier 明确指出 `src/stages/clone.ts` 与 `tests/stages/clone.test.ts` 存在格式问题
- 同时，`npm run test` 与 `npm run build` 已通过

**影响**

这不是功能缺陷，但它说明当前 Story 对外宣称的质量门禁状态与仓库实际状态不一致。若团队以 “lint/test/build 全绿” 作为 review-ready 标准，那么本 Story 还没达到稳定收口条件。

**建议**

按仓库现有 Prettier 规则格式化 `src/stages/clone.ts` 和 `tests/stages/clone.test.ts`，重新执行 `npm run lint`，再更新 Story 的 Dev Agent Record。

## 正向观察

- 浅克隆（`--depth 1`）、增量 `pull`、自定义路径、顶层文件扫描等主流程实现思路清晰：`src/stages/clone.ts:33-56,120-141`
- 针对 clone / pull 的基础单测覆盖较完整，核心 happy path 和部分异常路径已具备：`tests/stages/clone.test.ts:76-407`
- 本轮实测：`npm run test` ✅（`309/309`），`npm run build` ✅

## 建议修复顺序

1. 先收紧“失败清理”边界，避免删除预先存在的目录
2. 再补齐 token-bearing `cloneUrl` 的内存清理与测试
3. 最后统一 clone 阶段的错误封装，并补 `ENOENT` 之外的负向测试
4. 修复格式问题后重新执行 `npm run lint && npm run test && npm run build`

## 最终建议

**本轮结论：Changes Requested。**

当前阻塞项不是“浅克隆/增量更新主链路不存在”，而是：**失败清理边界过宽存在数据删除风险、NFR-S2 的内存清理未闭环、错误处理契约不完整**。建议先完成上述修复，再进入下一轮 CR / evaluation。
