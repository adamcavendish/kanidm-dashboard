# Deployment

## Production build

```bash
just build
```

Outputs to `dist/`. The build produces:

- `index.html` — SPA entry point
- `assets/index-<hash>.js` — bundled JavaScript
- `assets/index-<hash>.css` — bundled CSS

## Caddy reverse proxy

The dashboard is designed to be served behind a reverse proxy that also proxies
Kanidm API routes. An example Caddy configuration:

```caddyfile
:443 {
    tls internal

    handle /ui/* {
        root * /srv/dashboard
        file_server
    }

    handle_path /v1/* {
        reverse_proxy kanidm:8443
    }

    handle {
        root * /srv/dashboard
        try_files {path} /index.html
    }
}
```

Key points:

- Static assets are served directly from the filesystem.
- Kanidm API routes (`/v1`, `/oauth2`, `/docs`) are proxied to the Kanidm
  server.
- SPA fallback: all other routes serve `index.html` for client-side routing.

## Container image

```bash
vp build
docker build -f deploy/container/Dockerfile -t kanidm-dashboard .
```

The container includes the dashboard static assets and a Caddy server
configured for same-origin Kanidm proxying.

See [`deploy/container/`](https://github.com/adamcavendish/kanidm-dashboard/tree/main/deploy/container)
for the Docker setup.

## Configuring the dashboard

Place a `dashboard.config.json` at the web root. The dashboard loads it on
first access. See [Configuration](configuration.md) for details.

## CI/CD

See `.github/workflows/` for the CI pipeline and container image publishing
workflows. The CI runs:

1. Fast gate — type-check, lint, unit tests, build, artifact audit, container
   smoke test.
2. Real Kanidm integration — end-to-end tests against a live Kanidm instance.

Container images are published to `ghcr.io` on tag pushes (`v*`).
