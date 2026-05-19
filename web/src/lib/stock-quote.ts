import type { MarketCandle, ResearchStockRow } from "@/lib/pipeline-api"
import { formatPct, pctClass } from "@/lib/feature-metrics"

export interface StockQuoteView {
  symbol: string
  name: string
  exchange: string | null
  price: number | null
  dayHigh: number | null
  dayLow: number | null
  change24h: number | null
  volume: number | null
  rsi: number | null
  volatility: number | null
}

export function resolveStockQuote(row: ResearchStockRow): StockQuoteView {
  const latest = latestCandle(row.candles)
  const price = row.lastClose ?? latest?.close ?? null

  return {
    symbol: row.symbol,
    name: row.name || row.symbol,
    exchange: row.exchange ?? null,
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
  if (price == null || Number.isNaN(price)) return "—"
  return `$${price.toFixed(digits)}`
}

export function formatVolume(vol: number | null | undefined): string {
  if (vol == null || vol <= 0) return "—"
  if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(1)}B`
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`
  return vol.toLocaleString()
}

export function formatExchange(exchange: string | null): string {
  if (!exchange?.trim()) return "—"
  return exchange.trim().toUpperCase()
}

export { formatPct, pctClass }
