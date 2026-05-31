import type {
  DecisionView,
  FinbertMetrics,
  NewsFeatures,
  ResearchStockRow,
} from "@/lib/pipeline-api"

export function resolveDecision(row: ResearchStockRow): DecisionView {
  if (row.decision && row.decision.horizons?.length >= 3) {
    return row.decision
  }
  return unavailableDecision()
}

function unavailableDecision(): DecisionView {
  return {
    primaryAction: "watch",
    primaryOutlook: "No data",
    compositeScore: 0,
    confidence: 0,
    riskLevel: "medium",
    alignment: "mixed",
    conflict: false,
    newsStance: "unknown",
    priceTrend: "unknown",
    drivers: ["Decision engine data not loaded for this symbol"],
    horizons: [
      { id: "short", label: "3D", score: 0, outlook: "watch", confidence: 0 },
      { id: "swing", label: "1W", score: 0, outlook: "watch", confidence: 0 },
      { id: "position", label: "1M", score: 0, outlook: "watch", confidence: 0 },
    ],
  }
}

export function hasNewsCoverage(news?: NewsFeatures | null): boolean {
  if (!news) return false
  return (news.newsCount1h ?? 0) > 0 || (news.newsCount4h ?? 0) > 0 || (news.newsCount24h ?? 0) > 0
}

function finbertHasMetrics(fb: FinbertMetrics): boolean {
  return (
    fb.avgProbPositive24h != null ||
    fb.avgProbNegative24h != null ||
    fb.weightedSentiment24h != null ||
    fb.positiveLabelPct24h != null ||
    fb.avgProbPositive1h != null ||
    fb.avgProbPositive4h != null
  )
}

export function finbertForRow(row: ResearchStockRow): FinbertMetrics | undefined {
  const nested = row.news?.finbert
  if (!nested || !finbertHasMetrics(nested)) return undefined
  return nested
}

export function outlookToLabel(outlook: string): string {
  switch (outlook) {
    case "strong_buy":
      return "Strong buy"
    case "buy":
      return "Buy"
    case "sell":
      return "Sell"
    case "avoid":
      return "Avoid"
    default:
      return "Watch"
  }
}

export function alignmentLabel(alignment: string): string {
  switch (alignment) {
    case "aligned_bullish":
      return "Aligned ↑"
    case "aligned_bearish":
      return "Aligned ↓"
    case "divergent":
      return "Divergent"
    default:
      return "Mixed"
  }
}

export function stanceLabel(stance: string): string {
  switch (stance) {
    case "bullish":
      return "Bullish"
    case "bearish":
      return "Bearish"
    case "neutral":
      return "Neutral"
    case "no_news":
      return "No news"
    default:
      return "Unknown"
  }
}

/** Explains outlook vs trade action (they can diverge when confidence is low). */
export function signalSubline(decision: DecisionView): string {
  const outlook = decision.primaryOutlook
  const parts = [`Outlook: ${outlook}`]
  if (decision.primaryAction === "watch" && outlook !== "Watch" && outlook !== "No data") {
    parts.push("trade gated")
  }
  if (
    decision.primaryAction === "watch" &&
    decision.confidence < 0.35 &&
    decision.compositeScore > 0
  ) {
    parts.push(`conf ${(decision.confidence * 100).toFixed(0)}%`)
  }
  return parts.join(" · ")
}

export function buildTraderKpis(
  rows: ResearchStockRow[],
  extras?: { buy?: number; sell?: number; avoid?: number; watchlist?: number; quality?: string },
) {
  const d = summarizeDecisions(rows)
  return [
    {
      label: "Watchlist",
      value: extras?.watchlist ?? rows.length,
      hint: "Symbols scored",
      icon: "target" as const,
      tone: "neutral" as const,
    },
    {
      label: "Buy signals",
      value: extras?.buy ?? rows.filter((r) => resolveDecision(r).primaryAction === "buy_candidate").length,
      hint: "Actionable long bias",
      icon: "bull" as const,
      tone: "positive" as const,
    },
    {
      label: "Sell / avoid",
      value:
        extras?.sell != null && extras?.avoid != null
          ? extras.sell + extras.avoid
          : rows.filter((r) => {
              const a = resolveDecision(r).primaryAction
              return a === "sell_candidate" || a === "avoid"
            }).length,
      hint: "Reduce or exit bias",
      icon: "bear" as const,
      tone: "negative" as const,
    },
    {
      label: "Horizons aligned ↑",
      value: d.alignedBull,
      hint: "3D · 1W · 1M bullish",
      icon: "bull" as const,
      tone: d.alignedBull > 0 ? ("positive" as const) : ("neutral" as const),
    },
    {
      label: "Conflicts",
      value: d.conflict,
      hint: "Price vs news or horizons",
      icon: "conflict" as const,
      tone: d.conflict > 0 ? ("warning" as const) : ("neutral" as const),
    },
    {
      label: "High risk",
      value: d.highRisk,
      hint: extras?.quality ? `Avg quality ${extras.quality}` : "Volatility / spikes",
      icon: "risk" as const,
      tone: d.highRisk > 0 ? ("warning" as const) : ("neutral" as const),
    },
  ]
}

function summarizeDecisions(rows: ResearchStockRow[]) {
  let alignedBull = 0
  let alignedBear = 0
  let conflict = 0
  let highRisk = 0

  for (const row of rows) {
    const d = resolveDecision(row)
    if (d.alignment === "aligned_bullish") alignedBull++
    if (d.alignment === "aligned_bearish") alignedBear++
    if (d.conflict) conflict++
    if (d.riskLevel === "high") highRisk++
  }

  return { alignedBull, alignedBear, conflict, highRisk }
}
