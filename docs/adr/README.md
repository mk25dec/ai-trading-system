# Architecture Decision Records

Significant technical choices: **context, decision, alternatives, consequences**.

- **Workflow:** [`.cursor/rules/lifecycle-change.mdc`](../../.cursor/rules/lifecycle-change.mdc)
- **Template:** [`template.md`](template.md)
- **Skill:** [`.cursor/skills/architecture-decision-records/SKILL.md`](../../.cursor/skills/architecture-decision-records/SKILL.md)
- **Product summary:** [`docs/project/project.md`](../project/project.md)

## Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [001](001-monorepo-stack.md) | Monorepo stack and deployment | Accepted | 2026 |
| [002](002-auth-and-tenancy.md) | Auth and tenancy | Accepted | 2026 |
| [003](003-duckdb-analytics-storage.md) | DuckDB analytics storage | Accepted | 2026 |

> **Note:** This repo uses `00N-slug.md` numbering. New ADRs may use harness-style `000N-slug.md` if you adopt four-digit convention—do not renumber existing files without updating all links.

## Lifecycle

```text
proposed → accepted → deprecated | superseded by ADR-NNNN
```

| Status | Implementation |
|--------|----------------|
| **proposed** | Do not treat as binding |
| **accepted** | Generator and reviewers must comply |
| **deprecated** | Historical only |
| **superseded** | See linked replacement ADR |
