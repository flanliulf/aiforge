---
Story: 2-1
Round: 2
Date: 2026-03-23
Model Used: GPT-5.4 (gpt-5.4)
Type: Code Review Summary
---

# Story 2.1 Code Review Summary — Round 2

## 基本信息

- Story ID: `2-1`
- Story 文件: `_bmad-output/implementation-artifacts/2-1-config-management-service.md`
- 审查类型: 复审
- 审查结论: **Changes Requested**

## 总体结论

相较 Round 1，本轮实现已经明显收敛：

- 上轮关于 `auth` 最小结构校验的修复已落地
- 上轮关于测试文件未使用导入的问题已修复
- `npm test`：✅ `221/221`
- `npm run build`：✅ 通过

但当前版本仍**不建议直接通过**，原因有二：

1. 配置服务仍会把部分底层 `fs` 异常原样向上抛出，破坏项目要求的 `AiforgeError` 统一错误契约。
2. 仓库级 `npm run lint` 仍失败；这次不是 ESLint，而是 `src/services/config.ts` 未通过 Prettier。

因此本轮结论仍为 **Changes Requested**。

## 上轮问题复核结果

### 1. `loadConfig()` 缺少最小结构校验

**已修复。**

当前 `src/services/config.ts:47-58` 已新增 `isValidConfigStructure()` 校验，能够拦截以下几类此前会漏过的输入：

- `{}`（缺少 `auth`）
- `{ "auth": null }`
- `{ "auth": [] }`

对应测试也已补齐：`tests/services/config.test.ts:87-115`。

### 2. 测试文件未使用导入导致 ESLint 失败

**已修复。**

`afterEach` / `HostAuth` 未使用导入已移除；本轮未再观察到对应 ESLint 报错。

不过，**仓库级 lint 尚未恢复为绿灯**：本轮发现的是新的 Prettier 格式问题，详见下方 Finding #2。

## 本轮问题

### 1. 中优先级【新发现】：配置服务仍会向上泄露原生 `fs` 错误，违反 `AiforgeError` 契约

- 位置：
  - `src/services/config.ts:19-30`
  - `src/services/config.ts:74-76`
  - `src/services/config.ts:94-97`
  - `tests/services/config.test.ts:80-85`
  - `src/pipeline.ts:174-188`

当前实现只对 `ENOENT` 和非法 JSON 做了专门映射；其余 `readFile()` 异常在 `src/services/config.ts:30` 被直接 `throw err`，而 `saveConfig()` / `ensureConfigDir()` 的写入、重命名、`chmod`、目录检查失败也都会直接冒泡为原生异常。测试甚至显式把这种行为固化为预期：`tests/services/config.test.ts:80-85` 断言 `EACCES` 应当“as-is” 抛出。

这与项目规则“**ALL errors MUST use `AiforgeError`**”不一致。实际影响是：

- 走 `pipeline` 时，这些原生异常只会在顶层被包装成通用 `ERR_UNKNOWN`（`src/pipeline.ts:180-188`），丢失配置场景下本应有的 `what / why / how to fix` 信息。
- 后续 `aiforge init` 属于**不走 pipeline** 的命令路径，若复用 `saveConfig()`，则更可能直接把 Node 原生错误暴露给用户。

**建议：**

- 将非 `ENOENT` 的配置读写异常也统一包装为 `AiforgeError`
- 至少覆盖：读取失败、目录创建失败、临时文件写入失败、`rename` 失败、`chmod` 失败
- 同步调整测试，删除“unexpected fs errors as-is”的断言，改为验证统一错误契约与可操作修复建议

### 2. 中优先级【新发现】：`src/services/config.ts` 未通过 Prettier，仓库级 lint 仍失败

- 位置：
  - `src/services/config.ts:65-68`
  - `src/services/config.ts:82-85`
  - `src/services/config.ts:115-118`

本轮验证结果：

- `npm test` ✅
- `npm run build` ✅
- `npm run lint` ❌
- `npx prettier --check src/services/config.ts` ❌

失败原因不是逻辑错误，而是代码格式未收敛。Prettier 已明确给出差异，主要是函数签名和布尔表达式换行与仓库格式规则不一致。

这意味着虽然功能路径已通过测试，但当前 story 仍**没有通过仓库既有质量门禁**，不能视为完成态。

**建议：**

- 对 `src/services/config.ts` 执行 Prettier 格式化
- 之后重新执行完整 `npm run lint`

## 已确认通过项

- `loadConfig()` 现在可以拒绝缺少/损坏 `auth` 容器结构的配置
- `saveConfig()` 仍保持 `tmp -> rename -> chmod(0o600)` 的主流程
- 多 host 认证读取路径正常：`getHostAuth()` 相关用例通过
- `tests/services/config.test.ts` 当前共 `15` 个测试全部通过
- 全量测试通过：`221/221`
- 构建通过：`npm run build`

## 建议修复顺序

1. 先统一配置服务的异常包装，恢复 `AiforgeError` 契约与三段式修复提示。
2. 再执行 Prettier 格式化并跑通 `npm run lint`。
3. 完成后发起下一轮 CR；若上述两点修复到位，Story 2.1 很可能可以收口。

## 最终建议

**本轮结论：Changes Requested。**

上轮指出的两项问题均已处理，但本轮新增的“错误契约未闭环”与“Prettier 门禁失败”仍需要修复后再进入下一轮复审。
