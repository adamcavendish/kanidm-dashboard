# Architecture

## Request flow

```
browser
  │
  ├─ /                   → dashboard SPA (SolidJS + Vite)
  ├─ /v1/*               → Kanidm REST API (proxied by Caddy / Vite dev server)
  ├─ /oauth2/*           → Kanidm OAuth2 endpoints
  └─ /dashboard.config.json → static deploy-time config
```

## Source layout

```
src/
  domain.ts             Shared types: Person, Group, Application, ConsoleState
  data-source.ts        DashboardDataSource interface + KanidmDataSource + MockDataSource
  store.tsx             SolidJS context: state, auth, credential operations
  kanidm-auth.ts        Auth state machine: password, TOTP, passkey, backup code, security key
  kanidm-mappers.ts     Kanidm API response → domain model mapping
  kanidm-composite.ts   Multi-step create operations: groups, OAuth2 apps
  kanidm-error.ts       HTTP error types and auth-failure detection
  seed.ts               Initial state and demo fixtures
  App.tsx               Router, layout shells, and page components
  components/           Shared UI components: ErrorBox, OptionGrid, GlassPanel, etc.
  generated/            TypeScript SDK generated from Kanidm OpenAPI spec
```

## Data source seam

The `DashboardDataSource` interface defines 31 CRUD methods. Two adapters
implement it:

- **`KanidmDataSource`** — calls the Kanidm REST API via a generated TypeScript
  SDK. The SDK is generated from `spec/kanidm-openapi.json` using
  [openapi-nexus](https://github.com/adamcavendish/openapi-nexus).
- **`MockDataSource`** — in-memory state persisted to `localStorage`. Seeds
  from `src/seed.ts` with demo people, groups, and applications.

Switching between them is a single config field (`dataSource.mode`) — no code
changes required.

## Store

`store.tsx` provides a SolidJS context (`ConsoleProvider`) that wraps the data
source. It exposes:

- **State** — reactive `ConsoleState` with people, groups, applications, and
  branding.
- **Auth** — login flows (password, TOTP, passkey, backup code, security key).
- **Mutations** — CRUD operations that go through `mutateKanidm()` (writes) or
  `readKanidm()` (reads), both handling error recovery and state reload.

## Auth flow

Kanidm uses a stepped authentication protocol. Each step returns an
`X-KANIDM-AUTH-SESSION-ID` header that must be sent with the next request.
The dashboard implements this state machine in `kanidm-auth.ts`:

1. `init2` — begin authentication with username
2. `choose` — the server responds with available mechanisms
3. `begin` — select a mechanism (password, passkey, etc.)
4. `cred` — submit credentials

## Credential update state machine

The credential update wizard (`src/pages/reset-credentials.tsx`) uses Kanidm's
multi-step credential protocol:

1. `_exchange_intent` — exchange a reset token for a session
2. `_status` — query current credential state
3. `_update` — stage credential changes (password, TOTP, passkeys, etc.)
4. `_commit` — commit all staged changes atomically
