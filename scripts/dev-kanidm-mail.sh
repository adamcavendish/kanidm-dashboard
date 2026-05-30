#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_DIR="$ROOT/deploy/local"
MAILPIT_TLS_DIR="$LOCAL_DIR/mailpit/tls"
MAIL_SENDER_CONFIG="$LOCAL_DIR/kanidm/mail-sender.local.toml"
KANIDM_URL="${KANIDM_URL:-https://localhost:18443}"
export KANIDM_URL
CERT_REGENERATED=0

mkdir -p "$MAILPIT_TLS_DIR"

if [ ! -f "$MAILPIT_TLS_DIR/ca.pem" ] ||
  [ ! -f "$MAILPIT_TLS_DIR/key.pem" ] ||
  [ ! -f "$MAILPIT_TLS_DIR/chain.pem" ]; then
  CERT_REGENERATED=1
  rm -f \
    "$MAILPIT_TLS_DIR/ca.key" \
    "$MAILPIT_TLS_DIR/ca.pem" \
    "$MAILPIT_TLS_DIR/ca.srl" \
    "$MAILPIT_TLS_DIR/cert.pem" \
    "$MAILPIT_TLS_DIR/chain.pem" \
    "$MAILPIT_TLS_DIR/key.pem" \
    "$MAILPIT_TLS_DIR/server.csr" \
    "$MAILPIT_TLS_DIR/server.ext"

  openssl req \
    -x509 \
    -newkey rsa:4096 \
    -sha256 \
    -days 365 \
    -nodes \
    -keyout "$MAILPIT_TLS_DIR/ca.key" \
    -out "$MAILPIT_TLS_DIR/ca.pem" \
    -subj "/CN=Kanidm Dashboard Local Mailpit CA" \
    -addext "basicConstraints=critical,CA:TRUE" \
    -addext "keyUsage=critical,keyCertSign,cRLSign"

  openssl req \
    -newkey rsa:4096 \
    -sha256 \
    -nodes \
    -keyout "$MAILPIT_TLS_DIR/key.pem" \
    -out "$MAILPIT_TLS_DIR/server.csr" \
    -subj "/CN=mailpit"

  cat >"$MAILPIT_TLS_DIR/server.ext" <<EOF
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=DNS:mailpit,DNS:localhost,IP:127.0.0.1
EOF

  openssl x509 \
    -req \
    -in "$MAILPIT_TLS_DIR/server.csr" \
    -CA "$MAILPIT_TLS_DIR/ca.pem" \
    -CAkey "$MAILPIT_TLS_DIR/ca.key" \
    -CAcreateserial \
    -out "$MAILPIT_TLS_DIR/cert.pem" \
    -days 365 \
    -sha256 \
    -extfile "$MAILPIT_TLS_DIR/server.ext"

  cat "$MAILPIT_TLS_DIR/cert.pem" "$MAILPIT_TLS_DIR/ca.pem" >"$MAILPIT_TLS_DIR/chain.pem"
fi

chmod 400 "$MAILPIT_TLS_DIR/ca.key"
chmod 444 "$MAILPIT_TLS_DIR/ca.pem"
chmod 400 "$MAILPIT_TLS_DIR/key.pem"
chmod 444 "$MAILPIT_TLS_DIR/chain.pem"

docker compose -f "$LOCAL_DIR/docker-compose.yml" --profile mail up -d kanidm
if [ "$CERT_REGENERATED" -eq 1 ]; then
  docker compose -f "$LOCAL_DIR/docker-compose.yml" --profile mail up -d --force-recreate mailpit
else
  docker compose -f "$LOCAL_DIR/docker-compose.yml" --profile mail up -d mailpit
fi

for _ in {1..30}; do
  if curl --fail --insecure --silent --show-error "$KANIDM_URL/status" >/dev/null; then
    break
  fi
  sleep 1
done

vp exec node scripts/dev-kanidm-mail-bootstrap.mjs

docker compose -f "$LOCAL_DIR/docker-compose.yml" --profile mail up -d --force-recreate kanidm-mail-sender

echo "Mail capture is ready at http://localhost:18025"
echo "Generated local sender config: $MAIL_SENDER_CONFIG"
