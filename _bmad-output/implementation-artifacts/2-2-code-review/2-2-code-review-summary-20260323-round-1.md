---
Story: 2-2
Round: 1
Date: 2026-03-23
Model Used: GPT-5.4 (model ID: gpt-5.4)
Type: Code Review Summary
---

# Story 2.2 代码审查总结 — 第 1 轮

## 基本信息

- Story ID: `2-2`
- Story 文件: `_bmad-output/implementation-artifacts/2-2-source-resolver-and-git-service.md`
- 审查类型: 首轮审查
- 审查结论: **Changes Requested**

## 总体结论

本 Story 的 happy path 主流程已经基本成形：

- HTTPS / SSH / SCP-style URL 的正向解析已实现
- `defaultRepo` 回退路径已覆盖
- `createGit()` 的 simple-git 薄封装保持了较小边界
- `npm test` 与 `npm run build` 通过

但当前实现仍未达到可合入状态，原因有三：

1. `resolve-source` 会吞掉配置层的真实错误，把 `CONFIG_CORRUPT` / `CONFIG_READ_FAILED` 误报成 `NO_REPO`
2. 非法 URL 会直接漏出原生 `TypeError`，违反项目统一的 `AiforgeError` 契约
3. Resolve 阶段没有真正通过 `SourceResolver` 抽象调度，且函数签名已偏离现有管道契约

另外，质量门禁当前也未闭环：`npm run lint` 失败。

## 质量门禁

- `npm run lint` ❌
  - `src/stages/resolve-source.ts:41:3`
  - ESLint: `no-useless-catch`
- `npm test` ✅（`249/249`）
- `npm run build` ✅

## 本轮问题

### 1. 高优先级【新发现】：损坏/不可读配置会被吞掉，并被误报为 `NO_REPO`

- 位置：
  - `src/stages/resolve-source.ts:57-79`
  - `src/services/config.ts:14-59`
- 现状：
  - `resolveDefaultRepo()` 对 `loadConfig(pathResolver)` 使用了宽泛 `catch {}`
  - 这会把 `CONFIG_NOT_FOUND`、`CONFIG_CORRUPT`、`CONFIG_READ_FAILED` 等所有配置错误都统一降级成“无默认仓库”
  - 随后函数固定抛出 `AiforgeError(code: 'NO_REPO')`
- 实测：
  - 使用损坏的临时 `config.json`（非法 JSON）调用 `resolveSource()`，最终得到的是：
    - `AiforgeError`
    - `code = 'NO_REPO'`
    - `message = '未指定知识仓库地址'`
  - 而不是 Story 2.1 已定义好的 `CONFIG_CORRUPT`
- 风险：
  - 用户明明已经有配置文件，只是配置损坏/不可读，却会被误导去“重新传 URL”或“运行 init”
  - 破坏 Story 2.1 的错误语义分层
  - 违反 `project-context.md` / `04-implementation-patterns.md` 中“绝不吞掉错误”的规则
- 建议：
  - 仅将 `CONFIG_NOT_FOUND` 视为“无默认配置”
  - 对 `CONFIG_CORRUPT`、`CONFIG_READ_FAILED` 等错误直接透传
  - 补充负向测试，覆盖“损坏 JSON”“权限/读取失败”两条路径

### 2. 中优先级【新发现】：非法 URL 会直接漏出原生 `TypeError`，未收口为 `AiforgeError`

- 位置：
  - `src/stages/resolve-source.ts:87-128`
  - `src/services/git.ts:58-107`
- 现状：
  - `parseSourceUrl()` / `parseGitUrl()` 直接调用 `new URL(url)`
  - 对非法输入（如 `not-a-url`）没有做业务级包装
  - `resolveSource()` 与 `GitSourceResolver.resolve()` 都会直接抛出原生 `TypeError [ERR_INVALID_URL]`
- 实测：
  - `resolveSource('not-a-url', ...)` → `TypeError / ERR_INVALID_URL / Invalid URL`
  - `new GitSourceResolver().resolve('not-a-url')` → 同样的原生错误
- 风险：
  - 违反“所有错误必须使用 `AiforgeError`”的项目规则
  - 管道顶层会把它兜底包装成泛化的 `ERR_UNKNOWN`，丢失“仓库地址非法”的明确诊断
  - 目前测试只覆盖正向 URL，未覆盖非法输入分支
- 建议：
  - 在解析层将非法/不支持的仓库地址统一转换为显式的 `AiforgeError`
  - 给出可执行修复建议（例如示例 URL 格式）
  - 为 CLI 输入和 `defaultRepo` 两个入口都补负向测试

### 3. 中优先级【新发现】：Resolve 阶段没有真正通过 `SourceResolver` 调度，且已偏离当前管道/架构契约

- 位置：
  - `src/stages/resolve-source.ts:34-49`
  - `src/stages/resolve-source.ts:87-135`
  - `src/services/git.ts:21-24`
  - `src/pipeline.ts:57`
  - `_bmad-output/planning-artifacts/architecture/05-project-structure.md:23`
  - `_bmad-output/planning-artifacts/architecture/03-core-decisions.md:28-31`
- 现状：
  - 架构文档把 `resolve-source.ts` 定义为“**SourceResolver 调度**”
  - 但当前 `resolve-source.ts` 并未使用 `GitSourceResolver`，而是在阶段内部复制了一份 URL 解析逻辑
  - 同时：
    - `src/pipeline.ts` 仍声明 `ResolveFn = (args, reporter) => Promise<ResolvedSource>`
    - `src/stages/resolve-source.ts` 实际签名变成了 `(args, reporter, pathResolver)`
    - `src/services/git.ts` 中的 `SourceResolver.resolve()` 也不再与 D1 文档中的 `resolve(source, options)` 形式一致
- 风险：
  - 现在仓库里存在两份解析实现，后续修 bug / 扩协议时极易漂移
  - Resolve 阶段与 `SourceResolver` 抽象没有真正收口，削弱了为未来 `LocalSourceResolver` 预留扩展点的价值
  - Story 4.6a 或后续真正接线到 `pipeline.ts` 时，会立刻遇到签名不一致/临时适配问题
- 建议：
  - 让 `resolve-source.ts` 只负责：
    - 决定使用 CLI URL 还是 `defaultRepo`
    - 选择/调度合适的 `SourceResolver`
  - 将 URL 解析逻辑收口到 `GitSourceResolver`
  - 对 `PathResolver` 依赖采用工厂/闭包注入，保持公开的 stage 签名仍满足 `ResolveFn`
  - 若确实要修改契约，必须同步更新 story / architecture / project-context 中对应描述

## 已确认通过项

- `tests/stages/resolve-source.test.ts` 已覆盖：
  - HTTPS URL
  - SCP-style SSH URL
  - `ssh://` URL
  - `defaultRepo` 正常回退
  - 无配置时抛 `NO_REPO`
- `tests/services/git.test.ts` 已覆盖：
  - `GitSourceResolver.canHandle()`
  - `GitSourceResolver.resolve()`
  - `createGit()` 工厂函数
- `createGit()` 目前保持 thin wrapper，没有过度封装 `simple-git`
- 全量测试与构建通过，说明当前问题主要集中在错误语义与架构收口，而非现有 happy path 回归

## 建议修复顺序

1. 先修 `resolveDefaultRepo()` 的错误吞掉问题，恢复 Story 2.1 的错误语义
2. 再补非法 URL 的 `AiforgeError` 包装与负向测试
3. 收口 Resolve 阶段与 `SourceResolver` / `ResolveFn` 的契约，避免后续 Story 接线时返工
4. 删除无意义的顶层 `try/catch`，重新执行 `npm run lint && npm test && npm run build`

## 最终建议

**本轮结论：Changes Requested。**

当前实现已经完成了大部分正向能力，但错误处理和架构收口仍未闭环；其中“配置损坏被误报为 `NO_REPO`”属于需要优先修正的功能性问题。建议先完成上述 3 项修复，再进入下一轮快速复审。
