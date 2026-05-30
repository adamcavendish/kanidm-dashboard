#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_DIR="$ROOT/deploy/local"
TLS_DIR="$LOCAL_DIR/kanidm/tls"

mkdir -p "$TLS_DIR"

if [ ! -f "$TLS_DIR/key.pem" ] || [ ! -f "$TLS_DIR/chain.pem" ]; then
  openssl req \
    -x509 \
    -newkey rsa:4096 \
    -sha256 \
    -days 365 \
    -nodes \
    -keyout "$TLS_DIR/key.pem" \
    -out "$TLS_DIR/chain.pem" \
    -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
fi

chmod 400 "$TLS_DIR/key.pem"
chmod 400 "$TLS_DIR/chain.pem"
chmod 400 "$LOCAL_DIR/kanidm/server.toml"

docker compose -f "$LOCAL_DIR/docker-compose.yml" up -d kanidm

for _ in {1..30}; do
  if curl --fail --insecure --silent --show-error https://localhost:18443/status >/dev/null; then
    break
  fi
  sleep 1
done

echo "Kanidm is starting on https://localhost:18443"
echo "Same-origin dashboard preview will be https://localhost:9443 after you run:"
echo "  vp build"
echo "  docker compose -f deploy/local/docker-compose.yml up -d dashboard-proxy"
echo
echo "To recover/bootstrap the idm_admin account, run:"
echo "  docker compose -f deploy/local/docker-compose.yml exec kanidm kanidmd recover-account idm_admin -c /data/server.toml"

echo
echo "=== Running domain admin privilege setup ==="
"$ROOT/scripts/dev-kanidm-domain-admin-setup.sh"
