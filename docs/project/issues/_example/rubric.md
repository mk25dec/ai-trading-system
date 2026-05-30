# Example issue rubric — #142: Password reset flow

> **Example only** — copy [`templates/issue-rubric-subtask.md`](../../templates/issue-rubric-subtask.md) for real issues.  
> **Extends** [`docs/project/eval-rubric.md`](../../eval-rubric.md).

---

## Required reviewer subagents

- [x] **code-reviewer**
- [x] **api-reviewer**
- [x] **security-reviewer**
- [x] **frontend-evaluator**
- [ ] **database-reviewer** — no schema change
- [ ] **performance-evaluator**

---

## Must-pass flows (this issue)

| ID | Flow | Evidence |
|----|------|----------|
| I1 | Request reset → email sent → link works → new password → login | Playwright `password-reset.spec.ts` |
| I2 | Global G2 still passes after implementation | Manual: sign out from settings |

---

## Must-test edge cases (this issue)

| ID | Case | Expected |
|----|------|----------|
| X1 | Expired reset token | Clear error; link to request again |
| X2 | Weak new password | Validation message; no update |
| X3 | Global E2 | Unauthenticated `/settings` → redirect |