#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_DIR="$ROOT/deploy/local"
KANIDM_URL="${KANIDM_URL:-https://localhost:9443}"
KANIDM_LOGIN=()

if command -v kanidm >/dev/null 2>&1; then
  KANIDM=(kanidm)
  KANIDM_TLS_FLAGS=()
else
  KANIDM=(
    docker compose
    -f "$LOCAL_DIR/docker-compose.yml"
    --profile tools
    run --rm -T
    kanidm-tools
  )
  KANIDM_LOGIN=(
    docker compose
    -f "$LOCAL_DIR/docker-compose.yml"
    --profile tools
    run --rm
    kanidm-tools
  )
  KANIDM_TLS_FLAGS=(--accept-invalid-certs --skip-hostname-verification)
fi

if [ ${#KANIDM_LOGIN[@]} -eq 0 ]; then
  KANIDM_LOGIN=("${KANIDM[@]}")
fi

echo "Using Kanidm at $KANIDM_URL"
echo "This script expects an authenticated admin CLI session."
echo "If needed, run:"
echo "  ${KANIDM_LOGIN[*]} login --name idm_admin --url $KANIDM_URL ${KANIDM_TLS_FLAGS[*]}"

if ! "${KANIDM[@]}" self whoami --url "$KANIDM_URL" "${KANIDM_TLS_FLAGS[@]}" >/dev/null; then
  echo "No authenticated Kanidm admin CLI session was found." >&2
  exit 1
fi

"${KANIDM[@]}" group create engineering --url "$KANIDM_URL" "${KANIDM_TLS_FLAGS[@]}" || true
"${KANIDM[@]}" group create design --url "$KANIDM_URL" "${KANIDM_TLS_FLAGS[@]}" || true
"${KANIDM[@]}" group create app_grafana --url "$KANIDM_URL" "${KANIDM_TLS_FLAGS[@]}" || true
"${KANIDM[@]}" group create app_gitea --url "$KANIDM_URL" "${KANIDM_TLS_FLAGS[@]}" || true
"${KANIDM[@]}" group create app_docs --url "$KANIDM_URL" "${KANIDM_TLS_FLAGS[@]}" || true

"${KANIDM[@]}" person create ava "Ava Chen" --url "$KANIDM_URL" "${KANIDM_TLS_FLAGS[@]}" || true
"${KANIDM[@]}" person create mika "Mika Patel" --url "$KANIDM_URL" "${KANIDM_TLS_FLAGS[@]}" || true
"${KANIDM[@]}" person create rin "Rin Morales" --url "$KANIDM_URL" "${KANIDM_TLS_FLAGS[@]}" || true

"${KANIDM[@]}" group add-members engineering ava mika --url "$KANIDM_URL" "${KANIDM_TLS_FLAGS[@]}" || true
"${KANIDM[@]}" group add-members design rin --url "$KANIDM_URL" "${KANIDM_TLS_FLAGS[@]}" || true
"${KANIDM[@]}" group add-members app_grafana ava mika --url "$KANIDM_URL" "${KANIDM_TLS_FLAGS[@]}" || true
"${KANIDM[@]}" group add-members app_gitea mika --url "$KANIDM_URL" "${KANIDM_TLS_FLAGS[@]}" || true
"${KANIDM[@]}" group add-members app_docs rin --url "$KANIDM_URL" "${KANIDM_TLS_FLAGS[@]}" || true

echo "Core people and groups are ready."
echo "OAuth2 app fixtures should be added after Phase 0 confirms the stable kanidm CLI/API shape for oauth2 create/update in this Kanidm version."
