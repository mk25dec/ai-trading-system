import { X } from "lucide-react"
import type { PriceChartProjectionReplay } from "@/lib/pipeline-api"
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
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function Stat({
  label,
  value,
  sub,
  className,
}: {
  label: string
  value: string
  sub?: string
  className?: string
}) {
  return (
    <div className={cn("min-w-[8rem]", className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium tabular-nums">{value}</dd>
      {sub ? <dd className="text-xs text-muted-foreground">{sub}</dd> : null}
    </div>
  )
}

export function ChartProjectionReplayPanel({
  replay,
  onClear,
  isLoading,
  className,
}: {
  replay: PriceChartProjectionReplay | null
  onClear: () => void
  isLoading?: boolean
  className?: string
}) {
  if (!replay && !isLoading) return null

  return (
    <div
      className={cn("rounded-lg border border-violet-500/30 bg-violet-500/5 px-4 py-3", className)}
      aria-live="polite"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Computing projection at selected time…</p>
          ) : replay ? (
            <p className="text-sm text-muted-foreground">
              Anchor <span className="font-medium text-foreground">{fmtWhen(replay.anchor.timestamp)}</span>
              {" · "}
              <span className="font-mono tabular-nums">{fmtMoney(replay.anchor.close)}</span>
            </p>
          ) : null}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClear} disabled={isLoading}>
          <X className="size-4" />
          Clear
        </Button>
      </div>

      {replay && !isLoading ? (
        <dl className="flex flex-wrap gap-x-6 gap-y-3">
          <Stat
            label="Projected at +3D"
            value={
              replay.projectedAtHorizon != null
                ? fmtMoney(replay.projectedAtHorizon)
                : "—"
            }
            sub={fmtWhen(replay.horizonEnd)}
          />
          {replay.isFutureHorizon ? (
            <Stat label="Actual at +3D" value="Not yet reached" />
          ) : replay.actualAtHorizon ? (
            <Stat
              label="Actual at +3D"
              value={fmtMoney(replay.actualAtHorizon.close)}
              sub={fmtWhen(replay.actualAtHorizon.timestamp)}
            />
          ) : (
            <Stat label="Actual at +3D" value="No bar at horizon" />
          )}
          {replay.projectionError != null && replay.projectionErrorPct != null ? (
            <Stat
              label="Actual − projected"
              value={`${fmtMoney(replay.projectionError)} (${fmtPct(replay.projectionErrorPct, true)})`}
              className={
                Math.abs(replay.projectionError) < 0.5
                  ? "text-emerald-700 dark:text-emerald-400 [&_dd]:text-emerald-700 dark:[&_dd]:text-emerald-400"
                  : ""
              }
            />
          ) : null}
        </dl>
      ) : null}
    </div>
  )
}
