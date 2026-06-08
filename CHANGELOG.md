# Changelog

## 0.0.3 (2026-06-08)

### Features

- Person operations inspector with split-panel list/detail view, profile editing, group membership toggle, certificates, and sessions
- Service account vault with CRUD, API token management, credential generation, SSH keys, and Unix extensions
- OAuth policy workbench with toggle controls (7 attrs), supplemental scope maps, claim maps, key rotation, and client secret reveal
- Admin maintenance console: schema browser, recycle bin with revive, system config
- Self-service credential completion: passkey and backup code management
- Application editing (display name, landing URL, redirect URIs) and deletion
- Group management: edit metadata, parent groups, members, managed-by relationships
- Relationships access matrix
- Free-form OAuth scope picker with custom scopes

### Fixes

- Unix timestamp parsing in session `issued_at` (Kanidm returns integer seconds, not milliseconds)
- Credential meter now shows signal meanings with an accessible info button
- E2E test resilience for optional scope buttons

### Internal

- App.tsx modularized from ~5,400 lines into 30+ modules across `src/pages/`, `src/components/`, and `src/utils/`
- Router extracted to `src/routing.tsx` with NavigationProvider, Link, NavLink

## 0.0.2 (2026-06-02)

### Fixes

- Clean up deploy layout, remove TLS workaround, add reference compose file

## 0.0.1 (2026-05-29)

Initial release.
