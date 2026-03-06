#!/bin/bash
# require-edit-approval.sh
# PreToolUse hook: exits 2 to force user approval before editing protected files.

LOG="/tmp/require-edit-approval.log"
echo "--- $(date -Iseconds) ---" >> "$LOG"
echo "CLAUDE_PROJECT_DIR=${CLAUDE_PROJECT_DIR:-<unset>}" >> "$LOG"
echo "PWD=$(pwd)" >> "$LOG"

INPUT=$(cat)
echo "RAW_INPUT=$INPUT" >> "$LOG"

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
echo "FILE_PATH=$FILE_PATH" >> "$LOG"

# Nothing to check if no file path
if [ -z "$FILE_PATH" ]; then
  echo "No file_path found, exiting 0" >> "$LOG"
  exit 0
fi

PROTECTED_PATTERNS=(
  "spec/spec_concept.md"
  "config/flows.yaml"
  ".github/workflows/"
  "src/css/variables.css"
  "src/css/special.css"
  "readme.md"
)

# Normalize path before checking
NORMALIZED_PATH=$(echo "$FILE_PATH" | sed 's#//*#/#g; s#/\./#/#g; s#^\./##')

for pattern in "${PROTECTED_PATTERNS[@]}"; do
  if [[ "$NORMALIZED_PATH" == *"$pattern"* ]]; then
    echo "MATCH: '$FILE_PATH' matches '$pattern'. Exiting 2." >> "$LOG"
    echo "Protected file: $FILE_PATH matches '$pattern'. Approval required." >&2
    exit 2
  fi
done

echo "No match found, exiting 0" >> "$LOG"
exit 0
