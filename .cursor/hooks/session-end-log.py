#!/usr/bin/env python3
"""
sessionEnd: append lightweight JSON lines for local auditing (ignored by git).
Response body is unused by Cursor but stdout should still be valid / empty-safe.
"""
from __future__ import annotations

import datetime
import json
import sys
from pathlib import Path

LOG_REL = Path(__file__).resolve().parent / "logs" / "session.log"


def main() -> None:
    try:
        raw = sys.stdin.read()
        data = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError:
        print("{}")
        return

    LOG_REL.parent.mkdir(parents=True, exist_ok=True)
    record = {
        "ts": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "session_id": data.get("session_id"),
        "reason": data.get("reason"),
        "duration_ms": data.get("duration_ms"),
    }
    with LOG_REL.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(record, ensure_ascii=False) + "\n")

    print("{}")


if __name__ == "__main__":
    main()