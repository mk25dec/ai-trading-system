# Changelog

All notable changes to this project are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Cursor **agent-development** harness: rules, subagents, skills, hooks, `AGENTS.md`, `GETTING_STARTED.md`
- `docs/project/` harness docs (`project.md`, `roadmap.md`, `setup.md`, `eval-rubric.md`)
- `.github/workflows/ci.yml` — Go tests + web build/lint
- `.github/ISSUE_TEMPLATE/feature.yml` and PR template
- `.cursor/rules/go/` for Go API conventions
- `docs/guides/workflow-explainer.md` and `docs/HARNESS_MIGRATION.md`

### Changed

- Replaced legacy `.cursor/rules/00–09-*.mdc` with template orchestration and stack rules
- `docs/adr/README.md` aligned with harness ADR workflow

### Removed

- Legacy numbered workflow rules (`00-workflow` through `09-git-hygiene`) — superseded by harness rules + skills

## [Prior work]

Features and ADRs before harness migration are recorded in:

- `docs/features/001`–`007`
- `docs/adr/001`–`003`
- `docs/plans/` and `docs/runbooks/`
