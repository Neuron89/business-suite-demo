#!/usr/bin/env bash
# Nightly demo reset: wipe all data volumes and re-seed every app from scratch
# so visitor edits never accumulate. Safe to run anytime.
set -euo pipefail

DIR="${INSTALL_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$DIR"

set -a; [ -f .env ] && . ./.env; set +a
PROFILE_ARGS=()
[ -n "${CLOUDFLARE_TUNNEL_TOKEN:-}" ] && PROFILE_ARGS=(--profile tunnel)

echo "[reset] $(date -Is) — tearing down + wiping volumes"
docker compose "${PROFILE_ARGS[@]}" down -v

echo "[reset] rebuilding + starting (containers re-run migrations + seeds)"
docker compose "${PROFILE_ARGS[@]}" up -d
echo "[reset] done."
