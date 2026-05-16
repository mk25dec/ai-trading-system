# Feature 001: Auth foundation

## Status

Implemented (2026-05-16)

## Summary

Platform login, user management, workspaces, and workspace membership — the control-plane foundation before trading features.

## Behavior

### Authentication

- Email/password login; session stored in HttpOnly JWT cookie (`session`)
- Bootstrap: if no users exist on API startup, creates platform admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD`
- Logout clears the session cookie

### Authorization

| Action | Who |
|--------|-----|
| Manage all users | Platform `admin` |
| List user lookup (id, email, name) | Any authenticated user |
| Create workspace | Any authenticated user (becomes `owner`) |
| List workspaces | Members see theirs; platform admin sees all |
| Manage workspace settings/members | Workspace `owner` or `admin`; platform admin |

### Dashboard

- Login page
- Sidebar layout: Overview, Workspaces, Users (admin)
- Workspace member management per workspace

## Deployment

- `docker-compose.yml`: `postgres`, `api`, `web` (nginx + static React build)
- `web` proxies `/api` and `/health` to `api` for same-origin cookies

## Related docs

- [ADR 001: Monorepo stack](../adr/001-monorepo-stack.md)
- [ADR 002: Auth and tenancy](../adr/002-auth-and-tenancy.md)
- [Coolify runbook](../runbooks/coolify-deploy.md)

## Not included

OAuth, password reset, trading data, DuckDB, Alpaca, n8n
