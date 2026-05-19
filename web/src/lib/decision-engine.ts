import type {
  DecisionView,
  FinbertMetrics,
  HorizonOutlook,
  MarketFeatures,
  OutlookLabel,
  ResearchStockRow,
} from "@/lib/pipeline-api"

export function resolveDecision(row: ResearchStockRow): DecisionView {
  const base =
    row.decision && row.decision.horizons?.length >= 3
      ? row.decision
      : fallbackDecision(row)
  return enrichNewsStance(base, row)
}

function enrichNewsStance(d: DecisionView, row: ResearchStockRow): DecisionView {
  if (d.newsStance && d.newsStance !== "unknown") {
    return d
  }
  const inferred = inferNewsFromRow(row)
  if (!inferred) {
    return d
  }
  return {
    ...d,
    newsStance: inferred.stance,
    newsConfidence: inferred.confidence ?? d.newsConfidence,
  }
}

function inferNewsFromRow(row: ResearchStockRow): { stance: string; confidence?: number } | null {
  const nf = row.news
  if (!nf) {
    return { stance: "no_news" }
  }
  const articles = nf.newsCount24h || nf.newsCount4h || nf.newsCount1h || 0
  if (articles === 0) {
    return { stance: "no_news" }
  }

  const fb = finbertForRow(row)
  let score: number | undefined
  const confParts: number[] = []
  let acc = 0
  let wsum = 0

  const addWindow = (sent?: number, count?: number, weight = 1, modelConf?: number) => {
    if (sent == null || !count) return
    const coverage = Math.min(1, count / 3)
    acc += sent * weight * coverage
    wsum += weight * coverage
    if (modelConf != null) confParts.push(modelConf)
  }

  addWindow(nf.avgSentiment1h, nf.newsCount1h, 1.2, fb?.avgConfidence1h)
  addWindow(nf.avgSentiment4h, nf.newsCount4h, 1, fb?.avgConfidence4h)
  addWindow(nf.avgSentiment24h, nf.newsCount24h, 0.85, fb?.avgConfidence24h)
  if (wsum > 0) score = acc / wsum

  if (score == null && fb?.weightedSentiment24h != null) {
    score = fb.weightedSentiment24h
    if (fb.avgConfidence24h != null) confParts.push(fb.avgConfidence24h)
  } else if (score == null && fb?.positiveLabelPct24h != null) {
    const pos = fb.positiveLabelPct24h
    const neg = fb.negativeLabelPct24h ?? 0
    score = pos - neg
    confParts.push(0.45)
  } else if (score == null && nf.avgSentiment24h != null) {
    score = nf.avgSentiment24h
  }

  if (score != null) {
    const sampleConf = 1 - Math.exp(-articles / 5)
    const modelConf =
      confParts.length > 0
        ? confParts.reduce((a, b) => a * b, 1) ** (1 / confParts.length)
        : 0.35
    return {
      stance: stanceFromSentiment(score),
      confidence: Math.min(0.95, Math.sqrt(sampleConf * modelConf)),
    }
  }

  return { stance: "neutral", confidence: 0.22 }
}

function fallbackDecision(row: ResearchStockRow): DecisionView {
  const composite = Math.round(Math.min(100, Math.max(0, 50 + row.score * 25)) * 10) / 10
  const outlook = scoreToOutlook(composite)
  const horizon: HorizonOutlook = {
    id: "swing",
    label: "1W",
    score: composite,
    outlook,
    confidence: row.confidence,
  }
  return {
    primaryAction: row.recommendation,
    primaryOutlook: outlookToLabel(outlook),
    compositeScore: composite,
    confidence: row.confidence,
    riskLevel: "medium",
    alignment: "mixed",
    conflict: false,
    newsStance: stanceFromSentiment(row.news?.avgSentiment24h),
    priceTrend: priceTrendFromMarket(row.market),
    drivers: row.bullets.slice(0, 2),
    horizons: [
      { ...horizon, id: "short", label: "3D" },
      horizon,
      { ...horizon, id: "position", label: "1M" },
    ],
  }
}

export function finbertForRow(row: ResearchStockRow): FinbertMetrics | undefined {
  const nested = row.news?.finbert
  if (nested && Object.keys(nested).length > 0) return nested
  return undefined
}

export function outlookToLabel(outlook: OutlookLabel | string): string {
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

export function outlookTone(
  outlook: OutlookLabel | string,
): "positive" | "negative" | "neutral" {
  if (outlook === "strong_buy" || outlook === "buy") return "positive"
  if (outlook === "sell" || outlook === "avoid") return "negative"
  return "neutral"
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

export function riskTone(level: string): "positive" | "negative" | "neutral" {
  if (level === "low") return "positive"
  if (level === "high") return "negative"
  return "neutral"
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

/** When trade action is cautious but composite outlook is directional. */
export function signalSubline(decision: DecisionView): string {
  const outlook = decision.primaryOutlook
  if (decision.primaryAction === "watch" && outlook !== "Watch") {
    return `Outlook: ${outlook} · cautious`
  }
  return `Outlook: ${outlook}`
}

export function priceTrendLabel(trend: string): string {
  switch (trend) {
    case "uptrend":
      return "Uptrend"
    case "downtrend":
      return "Downtrend"
    case "sideways":
      return "Sideways"
    default:
      return "—"
  }
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

export function summarizeDecisions(rows: ResearchStockRow[]) {
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

function scoreToOutlook(score: number): OutlookLabel {
  if (score >= 78) return "strong_buy"
  if (score >= 62) return "buy"
  if (score >= 45) return "watch"
  if (score >= 32) return "sell"
  return "avoid"
}

function stanceFromSentiment(s?: number): string {
  if (s == null) return "unknown"
  if (s > 0.2) return "bullish"
  if (s < -0.2) return "bearish"
  return "neutral"
}

function priceTrendFromMarket(m?: MarketFeatures): string {
  if (m?.priceChange24h == null) return "unknown"
  if (m.priceChange24h > 2) return "uptrend"
  if (m.priceChange24h < -2) return "downtrend"
  return "sideways"
}
