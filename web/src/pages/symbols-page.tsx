import { useQuery } from "@tanstack/react-query"
import { pipelineApi } from "@/lib/pipeline-api"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function SymbolsPage() {
  const symbols = useQuery({
    queryKey: ["symbols"],
    queryFn: pipelineApi.symbols,
    refetchInterval: 120_000,
  })

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Market data</h1>
        <p className="mt-2 text-muted-foreground">
          Active symbol universe and latest candle freshness from Alpaca ingestion
        </p>
      </header>

      <Card className="border-border/70 shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Last close</TableHead>
                <TableHead>Latest candle</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(symbols.data ?? []).map((row) => {
                const stale =
                  !row.latestCandleAt ||
                  Date.now() - new Date(row.latestCandleAt).getTime() > 3 * 24 * 3600 * 1000
                return (
                  <TableRow key={row.symbol}>
                    <TableCell className="font-mono font-medium">{row.symbol}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>
                      {row.lastClose != null ? row.lastClose.toFixed(2) : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.latestCandleAt
                        ? new Date(row.latestCandleAt).toLocaleString()
                        : "No data"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={stale ? "destructive" : "default"}>
                        {stale ? "stale" : "ok"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
