import { useQuery } from "@tanstack/react-query"
import { useParams } from "react-router-dom"
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

export function WorkspaceSignalsPage() {
  const { id } = useParams<{ id: string }>()
  const workspace = useQuery({
    queryKey: ["workspace", id],
    queryFn: () => api.get<WorkspaceWithRole>(`/api/v1/workspaces/${id}`),
    enabled: !!id,
  })
  const signals = useQuery({
    queryKey: ["workspace-signals", id],
    queryFn: () => pipelineApi.workspaceSignals(id!),
    enabled: !!id,
    refetchInterval: 120_000,
  })

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          Signals{workspace.data ? ` · ${workspace.data.name}` : ""}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Workspace-specific opportunities from combined feature snapshots
        </p>
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
                <TableHead>Time</TableHead>
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
                    {new Date(sig.timestamp).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
              {(signals.data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No signals yet. Configure watchlist and run workspace signal generation.
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
