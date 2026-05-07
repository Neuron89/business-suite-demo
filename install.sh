#!/usr/bin/env bash
# =============================================================================
# Acme Industries Business Suite — one-line installer
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Neuron89/business-suite-demo/main/install.sh | bash
#
# Optional env:
#   INSTALL_DIR  where to clone the repo (default: $HOME/business-suite-demo)
# =============================================================================
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-$HOME/business-suite-demo}"
REPO_URL="${REPO_URL:-https://github.com/Neuron89/business-suite-demo.git}"

bold()  { printf "\033[1m%s\033[0m\n" "$1"; }
green() { printf "\033[32m%s\033[0m\n" "$1"; }
red()   { printf "\033[31m%s\033[0m\n" "$1" >&2; }

bold "[install] Acme Industries Business Suite — demo installer"

# ---------------------------------------------------------------- preflight ---
need() {
  command -v "$1" >/dev/null 2>&1 || { red "[install] '$1' is required but not installed."; exit 1; }
}
need git
need docker
docker compose version >/dev/null 2>&1 || { red "[install] docker compose v2 plugin is required."; exit 1; }

# ----------------------------------------------------------------- clone ---
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "[install] updating existing checkout at $INSTALL_DIR"
  git -C "$INSTALL_DIR" pull --ff-only
else
  echo "[install] cloning into $INSTALL_DIR"
  git clone --depth=1 "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# ------------------------------------------------------------- compose up ---
bold "[install] building containers (first run takes ~5-10 minutes)"
docker compose up -d --build

# ----------------------------------------------------------------- wait ---
echo -n "[install] waiting for portal to come up "
for i in $(seq 1 90); do
  if curl -sf http://localhost:3070 >/dev/null 2>&1; then
    echo " ready."
    break
  fi
  echo -n "."
  sleep 2
done

# ----------------------------------------------------------------- done ---
green "
=================================================================
  Acme Industries Business Suite — Demo
=================================================================
  Portal              http://localhost:3070
  MOC                 http://localhost:3000
  IT Request          http://localhost:3020
  Shipping            http://localhost:3030
  QC Lab              http://localhost:5000
  IQMS Chat           http://localhost:5055
  Employee Directory  http://localhost:5065

  Sign in: pick one of IT / HR / Manager / Employee from the
  dropdown on the portal login page. Click any tile to land in
  the corresponding app already authenticated.

  Stop:   docker compose -f $INSTALL_DIR/docker-compose.yml down
  Reset:  docker compose -f $INSTALL_DIR/docker-compose.yml down -v
=================================================================
"
