# Plan: Auth foundation (Go API + React dashboard)

## Acceptance criteria

- [ ] User can log in with email/password and stay authenticated via session cookie
- [ ] Platform admin can list/create/update/delete users
- [ ] Authenticated users can list/create workspaces they belong to; admins see all
- [ ] Workspace owners/admins can add/remove/update member roles
- [ ] React dashboard: login page, sidebar layout, Users, Workspaces, Workspace members
- [ ] `docker compose up` runs Postgres, API, and web (nginx static)
- [ ] Coolify can deploy from repo compose file

## Definition of done

- [ ] Migrations apply on API startup
- [ ] `.env.example` documents required variables
- [ ] README covers local dev and Coolify deploy
- [ ] API and web Docker images build successfully

## Out of scope

- Trading symbols, signals, Alpaca, DuckDB, n8n workflows
- OAuth / SSO
- Email verification, password reset
- Redis, Kubernetes

## Feature doc

Update `docs/features/001-auth-foundation.md` after implementation.
