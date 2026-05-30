# Introduction

Kanidm Dashboard is a modern web console for [Kanidm](https://github.com/kanidm/kanidm) —
the identity provider. It is a SolidJS single-page application that provides an
admin interface and user self-service portal over the Kanidm REST API.

## Who is this for?

- **Organisations running Kanidm** who want an admin UI and user portal without
  building their own frontend.
- **Operators** who prefer static deploy-time config (theme, branding, login
  message) over a writeable app database.
- **Developers** integrating Kanidm OAuth2 who need a reference client
  implementation.

## Design principles

- **API-spine first.** The dashboard talks to Kanidm through a same-origin
  proxy — it is a static asset bundle served alongside Kanidm's `/v1`,
  `/oauth2`, and `/ui` routes by a reverse proxy such as Caddy.
- **Adapter seam.** All data access goes through a `DashboardDataSource`
  interface with two adapters: `KanidmDataSource` (real API) and
  `MockDataSource` (in-memory demo). Switching between them is a single
  config field.
- **Static config.** Deploy-time settings (theme, company name, logo, login
  message) live in a JSON file — no database required. Kanidm-native branding
  (domain display name, domain image, OAuth2 app icons) is read from and
  written to Kanidm directly.

## Features

- **Admin console** — manage people, groups, and OAuth2 applications with
  review-before-submit wizards and access-impact previews.
- **Self-service portal** — users can manage credentials: password, TOTP,
  passkeys, SSH public keys, RADIUS, and Unix account settings.
- **Credential update wizard** — multi-step state machine for enrolling new
  credentials via reset tokens.
- **Relationship explorer** — visualise how people, groups, and applications
  connect.
- **Native Kanidm branding** — domain display name, domain image, and OAuth2
  application icons.
- **OAuth2 / OIDC consent flow** — built-in consent page and native OAuth2
  authorization endpoint.
- **E2E test suite** — Playwright tests against a real Kanidm server covering
  admin workflows, self-service, OAuth2 consent, credential resets, WebAuthn
  passkeys, and recovery email.
