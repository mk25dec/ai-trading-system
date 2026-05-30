---
name: verification-before-completion
description: Run setup.md CI commands and rubric checks before claiming done or opening PR.
---

# Verification Before Completion

No "done" without evidence.

## Before PR

Run all **required** commands from `docs/project/setup.md`:

- typecheck, lint, test, build (as configured)
- e2e / db migrate when in profile

## Before merge-ready claim

- Required reviewer files show PASS in `docs/project/feedback/<n>/`
- No open CRITICAL/HIGH blockers
- Human sign-off on must-pass flows when UI (issue rubric)
- S issue: `CHANGELOG.md` updated

## Generator

List commands actually run in `generator-response-i<i>.md` and reviewer handoff.