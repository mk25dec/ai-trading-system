# AI Trading System — roadmap

> **Last updated:** 2026-05-30  
> Update this file when closing GitHub issues (harness convention).

---

## Phase 1 — Foundation (done)

| Subtask | Status | Doc |
|---------|--------|-----|
| Monorepo Go API + React dashboard | Done | ADR 001, feature 001 |
| Auth, workspaces, watchlist | Done | feature 001 |
| n8n internal API + workflow briefing | Done | `docs/briefings/INITIAL_WORKFLOWS.md` |
| Coolify / Compose deploy | Done | runbook |

---

## Phase 2 — FinBERT & decision engine (in progress)

**Goal:** Calibrated multi-horizon scores and uncertainty-aware projections.

| Sprint | Status | Plan / feature |
|--------|--------|----------------|
| A — Calibration backtest | Done (code) | `docs/plans/2026-05-19-sprint-a-calibration.md`, feature 004 |
| B — Signal richness | In progress | feature 005 |
| C — Pipeline depth | In progress | feature 007 |
| D — Price projection bands | In progress | feature 006 |

Master plan: [`docs/plans/2026-05-19-finbert-decision-engine-roadmap.md`](../plans/2026-05-19-finbert-decision-engine-roadmap.md).

---

## Phase 3 — Trading execution (backlog)

| Subtask | Status |
|---------|--------|
| Hypotheses CRUD + UI | Backlog |
| Paper orders via Alpaca | Backlog |
| Risk rules in Go API (hard gates) | Backlog |
| Decision log + audit trail UI | Backlog |
| Live trading (explicit enable) | Backlog |

Source: [`docs/briefings/PROJECT.md`](../briefings/PROJECT.md).

---

## Phase 4 — Harness & quality (ongoing)

| Subtask | Status |
|---------|--------|
| Cursor agent-development template adoption | Done (2026-05-30) |
| GitHub issue + plan → generate → review loop | Adopt |
| CI: Go test + web build/lint | Done |
| Web unit tests in CI | Backlog |
| Playwright smoke for dashboard | Backlog |
