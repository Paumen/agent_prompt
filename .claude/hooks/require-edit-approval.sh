#!/bin/bash
# require-edit-approval.sh
# PreToolUse hook: exits 2 to force user approval before editing protected files.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Nothing to check if no file path
[ -z "$FILE_PATH" ] && exit 0

PROTECTED_PATTERNS=(
  "spec/spec_concept.md"
  "config/flows.yaml"
  ".github/workflows/"
  "src/css/variables.css"
  "src/css/special.css"
)

for pattern in "${PROTECTED_PATTERNS[@]}"; do
  if [[ "$FILE_PATH" == *"$pattern"* ]]; then
    echo "Protected file: $FILE_PATH matches '$pattern'. Approval required." >&2
    exit 2
  fi
done

exit 0
