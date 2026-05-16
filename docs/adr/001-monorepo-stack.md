# ADR 001: Monorepo stack and deployment

## Status

Accepted

## Context

We need a foundation for the trading AI system: authenticated multi-tenant workspaces before trading features. The briefing targets Go API, React dashboard, Docker Compose, and Coolify on a single VPS.

## Decision

- **Monorepo layout**: `api/` (Go), `web/` (React), root `docker-compose.yml`
- **API**: Go 1.22+, `chi` router, `pgx` for PostgreSQL, JWT in HttpOnly cookies
- **Web**: React 19 + Vite + TypeScript + Tailwind + Shadcn UI
- **Auth DB**: PostgreSQL (relational users/workspaces/members). DuckDB reserved for analytical/trading data in a later ADR
- **Deployment**: Docker Compose as source of truth; Coolify deploys the compose stack

## Consequences

- Clear separation: Postgres for identity/tenancy; DuckDB added later without mixing concerns
- Coolify can wire domains to `web` (static/nginx) and `api` services
- Single repo simplifies CI and coordinated releases
