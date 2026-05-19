import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { buildPriceOutlook, formatPriceOutlookTooltip } from "@/lib/price-outlook"
import type { DecisionView, MarketCandle, MarketFeatures } from "@/lib/pipeline-api"
import { cn } from "@/lib/utils"

export function PriceOutlookProjection({
  symbol,
  candles,
  decision,
  market,
  width = 108,
  height = 40,
}: {
  symbol: string
  candles: MarketCandle[]
  decision: DecisionView
  market?: MarketFeatures
  width?: number
  height?: number
}) {
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

  const histLen = outlook.historical.length
  const totalLen = histLen + outlook.projected.length
  const all = [...outlook.historical, ...outlook.projected]
  const min = Math.min(...all)
  const max = Math.max(...all)
  const range = max - min || 1
  const pad = 3

  const toPoint = (value: number, index: number) => {
    const x = pad + (index / (totalLen - 1)) * (width - pad * 2)
    const y = pad + (height - pad * 2) - ((value - min) / range) * (height - pad * 2)
    return `${x},${y}`
  }

  const histPoints = outlook.historical.map((v, i) => toPoint(v, i)).join(" ")
  const projPoints = [outlook.historical[histLen - 1], ...outlook.projected]
    .map((v, i) => toPoint(v, histLen - 1 + i))
    .join(" ")

  const splitX = pad + ((histLen - 1) / (totalLen - 1)) * (width - pad * 2)
  const bull = outlook.pBull3M >= 0.5
  const tip = formatPriceOutlookTooltip(outlook, symbol)

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              className="block cursor-help rounded-md border border-transparent p-0.5 hover:border-border/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={(e) => e.stopPropagation()}
            >
              <svg width={width} height={height} className="shrink-0" aria-hidden>
                <line
                  x1={splitX}
                  y1={pad}
                  x2={splitX}
                  y2={height - pad}
                  className="stroke-border"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
                <polyline
                  fill="none"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  className="stroke-muted-foreground/70"
                  points={histPoints}
                />
                <polyline
                  fill="none"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeDasharray="4 3"
                  className={bull ? "stroke-emerald-500" : "stroke-red-500"}
                  points={projPoints}
                />
              </svg>
              <p
                className={cn(
                  "mt-0.5 text-center font-mono text-[9px] font-semibold tabular-nums",
                  bull ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
                )}
              >
                {(outlook.pBull3M * 100).toFixed(0)}% P↑
              </p>
            </button>
          }
        />
        <TooltipContent side="top" className="max-w-sm whitespace-pre-wrap font-mono text-[11px]">
          {tip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
