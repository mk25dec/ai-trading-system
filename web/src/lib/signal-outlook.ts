import { outlookToLabel } from "@/lib/decision-engine"
import type {
  DecisionView,
  MarketCandle,
  PriceChartPoint,
} from "@/lib/pipeline-api"

export function candlesToChartPoints(candles: MarketCandle[]): PriceChartPoint[] {
  return candles.map((c) => ({
    timestamp: c.timestamp,
    close: c.close,
  }))
}

export function bullishProbability(decision: DecisionView): number {
  const position =
    decision.horizons.find((h) => h.id === "position") ??
    decision.horizons[decision.horizons.length - 1]
  return position?.score ?? 50
}

export function formatSignalOutlookTooltip(
  symbol: string,
  candles: MarketCandle[],
  forwardPoints: PriceChartPoint[] | undefined,
  decision: DecisionView,
): string {
  const history = candles.slice(-21)
  const forward = forwardPoints ?? []
  const lastHist = history[history.length - 1]?.close
  const lastFwd = forward[forward.length - 1]?.close
  const lines = [`${symbol} · price outlook`, ""]
  if (lastHist != null) {
    lines.push(`Last close: $${lastHist.toFixed(2)}`)
  }
  if (lastHist != null && lastFwd != null) {
    const changePct = ((lastFwd - lastHist) / lastHist) * 100
    lines.push(
      `Projected (+3D path): $${lastFwd.toFixed(2)} (${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%)`,
    )
  }
  lines.push("")
  for (const h of decision.horizons) {
    lines.push(`${h.label}: ${h.score.toFixed(0)} · ${outlookToLabel(h.outlook)}`)
  }
  return lines.join("\n")
}
