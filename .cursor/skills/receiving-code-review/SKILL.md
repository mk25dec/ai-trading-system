---
name: receiving-code-review
description: Generator applies reviewer feedback without arguing. Read feedback files; fix or document why not.
---

# Receiving Code Review

For **generator** when processing `docs/project/feedback/<n>/` files.

## Process

1. Read **all** `*-i<current>.md` reviewer files for this iteration
2. Treat CRITICAL/HIGH and frontend-evaluator FAIL as **required**
3. Fix or document in `generator-response-i<i>.md` why not fixed
4. Do **not** edit reviewer-owned files
5. Do **not** re-run reviewers yourself — parent orchestrates next round

## Tone

Feedback is input, not debate. If reviewer wrong, note in generator-response with evidence; parent may re-invoke reviewer.

## Skills

After fixes, run **verification-before-completion** before handoff.