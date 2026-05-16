# Agent Memory

Maintained by the `continual-learning` plugin. Manual edits are welcome — the plugin merges, not overwrites.

## Learned User Preferences

- (none yet — preferences will be extracted from conversation history)

## Learned Workspace Facts

- Project uses `.cursor/rules/` for process and quality standards (project-independent)
- All rules are project-agnostic — no language, framework, or regulation specifics live in rules
- Architectural, testing, and technology decisions are recorded in `docs/adr/`
- Implementation plans live in `docs/plans/` and must be approved before coding begins
- Feature documentation lives in `docs/features/` and is created/updated after every completed feature
- Operational runbooks live in `docs/runbooks/`
- `docs/README.md` is the central guide to the docs folder structure and conventions
- The mandatory workflow pipeline is: Understand > Clarify > Assess > Brainstorm > Plan > Execute > Verify and Document
- The Assess step (impact analysis, risk assessment, scope boundary) is required before brainstorming
- Post-task docs review is a hard gate — completion cannot be claimed without it
- Mandatory plugin gates before completion: `verification-before-completion`, `deslop`, `check-compiler-errors`
- `context7-plugin` is used proactively for any library/framework/API, not just unfamiliar ones
- `continual-learning` triggers after completing feature-level tasks
