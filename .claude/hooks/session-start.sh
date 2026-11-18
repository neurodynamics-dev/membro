#!/bin/bash
# SessionStart hook for Claude Code cloud sessions: installs what the browser
# tests in testes/ need (see testes/LEIAME.md). Chromium is preinstalled at
# /opt/pw-browsers and the tests launch it from there, so no browser download.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# pdftotext (poppler-utils): aproveitamento.mjs checks the final PDF with it
if ! command -v pdftotext >/dev/null; then
  apt-get update
  apt-get install -y poppler-utils
fi

# npm install in testes/ only when this script or testes/package.json changed
# since the last successful install (package-lock.json is gitignored)
hashes=testes/node_modules/.session-start.sha256
if ! sha256sum --check --status "$hashes" 2>/dev/null; then
  rm -f "$hashes"
  (cd testes && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-audit --no-fund)
  sha256sum .claude/hooks/session-start.sh testes/package.json > "$hashes" || rm -f "$hashes"
fi
