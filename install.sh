#!/usr/bin/env bash
# =============================================================================
# Acme Industries Business Suite — installer
#
# Localhost (no domain, no tunnel):
#   bash install.sh --local          -> http://localhost:8080
#
# Self-hosted on your own domain (behind a Cloudflare tunnel):
#   bash install.sh                  first run writes .env and stops
#   $EDITOR .env                     set DEMO_DOMAIN + CLOUDFLARE_TUNNEL_TOKEN
#   bash install.sh                  builds + starts, including the tunnel
#
# Optional env:
#   INSTALL_DIR  where the repo lives (default: this checkout)
# =============================================================================
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
cd "$INSTALL_DIR"

bold()  { printf "\033[1m%s\033[0m\n" "$1"; }
green() { printf "\033[32m%s\033[0m\n" "$1"; }
red()   { printf "\033[31m%s\033[0m\n" "$1" >&2; }

MODE=public
[ "${1:-}" = "--local" ] && MODE=local

bold "[install] Acme Industries Business Suite ($MODE)"

# ---------------------------------------------------------------- preflight ---
need() { command -v "$1" >/dev/null 2>&1 || { red "[install] '$1' is required but not installed."; exit 1; }; }
need docker
docker compose version >/dev/null 2>&1 || { red "[install] docker compose v2 plugin is required."; exit 1; }

# ----------------------------------------------------------------- env file ---
COMPOSE_ARGS=()
if [ "$MODE" = "local" ]; then
  ENV_FILE=local.env
  COMPOSE_ARGS+=(--env-file local.env)
else
  ENV_FILE=.env
  if [ ! -f .env ]; then
    cp .env.example .env
    red "[install] wrote .env from template. Edit it (DEMO_DOMAIN + CLOUDFLARE_TUNNEL_TOKEN), then re-run."
    exit 0
  fi
fi
set -a; . "./$ENV_FILE"; set +a

# --------------------------------------------------------------- compose up ---
if [ "$MODE" = "public" ]; then
  if [ -n "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]; then
    COMPOSE_ARGS+=(--profile tunnel)
    bold "[install] tunnel token present — bringing up WITH the Cloudflare tunnel"
  else
    red "[install] no CLOUDFLARE_TUNNEL_TOKEN set — starting without the tunnel (proxy only, on port ${HTTP_PORT:-8080})"
  fi
fi

bold "[install] building containers (first run takes several minutes)"
docker compose ${COMPOSE_ARGS[@]+"${COMPOSE_ARGS[@]}"} up -d --build

# ----------------------------------------------------------------- wait ---
D="${DEMO_DOMAIN:-demo.haydennester.com}"
echo -n "[install] waiting for the proxy "
for i in $(seq 1 90); do
  if curl -sf -H "Host: ${D}" "http://localhost:${HTTP_PORT:-8080}/" >/dev/null 2>&1; then
    echo " ready."; break
  fi
  echo -n "."; sleep 2
done

# ----------------------------------------------------------------- done ---
BASE="${DEMO_SCHEME:-https}://"
SUFFIX="${DEMO_PORT_SUFFIX:-}"
green "
=================================================================
  Acme Industries Business Suite — running
=================================================================
  Portal              ${BASE}${D}${SUFFIX}
  MOC                 ${BASE}moc.${D}${SUFFIX}
  IT Request          ${BASE}it.${D}${SUFFIX}
  Shipping            ${BASE}ship.${D}${SUFFIX}
  QC Lab              ${BASE}qc.${D}${SUFFIX}
  IQMS Chat           ${BASE}chat.${D}${SUFFIX}
  Employee Directory  ${BASE}dir.${D}${SUFFIX}
  Complaint Tracker   ${BASE}complaints.${D}${SUFFIX}
  SDS Portal          ${BASE}sds.${D}${SUFFIX}
  Onboarding          ${BASE}onboarding.${D}${SUFFIX}

  Sign in: pick IT / HR / Manager / Employee on the portal login
  page, then click any tile to land in that app authenticated.

  Stop:        docker compose down
  Reset data:  docker compose down -v, then start again
               (or bash deploy/reset.sh for the .env deployment)
=================================================================
"
