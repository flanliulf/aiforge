# MVP Go/No-Go 发布门禁

**验证日期：** 2026-04-02
**验证人：** Dev Agent (Amelia) — Story 5.5c
**产品版本：** aiforge v0.1.0
**构建状态：** `npm run build` ✅ 通过 (dist/index.js 108.05 KB)

---

## Blocker 级别（必须全部 ✅）

| # | 门禁项 | 状态 | 验证方式 | 备注 |
|---|--------|------|---------|------|
| B1 | 新员工首次配置旅程 | ✅ 通过 | 手动 + E2E 测试 | 见下方旅程验证 §3.1 |
| B2 | dry-run 一致性 | ✅ 通过 | E2E 测试通过 | NFR-U5；3 条专项 E2E 测试全绿 |
| B3 | 冲突备份保护 | ✅ 通过 | E2E 测试通过 | FR-028；备份名 `*.aiforge-backup-YYYYMMDD` |
| B4 | 零结果诊断（双分支） | ✅ 通过 | E2E 测试通过 | FR-032；`resultItems.length === 0` 场景触发诊断；「全 skipped」场景视为成功路径输出成功摘要 |
| B5 | npm 包安全审计 | ✅ 通过 | 入包文件内容扫描（CR Round-1 修复后） | NFR-S1；README.md 认证示例已替换为通用占位符，入包 4 个文件内容均无敏感信息 |
| B6 | E2E 测试全部通过 | ✅ 通过 | vitest --run | 30 测试文件 / 692 用例，全部通过 |
| B7 | 退出码正确性 | ✅ 通过 | 单测 + 手动验证 | 0/1/2/3 均有测试覆盖 |

**Blocker 汇总：7/7 通过 ✅**

---

## Warning 级别（建议通过）

| # | 门禁项 | 状态 | 验证方式 | 备注 |
|---|--------|------|---------|------|
| W1 | 首次克隆 < 30s | ⚠️ 未验证 | 需实际 Git 仓库手动计时 | NFR-P1；E2E 使用本地 fixture，无法验证实际克隆性能 |
| W2 | 增量更新 < 15s | ⚠️ 未验证 | 需实际 Git 仓库手动计时 | NFR-P2；同上 |
| W3 | 工具扫描 < 500ms | ✅ 通过 | 测试计时 | NFR-P5；detect-tools 测试耗时 10ms，远低于 500ms 阈值 |
| W4 | 中英文输出完整 | ✅ 通过 | 单测验证 | FR-046；4 条 i18n 专项测试全绿（Reporter 统计行、错误标签均已切换） |

**Warning 汇总：2/4 通过，2/4 未验证（已知限制：W1/W2 依赖真实网络环境，无法在 E2E 中自动化验证）**

---

## 详细验证记录

### §2 安全审计（Task 2）

#### 2.1 npm pack 产物清单

```
npm pack --dry-run 输出（2026-04-02，CR Round-1 修复后重新验证）：
- README.md        (8.2 kB)
- dist/index.d.ts  (20 B)
- dist/index.js    (111.7 kB)
- package.json     (948 B)
总计 4 个文件，打包后 28.4 kB
```

> ⚠️ 注意：`README.md` 是 npm 硬编码始终包含的文件，无法通过 `.npmignore` 或 `files` 字段排除。
> 正确的验证方法是**扫描入包文件的实际内容**，而非扫描 `npm pack` 的输出流（输出流仅含文件名和大小）。

**正确验证方法（扫描入包文件实际内容）：**

```bash
# 扫描 README.md 内容（硬编码入包）
grep -in "gitlab\|wshoto\|glpat" README.md

# 扫描 dist/index.js 内容（构建产物）
grep -in "wshoto\|glpat-" dist/index.js

# 扫描 package.json
grep -in "repository\|bugs\|homepage\|gitlab\|wshoto\|glpat" package.json
```

**验证结果（CR Round-1 修复后，2026-04-02）：**
- `README.md`：认证示例已替换为通用占位符（`your-git-host.com`、`<your-access-token>`），无 `gitlab`、`glpat-` 内容 ✅
- `dist/index.js`：无敏感域名/Token ✅
- `package.json`：无 `repository`、`bugs`、`homepage` 等公司信息字段 ✅

#### 2.2 产物边界验证

包含文件：`dist/` 目录 + npm 硬编码文件（`README.md`、`package.json`）

不包含：
- `tests/` — ✅ 未入包
- `src/` — ✅ 未入包
- `tsconfig.json`、`eslint.config.js`、`tsup.config.ts`、`vitest.config.ts` — ✅ 未入包
- `_bmad-output/`、`node_modules/` — ✅ 未入包

#### 2.3 package.json 字段审计

检查 `repository`、`bugs`、`homepage`、`author` 字段 → **均不存在** ✅

package.json 关键字段：
```json
{
  "name": "aiforge",
  "version": "0.1.0",
  "license": "MIT",
  "keywords": []
}
```

#### 2.4 硬编码域名 / Token 扫描

- `grep -rn "gitlab\." src/`：仅找到 `git.ts` 中注释/错误消息示例里的 `ncom`（占位符，非真实域名）✅
- `grep -rn "wshoto" src/`：无匹配 ✅
- `grep -rn "glpat-" src/`：无匹配 ✅
- dist/index.js 扫描：无真实公司域名/Token ✅

**安全审计结论：B5 ✅ 通过**

---

### §3 关键旅程验证（Task 3）

#### 3.1 新员工首次配置旅程

旅程步骤：`aiforge init` → `aiforge -g <repo-url>` → 验证安装结果

**CLI 可用性验证：**
```
$ node dist/index.js --version
0.1.0   ✅

$ node dist/index.js --help
Usage: aiforge [options] [command] [repo-url]  ✅
```

**init 子命令：** 存在且可调用（`aiforge init` 触发交互式配置，单测 19 用例全绿）

**安装流程（通过 E2E 测试验证）：**
- 全局安装（`-g`）：claude agents(Files) + skills(Directories) 按规则安装到正确目标目录 ✅
- 排除文件：README.md、.gitkeep 不被安装 ✅
- manifest.json：安装后持久化正确的 tool/scope/mode 字段 ✅

**旅程结论：B1 ✅ 通过**（E2E 全链路覆盖，无需真实远程仓库）

#### 3.2 日常更新旅程（增量更新）

**增量更新验证：**
- E2E 测试覆盖：hash 相同的文件被跳过（`status: skipped`），不重复安装 ✅
- `saveManifest` 记录完整，下次对比 hash 时可正确判断增量 ✅

**旅程结论：✅ 通过**（通过 hash 比对机制验证，单测覆盖）

#### 3.3 预览旅程（dry-run）

**dry-run 验证（E2E 测试通过）：**
- `dryRun=true` 时调用 `reportPlan`，不调用 `reportResult` ✅
- 管道路径：Resolve → Auth → Clone → Detect → Match → Report（**无 Install**）✅
- 执行后目标目录不被创建（无文件系统副作用）✅
- dry-run 计划与真实安装结果一致（Files 类型 + Flatten 含重命名规则）✅

**旅程结论：B2 ✅ 通过**

#### 3.4 冲突旅程

**冲突备份保护验证（E2E 测试通过）：**
- `backup` 决策：目标文件备份为 `{filename}.aiforge-backup-{YYYYMMDD}`，原文件被新内容覆盖 ✅
- `--force` 决策：直接覆盖，不产生备份文件 ✅
- `skip` 决策：文件未被修改，结果为 `status: skipped` ✅
- 选择性跳过：跳过有冲突的文件，其他文件正常安装 ✅

**旅程结论：B3 ✅ 通过**

#### 零结果诊断（B4）

**E2E 测试验证：**
- 空仓库（无 agents/ 目录、`resultItems.length === 0`）：触发零结果诊断输出（`reporter.warn` 被调用含诊断信息）✅
- 全部跳过场景（`resultItems.length > 0` 但无 new/updated）：视为成功路径，调用 `reporter.completePhase()` 输出成功摘要，**不**触发诊断警告 ✅

**诊断结论：B4 ✅ 通过**

---

### §4 退出码验证（B7）

| 退出码 | 语义 | 验证方式 | 状态 |
|--------|------|---------|------|
| 0 | 成功 | 管道正常完成（单测覆盖）| ✅ |
| 1 | 安装失败 | `process.exitCode = 1` 单测覆盖 | ✅ |
| 2 | 认证失败 | `EXIT_AUTH_FAILURE` 单测覆盖 | ✅ |
| 3 | 参数错误 | `$ node dist/index.js` → Exit: 3（手动验证）| ✅ |

**退出码结论：B7 ✅ 通过**

---

### §5 测试质量汇总（B6）

```
npm test 执行结果（2026-04-02）：
  Test Files: 30 passed (30)
  Tests:      692 passed (692)
  Duration:   1.03s
```

- ESLint（src/ + tests/）：exit 0，无错误 ✅
- Prettier（src/ + tests/）：`All matched files use Prettier code style!` ✅
- Build：`ESM Build success in 16ms` ✅

**测试结论：B6 ✅ 通过**

---

## 已知限制与上线边界

### 已知限制

| # | 限制 | 影响 | 缓解措施 |
|---|------|------|---------|
| L1 | W1/W2 性能指标（首次克隆 <30s / 增量更新 <15s）未在自动化测试中验证 | 实际使用时若网络慢或仓库大可能超时 | 上线后监控实际使用反馈；当前 E2E 使用本地 fixture 无法评估真实网络性能 |
| L2 | `--ssh` 认证路径依赖用户 SSH 密钥配置正确性 | 用户 SSH 密钥未配置时安装失败 | 错误消息包含三段式诊断和修复命令 |
| L3 | 非 TTY 环境下无交互式冲突解决（`aiforge init` 无法在非 TTY 环境运行） | CI/CD 环境无法交互 | 设计约束，已在 `NON_TTY` 错误中说明 |
| L4 | `npm pack` 的 `prettier --check` 会对 `.gemini/` 等非 src 目录输出 warn（339 个文件） | 不影响发布产物，但 lint 输出含 warn 噪音 | 仅影响开发体验，不影响 src/tests 代码质量 |

### 上线边界

1. **npm registry：** 公共 npm registry（`npmjs.com`），执行 `npm publish` 前需登录 npm 账号
2. **版本策略：** 当前版本 `0.1.0`（MVP 初始版本），后续遵循 semver
3. **Node.js 要求：** `>= 18.0.0`（ESM native），用户需提前安装
4. **CI/CD 发布：** 本 MVP 不包含自动化发布流程，手动执行 `npm publish`
5. **不执行实际 `npm publish`：** 本 Story 验收范围不含实际发布动作

---

## 结论

- [x] **Go** — 所有 Blocker（B1~B7）全部通过，无阻塞发布的未通过项
- [ ] No-Go — 存在未通过 Blocker

**发布结论：✅ Go**

> 所有 7 项 Blocker 级门禁全部通过，4 项 Warning 中 2 项通过、2 项（W1/W2 性能）为已知限制（依赖真实网络环境，无法在 E2E 中自动化验证）。已知限制不阻塞发布，建议上线后持续监控。

---

*本记录由 Dev Agent (Story 5.5c) 于 2026-04-02 生成，可作为发布评审的可追溯验收依据。*

---

## 后续修订（2026-04-24 UX 收敛）

> 本次修订源于零结果诊断分支拆分，仅描述精化。已原地更新上文 B4 与 「零结果诊断（B4）」节。

| 章节 / 行 | 变更前 | 变更后 | 依据 |
|----------|--------|--------|------|
| B4 记录 | 「空仓库 + 全跳过场景均触发诊断」 | 区分「`length===0` 走诊断」与「全 skipped 走成功摘要」 | 代码：src/stages/execute-install.ts / 测试：tests/integration/edge-cases.test.ts |

