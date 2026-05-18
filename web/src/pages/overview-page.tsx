import { useQuery } from "@tanstack/react-query"
import { Building2, Users } from "lucide-react"
import { WorkspaceToolbar } from "@/components/workspace-toolbar"
import { api, type WorkspaceWithRole } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useDataRefresh } from "@/hooks/use-data-refresh"
import { useWorkspace } from "@/hooks/use-workspace"
import { pipelineApi } from "@/lib/pipeline-api"

export function OverviewPage() {
  const { user } = useAuth()
  const { workspaceId, selectWorkspace, workspaces, activeWorkspace } = useWorkspace()
  const { refresh, lastRefreshedAt } = useDataRefresh(workspaceId)

  const workspacesQuery = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => api.get<WorkspaceWithRole[]>("/api/v1/workspaces"),
  })

  const watchlist = useQuery({
    queryKey: ["watchlist", workspaceId],
    queryFn: () => pipelineApi.watchlist(workspaceId),
    enabled: !!workspaceId,
  })

  const activeSymbols = (watchlist.data ?? []).filter((e) => e.isActive).map((e) => e.symbol)

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Hello{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="mt-2 text-muted-foreground">
            News, market data, features, and data health are scoped to your{" "}
            {activeWorkspace ? (
              <span className="font-medium text-foreground">{activeWorkspace.name}</span>
            ) : (
              "workspace"
            )}{" "}
            watchlist.
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Workspaces"
          value={workspacesQuery.data?.length ?? "—"}
          icon={Building2}
          hint="Teams and environments you can access"
        />
        <StatCard
          title="Watchlist symbols"
          value={activeSymbols.length}
          icon={Building2}
          hint={
            activeSymbols.length > 0
              ? activeSymbols.join(", ")
              : "Add symbols on Research"
          }
        />
        {user?.platformRole === "admin" && (
          <StatCard
            title="Your role"
            value="Platform admin"
            icon={Users}
            hint="Manage users and all workspaces"
          />
        )}
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  icon: Icon,
  hint,
}: {
  title: string
  value: string | number
  icon: typeof Building2
  hint: string
}) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="size-4 text-primary" />
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}
