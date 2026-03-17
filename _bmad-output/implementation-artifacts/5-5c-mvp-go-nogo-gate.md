# Story 5.5c: MVP Go/No-Go 发布门禁验收

Status: ready-for-dev

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

- [ ] Task 1: 创建发布门禁清单文档 (AC: #1, #2)
  - [ ] 1.1 创建 `_bmad-output/implementation-artifacts/mvp-go-nogo-checklist.md`
  - [ ] 1.2 定义 Blocker 级别门禁项（必须全部通过）：
    - 新员工首次配置旅程（init → 安装 → 验证）
    - dry-run 一致性（NFR-U5）
    - 冲突备份保护（FR-028）
    - 零结果诊断（FR-032）
    - npm 包安全审计（NFR-S1）
    - 端到端测试全部通过
    - 退出码正确性（0/1/2/3）
  - [ ] 1.3 定义 Warning 级别门禁项（建议通过，不阻塞发布）：
    - 性能指标（NFR-P1~P5）
    - 国际化完整性
    - 错误消息覆盖率
- [ ] Task 2: 执行安全审计 (AC: #1)
  - [ ] 2.1 检查 `npm pack --dry-run` 输出，确认无公司域名、仓库地址、Token
  - [ ] 2.2 检查 `.npmignore` 排除了 tests/、src/、.eslintrc 等
  - [ ] 2.3 检查 package.json 中无 `repository`、`bugs` 等含公司信息的字段
  - [ ] 2.4 搜索代码中的硬编码域名或 Token
- [ ] Task 3: 执行关键旅程验证 (AC: #1)
  - [ ] 3.1 新员工旅程：`aiforge init` → `aiforge -g` → 验证安装结果
  - [ ] 3.2 日常更新旅程：`aiforge -g`（增量更新）→ 验证只更新变更文件
  - [ ] 3.3 预览旅程：`aiforge --dry-run` → 验证输出格式
  - [ ] 3.4 冲突旅程：手写文件 → `aiforge -g` → 验证备份保护
- [ ] Task 4: 汇总验收报告 (AC: #2-5)
  - [ ] 4.1 逐项记录门禁状态
  - [ ] 4.2 未通过项附带风险说明和处理建议
  - [ ] 4.3 形成 Go/No-Go 结论
  - [ ] 4.4 记录已知限制和上线边界

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
| B4 | 零结果诊断 | ⬜ | E2E 测试 | FR-032 |
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
- 依赖 Story 5.5b（E2E 测试通过）
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

### Debug Log References

### Completion Notes List

### File List
