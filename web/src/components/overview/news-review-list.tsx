import { Link } from "react-router-dom"
import { Newspaper } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { timeAgo } from "@/lib/overview-metrics"
import type { NewsBacklogItem } from "@/lib/pipeline-api"

function impactLevel(item: NewsBacklogItem): "High" | "Medium" | "Low" {
  if (item.rawSymbolGuess.length >= 2) return "High"
  if (item.rawSymbolGuess.length === 1) return "Medium"
  return "Low"
}

export function NewsReviewList({ items }: { items: NewsBacklogItem[] }) {
  const pending = items
    .filter((i) => i.status === "new" || i.status === "fetched")
    .slice(0, 4)

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold">News requiring review</CardTitle>
        <Link to="/news" className="text-xs font-medium text-primary hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {pending.map((item) => {
          const impact = impactLevel(item)
          return (
            <div key={item.id} className="flex gap-3 rounded-lg border border-border/60 p-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Newspaper className="size-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-medium leading-snug">{item.title}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{item.source}</span>
                  <span>·</span>
                  <span>{timeAgo(item.discoveredAt)}</span>
                  {item.rawSymbolGuess.length > 0 && (
                    <>
                      <span>·</span>
                      <span className="font-mono">{item.rawSymbolGuess.join(", ")}</span>
                    </>
                  )}
                </div>
              </div>
              <Badge
                variant={impact === "High" ? "destructive" : "secondary"}
                className="h-fit shrink-0"
              >
                {impact}
              </Badge>
            </div>
          )
        })}
        {pending.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No news items pending review
          </p>
        )}
      </CardContent>
    </Card>
  )
}
