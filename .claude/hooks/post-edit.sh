#!/bin/bash
# post-edit.sh
# PostToolUse hook: auto-format and lint after Write|Edit
# Receives JSON on stdin with tool_input.file_path

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

# Skip if no file path or file doesn't exist
[ -z "$FILE" ] && exit 0
[ ! -f "$FILE" ] && exit 0

# Prettier
echo "Formatting $FILE"
npx prettier --write "$FILE" 2>/dev/null

# CSS → stylelint
if echo "$FILE" | grep -qE '\.css$'; then
  echo "Stylelinting $FILE"
  npx stylelint "$FILE" --config config/.stylelintrc.json --fix 2>&1 \
    || echo "⚠ Stylelint errors remain — invoke /css-guide for guidance."
fi

# JS → eslint
if echo "$FILE" | grep -qE '\.(js|mjs|cjs)$'; then
  echo "Linting $FILE"
  npx eslint --fix "$FILE" 2>/dev/null
fi

exit 0
