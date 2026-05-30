# Configuration

The dashboard reads a single JSON file at `/dashboard.config.json`:

```json
{
  "dataSource": {
    "mode": "kanidm",
    "apiBasePath": "",
    "openApiPath": "/docs/v1/openapi.json"
  },
  "siteName": "My Org",
  "logoUrl": "https://example.com/logo.svg",
  "loginMessage": "Sign in with your organisation account",
  "adminGroup": "idm_admins",
  "theme": {
    "mode": "system",
    "preset": "blue"
  }
}
```

## Fields

| Field                    | Type                            | Description                                                     |
| ------------------------ | ------------------------------- | --------------------------------------------------------------- |
| `dataSource.mode`        | `"kanidm" \| "mock"`            | `"kanidm"` for real API, `"mock"` for demo data                 |
| `dataSource.apiBasePath` | `string`                        | Base path for the Kanidm API (empty for same-origin)            |
| `dataSource.openApiPath` | `string`                        | Path to the Kanidm OpenAPI spec                                 |
| `siteName`               | `string`                        | Site title shown in the browser tab and login page              |
| `logoUrl`                | `string`                        | Fallback logo when native Kanidm domain branding is unavailable |
| `loginMessage`           | `string`                        | Message displayed on the login page                             |
| `adminGroup`             | `string`                        | Kanidm group whose members get admin console access             |
| `theme.mode`             | `"light" \| "dark" \| "system"` | Colour scheme mode                                              |
| `theme.preset`           | `string`                        | Colour preset name                                              |

## Static vs. native branding

The dashboard has two branding layers:

1. **Static config** (`dashboard.config.json`) — deploy-time settings: company
   name, fallback logo, login message, and theme. Update the file and restart.
2. **Native Kanidm** — domain display name, domain image, and OAuth2
   application icons are read from (and written to) Kanidm directly via the
   REST API. These take precedence over static config when available.

## Demo mode

For development and demos without a Kanidm backend, use
`scripts/fixtures/dashboard.config.mock.json`:

```bash
cp scripts/fixtures/dashboard.config.mock.json public/dashboard.config.json
vp dev
```

The mock data source pre-seeds people, groups, and applications so every page
is explorable immediately.
