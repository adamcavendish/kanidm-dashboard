# OAuth Policy Workbench Test Plan

This phase expands application administration into a supported OAuth policy
workbench for scope maps, supplemental scope maps, claim maps, join strategy,
and confidential-client secret display.

Run all commands from:

`/Volumes/files/repo/adamcavendish/kanidm-dashboard/kanidm-dashboard`

## Scope

- Application detail summaries for access scope maps, supplemental scope maps,
  and claim maps.
- Application edit controls for access groups, scopes, supplemental scopes, and
  claim rules.
- Confidential-client secret reveal through Kanidm
  `/v1/oauth2/{rs_name}/_basic_secret`.
- Kanidm-backed policy writes through generated OAuth2 API endpoints:
  `_scopemap`, `_sup_scopemap`, `_claimmap/{claim}`, and
  `_claimmap/{claim}/{group}`.
- No key rotation or revocation controls; the generated OpenAPI SDK does not
  expose those operations.
- No mutating policy toggle controls. Live Kanidm rejected the tested toggle
  attrs through the supported OAuth2 patch endpoint.

## Required Fast Gate

```bash
vp check
vp test
vp build
```

## Live Kanidm Gate

Run against the live/proxied Kanidm server only:

```bash
KANIDM_TARGET=https://localhost:8443 vp dev
vp run e2e-kanidm
```

If the generic E2E script is blocked before reaching application policy routes,
record the exact Kanidm response and run targeted browser QA on
`/admin/apps`.

## Manual Browser QA

1. Sign in as an admin and open `/admin/apps`.
2. Select a confidential application and reveal its client secret.
3. Enter edit mode and add/remove an access scope for a selected group.
4. Add/remove a supplemental scope for a selected group.
5. Add a claim map rule with each join strategy: array, CSV, and
   space-separated.
6. Save changes and confirm the app reload shows the expected summaries.
7. Confirm unsupported key rotation/revocation controls are absent.
8. Confirm policy-toggle mutation controls are absent unless future live API
   verification proves support.

## Unit Coverage Targets

- Mapper parses `oauth2_rs_sup_scope_map` into supplemental scope maps.
- Mapper parses `oauth2_rs_claim_map` values and join strategies.
- Data source reads confidential-client secrets through `_basic_secret`.
- Data source writes/deletes scope maps, supplemental scope maps, claim maps,
  and claim-map join strategy through generated SDK endpoints.

## Live Validation Notes

Run date: 2026-06-04.

- `vp check`, `vp test`, and `vp build` passed.
- `vp run e2e-kanidm` is blocked before application policy routes by the
  existing live Kanidm group display-name write denial:
  `403 /v1/group/ui_registry_parent_243342/_attr/displayname`. The failed run
  cleaned up the temporary parent group and reported the screenshot at
  `/tmp/kanidm-dashboard-real-write-failure.png`.
- A temporary OAuth2 resource server was created against the live Kanidm tunnel
  at `https://localhost:9443`.
- Live API probes confirmed `_sup_scopemap` writes store
  `oauth2_rs_sup_scope_map` values like
  `idm_admins@localhost: {"admin_extra", "audit"}`.
- Live API probes confirmed `_claimmap` writes store
  `oauth2_rs_claim_map` values like
  `roles:idm_admins@localhost:;:"admin,owner"` for array joins,
  `roles:idm_admins@localhost:,:"admin,owner"` for CSV joins, and
  `roles:idm_admins@localhost: :"admin,owner"` for space-separated joins.
- Live API probes confirmed the tested toggle attrs were rejected by
  `/v1/oauth2/{rs_name}` PATCH with `400 invalidattributename`; mutating
  toggle controls remain intentionally out of scope for this phase.
- Browser QA on `/admin/apps` confirmed the temporary confidential client
  rendered normal scope maps, supplemental scope maps, claim maps, and the
  client-secret reveal path.
- Browser QA edit mode confirmed the selected group list avoids long-label
  overlap, the supplemental scope controls are reachable after the live group
  list, and claim-map controls render with join strategy selection.
- Browser QA saved a supplemental `review` scope through the UI, and live API
  verification confirmed Kanidm stored it in `oauth2_rs_sup_scope_map`.
- Browser QA verified a one-click mixed metadata and policy save: display name
  changed to `Codex OAuth Mixed Save Updated` and supplemental scope
  `qa_review` was persisted in `oauth2_rs_sup_scope_map`.
- The temporary resource server was deleted after the probe.

## Acceptance Evidence

- `vp check` passes.
- `vp test` passes.
- `vp build` passes.
- Live Kanidm E2E is passed or the group display-name blocker is documented
  with reproduction details.
- Subagent review findings are resolved or explicitly documented before asking
  the user to push.
