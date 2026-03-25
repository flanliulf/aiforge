# cr-todo-check.sh Hook 触发场景有效性分析

> **分析日期**: 2026-03-25
> **分析对象**: `.claude/hooks/cr-todo-check.sh`
> **Hook 类型**: PostToolUse（`Edit|Write`）
> **行为**: 仅提醒（stderr 输出），不阻塞操作（始终 exit 0）

---

## Hook 触发链路总览

```
settings.json
  → PostToolUse
    → matcher: "Edit|Write"
      → cr-todo-check.sh
        → stdin 接收 JSON: { tool_name, tool_input: { file_path } }
          → 按文件路径模式分流到 3 个场景
```

---

## 场景 1：CR evaluation 文件写入 → 提醒提取 TODO

### 匹配逻辑

```bash
if echo "$FILE_PATH" | grep -qE 'code-review-evaluation.*\.md$'; then
```

### 触发时机

`bmad-enhance-02-cr-evaluate` skill 执行时，Claude 使用 `Write` 工具创建 evaluation 文件。

### 实际文件路径示例

```
_bmad-output/implementation-artifacts/2-5-code-review/2-5-code-review-evaluation-20260324-round-1.md
```

### 有效性验证

| 检查项 | 结果 |
|--------|------|
| 正则匹配 `code-review-evaluation.*\.md$` | ✅ 路径中包含 `code-review-evaluation`，以 `.md` 结尾 |
| Skill 确实使用 Write 工具写入该文件 | ✅ 是 |
| 提醒内容合理性 | ✅ 提醒将评估中的「非阻塞」改进项提取到 TODO backlog |

### 结论：✅ 真实有效

---

## 场景 2：CR summary 文件写入 → 提醒检查已有 TODO

### 匹配逻辑

```bash
if echo "$FILE_PATH" | grep -qE 'code-review-summary.*\.md$'; then
    OPEN_COUNT=$(grep -c '^\- \*\*状态\*\*: open' "$TODO_FILE" 2>/dev/null || echo "0")
```

### 触发时机

`bmad-enhance-01-cr-review` skill 执行时，Claude 使用 `Write` 工具创建 summary 文件。

### 实际文件路径示例

```
_bmad-output/implementation-artifacts/2-5-code-review/2-5-code-review-summary-20260324-round-1.md
```

### 有效性验证

| 检查项 | 结果 |
|--------|------|
| 正则匹配 `code-review-summary.*\.md$` | ✅ 路径中包含 `code-review-summary`，以 `.md` 结尾 |
| Skill 确实使用 Write 工具写入该文件 | ✅ 是 |
| open 条目计数逻辑 | ⚠️ 见下方说明 |
| 提醒内容合理性 | ✅ 提醒检查是否有条目在本次 story 中已顺带解决 |

**open 条目计数说明**：

脚本使用 `grep -c '^\- \*\*状态\*\*: open'` 计数。而 TODO backlog 中实际的状态字段格式为：

```markdown
- **状态**: open
```

正则要求行首 `- **状态**: open`，与实际文件格式完全匹配。✅ 正确。

### 结论：✅ 真实有效

---

## 场景 3：编辑源码文件 → 检查相关 open TODO

### 匹配逻辑

```bash
# 绝对路径转相对路径
REL_PATH="${FILE_PATH#$PROJECT_DIR/}"

# 只对 src/ 和 tests/ 下的文件触发
if [[ "$REL_PATH" != src/* ]] && [[ "$REL_PATH" != tests/* ]]; then
    exit 0
fi

# 提取 Open Items 区域
OPEN_SECTION=$(awk '/^## Open Items/,/^## Resolved Items/' "$TODO_FILE")

# 固定字符串匹配文件路径
if echo "$OPEN_SECTION" | grep -qF "$REL_PATH"; then
    # 反向搜索 30 行提取 TODO 标题
    MATCHES=$(echo "$OPEN_SECTION" | grep -B 30 "$REL_PATH" | grep -oE '### TODO-[0-9]+:.*')
fi
```

### 触发时机

任何 Story 开发过程中，Claude 使用 `Edit` 或 `Write` 工具修改 `src/` 或 `tests/` 下的文件时触发。

### 实际数据模拟（以 TODO-001 为例）

当前唯一的 open 条目 TODO-001 涉及文件：`src/commands/init.ts` 和 `src/core/sanitize.ts`。

| 模拟编辑的文件 | grep -F 匹配 | TODO 标题提取 | 是否提醒 |
|----------------|-------------|--------------|---------|
| `src/commands/init.ts` | ✅ 命中 3 行（描述、涉及文件、建议时机） | `TODO-001: 合并 sanitizeTokenDisplay()...` | ✅ 提醒 |
| `src/core/sanitize.ts` | ✅ 命中 2 行（描述、涉及文件） | `TODO-001: 合并 sanitizeTokenDisplay()...` | ✅ 提醒 |
| `src/index.ts`（无关文件） | ❌ 无匹配 | — | ❌ 静默退出 |
| `_bmad-output/xxx.md`（非 src/tests） | — | — | ❌ 前缀过滤直接退出 |

### 有效性验证

| 检查项 | 结果 |
|--------|------|
| 路径前缀过滤 `src/*` / `tests/*` | ✅ 正确过滤非源码文件 |
| awk 提取 Open Items 区域 | ✅ 精确提取 `## Open Items` 到 `## Resolved Items` 之间内容 |
| grep -F 固定字符串匹配 | ✅ 对相对路径做精确子串匹配 |
| grep -B 30 反向搜索 TODO 标题 | ✅ 当前条目约 10 行，30 行回溯距离充足 |
| 多 TODO 条目场景 | ✅ grep -B 30 能抓取所有匹配行的上下文，正确提取多个 TODO 标题 |
| 无关源码文件静默退出 | ✅ grep -F 无匹配时不触发提醒 |

### 潜在风险点

#### 1. `grep -B 30` 回溯距离限制

**风险**：如果某个 TODO 条目描述特别长（超过 30 行），`涉及文件` 字段距离 `### TODO-NNN` 标题超过 30 行，标题提取会失败。

**当前影响**：无 — 当前条目约 10 行，远未触及上限。

**建议**：如果未来条目变长，可考虑改为更精确的 awk 解析。

#### 2. `grep -F` 子字符串误匹配

**风险**：如果 TODO 描述文本中偶然包含另一个文件的路径片段，可能误触发。例如 TODO 描述中提到 `src/utils/helper.ts`，而编辑的恰好是该文件但 TODO 实际无关。

**当前影响**：极低 — TODO 的 `涉及文件` 字段明确列出相关文件，描述中出现的路径通常也是相关文件。

#### 3. 路径转换依赖 `CLAUDE_PROJECT_DIR`

**风险**：`REL_PATH="${FILE_PATH#$PROJECT_DIR/}"`，如果 `CLAUDE_PROJECT_DIR` 格式异常（如末尾多 `/`、符号链接解析差异），截取可能失败。

**当前影响**：极低 — Claude Code 的 hook input 中 `file_path` 与 `CLAUDE_PROJECT_DIR` 格式一致。

### 结论：✅ 真实有效

---

## 总结

| 场景 | 触发条件 | 有效性 | 风险等级 |
|------|----------|--------|----------|
| 场景 1: CR evaluation 写入 | 路径匹配 `code-review-evaluation.*\.md$` | ✅ 有效 | 🟢 无风险 |
| 场景 2: CR summary 写入 | 路径匹配 `code-review-summary.*\.md$` | ✅ 有效 | 🟢 无风险 |
| 场景 3: 源码编辑 | `src/*` / `tests/*` 前缀 + TODO backlog 路径匹配 | ✅ 有效 | 🟡 极低风险（`grep -B 30` 距离限制） |

**整体评价**：三个触发场景均通过实际数据验证，逻辑正确、匹配精确。脚本采用保守设计（仅提醒不阻塞、找不到 TODO 文件时静默退出），即使在边界情况下也不会对开发流程造成干扰。
