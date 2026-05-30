# Eval rubric — AI Trading System

> **Global quality bar.** Every issue rubric extends this file. Reviewers apply **both** this document and `docs/project/issues/<n>/rubric.md`.
>
> **Source:** [`project.md`](project.md) — Quality bar

---

## Pass threshold

| Rule | Value |
|------|-------|
| **Weighted score** | ≥ **7.0** / 10 |
| **Blockers** | Zero **CRITICAL** or **HIGH** from required reviewer subagents |
| **Must-pass flows** | All global + issue-specific flows PASS |

---

## Weighted dimensions

| Dimension | Weight | What we measure |
|-----------|--------|-----------------|
| **Design & UX** | 0.25 | Shadcn dashboard clarity, research/signals readability, non-generic UI |
| **Functionality** | 0.30 | API contracts, watchlist/research flows, scoring correctness |
| **Craft** | 0.25 | Go/TS quality, tests, loading/empty states, alignment with ADRs |
| **Security & trust** | 0.20 | Authz, workspace isolation, no secret leakage, safe errors |

### Design & UX

- [ ] Primary actions obvious on workspace research and signals pages
- [ ] Charts and score gauges include empty/loading states
- [ ] No unexplained “AI slop” layouts on new pages

### Functionality

- [ ] Workspace-scoped data never leaks across tenants
- [ ] FinBERT/decision scores respect zero-data policy (no fake 50s)
- [ ] API errors return safe messages to the client

### Craft

- [ ] `go test ./...` and `npm run build` pass per `setup.md`
- [ ] Scoring methodology UI matches backend formulas when touched
- [ ] Migrations reversible when schema changes

### Security & trust

- [ ] Protected routes require auth; admin routes require platform admin
- [ ] Internal API key required on `/internal/*`
- [ ] `.env` secrets never committed

---

## Non-negotiables (automatic FAIL)

- No hardcoded secrets or production credentials in source
- Go API remains authority for order/risk decisions (no LLM-direct trading)
- No raw stack traces to browser clients
- User input validated at API boundary (symbols, workspace IDs, etc.)

---

## Cross-cutting must-pass flows

| ID | Flow | How to verify |
|----|------|---------------|
| G1 | Admin can sign in | Login with `ADMIN_EMAIL` / `ADMIN_PASSWORD` → dashboard loads |
| G2 | Workspace member sees only their workspaces | Non-admin user → workspace list scoped |
| G3 | Research refresh respects watchlist | Refresh → only watchlist symbols updated |
| G4 | Health check | `GET /health` returns OK with API up |

---

## Cross-cutting edge cases

| ID | Case | Expected behavior |
|----|------|-------------------|
| E1 | API down during dashboard load | Clear error; no white screen crash |
| E2 | Unauthenticated `/api/v1/*` | 401 / redirect to login |
| E3 | FinBERT unavailable on refresh | Partial failure surfaced; no silent success |

---

## Performance baseline (UI)

| Metric | Target |
|--------|--------|
| Research page initial load | Usable < 5s on local dev with warm API |
| Lighthouse (key page) | ≥ 75 when measured on staging |

---

## Change log

| Date | Change |
|------|--------|
| 2026-05-30 | Initial product rubric from harness migration |
