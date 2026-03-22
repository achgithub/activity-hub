#!/bin/bash

# Install Activity Hub git hooks to mini-app repositories
# This ensures mini-apps enforce SDK component usage

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ACTIVITY_HUB_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
HOOK_SOURCE="$ACTIVITY_HUB_ROOT/.githooks/pre-commit"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "🔧 Installing Activity Hub git hooks to mini-apps..."
echo ""

# Check if hook source exists
if [ ! -f "$HOOK_SOURCE" ]; then
    echo -e "${RED}❌ Error: Hook source not found at $HOOK_SOURCE${NC}"
    exit 1
fi

# Function to install hook to a repository
install_hook() {
    local REPO_PATH=$1
    local REPO_NAME=$(basename "$REPO_PATH")

    if [ ! -d "$REPO_PATH/.git" ]; then
        echo -e "${YELLOW}⚠️  Skipping $REPO_NAME (not a git repository)${NC}"
        return
    fi

    # Create .githooks directory if it doesn't exist
    mkdir -p "$REPO_PATH/.githooks"

    # Copy the hook
    cp "$HOOK_SOURCE" "$REPO_PATH/.githooks/pre-commit"
    chmod +x "$REPO_PATH/.githooks/pre-commit"

    # Configure git to use .githooks directory
    cd "$REPO_PATH"
    git config core.hooksPath .githooks

    echo -e "${GREEN}✓${NC} Installed hook to $REPO_NAME"
}

# Install to known mini-apps
PROJECTS_DIR="$( cd "$ACTIVITY_HUB_ROOT/.." && pwd )"

# List of mini-app directories
MINI_APPS=(
    "activity-hub-dice"
    "activity-hub-tictactoe"
)

for APP in "${MINI_APPS[@]}"; do
    APP_PATH="$PROJECTS_DIR/$APP"
    if [ -d "$APP_PATH" ]; then
        install_hook "$APP_PATH"
    else
        echo -e "${YELLOW}⚠️  Mini-app not found: $APP_PATH${NC}"
    fi
done

echo ""
echo -e "${GREEN}✅ Hook installation complete!${NC}"
echo ""
echo "The pre-commit hook will now enforce:"
echo "  • No inline styles"
echo "  • No component CSS files"
echo "  • No manual app headers (must use AppHeader component)"
echo "  • TypeScript only (.tsx)"
echo ""
echo "To test in a mini-app, try committing a manual header:"
echo "  <div className=\"ah-app-header\">...</div>"
echo ""
