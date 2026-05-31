import { resolveDecision } from "@/lib/decision-engine"
import type { RecommendationAction, ResearchStockRow, SymbolFeatureSnapshot } from "@/lib/pipeline-api"

export function formatPct(v?: number | null) {
  if (v == null || Number.isNaN(v)) return "—"
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`
}

export function formatNum(v?: number | null, digits = 2) {
  if (v == null || Number.isNaN(v)) return "—"
  return v.toFixed(digits)
}

export function formatSentiment(v?: number | null) {
  if (v == null || Number.isNaN(v)) return "—"
  return v.toFixed(2)
}

/** FinBERT softmax probability as percentage (0–100). */
export function formatProb(v?: number | null) {
  if (v == null || Number.isNaN(v)) return "—"
  return `${(v * 100).toFixed(1)}%`
}

/** Label share as percentage. */
export function formatLabelPct(v?: number | null) {
  if (v == null || Number.isNaN(v)) return "—"
  return `${(v * 100).toFixed(0)}%`
}

export function sentimentTone(v: number): "bullish" | "bearish" | "neutral" {
  if (v > 0.2) return "bullish"
  if (v < -0.2) return "bearish"
  return "neutral"
}

export function rsiLabel(rsi?: number | null): string | null {
  if (rsi == null) return null
  if (rsi >= 70) return "Overbought"
  if (rsi <= 30) return "Oversold"
  return null
}

export function pctClass(v?: number | null) {
  if (v == null || Number.isNaN(v)) return "text-muted-foreground"
  if (v > 0.5) return "text-emerald-600 dark:text-emerald-400"
  if (v < -0.5) return "text-red-600 dark:text-red-400"
  return "text-muted-foreground"
}

export function sentimentClass(v?: number | null) {
  if (v == null || Number.isNaN(v)) return "text-muted-foreground"
  if (v > 0.2) return "text-emerald-600 dark:text-emerald-400"
  if (v < -0.2) return "text-red-600 dark:text-red-400"
  return "text-muted-foreground"
}

export function probClass(v?: number | null, invert = false) {
  if (v == null || Number.isNaN(v)) return "text-muted-foreground"
  const high = v >= 0.55
  const low = v <= 0.25
  if (invert) {
    if (high) return "text-red-600 dark:text-red-400"
    if (low) return "text-emerald-600 dark:text-emerald-400"
  } else {
    if (high) return "text-emerald-600 dark:text-emerald-400"
    if (low) return "text-red-600 dark:text-red-400"
  }
  return "text-muted-foreground"
}

const recOrder: Record<RecommendationAction, number> = {
  buy_candidate: 0,
  sell_candidate: 1,
  watch: 2,
  avoid: 3,
}

export function sortResearchRows(rows: ResearchStockRow[]) {
  return [...rows].sort((a, b) => {
    const da = resolveDecision(a)
    const db = resolveDecision(b)
    return (
      (recOrder[a.recommendation] ?? 9) - (recOrder[b.recommendation] ?? 9) ||
      db.compositeScore - da.compositeScore ||
      b.confidence - a.confidence
    )
  })
}

export function snapshotBySymbol(snapshots: SymbolFeatureSnapshot[]) {
  return new Map(snapshots.map((s) => [s.symbol, s]))
}

export type FeatureRow = ResearchStockRow & {
  snapshot?: SymbolFeatureSnapshot
}

export function summarizeRows(rows: FeatureRow[]) {
  let buy = 0
  let sell = 0
  let avoid = 0
  let negSpike = 0
  let posSpike = 0
  let qualitySum = 0
  let qualityN = 0

  for (const row of rows) {
    if (row.recommendation === "buy_candidate") buy++
    if (row.recommendation === "sell_candidate") sell++
    if (row.recommendation === "avoid") avoid++
    if (row.news?.negativeNewsSpike) negSpike++
    if (row.news?.positiveNewsSpike) posSpike++
    if (row.snapshot) {
      qualitySum += row.snapshot.dataQualityScore
      qualityN++
    }
  }

  return {
    total: rows.length,
    buy,
    sell,
    avoid,
    negSpike,
    posSpike,
    avgQuality: qualityN > 0 ? qualitySum / qualityN : null,
  }
}
