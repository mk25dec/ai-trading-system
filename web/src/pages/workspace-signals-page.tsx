import { useQuery } from "@tanstack/react-query"
import { useParams } from "react-router-dom"
import { WorkspaceToolbar } from "@/components/workspace-toolbar"
import { pipelineApi } from "@/lib/pipeline-api"
import { api, type WorkspaceWithRole } from "@/lib/api"
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

export function WorkspaceSignalsPage() {
  const { id: routeWorkspaceId } = useParams<{ id: string }>()
  const { workspaceId: storedId, selectWorkspace, workspaces } = useWorkspace()
  const workspaceId = routeWorkspaceId ?? storedId
  const { refresh, lastRefreshedAt } = useDataRefresh(workspaceId)

  const workspace = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => api.get<WorkspaceWithRole>(`/api/v1/workspaces/${workspaceId}`),
    enabled: !!workspaceId,
  })
  const signals = useQuery({
    queryKey: ["workspace-signals", workspaceId],
    queryFn: () => pipelineApi.workspaceSignals(workspaceId),
    enabled: !!workspaceId,
    refetchInterval: 120_000,
  })

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Signals{workspace.data ? ` · ${workspace.data.name}` : ""}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Workspace signals for watchlist symbols only
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
          <CardTitle className="text-base">Latest signals</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Generated at</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(signals.data ?? []).map((sig) => (
                <TableRow key={sig.id}>
                  <TableCell className="font-mono font-medium">{sig.symbol}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        sig.action === "buy_candidate"
                          ? "default"
                          : sig.action === "avoid"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {sig.action}
                    </Badge>
                  </TableCell>
                  <TableCell>{sig.score.toFixed(2)}</TableCell>
                  <TableCell>{(sig.confidence * 100).toFixed(0)}%</TableCell>
                  <TableCell>{sig.status}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(sig.timestamp)}
                  </TableCell>
                </TableRow>
              ))}
              {(signals.data ?? []).length === 0 && workspaceId && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No signals yet. Add watchlist symbols and click Get latest data.
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
