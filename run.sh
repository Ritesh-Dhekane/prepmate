#!/usr/bin/env sh
# Starts PrepMate. First run: creates .venv, installs requirements and makes .env from
# .env.example. Later runs only reinstall when requirements.txt has changed.
# Usage (from the repo root): ./run.sh   — set PORT for another port, NO_BROWSER=1 to skip the browser.
set -e
cd "$(dirname "$0")"

if [ ! -x .venv/bin/python ]; then
  echo "Creating virtual environment (.venv)..."
  python3 -m venv .venv
fi

stamp=.venv/.requirements.sha256
hash=$( (sha256sum requirements.txt 2>/dev/null || shasum -a 256 requirements.txt) | cut -d' ' -f1)
if [ "$(cat "$stamp" 2>/dev/null)" != "$hash" ]; then
  echo "Installing requirements..."
  .venv/bin/python -m pip install --disable-pip-version-check -q -r requirements.txt
  echo "$hash" > "$stamp"
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example. Add AI_API_KEY there for AI analysis (optional)."
fi

PORT=${PORT:-5000}
export PORT
url="http://127.0.0.1:$PORT"
echo "PrepMate: $url  (Ctrl+C to stop)"
if [ -z "$NO_BROWSER" ]; then
  ( sleep 2; (xdg-open "$url" || open "$url") >/dev/null 2>&1 ) &
fi
exec .venv/bin/python app.py
