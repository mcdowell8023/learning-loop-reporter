#!/usr/bin/env bash
# learning-loop-reporter CLI wrapper
set -euo pipefail

# Resolve real location (handles symlinks from ~/.local/bin)
REAL_SCRIPT="$(readlink -f "$0" 2>/dev/null || echo "$0")"
REAL_DIR="$(dirname "$REAL_SCRIPT")"
PROJECT_DIR="$(dirname "$REAL_DIR")"

# Try dist (compiled), fall back to npx tsx
if [[ -f "$PROJECT_DIR/dist/cli.js" ]]; then
  exec node "$PROJECT_DIR/dist/cli.js" "$@"
elif command -v npx &>/dev/null; then
  exec npx --yes tsx "$PROJECT_DIR/src/cli.ts" "$@"
else
  echo "ERROR: Neither dist/cli.js nor npx/tsx available. Run 'npm run build' in $PROJECT_DIR" >&2
  exit 1
fi
