# Layerhouse Live OAuth Integration Test Plan

This dashboard uses Layerhouse as the sample OAuth2/OIDC application for the
Kanidm application portal and admin application-management flows.

## Current Status

- The dashboard real Kanidm E2E creates an Layerhouse-shaped OAuth2 application
  with:
  - landing URL: `http://localhost:5050`
  - redirect URI: `http://localhost:5050/oauth2/callback`
  - additional same-origin test callback for Playwright capture
- `vp run e2e-kanidm` verifies Kanidm-native discovery, `/ui/oauth2` consent,
  authorization-code redirect, access denial, scope maps, and cleanup.
- The dashboard has not yet proven a live Layerhouse `/oauth2/start` to
  `/oauth2/callback` browser flow with token exchange and session creation.
- **Update 2026-06-01:** The Layerhouse OAuth2 origin/landing mapping bug
  (reversed `oauth2_rs_origin` / `oauth2_rs_origin_landing`) that blocked the
  live gate has been fixed in Layerhouse commit
  `d6fcf9d fix(auth): correct Kanidm OAuth2 origin/landing mapping`. Both
  `deploy/scripts/kanidm-setup.sh` and `deploy/tilt/bootstrap-kanidm.sh` now
  use `OAUTH2_REDIRECT_URL` → `oauth2_rs_origin` (callback) and
  `OAUTH2_LANDING_URL` → `oauth2_rs_origin_landing` (bare root), matching the
  runtime `redirect_uri` in `deploy/configs/auth-cluster.toml`.
- The live integration gate is now **unblocked** and implemented.

## Evidence From Layerhouse

Repository inspected:

`/Volumes/files/repo/adamcavendish/layerhouse/layerhouse`

Layerhouse's local auth config expects the callback URL here:

`deploy/configs/auth-cluster.toml`

```toml
redirect_uri = "http://localhost:5050/oauth2/callback"
```

Layerhouse's OAuth start handler sends that `redirect_uri` to Kanidm, and the
callback handler exchanges the authorization code with the same redirect URI.
Those paths are implemented in:

`crates/layerhouse-server/src/auth/oauth2.rs`

The local Kanidm setup script currently creates the OAuth2 client with these
attributes:

`deploy/scripts/kanidm-setup.sh`

```json
{
  "attrs": {
    "name": ["layerhouse"],
    "displayname": ["Layerhouse Container Registry"],
    "oauth2_rs_origin": ["http://localhost:5050"],
    "oauth2_rs_origin_landing": ["http://localhost:5050/oauth2/callback"]
  }
}
```

The Tilt bootstrap script has the same shape:

`deploy/tilt/bootstrap-kanidm.sh`

```json
{
  "attrs": {
    "oauth2_rs_origin": ["https://$REGISTRY_ENDPOINT"],
    "oauth2_rs_origin_landing": ["https://$REGISTRY_ENDPOINT/oauth2/callback"]
  }
}
```

Kanidm stable OAuth2 documentation describes `create` as taking the application
landing page first, and `add-redirect-url` as adding the callback URL. The
corresponding stored attributes are:

- `oauth2_rs_origin_landing`: application landing page
- `oauth2_rs_origin`: redirect URL entries

The dashboard follows that mapping in `src/kanidm-api.ts`:

- `input.landingUrl` -> `oauth2_rs_origin_landing`
- `input.redirectUris` -> `oauth2_rs_origin`

## Prompt To Send To Layerhouse

Please fix Layerhouse's Kanidm OAuth2 setup so the Kanidm client registration
matches Kanidm's landing URL and redirect URL semantics.

Problem:

- `deploy/scripts/kanidm-setup.sh` appears to set
  `oauth2_rs_origin=["http://localhost:5050"]` and
  `oauth2_rs_origin_landing=["http://localhost:5050/oauth2/callback"]`.
- `deploy/tilt/bootstrap-kanidm.sh` appears to do the same with
  `https://$REGISTRY_ENDPOINT` and `https://$REGISTRY_ENDPOINT/oauth2/callback`.
- Layerhouse's own runtime config uses
  `redirect_uri = "http://localhost:5050/oauth2/callback"`, and the OAuth2
  start/token-exchange code sends that callback URL to Kanidm.
- Kanidm expects the portal landing page in `oauth2_rs_origin_landing`, and the
  OAuth2 callback URL in `oauth2_rs_origin` / redirect URL configuration.

Expected local setup:

```json
{
  "attrs": {
    "name": ["layerhouse"],
    "displayname": ["Layerhouse Container Registry"],
    "oauth2_rs_origin": ["http://localhost:5050/oauth2/callback"],
    "oauth2_rs_origin_landing": ["http://localhost:5050"]
  }
}
```

Expected Tilt setup:

```json
{
  "attrs": {
    "oauth2_rs_origin": ["https://$REGISTRY_ENDPOINT/oauth2/callback"],
    "oauth2_rs_origin_landing": ["https://$REGISTRY_ENDPOINT"]
  }
}
```

Please also update the Layerhouse Kanidm auth documentation where it currently
describes `--origin` and `--landing` in the reversed order.

Acceptance criteria:

- `deploy/scripts/kanidm-setup.sh` registers the callback URL as the Kanidm
  redirect URL and the registry root as the Kanidm portal landing URL.
- `deploy/tilt/bootstrap-kanidm.sh` uses the same corrected mapping.
- Layerhouse docs show:
  - landing URL: `http://localhost:5050` or production registry root
  - redirect URI: `http://localhost:5050/oauth2/callback` or production callback
- `just compose-auth-up` creates a Kanidm client whose stored attributes match
  the corrected mapping.
- `just auth-smoke` passes.
- Manual browser check passes:
  1. open `http://localhost:5050/oauth2/start`
  2. authenticate through Kanidm
  3. approve consent
  4. return to `http://localhost:5050/oauth2/callback`
  5. Layerhouse exchanges the authorization code successfully
  6. `GET http://localhost:5050/api/v1/session` reports an authenticated
     `admin` or `developer` session with expected groups/scopes.

## Dashboard Gate After Layerhouse Fix

The dashboard-side live integration gate is implemented as:

```bash
vp run e2e-layerhouse-live-oauth
```

### Setup (one-time per test run)

1. Start Layerhouse's auth-enabled cluster from the Layerhouse repo:

   ```bash
   # In the Layerhouse repo:
   just compose-auth-up
   ```

   This brings up Kanidm on `https://localhost:8443` and Layerhouse on `http://localhost:5050`.
   The `kanidm-setup.sh` service creates the `layerhouse` OAuth2 client, the
   `registry_admins` and `registry_developers` groups, and the `admin`/`developer`
   user fixtures.

2. Start the dashboard dev server proxying to Layerhouse's Kanidm:

   ```bash
   # In the dashboard repo:
   KANIDM_TARGET=https://localhost:8443 vp dev
   ```

3. Recover the `idm_admin` password from the Layerhouse Kanidm container:

   ```bash
   docker compose -f docker-compose.auth-cluster.yml exec kanidm \
     kanidmd recover-account idm_admin -c /data/server.toml
   ```

   Use the returned `new_password` value for `KANIDM_PASSWORD`. Do not use
   `/shared/admin-pw` here; that file belongs to Layerhouse's fixture `admin`
   user, not the privileged `idm_admin` account used by this dashboard gate.

4. Run the gate:

   ```bash
   KANIDM_DASHBOARD_URL=http://localhost:5173 KANIDM_PASSWORD="<admin-password>" vp run e2e-layerhouse-live-oauth
   ```

### What the task verifies

The script (`scripts/e2e-layerhouse-live-oauth.mjs`) drives Playwright through:

- Dashboard admin login
- Layerhouse application exists in the app catalog with `ready` status
- Portal app card has the correct launch URL pointing to Layerhouse
- Disposable test user is created and added to `registry_developers`
- Layerhouse `/oauth2/start` redirects to Kanidm's native `/ui/oauth2`
- Kanidm consent succeeds for a test user
- Layerhouse `/oauth2/callback` receives the authorization code and state before
  redirecting back to the registry root
- Layerhouse `/api/v1/session` returns an authenticated session with identity fields
- Kanidm access-denied page renders when `idm_admin` (lacking app access) attempts the flow

### Environment variables

| Variable               | Default                 | Description                   |
| ---------------------- | ----------------------- | ----------------------------- |
| `KANIDM_DASHBOARD_URL` | `http://localhost:5173` | Dashboard base URL            |
| `LAYERHOUSE_URL`       | `http://localhost:5050` | Layerhouse base URL           |
| `LAYERHOUSE_CLIENT_ID` | `layerhouse`            | Layerhouse OAuth2 client name |
| `KANIDM_USERNAME`      | `idm_admin`             | Kanidm admin username         |
| `KANIDM_PASSWORD`      | (required)              | Kanidm admin password         |
| `E2E_SCREENSHOT_DIR`   | `/tmp`                  | Screenshot output directory   |

### Expected output

```json
{
  "ok": true,
  "orbAppVerified": true,
  "orbSessionVerified": true,
  "orbSessionIdentity": { "username": "orbuser_123456", ... },
  "orbAccessDeniedVerified": true,
  "screenshot": "/tmp/kanidm-dashboard-layerhouse-live-oauth.png"
}
```

Until this gate passes reliably in CI, the dashboard's Layerhouse integration is
partially verified: Kanidm client creation and consent are covered, but the live
sample-app token exchange is proven only in local runs.
