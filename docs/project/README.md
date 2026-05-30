# Project harness docs

Durable artefacts for Cursor Agent development on **AI Trading System**. See [`AGENTS.md`](../../AGENTS.md) and [`.cursor/rules/harness-artifacts.mdc`](../../.cursor/rules/harness-artifacts.mdc).

## File roles

| Path | When | Owner |
|------|------|-------|
| `project.md` | Product truth | planner / human |
| `roadmap.md` | **Update every issue close** | planner / generator |
| `eval-rubric.md` | Global quality bar | planner |
| `setup.md` | CI commands — source of truth | human / generator |
| `generator-state.md` | Ongoing | generator |
| `issues/<n>/spec.md` | Per issue | planner |
| `issues/<n>/rubric.md` | Per issue | planner |
| `feedback/<n>/*-i<m>.md` | Review iterations | reviewer subagents |

## Related documentation

| Path | Role |
|------|------|
| [`docs/features/`](../features/) | Shipped feature behaviour |
| [`docs/plans/`](../plans/) | Sprint / implementation plans |
| [`docs/runbooks/`](../runbooks/) | Deploy and operations |
| [`docs/adr/`](../adr/) | Architecture decisions |
| [`docs/guides/workflow-explainer.md`](../guides/workflow-explainer.md) | Human harness FAQ |

## Harness (always)

Every change: **GitHub issue → plan → generate → review** (even S-sized). See [`GETTING_STARTED.md`](../../GETTING_STARTED.md).
