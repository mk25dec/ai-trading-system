"""Fetch daily OHLCV bars from Alpaca (matches api/internal/services/alpaca.go)."""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any

import pandas as pd
import requests


class AlpacaError(RuntimeError):
    pass


def _credentials() -> tuple[str, str, str, str]:
    key = os.environ.get("ALPACA_API_KEY", "").strip()
    secret = os.environ.get("ALPACA_API_SECRET", "").strip()
    if not key or not secret:
        raise AlpacaError("Set ALPACA_API_KEY and ALPACA_API_SECRET in .env")
    data_url = os.environ.get("ALPACA_DATA_URL", "https://data.alpaca.markets/v2").rstrip("/")
    feed = os.environ.get("ALPACA_DATA_FEED", "iex").strip() or "iex"
    return key, secret, data_url, feed


def fetch_daily_bars(
    symbol: str,
    *,
    days: int = 365,
    end: datetime | None = None,
    timeout: float = 90.0,
) -> pd.DataFrame:
    """
    Return daily bars as a DataFrame indexed by date (UTC midnight).

    Columns: open, high, low, close, volume
    """
    key, secret, data_url, feed = _credentials()
    end_dt = end or datetime.now(timezone.utc)
    start_dt = end_dt - timedelta(days=days)

    params: dict[str, Any] = {
        "symbols": symbol.upper(),
        "timeframe": "1Day",
        "start": start_dt.isoformat(),
        "end": end_dt.isoformat(),
        "limit": 10000,
        "adjustment": "split",
        "feed": feed,
        "sort": "asc",
    }

    headers = {
        "APCA-API-KEY-ID": key,
        "APCA-API-SECRET-KEY": secret,
    }

    rows: list[dict[str, Any]] = []
    page_token = ""

    for _ in range(50):
        q = dict(params)
        if page_token:
            q["page_token"] = page_token

        resp = requests.get(
            f"{data_url}/stocks/bars",
            params=q,
            headers=headers,
            timeout=timeout,
        )
        if not resp.ok:
            msg = resp.text.strip()
            if resp.status_code == 403 and feed == "sip":
                raise AlpacaError(
                    f"alpaca bars 403 (SIP requires paid plan; set ALPACA_DATA_FEED=iex): {msg}"
                )
            raise AlpacaError(f"alpaca bars {resp.status_code}: {msg}")

        payload = resp.json()
        bars_map = payload.get("bars") or {}
        sym_bars = bars_map.get(symbol.upper()) or []
        for bar in sym_bars:
            ts = pd.Timestamp(bar["t"]).tz_convert("UTC").normalize()
            rows.append(
                {
                    "date": ts,
                    "open": float(bar["o"]),
                    "high": float(bar["h"]),
                    "low": float(bar["l"]),
                    "close": float(bar["c"]),
                    "volume": int(bar["v"]),
                }
            )

        page_token = payload.get("next_page_token") or ""
        if not page_token:
            break

    if not rows:
        raise AlpacaError(f"no bars returned for {symbol}")

    df = pd.DataFrame(rows).set_index("date").sort_index()
    return df[~df.index.duplicated(keep="last")]
