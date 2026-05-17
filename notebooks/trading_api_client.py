"""Trading API client for Jupyter / scripts (session cookie auth)."""

from __future__ import annotations

import os
from typing import Any

import requests


class TradingAPIError(RuntimeError):
    pass


def _base_url(url: str | None) -> str:
    raw = url or os.environ.get("TRADING_API_URL", "https://trading.derisory.nl")
    return raw.rstrip("/")


def login(
    email: str,
    password: str,
    *,
    base_url: str | None = None,
    session: requests.Session | None = None,
    timeout: float = 30.0,
) -> requests.Session:
    """Authenticate; returns a session with HttpOnly cookie for later calls."""
    sess = session or requests.Session()
    base = _base_url(base_url)
    r = sess.post(
        f"{base}/api/v1/auth/login",
        json={"email": email, "password": password},
        timeout=timeout,
    )
    if not r.ok:
        raise TradingAPIError(f"login {r.status_code}: {r.text}")
    return sess


def health(*, base_url: str | None = None, session: requests.Session | None = None, timeout: float = 30.0) -> dict[str, str]:
    """GET /health — public, includes postgres + duckdb readiness."""
    sess = session or requests.Session()
    r = sess.get(f"{_base_url(base_url)}/health", timeout=timeout)
    if not r.ok:
        raise TradingAPIError(f"health {r.status_code}: {r.text}")
    return r.json()


def analytics_status(
    *,
    base_url: str | None = None,
    session: requests.Session | None = None,
    timeout: float = 30.0,
) -> dict[str, Any]:
    """GET /api/v1/analytics/status — requires login session."""
    sess = session or requests.Session()
    r = sess.get(f"{_base_url(base_url)}/api/v1/analytics/status", timeout=timeout)
    if not r.ok:
        raise TradingAPIError(f"analytics/status {r.status_code}: {r.text}")
    return r.json()
