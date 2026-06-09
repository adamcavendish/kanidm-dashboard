# Kanidm Dashboard Vite+ Test Plan

This project uses Vite+ as the project entry point. Do not run `npm`, `pnpm`,
raw `node`, `vitest`, or `tsc` directly for normal project checks.

## Vite+ Command Map

- Install dependencies: `vp install`
- Start local dev server: `vp dev`
- Format, lint, and type check: `vp check`
- Auto-fix format and lint: `vp check --fix`
- Unit tests: `vp test`
- Production build: `vp build`
- List project tasks: `vp run`
- Audit the built production artifact after `vp build`:
  `vp run production-artifact-audit`
- Build and smoke-test the production Caddy runtime image after `vp build`:
  `vp run container-smoke`
- Install Chromium before runtime browser smoke checks if the host has not
  already installed it: `vp exec playwright install --with-deps chromium`
- Pull and smoke-test a published runtime image:
  `KANIDM_DASHBOARD_IMAGE=registry.example.com/team/kanidm-dashboard:tag vp run registry-image-smoke`
- Visual smoke across desktop/mobile and light/dark against `vp dev`:
  `vp run visual-smoke`
- Mock browser E2E against `vp dev`, with Playwright intercepting
  `/dashboard.config.json` from `scripts/fixtures/dashboard.config.mock.json`:
  `vp run e2e-mock`
- Real Kanidm auth smoke: `vp run auth-smoke`
- Real Kanidm credential update smoke: `vp run credential-update-smoke`
- Real Kanidm browser E2E: `vp run e2e-kanidm`
- Real Kanidm WebAuthn browser E2E: `vp run e2e-webauthn-kanidm`
- Real Kanidm recovery handoff E2E: `vp run e2e-recovery-kanidm`
- Real Kanidm recovery email E2E: `vp run e2e-recovery-mail-kanidm`
- Real Kanidm add-user recovery email browser E2E:
  `vp run e2e-add-user-recovery-mail-kanidm`
- Layerhouse live OAuth sample-app follow-up:
  `docs/test-plans/layerhouse-live-oauth.md`
- Bootstrap local Kanidm mail capture: `vp run kanidm-mail-bootstrap` or
  `./scripts/dev-kanidm-mail.sh` for the full Docker Compose mail profile
- Run project scripts directly through managed Node: `vp node scripts/<script>.mjs`
- Run project-local binaries through Vite+: `vp exec <binary> ...`
- Run Node-backed project tasks from Vite Task: `vp exec node scripts/<script>.mjs`
- Run one-off managed Node probes: `vp env exec node -e "<script>"`

Run these commands from the package root:
`/Volumes/files/repo/adamcavendish/kanidm-dashboard/kanidm-dashboard`.

Vite Task runs custom tasks in a clean environment. Custom Kanidm and proxy
variables are passed through by `vite.config.ts` using `untrackedEnv`. The
task cache is disabled in `run.cache.tasks` so browser/API tasks never replay
stale results. Put long-lived local values in `.env.local`, or export them in
the shell before running `vp run <task>`.

## Local Real Kanidm Setup

1. Start the local Kanidm/Caddy stack:

   ```bash
   docker compose -f deploy/local/docker-compose.yml up -d
   ```

2. Build the dashboard for the Caddy preview when testing the production path:

   ```bash
   vp build
   docker compose -f deploy/local/docker-compose.yml up -d dashboard-proxy
   ```

3. Recover or set the local `idm_admin` password:

   ```bash
   docker compose -f deploy/local/docker-compose.yml exec kanidm kanidmd recover-account idm_admin -c /data/server.toml
   ```

4. Copy `.env.local.example` to `.env.local`, fill `KANIDM_PASSWORD`, then run:

   ```bash
   vp run auth-smoke
   vp run credential-update-smoke
   vp run e2e-recovery-kanidm
   ./scripts/dev-kanidm-mail.sh
   vp run e2e-recovery-mail-kanidm
   vp run e2e-add-user-recovery-mail-kanidm
   vp run e2e-kanidm
   vp run e2e-webauthn-kanidm
   ```

The main E2E task signs in through the dashboard, confirms the portal-first flow,
enters the admin console, creates a parent access group, a child member group, a
person, and an Layerhouse-style OAuth2 application. It verifies nested
group-to-application effective access, per-access-group scope-map reload, OAuth2 app
image upload/reset, confidential client-secret display, native Kanidm OAuth2
discovery, native `/ui/oauth2` consent, native OAuth access denial, initial user credential
setup URL creation through Kanidm's credential update intent endpoint,
password/TOTP/backup-code generation from that setup URL, group member
remove/add, non-admin portal visibility through nested access, second-session
revoke, Unix self-service allowed-or-denied behavior, non-admin direct admin-route
guarding, non-admin person-create denial, logout, and private-route redirect.
After the assertions pass, the task deletes the disposable OAuth2 app, person,
child group, and parent group through Kanidm's real delete endpoints. The run
output must include `fixtureCleanupVerified: true`,
`nestedGroupAccessVerified: true`, `groupMembershipToggleVerified: true`,
`sessionRevokeVerified: true`, `unixSelfServiceVerified: true`,
`backupCodeLoginVerified: true`, `initialCredentialIntentVerified: true`,
`appImageUploadVerified: true`, `appImageResetVerified: true`,
`nonAdminAdminRouteGuardVerified: true`,
`nonAdminMutationDeniedVerified: true`,
`nativeOAuthDiscoveryVerified: true`, `nativeOAuthConsentVerified: true`,
`nativeOAuthAccessDeniedVerified: true`, and HTTP success
statuses for `/v1/oauth2/{rs_name}`, `/v1/person/{id}`, `/v1/group/{child}`,
and `/v1/group/{parent}`.

The WebAuthn E2E task creates a disposable person through the dashboard, issues a
credential update token, registers a passkey with a Playwright virtual
authenticator, commits the reset flow, and signs back in with the registered
passkey. It then deletes the disposable person through Kanidm's real delete
endpoint. The run output must include `resetRegistrationVerified: true`,
`passkeyLoginVerified: true`, `fixtureCleanupVerified: true`, and a
`cleanupResults` entry for `/v1/person/{id}`.

The recovery-mail E2E task creates a disposable person through Kanidm's API,
requests an admin-issued credential reset email, waits for `kanidm-mail-sender`
to deliver it to Mailpit, and verifies that the captured message includes a
`/ui/reset?token=...` link.

The add-user recovery-mail E2E task signs into the dashboard, opens the real
admin Add User wizard, selects the `Send recovery email` credential path, creates
the person through the UI, verifies the UI shows Kanidm accepted the recovery
email request without exposing a direct setup URL, waits for `kanidm-mail-sender`
to deliver the message to Mailpit, verifies the captured reset link, and deletes
the disposable person through Kanidm's real delete endpoint.

Production recovery/reset email setup and verification steps are documented in
`docs/production-email-delivery.md`. Treat the local Mailpit workflow as parity
coverage only; production readiness requires a real `kanidm-mail-sender`
instance, trusted SMTP relay, routable test mailbox, and reset-link verification
against the production `instance_url`.

## Baseline Validation

Run these before considering a change ready:

```bash
vp check
vp test
vp build
vp run production-artifact-audit
vp exec playwright install --with-deps chromium
vp run container-smoke
```

For changes touching real Kanidm API behavior, also run:

```bash
vp run auth-smoke
vp run credential-update-smoke
vp run e2e-recovery-kanidm
vp run e2e-recovery-mail-kanidm
vp run e2e-add-user-recovery-mail-kanidm
vp run e2e-kanidm
vp run e2e-webauthn-kanidm
```

## Production Release Validation

Use `docs/production-deployment.md` as the release runbook. A production
candidate must pass the fast Vite+ gate:

```bash
vp check
vp test
vp build
vp run production-artifact-audit
vp exec playwright install --with-deps chromium
vp run container-smoke
KANIDM_DASHBOARD_IMAGE=registry.example.com/team/kanidm-dashboard:tag vp run registry-image-smoke
```

It must also prove the same-origin Kanidm route shape before release. The local
reference path is:

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

For CI, keep `vp check`, `vp test`, and `vp build` on the fast pull-request
gate. Run the real Kanidm integration gate for protected branches, release
candidates, and changes touching auth, API adapters, credentials, relationships,
branding, same-origin routing, or deployment config. Preserve Playwright
screenshots and real script JSON output as CI artifacts on failure.

The checked-in GitHub Actions workflow at `.github/workflows/ci.yml` implements
that split:

- Pull requests run `vp install --frozen-lockfile`, `vp check`, `vp test`,
  `vp build`, `vp run production-artifact-audit`, Playwright Chromium install,
  and `vp run container-smoke`.
- Pushes to `main` run the same fast gate and then the local real Kanidm
  integration gate.
- Manual `workflow_dispatch` runs can enable or skip the real Kanidm integration
  gate with the `run_real_kanidm` input.

The checked-in `.github/workflows/container-image.yml` workflow implements the
registry-artifact gate. It runs the Vite+ build/audit/container-smoke sequence,
publishes `deploy/container/Dockerfile` to GHCR on `v*` tag pushes or manual
dispatch, and then runs `vp run registry-image-smoke` against the pushed image
tag. The manual workflow accepts an optional `image_tag`; if omitted, it uses
`sha-<commit>`. The image build requests max-mode provenance and SBOM
attestations; record the workflow run URL, image digest, and attestation
metadata for production releases.

Production config checks:

- `/dashboard.config.json` is Kanidm mode.
- `/dashboard.config.json` defines the unauthenticated fallback `siteName`,
  `logoUrl`, and `loginMessage`.
- A production build without `VITE_ALLOW_MOCK_DATA=true` ignores accidental
  `dataSource.mode: "mock"` and falls back to Kanidm mode.
- `VITE_ALLOW_MOCK_DATA=true` is reserved for deliberate demo artifacts, not
  production release builds.
- `/dashboard.config.json` is served with `Cache-Control: no-store`.
- `/assets/*` is served with immutable caching.
- `/v1`, `/docs`, `/ui`, `/oauth2`, `/pkg`, `/hpkg`, `/.well-known`, and
  `/status` are proxied to Kanidm on the same origin.
- Mock fixtures from `scripts/fixtures/` are not published.
- `vp run production-artifact-audit` passes after `vp build`.
- `vp run container-smoke` builds `deploy/container/Dockerfile`, starts the
  runtime with Docker Compose, and verifies:
  - a generated runtime config is mounted into `/config/dashboard.config.json`
  - `/dashboard.config.json` returns that injected Kanidm-mode config and
    `Cache-Control: no-store`
  - a built `/assets/*` file returns immutable cache headers
  - dashboard-owned responses return CSP, referrer, content-type, and frame
    protection headers
  - Chromium can boot the container-served `/login` and `/portal` routes under
    those headers without CSP or page errors
  - `/portal` returns the SPA shell
  - `/status` is proxied to a mock Kanidm upstream
  - `/docs/v1/openapi.json` is proxied to a mock Kanidm upstream
- `vp run registry-image-smoke` requires `KANIDM_DASHBOARD_IMAGE` or
  `CONTAINER_SMOKE_IMAGE`. It pulls that image, starts it with the same generated
  runtime config and mock Kanidm upstream, parses the asset path from the
  container-served `/` HTML, then verifies config no-store caching, immutable
  built assets, dashboard security headers, browser runtime boot, SPA fallback,
  `/status`, and `/docs/v1/openapi.json`. This is the gate that proves the
  published registry artifact, not only the local Docker build.
- Production proxy validates upstream Kanidm TLS instead of using local
  `tls_insecure_skip_verify`.

For mock-mode browser coverage, start the dev server and run. The script
intercepts `/dashboard.config.json` with
`scripts/fixtures/dashboard.config.mock.json`, so the checked-in default config
can remain Kanidm-backed and the mock config is not copied into `dist/`:

```bash
vp dev
vp run visual-smoke
vp run e2e-mock
```

The visual smoke task captures public Kanidm-mode login/recovery/reset/logout
screens plus authenticated mock portal, profile, credentials, admin, people,
add-user, groups, add-group, applications, add-application, relationships, and
branding screens. It runs each route in light and dark themes at desktop and
mobile viewport sizes, injects a long company/login-message branding fixture,
fails on page errors, fails if the document root overflows horizontally, and
performs basic accessibility assertions for duplicate ids, missing image alt
text, unlabeled visible form fields, and unlabeled visible interactive controls.
Screenshots are written to `$E2E_SCREENSHOT_DIR` or
`/tmp/kanidm-dashboard-visual-smoke`.

The same visual smoke task also runs targeted mobile stress fixtures:

- Empty portal state with no linked applications.
- Large app catalog with long application names and long landing URLs.
- Many groups and people.
- Nested group-to-application access relationships.
- Dense relationship explorer rendering.
- Populated Layerhouse add-application scope-map editor with separate
  `registry_admins` and `registry_developers` scopes.

## Browser QA Coverage

Use the running Vite+ dev server (`vp dev`) for interactive checks.

- Login from `/login`, confirm the default landing page is `/portal`.
- Real Kanidm startup:
  - Before config/session load, the app must not render seeded demo people,
    demo groups, or demo applications.
  - Real-mode unauthenticated state uses a single `Not signed in` placeholder
    and an empty app/group list.
  - Login, recovery, reset, and logout surfaces use `siteName`, `logoUrl`, and
    `loginMessage` from static config before authenticated Kanidm data is
    available.
  - After sign-in, Kanidm domain display name can override the static fallback
    company name.
  - After sign-in, Kanidm domain image can override the static fallback logo
    when `/v1/domain` reports image metadata.
  - Dashboard domain image upload/reset uses Kanidm `/v1/domain/_image`; the
    served image route is `/ui/images/domain`.
  - If `/v1/domain` is empty for the current session, the dashboard must disable
    native domain display/image controls and show the domain-branding permission
    guard instead of attempting writes that Kanidm will reject with
    `nomatchingentries`.
  - Static `logoUrl` and `loginMessage` remain the unauthenticated/fallback
    source and are changed by updating `/dashboard.config.json`.
  - The login form must not prefill demo credentials in Kanidm mode.
  - Explicit mock mode may still prefill the Ava demo account after
    `scripts/fixtures/dashboard.config.mock.json` is loaded.
- Login mechanisms:
  - Password login uses Kanidm `/v1/auth` with `password`.
  - TOTP login uses Kanidm `/v1/auth` with `passwordmfa`, then submits `totp`
    and `password` credential steps.
  - Backup-code login uses Kanidm `/v1/auth` with `passwordbackupcode`, then
    submits `backupcode` and `password` credential steps.
  - Passkey login uses Kanidm stepped `/v1/auth` with `passkey`, then submits the
    browser WebAuthn assertion as `{ "passkey": assertion }`.
  - Security-key login uses Kanidm stepped `/v1/auth` with
    `passwordsecuritykey`, submits the browser WebAuthn assertion as
    `{ "securitykey": assertion }`, then submits the password credential.
- OAuth public surfaces:
  - `/oauth/resume` shows the client, redirect URI, and requested scopes from
    query parameters, then links into `/oauth/consent`.
  - `/oauth/consent` shows the selected OAuth2 application, requested scopes,
    redirect URI, and state.
  - Consent denial routes to `/oauth/access-denied` and preserves redirect/state
    context.
  - Access-denied return links include `error=access_denied` and preserve
    `state`.
  - Consent allow links preserve `code` and `state` when a redirect URI is
    provided; otherwise they fall back to the application landing URL.
  - `vp run e2e-kanidm` verifies the production proxy path for Kanidm-native
    OAuth by reading `/oauth2/openid/{app}/.well-known/openid-configuration`,
    authenticating the disposable non-admin user through native `/ui/oauth2`,
    approving consent, and asserting that the authorization-code callback
    preserves `code` and `state`. The same test signs in as `idm_admin`, which
    lacks the disposable app access group, and verifies Kanidm's native
    `Access Denied` page at `/ui/oauth2/resume`.
  - The real E2E keeps the Layerhouse callback
    `http://localhost:5050/oauth2/callback` on the created app, and adds a
    same-origin `/oauth-test-callback` redirect URI only so Playwright can
    capture the authorization-code redirect without running a separate Orb
    Chrysa server.
  - Live Layerhouse `/oauth2/start` to `/oauth2/callback` token exchange passed
    after the Layerhouse setup mapping fix. The setup and follow-up gate are
    tracked in
    `docs/test-plans/layerhouse-live-oauth.md`.
- Account recovery:
  - Mock mode shows a privacy-preserving success response after submitting a
    username or email.
  - Real Kanidm mode links to same-origin `/ui/recover`, because Kanidm v1.10.3
    recovery is a CSRF-protected native page and there is no stable JSON recovery
    submission API to call from the SPA.
  - `vp run e2e-recovery-kanidm` verifies the dashboard handoff to `/ui/recover`
    and confirms the native page reaches either Kanidm's enabled recovery form or
    the native disabled state.
  - `./scripts/dev-kanidm-mail.sh` starts a TLS-capable Mailpit capture service
    and one non-root `kanidm-mail-sender` instance from `kanidm/tools`.
  - `vp run e2e-recovery-mail-kanidm` verifies the full local queue-to-email path
    by sending an admin-issued credential reset email and checking Mailpit for a
    reset link.
- Normal user mode: confirm there is no sidebar/admin rail.
- Normal user application portal: use Kanidm `/v1/self/_applinks` as the portal
  source of truth, because least-privileged users may not receive enough
  application or group detail from admin-oriented `/v1/oauth2` and `/v1/group`
  reads alone.
  Only request native OAuth2 app image routes when Kanidm reports image metadata
  or an applink has `has_image`, otherwise the browser logs noisy 404s for apps
  without images.
- Admin mode: confirm portal first, then admin entry is available.
- Admin create flows:
  - Person creation sends conservative create attrs, then sets `legalname` as a
    follow-up write when supplied.
  - Real Kanidm person creation supports the credential update intent link path:
    after the person and memberships are created, the dashboard calls
    `/v1/person/{id}/_credential/_update_intent/{ttl}`, renders the resulting
    setup URL, and the real E2E uses that URL to set password/TOTP/backup-code
    credentials for the disposable user.
  - Real Kanidm person creation supports the recovery email request path by
    calling `/v1/person/{id}/_credential/_update_intent_send` with `{ ttl,
email }`; unit coverage verifies the endpoint, bearer auth, and request
    body. Production email delivery still depends on `kanidm-mail-sender` and a
    real SMTP relay.
  - `vp run e2e-add-user-recovery-mail-kanidm` verifies that same recovery email
    path through the dashboard Add User wizard against local
    `kanidm-mail-sender` and Mailpit.
  - Dashboard-created temporary passwords are hidden in real Kanidm mode and
    rejected by the real adapter because Kanidm does not support that dashboard
    shortcut. Temporary password staging remains mock/demo-only.
  - Group creation sends conservative create attrs, then sets `description` as a
    follow-up write when supplied.
  - Local Kanidm 1.10.3 returns `403` when the current `idm_admin` fixture tries
    to create or update group `displayname`, so group display-name persistence
    remains open for a more privileged fixture or a different supported endpoint.
  - Group creation also attempts optional `displayname` and `managedby`
    follow-up writes. Kanidm denials for those optional attrs are shown as a
    post-create warning instead of aborting the group after the base object was
    created. The current local fixture returns `403` for `displayname` and `400`
    for `managedby`; `vp run e2e-kanidm` verifies the warning path and still
    continues through nested group access.
  - Application creation supports per-access-group OAuth2 scope maps. This is
    required for the Layerhouse shape where `registry_admins` receives
    `openid profile email oci_admin` and `registry_developers` receives
    `openid profile email oci_push oci_pull`; the dashboard must not force both
    groups to receive the same union of scopes.
  - Unit coverage verifies separate Kanidm scopemap writes for the Layerhouse
    admin and developer groups.
- Profile page:
  - Mock mode display name, legal name, and email save through reviewed profile
    updates.
  - Non-admin real Kanidm profile attributes are read-only in this dashboard;
    local Kanidm 1.10.3 returned `403` for non-admin writes to `displayname`,
    `legalname`, and `mail`.
  - Admin-authorized real Kanidm profile writes use `displayname`, `legalname`,
    and `mail` attributes.
- Credentials page:
  - Password reset/update is handled through the credential update token flow on
    `/reset`.
  - Session/token safety lists Kanidm user auth tokens from
    `/v1/account/{id}/_user_auth_token`.
  - Individual sessions can be revoked through
    `/v1/account/{id}/_user_auth_token/{token_id}`.
  - `vp run e2e-kanidm` verifies session revoke by creating a second
    normal-user session, revoking that second session from the first session's
    credentials page, and confirming the revoked page returns to `/login`.
  - Backup-code generation/removal is handled through the credential update token
    flow on `/reset`.
  - TOTP setup/removal is handled through the credential update token flow on
    `/reset`.
  - Passkey setup/removal is handled through the credential update token flow on
    `/reset`; real browser registration uses Kanidm's WebAuthn challenge and
    mock E2E uses a deterministic fake credential.
  - Attested-passkey setup/removal uses the same reset-token flow, but full
    production verification still needs compatible hardware authenticator
    coverage.
  - Reauth clears the current bearer token, returns to `/login`, and after a
    successful sign-in returns to the protected route that requested reauth.
  - Unix credential opens `/unix-credential`.
  - Unix account settings save GID number and login shell in mock mode.
  - Unix credential can be set and deleted in mock mode.
  - Real Kanidm Unix account/credential changes may be policy denied for the
    current account. The dashboard must either show the updated Unix account and
    allow credential staging, or show a policy-denied message and disable
    repeated failing writes.
  - `vp run e2e-kanidm` verifies real Unix self-service allowed-or-denied
    behavior. On the local Kanidm 1.10.3 fixture, the disposable non-admin user
    receives a policy denial for `/v1/person/{id}/_unix`.
  - RADIUS opens `/radius`.
  - RADIUS delete shows `Not generated`.
  - RADIUS generate creates a fresh `rad-demo-*` value in mock mode.
  - Real Kanidm RADIUS generation/deletion may be policy denied for the current
    account. The dashboard must either show the generated credential or show a
    policy-denied message and leave the current credential unchanged instead of
    repeatedly offering a failing write.
  - The page must not show the obsolete hard-coded `rad-2a7c-9e4f-1bd0` value.
  - SSH public keys opens `/ssh-keys`.
  - SSH public key add creates a tagged key row.
  - SSH public key delete removes the tagged key row.
  - Real Kanidm SSH public-key self-service may be policy denied for the current
    account. The dashboard must show a policy-denied message, keep the user on
    `/ssh-keys`, and disable repeated failing writes.
- Credential update intents:
  - Admin People page has a reviewed `Issue reset` action.
  - The reviewed action shows who receives the token and warns about token risk.
  - `Issue token` creates a short-lived token and reset URL in mock mode.
  - `/reset?token=...` prefills the reset-token input.
  - `/reset` verifies the token, exchanges it for a credential update session with
    Kanidm's JSON-string `/v1/credential/_exchange_intent` request, and shows
    account credential states from the returned status.
  - `/reset` can stage a new primary password through Kanidm
    `/v1/credential/_update` using the v1.10.3 two-item `[CURequest, CUSessionToken]`
    payload.
  - `/reset` can stage backup-code generation/removal through Kanidm
    `/v1/credential/_update` with `backupcodegenerate` and `backupcoderemove`
    requests.
  - `/credentials` can start a current-user credential update session and stage
    backup-code generation when Kanidm policy allows it.
  - If Kanidm denies current-user credential self-service, `/credentials` stays
    in the portal surface and shows the policy denial. Live e2e records this as
    `credentialSelfServicePolicyDenied` rather than
    `credentialSelfServiceVerified`.
  - `/reset` can start TOTP setup, display the Kanidm-generated secret and
    `otpauth://` URI, verify a numeric code with a device label, handle retry
    and duplicate-name states, accept SHA1 only after Kanidm requests it, remove
    a registered TOTP by label, and cancel an in-progress MFA registration.
  - TOTP requests use Kanidm v1.10.3 `/v1/credential/_update` payloads:
    `totpgenerate`, `{ "totpverify": [code, label] }`, `totpacceptsha1`,
    `{ "totpremove": label }`, and `cancelmfareg`.
  - `/reset` can stage Unix credential set/removal through Kanidm
    `/v1/credential/_update` with `{ "unixpassword": password }` and
    `unixpasswordremove` requests.
  - `/reset` can stage passkey and attested-passkey setup/removal through Kanidm
    `/v1/credential/_update` with `passkeyinit`,
    `{ "passkeyfinish": [label, registration] }`, `attestedpasskeyinit`,
    `{ "attestedpasskeyfinish": [label, registration] }`,
    `{ "passkeyremove": uuid }`, and `{ "attestedpasskeyremove": uuid }`.
  - `/reset` can stage SSH public-key addition/removal through Kanidm
    `/v1/credential/_update` with
    `{ "sshpublickey": [label, rawOpenSshPublicKey] }` and
    `{ "sshpublickeyremove": label }`. The raw OpenSSH string form was verified
    against local Kanidm 1.10.3; object payloads fail deserialization.
  - `/reset` can cancel a verified credential update session.
  - Self-service `/enrol` can generate an intent URL for the current user in mock mode.
  - Self-service `/credentials` starts the current-user credential update path for passkey
    and backup-code management. Mock e2e stages passkey and backup-code updates through the
    credential update state machine; live e2e accepts either a started session or Kanidm's
    current-user self-service denial message.
- Theme toggle must work in both dark and light modes.
- API error states need desktop and mobile spot checks before production.

## Current Verified Baseline

- `vp check`: pass
- `vp test`: pass
- `vp build`: pass
- `vp run production-artifact-audit`: pass
- `vp run container-smoke`: pass
- `vp run visual-smoke`: pass against `http://localhost:5173`
- `vp run e2e-mock`: pass
- `vp run auth-smoke`: pass against local Kanidm `https://localhost:18443`
- `vp run credential-update-smoke`: pass against local Kanidm
  `https://localhost:18443`
- `vp run e2e-recovery-kanidm`: pass against same-origin Caddy preview
  `https://localhost:9443`
- `vp run e2e-recovery-mail-kanidm`: pass against local
  `kanidm-mail-sender` plus Mailpit at `http://localhost:18025`
- `vp run e2e-add-user-recovery-mail-kanidm`: pass against same-origin Caddy
  preview plus local `kanidm-mail-sender` and Mailpit at `http://localhost:18025`
- `vp run e2e-kanidm`: pass against same-origin Caddy preview
  `https://localhost:9443`
- Unit Kanidm OAuth2 confidential app creation retrieves
  `/v1/oauth2/{name}/_basic_secret`: pass
- Browser OAuth resume/consent/access-denied mock route flow: pass
- Browser real Kanidm native OAuth discovery, consent callback, and access
  denial through `/ui/oauth2`: pass
- Checked-in `/dashboard.config.json` defaults to Kanidm mode, and `vp build`
  does not copy the explicit mock config fixture into `dist/`: pass
- Real-mode unauthenticated startup state does not seed demo people/apps, and
  mock local-storage persistence is gated behind loaded mock config: pass
- Browser mock account recovery neutral-success flow: pass
- Browser real Kanidm recovery handoff to native `/ui/recover`: pass
- Browser real Kanidm recovery email delivery through `kanidm-mail-sender` and
  Mailpit with reset-link verification: pass
- Browser real Kanidm Add User recovery email path through the dashboard wizard,
  `kanidm-mail-sender`, Mailpit reset-link verification, and disposable person
  cleanup: pass
- Production email delivery runbook for `kanidm-mail-sender`, SMTP relay setup,
  token handling, and production reset-link verification: documented
- Browser real Kanidm portal-first admin login, group/user/OAuth2 app creation,
  person legal-name follow-up write, initial credential setup URL creation from
  the add-user wizard, group description follow-up write, nested parent/child
  group access, OAuth2 per-group scope-map reload, client-secret display, app image
  upload/reset, native domain-branding permission guard, backup-code
  generation/login, non-admin app portal visibility through `/v1/self/_applinks`,
  non-admin profile read-only enforcement, RADIUS self-service allowed-or-denied
  handling, SSH public-key self-service handling, Unix self-service
  allowed-or-denied handling, reauth return-to-credentials handling,
  second-session revoke, group member remove/add, logout, private-route
  redirect, and fixture cleanup for the disposable OAuth2 app/person/child
  group/parent group: pass
- Local Kanidm 1.10.3 OpenAPI exposes `/v1/domain/_image` and
  `/ui/images/domain`, but the local `idm_admin` fixture cannot read
  `/v1/domain`; `vp run e2e-kanidm` verifies the dashboard disables native
  domain display/image controls for that session instead of attempting writes:
  pass
- Browser real Kanidm app creation keeps the post-create credential screen
  mounted across the Kanidm state reload after writes: pass
- Browser real Kanidm expired bearer token redirect clears sessionStorage, returns
  to login, and avoids rendering the admin rail: pass
- Browser real Kanidm non-admin direct `/admin/people` navigation renders
  portal-only UI without the admin rail or People admin page: pass
- Browser real Kanidm non-admin bearer token cannot create a person at
  `/v1/person`: pass
- Container runtime smoke verifies dashboard-owned CSP, referrer, content-type,
  and frame-protection headers: pass
- Container runtime smoke opens `/login` and `/portal` in Chromium under the
  production Caddy headers and fails on CSP/page errors: pass
- Browser real Kanidm WebAuthn reset-token passkey registration with Playwright
  virtual authenticator: pass
- Browser real Kanidm WebAuthn passkey login with Playwright virtual
  authenticator: pass
- Browser real Kanidm WebAuthn disposable person cleanup: pass
- Browser Unix account/credential mock save/set/delete flow: pass
- Browser session/token mock list/revoke flow: pass
- Browser reauth mock return-to-credentials flow: pass
- Visual smoke basic accessibility assertions for visible form fields,
  interactive controls, images, and duplicate ids: pass
- Browser mock TOTP and backup-code login field flow: pass
- Browser mock passkey login flow: pass
- Browser RADIUS mock flow: pass after generated value fix
- Browser SSH public key mock add/delete flow: pass
- Browser credential update intent mock issue/enrol/reset-status/password-stage/cancel flow:
  pass
- Browser TOTP mock setup/retry/verify/remove flow: pass
- Browser Unix credential reset-token mock set/remove flow: pass
- Browser passkey reset-token mock add/remove flow: pass
- Browser SSH public-key reset-token mock add/remove flow: pass
- Unit Kanidm credential update intent exchange uses the real JSON string request
  and tuple response shape: pass
- Unit Kanidm HTTP 401 auth failure and 403 policy-denial classification: pass
- Unit Kanidm stepped passkey auth begin/complete payloads: pass
- Unit Kanidm stepped password-plus-security-key auth payloads: pass
- Unit Kanidm OAuth2 image route mapping only emits image URLs when image
  metadata exists: pass
- Unit Kanidm profile update writes displayname, legalname, and mail attrs: pass
- Unit Kanidm credential update passkey and attested-passkey setup/removal
  payloads: pass
- Unit Kanidm credential update SSH public-key removal payload: pass
- Visual credentials/session screenshot: pass
- Visual smoke screenshot matrix for public/private, desktop/mobile, and
  light/dark routes: pass
- Visual smoke mobile stress fixtures for empty portal, long app names, many
  groups, and nested relationships: pass
- Visual smoke populated Layerhouse scope-map editor on `/admin/apps/new`: pass
- Live Layerhouse `/oauth2/start` to `/oauth2/callback` sample-app token
  exchange: passed after the Layerhouse setup mapping fix documented in
  `docs/test-plans/layerhouse-live-oauth.md`

Screenshots from the latest local browser verification:

- `/tmp/kanidm-dashboard-visual-smoke/stress-empty-mobile-dark-_portal.png`
- `/tmp/kanidm-dashboard-visual-smoke/stress-large-mobile-dark-_portal.png`
- `/tmp/kanidm-dashboard-visual-smoke/stress-large-mobile-dark-_admin_relationships.png`
- `/tmp/kanidm-dashboard-visual-smoke/stress-orb-scope-map-mobile-dark-_admin_apps_new.png`
- `/tmp/kanidm-dashboard-visual-smoke/public-mobile-light-_login.png`
- `/tmp/kanidm-dashboard-visual-smoke/private-mobile-dark-_admin_people.png`
- `/tmp/kanidm-dashboard-visual-smoke/private-desktop-light-_portal.png`
- `/private/tmp/kanidm-dashboard-radius-generated.png`
- `/private/tmp/kanidm-dashboard-ssh-keys.png`
- `/private/tmp/kanidm-dashboard-credential-intent.png`
- `/tmp/kanidm-dashboard-credentials-sessions.png`
- `/tmp/kanidm-dashboard-mock-e2e.png`
- `/tmp/kanidm-dashboard-real-write-orb.png`
- `/tmp/kanidm-dashboard-add-user-recovery-mail.png`
- `/tmp/kanidm-dashboard-webauthn-real.png`
- `/tmp/kanidm-dashboard-recovery-handoff.png`

## Remaining Production Gaps

- Real Kanidm E2E requires ignored local `.env.local` with `KANIDM_PASSWORD`.
  The local `idm_admin` account was recovered and `vp run auth-smoke`,
  `vp run e2e-kanidm`, `vp run e2e-webauthn-kanidm`, and
  `vp run e2e-recovery-mail-kanidm` passed on the running 1.10.3 compose stack.
  Re-run them after any Kanidm API or admin-flow change.
- Layerhouse live sample-app OAuth passed after the setup mapping fix. The
  dashboard also verifies Kanidm-native OAuth discovery, consent, callback
  preservation, access denial, and Layerhouse-shaped app creation.
- Passkey and attested-passkey reset-token setup/removal is implemented with
  Kanidm `passkeyinit`/`passkeyfinish`, `attestedpasskeyinit`/
  `attestedpasskeyfinish`, `{ "passkeyremove": uuid }`, and
  `{ "attestedpasskeyremove": uuid }`. Unit tests cover the payloads, mock E2E
  covers the dashboard flow, and `vp run e2e-webauthn-kanidm` verifies real
  Kanidm passkey registration with a Playwright virtual authenticator.
- Passkey login is wired to Kanidm stepped auth. Unit tests cover the payloads,
  mock E2E covers the UI path, and `vp run e2e-webauthn-kanidm` verifies real
  Kanidm passkey login with a Playwright virtual authenticator.
- `/credentials` now exposes passkey management and backup-code regeneration
  through credential update sessions. Local live Kanidm 1.10.3 denies
  `idm_admin` current-user intent creation with `500 "notauthorised"`, and the
  dashboard surfaces that as a self-service policy denial while staying on the
  portal credentials page.
- Password-plus-security-key login is wired to Kanidm stepped auth with
  security-key assertion first and password second. Unit tests cover the payloads,
  and mock E2E covers the UI path. Real Kanidm coverage still needs a local
  account carrying a deprecated security key credential or compatible hardware.
- SSH public key reset-token addition/removal is implemented with verified
  Kanidm v1.10.3 payloads. A local probe showed the raw OpenSSH string
  deserializes for `CURequest::SshPublicKey(label, SshPublicKey)`; the disposable
  probe account then returned `AccessDeny` because its `sshkeys_state` was
  `AccessDeny`, while the generated OpenAPI object shape failed to deserialize.
