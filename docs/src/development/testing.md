# Testing

## Unit tests

```bash
just test
```

Tests cover:

- **Data source seam** — `MockDataSource` and `KanidmDataSource` behaviour
- **Auth flows** — login with password, password+TOTP, backup code
- **Composite operations** — group and OAuth2 application creation
- **Mappers** — Kanidm API response parsing and domain model mapping

## E2E tests

```bash
# Full suite against a real Kanidm
just e2e-kanidm

# WebAuthn / passkey test
just e2e-webauthn

# Recovery email test
just e2e-recovery-mail
```

The main E2E suite (`scripts/e2e-real-kanidm.mjs`) uses Playwright with Chromium
against a real Kanidm instance. It verifies 22 behaviours:

1. Expired session redirect
2. Admin login
3. Group creation (parent and child)
4. Person creation with group membership
5. Group membership toggling
6. Nested relationship resolution
7. OAuth2 application creation
8. Application image upload and reset
9. Domain image upload and reset
10. Credential setup (password, TOTP, backup codes) via reset token
11. Native OAuth2 discovery, consent, and access denial
12. Non-admin portal login with backup code
13. Non-admin route guards (admin pages redirect to portal)
14. Non-admin mutation denial (direct API calls are rejected)
15. Profile read-only enforcement
16. RADIUS self-service
17. SSH public key management
18. Reauth flow
19. Session revocation
20. Unix credential self-service
21. Logout
22. Fixture cleanup

Each run creates unique test fixtures and cleans them up on completion,
even when tests fail.

### Requirements

- `KANIDM_PASSWORD` in `.env.local`
- Running Kanidm instance (via `./scripts/dev-kanidm-bootstrap.sh`)
- Caddy proxy (via `docker compose -f deploy/local/docker-compose.yml up -d dashboard-proxy`)

## Production artifact audit

```bash
just audit
```

Verifies the production build output: checks that all expected files exist, the
JavaScript bundle is non-empty, SPA fallback works, and the config file is
valid.
