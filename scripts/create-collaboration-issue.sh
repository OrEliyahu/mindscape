#!/usr/bin/env bash
# Creates the GitHub issue for agent collaboration feature.
# Requires: gh CLI authenticated (run `gh auth login` first)
set -euo pipefail

REPO="OrEliyahu/mindscape"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BODY_FILE="$SCRIPT_DIR/../docs/agent-collaboration-proposal.md"

if ! command -v gh &> /dev/null; then
  echo "Error: gh CLI not found. Install from https://cli.github.com"
  exit 1
fi

if ! gh auth status &> /dev/null; then
  echo "Error: Not authenticated. Run 'gh auth login' first."
  exit 1
fi

if [ ! -f "$BODY_FILE" ]; then
  echo "Error: Issue body file not found at $BODY_FILE"
  exit 1
fi

echo "Creating GitHub issue in $REPO..."
gh issue create \
  --repo "$REPO" \
  --title "Agent Collaboration: Enable inter-agent communication for coordinated creative output" \
  --body-file "$BODY_FILE" \
  --label "enhancement"

echo "Done!"
