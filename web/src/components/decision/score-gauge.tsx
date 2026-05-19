import { scoreSpectrum } from "@/lib/decision-visuals"
import { cn } from "@/lib/utils"

export function ScoreGauge({
  score,
  confidence,
  size = "md",
  showLabel = true,
  noData = false,
}: {
  score: number
  confidence?: number
  size?: "sm" | "md" | "lg"
  showLabel?: boolean
  noData?: boolean
}) {
  const spec = scoreSpectrum(score, { noData })
  const clamped = noData ? 0 : Math.min(100, Math.max(0, score))

  if (size === "sm") {
    return (
      <div className="min-w-[72px] space-y-1">
        <div className={cn("flex items-baseline gap-0.5", spec.text)}>
          <span className="font-mono text-lg font-bold tabular-nums leading-none">
            {noData ? "—" : clamped.toFixed(0)}
          </span>
          {!noData && <span className="text-[10px] text-muted-foreground">/100</span>}
        </div>
        <div className={cn("h-1.5 w-full overflow-hidden rounded-full", spec.track)}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${clamped}%`, backgroundColor: spec.fill }}
          />
        </div>
      </div>
    )
  }

  const dim = size === "lg" ? 120 : 88
  const stroke = size === "lg" ? 8 : 6
  const r = (dim - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c - (clamped / 100) * c

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: dim, height: dim }}>
        <svg width={dim} height={dim} className="-rotate-90">
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-muted/30"
          />
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={r}
            fill="none"
            stroke={spec.fill}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(
              "font-mono font-bold tabular-nums leading-none",
              spec.text,
              size === "lg" ? "text-3xl" : "text-2xl",
            )}
          >
            {clamped.toFixed(0)}
          </span>
          {showLabel && (
            <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Score
            </span>
          )}
        </div>
      </div>
      {confidence != null && (
        <p className="text-xs text-muted-foreground">
          <span className="font-mono tabular-nums">{(confidence * 100).toFixed(0)}%</span>{" "}
          confidence
        </p>
      )}
    </div>
  )
}
