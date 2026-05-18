import { Badge } from "@/components/ui/badge"
import type { HorizonOutlook } from "@/lib/pipeline-api"
import { outlookTone, outlookToLabel } from "@/lib/decision-engine"
import { cn } from "@/lib/utils"

export function HorizonOutlookBadge({ horizon }: { horizon: HorizonOutlook }) {
  const tone = outlookTone(horizon.outlook)
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] font-medium uppercase text-muted-foreground">
        {horizon.label}
      </span>
      <Badge
        variant={tone === "positive" ? "default" : tone === "negative" ? "destructive" : "secondary"}
        className={cn("px-1.5 py-0 text-[10px] font-medium")}
      >
        {outlookToLabel(horizon.outlook)}
      </Badge>
      <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
        {horizon.score.toFixed(0)}
      </span>
    </div>
  )
}
