# ADR 002: Authentication and tenancy model

## Status

Accepted

## Context

The dashboard needs login, platform user management, workspaces, and per-workspace membership before trading features.

## Decision

### Authentication

- Email + password with bcrypt
- JWT stored in HttpOnly, `SameSite=Lax` cookie (`session`)
- `GET /api/v1/auth/me` returns current user

### Roles

| Scope | Roles |
|-------|--------|
| Platform | `admin`, `user` |
| Workspace | `owner`, `admin`, `member` |

- Platform `admin`: manage all users and workspaces
- Workspace `owner`/`admin`: manage members in that workspace
- Workspace `member`: read workspace context only

### Bootstrap

- On API startup, if no users exist, create one platform admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD`

### API prefix

All JSON routes under `/api/v1` except `GET /health`

## Consequences

- Cookie-based auth works with same-site dashboard deployment
- Workspace isolation enforced in handlers via membership checks
- Trading features will scope data by `workspace_id` in later milestones
