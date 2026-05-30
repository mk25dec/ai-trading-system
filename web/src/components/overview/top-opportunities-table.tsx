import { Link } from "react-router-dom"
import { ArrowDown, ArrowUp, Minus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { resolveDecision } from "@/lib/decision-engine"
import { convictionLabel, trendFromRow } from "@/lib/overview-metrics"
import type { ResearchStockRow } from "@/lib/pipeline-api"
import { cn } from "@/lib/utils"

function TrendIcon({ trend }: { trend: "up" | "down" | "flat" }) {
  if (trend === "up") return <ArrowUp className="size-4 text-emerald-600" />
  if (trend === "down") return <ArrowDown className="size-4 text-red-600" />
  return <Minus className="size-4 text-muted-foreground" />
}

function ConvictionBadge({ confidence }: { confidence: number }) {
  const label = convictionLabel(confidence)
  return (
    <Badge
      variant="secondary"
      className={cn(
        "font-medium",
        label === "High" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
        label === "Medium" && "bg-amber-500/15 text-amber-700 dark:text-amber-300",
        label === "Low" && "bg-red-500/15 text-red-700 dark:text-red-400",
      )}
    >
      {label}
    </Badge>
  )
}

export function TopOpportunitiesTable({ rows }: { rows: ResearchStockRow[] }) {
  const top = rows.slice(0, 5)

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Top opportunities</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Symbol</TableHead>
              <TableHead className="text-right">Opportunity score</TableHead>
              <TableHead>Conviction</TableHead>
              <TableHead className="w-10">Trend</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {top.map((row) => {
              const decision = resolveDecision(row)
              const needsReview =
                decision.primaryAction === "buy_candidate" ||
                decision.primaryAction === "sell_candidate"
              return (
                <TableRow key={row.symbol}>
                  <TableCell className="font-mono font-semibold">{row.symbol}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Math.round(decision.compositeScore)}
                  </TableCell>
                  <TableCell>
                    <ConvictionBadge confidence={row.confidence} />
                  </TableCell>
                  <TableCell>
                    <TrendIcon trend={trendFromRow(row)} />
                  </TableCell>
                  <TableCell className="text-right">
                    {needsReview ? (
                      <Button render={<Link to="/research" />} size="sm" variant="default">
                        Review
                      </Button>
                    ) : (
                      <Badge variant="outline">Monitoring</Badge>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
            {top.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Add symbols on Research and refresh to see opportunities
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
