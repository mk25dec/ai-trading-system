# ADR 003: DuckDB analytics storage

## Status

Accepted

## Context

PostgreSQL holds auth and tenancy (ADR 001–002). Trading analytics (signals, decisions, audit logs) need columnar OLAP-style storage per the project briefing.

## Decision

- **DuckDB** as an embedded database (single file), not a separate network service.
- Database file path via `DUCKDB_PATH` (default `/data/analytics.duckdb`).
- **Persistent volume** mounted at `/data` on the `api` container in Docker Compose / Coolify.
- Go access via `github.com/duckdb/duckdb-go/v2` (`database/sql`), with CGO enabled in the API image build.

## Consequences

- No DuckDB hostname or port for n8n; workflows call the Go API (or future dedicated export jobs).
- Coolify: add **Persistent Storage** on the trading API app → mount volume to `/data`.
- Back up `/data/analytics.duckdb` with normal volume snapshots; file is in `.gitignore`.
