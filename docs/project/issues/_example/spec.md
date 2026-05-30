# Example issue spec — #142: Password reset flow

> **Example only** — copy [`templates/issue-spec-subtask.md`](../../templates/issue-spec-subtask.md) for real issues.

## Summary

Users can request a password reset email, follow a signed link, set a new password, and sign in.

## Related ADRs

- None for this example

## Spec references

- [`project.md`](../../project.md) — Auth / account recovery
- [`roadmap.md`](../../roadmap.md) — Phase 1 / account security

## Acceptance criteria

- [ ] Request reset with valid email sends message (or generic success to prevent enumeration)
- [ ] Valid token allows password change; expired token shows clear error
- [ ] Weak password rejected with validation message
- [ ] User can sign in with new password

## Out of scope

- MFA enrollment
- Admin-initiated password reset

## File impact (indicative)

- `src/app/**` auth routes
- `src/app/api/**` reset endpoints
- Tests for happy path + expired token