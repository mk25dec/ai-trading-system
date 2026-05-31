import { Link } from "react-router-dom"
import { ArrowUpRight, CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type Pipeline = {
  key: string
  label: string
  pct: number
  status: string
}

export function PipelineHealthCard({
  pipelines,
  operational,
}: {
  pipelines: Pipeline[]
  operational: boolean
}) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Pipeline health</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
            operational
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "bg-amber-500/10 text-amber-700 dark:text-amber-300",
          )}
        >
          <CheckCircle2 className="size-4 shrink-0" />
          {operational ? "All systems operational" : "Some pipelines need attention"}
        </div>
        <ul className="space-y-3">
          {pipelines.map((p) => (
            <li key={p.key} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">{p.label}</span>
              <span
                className={cn(
                  "font-medium tabular-nums",
                  p.pct === 100 && "text-emerald-600 dark:text-emerald-400",
                  p.pct > 0 && p.pct < 100 && "text-amber-600 dark:text-amber-400",
                  p.pct === 0 && p.status !== "unknown" && "text-red-600 dark:text-red-400",
                )}
              >
                {p.status === "unknown"
                  ? "—"
                  : p.status === "success"
                    ? "OK"
                    : p.status}
              </span>
            </li>
          ))}
        </ul>
        <Link
          to="/data-health"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          View data operations
          <ArrowUpRight className="size-3.5" />
        </Link>
      </CardContent>
    </Card>
  )
}
