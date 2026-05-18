import { useQuery } from "@tanstack/react-query"
import { WorkspaceToolbar } from "@/components/workspace-toolbar"
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
import { useDataRefresh } from "@/hooks/use-data-refresh"
import { formatDateTime, useWorkspace } from "@/hooks/use-workspace"
import { pipelineApi } from "@/lib/pipeline-api"

export function FeaturesPage() {
  const { workspaceId, selectWorkspace, workspaces, activeWorkspace } = useWorkspace()
  const { refresh, lastRefreshedAt } = useDataRefresh(workspaceId)

  const snapshots = useQuery({
    queryKey: ["snapshots", workspaceId],
    queryFn: () => pipelineApi.snapshots(workspaceId),
    enabled: !!workspaceId,
    refetchInterval: 120_000,
  })

  const ranked = [...(snapshots.data ?? [])].sort(
    (a, b) => (b.combinedScore ?? 0) - (a.combinedScore ?? 0),
  )

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Features</h1>
          <p className="mt-2 text-muted-foreground">
            Combined market and news snapshots for{" "}
            {activeWorkspace ? (
              <span className="font-medium text-foreground">{activeWorkspace.name}</span>
            ) : (
              "your workspace"
            )}{" "}
            watchlist only
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
        <CardHeader>
          <CardTitle className="text-base">Ranked watchlist symbols</CardTitle>
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
                <TableHead>Snapshot at</TableHead>
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
                      {formatDateTime(snap.timestamp)}
                    </TableCell>
                  </TableRow>
                )
              })}
              {ranked.length === 0 && workspaceId && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No snapshots yet — click Get latest data after adding watchlist symbols.
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
