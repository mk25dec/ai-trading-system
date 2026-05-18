import type { CategoryScore } from "@/lib/pipeline-api"
import { cn } from "@/lib/utils"

export function CategoryBars({ categories }: { categories: CategoryScore[] }) {
  if (categories.length === 0) return null

  return (
    <div className="rounded-xl border bg-card/60 p-4 shadow-sm">
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Factor contribution
      </p>
      <ul className="space-y-3">
        {categories.map((c) => {
          const pct = Math.round(c.score * 100)
          const width = Math.min(100, Math.abs(pct))
          const positive = pct >= 0
          return (
            <li key={c.id}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-foreground">{c.label}</span>
                <span
                  className={cn(
                    "font-mono tabular-nums",
                    positive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
                  )}
                >
                  {positive ? "+" : ""}
                  {pct}%
                </span>
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-muted/60">
                <div
                  className={cn(
                    "absolute top-0 h-full rounded-full transition-all",
                    positive ? "left-1/2 bg-emerald-500" : "right-1/2 bg-red-500",
                  )}
                  style={{ width: `${width / 2}%` }}
                />
                <div className="absolute left-1/2 top-0 h-full w-px bg-border" />
              </div>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {(c.confidence * 100).toFixed(0)}% data confidence · weight {(c.weight * 100).toFixed(0)}%
              </p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
