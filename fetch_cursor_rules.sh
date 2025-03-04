#!/bin/bash
# fetch_cursor_rules.sh - Cursor Rules Management Script
#
# Purpose:
# This script manages Cursor IDE rules by fetching them from a central repository.
# It's necessary because Cursor IDE doesn't support storing .cursor directory in
# virtual environments, making it difficult to share consistent rules across projects
# and team members.
#
# Why this approach:
# 1. Centralized Rules: Maintains consistent coding standards across projects
# 2. Version Control: Rules are tracked and can be rolled back if needed
# 3. Easy Updates: Single command to update rules across all projects
# 4. Minimal Download: Uses git sparse-checkout to fetch only required files
# 5. Team Synchronization: Ensures all team members use the same rules
#
# Required Files:
# Files will maintain the structure from the repository:
# .cursor/
#   rules/
#     001-code-advice-rules.mdc
#     002-design-patterns.mdc
#     003-package-usage.mdc
#     ...
#
# Usage:
# ./fetch_cursor_rules.sh

set -e

TARGET_DIR=".cursor"
TEMP_DIR=".cursor_temp"
REPO_URL="https://github.com/grahama1970/snippets.git"
BRANCH="master"

# Clean up any existing directories
rm -rf "$TARGET_DIR" "$TEMP_DIR"

# Clone repository to temp directory
git clone --no-checkout "$REPO_URL" "$TEMP_DIR"
cd "$TEMP_DIR"
git sparse-checkout init --cone
git sparse-checkout set ".cursor/rules"
git checkout "$BRANCH"

# Create target directory and copy with correct structure
cd ..
mkdir -p "$TARGET_DIR/rules"
cp -r "$TEMP_DIR/.cursor/rules/"* "$TARGET_DIR/rules/"

# Clean up temp directory
rm -rf "$TEMP_DIR"

# Verify the rules were downloaded
if [ ! -d "$TARGET_DIR/rules" ] || [ -z "$(ls -A $TARGET_DIR/rules)" ]; then
    echo "🚨❌ Error: Failed to fetch cursor rules"
    exit 1
fi

echo "🎉✅ Cursor rules updated successfully"
