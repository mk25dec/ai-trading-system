import { Badge } from "@/components/ui/badge"
import type { RecommendationAction } from "@/lib/pipeline-api"
import { cn } from "@/lib/utils"

const config: Record<
  RecommendationAction,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  buy_candidate: { label: "Buy", variant: "default" },
  sell_candidate: { label: "Sell", variant: "destructive" },
  avoid: { label: "Avoid", variant: "destructive" },
  watch: { label: "Watch", variant: "secondary" },
}

export function RecommendationBadge({
  action,
  className,
}: {
  action: RecommendationAction | string
  className?: string
}) {
  const key = (action in config ? action : "watch") as RecommendationAction
  const { label, variant } = config[key]
  return (
    <Badge variant={variant} className={cn("font-medium tracking-wide", className)}>
      {label}
    </Badge>
  )
}
