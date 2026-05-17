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
| `DUCKDB_PATH` | no | Default `/data/analytics.duckdb` — mount persistent storage on `api` at `/data` |

## Fix: `network swr70… declared as external, but could not be found`

You used the **Postgres hostname** (`swr70ljso04l5io36pgk3vsg`) as `DATABASE_NETWORK_NAME`. That is wrong.

| Variable | What it is | Example |
|----------|------------|---------|
| Host in `DATABASE_URL` | DNS name of Postgres on the shared network | `swr70ljso04l5io36pgk3vsg` |
| `DATABASE_NETWORK_NAME` | Docker **network** name both containers join | `coolify` |

**Fix:** In Coolify env vars, either **delete** `DATABASE_NETWORK_NAME` (compose defaults to `coolify`) or set:

```env
DATABASE_NETWORK_NAME=coolify
```

Keep `DATABASE_URL` unchanged (still using `swr70ljso04l5io36pgk3vsg` as host). Redeploy.

## Fix: `lookup swr70… on 127.0.0.11:53: server misbehaving`

The API container and Postgres are on **different Docker networks**. Join the `coolify` network (see above).

### Option B — Coolify UI (in addition or instead)

Compose resource → **Connect to Predefined Network** → select the network used by your Postgres service → Redeploy.

You should still set `DATABASE_NETWORK_NAME` in env so `docker-compose.yml` attaches the `api` service explicitly.

## Steps

1. Create a **Docker Compose** application → repo root → `docker-compose.yml`.
2. Set all environment variables above.
3. Map your domain to the **web** service (container port **80**). Do not set `ports: 80:80` in compose — Coolify already uses host port 80 for its proxy (`port is already allocated` if you bind it twice). Nginx in `web` proxies `/api` and `/health` to `api`.
4. Deploy. In **api** logs you want `database target` then `api ready`.

## DuckDB volume (API app)

On the **AI Trading System** compose app in Coolify:

1. **Persistent Storage** → add mount: container `/data` (name e.g. `duckdb_data`).
2. Optional env: `DUCKDB_PATH=/data/analytics.duckdb` (default if unset).

DuckDB runs **inside the API container** (not a separate service). Back up the volume to preserve analytics.

## Verify

```bash
curl https://your-domain/health
# {"status":"ok","postgres":"ok","duckdb":"ok"}  (or "starting" until both are ready)
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
