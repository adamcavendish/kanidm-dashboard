# Admin Maintenance Console Test Plan

## Scope

This phase adds the admin maintenance surfaces for group Unix/POSIX settings,
group account policy attrs, schema browsing, recycle-bin revive, and system
configuration attrs.

## Live API Notes

- Keep group rename limited to display metadata. Do not patch immutable identity
  names unless a future live API validation proves that identity rename is
  supported.
- `GroupUnixApi.groupIdUnixTokenGet` can return a live Kanidm `missingclass`
  error when a group is not POSIX-enabled. The UI treats that as "not set" and
  uses `GroupUnixApi.groupIdUnixPost` to extend the group with a GID.
- The live recycle-bin list endpoint accepted `GET /v1/recycle_bin`, while the
  generated SDK list method emitted `POST /v1/recycle_bin` and received 405.
  The implementation uses a narrow direct GET for listing and keeps generated
  SDK methods for detail and revive.
- Live schema endpoints may return empty arrays or null entries for some
  sessions. The schema browser must show an explicit empty state instead of a
  blank list.
- System configuration exposes all returned attrs for inspection, but only
  `description` is writable in this phase. Keep other system attrs read-only
  until live API validation proves they are safe dashboard controls.
- The live e2e failure filter allows the verified maintenance read failures for
  absent group policy attrs and non-POSIX group Unix token reads. These are read
  probes, not failed writes.
- Group account policy controls use canonical Kanidm attrs:
  `authsession_expiry`, `auth_password_minimum_length`,
  `credential_type_minimum`, `privilege_expiry`,
  `webauthn_attestation_ca_list`, `allow_primary_cred_fallback`,
  `limit_search_max_results`, and
  `limit_search_max_filter_test`.

## Validation

Run these after source changes:

```bash
vp check
vp test
vp build
```

For live Kanidm coverage, run:

```bash
KANIDM_TARGET=https://localhost:8443 vp dev
KANIDM_DASHBOARD_URL=http://127.0.0.1:5173 vp run e2e-kanidm
```

When `KANIDM_DASHBOARD_URL` is an HTTP dev URL, the e2e script uses
`KANIDM_NATIVE_OAUTH_URL` or `KANIDM_URL` for the native Kanidm OAuth UI
because Kanidm's native auth-session cookies require the HTTPS Kanidm origin.

Browser QA at desktop and mobile widths:

- `/admin/groups`: verify group details, Unix/POSIX status, GID save control,
  account policy attrs, and list empty-state behavior.
- `/admin/schema`: verify loading, empty schema, search, and read-only detail.
- `/admin/recycle-bin`: verify list, detail, confirmation guard, and revive
  error/success feedback.
- `/admin/system`: verify system config entry list, attr selection, multiline
  values, read-only guards for non-description attrs, save feedback, and large
  attr handling.

## Current Result

- `vp check`: passed.
- `vp test`: passed.
- `vp build`: passed.
- `vp run e2e-kanidm`: passed against `https://localhost:9443`, including
  nested group access, group membership toggle, native OAuth, domain branding,
  direct maintenance-page route checks, and fixture cleanup.
