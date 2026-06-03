# Person Operations Inspector Test Plan

This phase replaces the admin People table with a split-panel person inspector
and adds Kanidm-backed person lifecycle and cross-person admin operations.

Run all commands from:

`/Volumes/files/repo/adamcavendish/kanidm-dashboard/kanidm-dashboard`

## Scope

- Person list/detail split-panel UI.
- Profile edit for display name, legal name, and email.
- Status and validity controls backed by canonical Kanidm attrs.
- Group membership add/remove from the person detail view.
- Person delete with two-step confirmation.
- Person certificates list/add through `PersonCertificateApi`.
- Cross-person admin tools for credential update intents, sessions, SSH keys,
  RADIUS password, and Unix settings.

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

## Manual Browser QA

1. Sign in as an admin and open `/admin/people`.
2. Confirm the split-panel list/detail layout is usable on desktop and mobile.
3. Search for a person and select different rows; detail state should update
   without losing the list context.
4. Rapidly switch between people while operations are loading; sessions, SSH
   keys, RADIUS password, and certificates must not appear under the wrong
   person.
5. Edit profile fields and verify the updated values appear after reload.
6. Confirm `validFrom`, `expireAt`, and `softLockExpire` hydrate from the
   selected person and do not carry stale values between selections.
7. Add and remove a group membership from the person detail view; selected
   rows and toggled groups must expose `aria-current` or `aria-pressed` state.
8. Issue a credential update intent and verify the reset URL/token panel.
9. Inspect sessions, SSH keys, RADIUS password, Unix settings, and certificates.
10. Exercise destructive confirmations for person deletion without accidental
    single-click deletion.
11. Verify API denial or policy errors render as inline errors and do not corrupt
    local state.

## Unit Coverage Targets

- Data-source methods call generated SDK operations or canonical attr APIs.
- Mock data source mirrors the new inspector actions for local unit tests.
- Person mapper/test fixtures cover optional certificate, session, SSH, RADIUS,
  Unix, and validity detail states.
- Store actions refresh or update state consistently after mutations.
- UI tests or manual regression notes cover rapid selection changes and stale
  lifecycle field prevention.

## Acceptance Evidence

- `vp check` passes.
- `vp test` passes.
- `vp build` passes.
- Live Kanidm E2E is passed or the blocker is documented with reproduction
  details.
- Subagent review findings are resolved or explicitly documented before asking
  the user to push.
