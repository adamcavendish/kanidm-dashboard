# Kanidm Dashboard

A modern web console for [Kanidm](https://github.com/kanidm/kanidm) — the
identity provider. Built as a SolidJS single-page application with a clean
separation between static deploy-time config and live Kanidm data.

[![CI](https://github.com/adamcavendish/kanidm-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/adamcavendish/kanidm-dashboard/actions/workflows/ci.yml)

## Overview

Kanidm Dashboard provides a ready-to-deploy admin and self-service interface over
the Kanidm REST API. It talks to Kanidm through a same-origin proxy — the
dashboard is a static asset bundle served alongside Kanidm's `/v1`, `/oauth2`,
and `/ui` routes by a reverse proxy such as Caddy.

**Who is this for?**

- Organisations running Kanidm who want an admin UI and user portal without
  building their own frontend
- Operators who prefer static deploy-time config (theme, branding, login message)
  over a writeable app database
- Developers integrating Kanidm OAuth2 who need a reference client
  implementation

## Features

- **Admin console** — manage people, groups, and OAuth2 applications with
  review-before-submit wizards and access-impact previews
- **Self-service portal** — users can manage their own credentials: password,
  TOTP, passkeys, SSH public keys, RADIUS, and Unix account settings
- **Credential update wizard** — multi-step state machine for enrolling new
  credentials via reset tokens
- **Relationship explorer** — visualise how people, groups, and applications
  connect
- **Native Kanidm branding** — domain display name, domain image, and OAuth2
  application icons are read from (and written to) Kanidm directly
- **Static theme config** — company name, logo, login message, and light/dark
  theme are deploy-time settings in a JSON file — no database required
- **OAuth2 / OIDC consent flow** — built-in consent page and native OAuth2
  authorization endpoint
- **Two data source adapters** — `KanidmDataSource` (real API) and
  `MockDataSource` (in-memory demo) share the same interface, so you can develop
  against mock data and switch to a live Kanidm with a config change
- **E2E test suite** — Playwright tests against a real Kanidm server covering
  admin workflows, self-service, OAuth2 consent, credential resets, WebAuthn
  passkeys, and recovery email

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

## Architecture

```
browser
  │
  ├─ /                   → dashboard SPA (SolidJS + Vite)
  ├─ /v1/*               → Kanidm REST API (proxied by Caddy / Vite dev server)
  ├─ /oauth2/*           → Kanidm OAuth2 endpoints
  └─ /dashboard.config.json → static deploy-time config
```

```
src/
  domain.ts             Shared types: Person, Group, Application, ConsoleState
  data-source.ts        DashboardDataSource interface + KanidmDataSource + MockDataSource
  store.tsx             SolidJS context: state, auth, credential operations
  kanidm-auth.ts        Auth state machine: password, TOTP, passkey, backup code, security key
  kanidm-mappers.ts     Kanidm API response → domain model mapping
  kanidm-composite.ts   Multi-step create operations: groups, OAuth2 apps
  kanidm-error.ts       HTTP error types and auth-failure detection
  seed.ts               Initial state and demo fixtures
  App.tsx               Router, layout shells, and page components
  components/           Shared UI components: ErrorBox, OptionGrid, GlassPanel, etc.
  generated/            TypeScript SDK generated from Kanidm OpenAPI spec
```

The `DashboardDataSource` interface defines 31 CRUD methods. Two adapters
implement it:

- **`KanidmDataSource`** — calls the Kanidm REST API via a generated TypeScript
  SDK
- **`MockDataSource`** — in-memory state persisted to `localStorage`

Switching between them is a single config field — no code changes required.

### SDK generation

The Kanidm TypeScript SDK is generated from `spec/kanidm-openapi.json` using
[openapi-nexus](https://github.com/adamcavendish/openapi-nexus):

```bash
just generate-sdk
```

The generated code lives in `src/generated/kanidm-sdk/` and is excluded from
version control.

## Configuration

The dashboard reads a single JSON file at `/dashboard.config.json`:

```json
{
  "dataSource": {
    "mode": "kanidm",
    "apiBasePath": "",
    "openApiPath": "/docs/v1/openapi.json"
  },
  "siteName": "My Org",
  "logoUrl": "https://example.com/logo.svg",
  "loginMessage": "Sign in with your organisation account",
  "adminGroup": "idm_admins",
  "theme": {
    "mode": "system",
    "preset": "blue"
  }
}
```

| Field                    | Description                                                     |
| ------------------------ | --------------------------------------------------------------- |
| `dataSource.mode`        | `"kanidm"` for real API, `"mock"` for demo data                 |
| `dataSource.apiBasePath` | Base path for the Kanidm API (empty for same-origin)            |
| `siteName`               | Site title shown in the browser tab and login page              |
| `logoUrl`                | Fallback logo when native Kanidm domain branding is unavailable |
| `loginMessage`           | Message displayed on the login page                             |
| `adminGroup`             | Kanidm group whose members get admin console access             |
| `theme.mode`             | `"light"`, `"dark"`, or `"system"`                              |
| `theme.preset`           | Colour preset name                                              |

## Development

### Prerequisites

- **Node.js** ≥ 22
- **Vite+** (`vp`) — the project uses `vp` (Vite+) as its toolchain entry point
- **just** — command runner for the `generate-sdk` recipe and other tasks
- **openapi-nexus** ≥ 0.1.13 — TypeScript SDK generator (`cargo binstall openapi-nexus`)
- **Kanidm** (optional) — for real-API development and E2E tests

### Local Kanidm setup

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

### Same-origin preview

Build the dashboard and serve it through Caddy for a production-like setup:

```bash
vp build
docker compose -f deploy/local/docker-compose.yml up -d dashboard-proxy
```

Open `https://localhost:9443`. Caddy serves dashboard assets and proxies Kanidm
routes.

### Commands

| Command                            | Description                                |
| ---------------------------------- | ------------------------------------------ |
| `vp dev`                           | Start dev server with HMR                  |
| `vp build`                         | Production build to `dist/`                |
| `vp lint`                          | Type-check and lint                        |
| `vp test`                          | Run unit tests                             |
| `vp run auth-smoke`                | Smoke-test Kanidm authentication           |
| `vp run e2e-kanidm`                | Full browser E2E suite against real Kanidm |
| `vp run e2e-webauthn-kanidm`       | WebAuthn / passkey E2E test                |
| `vp run e2e-recovery-mail-kanidm`  | Recovery email E2E test                    |
| `vp run production-artifact-audit` | Verify production build                    |
| `vp run container-smoke`           | Smoke-test the container image             |
| `just generate-sdk`                | Regenerate the Kanidm TypeScript SDK       |

## Testing

### Unit tests

```bash
vp test
```

Tests cover the data source seam, auth flows, composite creation operations, and
mapping functions.

### E2E tests

The E2E suite runs a Playwright browser against a real Kanidm instance. It
requires `KANIDM_PASSWORD` in `.env.local`.

```bash
vp run e2e-kanidm
```

The main E2E test verifies 22 behaviours:

- Admin login and expired session redirect
- Group, person, and OAuth2 application creation through the UI
- Group membership toggling and nested relationship resolution
- Domain image upload and reset
- Credential setup (password, TOTP, backup codes) via reset token
- Native OAuth2 discovery, consent, and access denial
- Non-admin portal login with backup code
- Non-admin route guards: admin pages redirect to portal
- Non-admin mutation denial: direct API calls are rejected
- Self-service: RADIUS, SSH keys, Unix credentials, session revocation
- Reauth flow and logout

Each run creates unique test fixtures and cleans them up on completion.

## Deployment

See [`docs/runbooks/production-deployment.md`](docs/runbooks/production-deployment.md) for
production deployment guidance, including Caddy configuration, container image
builds, and CI/CD integration.

See [`docs/runbooks/production-email-delivery.md`](docs/runbooks/production-email-delivery.md) for
configuring Kanidm recovery and invitation email delivery.

### Container image

```bash
vp build
docker build -f deploy/container/Dockerfile -t kanidm-dashboard .
```

The container serves the dashboard as static files with a Caddy reverse proxy
for Kanidm API routes.

## Documentation

- [Production deployment runbook](docs/runbooks/production-deployment.md)
- [Email delivery runbook](docs/runbooks/production-email-delivery.md)
- [Orb Chrysa live OAuth test plan](docs/test-plans/orb-chrysa-live-oauth.md)

## License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE) or http://www.apache.org/licenses/LICENSE-2.0)
- MIT license ([LICENSE-MIT](LICENSE-MIT) or http://opensource.org/licenses/MIT)

at your option.
