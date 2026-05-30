FROM caddy:2-alpine

COPY dist/ /srv/dashboard/
COPY public/dashboard.config.json /config/dashboard.config.json
COPY deploy/container/Caddyfile /etc/caddy/Caddyfile

EXPOSE 8080
