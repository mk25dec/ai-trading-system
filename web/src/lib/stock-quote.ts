import type { MarketCandle, ResearchStockRow } from "@/lib/pipeline-api"
import { formatPct, pctClass, rsiLabel } from "@/lib/feature-metrics"

export const NA = "N/A"

export interface StockQuoteView {
  symbol: string
  companyName: string | null
  exchange: string | null
  price: number | null
  dayHigh: number | null
  dayLow: number | null
  change24h: number | null
  volume: number | null
  rsi: number | null
  volatility: number | null
}

export function isPlaceholderCompanyName(symbol: string, name?: string | null): boolean {
  const sym = symbol.trim().toUpperCase()
  const n = (name ?? "").trim()
  if (!n) return true
  return n.toUpperCase() === sym
}

/** Company display name, or null when unknown (render as N/A). */
export function resolveCompanyName(symbol: string, name?: string | null): string | null {
  if (isPlaceholderCompanyName(symbol, name)) return null
  return (name ?? "").trim()
}

export function formatCompanyName(symbol: string, name?: string | null): string {
  return resolveCompanyName(symbol, name) ?? NA
}

export function formatExchange(exchange?: string | null): string {
  const ex = (exchange ?? "").trim()
  if (!ex) return NA
  return ex.toUpperCase()
}

export function resolveStockQuote(row: ResearchStockRow): StockQuoteView {
  const latest = latestCandle(row.candles)
  const price = row.lastClose ?? latest?.close ?? null

  return {
    symbol: row.symbol,
    companyName: resolveCompanyName(row.symbol, row.name),
    exchange: (row.exchange ?? "").trim() || null,
    price,
    dayHigh: row.dayHigh ?? latest?.high ?? null,
    dayLow: row.dayLow ?? latest?.low ?? null,
    change24h: row.market?.priceChange24h ?? null,
    volume: latest?.volume ?? null,
    rsi: row.market?.rsi ?? null,
    volatility: row.market?.volatility ?? null,
  }
}

function latestCandle(candles: MarketCandle[]): MarketCandle | undefined {
  if (!candles?.length) return undefined
  return candles[candles.length - 1]
}

export function formatUsd(price: number | null | undefined, digits = 2): string {
  if (price == null || Number.isNaN(price)) return NA
  return `$${price.toFixed(digits)}`
}

export function formatVolume(vol: number | null | undefined): string {
  if (vol == null || vol <= 0) return NA
  if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(1)}B`
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`
  return vol.toLocaleString()
}

export function quoteChangeTone(change24h: number | null | undefined): "up" | "down" | "flat" | "none" {
  if (change24h == null || Number.isNaN(change24h)) return "none"
  if (change24h > 0.05) return "up"
  if (change24h < -0.05) return "down"
  return "flat"
}

export function rsiTone(rsi: number | null | undefined): "high" | "low" | "neutral" | "none" {
  if (rsi == null || Number.isNaN(rsi)) return "none"
  if (rsi >= 70) return "high"
  if (rsi <= 30) return "low"
  return "neutral"
}

export { formatPct, pctClass, rsiLabel }
