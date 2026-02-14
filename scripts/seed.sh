#!/usr/bin/env bash
#
# Seed script: create a canvas and invoke the AI agent on it.
# Usage: ./scripts/seed.sh [prompt]
#
set -euo pipefail

API_URL="${API_URL:-http://localhost:4000}"
INTERNAL_KEY="${INTERNAL_API_KEY:-mindscape-internal-dev-key}"
PROMPT="${1:-Create a brainstorming board about the future of AI with 5 diverse sticky notes}"

echo "Creating canvas..."
CANVAS=$(curl -s -X POST "$API_URL/canvases" \
  -H "Content-Type: application/json" \
  -d '{"title": "AI Brainstorm"}')

CANVAS_ID=$(echo "$CANVAS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$CANVAS_ID" ]; then
  echo "Failed to create canvas"
  echo "$CANVAS"
  exit 1
fi

echo "Canvas created: $CANVAS_ID"
echo "Invoking agent with prompt: $PROMPT"

RESULT=$(curl -s -X POST "$API_URL/canvases/$CANVAS_ID/agent/invoke" \
  -H "Content-Type: application/json" \
  -H "x-internal-key: $INTERNAL_KEY" \
  -d "{\"prompt\": \"$PROMPT\"}")

SESSION_ID=$(echo "$RESULT" | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)

echo "Agent session: $SESSION_ID"
echo ""
echo "View canvas at: http://localhost:3000/canvas/$CANVAS_ID"
echo "Agent is running in the background. Nodes will appear shortly."
