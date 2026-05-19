import { useState } from "react"
import { Maximize2 } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { PriceOutlookChartDialog } from "@/components/decision/price-outlook-chart-dialog"
import { buildPriceOutlook, formatPriceOutlookTooltip } from "@/lib/price-outlook"
import type { DecisionView, MarketCandle, MarketFeatures } from "@/lib/pipeline-api"
import { cn } from "@/lib/utils"

const MINI_W = 128
const CHART_H = 36

export function PriceOutlookProjection({
  symbol,
  name,
  candles,
  decision,
  market,
}: {
  symbol: string
  name?: string
  candles: MarketCandle[]
  decision: DecisionView
  market?: MarketFeatures
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const outlook = buildPriceOutlook(candles, decision, market)

  if (!outlook) {
    return (
      <div
        className="flex h-[52px] w-[128px] items-center justify-center rounded-md bg-muted/40 text-[10px] text-muted-foreground"
        title="Need more price history"
      >
        No chart
      </div>
    )
  }

  const histCount = outlook.historicalCount
  const totalLen = outlook.points.length
  const all = outlook.points.map((p) => p.close)
  const min = Math.min(...all)
  const max = Math.max(...all)
  const range = max - min || 1
  const padX = 2
  const padY = 3
  const width = MINI_W
  const height = CHART_H

  const toXY = (value: number, index: number) => ({
    x: padX + (index / Math.max(totalLen - 1, 1)) * (width - padX * 2),
    y: padY + (height - padY * 2) - ((value - min) / range) * (height - padY * 2),
  })

  const histLine = outlook.points
    .filter((p) => p.kind === "history")
    .map((p) => {
      const { x, y } = toXY(p.close, p.index)
      return `${x},${y}`
    })
    .join(" ")

  const projLine = outlook.points
    .filter((p) => p.index >= histCount - 1)
    .map((p) => {
      const { x, y } = toXY(p.close, p.index)
      return `${x},${y}`
    })
    .join(" ")

  const splitX = padX + ((histCount - 1) / Math.max(totalLen - 1, 1)) * (width - padX * 2)
  const projX = width - padX
  const bull = outlook.pBull3M >= 0.5
  const tip = formatPriceOutlookTooltip(outlook, symbol)

  const anchorTicks = outlook.anchors.map((a) => {
    const { x } = toXY(a.price, a.index)
    return { ...a, x }
  })

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                className="group w-[128px] rounded-md border border-transparent p-1 text-left hover:border-border/80 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={(e) => {
                  e.stopPropagation()
                  setDialogOpen(true)
                }}
              >
                <div className="relative">
                  <svg
                    width={width}
                    height={height}
                    className="block"
                    aria-label={`${symbol} price outlook`}
                  >
                    <rect
                      x={splitX}
                      y={padY}
                      width={Math.max(projX - splitX, 1)}
                      height={height - padY * 2}
                      rx={1}
                      className="fill-muted-foreground/12"
                    />
                    {anchorTicks.map((a) => (
                      <line
                        key={a.label}
                        x1={a.x}
                        y1={padY}
                        x2={a.x}
                        y2={height - padY}
                        className="stroke-muted-foreground/25"
                        strokeWidth={1}
                      />
                    ))}
                    <line
                      x1={splitX}
                      y1={padY}
                      x2={splitX}
                      y2={height - padY}
                      className="stroke-border"
                      strokeWidth={1}
                    />
                    <polyline
                      fill="none"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      className="stroke-slate-500 dark:stroke-slate-400"
                      points={histLine}
                    />
                    <polyline
                      fill="none"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      strokeDasharray="3 2"
                      className={bull ? "stroke-emerald-500" : "stroke-red-500"}
                      points={projLine}
                    />
                  </svg>
                  <Maximize2
                    className="absolute right-0 top-0 size-3 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground"
                    aria-hidden
                  />
                </div>

                <div className="mt-1 flex justify-between gap-0.5 px-0.5">
                  {outlook.anchors.map((a) => (
                    <span
                      key={a.label}
                      className="flex-1 truncate text-center font-mono text-[7px] font-medium leading-none text-muted-foreground"
                    >
                      {a.label}
                    </span>
                  ))}
                </div>

                <p
                  className={cn(
                    "mt-0.5 text-center font-mono text-[9px] font-semibold tabular-nums",
                    bull
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400",
                  )}
                >
                  {(outlook.pBull3M * 100).toFixed(0)}% P↑ · click chart
                </p>
              </button>
            }
          />
          <TooltipContent side="top" className="max-w-sm whitespace-pre-wrap font-mono text-[11px]">
            {tip}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PriceOutlookChartDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        symbol={symbol}
        name={name}
        outlook={outlook}
      />
    </>
  )
}
