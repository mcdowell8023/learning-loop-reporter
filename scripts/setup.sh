#!/usr/bin/env bash
# setup.sh — Install learning-loop-reporter skill
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

SKILL_DIR="$HOME/.openclaw/workspace/skills/learning-loop-reporter"
BIN_DIR="$HOME/.local/bin"
BIN_NAME="learning-loop-reporter"
CONFIG_PATH="$HOME/.openclaw/workspace/learn/reporter-config.json"

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

info() { echo "ℹ️  $*"; }
ok()   { echo "✅ $*"; }
err()  { echo "❌ $*" >&2; }

# 1. Copy SKILL.md to skills dir
if $DRY_RUN; then
  info "[dry-run] Would create $SKILL_DIR"
else
  mkdir -p "$SKILL_DIR"
  cp "$PROJECT_DIR/SKILL.md" "$SKILL_DIR/SKILL.md"
  ok "SKILL.md installed to $SKILL_DIR"
fi

# 2. Register CLI wrapper
if $DRY_RUN; then
  info "[dry-run] Would link $BIN_DIR/$BIN_NAME"
else
  mkdir -p "$BIN_DIR"
  ln -sf "$PROJECT_DIR/bin/reporter.sh" "$BIN_DIR/$BIN_NAME"
  ok "CLI registered: $BIN_DIR/$BIN_NAME"
fi

# 3. Create default config (if not exists)
if [[ ! -f "$CONFIG_PATH" ]]; then
  if $DRY_RUN; then
    info "[dry-run] Would create default config at $CONFIG_PATH"
  else
    mkdir -p "$(dirname "$CONFIG_PATH")"
    cat > "$CONFIG_PATH" << 'EOF'
{
  "channels": [
    {
      "type": "feishu",
      "target": "ou_5a77e021e15243dd6694a86c500cdfae"
    }
  ]
}
EOF
    ok "Default config created: $CONFIG_PATH"
  fi
else
  info "Config already exists: $CONFIG_PATH (skipped)"
fi

# 4. Health check
if ! $DRY_RUN; then
  info "Running health check..."
  if "$BIN_DIR/$BIN_NAME" health; then
    ok "Health check passed"
  else
    err "Health check failed (reporter may still work, check config)"
  fi
fi

echo ""
ok "learning-loop-reporter installed successfully!"
echo "   Skill: $SKILL_DIR"
echo "   CLI:   $BIN_DIR/$BIN_NAME"
echo "   Config: $CONFIG_PATH"
