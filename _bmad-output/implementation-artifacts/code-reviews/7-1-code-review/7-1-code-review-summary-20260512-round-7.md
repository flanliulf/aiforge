---
Story: 7-1
Round: 7
Date: 2026-05-12
Model Used: GPT-5.5 (github-copilot/gpt-5.5)
Type: Code Review Summary
---

## 审查结论

本轮为复审（Round 7）。三层审查（Blind Hunter / Edge Case Hunter / Acceptance Auditor）全部正常返回，无失败审查层。Round 6 的 4 项修复主体已落地：migration 主步骤已明确要求安装 GitHub Copilot 扩展并创建 `~/.copilot/` marker，CHANGELOG 已改为 Copilot context 检测，AC #3 中英文测试断言已加强，`detectTools` 调用处注释已清理，Story 7-1 相关修复文件已进入 staged 范围。

本轮未发现 [高] 阻塞项。仍发现 3 个建议发布前修复的中/低优先级问题，集中在迁移文档对 `.github` 项目级检测、warning 触发条件、`.vscode/mcp.json` 与实际 Files 复制行为的精确表述，以及测试语言状态清理健壮性。

## 上轮问题回顾

### 已修复

1. Round 6 / Finding #1 — migration 文档与 CHANGELOG 暗示“安装 Copilot 扩展后即可被检测”
   - 修复位置：`docs/migration-v2.md:46-54` / `docs/migration-v2.zh.md:46-54` 已明确“安装扩展 + 创建 `~/.copilot/` marker”。
   - 修复位置：`CHANGELOG.md:15` 已改为 “aiforge detects the Copilot context (via `~/.copilot/` marker or project `.github/`)”。
   - 验证结果：主路径已闭合；但文档后续段落仍有局部残留和 `.github` 条件说明缺口，见本轮发现 #1。

2. Round 6 / Finding #2 — AC #3 回归测试断言过弱
   - 修复位置：`tests/stages/detect-tools.test.ts:481-482` 已改为精确断言 `GitHub Copilot 扩展`。
   - 修复位置：`tests/stages/detect-tools.test.ts:502-518` 已新增英文 `Install the GitHub Copilot extension` 断言。
   - 验证结果：AC #3 文案门禁已增强；测试语言状态清理建议见本轮发现 #3。

3. Round 6 / Finding #3 — `detectTools` 调用处注释残留“或项目级 .vscode/”旧语义
   - 修复位置：`src/stages/detect-tools.ts:196-197` 已改为只描述 home 级 `~/.vscode/`。
   - 验证结果：注释与实现、测试已对齐。

4. Round 6 / Finding #4 — staged 状态不完整
   - 修复位置：`git diff --cached --name-status -- <Story 7-1 相关文件>` 显示核心代码、测试、文档、规则文档均已 staged。
   - 验证结果：Story 7-1 相关交付文件的 staged 完整性已闭合。

### 仍为非阻塞待办

1. Round 4 / Finding #2 — Unicode 同形字符与 NFC/NFD 规范化风险
   - 维持既有评估结论：CR TODO / 非阻塞。

2. Round 4 / Finding #4 — 全部 reserved-skip 时 `ensureDir(item.targetPath)` 仍可能创建空目录
   - 维持既有评估结论：CR TODO / 非阻塞。

3. Round 5 / Finding #4 延伸项 — Story 7-10 补全多工具矩阵端到端集成测试
   - 维持为 Story 7-10 延伸覆盖项；Story 7-1 已有最小 `.vscode/server.json` 端到端断言。

## 新发现

### 1. [中][新] migration 文档对 Copilot 检测与 warning 触发条件仍不完全准确

- **来源**：edge+auditor
- **分类**：patch

- **证据**
  - 迁移步骤主路径已写明创建 marker：`docs/migration-v2.md:46-54` / `docs/migration-v2.zh.md:46-54`。
  - 后续仍写 “aiforge will now detect GitHub Copilot (if installed)”：`docs/migration-v2.md:62`；中文为“检测 GitHub Copilot（如已安装）”：`docs/migration-v2.zh.md:62`。
  - Copilot 实际检测路径包含 `~/.copilot/` 和项目 `.github/`，CHANGELOG 已承认该口径：`CHANGELOG.md:15`。
  - 文档写“如果检测到 `~/.vscode/` 但未检测到 `~/.copilot/`，将显示 warning”：`docs/migration-v2.md:70` / `docs/migration-v2.zh.md:70`。
  - 代码实际还要求 `!detectedTools.includes('copilot')`；如果项目 `.github/` 存在，Copilot 会被检测到，即便 `~/.copilot/` 不存在也不会输出 `vscodeMergedNote`：`src/stages/detect-tools.ts:196-199`。

- **影响**
  - 用户按文档可能仍把“安装扩展”误认为检测条件，而不是 `~/.copilot/` marker 或项目 `.github/`。
  - 存在项目 `.github/` 的用户可能符合“`~/.vscode/` 存在且无 `~/.copilot/`”的文档条件，但实际不会看到 warning；这是文档承诺与代码行为的不一致。
  - 该问题影响 AC #4 的 migration 指引精确性，非运行时阻塞。

- **建议**
  - 将 `docs/migration-v2.md:62` / `.zh.md:62` 改为“detect the Copilot context via `~/.copilot/` marker or project `.github/`”。
  - 将 warning 条件改写为“当未检测到 Copilot context，且存在 home `~/.vscode/` 但不存在 `~/.copilot/` 时显示 warning”。
  - 中英文同步修改，避免与 `src/stages/detect-tools.ts:196-199` 再次偏离。

### 2. [中][新] 文档多处写死 `.vscode/mcp.json`，但当前 Files 规则和集成测试实际写入 `.vscode/server.json`

- **来源**：blind
- **分类**：decision_needed

- **证据**
  - Story AC #2 与文档口径多处使用 `.vscode/mcp.json` 作为项目级 MCP 配置名称：`_bmad-output/implementation-artifacts/stories/7-1-vscode-merge-and-mvp-rules-completion.md:20-22`，`docs/migration-v2.md:29` / `docs/migration-v2.md:75` / `docs/migration-v2.md:107-115`。
  - 当前规则只是 `sourceDir: 'mcp-tools'` + `type: Files` + `targetDir: '.vscode/'`，不会重命名源文件：`src/data/install-rules.ts:73-76`。
  - 当前 fixture 源文件为 `tests/fixtures/sample-repo/mcp-tools/server.json`，集成测试断言目标是 `.vscode/server.json`：`tests/integration/pipeline.test.ts:958-960`。

- **影响**
  - 如果产品契约是固定生成 `.vscode/mcp.json`，当前实现和测试没有满足该文件名契约。
  - 如果产品契约是“把 mcp-tools 目录中的文件复制到 `.vscode/`”，文档中反复写 `.vscode/mcp.json` 会误导用户以为固定只管理一个文件。
  - 该问题需要产品/规格口径裁决：修文档泛化为 `.vscode/<mcp-tools 文件>`，还是调整实现/fixture 产出 `.vscode/mcp.json`。

- **建议**
  - 推荐先裁决目标契约：固定 `.vscode/mcp.json` vs 保持 Files 复制语义。
  - 若保持现有 Files 复制语义：将迁移文档与 warning 中的 `.vscode/mcp.json` 改为 `.vscode/` 或 `.vscode/<mcp-tools 文件名>`，并在 install-rules matrix 说明文件名沿用源文件。
  - 若要求固定 `.vscode/mcp.json`：需要调整规则/安装逻辑或 fixture，并把集成测试改为断言 `.vscode/mcp.json`。

### 3. [低][新] 英文语言切换测试未使用 `finally` / `afterEach` 恢复语言，失败时可能污染后续测试

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - 既有英文 UNKNOWN_TOOL 测试在末尾调用 `setLanguage('zh-CN')`：`tests/stages/detect-tools.test.ts:385-405`。
  - 新增英文 vscodeMergedNote 测试同样在末尾调用 `setLanguage('zh-CN')`：`tests/stages/detect-tools.test.ts:502-518`。
  - 两处都没有 `try/finally` 或文件级 `afterEach(() => setLanguage('zh-CN'))` 兜底。

- **影响**
  - 如果英文模式测试在清理前断言失败，模块级语言状态会保持 `en`，后续中文断言可能级联失败，增加定位成本。
  - 这不是产品运行时缺陷，但影响测试稳定性和失败可诊断性。

- **建议**
  - 在该测试文件增加 `afterEach(() => setLanguage('zh-CN'))`，或把两处 `setLanguage('en')` 用 `try/finally` 包裹。
  - 若添加 `afterEach`，可删除测试内部重复清理注释或保留为冗余保护。

## 验证摘要

- `npm test` 本轮未重新执行（CR 只读复审）；Round 6 修复记录显示 ✅ 通过（853 / 853）。
- `npm run lint:src` 本轮未重新执行；Round 6 修复记录显示 ✅ 通过。
- `npm run build` 本轮未重新执行；Round 6 修复记录显示 ✅ 通过。
- 额外复核：
  - 三层审查全部返回，无失败层。
  - `git diff HEAD -- <Story 7-1 相关文件>` 已用于本轮审查输入。
  - `git diff --cached --name-status -- <Story 7-1 相关文件>` 显示核心修复文件已 staged。

## 通过项

- Round 6 的 4 项修复主体已闭合：主迁移步骤、CHANGELOG 检测口径、AC #3 中英文测试断言、`detectTools` 注释、staged 完整性均有证据。
- `vscode` 工具删除、`BUILTIN_RULES` 19 条、`package.json` 2.0.0、`.vscode/server.json` 最小端到端断言等主实现未发现新回归。
- `vscodeMergedNote` 当前代码文案包含安装 GitHub Copilot 扩展指引，且 legacy 提示仅按 home 级 `~/.vscode/` 触发。
- Rule Document Registry 中 `project-context.md` 的 reserved-name 规则边界已补齐。
- `--force` FAQ 误导性措辞已修正。

## 结论

- **结论：不通过**
- **阻塞项**：无 [高] 级阻塞项；但发现 #1 和 #2 属于 AC #4 / AC #2 交付口径问题，建议 Story 7-1 完成前修复或裁决。
- **建议**：先修正文档中残留的 Copilot 检测/警告条件表述；裁决 `.vscode/mcp.json` 是否为固定契约并同步文档或实现；为语言切换测试增加清理兜底。随后进入 Round 8 快速复审。
