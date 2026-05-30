# Setup & CI commands

> **Source of truth** for local dev and GitHub Actions. Keep in sync with [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml).

---

## Prerequisites

- Docker (Postgres dev)
- Go 1.22+
- Node.js 20+
- Python 3.11+ (FinBERT / notebooks / ML services, optional for API-only work)

---

## Environment

```bash
cp .env.example .env
```

Edit `.env`: `JWT_SECRET`, `ADMIN_PASSWORD`, `DATABASE_URL`, API keys as needed.

**Harness MCP (optional for agents):**

- `CONTEXT7_API_KEY` — library docs via Context7
- `GITHUB_TOKEN` — issues/PRs via GitHub MCP

---

## Local services

### Postgres

```bash
docker compose -f docker-compose.dev.yml up -d
```

### Migrations

```bash
cd api
go run ./cmd/migrate/
```

### API

```bash
cd api
go run ./cmd/server
```

Default: http://localhost:8090 (`API_PORT`).

### Web dashboard

```bash
cd web
npm install
npm run dev
```

Open http://localhost:5173.

### Optional: calibration backtest

```bash
cd api
go run ./cmd/calibrate/ -since 720h -config ../config/calibration.json
```

See [calibration backtest runbook](../runbooks/calibration-backtest.md).

### Optional: n8n workflows

```bash
node scripts/n8n/deploy-workflows.mjs
```

Requires `N8N_URL`, `N8N_API_KEY`, `API_INTERNAL_BASE_URL`, `INTERNAL_API_KEY` in `.env`.

---

## CI commands (must pass before merge)

Run from repo root:

```bash
cd api && go test ./...
cd web && npm ci && npm run build && npm run lint
```

**Not in CI yet (run locally when touched):**

```bash
cd api && go vet ./...
cd finbert-api && pip install -r requirements.txt && pytest   # when tests exist
```

---

## Production

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

Coolify: see [coolify-deploy runbook](../runbooks/coolify-deploy.md).
