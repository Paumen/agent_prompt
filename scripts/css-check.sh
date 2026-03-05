#!/usr/bin/env bash
# css-check.sh — CSS validation: stylelint + dead code detection
# Usage: ./scripts/css-check.sh [file.css]   # check specific file
#        ./scripts/css-check.sh              # check all CSS files

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CSS_DIR="$PROJECT_ROOT/src/css"
SRC_DIR="$PROJECT_ROOT/src"
EXIT_CODE=0

# Colors for output
RED='\033[0;31m'
YELLOW='\033[0;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# ── Stylelint ──────────────────────────────────────────────
run_stylelint() {
  local target="${1:-"$CSS_DIR"}"
  echo "── Stylelint ──"
  if npx stylelint "$target" --config "$PROJECT_ROOT/config/.stylelintrc.json" --configBasedir "$PROJECT_ROOT" 2>&1; then
    echo -e "${GREEN}Stylelint: passed${NC}"
  else
    echo -e "${RED}Stylelint: failed${NC}"
    EXIT_CODE=1
  fi
  echo ""
}

# ── Dead Code Detection ───────────────────────────────────
# Finds CSS classes defined in .css files that are not referenced
# in any .js or .html file.
find_dead_classes() {
  echo "── Dead Code Detection ──"
  local dead_count=0
  local css_files

  if [ -n "${1:-}" ]; then
    css_files="$1"
  else
    css_files=$(find "$CSS_DIR" -name '*.css' -not -name 'variables.css')
  fi

  for css_file in $css_files; do
    local filename
    filename=$(basename "$css_file")

    # Extract class names from CSS (matches .class-name patterns)
    # Excludes pseudo-classes, combinator contexts, and common resets
    local classes
    classes=$(grep -oP '(?<=[^a-zA-Z0-9_-])\.(?![\d])[a-zA-Z_-][a-zA-Z0-9_-]*' "$css_file" 2>/dev/null \
      | sed 's/^\.//' \
      | sort -u \
      | grep -vE '^(open|collapsible|collapsible-content)$' || true)

    if [ -z "$classes" ]; then
      continue
    fi

    local file_dead=""
    while IFS= read -r class; do
      # Search for class in .js and .html files (as string literal or in classList/className)
      local found
      found=$(grep -rlE "(class(Name|List)?[^>]*['\"\`\s]${class}['\"\`\s,)]|class=\"[^\"]*\b${class}\b|'${class}'|\"${class}\")" \
        "$SRC_DIR" --include='*.js' --include='*.html' 2>/dev/null || true)

      if [ -z "$found" ]; then
        file_dead="${file_dead}  .${class}\n"
        ((dead_count++)) || true
      fi
    done <<< "$classes"

    if [ -n "$file_dead" ]; then
      echo -e "${YELLOW}${filename}:${NC}"
      echo -e "$file_dead"
    fi
  done

  if [ "$dead_count" -eq 0 ]; then
    echo -e "${GREEN}No dead CSS classes found.${NC}"
  else
    echo -e "${YELLOW}Found ${dead_count} potentially unused class(es).${NC}"
    echo "  Verify manually — dynamic class references may not be detected."
  fi
  echo ""
}

# ── Main ───────────────────────────────────────────────────
echo "=== CSS Check ==="
echo ""

if [ -n "${1:-}" ]; then
  # Single file mode
  if [ ! -f "$1" ]; then
    echo -e "${RED}File not found: $1${NC}"
    exit 1
  fi
  run_stylelint "$1"
  find_dead_classes "$1"
else
  # Full check mode
  run_stylelint "$CSS_DIR"
  find_dead_classes
fi

echo "=== Done ==="
exit $EXIT_CODE
