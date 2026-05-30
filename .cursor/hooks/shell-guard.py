#!/usr/bin/env python3
"""
sessionStart: one-line harness bootstrap for parent agent orchestration.
"""
from __future__ import annotations

import json
import sys


def main() -> None:
    msg = (
        "AI Trading System harness: parent orchestrates plan → generator → reviewers (max 3 generator rounds); "
        "doc-updater runs last. Read AGENTS.md and .cursor/rules/orchestration.mdc before implementing."
    )
    print(json.dumps({"additional_context": msg}))


if __name__ == "__main__":
    main()