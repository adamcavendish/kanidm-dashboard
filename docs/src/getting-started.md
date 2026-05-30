# Getting Started

## Prerequisites

- **Node.js** ≥ 22
- **Vite+** (`vp`) — the project uses `vp` (Vite+) as its toolchain entry point
- **just** — command runner for project recipes
- **openapi-nexus** — Rust CLI for generating the TypeScript SDK
- **Kanidm** (optional) — for real-API development and E2E tests

## Quick start

```bash
# Install dependencies
vp install

# Generate the Kanidm TypeScript SDK (required before vp dev or vp build)
just generate-sdk

# Start the dev server
vp dev
```

Open `http://localhost:5173`. The default config uses Kanidm mode — use
`scripts/fixtures/dashboard.config.mock.json` as `public/dashboard.config.json`
for pre-seeded demo data without a Kanidm backend.

## Local Kanidm

Start Kanidm and generate TLS certificates:

```bash
./scripts/dev-kanidm-bootstrap.sh
```

This starts Kanidm on `https://localhost:18443`. During `vp dev`, Vite proxies
Kanidm routes (`/v1`, `/oauth2`, `/.well-known`, `/docs`) to that server.

Recover the `idm_admin` password:

```bash
docker compose -f deploy/local/docker-compose.yml exec kanidm \
  kanidmd recover-account idm_admin -c /data/server.toml
```

Copy `.env.local.example` to `.env.local` with the recovered password.

## Same-origin preview

Build the dashboard and serve it through Caddy for a production-like setup:

```bash
vp build
docker compose -f deploy/local/docker-compose.yml up -d dashboard-proxy
```

Open `https://localhost:9443`. Caddy serves dashboard assets and proxies Kanidm
routes.

## Commands

| Command             | Description                          |
| ------------------- | ------------------------------------ |
| `just install`      | Install dependencies                 |
| `just generate-sdk` | Regenerate the Kanidm TypeScript SDK |
| `just check`        | Type-check and lint                  |
| `just test`         | Run unit tests                       |
| `just build`        | Production build to `dist/`          |
| `just audit`        | Verify production build integrity    |
| `just ci-fast`      | Run all fast quality checks          |
| `just book`         | Build the documentation site         |
| `just book-serve`   | Serve documentation with live reload |
