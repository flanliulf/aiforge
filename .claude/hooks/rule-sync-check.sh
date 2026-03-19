#!/usr/bin/env bash
# rule-sync-check.sh
# PostToolUse hook: 检测规则文档变更或规则决策写入，提示 AI 同步所有规则文档
#
# 触发场景：
#   Hook 1 - 修改了规则文档本身（project-context.md / architecture/*.md）
#   Hook 2 - 修改任意文件时，写入内容含规则决策关键词
#   Hook 3 - 修改 story 文件时，写入内容含 CR 写入特征（[AI-Review] / Senior Developer Review）

set -euo pipefail

INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
NEW_STRING=$(echo "$INPUT" | jq -r '.tool_input.new_string // .tool_input.content // empty')

# 规则文档清单（Rule Document Registry）
RULE_DOCS=(
  "_bmad-output/project-context.md"
  "_bmad-output/planning-artifacts/architecture/04-implementation-patterns.md"
)

# ── Hook 1: 修改了规则文档本身 ──────────────────────────────────────────────
is_rule_doc=false
for doc in "${RULE_DOCS[@]}"; do
  if [[ "$FILE_PATH" == *"$doc"* ]]; then
    is_rule_doc=true
    break
  fi
done

if $is_rule_doc; then
  OTHER_DOCS=""
  for doc in "${RULE_DOCS[@]}"; do
    if [[ "$FILE_PATH" != *"$doc"* ]]; then
      OTHER_DOCS+="  - $doc\n"
    fi
  done
  echo "⚠️  [Rule Sync Check] 你修改了规则文档: $FILE_PATH" >&2
  echo "" >&2
  echo "必须检查以下文档是否需要同步相同的规则变更：" >&2
  printf "$OTHER_DOCS" >&2
  echo "" >&2
  echo "请逐一打开上述文档，确认内容一致后再继续。" >&2
  exit 2
fi

# ── Hook 2: 写入内容含规则决策关键词（任意文件）────────────────────────────
# Hook 2 只对业务代码目录触发（白名单），避免文档/框架文件误报
# 仅匹配：src/、tests/ 下的文件
is_business_code=false
if [[ "$FILE_PATH" == */src/* ]] || [[ "$FILE_PATH" == */tests/* ]]; then
  is_business_code=true
fi

if $is_business_code; then
  RULE_KEYWORDS=("豁免" "规则边界" "已确认豁免" "exemption" "override" "规则变更" "约定变更" "仅约束")

  for kw in "${RULE_KEYWORDS[@]}"; do
    if echo "$NEW_STRING" | grep -qF "$kw"; then
      echo "⚠️  [Rule Sync Check] 检测到规则决策关键词 [$kw] 写入: $FILE_PATH" >&2
      echo "" >&2
      echo "如果这是一条规则边界确认或豁免决策，必须同步到以下规则文档：" >&2
      for doc in "${RULE_DOCS[@]}"; do
        echo "  - $doc" >&2
      done
      echo "" >&2
      echo "请确认是否需要同步，完成后再继续。" >&2
      exit 2
    fi
  done
fi

# ── Hook 3: story 文件 + CR 写入特征 ────────────────────────────────────────
is_story_file=false
if echo "$FILE_PATH" | grep -qE '_bmad-output/implementation-artifacts/[0-9]+-[0-9]+-.*\.md$'; then
  is_story_file=true
fi

if $is_story_file; then
  CR_KEYWORDS=("[AI-Review]" "Senior Developer Review" "Review Follow-ups")
  for kw in "${CR_KEYWORDS[@]}"; do
    if echo "$NEW_STRING" | grep -qF "$kw"; then
      echo "💡 [Rule Sync Check] 检测到 Code Review 内容写入 story 文件: $FILE_PATH" >&2
      echo "" >&2
      echo "如果 review 中包含规则边界确认或豁免决策，请检查是否需要同步到：" >&2
      for doc in "${RULE_DOCS[@]}"; do
        echo "  - $doc" >&2
      done
      echo "" >&2
      echo "（提示仅供参考，无需强制处理后才能继续）" >&2
      exit 0
    fi
  done
fi

exit 0
