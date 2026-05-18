import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  ShieldAlert,
  Target,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type Kpi = {
  label: string
  value: string | number
  hint?: string
  tone?: "positive" | "negative" | "warning" | "neutral"
  icon?: "bull" | "bear" | "conflict" | "risk" | "target"
}

const iconMap = {
  bull: ArrowUpRight,
  bear: ArrowDownRight,
  conflict: AlertTriangle,
  risk: ShieldAlert,
  target: Target,
}

export function TraderKpiCards({ items }: { items: Kpi[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {items.map((item) => {
        const Icon = item.icon ? iconMap[item.icon] : Target
        return (
          <Card
            key={item.label}
            className={cn(
              "border-border/70 shadow-sm transition-colors",
              item.tone === "positive" && "border-emerald-500/25 bg-emerald-500/5",
              item.tone === "negative" && "border-red-500/25 bg-red-500/5",
              item.tone === "warning" && "border-amber-500/25 bg-amber-500/5",
            )}
          >
            <CardContent className="flex items-start gap-3 py-4">
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg",
                  item.tone === "positive" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                  item.tone === "negative" && "bg-red-500/15 text-red-600 dark:text-red-400",
                  item.tone === "warning" && "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                  (!item.tone || item.tone === "neutral") && "bg-muted text-muted-foreground",
                )}
              >
                <Icon className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                <p
                  className={cn(
                    "mt-0.5 text-2xl font-semibold tabular-nums tracking-tight",
                    item.tone === "positive" && "text-emerald-600 dark:text-emerald-400",
                    item.tone === "negative" && "text-red-600 dark:text-red-400",
                    item.tone === "warning" && "text-amber-700 dark:text-amber-300",
                  )}
                >
                  {item.value}
                </p>
                {item.hint && (
                  <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{item.hint}</p>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
