# Service Account Vault Test Plan

This phase adds the admin service account vault for Kanidm-backed machine
identities, API tokens, generated credentials, SSH public keys, and Unix
settings.

Run all commands from:

`/Volumes/files/repo/adamcavendish/kanidm-dashboard/kanidm-dashboard`

## Scope

- Admin rail entry and routes for `/admin/service-accounts` and
  `/admin/service-accounts/new`.
- Service account list/detail split-panel UI.
- Service account create, profile edit, group membership, and delete.
- API token list, generate, one-time secret display, and delete.
- Credential status read and credential generation.
- SSH public key list, add, and delete.
- Unix account settings extension.

## Required Fast Gate

```bash
vp check
vp test
vp build
```

`vp check` must be run without source-changing fixes unless the change is
intentional and reviewed.

## Live Kanidm Gate

Run against the live/proxied Kanidm server only:

```bash
KANIDM_TARGET=https://localhost:8443 vp dev
vp run e2e-kanidm
```

If the live gate is blocked by environment state, record the exact blocker in
the PR and keep `vp check`, `vp test`, and `vp build` green.

The generic E2E script is not sufficient by itself for this phase unless it
reaches the service-account routes. Also exercise:

- `/admin/service-accounts`
- `/admin/service-accounts/new`
- Service account API token list/generate/delete.
- Service account SSH key list/add/delete.
- Service account credential status/generate.
- Service account Unix settings save.

The visual smoke script includes the service-account routes and should be used
when a mock visual pass is needed in addition to live Kanidm checks.

## Manual Browser QA

1. Sign in as an admin and open `/admin/service-accounts`.
2. Confirm the split-panel list/detail layout is usable on desktop and mobile.
3. Search for a service account and verify the empty state explains no matches.
4. Create a service account from `/admin/service-accounts/new`.
5. Edit display name, description, and managed-by group.
6. Add and remove group membership from the detail view.
7. Generate an API token and verify the secret is shown only in the result box.
8. Delete an API token and confirm the list refreshes.
9. Check credential status and generate a service account credential.
10. Add and delete SSH public keys.
11. Save Unix GID and login shell settings.
12. Exercise destructive delete confirmation without accidental single-click
    deletion.
13. Verify API denial or policy errors render as inline errors and do not
    corrupt local state.

## Unit Coverage Targets

- Service accounts are loaded and mapped from Kanidm entries.
- Service account create uses canonical Kanidm attrs.
- API token generation uses `label`, `expiry`, `read_write`, and `compact`.
- Mock data source mirrors token, SSH key, credential, and Unix state changes.
- Unauthenticated real-mode state never exposes demo service account data.
- Kanidm load remains usable when service-account listing is denied by policy.

## Acceptance Evidence

- `vp check` passes.
- `vp test` passes.
- `vp build` passes.
- Live Kanidm E2E is passed or the blocker is documented with reproduction
  details.
- Service-account route/browser QA covers desktop, mobile, and filtered empty
  states.
- Subagent review findings are resolved or explicitly documented before asking
  the user to push.

## Live Validation Notes

Run date: 2026-06-04.

- Created a temporary `testsvcacc` service account against the live Kanidm
  tunnel at `https://localhost:9443`, added it to
  `idm_service_account_admins`, and added SSH key tag `codex-validation-key`.
- Browser QA at `/admin/service-accounts` showed `testsvcacc`, direct
  membership `idm_service_account_admins`, SSH key count `1`, and the
  `codex-validation-key` detail row.
- Direct API validation confirmed `/v1/service_account/testsvcacc/_ssh_pubkeys`
  returns raw public keys, while `/v1/service_account/testsvcacc` exposes the
  label in `ssh_publickey`; the adapter must prefer that attr for labels.
- Direct API validation confirmed blank API-token expiry must serialize as a
  present `null` field. With that shape the request reaches Kanidm authz and
  the current admin fixture returns `403 "accessdenied"`.
- Direct API validation confirmed Unix save succeeds with
  `/v1/service_account/testsvcacc/_unix`.
- Direct API validation found current live Kanidm responses outside dashboard
  control: credential status returned `500 {"missingattribute":"displayname"}`,
  credential generation returned `405`, and description attr write returned
  `403 "accessdenied"`.
- The temporary service account and group membership were deleted after the
  pass; the service-account list no longer included `testsvcacc`.
- `vp run e2e-kanidm` was attempted with
  `KANIDM_URL=https://localhost:9443` and
  `KANIDM_DASHBOARD_URL=http://127.0.0.1:5173`. It failed before reaching
  service-account routes because Kanidm returned `403` for
  `/v1/group/ui_registry_parent_521885/_attr/displayname`, so the script timed
  out waiting for `Group created`. Cleanup deleted the disposable parent group;
  missing child/person/OAuth fixtures were already absent.
