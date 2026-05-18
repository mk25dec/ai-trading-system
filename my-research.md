# AI Stock Decision Engine v2 — Research Brief

> **Goal:** Replace a single static score with a **Multi-Horizon Decision Engine** that produces consistent, actionable signals per timeframe.

---

## 1. Problem: One Score, Conflicting Signals

Without timeframe awareness, the same stock can contradict itself:

| Horizon   | Signal |
|-----------|--------|
| Short-term | SELL  |
| Mid-term   | WATCH |
| Long-term  | BUY   |

A professional engine must answer: **Score(stock, timeframe)** — not one number for all horizons.

---

## 2. Core Concept: Score Matrix

### Timeframes

| Timeframe | Meaning |
|-----------|---------|
| 3 days | Short-term momentum |
| 1 week | Swing direction |
| 2 weeks | Trend continuation |
| 1 month | Medium-term outlook |
| 3 months | Position trade |
| 1 year | Investment quality |

### Output: Final Score Matrix (example)

| Timeframe | Buy/Sell Score |
|-----------|----------------|
| 3 days | 58 |
| 1 week | 65 |
| 2 weeks | 74 |
| 1 month | 81 |
| 3 months | 88 |

Each cell drives outlook labels (BUY / WATCH / SELL / STRONG BUY) for that horizon.

---

## 3. Scoring Formula (per timeframe T)

```
FinalScore(T) = Σ (CategoryScore_i(T) × CategoryWeight_i × Confidence_i)
                − RiskPenalty(T)
                + RegimeAdjustment(T)
```

| Term | Role |
|------|------|
| **T** | Timeframe (3D, 1W, 1M, …) |
| **CategoryWeight_i** | Base importance of category (see §6) |
| **Confidence_i** | Model certainty — low confidence → less contribution |
| **RiskPenalty(T)** | Volatility, drawdown, liquidity, gap, beta, earnings risk |
| **RegimeAdjustment(T)** | Bull / bear / sideways / high-vol multiplier |

Also apply **timeframe-specific weights** where category sensitivity differs (e.g. technical ↑ for 3D, fundamentals ↑ for 1Y).

---

## 4. Required Components (beyond timeframes)

### 4.1 Confidence (mandatory)

Never emit BUY/SELL without confidence. Example:

| Signal | Score | Confidence |
|--------|-------|------------|
| Technical | 80 | 90% |
| Sentiment | 70 | 50% |

Low-confidence inputs are down-weighted in the sum.

### 4.2 Market regime

| Regime | Effect |
|--------|--------|
| Bull | Trend-following stronger |
| Bear | Defensive weighting |
| Sideways | Mean-reversion favored |
| High volatility | Reduce leverage / size |

### 4.3 Signal freshness (decay)

```
AdjustedSentiment = Sentiment × e^(-kt)
```

Recent news (hours) matters; stale news (weeks) should fade.

### 4.4 Risk-adjusted scoring

Penalize high score + high risk: drawdown, liquidity, gaps, beta, earnings-event risk.

### 4.5 Position style (optional weight profiles)

| Style | Emphasis |
|-------|----------|
| Scalping | Momentum, order flow |
| Swing | Technical + sentiment |
| Long-term | Fundamentals + valuation |
| Options | Volatility, gamma |

One universal weight vector is weaker than style-specific profiles.

### 4.6 Multi-timeframe agreement (meta signal)

**Aligned (conviction ↑):** 3D/1W/2W/1M all BUY.

**Divergent (interpret context):** 3D SELL + 1M BUY → short-term pullback in long-term uptrend.

Use alignment as a dedicated category or meta-engine feature (~2% weight in table below).

---

## 5. Category Weights (v2 baseline)

| Category | Weight | Time sensitivity | Key inputs | Models / systems |
|----------|--------|------------------|------------|------------------|
| Technical momentum | 18% | Very high | RSI, MACD, EMA, VWAP, ATR | XGBoost, LightGBM, TFT |
| Trend strength | 10% | High | HH/HL, ADX | LSTM, Transformers |
| Fundamentals | 18% | Low | Revenue, EPS, FCF, ROIC | LLM finance agent |
| Valuation | 10% | Medium | P/E, PEG, DCF | Regression + LLM |
| Sentiment | 12% | Very high | News, social, filings | FinBERT, FinGPT |
| Earnings quality | 8% | High | Guidance, margins | FinGPT, Qwen |
| Market regime | 8% | High | VIX, rates, SPY trend | Regime classifier |
| Sector strength | 5% | Medium | Relative strength | XGBoost |
| Risk analysis | 6% | Very high | Volatility, drawdown | Risk engine |
| Liquidity & flow | 3% | High | Volume, options flow | Order-flow models |
| Multi-timeframe alignment | 2% | Critical | Cross-horizon agreement | Meta engine |

**Total:** 100% — tune per timeframe via time-sensitivity column.

---

## 6. Engine Outputs (per stock)

| Output | Meaning |
|--------|---------|
| Score | Numerical rating (per timeframe + aggregate) |
| Confidence | Reliability of composite |
| Risk level | Low / Medium / High |
| Timeframe outlook | 3D / 1W / 1M labels |
| Regime | Bull / Bear / Sideways |
| Entry zone | Suggested entry band |
| Exit zone | Profit target |
| Stop loss | Risk control |
| Position size | Suggested allocation |

### Example institutional-style card

| Metric | Value |
|--------|-------|
| 3D outlook | WATCH |
| 1W outlook | BUY |
| 1M outlook | STRONG BUY |
| Final score (1M) | 82 |
| Confidence | 78% |
| Risk level | Medium |
| Regime | Bullish |
| Best entry | $182–185 |
| Stop loss | $174 |
| Target | $205 |

---

## 7. Model Architecture (layers)

```
Layer 1 — Data collection
  Polygon, Alpha Vantage, SEC, news APIs, Reddit/X

Layer 2 — Feature generation
  TA-Lib, pandas-ta, options analytics, macro indicators

Layer 3 — Specialized models
  Sentiment      → FinBERT
  Finance reasoning → FinGPT (explain, not trade)
  Structured prediction → XGBoost / LightGBM
  Time series    → TFT
  Regime         → HMM / Transformer

Layer 4 — Meta Decision Engine  ← most important
  Ensemble (XGBoost / LightGBM) → BUY / WATCH / SELL
  LLMs explain decisions; they do not directly trade.
```

---

## 8. Next upgrade: dynamic weights

Static weights are a baseline. Adjust by context:

| Context | Weight shift |
|---------|----------------|
| Earnings season | Sentiment ↑, technical ↓ |
| Bear market | Risk ↑, momentum ↓ |
| High vol | Risk ↑, size ↓ |

Implement as rules or a small model over regime + calendar features.

---

## 9. Implementation approach (suggested order)

1. **Define timeframes** in API/schema: `3D`, `1W`, `2W`, `1M`, `3M`, `1Y`.
2. **Compute category scores per T** using existing features (technical, sentiment/FinBERT, etc.).
3. **Add confidence** on each category input; wire into formula.
4. **Add regime classifier** + `RegimeAdjustment(T)`.
5. **Add decay** on sentiment/news features.
6. **Add risk penalty** from volatility, drawdown, liquidity.
7. **Emit score matrix + outlook labels**; add alignment meta-feature.
8. **Meta engine** (ensemble) for final action + position sizing hints.
9. **Dynamic weights** by regime and event calendar.

---

## 10. Design principles

- **Multi-horizon first** — one row per timeframe in the score matrix.
- **No signal without confidence** — every BUY/SELL carries certainty.
- **Regime-aware** — same technicals mean different things in bull vs bear.
- **Fresh data weighted** — decay stale sentiment and news.
- **Risk caps enthusiasm** — high score ≠ good trade if risk is extreme.
- **LLM explains; ensemble decides** — keep execution logic out of generative models.
