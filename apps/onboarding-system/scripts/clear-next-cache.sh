#!/usr/bin/env bash
# Recover from the intermittent Next.js dev-mode "stuck .next cache" bug.
#
# Symptom: site returns HTTP 500 with errors like
#   Cannot find module './<N>.js'
#   ENOENT: no such file or directory, open '.next/routes-manifest.json'
# These show up after a long-running `next dev` process drops chunks during
# hot-reload cycles. We've hit it on several repos including portal and
# parts-tracker (the original incident was the parts-tracker note in
# Hayden's memory file).
#
# Fix: nuke client/.next so Next.js rebuilds clean on the next startup,
# then restart the systemd unit. First page request after restart will
# be slow (~30-60s) while it recompiles.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NEXT_DIR="$REPO_DIR/client/.next"
SERVICE="onboarding-system"

echo "→ Repo:    $REPO_DIR"
echo "→ Service: $SERVICE"
echo

if [ -d "$NEXT_DIR" ]; then
  SIZE=$(du -sh "$NEXT_DIR" 2>/dev/null | cut -f1)
  echo "Removing $NEXT_DIR ($SIZE)..."
  rm -rf "$NEXT_DIR"
  echo "  done."
else
  echo "$NEXT_DIR doesn't exist — already clean."
fi

echo
echo "Now restart the service:"
echo "  sudo systemctl restart $SERVICE"
echo
echo "First request to the app will take 30-60s while Next.js rebuilds."
