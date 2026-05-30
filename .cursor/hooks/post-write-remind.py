#!/usr/bin/env python3
"""
postToolUse (Write | StrReplace): reminders for code quality and harness paths.
"""
from __future__ import annotations

import json
import sys
from typing import Any

CODE_SUFFIXES = (
    ".py",
    ".pyi",
    ".go",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".vue",
    ".svelte",
    ".mdc",
)

HARNESS_PREFIXES = (
    "docs/project/",
    "db/migrations/",
    "docs/adr/",
)

ENV_MARKERS = (".env", ".env.local", ".env.example")


def _coerce_tool_input(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str) and raw.strip():
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}


def _extract_path(tool_input: dict[str, Any]) -> str | None:
    for key in ("file_path", "path", "target_file", "file", "filepath"):
        val = tool_input.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
    return None


def _harness_message(path: str) -> str | None:
    norm = path.replace("\\", "/")
    base = norm.rsplit("/", 1)[-1]

    if any(norm.startswith(p) for p in HARNESS_PREFIXES):
        return (
            "Harness path edited: update docs/project/generator-state.md before PR-ready handoff; "
            "run docs/project/setup.md CI commands; for migrations run db:test:migrate when Docker is available."
        )

    if any(marker in base for marker in ENV_MARKERS):
        return (
            "Env file touched: never commit secrets; mirror new vars in .env.example with placeholders only."
        )

    return None


def _code_message(path: str) -> str | None:
    base = path.rsplit("/", 1)[-1]
    if not base or "." not in base:
        return None
    suffix = "." + base.rsplit(".", 1)[-1].lower()
    if suffix not in CODE_SUFFIXES:
        return None
    return (
        "After substantive edits run formatter/linter/typecheck from docs/project/setup.md when tooling exists — "
        "see .cursor/rules/go/hooks.mdc, typescript/hooks.mdc, python/hooks.mdc, web/hooks.mdc; keep CI green."
    )


def main() -> None:
    try:
        raw = sys.stdin.read()
        data = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError:
        print("{}")
        return

    ti = _coerce_tool_input(data.get("tool_input"))
    path = _extract_path(ti)
    if not path:
        print("{}")
        return

    msg = _harness_message(path) or _code_message(path)
    if not msg:
        print("{}")
        return

    print(json.dumps({"additional_context": msg}))


if __name__ == "__main__":
    main()