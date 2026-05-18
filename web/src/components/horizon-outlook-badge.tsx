import { Badge } from "@/components/ui/badge"
import type { HorizonOutlook } from "@/lib/pipeline-api"
import { outlookToLabel } from "@/lib/decision-engine"
import { outlookSpectrum, scoreSpectrum } from "@/lib/decision-visuals"
import { cn } from "@/lib/utils"

export function HorizonOutlookBadge({ horizon }: { horizon: HorizonOutlook }) {
  const tone = outlookSpectrum(horizon.outlook)
  const scoreSpec = scoreSpectrum(horizon.score)

  return (
    <div
      className={cn(
        "flex min-w-[52px] flex-col items-center gap-1 rounded-lg border px-2 py-1.5",
        tone.bg,
        tone.ring,
        "ring-1 ring-inset",
      )}
    >
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {horizon.label}
      </span>
      <Badge
        variant="outline"
        className={cn("border-0 bg-transparent px-0 py-0 text-[10px] font-semibold shadow-none", tone.text)}
      >
        {outlookToLabel(horizon.outlook)}
      </Badge>
      <div className="flex items-center gap-1">
        <span className={cn("font-mono text-sm font-bold tabular-nums leading-none", scoreSpec.text)}>
          {horizon.score.toFixed(0)}
        </span>
      </div>
      <div className={cn("h-1 w-full overflow-hidden rounded-full", scoreSpec.track)}>
        <div
          className="h-full rounded-full"
          style={{ width: `${horizon.score}%`, backgroundColor: scoreSpec.fill }}
        />
      </div>
    </div>
  )
}
