# Story 5.5c: MVP Go/No-Go 发布门禁验收

Status: done

## Story

As a PM / QA,
I want 一份明确的 MVP 发布门禁清单并逐项完成验证,
So that 团队对产品是否达到发布标准有客观、一致、可追溯的判断。

> 性质说明：本 Story 更偏发布门禁/验收清单，而非标准开发 Story。

## Acceptance Criteria

1. **Given** MVP Go/No-Go 门禁清单 **When** 逐项执行发布前验证 **Then** 以下条件全部满足：新员工首次配置旅程可完整走通、dry-run 与实际安装一致、冲突有备份保护、零结果有诊断、npm 包无敏感信息（NFR-S1）
2. **Given** 验证结果 **When** 汇总发布评审材料 **Then** 每项门禁有明确状态（通过/未通过/阻塞），未通过项附带风险说明
3. **Given** 存在任一未通过的 blocker **When** 执行评审 **Then** 发布结论为 No-Go
4. **Given** 所有 blocker 均已关闭 **When** 执行评审 **Then** 发布结论为 Go，形成可追溯的验收记录
5. **Given** 验收完成 **When** 复盘 **Then** 团队明确知道已知风险、剩余限制和上线边界

## Tasks / Subtasks

- [x] Task 1: 创建发布门禁清单文档 (AC: #1, #2)
  - [x] 1.1 创建 `_bmad-output/implementation-artifacts/mvp-go-nogo-checklist.md`
  - [x] 1.2 定义 Blocker 级别门禁项（必须全部通过）：
    - 新员工首次配置旅程（init → 安装 → 验证）
    - dry-run 一致性（NFR-U5）
    - 冲突备份保护（FR-028）
    - 零结果诊断（FR-032）
    - npm 包安全审计（NFR-S1）
    - 端到端测试全部通过
    - 退出码正确性（0/1/2/3）
  - [x] 1.3 定义 Warning 级别门禁项（建议通过，不阻塞发布）：
    - 性能指标（NFR-P1~P5）
    - 国际化完整性
    - 错误消息覆盖率
- [x] Task 2: 执行安全审计 (AC: #1)
  - [x] 2.1 检查 `npm pack --dry-run` 输出的最终产物列表，确认无公司域名、仓库地址、Token
  - [x] 2.2 检查最终 packlist 不包含 tests/、src/、配置文件等非发布内容（验证产物而非绑定 `.npmignore` 或 `package.json.files` 某一种打包机制）
  - [x] 2.3 检查 package.json 中无 `repository`、`bugs` 等含公司信息的字段
  - [x] 2.4 搜索代码中的硬编码域名或 Token
- [x] Task 3: 执行关键旅程验证 (AC: #1)
  - [x] 3.1 新员工旅程：`aiforge init` → `aiforge -g` → 验证安装结果
  - [x] 3.2 日常更新旅程：`aiforge -g`（增量更新）→ 验证只更新变更文件
  - [x] 3.3 预览旅程：`aiforge --dry-run` → 验证输出格式
  - [x] 3.4 冲突旅程：手写文件 → `aiforge -g` → 验证备份保护
- [x] Task 4: 汇总验收报告 (AC: #2-5)
  - [x] 4.1 逐项记录门禁状态
  - [x] 4.2 未通过项附带风险说明和处理建议
  - [x] 4.3 形成 Go/No-Go 结论
  - [x] 4.4 记录已知限制和上线边界

## Dev Notes

### 门禁清单模板

```markdown
# MVP Go/No-Go 发布门禁

## Blocker 级别（必须全部 ✅）

| # | 门禁项 | 状态 | 验证方式 | 备注 |
|---|--------|------|---------|------|
| B1 | 新员工首次配置旅程 | ⬜ | 手动验证 | |
| B2 | dry-run 一致性 | ⬜ | E2E 测试 | NFR-U5 |
| B3 | 冲突备份保护 | ⬜ | E2E 测试 | FR-028 |
| B4 | 零结果诊断（双分支：`length===0` warn / 全 skipped 成功） | ⚬ | E2E 测试 | FR-032 |
| B5 | npm 包安全审计 | ⬜ | npm pack 检查 | NFR-S1 |
| B6 | E2E 测试全部通过 | ⬜ | vitest --run | |
| B7 | 退出码正确性 | ⬜ | E2E 测试 | 0/1/2/3 |

## Warning 级别（建议通过）

| # | 门禁项 | 状态 | 验证方式 | 备注 |
|---|--------|------|---------|------|
| W1 | 首次克隆 < 30s | ⬜ | 手动计时 | NFR-P1 |
| W2 | 增量更新 < 15s | ⬜ | 手动计时 | NFR-P2 |
| W3 | 工具扫描 < 500ms | ⬜ | 单元测试 | NFR-P5 |
| W4 | 中英文输出完整 | ⬜ | 手动验证 | FR-046 |

## 结论

- [ ] Go — 所有 Blocker 通过
- [ ] No-Go — 存在未通过 Blocker
```

### npm 包安全检查命令

```bash
# 检查包内容
npm pack --dry-run 2>&1 | grep -i "gitlab\|wshoto\|token\|glpat"

# 检查 package.json
cat package.json | grep -i "repository\|bugs\|homepage"

# 搜索代码中的硬编码
grep -r "gitlab\.\|wshoto\|glpat-" src/ --include="*.ts"
```

### 模块边界

- 创建验收文档（不修改代码）
- 执行验证脚本和手动测试
- 汇总报告

### 依赖关系

- 依赖 Epic 1-5 全部 Story（完整产品实现）
- 依赖 Story 5.5b（E2E 测试通过）——门禁结论的可信度直接取决于 5.5b 的测试覆盖质量，5.5b 必须先收口完成
- 这是整个 MVP 的最后一个 Story

### 本 Story 不做的事

- 不实现自动化发布流程（CI/CD）
- 不实现版本号管理策略
- 不执行实际 npm publish

### References

- [Source: architecture/06-validation-results.md] — 架构验证结果
- [Source: project-context.md#Security-Rules] — npm 包安全要求
- [Source: epic-5.md] — MVP Go/No-Go 门禁定义

## Dev Agent Record

### Agent Model Used

claude-opus-4-5 (Amelia — bmad-agent-dev)

### Debug Log References

- `npm pack --dry-run` 输出：4 个文件入包，无敏感信息
- `npm test` 输出：30 测试文件 / 692 用例，全部通过，耗时 1.03s
- `npx eslint src/ tests/` exit: 0
- `npx prettier --check "src/**/*.ts" "tests/**/*.ts"` → All matched files use Prettier code style!
- `npm run build` → ESM Build success in 16ms，dist/index.js 108.05 KB
- 退出码手动验证：`node dist/index.js` → Exit: 3（参数错误，符合预期）

### Completion Notes List

- ✅ Task 1：创建 `mvp-go-nogo-checklist.md`，包含 B1~B7 Blocker 门禁项和 W1~W4 Warning 门禁项
- ✅ Task 2：执行完整安全审计，B5 通过：包内 4 个文件，无公司域名/Token，package.json 无敏感字段，src/ 中 `gitlab.` 仅为占位符 `ncom`
- ✅ Task 3：通过 E2E 测试（54/54）+ 手动验证覆盖 4 条旅程；B1（新员工旅程）、B2（dry-run 一致性）、B3（冲突备份）、B4（零结果诊断）均通过
- ✅ Task 4：汇总验收报告，所有 Blocker 通过，已知限制 W1/W2（性能）不阻塞发布，结论 **Go**
- 全仓测试：30 测试文件 / 692 用例，全部通过
- Lint：ESLint exit 0，Prettier src/tests 全绿（`.gemini/` 等非 src 目录的 Prettier warn 为已知噪音，不影响发布产物）

### Change Log

- 2026-04-02：Story 5.5c 实现完成。创建 `mvp-go-nogo-checklist.md`，执行安全审计、关键旅程验证、汇总发布门禁报告。结论：**Go**，所有 7 项 Blocker 全部通过。

### File List

- `_bmad-output/implementation-artifacts/mvp-go-nogo-checklist.md` — 新增，MVP Go/No-Go 发布门禁完整验收清单
- `_bmad-output/implementation-artifacts/5-5c-mvp-go-nogo-gate.md` — 修改，Story 状态更新为 review，Dev Agent Record 填写完毕
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — 修改，5-5c 状态 ready-for-dev → review

---

## 后续修订（2026-04-24 UX 收敛）

> 本次修订源于零结果诊断分支拆分，只是描述精化（活动路径不变）。已原地更新 B4 门禁描述，本块保留变更对照供审计追溯。

| 章节 / 行 | 变更前 | 变更后 | 依据 |
|----------|--------|--------|------|
| B4 门禁 | 零结果诊断 | 零结果诊断（双分支：`length===0` warn / 全 skipped 成功） | 代码：src/stages/execute-install.ts / 测试：tests/integration/edge-cases.test.ts |

