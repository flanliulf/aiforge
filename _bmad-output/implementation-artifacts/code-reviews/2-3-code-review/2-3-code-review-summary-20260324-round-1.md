---
Story: 2-3
Round: 1
Date: 2026-03-24
Model Used: GPT-5.4
Type: Code Review Summary
---

# Story 2-3 代码审查总结

## 审查结论

本轮为**第 1 轮审查**。当前实现的主体链路可工作，`npm run build` 与 `npm run test` 均通过，但仍存在 **1 个高优先级问题、2 个中优先级问题、1 个低优先级测试覆盖缺口**。结论：**暂不建议按“已完成”状态收口，建议修复后再进入下一环节。**

## 本轮核验范围

- Story：`_bmad-output/implementation-artifacts/2-3-four-layer-auth-chain.md`
- 实现：`src/stages/authenticate.ts`
- 测试：`tests/stages/authenticate.test.ts`
- 相关规则：
  - `_bmad-output/project-context.md`
  - `_bmad-output/planning-artifacts/architecture/03-core-decisions.md`
  - `_bmad-output/planning-artifacts/architecture/04-implementation-patterns.md`
  - `_bmad-output/implementation-artifacts/2-1-config-management-service.md`
  - `_bmad-output/implementation-artifacts/2-5-aiforge-init-interactive-setup.md`

## 审查发现

### 1. [高] `authenticate()` 过度吞掉配置错误，违反既有错误处理约束

**证据**

- `src/stages/authenticate.ts:92-117` 把 `CONFIG_NOT_FOUND`、`CONFIG_CORRUPT`、`CONFIG_READ_FAILED` 一并降级到 Layer 4。
- `_bmad-output/planning-artifacts/architecture/04-implementation-patterns.md:100-117` 明确要求：降级必须是特例，示例只允许对 `CONFIG_NOT_FOUND` 做降级，其余默认透传。
- `_bmad-output/implementation-artifacts/2-1-config-management-service.md:17` 明确 `CONFIG_NOT_FOUND` 由调用方负责提示；`CONFIG_CORRUPT` / `CONFIG_READ_FAILED` 并无“静默降级”豁免。

**影响**

当配置文件损坏或权限异常时，用户不会收到明确配置错误，而是被悄悄降级到 `credential-manager`。这会掩盖真实根因，使后续认证失败表现成“凭据问题”而不是“配置损坏/不可读”，与项目的错误透传规则冲突。

**建议**

仅对 `CONFIG_NOT_FOUND` 做“无默认配置”降级；对 `CONFIG_CORRUPT`、`CONFIG_READ_FAILED` 继续抛出，让 pipeline 统一走 `reportError`。

### 2. [中] 认证优先级链遗漏 `preferSSH` 全局回退，和架构/前置 Story 不一致

**证据**

- `_bmad-output/planning-artifacts/architecture/03-core-decisions.md:65-79` 定义了完整链路：CLI > 环境变量 > `auth[host]` > `preferSSH` > 系统凭据。
- `_bmad-output/implementation-artifacts/2-1-config-management-service.md:44-53` 同样写明 `preferSSH` 是全局默认认证偏好，并进入优先级链。
- `_bmad-output/implementation-artifacts/2-5-aiforge-init-interactive-setup.md:116-128` 在用户选择 SSH 时会写入 `config.preferSSH = true`。
- `src/stages/authenticate.ts:91-128` 在 per-host 配置后直接降级到 `credential-manager`，完全没有读取 `config.preferSSH`。

**影响**

若用户在 `aiforge init` 中设置了 SSH 偏好，但访问的是“没有 per-host 显式配置的新 host”，当前实现不会按设计回退到 SSH，而会直接走 `credential-manager`。这会让 `preferSSH` 字段处于“被保存但不生效”的状态。

**建议**

需要统一 Story 2-3 与架构文档的口径。若 D3 / Story 2.1 仍为准，则应在 Layer 3 和 Layer 4 之间补上 `preferSSH` 回退；若产品决定只保留四层，则应同步修正文档，避免跨文档规则漂移。

### 3. [中] 当前分支 `npm run lint` 失败，和 Story 中“Lint clean”记录不一致

**证据**

- 实测：`npm run lint` 失败，Prettier 报 `tests/stages/authenticate.test.ts` 格式不符合规范。
- 差异位置在 `tests/stages/authenticate.test.ts:138-141` 与 `tests/stages/authenticate.test.ts:187-189`。
- Story 记录 `_bmad-output/implementation-artifacts/2-3-four-layer-auth-chain.md:171` 写的是 “Lint clean”。

**影响**

虽然 `build/test` 已通过，但质量门禁并未实际通过，当前 Story 不能稳定满足“可合并”标准，且 Dev Agent Record 与实际状态不一致。

**建议**

按仓库现有 Prettier 结果格式化该测试文件，并重新执行 `npm run lint` 更新 Story 记录。

### 4. [低] AC #7 的单测没有真正验证 stage 级别的脱敏行为

**证据**

- `tests/stages/authenticate.test.ts:268-280` 仅直接调用 mock 的 `sanitizeToken()`，验证的是 mock 自身输出。
- 同文件没有断言 `authenticate()` 调用了 `sanitizeToken()`，也没有断言 `reporter.updatePhase(...)` 中出现的是脱敏 token。

**影响**

如果后续有人误把 `reporter.updatePhase` 改成输出原始 token，或删掉 `sanitizeToken()` 调用，这组测试依然会通过，无法真正守住 AC #7 的安全回归。

**建议**

补 1 条 stage-level 测试：走环境变量分支，断言 `sanitizeToken()` 被调用，且 `mockReporter.updatePhase` 收到的是脱敏后的 token，而不是原文。

## 正向观察

- `src/stages/authenticate.ts` 的主链路结构清晰，CLI / env / per-host / credential-manager 的基本分层实现可读性较好。
- `npm run build` 通过。
- `npm run test` 通过，当前共 `285` 个测试通过，未见回归。

## 建议结论

建议先修复 **配置错误处理范围** 与 **lint 失败**，并确认 `preferSSH` 是否属于本 Story 应实现的正式要求；完成后再进入下一轮 CR / evaluation 更稳妥。
