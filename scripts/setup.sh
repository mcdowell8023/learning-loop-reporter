#!/usr/bin/env bash
# setup.sh — Install learning-loop-reporter skill (idempotent)
# T-046: Fixed to handle broken plain-file installs (alpha.4 regression)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

SKILL_DIR="$HOME/.openclaw/workspace/skills/learning-loop-reporter"
BIN_DIR="$HOME/.local/bin"
BIN_NAME="learning-loop-reporter"
BIN_LINK="$BIN_DIR/$BIN_NAME"
BIN_TARGET="$PROJECT_DIR/bin/reporter.sh"
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

# 2. Register CLI wrapper — idempotent with broken-install recovery
install_bin_link() {
  local target="$BIN_TARGET"
  local link="$BIN_LINK"
  mkdir -p "$BIN_DIR"

  if [[ -f "$link" && ! -L "$link" ]]; then
    # Plain file (e.g. alpha.4 copied dist/cli.js) — backup and replace
    local bak="${link}.broken-bak-$(date +%s)"
    err "$link is a regular file (not symlink) — broken install detected"
    info "Backing up to $bak"
    mv "$link" "$bak"
    ln -s "$target" "$link"
    ok "Fixed: replaced broken file with symlink $link → $target"
  elif [[ -L "$link" ]]; then
    local current_target expected_target
    current_target="$(readlink -f "$link" 2>/dev/null || echo "")"
    expected_target="$(readlink -f "$target" 2>/dev/null || echo "$target")"
    if [[ "$current_target" != "$expected_target" ]]; then
      info "$link points to wrong target ($current_target), relinking..."
      rm "$link"
      ln -s "$target" "$link"
      ok "Fixed symlink: $link → $target"
    else
      ok "Symlink already correct: $link → $target"
    fi
  else
    ln -s "$target" "$link"
    ok "Created symlink: $link → $target"
  fi
}

if $DRY_RUN; then
  info "[dry-run] Would ensure $BIN_LINK → $BIN_TARGET (idempotent)"
else
  install_bin_link
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

# 4. Health check — MANDATORY (fail = install fail)
if ! $DRY_RUN; then
  info "Running health check..."
  if "$BIN_LINK" health; then
    ok "Health check passed"
  else
    err "Health check FAILED — install is broken"
    exit 1
  fi
fi

echo ""
ok "learning-loop-reporter installed successfully!"
echo "   Skill:  $SKILL_DIR"
echo "   CLI:    $BIN_LINK → $BIN_TARGET"
echo "   Config: $CONFIG_PATH"
