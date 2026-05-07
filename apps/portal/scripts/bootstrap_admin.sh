#!/usr/bin/env bash
#
# One-shot script to flip demo IT admin flags in the Employee Tech Doc directory
# so he becomes the portal admin. Run this once after the new schema columns
# have been created (i.e. after rebuilding the employee-tech-doc container).
#
# Usage:  ./scripts/bootstrap_admin.sh demo.it@acme.demo
#
# Reads PORTAL_SERVICE_TOKEN + DIRECTORY_BASE_URL from .env.
#
set -euo pipefail

EMAIL="${1:-demo.it@acme.demo}"

# shellcheck disable=SC1091
if [ -f .env ]; then source .env; fi

: "${PORTAL_SERVICE_TOKEN:?PORTAL_SERVICE_TOKEN must be set in .env}"
: "${DIRECTORY_BASE_URL:=http://localhost:5065}"

curl -sS -X PATCH \
  "${DIRECTORY_BASE_URL%/}/api/directory/employees/${EMAIL}/access" \
  -H "X-Service-Token: ${PORTAL_SERVICE_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{
    "portal_role": "admin",
    "access": {
      "moc": true,
      "it": true,
      "qc": true,
      "sds": true,
      "complaint": true,
      "iqms_chat": true,
      "employee_db": true,
      "shipping": true
    }
  }'
echo
echo "Flipped ${EMAIL} to admin with all module access. Sign in at the portal."
