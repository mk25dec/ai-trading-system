---
name: test-driven-development
description: RED-GREEN-REFACTOR for generator work. Use before implementing behavior in issues.
---

# Test-Driven Development

Mandatory for **generator** subagent when behavior is testable.

## Cycle

1. **RED** — failing test for desired behavior
2. **VERIFY FAIL** — run `docs/project/setup.md` test command; fail for right reason
3. **GREEN** — minimal implementation
4. **VERIFY PASS** — all relevant tests green
5. **REFACTOR** — clean up; tests stay green

## Scope

| Layer | When |
|-------|------|
| Unit | Default for pure logic |
| Integration | HTTP handlers, DB boundaries |
| E2E | Critical journeys in issue rubric |

## Anti-patterns

- Skip tests on "small" M issues — rubric decides
- Encode implementation details instead of observable behavior
- Change tests to green without fixing root cause

Commands: read from `docs/project/setup.md`, never assume npm vs pnpm vs pytest.