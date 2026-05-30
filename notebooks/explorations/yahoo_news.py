"""Yahoo Finance news via yfinance (headlines + publish time)."""

from __future__ import annotations

import re

import pandas as pd
import yfinance as yf

_NVDA_PATTERN = re.compile(r"\b(nvidia|nvda)\b", re.IGNORECASE)


def fetch_yahoo_news(
    symbol: str,
    *,
    max_items: int = 200,
    symbol_filter: bool = True,
) -> pd.DataFrame:
    """
    Fetch recent Yahoo Finance news for *symbol*.

    Returns DataFrame: published_at (UTC), title, link, publisher, type
    """
    ticker = yf.Ticker(symbol.upper())
    raw = ticker.news or []

    rows: list[dict] = []
    for item in raw[:max_items]:
        content = item.get("content") or {}
        title = (content.get("title") or item.get("title") or "").strip()
        link = content.get("canonicalUrl") or content.get("clickThroughUrl") or item.get("link") or ""
        provider = content.get("provider") or {}
        publisher = provider.get("displayName") or item.get("publisher") or ""

        pub_raw = content.get("pubDate") or item.get("providerPublishTime")
        if pub_raw is None:
            continue

        if isinstance(pub_raw, (int, float)):
            published_at = pd.Timestamp(pub_raw, unit="s", tz="UTC")
        else:
            published_at = pd.Timestamp(pub_raw).tz_convert("UTC")

        if symbol_filter and title and not _NVDA_PATTERN.search(title):
            # Keep articles that mention the company/ticker in the headline.
            continue

        rows.append(
            {
                "published_at": published_at,
                "title": title,
                "link": link,
                "publisher": publisher,
                "type": item.get("type") or content.get("contentType") or "story",
            }
        )

    if not rows:
        return pd.DataFrame(columns=["published_at", "title", "link", "publisher", "type"])

    df = pd.DataFrame(rows).sort_values("published_at").reset_index(drop=True)
    return df


def news_for_trading_day(
    news: pd.DataFrame,
    day: pd.Timestamp,
    *,
    lookback_hours: int = 24,
) -> pd.DataFrame:
    """Articles published in (day - lookback, day] window."""
    if news.empty:
        return news
    day_end = pd.Timestamp(day).tz_convert("UTC") + pd.Timedelta(days=1) - pd.Timedelta(seconds=1)
    day_start = day_end - pd.Timedelta(hours=lookback_hours)
    mask = (news["published_at"] > day_start) & (news["published_at"] <= day_end)
    return news.loc[mask].copy()
