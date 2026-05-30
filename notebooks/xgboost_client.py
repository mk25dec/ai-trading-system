"""XGBoost inference API client for Jupyter / local scripts.

Set environment variable (or pass base_url):
  XGBOOST_API_URL  e.g. https://xgboost.derisory.nl  (no trailing slash)

Public routes (FastAPI, port 7888 behind Traefik):
  GET  /health   -> {"status": "ok" | "no_model"}
  POST /predict  -> {"features": [float, ...]} -> prediction + probability
"""

from __future__ import annotations

import os
from typing import Any

import requests


class XGBoostError(RuntimeError):
    """XGBoost API returned an error or is unreachable."""


def _base_url(url: str | None) -> str:
    raw = url or os.environ.get("XGBOOST_API_URL", "")
    if not raw:
        raise XGBoostError(
            "Set XGBOOST_API_URL (e.g. https://xgboost.derisory.nl) or pass base_url="
        )
    return raw.rstrip("/")


def _verify_ssl(verify_ssl: bool | None) -> bool:
    if verify_ssl is not None:
        return verify_ssl
    raw = os.environ.get("XGBOOST_VERIFY_SSL", "false").lower()
    return raw in ("1", "true", "yes")


def xgboost_health(
    *,
    base_url: str | None = None,
    timeout: float = 30.0,
    verify_ssl: bool | None = None,
) -> dict[str, str]:
    """GET /health — ``ok`` means a model is loaded; ``no_model`` means the service is up but predict will 503."""
    url = f"{_base_url(base_url)}/health"
    verify_ssl = _verify_ssl(verify_ssl)
    resp = requests.get(url, timeout=timeout, verify=verify_ssl)
    if not resp.ok:
        raise XGBoostError(f"health {resp.status_code}: {resp.text}")
    data = resp.json()
    if not isinstance(data, dict) or "status" not in data:
        raise XGBoostError(f"unexpected health response: {data!r}")
    return {str(k): str(v) for k, v in data.items()}


def xgboost_predict(
    features: list[float],
    *,
    base_url: str | None = None,
    timeout: float = 60.0,
    verify_ssl: bool | None = None,
) -> dict[str, Any]:
    """
    POST /predict with a feature vector matching the deployed model.

    Returns:
        {"prediction": int, "probability": [float, ...]}
    """
    if not features:
        raise ValueError("features must not be empty")

    url = f"{_base_url(base_url)}/predict"
    verify_ssl = _verify_ssl(verify_ssl)
    resp = requests.post(
        url,
        json={"features": features},
        headers={"Content-Type": "application/json"},
        timeout=timeout,
        verify=verify_ssl,
    )
    if resp.status_code == 503:
        detail = resp.json().get("detail", resp.text) if resp.text else "model not loaded"
        raise XGBoostError(f"model not ready (503): {detail}")
    if not resp.ok:
        raise XGBoostError(f"predict {resp.status_code}: {resp.text}")

    data = resp.json()
    if not isinstance(data, dict) or "prediction" not in data:
        raise XGBoostError(f"unexpected predict response: {data!r}")
    return data
