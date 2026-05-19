import { ChevronRight } from "lucide-react"
import { ScoringMethodologyPanel } from "@/components/decision/scoring-methodology-panel"
import { cn } from "@/lib/utils"

/** Collapsed by default — formulas, input sources, and category weights. */
export function CalculationRulesCollapsible() {
  return (
    <details className="group border-t border-border/60 bg-muted/10">
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm transition-colors",
          "hover:bg-muted/20 [&::-webkit-details-marker]:hidden",
        )}
      >
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
          aria-hidden
        />
        <span className="font-semibold text-foreground">Calculation rules</span>
        <span className="text-xs text-muted-foreground">
          Formulas, data sources, category weights
        </span>
      </summary>
      <ScoringMethodologyPanel showHeader={false} />
    </details>
  )
}
