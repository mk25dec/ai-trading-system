import { X } from "lucide-react"
import type { ChartSelectionAnalysis } from "@/lib/chart-selection-analysis"
import { formatChartDateTime } from "@/lib/chart-time"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function fmtMoney(v: number): string {
  return `$${v.toFixed(2)}`
}

function fmtPct(v: number, signed = false): string {
  const sign = signed && v > 0 ? "+" : ""
  return `${sign}${v.toFixed(2)}%`
}

function fmtWhen(iso: string): string {
  return formatChartDateTime(iso)
}

function Stat({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className={cn("min-w-[7rem]", className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium tabular-nums">{value}</dd>
    </div>
  )
}

export function ChartSelectionAnalysisPanel({
  analysis,
  onClear,
  className,
}: {
  analysis: ChartSelectionAnalysis
  onClear: () => void
  className?: string
}) {
  const trendLabel =
    analysis.trend === "up" ? "Uptrend" : analysis.trend === "down" ? "Downtrend" : "Sideways"

  return (
    <div
      className={cn(
        "rounded-lg border bg-muted/30 px-4 py-3",
        className,
      )}
      aria-live="polite"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Selection analysis</p>
          <p className="text-xs text-muted-foreground">
            {fmtWhen(analysis.start)} → {fmtWhen(analysis.end)} · {analysis.barCount} bars ·{" "}
            <span
              className={
                analysis.trend === "up"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : analysis.trend === "down"
                    ? "text-red-600 dark:text-red-400"
                    : ""
              }
            >
              {trendLabel}
            </span>
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          <X className="size-4" />
          Clear
        </Button>
      </div>
      <dl className="flex flex-wrap gap-x-6 gap-y-3">
        <Stat label="Open" value={fmtMoney(analysis.open)} />
        <Stat label="Close" value={fmtMoney(analysis.close)} />
        <Stat label="High" value={fmtMoney(analysis.high)} />
        <Stat label="Low" value={fmtMoney(analysis.low)} />
        <Stat
          label="Change"
          value={`${fmtMoney(analysis.change)} (${fmtPct(analysis.changePct, true)})`}
          className={
            analysis.change >= 0
              ? "text-emerald-700 dark:text-emerald-400 [&_dd]:text-emerald-700 dark:[&_dd]:text-emerald-400"
              : "text-red-700 dark:text-red-400 [&_dd]:text-red-700 dark:[&_dd]:text-red-400"
          }
        />
        <Stat label="Volatility (1m σ)" value={fmtPct(analysis.volatilityPct)} />
        {analysis.avgPredictedError != null ? (
          <Stat
            label="Avg |predicted − actual|"
            value={fmtMoney(analysis.avgPredictedError)}
          />
        ) : null}
        <Stat
          label="Prediction coverage"
          value={fmtPct(analysis.predictionCoveragePct)}
        />
      </dl>
    </div>
  )
}
