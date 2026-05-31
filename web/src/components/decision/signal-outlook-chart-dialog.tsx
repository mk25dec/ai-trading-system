import { useMemo } from "react"
import { GripHorizontal } from "lucide-react"
import { ActualPredictedChart } from "@/components/actual-predicted-chart"
import { HorizonOutlookBadge } from "@/components/horizon-outlook-badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { horizonTrajectory } from "@/lib/decision-visuals"
import type {
  DecisionView,
  MarketCandle,
  PriceChartPoint,
} from "@/lib/pipeline-api"
import { candlesToChartPoints, bullishProbability } from "@/lib/signal-outlook"
import { cn } from "@/lib/utils"

export function SignalOutlookChartDialog({
  open,
  onOpenChange,
  symbol,
  name,
  candles,
  forwardPoints,
  decision,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  symbol: string
  name?: string
  candles: MarketCandle[]
  forwardPoints?: PriceChartPoint[]
  decision: DecisionView
}) {
  const points = useMemo(() => candlesToChartPoints(candles), [candles])
  const pUp = bullishProbability(decision)
  const trajectory = horizonTrajectory(decision.horizons)
  const history = candles.slice(-21)
  const lastHist = history[history.length - 1]?.close
  const lastFwd = forwardPoints?.[forwardPoints.length - 1]?.close
  const projChangePct =
    lastHist != null && lastFwd != null ? ((lastFwd - lastHist) / lastHist) * 100 : null
  const bullish = (projChangePct ?? 0) >= 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className={cn(
          "relative flex h-[min(88vh,760px)] w-[min(92vw,960px)] min-h-[520px] min-w-[560px] max-w-none flex-col gap-4 overflow-auto p-5",
          "sm:max-w-none resize",
        )}
      >
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-lg">
            <span className="font-mono">{symbol}</span>
            {name ? (
              <span className="text-sm font-normal text-muted-foreground">{name}</span>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            Historical closes with server formula projection — brush a range to inspect movement.
            Drag the corner to resize.
          </DialogDescription>
        </DialogHeader>

        <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
          {lastHist != null && <Stat label="Last close" value={`$${lastHist.toFixed(2)}`} />}
          {lastFwd != null && (
            <Stat
              label="Projected"
              value={`$${lastFwd.toFixed(2)}`}
              accent={
                projChangePct != null ? (projChangePct >= 0 ? "up" : "down") : undefined
              }
              suffix={
                projChangePct != null
                  ? `${projChangePct >= 0 ? "+" : ""}${projChangePct.toFixed(2)}%`
                  : undefined
              }
            />
          )}
          <Stat
            label="1M score (P↑ proxy)"
            value={`${pUp.toFixed(0)}%`}
            accent={pUp >= 50 ? "up" : "down"}
          />
          <Stat label="Trajectory" value={trajectory} />
        </div>

        <div className="min-h-[320px] shrink-0">
          <ActualPredictedChart
            points={points}
            forwardPoints={forwardPoints ?? []}
            symbol={symbol}
            height={380}
          />
        </div>

        <div className="grid shrink-0 gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Horizon outlook
            </p>
            <div className="flex flex-wrap gap-2">
              {decision.horizons.map((h) => (
                <HorizonOutlookBadge key={h.id} horizon={h} />
              ))}
            </div>
          </div>

          {decision.drivers.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Key drivers
              </p>
              <ul className="space-y-1.5 text-sm">
                {decision.drivers.slice(0, 4).map((driver, i) => (
                  <li
                    key={i}
                    className="rounded-md border border-border/60 bg-muted/20 px-3 py-2"
                  >
                    {driver}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <p className="shrink-0 text-xs text-muted-foreground">
          Primary outlook:{" "}
          <span className={cn("font-medium", bullish ? "text-emerald-600" : "text-red-600")}>
            {decision.primaryOutlook}
          </span>
          {" · "}
          Composite {decision.compositeScore.toFixed(0)} · confidence{" "}
          {(decision.confidence * 100).toFixed(0)}%
        </p>

        <GripHorizontal
          className="pointer-events-none absolute right-3 bottom-2 size-4 text-muted-foreground/40"
          aria-hidden
        />
      </DialogContent>
    </Dialog>
  )
}

function Stat({
  label,
  value,
  suffix,
  accent,
}: {
  label: string
  value: string
  suffix?: string
  accent?: "up" | "down"
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/60 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "font-mono text-sm font-semibold tabular-nums",
          accent === "up" && "text-emerald-600 dark:text-emerald-400",
          accent === "down" && "text-red-600 dark:text-red-400",
        )}
      >
        {value}
        {suffix ? (
          <span className="ml-1.5 text-xs font-medium text-muted-foreground">{suffix}</span>
        ) : null}
      </p>
    </div>
  )
}
