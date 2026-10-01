#!/bin/bash
# Double-click to play Afterlife.
# Runs the Python backend server and opens the React web game in your browser.
cd "$(dirname "$0")" || exit 1
PORT=8087
URL="http://127.0.0.1:$PORT/"

if ! command -v python3 >/dev/null 2>&1; then
  echo "Error: python3 is required. Install it or Xcode Command Line Tools."
  read -n 1 -s -r -p "Press any key to close."
  exit 1
fi

# Build the production bundle when it is missing or older than the web sources
if [ -d "web" ] && { [ ! -f "dist/index.html" ] || [ -n "$(find web/src web/public web/index.html -newer dist/index.html -print -quit)" ]; }; then
  if ! command -v npm >/dev/null 2>&1; then
    echo "Error: the web sources changed but npm is not installed to rebuild them."
    read -n 1 -s -r -p "Press any key to close."
    exit 1
  fi
  echo "Building React frontend for Afterlife..."
  (cd web && { [ -d node_modules ] || npm install; } && npm run build) || { read -n 1 -s -r -p "Build failed. Press any key to close."; exit 1; }
fi

# Reuse a server that is already running on this port
if curl -s -o /dev/null "$URL"; then
  echo "Afterlife is already running at $URL"
  open "$URL"
  exit 0
fi

echo "Starting Afterlife Python Server at $URL"
echo "Keep this window open while you play. Press Ctrl+C to stop."
(sleep 1; open "$URL") &
exec python3 server.py
