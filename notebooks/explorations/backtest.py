"""Simple long-only backtest helpers."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class BacktestResult:
    equity: pd.Series
    daily_returns: pd.Series
    trades: pd.DataFrame
    metrics: dict[str, float]


def run_long_only_backtest(
    prices: pd.Series,
    signals: pd.Series,
    *,
    initial_cash: float = 10_000.0,
) -> BacktestResult:
    """
    Long when signal == 1, flat when signal == 0.

    signals are applied with 1-day lag (trade at next open using close-to-close proxy).
    """
    aligned = pd.DataFrame({"price": prices, "signal": signals}).dropna()
    aligned["position"] = aligned["signal"].shift(1).fillna(0).clip(0, 1)
    aligned["daily_return"] = aligned["price"].pct_change()
    aligned["strategy_return"] = aligned["position"] * aligned["daily_return"]
    aligned["equity"] = initial_cash * (1 + aligned["strategy_return"].fillna(0)).cumprod()

    strat = aligned["strategy_return"].dropna()
    bench = aligned["daily_return"].dropna()

    def _sharpe(r: pd.Series) -> float:
        if r.std() == 0 or len(r) < 2:
            return 0.0
        return float(r.mean() / r.std() * np.sqrt(252))

    def _max_dd(eq: pd.Series) -> float:
        peak = eq.cummax()
        dd = (eq - peak) / peak
        return float(dd.min())

    metrics = {
        "total_return_pct": float((aligned["equity"].iloc[-1] / initial_cash - 1) * 100),
        "buy_hold_return_pct": float((aligned["price"].iloc[-1] / aligned["price"].iloc[0] - 1) * 100),
        "sharpe": _sharpe(strat),
        "buy_hold_sharpe": _sharpe(bench),
        "max_drawdown_pct": _max_dd(aligned["equity"]) * 100,
        "hit_rate": float((strat[strat != 0] > 0).mean()) if (strat != 0).any() else 0.0,
        "days_in_market_pct": float(aligned["position"].mean() * 100),
    }

    trades = aligned.loc[aligned["position"].diff().fillna(0) != 0, ["price", "position"]].copy()
    return BacktestResult(
        equity=aligned["equity"],
        daily_returns=strat,
        trades=trades,
        metrics=metrics,
    )


def classification_metrics(y_true: pd.Series, y_prob: pd.Series, *, threshold: float = 0.5) -> dict[str, float]:
    pred = (y_prob >= threshold).astype(int)
    y = y_true.astype(int)
    mask = y.notna() & y_prob.notna()
    y = y[mask]
    pred = pred[mask]
    prob = y_prob[mask]
    if len(y) == 0:
        return {"accuracy": 0.0, "hit_rate": 0.0, "brier": 1.0, "n": 0}

    acc = float((pred == y).mean())
    hit = float(((pred == 1) & (y == 1)).sum() / max((pred == 1).sum(), 1))
    brier = float(np.mean((prob - y) ** 2))
    return {"accuracy": acc, "hit_rate": hit, "brier": brier, "n": float(len(y))}
