# agent-development skills library

On-demand playbooks. Rules stay short; agents invoke skills for depth.

## Core workflow (all profiles)

| Skill | Use when |
|-------|----------|
| [subagent-driven-development](subagent-driven-development/SKILL.md) | Parent orchestrating plan → generate → review |
| [test-driven-development](test-driven-development/SKILL.md) | Generator implementing behavior |
| [verification-before-completion](verification-before-completion/SKILL.md) | Before PR or merge-ready claim |
| [receiving-code-review](receiving-code-review/SKILL.md) | Generator processing feedback |
| [systematic-debugging](systematic-debugging/SKILL.md) | Hard bugs, flaky tests |
| [architecture-decision-records](architecture-decision-records/SKILL.md) | ADR drafts and capture |
| [git-workflow](git-workflow/SKILL.md) | Branching, PR, GitHub Flow |
| [github-issues-workflow](github-issues-workflow/SKILL.md) | Issue/PR linkage |
| [documentation-lookup](documentation-lookup/SKILL.md) | Context7 library docs |
| [mcp-server-patterns](mcp-server-patterns/SKILL.md) | Building MCP servers |

## Stack skills (profile-gated)

| Skill | Profile |
|-------|---------|
| api-design, frontend-patterns, nextjs-turbopack | nextjs-app |
| postgres-patterns, database-migrations | nextjs-app |
| security-review | nextjs-app, mcp-server |
| coding-standards, backend-patterns | optional |

**Python / FastAPI:** `fastapi-patterns`, `python-patterns`, `python-testing` and `.cursor/rules/python/` exist; no `fastapi-api` profile YAML yet — copy manually (see [`GETTING_STARTED.md`](../../GETTING_STARTED.md)).

## Excluded

- blueprint (use roadmap + issues + ADRs)
- Domain-specific optional skills (investor, defi, etc.) — not in agent-development library

Profiles: `docs/profiles/*.yaml`