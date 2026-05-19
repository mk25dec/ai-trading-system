import type { DecisionView, MarketCandle, MarketFeatures } from "@/lib/pipeline-api"

const TRADING_DAYS_3M = 63
const PROJECT_DAYS = 21

export interface PriceOutlookProjection {
  historical: number[]
  projected: number[]
  pBull3M: number
  pBear3M: number
  driftPct: number
  lastPrice: number
  projectedPrice3M: number
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/** Logistic map composite 0–100 → P(up) at 3M horizon. */
function compositeToProbability(composite: number, confidence: number, positionScore: number): number {
  const logistic = 1 / (1 + Math.exp(-(composite - 50) / 11))
  const positionPrior = positionScore / 100
  return clamp(logistic * 0.55 + positionPrior * 0.35 + confidence * 0.1, 0.05, 0.95)
}

function linearSlope(values: number[]): number {
  const n = values.length
  if (n < 2) return 0
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0
  for (let i = 0; i < n; i++) {
    sumX += i
    sumY += values[i]
    sumXY += i * values[i]
    sumXX += i * i
  }
  const denom = n * sumXX - sumX * sumX
  if (denom === 0) return 0
  return (n * sumXY - sumX * sumY) / denom
}

export function buildPriceOutlook(
  candles: MarketCandle[],
  decision: DecisionView,
  market?: MarketFeatures,
): PriceOutlookProjection | null {
  if (candles.length < 8) return null

  const chron = candles.slice(-TRADING_DAYS_3M)
  const closes = chron.map((c) => c.close)
  const last = closes[closes.length - 1]

  const tail = closes.slice(-20)
  const slope = linearSlope(tail)
  const volBoost = market?.volatility != null ? 1 + market.volatility * 8 : 1
  const driftPct =
    market?.priceChange5d != null
      ? market.priceChange5d / 5
      : ((last - closes[0]) / closes[0] / closes.length) * 100

  const projected: number[] = []
  for (let i = 1; i <= PROJECT_DAYS; i++) {
    const trend = slope * volBoost
    const drift = last * (driftPct / 100) * (i / PROJECT_DAYS)
    projected.push(last + trend * i + drift)
  }

  const position = decision.horizons?.find((h) => h.id === "position")
  const pBull3M = compositeToProbability(
    decision.compositeScore,
    decision.confidence,
    position?.score ?? decision.compositeScore,
  )

  return {
    historical: closes,
    projected,
    pBull3M,
    pBear3M: 1 - pBull3M,
    driftPct,
    lastPrice: last,
    projectedPrice3M: projected[projected.length - 1],
  }
}

export function formatPriceOutlookTooltip(
  outlook: PriceOutlookProjection,
  symbol: string,
): string {
  const pct =
    ((outlook.projectedPrice3M - outlook.lastPrice) / outlook.lastPrice) * 100
  return [
    `${symbol} — 3M price outlook`,
    `Last: $${outlook.lastPrice.toFixed(2)}`,
    `Projected (~63d): $${outlook.projectedPrice3M.toFixed(2)} (${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%)`,
    `Drift (5d/5): ${outlook.driftPct >= 0 ? "+" : ""}${outlook.driftPct.toFixed(2)}%/day est.`,
    `P(bullish 3M): ${(outlook.pBull3M * 100).toFixed(0)}%`,
    `P(bearish 3M): ${(outlook.pBear3M * 100).toFixed(0)}%`,
    "",
    "Projection: linear trend on last 20 sessions + 5d drift,",
    "adjusted by volatility. P(up) from composite + 1M horizon.",
  ].join("\n")
}
