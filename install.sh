#!/usr/bin/env bash
# =============================================================================
# Acme Industries Business Suite — installer (self-hosted, behind Cloudflare)
#
# Usage (on the home server, e.g. 192.168.1.193):
#   git clone https://github.com/Neuron89/business-suite-demo.git
#   cd business-suite-demo && bash install.sh
#
# First run copies .env.example -> .env and stops so you can fill it in
# (DEMO_DOMAIN + CLOUDFLARE_TUNNEL_TOKEN). Re-run to build + start.
#
# Optional env:
#   INSTALL_DIR  where to clone/find the repo (default: this checkout)
# =============================================================================
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
cd "$INSTALL_DIR"

bold()  { printf "\033[1m%s\033[0m\n" "$1"; }
green() { printf "\033[32m%s\033[0m\n" "$1"; }
red()   { printf "\033[31m%s\033[0m\n" "$1" >&2; }

bold "[install] Acme Industries Business Suite"

# ---------------------------------------------------------------- preflight ---
need() { command -v "$1" >/dev/null 2>&1 || { red "[install] '$1' is required but not installed."; exit 1; }; }
need docker
docker compose version >/dev/null 2>&1 || { red "[install] docker compose v2 plugin is required."; exit 1; }

# ----------------------------------------------------------------- env file ---
if [ ! -f .env ]; then
  cp .env.example .env
  red "[install] wrote .env from template. Edit it (DEMO_DOMAIN + CLOUDFLARE_TUNNEL_TOKEN), then re-run."
  exit 0
fi
set -a; . ./.env; set +a

# --------------------------------------------------------------- compose up ---
PROFILE_ARGS=()
if [ -n "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]; then
  PROFILE_ARGS=(--profile tunnel)
  bold "[install] tunnel token present — bringing up WITH the Cloudflare tunnel"
else
  red "[install] no CLOUDFLARE_TUNNEL_TOKEN set — local-only (reach via http://localhost:${HTTP_PORT:-8080} with a Host header)"
fi

bold "[install] building containers (first run takes ~5-10 minutes)"
docker compose "${PROFILE_ARGS[@]}" up -d --build

# ----------------------------------------------------------------- wait ---
echo -n "[install] waiting for the proxy "
for i in $(seq 1 90); do
  if curl -sf -H "Host: ${DEMO_DOMAIN:-demo.haydennester.com}" "http://localhost:${HTTP_PORT:-8080}/" >/dev/null 2>&1; then
    echo " ready."; break
  fi
  echo -n "."; sleep 2
done

# ----------------------------------------------------------------- done ---
D="${DEMO_DOMAIN:-demo.haydennester.com}"
green "
=================================================================
  Acme Industries Business Suite — live
=================================================================
  Portal              https://${D}
  MOC                 https://moc.${D}
  IT Request          https://it.${D}
  Shipping            https://ship.${D}
  QC Lab              https://qc.${D}
  IQMS Chat           https://chat.${D}
  Employee Directory  https://dir.${D}
  Complaint Tracker   https://complaints.${D}
  SDS Portal          https://sds.${D}
  Onboarding          https://onboarding.${D}

  Sign in: pick IT / HR / Manager / Employee on the portal login
  page, then click any tile to land in that app authenticated.

  Stop:        docker compose down
  Reset data:  bash deploy/reset.sh
=================================================================
"
