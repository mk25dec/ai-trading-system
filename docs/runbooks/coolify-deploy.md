# Coolify deployment

Deploy this repo as a **Docker Compose** resource in Coolify.

## Prerequisites

- Coolify instance with Docker access
- A **Coolify Postgres** (or other) database resource
- Git repository connected to Coolify

## Environment variables

| Variable | Required | Example |
|----------|----------|---------|
| `DATABASE_URL` | yes | Internal URL from Coolify Postgres (hostname like `swr70…`) |
| `DATABASE_NETWORK_NAME` | yes | Docker network name where Postgres runs (see below) |
| `JWT_SECRET` | yes | Long random string |
| `ADMIN_PASSWORD` | yes | Bootstrap admin password |
| `CORS_ORIGIN` | yes | `https://your-domain.example` |
| `SECURE_COOKIES` | yes (HTTPS) | `true` |
| `ADMIN_EMAIL` | no | `admin@yourdomain.com` |
| `API_PORT` | no | `8090` (default) |
| `WEB_PORT` | no | `80` (default) |

## Fix: `lookup swr70… on 127.0.0.11:53: server misbehaving`

The API container and Postgres are on **different Docker networks**. The hostname in `DATABASE_URL` only resolves on the Postgres network.

### Option A — Set `DATABASE_NETWORK_NAME` (recommended, in git)

1. On the Coolify server (SSH or terminal), find the Postgres container:

```bash
docker ps --filter "ancestor=postgres" --format '{{.Names}}'
```

2. List its networks (pick the non-bridge `coolify` / UUID name, not only `bridge`):

```bash
docker inspect <postgres-container-name> --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}'
```

3. In Coolify → Compose app → **Environment Variables**, add:

```env
DATABASE_NETWORK_NAME=swr70ljso04l5io36pgk3vsg
```

Use the network name from step 2. On many Coolify installs it is **the same string** as the hostname in `DATABASE_URL`.

4. Redeploy.

### Option B — Coolify UI (in addition or instead)

Compose resource → **Connect to Predefined Network** → select the network used by your Postgres service → Redeploy.

You should still set `DATABASE_NETWORK_NAME` in env so `docker-compose.yml` attaches the `api` service explicitly.

## Steps

1. Create a **Docker Compose** application → repo root → `docker-compose.yml`.
2. Set all environment variables above.
3. Map your domain to the **web** service (port 80). Nginx proxies `/api` and `/health` to `api`.
4. Deploy. In **api** logs you want `database target` then `api ready`.

## Verify

```bash
curl https://your-domain/health
# {"status":"ok"}  (or "starting" until DB connects)
```

## TLS

Set `SECURE_COOKIES=true` and `CORS_ORIGIN` to your HTTPS dashboard URL.

## Local full stack (without Coolify network)

```bash
docker network create trading-local
export DATABASE_NETWORK_NAME=trading-local
# Postgres must be attached to trading-local, or use docker-compose.dev.yml + host API
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

For day-to-day dev, prefer `docker-compose.dev.yml` (Postgres only) and run `go run` + `npm run dev` on the host — see README.
