#!/bin/bash
set -euo pipefail

# Only run in remote (Claude Code on the web) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

echo '--- Session Start ---'
echo "Branch: $(git branch --show-current)"
git status --short
echo '---'

# Install dependencies (idempotent — npm install is a no-op when node_modules is current)
npm install 2>&1
echo '--- Ready ---'
