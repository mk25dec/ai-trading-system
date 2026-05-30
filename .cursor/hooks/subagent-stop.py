#!/usr/bin/env python3
"""
beforeShellExecution: gate risky shell commands and nudge on long-running dev commands.

Reads JSON stdin (see https://cursor.com/docs/hooks — fields include `command`, `cwd`).
Writes a single JSON object to stdout: permission allow | ask | deny.
Fails open on parse errors (allows the command).
"""
from __future__ import annotations

import json
import re
import sys


def _allow(agent_message: str | None = None) -> None:
    out: dict = {"permission": "allow"}
    if agent_message:
        out["agent_message"] = agent_message
    print(json.dumps(out))
    sys.exit(0)


def _ask(user_message: str, agent_message: str) -> None:
    print(
        json.dumps(
            {
                "permission": "ask",
                "user_message": user_message,
                "agent_message": agent_message,
            }
        )
    )
    sys.exit(0)


def _deny(agent_message: str, user_message: str | None = None) -> None:
    print(
        json.dumps(
            {
                "permission": "deny",
                "agent_message": agent_message,
                "user_message": user_message or agent_message,
            }
        )
    )
    sys.exit(0)


def main() -> None:
    try:
        raw = sys.stdin.read()
        data = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError:
        _allow()

    cmd = (data.get("command") or "").strip()
    if not cmd:
        _allow()

    # --- Deny: obvious filesystem root wipes ---------------------------------
    if re.search(r"\brm\b", cmd):
        has_rf = bool(
            re.search(r"(?:^|\s)-(?:[^\s]*[rf][^\s]*|-[^\s]*rf|-[^\s]*fr)\b", cmd)
            or re.search(r"(?:^|\s)-r\s+\S*\s+-f\b", cmd)
            or re.search(r"(?:^|\s)-f\s+\S*\s+-r\b", cmd)
        )
        if has_rf or "--recursive" in cmd:
            if re.search(r"(?:^|\s)/\s*(?:#|$)", cmd) or re.search(
                r"(?:^|\s)/\*\s*(?:#|$)", cmd
            ):
                _deny(
                    "Blocked: recursive delete targeting `/` or `/*` is never allowed from the agent shell.",
                )
            if "--no-preserve-root" in cmd:
                _deny(
                    "Blocked: rm with --no-preserve-root is not allowed from the agent shell.",
                )

    # --- Ask: outbound network via common CLIs --------------------------------
    if re.search(r"(?<!['\"])\b(?:curl|wget)\b", cmd):
        _ask(
            "This shell command may perform a network request. Approve only if the URL and flags are expected.",
            "User must approve this command: it may access the network (curl/wget).",
        )

    # --- Deny: force push to main/master -------------------------------------
    if re.search(r"(?:^|\s)git\s+push\b", cmd):
        if re.search(r"--force|-f\b", cmd) and re.search(
            r"\b(?:origin\s+)?(?:HEAD\s*:\s*)?(?:main|master)\b", cmd
        ):
            _deny(
                "Blocked: force push to main/master is not allowed from the agent shell.",
            )

    # --- Ask: push to main or any push ---------------------------------------
    if re.search(r"(?:^|\s)git\s+push\b", cmd):
        if re.search(r"\b(?:origin\s+)?(?:HEAD\s*:\s*)?main\b", cmd):
            _ask(
                "git push to main was requested. Confirm CI green and human approval.",
                "User must approve git push to main — verify branch, CI, and review closure.",
            )
        else:
            _ask(
                "git push was requested. Confirm the branch and remote before pushing.",
                "User should confirm this git push (branch/remote/CI) before it runs.",
            )

    # --- Nudge: long-running test / build commands -----------------------------
    if re.search(
        r"\bpytest\b|\bcargo\s+test\b|(?:^|\s)(?:npm|pnpm|yarn)\s+(?:test|run)\s",
        cmd,
    ):
        _allow(
            "Long-running shell command. Prefer a persistent terminal (e.g. tmux) if you need to detach; watch for streaming output and timeouts."
        )

    _allow()


if __name__ == "__main__":
    main()