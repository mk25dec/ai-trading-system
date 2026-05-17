"""FinBERT API client for Jupyter / local scripts.

Set environment variables (or pass arguments):
  FINBERT_API_URL  e.g. https://<your-finbert-host>  (no trailing slash)
  FINBERT_API_KEY  same key as on the finbert-api Coolify app

On the same Docker network as finbert-api you can use:
  http://<finbert-container-name>:8000
"""

from __future__ import annotations

import os
from typing import Any

import requests


class FinBERTError(RuntimeError):
    """FinBERT API returned an error or unreachable."""


def _base_url(url: str | None) -> str:
    raw = url or os.environ.get("FINBERT_API_URL", "")
    if not raw:
        raise FinBERTError(
            "Set FINBERT_API_URL (e.g. https://your-finbert.coolify.app) or pass base_url="
        )
    return raw.rstrip("/")


def _api_key(key: str | None) -> str | None:
    return key if key is not None else os.environ.get("FINBERT_API_KEY") or None


def _headers(api_key: str | None) -> dict[str, str]:
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if api_key:
        headers["X-Api-Key"] = api_key
    return headers


def finbert_health(
    *,
    base_url: str | None = None,
    api_key: str | None = None,
    timeout: float = 30.0,
) -> dict[str, str]:
    """GET /health — wait until status is 'ok' before calling analyze."""
    url = f"{_base_url(base_url)}/health"
    resp = requests.get(url, headers=_headers(_api_key(api_key)), timeout=timeout)
    if not resp.ok:
        raise FinBERTError(f"health {resp.status_code}: {resp.text}")
    data = resp.json()
    if not isinstance(data, dict):
        raise FinBERTError(f"unexpected health response: {data!r}")
    return {str(k): str(v) for k, v in data.items()}


def finbert_analyze(
    text: str,
    *,
    base_url: str | None = None,
    api_key: str | None = None,
    timeout: float = 120.0,
) -> dict[str, Any]:
    """
    Run sentiment on one text snippet.

    Returns:
        {"label": "positive"|"negative"|"neutral", "scores": {"positive": 0.9, ...}}

    Example:
        >>> finbert_analyze("Apple beats earnings expectations")
        {'label': 'positive', 'scores': {...}}
    """
    stripped = text.strip()
    if not stripped:
        raise ValueError("text must not be empty")

    url = f"{_base_url(base_url)}/analyze"
    resp = requests.post(
        url,
        json={"text": stripped},
        headers=_headers(_api_key(api_key)),
        timeout=timeout,
    )
    if resp.status_code == 503:
        raise FinBERTError(
            "model still loading (503). Call finbert_health() until status is 'ok', then retry."
        )
    if not resp.ok:
        raise FinBERTError(f"analyze {resp.status_code}: {resp.text}")

    data = resp.json()
    if not isinstance(data, dict) or "label" not in data or "scores" not in data:
        raise FinBERTError(f"unexpected analyze response: {data!r}")
    return data


def finbert_analyze_many(
    texts: list[str],
    *,
    base_url: str | None = None,
    api_key: str | None = None,
    timeout: float = 120.0,
) -> list[dict[str, Any]]:
    """Analyze multiple strings sequentially (simple helper for notebooks)."""
    return [
        finbert_analyze(t, base_url=base_url, api_key=api_key, timeout=timeout) for t in texts
    ]
