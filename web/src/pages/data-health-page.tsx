import { useQuery } from "@tanstack/react-query"
import { Activity, AlertTriangle, CheckCircle2 } from "lucide-react"
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

export function DataHealthPage() {
  const runs = useQuery({
    queryKey: ["workflow-runs"],
    queryFn: pipelineApi.workflowRuns,
    refetchInterval: 60_000,
  })

  const latestByName = new Map<string, NonNullable<typeof runs.data>[number]>()
  for (const run of runs.data ?? []) {
    const existing = latestByName.get(run.workflowName)
    if (!existing || run.startedAt > existing.startedAt) {
      latestByName.set(run.workflowName, run)
    }
  }

  const failed = (runs.data ?? []).filter((r) => r.status === "failed").length
  const success = (runs.data ?? []).filter((r) => r.status === "success").length

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Data health</h1>
        <p className="mt-2 text-muted-foreground">
          Workflow run history, freshness, and ingestion errors
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat title="Successful runs" value={success} icon={CheckCircle2} />
        <Stat title="Failed runs" value={failed} icon={AlertTriangle} tone={failed > 0 ? "warn" : "ok"} />
        <Stat title="Workflows tracked" value={latestByName.size} icon={Activity} />
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Latest run per workflow</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workflow</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from(latestByName.values()).map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="font-medium">{run.workflowName}</TableCell>
                  <TableCell>
                    <StatusBadge status={run.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(run.startedAt).toLocaleString()}
                  </TableCell>
                  <TableCell>{run.itemsProcessed}</TableCell>
                  <TableCell>{run.durationMs != null ? `${run.durationMs}ms` : "—"}</TableCell>
                  <TableCell className="max-w-xs truncate text-destructive">
                    {run.errorMessage ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
              {latestByName.size === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No workflow runs yet — n8n schedules will populate this view.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Recent runs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workflow</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Items</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(runs.data ?? []).slice(0, 25).map((run) => (
                <TableRow key={run.id}>
                  <TableCell>{run.workflowName}</TableCell>
                  <TableCell>
                    <StatusBadge status={run.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(run.startedAt).toLocaleString()}
                  </TableCell>
                  <TableCell>{run.itemsProcessed}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function Stat({
  title,
  value,
  icon: Icon,
  tone = "ok",
}: {
  title: string
  value: number
  icon: typeof Activity
  tone?: "ok" | "warn"
}) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={tone === "warn" ? "size-4 text-amber-500" : "size-4 text-primary"} />
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "success" ? "default" : status === "failed" ? "destructive" : "secondary"
  return <Badge variant={variant}>{status}</Badge>
}
