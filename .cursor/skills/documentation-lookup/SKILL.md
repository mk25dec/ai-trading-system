---
name: documentation-lookup
description: Fetch current library docs via Context7 MCP. Use for setup, API references, and framework questions before coding.
---

# Documentation Lookup (Context7)

Use Context7 MCP (`resolve-library-id`, `query-docs`) instead of training data for libraries and APIs.

## When to use

- Setup or configuration questions
- Code depending on a library version
- API reference lookups
- User names a framework (React, Next.js, FastAPI, MCP SDK, etc.)

## Steps

1. **resolve-library-id** — libraryName + user's question
2. Pick best match (official, high benchmark score, version if specified)
3. **query-docs** — libraryId + specific question (max 3 calls per question)
4. Answer with current docs; cite version when relevant

## agent-development note

Complements **mcp-reviewer** subagent — Context7 is for **vendor docs**, not MCP product review.