import type { LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { MiniSparkline } from "@/components/decision/mini-sparkline"
import type { MarketCandle } from "@/lib/pipeline-api"
import { cn } from "@/lib/utils"

type OverviewKpiCardProps = {
  label: string
  value: string
  hint?: string
  change?: string
  changeTone?: "positive" | "negative" | "neutral"
  icon?: LucideIcon
  iconClassName?: string
  sparkline?: MarketCandle[]
}

export function OverviewKpiCard({
  label,
  value,
  hint,
  change,
  changeTone = "neutral",
  icon: Icon,
  iconClassName,
  sparkline,
}: OverviewKpiCardProps) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="flex items-start justify-between gap-3 py-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
          {(change || hint) && (
            <p className="mt-1 text-xs text-muted-foreground">
              {change && (
                <span
                  className={cn(
                    "font-medium",
                    changeTone === "positive" && "text-emerald-600 dark:text-emerald-400",
                    changeTone === "negative" && "text-red-600 dark:text-red-400",
                  )}
                >
                  {change}
                </span>
              )}
              {change && hint && " · "}
              {hint}
            </p>
          )}
        </div>
        {sparkline && sparkline.length >= 2 ? (
          <MiniSparkline candles={sparkline} width={72} height={32} />
        ) : Icon ? (
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted",
              iconClassName,
            )}
          >
            <Icon className="size-4" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
