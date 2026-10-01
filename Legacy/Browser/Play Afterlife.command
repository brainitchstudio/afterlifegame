#!/bin/bash
# Double-click to play Afterlife. Starts a local web server and opens the game.
# Close this Terminal window (or press Ctrl+C) to stop the server.
cd "$(dirname "$0")" || exit 1
PORT=8087
URL="http://127.0.0.1:$PORT/"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required. Install it with: xcode-select --install"
  read -n 1 -s -r -p "Press any key to close."
  exit 1
fi

# Reuse a server that is already running on this port.
if curl -s -o /dev/null "$URL"; then
  echo "Afterlife is already running at $URL"
  open "$URL"
  exit 0
fi

echo "Starting Afterlife at $URL"
echo "Keep this window open while you play. Press Ctrl+C to stop."
(sleep 1; open "$URL") &
exec python3 -m http.server "$PORT" --bind 127.0.0.1
