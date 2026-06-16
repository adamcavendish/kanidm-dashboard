# Self-Service Credential Completion Test Plan

## Scope

This phase completes portal-first credential self-service for passkeys and
backup codes. The `/credentials` page must let authenticated users start a
short-lived credential update session for their own account, stage passkey and
backup-code changes through Kanidm's credential update state machine, and
commit or cancel the staged update without entering admin routes.

## Kanidm API Coverage

- Current-user self-service starts a direct credential update session with
  `GET /v1/person/{id}/_credential/_update`.
- Passkey setup uses `/v1/credential/_update` with `passkeyinit` followed by
  `{ "passkeyfinish": [label, registration] }`.
- Attested passkey setup uses `attestedpasskeyinit` followed by
  `{ "attestedpasskeyfinish": [label, registration] }`.
- Passkey removal uses `{ "passkeyremove": uuid }`.
- Attested passkey removal uses `{ "attestedpasskeyremove": uuid }`.
- Backup-code regeneration/removal uses `backupcodegenerate` and
  `backupcoderemove`.
- Finalization uses `/v1/credential/_commit`; cancellation uses
  `/v1/credential/_cancel`.

## Required Validation

- `vp check`
- `vp test`
- `vp build`
- `KANIDM_DASHBOARD_URL=http://127.0.0.1:5173 vp run e2e-kanidm`
- Browser QA on `/credentials` at desktop and mobile widths.
- Real WebAuthn validation with Playwright virtual authenticators when passkey
  changes affect registration or login behavior.

## Browser QA Checklist

- Non-admin users land on `/portal` after login and can reach `/credentials`
  from the primary navigation.
- `/credentials` does not render the admin rail for non-admin users.
- The Passkeys card starts a credential update session and exposes add/remove
  passkey controls.
- The Backup codes card stages backup-code generation and displays generated
  codes before commit.
- Commit refreshes credential data and returns the panel to an idle state.
- Cancel clears the active credential update session without leaving the portal
  surface.
- Long passkey labels, generated codes, and warning text wrap without horizontal
  overflow on mobile.

## Current Notes

- The reset-token page remains the unauthenticated entry for admin-issued
  password, TOTP, Unix, SSH, passkey, and backup-code operations.
- `/enrol` is the authenticated self-service credential update workbench for the
  current user.
- `/credentials` exposes inline passkey and backup-code shortcuts that start the
  same direct current-user credential update session.
- If live Kanidm denies direct current-user credential update for a specific
  account, the UI must show the returned error and keep the user on
  `/credentials` or `/enrol`.
- Local live probing on Kanidm 1.10.3 showed `idm_admin` receives
  `500 "notauthorised"` for credential self-service; the dashboard maps
  that to a self-service denial message instead of the generated SDK's generic
  error.
- Live e2e also allows `403` on a non-admin user's
  `/_credential/_update` request as a Kanidm policy denial, scoped to that
  exact self-service request. This is reported as
  `credentialSelfServicePolicyDenied`, not as a completed update session.
