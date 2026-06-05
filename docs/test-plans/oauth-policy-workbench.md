# OAuth Policy Workbench Test Plan

This phase expands application administration into a supported OAuth policy
workbench for scope maps, supplemental scope maps, claim maps, join strategy,
confidential-client secret display, verified policy toggles, and key actions.

Run all commands from:

`/Volumes/files/repo/adamcavendish/kanidm-dashboard/kanidm-dashboard`

## Scope

- Application detail summaries for access scope maps, supplemental scope maps,
  and claim maps.
- Application edit controls for access groups, scopes, supplemental scopes, and
  claim rules.
- Confidential-client secret reveal through Kanidm
  `/v1/oauth2/{rs_name}/_basic_secret`.
- Attribute-backed OAuth policy controls for:
  `oauth2_prefer_short_username`, `oauth2_consent_prompt_enable`,
  `oauth2_jwt_legacy_crypto_enable`, `oauth2_strict_redirect_uri`,
  `oauth2_device_flow_enable`, `oauth2_refresh_token_expiry`,
  `oauth2_allow_insecure_client_disable_pkce`, and
  `oauth2_allow_localhost_redirect`.
- `oauth2_allow_localhost_redirect` is editable only for public clients.
- Existing `oauth2_refresh_token_expiry` values can be changed, but clearing an
  existing value is blocked because Kanidm 1.10.3 exposes no OAuth2
  resource-server attr-delete route.
- OAuth key rotation and revocation through `key_action_rotate` and
  `key_action_revoke` PATCH attribute operations.
- Kanidm-backed policy writes through generated OAuth2 API endpoints:
  `_scopemap`, `_sup_scopemap`, `_claimmap/{claim}`, and
  `_claimmap/{claim}/{group}`.

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
6. Toggle each verified policy control and set a refresh-token expiry value.
7. Confirm clearing an existing refresh-token expiry is blocked with guidance
   to enter a replacement value.
8. Confirm localhost redirect can be changed only on public clients.
9. Save changes and confirm the app reload shows the expected summaries.
10. Rotate OAuth keys and confirm the command completes.
11. Revoke OAuth keys and confirm the command completes.

## Unit Coverage Targets

- Mapper parses `oauth2_rs_sup_scope_map` into supplemental scope maps.
- Mapper parses `oauth2_rs_claim_map` values and join strategies.
- Data source reads confidential-client secrets through `_basic_secret`.
- Data source writes/deletes scope maps, supplemental scope maps, claim maps,
  and claim-map join strategy through generated SDK endpoints.
- Mapper parses the verified OAuth policy toggle attributes.
- Data source writes changed OAuth toggle attributes through
  `/v1/oauth2/{rs_name}` PATCH.
- Data source sends `key_action_rotate` and `key_action_revoke` command
  attributes through `/v1/oauth2/{rs_name}` PATCH.

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
- Follow-up live API probes on 2026-06-05 confirmed seven of eight toggle
  attributes were accepted against Kanidm 1.10.3 through
  `/v1/oauth2/{rs_name}` PATCH. `oauth2_allow_localhost_redirect` was accepted
  for public clients through a public test client.
- Follow-up live API probes confirmed `key_action_rotate` and
  `key_action_revoke` use the same OAuth2 PATCH attribute mechanism.
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

Follow-up run date: 2026-06-05.

- `vp check`, `vp test`, and `vp build` passed after adding attr-backed OAuth
  policy controls and key action commands.
- `vp run e2e-kanidm` was attempted with
  `KANIDM_DASHBOARD_URL=http://127.0.0.1:5173` and
  `KANIDM_TARGET=https://localhost:8443` after starting
  `vp dev --host 127.0.0.1` against the live tunnel.
- The live E2E was blocked at login by the local `.env.local` admin password:
  Kanidm returned `incorrect password`, the script did not obtain an admin
  token, and no live mutations were made.
- Browser QA for `/admin/apps` was also blocked because the in-app browser
  redirected to `/login` without a valid admin session.

## Acceptance Evidence

- `vp check` passes.
- `vp test` passes.
- `vp build` passes.
- Live Kanidm E2E is passed or the current environment blocker is documented
  with reproduction details.
- Subagent review findings are resolved or explicitly documented before asking
  the user to push.
