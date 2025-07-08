#!/bin/bash

# setup-claude-permissions.sh
# Automated Claude Code permissions setup for new projects
# Usage: ./setup-claude-permissions.sh [project-path]

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if project path is provided
if [ -z "$1" ]; then
    print_error "Usage: $0 <project-path>"
    echo "Example: $0 /path/to/your/project"
    exit 1
fi

PROJECT_PATH="$1"

# Validate project path
if [ ! -d "$PROJECT_PATH" ]; then
    print_error "Project path does not exist: $PROJECT_PATH"
    exit 1
fi

# Create .claude directory if it doesn't exist
CLAUDE_DIR="$PROJECT_PATH/.claude"
if [ ! -d "$CLAUDE_DIR" ]; then
    print_status "Creating .claude directory..."
    mkdir -p "$CLAUDE_DIR"
fi

# Copy template permissions file
TEMPLATE_FILE="$SCRIPT_DIR/claude-permissions-template.json"
TARGET_FILE="$CLAUDE_DIR/settings.local.json"

if [ ! -f "$TEMPLATE_FILE" ]; then
    print_error "Template file not found: $TEMPLATE_FILE"
    print_error "Please ensure claude-permissions-template.json exists in the same directory as this script"
    exit 1
fi

# Copy template to project
print_status "Copying permissions template to $TARGET_FILE..."
cp "$TEMPLATE_FILE" "$TARGET_FILE"

# Add to .gitignore if it exists
GITIGNORE_FILE="$PROJECT_PATH/.gitignore"
if [ -f "$GITIGNORE_FILE" ]; then
    # Check if .claude is already in .gitignore
    if ! grep -q "^\.claude" "$GITIGNORE_FILE"; then
        print_status "Adding .claude to .gitignore..."
        echo -e "\n# Claude Code local settings\n.claude/" >> "$GITIGNORE_FILE"
        print_success "Added .claude to .gitignore"
    else
        print_status ".claude already in .gitignore"
    fi
else
    print_warning "No .gitignore file found in project"
fi

# Create a README for the .claude directory
README_FILE="$CLAUDE_DIR/README.md"
cat > "$README_FILE" << 'EOF'
# Claude Code Local Settings

This directory contains project-specific settings for Claude Code.

## Files

- `settings.local.json` - Project-specific permissions and configuration
  - Uses DANGEROUSLY ALLOW ALL mode with "*" in allow array
  - Overrides global Claude Code settings
  - Should NOT be committed to version control

## Current Permission Mode: ALLOW ALL (Dangerous)

This configuration uses the most permissive settings:
- `"allow": ["*"]` - Allows ALL operations by default
- `"deny": [...]` - Only blocks specific Supabase write operations
- `disableBypassPermissionsMode: false` - Bypass mode enabled

## Usage

To add restrictions, edit `settings.local.json` and add operations to the `deny` array.

Example:
```json
{
  "permissions": {
    "disableBypassPermissionsMode": false,
    "allow": ["*"],
    "deny": [
      "mcp__supabase__apply_migration",
      "mcp__supabase__execute_sql",
      "Bash(rm -rf *)",
      "Write(/etc/*)"
    ]
  }
}
```

## Security Note

This is the MOST PERMISSIVE configuration possible. Claude Code can execute ANY operation except those explicitly denied. Use with caution and add deny rules as needed.
EOF

print_success "Created .claude/README.md"

# Final summary
echo ""
print_success "Claude Code permissions setup complete!"
echo ""
echo "📁 Project: $PROJECT_PATH"
echo "📄 Permissions file: $TARGET_FILE"
echo ""
echo "✅ What was done:"
echo "   - Created .claude directory"
echo "   - Configured permissions: ALLOW ALL by default"
echo "   - Blocked Supabase write operations for safety"
echo "   - Added .claude to .gitignore (if applicable)"
echo "   - Created README for .claude directory"
echo ""
echo "⚡ Permission Mode: DANGEROUSLY ALLOW ALL"
echo "   - All operations allowed by default with '*'"
echo "   - Only Supabase writes are denied"
echo "   - Add more to 'deny' array as needed"
echo ""
echo "🚀 Next steps:"
echo "   1. Review permissions in $TARGET_FILE"
echo "   2. Add operations to 'deny' array if needed"
echo "   3. Start using Claude Code with maximum autonomy!"
echo ""
echo "💡 Tip: Run 'claude config list' in your project to verify settings"