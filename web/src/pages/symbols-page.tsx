import { useQuery } from "@tanstack/react-query"
import { WorkspaceToolbar } from "@/components/workspace-toolbar"
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
import { useDataRefresh } from "@/hooks/use-data-refresh"
import { formatDateTime, useWorkspace } from "@/hooks/use-workspace"
import { pipelineApi } from "@/lib/pipeline-api"

export function SymbolsPage() {
  const { workspaceId, selectWorkspace, workspaces, activeWorkspace } = useWorkspace()
  const { refresh, lastRefreshedAt } = useDataRefresh(workspaceId)

  const symbols = useQuery({
    queryKey: ["symbols", workspaceId],
    queryFn: () => pipelineApi.symbols(workspaceId),
    enabled: !!workspaceId,
    refetchInterval: 120_000,
  })

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Market data</h1>
          <p className="mt-2 text-muted-foreground">
            Watchlist symbols for{" "}
            {activeWorkspace ? (
              <span className="font-medium text-foreground">{activeWorkspace.name}</span>
            ) : (
              "your workspace"
            )}{" "}
            — candle freshness from Alpaca ingestion
          </p>
        </div>
        <WorkspaceToolbar
          workspaceId={workspaceId}
          workspaces={workspaces}
          onWorkspaceChange={selectWorkspace}
          onRefresh={() => refresh.mutate()}
          isRefreshing={refresh.isPending}
          lastRefreshedAt={lastRefreshedAt}
        />
      </header>

      <Card className="border-border/70 shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Last close</TableHead>
                <TableHead>Latest bar</TableHead>
                <TableHead>Data fetched at</TableHead>
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
                      {formatDateTime(row.latestCandleAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(row.dataFetchedAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={stale ? "destructive" : "default"}>
                        {stale ? "stale" : "ok"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
              {(symbols.data ?? []).length === 0 && workspaceId && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No watchlist symbols — add symbols on Research, then click Get latest data.
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
