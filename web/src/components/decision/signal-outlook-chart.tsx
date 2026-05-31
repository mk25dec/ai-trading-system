import type { MarketCandle, PriceChartPoint } from "@/lib/pipeline-api"
import { cn } from "@/lib/utils"

const WIDTH = 128
const HEIGHT = 36

/** Mini hist + server formula forward path (same source as chart page). */
export function SignalOutlookChart({
  candles,
  forwardPoints,
  className,
}: {
  candles: MarketCandle[]
  forwardPoints?: PriceChartPoint[]
  className?: string
}) {
  const history = candles.slice(-21)
  const forward = (forwardPoints ?? []).slice(0, 4)
  if (history.length < 2 && forward.length < 2) {
    return (
      <div
        className={cn(
          "flex h-[52px] w-[128px] items-center justify-center rounded-md bg-muted/40 text-[10px] text-muted-foreground",
          className,
        )}
      >
        No chart
      </div>
    )
  }

  const histCloses = history.map((c) => c.close)
  const fwdCloses = forward.map((p) => p.close)
  const all = [...histCloses, ...fwdCloses]
  const min = Math.min(...all)
  const max = Math.max(...all)
  const range = max - min || 1
  const padX = 2
  const padY = 3
  const totalLen = Math.max(all.length - 1, 1)
  const histCount = histCloses.length

  const toXY = (value: number, index: number) => ({
    x: padX + (index / totalLen) * (WIDTH - padX * 2),
    y: padY + (HEIGHT - padY * 2) - ((value - min) / range) * (HEIGHT - padY * 2),
  })

  const histLine = histCloses
    .map((close, i) => {
      const { x, y } = toXY(close, i)
      return `${x},${y}`
    })
    .join(" ")

  const projStart = Math.max(histCount - 1, 0)
  const projLine = fwdCloses
    .map((close, i) => {
      const { x, y } = toXY(close, projStart + i)
      return `${x},${y}`
    })
    .join(" ")

  const splitX =
    histCount > 0
      ? padX + ((histCount - 1) / totalLen) * (WIDTH - padX * 2)
      : padX
  const up = all[all.length - 1] >= all[0]

  return (
    <div className={cn("w-[128px]", className)}>
      <svg width={WIDTH} height={HEIGHT} className="block" aria-label="Price outlook">
        <rect
          x={splitX}
          y={padY}
          width={Math.max(WIDTH - padX - splitX, 1)}
          height={HEIGHT - padY * 2}
          rx={1}
          className="fill-muted-foreground/12"
        />
        {histLine && (
          <polyline
            fill="none"
            strokeWidth={1.5}
            strokeLinecap="round"
            className="stroke-slate-500 dark:stroke-slate-400"
            points={histLine}
          />
        )}
        {projLine && (
          <polyline
            fill="none"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeDasharray="3 2"
            className={up ? "stroke-emerald-500" : "stroke-red-500"}
            points={projLine}
          />
        )}
      </svg>
      <p className="mt-0.5 text-center text-[9px] text-muted-foreground">Hist · proj (+3D)</p>
    </div>
  )
}
