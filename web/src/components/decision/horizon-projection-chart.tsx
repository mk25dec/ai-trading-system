import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react"
import type { HorizonOutlook } from "@/lib/pipeline-api"
import { outlookToLabel } from "@/lib/decision-engine"
import {
  horizonTrajectory,
  outlookSpectrum,
  scoreSpectrum,
  trajectoryLabel,
} from "@/lib/decision-visuals"
import { cn } from "@/lib/utils"

export function HorizonProjectionChart({ horizons }: { horizons: HorizonOutlook[] }) {
  if (horizons.length === 0) return null

  const trajectory = horizonTrajectory(horizons)
  const width = 320
  const height = 140
  const padX = 36
  const padY = 28
  const innerW = width - padX * 2
  const innerH = height - padY * 2

  const points = horizons.map((h, i) => ({
    x: padX + (horizons.length === 1 ? innerW / 2 : (i / (horizons.length - 1)) * innerW),
    y: padY + innerH - (h.score / 100) * innerH,
    h,
  }))

  const line = points.map((p) => `${p.x},${p.y}`).join(" ")
  const area = `${points[0].x},${padY + innerH} ${line} ${points[points.length - 1].x},${padY + innerH}`

  const TrajectoryIcon =
    trajectory === "improving" ? ArrowUpRight : trajectory === "fading" ? ArrowDownRight : ArrowRight

  return (
    <div className="rounded-xl border bg-card/60 p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Horizon projection
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm font-medium">
            <TrajectoryIcon
              className={cn(
                "size-4 shrink-0",
                trajectory === "improving" && "text-emerald-600 dark:text-emerald-400",
                trajectory === "fading" && "text-red-600 dark:text-red-400",
                trajectory === "stable" && "text-muted-foreground",
              )}
            />
            {trajectoryLabel(trajectory)}
          </p>
        </div>
        <div className="flex gap-3 text-[10px] text-muted-foreground">
          {horizons.map((h) => (
            <span key={h.id} className="font-mono">
              {h.label}: {h.score.toFixed(0)}
            </span>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-md" role="img" aria-label="Horizon score projection">
        <defs>
          <linearGradient id="horizonArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[25, 50, 75].map((pct) => {
          const y = padY + innerH - (pct / 100) * innerH
          return (
            <g key={pct}>
              <line x1={padX} y1={y} x2={width - padX} y2={y} className="stroke-border" strokeWidth="0.5" strokeDasharray="3 3" />
              <text x={4} y={y + 3} className="fill-muted-foreground text-[8px]">
                {pct}
              </text>
            </g>
          )
        })}
        <polygon points={area} fill="url(#horizonArea)" />
        <polyline
          points={line}
          fill="none"
          className="stroke-primary"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map(({ x, y, h }) => {
          const spec = scoreSpectrum(h.score)
          const o = outlookSpectrum(h.outlook)
          return (
            <g key={h.id}>
              <circle cx={x} cy={y} r="6" fill={spec.fill} stroke="hsl(var(--background))" strokeWidth="2" />
              <text x={x} y={height - 6} textAnchor="middle" className="fill-muted-foreground text-[9px] font-medium">
                {h.label}
              </text>
              <text x={x} y={y - 10} textAnchor="middle" className={cn("text-[8px] font-semibold", o.text)}>
                {outlookToLabel(h.outlook)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
