import type { MarketCandle } from "@/lib/pipeline-api"
import { cn } from "@/lib/utils"

export function PriceChart({
  candles,
  className,
  height = 120,
}: {
  candles: MarketCandle[]
  className?: string
  height?: number
}) {
  if (candles.length < 2) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border border-dashed bg-muted/30 px-3 text-center text-xs text-muted-foreground",
          className,
        )}
        style={{ height }}
      >
        No price history — run refresh with Alpaca configured
      </div>
    )
  }

  const closes = candles.map((c) => c.close)
  const min = Math.min(...closes)
  const max = Math.max(...closes)
  const range = max - min || 1
  const width = 280
  const pad = 4
  const innerH = height - pad * 2
  const innerW = width - pad * 2

  const points = closes
    .map((c, i) => {
      const x = pad + (i / (closes.length - 1)) * innerW
      const y = pad + innerH - ((c - min) / range) * innerH
      return `${x},${y}`
    })
    .join(" ")

  const last = closes[closes.length - 1]
  const first = closes[0]
  const change = ((last - first) / first) * 100
  const up = change >= 0

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-mono font-medium tabular-nums">${last.toFixed(2)}</span>
        <span
          className={cn(
            "font-mono tabular-nums",
            up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
          )}
        >
          {up ? "+" : ""}
          {change.toFixed(2)}%
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full max-w-[320px] rounded-lg border bg-card/50"
        role="img"
        aria-label="Price chart"
      >
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className={up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}
          points={points}
        />
      </svg>
    </div>
  )
}
