---
Story: 4-3
Round: 1
Date: 2026-03-28
Model Used: GPT-5.4
Type: Code Review Summary
---

## 审查结论

本轮为首轮审查。

结论：**需修复后再进入下一轮**。当前发现 1 个高优先级问题，直接影响 AC #5 / NFR-R6（断链检测）兑现。

## 审查发现

### 1. 已损坏的既有 symlink 无法按 AC #5 输出“明确警告”，反而会在重装时直接 fatal

- **严重级别**：高
- **关联 AC**：AC #5, NFR-R6
- **位置**：
  - `src/services/fs-utils.ts:504-532`
  - `src/stages/execute-install.ts:131-139`
- **问题说明**：
  - Story 要求“符号链接目标文件被删除（源仓库被移动）时，检查链接状态应检测到断链并输出明确警告”。
  - 但当前实现中，若目标路径已经是一个 **broken symlink**，`validateDestPathSecurity()` 会在安装阶段前直接抛出 `AiforgeError(PATH_TRAVERSAL)` 并终止流程，而不是进入断链告警逻辑。
  - 同时，`checkBrokenLinks()` 又显式跳过了 `status === 'skipped'` 的 symlink；这意味着即便后续放宽前置校验，**“同一路径、同一目标、仅源文件后来被删”** 这一最典型的断链场景仍不会告警。
- **影响**：
  - 用户在仓库被移动/删除后重新执行安装时，拿到的是 fatal 错误，而不是 AC #5 要求的“明确警告”。
  - 当前测试仅覆盖了“新建/更新后形成断链”的路径，未覆盖“既有链接后来变成断链，再次检查”的场景，因此该缺口未被发现。
- **复现要点**：
  1. 先以 symlink 模式成功安装某文件。
  2. 删除源文件，使目标链接变成 broken symlink。
  3. 以相同 plan 再次执行安装。
  4. 实际结果：在 `validateDestPathSecurity()` 处抛 fatal；未输出 AC #5 所要求的断链警告。
- **修复建议**：
  - 对“目标位于 allowedRoot 内的 broken symlink”区分安全问题与业务状态问题：
    - 不应一律按 `PATH_TRAVERSAL` fatal 拒绝。
    - 应允许进入 symlink 修复/检测路径，至少输出明确的断链 warning。
  - `checkBrokenLinks()` 不应跳过 `status === 'skipped'` 的 symlink；否则已有链接在源文件消失后无法被检测出来。
  - 补充测试：
    - “已有 symlink 后来断链，再次执行安装时输出 warning”
    - “同目标同源路径的 skipped symlink 若已断链，仍会告警”

## 测试与覆盖观察

- 已执行：`npm test -- --run tests/stages/execute-install.test.ts tests/integration/dry-run.test.ts`
- 结果：通过
- 结论：现有测试覆盖了大部分新增路径，但**缺失 AC #5 的既有断链复检场景**

## 建议

建议先修复上述问题，再进行第 2 轮 CR。该问题属于验收标准未完全兑现，不建议按“已完成”合入。
