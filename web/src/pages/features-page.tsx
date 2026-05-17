import { useQuery } from "@tanstack/react-query"
import { pipelineApi } from "@/lib/pipeline-api"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function FeaturesPage() {
  const snapshots = useQuery({
    queryKey: ["snapshots"],
    queryFn: pipelineApi.snapshots,
    refetchInterval: 120_000,
  })

  const ranked = [...(snapshots.data ?? [])].sort(
    (a, b) => (b.combinedScore ?? 0) - (a.combinedScore ?? 0)
  )

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Features</h1>
        <p className="mt-2 text-muted-foreground">
          Combined market and news feature snapshots per symbol
        </p>
      </header>

      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Ranked symbols</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Combined score</TableHead>
                <TableHead>24h price %</TableHead>
                <TableHead>News 24h</TableHead>
                <TableHead>Avg sentiment 24h</TableHead>
                <TableHead>Quality</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranked.map((snap) => {
                const mf = snap.marketFeatures
                const nf = snap.newsFeatures
                const price = mf.priceChange24h as number | undefined
                const newsCount = nf.newsCount24h as number | undefined
                const sentiment = nf.avgSentiment24h as number | undefined
                return (
                  <TableRow key={`${snap.symbol}-${snap.timestamp}`}>
                    <TableCell className="font-mono font-medium">{snap.symbol}</TableCell>
                    <TableCell>
                      {snap.combinedScore != null ? snap.combinedScore.toFixed(2) : "—"}
                    </TableCell>
                    <TableCell>{price != null ? `${price.toFixed(2)}%` : "—"}</TableCell>
                    <TableCell>{newsCount ?? "—"}</TableCell>
                    <TableCell>
                      {sentiment != null ? sentiment.toFixed(2) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={snap.dataQualityScore >= 0.7 ? "default" : "secondary"}>
                        {(snap.dataQualityScore * 100).toFixed(0)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(snap.timestamp).toLocaleString()}
                    </TableCell>
                  </TableRow>
                )
              })}
              {ranked.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No snapshots yet — run market/news feature workflows first.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
