---
name: subagent-driven-development
description: Parent agent orchestrates planner → generator → reviewers. Use for every issue closure.
---

# Subagent-Driven Development

Parent agent (main chat) owns the harness loop. Subagents do **one role** per `Task` invocation.

## Loop

1. Size confirm (S/M/L/XL)
2. `Task(planner)` → spec + rubric
3. `Task(generator)` → code + handoff
4. `Task(reviewers)` **in parallel** (from rubric, except doc-updater)
5. Consolidate blockers
6. Repeat generator if ≤3 rounds
7. `Task(doc-updater)` after all PASS
8. Testing gate → PR

## Rules

- Never nest full closure inside one generator run
- Never let generator self-approve
- Max 3 generator rounds → human triage

Enforced by `.cursor/rules/orchestration.mdc`.