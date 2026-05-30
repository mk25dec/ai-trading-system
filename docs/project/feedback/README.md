# Feedback files

Harness review output for the generator ↔ reviewer loop. See [`.cursor/rules/harness-discipline.mdc`](../../.cursor/rules/harness-discipline.mdc) and [`AGENTS.md`](../../AGENTS.md).

## Layout

**One folder per GitHub issue.** Iteration is in the **filename**, not a subfolder.

```text
docs/project/feedback/
└── 142/                          # Issue #142
    ├── code-review-i1.md
    ├── frontend-eval-i1.md
    ├── generator-response-i1.md
    ├── code-review-i2.md
    ├── security-review-i2.md
    ├── generator-response-i2.md
    └── frontend-eval-i3.md
```

## Naming convention

```text
<reviewer-type>-i<iteration>.md
generator-response-i<iteration>.md
```

| Pattern | Owner | Example |
|---------|-------|---------|
| `code-review-i<n>.md` | code-reviewer subagent | `code-review-i1.md` |
| `api-review-i<n>.md` | api-reviewer subagent | `api-review-i2.md` |
| `mcp-review-i<n>.md` | mcp-reviewer subagent | |
| `database-review-i<n>.md` | database-reviewer subagent | |
| `security-review-i<n>.md` | security-reviewer subagent | |
| `frontend-eval-i<n>.md` | frontend-evaluator subagent | |
| `performance-eval-i<n>.md` | performance-evaluator subagent | |
| `docs-review-i<n>.md` | doc-updater subagent | |
| `generator-response-i<n>.md` | generator subagent | |

- `<n>` in filenames = **iteration** (1, 2, 3 — matches generator round)
- Parent folder = **GitHub issue number**

## Rules

1. **Immutable iterations** — never edit `*-i1.md` when producing `*-i2.md`; add new files.
2. **Reviewer ownership** — only the named subagent writes its file type.
3. **Generator ownership** — only `generator-response-i<n>.md` documents fixes between rounds.
4. **Max 3 iterations** per issue before human triage (see workflow).

## Reading order (next generator round)

For iteration `i+1`, the generator reads all files matching `*-i<i>.md` and `generator-response-i<i>.md` in `feedback/<issue>/`.