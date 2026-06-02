# Deployment

The dashboard is distributed as a container image that bundles the static SPA
with an embedded Caddy reverse proxy. Caddy serves the dashboard and proxies
Kanidm API routes internally — you only need to expose one port.

## Quick start

```bash
docker run -d -p 8080:8080 \
  -e KANIDM_UPSTREAM=https://your-kanidm-server:8443 \
  ghcr.io/adamcavendish/kanidm-dashboard:0.0.2
```

Open `http://localhost:8080`.

If your Kanidm server runs in the same Docker network, use the container name
as the upstream:

```yaml
# docker-compose.yml
services:
  kanidm:
    # ... your existing Kanidm setup ...

  dashboard:
    image: ghcr.io/adamcavendish/kanidm-dashboard:0.0.2
    environment:
      KANIDM_UPSTREAM: https://kanidm:8443
    ports:
      - "8080:8080"
```

A full reference compose file is available at
[`deploy/container/docker-compose.yml`](https://github.com/adamcavendish/kanidm-dashboard/blob/main/deploy/container/docker-compose.yml).

## TLS between dashboard and Kanidm

The dashboard communicates with Kanidm over HTTPS. The container's Caddy
server uses the system trust store — it works out of the box when Kanidm
has a publicly trusted certificate (e.g. Let's Encrypt).

### Self-signed certificates

If Kanidm uses a self-signed certificate (the default when setting up
`kanidmd`), you need two things:

1. Mount the Kanidm CA certificate into the container
2. Mount a custom Caddyfile that trusts it

**Where to find `chain.pem`:** Kanidm generates this during initial setup.
It is typically at `/data/certs/chain.pem` inside the Kanidm container, or
in the directory you mounted to `kanidm`'s `/data/certs`.

**Custom Caddyfile** (`dashboard-caddyfile`):

```caddyfile
{
	auto_https off
}

:8080 {
	encode zstd gzip

	@dashboardConfig path /dashboard.config.json
	handle @dashboardConfig {
		header Cache-Control "no-store"
		root * /config
		file_server
	}

	@kanidm path /ui* /v1* /oauth2* /pkg* /hpkg* /.well-known* /docs* /status
	handle @kanidm {
		reverse_proxy {$KANIDM_UPSTREAM:https://kanidm:8443} {
			transport http {
				tls_server_name kanidm.example.com
				tls_trusted_ca_certs /certs/chain.pem
			}
		}
	}

	handle {
		root * /srv/dashboard
		try_files {path} /index.html
		file_server
	}
}
```

Replace `kanidm.example.com` with your Kanidm server's domain name — the
one in the certificate's Subject Alternative Name.

**Docker Compose:**

```yaml
dashboard:
  image: ghcr.io/adamcavendish/kanidm-dashboard:0.0.2
  environment:
    KANIDM_UPSTREAM: https://kanidm:8443
  volumes:
    - ./dashboard-caddyfile:/etc/caddy/Caddyfile:ro
    - ./certs/chain.pem:/certs/chain.pem:ro
  ports:
    - "8080:8080"
```

| Directive                  | Purpose                                                                                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `tls_server_name`          | Overrides the TLS SNI to match the certificate's domain. The Docker container hostname (`kanidm`) differs from the domain in the certificate. |
| `tls_trusted_ca_certs`     | Trusts the Kanidm CA certificate so the self-signed cert is accepted.                                                                         |
| `tls_insecure_skip_verify` | **Avoid.** Disables all TLS verification — accepts any certificate. Use only as a temporary workaround.                                       |

### Public certificates

No extra configuration is needed. The dashboard's Caddy server trusts
public CAs by default. Set `KANIDM_UPSTREAM` to your Kanidm server's
HTTPS URL and the TLS handshake will verify normally.

## Reverse proxy (standalone)

If you prefer to run the dashboard without the container's embedded Caddy,
serve `dist/` with your own reverse proxy:

```bash
# Build from source
vp build
# Serve dist/ with your web server, proxying Kanidm routes
```

Example Caddy configuration:

```caddyfile
kanidm.example.com {
    handle /v1/* {
        reverse_proxy https://kanidm-server:8443
    }
    handle /oauth2/* {
        reverse_proxy https://kanidm-server:8443
    }
    handle {
        root * /srv/dashboard
        try_files {path} /index.html
        file_server
    }
}
```

## Configuring the dashboard

Place a `dashboard.config.json` at the web root (next to `index.html`).
The container image includes a default config. See
[Configuration](configuration.md) for all options.

To use a custom config with the container:

```yaml
volumes:
  - ./my-dashboard.config.json:/config/dashboard.config.json:ro
```

## CI/CD

Container images are published to `ghcr.io/adamcavendish/kanidm-dashboard`
on every semver tag (`[0-9]*`). See `.github/workflows/container-image.yml`.
