import { Ban, Eye, TrendingDown, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { RecommendationAction } from "@/lib/pipeline-api"
import { cn } from "@/lib/utils"

const config: Record<
  RecommendationAction,
  {
    label: string
    variant: "default" | "secondary" | "destructive" | "outline"
    icon: typeof TrendingUp
    className?: string
  }
> = {
  buy_candidate: {
    label: "Buy",
    variant: "default",
    icon: TrendingUp,
    className: "bg-emerald-600 hover:bg-emerald-600/90 dark:bg-emerald-600",
  },
  sell_candidate: {
    label: "Sell",
    variant: "destructive",
    icon: TrendingDown,
  },
  avoid: {
    label: "Avoid",
    variant: "destructive",
    icon: Ban,
    className: "bg-red-700 hover:bg-red-700/90 dark:bg-red-700",
  },
  watch: {
    label: "Watch",
    variant: "secondary",
    icon: Eye,
  },
}

export function RecommendationBadge({
  action,
  className,
}: {
  action: RecommendationAction | string
  className?: string
}) {
  const key = (action in config ? action : "watch") as RecommendationAction
  const { label, variant, icon: Icon, className: toneClass } = config[key]
  return (
    <Badge variant={variant} className={cn("gap-1 font-semibold tracking-wide", toneClass, className)}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {label}
    </Badge>
  )
}
