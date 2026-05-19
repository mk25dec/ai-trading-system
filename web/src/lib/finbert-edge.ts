import type { FinbertMetrics, NewsFeatures } from "@/lib/pipeline-api"

/** Horizon window weights aligned with decision_engine sentimentWindow. */
const WINDOW_WEIGHTS = {
  short: { h1: 0.65, h4: 0.25, h24: 0.1 },
  swing: { h1: 0.2, h4: 0.35, h24: 0.45 },
  position: { h1: 0.1, h4: 0.25, h24: 0.65 },
} as const

export type FinbertHorizonKind = keyof typeof WINDOW_WEIGHTS

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

function probEdge(
  pos?: number,
  neg?: number,
  neu?: number,
): number | undefined {
  if (pos == null && neg == null) return undefined
  let s = (pos ?? 0) - (neg ?? 0)
  const u = neu ?? 0
  if (u > 0.55) s *= 0.5
  return clamp(s, -1, 1)
}

function windowEdge(fb: FinbertMetrics, win: "1h" | "4h" | "24h"): number | undefined {
  if (win === "1h" && fb.weightedSentiment1h != null) return fb.weightedSentiment1h
  if (win === "24h" && fb.weightedSentiment24h != null) return fb.weightedSentiment24h
  if (win === "1h")
    return probEdge(fb.avgProbPositive1h, fb.avgProbNegative1h, fb.avgProbNeutral1h)
  if (win === "4h")
    return probEdge(fb.avgProbPositive4h, fb.avgProbNegative4h, fb.avgProbNeutral4h)
  return probEdge(fb.avgProbPositive24h, fb.avgProbNegative24h, fb.avgProbNeutral24h)
}

function entropyDiscount(score: number, entropy?: number): number {
  if (entropy == null || entropy <= 1.2) return score
  const factor = Math.max(0.55, 1 - (entropy - 1.2) * 0.35)
  return score * factor
}

/**
 * Signed FinBERT edge [−1, 1] for price projection, horizon-weighted (mirrors Go finbertHorizonScore).
 */
export function finbertHorizonEdge(
  news: NewsFeatures | undefined,
  horizon: FinbertHorizonKind = "position",
): { edge: number; confidence: number } {
  if (!news?.finbert) return { edge: 0, confidence: 0 }
  const fb = news.finbert
  const sw = WINDOW_WEIGHTS[horizon]

  const wins: { w: number; count: number; win: "1h" | "4h" | "24h" }[] = [
    { w: sw.h1, count: news.newsCount1h, win: "1h" },
    { w: sw.h4, count: news.newsCount4h, win: "4h" },
    { w: sw.h24, count: news.newsCount24h, win: "24h" },
  ]

  let acc = 0
  let wsum = 0
  for (const x of wins) {
    if (x.w <= 0 || x.count === 0) continue
    const edge = windowEdge(fb, x.win)
    if (edge == null) continue
    const coverage = Math.min(1, x.count / 3)
    let val = edge
    if (x.win === "24h") val = entropyDiscount(val, fb.labelEntropy24h)
    acc += val * x.w * coverage
    wsum += x.w * coverage
  }

  if (wsum === 0) {
    const fallback =
      fb.weightedSentiment24h ??
      probEdge(fb.avgProbPositive24h, fb.avgProbNegative24h, fb.avgProbNeutral24h)
    if (fallback == null) return { edge: 0, confidence: 0 }
    return { edge: clamp(fallback, -1, 1), confidence: fb.avgConfidence24h ?? 0.45 }
  }

  let score = clamp(acc / wsum, -1, 1)
  if (fb.maxProbNegative24h != null && fb.maxProbNegative24h > 0.75) {
    score -= 0.12 * ((fb.maxProbNegative24h - 0.75) / 0.25)
  }
  if (fb.maxProbPositive24h != null && fb.maxProbPositive24h > 0.75) {
    score += 0.08 * ((fb.maxProbPositive24h - 0.75) / 0.25)
  }
  if (news.positiveNewsSpike) score = clamp(score + 0.2, -1, 1)
  if (news.negativeNewsSpike) score = clamp(score - 0.28, -1, 1)

  const conf = clamp(fb.avgConfidence24h ?? fb.maxConfidence24h ?? 0.45, 0.2, 0.95)
  return { edge: score, confidence: conf }
}
