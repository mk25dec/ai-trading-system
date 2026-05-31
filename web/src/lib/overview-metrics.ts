import { resolveDecision } from "@/lib/decision-engine"
import type {
  ResearchStockRow,
  WorkflowRun,
  WorkspaceSignal,
} from "@/lib/pipeline-api"

export type PerformanceRange = "7D" | "1M" | "3M" | "1Y" | "All"

export function getTimeGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

export function formatCurrency(value: number): string {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatPctChange(value: number): string {
  const sign = value >= 0 ? "+" : ""
  return `${sign}${value.toFixed(2)}%`
}

export function timeAgo(value?: string | null): string {
  if (!value) return "—"
  const diff = Date.now() - new Date(value).getTime()
  if (diff < 60_000) return "Just now"
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function dateRangeLabel(days = 7): string {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - (days - 1))
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
  return `${fmt(start)} – ${fmt(end)}`
}

function rangeToDays(range: PerformanceRange): number {
  switch (range) {
    case "7D":
      return 7
    case "1M":
      return 30
    case "3M":
      return 90
    case "1Y":
      return 365
    default:
      return 9999
  }
}

export function buildPerformanceSeries(
  rows: ResearchStockRow[],
  range: PerformanceRange,
): { labels: string[]; strategy: number[]; benchmark: (number | null)[] } {
  const days = rangeToDays(range)
  const cutoff = Date.now() - days * 86_400_000

  const byDate = new Map<string, number[]>()
  for (const row of rows) {
    const candles = row.candles.filter((c) => new Date(c.timestamp).getTime() >= cutoff)
    if (candles.length < 2) continue
    const base = candles[0].close
    for (const c of candles) {
      const key = c.timestamp.slice(0, 10)
      const pct = ((c.close - base) / base) * 100
      const bucket = byDate.get(key) ?? []
      bucket.push(pct)
      byDate.set(key, bucket)
    }
  }

  const spyRow = rows.find((r) => r.symbol === "SPY")
  const benchmarkByDate = new Map<string, number>()
  if (spyRow && spyRow.candles.length >= 2) {
    const spyCandles = spyRow.candles.filter((c) => new Date(c.timestamp).getTime() >= cutoff)
    const base = spyCandles[0]?.close
    if (base) {
      for (const c of spyCandles) {
        benchmarkByDate.set(c.timestamp.slice(0, 10), ((c.close - base) / base) * 100)
      }
    }
  }

  const labels = [...byDate.keys()].sort()
  const strategy = labels.map((d) => {
    const vals = byDate.get(d) ?? []
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  })
  const benchmark = labels.map((d) => benchmarkByDate.get(d) ?? null)

  return { labels, strategy, benchmark }
}

export function computeWatchlistNotional(rows: ResearchStockRow[]): number {
  return rows.reduce((sum, row) => sum + (row.lastClose ?? 0), 0)
}

export function computeAvgReturn(rows: ResearchStockRow[], field: "priceChange5d" | "priceChange24h" = "priceChange5d"): number | null {
  const vals = rows
    .map((r) => r.market?.[field])
    .filter((v): v is number => v != null && !Number.isNaN(v))
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

export function countSignalsToday(signals: WorkspaceSignal[]): number {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return signals.filter((s) => new Date(s.timestamp) >= start).length
}

export function countHighConvictionSignals(signals: WorkspaceSignal[], min = 0.7): number {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return signals.filter((s) => new Date(s.timestamp) >= start && s.confidence >= min).length
}

export function confidenceBuckets(signals: WorkspaceSignal[]) {
  let high = 0
  let medium = 0
  let low = 0
  for (const s of signals) {
    if (s.confidence >= 0.7) high++
    else if (s.confidence >= 0.4) medium++
    else low++
  }
  const total = high + medium + low
  return { high, medium, low, total }
}

const PIPELINE_LABELS: Record<string, string> = {
  news: "News pipeline",
  market: "Market data pipeline",
  feature: "Feature pipeline",
  signal: "AI / Signals pipeline",
}

function pipelineKey(name: string): string {
  const lower = name.toLowerCase()
  if (lower.includes("news")) return "news"
  if (lower.includes("market") || lower.includes("alpaca") || lower.includes("symbol")) return "market"
  if (lower.includes("feature")) return "feature"
  if (lower.includes("signal") || lower.includes("finbert") || lower.includes("sentiment")) return "signal"
  return lower
}

export function buildPipelineHealth(runs: WorkflowRun[]) {
  const latest = new Map<string, WorkflowRun>()
  for (const run of runs) {
    const key = pipelineKey(run.workflowName)
    const existing = latest.get(key)
    if (!existing || run.startedAt > existing.startedAt) {
      latest.set(key, run)
    }
  }

  const order = ["news", "market", "feature", "signal"] as const
  const pipelines = order.map((key) => {
    const run = latest.get(key)
    const label = PIPELINE_LABELS[key]
    if (!run) {
      return { key, label, pct: 0, status: "unknown" as const }
    }
    return {
      key,
      label,
      pct: run.status === "success" ? 100 : 0,
      status: run.status,
    }
  })

  const operational = pipelines.every((p) => p.pct === 100 || p.status === "unknown")
  return { pipelines, operational }
}

export function summarizeOverviewKpis(
  rows: ResearchStockRow[],
  signals: WorkspaceSignal[],
) {
  const notional = computeWatchlistNotional(rows)
  const avgReturn = computeAvgReturn(rows)
  const returnUsd = avgReturn != null ? notional * (avgReturn / 100) : 0

  const buyCount = rows.filter((r) => resolveDecision(r).primaryAction === "buy_candidate").length
  const sellCount = rows.filter((r) => resolveDecision(r).primaryAction === "sell_candidate").length
  const watchCount = rows.filter((r) => resolveDecision(r).primaryAction === "watch").length
  const conflictCount = rows.filter((r) => resolveDecision(r).conflict).length

  const actionable = buyCount + sellCount
  const winRate = actionable > 0 ? (buyCount / actionable) * 100 : null

  return {
    notional,
    avgReturn,
    returnUsd,
    winRate,
    buyCount,
    sellCount,
    watchCount,
    conflictCount,
    signalsToday: countSignalsToday(signals),
    highConvictionToday: countHighConvictionSignals(signals),
  }
}

export function convictionLabel(confidence: number): "High" | "Medium" | "Low" {
  if (confidence >= 0.7) return "High"
  if (confidence >= 0.4) return "Medium"
  return "Low"
}

export function trendFromRow(row: ResearchStockRow): "up" | "down" | "flat" {
  const change = row.market?.priceChange24h
  if (change == null) return "flat"
  if (change > 0.5) return "up"
  if (change < -0.5) return "down"
  return "flat"
}
