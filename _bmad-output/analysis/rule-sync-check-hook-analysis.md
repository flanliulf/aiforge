# rule-sync-check.sh Hook 触发场景有效性分析

> **分析日期**: 2026-03-25
> **分析对象**: `.claude/hooks/rule-sync-check.sh`
> **Hook 类型**: PostToolUse（`Edit|Write`）
> **行为**: Hook 1/2 阻塞（exit 2），Hook 3 仅提醒（exit 0）

---

## Hook 触发链路总览

```
settings.json
  → PostToolUse
    → matcher: "Edit|Write"
      → rule-sync-check.sh
        → stdin 接收 JSON: { tool_name, tool_input: { file_path, new_string|content } }
          → 按优先级依次检查 3 个场景（互斥，先命中先退出）
```

### 依赖的 JSON 字段

根据 [Claude Code 官方文档](https://code.claude.com/docs/en/hooks)，PostToolUse hook 的 stdin JSON 结构：

| 工具 | `tool_input` 字段 |
|------|-------------------|
| **Edit** | `file_path`, `old_string`, `new_string`, `replace_all` |
| **Write** | `file_path`, `content` |

脚本提取方式：

```bash
NEW_STRING=$(echo "$INPUT" | jq -r '.tool_input.new_string // .tool_input.content // empty')
```

- Edit 工具 → 取 `new_string`（替换后的新内容）
- Write 工具 → fallback 取 `content`（写入的完整内容）

✅ 与官方 JSON 结构一致。

---

## Hook 1：修改规则文档本身 → 强制同步提醒

### 匹配逻辑

```bash
RULE_DOCS=(
  "_bmad-output/project-context.md"
  "_bmad-output/planning-artifacts/architecture/04-implementation-patterns.md"
)

for doc in "${RULE_DOCS[@]}"; do
  if [[ "$FILE_PATH" == *"$doc"* ]]; then
    is_rule_doc=true
    break
  fi
done
```

### 触发时机

任何 Agent 使用 `Edit` 或 `Write` 工具修改以下两个规则文档时触发：

- `_bmad-output/project-context.md`
- `_bmad-output/planning-artifacts/architecture/04-implementation-patterns.md`

### 有效性验证

| 检查项 | 结果 |
|--------|------|
| 路径包含匹配 `*"$doc"*` | ✅ 绝对路径中包含相对路径片段 |
| 规则文档确实存在 | ✅ 两个文件均存在且有实质内容 |
| 提醒输出其他需同步的文档 | ✅ 排除当前修改的文档，列出其余文档 |
| 退出码 exit 2（阻塞） | ✅ 强制 Agent 确认同步后才能继续 |

### ⚠️ 发现的问题

**RULE_DOCS 与 CLAUDE.md 中的 Rule Document Registry 不一致**

CLAUDE.md 的 Rule Document Registry 列出了 **3 个** 文档：

| 文档 | 职责 |
|------|------|
| `_bmad-output/project-context.md` | AI agent 主规则文件 |
| `_bmad-output/planning-artifacts/architecture/04-implementation-patterns.md` | 实现模式 |
| `_bmad-output/planning-artifacts/architecture/03-core-decisions.md` | 技术决策事项记录 |

但脚本的 `RULE_DOCS` 数组只包含前 **2 个**，遗漏了 `03-core-decisions.md`。

**影响**：
- 修改 `03-core-decisions.md` 时 **不会** 触发 Hook 1 的同步提醒
- 修改 `project-context.md` 或 `04-implementation-patterns.md` 时，提醒中 **不会** 提及需同步 `03-core-decisions.md`

### 结论：✅ 触发逻辑有效，但 ⚠️ RULE_DOCS 覆盖不完整

---

## Hook 2：写入内容含规则决策关键词 → 强制同步提醒

### 匹配逻辑

```bash
# 仅对 src/ 和 tests/ 下的文件触发
if [[ "$FILE_PATH" == */src/* ]] || [[ "$FILE_PATH" == */tests/* ]]; then
  is_business_code=true
fi

RULE_KEYWORDS=("豁免" "规则边界" "已确认豁免" "exemption" "override" "规则变更" "约定变更" "仅约束")

for kw in "${RULE_KEYWORDS[@]}"; do
  if echo "$NEW_STRING" | grep -qF "$kw"; then
    # 触发提醒
  fi
done
```

### 触发时机

在 `src/` 或 `tests/` 下编辑/写入文件时，如果写入的内容（`new_string` 或 `content`）中包含规则决策关键词。

### 有效性验证

| 检查项 | 结果 |
|--------|------|
| 路径白名单过滤 `*/src/*` / `*/tests/*` | ✅ 精确限定业务代码目录 |
| 关键词列表覆盖度 | ✅ 覆盖中英文规则决策常用词 |
| `NEW_STRING` 取值来源 | ✅ Edit 取 `new_string`，Write 取 `content`，与官方 JSON 结构一致 |
| 非 src/tests 目录静默退出 | ✅ `_bmad-output/`、配置文件等不触发 |
| 退出码 exit 2（阻塞） | ✅ 强制 Agent 确认同步 |

### 实际触发场景分析

**当前源码中是否有规则关键词？**

搜索 `src/` 目录中的规则关键词（`豁免`、`exemption`、`override`、`仅约束` 等）：**未找到任何匹配**。

这说明 Hook 2 的触发场景是 **前瞻性** 的 — 当 Agent 在实现代码时写入包含规则决策的注释（如 `// 已确认豁免: xxx`），才会触发。

**典型触发例子**（假设性）：

```typescript
// 已确认豁免: tsup.config.ts 使用 export default，豁免命名导出规则
export default defineConfig({ ... })
```

此时 `new_string` 包含「已确认豁免」→ 命中关键词 → 触发提醒。

### 潜在风险点

**1. `override` 关键词误触发风险**

`override` 是 TypeScript/JavaScript 中的常见关键字（如 `@Override`、`style override`、CSS `!important` override），在业务代码中出现概率较高。

```typescript
// 可能误触发的场景
const options = { ...defaults, ...override }
class Foo extends Bar { override method() {} }
```

**风险等级**：🟡 中等 — TypeScript 中 `override` 是保留字，在实际代码中可能出现。

**2. `grep -F` 固定字符串匹配 — 子串匹配问题**

`grep -F "override"` 会匹配任何包含 `override` 的字符串，如 `overrideConfig`、`isOverridden` 等变量名。

**风险等级**：🟡 中等 — 这些变量名在配置相关代码中可能出现。

### 结论：✅ 触发逻辑有效，但 ⚠️ `override` 关键词存在误触发风险

---

## Hook 3：Story 文件 + CR 写入特征 → 参考提醒

### 匹配逻辑

```bash
if echo "$FILE_PATH" | grep -qE '_bmad-output/implementation-artifacts/[0-9]+-[0-9]+-.*\.md$'; then
  is_story_file=true
fi

CR_KEYWORDS=("[AI-Review]" "Senior Developer Review" "Review Follow-ups")
for kw in "${CR_KEYWORDS[@]}"; do
  if echo "$NEW_STRING" | grep -qF "$kw"; then
    # 触发提醒
  fi
done
```

### 触发时机

当写入/编辑路径匹配 `_bmad-output/implementation-artifacts/X-Y-*.md` 且内容包含 CR 关键词时触发。

### 有效性验证 — Story 文件匹配

| 文件路径 | 正则匹配 | 预期 | 实际 |
|----------|---------|------|------|
| `2-5-aiforge-init-interactive-setup.md` | ✅ | story 文件 | ✅ 正确 |
| `1-1-project-init-and-toolchain.md` | ✅ | story 文件 | ✅ 正确 |
| `epic-1-review-summary.md` | ❌ | 非 story | ✅ 正确（不以数字开头） |
| `cr-todo-backlog.md` | ❌ | 非 story | ✅ 正确 |
| `epic-1-retrospective-2026-03-23.md` | ❌ | 非 story | ✅ 正确 |

### ⚠️ 发现的问题：CR 子目录文件误匹配

| 文件路径 | 正则匹配 | 预期 | 实际 |
|----------|---------|------|------|
| `1-2-code-review/1-2-code-review-summary-20260319-round-1.md` | ✅ | ❌ 非 story | ⚠️ **误匹配** |
| `2-5-code-review/2-5-code-review-evaluation-20260324-round-1.md` | ✅ | ❌ 非 story | ⚠️ **误匹配** |

**原因**：正则 `_bmad-output/implementation-artifacts/[0-9]+-[0-9]+-.*\.md$` 中的 `.*` 会穿越目录分隔符 `/`，因此 code-review 子目录下以 `数字-数字-` 开头的文件也会匹配。

**影响分析**：

CR summary/evaluation 文件（如 `1-2-code-review-summary-*.md`）被误判为 story 文件后，Hook 3 会检查其写入内容是否包含 CR 关键词。而 CR 文件本身通常不包含 `[AI-Review]`、`Senior Developer Review`、`Review Follow-ups` 这些写入到 **story** 文件中的标记。因此：

- **误触发概率**：🟡 低但非零 — 如果 CR summary 中恰好引用了某个 `[AI-Review]` 标记的原文，可能触发
- **误触发后果**：🟢 无害 — Hook 3 是 exit 0 仅参考提醒，不阻塞操作

### CR 关键词验证

在已有的 story 文件中搜索 CR 关键词：

```
1-1-project-init-and-toolchain.md:
  ✅ "### Review Follow-ups (AI)"
  ✅ "[AI-Review][HIGH] 补充 .gitignore..."
  ✅ "[AI-Review][MEDIUM] 更新 Dev Agent Record..."
```

这些关键词在 story 文件的 Review Follow-ups 章节中被大量使用，证实了 Hook 3 的设计意图：**当 Agent 向 story 文件写入 CR 审查结论时，提醒检查是否涉及规则决策**。

### 结论：✅ 触发逻辑有效，⚠️ 正则可误匹配 CR 子目录文件（影响轻微）

---

## 三个 Hook 的执行优先级与互斥关系

```
Hook 1: 规则文档路径匹配 → exit 2（阻塞，后续 Hook 不执行）
    ↓ 不匹配
Hook 2: src/tests 路径 + 关键词匹配 → exit 2（阻塞）
    ↓ 不匹配或非 src/tests
Hook 3: story 文件路径 + CR 关键词 → exit 0（仅提醒）
    ↓ 不匹配
exit 0（静默退出）
```

**关键观察**：三个 Hook 之间存在隐式互斥 —

- 规则文档（`_bmad-output/project-context.md` 等）被 Hook 1 拦截，不会到达 Hook 2/3
- 业务代码（`src/*`、`tests/*`）被 Hook 2 处理，不会到达 Hook 3（因为路径不匹配 story 文件正则）
- Story 文件（`_bmad-output/implementation-artifacts/X-Y-*.md`）不在 `src/tests` 下，跳过 Hook 2，由 Hook 3 处理

**唯一的重叠区域**：CR 子目录文件（如上文分析）被误匹配到 Hook 3，但无实质危害。

---

## 总结

| Hook | 触发条件 | 有效性 | 退出码 | 风险 |
|------|----------|--------|--------|------|
| Hook 1: 规则文档修改 | 路径包含 RULE_DOCS 中的文档 | ✅ 有效 | exit 2 阻塞 | ⚠️ RULE_DOCS 缺少 `03-core-decisions.md` |
| Hook 2: 规则关键词写入 | src/tests 路径 + 内容含关键词 | ✅ 有效 | exit 2 阻塞 | ⚠️ `override` 关键词可能误触发 |
| Hook 3: CR 写入 story | story 文件路径 + CR 关键词 | ✅ 有效 | exit 0 提醒 | ⚠️ 正则可误匹配 CR 子目录文件 |

### 改进建议汇总

| 编号 | 问题 | 建议 | 优先级 | 状态 |
|------|------|------|--------|------|
| R1 | RULE_DOCS 遗漏 `03-core-decisions.md` | 将其加入 RULE_DOCS 数组 | P1 | ✅ 已修复 (2026-03-25) |
| R2 | `override` 误触发 | 将 `override` 替换为 `rule override`，避免匹配 TS 关键字 | P2 | ✅ 已修复 (2026-03-25) |
| R3 | Hook 3 正则穿越目录 | `.*` → `[^/]*`，排除子目录 | P3 | ✅ 已修复 (2026-03-25) |
