"""Technical features aligned with api/internal/services/decision_engine.go."""

from __future__ import annotations

import numpy as np
import pandas as pd


def _rsi(close: pd.Series, period: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0).rolling(period).mean()
    loss = (-delta.clip(upper=0)).rolling(period).mean()
    rs = gain / loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))


def add_technical_features(bars: pd.DataFrame) -> pd.DataFrame:
    """Add columns used by the Go decision engine and XGBoost."""
    out = bars.copy()
    close = out["close"]
    vol = out["volume"].astype(float)

    out["return_1d"] = close.pct_change() * 100
    out["return_5d"] = close.pct_change(5) * 100
    out["sma20"] = close.rolling(20).mean()
    out["sma50"] = close.rolling(50).mean()
    out["distance_sma20"] = (close - out["sma20"]) / out["sma20"]
    out["distance_sma50"] = (close - out["sma50"]) / out["sma50"]
    out["rsi14"] = _rsi(close, 14)
    out["volatility_20d"] = close.pct_change().rolling(20).std() * 100
    vol_avg = vol.rolling(20).mean()
    out["volume_ratio"] = vol / vol_avg.replace(0, np.nan)

    return out


def finbert_signed_score(label: str, scores: dict[str, float]) -> float:
    """Map FinBERT label + softmax scores to [-1, 1] edge."""
    pos = float(scores.get("positive", 0))
    neg = float(scores.get("negative", 0))
    neu = float(scores.get("neutral", 0))
    edge = pos - neg
    conf = max(pos, neg, neu)
    return float(np.clip(edge * conf, -1, 1))


def aggregate_sentiment(analyses: list[dict]) -> dict[str, float]:
    """Daily sentiment summary from FinBERT analyze results."""
    if not analyses:
        return {
            "news_count_24h": 0,
            "sentiment_mean": 0.0,
            "sentiment_pos_ratio": 0.0,
            "sentiment_neg_ratio": 0.0,
            "sentiment_confidence": 0.0,
        }

    signed: list[float] = []
    pos = neg = 0
    confs: list[float] = []

    for row in analyses:
        label = str(row.get("label", "neutral"))
        scores = row.get("scores") or {}
        signed.append(finbert_signed_score(label, scores))
        if label == "positive":
            pos += 1
        elif label == "negative":
            neg += 1
        confs.append(max(float(scores.get("positive", 0)), float(scores.get("negative", 0)), float(scores.get("neutral", 0))))

    n = len(analyses)
    return {
        "news_count_24h": n,
        "sentiment_mean": float(np.mean(signed)),
        "sentiment_pos_ratio": pos / n,
        "sentiment_neg_ratio": neg / n,
        "sentiment_confidence": float(np.mean(confs)),
    }


def add_forward_targets(
    df: pd.DataFrame,
    *,
    horizons: tuple[int, ...] = (3, 5),
) -> pd.DataFrame:
    """Binary target: 1 if forward return over horizon is positive."""
    out = df.copy()
    for h in horizons:
        fwd = out["close"].shift(-h) / out["close"] - 1
        out[f"fwd_return_{h}d"] = fwd * 100
        out[f"target_up_{h}d"] = (fwd > 0).astype("Int64")
    return out


FEATURE_COLUMNS = [
    "return_1d",
    "return_5d",
    "rsi14",
    "distance_sma20",
    "distance_sma50",
    "volatility_20d",
    "volume_ratio",
    "news_count_24h",
    "sentiment_mean",
    "sentiment_pos_ratio",
    "sentiment_neg_ratio",
    "sentiment_confidence",
]
