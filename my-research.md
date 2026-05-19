# AI Stock Decision Engine v2 — Research Brief

> **Goal:** Replace a single static score with a **Multi-Horizon Decision Engine** that produces consistent, actionable signals per timeframe.

> **In-app reference:** Features → *Score basis by category* → **Calculation rules** (formulas, input sources, category weights) above the per-symbol grid.

---

##  Calculation rules

How scores are computed: equations, data feeding them, and baseline category weights.

### 1. Mathematical formulas

Score calculation over a given time period — research target and formulas **implemented** in `api/internal/services/decision_engine.go`, `decision_math.go`, and `decision_news.go`.

#### 1.1 Final score per timeframe T (research target)

```
FinalScore(T) = Σᵢ (CategoryScoreᵢ(T) × CategoryWeightᵢ × Confidenceᵢ)
                − RiskPenalty(T)
                + RegimeAdjustment(T)
```

| Term | Role |
|------|------|
| **T** | Timeframe (3D, 1W, 1M, …) |
| **CategoryWeightᵢ** | Base importance (category weights below) |
| **Confidenceᵢ** | Model certainty — low confidence → less contribution |
| **RiskPenalty(T)** | Volatility, drawdown, liquidity, gap, beta, earnings risk |
| **RegimeAdjustment(T)** | Bull / bear / sideways / high-vol multiplier |

`RegimeAdjustment` is not wired yet; horizons and composite below are live.

#### 1.2 Implemented formulas

| Name | Formula | Period / scope |
|------|---------|----------------|
| Horizon score | `Score₁₀₀ = sigmoid(raw × 1.15) × 100` if `Σ(conf×weight) ≥ 0.08`, else **0** (no fake 50) | 3D · 1W · 1M (distinct sentiment windows) |
| Overall composite | `Composite = 0.45×Score₁W + 0.30×Score₃D + 0.25×Score₁M + AlignmentBonus − RiskPenalty` | Cross-horizon trader score (risk: high=8, med=4; align: ±4 / −2) |
| Category contribution | `contribᵢ = CategoryScoreᵢ × Weightᵢ × Confidenceᵢ × 100` | Table cells; display = `(score+1)×50` |
| Sentiment decay | `AdjustedSentiment = Sentiment × e^(−k·t)` | 1h / 4h / 24h windows; half-lives 6h, 12h, 24h |
| FinBERT confidence | Wilson lower bound on positive label proportion (z=1.96) | 24h article window |
| News sample confidence | `conf = 1 − e^(−n/λ)`, λ=5 articles | Combined with model confidence (geometric mean) |
| Technical mapping | `RSI signal = (50−RSI)/50`; price/SMA via `tanh(Δ%/scale)` | Latest daily bar |
| News stance | `score = Σ window(weight × decay × sentiment)`; stance thresholds ±0.2 | `decision_news.go` |
| Price projection P(up) | `logistic(composite)×0.5 + horizonPrior×0.35 + conf×0.1 + momentum` | 63d history + 21d path |
| Multi-horizon path | `P_T = P₀ × (1 + edge×σ×√(days/252) + trend)` per anchor T ∈ {3D,1W,2W,3W,1M} | Grey bands on chart; ECharts popup |
| Zero-data policy | No market signal **and** no news → composite **0**, display **—**, not 50 | `hasScorableInputs` + `categorySignalStrength` |
| Outlook buckets | 78–100 Strong buy · 62–77.99 Buy · 45–61.99 Watch · 32–44.99 Sell · 0–31.99 Avoid | See **§1.5 master table**; same for horizons + composite |

#### Calibrated constants (Sprint A)

Tunable values live in `config/calibration.json` (loaded by API via `CALIBRATION_CONFIG`). Re-fit with `go run ./cmd/calibrate/ -optimize`. Web P(up) uses matching constants in `web/src/lib/calibration.ts`.

#### Signal richness (Sprint B)

- Horizons use `finalHorizonRaw`: **Σᵢ (CategoryScoreᵢ × Weightᵢ × Confidenceᵢ)** with horizon-specific FinBERT windows (`decision_finbert.go`).
- **Single news path:** `finbert` category (48% weight) OR `sentiment` fallback when FinBERT absent — never both.
- FinBERT uses 1h/4h/24h softmax edges, entropy discount, tail probs, high-confidence counts.

### 1.5 Trader signal table (outlook vs trade action)

The **Trader outlook** column shows two related outputs from `ComputeDecision` in `decision_engine.go`:

| UI label | API field | Meaning |
|----------|-----------|---------|
| **Signal badge** (Buy / Watch / Sell / Avoid) | `decision.primaryAction` → `recommendation` | **Trade posture** — whether to add risk, reduce, or wait. Never auto-executes. |
| **Subline** (`Outlook: …`) | `decision.primaryOutlook` | **Score bucket label** from composite 0–100 after risk penalty. |

They are **not always the same**. Example: composite 42 with outlook **Sell** but badge **Watch** when confidence is below the trade gate.

#### Master table — composite range, outlook, and signal

Applied to **composite score** and each **horizon score** (3D / 1W / 1M) via `scoreToOutlook` in `decision_engine.go`.  
**Signal badge** = `primaryAction` after `outlookToAction` + overrides (UI maps `buy_candidate` → **Buy**, etc.).

| Composite range | Outlook key | Outlook label (subline) | Signal badge (conf ≥ **35%**, no conflict) | Signal badge (conf **&lt; 35%**) | `primaryAction` API |
|-----------------|-------------|-------------------------|---------------------------------------------|-----------------------------------|---------------------|
| **78 – 100** | `strong_buy` | Strong buy | **Buy** | Watch | `buy_candidate` |
| **62 – 77.99** | `buy` | Buy | **Buy** | Watch | `buy_candidate` |
| **45 – 61.99** | `watch` | Watch | **Watch** | Watch | `watch` |
| **32 – 44.99** | `sell` | Sell | **Sell** | Watch | `sell_candidate` |
| **0 – 31.99** | `avoid` | Avoid | **Avoid** | Watch* | `avoid` |

\* **Avoid** can still show when overrides force `avoid` even at low confidence (e.g. negative news spike). Otherwise low confidence downgrades Buy/Sell/Avoid outlooks to badge **Watch**.

**Boundary notes (inclusive lower bound):**

| Threshold | Rule in code |
|-----------|----------------|
| Strong buy | `score >= 78` |
| Buy | `62 <= score < 78` |
| Watch | `45 <= score < 62` |
| Sell | `32 <= score < 45` |
| Avoid | `score < 32` |

Same buckets apply per horizon for horizon badges; **trader row outlook label** uses the **composite** after alignment and risk penalty.

Formula (implemented):

```
composite = 0.45×Score₁W + 0.30×Score₃D + 0.25×Score₁M + alignmentBonus − riskPenalty
composite = clamp(composite, 0, 100)
```

| Adjustment | Range / value |
|------------|----------------|
| Alignment bonus | **+4** (3 horizons bullish) · **−4** (≥2 bearish) · **−2** (divergent) · **0** (mixed) |
| Risk penalty | **−8** (high) · **−4** (medium) · **0** (low) |

#### Signal gates — when badge ≠ outlook label

Evaluated in `outlookToAction` **before** overrides. Numeric thresholds:

| Gate | Threshold | Effect on signal badge |
|------|-----------|-------------------------|
| Low confidence | `confidence < 0.35` (35%) | Force **Watch** (`watch`) — blocks Buy/Sell from outlook |
| Horizon conflict | `conflict == true` and outlook ∉ {sell, avoid} | Force **Watch** |
| High risk + moderate score | `risk == high` and outlook ∈ {buy, strong_buy} and `composite < 70` | Force **Watch** |
| Default (pass gates) | — | Map outlook → signal per master table |

**Confidence** (0–1, shown as % in UI subline):

| Step | Range / rule |
|------|----------------|
| Base | Mean of 3D / 1W / 1M horizon confidences |
| No market features | × **0.75** |
| No news (0 articles 1h & 24h) | × **0.85** |
| Final clamp | **0.15 – 0.95** (15% – 95%) |

Market-only watchlists often end at **~17–22%** → badge **Watch** for composites in 45–61 even when price action is strong.

#### Override rules (`applyDecisionOverrides`) — after signal gates

Can **change signal badge and outlook** outside the composite bands above. Runs after `outlookToAction`.

| Trigger (all must match where listed) | Signal badge | Outlook label | Composite range after override |
|---------------------------------------|--------------|---------------|--------------------------------|
| Negative news spike + 24h sentiment **&lt; −0.35** | Avoid | Avoid | **≤ 28** |
| Negative news spike + 1h sentiment **&lt; −0.45** | Avoid | Avoid | **≤ 30** |
| Positive news spike + 1h sentiment **&gt; +0.35** + composite **≥ 50** | Buy | Buy | **≥ 64** |
| 24h price **&gt; +2.5%** + 24h sentiment **&gt; +0.3** + no neg spike | Buy | Buy | **≥ 65** |
| 24h price **&lt; −2%** + 24h sentiment **&lt; −0.35** | Sell | Sell | **≤ 38** |
| 24h sentiment **&lt; −0.5**, no market data | Avoid | Avoid | **≤ 25** |

Overrides can produce **Buy** with composite in the **45–61** watch band (e.g. floor 65) if sentiment/price triggers fire. A strong mover with **weak news** (e.g. +28% price, sentiment **0.1**) stays in **45–61 / Watch** unless sentiment clears **+0.3** on the momentum override.

#### Debug: why your watchlist can all show Watch (May 2026 example)

| Symbol | Composite | Outlook (range) | Conf | Signal badge | Why |
|--------|-----------|-----------------|------|--------------|-----|
| HIVE | ~53 | Watch (**45–61.99**) | ~20% | Watch | Outlook band + conf **&lt; 35%** gate |
| ING | ~46 | Watch (**45–61.99**) | ~21% | Watch | Same |
| AAPL | ~46 | Watch (**45–61.99**) | ~17% | Watch | Medium risk penalty; still watch band |
| RRR | ~45 | Watch (**45–61.99**) | ~21% | Watch | Same |

**Price outlook P(up)** (chart) is a **separate model** (`price-outlook.ts`) — it can show 66% up while the **trade badge** stays Watch because the decision engine requires composite ≥ 62 **and** sufficient confidence for Buy.

#### Positions (holdings) — not in engine today

| Question | Current behavior |
|----------|------------------|
| Is there a portfolio / position size input? | **No** — signals are per symbol only. |
| Does signal change if you already own shares? | **No** — zero shares vs open position get the **same** `primaryAction` and `primaryOutlook`. |
| What should happen (v2 target)? | Use a **position-aware** layer on top of the same composite: |

| Position | Outlook | Suggested trade posture (future) |
|----------|---------|----------------------------------|
| Flat (0) | Buy | Buy candidate — enter |
| Flat | Watch | Wait — no entry |
| Flat | Sell / Avoid | Avoid new long |
| Long | Buy | Hold / add (size by confidence) |
| Long | Watch | Hold — monitor |
| Long | Sell | Trim / exit candidate |
| Long | Avoid | Exit candidate |
| Short | (not supported) | — |

Until positions are stored (workspace holdings table + API), treat every row as **flat** research: the badge means “if you were deciding from scratch today,” not “adjust your current lot.”

---

### 1.3 Formula inputs — information sources

Symbols and fields fed into the equations above; where each value originates in this system.

| Symbol | Input | Used in | Data source | Refresh |
|--------|-------|---------|-------------|---------|
| P₀, P₂₄h, P₅d | Price levels & returns | Technical, trend, risk | Alpaca daily bars (1Day) | Refresh data |
| RSI₁₄ | Relative strength index | Technical momentum | Computed from Alpaca closes | Refresh data |
| σ₁₀d | Volatility (10d) | Risk penalty, 3M projection | `market_features.volatility` | Refresh data |
| Vol ratio | Volume vs average | Technical (breakout bias) | `market_features.volumeRatio` | Refresh data |
| SMA20 dist | Distance to SMA20 | Technical momentum | `market_features.distanceSma20` | Refresh data |
| S₁h,S₄h,S₂₄h | Signed news sentiment | Sentiment, FinBERT, horizons | `news_features` avg_sentiment_* | Refresh + FinBERT backlog |
| N₁h,N₄h,N₂₄h | Article counts | Sample confidence, coverage | `news_features` news_count_* | News ingest |
| P+,P−,P₀ | FinBERT softmax means | FinBERT category, news stance | `news_features.finbert` avg_prob_* | FinBERT on headlines |
| Label % | FinBERT label proportions | FinBERT / sentiment fallback | Aggregated article labels 24h | FinBERT on headlines |
| Spike± | News spike flags | Overrides, risk, drivers | `positive/negative_news_spike` | ≥3 articles in 1h |
| H₃D,H₁W,H₁M | Horizon scores | Composite, alignment | `decision_engine` horizons | Each board load |
| Align | Horizon alignment | Alignment bonus, category row | Compare 3D/1W/1M outlooks | Derived |

---

### 1.4 Category weights (v2 baseline)

| Category | Weight | Time sensitivity | Key inputs | Models / systems | Live in engine |
|----------|--------|------------------|------------|------------------|----------------|
| Technical momentum | 18% | Very high | RSI, MACD, EMA, VWAP, ATR | XGBoost, LightGBM, TFT | Yes |
| Trend strength | 10% | High | HH/HL, ADX | LSTM, Transformers | Yes |
| Fundamentals | 18% | Low | Revenue, EPS, FCF, ROIC | LLM finance agent | — |
| Valuation | 10% | Medium | P/E, PEG, DCF | Regression + LLM | — |
| Sentiment | 12% | Very high | News, social, filings | FinBERT, FinGPT | Yes |
| Earnings quality | 8% | High | Guidance, margins | FinGPT, Qwen | — |
| Market regime | 8% | High | VIX, rates, SPY trend | Regime classifier | Partial (risk/regime labels) |
| Sector strength | 5% | Medium | Relative strength | XGBoost | — |
| Risk analysis | 6% | Very high | Volatility, drawdown | Risk engine | Yes |
| Liquidity & flow | 3% | High | Volume, options flow | Order-flow models | Partial (volume ratio) |
| Multi-timeframe alignment | 2% | Critical | Cross-horizon agreement | Meta engine | Yes |

**Total:** 100% — tune per timeframe via time-sensitivity (technical ↑ on 3D, fundamentals ↑ on 1Y when added).

---


####  EXTRA INFO

## 4. Problem: One Score, Conflicting Signals

Without timeframe awareness, the same stock can contradict itself:

| Horizon   | Signal |
|-----------|--------|
| Short-term | SELL  |
| Mid-term   | WATCH |
| Long-term  | BUY   |

A professional engine must answer: **Score(stock, timeframe)** — not one number for all horizons.

---

## 5. Core Concept: Score Matrix

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

## 6. Required Components (beyond timeframes)

Per-timeframe scoring uses **Calculation rules → Final score per timeframe T**; apply **timeframe-specific weights** where category sensitivity differs (e.g. technical ↑ for 3D, fundamentals ↑ for 1Y). Category baselines are under **Category weights (v2 baseline)**.

### 6.1 Confidence (mandatory)

Never emit BUY/SELL without confidence. Example:

| Signal | Score | Confidence |
|--------|-------|------------|
| Technical | 80 | 90% |
| Sentiment | 70 | 50% |

Low-confidence inputs are down-weighted in the sum.

### 6.2 Market regime

| Regime | Effect |
|--------|--------|
| Bull | Trend-following stronger |
| Bear | Defensive weighting |
| Sideways | Mean-reversion favored |
| High volatility | Reduce leverage / size |

### 6.3 Signal freshness (decay)

```
AdjustedSentiment = Sentiment × e^(-kt)
```

Recent news (hours) matters; stale news (weeks) should fade.

### 6.4 Risk-adjusted scoring

Penalize high score + high risk: drawdown, liquidity, gaps, beta, earnings-event risk.

### 6.5 Position style (optional weight profiles)

| Style | Emphasis |
|-------|----------|
| Scalping | Momentum, order flow |
| Swing | Technical + sentiment |
| Long-term | Fundamentals + valuation |
| Options | Volatility, gamma |

One universal weight vector is weaker than style-specific profiles.

### 6.6 Multi-timeframe agreement (meta signal)

**Aligned (conviction ↑):** 3D/1W/2W/1M all BUY.

**Divergent (interpret context):** 3D SELL + 1M BUY → short-term pullback in long-term uptrend.

Use alignment as a dedicated category or meta-engine feature (~2% weight in **Category weights**).

---

## 7. Engine Outputs (per stock)

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

## 8. Model Architecture (layers)

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

## 9. Next upgrade: dynamic weights

Static weights are a baseline. Adjust by context:

| Context | Weight shift |
|---------|----------------|
| Earnings season | Sentiment ↑, technical ↓ |
| Bear market | Risk ↑, momentum ↓ |
| High vol | Risk ↑, size ↓ |

Implement as rules or a small model over regime + calendar features.

---

## 10. Implementation approach (suggested order)

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

## 11. Design principles

- **Multi-horizon first** — one row per timeframe in the score matrix.
- **No signal without confidence** — every BUY/SELL carries certainty.
- **Regime-aware** — same technicals mean different things in bull vs bear.
- **Fresh data weighted** — decay stale sentiment and news.
- **Risk caps enthusiasm** — high score ≠ good trade if risk is extreme.
- **LLM explains; ensemble decides** — keep execution logic out of generative models.
