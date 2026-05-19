import type { CategoryScore, DecisionView, HorizonOutlook, ResearchStockRow } from "@/lib/pipeline-api"
import { resolveDecision } from "@/lib/decision-engine"

/** v2 baseline categories from my-research.md — Calculation rules · Category weights */
export interface ResearchCategoryDef {
  id: string
  label: string
  researchWeight: number
  timeSensitivity: string
  keyInputs: string
  modelsPlanned: string
  /** Where values come from in the running system */
  dataSource: string
  /** Backend category ids merged into this row */
  backendIds: string[]
  implemented: boolean
}

export interface CategoryFormulaTerm {
  label: string
  weight: number
  score: number
  confidence: number
  contribution: number
  implemented: boolean
}

export interface CompositeFormulaBreakdown {
  /** Engine composite (horizon blend) */
  horizonBlend: {
    short: HorizonOutlook
    swing: HorizonOutlook
    position: HorizonOutlook
    alignBonus: number
    riskPenalty: number
    beforeClamp: number
    composite: number
  }
  /** Calculation rules category sum (implemented factors only) */
  categorySum: number
  categoryTerms: CategoryFormulaTerm[]
  confidence: number
}

export const RESEARCH_CATEGORIES: ResearchCategoryDef[] = [
  {
    id: "technical",
    label: "Technical momentum",
    researchWeight: 0.18,
    timeSensitivity: "Very high",
    keyInputs: "RSI, MACD, EMA, VWAP, ATR",
    modelsPlanned: "XGBoost, LightGBM, TFT",
    dataSource: "Alpaca daily bars → market_features (RSI, 24h %, SMA20 distance, volume ratio)",
    backendIds: ["technical"],
    implemented: true,
  },
  {
    id: "trend",
    label: "Trend strength",
    researchWeight: 0.1,
    timeSensitivity: "High",
    keyInputs: "HH/HL, ADX",
    modelsPlanned: "LSTM, Transformers",
    dataSource: "Alpaca bars → 24h & 5d price change alignment",
    backendIds: ["trend"],
    implemented: true,
  },
  {
    id: "fundamentals",
    label: "Fundamentals",
    researchWeight: 0.18,
    timeSensitivity: "Low",
    keyInputs: "Revenue, EPS, FCF, ROIC",
    modelsPlanned: "LLM finance agent",
    dataSource: "Not wired in v2 engine",
    backendIds: [],
    implemented: false,
  },
  {
    id: "valuation",
    label: "Valuation",
    researchWeight: 0.1,
    timeSensitivity: "Medium",
    keyInputs: "P/E, PEG, DCF",
    modelsPlanned: "Regression + LLM",
    dataSource: "Not wired in v2 engine",
    backendIds: [],
    implemented: false,
  },
  {
    id: "sentiment",
    label: "Sentiment",
    researchWeight: 0.12,
    timeSensitivity: "Very high",
    keyInputs: "News, social, filings",
    modelsPlanned: "FinBERT, FinGPT",
    dataSource: "News pipeline → avg_sentiment 1h/4h/24h + decay weights",
    backendIds: ["sentiment", "finbert"],
    implemented: true,
  },
  {
    id: "earnings",
    label: "Earnings quality",
    researchWeight: 0.08,
    timeSensitivity: "High",
    keyInputs: "Guidance, margins",
    modelsPlanned: "FinGPT, Qwen",
    dataSource: "Not wired in v2 engine",
    backendIds: [],
    implemented: false,
  },
  {
    id: "regime",
    label: "Market regime",
    researchWeight: 0.08,
    timeSensitivity: "High",
    keyInputs: "VIX, rates, SPY trend",
    modelsPlanned: "Regime classifier",
    dataSource: "Planned — not in v2 engine",
    backendIds: [],
    implemented: false,
  },
  {
    id: "sector",
    label: "Sector strength",
    researchWeight: 0.05,
    timeSensitivity: "Medium",
    keyInputs: "Relative strength",
    modelsPlanned: "XGBoost",
    dataSource: "Not wired in v2 engine",
    backendIds: [],
    implemented: false,
  },
  {
    id: "risk",
    label: "Risk analysis",
    researchWeight: 0.06,
    timeSensitivity: "Very high",
    keyInputs: "Volatility, drawdown",
    modelsPlanned: "Risk engine",
    dataSource: "market_features volatility, RSI extremes, negative news spike",
    backendIds: ["risk"],
    implemented: true,
  },
  {
    id: "liquidity",
    label: "Liquidity & flow",
    researchWeight: 0.03,
    timeSensitivity: "High",
    keyInputs: "Volume, options flow",
    modelsPlanned: "Order-flow models",
    dataSource: "Partial — volume_ratio in technical category",
    backendIds: [],
    implemented: false,
  },
  {
    id: "alignment",
    label: "Multi-timeframe alignment",
    researchWeight: 0.02,
    timeSensitivity: "Critical",
    keyInputs: "Cross-horizon agreement",
    modelsPlanned: "Meta engine",
    dataSource: "Computed from 3D / 1W / 1M outlook agreement",
    backendIds: [],
    implemented: true,
  },
]

export const COMPOSITE_FORMULA_DOC = {
  research:
    "FinalScore(T) = Σ (CategoryScoreᵢ × CategoryWeightᵢ × Confidenceᵢ) − RiskPenalty(T) + RegimeAdjustment(T)",
  engine:
    "Composite = 0.45×Score₁W + 0.30×Score₃D + 0.25×Score₁M + AlignmentBonus − RiskPenalty",
  display:
    "Cell score maps signed factor s ∈ [−1,+1] to display = (s+1)×50 (50 = neutral). Contribution = s × weight × confidence × 100.",
}

export interface CategoryCell {
  score: number | null
  confidence: number | null
  /** Weighted contribution toward composite (research weight × score × confidence) */
  contribution: number | null
  displayScore: number | null
}

export interface StockCategoryBreakdown {
  symbol: string
  name: string
  compositeScore: number
  compositeConfidence: number
  unscored: boolean
  cells: Record<string, CategoryCell>
  formula: CompositeFormulaBreakdown
}

function alignmentScore(alignment: string): { score: number; confidence: number } {
  switch (alignment) {
    case "aligned_bullish":
      return { score: 0.75, confidence: 0.85 }
    case "aligned_bearish":
      return { score: -0.75, confidence: 0.85 }
    case "divergent":
      return { score: -0.35, confidence: 0.7 }
    default:
      return { score: 0, confidence: 0.55 }
  }
}

function mergeBackendScores(
  ids: string[],
  byId: Map<string, CategoryScore>,
): CategoryScore | null {
  const parts = ids.map((id) => byId.get(id)).filter((c): c is CategoryScore => c != null)
  if (parts.length === 0) return null
  if (parts.length === 1) return parts[0]

  let wAcc = 0
  let sAcc = 0
  let cAcc = 0
  for (const p of parts) {
    const w = p.weight > 0 ? p.weight : 1
    sAcc += p.score * w
    cAcc += p.confidence * w
    wAcc += w
  }
  return {
    id: ids.join("+"),
    label: parts.map((p) => p.label).join(" · "),
    score: sAcc / wAcc,
    confidence: cAcc / wAcc,
    weight: wAcc / parts.length,
  }
}

/** Map signed factor score (−1…+1) to 0–100 display scale. Returns null when unscored. */
export function signedToDisplay(score: number, confidence?: number | null): number | null {
  if (confidence != null && confidence < 0.12) {
    return null
  }
  return Math.round(clamp((score + 1) * 50, 0, 100) * 10) / 10
}

export function isUnscoredDecision(decision: DecisionView): boolean {
  return (
    decision.compositeScore <= 0 &&
    (decision.confidence ?? 0) <= 0.2 &&
    (decision.primaryOutlook === "No data" ||
      (decision.horizons?.every((h) => h.score <= 0) ?? true))
  )
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

export function resolveCategoryCell(
  def: ResearchCategoryDef,
  decision: DecisionView,
): CategoryCell {
  const empty: CategoryCell = {
    score: null,
    confidence: null,
    contribution: null,
    displayScore: null,
  }

  if (!def.implemented) {
    return empty
  }

  if (def.id === "alignment") {
    const { score, confidence } = alignmentScore(decision.alignment)
    const contribution = score * def.researchWeight * confidence * 100
    return {
      score,
      confidence,
      contribution: Math.round(contribution * 10) / 10,
      displayScore: signedToDisplay(score, confidence),
    }
  }

  const byId = new Map((decision.categories ?? []).map((c) => [c.id, c]))
  const merged = mergeBackendScores(def.backendIds, byId)
  if (!merged || merged.confidence < 0.12) {
    return empty
  }

  const contribution = merged.score * def.researchWeight * merged.confidence * 100
  return {
    score: merged.score,
    confidence: merged.confidence,
    contribution: Math.round(contribution * 10) / 10,
    displayScore: signedToDisplay(merged.score, merged.confidence),
  }
}

function alignBonusFromAlignment(alignment: string): number {
  switch (alignment) {
    case "aligned_bullish":
      return 4
    case "aligned_bearish":
      return -4
    case "divergent":
      return -2
    default:
      return 0
  }
}

function riskPenaltyFromLevel(level: string): number {
  switch (level) {
    case "high":
      return 8
    case "medium":
      return 4
    default:
      return 0
  }
}

const emptyHorizon = (id: string, label: string): HorizonOutlook => ({
  id,
  label,
  score: 0,
  outlook: "watch",
  confidence: 0.15,
})

export function buildCompositeFormula(decision: DecisionView): CompositeFormulaBreakdown {
  const horizons = decision.horizons ?? []
  const short = horizons.find((h) => h.id === "short") ?? horizons[0] ?? emptyHorizon("short", "3D")
  const swing = horizons.find((h) => h.id === "swing") ?? horizons[1] ?? emptyHorizon("swing", "1W")
  const position =
    horizons.find((h) => h.id === "position") ?? horizons[2] ?? emptyHorizon("position", "1M")

  const alignBonus = alignBonusFromAlignment(decision.alignment)
  const riskPenalty = riskPenaltyFromLevel(decision.riskLevel)
  const beforeClamp =
    swing.score * 0.45 + short.score * 0.3 + position.score * 0.25 + alignBonus - riskPenalty

  const categoryTerms: CategoryFormulaTerm[] = RESEARCH_CATEGORIES.map((def) => {
    const cell = resolveCategoryCell(def, decision)
    return {
      label: def.label,
      weight: def.researchWeight,
      score: cell.score ?? 0,
      confidence: cell.confidence ?? 0,
      contribution: cell.contribution ?? 0,
      implemented: def.implemented && cell.score != null,
    }
  })

  const categorySum = categoryTerms
    .filter((t) => t.implemented)
    .reduce((acc, t) => acc + t.contribution, 0)

  return {
    horizonBlend: {
      short,
      swing,
      position,
      alignBonus,
      riskPenalty,
      beforeClamp: Math.round(beforeClamp * 10) / 10,
      composite: decision.compositeScore,
    },
    categorySum: Math.round(categorySum * 10) / 10,
    categoryTerms,
    confidence: decision.confidence,
  }
}

/** Multi-line tooltip with substituted numeric values. */
export function formatCompositeFormulaTooltip(f: CompositeFormulaBreakdown): string {
  const { short, swing, position, alignBonus, riskPenalty, beforeClamp, composite } =
    f.horizonBlend
  const lines = [
    "Engine composite (horizon blend):",
    `  0.45×${swing.label} + 0.30×${short.label} + 0.25×${position.label} + align − risk`,
    `  = 0.45×${swing.score.toFixed(1)} + 0.30×${short.score.toFixed(1)} + 0.25×${position.score.toFixed(1)} + (${alignBonus >= 0 ? "+" : ""}${alignBonus.toFixed(0)}) − ${riskPenalty.toFixed(0)}`,
    `  = ${beforeClamp.toFixed(1)} → ${composite.toFixed(0)} (after overrides/clamp)`,
    "",
    "Research category sum (implemented):",
    `  Σ (score × weight × confidence × 100) = ${f.categorySum.toFixed(1)}`,
  ]
  for (const t of f.categoryTerms.filter((x) => x.implemented)) {
    lines.push(
      `  ${t.label}: ${t.score >= 0 ? "+" : ""}${(t.score * 100).toFixed(0)}% × ${(t.weight * 100).toFixed(0)}% × ${(t.confidence * 100).toFixed(0)}% = ${t.contribution.toFixed(1)}`,
    )
  }
  lines.push("", `Model confidence: ${(f.confidence * 100).toFixed(0)}%`)
  return lines.join("\n")
}

export function buildStockCategoryBreakdown(row: ResearchStockRow): StockCategoryBreakdown {
  const decision = resolveDecision(row)
  const cells: Record<string, CategoryCell> = {}

  for (const def of RESEARCH_CATEGORIES) {
    cells[def.id] = resolveCategoryCell(def, decision)
  }

  const formula = buildCompositeFormula(decision)

  return {
    symbol: row.symbol,
    name: row.name,
    compositeScore: decision.compositeScore,
    compositeConfidence: decision.confidence,
    unscored: isUnscoredDecision(decision),
    cells,
    formula,
  }
}

export function sumImplementedContributions(breakdown: StockCategoryBreakdown): number {
  let sum = 0
  for (const def of RESEARCH_CATEGORIES) {
    const c = breakdown.cells[def.id]?.contribution
    if (c != null && def.implemented) sum += c
  }
  return Math.round(sum * 10) / 10
}
