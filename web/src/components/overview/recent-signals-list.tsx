import { Link } from "react-router-dom"
import { ArrowDownRight, ArrowUpRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { convictionLabel, timeAgo } from "@/lib/overview-metrics"
import type { WorkspaceSignal } from "@/lib/pipeline-api"
import { cn } from "@/lib/utils"

function sentimentFromSignal(sig: WorkspaceSignal): "Bullish" | "Bearish" | "Neutral" {
  if (sig.direction === "long" || sig.action === "buy_candidate") return "Bullish"
  if (sig.direction === "short" || sig.action === "sell_candidate" || sig.action === "avoid") {
    return "Bearish"
  }
  return "Neutral"
}

export function RecentSignalsList({
  signals,
  signalsHref,
}: {
  signals: WorkspaceSignal[]
  signalsHref: string
}) {
  const recent = [...signals]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 5)

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold">Recent signals</CardTitle>
        <Link to={signalsHref} className="text-xs font-medium text-primary hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {recent.map((sig) => {
          const sentiment = sentimentFromSignal(sig)
          const conviction = convictionLabel(sig.confidence)
          const bullish = sentiment === "Bullish"
          return (
            <div
              key={sig.id}
              className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2.5"
            >
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full",
                  bullish ? "bg-emerald-500/15" : "bg-red-500/15",
                )}
              >
                {bullish ? (
                  <ArrowUpRight className="size-4 text-emerald-600" />
                ) : (
                  <ArrowDownRight className="size-4 text-red-600" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold">{sig.symbol}</span>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      bullish ? "text-emerald-600" : "text-red-600",
                    )}
                  >
                    {sentiment}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{timeAgo(sig.timestamp)}</p>
              </div>
              <Badge
                variant="secondary"
                className={cn(
                  conviction === "High" && "bg-emerald-500/15 text-emerald-700",
                  conviction === "Medium" && "bg-amber-500/15 text-amber-700",
                )}
              >
                {conviction}
              </Badge>
            </div>
          )
        })}
        {recent.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No signals generated yet
          </p>
        )}
      </CardContent>
    </Card>
  )
}
