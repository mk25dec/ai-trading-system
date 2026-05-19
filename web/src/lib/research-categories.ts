import type { CategoryScore, DecisionView, ResearchStockRow } from "@/lib/pipeline-api"
import { resolveDecision } from "@/lib/decision-engine"

/** v2 baseline categories from my-research.md §5 */
export interface ResearchCategoryDef {
  id: string
  label: string
  researchWeight: number
  /** Backend category ids merged into this row */
  backendIds: string[]
  implemented: boolean
}

export const RESEARCH_CATEGORIES: ResearchCategoryDef[] = [
  {
    id: "technical",
    label: "Technical momentum",
    researchWeight: 0.18,
    backendIds: ["technical"],
    implemented: true,
  },
  {
    id: "trend",
    label: "Trend strength",
    researchWeight: 0.1,
    backendIds: ["trend"],
    implemented: true,
  },
  {
    id: "fundamentals",
    label: "Fundamentals",
    researchWeight: 0.18,
    backendIds: [],
    implemented: false,
  },
  {
    id: "valuation",
    label: "Valuation",
    researchWeight: 0.1,
    backendIds: [],
    implemented: false,
  },
  {
    id: "sentiment",
    label: "Sentiment",
    researchWeight: 0.12,
    backendIds: ["sentiment", "finbert"],
    implemented: true,
  },
  {
    id: "earnings",
    label: "Earnings quality",
    researchWeight: 0.08,
    backendIds: [],
    implemented: false,
  },
  {
    id: "regime",
    label: "Market regime",
    researchWeight: 0.08,
    backendIds: [],
    implemented: false,
  },
  {
    id: "sector",
    label: "Sector strength",
    researchWeight: 0.05,
    backendIds: [],
    implemented: false,
  },
  {
    id: "risk",
    label: "Risk analysis",
    researchWeight: 0.06,
    backendIds: ["risk"],
    implemented: true,
  },
  {
    id: "liquidity",
    label: "Liquidity & flow",
    researchWeight: 0.03,
    backendIds: [],
    implemented: false,
  },
  {
    id: "alignment",
    label: "Multi-timeframe alignment",
    researchWeight: 0.02,
    backendIds: [],
    implemented: true,
  },
]

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
  cells: Record<string, CategoryCell>
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

/** Map signed factor score (−1…+1) to 0–100 display scale. */
export function signedToDisplay(score: number): number {
  return Math.round(clamp((score + 1) * 50, 0, 100) * 10) / 10
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
      displayScore: signedToDisplay(score),
    }
  }

  const byId = new Map((decision.categories ?? []).map((c) => [c.id, c]))
  const merged = mergeBackendScores(def.backendIds, byId)
  if (!merged) {
    return empty
  }

  const contribution = merged.score * def.researchWeight * merged.confidence * 100
  return {
    score: merged.score,
    confidence: merged.confidence,
    contribution: Math.round(contribution * 10) / 10,
    displayScore: signedToDisplay(merged.score),
  }
}

export function buildStockCategoryBreakdown(row: ResearchStockRow): StockCategoryBreakdown {
  const decision = resolveDecision(row)
  const cells: Record<string, CategoryCell> = {}

  for (const def of RESEARCH_CATEGORIES) {
    cells[def.id] = resolveCategoryCell(def, decision)
  }

  return {
    symbol: row.symbol,
    name: row.name,
    compositeScore: decision.compositeScore,
    compositeConfidence: decision.confidence,
    cells,
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
