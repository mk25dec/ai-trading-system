---
name: git-workflow
description: >-
  GitHub Flow for agent-development — short-lived branches, PR into main, Conventional Commits,
  and practical PR/conflict hygiene. Apply when branching, merging, or drafting PR copy.
disable-model-invocation: true
---

# Git workflow (GitHub Flow only)

This repository standard is **[GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow)**. Alternate models (GitFlow, long-lived `develop`, or heavy trunk rituals) are intentionally omitted here—use upstream docs elsewhere if your org requires them.

## Model

```
main           ← protected, always deployable
feature/foo    ──PR review + CI──► merge to main
fix/bar        ──same
```

1. **`main`** is the integration branch and release line.
2. Create **short-lived** branches off `main` for units of work worth reviewing.
3. Open a **pull request**, get review, merge when CI is green unless policy says otherwise.
4. Ship from **`main`** on your project’s cadence.

## Branch names

Prefer clear prefixes:

- `feature/` — new capability
- `fix/` — bugfixes
- `chore/` or `docs/` — maintenance only when naming helps filtering

Avoid weeks-long branches when you can slice work.

## Commits — Conventional Commits

Use:

```text
<type>(<optional-scope>): <imperative subject, ~50 chars>
```

Common types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, `revert`.

Body paragraphs explain **why** when it is not obvious; footers reference issues (`Closes #123`, `Refs #456`). Align issue ↔ spec references with **`github-issues-workflow`** (rule + skill) when collaborating.

## Staying current with `main`

- **Merged PR from main into your branch** is fine for straightforward updates (`git merge origin/main` on your branch).
- **Rebase** only when the branch is truly local / not depended on by others; never force-push to shared default branches.

## Pull requests

- Title matches commit style (`feat(auth): …`).
- Description: **What**, **Why**, **How**, **Testing** (checklist acceptable).
- Keep PRs **small** and coherent; oversized diffs violate review ergonomics.

## Conflicts

1. Identify with `git status`.
2. Resolve markers in files, run tests/typecheck locally.
3. `git add` resolved paths; complete merge/rebase commit.

Do not blindly take “ours”/`theirs` on files you did not inspect.

## Tags and versioning

Prefer **semver** (`vMAJOR.MINOR.PATCH`) for tagged releases when the project publishes versions.

## Anti-patterns (here)

- Unreviewed pushes directly to **`main`** (unless administrators explicitly exempt hotfixes—and even then prefer fast PR review).
- **Secrets** committed (use env + platform secret stores; never commit `.env`).
- Huge catch-all commits (`fix stuff`, megabyte blobs of unrelated refactor).