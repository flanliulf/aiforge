---
Story: 5-5c
Round: 1
Date: 2026-04-02
Model Used: GPT-5.4 (gpt-5.4)
Type: Code Review Summary
---

## 审查结论

首轮审查。`npm test` 与 `npm run build` 通过，但项目标准 `npm run lint` 未通过；同时发布门禁文档对 B5 安全门禁与 Warning 汇总的表述存在与仓库实际状态不一致的问题。当前存在 **2 个中优先级阻塞项**，**暂不建议通过**。

## 新发现

### 1. [中] B5“npm 包无仓库地址/Token”结论与实际入包内容不一致

- **证据**
  - Story AC 明确要求“npm 包中不包含公司域名、仓库地址、Token 或其他敏感信息（NFR-S1）”：`_bmad-output/planning-artifacts/epics/epic-5.md:202-209`
  - 项目安全规则同样要求“**npm package MUST contain ZERO company info** — no repo URLs, tokens, hostnames”：`_bmad-output/project-context.md:150-153`
  - 5-5c 验收清单将 B5 标记为“✅ 通过”，并宣称“仅 4 个文件入包，无公司信息”：`_bmad-output/implementation-artifacts/mvp-go-nogo-checklist.md:18`, `_bmad-output/implementation-artifacts/mvp-go-nogo-checklist.md:54-55`
  - 但 `npm pack --dry-run --json` 显示 `README.md` 会随包一起发布：`package.json:19-20`, `README.md`, `npm pack --dry-run --json -> files[0].path = "README.md"`
  - 已入包的 `README.md` 仍包含仓库 URL / host / token 示例：`README.md:91`, `README.md:176-183`, `README.md:192-199`

- **影响**
  - 当前“B5 已通过 / npm 包不含仓库地址或 Token”的结论不成立，Go/No-Go 记录对发布安全状态产生误报。
  - 由于 README 随 tarball 一并发布，门禁检查如果只看 packlist 文件名而不看文件内容，会漏掉实际发布产物中的敏感边界信息。

- **建议**
  - 将 B5 复核逻辑从“只检查 packlist 文件名”升级为“检查 packlist + 每个入包文件内容”，至少覆盖 `README.md`、`package.json`、`dist/**`。
  - 在修复前，将 5-5c 文档中的 B5 结论改为未通过或待复核；若项目接受示例域名/占位 token 出现在 README，需要先明确放宽 NFR-S1 / Security Rules 的边界定义并同步规则文档。
  - 补 1 条发布门禁自动检查，直接扫描 `npm pack --json` 列出的所有文件内容，防止后续再次误判。

### 2. [中] 门禁文档把未验证项和 lint 失败写成已通过，Go 结论不可追溯

- **证据**
  - 验收清单中 `W1` / `W2` 在表格里标记为“⚠️ 未验证”：`_bmad-output/implementation-artifacts/mvp-go-nogo-checklist.md:30-31`
  - 同一文档的 Warning 汇总却写成“**4/4 已验证（W1/W2 依赖真实网络环境，本次为已知限制）**”：`_bmad-output/implementation-artifacts/mvp-go-nogo-checklist.md:35`
  - Story Dev Agent Record 声称 “Lint：ESLint exit 0，Prettier src/tests 全绿”：`_bmad-output/implementation-artifacts/5-5c-mvp-go-nogo-gate.md:146`
  - 但项目标准 lint 脚本实际是 `eslint . && prettier --check .`：`package.json:12-17`
  - 实际执行 `npm run lint` 返回退出码 `1`，Prettier 对跟踪中的 `.gemini/**` 等文件报出大量格式问题，末尾为 `Code style issues found in 339 files.`。

- **影响**
  - AC #2 要求“每一项门禁都有明确状态：通过 / 未通过 / 阻塞，并附风险说明”：`_bmad-output/planning-artifacts/epics/epic-5.md:211-214`
  - 当前 5-5c 记录把“未验证”汇总成“已验证”，又把局部检查结果写成项目标准 lint 通过，导致 Go/No-Go 结论缺乏可追溯性，评审者无法据此准确判断发布门禁状态。

- **建议**
  - 将 W1/W2 汇总改为“2/4 已通过，2/4 未验证（已知限制）”或等价准确表述。
  - 将 lint 记录改成“项目标准 `npm run lint` 未通过；如果只验证 `src/` / `tests/`，需明确写为局部检查结果，不能替代仓库标准门禁”。
  - 若发布门禁只关心发布产物相关路径，需在 Story / 项目规则里显式定义“发布 lint 门禁”的脚本范围，再据此输出 Go/No-Go 结论。

## 验证摘要

- `npm test` ✅（692 / 692）
- `npm run lint` ❌
  - `eslint . && prettier --check .`
  - Prettier 对跟踪中的 `.gemini/**` 等文件报出 339 个格式问题，退出码 1
- `npm run build` ✅
- 定向复核 ❌
  - `npm pack --dry-run --json` 显示 `README.md` 会随包发布
  - `README.md` 中仍包含仓库 URL / host / token 示例，和 B5“已通过”结论不一致
  - `mvp-go-nogo-checklist.md` 中 W1/W2 与 Warning 汇总存在自相矛盾

## 通过项

- Story 5.5c 已按目标产出独立的发布门禁清单文档，Blocker / Warning / 已知限制 / 上线边界结构完整：`_bmad-output/implementation-artifacts/mvp-go-nogo-checklist.md`
- 与 5-5c 相关的核心测试资产存在且当前全绿，覆盖了 `init`、`dry-run`、冲突处理、零结果诊断、退出码、i18n 等关键旅程。
- `npm pack --dry-run` 的产物边界本身较收敛，当前仅发布 `README.md`、`dist/index.d.ts`、`dist/index.js`、`package.json` 四个文件。
