# Coolify deployment

Deploy this repo as a **Docker Compose** resource in Coolify.

## Prerequisites

- Coolify instance with Docker access
- Domain (optional) pointing to the Coolify server
- Git repository connected to Coolify

## Steps

1. In Coolify, create a new **Docker Compose** application and point it at this repository.
2. Set the compose file path to `docker-compose.yml` at the repo root.
3. Add environment variables (Coolify UI or `.env` attached to the resource):

| Variable | Example |
|----------|---------|
| `POSTGRES_USER` | `trading` |
| `POSTGRES_PASSWORD` | *(strong secret)* |
| `POSTGRES_DB` | `trading` |
| `JWT_SECRET` | *(long random string)* |
| `ADMIN_EMAIL` | `admin@yourdomain.com` |
| `ADMIN_PASSWORD` | *(change after first login)* |
| `CORS_ORIGIN` | `https://trading.yourdomain.com` |
| `SECURE_COOKIES` | `true` |
| `WEB_PORT` | `80` |

4. Map your domain to the **web** service (port 80). The nginx container proxies `/api` and `/health` to the API service — no separate public API domain is required.
5. Deploy. Coolify builds `api` and `web` images and starts Postgres with a persistent volume.

## TLS

Terminate TLS at Coolify’s reverse proxy (Traefik/Caddy). Set `SECURE_COOKIES=true` and `CORS_ORIGIN` to your HTTPS dashboard URL.

## Health checks

- Compose defines healthchecks for `postgres` and `api`.
- Verify: `curl https://trading.yourdomain.com/health` → `{"status":"ok"}`

## Upgrades

Redeploy from Coolify after pushing to the tracked branch. Postgres data persists in the `postgres_data` volume.

## Local parity

```bash
docker compose up -d --build
```

Uses the same compose file Coolify deploys.
