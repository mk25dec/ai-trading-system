/** Scoring methodology reference — aligned with my-research.md */

export interface FormulaEntry {
  id: string
  name: string
  /** LaTeX-style or plain formula */
  expression: string
  /** Time period / scope */
  period: string
  status: "implemented" | "planned" | "research_target"
  notes?: string
}

export interface FormulaInputRow {
  symbol: string
  name: string
  usedIn: string
  source: string
  refresh: string
}

export const SCORING_FORMULAS: FormulaEntry[] = [
  {
    id: "research_score_t",
    name: "Final score per timeframe (research target)",
    expression:
      "FinalScore(T) = Σᵢ (CategoryScoreᵢ(T) × CategoryWeightᵢ × Confidenceᵢ) − RiskPenalty(T) + RegimeAdjustment(T)",
    period: "Per horizon T (3D, 1W, 1M, …)",
    status: "research_target",
    notes: "my-research.md Calculation rules — full v2 target; RegimeAdjustment not yet wired.",
  },
  {
    id: "horizon_score",
    name: "Horizon score (implemented)",
    expression: "Score₁₀₀ = sigmoid(raw × 1.15) × 100,  raw = Σ categoryᵢ × weightᵢ",
    period: "3D · 1W · 1M (distinct sentiment windows per horizon)",
    status: "implemented",
    notes: "api/internal/services/decision_engine.go — scoreHorizon",
  },
  {
    id: "composite",
    name: "Overall composite (implemented)",
    expression: "Composite = 0.45×Score₁W + 0.30×Score₃D + 0.25×Score₁M + AlignmentBonus − RiskPenalty",
    period: "Cross-horizon blend (trader primary score)",
    status: "implemented",
    notes: "RiskPenalty: high=8, medium=4, low=0. AlignmentBonus: ±4 / −2.",
  },
  {
    id: "category_contrib",
    name: "Category contribution (table cells)",
    expression: "contribᵢ = CategoryScoreᵢ × ResearchWeightᵢ × Confidenceᵢ × 100",
    period: "Per category, per symbol snapshot",
    status: "implemented",
    notes: "CategoryScoreᵢ ∈ [−1,+1]; display = (score+1)×50.",
  },
  {
    id: "sentiment_decay",
    name: "Sentiment freshness decay",
    expression: "AdjustedSentiment = Sentiment × e^(−k·t)  (window weights via half-life)",
    period: "1h / 4h / 24h news windows",
    status: "implemented",
    notes: "decayWeight(age, halfLife) — half-lives 6h, 12h, 24h in categorySentiment.",
  },
  {
    id: "wilson",
    name: "FinBERT label confidence",
    expression: "Wilson lower bound on positive label proportion (z=1.96)",
    period: "24h article window",
    status: "implemented",
    notes: "Conservative confidence when using label % without softmax averages.",
  },
  {
    id: "sample_conf",
    name: "News sample confidence",
    expression: "conf_sample = 1 − e^(−n/λ),  λ=5 articles",
    period: "Rolling news counts",
    status: "implemented",
    notes: "Combined with model confidence via geometric mean.",
  },
  {
    id: "rsi_tanh",
    name: "Technical factor mapping",
    expression: "RSI signal = (50−RSI)/50;  price/SMA = tanh(Δ%/scale)",
    period: "Latest daily bar",
    status: "implemented",
    notes: "tanhScale compresses outliers; RSI mean-reversion centered at 50.",
  },
  {
    id: "news_stance",
    name: "News stance inference",
    expression: "score = Σ window(weight × decay × sentiment);  stance from thresholds ±0.2",
    period: "1h · 4h · 24h + FinBERT weighted / label %",
    status: "implemented",
    notes: "decision_news.go — falls back to neutral if articles exist but unscored.",
  },
  {
    id: "price_3m",
    name: "3M price outlook P(up)",
    expression: "P(up) = logistic(composite) × 0.55 + (Score₁M/100) × 0.35 + confidence × 0.1",
    period: "~63 trading days history + 21-day projection",
    status: "implemented",
    notes: "Linear trend on last 20 sessions + 5d drift; not a trade signal alone.",
  },
  {
    id: "outlook_buckets",
    name: "Outlook labels",
    expression: "≥78 Strong buy · ≥62 Buy · ≥45 Watch · ≥32 Sell · <32 Avoid",
    period: "Applied to 0–100 scores",
    status: "implemented",
    notes: "scoreToOutlook in decision engine.",
  },
]

export const FORMULA_INPUT_SOURCES: FormulaInputRow[] = [
  { symbol: "P₀, P₂₄h, P₅d", name: "Price levels & returns", usedIn: "Technical, trend, risk", source: "Alpaca daily bars (1Day)", refresh: "Refresh data" },
  { symbol: "RSI₁₄", name: "Relative strength index", usedIn: "Technical momentum", source: "Computed from Alpaca closes", refresh: "Refresh data" },
  { symbol: "σ₁₀d", name: "Volatility (10d)", usedIn: "Risk penalty, 3M projection", source: "market_features.volatility", refresh: "Refresh data" },
  { symbol: "Vol ratio", name: "Volume vs average", usedIn: "Technical (breakout bias)", source: "market_features.volumeRatio", refresh: "Refresh data" },
  { symbol: "SMA20 dist", name: "Distance to SMA20", usedIn: "Technical momentum", source: "market_features.distanceSma20", refresh: "Refresh data" },
  { symbol: "S₁h,S₄h,S₂₄h", name: "Signed news sentiment", usedIn: "Sentiment, FinBERT, horizons", source: "news_features avg_sentiment_*", refresh: "Refresh + FinBERT backlog" },
  { symbol: "N₁h,N₄h,N₂₄h", name: "Article counts", usedIn: "Sample confidence, coverage", source: "news_features news_count_*", refresh: "News ingest workflow" },
  { symbol: "P+,P−,P₀", name: "FinBERT softmax means", usedIn: "FinBERT category, news stance", source: "news_features.finbert avg_prob_*", refresh: "FinBERT on headlines" },
  { symbol: "Label %", name: "FinBERT label proportions", usedIn: "FinBERT / sentiment fallback", source: "Aggregated article labels 24h", refresh: "FinBERT on headlines" },
  { symbol: "Spike±", name: "News spike flags", usedIn: "Overrides, risk, drivers", source: "news_features positive/negative_news_spike", refresh: "≥3 articles in 1h window" },
  { symbol: "H₃D,H₁W,H₁M", name: "Horizon scores", usedIn: "Composite, alignment", source: "decision_engine horizons", refresh: "Derived each board load" },
  { symbol: "Align", name: "Horizon alignment", usedIn: "Alignment bonus, category row", source: "compare 3D/1W/1M outlooks", refresh: "Derived" },
]
