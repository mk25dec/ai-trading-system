import { AlertTriangle } from "lucide-react"
import type { DecisionView } from "@/lib/pipeline-api"
import { CategoryBars } from "@/components/decision/category-bars"
import { ConfidenceMeter } from "@/components/decision/confidence-meter"
import { HorizonProjectionChart } from "@/components/decision/horizon-projection-chart"
import { ScoreGauge } from "@/components/decision/score-gauge"
import { RecommendationBadge } from "@/components/recommendation-badge"
import { alignmentSpectrum, scoreSpectrum } from "@/lib/decision-visuals"
import { alignmentLabel } from "@/lib/decision-engine"
import type { RecommendationAction } from "@/lib/pipeline-api"
import { cn } from "@/lib/utils"

export function DecisionHeroPanel({ decision }: { decision: DecisionView }) {
  const spec = scoreSpectrum(decision.compositeScore)
  const align = alignmentSpectrum(decision.alignment)

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "grid gap-4 rounded-xl border p-4 shadow-sm lg:grid-cols-[auto_1fr_auto]",
          spec.bg,
          spec.border,
        )}
      >
        <ScoreGauge score={decision.compositeScore} confidence={decision.confidence} size="lg" />
        <div className="flex flex-col justify-center gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <RecommendationBadge
              action={decision.primaryAction as RecommendationAction}
              className="text-sm px-3 py-1"
            />
            <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", align.bg, align.text)}>
              {alignmentLabel(decision.alignment)}
            </span>
          </div>
          <p className="text-lg font-semibold tracking-tight">{decision.primaryOutlook}</p>
          <p className="max-w-xl text-sm text-muted-foreground">
            {decision.drivers[0] ?? "Awaiting stronger factor alignment before sizing a position."}
          </p>
          {decision.conflict && decision.conflictNote && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{decision.conflictNote}</span>
            </div>
          )}
        </div>
        <ConfidenceMeter confidence={decision.confidence} riskLevel={decision.riskLevel} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <HorizonProjectionChart horizons={decision.horizons} />
        {decision.categories && decision.categories.length > 0 && (
          <CategoryBars categories={decision.categories} />
        )}
      </div>
    </div>
  )
}
