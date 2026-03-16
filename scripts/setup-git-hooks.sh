#!/bin/bash

# Script: setup-git-hooks.sh
# Sets up Git hooks for Activity Hub monorepo
# Enforces CSS standards and prevents styling drift

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HOOKS_DIR="$ROOT_DIR/.git/hooks"
SOURCE_HOOKS_DIR="$ROOT_DIR/.githooks"

echo "Setting up Activity Hub Git hooks..."
echo ""

# Check if .git directory exists
if [ ! -d "$ROOT_DIR/.git" ]; then
    echo "❌ Error: Not in a Git repository"
    exit 1
fi

# Create hooks directory if it doesn't exist
mkdir -p "$HOOKS_DIR"

# Copy pre-commit hook
if [ -f "$SOURCE_HOOKS_DIR/pre-commit" ]; then
    cp "$SOURCE_HOOKS_DIR/pre-commit" "$HOOKS_DIR/pre-commit"
    chmod +x "$HOOKS_DIR/pre-commit"
    echo "✅ Installed pre-commit hook"
else
    echo "❌ Error: pre-commit hook not found at $SOURCE_HOOKS_DIR/pre-commit"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "The pre-commit hook will now enforce:"
echo ""
echo "  ❌ ERRORS (block commits):"
echo "     • Component-specific CSS files (must use shared CSS only)"
echo "     • CSS imports outside of index.tsx"
echo "     • Inline styles (style={{...}})"
echo "     • .js/.jsx files (must use .ts/.tsx)"
echo ""
echo "  ⚠️  WARNINGS (don't block, but recommend fixing):"
echo "     • Hardcoded colors (use Activity Hub palette)"
echo "     • Missing .ah-* classes in components"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "CSS Standards:"
echo "  • Import CSS in frontend/src/index.tsx:"
echo "    import '@activity-hub/ui/styles/activity-hub.css';"
echo ""
echo "  • Use .ah-* classes for all styling"
echo "    See packages/ui/CSS_GUIDE.md for class reference"
echo ""
echo "  • No inline styles, no component CSS, no hardcoded colors"
echo ""
echo "Bypass hooks (not recommended):"
echo "  git commit --no-verify"
echo ""
