import type { MarketCandle } from "@/lib/pipeline-api"
import { cn } from "@/lib/utils"

export function PriceChart({
  candles,
  className,
  height = 140,
}: {
  candles: MarketCandle[]
  className?: string
  height?: number
}) {
  if (candles.length < 2) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-xl border border-dashed bg-muted/30 px-3 text-center text-xs text-muted-foreground",
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
  const width = 320
  const pad = 8
  const innerH = height - pad * 2
  const innerW = width - pad * 2

  const points = closes.map((c, i) => {
    const x = pad + (i / (closes.length - 1)) * innerW
    const y = pad + innerH - ((c - min) / range) * innerH
    return { x, y }
  })

  const line = points.map((p) => `${p.x},${p.y}`).join(" ")
  const area = `${points[0].x},${pad + innerH} ${line} ${points[points.length - 1].x},${pad + innerH}`

  const last = closes[closes.length - 1]
  const first = closes[0]
  const change = ((last - first) / first) * 100
  const up = change >= 0
  const gradId = `priceGrad-${up ? "up" : "down"}`

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-mono text-lg font-semibold tabular-nums">${last.toFixed(2)}</span>
        <span
          className={cn(
            "rounded-md px-2 py-0.5 font-mono text-sm font-medium tabular-nums",
            up
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : "bg-red-500/15 text-red-600 dark:text-red-400",
          )}
        >
          {up ? "+" : ""}
          {change.toFixed(2)}%
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full max-w-full rounded-xl border bg-gradient-to-b from-card to-muted/20 shadow-sm"
        role="img"
        aria-label="Price chart"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={up ? "#10b981" : "#ef4444"} stopOpacity="0.35" />
            <stop offset="100%" stopColor={up ? "#10b981" : "#ef4444"} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill={`url(#${gradId})`} />
        <polyline
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={up ? "stroke-emerald-500" : "stroke-red-500"}
          points={line}
        />
      </svg>
    </div>
  )
}
