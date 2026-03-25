#!/usr/bin/env bash
# cr-todo-check.sh
# PostToolUse hook: 在关键操作后提醒检查 CR TODO Backlog
#
# 触发场景：
#   场景 1 - 写入 CR evaluation 文件 → 提醒提取 TODO 条目
#   场景 2 - 写入 CR summary 文件 → 提醒检查/解决已有 TODO
#   场景 3 - 编辑源码文件 → 检查是否有相关 open TODO 条目
#
# 行为：仅提醒（exit 0），不阻塞操作

set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
TODO_FILE="$PROJECT_DIR/_bmad-output/implementation-artifacts/cr-todo-backlog.md"

# 从 stdin 读取 hook input JSON
INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# 如果 TODO 文件不存在，静默退出
if [ ! -f "$TODO_FILE" ]; then
    exit 0
fi

# 如果没有文件路径信息，静默退出
if [ -z "$FILE_PATH" ]; then
    exit 0
fi

# ── 场景 1: 写入 CR evaluation 文件 → 提醒提取 TODO ──────────────
if echo "$FILE_PATH" | grep -qE 'code-review-evaluation.*\.md$'; then
    echo "" >&2
    echo "📋 [CR TODO] 检测到 CR evaluation 文件写入。" >&2
    echo "   如果评估中有「非阻塞」改进项，建议提取到 TODO backlog：" >&2
    echo "   → 使用 cr-todo-tracker 技能: add" >&2
    echo "" >&2
    exit 0
fi

# ── 场景 2: 写入 CR summary 文件 → 提醒检查已有 TODO ─────────────
if echo "$FILE_PATH" | grep -qE 'code-review-summary.*\.md$'; then
    OPEN_COUNT=$(grep -c '^\- \*\*状态\*\*: open' "$TODO_FILE" 2>/dev/null || echo "0")
    if [ "$OPEN_COUNT" -gt 0 ]; then
        echo "" >&2
        echo "📋 [CR TODO] 当前 backlog 有 ${OPEN_COUNT} 个 open 条目。" >&2
        echo "   建议检查是否有条目在本次 story 中已顺带解决：" >&2
        echo "   → 使用 cr-todo-tracker 技能: list / resolve" >&2
        echo "" >&2
    fi
    exit 0
fi

# ── 场景 3: 编辑源码文件 → 检查相关 open TODO ────────────────────
# 将绝对路径转换为项目相对路径
REL_PATH="${FILE_PATH#$PROJECT_DIR/}"

# 只对 src/ 和 tests/ 下的文件触发
if [[ "$REL_PATH" != src/* ]] && [[ "$REL_PATH" != tests/* ]]; then
    exit 0
fi

# 在 TODO 文件的 Open Items 区域搜索匹配的文件路径
OPEN_SECTION=$(awk '/^## Open Items/,/^## Resolved Items/' "$TODO_FILE" 2>/dev/null || true)

if [ -z "$OPEN_SECTION" ]; then
    exit 0
fi

# 检查 Open Items 区域是否包含当前文件路径
if echo "$OPEN_SECTION" | grep -qF "$REL_PATH"; then
    # 提取匹配的 TODO 编号和标题
    MATCHES=$(echo "$OPEN_SECTION" | grep -B 30 "$REL_PATH" | grep -oE '### TODO-[0-9]+:.*' || true)

    if [ -n "$MATCHES" ]; then
        echo "" >&2
        echo "⚠️  [CR TODO] 当前编辑的文件 \`$REL_PATH\` 有相关待办事项：" >&2
        echo "$MATCHES" | while IFS= read -r line; do
            # 从 ### TODO-001: 标题 中提取编号和标题
            TODO_ID=$(echo "$line" | grep -oE 'TODO-[0-9]+')
            TITLE=$(echo "$line" | sed 's/### TODO-[0-9]*: //')
            echo "   • $TODO_ID: $TITLE" >&2
        done
        echo "   → 考虑在本次修改中一并处理" >&2
        echo "" >&2
    fi
fi

exit 0
