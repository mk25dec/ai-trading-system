# AI Trading System

> **Lifecycle stage:** Live (MVP+)
> **Last updated:** 2026-05-30

---

## Vision

Lean **AI-assisted trading and investing**: Go API as execution authority, React dashboard for research and signals, FinBERT + ML services for sentiment and scores, n8n for pipeline orchestration. AI may reason and summarize; **deterministic rules** control risk and order placement.

---

## Rationale

### Problem

Operators need multi-tenant workspaces, watchlist research, calibrated FinBERT signals, and audit-friendly decisions—not ad-hoc chat trading.

### Who it is for

| User | Need |
|------|------|
| Platform admin | Users, workspaces, system config |
| Workspace members | Watchlist, research board, signals, calibration views |
| Automation (n8n) | Internal API for ingest and workflow results |

### Why now

Monorepo stack (ADR 001) is deployed; FinBERT decision engine and calibration sprints are in progress per roadmap.

---

## Features (current)

| Area | Status |
|------|--------|
| Auth, users, workspaces, watchlist | Shipped — see `docs/features/001-auth-foundation.md` |
| Research board (Alpaca + FinBERT) | Shipped |
| Calibration backtest CLI | Shipped — `docs/features/004-calibration-backtest.md` |
| FinBERT signal richness / pipeline depth | In progress — features 005–007 |
| Paper/live Alpaca execution | Planned — `docs/briefings/PROJECT.md` |
| Hypotheses, orders, decision log UI | Planned |

---

## Quality bar

See [`eval-rubric.md`](eval-rubric.md). Trading-specific non-negotiables:

- No fake neutral scores without inputs (`hasScorableInputs`, zero-data policy)
- Go API is final authority for orders and risk—not LLM output
- Formulas in `web/src/lib/scoring-methodology.ts` stay aligned with `api/internal/services/decision_*.go`

---

## Technical stack

| Layer | Choice | ADR / doc |
|-------|--------|-----------|
| API | Go 1.22+, chi, pgx, JWT cookies | [001-monorepo-stack](../adr/001-monorepo-stack.md) |
| Web | React 19, Vite, TypeScript, Tailwind, Shadcn | ADR 001 |
| Identity DB | PostgreSQL | ADR 001, [002-auth-and-tenancy](../adr/002-auth-and-tenancy.md) |
| Analytics | DuckDB file (`DUCKDB_PATH`) | [003-duckdb-analytics-storage](../adr/003-duckdb-analytics-storage.md) |
| Sentiment | `finbert-api/` (Python) | Runbooks |
| ML scores | `xgboost-service/` (Python) | — |
| Orchestration | n8n + internal `/internal/*` | [INITIAL_WORKFLOWS](../briefings/INITIAL_WORKFLOWS.md) |
| Deploy | Docker Compose, Coolify VPS | [coolify-deploy](../runbooks/coolify-deploy.md) |

**Agent config:** `.cursor/rules/` (orchestration + `go/`, `typescript/`, `web/`, `python/`), `.cursor/agents/`, `.cursor/skills/`.

---

## Legacy documentation map

Harness uses `docs/project/` for issue-driven work. Existing docs remain authoritative for shipped behavior:

| Path | Role |
|------|------|
| `docs/features/` | Living feature records (update when behavior changes) |
| `docs/plans/` | Historical / sprint implementation plans |
| `docs/runbooks/` | Operations (deploy, calibration, FinBERT ingest) |
| `docs/briefings/` | Original product briefing (`PROJECT.md`) |
| `docs/adr/` | Architecture decisions |

New issues should link ADRs and feature docs from `docs/project/issues/<n>/spec.md`.

---

## Delivery requirements

| Area | Requirement |
|------|-------------|
| Hosting | VPS via Coolify; Compose stack |
| CI | `.github/workflows/ci.yml` mirrors [`setup.md`](setup.md) |
| MCP | Context7 + GitHub (`CONTEXT7_API_KEY`, `GITHUB_TOKEN` in `.env`) |
| Observability | Structured logs on API; no secrets in logs |
