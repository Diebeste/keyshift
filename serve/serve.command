#!/bin/bash
# Key Shift for macOS: double-click to start, then use the browser tab that opens. Close this window to stop.
cd "$(dirname "$0")"
PORT=8765
if xcode-select -p >/dev/null 2>&1 && command -v python3 >/dev/null 2>&1; then exec python3 serve.py $PORT
elif command -v node >/dev/null 2>&1; then exec node serve.mjs $PORT
elif command -v ruby >/dev/null 2>&1 && ruby -e 'require "webrick"' >/dev/null 2>&1; then
  (sleep 1; open "http://localhost:$PORT/") &
  echo "Key Shift running at http://localhost:$PORT/ (close this window to stop)"
  exec ruby -run -e httpd . -b 127.0.0.1 -p $PORT
else
  echo "No Python 3, Node or Ruby found. Install Python 3 (python.org) or Node (nodejs.org), then double-click again."
  read -n 1 -s -r -p "Press any key to close"
fi
