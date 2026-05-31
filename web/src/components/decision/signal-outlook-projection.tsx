import { useState } from "react"
import { Maximize2 } from "lucide-react"
import { SignalOutlookChart } from "@/components/decision/signal-outlook-chart"
import { SignalOutlookChartDialog } from "@/components/decision/signal-outlook-chart-dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type {
  DecisionView,
  MarketCandle,
  PriceChartPoint,
} from "@/lib/pipeline-api"
import { bullishProbability, formatSignalOutlookTooltip } from "@/lib/signal-outlook"
import { cn } from "@/lib/utils"

export function SignalOutlookProjection({
  symbol,
  name,
  candles,
  forwardPoints,
  decision,
}: {
  symbol: string
  name?: string
  candles: MarketCandle[]
  forwardPoints?: PriceChartPoint[]
  decision: DecisionView
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const history = candles.slice(-21)
  const forward = (forwardPoints ?? []).slice(0, 4)
  const hasChart = history.length >= 2 || forward.length >= 2

  if (!hasChart) {
    return (
      <div
        className="flex h-[52px] w-[128px] items-center justify-center rounded-md bg-muted/40 text-[10px] text-muted-foreground"
        title="Need more price history"
      >
        No chart
      </div>
    )
  }

  const histCloses = history.map((c) => c.close)
  const fwdCloses = forward.map((p) => p.close)
  const all = [...histCloses, ...fwdCloses]
  const bullish = all[all.length - 1] >= all[0]
  const pUp = bullishProbability(decision)
  const tip = formatSignalOutlookTooltip(symbol, candles, forwardPoints, decision)

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
                  <SignalOutlookChart
                    candles={candles}
                    forwardPoints={forwardPoints}
                    showCaption={false}
                  />
                  <Maximize2
                    className="absolute right-0 top-0 size-3 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground"
                    aria-hidden
                  />
                </div>

                <div className="mt-1 flex justify-between gap-0.5 px-0.5">
                  {decision.horizons.map((h) => (
                    <span
                      key={h.id}
                      className="flex-1 truncate text-center font-mono text-[7px] font-medium leading-none text-muted-foreground"
                    >
                      {h.label}
                    </span>
                  ))}
                </div>

                <p
                  className={cn(
                    "mt-0.5 text-center font-mono text-[9px] font-semibold tabular-nums",
                    bullish
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400",
                  )}
                >
                  {pUp.toFixed(0)}% P↑ · click chart
                </p>
              </button>
            }
          />
          <TooltipContent side="top" className="max-w-sm whitespace-pre-wrap font-mono text-[11px]">
            {tip}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {dialogOpen ? (
        <SignalOutlookChartDialog
          open
          onOpenChange={setDialogOpen}
          symbol={symbol}
          name={name}
          candles={candles}
          forwardPoints={forwardPoints}
          decision={decision}
        />
      ) : null}
    </>
  )
}
