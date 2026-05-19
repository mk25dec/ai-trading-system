import { useState } from "react"
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

export function PriceOutlookProjection({
  symbol,
  name,
  candles,
  decision,
  market,
  width = 120,
  height = 44,
}: {
  symbol: string
  name?: string
  candles: MarketCandle[]
  decision: DecisionView
  market?: MarketFeatures
  width?: number
  height?: number
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const outlook = buildPriceOutlook(candles, decision, market)

  if (!outlook) {
    return (
      <div
        className="rounded bg-muted/40"
        style={{ width, height }}
        title="Need more price history"
      />
    )
  }

  const histCount = outlook.historicalCount
  const totalLen = outlook.points.length
  const all = outlook.points.map((p) => p.close)
  const min = Math.min(...all)
  const max = Math.max(...all)
  const range = max - min || 1
  const pad = 4

  const toPoint = (value: number, index: number) => {
    const x = pad + (index / Math.max(totalLen - 1, 1)) * (width - pad * 2)
    const y = pad + (height - pad * 2) - ((value - min) / range) * (height - pad * 2)
    return `${x},${y}`
  }

  const histPoints = outlook.points
    .filter((p) => p.kind === "history")
    .map((p) => toPoint(p.close, p.index))
    .join(" ")

  const projPoints = outlook.points
    .filter((p) => p.index >= histCount - 1)
    .map((p) => toPoint(p.close, p.index))
    .join(" ")

  const splitX = pad + ((histCount - 1) / Math.max(totalLen - 1, 1)) * (width - pad * 2)
  const bull = outlook.pBull3M >= 0.5
  const tip = formatPriceOutlookTooltip(outlook, symbol)

  const zoneRects = outlook.zones.map((z) => {
    const x1 = pad + (z.startIndex / Math.max(totalLen - 1, 1)) * (width - pad * 2)
    const x2 = pad + (z.endIndex / Math.max(totalLen - 1, 1)) * (width - pad * 2)
    return { ...z, x: x1, w: Math.max(x2 - x1, 2) }
  })

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                className="block cursor-pointer rounded-md border border-transparent p-0.5 hover:border-border/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={(e) => {
                  e.stopPropagation()
                  setDialogOpen(true)
                }}
              >
                <svg width={width} height={height} className="shrink-0" aria-hidden>
                  {zoneRects.map((z) => (
                    <g key={z.label}>
                      <rect
                        x={z.x}
                        y={pad}
                        width={z.w}
                        height={height - pad * 2}
                        className="fill-muted-foreground/15"
                      />
                      <text
                        x={z.x + z.w / 2}
                        y={pad + 7}
                        textAnchor="middle"
                        className="fill-muted-foreground text-[6px] font-medium"
                      >
                        {z.label}
                      </text>
                    </g>
                  ))}
                  <line
                    x1={splitX}
                    y1={pad}
                    x2={splitX}
                    y2={height - pad}
                    className="stroke-border"
                    strokeWidth="1"
                  />
                  <polyline
                    fill="none"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    className="stroke-muted-foreground/80"
                    points={histPoints}
                  />
                  <polyline
                    fill="none"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeDasharray="3 2"
                    className={bull ? "stroke-emerald-500" : "stroke-red-500"}
                    points={projPoints}
                  />
                </svg>
                <p
                  className={cn(
                    "mt-0.5 text-center font-mono text-[9px] font-semibold tabular-nums",
                    bull
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400",
                  )}
                >
                  {(outlook.pBull3M * 100).toFixed(0)}% P↑
                </p>
              </button>
            }
          />
          <TooltipContent side="top" className="max-w-sm whitespace-pre-wrap font-mono text-[11px]">
            {tip}
            <span className="mt-1 block text-muted-foreground">Click to open chart</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PriceOutlookChartDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        symbol={symbol}
        name={name}
        outlook={outlook}
        candles={candles}
      />
    </>
  )
}
