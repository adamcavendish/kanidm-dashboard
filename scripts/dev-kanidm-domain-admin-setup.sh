#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_DIR="$ROOT/deploy/local"
KANIDM_URL="${KANIDM_URL:-https://localhost:18443}"
COMPOSE_FILE="$LOCAL_DIR/docker-compose.yml"

echo "=== Recovering admin account ==="
ADMIN_PW=$(docker compose -f "$COMPOSE_FILE" exec -T kanidm kanidmd recover-account admin -c /data/server.toml 2>&1 | grep -oE 'new_password: "[^"]*"' | head -1 | sed 's/new_password: "//' | tr -d '"')
if [ -z "$ADMIN_PW" ]; then
  echo "ERROR: Could not recover admin account"
  exit 1
fi
echo "Admin password recovered: ${ADMIN_PW:0:8}..."

echo "=== Authenticating as admin ==="
AUTH_INIT=$(curl --insecure --silent --show-error --dump-header - \
  -X POST "$KANIDM_URL/v1/auth" \
  -H "Content-Type: application/json" -H "Accept: application/json" \
  -d '{"step":{"init2":{"username":"admin","issue":"token","privileged":true}}}')
AUTH_SESSION=$(echo "$AUTH_INIT" | grep -i 'x-kanidm-auth-session-id:' | tr -d '\r' | sed 's/.*: //')
if [ -z "$AUTH_SESSION" ]; then
  echo "ERROR: Could not start auth session for admin"
  exit 1
fi

curl --insecure --silent --show-error --fail \
  -X POST "$KANIDM_URL/v1/auth" \
  -H "Content-Type: application/json" -H "Accept: application/json" \
  -H "X-KANIDM-AUTH-SESSION-ID: $AUTH_SESSION" \
  -d '{"step":{"begin":"password"}}' > /dev/null

AUTH_CRED=$(curl --insecure --silent --show-error --fail \
  -X POST "$KANIDM_URL/v1/auth" \
  -H "Content-Type: application/json" -H "Accept: application/json" \
  -H "X-KANIDM-AUTH-SESSION-ID: $AUTH_SESSION" \
  -d "{\"step\":{\"cred\":{\"password\":\"$ADMIN_PW\"}}}")

AUTH_TOKEN=$(echo "$AUTH_CRED" | python3 -c "import sys,json; print(json.load(sys.stdin)['state']['success'])" 2>/dev/null)
if [ -z "$AUTH_TOKEN" ]; then
  echo "ERROR: Could not authenticate as admin"
  exit 1
fi
AUTH_HEADER="Authorization: Bearer $AUTH_TOKEN"
echo "Authenticated as admin"

echo "=== Adding idm_admins to domain_admins ==="
curl --insecure --silent --show-error --fail \
  -X POST "$KANIDM_URL/v1/group/domain_admins/_attr/member" \
  -H "$AUTH_HEADER" -H "Content-Type: application/json" \
  -d '["idm_admins"]' || echo "  (may already be a member)"
echo "idm_admins added as member of domain_admins"

echo "=== Verifying domain visibility ==="
DOMAIN_RESULT=$(curl --insecure --silent --show-error \
  -H "$AUTH_HEADER" "$KANIDM_URL/v1/domain" || echo "[]")
DOMAIN_COUNT=$(echo "$DOMAIN_RESULT" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
echo "Domain entries visible: $DOMAIN_COUNT"
if [ "$DOMAIN_COUNT" -gt 0 ]; then
  echo "Domain entry is now visible to domain_admins"
else
  echo "WARN: Domain entry still not visible. Check domain_admins membership."
fi

echo ""
echo "=== Domain admin setup complete ==="
echo "Note: group displayname writes remain unsupported by Kanidm 1.10.3 built-in ACPs."
echo "The dashboard shows warnings when optional group metadata is rejected."
