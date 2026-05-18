import type { MarketCandle } from "@/lib/pipeline-api"
import { cn } from "@/lib/utils"

export function MiniSparkline({
  candles,
  width = 64,
  height = 28,
  className,
}: {
  candles: MarketCandle[]
  width?: number
  height?: number
  className?: string
}) {
  if (candles.length < 2) {
    return (
      <div
        className={cn("rounded bg-muted/40", className)}
        style={{ width, height }}
        aria-hidden
      />
    )
  }

  const slice = candles.slice(-24)
  const closes = slice.map((c) => c.close)
  const min = Math.min(...closes)
  const max = Math.max(...closes)
  const range = max - min || 1
  const pad = 2
  const up = closes[closes.length - 1] >= closes[0]

  const points = closes
    .map((c, i) => {
      const x = pad + (i / (closes.length - 1)) * (width - pad * 2)
      const y = pad + (height - pad * 2) - ((c - min) / range) * (height - pad * 2)
      return `${x},${y}`
    })
    .join(" ")

  return (
    <svg
      width={width}
      height={height}
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <polyline
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={up ? "stroke-emerald-500" : "stroke-red-500"}
        points={points}
      />
    </svg>
  )
}
