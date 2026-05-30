# Production Email Delivery Runbook

The dashboard does not send recovery email. It renders the recovery handoff,
admin reset actions, and reset-token UI, while Kanidm and `kanidm-mail-sender`
own message queueing and delivery.

Use this runbook for production recovery/reset email readiness. The local
Mailpit workflow is a reference implementation, not the production transport.

## Ownership Boundary

- Dashboard:
  - links users to Kanidm native `/ui/recover`
  - calls Kanidm admin credential intent APIs where the authenticated admin is allowed
  - renders `/reset?token=...`
  - verifies local delivery only through `vp run e2e-recovery-mail-kanidm`
- Kanidm:
  - owns account recovery policy
  - owns credential update intent creation
  - owns queued recovery/reset messages
  - owns the reset token in generated links
- `kanidm-mail-sender`:
  - polls Kanidm for queued messages with a service-account API token
  - sends messages through the configured production SMTP relay
  - must run as a separate production process or sidecar

## Required Production Setup

1. Run a production `kanidm-mail-sender` instance.
2. Create a dedicated Kanidm service account for mail sending.
3. Add that service account to `idm_message_senders`.
4. Generate a scoped API token for the service account.
5. Store the token in a secret manager, not in the dashboard image or static config.
6. Configure `kanidm-mail-sender` with production values:
   - `token`
   - `schedule`
   - `instance_display_name`
   - `instance_url`
   - `mail_from_address`
   - `mail_reply_to_address`
   - `mail_relay`
   - SMTP username/password or equivalent relay credentials
   - timeout values suitable for the relay
7. Configure trusted TLS for both Kanidm and the SMTP relay.
8. Enable Kanidm account recovery only when the organization is ready to support it.

Do not use the local Mailpit TLS CA, `mailpit`, `example.test` sender addresses,
or `verify_ca = false` style client settings in production.

## Production Verification

Run this before declaring recovery/reset email production-ready:

1. Confirm `/dashboard.config.json` points users at the production same-origin
   dashboard/Kanidm deployment.
2. Confirm the native Kanidm recovery page is reachable from the dashboard:

   ```bash
   vp run e2e-recovery-kanidm
   ```

3. Create a disposable production test account with a routable test mailbox.
4. From the dashboard, issue a credential reset email for that account, or invoke
   Kanidm's credential update intent send API through an admin-authenticated path.
5. Confirm the message arrives at the mailbox.
6. Confirm the message contains a reset link whose host matches the production
   `instance_url`.
7. Open the reset link and complete a password update.
8. Confirm the new credential can sign in through the dashboard.
9. Revoke or delete the disposable test account and any temporary test tokens.

For local parity before production, run:

```bash
./scripts/dev-kanidm-mail.sh
vp run e2e-recovery-mail-kanidm
```

The local E2E creates a disposable person, queues a credential reset email,
waits for `kanidm-mail-sender` to deliver through Mailpit, and verifies the
captured message contains a `/ui/reset?token=...` link.

## Operational Checks

- Monitor `kanidm-mail-sender` process health and restart behavior.
- Alert on repeated SMTP authentication, TLS, timeout, or relay rejection errors.
- Track queued-message age so recovery emails are not silently delayed.
- Rotate the mail sender service-account token on a defined schedule.
- Keep sender domain SPF/DKIM/DMARC aligned with the SMTP relay.
- Keep `mail_from_address` and `mail_reply_to_address` under an operator-owned domain.
- Verify reset links after every production origin, proxy, or branding change.

## Local Reference

The local workflow lives in:

- `scripts/dev-kanidm-mail.sh`
- `scripts/dev-kanidm-mail-bootstrap.mjs`
- `scripts/e2e-recovery-mail-kanidm.mjs`
- `deploy/local/docker-compose.yml`
- `deploy/local/kanidm/mail-sender.example.toml`

The generated local token config is intentionally ignored:

- `deploy/local/kanidm/mail-sender.local.toml`
