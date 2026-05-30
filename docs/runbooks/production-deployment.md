# Production Deployment Runbook

This dashboard is a static SolidJS SPA. Production should serve the built
`dist/` directory and proxy Kanidm on the same origin as the dashboard. The
local Compose stack under `deploy/local/` is the reference shape, not a
production-ready certificate or persistence setup.

## Release Artifacts

Build with Vite+:

```bash
vp check
vp test
vp build
vp run production-artifact-audit
vp exec playwright install --with-deps chromium
vp run container-smoke
```

The releasable artifact is:

- `dist/index.html`
- `dist/assets/*`
- an environment-specific `/dashboard.config.json`

The repository also includes a minimal Caddy runtime image:

- `deploy/container/Dockerfile`
- `deploy/container/Caddyfile`
- `deploy/container/docker-compose.smoke.yml`
- `deploy/container/docker-compose.image-smoke.yml`

Build `dist/` first, then smoke-test that runtime image:

```bash
vp build
vp run production-artifact-audit
vp exec playwright install --with-deps chromium
vp run container-smoke
```

After publishing the image to a registry, pull and smoke-test the exact image tag
that will be deployed:

```bash
KANIDM_DASHBOARD_IMAGE=registry.example.com/team/kanidm-dashboard:tag vp run registry-image-smoke
```

The checked-in `.github/workflows/container-image.yml` workflow provides the
GHCR release path. It runs the Vite+ gate, runs `vp run container-smoke`, pushes
`deploy/container/Dockerfile` to `ghcr.io/<owner>/<repo>:<tag>`, then pulls that
published image back through `vp run registry-image-smoke`. Trigger it from a
`v*` tag push or `workflow_dispatch` with an optional image tag.
The image build requests max-mode provenance and SBOM attestations from
`docker/build-push-action`.

The runtime image copies `dist/` into `/srv/dashboard`, copies the checked-in
Kanidm-mode fallback config into `/config/dashboard.config.json`, and serves it
as `/dashboard.config.json`. In production, mount or bake an
environment-specific `/config/dashboard.config.json` over that fallback config.
Set `KANIDM_UPSTREAM` to the production Kanidm origin, for example
`https://idm.example.com`.

`vp run container-smoke` verifies the same override path by mounting a generated
Kanidm-mode config into `/config/dashboard.config.json` and asserting the
container serves that injected config with `Cache-Control: no-store`. The smoke
stack also starts a mock Kanidm upstream and verifies `/status` plus
`/docs/v1/openapi.json` route through the runtime proxy. The smoke also verifies
dashboard-owned responses carry the runtime security headers listed below, then
opens the container-served `/login` and `/portal` routes in Chromium to catch CSP
or runtime boot failures. This proves the image's route wiring and dashboard
header policy; it is not a substitute for staging verification against a real
production Kanidm upstream and trusted TLS chain.

`vp run registry-image-smoke` accepts `KANIDM_DASHBOARD_IMAGE` or
`CONTAINER_SMOKE_IMAGE`, pulls the image, mounts the same generated runtime
config, verifies the container-served HTML and assets, and runs the same
Chromium runtime boot check. Use it after image publication so the release gate
covers the registry artifact that production will actually pull.

Do not publish or mount `scripts/fixtures/dashboard.config.mock.json` in
production. Mock mode is only for explicit demo and browser E2E runs. A normal
production build ignores accidental `dataSource.mode: "mock"` at runtime and
falls back to Kanidm mode. Build with `VITE_ALLOW_MOCK_DATA=true` only for a
deliberate non-production demo artifact.

## Required Runtime Routes

Serve these routes from the same scheme, host, and port:

- `/` and SPA deep links: static dashboard shell from `dist/`
- `/assets/*`: immutable built assets from `dist/assets`
- `/dashboard.config.json`: deploy-time dashboard config
- `/v1/*`: Kanidm API
- `/docs/*`: Kanidm OpenAPI docs used by the API spine
- `/ui/*`: native Kanidm pages for recovery and fallback flows
- `/oauth2/*`: Kanidm OAuth2 endpoints
- `/pkg/*` and `/hpkg/*`: Kanidm native UI package assets
- `/.well-known/*`: Kanidm discovery endpoints
- `/status`: Kanidm health endpoint

The local Caddy preview implements this route shape in
`deploy/local/Caddyfile`.

Recovery/reset email delivery is a Kanidm and `kanidm-mail-sender` production
responsibility, not a dashboard static-config feature. Use
`docs/production-email-delivery.md` for the production mail sender setup,
verification checklist, and local Mailpit parity workflow.

## Dashboard Config

Production `/dashboard.config.json` must keep Kanidm mode enabled:

```json
{
  "siteName": "Example Corp",
  "logoUrl": "/brand/example-logo.svg",
  "loginMessage": "Sign in with your Example identity.",
  "adminGroup": "idm_admins",
  "dataSource": {
    "mode": "kanidm",
    "apiBasePath": "",
    "openApiPath": "/docs/v1/openapi.json"
  }
}
```

`siteName`, `logoUrl`, and `loginMessage` are the unauthenticated and fallback
branding source of truth. After sign-in, Kanidm domain display name can override
the fallback company name when the server returns it. Kanidm domain image can
override the fallback logo after sign-in when the server has an image. OAuth2
application display name/image values should come from Kanidm where the current
API supports them.
Do not put secrets, bearer tokens, client secrets, or private keys in
`dashboard.config.json`.

Do not set `VITE_ALLOW_MOCK_DATA=true` for production release builds. That flag
exists only so maintainers can intentionally build a standalone demo artifact
that accepts mock mode.

Cache headers:

- `/dashboard.config.json`: `Cache-Control: no-store`
- `/assets/*`: `Cache-Control: public, max-age=31536000, immutable`
- `/index.html`: no long-lived immutable caching

Dashboard-owned responses from the checked-in runtime image include these
security headers:

- `Content-Security-Policy` with same-origin defaults, `script-src 'self'`,
  `object-src 'none'`, and `frame-ancestors 'none'`. `style-src` allows
  controlled inline styles because the SPA applies deploy-time theme tokens as
  runtime CSS variables.
- `Referrer-Policy: same-origin`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`

Apply those headers to the static dashboard shell, built assets, and
`/dashboard.config.json`. Do not force them onto proxied Kanidm native `/ui`,
`/oauth2`, `/v1`, `/docs`, or package responses unless the Kanidm deployment has
been tested with the same policy.

If `logoUrl` points at an operator-hosted asset, serve it from the same origin
or another trusted HTTPS origin with stable caching. Keep the logo small enough
for first-paint login and recovery pages.

The local Kanidm 1.10.3 OpenAPI exposes native domain image mutation at
`/v1/domain/_image`; Kanidm serves that image from `/ui/images/domain`. Use the
dashboard branding page for authenticated domain-image updates when the current
session can read the domain entry from `/v1/domain`. If `/v1/domain` is empty,
the dashboard disables native domain branding controls because Kanidm will reject
domain display/image writes for that session. Use `logoUrl` only as the static
unauthenticated/fallback asset.

## Rolling Updates

Use content-hashed assets and roll replicas after publishing the new artifact.
Because `index.html` points at release-specific asset names, every serving
replica must serve an internally consistent `index.html` plus matching assets.

If assets are served from shared object storage or a CDN, retain previous
release assets for at least the maximum browser session and CDN cache window.
If assets are served from each replica image, keep the old replica healthy until
new replicas pass readiness, then drain old replicas. `dashboard.config.json`
should remain no-store so theme/config changes can roll without forcing users
through a hard reload.

## Production Proxy Requirements

The browser calls Kanidm directly through the dashboard origin. The proxy must:

- terminate public TLS with production certificates
- validate upstream Kanidm TLS certificates
- preserve method, path, query string, and request body
- forward `Authorization` headers for bearer-token API calls
- forward WebAuthn/OAuth related routes without rewriting payloads
- avoid adding permissive cross-origin behavior that is unnecessary in the
  same-origin model
- reject accidental access to mock fixtures and source files
- add dashboard security headers to dashboard-owned responses without
  overwriting Kanidm native response policies

The local Caddy file uses `tls_insecure_skip_verify` only for the local
self-signed Kanidm certificate. Do not copy that setting to production.

## Readiness Checks

A dashboard replica is ready only after these checks pass against the public
same-origin URL:

```bash
curl --fail --silent --show-error https://dashboard.example.com/dashboard.config.json
curl --fail --silent --show-error https://dashboard.example.com/status
curl --fail --silent --show-error https://dashboard.example.com/docs/v1/openapi.json
curl --fail --silent --show-error https://dashboard.example.com/portal
```

The `/portal` check should return the SPA shell. Authenticated behavior is
covered by the real browser E2E test, not by unauthenticated readiness probes.

## CI Strategy

The concrete GitHub Actions workflows live at `.github/workflows/ci.yml` and
`.github/workflows/container-image.yml`. They use `voidzero-dev/setup-vp@v1`,
then run Vite+ commands directly.

Fast pull-request gate:

```bash
vp check
vp test
vp build
vp run production-artifact-audit
vp exec playwright install --with-deps chromium
vp run container-smoke
```

Mock browser gate for UI-only changes:

```bash
vp dev
vp run e2e-mock
```

Real Kanidm integration gate for protected branches, release candidates, and
changes touching auth, API, credentials, relationships, branding, or routing:

```bash
docker compose -f deploy/local/docker-compose.yml up -d
vp build
docker compose -f deploy/local/docker-compose.yml up -d dashboard-proxy
vp run auth-smoke
vp run credential-update-smoke
vp run e2e-recovery-kanidm
./scripts/dev-kanidm-mail.sh
vp run e2e-recovery-mail-kanidm
vp run e2e-add-user-recovery-mail-kanidm
vp run e2e-kanidm
vp run e2e-webauthn-kanidm
```

CI must provide `KANIDM_PASSWORD` for the local `idm_admin` account or run a
bootstrap step that recovers/sets it before the real Kanidm tasks. The checked-in
GitHub Actions workflow uses the bootstrap path for its local Compose Kanidm
server. Preserve Playwright screenshots and script JSON output as artifacts when
any real browser test fails.

Container image release gate:

```bash
vp check
vp test
vp build
vp run production-artifact-audit
vp exec playwright install --with-deps chromium
vp run container-smoke
KANIDM_DASHBOARD_IMAGE=ghcr.io/<owner>/<repo>:<tag> vp run registry-image-smoke
```

The GHCR workflow publishes the image with BuildKit provenance and SBOM
attestations. Keep a copy of the workflow run URL, image digest, and registry
attestation metadata with the release record.

## Release Checklist

- `vp check` passed.
- `vp test` passed.
- `vp build` passed.
- `vp run production-artifact-audit` passed.
- Playwright Chromium is installed for runtime browser smoke checks.
- `vp run container-smoke` passed for the release artifact.
- `vp run registry-image-smoke` passed against the published image tag.
- Published image has provenance and SBOM attestations from the release workflow.
- Mock config and fixture paths are absent from the published artifact.
- `/dashboard.config.json` is Kanidm mode and no-store.
- Dashboard-owned responses include CSP, referrer, content-type, and frame
  protection headers.
- Same-origin Kanidm proxy routes are present.
- Production proxy validates upstream TLS.
- Real Kanidm smoke and browser E2E passed for the release candidate.
- Rollback artifact still has matching `index.html`, `assets/*`, and config.
- Operator-facing theme/config changes have been tested with a rolling update.
