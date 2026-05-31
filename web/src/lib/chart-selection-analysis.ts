import type { PriceChartPoint } from "@/lib/pipeline-api"

export type ChartTrend = "up" | "down" | "flat"

export interface ChartSelectionAnalysis {
  start: string
  end: string
  barCount: number
  open: number
  close: number
  high: number
  low: number
  change: number
  changePct: number
  /** Std dev of minute-to-minute % returns in the window. */
  volatilityPct: number
  avgPredictedError?: number
  predictionCoveragePct: number
  trend: ChartTrend
}

function parseMs(timestamp: string): number {
  const ms = new Date(timestamp).getTime()
  return Number.isNaN(ms) ? 0 : ms
}

function trendFromChangePct(pct: number): ChartTrend {
  if (pct > 0.15) return "up"
  if (pct < -0.15) return "down"
  return "flat"
}

/** Compute summary stats for price points within [startMs, endMs] (inclusive). */
export function analyzeChartSelection(
  points: PriceChartPoint[],
  startMs: number,
  endMs: number,
): ChartSelectionAnalysis | null {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) {
    return null
  }
  const lo = Math.min(startMs, endMs)
  const hi = Math.max(startMs, endMs)
  const slice = points.filter((p) => {
    const t = parseMs(p.timestamp)
    return t >= lo && t <= hi
  })
  if (slice.length < 2) return null

  const open = slice[0].close
  const close = slice[slice.length - 1].close
  let high = -Infinity
  let low = Infinity
  for (const p of slice) {
    high = Math.max(high, p.close)
    low = Math.min(low, p.close)
  }

  const change = close - open
  const changePct = open !== 0 ? (change / open) * 100 : 0

  const returns: number[] = []
  for (let i = 1; i < slice.length; i++) {
    const prev = slice[i - 1].close
    if (prev > 0) {
      returns.push(((slice[i].close - prev) / prev) * 100)
    }
  }
  let volatilityPct = 0
  if (returns.length > 0) {
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length
    const variance =
      returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length
    volatilityPct = Math.sqrt(variance)
  }

  const withPred = slice.filter((p) => p.predictedPrice1 != null)
  let avgPredictedError: number | undefined
  if (withPred.length > 0) {
    const mae =
      withPred.reduce((sum, p) => sum + Math.abs((p.predictedPrice1 ?? 0) - p.close), 0) /
      withPred.length
    avgPredictedError = mae
  }

  return {
    start: slice[0].timestamp,
    end: slice[slice.length - 1].timestamp,
    barCount: slice.length,
    open,
    close,
    high,
    low,
    change,
    changePct,
    volatilityPct,
    avgPredictedError,
    predictionCoveragePct: (withPred.length / slice.length) * 100,
    trend: trendFromChangePct(changePct),
  }
}
