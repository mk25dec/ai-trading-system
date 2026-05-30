# Getting started — AI Trading System

This repo uses the **agent-development** Cursor harness (rules, subagents, skills, hooks). Application setup is in [`README.md`](README.md); harness setup is here.

## Quick links

| Doc | Purpose |
|-----|---------|
| [`AGENTS.md`](AGENTS.md) | Agent contract and orchestration loop |
| [`docs/project/setup.md`](docs/project/setup.md) | **CI commands** and local dev |
| [`docs/project/project.md`](docs/project/project.md) | Product vision and stack |
| [`docs/guides/workflow-explainer.md`](docs/guides/workflow-explainer.md) | Human FAQ (plan → generate → review) |
| [`docs/HARNESS_MIGRATION.md`](docs/HARNESS_MIGRATION.md) | Migration gaps and follow-ups |

## First-time harness setup

1. Copy `.env.example` → `.env` (app + optional MCP keys).
2. Set `CONTEXT7_API_KEY` and `GITHUB_TOKEN` if using MCP (see `.cursor/mcp.json`).
3. Read `AGENTS.md` — every change needs a **GitHub issue** and **plan → generate → review**.
4. Run local stack per [`docs/project/setup.md`](docs/project/setup.md).
5. Confirm CI locally before PRs: `go test` in `api/`, `npm run build` + `lint` in `web/`.

## Stack-specific Cursor rules

| Path | Applies to |
|------|------------|
| `.cursor/rules/go/` | `api/**/*.go` |
| `.cursor/rules/typescript/` | `web/**/*.ts`, `web/**/*.tsx` |
| `.cursor/rules/web/` | React dashboard |
| `.cursor/rules/python/` | `finbert-api/`, `xgboost-service/`, `notebooks/` |

## Working an issue

1. Create GitHub issue (template: `.github/ISSUE_TEMPLATE/feature.yml`).
2. `Task(planner)` → `docs/project/issues/<n>/spec.md` + `rubric.md`.
3. `Task(generator)` → implementation + `generator-state.md`.
4. Reviewer subagents in parallel per rubric.
5. `Task(doc-updater)` after PASS — update README, features, `CHANGELOG.md` (required for S).
6. PR with `Closes #n`.

## Legacy docs

Pre-harness work lives in `docs/features/`, `docs/plans/`, `docs/runbooks/`. Link them from new issue specs; do not delete without archival reason.
