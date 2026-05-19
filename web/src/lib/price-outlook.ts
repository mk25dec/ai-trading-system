import type {
  DecisionView,
  MarketCandle,
  MarketFeatures,
  NewsFeatures,
} from "@/lib/pipeline-api"
import { CALIBRATION } from "@/lib/calibration"
import { finbertHorizonEdge, type FinbertHorizonKind } from "@/lib/finbert-edge"

/** Trading-day horizons shown on the projection axis (after last close). */
export const PROJECTION_HORIZONS = [
  { id: "3d", label: "3D", days: 3 },
  { id: "1w", label: "1W", days: 5 },
  { id: "2w", label: "2W", days: 10 },
  { id: "3w", label: "3W", days: 15 },
  { id: "1m", label: "1M", days: 21 },
] as const

const MAX_HISTORY = 63
const MAX_PROJECT_DAYS = 21

export interface PriceOutlookPoint {
  index: number
  date?: string
  close: number
  kind: "history" | "projected"
}

export interface ProjectionZone {
  label: string
  startIndex: number
  endIndex: number
}

export interface PriceOutlookProjection {
  points: PriceOutlookPoint[]
  /** ±1σ upper bound (projected segment only). */
  bandUpper: PriceOutlookPoint[]
  /** ±1σ lower bound (projected segment only). */
  bandLower: PriceOutlookPoint[]
  zones: ProjectionZone[]
  anchors: { label: string; index: number; price: number }[]
  historicalCount: number
  pBull3M: number
  pBear3M: number
  driftPct: number
  lastPrice: number
  projectedPrice1M: number
  finbertEdge: number
  /** @deprecated use points */
  historical: number[]
  /** @deprecated use points */
  projected: number[]
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
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

function horizonScore(decision: DecisionView, id: string, fallback: number): number {
  const h = decision.horizons?.find((x) => x.id === id)
  if (!h || h.score <= 0) return fallback
  return h.score
}

function horizonKindForProjection(id: string): FinbertHorizonKind {
  if (id === "3d") return "short"
  if (id === "1w" || id === "2w") return "swing"
  return "position"
}

/**
 * P(up): logistic composite + horizon prior + confidence + momentum + FinBERT edge.
 */
function compositeToProbability(
  composite: number,
  confidence: number,
  shortScore: number,
  swingScore: number,
  positionScore: number,
  momentumPct: number,
  finbertEdge: number,
  finbertConf: number,
): number {
  if (composite <= 0 && confidence <= 0.2) {
    return 0.5
  }
  const logistic =
    1 /
    (1 +
      Math.exp(
        -(composite - CALIBRATION.logisticCenter) / CALIBRATION.logisticScale,
      ))
  const horizonPrior =
    shortScore * 0.2 + swingScore * 0.35 + positionScore * 0.45
  const prior = horizonPrior / 100
  const mom = clamp(momentumPct / 8, -0.15, 0.15)
  const fb =
    finbertEdge *
    CALIBRATION.pUpFinbertWeight *
    clamp(finbertConf, 0.25, 0.95)
  return clamp(
    logistic * 0.5 + prior * 0.35 + confidence * 0.1 + mom + fb,
    0.04,
    0.96,
  )
}

/**
 * Expected return % over `days`: score edge × vol × √t + trend + FinBERT edge (Sprint D).
 */
function expectedReturnPct(
  score100: number,
  days: number,
  annualizedVol: number,
  trendSlopePerDay: number,
  lastPrice: number,
  finbertEdge: number,
): number {
  const edge = score100 / 100 - 0.5 + finbertEdge * CALIBRATION.pUpFinbertWeight
  const dailyVol = annualizedVol / Math.sqrt(252)
  const volComponent = edge * dailyVol * Math.sqrt(days) * 100 * 1.25
  const trendComponent =
    lastPrice > 0 ? (trendSlopePerDay / lastPrice) * days * 100 : 0
  return volComponent + trendComponent
}

/** P_T band: center return μ and ±1σ from annualized vol (√time scaling). */
function projectionBandPrices(
  last: number,
  days: number,
  muPct: number,
  annualizedVol: number,
): { center: number; upper: number; lower: number } {
  const mu = muPct / 100
  const sigma = (annualizedVol / Math.sqrt(252)) * Math.sqrt(days)
  const center = last * (1 + mu)
  const upper = last * (1 + mu + sigma)
  const lower = last * (1 + mu - sigma)
  return { center, upper, lower }
}

function interpolatePath(
  last: number,
  anchorTargets: { days: number; price: number }[],
  maxDays: number,
): number[] {
  const prices: number[] = []
  let price = last
  for (let d = 1; d <= maxDays; d++) {
    const prev = anchorTargets.filter((a) => a.days <= d).at(-1)
    const next = anchorTargets.find((a) => a.days >= d)
    if (prev && next) {
      const span = next.days - prev.days || 1
      const t = (d - prev.days) / span
      const target = prev.price + (next.price - prev.price) * t
      price = price * 0.55 + target * 0.45
    }
    prices.push(price)
  }
  return prices
}

export function buildPriceOutlook(
  candles: MarketCandle[],
  decision: DecisionView,
  market?: MarketFeatures,
  news?: NewsFeatures,
): PriceOutlookProjection | null {
  if (candles.length < 8) return null

  const chron = candles.slice(-MAX_HISTORY)
  const histPoints: PriceOutlookPoint[] = chron.map((c, i) => ({
    index: i,
    date: c.timestamp,
    close: c.close,
    kind: "history" as const,
  }))

  const closes = chron.map((c) => c.close)
  const last = closes[closes.length - 1]
  const histLen = closes.length

  const tail = closes.slice(-20)
  const slope = linearSlope(tail)
  const annualizedVol =
    market?.volatility != null ? clamp(market.volatility, 0.08, 0.85) : 0.22
  const rsi = market?.rsi ?? 50
  const meanRev = rsi > 68 ? -0.08 : rsi < 32 ? 0.08 : 0

  const shortScore = horizonScore(decision, "short", decision.compositeScore)
  const swingScore = horizonScore(decision, "swing", decision.compositeScore)
  const positionScore = horizonScore(decision, "position", decision.compositeScore)

  const { edge: finbertEdge, confidence: finbertConf } = finbertHorizonEdge(
    news,
    "position",
  )

  const driftPct =
    market?.priceChange5d != null
      ? market.priceChange5d / 5
      : ((last - closes[Math.max(0, closes.length - 6)]) / last) * 100

  const anchorTargets: {
    label: string
    days: number
    price: number
    upper: number
    lower: number
  }[] = []

  for (const hz of PROJECTION_HORIZONS) {
    const score =
      hz.id === "3d"
        ? shortScore
        : hz.id === "1w" || hz.id === "2w"
          ? swingScore
          : positionScore
    const hzKind = horizonKindForProjection(hz.id)
    const { edge: hzFb } = finbertHorizonEdge(news, hzKind)
    const ret =
      expectedReturnPct(score, hz.days, annualizedVol, slope, last, hzFb) +
      meanRev * (hz.days / 21)
    const band = projectionBandPrices(last, hz.days, ret, annualizedVol)
    anchorTargets.push({
      label: hz.label,
      days: hz.days,
      price: band.center,
      upper: band.upper,
      lower: band.lower,
    })
  }

  const centerAnchors = anchorTargets.map((a) => ({ days: a.days, price: a.price }))
  const upperAnchors = anchorTargets.map((a) => ({ days: a.days, price: a.upper }))
  const lowerAnchors = anchorTargets.map((a) => ({ days: a.days, price: a.lower }))

  const centerPath = interpolatePath(last, centerAnchors, MAX_PROJECT_DAYS)
  const upperPath = interpolatePath(last, upperAnchors, MAX_PROJECT_DAYS)
  const lowerPath = interpolatePath(last, lowerAnchors, MAX_PROJECT_DAYS)

  const projPoints: PriceOutlookPoint[] = []
  const bandUpper: PriceOutlookPoint[] = []
  const bandLower: PriceOutlookPoint[] = []

  for (let d = 0; d < MAX_PROJECT_DAYS; d++) {
    const idx = histLen - 1 + d + 1
    projPoints.push({
      index: idx,
      close: centerPath[d],
      kind: "projected",
    })
    bandUpper.push({ index: idx, close: upperPath[d], kind: "projected" })
    bandLower.push({ index: idx, close: lowerPath[d], kind: "projected" })
  }

  const points = [...histPoints, ...projPoints]
  const zones: ProjectionZone[] = []
  let zoneStart = histLen - 1
  for (const hz of PROJECTION_HORIZONS) {
    zones.push({
      label: hz.label,
      startIndex: zoneStart,
      endIndex: histLen - 1 + hz.days,
    })
    zoneStart = histLen - 1 + hz.days
  }

  const anchors = anchorTargets.map((a) => ({
    label: a.label,
    index: histLen - 1 + a.days,
    price: a.price,
  }))

  const pBull3M = compositeToProbability(
    decision.compositeScore,
    decision.confidence,
    shortScore,
    swingScore,
    positionScore,
    driftPct,
    finbertEdge,
    finbertConf,
  )

  const projected = projPoints.map((p) => p.close)
  const historical = closes

  return {
    points,
    bandUpper,
    bandLower,
    zones,
    anchors,
    historicalCount: histLen,
    pBull3M,
    pBear3M: 1 - pBull3M,
    driftPct,
    lastPrice: last,
    projectedPrice1M: projected[projected.length - 1],
    finbertEdge,
    historical,
    projected,
  }
}

export function formatPriceOutlookTooltip(
  outlook: PriceOutlookProjection,
  symbol: string,
): string {
  const pct =
    ((outlook.projectedPrice1M - outlook.lastPrice) / outlook.lastPrice) * 100
  const anchorLines = outlook.anchors.map(
    (a) => `  ${a.label}: $${a.price.toFixed(2)}`,
  )
  const lastUpper = outlook.bandUpper[outlook.bandUpper.length - 1]?.close
  const lastLower = outlook.bandLower[outlook.bandLower.length - 1]?.close
  return [
    `${symbol} — multi-horizon price projection`,
    `Last: $${outlook.lastPrice.toFixed(2)}`,
    `1M target: $${outlook.projectedPrice1M.toFixed(2)} (${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%)`,
    lastUpper != null && lastLower != null
      ? `1M band: $${lastLower.toFixed(2)} – $${lastUpper.toFixed(2)} (±1σ)`
      : "",
    `FinBERT edge: ${outlook.finbertEdge >= 0 ? "+" : ""}${outlook.finbertEdge.toFixed(2)}`,
    `Drift est: ${outlook.driftPct >= 0 ? "+" : ""}${outlook.driftPct.toFixed(2)}%/day`,
    `P(bullish 1M): ${(outlook.pBull3M * 100).toFixed(0)}%`,
    "",
    "Anchors:",
    ...anchorLines,
    "",
    "Model: horizon + FinBERT edge → μ; vol·√t uncertainty band.",
    "Shaded band = ±1σ. Not a price guarantee.",
    "Click chart for detail with crosshair.",
  ]
    .filter(Boolean)
    .join("\n")
}
