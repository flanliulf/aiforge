# PostToolUse Hook 未触发问题分析报告

> **日期**: 2026-03-25
> **环境**: Cursor IDE + Claude Code 扩展（非原生终端 CLI）
> **触发场景**: Story 3-1 CR Evaluation Round 1/2 执行后，PostToolUse hook 未触发 TODO 提醒
> **状态**: 待后续 Story 验证

---

## 问题描述

Story 3-1 的 CR 评估流程中，`bmad-enhance-02-cr-evaluate` Skill 通过 `Write` 工具写入了两个 `code-review-evaluation` 文件：

- `3-1-code-review-evaluation-20260325-round-1.md`
- `3-1-code-review-evaluation-20260325-round-2.md`

按照 `.claude/settings.json` 中注册的 PostToolUse hook 配置，`cr-todo-check.sh` 应在 Write 操作后触发，提醒 Agent 将非阻塞改进项记录到 `cr-todo-backlog.md`。**实际未触发。**

最终由用户手动调用 `bmad-enhance-05-cr-todo-tracker` Skill 补录了 TODO-002。

## 环境信息

```
TERM_PROGRAM=vscode
CURSOR_TRACE_ID=60094a17c7f0...
CLAUDE_CODE_ENTRYPOINT=cli
CLAUDE_CODE_SSE_PORT=25511
CLAUDE_PROJECT_DIR=not-set        ← Bash 子进程中未设置
CLAUDECODE=1
```

**运行环境**: Cursor IDE 嵌入的 Claude Code 扩展，非原生终端启动。

## Hook 配置

`.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/cr-todo-check.sh"
          }
        ]
      }
    ]
  }
}
```

`cr-todo-check.sh` 场景 1 匹配逻辑：

```bash
if echo "$FILE_PATH" | grep -qE 'code-review-evaluation.*\.md$'; then
    echo "📋 [CR TODO] 检测到 CR evaluation 文件写入。" >&2
    echo "   → 使用 cr-todo-tracker 技能: add" >&2
    exit 0
fi
```

## 验证过程

### 1. 脚本功能验证（通过）

手动模拟 hook 输入，脚本功能正常：

```bash
echo '{"tool_name":"Write","tool_input":{"file_path":"...-code-review-evaluation-..."}}' \
  | CLAUDE_PROJECT_DIR="..." bash cr-todo-check.sh
# → 输出了 📋 [CR TODO] 提醒，EXIT_CODE=0
```

### 2. 实际触发验证（失败）

在当前 Cursor IDE 环境中，通过 Write 工具写入文件名包含 `code-review-evaluation` 的测试文件，**未观察到任何 hook 提醒输出**。

## 根因分析

### 断链点：PostToolUse hooks 在 Cursor IDE 嵌入模式下未执行

```
Write(code-review-evaluation.md)
  → PostToolUse hook runner
    → ❌ 在 Cursor IDE 嵌入模式下未执行 hooks
      → cr-todo-check.sh 未运行
        → 无提醒输出
          → Agent 无感知
            → TODO 未记录
```

### 可能原因

| 可能性 | 描述 | 评估 |
|--------|------|------|
| **A. IDE 嵌入模式不支持 PostToolUse hooks** | Cursor/VS Code 中的 Claude Code 扩展可能只支持部分 hook 类型，或完全不加载 `.claude/settings.json` 中的 hooks 配置 | 高 |
| **B. `CLAUDE_PROJECT_DIR` 未注入导致脚本路径解析失败** | hook command 中的 `"$CLAUDE_PROJECT_DIR"/.claude/hooks/cr-todo-check.sh` 因变量未设置而路径不存在，静默失败 | 中 |

## 改进建议

| 优先级 | 方案 | 描述 | 环境依赖 |
|--------|------|------|----------|
| **P0** | 验证 hook 支持范围 | 在原生终端 `claude` CLI 中测试同样的 Write 操作，确认 hook 是否正常触发，区分"IDE 限制"和"hook 配置问题" | 需后续 Story 验证 |
| **P1** | Skill 流程内闭环 | 在 `bmad-enhance-02-cr-evaluate` Step 5 后增加 Step 6："检查评估结论中是否有非阻塞/降级项，若有则提示用户调用 cr-todo-tracker add"；在 `bmad:cr-done` 流程中增加 TODO 提取步骤 | 无环境依赖 |
| **P2** | Hook 增强 | 若确认 IDE 模式不支持 hooks，考虑将提醒逻辑迁移到 CLAUDE.md 规则约束中 | 依赖 Agent 遵守规则 |

**核心结论**：Hook 机制依赖运行时环境支持，但 Skill 流程定义是环境无关的。**将 TODO 提取步骤内嵌到 Skill 流程中（P1）是最稳健的改进路径**，不受 IDE / CLI 环境差异影响。

## 后续行动

- [ ] 在后续 Story 中使用原生终端 CLI 验证 PostToolUse hook 是否正常触发（P0）
- [ ] 根据验证结果决定是否实施 P1（Skill 流程内闭环）
- [ ] 如确认 IDE 模式不支持 hooks，评估所有依赖 hooks 的自动化流程的影响范围
