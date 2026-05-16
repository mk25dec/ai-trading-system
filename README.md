# AI Trading System

Monorepo for the trading control plane: **Go API** + **React dashboard**, deployed with **Docker Compose** (Coolify).

## Repository layout

| Path | Purpose |
|------|---------|
| `api/` | Go REST API (auth, users, workspaces) |
| `web/` | React + Vite + Shadcn UI dashboard |
| `docker-compose.yml` | Production stack (API + web; external `DATABASE_URL`) |
| `docker-compose.dev.yml` | Local Postgres only |
| `docs/adr/` | Architecture decisions |
| `docs/plans/` | Implementation plans |
| `docs/features/` | Feature documentation |

## Quick start (local)

1. Copy environment file and set secrets:

```bash
cp .env.example .env
```

2. Start Postgres:

```bash
docker compose -f docker-compose.dev.yml up -d
```

3. Run API (requires [Go 1.22+](https://go.dev/dl/)):

```bash
cd api
export DATABASE_URL=postgres://trading:trading@localhost:5432/trading?sslmode=disable
export JWT_SECRET=dev-secret-change-me
export ADMIN_EMAIL=admin@example.com
export ADMIN_PASSWORD=changeme
export CORS_ORIGIN=http://localhost:5173
go run ./cmd/server
```

4. Run dashboard:

```bash
cd web
npm install
npm run dev
```

Open http://localhost:5173 and sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

## Production (Docker Compose / Coolify)

```bash
docker compose --env-file .env up -d --build
```

Set `DATABASE_URL` in `.env` (or Coolify env vars) to your Postgres connection string.

- Dashboard: http://localhost (port `WEB_PORT`, default 80)
- API health: proxied at `/health`
- API routes: proxied at `/api/v1/*`

See [docs/runbooks/coolify-deploy.md](docs/runbooks/coolify-deploy.md) for Coolify setup.

### Required environment variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Postgres connection URL (Coolify internal hostname in production) |
| `JWT_SECRET` | Signing key for session cookies |
| `ADMIN_PASSWORD` | Bootstrap admin password (first run only) |
| `CORS_ORIGIN` | Public dashboard URL (e.g. `https://app.example.com`) |
| `SECURE_COOKIES` | Set `true` when serving over HTTPS |

## API (current scope)

- `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`
- `GET/POST/PATCH/DELETE /api/v1/users` (platform admin)
- `GET /api/v1/users/lookup` (assign workspace members)
- `GET/POST/PATCH/DELETE /api/v1/workspaces`
- `GET/POST/PATCH/DELETE /api/v1/workspaces/:id/members`

Trading endpoints (symbols, signals, Alpaca) are planned in later milestones — see `docs/briefings/PROJECT.md`.
