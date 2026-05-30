# Harness migration notes (2026-05-30)

This repo was aligned with the [agent-development template](https://github.com/Template-app/template) (local path used during migration).

## What was applied

| Area | Status |
|------|--------|
| `.cursor/rules/` — orchestration, harness, security, testing, stack rules | Copied + `go/` added |
| `.cursor/agents/` — planner, generator, reviewers, doc-updater | Copied |
| `.cursor/skills/` — workflow + stack skills | Copied |
| `.cursor/hooks/` + `hooks.json` | Copied; **wiring fixed** (see below) |
| `.github/` — CI, issue template, PR template | Copied; product `ci.yml` implemented |
| `AGENTS.md`, `GETTING_STARTED.md`, `CHANGELOG.md` | Added |
| `docs/project/*` | Filled from existing README, ADRs, plans, features |
| `docs/guides/workflow-explainer.md` | Copied |

## Preserved (not replaced)

- `docs/features/`, `docs/plans/`, `docs/runbooks/`, `docs/briefings/`
- `docs/adr/001`–`003` (filenames unchanged)
- Application code (`api/`, `web/`, `finbert-api/`, etc.)
- `.cursor/settings.json` (plugin enablement)

## Known problems & gaps

### 1. Template hook filenames vs behavior

In the upstream template, script **filenames do not match** docstrings (`shell-guard.py` implements `sessionStart`, `subagent-stop.py` implements `beforeShellExecution`). This repo’s `.cursor/hooks.json` wires hooks by **actual behavior**, not filename.

### 2. Empty `docs/project/templates/`

The scaffold script references `docs/project/templates/*.md`, but the template checkout had an **empty** `templates/` directory. Product docs were authored directly under `docs/project/`. If you re-scaffold, add templates or copy from a newer template revision.

### 3. No Go profile in upstream template

The template documents manual Python rule copy; **Go is not in the template**. This repo adds `.cursor/rules/go/` locally. Consider contributing a `go-api` profile upstream.

### 4. ADR numbering mismatch

Harness docs prefer `0001-short-title.md`; this repo uses `001-monorepo-stack.md`. **Do not rename** without updating all links—index is in `docs/adr/README.md`.

### 5. Dual workflow documentation

Old pipeline (Understand → Clarify → Assess → Brainstorm → Plan in `docs/plans/`) coexists with harness (GitHub issue → plan → generate → review). **New work** should use the harness; historical plans remain valid archives.

### 6. Plugin skills vs repo skills

`.cursor/settings.json` still enables Superpowers, Compound Engineering, and Cursor Team Kit plugins. Repo-local `.cursor/skills/` duplicate some plugin skills—prefer **repo skills** when paths conflict; plugins remain optional gates (`verification-before-completion`, etc.).

### 7. CI coverage gaps

| Check | CI | Local |
|-------|-----|-------|
| `go test ./...` | Yes | Yes |
| `go vet` | No | Recommended |
| `npm run build` + `lint` | Yes | Yes |
| `npm test` | No — no test script yet | N/A |
| Python FinBERT/xgboost tests | No | When added |
| Postgres migrations in CI | No | Docker dev + migrate |

### 8. MCP configuration

`.cursor/mcp.json` expects `CONTEXT7_API_KEY` and `GITHUB_TOKEN` in `.env`. Verify URLs match your Cursor/MCP versions; adjust if GitHub MCP endpoint differs in your environment.

### 9. `harness.validate.yml` omitted

That workflow is **library-only** (scaffold dry-run) and fails on product repos without template files. Not copied.

### 10. Next.js-specific skills

`nextjs-turbopack` skill was copied with the profile bundle; this app uses **Vite + React Router**. Use `frontend-patterns` / `web/` rules; ignore Next-specific guidance unless migrating stack.

## Recommended follow-ups

1. Open a GitHub issue for first harness-sized task and run planner → generator loop end-to-end.
2. Add `npm test` or Playwright smoke when ready; extend `ci.yml` and `setup.md`.
3. Populate `docs/project/templates/` if you want scaffold parity.
4. Run `continual-learning` to refresh root `AGENTS.md` learned facts for the new layout.
