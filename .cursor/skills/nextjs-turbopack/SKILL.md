---
name: github-issues-workflow
description: >-
  Split project.md and roadmap into GitHub Issues (assignable slices), link PR/commits,
  use epics/milestones, avoid doc/issue drift—use after planning or backlog grooming.
disable-model-invocation: true
---

# GitHub Issues workflow

Use when **translating product docs into parallelizable work**, **onboarding collaborators** (“clone + Issues = context”), or **grooming backlog** with the planner harness.

## Mental model

| Artefact | Role |
|----------|------|
| **`docs/project/project.md`** | Product truth: vision, lifecycle, delivery |
| **`docs/project/roadmap.md`** | Phases, ordering, epic intent |
| **`docs/project/issues/<n>/spec.md`** | Per-issue scope (planner, Phase 1) |
| **`docs/project/issues/<n>/rubric.md`** | Per-issue done-criteria and reviewers |
| **GitHub Issues** | Assignee, size, links, discussion |
| **PRs** | Delivery: `Closes` / `Refs #n` |

Behavioral truth: issue specs + tests + merged code. Issues hold **execution metadata** only.

## How to split work into Issues

### Sizing

Prefer **hours to ~two days** per issue when practical. **Epic** = multi-sprint outcome + linked children. **Spike** = `spike:` prefix when discovery may not ship product.

### Per-issue body template

Use [`docs/project/templates/github-issue.md`](../../docs/project/templates/github-issue.md) or:

```markdown
## Spec reference

- **Project:** [`docs/project/project.md`](docs/project/project.md) — _section_
- **Roadmap:** [`docs/project/roadmap.md`](docs/project/roadmap.md) — Phase _N_ / subtask
- **Issue spec:** `docs/project/issues/NNN/spec.md` _(after Phase 1)_
- **Rubric:** `docs/project/issues/NNN/rubric.md`

## Size

S / M / L / XL — _agent proposed, human confirmed_

## Acceptance criteria

- [ ] _Testable criterion_
- [ ] CI green per [`docs/project/setup.md`](docs/project/setup.md)
- [ ] plan → generate → review; no open CRITICAL/HIGH in `docs/project/feedback/NNN/`
- [ ] **frontend-evaluator** PASS when issue rubric lists UI flows

## Related ADRs

- [ADR-0001](docs/adr/0001-example.md) — _or none_
```

### Harness alignment

Parent orchestrates: **planner → generator → reviewers** (see **subagent-driven-development** skill).

1. Record **issue number** in **`generator-state.md`**.
2. Feedback lives in **`docs/project/feedback/<n>/*-i<m>.md`** (not issue comments only).
3. Paste **blocker summaries** on the GitHub issue when the team needs visibility.

## Grooming checklist (planner session end)

- [ ] Roadmap subtasks map to issues (or epic + children).
- [ ] Every issue links **project.md** + **roadmap** + **issues/<n>/spec** when M+.
- [ ] No orphaned issues—or mark `needs-spec`.
- [ ] **`eval-rubric.md`** changes reflected in rubrics or issue comments.

## Integration

- **git-workflow** — PR footers, GitHub Flow.
- **product-capability** — optional PRD before issue blast.
- **orchestration.mdc** — plan → generate → review loop.

## Anti-patterns

- Issues and `project.md` diverging for months without updates.
- One issue owning unrelated streams—split.
- Closing without **`Closes #n`** in PR or explicit merge comment.